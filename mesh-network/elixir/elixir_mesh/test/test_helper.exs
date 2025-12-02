# mesh-network/elixir/elixir_mesh/test/test_helper.exs
# ==============================================================================
# OMEGA PLATFORM - ELIXIR MESH TEST HELPER
# ==============================================================================
#
# This file provides a comprehensive setup for running tests in the Elixir Mesh
# Network. It configures ExUnit, integrates code coverage, sets up test-specific
# logging, and ensures a consistent and isolated testing environment.
#

# --- 1. Configure ExUnit ---
# Start ExUnit with asynchronous tests enabled for faster execution and
# a custom formatter for better test output.
ExUnit.start(
  auto_run: true,
  async: true,        # Allow tests to run in parallel
  formatters: [ExUnit.CLIFormatter]
)

# --- 2. Code Coverage Configuration ---
# Integrate ExCoveralls for code coverage analysis.
# This helps ensure that tests adequately cover the codebase.
if System.get_env("MIX_ENV") == "test" do
  Mix.Task.run "app.start"
  {:ok, _} = Application.ensure_all_started(:excoveralls)
  ExCoveralls.start()
  # Configure modules to be included in coverage reports.
  # Exclude test files, Mix itself, and any generated modules.
  ExCoveralls.configure(
    coveralls_json_options: [
      file_patterns: ["lib/**/*.ex"],
      excluded_modules: [Mix, Application, ElixirMesh.PQC] # Exclude NIF placeholder
    ],
    minimum_coverage: 80, # Set a minimum coverage threshold
    # The `excoveralls` Mix task handles the reporting.
  )
end

# --- 3. Logging Configuration for Tests ---
# Suppress verbose logging during tests to keep the output clean.
# Only show warnings and errors by default.
Logger.configure(level: :warn, format: "$time $level $message")

# You can override specific loggers if needed, e.g.:
# Logger.configure_backend(:console, format: "$time $message\n")

# --- 4. Test-Specific Application Configuration ---
# Override application settings for the test environment.
# Example: Use different ports for gRPC services or a test-specific cluster name.
Application.put_env(:elixir_mesh, :grpc_port, 50059) # Use a port distinct from dev/prod
Application.put_env(:elixir_mesh, :gossip_interval_ms, 100) # Faster gossip for tests
Application.put_env(:elixir_mesh, :cluster_node_prefix, "test_omega_mesh")

# Configure libcluster for tests if needed, e.g., only connect to self for isolated tests.
Application.put_env(:libcluster, :topologies, [
  test_cluster: [
    strategy: Cluster.Strategy.DNSPoll,
    config: [
      polling_interval_ms: 1000,
      query: "localhost", # Only look for nodes on localhost
      node_basename: Application.fetch_env!(:elixir_mesh, :cluster_node_prefix)
    ]
  ]
])


# --- 5. Global Test Setup/Teardown (Optional) ---
# Use ExUnit.Callbacks for setup/teardown that runs once for all tests.
# This ensures a consistent starting state for the entire test suite.
defmodule ElixirMesh.GlobalTestCallbacks do
  use ExUnit.Callbacks

  @impl true
  def setup_all(context) do
    Logger.info("Global test setup: Ensuring ElixirMesh.Application is started.")
    # Ensure the main application is started once for all tests.
    # This might already be handled by `Mix.Task.run "app.start"` if called above.
    {:ok, _} = Application.ensure_all_started(:elixir_mesh)
    :ok = Phoenix.PubSub.start_link(name: ElixirMesh.PubSub) # Ensure PubSub is running
    context # Return the context
  end

  @impl true
  def teardown_all(_context) do
    Logger.info("Global test teardown: Stopping ElixirMesh.Application.")
    Application.stop(:elixir_mesh)
    :ok
  end
end

# Ensure the callbacks are registered
ExUnit.register_callbacks(ElixirMesh.GlobalTestCallbacks)

# --- 6. Import specific test modules or shared contexts ---
# Example: import TestHelpers.*
# require ElixirMesh.TestHelpers