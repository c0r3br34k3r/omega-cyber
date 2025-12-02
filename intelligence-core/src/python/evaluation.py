# intelligence-core/src/python/evaluation.py
import argparse
import json
import logging
import random
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Any, Generator, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

from pydantic import BaseModel, Field
from tqdm import tqdm

# --- Configuration & Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - [%(name)s] %(message)s')
logger = logging.getLogger(__name__)

# --- Data Models (Pydantic for validation) ---

class AgentConfig(BaseModel):
    agent_id: str
    model_path: str
    params: Dict[str, Any] = Field(default_factory=dict)

class ScenarioConfig(BaseModel):
    scenario_id: str
    description: str
    max_steps: int
    environment_params: Dict[str, Any]

class EvaluationTask(BaseModel):
    task_id: str
    scenario: ScenarioConfig
    defensive_agent: AgentConfig
    adversarial_agent: AgentConfig

class EvaluationResult(BaseModel):
    task_id: str
    defensive_agent_id: str
    adversarial_agent_id: str
    steps_taken: int
    outcome: str  # e.g., "DEFENDER_WIN", "ADVERSARY_WIN", "TIMEOUT"
    metrics: Dict[str, float] = Field(default_factory=dict)

# --- Core Simulation Components ---

@dataclass
class Action:
    name: str
    params: Dict[str, Any]

@dataclass
class Observation:
    state: Dict[str, Any]
    available_actions: List[str]

class Agent(ABC):
    """Abstract Base Class for all agents."""
    def __init__(self, config: AgentConfig):
        self.config = config
        self.agent_id = config.agent_id
        logger.info(f"Initializing agent: {self.agent_id} from model: {self.config.model_path}")

    @abstractmethod
    def act(self, observation: Observation) -> Action:
        """Choose an action based on the current observation."""
        pass

class DefensiveAgent(Agent):
    """A defensive agent that tries to mitigate threats."""
    def act(self, observation: Observation) -> Action:
        # Sophisticated logic would go here (e.g., running an RL model)
        # For this example, we choose a random "defensive" action.
        if "ISOLATE" in observation.available_actions and random.random() > 0.5:
            return Action(name="ISOLATE", params={"target": "compromised_node_1"})
        return Action(name="SCAN", params={"target": "network_segment_A"})

class AdversarialAgent(Agent):
    """An adversarial agent that tries to achieve a goal."""
    def act(self, observation: Observation) -> Action:
        # Sophisticated logic for an adversary (e.g., attack tree traversal)
        # For this example, we choose a random "offensive" action.
        if "EXFILTRATE" in observation.available_actions:
            return Action(name="EXFILTRATE", params={"target": "financial_db"})
        return Action(name="LATERAL_MOVE", params={"target": "server_b"})

class Session:
    """Represents a single evaluation environment/session."""
    def __init__(self, scenario: ScenarioConfig):
        self.scenario = scenario
        self.state = {
            "step": 0,
            "threat_level": 0.1,
            "compromised_nodes": set(),
            "goal_achieved": False,
            "defenses_active": set(),
        }
        logger.info(f"Session created for scenario: {self.scenario.scenario_id}")

    def update(self, defensive_action: Action, adversarial_action: Action) -> Tuple[bool, str]:
        """Update the session state based on agent actions."""
        self.state["step"] += 1
        
        # Simplified simulation logic
        if adversarial_action.name == "LATERAL_MOVE":
            self.state["threat_level"] += 0.1
            self.state["compromised_nodes"].add(adversarial_action.params["target"])
        
        if defensive_action.name == "ISOLATE":
            self.state["threat_level"] -= 0.2
            if adversarial_action.params.get("target") in self.state["defenses_active"]:
                self.state["compromised_nodes"].discard(adversarial_action.params["target"])

        if self.state["threat_level"] > 1.0:
            self.state["goal_achieved"] = True
            return True, "ADVERSARY_WIN" # Adversary wins

        if self.state["step"] >= self.scenario.max_steps:
            return True, "TIMEOUT"

        return False, "IN_PROGRESS"

    def get_observation_for_agent(self, agent_type: str) -> Observation:
        """Generate an observation for a given agent type."""
        # This would be a complex function in a real system
        if agent_type == "defensive":
            return Observation(state=self.state, available_actions=["SCAN", "ISOLATE", "PATCH"])
        else:
            return Observation(state=self.state, available_actions=["LATERAL_MOVE", "EXFILTRATE", "PERSIST"])

