# deception-engine/src/test_simulation.py
import unittest
from simulation import generate_fake_credential, generate_fake_network_traffic_entry

class TestDeceptionSimulation(unittest.TestCase):

    def test_generate_fake_credential(self):
        credential = generate_fake_credential()
        self.assertIn("username", credential)
        self.assertIn("password", credential)
        self.assertGreaterEqual(len(credential["username"]), 5)
        self.assertGreaterEqual(len(credential["password"]), 8)

    def test_generate_fake_network_traffic_entry(self):
        traffic_entry = generate_fake_network_traffic_entry()
        self.assertIn("src_ip", traffic_entry)
        self.assertIn("dst_ip", traffic_entry)
        self.assertIn("port", traffic_entry)
        self.assertIn("protocol", traffic_entry)
        self.assertIn("bytes_sent", traffic_entry)
        self.assertTrue(traffic_entry["src_ip"].startswith("192.168."))
        self.assertTrue(traffic_entry["dst_ip"].startswith("10.0."))
        self.assertGreaterEqual(traffic_entry["port"], 1)
        self.assertLessEqual(traffic_entry["port"], 65535)
        self.assertIn(traffic_entry["protocol"], ["TCP", "UDP", "ICMP"])
        self.assertGreaterEqual(traffic_entry["bytes_sent"], 100)
        self.assertLessEqual(traffic_entry["bytes_sent"], 10000)

if __name__ == "__main__":
    unittest.main()
