defmodule ElixirMesh.EventStreamTest do
  use ExUnit.Case, async: true
  doctest ElixirMesh

  # Import the application module to access its components
  alias ElixirMesh.{Application, MeshService, PubSub, GossipService}
  require Logger

  # Setup hook: start the ElixirMesh application for each test
  setup do
    # Start the ElixirMesh application, which includes the supervisor and children
    _ = Application.start(:elixir_mesh, :test)
    :ok
  end

  # --- Test for gRPC Server-Side Streaming ---
  test "MeshService streams network events to connected clients" do
    # Mock a gRPC stream object for testing purposes
    # In a real scenario, this would be an actual gRPC client stream
    mock_grpc_stream = %{
      sent_messages: [],
      send_msg: fn (message) ->
        Logger.info("Mock GRPC Stream: Sending message #{inspect(message)}")
        # Simulate adding message to a list
        # This is a functional approach, append to a list in a separate process in real test
        Process.send(self(), {:grpc_message, message})
        :ok
      end,
      # Add other stream functions if needed, e.g., send_status, read_msg
    }

    # Start the stream call (this is a blocking call in a real client, but non-blocking here)
    # The MeshService.stream_events function will call mock_grpc_stream.send_msg
    Task.start_link(fn ->
      MeshService.stream_events(nil, mock_grpc_stream)
    end)

    # Assert that the client receives the expected number of messages
    # We expect 5 messages based on the dummy implementation in MeshService.stream_events
    expected_messages = [
      %{event_id: "elixir-event-1", type: "NODE_STATUS_UPDATE"},
      %{event_id: "elixir-event-2", type: "NODE_STATUS_UPDATE"},
      %{event_id: "elixir-event-3", type: "NODE_STATUS_UPDATE"},
      %{event_id: "elixir-event-4", type: "NODE_STATUS_UPDATE"},
      %{event_id: "elixir-event-5", type: "NODE_STATUS_UPDATE"}
    ]

    received_messages = for _ <- 1..5, do: assert_receive({:grpc_message, msg}, 2000), do: msg

    assert length(received_messages) == 5
    assert received_messages == expected_messages
  end

  # --- Test for PubSub Integration ---
  test "GossipService publishes state updates to PubSub" do
    # Create a test process to subscribe to the PubSub topic
    {:ok, subscriber_pid} = GenServer.start_link(fn -> :ok end, nil)
    PubSub.subscribe(subscriber_pid, "network_events")

    # Simulate a gossip tick, which should trigger a PubSub publish
    GenServer.cast(GossipService, :gossip_tick)

    # Assert that the subscriber receives the message
    assert_receive({:elixir_mesh_event, %{type: "GOSSIP_UPDATE", payload: _}}, 2000)
  end

  test "PQC NIF placeholder functions provide mock results" do
    # Since the NIF is mocked to return dummy data, we test that it behaves as expected
    {:ok, public_key, private_key} = ElixirMesh.PQC.generate_pqc_key_pair()
    assert public_key == "mock_public_key"
    assert private_key == "mock_private_key"

    {:ok, signature} = ElixirMesh.PQC.sign_message("some_data", private_key)
    assert signature == "mock_signature"

    {:ok, verified} = ElixirMesh.PQC.verify_message("some_data", signature, public_key)
    assert verified == true
  end
end