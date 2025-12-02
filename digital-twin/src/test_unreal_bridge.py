# digital-twin/src/test_unreal_bridge.py
import pytest
from unittest.mock import MagicMock, patch
import json

from unreal_bridge import UnrealBridge, DigitalTwinState, UnrealActorProperties, DigitalTwinEvent, ConnectionError, DataTranslationError

# --- Fixtures for Mocking Unreal Engine and Bridge Instance ---

@pytest.fixture
def mock_unreal_engine():
    """Mocks the Unreal Engine Python API."""
    mock_ue = MagicMock()
    
    # Mock commonly used functions for spawning/managing actors
    mock_ue.get_actor_subsystem.return_value = MagicMock()
    mock_ue.get_editor_subsystem.return_value = MagicMock()
    
    # Mock actor creation/destruction
    mock_ue.get_actor_subsystem.return_value.spawn_actor.return_value = MagicMock(
        get_name=lambda: "MockActor_1",
        get_world=lambda: MagicMock(),
        get_actor_location=lambda: MagicMock(x=0, y=0, z=0),
        set_actor_location=MagicMock(),
        set_editor_property=MagicMock(),
        destroy_actor=MagicMock(),
    )
    mock_ue.get_actor_subsystem.return_value.get_all_actors_of_class.return_value = []

    # Mock editor property access
    mock_ue.get_editor_subsystem.return_value.set_editor_property = MagicMock()
    
    # Mock communication (e.g., sockets if used for real-time updates)
    mock_ue.socket_client = MagicMock()
    mock_ue.socket_client.send_message = MagicMock()
    mock_ue.socket_client.receive_message = MagicMock()
    mock_ue.socket_client.connect = MagicMock()
    mock_ue.socket_client.disconnect = MagicMock()

    # Mock engine version if needed
    mock_ue.get_engine_version.return_value = "5.3.0"

    return mock_ue

@pytest.fixture
def unreal_bridge_instance(mock_unreal_engine):
    """Provides an UnrealBridge instance with a mocked Unreal Engine."""
    with patch('unreal_bridge.ue', new=mock_unreal_engine):
        bridge = UnrealBridge(unreal_engine_port=50051) # Example port
        yield bridge
        bridge.disconnect() # Ensure cleanup after test

# --- Mock Digital Twin State Data ---

@pytest.fixture
def mock_dt_state():
    """Mock Digital Twin state representing a network node."""
    return DigitalTwinState(
        entity_id="dt_node_123",
        entity_type="NetworkNode",
        position={"x": 100, "y": 50, "z": 10},
        rotation={"x": 0, "y": 0, "z": 0},
        scale={"x": 1, "y": 1, "z": 1},
        properties={
            "status": "online",
            "threat_level": 0.2,
            "cpu_usage": 75.5,
            "connected_peers": ["dt_node_456", "dt_node_789"]
        }
    )

@pytest.fixture
def mock_dt_state_updated():
    """Mock Digital Twin state representing an updated network node."""
    return DigitalTwinState(
        entity_id="dt_node_123",
        entity_type="NetworkNode",
        position={"x": 110, "y": 60, "z": 10},
        rotation={"x": 0, "y": 0, "z": 0},
        scale={"x": 1.2, "y": 1.2, "z": 1.2},
        properties={
            "status": "critical",
            "threat_level": 0.8,
            "cpu_usage": 99.1,
            "connected_peers": ["dt_node_456"]
        }
    )

@pytest.fixture
def mock_unreal_event():
    """Mock Unreal Engine event feedback."""
    return {
        "event_type": "USER_INTERACTION",
        "actor_id": "MockActor_1",
        "interaction_type": "CLICK",
        "timestamp": 1678886400
    }

# --- Tests for Connection and Basic Operations ---

def test_connect_and_disconnect(unreal_bridge_instance, mock_unreal_engine):
    assert unreal_bridge_instance.is_connected
    mock_unreal_engine.socket_client.connect.assert_called_once_with(unreal_bridge_instance.host, unreal_bridge_instance.port)
    
    unreal_bridge_instance.disconnect()
    assert not unreal_bridge_instance.is_connected
    mock_unreal_engine.socket_client.disconnect.assert_called_once()

def test_connection_failure_raises_error(mock_unreal_engine):
    mock_unreal_engine.socket_client.connect.side_effect = Exception("Mock connection failed")
    with patch('unreal_bridge.ue', new=mock_unreal_engine):
        with pytest.raises(ConnectionError, match="Failed to connect to Unreal Engine Python API"):
            UnrealBridge()

# --- Tests for Data Translation ---

def test_dt_state_to_unreal_properties_translation(unreal_bridge_instance, mock_dt_state):
    unreal_props = unreal_bridge_instance._dt_state_to_unreal_properties(mock_dt_state)
    assert isinstance(unreal_props, UnrealActorProperties)
    assert unreal_props.entity_id == "dt_node_123"
    assert unreal_props.position == {"x": 100, "y": 50, "z": 10}
    assert unreal_props.properties["status"] == "online"
    assert unreal_props.properties["threat_level"] == 0.2

