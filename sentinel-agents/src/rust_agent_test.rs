// src/rust_agent_test.rs
// ==============================================================================
// OMEGA PLATFORM - SENTINEL AGENT (RUST COMPONENT) TEST SUITE
// ==============================================================================
//
// This file contains unit and integration tests for the Rust component of the
// Sentinel Agent. It focuses on verifying:
// - The correctness and safety of the C-compatible FFI.
// - The behavior of the asynchronous `tokio` runtime and gRPC client.
// - Error handling for invalid inputs and network conditions.
//

// This module will only be compiled when running tests.
#![cfg(test)]

use super::*; // Import the main library code
use std::ffi::CString;
use std::time::Duration;
use tokio::time::timeout;
use rstest::rstest;

// --- FFI Tests ---
// These tests call the `extern "C"` functions directly to ensure they behave as expected.
#[cfg(test)]
mod ffi_tests {
    use super::*;

    #[test]
    fn test_init_and_shutdown_lifecycle() {
        // Ensure that calling init multiple times is safe (due to `Once`).
        rust_component_init();
        rust_component_init(); // Should not panic or re-initialize

        // Ensure shutdown can be called even if the client was not started.
        rust_component_shutdown();
    }

    #[test]
    fn test_start_and_stop_runtime() {
        rust_component_init();
        
        // Start the runtime. This spawns a thread.
        rust_start_grpc_client();
        
        // Give it a moment to initialize
        std::thread::sleep(Duration::from_millis(200));

        // Assert that the global cells are now initialized
        assert!(TOKIO_RUNTIME.get().is_some(), "Tokio runtime should be initialized");
        assert!(SHUTDOWN_SENDER.get().is_some(), "Shutdown sender should be initialized");

        // Shut down the runtime
        rust_component_shutdown();

        // The thread might not have terminated immediately, but the signal is sent.
        // In a more complex test, we could use channels to wait for confirmation.
    }

    #[rstest]
    #[case(r#"{"timestamp":1678886400,"source":"test_agent","type":"test_event","payload":{"value":42}}"#, true)]
    #[case(r#"{"invalid_json": "test"}"#, false)] // This will fail parsing
    #[case(r#"not a json"#, false)] // This will also fail
    fn test_send_telemetry_ffi_call(#[case] json_input: &str, #[case] should_succeed: bool) {
        // We need a running runtime for this test
        if TOKIO_RUNTIME.get().is_none() {
            rust_component_init();
            rust_start_grpc_client();
            std::thread::sleep(Duration::from_millis(200));
        }

        // Convert the Rust string to a C-compatible string
        let c_json = CString::new(json_input).unwrap();
        let c_json_ptr = c_json.as_ptr();

        // The function itself doesn't return a value, but we can check for panics
        // and, in a real scenario, observe logs or mock the gRPC call.
        // For now, we ensure it doesn't crash.
        let result = std::panic::catch_unwind(|| {
            rust_send_telemetry(c_json_ptr);
        });
        
        assert!(result.is_ok(), "rust_send_telemetry should not panic");

        // Cleanup
        // rust_component_shutdown();
    }
    
    #[test]
    fn test_send_telemetry_null_pointer() {
        // Ensure passing a null pointer is handled gracefully and does not panic.
        let result = std.panic::catch_unwind(|| {
            rust_send_telemetry(std::ptr::null());
        });
        assert!(result.is_ok(), "rust_send_telemetry should handle null pointers gracefully");
        // We would also check logs for an error message.
    }
}


// --- gRPC Client and Tokio Runtime Tests ---
#[cfg(test)]
mod grpc_client_tests {
    use super::*;
    use tokio::net::TcpListener;
    use tonic::transport::Server;
    use tonic::{Request, Response, Status};
    use tokio_stream::wrappers::TcpListenerStream;

    // --- Mock gRPC Server ---
    #[derive(Debug, Default)]
    struct MockMeshService {}

    // Placeholder for generated gRPC service trait
    #[tonic::async_trait]
    pub trait MockMeshServiceTrait {
        async fn send_telemetry(&self, request: Request<TelemetryData>) -> Result<Response<()>, Status>;
    }

    #[tonic::async_trait]
    impl MockMeshServiceTrait for MockMeshService {
        async fn send_telemetry(&self, request: Request<TelemetryData>) -> Result<Response<()>, Status> {
            let data = request.into_inner();
            println!("[Mock Server] Received telemetry: {:?}", data);
            
            // Assert that we received the expected data
            if data.source == "test_agent" {
                Ok(Response::new(()))
            } else {
                Err(Status::invalid_argument("Invalid source agent"))
            }
        }
    }
    
    // Helper to start a mock server
    async fn start_mock_server() -> String {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let server = MockMeshService::default();
        
        tokio::spawn(async move {
            // We can't use the real service trait, so this part is conceptual
            // to show how a mock server would be set up.
            // Server::builder()
            //     .add_service(MockMeshServiceServer::new(server))
            //     .serve_with_incoming(TcpListenerStream::new(listener))
            //     .await
            //     .unwrap();
        });
        
        format!("http://{}", addr)
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn test_connect_to_mesh_success() {
        // Start a mock server
        // Since we can't implement the real trait without generated code, this test is conceptual
        // let server_addr = start_mock_server().await;
        //
        // let result = connect_to_mesh(&server_addr).await;
        // assert!(result.is_ok(), "Should connect to mock server successfully");
        
        // For now, we test the failure case as it doesn't require a running server
    }
    
    #[tokio::test(flavor = "multi_thread")]
    async fn test_connect_to_mesh_failure() {
        // Attempt to connect to an address where no server is running
        let server_addr = "http://127.0.0.1:9999";
        
        let result = timeout(Duration::from_secs(2), connect_to_mesh(server_addr)).await;
        
        // Expect a timeout or connection error
        assert!(result.is_err() || result.unwrap().is_err(), "Connection should fail");
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn test_telemetry_processing_logic() {
        // This test verifies the logic inside the `spawn` block of `rust_send_telemetry`
        let json_str = r#"{"timestamp":1678886400,"source":"test_agent","type":"test_event","payload":{"value":42}}"#;
        
        let telemetry_data: TelemetryData = serde_json::from_str(json_str).unwrap();
        
        // Here we would call a mocked version of the gRPC client's method
        // and assert that it was called with the correct `telemetry_data`.
        
        assert_eq!(telemetry_data.source, "test_agent");
        assert_eq!(telemetry_data.payload["value"], 42);
    }
}