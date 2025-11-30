// sentinel-agents/src/rust_agent_test.rs

#[cfg(test)]
mod tests {
    use super::super::main::{simulate_process_monitor, process_safe_data}; // Adjust path based on module structure

    #[test]
    fn test_simulate_process_monitor_clean() {
        // Even process IDs should be clean in simulation
        let result = simulate_process_monitor(2);
        assert!(result);
    }

    #[test]
    fn test_simulate_process_monitor_anomalous() {
        // Odd process IDs should be anomalous in simulation
        let result = simulate_process_monitor(1);
        assert!(!result);
    }

    #[test]
    fn test_process_safe_data() {
        let input_data = vec![1, 2, 3, 255]; // 255 + 1 wraps around to 0 for u8
        let expected_output = vec![2, 3, 4, 0];
        let processed_data = process_safe_data(&input_data);
        assert_eq!(processed_data, expected_output);
    }
}
