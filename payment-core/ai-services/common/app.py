#!/usr/bin/env python3
"""
ML Risk Scoring Service for Fraud Prevention System
"""

import os
import json
import time
import logging
import pickle
import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta

from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import joblib
import uvicorn
from prometheus_client import Counter, Histogram, start_http_server

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("ml_risk_scoring")

# Initialize FastAPI app
app = FastAPI(
    title="ML Risk Scoring Service",
    description="Machine Learning Risk Scoring Service for Fraud Prevention",
    version="1.0.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus metrics
PREDICTION_COUNTER = Counter(
    "ml_predictions_total", 
    "Total number of ML predictions", 
    ["result"]
)
PREDICTION_LATENCY = Histogram(
    "ml_prediction_latency_seconds", 
    "ML prediction latency in seconds"
)
FEATURE_EXTRACTION_LATENCY = Histogram(
    "ml_feature_extraction_latency_seconds", 
    "Feature extraction latency in seconds"
)
MODEL_LOADING_LATENCY = Histogram(
    "ml_model_loading_latency_seconds", 
    "Model loading latency in seconds"
)

# Model cache
MODEL_CACHE = {}
SCALER_CACHE = {}

# Request and response models
class PredictionRequest(BaseModel):
    transaction_id: str
    features: Dict[str, Any]

class PredictionResponse(BaseModel):
    transaction_id: str
    prediction: bool
    probability: float
    features_used: List[str]
    model_version: str
    prediction_time: str

class TrainingRequest(BaseModel):
    dataset_path: str
    model_name: str = "fraud_detection_model"
    test_size: float = 0.2
    random_state: int = 42

class TrainingResponse(BaseModel):
    model_id: str
    model_version: str
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    training_time: float
    feature_importance: Dict[str, float]

class ModelInfo(BaseModel):
    model_id: str
    model_name: str
    model_version: str
    model_type: str
    creation_date: str
    accuracy: float
    feature_count: int
    is_active: bool

# Helper functions
def load_model(model_path: str, model_name: str = "default") -> Tuple[Any, Any]:
    """Load ML model and scaler from disk"""
    start_time = time.time()
    
    # Check if model is already in cache
    if model_name in MODEL_CACHE and model_name in SCALER_CACHE:
        return MODEL_CACHE[model_name], SCALER_CACHE[model_name]
    
    try:
        # Load model and scaler
        model = joblib.load(os.path.join(model_path, f"{model_name}.pkl"))
        scaler = joblib.load(os.path.join(model_path, f"{model_name}_scaler.pkl"))
        
        # Cache model and scaler
        MODEL_CACHE[model_name] = model
        SCALER_CACHE[model_name] = scaler
        
        MODEL_LOADING_LATENCY.observe(time.time() - start_time)
        return model, scaler
    except Exception as e:
        logger.error(f"Failed to load model {model_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load model: {str(e)}")

def extract_features(transaction_features: Dict[str, Any]) -> np.ndarray:
    """Extract features from transaction data"""
    start_time = time.time()
    
    try:
        # Define the expected features and their default values
        expected_features = {
            "transaction_amount": 0.0,
            "transaction_hour": 12,
            "transaction_day_of_week": 0,
            "transaction_count_24h": 0,
            "transaction_amount_24h": 0.0,
            "new_location": False,
            "new_merchant": False,
            "transaction_velocity_1h": 0
        }
        
        # Extract features from transaction data
        features = {}
        for feature, default_value in expected_features.items():
            features[feature] = transaction_features.get(feature, default_value)
        
        # Convert boolean features to integers
        for feature in ["new_location", "new_merchant"]:
            features[feature] = 1 if features[feature] else 0
        
        # Create feature vector
        feature_vector = np.array([
            features["transaction_amount"],
            features["transaction_hour"],
            features["transaction_day_of_week"],
            features["transaction_count_24h"],
            features["transaction_amount_24h"],
            features["new_location"],
            features["new_merchant"],
            features["transaction_velocity_1h"]
        ]).reshape(1, -1)
        
        FEATURE_EXTRACTION_LATENCY.observe(time.time() - start_time)
        return feature_vector
    except Exception as e:
        logger.error(f"Failed to extract features: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to extract features: {str(e)}")

@app.on_event("startup")
async def startup_event():
    """Startup event handler"""
    logger.info("Starting ML Risk Scoring Service")
    
    # Create model directory if it doesn't exist
    os.makedirs("models", exist_ok=True)
    
    # Start Prometheus metrics server
    start_http_server(8000)
    
    # Try to load default model
    try:
        load_model("models", "default")
        logger.info("Default model loaded successfully")
    except Exception as e:
        logger.warning(f"Default model not found, will be created on first training: {e}")

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "ML Risk Scoring Service is running"}

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}

