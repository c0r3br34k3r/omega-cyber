package io.omega.orchestration.scheduler

import akka.actor.typed.scaladsl.Behaviors
import akka.actor.typed.{ActorRef, ActorSystem, Behavior, SupervisorStrategy}
import akka.actor.typed.scaladsl.LoggerOps
import akka.cluster.sharding.typed.scaladsl.{ClusterSharding, Entity, EntityTypeKey}
import akka.cluster.typed.{Cluster, SelfUp, Subscribe}
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import akka.stream.scaladsl.{Keep, Sink, Source}
import akka.stream.{Materializer, SystemMaterializer}
import com.typesafe.config.{Config, ConfigFactory}
import io.grpc.Status
import io.omega.orchestration.proto.scheduler._ // Assuming generated gRPC code
import io.omega.orchestration.proto.scheduler.SchedulerServiceHandler
import kamon.Kamon
import kamon.system.SystemMetrics
import kamon.prometheus.PrometheusReporter
import org.apache.kafka.clients.producer.ProducerRecord

import scala.concurrent.duration._
import scala.concurrent.{ExecutionContextExecutor, Future}
import scala.util.{Failure, Success}
import akka.kafka.ConsumerMessage.{CommittableMessage, CommittableOffsetBatch}
import akka.kafka.scaladsl.{Consumer, Producer}
import akka.kafka.{ConsumerSettings, ProducerSettings, Subscriptions}
import org.apache.kafka.common.serialization.{ByteArrayDeserializer, ByteArraySerializer, StringDeserializer, StringSerializer}
import akka.http.scaladsl.{Http, server}
import akka.http.scaladsl.server.Directives._
import akka.grpc.scaladsl.ServiceHandler
import akka.http.scaladsl.model.{ContentTypes, HttpEntity}

// ==============================================================================
// OMEGA PLATFORM - ORCHESTRATION SCHEDULER (AKKA CLUSTER)
// ==============================================================================
//
// This is the core Scala/Akka component of the Omega Orchestration Service.
// It is a distributed, fault-tolerant, and event-sourced scheduler managing
// tasks across the entire Omega Platform.
//
// Key features:
// - Akka Cluster: For distributed deployment and high availability.
// - Akka Persistence (Event Sourcing): For reliable state management and recovery.
// - Akka Cluster Sharding: For distributing and managing worker actors.
// - Akka gRPC: High-performance, type-safe API for task submission and status streaming.
// - Akka Stream Kafka: For event-driven task ingestion and outcome publishing.
// - Kamon: Comprehensive metrics and observability.
//
// ==============================================================================


// --- 1. Task Model ---
final case class OrchestrationTask(
    id: String,
    taskType: String, // e.g., "DEPLOY_HONEYPOT", "ISOLATE_NODE", "UPDATE_POLICY"
    payload: String, // JSON payload
    priority: Int,   // 0 (high) to 10 (low)
    createdAt: Long,
    dueDate: Option[Long] = None,
    assignedTo: Option[String] = None,
    status: String = "PENDING" // "PENDING", "ASSIGNED", "COMPLETED", "FAILED"
) extends CborSerializable // Marker trait for Akka Serialization

// --- 2. Akka Persistence Event-Sourced Behavior for the Task Scheduler ---
object TaskScheduler {
  sealed trait Command extends CborSerializable
  final case class ScheduleTask(task: OrchestrationTask, replyTo: ActorRef[CommandAck]) extends Command
  final case class TaskAssigned(taskId: String, workerId: String, replyTo: ActorRef[CommandAck]) extends Command
  final case class TaskCompleted(taskId: String, result: String, replyTo: ActorRef[CommandAck]) extends Command
  final case class TaskFailed(taskId: String, reason: String, replyTo: ActorRef[CommandAck]) extends Command
  final case class GetSchedulerStatus(replyTo: ActorRef[SchedulerStatusResponse]) extends Command

  sealed trait Event extends CborSerializable
  final case class TaskScheduled(task: OrchestrationTask) extends Event
  final case class TaskAssignedEvent(taskId: String, workerId: String) extends Event
  final case class TaskCompletedEvent(taskId: String, result: String) extends Event
  final case class TaskFailedEvent(taskId: String, reason: String) extends Event

