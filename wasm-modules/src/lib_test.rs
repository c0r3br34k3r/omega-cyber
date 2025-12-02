// src/lib_test.rs
// ==============================================================================
// OMEGA PLATFORM - WASM DYNAMIC RULE MODULE TEST SUITE
// ==============================================================================
//
// This file contains a comprehensive test suite for the WASM module. It uses
// `wasm-bindgen-test` to run tests in a simulated host environment, allowing for
// verification of the module's logic, state management, and interaction with
// the host via `wasm-bindgen`.
//

#![cfg(test)]

use super::*; // Import the main library code
use wasm_bindgen_test::*;
use serde_json::json;
use std::sync::{Mutex, Once};

// Configure the test runner to work in a headless browser environment
wasm_bindgen_test_configure!(run_in_browser);

// --- Mock Host Environment ---
// We use a Mutex to store mocked state that can be accessed by the host shims.
static MOCKED_ALERTS: Mutex<Vec<(u8, String)>> = Mutex::new(Vec::new());
static MOCKED_TIME: Mutex<f64> = Mutex::new(1_000_000.0);

// `wasm-bindgen` allows us to define a JS shim to mock the host functions.
#[wasm_bindgen(inline_js = r#"
    // This JS code will be executed in the test environment (e.g., headless browser)
    // It provides the implementations for the functions we declared in `extern "C"`.
    
    // We use global variables in JS to store the state of our mocks.
    global.triggered_alerts = [];
    global.mock_time = 1000000.0;

    export function trigger_alert(severity, summary) {
        console.log(`[JS Mock] trigger_alert called with severity: ${severity}, summary: "${summary}"`);
        global.triggered_alerts.push({ severity, summary });
    }

    export function get_host_time() {
        global.mock_time += 10.0; // Increment time on each call to simulate passing time
        return global.mock_time;
    }
    
    // Helper function for tests to reset the mock state
    export function reset_mocks() {
        global.triggered_alerts = [];
        global.mock_time = 1000000.0;
    }

    // Helper function to get the number of triggered alerts
    export function get_alert_count() {
        return global.triggered_alerts.length;
    }
    
    // Helper function to get the last triggered alert
    export function get_last_alert() {
        return global.triggered_alerts[global.triggered_alerts.length - 1];
    }
"#)]
extern "C" {
    fn reset_mocks();
    fn get_alert_count() -> usize;
    fn get_last_alert() -> JsValue;
}

// --- Test Setup ---
fn setup() {
    // Reset the JS mocks and Rust state before each test
    reset_mocks();
    *CONFIG.lock().unwrap() = None;
    *STATE.lock().unwrap() = None;
    
    // Initialize the module with default config
    let config_json = serde_json::to_string(&Config::default()).unwrap();
    let success = initialize(&config_json);
    assert!(success, "Module should initialize successfully");
}

// --- Test Cases ---

#[wasm_bindgen_test]
fn test_initialization() {
    setup(); // Uses default config
    assert!(CONFIG.lock().unwrap().is_some());
    assert!(STATE.lock().unwrap().is_some());

    // Test initialization with custom config
    let custom_config = json!({
        "cpu_high_threshold": 95.0,
        "cpu_strike_limit": 5,
        "suspicious_processes": ["test.exe"]
    }).to_string();
    let success = initialize(&custom_config);
    assert!(success);
    let config = CONFIG.lock().unwrap();
    let config_ref = config.as_ref().unwrap();
    assert_eq!(config_ref.cpu_high_threshold, 95.0);
    assert_eq!(config_ref.suspicious_processes, vec!["test.exe".to_string()]);
}

#[wasm_bindgen_test]
fn test_uninitialized_module_returns_error() {
    // Intentionally do not call setup()
    let event = json!({
        "metric_name": "cpu_usage",
        "source_id": "test-node",
        "value": {"percent": 50.0}
    }).to_string();
    
    let result_json = on_telemetry_event(&event);
    let result: AnalysisResult = serde_json::from_str(&result_json).unwrap();
    
    assert_eq!(result.status, "ERROR");
    assert_eq!(result.reason, Some("Module not initialized".to_string()));
}

