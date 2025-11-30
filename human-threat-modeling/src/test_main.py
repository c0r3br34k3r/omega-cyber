# human-threat-modeling/src/test_main.py
import unittest
from unittest.mock import patch
import random
from main import simulate_behavioral_analysis, generate_attacker_persona

class TestHumanThreatModeling(unittest.TestCase):

    @patch('builtins.print') # Mock print to prevent output during test
    @patch('random.random', return_value=0.05) # Force low risk
    def test_simulate_behavioral_analysis_low_risk(self, mock_random, mock_print):
        user_actions = ["login", "browse"]
        result = simulate_behavioral_analysis(user_actions)
        self.assertEqual(result, "Low risk: normal activity.")
        mock_print.assert_called_with(f"Simulating LLM analysis for user actions: {user_actions}")

    @patch('builtins.print') # Mock print
    @patch('random.random', return_value=0.25) # Force medium risk
    def test_simulate_behavioral_analysis_medium_risk(self, mock_random, mock_print):
        user_actions = ["login", "unusual_activity"]
        result = simulate_behavioral_analysis(user_actions)
        self.assertEqual(result, "Medium risk: unusual activity detected.")
        mock_print.assert_called_with(f"Simulating LLM analysis for user actions: {user_actions}")

    @patch('builtins.print') # Mock print
    @patch('random.random', return_value=0.5) # Irrelevant for this path
    def test_simulate_behavioral_analysis_high_risk(self, mock_random, mock_print):
        user_actions = ["login", "unusual_login", "data_access"]
        result = simulate_behavioral_analysis(user_actions)
        self.assertEqual(result, "High risk: potential insider threat activity detected.")
        mock_print.assert_called_with(f"Simulating LLM analysis for user actions: {user_actions}")

    @patch('builtins.print') # Mock print
    @patch('random.choice', side_effect=["Cybercriminal Syndicate", "Sabotage"])
    @patch('random.sample', return_value=["Phishing Campaigns"])
    def test_generate_attacker_persona(self, mock_sample, mock_choice, mock_print):
        threat_context = "financial fraud"
        persona = generate_attacker_persona(threat_context)
        self.assertIn("threat_actor_type", persona)
        self.assertIn("motivation", persona)
        self.assertIn("typical_capabilities", persona)
        self.assertIn("likely_targets", persona)
        self.assertEqual(persona["threat_actor_type"], "Cybercriminal Syndicate")
        self.assertEqual(persona["motivation"], "Sabotage")
        self.assertEqual(persona["typical_capabilities"], ["Phishing Campaigns"])
        self.assertEqual(persona["likely_targets"], "Organizations related to financial fraud")
        mock_print.assert_called_with(f"Simulating LLM generation of attacker persona for context: 'financial fraud'")

if __name__ == "__main__":
    unittest.main()
