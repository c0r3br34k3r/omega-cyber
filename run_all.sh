#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

echo "Starting Omega project orchestration..."

# --- 1. Build all components ---
echo "Building all project components..."
./scripts/build.sh
echo "Build complete."

# Define PIDs array to keep track of background processes
PIDS=()

# --- 2. Start Intelligence Core (Python gRPC Server) ---
echo "Starting Intelligence Core (Python gRPC Server) on port 50051..."
cd intelligence-core
python3 src/python/main.py &> /dev/null &
PIDS+=($!)
cd ..
echo "Intelligence Core gRPC Server started."

# --- 3. Start Dashboard (Node.js/TypeScript served by Python HTTP server) ---
echo "Starting Dashboard on http://localhost:8000..."
cd dashboard
# Ensure Node.js dependencies are installed and TypeScript is compiled
npm install &> /dev/null &> /dev/null
# This ensures that dashboard.ts and test_dashboard.ts are compiled to JavaScript in the dist folder

python3 -m http.server 8000 &> /dev/null &
PIDS+=($!)
cd ..
echo "Dashboard server started."

# --- 4. Start Mesh Network (Elixir GenServer) ---
echo "Starting Elixir Mesh Network component..."
cd mesh-network/elixir/elixir_mesh
if ! command -v mix &> /dev/null
then
    echo "Error: 'mix' command not found for Elixir Mesh Network. Please install Elixir or ensure it's in your PATH."
    exit 1
fi
mix deps.get &> /dev/null
mix run --no-halt &> /dev/null &
PIDS+=($!)
cd ../../..
echo "Elixir Mesh Network component started."

# --- 5. Start Orchestration (Elixir GenServer) ---
echo "Starting Elixir Orchestration component..."
cd orchestration
if ! command -v mix &> /dev/null
then
    echo "Error: 'mix' command not found for Elixir Orchestration. Please install Elixir or ensure it's in your PATH."
    exit 1
fi
mix deps.get &> /dev/null
mix run --no-halt &> /dev/null &
PIDS+=($!)
cd ..
echo "Elixir Orchestration component started."

echo "---------------------------------------------------"
echo "Omega project services are running in the background."
echo ""
echo "Access Points:"
echo "  - Dashboard:        http://localhost:8000"
echo "  - Intelligence Core: gRPC on localhost:50051"
echo "  - Elixir Mesh Network: (internal communication)"
echo "  - Elixir Orchestration: (internal communication)"
echo ""
echo "To stop all services, run: kill ${PIDS[@]}"
echo "---------------------------------------------------"