#[wasm_bindgen_test]
fn test_cpu_strike_logic_and_alert() {
    setup();
    let high_cpu_event = json!({
        "metric_name": "cpu_usage",
        "source_id": "test-node-1",
        "value": {"percent": 90.0}
    }).to_string();

    // First two high CPU events should not trigger an alert
    let res1_json = on_telemetry_event(&high_cpu_event);
    let res1: AnalysisResult = serde_json::from_str(&res1_json).unwrap();
    assert_eq!(res1.status, "NORMAL");
    assert_eq!(get_alert_count(), 0); // initial alert + this = 1
    
    let res2_json = on_telemetry_event(&high_cpu_event);
    let res2: AnalysisResult = serde_json::from_str(&res2_json).unwrap();
    assert_eq!(res2.status, "NORMAL");
    assert_eq!(get_alert_count(), 0);

    // The third high CPU event should trigger a critical alert
    let res3_json = on_telemetry_event(&high_cpu_event);
    let res3: AnalysisResult = serde_json::from_str(&res3_json).unwrap();
    assert_eq!(res3.status, "ALERT_TRIGGERED");
    assert_eq!(res3.severity, Some(8));
    assert_eq!(get_alert_count(), 1);

    // CPU usage goes back to normal, strike count should reset
    let normal_cpu_event = json!({
        "metric_name": "cpu_usage",
        "source_id": "test-node-1",
        "value": {"percent": 50.0}
    }).to_string();
    on_telemetry_event(&normal_cpu_event);
    assert_eq!(STATE.lock().unwrap().as_ref().unwrap().cpu_strike_count, 0);
}

#[wasm_bindgen_test]
fn test_alert_cooldown_mechanism() {
    setup();
    let high_cpu_event = json!({
        "metric_name": "cpu_usage",
        "source_id": "test-node-1",
        "value": {"percent": 90.0}
    }).to_string();
    
    // Trigger the first alert
    on_telemetry_event(&high_cpu_event);
    on_telemetry_event(&high_cpu_event);
    on_telemetry_event(&high_cpu_event);
    assert_eq!(get_alert_count(), 1);

    // Reset strike count and try to trigger again immediately
    STATE.lock().unwrap().as_mut().unwrap().cpu_strike_count = 0;
    on_telemetry_event(&high_cpu_event);
    on_telemetry_event(&high_cpu_event);
    let res = on_telemetry_event(&high_cpu_event);
    let res_data: AnalysisResult = serde_json::from_str(&res).unwrap();
    
    // Should not trigger another alert because of cooldown
    assert_eq!(get_alert_count(), 1);
    assert_eq!(res_data.status, "NORMAL");
}

#[wasm_bindgen_test]
fn test_network_spike_detection() {
    setup();
    
    // First event establishes baseline
    let event1 = json!({
        "metric_name": "network_traffic",
        "source_id": "test-node-2",
        "value": {"bytes_in": 1000}
    }).to_string();
    on_telemetry_event(&event1);
    assert_eq!(get_alert_count(), 0);

    // Second event is a huge spike (10x > 5x factor)
    let event2 = json!({
        "metric_name": "network_traffic",
        "source_id": "test-node-2",
        "value": {"bytes_in": 10000}
    }).to_string();
    let res_json = on_telemetry_event(&event2);
    let result: AnalysisResult = serde_json::from_str(&res_json).unwrap();

    assert_eq!(result.status, "ALERT_TRIGGERED");
    assert_eq!(result.severity, Some(7));
    assert_eq!(get_alert_count(), 1);
}

#[wasm_bindgen_test]
fn test_suspicious_process_detection() {
    setup();
    let event = json!({
        "metric_name": "process_creation",
        "source_id": "test-node-3",
        "value": {"process_name": "mimikatz.exe"}
    }).to_string();
    
    let res_json = on_telemetry_event(&event);
    let result: AnalysisResult = serde_json::from_str(&res_json).unwrap();
    
    assert_eq!(result.status, "ALERT_TRIGGERED");
    assert_eq!(result.severity, Some(9));
    assert_eq!(get_alert_count(), 1);
}

#[wasm_bindgen_test]
fn test_invalid_event_json() {
    setup();
    let invalid_event = r#"{"metric_name": "cpu_usage", "source_id": "test-node", "val": {}}"#;
    let res_json = on_telemetry_event(invalid_event);
    let result: AnalysisResult = serde_json::from_str(&res_json).unwrap();
    
    assert_eq!(result.status, "ERROR");
    assert!(result.reason.unwrap().contains("Invalid CPU telemetry format"));
}