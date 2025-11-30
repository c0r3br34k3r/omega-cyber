defmodule ElixirMesh.Application do
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      # Start the Ecto repository
      # {ElixirMesh.Repo, otp_app: :elixir_mesh},
      # Start the Telemetry supervisor
      # ElixirMeshWeb.Telemetry,
      # Start the PubSub system
      # {Phoenix.PubSub, name: ElixirMesh.PubSub},
      # Start the Endpoint (http/https)
      # ElixirMeshWeb.Endpoint
      # Start a worker by calling: ElixirMesh.Worker.start_link(arg)
      # {ElixirMesh.Worker, arg}
      ElixirMesh.EventStream,
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: ElixirMesh.Supervisor]
    Supervisor.start_link(children, opts)
  end
end

defmodule ElixirMesh.EventStream do
  use GenServer

  # Client API
  def start_link(opts) do
    GenServer.start_link(__MODULE__, :ok, opts)
  end

  def stream_event(server, event) do
    GenServer.cast(server, {:stream, event})
  end

  # GenServer Callbacks
  @impl true
  def init(:ok) do
    IO.puts "ElixirMesh.EventStream started."
    {:ok, %{}}
  end

  @impl true
  def handle_cast({:stream, event}, state) do
    IO.puts "Streaming event: #{inspect(event)}"
    # In a real scenario, this would publish to a distributed event bus
    {:noreply, state}
  end
end