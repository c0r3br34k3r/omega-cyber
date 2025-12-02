// src/lib.rs
// ==============================================================================
// OMEGA PLATFORM - WASM DYNAMIC RULE MODULE
// ==============================================================================
//
// This file contains the core logic for a dynamically loadable WebAssembly
// module. It is designed to be executed by a WASM runtime (like wasmtime)
// within a Sentinel Agent, providing a secure, sandboxed environment for
// extensible, high-performance logic.
//
// The module uses `wasm-bindgen` to define a clear interface with the host.
// It processes telemetry events, maintains state, and can call back into the
// host environment to trigger alerts or request more data.
//

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use log::{info, warn, error};

// --- 1. Host Function Imports (from the Sentinel Agent) ---
// This section defines the "safe API" that the host must provide to the WASM module.
// `wasm-bindgen` will link these to the functions provided by the host environment.
#[wasm_bindgen]
extern "C" {
    // A function to log messages from within the WASM module.
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);

    // A function to trigger an alert in the Omega Platform.
    // The host (Sentinel Agent) is responsible for implementing this.
    fn trigger_alert(severity: u8, summary: &str);

    // A function to get the current system time (as a Unix timestamp).
    // This is preferred over `std::time` to ensure the WASM module uses the host's clock.
    fn get_host_time() -> f64;
}

// --- 2. Data Structures for Host-Module Communication ---

/// Represents telemetry data passed from the host to the WASM module.
#[derive(Serialize, Deserialize, Debug)]
pub struct TelemetryEvent {
    pub metric_name: String,
    pub source_id: String,
    pub value: serde_json::Value,
}

/// Represents the result of the analysis performed by the WASM module.
#[derive(Serialize, Deserialize, Debug)]
pub struct AnalysisResult {
    pub status: String, // e.g., "NORMAL", "ALERT_TRIGGERED", "ERROR"
    pub reason: Option<String>,
    pub severity: Option<u8>,
}

// --- 3. Internal State and Configuration ---

#[derive(Serialize, Deserialize, Debug)]
struct Config {
    cpu_high_threshold: f64,
    cpu_strike_limit: u32,
    network_spike_factor: f64,
    alert_cooldown_sec: u64,
    suspicious_processes: Vec<String>,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            cpu_high_threshold: 85.0,
            cpu_strike_limit: 3,
            network_spike_factor: 5.0,
            alert_cooldown_sec: 60,
            suspicious_processes: vec![
                "powershell.exe".to_string(),
                "mimikatz.exe".to_string(),
                "nc.exe".to_string(),
            ],
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Default)]
struct ModuleState {
    cpu_strike_count: u32,
    previous_network_bytes: std::collections::HashMap<String, u64>,
    alert_cooldown_timers: std::collections::HashMap<String, f64>,
}

// Use a Mutex to safely manage global state across potentially concurrent calls.
// `lazy_static` would also be an option here.
static CONFIG: Mutex<Option<Config>> = Mutex::new(None);
static STATE: Mutex<Option<ModuleState>> = Mutex::new(None);


// --- 4. Exported Functions (WASM Module API) ---

/// Initializes the WASM module with a given configuration.
/// Must be called once by the host before any other functions are used.
///
/// @param config_json: A JSON string representing the `Config` struct.
/// @returns A boolean indicating success.
#[wasm_bindgen]
pub fn initialize(config_json: &str) -> bool {
    // Set up a panic hook to log panics to the console
    std::panic::set_hook(Box::new(console_error_panic_hook::hook));
    wasm_bindgen_console_logger::init().expect("Failed to initialize logger");

    info!("[WASM] Initializing module...");
    
    let config: Config = match serde_json::from_str(config_json) {
        Ok(c) => c,
        Err(e) => {
            error!("[WASM] Failed to parse configuration JSON: {}", e);
            return false;
        }
    };
    
    *CONFIG.lock().unwrap() = Some(config);
    *STATE.lock().unwrap() = Some(ModuleState::default());

    info!("[WASM] Module initialized successfully.");
    true
}

