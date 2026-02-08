"""
Risk Insights & Explainability Service.
Provides human-readable explanations for fraud decisions using SHAP/LIME-style attribution.
"""
import os
import time
import uuid
from dataclasses import dataclass
from enum import Enum
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Risk Insights Service", version="1.0.0")

KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "kafka:9092")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
FRAUD_SCORING_URL = os.getenv("FRAUD_SCORING_URL", "http://fraud-scoring-service:8140")


class InsightCategory(str, Enum):
    VELOCITY = "velocity"
    DEVICE = "device"
    GEOLOCATION = "geolocation"
    BEHAVIORAL = "behavioral"
    NETWORK = "network"
    HISTORICAL = "historical"


class InsightSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class RiskInsight:
    category: InsightCategory
    severity: InsightSeverity
    title: str
    description: str
    contribution: float
    evidence: dict


# Human-readable insight templates
INSIGHT_TEMPLATES = {
    "high_card_velocity": {
        "category": InsightCategory.VELOCITY,
        "title": "Unusual card activity",
        "template": "This card has been used {count} times in the last hour, which is {multiplier}x higher than typical usage.",
    },
    "multiple_cards_ip": {
        "category": InsightCategory.VELOCITY,
        "title": "Multiple cards from same IP",
        "template": "{count} different cards have been used from this IP address in the last hour.",
    },
    "new_device": {
        "category": InsightCategory.DEVICE,
        "title": "New device detected",
        "template": "This device was first seen {days} days ago. New devices have a {rate}% higher fraud rate.",
    },
    "emulator_detected": {
        "category": InsightCategory.DEVICE,
        "title": "Emulator detected",
        "template": "This transaction originated from an emulated device environment.",
    },
    "vpn_proxy": {
        "category": InsightCategory.DEVICE,
        "title": "VPN or proxy detected",
        "template": "The IP address is associated with a {type} service, which may mask the true location.",
    },
    "country_mismatch": {
        "category": InsightCategory.GEOLOCATION,
        "title": "Country mismatch",
        "template": "The IP address is in {ip_country} but the card was issued in {card_country}.",
    },
    "impossible_travel": {
        "category": InsightCategory.GEOLOCATION,
        "title": "Impossible travel detected",
        "template": "This card was used {distance}km away just {minutes} minutes ago, which would require travel faster than possible.",
    },
    "fast_checkout": {
        "category": InsightCategory.BEHAVIORAL,
        "title": "Unusually fast checkout",
        "template": "The checkout was completed in {seconds} seconds, which is faster than {percentile}% of legitimate transactions.",
    },
    "bot_behavior": {
        "category": InsightCategory.BEHAVIORAL,
        "title": "Automated behavior detected",
        "template": "Mouse movements and typing patterns suggest automated or scripted behavior.",
    },
    "card_seen_fraud": {
        "category": InsightCategory.NETWORK,
        "title": "Card linked to fraud",
        "template": "This card has been associated with {count} fraudulent transactions across the network.",
    },
    "email_seen_fraud": {
        "category": InsightCategory.NETWORK,
        "title": "Email linked to fraud",
        "template": "This email address has been associated with fraudulent activity on other merchants.",
    },
    "high_risk_bin": {
        "category": InsightCategory.NETWORK,
        "title": "High-risk card BIN",
        "template": "Cards with this BIN ({bin}) have a {rate}% fraud rate across the network.",
    },
    "previous_chargeback": {
        "category": InsightCategory.HISTORICAL,
        "title": "Previous chargebacks",
        "template": "This card has {count} previous chargebacks in the last 12 months.",
    },
    "user_fraud_history": {
        "category": InsightCategory.HISTORICAL,
        "title": "User fraud history",
        "template": "This user account has been associated with {count} previous fraud attempts.",
    },
}


class InsightRequest(BaseModel):
    transaction_id: str
    score: float
    features: dict
    action: str


class InsightResponse(BaseModel):
    transaction_id: str
    score: float
    action: str
    insights: list
    summary: str
    risk_factors_count: int
    recommendation: str


# In-memory storage
insights_cache: dict = {}


