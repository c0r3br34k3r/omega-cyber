# deception-engine/src/simulation.py
# Python simulation logic for dynamic honey-reality environments

import random
import string

def generate_fake_credential():
    """Generates a fake username and password."""
    username = ''.join(random.choices(string.ascii_lowercase, k=random.randint(5, 10)))
    password = ''.join(random.choices(string.ascii_letters + string.digits + "!@#$%^&*"), k=random.randint(8, 15)))
    return {"username": username, "password": password}

def generate_fake_network_traffic_entry():
    """Generates a fake network traffic log entry."""
    src_ip = "192.168." + str(random.randint(1, 254)) + "." + str(random.randint(1, 254))
    dst_ip = "10.0." + str(random.randint(1, 254)) + "." + str(random.randint(1, 254))
    port = random.randint(1, 65535)
    protocol = random.choice(["TCP", "UDP", "ICMP"])
    bytes_sent = random.randint(100, 10000)
    return {"src_ip": src_ip, "dst_ip": dst_ip, "port": port, "protocol": protocol, "bytes_sent": bytes_sent}

def run_simulation(num_credentials=5, num_traffic_entries=10):
    """
    Runs a simulation to generate deception data.
    """
    print("Running deception engine simulation...")

    fake_credentials = [generate_fake_credential() for _ in range(num_credentials)]
    print("\nGenerated Fake Credentials:")
    for cred in fake_credentials:
        print(f"  Username: {cred['username']}, Password: {cred['password']}")

    fake_traffic = [generate_fake_network_traffic_entry() for _ in range(num_traffic_entries)]
    print("\nGenerated Fake Network Traffic:")
    for traffic in fake_traffic:
        print(f"  {traffic['src_ip']} -> {traffic['dst_ip']}:{traffic['port']} ({traffic['protocol']}) - {traffic['bytes_sent']} bytes")

    print("\nDeception simulation complete.")
    return {"credentials": fake_credentials, "traffic": fake_traffic}

if __name__ == "__main__":
    simulation_results = run_simulation()
    # In a real scenario, these results would be fed to other systems or a database.