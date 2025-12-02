#include "AquaWarSDK.h"
#include <iostream>
#include <stdexcept>
#include <vector>

// Use nlohmann::json for convenience
using json = nlohmann::json;

// ==============================================================================
// Event Subclass Implementations
// ==============================================================================

class MoveEvent : public Event {
public:
    MoveEvent(int unitId, Position target) : unitId_(unitId), target_(target) {}
    std::string getType() const override { return "MOVE"; }
    json toJson() const override {
        return {{"type", getType()}, {"unit_id", unitId_}, {"target", target_}};
    }
    int getUnitId() const { return unitId_; }
    const Position& getTarget() const { return target_; }

private:
    int unitId_;
    Position target_;
};

class BuildEvent : public Event {
public:
    BuildEvent(int playerId, std::string unitType, Position position)
        : playerId_(playerId), unitType_(std::move(unitType)), position_(position) {}
    std::string getType() const override { return "BUILD"; }
    json toJson() const override {
        return {{"type", getType()}, {"player_id", playerId_}, {"unit_type", unitType_}, {"position", position_}};
    }
    int getPlayerId() const { return playerId_; }
    const std::string& getUnitType() const { return unitType_; }
    const Position& getPosition() const { return position_; }

private:
    int playerId_;
    std::string unitType_;
    Position position_;
};


// ==============================================================================
// Game Class Implementation
// ==============================================================================

Game::Game(int gameId, int mapWidth, int mapHeight)
    : gameId_(gameId), tick_(0), mapWidth_(mapWidth), mapHeight_(mapHeight) {
    std::cout << "[Game] New game instance created with ID: " << gameId_ << std::endl;
}

void Game::update(const std::vector<std::unique_ptr<Event>>& events) {
    std::cout << "[Game] Updating tick " << tick_ << " with " << events.size() << " events." << std::endl;
    for (const auto& event : events) {
        processEvent(*event);
    }
    tick_++;
}

void Game::processEvent(const Event& event) {
    // Here we use dynamic_cast for safe downcasting, but a visitor pattern
    // could be more performant for a larger number of event types.
    if (const auto* moveEvent = dynamic_cast<const MoveEvent*>(&event)) {
        if (auto it = units_.find(moveEvent->getUnitId()); it != units_.end()) {
            // Simplified logic: just teleport the unit for this example
            it->second.pos = moveEvent->getTarget();
            std::cout << "[Game] Unit " << it->first << " moved to (" << it->second.pos.x << ", " << it->second.pos.y << ")." << std::endl;
        }
    } else if (const auto* buildEvent = dynamic_cast<const BuildEvent*>(&event)) {
        if (auto player_it = players_.find(buildEvent->getPlayerId()); player_it != players_.end()) {
            // Simplified logic: create a new unit
            Unit newUnit;
            newUnit.id = units_.size() + 100; // Simple ID generation
            newUnit.owner_player_id = buildEvent->getPlayerId();
            newUnit.type = buildEvent->getUnitType();
            newUnit.pos = buildEvent->getPosition();
            newUnit.hp = 100;
            newUnit.max_hp = 100;
            addUnit(newUnit);
        }
    }
}

int Game::getGameId() const {
    return gameId_;
}

int Game::getTick() const {
    return tick_;
}

json Game::getGameStateAsJson() const {
    return {
        {"game_id", gameId_},
        {"tick", tick_},
        {"map_dimensions", {{"width", mapWidth_}, {"height", mapHeight_}}},
        {"players", players_},
        {"units", units_}
    };
}

bool Game::addPlayer(const Player& player) {
    if (players_.count(player.id)) {
        return false; // Player already exists
    }
    players_[player.id] = player;
    std::cout << "[Game] Player " << player.id << " added." << std::endl;
    return true;
}

bool Game::addUnit(const Unit& unit) {
    if (units_.count(unit.id)) {
        return false; // Unit already exists
    }
    units_[unit.id] = unit;
    std::cout << "[Game] Unit " << unit.id << " (" << unit.type << ") added for player " << unit.owner_player_id << "." << std::endl;
    return true;
}

std::unique_ptr<Game> Game::loadGameStateFromJson(const json& gameState) {
    auto game = std::make_unique<Game>(
        gameState["game_id"],
        gameState["map_dimensions"]["width"],
        gameState["map_dimensions"]["height"]
    );
    game->tick_ = gameState["tick"];
    game->players_ = gameState["players"].get<std::map<int, Player>>();
    game->units_ = gameState["units"].get<std::map<int, Unit>>();
    return game;
}

// ==============================================================================
// AquaWarSDK Class Implementation
// ==============================================================================

AquaWarSDK::AquaWarSDK() : gameInstance_(nullptr) {}

bool AquaWarSDK::createGame(int gameId, int mapWidth, int mapHeight) {
    if (gameInstance_) {
        std::cerr << "[SDK] A game is already in progress." << std::endl;
        return false;
    }
    gameInstance_ = std::make_unique<Game>(gameId, mapWidth, mapHeight);
    
    // Add some default players for the simulation
    gameInstance_->addPlayer({1, 1, 1000});
    gameInstance_->addPlayer({2, 2, 1000});

    return true;
}

json AquaWarSDK::processTurn(const json& turnData) {
    if (!gameInstance_) {
        throw std::runtime_error("No game instance available. Call createGame() first.");
    }
    
    auto events = parseEvents(turnData);
    gameInstance_->update(events);
    
    return getGameState();
}

json AquaWarSDK::getGameState() const {
    if (!gameInstance_) {
        return {{"error", "No game instance available."}};
    }
    return gameInstance_->getGameStateAsJson();
}

bool AquaWarSDK::isGameOver() const {
    if (!gameInstance_) {
        return true;
    }
    // Simplified game over condition: one player has no units left
    std::map<int, int> playerUnitCounts;
    const auto& state = gameInstance_->getGameStateAsJson();
    for (const auto& unit_it : state["units"].items()) {
        playerUnitCounts[unit_it.value()["owner_player_id"]]++;
    }
    
    return playerUnitCounts.size() <= 1;
}

std::vector<std::unique_ptr<Event>> AquaWarSDK::parseEvents(const json& turnData) const {
    std::vector<std::unique_ptr<Event>> events;
    if (!turnData.contains("actions") || !turnData["actions"].is_array()) {
        return events;
    }

    for (const auto& action : turnData["actions"]) {
        std::string type = action.value("type", "");
        if (type == "MOVE") {
            events.push_back(std::make_unique<MoveEvent>(
                action["unit_id"],
                action["target"]
            ));
        } else if (type == "BUILD") {
            events.push_back(std::make_unique<BuildEvent>(
                action["player_id"],
                action["unit_type"],
                action["position"]
            ));
        } else {
            std::cerr << "[SDK] Unknown action type: " << type << std::endl;
        }
    }
    return events;
}
