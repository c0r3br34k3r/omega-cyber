# Sentinel Agents: The Autonomous, Secure Edge Defenders

---

## 1. Introduction: The Eyes and Hands of Omega

Sentinel Agents are the distributed edge components of the Omega Platform, deployed across endpoints to act as the vigilant eyes and responsive hands of the system. They are responsible for telemetry collection and enforcement of security policies.

*(Note: The current implementation is a proof-of-concept demonstrating a polyglot architecture. The core functionalities are placeholders and do not represent a production-ready agent.)*

---

## 2. Role and Vision

The primary mission of the Sentinel Agent is to:
*   **Demonstrate Polyglot Architecture**: Show how C, Rust, and Zig can be integrated into a single agent, with each language serving a specific purpose.
*   **Provide a Framework for Telemetry**: Establish a basic structure for collecting system information.
*   **Establish a Communication Channel**: Connect to the Mesh Network to send data.

The long-term vision is to develop this into a high-performance, resilient agent with advanced capabilities like kernel-level monitoring and dynamic policy enforcement.

---

## 3. Core Architectural Components (Proof-of-Concept)

The Sentinel Agent is currently implemented as a polyglot application with C as the central orchestrator.

### 3.1. C Orchestrator (`main.c`)

*   **Role**: The main entry point of the agent. It runs the main loop and orchestrates calls to the Rust and Zig components.
*   **Functionality**:
    *   Initializes the Rust and Zig static libraries via an FFI (Foreign Function Interface).
    *   In a loop, it calls the Zig component to perform a "scan".
    *   It then calls the Rust component to send the result of the scan as telemetry.
    *   Handles graceful shutdown signals.

### 3.2. Secure Communication Module (Rust Library)

*   **Role**: This component is intended to handle all secure communication with the Mesh Network. It is compiled as a static library and called by the C orchestrator.
*   **Functionality (Current)**:
    *   Initializes a Tokio async runtime.
    *   Establishes a gRPC client connection to the Mesh Network.
    *   Exposes an FFI function (`rust_send_telemetry`) that the C code can call.
    *   **The actual gRPC call to send telemetry is a placeholder** and does not currently transmit data over the network.
    *   Hooks for integrating PQC and advanced TLS are present as comments but are not implemented.

### 3.3. Low-Level System Scanner (Zig Library)

*   **Role**: This component is designed for performing low-level system checks where direct memory control is important. It is also compiled as a static library.
*   **Functionality (Current)**:
    *   Exposes an FFI function (`zig_perform_low_level_scan`) for the C code to call.
    *   **The scanning logic is a placeholder**. It simulates a memory scan by searching for a hardcoded string within a local buffer, not by inspecting system memory.

---

## 4. Technology Stack Highlights

*   **Languages**:
    *   **C**: For top-level orchestration and FFI management.
    *   **Rust**: For the communication component, using the Tokio runtime.
    *   **Zig**: For the placeholder low-level scanning component.
*   **Aspirational Technologies (Not Implemented)**:
    *   **Kernel Technologies**: eBPF (for Linux) or WFP (for Windows).
    *   **Runtime**: Wasmtime (for WASM module execution).
    *   **Cryptography**: LibOQS (for PQC algorithms).

---

## 5. Security & Resilience

*   **Memory Safety**: The use of Rust and Zig is intended to provide memory safety for the components written in those languages, reducing the overall attack surface of the agent.
*   **Current State**: As the agent is a proof-of-concept with placeholder logic, it has not undergone security hardening.

---

## 6. Integration Points

*   **Input**: The agent is designed to receive commands from the Intelligence Core via the Mesh Network, but this is not implemented.
*   **Output**:
    *   **Mesh Network**: The Rust component is designed to stream telemetry to the Mesh Network, but the implementation is a placeholder.
*   **Dependencies**: The agent depends on the build system (CMake, Cargo, Zig build) to correctly compile and link the C, Rust, and Zig components together.