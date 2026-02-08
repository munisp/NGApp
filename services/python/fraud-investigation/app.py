"""
Fraud Investigation Dashboard Service.
Provides related transaction search, geo visualization data, and attack pattern detection.
"""
import os
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel

app = FastAPI(title="Fraud Investigation Service", version="1.0.0")

KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "kafka:9092")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
ELASTICSEARCH_URL = os.getenv("ELASTICSEARCH_URL", "http://elasticsearch:9200")


class AttackType(str, Enum):
    CARD_TESTING = "card_testing"
    ACCOUNT_TAKEOVER = "account_takeover"
    SYNTHETIC_IDENTITY = "synthetic_identity"
    FRIENDLY_FRAUD = "friendly_fraud"
    TRIANGULATION = "triangulation"
    BIN_ATTACK = "bin_attack"


class InvestigationStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    FALSE_POSITIVE = "false_positive"


# Simulated transaction database
transactions_db: list = []
investigations_db: dict = {}
attack_patterns_db: list = []


def generate_sample_transactions():
    """Generate sample transactions for demo."""
    countries = ["US", "NG", "GB", "CA", "DE", "FR", "IN", "BR"]
    merchants = ["merchant_001", "merchant_002", "merchant_003", "merchant_004"]
    
    for i in range(100):
        txn = {
            "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
            "amount": round(np.random.uniform(10, 5000), 2),
            "currency": "USD",
            "card_last4": f"{np.random.randint(1000, 9999)}",
            "card_bin": f"{np.random.randint(400000, 499999)}",
            "ip_address": f"{np.random.randint(1, 255)}.{np.random.randint(1, 255)}.{np.random.randint(1, 255)}.{np.random.randint(1, 255)}",
            "ip_country": np.random.choice(countries),
            "card_country": np.random.choice(countries[:3]),
            "merchant_id": np.random.choice(merchants),
            "email": f"user{np.random.randint(1, 1000)}@example.com",
            "device_id": f"device_{uuid.uuid4().hex[:8]}",
            "score": round(np.random.uniform(0, 100), 1),
            "action": np.random.choice(["allow", "review", "challenge", "block"]),
            "timestamp": time.time() - np.random.randint(0, 86400 * 7),
            "latitude": round(np.random.uniform(-90, 90), 4),
            "longitude": round(np.random.uniform(-180, 180), 4),
        }
        transactions_db.append(txn)


# Initialize sample data
generate_sample_transactions()


class SearchRequest(BaseModel):
    card_last4: Optional[str] = None
    card_bin: Optional[str] = None
    ip_address: Optional[str] = None
    email: Optional[str] = None
    device_id: Optional[str] = None
    merchant_id: Optional[str] = None
    min_score: Optional[float] = None
    max_score: Optional[float] = None
    action: Optional[str] = None
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    limit: int = 50


class InvestigationRequest(BaseModel):
    transaction_id: str
    reason: str
    assigned_to: Optional[str] = None


class AttackPatternRequest(BaseModel):
    pattern_type: AttackType
    indicators: dict
    affected_merchants: list[str]
    severity: str


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "fraud-investigation",
        "version": "1.0.0",
        "transactions_indexed": len(transactions_db),
        "open_investigations": len([i for i in investigations_db.values() if i["status"] == "open"]),
        "attack_patterns_detected": len(attack_patterns_db),
    }


@app.post("/search")
async def search_transactions(request: SearchRequest):
    """Search for related transactions using multiple criteria."""
    results = transactions_db.copy()
    
    if request.card_last4:
        results = [t for t in results if t["card_last4"] == request.card_last4]
    if request.card_bin:
        results = [t for t in results if t["card_bin"] == request.card_bin]
    if request.ip_address:
        results = [t for t in results if t["ip_address"] == request.ip_address]
    if request.email:
        results = [t for t in results if t["email"] == request.email]
    if request.device_id:
        results = [t for t in results if t["device_id"] == request.device_id]
    if request.merchant_id:
        results = [t for t in results if t["merchant_id"] == request.merchant_id]
    if request.min_score is not None:
        results = [t for t in results if t["score"] >= request.min_score]
    if request.max_score is not None:
        results = [t for t in results if t["score"] <= request.max_score]
    if request.action:
        results = [t for t in results if t["action"] == request.action]
    if request.start_time:
        results = [t for t in results if t["timestamp"] >= request.start_time]
    if request.end_time:
        results = [t for t in results if t["timestamp"] <= request.end_time]
    
    # Sort by timestamp descending
    results.sort(key=lambda x: x["timestamp"], reverse=True)
    
    return {
        "results": results[:request.limit],
        "total": len(results),
        "query": request.dict(exclude_none=True),
    }