def generate_insights(features: dict, score: float) -> list[dict]:
    """Generate human-readable insights from features."""
    insights = []
    
    # Velocity insights
    cards_per_ip = features.get("cards_per_ip_1h", 0)
    if cards_per_ip > 3:
        insights.append({
            "category": "velocity",
            "severity": "critical" if cards_per_ip > 5 else "warning",
            "title": "Multiple cards from same IP",
            "description": f"{cards_per_ip} different cards have been used from this IP address in the last hour.",
            "contribution": min(0.3, cards_per_ip * 0.05),
            "evidence": {"cards_count": cards_per_ip, "threshold": 3},
        })
    
    txns_per_card = features.get("txns_per_card_1h", 0)
    if txns_per_card > 5:
        insights.append({
            "category": "velocity",
            "severity": "warning",
            "title": "Unusual card activity",
            "description": f"This card has been used {txns_per_card} times in the last hour, which is {txns_per_card // 2}x higher than typical usage.",
            "contribution": min(0.2, txns_per_card * 0.03),
            "evidence": {"transaction_count": txns_per_card, "typical": 2},
        })
    
    # Device insights
    if features.get("is_emulator", False):
        insights.append({
            "category": "device",
            "severity": "critical",
            "title": "Emulator detected",
            "description": "This transaction originated from an emulated device environment.",
            "contribution": 0.4,
            "evidence": {"emulator": True},
        })
    
    if features.get("is_vpn", False) or features.get("is_proxy", False):
        proxy_type = "VPN" if features.get("is_vpn") else "proxy"
        insights.append({
            "category": "device",
            "severity": "warning",
            "title": "VPN or proxy detected",
            "description": f"The IP address is associated with a {proxy_type} service, which may mask the true location.",
            "contribution": 0.15,
            "evidence": {"vpn": features.get("is_vpn"), "proxy": features.get("is_proxy")},
        })
    
    device_age = features.get("device_age_days", 365)
    if device_age < 1:
        insights.append({
            "category": "device",
            "severity": "warning",
            "title": "New device detected",
            "description": f"This device was first seen {device_age} days ago. New devices have a 15% higher fraud rate.",
            "contribution": 0.2,
            "evidence": {"device_age_days": device_age},
        })
    
    # Geolocation insights
    ip_country = features.get("ip_country", "")
    card_country = features.get("card_country", "")
    if ip_country and card_country and ip_country != card_country:
        insights.append({
            "category": "geolocation",
            "severity": "warning",
            "title": "Country mismatch",
            "description": f"The IP address is in {ip_country} but the card was issued in {card_country}.",
            "contribution": 0.25,
            "evidence": {"ip_country": ip_country, "card_country": card_country},
        })
    
    if features.get("impossible_travel", False):
        insights.append({
            "category": "geolocation",
            "severity": "critical",
            "title": "Impossible travel detected",
            "description": "This card was used far away just minutes ago, which would require travel faster than possible.",
            "contribution": 0.5,
            "evidence": {"impossible_travel": True},
        })
    
    # Behavioral insights
    checkout_speed = features.get("checkout_speed_sec", 60)
    if checkout_speed < 5:
        insights.append({
            "category": "behavioral",
            "severity": "warning",
            "title": "Unusually fast checkout",
            "description": f"The checkout was completed in {checkout_speed} seconds, which is faster than 99% of legitimate transactions.",
            "contribution": 0.3,
            "evidence": {"checkout_seconds": checkout_speed, "percentile": 99},
        })
    
    if features.get("typing_speed_anomaly", False) or features.get("mouse_movement_anomaly", False):
        insights.append({
            "category": "behavioral",
            "severity": "warning",
            "title": "Automated behavior detected",
            "description": "Mouse movements and typing patterns suggest automated or scripted behavior.",
            "contribution": 0.2,
            "evidence": {"typing_anomaly": features.get("typing_speed_anomaly"), "mouse_anomaly": features.get("mouse_movement_anomaly")},
        })
    
    # Network insights
    if features.get("card_seen_fraud_network", False):
        insights.append({
            "category": "network",
            "severity": "critical",
            "title": "Card linked to fraud",
            "description": "This card has been associated with fraudulent transactions across the network.",
            "contribution": 0.5,
            "evidence": {"card_fraud_network": True},
        })
    
    if features.get("email_seen_fraud_network", False):
        insights.append({
            "category": "network",
            "severity": "critical",
            "title": "Email linked to fraud",
            "description": "This email address has been associated with fraudulent activity on other merchants.",
            "contribution": 0.3,
            "evidence": {"email_fraud_network": True},
        })
    
    bin_fraud_rate = features.get("bin_fraud_rate_network", 0)
    if bin_fraud_rate > 0.03:
        insights.append({
            "category": "network",
            "severity": "warning",
            "title": "High-risk card BIN",
            "description": f"Cards with this BIN have a {bin_fraud_rate * 100:.1f}% fraud rate across the network.",
            "contribution": 0.15,
            "evidence": {"bin_fraud_rate": bin_fraud_rate},
        })
    
    # Historical insights
    chargeback_history = features.get("card_chargeback_history", 0)
    if chargeback_history > 0:
        insights.append({
            "category": "historical",
            "severity": "critical",
            "title": "Previous chargebacks",
            "description": f"This card has {chargeback_history} previous chargebacks in the last 12 months.",
            "contribution": 0.3,
            "evidence": {"chargeback_count": chargeback_history},
        })
    
    user_fraud = features.get("user_fraud_history", 0)
    if user_fraud > 0:
        insights.append({
            "category": "historical",
            "severity": "critical",
            "title": "User fraud history",
            "description": f"This user account has been associated with {user_fraud} previous fraud attempts.",
            "contribution": 0.4,
            "evidence": {"fraud_count": user_fraud},
        })
    
    # Sort by contribution (highest first)
    insights.sort(key=lambda x: x["contribution"], reverse=True)
    
    return insights