def test_unreal_event_to_dt_feedback_translation(unreal_bridge_instance, mock_unreal_event):
    dt_feedback = unreal_bridge_instance._unreal_event_to_dt_feedback(mock_unreal_event)
    assert isinstance(dt_feedback, DigitalTwinEvent)
    assert dt_feedback.event_type == "USER_INTERACTION"
    assert dt_feedback.entity_id == "MockActor_1"

# --- Tests for Sending Commands to Unreal ---

def test_spawn_dt_entity_creates_actor(unreal_bridge_instance, mock_dt_state, mock_unreal_engine):
    unreal_bridge_instance.spawn_dt_entity(mock_dt_state)
    
    # Verify that ue.get_actor_subsystem().spawn_actor was called
    mock_unreal_engine.get_actor_subsystem.return_value.spawn_actor.assert_called_once()
    spawn_call_args, spawn_call_kwargs = mock_unreal_engine.get_actor_subsystem.return_value.spawn_actor.call_args
    assert "class" in spawn_call_kwargs
    assert spawn_call_kwargs["name"] == mock_dt_state.entity_id

    # Verify that properties were set (e.g., via socket for real-time update)
    mock_unreal_engine.socket_client.send_message.assert_called_with(
        json.dumps({
            "command": "CREATE_ACTOR",
            "actor_id": mock_dt_state.entity_id,
            "actor_type": mock_dt_state.entity_type,
            "properties": unreal_bridge_instance._dt_state_to_unreal_properties(mock_dt_state).properties,
            "transform": {
                "location": mock_dt_state.position,
                "rotation": mock_dt_state.rotation,
                "scale": mock_dt_state.scale
            }
        })
    )

def test_update_dt_entity_updates_actor(unreal_bridge_instance, mock_dt_state_updated, mock_unreal_engine):
    # First, simulate that the actor exists
    mock_actor = MagicMock(get_name=lambda: "dt_node_123")
    mock_unreal_engine.get_actor_subsystem.return_value.get_all_actors_of_class.return_value = [mock_actor]

    unreal_bridge_instance.update_dt_entity(mock_dt_state_updated)
    
    # Verify that the socket client sent an update message
    mock_unreal_engine.socket_client.send_message.assert_called_with(
        json.dumps({
            "command": "UPDATE_ACTOR",
            "actor_id": mock_dt_state_updated.entity_id,
            "properties": unreal_bridge_instance._dt_state_to_unreal_properties(mock_dt_state_updated).properties,
            "transform": {
                "location": mock_dt_state_updated.position,
                "rotation": mock_dt_state_updated.rotation,
                "scale": mock_dt_state_updated.scale
            }
        })
    )

def test_remove_dt_entity_destroys_actor(unreal_bridge_instance, mock_unreal_engine):
    actor_id_to_remove = "dt_node_123"
    unreal_bridge_instance.remove_dt_entity(actor_id_to_remove)
    
    mock_unreal_engine.socket_client.send_message.assert_called_with(
        json.dumps({
            "command": "DESTROY_ACTOR",
            "actor_id": actor_id_to_remove
        })
    )

# --- Tests for Receiving Events from Unreal ---

def test_receive_unreal_event_processes_feedback(unreal_bridge_instance, mock_unreal_event):
    with patch.object(unreal_bridge_instance, 'on_event_received') as mock_on_event:
        unreal_bridge_instance.socket_client.receive_message.return_value = json.dumps(mock_unreal_event)
        
        # Simulate receiving an event
        feedback = unreal_bridge_instance.receive_unreal_event()
        
        assert feedback is not None
        assert feedback.event_type == "USER_INTERACTION"
        mock_on_event.assert_called_once_with(feedback) # Verify callback was invoked

def test_receive_unreal_event_handles_empty_message(unreal_bridge_instance):
    unreal_bridge_instance.socket_client.receive_message.return_value = None
    feedback = unreal_bridge_instance.receive_unreal_event()
    assert feedback is None

# --- Tests for Error Handling ---

def test_invalid_data_translation_raises_error(unreal_bridge_instance):
    invalid_state = DigitalTwinState(
        entity_id="invalid",
        entity_type="Unknown",
        position={"x": "not_a_number", "y": 0, "z": 0}, # Invalid type
        properties={}
    )
    with pytest.raises(DataTranslationError, match="Failed to validate DigitalTwinState"):
        unreal_bridge_instance._dt_state_to_unreal_properties(invalid_state)

def test_socket_send_failure_raises_error(unreal_bridge_instance, mock_dt_state, mock_unreal_engine):
    mock_unreal_engine.socket_client.send_message.side_effect = Exception("Socket send failed")
    with pytest.raises(ConnectionError, match="Failed to send command to Unreal Engine"):
        unreal_bridge_instance.spawn_dt_entity(mock_dt_state)