-- Lua test script for agent mutation logic

-- Load the main script
dofile("script.lua")

-- Test case 1: Initial state
local initial_state = get_initial_agent_state()
assert(initial_state.health == 100, "Test 1 Failed: Initial health incorrect")
assert(initial_state.attack == 10, "Test 1 Failed: Initial attack incorrect")
assert(initial_state.defense == 5, "Test 1 Failed: Initial defense incorrect")
assert(initial_state.mutations_applied == 0, "Test 1 Failed: Initial mutations applied incorrect")
print("Test 1 Passed: Initial state is correct.")

-- Test case 2: Aggressive mutation
local state_after_aggressive = apply_mutation(table.copy(initial_state), "aggressive")
assert(state_after_aggressive.attack == 12, "Test 2 Failed: Aggressive attack incorrect")
assert(state_after_aggressive.defense == 4, "Test 2 Failed: Aggressive defense incorrect")
assert(state_after_aggressive.mutations_applied == 1, "Test 2 Failed: Aggressive mutations applied incorrect")
print("Test 2 Passed: Aggressive mutation applied correctly.")

-- Test case 3: Defensive mutation
local state_after_defensive = apply_mutation(table.copy(initial_state), "defensive")
assert(state_after_defensive.attack == 9, "Test 3 Failed: Defensive attack incorrect")
assert(state_after_defensive.defense == 7, "Test 3 Failed: Defensive defense incorrect")
assert(state_after_defensive.mutations_applied == 1, "Test 3 Failed: Defensive mutations applied incorrect")
print("Test 3 Passed: Defensive mutation applied correctly.")

-- Test case 4: Unknown mutation (should not change state, but increment mutations_applied)
local state_after_unknown = apply_mutation(table.copy(initial_state), "unknown")
assert(state_after_unknown.attack == 10, "Test 4 Failed: Unknown mutation attack incorrect")
assert(state_after_unknown.defense == 5, "Test 4 Failed: Unknown mutation defense incorrect")
assert(state_after_unknown.mutations_applied == 1, "Test 4 Failed: Unknown mutations applied incorrect")
print("Test 4 Passed: Unknown mutation handled correctly.")


print("All Lua tests passed!")

-- Helper function for table copying (Lua does not have a built-in one)
function table.copy(t)
    local t2 = {}
    for k, v in pairs(t) do
        t2[k] = v
    end
    return t2
end