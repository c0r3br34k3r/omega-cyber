defmodule Orchestration.Orchestrator do
  use GenServer

  @moduledoc """
  Placeholder for high-concurrency orchestration logic.
  Simulates scheduling and executing tasks.
  """

  # Client API
  def start_link(opts) do
    GenServer.start_link(__MODULE__, :ok, opts)
  end

  def schedule_task(orchestrator, task_id, task_details) do
    GenServer.cast(orchestrator, {:schedule, task_id, task_details})
  end

  def get_task_status(orchestrator, task_id) do
    GenServer.call(orchestrator, {:status, task_id})
  end

  # GenServer Callbacks
  @impl true
  def init(:ok) do
    IO.puts "Orchestrator started."
    {:ok, %{tasks: %{}}} # State will hold scheduled tasks
  end

  @impl true
  def handle_cast({:schedule, task_id, task_details}, state) do
    IO.puts "Scheduling task: #{inspect(task_id)} with details #{inspect(task_details)}"
    # Simulate execution after a delay
    Process.send_after(self(), {:execute_task, task_id}, 100) # Execute after 100ms
    new_state = Map.put(state.tasks, task_id, %{details: task_details, status: :scheduled})
    {:noreply, %{tasks: new_state}}
  end

  @impl true
  def handle_call({:status, task_id}, _from, state) do
    status = Map.get(state.tasks, task_id, %{status: :not_found})
    {:reply, status, state}
  end

  @impl true
  def handle_info({:execute_task, task_id}, state) do
    case Map.get(state.tasks, task_id) do
      nil ->
        IO.puts "Task #{inspect(task_id)} not found for execution."
        {:noreply, state}
      task_info ->
        IO.puts "Executing task: #{inspect(task_id)}"
        # Simulate execution logic here
        new_task_info = Map.put(task_info, :status, :completed)
        new_state = Map.put(state.tasks, task_id, new_task_info)
        {:noreply, %{tasks: new_state}}
    end
  end
end