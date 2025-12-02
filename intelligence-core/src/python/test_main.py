# intelligence-core/src/python/test_main.py
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import MagicMock, patch
import json
import time
import os

# Import the main application and its components
from main import app, get_db, Base, AnomalyAlertDB, TelemetryData, AnomalyAlertResponse
from main import anomaly_detector, llm_analyzer, julia_client, telemetry_consumer # Global instances for patching
from main import IntelligenceCoreServicer # gRPC servicer

# --- Mocks for external dependencies ---

# 1. Database (in-memory SQLite for testing)
@pytest.fixture(scope="module")
def test_db_engine():
    return create_engine("sqlite:///:memory:")

@pytest.fixture(scope="module")
def test_db_tables(test_db_engine):
    Base.metadata.create_all(test_db_engine)
    yield
    Base.metadata.drop_all(test_db_engine)

@pytest.fixture
def db_session(test_db_engine, test_db_tables):
    connection = test_db_engine.connect()
    transaction = connection.begin()
    SessionTesting = sessionmaker(autocommit=False, autoflush=False, bind=connection)
    session = SessionTesting()
    yield session
    session.close()
    transaction.rollback()
    connection.close()

# 2. FastAPI Test Client
@pytest.fixture(scope="module")
def client(test_db_engine, test_db_tables):
    def override_get_db():
        connection = test_db_engine.connect()
        transaction = connection.begin()
        SessionTesting = sessionmaker(autocommit=False, autoflush=False, bind=connection)
        session = SessionTesting()
        yield session
        session.close()
        transaction.rollback()
        connection.close()
    
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides = {}

# 3. Anomaly Detection Service
@pytest.fixture(autouse=True)
def mock_anomaly_detector():
    with patch('main.AnomalyDetectionService', autospec=True) as MockDetector:
        instance = MockDetector.return_value
        instance.predict_anomaly_score.return_value = 85 # Simulate high anomaly
        with patch('main.anomaly_detector', new=instance):
            yield instance

# 4. LLM Service
@pytest.fixture(autouse=True)
def mock_llm_analyzer():
    with patch('main.LLMService', autospec=True) as MockLLM:
        instance = MockLLM.return_value
        instance.get_sentiment.return_value = "NEGATIVE"
        with patch('main.llm_analyzer', new=instance):
            yield instance

# 5. Julia Compute Client
@pytest.fixture(autouse=True)
def mock_julia_client():
    with patch('main.JuliaComputeClient', autospec=True) as MockJuliaClient:
        instance = MockJuliaClient.return_value
        instance.send_command.side_effect = [
            {"result": {"status": "OPTIMAL", "allocated_resources": {"res1": 1}, "total_cost": 100.0}}, # For optimize_defense_resources
            {"result": {"total_impact_score": 0.8, "time_to_compromise_seconds": 60.0}} # For analyze_attack_path_impact
        ]
        with patch('main.julia_client', new=instance):
            yield instance

# 6. Kafka Consumer
@pytest.fixture(autouse=True)
def mock_kafka_consumer():
    with patch('main.TelemetryConsumer', autospec=True) as MockKafkaConsumer:
        instance = MockKafkaConsumer.return_value
        # Simulate a single message, then None
        mock_msg_value = {
            "source_node_id": "kafka-node-1",
            "metric_name": "cpu_utilization",
            "value": {"cpu_percent": 95.0},
            "timestamp": time.time()
        }
        mock_msg = MagicMock()
        mock_msg.error.return_value = None
        mock_msg.value.return_value = json.dumps(mock_msg_value).encode('utf-8')
        
        instance.poll_messages.side_effect = [mock_msg, None] # First call returns msg, subsequent return None
        with patch('main.telemetry_consumer', new=instance):
            yield instance

# 7. gRPC Server (patch the servicer directly for unit tests)
@pytest.fixture
def grpc_test_servicer():
    return IntelligenceCoreServicer()

# --- Test Cases ---

def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.text == "Intelligence Core is healthy."

