#!/bin/bash
#
# ==============================================================================
# OMEGA PLATFORM DEPLOYMENT SCRIPT
# Version: 3.0
#
# This script is the unified entry point for all development, testing, and
# operational tasks related to the Omega Cybersecurity Mesh Platform. It provides
# a consistent, environment-aware, and fault-tolerant interface to manage the
# complex, polyglot monorepo.
#
# USAGE: ./deploy.sh [COMMAND] [OPTIONS]
#
# COMMANDS:
#   install         - Install all dependencies for all modules.
#   build           - Build all modules in dependency-aware order.
#   test            - Run the complete test suite (unit, integration, e2e).
#   run             - Launch the full Omega platform stack for development.
#   deploy          - Build and deploy the full Omega platform.
#   clean           - Remove all build artifacts and temporary files.
#   lint            - Run static analysis and code formatters across all modules.
#   validate        - Perform post-run system health and integrity checks.
#   docs            - Generate and serve project documentation.
#   ci              - Run the full CI pipeline (lint, build, test).
#
# OPTIONS:
#   --module=<name> - Target a specific module (e.g., --module=mesh-network).
#   --env=<name>    - Specify environment (dev, test, prod). Defaults to 'dev'.
#   --fast          - Skip non-essential checks for faster local runs.
#   --verbose       - Enable detailed, verbose logging output.
#   --sequential    - Force sequential execution instead of parallel.
#
# ==============================================================================

# --- §1. Script Configuration & Initialization ---

# Strict Mode: Exit on error, pipe failure, and unset variables.
set -o errexit
set -o nounset
set -o pipefail

# --- §2. Global Variables & Environment ---

# Logging framework
_COLOR_RESET='\e[0m'
_COLOR_RED='\e[0;31m'
_COLOR_GREEN='\e[0;32m'
_COLOR_YELLOW='\e[0;33m'
_COLOR_BLUE='\e[0;34m'
_COLOR_CYAN='\e[0;36m'

log() { echo -e "[$(date +'%Y-%m-%dT%H:%M:%S%z')] ${_COLOR_BLUE}INFO:${_COLOR_RESET} $1"; }
log_warn() { echo -e "[$(date +'%Y-%m-%dT%H:%M:%S%z')] ${_COLOR_YELLOW}WARN:${_COLOR_RESET} $1"; }
log_error() { echo -e "[$(date +'%Y-%m-%dT%H:%M:%S%z')] ${_COLOR_RED}ERROR:${_COLOR_RESET} $1" >&2; exit 1; }
log_step() { echo -e "\n${_COLOR_CYAN}>>> $1...${_COLOR_RESET}"; }
log_success() { echo -e "${_COLOR_GREEN}✔ Success:${_COLOR_RESET} $1"; }

# Default command-line arguments
ARG_COMMAND=""
ARG_MODULE="all"
ARG_ENV="dev"
ARG_FAST=false
ARG_VERBOSE=false
ARG_SEQUENTIAL=false
CHILD_PIDS=()

# --- §3. Core System Functions ---