@app.get("/transactions/{transaction_id}")
async def get_transaction(transaction_id: str):
    """Get transaction details with related transactions."""
    txn = next((t for t in transactions_db if t["transaction_id"] == transaction_id), None)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Find related transactions
    related_by_card = [t for t in transactions_db if t["card_last4"] == txn["card_last4"] and t["transaction_id"] != transaction_id][:10]
    related_by_ip = [t for t in transactions_db if t["ip_address"] == txn["ip_address"] and t["transaction_id"] != transaction_id][:10]
    related_by_email = [t for t in transactions_db if t["email"] == txn["email"] and t["transaction_id"] != transaction_id][:10]
    related_by_device = [t for t in transactions_db if t["device_id"] == txn["device_id"] and t["transaction_id"] != transaction_id][:10]
    
    return {
        "transaction": txn,
        "related": {
            "by_card": related_by_card,
            "by_ip": related_by_ip,
            "by_email": related_by_email,
            "by_device": related_by_device,
        },
        "related_counts": {
            "by_card": len(related_by_card),
            "by_ip": len(related_by_ip),
            "by_email": len(related_by_email),
            "by_device": len(related_by_device),
        },
    }


@app.get("/geo/heatmap")
async def get_geo_heatmap(
    min_score: float = Query(0, description="Minimum fraud score"),
    hours: int = Query(24, description="Time window in hours"),
):
    """Get geographic heatmap data for fraud visualization."""
    cutoff = time.time() - (hours * 3600)
    filtered = [t for t in transactions_db if t["timestamp"] >= cutoff and t["score"] >= min_score]
    
    # Aggregate by location
    locations = {}
    for txn in filtered:
        key = f"{round(txn['latitude'], 1)},{round(txn['longitude'], 1)}"
        if key not in locations:
            locations[key] = {"lat": txn["latitude"], "lng": txn["longitude"], "count": 0, "total_score": 0}
        locations[key]["count"] += 1
        locations[key]["total_score"] += txn["score"]
    
    # Calculate average score per location
    heatmap_data = []
    for loc in locations.values():
        heatmap_data.append({
            "lat": loc["lat"],
            "lng": loc["lng"],
            "count": loc["count"],
            "avg_score": round(loc["total_score"] / loc["count"], 1),
            "intensity": min(1.0, loc["count"] / 10),
        })
    
    return {
        "heatmap": heatmap_data,
        "total_points": len(heatmap_data),
        "time_window_hours": hours,
        "min_score_filter": min_score,
    }


@app.get("/geo/transactions")
async def get_geo_transactions(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    radius_km: float = Query(50, description="Radius in kilometers"),
):
    """Get transactions within a geographic radius."""
    # Simple distance calculation (not accurate for large distances)
    def distance(lat1, lng1, lat2, lng2):
        return ((lat1 - lat2) ** 2 + (lng1 - lng2) ** 2) ** 0.5 * 111  # Rough km conversion
    
    nearby = [
        t for t in transactions_db
        if distance(lat, lng, t["latitude"], t["longitude"]) <= radius_km
    ]
    
    return {
        "transactions": nearby[:100],
        "total": len(nearby),
        "center": {"lat": lat, "lng": lng},
        "radius_km": radius_km,
    }


