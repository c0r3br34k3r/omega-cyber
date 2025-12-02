defmodule OmegaOrchestratorElixir.Orchestrator do
  @moduledoc """
  The `OmegaOrchestratorElixir.Orchestrator` module acts as a top-level supervisor
  for the Elixir-based components of the Omega Platform's orchestration layer.
  It is responsible for ensuring the health and coordinating the lifecycle of
  critical processes, including monitoring the Scala/Akka scheduler and managing
  dynamic worker processes.

  This supervisor employs a `:one_for_one` strategy, meaning if a child process
  crashes, only that child is restarted, ensuring isolation of failures.
  """
  use Supervisor

  require Logger

  # --- Client API ---
  @doc """
  Starts the Orchestrator supervisor.
  """
  def start_link(init_arg) do
    Supervisor.start_link(__MODULE__, init_arg, name: __MODULE__)
  end

  # --- Supervisor Callbacks ---
  @impl true
  def init(_init_arg) do
    Logger.info("Starting OmegaOrchestratorElixir supervisor...")

    children = [
      # --- 1. Scala/Akka Scheduler Health Monitor ---
      # This GenServer periodically pings the Scala/Akka scheduler's health endpoint
      # and reports its status. If the Scala service goes down, this monitor detects it.
      {OmegaOrchestratorElixir.ScalaAkkaMonitor, []},

      # --- 2. Dynamic Worker Spawner ---
      # A GenServer that manages the lifecycle of dynamic worker processes,
      # potentially starting/stopping microservice instances based on demand or events.
      # For now, a placeholder that could be extended to manage specific tasks
      # delegated by the Scala/Akka scheduler or Intelligence Core.
      {OmegaOrchestratorElixir.DynamicWorkerSpawner, []},

      # --- 3. Distributed State Manager ---
      # Utilizes Swarm to maintain a distributed, eventually consistent state
      # across the Elixir cluster, e.g., status of dynamically deployed services.
      # {Swarm.Registry, name: OmegaOrchestratorElixir.StateRegistry},
      # {OmegaOrchestratorElixir.DistributedStateManager, []},

      # --- 4. Alert Forwarder ---
      # Listens for critical events (e.g., Scala/Akka scheduler failure,
      # resource starvation) and forwards them to the Mesh Network or
      # Intelligence Core for broader awareness and response.
      {OmegaOrchestratorElixir.AlertForwarder, []}
    ]

    # Use a :one_for_one strategy: if a child crashes, restart only that child.
    Supervisor.init(children, strategy: :one_for_one)
  end
end

# --- Child Worker: Scala/Akka Health Monitor ---
defmodule OmegaOrchestratorElixir.ScalaAkkaMonitor do
  @moduledoc """
  A `GenServer` that periodically monitors the health of the Scala/Akka Scheduler
  component. It can use HTTP or gRPC to check the status.
  """
  use GenServer

  require Logger
  alias OmegaOrchestratorElixir.AlertForwarder

  # Client API
  def start_link(init_arg) do
    GenServer.start_link(__MODULE__, init_arg, name: __MODULE__)
  end

  # Callbacks
  @impl true
  def init(init_arg) do
    akka_grpc_address = Application.get_env(:omega_orchestrator_elixir, :akka_grpc_address)
    interval = Application.get_env(:omega_orchestrator_elixir, :akka_health_check_interval_ms)
    
    Logger.info("ScalaAkkaMonitor starting. Checking Akka at #{akka_grpc_address} every #{interval}ms.")
    :timer.send_interval(interval, self(), :check_health)
    {:ok, %{akka_grpc_address: akka_grpc_address, status: :unknown}}
  end

  @impl true
  def handle_info(:check_health, state) do
    case check_akka_status(state.akka_grpc_address) do
      {:ok, :healthy} ->
        if state.status != :healthy do
          Logger.info("Scala/Akka Scheduler is now HEALTHY.")
          AlertForwarder.forward_alert({:info, "Scala/Akka Scheduler is now HEALTHY"})
          {:noreply, %{state | status: :healthy}}
        else
          {:noreply, state}
        end
      {:error, reason} ->
        if state.status != :unhealthy do
          Logger.error("Scala/Akka Scheduler is UNHEALTHY: #{inspect(reason)}")
          AlertForwarder.forward_alert({:critical, "Scala/Akka Scheduler is UNHEALTHY: #{inspect(reason)}"})
          {:noreply, %{state | status: :unhealthy}}
        else
          {:noreply, state}
        end
    end
  end

  # --- Private Functions ---
  defp check_akka_status(address) do
    # In a real scenario, this would be a gRPC call to a health endpoint
    # For now, simulate HTTP health check
    case HTTPoison.get("#{address}/health") do
      {:ok, %HTTPoison.Response{status_code: 200, body: "OK"}} ->
        {:ok, :healthy}
      {:ok, %HTTPoison.Response{status_code: code}} ->
        {:error, "HTTP status code: #{code}"}
      {:error, %HTTPoison.Error{reason: reason}} ->
        {:error, reason}
    end
  end
end

# --- Child Worker: Dynamic Worker Spawner ---
defmodule OmegaOrchestratorElixir.DynamicWorkerSpawner do
  @moduledoc """
  A `GenServer` responsible for dynamically starting, stopping, or reconfiguring
  other worker processes based on events or policies.
  """
  use GenServer
  require Logger

  # Client API
  def start_link(init_arg) do
    GenServer.start_link(__MODULE__, init_arg, name: __MODULE__)
  end

  # Callbacks
  @impl true
  def init(_init_arg) do
    Logger.info("DynamicWorkerSpawner starting...")
    {:ok, %{}}
  end

  @impl true
  def handle_cast({:spawn_worker, worker_spec}, state) do
    Logger.info("Spawning new worker with spec: #{inspect(worker_spec)}")
    # Logic to dynamically add a child to a supervisor or start a GenServer directly
    # Example: {MyWorker, worker_spec} |> Supervisor.start_child(MySupervisor)
    {:noreply, state}
  end
end

# --- Child Worker: Alert Forwarder ---
defmodule OmegaOrchestratorElixir.AlertForwarder do
  @moduledoc """
  A `GenServer` that listens for critical events and forwards them to
  the Mesh Network or Intelligence Core.
  """
  use GenServer
  require Logger

  # Client API
  def start_link(init_arg) do
    GenServer.start_link(__MODULE__, init_arg, name: __MODULE__)
  end

  def forward_alert(alert_tuple) do
    GenServer.cast(__MODULE__, {:alert, alert_tuple})
  end

  # Callbacks
  @impl true
  def init(_init_arg) do
    Logger.info("AlertForwarder starting...")
    # Subscribe to internal PubSub topics for alerts
    Phoenix.PubSub.subscribe(OmegaOrchestratorElixir.PubSub, "orchestration_alerts")
    {:ok, %{}}
  end

  @impl true
  def handle_cast({:alert, {level, message}}, state) do
    Logger.log(level, "Forwarding alert: #{message}")
    # In a real system, this would involve:
    # 1. Sending a gRPC message to the Go Mesh Network
    # 2. Sending a Kafka message to the Intelligence Core
    # 3. Pushing to a monitoring system
    {:noreply, state}
  end

  @impl true
  def handle_info({:info, _event}, state) do
    # Handle internal events received via PubSub
    {:noreply, state}
  end
end
