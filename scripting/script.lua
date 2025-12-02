-- ==============================================================================
-- OMEGA PLATFORM - DYNAMIC AGENT RULE (LUA SCRIPT)
-- ==============================================================================
--
-- This script provides dynamic, stateful logic for a Sentinel Agent to analyze
-- telemetry events. It is designed to be executed within a secure, sandboxed
-- Lua environment provided by the `lua_wrapper.py`.
--
-- Features:
-- - Stateful analysis: Tracks metrics over time to detect sustained anomalies.
-- - Configurable thresholds: Easily tunable parameters without changing code.
-- - Alert cooldowns: Prevents alert spamming for noisy metrics.
-- - API integration: Calls back into the host application's safe API.
--

-- --- 1. Configuration Table ---
-- These parameters can be overridden by the host application.
local Config = {
    CPU_HIGH_THRESHOLD = 85.0,  -- %
    CPU_STRIKE_LIMIT = 3,         -- Number of consecutive high readings to trigger critical alert
    NETWORK_SPIKE_FACTOR = 5.0,   -- e.g., 5x the previous value
    ALERT_COOLDOWN_SEC = 60,      -- 60 seconds
    SUSPICIOUS_PROCESSES = {
        "powershell.exe", "mimikatz.exe", "nc.exe", "ncat.exe"
    }
}

-- --- 2. State Table ---
-- This table maintains state across multiple executions of the script.
-- It will be preserved in the Lua runtime between calls from Python.
local State = {
    cpu_strike_count = 0,
    previous_metric_values = {},
    alert_cooldown_timers = {}
}

-- --- 3. Helper Functions ---

-- Checks if a given alert type is on cooldown.
local function is_on_cooldown(alert_type)
    local now = os.time() -- Note: `os.time()` must be whitelisted in the sandbox, or a custom time function provided.
    local cooldown_end = State.alert_cooldown_timers[alert_type]
    if cooldown_end and now < cooldown_end then
        return true
    end
    return false
end

-- Starts a cooldown for a given alert type.
local function start_cooldown(alert_type)
    local now = os.time()
    State.alert_cooldown_timers[alert_type] = now + Config.ALERT_COOLDOWN_SEC
end

-- --- 4. Telemetry Analysis Functions ---

-- Analyzes CPU usage telemetry.
local function analyze_cpu_usage(telemetry)
    local cpu_usage = telemetry.value.percent
    if cpu_usage > Config.CPU_HIGH_THRESHOLD then
        State.cpu_strike_count = State.cpu_strike_count + 1
        print("CPU strike count increased to: " .. State.cpu_strike_count)
        
        if State.cpu_strike_count >= Config.CPU_STRIKE_LIMIT and not is_on_cooldown("HIGH_CPU") then
            trigger_alert(8, "Critical: Sustained high CPU usage detected at " .. cpu_usage .. "%")
            start_cooldown("HIGH_CPU")
            return { result = "ALERT_TRIGGERED", severity = 8 }
        end
        return { result = "STRIKE_RECORDED" }
    else
        -- Reset strike count if usage drops below threshold
        if State.cpu_strike_count > 0 then
            print("CPU strike count reset.")
            State.cpu_strike_count = 0
        end
        return { result = "NORMAL" }
    end
end

-- Analyzes network traffic telemetry.
local function analyze_network_traffic(telemetry)
    local current_bytes = telemetry.value.bytes_in
    local metric_key = "network_bytes_in:" .. telemetry.source_id
    local previous_bytes = State.previous_metric_values[metric_key]
    
    -- Store current value for next time
    State.previous_metric_values[metric_key] = current_bytes

    if previous_bytes and current_bytes > (previous_bytes * Config.NETWORK_SPIKE_FACTOR) and not is_on_cooldown("NETWORK_SPIKE") then
        trigger_alert(7, "High severity: Sudden network traffic spike detected. From " .. previous_bytes .. " to " .. current_bytes .. " bytes.")
        start_cooldown("NETWORK_SPIKE")
        return { result = "ALERT_TRIGGERED", severity = 7 }
    end
    return { result = "NORMAL" }
end

-- Analyzes process creation events.
local function analyze_process_creation(telemetry)
    local process_name = telemetry.value.process_name:lower()
    for _, suspicious_name in ipairs(Config.SUSPICIOUS_PROCESSES) do
        if process_name == suspicious_name and not is_on_cooldown("SUSPICIOUS_PROCESS") then
            trigger_alert(9, "Critical: Suspicious process '" .. process_name .. "' executed.")
            start_cooldown("SUSPICIOUS_PROCESS")
            return { result = "ALERT_TRIGGERED", severity = 9 }
        end
    end
    return { result = "NORMAL" }
end

-- Dispatcher table for analysis functions
local TelemetryDispatch = {
    ["cpu_usage"] = analyze_cpu_usage,
    ["network_traffic"] = analyze_network_traffic,
    ["process_creation"] = analyze_process_creation,
}


-- --- 5. Main Public Functions (callable from Python) ---

-- Initializes or overrides the script's configuration.
function initialize(config_override)
    print("Lua: Initializing configuration...")
    if config_override then
        for k, v in pairs(config_override) do
            Config[k] = v
        end
    end
    print("Lua: Configuration loaded.")
    return { status = "OK", config = Config }
end

-- Main entry point for processing telemetry events.
-- This function is called by the Python host for each new event.
function on_telemetry_event(telemetry_data)
    print("Lua: Received telemetry event for metric: " .. telemetry_data.metric_name)

    local handler = TelemetryDispatch[telemetry_data.metric_name]
    if handler then
        return handler(telemetry_data)
    else
        print("Lua: No handler found for metric '" .. telemetry_data.metric_name .. "'")
        return { result = "NO_HANDLER" }
    end
end


-- --- 6. Script Initialization ---
print("Omega Dynamic Agent Rule script loaded successfully.")
-- Perform any one-time setup here if needed.
trigger_alert(2, "Lua rule engine initialized.")
