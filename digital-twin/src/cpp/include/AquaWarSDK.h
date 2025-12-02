#pragma once

#include <string>
#include <vector>
#include <map>
#include <memory>
#include <optional>

#include <nlohmann/json.hpp>

// Forward declaration for Game class
class Game;

// ==============================================================================
// Data Structures
// ==============================================================================

struct Position {
    int x;
    int y;
};

// Use nlohmann::json for easy serialization/deserialization
NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE(Position, x, y)

struct Player {
    int id;
    int team;
    int resources;
    // Add other player-specific data
};

NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE(Player, id, team, resources)

struct Unit {
    int id;
    int owner_player_id;
    std::string type; // e.g., "Scout", "Destroyer", "Base"
    Position pos;
    int hp;
    int max_hp;
    // Add other unit-specific data
};

NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE(Unit, id, owner_player_id, type, pos, hp, max_hp)

// Base class for game events using polymorphism
class Event {
public:
    virtual ~Event() = default;
    virtual std::string getType() const = 0;
    virtual nlohmann::json toJson() const = 0;
};


// ==============================================================================
// Game State Management
// ==============================================================================

class Game {
public:
    Game(int gameId, int mapWidth, int mapHeight);
    ~Game() = default;

    // Disallow copy and assignment
    Game(const Game&) = delete;
    Game& operator=(const Game&) = delete;

    // Allow move semantics
    Game(Game&&) = default;
    Game& operator=(Game&&) = default;

    // Core game loop function
    void update(const std::vector<std::unique_ptr<Event>>& events);

    // State accessors
    int getGameId() const;
    int getTick() const;
    nlohmann::json getGameStateAsJson() const;

    // State modifiers
    bool addPlayer(const Player& player);
    bool addUnit(const Unit& unit);

    // Static factory method for loading state
    static std::unique_ptr<Game> loadGameStateFromJson(const nlohmann::json& gameState);

private:
    void processEvent(const Event& event);
    // Add private methods for handling specific event types
    // void handleMoveEvent(const MoveEvent& event);
    // void handleAttackEvent(const AttackEvent& event);

    int gameId_;
    int tick_;
    int mapWidth_;
    int mapHeight_;
    std::map<int, Player> players_;
    std::map<int, Unit> units_;
};


// ==============================================================================
// Main SDK Class
// ==============================================================================

class AquaWarSDK {
public:
    AquaWarSDK();
    ~AquaWarSDK() = default;

    // Disallow copy and assignment
    AquaWarSDK(const AquaWarSDK&) = delete;
    AquaWarSDK& operator=(const AquaWarSDK&) = delete;

    /// @brief Creates a new game simulation instance.
    /// @param gameId A unique identifier for the game.
    /// @param mapWidth The width of the game map.
    /// @param mapHeight The height of the game map.
    /// @return True if the game was created successfully, false otherwise.
    bool createGame(int gameId, int mapWidth, int mapHeight);

    /// @brief Processes a full turn of player actions.
    /// @param turnData A JSON object containing a list of actions for the turn.
    ///                 Example: { "actions": [ { "type": "MOVE", "unit_id": 1, "target": { "x": 10, "y": 15 } } ] }
    /// @return A JSON object representing the state of the game after the turn.
    nlohmann::json processTurn(const nlohmann::json& turnData);

    /// @brief Retrieves the current state of the game.
    /// @return A JSON object representing the complete game state.
    nlohmann::json getGameState() const;
    
    /// @brief Checks if the game has reached an end condition.
    /// @return True if the game is over, false otherwise.
    bool isGameOver() const;

private:
    std::unique_ptr<Game> gameInstance_;

    // Helper to parse events from JSON
    std::vector<std::unique_ptr<Event>> parseEvents(const nlohmann::json& turnData) const;
};