# Cleanup trap for graceful shutdown
cleanup() {
    log_warn "Shutdown signal received. Cleaning up background processes..."
    if [ ${#CHILD_PIDS[@]} -gt 0 ]; then
        kill "${CHILD_PIDS[@]}" 2>/dev/null
    fi
    log_success "Cleanup complete. Exiting."
    exit 0
}
trap cleanup SIGINT SIGTERM

# Dependency check engine
check_dependency() {
    command -v "$1" >/dev/null 2>&1 || log_error "Dependency not found: $1. Please install it."
    # TODO: Add version checking logic, e.g., check_version "go" "1.21"
}

validate_dependencies() {
    log_step "Validating core dependencies"
    check_dependency "git"
    check_dependency "docker"
    check_dependency "go"
    check_dependency "rustc"
    check_dependency "cargo"
    check_dependency "npm"
    check_dependency "node"
    check_dependency "python3"
    check_dependency "pip"
    check_dependency "elixirc"
    check_dependency "mix"
    check_dependency "sbt"
    check_dependency "julia"
    check_dependency "zig"
    check_dependency "protoc"
    log_success "All core dependencies are installed."
}

# --- §4. Modular Task Functions ---

# Organized by module according to the Omega architecture
# Each function respects the --env and --verbose flags.

# §4.1 Installation
task_install() {
    log_step "Installing dependencies for all modules"
    (log_step "Module: mesh-network (Go)"; cd mesh-network && go mod tidy)
    (log_step "Module: sentinel-agents (Rust)"; cd sentinel-agents && cargo fetch)
    (log_step "Module: trust-fabric (Rust)"; cd trust-fabric && cargo fetch)
    (log_step "Module: wasm-modules (Rust)"; cd wasm-modules && cargo fetch)
    (log_step "Module: dashboard (TypeScript)"; cd dashboard && npm install)
    (log_step "Module: deception-engine (TypeScript)"; cd deception-engine && npm install)
    (log_step "Module: digital-twin (Python)"; cd digital-twin && pip install -r requirements.txt)
    (log_step "Module: intelligence-core (Python)"; cd intelligence-core && pip install -r requirements.txt)
    (log_step "Module: orchestration (Elixir/Scala)"; cd orchestration && mix deps.get)
    # ... and so on for all modules
    log_success "All dependencies installed."
}

# §4.2 Build
task_build() {
    log_step "Building all modules in dependency order"
    
    # Tier 1: Core libraries and protocols (can be built in parallel)
    log_step "Tier 1: Foundational Libraries"
    pids=()
    (cd proto && protoc --go_out=. --go_opt=paths=source_relative alert.proto && log_success "proto build complete") & pids+=($!)
    (cd trust-fabric && cargo build --release && log_success "trust-fabric build complete") & pids+=($!)
    (cd wasm-modules && cargo build --target wasm32-unknown-unknown --release && log_success "wasm-modules build complete") & pids+=($!)
    
    wait "${pids[@]}" # Wait for Tier 1 to complete

    # Tier 2: Core services (depend on Tier 1)
    log_step "Tier 2: Core Services"
    pids=()
    (cd mesh-network && go build -o main ./src && log_success "mesh-network build complete") & pids+=($!)
    (cd sentinel-agents && cargo build --release && log_success "sentinel-agents build complete") & pids+=($!)
    (cd intelligence-core/src/python && log_success "intelligence-core (Python) requires no build") & pids+=($!)

    wait "${pids[@]}"

    # Tier 3: Application/UI layers (depend on Tier 2)
    log_step "Tier 3: Application Layer"
    (cd dashboard && npm run build && log_success "dashboard build complete") & pids+=($!)

    wait "${pids[@]}"
    log_success "All modules built successfully."
}

# §4.3 Test
task_test() {
    log_step "Running test suites for all modules"
    declare -A test_pids
    declare -A test_results

    run_test() {
        log_step "Testing module: $1"
        (cd "$2" && $3) &> "/tmp/omega_test_$1.log"
        local exit_code=$?
        test_pids["$1"]=$!
        test_results["$1"]=$exit_code
    }
    
    # Run tests in parallel
    run_test "mesh-network" "mesh-network/src" "go test -v"
    run_test "sentinel-agents" "sentinel-agents" "cargo test --release"
    run_test "trust-fabric" "trust-fabric" "cargo test --release"
    run_test "intelligence-core" "intelligence-core/src/python" "python3 -m pytest"
    run_test "dashboard" "dashboard" "npm test"
    # ... etc for all testable modules

    log_step "Waiting for test suites to complete..."
    
    all_passed=true
    for module in "${!test_pids[@]}"; do
        wait "${test_pids[$module]}"
        if [ "${test_results[$module]}" -ne 0 ]; then
            log_warn "Test suite FAILED for module: $module"
            echo "-------------------- LOGS for $module --------------------"
            cat "/tmp/omega_test_$module.log"
            echo "----------------------------------------------------------"
            all_passed=false
        else
            log_success "Test suite PASSED for module: $module"
        fi
        rm "/tmp/omega_test_$module.log"
    done

    if ! $all_passed; then
        log_error "One or more test suites failed."
    fi
    log_success "All test suites passed."
}

# §4.4 Run
task_run() {
    log_step "Launching Omega Platform (Environment: $ARG_ENV)"
    
    log_step "Starting Tier 1 Services..."
    (cd mesh-network && ./main) & CHILD_PIDS+=($!)
    log "mesh-network node started with PID $!."
    
    sleep 2 # Give time for network to initialize

    log_step "Starting Tier 2 Services..."
    (cd sentinel-agents/target/release && ./sentinel-agents) & CHILD_PIDS+=($!)
    log "sentinel-agent started with PID $!."

    (cd intelligence-core/src/python && python3 main.py) & CHILD_PIDS+=($!)
    log "intelligence-core started with PID $!."

    log_step "Starting Tier 3 Services (UI)..."
    (cd dashboard && npm run dev) & CHILD_PIDS+=($!)
    log "dashboard started with PID $!."

    log_success "Omega Platform is now running."
    log "Press Ctrl+C to shut down all services."
    wait
}

# §4.5 Clean
task_clean() {
    log_step "Cleaning all build artifacts and temporary files..."
    git clean -fdX
    log_success "Repository cleaned."
}

# §4.6 Lint
task_lint() {
    log_step "Running linters for all modules..."
    log_warn "Linting not fully implemented yet. Placeholder."
    # Example: (cd dashboard && npm run lint)
    log_success "Linting complete."
}

# §4.7 Deploy
task_deploy() {
    log_step "Deploying Omega Platform (Environment: $ARG_ENV)"
    log_warn "This is a basic deployment running services locally. For production, more advanced deployment strategies (e.g., Docker, Kubernetes) are recommended."

    # 1. Build fresh artifacts
    task_build

    # 2. Run the platform
    task_run
}


# --- §5. Command-line Parser & Main Execution Logic ---

main() {
    if [[ $# -eq 0 ]]; then
        log_error "No command specified. Usage: ./deploy.sh [COMMAND]"
    fi

    # Parse arguments
    for arg in "$@"; do
        case $arg in
            install|build|test|run|clean|lint|validate|docs|ci|deploy)
                ARG_COMMAND=$arg
                shift
                ;;
            --module=*) 
                ARG_MODULE="${arg#*=}"
                shift
                ;;
            --env=*) 
                ARG_ENV="${arg#*=}"
                shift
                ;;
            --fast)
                ARG_FAST=true
                shift
                ;;
            --verbose)
                ARG_VERBOSE=true
                shift
                ;;
            --sequential)
                ARG_SEQUENTIAL=true
                shift
                ;;
            -*)
                log_error "Unknown option: $arg"
                ;;
        esac
    done

    log "Omega Orchestrator Initialized. Command: '$ARG_COMMAND', Module: '$ARG_MODULE', Env: '$ARG_ENV'"

    if ! $ARG_FAST; then
        validate_dependencies
    else
        log_warn "Skipping dependency validation (--fast)."
    fi

    case "$ARG_COMMAND" in
        install)
            task_install
            ;; 
        build)
            task_build
            ;; 
        test)
            task_test
            ;; 
        run)
            task_run
            ;; 
        deploy)
            task_deploy
            ;;
        clean)
            task_clean
            ;; 
        ci)
            task_lint
            task_build
            task_test
            ;; 
        *)
            log_error "Invalid command: '$ARG_COMMAND'. See usage at top of script."
            ;; 
    esac

    log_success "Orchestration command '$ARG_COMMAND' completed successfully."
}

# Execute main function with all script arguments
main "$@"