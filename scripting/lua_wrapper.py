# scripting/lua_wrapper.py
# Python wrapper to demonstrate calling Lua scripts

import subprocess
import json

def call_lua_function(lua_script_path, function_name, *args):
    """
    Simulates calling a Lua function from Python.
    In a real scenario, this would use a Lua-Python bridge like `lupa`.
    """
    print(f"Simulating call to Lua function '{function_name}' in '{lua_script_path}' with args: {args}")

    # In a real scenario, you'd execute Lua and capture its output
    # For now, we'll just return a mock response based on the function.
    if function_name == "apply_mutation":
        # Mocking the apply_mutation behavior
        agent_state_str = args[0]
        mutation_type = args[1]
        
        # Simple parsing for demonstration
        try:
            agent_state = json.loads(agent_state_str)
        except json.JSONDecodeError:
            print("Error: Could not parse agent state JSON from Lua simulation.")
            return json.dumps({"error": "Invalid agent state JSON"})

        if mutation_type == "aggressive":
            agent_state["attack"] += 2
            agent_state["defense"] -= 1
        elif mutation_type == "defensive":
            agent_state["attack"] -= 1
            agent_state["defense"] += 2
        agent_state["mutations_applied"] += 1
        return json.dumps(agent_state)
    elif function_name == "get_initial_agent_state":
        return json.dumps({
            "health": 100,
            "attack": 10,
            "defense": 5,
            "mutations_applied": 0
        })
    else:
        return json.dumps({"status": "function_called", "function": function_name, "args": args})

if __name__ == "__main__":
    lua_script_path = "scripting/script.lua"

    # Demonstrate getting initial state
    initial_state_json = call_lua_function(lua_script_path, "get_initial_agent_state")
    initial_state = json.loads(initial_state_json)
    print(f"Python received initial state: {initial_state}")

    # Demonstrate applying an aggressive mutation
    mutated_state_json = call_lua_function(lua_script_path, "apply_mutation", json.dumps(initial_state), "aggressive")
    mutated_state = json.loads(mutated_state_json)
    print(f"Python received mutated state: {mutated_state}")
