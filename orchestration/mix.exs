defmodule Orchestration.MixProject do
  use Mix.Project

  @version "0.2.0"

  # --- Project Definition ---
  # Defines the application and its basic settings.
  def project do
    [
      app: :omega_orchestrator_elixir,
      version: @version,
      elixir: "~> 1.15",
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      aliases: aliases(),
      preferred_cli_env: [
        test: :test,
        "test.all": :test,
        "release": :prod
      ],
      # dialyzer: [plt_add_apps: [:mix, :logger, :runtime_tools, :mnesia]], # For static code analysis
      # credo: [strict: true, parser: Credo.Parser.WithLocations], # For code style adherence
      docs: [
        main: "OmegaOrchestratorElixir",
        source_ref: "v#{@version}",
        source_url: "https://github.com/omega-cyber/omega/tree/main/orchestration"
      ]
    ]
  end

  # --- Application Configuration ---
  # Specifies how to start the application.
  def application do
    [
      mod: {OmegaOrchestratorElixir.Application, []},
      extra_applications: [:logger, :runtime_tools, :observer, :crypto, :ssl, :inets],
      env: [
        # Elixir-specific configuration for orchestration tasks
        # e.g., polling interval for Scala/Akka health checks
        akka_health_check_interval_ms: System.get_env("AKKA_HEALTH_CHECK_INTERVAL_MS") || 5000,
        akka_grpc_address: System.get_env("AKKA_GRPC_ADDRESS") || "localhost:8081"
      ]
    ]
  end

  # --- Dependencies ---
  # Specifies the Elixir and Erlang packages required by this project.
  defp deps do
    [
      # --- Distributed Systems & Clustering ---
      {:libcluster, "~> 3.3"}, # Automatic clustering of Elixir nodes
      {:gossip, "~> 0.10"},    # Flexible gossip protocol for state sync/discovery (e.g., Akka worker health)
      {:swarm, "~> 3.8"},      # Distributed, eventually consistent key-value store

      # --- Interoperability with Scala/Akka (via gRPC or HTTP health checks) ---
      # As Scala/Akka handles the primary gRPC server, Elixir will act as client or monitor.
      # For gRPC client calls from Elixir to Scala/Akka gRPC server:
      # {:grpc_client, "~> 0.1"}, # Placeholder for a custom gRPC client for Scala services

      # --- Metrics & Observability ---
      {:prometheus_ex, "~> 2.0"}, # Prometheus client for exposing Elixir-specific metrics
      {:telemetry, "~> 1.1"},     # Elixir's event-based telemetry system

      # --- Configuration & Utilities ---
      {:nerves_runtime, "~> 0.12"}, # Robust environment-aware configuration
      {:jason, "~> 1.4"},           # Fast JSON encoder/decoder (for HTTP health checks, etc.)
      {:httpoison, "~> 2.1"},       # HTTP client for polling Akka service health
      
      # --- Testing & Development ---
      {:ex_unit, "~> 1.15", only: [:dev, :test]}, # Elixir's unit testing framework
      {:mock, "~> 0.3.8", only: :test},          # Mocking library for tests
      {:credo, "~> 1.7", only: [:dev, :test], runtime: false}, # Code style linter
      {:dialyxir, "~> 1.2", only: [:dev, :test], runtime: false}, # Static code analysis
      {:ex_doc, "~> 0.30", only: :dev, runtime: false}, # For generating documentation
    ]
  end

  # --- Aliases ---
  # Define common tasks for Mix CLI.
  defp aliases do
    [
      "deps.setup": ["deps.get", "deps.compile"],
      "test.all": ["mix format --check-formatted", "credo --strict", "dialyzer", "test"],
      "release": ["deps.get", "compile", "release"], # Prepare for release
    ]
  end
end