# human-threat-modeling/src/main.py
import os
import json
import logging
import time
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional

import uvicorn
from fastapi import FastAPI, HTTPException, Depends, status
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import create_engine, Column, String, Integer, DateTime, Text, Boolean, ARRAY, JSON
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from datetime import datetime

import spacy
from transformers import pipeline as hf_pipeline
import networkx as nx
import grpc
import proto.alert_pb2 as alert_pb2
import proto.alert_pb2_grpc as alert_pb2_grpc

# --- Configuration Management ---
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')

    DATABASE_URL: str = "postgresql+psycopg2://user:password@localhost/htmdatabase"
    GRPC_INTEL_CORE_ADDRESS: str = "localhost:50052"
    NLP_MODEL_NAME: str = "en_core_web_sm" # Smaller SpaCy model for demonstration
    LLM_MODEL_NAME: str = "distilbert-base-uncased-distilled-squad" # QA model for LLM
    
    # Example: Override with values from config/<NODE_ENV>.json if using `python-dotenv` and a config library
    # For now, rely on .env
settings = Settings()

# --- Logging Configuration ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Database Setup (SQLAlchemy) ---
Base = declarative_base()

class ThreatModelDB(Base):
    __tablename__ = "threat_models"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # Store the knowledge graph as JSON
    knowledge_graph = Column(JSON, default=lambda: json.dumps(nx.node_link_data(nx.DiGraph())))
    status = Column(String, default="draft") # e.g., "draft", "in_review", "final"
    owner_id = Column(String, index=True) # User who owns the model

engine = create_engine(settings.DATABASE_URL)
Base.metadata.create_all(engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Pydantic Models for API Request/Response Validation ---
class ThreatModelCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=100)
    description: Optional[str] = None
    owner_id: str = "anonymous" # Placeholder for user authentication

class ThreatModelInDB(ThreatModelCreate):
    id: str
    created_at: datetime
    updated_at: datetime
    knowledge_graph: Dict[str, Any]
    status: str

    model_config = { "from_attributes": True }

class ThreatTextAnalysisRequest(BaseModel):
    text: str = Field(..., min_length=10)

class ExtractedEntity(BaseModel):
    text: str
    label: str
    start: int
    end: int

class LLMInsight(BaseModel):
    question: str
    answer: str
    score: float

class ThreatTextAnalysisResponse(BaseModel):
    entities: List[ExtractedEntity]
    mitre_ttps: List[str]
    llm_insights: List[LLMInsight] = Field(default_factory=list)

class GraphRelationship(BaseModel):
    source_entity_id: str
    target_entity_id: str
    relationship_type: str
    attributes: Dict[str, Any] = Field(default_factory=dict)

