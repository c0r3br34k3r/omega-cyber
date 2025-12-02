# deception-engine/src/simulation.py
import argparse
import json
import logging
import random
import time
from collections import deque
from enum import Enum, auto
from typing import Dict, List, Any, Optional

# --- Configuration and Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Enums ---
class AgentType(Enum):
    ATTACKER = auto()
    DEFENDER = auto()
    HONEYPOT = auto()
    USER = auto()

class EventType(Enum):
    INIT = auto()
    SCAN = auto()
    PROBE = auto()
    EXPLOIT_ATTEMPT = auto()
    BREACH = auto()
    DETECTION = auto()
    RESPONSE_DEPLOY = auto()
    RESPONSE_ISOLATE = auto()
    HONEYPOT_ENGAGE = auto()
    DATA_EXFIL = auto()
    ANOMALY = auto()

class Vulnerability(Enum):
    CVE_2023_1234 = auto()
    CVE_2024_5678 = auto()
    ZERO_DAY_IMPACT = auto()

class HoneypotType(Enum):
    SSH = auto()
    WEB = auto()
    DATABASE = auto()

# --- Core Data Models ---
class Node:
    def __init__(self, node_id: str, is_honeypot: bool = False, honeypot_type: Optional[HoneypotType] = None, vulnerable_to: Optional[List[Vulnerability]] = None):
        self.node_id = node_id
        self.is_honeypot = is_honeypot
        self.honeypot_type = honeypot_type
        self.compromised = False
        self.detected_by_defender = False
        self.vulnerable_to = vulnerable_to if vulnerable_to is not None else []
        self.services = set() # Example: {'ssh', 'web', 'db'}
        self.deception_level = 0 # How convincing the honeypot is

class NetworkEnvironment:
    def __init__(self, nodes: List[Node], adjacency_list: Dict[str, List[str]]):
        self.nodes: Dict[str, Node] = {node.node_id: node for node in nodes}
        self.adjacency_list = adjacency_list # 'A': ['B', 'C']
        self.events: deque[Dict] = deque(maxlen=1000) # Store recent events

    def add_event(self, event_type: EventType, source: str, target: str, description: str, severity: float = 0.5):
        event_data = {
            "timestamp": time.time(),
            "type": event_type.name,
            "source": source,
            "target": target,
            "description": description,
            "severity": severity
        }
        self.events.append(event_data)
        logger.info(f"Event: {event_data}")
        print(json.dumps(event_data)) # Output events to stdout for Node.js processing

    def get_node(self, node_id: str) -> Optional[Node]:
        return self.nodes.get(node_id)

    def get_neighbors(self, node_id: str) -> List[str]:
        return self.adjacency_list.get(node_id, [])

class Agent:
    def __init__(self, agent_id: str, agent_type: AgentType, current_node: str):
        self.agent_id = agent_id
        self.agent_type = agent_type
        self.current_node = current_node
        self.state: Dict[str, Any] = {} # Internal state for RL or FSM
        self.action_history: List[Dict] = []

    def choose_action(self, env: NetworkEnvironment) -> Optional[Dict]:
        raise NotImplementedError

    def take_action(self, env: NetworkEnvironment, action: Dict):
        raise NotImplementedError