class Runner:
    """Manages the turn-by-turn interaction between agents in a session."""
    def __init__(self, session: Session, defensive_agent: Agent, adversarial_agent: Agent):
        self.session = session
        self.defensive_agent = defensive_agent
        self.adversarial_agent = adversarial_agent

    def run_evaluation(self) -> EvaluationResult:
        """Execute the evaluation loop."""
        outcome = "IN_PROGRESS"
        is_done = False

        while not is_done:
            # 1. Get observations for both agents
            def_obs = self.session.get_observation_for_agent("defensive")
            adv_obs = self.session.get_observation_for_agent("adversarial")

            # 2. Get actions from both agents
            def_action = self.defensive_agent.act(def_obs)
            adv_action = self.adversarial_agent.act(adv_obs)

            # 3. Update the session state
            is_done, outcome = self.session.update(def_action, adv_action)
        
        # 4. Finalize and return results
        metrics = {"final_threat_level": self.session.state["threat_level"]}
        return EvaluationResult(
            task_id=self.session.scenario.scenario_id,
            defensive_agent_id=self.defensive_agent.agent_id,
            adversarial_agent_id=self.adversarial_agent.agent_id,
            steps_taken=self.session.state["step"],
            outcome=outcome,
            metrics=metrics,
        )


# --- Main Orchestrator Class ---

class EvaluationGenerator:
    """Orchestrates the generation and execution of AI agent evaluations."""
    def __init__(
        self,
        scenarios: List[Dict],
        defensive_agents: List[Dict],
        adversarial_agents: List[Dict],
        num_runs_per_task: int = 3,
        max_parallel_workers: int = 4
    ):
        self.scenarios = [ScenarioConfig(**s) for s in scenarios]
        self.defensive_agents = [AgentConfig(**a) for a in defensive_agents]
        self.adversarial_agents = [AgentConfig(**a) for a in adversarial_agents]
        self.num_runs_per_task = num_runs_per_task
        self.max_parallel_workers = max_parallel_workers
        self.evaluation_tasks: List[EvaluationTask] = []
        logger.info(f"EvaluationGenerator initialized with {len(self.scenarios)} scenarios, "
                    f"{len(self.defensive_agents)} defensive agents, "
                    f"{len(self.adversarial_agents)} adversarial agents.")

    def generate_evaluation_tasks(self) -> Generator[EvaluationTask, None, None]:
        """Generate all possible evaluation tasks."""
        task_counter = 0
        for scenario in self.scenarios:
            for def_agent_config in self.defensive_agents:
                for adv_agent_config in self.adversarial_agents:
                    for run_num in range(self.num_runs_per_task):
                        task_id = f"eval-{task_counter:04d}-run-{run_num + 1}"
                        task = EvaluationTask(
                            task_id=task_id,
                            scenario=scenario,
                            defensive_agent=def_agent_config,
                            adversarial_agent=adv_agent_config,
                        )
                        self.evaluation_tasks.append(task)
                        yield task
                        task_counter += 1

    def _run_single_evaluation(self, task: EvaluationTask) -> EvaluationResult:
        """Executes a single evaluation task."""
        logger.info(f"Running evaluation for task: {task.task_id}")
        session = Session(task.scenario)
        defensive_agent = DefensiveAgent(task.defensive_agent)
        adversarial_agent = AdversarialAgent(task.adversarial_agent)
        runner = Runner(session, defensive_agent, adversarial_agent)
        
        try:
            return runner.run_evaluation()
        except Exception as e:
            logger.error(f"Evaluation for task {task.task_id} failed: {e}", exc_info=True)
            return EvaluationResult(
                task_id=task.task_id,
                defensive_agent_id=task.defensive_agent.agent_id,
                adversarial_agent_id=task.adversarial_agent.agent_id,
                steps_taken=0,
                outcome="ERROR",
                metrics={"error": str(e)}
            )

    def run(self) -> List[EvaluationResult]:
        """Runs all generated evaluation tasks in parallel."""
        all_results: List[EvaluationResult] = []
        tasks_to_run = list(self.generate_evaluation_tasks())
        
        with ThreadPoolExecutor(max_workers=self.max_parallel_workers) as executor:
            future_to_task = {executor.submit(self._run_single_evaluation, task): task for task in tasks_to_run}
            
            with tqdm(total=len(tasks_to_run), desc="Running Evaluations") as pbar:
                for future in as_completed(future_to_task):
                    result = future.result()
                    all_results.append(result)
                    pbar.update(1)
        
        logger.info(f"Completed {len(all_results)} evaluation runs.")
        return all_results

    @staticmethod
    def aggregate_results(results: List[EvaluationResult]) -> Dict[str, Any]:
        """Aggregates results and computes summary statistics."""
        summary = {}
        for result in results:
            key = f"{result.defensive_agent_id}_vs_{result.adversarial_agent_id}"
            if key not in summary:
                summary[key] = {"wins": 0, "losses": 0, "timeouts": 0, "errors": 0, "total_runs": 0}
            
            summary[key]["total_runs"] += 1
            if result.outcome == "DEFENDER_WIN":
                summary[key]["wins"] += 1
            elif result.outcome == "ADVERSARY_WIN":
                summary[key]["losses"] += 1
            elif result.outcome == "TIMEOUT":
                summary[key]["timeouts"] += 1
            else:
                summary[key]["errors"] += 1
        
        for key, data in summary.items():
            summary[key]["win_rate"] = data["wins"] / data["total_runs"] if data["total_runs"] > 0 else 0

        return summary