@app.post("/investigations")
async def create_investigation(request: InvestigationRequest):
    """Create a fraud investigation case."""
    investigation_id = f"inv_{uuid.uuid4().hex[:12]}"
    
    txn = next((t for t in transactions_db if t["transaction_id"] == request.transaction_id), None)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    investigation = {
        "investigation_id": investigation_id,
        "transaction_id": request.transaction_id,
        "transaction": txn,
        "reason": request.reason,
        "status": InvestigationStatus.OPEN.value,
        "assigned_to": request.assigned_to,
        "created_at": time.time(),
        "updated_at": time.time(),
        "notes": [],
        "resolution": None,
    }
    
    investigations_db[investigation_id] = investigation
    
    return investigation


@app.get("/investigations")
async def list_investigations(
    status: Optional[str] = None,
    limit: int = 50,
):
    """List fraud investigations."""
    results = list(investigations_db.values())
    
    if status:
        results = [i for i in results if i["status"] == status]
    
    results.sort(key=lambda x: x["created_at"], reverse=True)
    
    return {
        "investigations": results[:limit],
        "total": len(results),
    }


@app.get("/investigations/{investigation_id}")
async def get_investigation(investigation_id: str):
    """Get investigation details."""
    if investigation_id not in investigations_db:
        raise HTTPException(status_code=404, detail="Investigation not found")
    return investigations_db[investigation_id]


@app.put("/investigations/{investigation_id}")
async def update_investigation(investigation_id: str, status: str, resolution: Optional[str] = None, note: Optional[str] = None):
    """Update investigation status."""
    if investigation_id not in investigations_db:
        raise HTTPException(status_code=404, detail="Investigation not found")
    
    inv = investigations_db[investigation_id]
    inv["status"] = status
    inv["updated_at"] = time.time()
    
    if resolution:
        inv["resolution"] = resolution
    if note:
        inv["notes"].append({"note": note, "timestamp": time.time()})
    
    return inv


@app.post("/attack-patterns")
async def report_attack_pattern(request: AttackPatternRequest):
    """Report a detected attack pattern."""
    pattern_id = f"atk_{uuid.uuid4().hex[:12]}"
    
    pattern = {
        "pattern_id": pattern_id,
        "pattern_type": request.pattern_type.value,
        "indicators": request.indicators,
        "affected_merchants": request.affected_merchants,
        "severity": request.severity,
        "detected_at": time.time(),
        "status": "active",
    }
    
    attack_patterns_db.append(pattern)
    
    # Publish to Kafka (simulated)
    print(f"[Kafka] Publishing attack pattern: {pattern_id}, type={request.pattern_type.value}")
    
    return pattern


@app.get("/attack-patterns")
async def list_attack_patterns(
    pattern_type: Optional[str] = None,
    status: str = "active",
    limit: int = 50,
):
    """List detected attack patterns."""
    results = attack_patterns_db.copy()
    
    if pattern_type:
        results = [p for p in results if p["pattern_type"] == pattern_type]
    if status:
        results = [p for p in results if p["status"] == status]
    
    results.sort(key=lambda x: x["detected_at"], reverse=True)
    
    return {
        "patterns": results[:limit],
        "total": len(results),
        "pattern_types": list(AttackType.__members__.keys()),
    }


@app.get("/analytics/summary")
async def get_analytics_summary(hours: int = 24):
    """Get fraud analytics summary."""
    cutoff = time.time() - (hours * 3600)
    recent = [t for t in transactions_db if t["timestamp"] >= cutoff]
    
    if not recent:
        return {"message": "No transactions in time window"}
    
    scores = [t["score"] for t in recent]
    actions = [t["action"] for t in recent]
    
    return {
        "time_window_hours": hours,
        "total_transactions": len(recent),
        "avg_score": round(np.mean(scores), 2),
        "high_risk_count": len([s for s in scores if s >= 60]),
        "blocked_count": actions.count("block"),
        "challenged_count": actions.count("challenge"),
        "reviewed_count": actions.count("review"),
        "allowed_count": actions.count("allow"),
        "block_rate": round(actions.count("block") / len(actions) * 100, 2),
        "top_risk_countries": ["NG", "RU", "CN"],  # Simulated
        "top_attack_types": ["card_testing", "account_takeover"],  # Simulated
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("FRAUD_INVESTIGATION_PORT", "8142"))
    uvicorn.run(app, host="0.0.0.0", port=port)
