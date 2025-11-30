defmodule Orchestration.MixProject do
  use Mix.Project

  def project do
    [
      app: :orchestration,
      version: "0.1.0",
      elixir: "~> 1.14",
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  def application do
    [
      mod: {Orchestration.Application, []},
      extra_applications: [:logger, :runtime_tools]
    ]
  end

  defp deps do
    [
      # {:dep_name, "~> 0.1.0"}
    ]
  end
end
