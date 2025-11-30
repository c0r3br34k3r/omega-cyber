# test_main.py for intelligence-core
import unittest
import json
from unittest.mock import patch, MagicMock
from io import StringIO
import sys

# Assume main.py functions are imported or directly available
# For this test, we'll import them.
from main import simulate_gnn_prediction, simulate_llm_action_recommendation

class TestIntelligenceCore(unittest.TestCase):

    @patch('builtins.print') # Mock print to prevent output during test
    @patch('random.random', return_value=0.5) # Mock random to get consistent prediction
    @patch('random.uniform', return_value=0.7) # Mock random to get consistent confidence
    def test_simulate_gnn_prediction(self, mock_uniform, mock_random, mock_print):
        input_data = {"nodes": 1, "edges": 1, "features": []}
        result = simulate_gnn_prediction(input_data)
        self.assertIn("prediction", result)
        self.assertIn("confidence", result)
        self.assertEqual(result["prediction"], "no_threat") # Based on mock_random=0.5 < 0.7
        self.assertEqual(result["confidence"], 0.7)
        mock_print.assert_called_with("Simulating GNN prediction for input: {'nodes': 1, 'edges': 1, 'features': []}")

    @patch('builtins.print') # Mock print
    def test_simulate_llm_action_recommendation_threat(self, mock_print):
        threat_details = {"prediction": "threat_detected", "confidence": 0.8}
        result = simulate_llm_action_recommendation(threat_details)
        self.assertIn("recommendation", result)
        self.assertEqual(result["recommendation"], "Isolate host and deploy deception environment.")
        mock_print.assert_called_with("Simulating LLM action recommendation for: {'prediction': 'threat_detected', 'confidence': 0.8}")

    @patch('builtins.print') # Mock print
    def test_simulate_llm_action_recommendation_no_threat(self, mock_print):
        threat_details = {"prediction": "no_threat", "confidence": 0.9}
        result = simulate_llm_action_recommendation(threat_details)
        self.assertIn("recommendation", result)
        self.assertEqual(result["recommendation"], "Monitor network traffic.")
        mock_print.assert_called_with("Simulating LLM action recommendation for: {'prediction': 'no_threat', 'confidence': 0.9}")

if __name__ == "__main__":
    unittest.main()
