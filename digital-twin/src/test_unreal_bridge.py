# digital-twin/src/test_unreal_bridge.py
import unittest
import time
from unittest.mock import patch
from unreal_bridge import connect_to_unreal, update_digital_twin_state, get_digital_twin_telemetry

class TestUnrealBridge(unittest.TestCase):

    @patch('builtins.print') # Mock print to prevent output during test
    @patch('time.sleep', return_value=None) # Mock time.sleep to speed up tests
    def test_connect_to_unreal(self, mock_sleep, mock_print):
        result = connect_to_unreal()
        self.assertTrue(result)
        mock_print.assert_any_call("Simulating connection to Unreal Engine...")
        mock_print.assert_any_call("Connection to Unreal Engine established (simulated).")

    @patch('builtins.print') # Mock print
    @patch('time.sleep', return_value=None) # Mock time.sleep
    def test_update_digital_twin_state(self, mock_sleep, mock_print):
        entity_id = "test_entity_1"
        position = (1.0, 2.0, 3.0)
        status = "testing"
        result = update_digital_twin_state(entity_id, position, status)
        self.assertIn("status", result)
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["entity_id"], entity_id)
        mock_print.assert_called_with(f"Simulating update for entity '{entity_id}': Position={position}, Status='{status}'")

    @patch('builtins.print') # Mock print
    @patch('time.sleep', return_value=None) # Mock time.sleep
    @patch('random.uniform', side_effect=[50.0, 30.0, 25.0]) # Mock random for consistent telemetry
    def test_get_digital_twin_telemetry(self, mock_random, mock_sleep, mock_print):
        entity_id = "test_entity_2"
        telemetry = get_digital_twin_telemetry(entity_id)
        self.assertIn("entity_id", telemetry)
        self.assertEqual(telemetry["entity_id"], entity_id)
        self.assertIn("cpu_usage", telemetry)
        self.assertIn("memory_usage", telemetry)
        self.assertIn("network_io_mbps", telemetry)
        self.assertEqual(telemetry["cpu_usage"], 50.0)
        self.assertEqual(telemetry["memory_usage"], 30.0)
        self.assertEqual(telemetry["network_io_mbps"], 25.0)
        mock_print.assert_called_with(f"Simulating fetching telemetry for entity '{entity_id}'...")

if __name__ == "__main__":
    unittest.main()
