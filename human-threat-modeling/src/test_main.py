# human-threat-modeling/src/test_main.py
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import MagicMock, patch
import json

# Import the main application and its components
from main import app, get_db, Base, ThreatModelDB, ThreatModelInDB, ThreatModelCreate, ThreatTextAnalysisRequest
from main import nlp_service, llm_service, intel_core_grpc_client # Import global instances for patching

# --- Fixtures ---

# 1. Mock DB Session for testing
@pytest.fixture(scope="module")
def test_db_engine():
    # Use an in-memory SQLite database for testing
    return create_engine("sqlite:///:memory:")

@pytest.fixture(scope="module")
def test_db_tables(test_db_engine):
    Base.metadata.create_all(test_db_engine)
    yield
    Base.metadata.drop_all(test_db_engine)

@pytest.fixture
def db_session(test_db_engine, test_db_tables):
    """Yields a new database session for each test, then rolls back all changes."""
    connection = test_db_engine.connect()
    transaction = connection.begin()
    SessionTesting = sessionmaker(autocommit=False, autoflush=False, bind=connection)
    session = SessionTesting()
    yield session
    session.close()
    transaction.rollback()
    connection.close()

# 2. Test Client for FastAPI
@pytest.fixture(scope="module")
def client(test_db_engine, test_db_tables):
    """Provides a TestClient for FastAPI that uses the test database."""
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
    app.dependency_overrides = {} # Clean up overrides

# 3. Mocks for external services (NLP, LLM, gRPC)
@pytest.fixture(autouse=True)
def mock_nlp_service():
    with patch('main.NLPService', autospec=True) as MockNLPService:
        instance = MockNLPService.return_value
        instance.analyze_text.return_value = {
            "entities": [{"text": "threat actor", "label": "ORG", "start": 0, "end": 12}],
            "mitre_ttps": ["T1001"]
        }
        # Patch the global instance in main.py
        with patch('main.nlp_service', new=instance):
            yield instance

@pytest.fixture(autouse=True)
def mock_llm_service():
    with patch('main.LLMService', autospec=True) as MockLLMService:
        instance = MockLLMService.return_value
        instance.get_insights.return_value = [
            {"question": "What is it?", "answer": "It's a mock answer.", "score": 0.9}
        ]
        # Patch the global instance in main.py
        with patch('main.llm_service', new=instance):
            yield instance

@pytest.fixture(autouse=True)
def mock_grpc_client():
    with patch('main.IntelCoreGRPCClient', autospec=True) as MockGRPCClient:
        instance = MockGRPCClient.return_value
        instance.get_latest_threat_intel.return_value = [
            {"id": "intel-001", "summary": "Mock Intel", "severity": "HIGH"}
        ]
        # Patch the global instance in main.py
        with patch('main.intel_core_grpc_client', new=instance):
            yield instance

# --- Test Cases ---

def test_create_threat_model(client, db_session):
    response = client.post(
        "/threat-models/",
        json={"name": "Test Model", "description": "A description", "owner_id": "tester1"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Model"
    assert "id" in data
    assert db_session.query(ThreatModelDB).count() == 1

def test_get_threat_model(client, db_session):
    # First create a model
    create_response = client.post(
        "/threat-models/",
        json={"name": "Existing Model", "description": "Desc", "owner_id": "tester2"}
    )
    model_id = create_response.json()["id"]

    response = client.get(f"/threat-models/{model_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Existing Model"
    assert data["id"] == model_id

def test_get_nonexistent_threat_model_404(client):
    response = client.get("/threat-models/nonexistent")
    assert response.status_code == 404

def test_analyze_threat_text(client, mock_nlp_service, mock_llm_service):
    # First create a model
    create_response = client.post(
        "/threat-models/",
        json={"name": "NLP Test Model", "description": "Desc", "owner_id": "tester3"}
    )
    model_id = create_response.json()["id"]

    test_text = "A sophisticated threat actor performed phishing using a new exploit."
    response = client.post(
        f"/threat-models/{model_id}/nlp-analyze",
        json={"text": test_text}
    )
    assert response.status_code == 200
    data = response.json()

    mock_nlp_service.analyze_text.assert_called_once_with(test_text)
    mock_llm_service.get_insights.assert_called_once() # We don't check args strictly here as questions are complex

    assert "entities" in data
    assert "mitre_ttps" in data
    assert "llm_insights" in data
    assert data["entities"][0]["text"] == "threat actor"
    assert data["mitre_ttps"] == ["T1001"]
    assert data["llm_insights"][0]["answer"] == "It's a mock answer."


def test_add_graph_relationship(client, db_session):
    # First create a model
    create_response = client.post(
        "/threat-models/",
        json={"name": "Graph Test Model", "description": "Desc", "owner_id": "tester4"}
    )
    model_id = create_response.json()["id"]

    relationship_data = {
        "source_entity_id": "attacker_group_x",
        "target_entity_id": "vulnerability_cve_2023",
        "relationship_type": "exploits",
        "attributes": {"confidence": 0.9}
    }
    response = client.post(
        f"/threat-models/{model_id}/graph/relationship",
        json=relationship_data
    )
    assert response.status_code == 204 # No content for success

    # Retrieve the model to check graph data
    model = db_session.query(ThreatModelDB).filter(ThreatModelDB.id == model_id).first()
    assert model is not None
    graph = json.loads(model.knowledge_graph) # db.knowledge_graph is already a dict from SQLAlchemy
    
    nodes = graph["nodes"]
    edges = graph["links"] # networkx uses "links" for edges in node_link_data

    assert any(n["id"] == relationship_data["source_entity_id"] for n in nodes)
    assert any(n["id"] == relationship_data["target_entity_id"] for n in nodes)
    assert any(
        e["source"] == relationship_data["source_entity_id"] and
        e["target"] == relationship_data["target_entity_id"] and
        e["type"] == relationship_data["relationship_type"]
        for e in edges
    )

def test_query_threat_graph_with_paths(client, db_session):
    # Create model and add relationships to form a path
    create_response = client.post(
        "/threat-models/",
        json={"name": "Path Test Model", "description": "Path analysis", "owner_id": "tester5"}
    )
    model_id = create_response.json()["id"]

    client.post(f"/threat-models/{model_id}/graph/relationship", json={
        "source_entity_id": "entry_point", "target_entity_id": "mid_point", "relationship_type": "leads_to"
    })
    client.post(f"/threat-models/{model_id}/graph/relationship", json={
        "source_entity_id": "mid_point", "target_entity_id": "final_target", "relationship_type": "compromises"
    })

    response = client.get(
        f"/threat-models/{model_id}/graph/query",
        params={"start_nodes": ["entry_point"], "target_nodes": ["final_target"]}
    )
    assert response.status_code == 200
    data = response.json()
    assert "attack_paths" in data
    assert ["entry_point", "mid_point", "final_target"] in data["attack_paths"]


def test_get_latest_intel_core_threats(client, mock_grpc_client):
    response = client.get("/threat-models/latest-intel")
    assert response.status_code == 200
    data = response.json()
    
    mock_grpc_client.get_latest_threat_intel.assert_called_once()
    assert data == [{"id": "intel-001", "summary": "Mock Intel", "severity": "HIGH"}]