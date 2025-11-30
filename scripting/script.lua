-- Lua scripting for agent runtime self-mutation scripts

-- Represents a simplified agent state
local agent_state = {
    health = 100,
    attack = 10,
    defense = 5,
    mutations_applied = 0
}

-- Function to apply a mutation to the agent state
function apply_mutation(state_table, mutation_type)
    if mutation_type == "aggressive" then
        state_table.attack = state_table.attack + 2
        state_table.defense = state_table.defense - 1
        print("Applied aggressive mutation.")
    elseif mutation_type == "defensive" then
        state_table.defense = state_table.defense + 2
        state_table.attack = state_table.attack - 1
        print("Applied defensive mutation.")
    else
        print("Unknown mutation type: " .. mutation_type)
    end
    state_table.mutations_applied = state_table.mutations_applied + 1
    return state_table
end

-- Example of a self-evolution function that applies a random mutation
function self_evolve(current_state)
    local mutation_types = {"aggressive", "defensive"}
    local random_index = math.random(1, #mutation_types)
    local chosen_mutation = mutation_types[random_index]
    print("Agent is self-evolving...")
    return apply_mutation(current_state, chosen_mutation)
end

-- Exported function to get initial agent state
function get_initial_agent_state()
    return agent_state
end

-- Example usage (for direct execution in Lua)
-- local current_agent_state = get_initial_agent_state()
-- print("Initial State: " .. tostring(current_agent_state.health) .. ", " .. tostring(current_agent_state.attack) .. ", " .. tostring(current_agent_state.defense))
--
-- current_agent_state = self_evolve(current_agent_state)
-- print("Evolved State: " .. tostring(current_agent_state.health) .. ", " .. tostring(current_agent_state.attack) .. ", " .. tostring(current_agent_state.defense))