class AttackerAgent(Agent):
    def __init__(self, agent_id: str, current_node: str, target_nodes: List[str]):
        super().__init__(agent_id, AgentType.ATTACKER, current_node)
        self.target_nodes = target_nodes
        self.compromised_nodes = set([current_node])
        self.known_vulnerabilities: List[Vulnerability] = []
        self.strategy_model = {} # Placeholder for a simplified Q-table or policy

    def choose_action(self, env: NetworkEnvironment) -> Optional[Dict]:
        available_actions = []
        current_node_obj = env.get_node(self.current_node)

        # Explore neighbors
        for neighbor_id in env.get_neighbors(self.current_node):
            if neighbor_id not in self.compromised_nodes:
                available_actions.append({"type": "SCAN", "target": neighbor_id})
                if random.random() < 0.3: # Stochastic vulnerability discovery
                    target_node_obj = env.get_node(neighbor_id)
                    if target_node_obj and target_node_obj.vulnerable_to:
                        discovered_vuln = random.choice(target_node_obj.vulnerable_to)
                        if discovered_vuln not in self.known_vulnerabilities:
                            self.known_vulnerabilities.append(discovered_vuln)
                            env.add_event(EventType.PROBE, self.agent_id, neighbor_id, f"Attacker discovered {discovered_vuln.name} on {neighbor_id}")

        # Attempt exploit if known vulnerability exists and node is not compromised
        for vuln in self.known_vulnerabilities:
            for node_id, node_obj in env.nodes.items():
                if vuln in node_obj.vulnerable_to and node_id not in self.compromised_nodes:
                    available_actions.append({"type": "EXPLOIT", "target": node_id, "vulnerability": vuln.name})

        # Move to a compromised node
        for comp_node in self.compromised_nodes:
            if comp_node != self.current_node:
                available_actions.append({"type": "MOVE", "target": comp_node})

        if not available_actions:
            return None # No actions possible

        # Simple Q-learning inspired action choice (placeholder)
        # In a full RL model, this would evaluate state-action pairs
        return random.choice(available_actions)

    def take_action(self, env: NetworkEnvironment, action: Dict):
        action_type = action["type"]
        target_node_id = action.get("target")
        target_node_obj = env.get_node(target_node_id) if target_node_id else None

        if action_type == "SCAN":
            env.add_event(EventType.SCAN, self.agent_id, target_node_id, f"Attacker scans {target_node_id}")
        elif action_type == "EXPLOIT" and target_node_obj:
            if random.random() < 0.7: # Stochastic success of exploit
                target_node_obj.compromised = True
                self.compromised_nodes.add(target_node_id)
                env.add_event(EventType.BREACH, self.agent_id, target_node_id, f"Attacker breached {target_node_id} via {action['vulnerability']}")
                if target_node_obj.is_honeypot:
                    env.add_event(EventType.HONEYPOT_ENGAGE, self.agent_id, target_node_id, f"Attacker engaged honeypot {target_node_id}", severity=0.8)
            else:
                env.add_event(EventType.EXPLOIT_ATTEMPT, self.agent_id, target_node_id, f"Attacker failed to exploit {target_node_id}")
        elif action_type == "MOVE" and target_node_obj:
            self.current_node = target_node_id
            env.add_event(EventType.INFO, self.agent_id, target_node_id, f"Attacker moved to {target_node_id}")
        # Add more sophisticated attack patterns like data exfil, privilege escalation etc.

class DefenderAgent(Agent):
    def __init__(self, agent_id: str, current_node: str, detection_model: Dict[str, float]):
        super().__init__(agent_id, AgentType.DEFENDER, current_node)
        self.detection_model = detection_model # { 'SCAN': 0.7, 'EXPLOIT_ATTEMPT': 0.9 }
        self.alert_queue: deque[Dict] = deque()

    def choose_action(self, env: NetworkEnvironment) -> Optional[Dict]:
        # Process alerts from environment
        for event in list(env.events): # Iterate over a copy to avoid modification issues
            if event["type"] in self.detection_model and random.random() < self.detection_model[event["type"]]:
                if not env.get_node(event["target"]).detected_by_defender:
                    self.alert_queue.append(event)
                    env.get_node(event["target"]).detected_by_defender = True
                    env.add_event(EventType.DETECTION, self.agent_id, event["target"], f"Defender detected {event['type']} on {event['target']}")

        if self.alert_queue:
            alert = self.alert_queue.popleft()
            return {"type": "RESPOND", "target": alert["target"], "alert_type": alert["type"]}
        return None

    def take_action(self, env: NetworkEnvironment, action: Dict):
        action_type = action["type"]
        target_node_id = action.get("target")
        target_node_obj = env.get_node(target_node_id) if target_node_id else None

        if action_type == "RESPOND" and target_node_obj:
            if target_node_obj.compromised:
                # Isolate the node
                target_node_obj.compromised = False # Assume isolation removes compromise
                env.add_event(EventType.RESPONSE_ISOLATE, self.agent_id, target_node_id, f"Defender isolated and remediated {target_node_id}")
            else:
                # Deploy additional sensors or deception
                env.add_event(EventType.RESPONSE_DEPLOY, self.agent_id, target_node_id, f"Defender deployed deception layer on {target_node_id}")
                target_node_obj.deception_level += 1