def test_analyze_telemetry_data(client, db_session, mock_anomaly_detector, mock_llm_analyzer):
    telemetry_payload = {
        "source_node_id": "test-node-01",
        "metric_name": "network_bytes_in",
        "value": {"bytes": 1000000},
        "timestamp": time.time()
    }
    response = client.post("/telemetry/analyze", json=telemetry_payload)
    assert response.status_code == 201
    data = response.json()

    mock_anomaly_detector.predict_anomaly_score.assert_called_once()
    # mock_llm_analyzer.get_sentiment.assert_called_once() # LLM is not called in this endpoint in current main.py
    
    assert data["source_node_id"] == "test-node-01"
    assert data["anomaly_score"] == 85
    assert data["severity"] == "HIGH"
    assert db_session.query(AnomalyAlertDB).count() == 1

def test_optimize_defense_resources(client, mock_julia_client):
    request_payload = {
        "threat_state": {"id": "T_Test", "severity": 0.5, "impact_score": 0.5, "affected_nodes": ["node1"], "attack_vector": "TestAttack"},
        "available_resources": [{"id": "res1", "type": "Test", "cost": 10.0, "effectiveness": {"TestAttack": 0.8}, "current_count": 1, "max_count": 1}],
        "budget": 100.0,
        "objectives": {"impact_reduction": 1.0}
    }
    response = client.post("/optimize/defense-resources", json=request_payload)
    assert response.status_code == 200
    data = response.json()
    
    mock_julia_client.send_command.assert_called_once_with({"command": "OPTIMIZE_RESOURCES", **request_payload})
    assert data["status"] == "OPTIMAL"
    assert data["allocated_resources"]["res1"] == 1

def test_analyze_attack_path_impact(client, mock_julia_client):
    request_payload = {
        "attack_path": ["nodeA", "nodeB"],
        "network_graph": {"nodes": ["nodeA", "nodeB"], "edges": [{"src": "nodeA", "dst": "nodeB"}]},
        "vulnerabilities": {"nodeA": 0.1, "nodeB": 0.9},
        "defender_response_time": 5.0
    }
    response = client.post("/analyze/attack-path-impact", json=request_payload)
    assert response.status_code == 200
    data = response.json()
    
    mock_julia_client.send_command.assert_called_once_with({"command": "ANALYZE_ATTACK_PATH", **request_payload})
    assert data["total_impact_score"] == 0.8 # Based on mock_julia_client fixture

def test_get_alert_details(client, db_session):
    alert_id = f"alert-{int(time.time())}-{os.urandom(4).hex()}"
    new_alert = AnomalyAlertDB(
        id=alert_id,
        source_node_id="test-node-get",
        metric_name="test-metric",
        value={},
        anomaly_score=50,
        severity="MEDIUM",
        status="NEW"
    )
    db_session.add(new_alert)
    db_session.commit()

    response = client.get(f"/alerts/{alert_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["alert_id"] == alert_id
    assert data["source_node_id"] == "test-node-get"

def test_get_alert_details_404(client):
    response = client.get("/alerts/nonexistent-alert")
    assert response.status_code == 404

def test_grpc_get_threat_intelligence(grpc_test_servicer):
    request = alert_pb2.GetThreatIntelRequest(query="latest")
    context_mock = MagicMock()
    response = grpc_test_servicer.GetThreatIntelligence(request, context_mock)
    
    assert len(response.alerts) == 2
    assert response.alerts[0].id == "mock-alert-1"
    assert response.alerts[1].summary == "Suspicious activity observed."

def test_grpc_stream_threat_events(grpc_test_servicer):
    request = alert_pb2.StreamThreatEventsRequest()
    context_mock = MagicMock()
    
    events = []
    for event in grpc_test_servicer.StreamThreatEvents(request, context_mock):
        events.append(event)
    
    assert len(events) == 10
    assert events[0].id == "stream-alert-0"
    assert "Anomalous behavior" in events[5].summary