/// The main entry point for processing telemetry events.
/// The host calls this function for each new piece of telemetry.
///
/// @param event_json: A JSON string representing the `TelemetryEvent` struct.
/// @returns A JSON string representing the `AnalysisResult`.
#[wasm_bindgen]
pub fn on_telemetry_event(event_json: &str) -> String {
    let mut state_guard = STATE.lock().unwrap();
    let state = match state_guard.as_mut() {
        Some(s) => s,
        None => return serde_json::to_string(&AnalysisResult {
            status: "ERROR".to_string(),
            reason: Some("Module not initialized".to_string()),
            severity: None,
        }).unwrap(),
    };

    let config_guard = CONFIG.lock().unwrap();
    let config = match config_guard.as_ref() {
        Some(c) => c,
        None => return serde_json::to_string(&AnalysisResult {
            status: "ERROR".to_string(),
            reason: Some("Module not initialized".to_string()),
            severity: None,
        }).unwrap(),
    };

    let event: TelemetryEvent = match serde_json::from_str(event_json) {
        Ok(e) => e,
        Err(e) => return serde_json::to_string(&AnalysisResult {
            status: "ERROR".to_string(),
            reason: Some(format!("Failed to parse event JSON: {}", e)),
            severity: None,
        }).unwrap(),
    };

    let result = match event.metric_name.as_str() {
        "cpu_usage" => analyze_cpu(event, state, config),
        "network_traffic" => analyze_network(event, state, config),
        "process_creation" => analyze_process(event, state, config),
        _ => AnalysisResult { status: "NO_HANDLER".to_string(), reason: None, severity: None },
    };
    
    serde_json::to_string(&result).unwrap()
}

// --- 5. Internal Logic Functions ---

fn analyze_cpu(event: TelemetryEvent, state: &mut ModuleState, config: &Config) -> AnalysisResult {
    if let Some(cpu_percent) = event.value.get("percent").and_then(|v| v.as_f64()) {
        if cpu_percent > config.cpu_high_threshold {
            state.cpu_strike_count += 1;
            if state.cpu_strike_count >= config.cpu_strike_limit && !is_on_cooldown("HIGH_CPU", state) {
                let summary = format!("Critical: Sustained high CPU usage detected at {:.2}% on node {}", cpu_percent, event.source_id);
                trigger_alert(8, &summary);
                start_cooldown("HIGH_CPU", state, config);
                return AnalysisResult { status: "ALERT_TRIGGERED".to_string(), reason: Some(summary), severity: Some(8) };
            }
        } else {
            state.cpu_strike_count = 0;
        }
        AnalysisResult { status: "NORMAL".to_string(), reason: None, severity: None }
    } else {
        AnalysisResult { status: "ERROR".to_string(), reason: Some("Invalid CPU telemetry format".to_string()), severity: None }
    }
}

fn analyze_network(event: TelemetryEvent, state: &mut ModuleState, config: &Config) -> AnalysisResult {
    if let Some(bytes_in) = event.value.get("bytes_in").and_then(|v| v.as_u64()) {
        if let Some(&previous_bytes) = state.previous_network_bytes.get(&event.source_id) {
            if bytes_in > previous_bytes * config.network_spike_factor as u64 && !is_on_cooldown("NETWORK_SPIKE", state) {
                let summary = format!("High severity: Sudden network traffic spike detected on node {}", event.source_id);
                trigger_alert(7, &summary);
                start_cooldown("NETWORK_SPIKE", state, config);
                return AnalysisResult { status: "ALERT_TRIGGERED".to_string(), reason: Some(summary), severity: Some(7) };
            }
        }
        state.previous_network_bytes.insert(event.source_id, bytes_in);
        AnalysisResult { status: "NORMAL".to_string(), reason: None, severity: None }
    } else {
        AnalysisResult { status: "ERROR".to_string(), reason: Some("Invalid network telemetry format".to_string()), severity: None }
    }
}

fn analyze_process(event: TelemetryEvent, state: &mut ModuleState, config: &Config) -> AnalysisResult {
    if let Some(process_name) = event.value.get("process_name").and_then(|v| v.as_str()) {
        if config.suspicious_processes.iter().any(|suspicious| process_name.eq_ignore_ascii_case(suspicious)) {
            if !is_on_cooldown("SUSPICIOUS_PROCESS", state) {
                let summary = format!("Critical: Suspicious process '{}' executed on node {}", process_name, event.source_id);
                trigger_alert(9, &summary);
                start_cooldown("SUSPICIOUS_PROCESS", state, config);
                return AnalysisResult { status: "ALERT_TRIGGERED".to_string(), reason: Some(summary), severity: Some(9) };
            }
        }
        AnalysisResult { status: "NORMAL".to_string(), reason: None, severity: None }
    } else {
        AnalysisResult { status: "ERROR".to_string(), reason: Some("Invalid process telemetry format".to_string()), severity: None }
    }
}

fn is_on_cooldown(alert_type: &str, state: &ModuleState) -> bool {
    let now = get_host_time();
    if let Some(&cooldown_end) = state.alert_cooldown_timers.get(alert_type) {
        return now < cooldown_end;
    }
    false
}

fn start_cooldown(alert_type: &str, state: &mut ModuleState, config: &Config) {
    let now = get_host_time();
    state.alert_cooldown_timers.insert(alert_type.to_string(), now + config.alert_cooldown_sec as f64);
}