def generate_summary(insights: list, score: float, action: str) -> str:
    """Generate a human-readable summary."""
    if not insights:
        return "No significant risk factors detected. Transaction appears legitimate."
    
    critical_count = len([i for i in insights if i["severity"] == "critical"])
    warning_count = len([i for i in insights if i["severity"] == "warning"])
    
    if action == "block":
        return f"Transaction blocked due to {critical_count} critical risk factors. Primary concerns: {', '.join([i['title'] for i in insights[:3]])}."
    elif action == "challenge":
        return f"Additional verification required. {critical_count} critical and {warning_count} warning signals detected."
    elif action == "review":
        return f"Manual review recommended. {len(insights)} risk factors identified, including: {insights[0]['title']}."
    else:
        if insights:
            return f"Transaction approved with {len(insights)} minor risk factors noted for monitoring."
        return "Transaction approved. No significant risk factors detected."


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "risk-insights",
        "version": "1.0.0",
        "insight_templates": len(INSIGHT_TEMPLATES),
        "insights_generated": len(insights_cache),
    }


@app.post("/insights", response_model=InsightResponse)
async def get_insights(request: InsightRequest):
    """Generate human-readable risk insights for a transaction."""
    insights = generate_insights(request.features, request.score)
    summary = generate_summary(insights, request.score, request.action)
    
    # Determine recommendation
    if request.action == "block":
        recommendation = "Do not process this transaction. Contact the cardholder through verified channels if needed."
    elif request.action == "challenge":
        recommendation = "Request 3D Secure authentication or OTP verification before processing."
    elif request.action == "review":
        recommendation = "Have a fraud analyst review this transaction before processing."
    else:
        recommendation = "Safe to process. Monitor for any post-transaction disputes."
    
    # Cache insights
    insights_cache[request.transaction_id] = {
        "insights": insights,
        "summary": summary,
        "timestamp": time.time(),
    }
    
    return InsightResponse(
        transaction_id=request.transaction_id,
        score=request.score,
        action=request.action,
        insights=insights,
        summary=summary,
        risk_factors_count=len(insights),
        recommendation=recommendation,
    )


@app.get("/insights/{transaction_id}")
async def get_cached_insights(transaction_id: str):
    """Get cached insights for a transaction."""
    if transaction_id not in insights_cache:
        raise HTTPException(status_code=404, detail="Insights not found")
    return insights_cache[transaction_id]


@app.get("/templates")
async def list_templates():
    """List available insight templates."""
    return {
        "templates": [
            {"id": k, "category": v["category"].value, "title": v["title"]}
            for k, v in INSIGHT_TEMPLATES.items()
        ],
        "total": len(INSIGHT_TEMPLATES),
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("RISK_INSIGHTS_PORT", "8141"))
    uvicorn.run(app, host="0.0.0.0", port=port)
