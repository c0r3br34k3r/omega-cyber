defmodule ElixirMesh.MixProject do
  use Mix.Project

  @version "0.2.0"

  # --- Project Definition ---
  # Defines the application and its basic settings.
  def project do
    [
      app: :elixir_mesh,
      version: @version,
      elixir: "~> 1.15",
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      compilers: [:elixir_make] ++ Mix.compilers(), # Add elixir_make for NIFs
      aliases: aliases(),
      preferred_cli_env: [
        test: :test,
        "test.all": :test,
        "release": :prod
      ],
      # dialyzer: [plt_add_apps: [:mix, :logger, :runtime_tools, :mnesia]], # For static code analysis
      # credo: [strict: true, parser: Credo.Parser.WithLocations], # For code style adherence
      docs: [
        main: "ElixirMesh",
        source_ref: "v#{@version}",
        source_url: "https://github.com/omega-cyber/omega/tree/main/mesh-network/elixir_mesh"
      ]
    ]
  end

  # --- Application Configuration ---
  # Specifies how to start the application.
  def application do
    [
      mod: {ElixirMesh.Application, []},
      extra_applications: [:logger, :runtime_tools, :crypto, :ssl, :inets, :mnesia, :eleveldb], # Important runtime dependencies
      env: [
        grpc_port: System.get_env("ELIXIR_GRPC_PORT") || 50050,
        cluster_node_prefix: System.get_env("ELIXIR_CLUSTER_NODE_PREFIX") || "omega_mesh",
        gossip_interval_ms: System.get_env("ELIXIR_GOSSIP_INTERVAL_MS") || 5000,
        # Placeholder for PQC NIF path
        pqc_nif_path: System.get_env("ELIXIR_PQC_NIF_PATH") || "priv/lib/omega_pqc.so"
      ]
    ]
  end

  # --- Dependencies ---
  # Specifies the Elixir and Erlang packages required by this project.
  defp deps do
    [
      # --- Core Networking & Communication ---
      {:grpc, "~> 0.5"}, # High-performance gRPC client/server
      # {:quic, "~> 0.1"}, # Placeholder for a mature pure Elixir QUIC library, if available.
      #                     # For now, relying on Go for primary QUIC transport.

      # --- Distributed Systems & Clustering ---
      {:libcluster, "~> 3.3"}, # Automatic clustering of Elixir nodes
      {:swarm, "~> 3.8"},      # Distributed, eventually consistent key-value store for node metadata
      {:gossip, "~> 0.10"},    # Flexible gossip protocol implementation for state sync/discovery
      {:phoenix_pubsub, "~> 2.1"}, # For distributed event publishing

      # --- Cryptography (Integration with Trust Fabric via NIFs) ---
      # Placeholder for custom NIF wrapper for Post-Quantum Cryptography primitives
      # Actual PQC algorithms (CRYSTALS-Kyber, Dilithium) would be implemented in Rust
      # or C/C++/Zig in the Trust Fabric and exposed via NIF.
      {:elixir_make, "~> 0.7", runtime: false}, # Required for compiling C/C++/Rust NIFs
      # {:omega_pqc_nif, "~> 0.1", optional: true}, # Example: if it was a hex package

      # --- Metrics & Observability ---
      {:prometheus_ex, "~> 2.0"}, # Prometheus client for exposing metrics
      {:telemetry, "~> 1.1"},     # Elixir's event-based telemetry system
      {:winston_logger, "~> 0.1"}, # Structured logger (if preferred over default Logger)

      # --- Configuration & Utilities ---
      {:nerves_runtime, "~> 0.12"}, # Robust environment-aware configuration
      {:jason, "~> 1.4"},           # Fast JSON encoder/decoder
      {:earmark, "~> 1.4", only: :dev}, # For Markdown processing in docs
      {:ex_doc, "~> 0.30", only: :dev, runtime: false}, # For generating documentation

      # --- Testing & Development ---
      {:ex_unit, "~> 1.15", only: [:dev, :test]}, # Elixir's unit testing framework
      {:mock, "~> 0.3.8", only: :test},          # Mocking library for tests
      {:credo, "~> 1.7", only: [:dev, :test], runtime: false}, # Code style linter
      {:dialyxir, "~> 1.2", only: [:dev, :test], runtime: false}, # Static code analysis
    ]
  end

  # --- Aliases ---
  # Define common tasks for Mix CLI.
  defp aliases do
    [
      "deps.setup": ["deps.get", "deps.compile", "elixir_make"], # Fetch, compile deps, compile NIFs
      "test.all": ["mix format --check-formatted", "credo --strict", "dialyzer", "test"],
      "release": ["deps.get", "compile", "release"], # Prepare for release
    ]
  end
end