class SimulationEngine:
    def __init__(self, num_attackers: int, num_honeypots: int, scenario: str, sim_duration_steps: int):
        self.num_attackers = num_attackers
        self.num_honeypots = num_honeypots
        self.scenario = scenario
        self.sim_duration_steps = sim_duration_steps
        self.env: Optional[NetworkEnvironment] = None
        self.agents: List[Agent] = []
        self.current_step = 0
        self.metrics: Dict[str, Any] = {}

    def _initialize_environment(self):
        # Define a sample network topology
        nodes_data = [
            Node('server-dc-01', vulnerable_to=[Vulnerability.CVE_2023_1234]),
            Node('workstation-hr', vulnerable_to=[Vulnerability.CVE_2024_5678]),
            Node('db-finance', vulnerable_to=[Vulnerability.ZERO_DAY_IMPACT]),
            Node('web-portal', vulnerable_to=[Vulnerability.CVE_2023_1234, Vulnerability.CVE_2024_5678]),
            Node('dmz-gateway')
        ]
        adjacency_list = {
            'server-dc-01': ['workstation-hr', 'db-finance', 'web-portal'],
            'workstation-hr': ['server-dc-01'],
            'db-finance': ['server-dc-01'],
            'web-portal': ['server-dc-01', 'dmz-gateway'],
            'dmz-gateway': ['web-portal']
        }

        # Deploy honeypots
        available_nodes = [node.node_id for node in nodes_data if not node.is_honeypot]
        honeypot_nodes_ids = random.sample(available_nodes, min(self.num_honeypots, len(available_nodes)))
        for node_id in honeypot_nodes_ids:
            hp_node_idx = [i for i, node in enumerate(nodes_data) if node.node_id == node_id][0]
            nodes_data[hp_node_idx].is_honeypot = True
            nodes_data[hp_node_idx].honeypot_type = random.choice(list(HoneypotType))
            nodes_data[hp_node_idx].vulnerable_to = [random.choice(list(Vulnerability))] # Honeypots have fake vulnerabilities

        self.env = NetworkEnvironment(nodes_data, adjacency_list)

    def _initialize_agents(self):
        # Attacker agents
        all_node_ids = list(self.env.nodes.keys())
        for i in range(self.num_attackers):
            start_node = random.choice(all_node_ids)
            target_nodes = random.sample(all_node_ids, k=min(3, len(all_node_ids))) # Attackers have multiple potential targets
            self.agents.append(AttackerAgent(f"Attacker-{i+1}", start_node, target_nodes))

        # Defender agents
        self.agents.append(DefenderAgent("Defender-1", random.choice(all_node_ids), {'SCAN': 0.7, 'EXPLOIT_ATTEMPT': 0.9, 'BREACH': 0.99}))

    def run(self):
        logger.info(f"Starting simulation scenario: {self.scenario} with {self.num_attackers} attackers and {self.num_honeypots} honeypots for {self.sim_duration_steps} steps.")
        self._initialize_environment()
        self._initialize_agents()

        if not self.env:
            logger.error("Environment not initialized.")
            return

        self.env.add_event(EventType.INIT, "SimulationEngine", "Global", f"Simulation started: {self.scenario}")

        for step in range(self.sim_duration_steps):
            self.current_step = step
            logger.debug(f"Simulation Step: {step+1}/{self.sim_duration_steps}")

            random.shuffle(self.agents) # Randomize agent turn order

            for agent in self.agents:
                action = agent.choose_action(self.env)
                if action:
                    agent.take_action(self.env, action)
            
            # Periodically update metrics
            if step % 10 == 0:
                self._update_metrics()
            
            time.sleep(0.1) # Simulate real-time progression

        self._finalize_metrics()
        logger.info("Simulation finished.")
        print(json.dumps({"simulation_summary": self.metrics}))


    def _update_metrics(self):
        if not self.env: return

        compromised_count = sum(1 for node in self.env.nodes.values() if node.compromised)
        total_nodes = len(self.env.nodes)
        
        self.metrics["current_step"] = self.current_step
        self.metrics["compromised_nodes_count"] = compromised_count
        self.metrics["system_integrity_percentage"] = (total_nodes - compromised_count) / total_nodes * 100
        # Add more real-time metrics

    def _finalize_metrics(self):
        if not self.env: return

        total_breaches = sum(1 for event in self.env.events if event['type'] == EventType.BREACH.name)
        total_detections = sum(1 for event in self.env.events if event['type'] == EventType.DETECTION.name)
        honeypot_engagements = sum(1 for event in self.env.events if event['type'] == EventType.HONEYPOT_ENGAGE.name)

        self.metrics["final_compromised_nodes_count"] = sum(1 for node in self.env.nodes.values() if node.compromised)
        self.metrics["total_breaches"] = total_breaches
        self.metrics["total_detections"] = total_detections
        self.metrics["honeypot_engagements"] = honeypot_engagements
        self.metrics["simulation_completed"] = True
        self.metrics["final_events"] = list(self.env.events)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Omega Deception Engine Cybersecurity Simulation.")
    parser.add_argument("--attackers", type=int, default=1, help="Number of attacker agents.")
    parser.add_argument("--honeypots", type=int, default=1, help="Number of honeypot nodes.")
    parser.add_argument("--scenario", type=str, default="default_infiltration", help="Simulation scenario name.")
    parser.add_argument("--steps", type=int, default=100, help="Number of simulation steps.")
    
    args = parser.parse_args()

    # Create and run the simulation engine
    engine = SimulationEngine(args.attackers, args.honeypots, args.scenario, args.steps)
    engine.run()
