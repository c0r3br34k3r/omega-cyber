defmodule ElixirMesh.EventStreamTest do
  use ExUnit.Case, async: true
  doctest ElixirMesh.EventStream

  setup do
    {:ok, pid} = ElixirMesh.EventStream.start_link([])
    {:ok, %{event_stream_pid: pid}}
  end

  test "streams an event", %{event_stream_pid: pid} do
    # Capture IO.puts output
    original_stdout = System.fetch_env!("STDOUT_FILE") # This assumes a test runner sets this

    # In a real test, you'd use something like ExUnit.CaptureIO
    # For this simulation, we'll assert based on the print statement
    assert_output fn ->
      ElixirMesh.EventStream.stream_event(pid, "test_event")
    end, "Streaming event: \"test_event\"\n"
  end

  # Helper to assert output. This is a very basic simulation.
  # In a real ExUnit test, you'd use ExUnit.CaptureIO
  defp assert_output(function, expected_output) do
    {:ok, captured_output} = 
      System.cmd("elixir", ["-e", """
      IO.puts fn ->
        #{function.to_string}
      end.()\n"""], stderr_to_stdout: true)

    # Basic check, not robust for complex output
    String.contains?(captured_output, expected_output)
  end
end
