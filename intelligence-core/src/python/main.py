# intelligence-core/src/python/main.py
import os
import json
import logging
import time
import socket
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional

import uvicorn
from fastapi import FastAPI, HTTPException, Depends, status, Query
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import create_engine, Column, String, Integer, DateTime, Text, Boolean, JSON, ARRAY
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from datetime import datetime

# AI/ML Libraries
import numpy as np
import tensorflow as tf
from tensorflow import keras
# import dgl # For Graph Neural Networks
from transformers import pipeline as hf_pipeline, AutoTokenizer, AutoModelForSequenceClassification
import grpc
from confluent_kafka import Consumer, KafkaError, KafkaException

# Generated protobufs
import proto.alert_pb2 as alert_pb2
import proto.alert_pb2_grpc as alert_pb2_grpc

# --- Configuration Management ---
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')

    DATABASE_URL: str = "postgresql+psycopg2://user:password@localhost/intelcore_db"
    GRPC_SERVER_ADDRESS: str = "[::]:50052" # For this service to expose
    GRPC_DECEPTION_ENGINE_ADDRESS: str = "localhost:50051" # For calling other services
    KAFKA_BOOTSTRAP_SERVERS: str = "localhost:9092"
    KAFKA_TELEMETRY_TOPIC: str = "omega_telemetry"
    JULIA_COMPUTE_HOST: str = "127.0.0.1"
    JULIA_COMPUTE_PORT: int = 50053
    ANOMALY_MODEL_PATH: str = "./models/anomaly_detector.h5"
    LLM_MODEL_NAME: str = "distilbert-base-uncased-finetuned-sst-2-english" # Sentiment for alerts
    
settings = Settings()

# --- Logging Configuration ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Database Setup (SQLAlchemy) ---
Base = declarative_base()

