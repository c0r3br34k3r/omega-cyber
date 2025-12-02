/**
 * ==============================================================================
 * OMEGA PLATFORM - SENTINEL AGENT (C/C++/RUST/ZIG POLYGLOT)
 * ==============================================================================
 *
 * This file contains the main entry point for the C-based orchestrator of the
 * Sentinel Agent. It demonstrates a polyglot architecture where C is used for
 *
 * low-level orchestration, while more complex, memory-safe, or specialized
 * tasks are delegated to Rust and Zig components via a Foreign Function
 * Interface (FFI).
 *
 * The C component is responsible for:
 *  - Initializing and shutting down the Rust and Zig components.
 *  - Running the main agent loop.
 *  - Orchestrating calls between the different language components.
 *
 * The Rust component handles:
 *  - Secure networking (gRPC/QUIC) with the Mesh Network.
 *  - Complex data processing and serialization.
 *  - High-level concurrency.
 *
 * The Zig component handles:
 *  - Extremely low-level system checks, memory scanning, or direct kernel
 *    interactions where fine-grained memory control is paramount.
 *
 */

#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <unistd.h>
#include <signal.h>
#include <string.h>
#include <time.h>

// --- FFI Declarations for Rust Component ---
// These functions are implemented in the Rust part of the project
// and will be linked against by CMake.

/**
 * @brief Initializes the Rust component (e.g., networking, logging).
 */
extern void rust_component_init();

/**
 * @brief Starts the asynchronous Rust runtime and gRPC client.
 */
extern void rust_start_grpc_client();

/**
 * @brief Sends telemetry data (as a JSON string) to the Mesh Network.
 * @param telemetry_json A null-terminated UTF-8 string containing the telemetry data.
 */
extern void rust_send_telemetry(const char* telemetry_json);

/**
 * @brief Gracefully shuts down the Rust component.
 */
extern void rust_component_shutdown();


// --- FFI Declarations for Zig Component ---
// These functions are implemented in the Zig part of the project.

/**
 * @brief Initializes the Zig component.
 */
extern void zig_component_init();

/**
 * @brief Performs a low-level system scan.
 * @param target A string indicating the scan target (e.g., "/proc/mem").
 * @return An integer representing the scan result (e.g., number of anomalies found).
 */
extern int zig_perform_low_level_scan(const char* target);

/**
 * @brief Gracefully shuts down the Zig component.
 */
extern void zig_component_shutdown();


// --- Global State & Signal Handling ---

// A global flag to signal the main loop to terminate.
// `volatile` is used to prevent the compiler from optimizing away reads
// in the main loop, as this variable can be changed by an external signal.
static volatile bool keep_running = true;

void int_handler(int dummy) {
    (void)dummy; // Unused parameter
    printf("\n[C Orchestrator] Caught shutdown signal. Terminating...\n");
    keep_running = false;
}

// --- Main Application ---

int main(int argc, char* argv[]) {
    // 1. Initialization
    printf("[C Orchestrator] Starting Omega Sentinel Agent (Polyglot Version)...\n");

    // Register signal handlers for graceful shutdown
    signal(SIGINT, int_handler);
    signal(SIGTERM, int_handler);

    // Initialize language components
    printf("[C Orchestrator] Initializing Zig component...\n");
    zig_component_init();

    printf("[C Orchestrator] Initializing Rust component...\n");
    rust_component_init();
    rust_start_grpc_client(); // Start the async runtime and gRPC client

    printf("[C Orchestrator] All components initialized. Entering main loop.\n");

    // 2. Main Loop
    int iteration = 0;
    while (keep_running) {
        printf("\n--- Iteration %d ---\n", iteration++);

        // --- Task 1: Perform low-level scan using Zig component ---
        printf("[C -> Zig] Performing low-level system scan...\n");
        int anomalies_found = zig_perform_low_level_scan("/proc/mem"); // Example target
        printf("[Zig -> C] Scan complete. Found %d anomalies.\n", anomalies_found);

        // --- Task 2: Generate telemetry payload ---
        char telemetry_buffer[512];
        time_t now = time(NULL);
        snprintf(telemetry_buffer, sizeof(telemetry_buffer),
                 "{\"timestamp\":%ld, \"source\":\"sentinel-agent-cxx\", \"type\":\"low_level_scan\", \"payload\":{\"anomalies\":%d}}",
                 (long)now, anomalies_found);
        
        printf("[C] Generated telemetry payload: %s\n", telemetry_buffer);

        // --- Task 3: Send telemetry using Rust component ---
        printf("[C -> Rust] Sending telemetry to Mesh Network...\n");
        rust_send_telemetry(telemetry_buffer);
        // The Rust component will handle the asynchronous gRPC call in the background.

        // Sleep for a defined interval
        for (int i = 0; i < 5 && keep_running; ++i) {
            sleep(1);
        }
    }

    // 3. Shutdown
    printf("[C Orchestrator] Shutting down components...\n");
    
    // Shut down in reverse order of initialization
    printf("[C Orchestrator] Shutting down Rust component...\n");
    rust_component_shutdown();
    
    printf("[C Orchestrator] Shutting down Zig component...\n");
    zig_component_shutdown();

    printf("[C Orchestrator] Omega Sentinel Agent shut down successfully.\n");

    return 0;
}
