defmodule Orchestration.OrchestratorTest do
  use ExUnit.Case, async: true
  doctest Orchestration.Orchestrator

  setup do
    {:ok, orchestrator_pid} = Orchestration.Orchestrator.start_link([])
    %{orchestrator_pid: orchestrator_pid}
  end

  test "schedules and executes a task", %{orchestrator_pid: pid} do
    task_id = "task_123"
    task_details = %{type: "deploy_agent", target: "host_a"}

    Orchestration.Orchestrator.schedule_task(pid, task_id, task_details)

    # Allow time for the cast message to be processed and task to be executed
    Process.sleep(200)

    status = Orchestration.Orchestrator.get_task_status(pid, task_id)
    assert status.status == :completed
    assert status.details == task_details
  end

  test "returns not_found for non-existent task", %{orchestrator_pid: pid} do
    status = Orchestration.Orchestrator.get_task_status(pid, "non_existent_task")
    assert status.status == :not_found
  end
end
