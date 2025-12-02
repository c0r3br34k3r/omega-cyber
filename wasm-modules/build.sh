#!/bin/bash
# ==============================================================================
# OMEGA PLATFORM - WASM MODULES BUILD & OPTIMIZATION SCRIPT
# ==============================================================================
#
# This script orchestrates the build, optimization, and verification process
# for all WebAssembly (WASM) modules used in the Omega Platform. It ensures
# that the final WASM binaries are small, fast, and secure.
#
# USAGE: ./build.sh [OPTIONS]
#
# OPTIONS:
#   --release   Create optimized, production-ready release builds (default).
#   --dev       Create unoptimized debug builds.
#
# ==============================================================================

# --- 1. Script Configuration & Initialization ---
set -o errexit
set -o nounset
set -o pipefail

# --- Logging Framework ---
_COLOR_RESET='\e[0m'
_COLOR_RED='\e[0;31m'
_COLOR_GREEN='\e[0;32m'
_COLOR_YELLOW='\e[0;33m'
_COLOR_BLUE='\e[0;34m'
_COLOR_CYAN='\e[0;36m'

log_info() { echo -e "[$(date +'%T')] ${_COLOR_BLUE}INFO:${_COLOR_RESET} $1"; }
log_step() { echo -e "\n[$(date +'%T')] ${_COLOR_CYAN}>>> $1...${_COLOR_RESET}"; }
log_success() { echo -e "[$(date +'%T')] ${_COLOR_GREEN}✔ Success:${_COLOR_RESET} $1"; }
log_error() { echo -e >&2 "[$(date +'%T')] ${_COLOR_RED}ERROR:${_COLOR_RESET} $1"; exit 1; }

# --- Argument Parsing ---
ARG_BUILD_MODE="release" # Default to release
if [ "${1:-}" == "--dev" ]; then
    ARG_BUILD_MODE="dev"
fi

# --- Global Variables ---
ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
WASM_PACK_FLAGS="--target nodejs" # We are targeting a Node.js-like environment in our agents
WASM_OPT_FLAGS="-O4 --strip-debug" # Aggressive optimization and strip debug info

if [ "$ARG_BUILD_MODE" == "release" ]; then
    log_info "Release mode enabled: building optimized WASM modules."
    WASM_PACK_FLAGS="$WASM_PACK_FLAGS --release"
else
    log_info "Development mode enabled: building debug WASM modules."
    WASM_PACK_FLAGS="$WASM_PACK_FLAGS --dev"
    WASM_OPT_FLAGS="" # No optimization for dev builds
fi

# --- Helper Functions ---
check_dependency() {
    command -v "$1" >/dev/null 2>&1 || log_error "Dependency not found: '$1'. Please install it. (e.g., 'cargo install $1' or 'npm install -g $1')"
}

# --- Main Build Orchestration ---
main() {
    local start_time
    start_time=$(date +%s)
    
    log_step "Checking dependencies"
    check_dependency "rustup"
    check_dependency "cargo"
    check_dependency "wasm-pack"
    if [ "$ARG_BUILD_MODE" == "release" ]; then
        check_dependency "wasm-opt" # From binaryen package
    fi
    check_dependency "wasm-validate" # From wabt package
    log_success "All dependencies found."

    log_step "Ensuring wasm32-unknown-unknown target is installed"
    rustup target add wasm32-unknown-unknown
    log_success "WASM target is installed."

    log_step "Building WASM module with wasm-pack"
    cd "$ROOT_DIR"
    wasm-pack build $WASM_PACK_FLAGS
    log_success "WASM module built successfully."

    # --- Optimization Step (for release builds) ---
    if [ "$ARG_BUILD_MODE" == "release" ]; then
        log_step "Optimizing WASM binary with wasm-opt"
        
        # Locate the generated WASM file
        WASM_FILE=$(find pkg -name "*_bg.wasm")
        if [ -z "$WASM_FILE" ]; then
            log_error "Could not find generated WASM file in 'pkg/' directory."
        fi
        
        local original_size
        original_size=$(stat -c%s "$WASM_FILE")
        
        log_info "Optimizing '$WASM_FILE'..."
        wasm-opt "$WASM_FILE" -o "${WASM_FILE}.opt" $WASM_OPT_FLAGS
        
        local optimized_size
        optimized_size=$(stat -c%s "${WASM_FILE}.opt")
        
        # Replace original with optimized version
        mv "${WASM_FILE}.opt" "$WASM_FILE"
        
        local size_reduction
        size_reduction=$((original_size - optimized_size))
        log_success "WASM optimization complete. Size reduced by $size_reduction bytes."
    fi

    # --- Verification Step ---
    log_step "Verifying optimized WASM module"
    WASM_FILE=$(find pkg -name "*_bg.wasm")
    wasm-validate "$WASM_FILE"
    log_success "WASM module verified successfully."

    # --- Artifact Signing (Conceptual) ---
    log_step "Signing WASM module for secure deployment"
    # In a real system, we would use a key from the Trust Fabric to sign the WASM binary.
    # This ensures that only trusted modules can be loaded by Sentinel Agents.
    # Example: omega_signer sign --key <key_from_trust_fabric> --in $WASM_FILE --out $WASM_FILE.sig
    touch "$WASM_FILE.sig" # Create a placeholder signature file
    log_success "WASM module signed (placeholder)."
    
    # --- Final Summary ---
    log_step "Build Summary"
    ls -lh pkg
    
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "WASM modules build completed in $duration seconds."
    log_info "Artifacts are available in the 'pkg/' directory."
}

# Run main function
main