# --- Example Usage ---
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Omega AI Agent Evaluation Framework")
    parser.add_argument("--config", type=str, default="evaluation_config.json", help="Path to evaluation config file")
    parser.add_argument("--output", type=str, default="evaluation_report.json", help="Path to output report file")
    args = parser.parse_args()

    # Define a mock configuration
    mock_config = {
        "scenarios": [
            {"scenario_id": "scenario_1", "description": "Standard Infiltration", "max_steps": 100, "environment_params": {}},
        ],
        "defensive_agents": [
            {"agent_id": "defender_v1.2", "model_path": "/models/defender_v1.2.onnx", "params": {"strategy": "cautious"}},
            {"agent_id": "defender_v1.3", "model_path": "/models/defender_v1.3.onnx", "params": {"strategy": "aggressive"}},
        ],
        "adversarial_agents": [
            {"agent_id": "adversary_A", "model_path": "/models/adversary_A.onnx", "params": {"goal": "data_exfil"}},
        ],
        "settings": {
            "num_runs_per_task": 5,
            "max_parallel_workers": 8
        }
    }
    
    # Normally, you would load this from a file:
    # with open(args.config, 'r') as f:
    #     config = json.load(f)
    config = mock_config

    # Initialize and run the evaluation generator
    eval_gen = EvaluationGenerator(
        scenarios=config["scenarios"],
        defensive_agents=config["defensive_agents"],
        adversarial_agents=config["adversarial_agents"],
        num_runs_per_task=config["settings"]["num_runs_per_task"],
        max_parallel_workers=config["settings"]["max_parallel_workers"]
    )

    results = eval_gen.run()
    summary_report = eval_gen.aggregate_results(results)

    logger.info("\n--- Evaluation Summary Report ---")
    logger.info(json.dumps(summary_report, indent=2))

    # Save detailed results
    with open(args.output, 'w') as f:
        # Pydantic models need to be converted to dicts for json.dump
        serializable_results = [r.model_dump() for r in results]
        json.dump(serializable_results, f, indent=2)

    logger.info(f"\nDetailed results saved to {args.output}")