  final case class SchedulerState(
      pendingTasks: Map[String, OrchestrationTask],
      activeTasks: Map[String, OrchestrationTask],
      completedTasks: Map[String, OrchestrationTask],
      failedTasks: Map[String, OrchestrationTask]
  ) extends CborSerializable {
    def applyEvent(event: Event): SchedulerState = event match {
      case TaskScheduled(task) => copy(pendingTasks = pendingTasks + (task.id -> task.copy(status = "PENDING")))
      case TaskAssignedEvent(taskId, workerId) =>
        val task = pendingTasks(taskId).copy(status = "ASSIGNED", assignedTo = Some(workerId))
        copy(pendingTasks = pendingTasks - taskId, activeTasks = activeTasks + (taskId -> task))
      case TaskCompletedEvent(taskId, result) =>
        val task = activeTasks(taskId).copy(status = "COMPLETED", payload = result)
        copy(activeTasks = activeTasks - taskId, completedTasks = completedTasks + (taskId -> task))
      case TaskFailedEvent(taskId, reason) =>
        val task = activeTasks(taskId).copy(status = "FAILED", payload = reason)
        copy(activeTasks = activeTasks - taskId, failedTasks = failedTasks + (taskId -> task))
    }

    def getStatusResponse: SchedulerStatusResponse =
      SchedulerStatusResponse(
        pendingTasks.size,
        activeTasks.size,
        completedTasks.size,
        failedTasks.size,
        pendingTasks.values.map(t => TaskInfo(t.id, t.taskType, t.status)).toSeq,
        activeTasks.values.map(t => TaskInfo(t.id, t.taskType, t.status, t.assignedTo)).toSeq
      )
  }

  val emptyState: SchedulerState = SchedulerState(Map.empty, Map.empty, Map.empty, Map.empty)

  final case class CommandAck(taskId: String, success: Boolean, message: String) extends CborSerializable

  def apply(persistenceId: PersistenceId): Behavior[Command] =
    EventSourcedBehavior[Command, Event, SchedulerState](
      persistenceId,
      emptyState,
      (state, command) => commandHandler(state, command),
      (state, event) => state.applyEvent(event)
    ).withTagger(_ => Set("task-scheduler")).withRetention(EventSourcedBehavior.RetentionCriteria.snapshotEvery(100, 2))

  def commandHandler(state: SchedulerState, command: Command): Effect[Event, SchedulerState] =
    command match {
      case ScheduleTask(task, replyTo) =>
        Effect.persist(TaskScheduled(task)).thenReply(replyTo)(_ => CommandAck(task.id, true, "Task scheduled"))
      case TaskAssigned(taskId, workerId, replyTo) =>
        if (state.pendingTasks.contains(taskId)) {
          Effect.persist(TaskAssignedEvent(taskId, workerId)).thenReply(replyTo)(_ => CommandAck(taskId, true, "Task assigned"))
        } else {
          Effect.reply(replyTo)(CommandAck(taskId, false, "Task not found or already assigned"))
        }
      case TaskCompleted(taskId, result, replyTo) =>
        if (state.activeTasks.contains(taskId)) {
          Effect.persist(TaskCompletedEvent(taskId, result)).thenReply(replyTo)(_ => CommandAck(taskId, true, "Task completed"))
        } else {
          Effect.reply(replyTo)(CommandAck(taskId, false, "Task not found or not active"))
        }
      case TaskFailed(taskId, reason, replyTo) =>
        if (state.activeTasks.contains(taskId)) {
          Effect.persist(TaskFailedEvent(taskId, reason)).thenReply(replyTo)(_ => CommandAck(taskId, true, "Task failed"))
        } else {
          Effect.reply(replyTo)(CommandAck(taskId, false, "Task not found or not active"))
        }
      case GetSchedulerStatus(replyTo) =>
        Effect.reply(replyTo)(state.getStatusResponse)
    }
}

