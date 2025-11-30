package orchestration

import scala.collection.mutable
import scala.concurrent.{Future, Await}
import scala.concurrent.duration._
import scala.concurrent.ExecutionContext.Implicits.global

object Scheduler {

  private val scheduledTasks: mutable.Map[String, String] = mutable.Map[String, String]()

  /**
   * Placeholder for high-concurrency scheduling logic.
   * Schedules a task to be executed after a simulated delay.
   */
  def scheduleTask(taskId: String, taskDetails: String): Future[String] = {
    println(s"[${java.time.LocalTime.now()}] Scheduling task: $taskId with details: $taskDetails")
    scheduledTasks.put(taskId, "SCHEDULED")

    Future {
      Thread.sleep(randomDelay()) // Simulate task processing time
      println(s"[${java.time.LocalTime.now()}] Executing task: $taskId")
      // In a real system, this would involve complex task execution logic
      scheduledTasks.put(taskId, "COMPLETED")
      s"Task $taskId completed"
    }
  }

  /**
   * Simulates a random delay for task execution.
   */
  private def randomDelay(): Long = {
    (scala.util.Random.nextInt(500) + 500).toLong // 500ms to 1000ms
  }

  /**
   * Retrieves the current status of a scheduled task.
   */
  def getTaskStatus(taskId: String): String = {
    scheduledTasks.getOrElse(taskId, "NOT_FOUND")
  }

  def main(args: Array[String]): Unit = {
    println("Scala Scheduler started.")
    val future1 = scheduleTask("task_alpha", "analyze_logs")
    val future2 = scheduleTask("task_beta", "update_firmware")

    Await.result(future1, 2.seconds)
    Await.result(future2, 2.seconds)

    println(s"Status of task_alpha: ${getTaskStatus("task_alpha")}")
    println(s"Status of task_beta: ${getTaskStatus("task_beta")}")
    println(s"Status of task_gamma (non-existent): ${getTaskStatus("task_gamma")}")
  }
}