@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    """Predict fraud risk for a transaction"""
    start_time = time.time()
    
    try:
        # Load model and scaler
        model, scaler = load_model("models", "default")
        
        # Extract features
        feature_vector = extract_features(request.features)
        
        # Scale features
        scaled_features = scaler.transform(feature_vector)
        
        # Make prediction
        prediction = bool(model.predict(scaled_features)[0])
        probability = float(model.predict_proba(scaled_features)[0][1])  # Probability of fraud
        
        # Record metrics
        PREDICTION_COUNTER.labels(result="fraud" if prediction else "legitimate").inc()
        PREDICTION_LATENCY.observe(time.time() - start_time)
        
        # Return response
        return PredictionResponse(
            transaction_id=request.transaction_id,
            prediction=prediction,
            probability=probability,
            features_used=list(request.features.keys()),
            model_version="1.0.0",  # TODO: Get from model metadata
            prediction_time=datetime.now().isoformat()
        )
    except Exception as e:
        logger.error(f"Prediction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

@app.post("/train", response_model=TrainingResponse)
async def train_model(request: TrainingRequest, background_tasks: BackgroundTasks):
    """Train a new fraud detection model"""
    try:
        # This would normally be a background task
        background_tasks.add_task(train_model_task, request)
        
        # Return immediate response
        return JSONResponse(
            status_code=202,
            content={
                "message": "Model training started",
                "model_name": request.model_name,
                "status": "pending"
            }
        )
    except Exception as e:
        logger.error(f"Training request failed: {e}")
        raise HTTPException(status_code=500, detail=f"Training request failed: {str(e)}")

async def train_model_task(request: TrainingRequest):
    """Background task to train a model"""
    try:
        # This is a placeholder for the actual training code
        # In a real implementation, this would:
        # 1. Load the dataset
        # 2. Preprocess the data
        # 3. Split into training and test sets
        # 4. Train the model
        # 5. Evaluate the model
        # 6. Save the model and scaler
        
        # For now, we'll just log that training was requested
        logger.info(f"Model training requested for {request.model_name} using {request.dataset_path}")
        
        # TODO: Implement actual model training
    except Exception as e:
        logger.error(f"Model training failed: {e}")

@app.get("/models", response_model=List[ModelInfo])
async def list_models():
    """List all available models"""
    try:
        # This would normally query a database or scan the models directory
        # For now, we'll just return the default model if it exists
        models = []
        
        if "default" in MODEL_CACHE:
            models.append(
                ModelInfo(
                    model_id="default",
                    model_name="Fraud Detection Model",
                    model_version="1.0.0",
                    model_type="RandomForestClassifier",
                    creation_date=datetime.now().isoformat(),
                    accuracy=0.95,  # Placeholder
                    feature_count=8,
                    is_active=True
                )
            )
        
        return models
    except Exception as e:
        logger.error(f"Failed to list models: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list models: {str(e)}")

@app.get("/models/{model_id}")
async def get_model(model_id: str):
    """Get information about a specific model"""
    try:
        # This would normally query a database or load model metadata
        if model_id in MODEL_CACHE:
            return ModelInfo(
                model_id=model_id,
                model_name="Fraud Detection Model",
                model_version="1.0.0",
                model_type="RandomForestClassifier",
                creation_date=datetime.now().isoformat(),
                accuracy=0.95,  # Placeholder
                feature_count=8,
                is_active=True
            )
        else:
            raise HTTPException(status_code=404, detail=f"Model {model_id} not found")
    except Exception as e:
        logger.error(f"Failed to get model {model_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get model: {str(e)}")

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Add processing time header to response"""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=5000,
        reload=True,
        log_level="info"
    )