// --- 3. Task Worker Actor (Distributed via Cluster Sharding) ---
object TaskWorker {
  sealed trait Command extends CborSerializable
  final case class AssignTask(task: OrchestrationTask, replyTo: ActorRef[CommandAck]) extends Command

  final case class WorkerState(currentTask: Option[OrchestrationTask]) extends CborSerializable

  val emptyState: WorkerState = WorkerState(None)

  def apply(workerId: String): Behavior[Command] =
    Behaviors.setup { ctx =>
      Behaviors.receiveMessage {
        case AssignTask(task, replyTo) =>
          ctx.log.infoN("Worker {} assigned task {}", workerId, task.id)
          // Simulate work
          Behaviors.withTimers { timers =>
            timers.startSingleTimer("work-timer", PerformWork(task, replyTo), 5.seconds)
            Behaviors.unhandled
          }
        case PerformWork(task, replyTo) =>
            if (Math.random() > 0.1) { // 10% chance of failure
              replyTo ! CommandAck(task.id, true, s"Task ${task.id} completed successfully by ${workerId}")
            } else {
              replyTo ! CommandAck(task.id, false, s"Task ${task.id} failed due to some reason on ${workerId}")
            }
          Behaviors.stopped
        case _ => Behaviors.unhandled
      }
    }

  final case class CommandAck(taskId: String, success: Boolean, message: String) extends CborSerializable
  private final case class PerformWork(task: OrchestrationTask, replyTo: ActorRef[CommandAck]) extends Command
}

// --- 4. gRPC Service Implementation ---
class SchedulerServiceImpl(system: ActorSystem[_], schedulerActor: ActorRef[TaskScheduler.Command]) extends SchedulerService {
  implicit val sys: ActorSystem[_] = system
  implicit val ec: ExecutionContextExecutor = system.executionContext

  override def scheduleTask(in: ScheduleTaskRequest): Future[ScheduleTaskResponse] = {
    val taskId = s"task-${java.util.UUID.randomUUID.toString}"
    val task = OrchestrationTask(taskId, in.taskType, in.payload, in.priority, System.currentTimeMillis())
    
    // Ask the scheduler actor to schedule the task
    system.askWithStatus[TaskScheduler.CommandAck](
      TaskScheduler.ScheduleTask(task, _),
      5.seconds // Timeout
    ).map {
      case TaskScheduler.CommandAck(_, true, msg) => ScheduleTaskResponse(true, msg, taskId)
      case TaskScheduler.CommandAck(_, false, msg) => ScheduleTaskResponse(false, msg, taskId)
    }.recover {
      case e =>
        system.log.error(e, "Error scheduling task")
        ScheduleTaskResponse(false, s"Failed to schedule task: ${e.getMessage}", taskId)
    }
  }

  override def getSchedulerStatus(in: GetSchedulerStatusRequest): Future[SchedulerStatusResponse] = {
    system.askWithStatus[TaskScheduler.SchedulerStatusResponse](
      TaskScheduler.GetSchedulerStatus(_),
      5.seconds
    )
  }

  override def streamTaskUpdates(in: StreamTaskUpdatesRequest): Source[TaskUpdate, NotUsed] = ??? // TODO: Implement streaming updates
}

// --- 5. Main Application Entry Point ---
object SchedulerApp {
  val TaskWorkerEntityKey: EntityTypeKey[TaskWorker.Command] =
    EntityTypeKey[TaskWorker.Command]("TaskWorker")

