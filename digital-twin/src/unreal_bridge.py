# digital-twin/src/unreal_bridge.py
import json
import socket
import struct
import time
import logging
from typing import Dict, Any, Optional, Callable
from pydantic import BaseModel, ValidationError, Field

# --- Configuration ---
UNREAL_ENGINE_HOST = "127.0.0.1"  # Or the IP of the machine running Unreal
UNREAL_ENGINE_PORT = 50051       # Port for the Python socket server in Unreal
RECONNECT_INTERVAL_SEC = 5
MESSAGE_MAX_LENGTH = 1024 * 1024 # 1MB max message size

# --- Logging ---
logging.basicConfig(level=logging.INFO, format='[UnrealBridge:%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

# --- Custom Exceptions ---
class ConnectionError(Exception):
    """Raised when there's an issue with the socket connection to Unreal."""
    pass

class DataTranslationError(Exception):
    """Raised when data translation/validation fails."""
    pass

# --- Pydantic Data Models for Strict Type-Checking and Validation ---
class DigitalTwinState(BaseModel):
    """Represents the state of an entity in the Digital Twin."""
    entity_id: str
    entity_type: str # e.g., 'NetworkNode', 'SentinelAgent', 'ThreatActor'
    position: Dict[str, float] = Field(default_factory=lambda: {"x": 0.0, "y": 0.0, "z": 0.0})
    rotation: Dict[str, float] = Field(default_factory=lambda: {"pitch": 0.0, "yaw": 0.0, "roll": 0.0})
    scale: Dict[str, float] = Field(default_factory=lambda: {"x": 1.0, "y": 1.0, "z": 1.0})
    properties: Dict[str, Any] = Field(default_factory=dict) # e.g., status, health, threat_level, color, associated_mesh

class UnrealCommand(BaseModel):
    """Represents a command to be sent to Unreal Engine."""
    command_type: str # e.g., 'SPAWN_ACTOR', 'UPDATE_ACTOR', 'DESTROY_ACTOR', 'TRIGGER_EFFECT'
    actor_id: str
    payload: Dict[str, Any] = Field(default_factory=dict)

class DigitalTwinEvent(BaseModel):
    """Represents feedback/events received from Unreal Engine."""
    event_type: str # e.g., 'USER_INTERACTION', 'SENSOR_READING', 'SIMULATION_EVENT'
    entity_id: Optional[str] = None
    timestamp: float = Field(default_factory=time.time)
    payload: Dict[str, Any] = Field(default_factory=dict)

# --- Main Bridge Class ---
class UnrealBridge:
    def __init__(self, host: str = UNREAL_ENGINE_HOST, port: int = UNREAL_ENGINE_PORT):
        self.host = host
        self.port = port
        self.socket: Optional[socket.socket] = None
        self._is_connected = False
        logger.info(f"UnrealBridge initialized for {host}:{port}")

    @property
    def is_connected(self) -> bool:
        return self._is_connected

    def connect(self, max_retries: int = 5) -> None:
        """Establishes a connection to the Unreal Engine Python socket server."""
        retries = 0
        while retries < max_retries:
            try:
                self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                self.socket.settimeout(5) # 5 second timeout for connection and send/receive
                self.socket.connect((self.host, self.port))
                self.socket.settimeout(None) # Set back to blocking for reliable receive
                self._is_connected = True
                logger.info("Successfully connected to Unreal Engine.")
                return
            except (socket.error, ConnectionRefusedError) as e:
                logger.warning(f"Connection attempt failed: {e}. Retrying in {RECONNECT_INTERVAL_SEC}s ({retries+1}/{max_retries}).")
                self.disconnect() # Clean up any partial connection
                retries += 1
                time.sleep(RECONNECT_INTERVAL_SEC)
        
        self._is_connected = False
        raise ConnectionError(f"Failed to connect to Unreal Engine Python API after {max_retries} attempts.")

    def disconnect(self) -> None:
        """Closes the connection to the Unreal Engine."""
        if self.socket:
            self.socket.close()
            self.socket = None
        self._is_connected = False
        logger.info("Disconnected from Unreal Engine.")

    def _send_message(self, message: Dict[str, Any]) -> None:
        """Sends a JSON-serialized message over the socket with length prefix."""
        if not self.is_connected or not self.socket:
            raise ConnectionError("Not connected to Unreal Engine.")

        try:
            json_message = json.dumps(message)
            encoded_message = json_message.encode('utf-8')
            
            if len(encoded_message) > MESSAGE_MAX_LENGTH:
                raise ValueError(f"Message exceeds maximum length of {MESSAGE_MAX_LENGTH} bytes.")

            # Prefix message with its length (4-byte unsigned integer)
            length_prefix = struct.pack("!I", len(encoded_message))
            self.socket.sendall(length_prefix + encoded_message)
            logger.debug(f"Sent command: {message.get('command_type', 'UNKNOWN')}")
        except (socket.error, TypeError, ValueError) as e:
            logger.error(f"Failed to send command to Unreal Engine: {e}")
            self.disconnect() # Assume connection is broken
            raise ConnectionError(f"Failed to send command to Unreal Engine: {e}")

    def _receive_message(self) -> Optional[Dict[str, Any]]:
        """Receives a length-prefixed JSON message from the Unreal Engine."""
        if not self.is_connected or not self.socket:
            raise ConnectionError("Not connected to Unreal Engine.")
        
        try:
            # Receive 4-byte length prefix
            length_bytes = self.socket.recv(4)
            if not length_bytes:
                logger.warning("Connection closed by Unreal Engine (empty length prefix).")
                self.disconnect()
                return None
            if len(length_bytes) < 4:
                raise ConnectionError("Incomplete message length prefix received.")
            
            message_length = struct.unpack("!I", length_bytes)[0]
            if message_length > MESSAGE_MAX_LENGTH:
                raise ValueError(f"Received message length ({message_length}) exceeds max ({MESSAGE_MAX_LENGTH}).")

            # Receive the actual message
            chunks = []
            bytes_received = 0
            while bytes_received < message_length:
                chunk = self.socket.recv(min(message_length - bytes_received, 4096))
                if not chunk:
                    raise ConnectionError("Socket connection broken while receiving message.")
                chunks.append(chunk)
                bytes_received += len(chunk)
            
            full_message = b"".join(chunks).decode('utf-8')
            return json.loads(full_message)

        except (socket.error, json.JSONDecodeError, struct.error, ValueError) as e:
            logger.error(f"Error receiving message from Unreal Engine: {e}")
            self.disconnect()
            raise ConnectionError(f"Error receiving message from Unreal Engine: {e}")
        except Exception as e:
            logger.error(f"Unexpected error in _receive_message: {e}")
            self.disconnect()
            raise

    def _dt_state_to_unreal_properties(self, dt_state: DigitalTwinState) -> UnrealActorProperties:
        """Translates DigitalTwinState into UnrealActorProperties."""
        try:
            # Example translation logic:
            # Map Digital Twin properties to Unreal-specific visual/behavioral properties.
            unreal_props = dt_state.properties.copy()
            if dt_state.entity_type == 'NetworkNode':
                if dt_state.properties.get('status') == 'Online':
                    unreal_props['material_color'] = 'Green'
                    unreal_props['emission_intensity'] = 1.0
                elif dt_state.properties.get('status') == 'Degraded':
                    unreal_props['material_color'] = 'Yellow'
                    unreal_props['emission_intensity'] = 2.0
                elif dt_state.properties.get('status') == 'Under Attack':
                    unreal_props['material_color'] = 'Red'
                    unreal_props['emission_intensity'] = 5.0
                    unreal_props['particle_effect'] = 'CriticalAlert'
                else: # Offline
                    unreal_props['material_color'] = 'DarkGray'
                    unreal_props['emission_intensity'] = 0.0
            
            # Use UnrealCommand to wrap this for sending
            return UnrealActorProperties(
                entity_id=dt_state.entity_id,
                entity_type=dt_state.entity_type,
                position=dt_state.position,
                rotation=dt_state.rotation,
                scale=dt_state.scale,
                properties=unreal_props
            )
        except ValidationError as e:
            raise DataTranslationError(f"Failed to validate DigitalTwinState for Unreal: {e}")
        except Exception as e:
            raise DataTranslationError(f"Error translating DigitalTwinState to Unreal properties: {e}")

    def _unreal_event_to_dt_feedback(self, unreal_event: Dict[str, Any]) -> DigitalTwinEvent:
        """Translates raw Unreal Engine events into structured DigitalTwinEvent feedback."""
        try:
            return DigitalTwinEvent(**unreal_event)
        except ValidationError as e:
            raise DataTranslationError(f"Failed to validate Unreal event for Digital Twin feedback: {e}")
        except Exception as e:
            raise DataTranslationError(f"Error translating Unreal event to Digital Twin feedback: {e}")

    def spawn_dt_entity(self, dt_state: DigitalTwinState) -> None:
        """Spawns a new actor in Unreal representing a Digital Twin entity."""
        unreal_actor_props = self._dt_state_to_unreal_properties(dt_state)
        command = UnrealCommand(
            command_type='SPAWN_ACTOR',
            actor_id=dt_state.entity_id,
            payload={
                "actor_type": dt_state.entity_type,
                "transform": {
                    "location": unreal_actor_props.position,
                    "rotation": unreal_actor_props.rotation,
                    "scale": unreal_actor_props.scale
                },
                "properties": unreal_actor_props.properties
            }
        )
        self._send_message(command.model_dump()) # Use model_dump for Pydantic v2

    def update_dt_entity(self, dt_state: DigitalTwinState) -> None:
        """Updates an existing actor's properties in Unreal."""
        unreal_actor_props = self._dt_state_to_unreal_properties(dt_state)
        command = UnrealCommand(
            command_type='UPDATE_ACTOR',
            actor_id=dt_state.entity_id,
            payload={
                "transform": {
                    "location": unreal_actor_props.position,
                    "rotation": unreal_actor_props.rotation,
                    "scale": unreal_actor_props.scale
                },
                "properties": unreal_actor_props.properties
            }
        )
        self._send_message(command.model_dump())

    def remove_dt_entity(self, entity_id: str) -> None:
        """Removes an actor from Unreal."""
        command = UnrealCommand(command_type='DESTROY_ACTOR', actor_id=entity_id)
        self._send_message(command.model_dump())

    def trigger_unreal_event(self, event_type: str, actor_id: str, payload: Dict[str, Any] = {}) -> None:
        """Sends a generic event/effect trigger to Unreal."""
        command = UnrealCommand(
            command_type='TRIGGER_EVENT',
            actor_id=actor_id,
            payload={"event_type": event_type, **payload}
        )
        self._send_message(command.model_dump())

    def receive_unreal_event(self) -> Optional[DigitalTwinEvent]:
        """Attempts to receive and translate an event from Unreal. Non-blocking if socket is set to non-blocking."""
        try:
            raw_event = self._receive_message()
            if raw_event:
                dt_event = self._unreal_event_to_dt_feedback(raw_event)
                logger.info(f"Received event from Unreal: {dt_event.event_type} for {dt_event.entity_id}")
                self.on_event_received(dt_event) # Call callback if registered
                return dt_event
            return None
        except (socket.timeout, BlockingIOError):
            return None # No message available, not an error
        except (ConnectionError, DataTranslationError) as e:
            logger.error(f"Error processing received Unreal event: {e}")
            return None
    
    def on_event_received(self, event: DigitalTwinEvent) -> None:
        """
        Placeholder callback for handling incoming Digital Twin events from Unreal.
        This should be overridden or hooked into by the consuming Digital Twin logic.
        """
        logger.debug(f"Default event handler received: {event.event_type} for {event.entity_id}")


# Example usage (for testing or standalone execution)
if __name__ == "__main__":
    bridge = UnrealBridge()
    try:
        bridge.connect()
        
        # Example: Spawn a new network node
        new_node_state = DigitalTwinState(
            entity_id="new_node_789",
            entity_type="NetworkNode",
            position={"x": 500.0, "y": 200.0, "z": 50.0},
            properties={"status": "Online", "cpu_usage": 35.0, "mesh_id": "global_mesh_01"}
        )
        bridge.spawn_dt_entity(new_node_state)
        time.sleep(1)

        # Example: Update the status of an existing node
        updated_node_state = DigitalTwinState(
            entity_id="new_node_789",
            entity_type="NetworkNode",
            position={"x": 500.0, "y": 200.0, "z": 50.0}, # Position unchanged
            properties={"status": "Under Attack", "cpu_usage": 95.0, "threat_level": 0.9}
        )
        bridge.update_dt_entity(updated_node_state)
        time.sleep(1)

        # Example: Trigger a visual effect
        bridge.trigger_unreal_event("ALERT_VISUAL", "new_node_789", {"intensity": 0.8})
        time.sleep(1)

        # Example: Receive an event (simulated)
        # In a real scenario, this would be on a separate thread or non-blocking loop
        # For demonstration, simulate an incoming message
        logger.info("Simulating incoming Unreal event...")
        mock_event_from_unreal = json.dumps({
            "event_type": "USER_INTERACTION",
            "entity_id": "user_avatar_1",
            "payload": {"action": "NODE_SELECT", "selected_actor_id": "new_node_789"}
        }).encode('utf-8')
        # Temporarily mock socket to inject message
        original_recv = bridge.socket.recv
        bridge.socket.recv = lambda count: mock_event_from_unreal[:count]
        
        received_dt_event = bridge.receive_unreal_event()
        if received_dt_event:
            logger.info(f"Digital Twin processed event: {received_dt_event}")
        
        bridge.socket.recv = original_recv # Restore original recv

        time.sleep(1)
        bridge.remove_dt_entity("new_node_789")

    except ConnectionError as e:
        logger.error(f"Bridge operation failed: {e}")
    finally:
        bridge.disconnect()
