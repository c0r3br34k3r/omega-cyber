#include "AquaWarSDK.h"
#include <iostream>
#include <thread>
#include <chrono>

using json = nlohmann::json;

// Helper function to create a unique ID for units in this example
int nextUnitId = 1000;
int getNextUnitId() {
    return nextUnitId++;
}

int main() {
    std::cout << "--- AquaWarSDK Example Simulation ---" << std::endl;

    AquaWarSDK sdk;

    try {
        // 1. Create a new game instance
        if (!sdk.createGame(1, 50, 50)) {
            std::cerr << "Failed to create game. Exiting." << std::endl;
            return 1;
        }
        std::cout << "\nGame created with ID 1, map 50x50." << std::endl;

        // 2. Add initial units for players
        Unit player1_unit1 = {getNextUnitId(), 1, "Scout", {10, 10}, 100, 100};
        Unit player1_unit2 = {getNextUnitId(), 1, "Base", {5, 5}, 500, 500};
        Unit player2_unit1 = {getNextUnitId(), 2, "Destroyer", {40, 40}, 150, 150};

        json add_units_turn = {
            {"actions", {
                {{"type", "BUILD"}, {"player_id", 1}, {"unit_type", player1_unit1.type}, {"position", player1_unit1.pos}},
                {{"type", "BUILD"}, {"player_id", 1}, {"unit_type", player1_unit2.type}, {"position", player1_unit2.pos}},
                {{"type", "BUILD"}, {"player_id", 2}, {"unit_type", player2_unit1.type}, {"position", player2_unit1.pos}}
            }}
        };
        // Process a dummy turn to add units via "BUILD" events
        sdk.processTurn(add_units_turn);
        std::cout << "\nInitial units added to the game." << std::endl;
        std::cout << "Current Game State: " << sdk.getGameState().dump(2) << std::endl;

        // 3. Simulate several turns
        for (int turn = 0; turn < 5; ++turn) {
            std::cout << "\n--- Simulating Turn " << sdk.getGameState()["tick"] << " ---" << std::endl;

            json turnData = {{"actions", json::array()}};

            // Player 1: Move a scout
            if (turn == 1) { // Only on turn 1
                turnData["actions"].push_back({
                    {"type", "MOVE"},
                    {"unit_id", player1_unit1.id},
                    {"target", {{"x", 12}, {"y", 12}}}
                });
                std::cout << "Player 1 (Scout " << player1_unit1.id << ") moves to (12, 12)." << std::endl;
            }
            
            // Player 2: Try to build a new unit
            if (turn == 2) { // Only on turn 2
                 turnData["actions"].push_back({
                    {"type", "BUILD"},
                    {"player_id", 2},
                    {"unit_type", "Interceptor"},
                    {"position", {{"x", 38}, {"y", 38}}}
                });
                std::cout << "Player 2 builds an Interceptor at (38, 38)." << std::endl;
            }


            json newGameState = sdk.processTurn(turnData);
            std::cout << "Game State after turn " << newGameState["tick"] << ":" << std::endl;
            // std::cout << newGameState.dump(2) << std::endl; // Uncomment for full state

            // Check game over condition
            if (sdk.isGameOver()) {
                std::cout << "\nGame Over detected!" << std::endl;
                break;
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(500)); // Simulate time passing
        }
        
        std::cout << "\nFinal Game State: " << sdk.getGameState().dump(2) << std::endl;

    } catch (const std::exception& e) {
        std::cerr << "Simulation Error: " << e.what() << std::endl;
        return 1;
    }

    std::cout << "--- AquaWarSDK Example Simulation Finished ---" << std::endl;
    return 0;
}