  def apply(): Behavior[Nothing] = Behaviors.setup[Nothing] { ctx =>
    implicit val system: ActorSystem[_] = ctx.system
    implicit val mat: Materializer = SystemMaterializer(system).materializer
    implicit val ec: ExecutionContextExecutor = system.executionContext

    // Initialize Kamon metrics
    Kamon.init()
    SystemMetrics.start()
    Kamon.addReporter(new PrometheusReporter())

    // Akka Cluster
    val cluster = Cluster(system)
    ctx.log.infoN("Started Akka Cluster node: {}", cluster.selfMember.address)
    cluster.subscriptions ! Subscribe(ctx.self, classOf[SelfUp])

    // Initialize Cluster Sharding for Task Workers
    val sharding = ClusterSharding(system)
    sharding.init(Entity(TaskWorkerEntityKey) { entityContext =>
      TaskWorker(entityContext.entityId)
    }.withStopMessage(TaskWorker.CommandAck("", false, "stop")))

    // Task Scheduler Actor
    val schedulerActor: ActorRef[TaskScheduler.Command] =
      ctx.spawn(TaskScheduler(PersistenceId.ofUniqueId("task-scheduler-1")), "TaskScheduler")

    // Start gRPC server
    val service = new SchedulerServiceImpl(system, schedulerActor)
    val bound = Http(system).newServerAt("0.0.0.0", system.settings.config.getInt("grpc.port"))
      .bind(SchedulerServiceHandler(service))
    bound.onComplete {
      case Success(binding) =>
        val address = binding.localAddress
        system.log.infoN("gRPC server online at http://{}:{}/", address.getHostString, address.getPort)
      case Failure(exception) =>
        system.log.errorN("Failed to bind gRPC endpoint, terminating system: {}", exception.getMessage)
        system.terminate()
    }

    // Start HTTP Health Check Server (for Elixir Orchestrator monitoring)
    val healthRoute: server.Route =
      concat(
        pathSingleSlash {
          get {
            complete(HttpEntity(ContentTypes.`text/plain(UTF-8)`, "OK"))
          }
        },
        path("status") {
          get {
            onSuccess(system.askWithStatus[TaskScheduler.SchedulerStatusResponse](
              TaskScheduler.GetSchedulerStatus(_),
              5.seconds,
              schedulerActor
            )) { statusResponse =>
              complete(statusResponse.toString) // Or convert to JSON
            }
          }
        }
      )
    Http(system).newServerAt("0.0.0.0", system.settings.config.getInt("http.port")).bind(healthRoute)


    // Kafka Consumer for incoming tasks
    val kafkaConfig = system.settings.config.getConfig("akka.kafka.consumer")
    val consumerSettings = ConsumerSettings(kafkaConfig, new StringDeserializer, new StringDeserializer)
      .withBootstrapServers(system.settings.config.getString("kafka.bootstrap-servers"))
      .withGroupId("omega-orchestration-group")

    Consumer.committableSource(consumerSettings, Subscriptions.topics("omega.tasks.inbound"))
      .mapAsync(1) { msg: CommittableMessage[String, String] =>
        // Parse Kafka message to OrchestrationTask
        // In a real system, use JSON/Protobuf deserialization
        val taskId = s"kafka-task-${java.util.UUID.randomUUID.toString}"
        val task = OrchestrationTask(taskId, "KAFKA_TASK", msg.value(), 5, System.currentTimeMillis())
        
        // Schedule the task and then commit Kafka offset
        system.askWithStatus[TaskScheduler.CommandAck](
          TaskScheduler.ScheduleTask(task, _),
          5.seconds,
          schedulerActor
        ).map(_ => msg.committableOffset)
      }
      .batch(max = 20, seed = _ => CommittableOffsetBatch.empty) { (batch, elem) =>
        batch.updated(elem)
      }
      .mapAsync(1)(_.commitScaladsl())
      .toMat(Sink.ignore)(Keep.both)
      .run()

    // Kafka Producer for outgoing events
    val producerConfig = system.settings.config.getConfig("akka.kafka.producer")
    val producerSettings = ProducerSettings(producerConfig, new StringSerializer, new StringSerializer)
      .withBootstrapServers(system.settings.config.getString("kafka.bootstrap-servers"))

    val taskOutcomeProducer = Producer.plainSink(producerSettings)
    // You would wire the scheduler actor's outcomes to this producer sink.
    // For example, by having the scheduler actor publish events to a PubSub that this stream consumes.


    Behaviors.empty[Nothing]
  }

  def main(args: Array[String]): Unit = {
    // Load application configuration
    val config = ConfigFactory.load()
    // Start Akka Actor System
    ActorSystem[Nothing](SchedulerApp(), "OmegaOrchestration", config)
  }
}

// --- Marker Trait for Akka Serialization ---
trait CborSerializable