class AnomalyAlertDB(Base):
    __tablename__ = "anomaly_alerts"
    id = Column(String, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    source_node_id = Column(String)
    metric_name = Column(String)
    value = Column(JSON) # Store raw telemetry data as JSON
    anomaly_score = Column(Integer)
    severity = Column(String)
    status = Column(String, default="NEW") # NEW, TRIAGED, FALSE_POSITIVE

engine = create_engine(settings.DATABASE_URL)
Base.metadata.create_all(engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Pydantic Models for API Request/Response ---
class TelemetryData(BaseModel):
    source_node_id: str
    metric_name: str
    value: Dict[str, Any]
    timestamp: float = Field(default_factory=time.time)

class AnomalyAlertResponse(BaseModel):
    alert_id: str
    timestamp: datetime
    source_node_id: str
    metric_name: str
    anomaly_score: int
    severity: str
    status: str

# --- AI/ML Services ---
class AnomalyDetectionService:
    def __init__(self, model_path: str):
        try:
            self.model = keras.models.load_model(model_path)
            logger.info(f"Anomaly detection model loaded from {model_path}")
        except Exception as e:
            logger.error(f"Failed to load anomaly detection model: {e}. Anomaly detection disabled.")
            self.model = None

    def predict_anomaly_score(self, telemetry: TelemetryData) -> int:
        if not self.model:
            return 0 # Default to no anomaly if model not loaded
        # Simplified: In a real scenario, telemetry would be preprocessed
        # and fed into the model. Here, we just use a dummy score.
        dummy_input = np.random.rand(1, 100) # Assuming model expects a 100-feature vector
        prediction = self.model.predict(dummy_input)[0][0]
        return int(prediction * 100) # Scale to 0-100

class LLMService:
    def __init__(self, model_name: str):
        try:
            self.tokenizer = AutoTokenizer.from_pretrained(model_name)
            self.model = AutoModelForSequenceClassification.from_pretrained(model_name)
            self.pipeline = hf_pipeline("sentiment-analysis", model=self.model, tokenizer=self.tokenizer)
            logger.info(f"LLM '{model_name}' loaded for sentiment analysis.")
        except Exception as e:
            logger.error(f"Failed to load LLM '{model_name}': {e}. LLM analysis disabled.")
            self.pipeline = None

    def get_sentiment(self, text: str) -> str:
        if not self.pipeline:
            return "UNKNOWN"
        result = self.pipeline(text)[0]
        return result['label']

# --- Julia Compute Service Client ---
class JuliaComputeClient:
    def __init__(self, host: str, port: int):
        self.host = host
        self.port = port
        self.socket: Optional[socket.socket] = None
        self._is_connected = False
        self.connect()

    def connect(self, max_retries: int = 3):
        for attempt in range(max_retries):
            try:
                self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                self.socket.settimeout(5)
                self.socket.connect((self.host, self.port))
                self.socket.settimeout(None)
                self._is_connected = True
                logger.info(f"Connected to Julia Compute Service at {self.host}:{self.port}")
                return
            except (socket.error, ConnectionRefusedError) as e:
                logger.warning(f"Julia connection failed: {e}. Retrying in 2s...")
                time.sleep(2)
        logger.error(f"Failed to connect to Julia Compute Service after {max_retries} attempts.")
        self._is_connected = False

    def send_command(self, command_dict: Dict) -> Optional[Dict]:
        if not self._is_connected or not self.socket:
            self.connect() # Try to reconnect
            if not self._is_connected:
                logger.error("Julia Compute Service not available.")
                return None
        
        try:
            request_json = json.dumps(command_dict)
            encoded_message = request_json.encode('utf-8')
            
            # Prefix message with its length (4-byte unsigned integer)
            length_prefix = struct.pack("!I", len(encoded_message))
            self.socket.sendall(length_prefix + encoded_message)

            # Receive length-prefixed response
            response_len_bytes = self.socket.recv(4)
            if not response_len_bytes: raise socket.error("Connection closed by Julia.")
            response_len = struct.unpack("!I", response_len_bytes)[0]
            
            response_data = b""
            while len(response_data) < response_len:
                chunk = self.socket.recv(response_len - len(response_data))
                if not chunk: raise socket.error("Connection closed by Julia during receive.")
                response_data += chunk

            return json.loads(response_data.decode('utf-8'))
        except socket.error as e:
            logger.error(f"Julia communication error: {e}. Disconnecting and will attempt reconnect.")
            self.disconnect()
            return None
        except Exception as e:
            logger.error(f"Error sending/receiving Julia command: {e}")
            return None

    def disconnect(self):
        if self.socket:
            self.socket.close()
            self.socket = None
        self._is_connected = False
        logger.info("Disconnected from Julia Compute Service.")

# --- gRPC Server Implementation (for this service to expose) ---
class IntelligenceCoreServicer(alert_pb2_grpc.IntelligenceCoreServicer):
    def GetThreatIntelligence(self, request, context):
        logger.info(f"gRPC: Received GetThreatIntelligence request with query: {request.query}")
        # Placeholder for fetching real threat intelligence from DB
        alerts = [
            alert_pb2.Alert(id="mock-alert-1", summary="Example threat detected.", severity=alert_pb2.AlertSeverity.HIGH),
            alert_pb2.Alert(id="mock-alert-2", summary="Suspicious activity observed.", severity=alert_pb2.AlertSeverity.MEDIUM)
        ]
        return alert_pb2.AlertResponse(alerts=alerts)

    def StreamThreatEvents(self, request, context):
        logger.info("gRPC: Client subscribed to StreamThreatEvents.")
        for i in range(10): # Simulate streaming 10 events
            alert = alert_pb2.Alert(
                id=f"stream-alert-{i}",
                summary=f"Streamed event {i}: Anomalous behavior on node X",
                severity=alert_pb2.AlertSeverity.LOW,
                timestamp=int(time.time())
            )
            yield alert
            time.sleep(1)
        logger.info("gRPC: StreamThreatEvents completed.")

# --- Kafka Consumer for Telemetry ---
class TelemetryConsumer:
    def __init__(self, bootstrap_servers: str, topic: str, group_id: str):
        self.consumer = Consumer({
            'bootstrap.servers': bootstrap_servers,
            'group.id': group_id,
            'auto.offset.reset': 'earliest'
        })
        self.topic = topic
        self.consumer.subscribe([topic])
        logger.info(f"Kafka consumer subscribed to topic: {topic}")

    def poll_messages(self, timeout_ms: int = 1000) -> Optional[Dict]:
        msg = self.consumer.poll(timeout=timeout_ms/1000.0)
        if msg is None:
            return None
        if msg.error():
            if msg.error().code() == KafkaError._PARTITION_EOF:
                logger.debug(f"Kafka: End of partition reached for {msg.topic()} [{msg.partition()}]")
            else:
                raise KafkaException(msg.error())
        else:
            try:
                # Assuming message value is JSON string of TelemetryData
                return json.loads(msg.value().decode('utf-8'))
            except json.JSONDecodeError as e:
                logger.error(f"Kafka: Failed to decode message as JSON: {e}")
                return None

    def close(self):
        self.consumer.close()
        logger.info("Kafka consumer closed.")

# --- FastAPI Application ---
app = FastAPI(
    title="Omega Intelligence Core",
    description="The AI brain of the Omega Platform, processing telemetry, detecting anomalies, and generating defense strategies.",
    version="2.0.0"
)

# Global service instances (initialized on startup)
anomaly_detector: AnomalyDetectionService
llm_analyzer: LLMService
julia_client: JuliaComputeClient
telemetry_consumer: TelemetryConsumer
grpc_server: grpc.Server

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Context manager for application startup and shutdown events."""
    logger.info("Intelligence Core Service starting up...")
    
    # Initialize services
    global anomaly_detector, llm_analyzer, julia_client, telemetry_consumer, grpc_server
    anomaly_detector = AnomalyDetectionService(settings.ANOMALY_MODEL_PATH)
    llm_analyzer = LLMService(settings.LLM_MODEL_NAME)
    julia_client = JuliaComputeClient(settings.JULIA_COMPUTE_HOST, settings.JULIA_COMPUTE_PORT)
    telemetry_consumer = TelemetryConsumer(settings.KAFKA_BOOTSTRAP_SERVERS, settings.KAFKA_TELEMETRY_TOPIC, "intel_core_group")

    # Start gRPC Server
    grpc_server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    alert_pb2_grpc.add_IntelligenceCoreServicer_to_server(IntelligenceCoreServicer(), grpc_server)
    grpc_server.add_insecure_port(settings.GRPC_SERVER_ADDRESS)
    grpc_server.start()
    logger.info(f"gRPC server started on {settings.GRPC_SERVER_ADDRESS}")
    
    logger.info("Intelligence Core Service ready.")
    yield
    
    logger.info("Intelligence Core Service shutting down...")
    julia_client.disconnect()
    telemetry_consumer.close()
    grpc_server.stop(grace=5)
    logger.info("Intelligence Core Service gracefully shut down.")

app.router.lifespan_context = lifespan

# --- API Endpoints (FastAPI) ---

@app.get("/health", response_class=PlainTextResponse)
async def health_check():
    return "Intelligence Core is healthy."

@app.post("/telemetry/analyze", response_model=AnomalyAlertResponse, status_code=status.HTTP_201_CREATED)
async def analyze_telemetry_data(telemetry: TelemetryData, db: Session = Depends(get_db)):
    anomaly_score = anomaly_detector.predict_anomaly_score(telemetry)
    severity = "CRITICAL" if anomaly_score > 90 else "HIGH" if anomaly_score > 70 else "MEDIUM" if anomaly_score > 50 else "LOW"
    
    alert = AnomalyAlertDB(
        id=f"alert-{int(time.time())}-{os.urandom(4).hex()}",
        source_node_id=telemetry.source_node_id,
        metric_name=telemetry.metric_name,
        value=telemetry.value,
        anomaly_score=anomaly_score,
        severity=severity
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    
    logger.info(f"Analyzed telemetry from {telemetry.source_node_id}: Anomaly Score = {anomaly_score}, Severity = {severity}")
    return AnomalyAlertResponse(
        alert_id=alert.id,
        timestamp=alert.timestamp,
        source_node_id=alert.source_node_id,
        metric_name=alert.metric_name,
        anomaly_score=alert.anomaly_score,
        severity=alert.severity,
        status=alert.status
    )

@app.post("/optimize/defense-resources")
async def optimize_defense_resources(request: Dict[str, Any]):
    # Example request: {"threat_state": {...}, "available_resources": [...], "budget": 1000.0, "objectives": {"impact_reduction": 0.8}}
    response = julia_client.send_command({"command": "OPTIMIZE_RESOURCES", **request})
    if response and response.get("result"):
        return response["result"]
    raise HTTPException(status_code=500, detail="Failed to get optimization result from Julia service.")

@app.post("/analyze/attack-path-impact")
async def analyze_attack_path_impact(request: Dict[str, Any]):
    # Example request: {"attack_path": [...], "network_graph": {...}, "vulnerabilities": {...}, "defender_response_time": 5.0}
    response = julia_client.send_command({"command": "ANALYZE_ATTACK_PATH", **request})
    if response and response.get("result"):
        return response["result"]
    raise HTTPException(status_code=500, detail="Failed to get attack path analysis from Julia service.")


@app.get("/alerts/{alert_id}", response_model=AnomalyAlertResponse)
async def get_alert_details(alert_id: str, db: Session = Depends(get_db)):
    alert = db.query(AnomalyAlertDB).filter(AnomalyAlertDB.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return AnomalyAlertResponse(
        alert_id=alert.id,
        timestamp=alert.timestamp,
        source_node_id=alert.source_node_id,
        metric_name=alert.metric_name,
        anomaly_score=alert.anomaly_score,
        severity=alert.severity,
        status=alert.status
    )

# --- Main entry point for Uvicorn ---
if __name__ == "__main__":
    from concurrent import futures
    from starlette.responses import PlainTextResponse

    # Start gRPC server in a separate thread
    def serve_grpc():
        grpc_server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
        alert_pb2_grpc.add_IntelligenceCoreServicer_to_server(IntelligenceCoreServicer(), grpc_server)
        grpc_server.add_insecure_port(settings.GRPC_SERVER_ADDRESS)
        grpc_server.start()
        logger.info(f"gRPC server running on {settings.GRPC_SERVER_ADDRESS}")
        grpc_server.wait_for_termination()

    import threading
    grpc_thread = threading.Thread(target=serve_grpc, daemon=True)
    grpc_thread.start()

    uvicorn.run(app, host="0.0.0.0", port=8001)