class GraphQueryResponse(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    attack_paths: Optional[List[List[str]]] = None

# --- Services: NLP, Knowledge Graph, LLM ---
class NLPService:
    def __init__(self, model_name: str):
        try:
            self.nlp = spacy.load(model_name)
            logger.info(f"SpaCy NLP model '{model_name}' loaded.")
        except OSError:
            logger.error(f"SpaCy model '{model_name}' not found. Downloading...")
            spacy.cli.download(model_name)
            self.nlp = spacy.load(model_name)

    def analyze_text(self, text: str) -> Dict[str, Any]:
        doc = self.nlp(text)
        entities = [{"text": ent.text, "label": ent.label_, "start": ent.start_char, "end": ent.end_char} for ent in doc.ents]
        
        # Simple TTP identification (can be improved with a more sophisticated rule-set or ML model)
        mitre_ttps = []
        if "phishing" in text.lower(): mitre_ttps.append("T1566")
        if "exploit" in text.lower(): mitre_ttps.append("T1190")
        if "lateral movement" in text.lower(): mitre_ttps.append("T1078")

        return {"entities": entities, "mitre_ttps": mitre_ttps}

class LLMService:
    def __init__(self, model_name: str):
        try:
            self.qa_pipeline = hf_pipeline("question-answering", model=model_name)
            logger.info(f"LLM QA pipeline '{model_name}' loaded.")
        except Exception as e:
            logger.error(f"Failed to load LLM model '{model_name}': {e}. LLM functionality disabled.")
            self.qa_pipeline = None

    def get_insights(self, context: str, questions: List[str]) -> List[LLMInsight]:
        if not self.qa_pipeline:
            return []
        
        insights = []
        for q in questions:
            try:
                result = self.qa_pipeline(question=q, context=context)
                insights.append(LLMInsight(question=q, answer=result['answer'], score=result['score']))
            except Exception as e:
                logger.warning(f"LLM failed to answer question '{q}': {e}")
                insights.append(LLMInsight(question=q, answer="[LLM error]", score=0.0))
        return insights


class KnowledgeGraphService:
    def __init__(self, graph_json: Dict[str, Any]):
        self._graph = nx.node_link_graph(graph_json)
        self._next_node_idx = max((int(n) for n in self._graph.nodes if n.isdigit()), default=-1) + 1 if self._graph.nodes else 0
    
    def get_graph_data(self) -> Dict[str, Any]:
        return nx.node_link_data(self._graph)

    def add_entity(self, entity_id: str, entity_type: str, properties: Dict[str, Any]):
        if not self._graph.has_node(entity_id):
            self._graph.add_node(entity_id, type=entity_type, **properties)
            logger.info(f"Added entity to graph: {entity_type} {entity_id}")
        else:
            self._graph.nodes[entity_id].update(properties)
            logger.info(f"Updated entity in graph: {entity_type} {entity_id}")
        
    def add_relationship(self, source_id: str, target_id: str, relationship_type: str, attributes: Dict[str, Any]):
        if not self._graph.has_node(source_id):
            self.add_entity(source_id, "unknown_source", {})
        if not self._graph.has_node(target_id):
            self.add_entity(target_id, "unknown_target", {})
        
        self._graph.add_edge(source_id, target_id, type=relationship_type, **attributes)
        logger.info(f"Added relationship: {source_id} -[{relationship_type}]-> {target_id}")

    def find_attack_paths(self, start_nodes: List[str], target_nodes: List[str]) -> List[List[str]]:
        paths = []
        for start_node in start_nodes:
            for target_node in target_nodes:
                if self._graph.has_node(start_node) and self._graph.has_node(target_node):
                    for path in nx.all_simple_paths(self._graph, source=start_node, target=target_node):
                        paths.append(path)
        return paths

# --- gRPC Client for Intelligence Core ---
class IntelCoreGRPCClient:
    def __init__(self, address: str):
        self.channel = grpc.insecure_channel(address)
        self.stub = alert_pb2_grpc.IntelligenceCoreStub(self.channel)
        logger.info(f"gRPC client connected to Intelligence Core at {address}")

    def get_latest_threat_intel(self) -> List[Dict[str, Any]]:
        try:
            request = alert_pb2.GetThreatIntelRequest(query="latest")
            response = self.stub.GetThreatIntelligence(request, timeout=5)
            # Assuming AlertResponse is used for threat intel for simplicity
            # In real system, would have specific proto for ThreatIntel
            return [{"id": alert.id, "summary": alert.summary, "severity": alert.severity} for alert in response.alerts]
        except grpc.RpcError as e:
            logger.error(f"gRPC call to Intelligence Core failed: {e.details}")
            return []

    def close(self):
        self.channel.close()

# --- FastAPI Application ---
app = FastAPI(
    title="Omega Human Threat Modeling Service",
    description="Facilitates collaborative threat modeling, leveraging NLP and AI to augment human intelligence.",
    version="2.0.0"
)

# Global service instances (initialized on startup)
nlp_service: NLPService
llm_service: LLMService
intel_core_grpc_client: IntelCoreGRPCClient

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Context manager for application startup and shutdown events."""
    logger.info("Human Threat Modeling Service starting up...")
    
    # Initialize services
    global nlp_service, llm_service, intel_core_grpc_client
    nlp_service = NLPService(settings.NLP_MODEL_NAME)
    llm_service = LLMService(settings.LLM_MODEL_NAME)
    intel_core_grpc_client = IntelCoreGRPCClient(settings.GRPC_INTEL_CORE_ADDRESS)
    
    logger.info("Human Threat Modeling Service ready.")
    yield
    
    logger.info("Human Threat Modeling Service shutting down...")
    intel_core_grpc_client.close()
    logger.info("Human Threat Modeling Service shut down.")

app.router.lifespan_context = lifespan # Assign the lifespan context manager

# --- API Endpoints ---

@app.post("/threat-models/", response_model=ThreatModelInDB, status_code=status.HTTP_201_CREATED)
async def create_threat_model(model: ThreatModelCreate, db: Session = Depends(get_db)):
    db_model = ThreatModelDB(
        id=f"thm-{int(time.time())}-{os.urandom(4).hex()}",
        name=model.name,
        description=model.description,
        owner_id=model.owner_id
    )
    db.add(db_model)
    db.commit()
    db.refresh(db_model)
    return db_model

@app.get("/threat-models/{model_id}", response_model=ThreatModelInDB)
async def get_threat_model(model_id: str, db: Session = Depends(get_db)):
    db_model = db.query(ThreatModelDB).filter(ThreatModelDB.id == model_id).first()
    if not db_model:
        raise HTTPException(status_code=404, detail="Threat model not found")
    return db_model

@app.post("/threat-models/{model_id}/nlp-analyze", response_model=ThreatTextAnalysisResponse)
async def analyze_threat_text(model_id: str, request: ThreatTextAnalysisRequest, db: Session = Depends(get_db)):
    db_model = db.query(ThreatModelDB).filter(ThreatModelDB.id == model_id).first()
    if not db_model:
        raise HTTPException(status_code=404, detail="Threat model not found")
    
    nlp_results = nlp_service.analyze_text(request.text)
    
    # LLM for insights
    llm_questions = [
        f"What are the main entities mentioned in this threat report?",
        f"What are the potential MITRE ATT&CK techniques implied by this text?",
        f"How does this threat relate to common cybersecurity incidents?"
    ]
    llm_insights = llm_service.get_insights(request.text, llm_questions)

    return ThreatTextAnalysisResponse(
        entities=[ExtractedEntity(**e) for e in nlp_results['entities']],
        mitre_ttps=nlp_results['mitre_ttps'],
        llm_insights=llm_insights
    )

@app.post("/threat-models/{model_id}/graph/relationship", status_code=status.HTTP_204_NO_CONTENT)
async def add_graph_relationship(model_id: str, relationship: GraphRelationship, db: Session = Depends(get_db)):
    db_model = db.query(ThreatModelDB).filter(ThreatModelDB.id == model_id).first()
    if not db_model:
        raise HTTPException(status_code=404, detail="Threat model not found")
    
    # Load graph, modify, then save
    kg_service = KnowledgeGraphService(db_model.knowledge_graph)
    kg_service.add_entity(relationship.source_entity_id, "generic", {}) # Ensure source node exists
    kg_service.add_entity(relationship.target_entity_id, "generic", {}) # Ensure target node exists
    kg_service.add_relationship(
        relationship.source_entity_id,
        relationship.target_entity_id,
        relationship.relationship_type,
        relationship.attributes
    )
    db_model.knowledge_graph = kg_service.get_graph_data()
    db.commit()
    return

@app.get("/threat-models/{model_id}/graph/query", response_model=GraphQueryResponse)
async def query_threat_graph(
    model_id: str,
    start_nodes: List[str] = Field(Query(None), description="Start nodes for attack path calculation"),
    target_nodes: List[str] = Field(Query(None), description="Target nodes for attack path calculation"),
    db: Session = Depends(get_db)
):
    db_model = db.query(ThreatModelDB).filter(ThreatModelDB.id == model_id).first()
    if not db_model:
        raise HTTPException(status_code=404, detail="Threat model not found")
    
    kg_service = KnowledgeGraphService(db_model.knowledge_graph)
    graph_data = kg_service.get_graph_data()

    attack_paths = None
    if start_nodes and target_nodes:
        attack_paths = kg_service.find_attack_paths(start_nodes, target_nodes)

    return GraphQueryResponse(
        nodes=graph_data["nodes"],
        edges=graph_data["links"], # NetworkX uses "links" for edges in node_link_data
        attack_paths=attack_paths
    )

@app.get("/threat-models/latest-intel", response_model=List[Dict[str, Any]])
async def get_intel_core_threats():
    return intel_core_grpc_client.get_latest_threat_intel()

# --- Main entry point for Uvicorn ---
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)