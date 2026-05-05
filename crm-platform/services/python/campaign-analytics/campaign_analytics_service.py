"""
Campaign Analytics Service
Real-time analytics, A/B testing evaluation, conversion tracking,
and ML-powered cross-sell predictions for outbound campaigns.
"""

import json
import logging
import os
import uuid
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional

import redis
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Campaign Analytics Service",
    description="Analytics, A/B testing, and ML predictions for outbound campaigns",
    version="1.0.0",
)

# Redis connection
redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", "6379")),
    db=int(os.getenv("REDIS_DB", "2")),
    decode_responses=True,
)


# ── Models ──────────────────────────────────────────────────────────────────


class CampaignChannel(str, Enum):
    sms = "sms"
    whatsapp = "whatsapp"
    telegram = "telegram"
    voice = "voice"
    email = "email"
    ussd = "ussd"


class DeliveryEvent(BaseModel):
    campaign_id: str
    recipient_id: str
    channel: CampaignChannel
    event_type: str  # sent, delivered, read, clicked, failed, opted_out
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: Optional[dict[str, Any]] = None


class CampaignMetrics(BaseModel):
    campaign_id: str
    total_recipients: int = 0
    sent: int = 0
    delivered: int = 0
    read: int = 0
    clicked: int = 0
    failed: int = 0
    opted_out: int = 0
    delivery_rate: float = 0.0
    open_rate: float = 0.0
    click_rate: float = 0.0
    conversion_rate: float = 0.0
    cost_per_acquisition: float = 0.0
    revenue_generated: float = 0.0
    roi: float = 0.0
    avg_response_time_hours: float = 0.0
    channel_breakdown: dict[str, dict[str, int]] = {}
    hourly_performance: list[dict[str, Any]] = []


class ABTestResult(BaseModel):
    campaign_id: str
    variant_a: str
    variant_b: str
    variant_a_sent: int = 0
    variant_a_clicked: int = 0
    variant_b_sent: int = 0
    variant_b_clicked: int = 0
    variant_a_rate: float = 0.0
    variant_b_rate: float = 0.0
    winner: Optional[str] = None
    confidence: float = 0.0
    statistical_significance: bool = False
    recommendation: str = ""


class CrossSellPrediction(BaseModel):
    customer_id: str
    recommended_product: str
    confidence_score: float
    reasoning: str
    estimated_revenue: float
    best_channel: CampaignChannel
    best_time_of_day: str
    customer_segment: str
    risk_score: float


class CampaignRecommendation(BaseModel):
    campaign_type: str
    target_segment: str
    recommended_channels: list[CampaignChannel]
    estimated_reach: int
    estimated_conversion_rate: float
    estimated_revenue: float
    optimal_send_time: str
    message_template_suggestion: str
    reasoning: str


# ── In-Memory Analytics Store ───────────────────────────────────────────────

# In production, use PostgreSQL/ClickHouse. For now, Redis + in-memory.


class AnalyticsStore:
    """Stores and aggregates campaign delivery events."""

    def __init__(self):
        self.events: list[DeliveryEvent] = []

    def record_event(self, event: DeliveryEvent) -> None:
        self.events.append(event)
        # Persist to Redis for real-time dashboard
        key = f"campaign:{event.campaign_id}:events"
        redis_client.lpush(key, event.model_dump_json())
        redis_client.ltrim(key, 0, 9999)

        # Increment counters
        counter_key = f"campaign:{event.campaign_id}:counters"
        redis_client.hincrby(counter_key, event.event_type, 1)
        redis_client.hincrby(counter_key, f"{event.channel.value}:{event.event_type}", 1)

    def get_metrics(self, campaign_id: str) -> CampaignMetrics:
        counter_key = f"campaign:{campaign_id}:counters"
        counters = redis_client.hgetall(counter_key)

        sent = int(counters.get("sent", 0))
        delivered = int(counters.get("delivered", 0))
        read = int(counters.get("read", 0))
        clicked = int(counters.get("clicked", 0))
        failed = int(counters.get("failed", 0))
        opted_out = int(counters.get("opted_out", 0))
        total = sent + failed + opted_out

        delivery_rate = (delivered / sent * 100) if sent > 0 else 0
        open_rate = (read / delivered * 100) if delivered > 0 else 0
        click_rate = (clicked / delivered * 100) if delivered > 0 else 0

        # Channel breakdown
        channels = {}
        for key, value in counters.items():
            if ":" in key:
                ch, evt = key.split(":", 1)
                if ch not in channels:
                    channels[ch] = {}
                channels[ch][evt] = int(value)

        return CampaignMetrics(
            campaign_id=campaign_id,
            total_recipients=total,
            sent=sent,
            delivered=delivered,
            read=read,
            clicked=clicked,
            failed=failed,
            opted_out=opted_out,
            delivery_rate=round(delivery_rate, 2),
            open_rate=round(open_rate, 2),
            click_rate=round(click_rate, 2),
            channel_breakdown=channels,
        )


analytics_store = AnalyticsStore()


# ── Cross-Sell Prediction Engine ────────────────────────────────────────────


class CrossSellEngine:
    """
    ML-powered cross-sell prediction engine.
    Uses customer behavioral signals from Core Banking, Agent Banking,
    and Remittance to predict product affinity.
    """

    # Product catalog with estimated revenue per conversion
    PRODUCTS = {
        "savings_account": {"revenue": 15000, "segment": ["agent_banking", "remittance"]},
        "fixed_deposit": {"revenue": 50000, "segment": ["core_banking"]},
        "personal_loan": {"revenue": 25000, "segment": ["core_banking", "agent_banking"]},
        "insurance": {"revenue": 8000, "segment": ["core_banking", "remittance"]},
        "investment_fund": {"revenue": 35000, "segment": ["core_banking"]},
        "mobile_wallet": {"revenue": 5000, "segment": ["agent_banking"]},
        "forex_account": {"revenue": 20000, "segment": ["remittance"]},
        "business_loan": {"revenue": 75000, "segment": ["agent_banking"]},
    }

    # Feature weights for scoring (simplified logistic regression analog)
    FEATURE_WEIGHTS = {
        "transaction_frequency": 0.25,
        "average_balance": 0.20,
        "account_age_months": 0.15,
        "num_products": 0.10,
        "remittance_volume": 0.10,
        "agent_activity": 0.10,
        "risk_score_inverse": 0.10,
    }

    def predict(self, customer: dict) -> list[CrossSellPrediction]:
        """Generate cross-sell predictions for a customer."""
        predictions = []
        source = customer.get("source", "core_banking")
        existing_products = set(customer.get("products", []))

        for product_name, product_info in self.PRODUCTS.items():
            if product_name in existing_products:
                continue

            # Score based on segment match
            segment_match = source in product_info["segment"]
            if not segment_match:
                continue

            confidence = self._calculate_confidence(customer, product_name)
            if confidence < 0.3:
                continue

            best_channel = self._recommend_channel(customer)
            best_time = self._recommend_time(customer)

            predictions.append(
                CrossSellPrediction(
                    customer_id=customer["id"],
                    recommended_product=product_name,
                    confidence_score=round(confidence, 3),
                    reasoning=self._generate_reasoning(customer, product_name, confidence),
                    estimated_revenue=product_info["revenue"] * confidence,
                    best_channel=best_channel,
                    best_time_of_day=best_time,
                    customer_segment=customer.get("segment", "standard"),
                    risk_score=customer.get("risk_score", 0.5),
                )
            )

        predictions.sort(key=lambda p: p.confidence_score, reverse=True)
        return predictions[:3]

    def _calculate_confidence(self, customer: dict, product: str) -> float:
        """Calculate prediction confidence using weighted features."""
        score = 0.0

        # Transaction frequency signal
        tx_freq = min(customer.get("transaction_count", 0) / 100, 1.0)
        score += tx_freq * self.FEATURE_WEIGHTS["transaction_frequency"]

        # Balance signal
        balance = customer.get("balance", 0)
        balance_signal = min(balance / 5_000_000, 1.0)
        score += balance_signal * self.FEATURE_WEIGHTS["average_balance"]

        # Account age
        age_months = customer.get("account_age_months", 0)
        age_signal = min(age_months / 24, 1.0)
        score += age_signal * self.FEATURE_WEIGHTS["account_age_months"]

        # Product diversity
        num_products = len(customer.get("products", []))
        product_signal = min(num_products / 5, 1.0)
        score += product_signal * self.FEATURE_WEIGHTS["num_products"]

        # Remittance activity
        remittance_vol = customer.get("remittance_volume", 0)
        remit_signal = min(remittance_vol / 10_000_000, 1.0)
        score += remit_signal * self.FEATURE_WEIGHTS["remittance_volume"]

        # Agent activity
        agent_tx = customer.get("agent_transactions", 0)
        agent_signal = min(agent_tx / 50, 1.0)
        score += agent_signal * self.FEATURE_WEIGHTS["agent_activity"]

        # Risk score (inverse — lower risk = higher confidence)
        risk = customer.get("risk_score", 0.5)
        risk_signal = 1.0 - min(risk, 1.0)
        score += risk_signal * self.FEATURE_WEIGHTS["risk_score_inverse"]

        return min(score, 0.95)

    def _recommend_channel(self, customer: dict) -> CampaignChannel:
        """Recommend the best outbound channel based on customer behavior."""
        preferred = customer.get("preferred_channel", "")
        if preferred == "whatsapp":
            return CampaignChannel.whatsapp
        if preferred == "telegram":
            return CampaignChannel.telegram
        if preferred == "email":
            return CampaignChannel.email

        source = customer.get("source", "")
        if source == "agent_banking":
            return CampaignChannel.sms
        if source == "remittance":
            return CampaignChannel.whatsapp

        return CampaignChannel.sms

    def _recommend_time(self, customer: dict) -> str:
        """Recommend optimal send time based on customer activity patterns."""
        segment = customer.get("segment", "standard")
        if segment == "premium":
            return "09:00-10:00"
        if segment == "business":
            return "14:00-15:00"
        return "11:00-12:00"

    def _generate_reasoning(self, customer: dict, product: str, confidence: float) -> str:
        """Generate human-readable reasoning for the recommendation."""
        source = customer.get("source", "unknown")
        segment = customer.get("segment", "standard")

        reasons = []
        if confidence > 0.7:
            reasons.append(f"High affinity ({segment} segment)")
        elif confidence > 0.5:
            reasons.append(f"Moderate affinity ({segment} segment)")
        else:
            reasons.append(f"Emerging opportunity ({segment} segment)")

        balance = customer.get("balance", 0)
        if balance > 1_000_000:
            reasons.append(f"Strong balance (₦{balance:,.0f})")

        tx_count = customer.get("transaction_count", 0)
        if tx_count > 20:
            reasons.append(f"Active transactor ({tx_count} transactions)")

        if source == "agent_banking" and product == "savings_account":
            reasons.append("Agent banking customer likely to benefit from formal savings")
        elif source == "remittance" and product == "forex_account":
            reasons.append("Regular remittance corridor usage suggests FX account need")

        return ". ".join(reasons)


cross_sell_engine = CrossSellEngine()


# ── A/B Testing Engine ──────────────────────────────────────────────────────


class ABTestingEngine:
    """Statistical A/B test evaluation using z-test for proportions."""

    @staticmethod
    def evaluate(campaign_id: str) -> ABTestResult:
        """Evaluate A/B test results for a campaign."""
        counter_key = f"campaign:{campaign_id}:counters"
        counters = redis_client.hgetall(counter_key)

        # Get variant-specific counts from Redis
        variant_a_key = f"campaign:{campaign_id}:variant:A"
        variant_b_key = f"campaign:{campaign_id}:variant:B"

        va_data = redis_client.hgetall(variant_a_key)
        vb_data = redis_client.hgetall(variant_b_key)

        va_sent = int(va_data.get("sent", 0))
        va_clicked = int(va_data.get("clicked", 0))
        vb_sent = int(vb_data.get("sent", 0))
        vb_clicked = int(vb_data.get("clicked", 0))

        va_rate = (va_clicked / va_sent) if va_sent > 0 else 0
        vb_rate = (vb_clicked / vb_sent) if vb_sent > 0 else 0

        # Z-test for difference in proportions
        confidence = 0.0
        significant = False
        winner = None
        recommendation = "Insufficient data for statistical significance"

        if va_sent >= 30 and vb_sent >= 30:
            import math

            p_pool = (va_clicked + vb_clicked) / (va_sent + vb_sent) if (va_sent + vb_sent) > 0 else 0
            if p_pool > 0 and p_pool < 1:
                se = math.sqrt(p_pool * (1 - p_pool) * (1 / va_sent + 1 / vb_sent))
                if se > 0:
                    z = abs(va_rate - vb_rate) / se
                    # Approximate confidence from z-score
                    if z > 2.576:
                        confidence = 0.99
                    elif z > 1.96:
                        confidence = 0.95
                    elif z > 1.645:
                        confidence = 0.90
                    else:
                        confidence = min(z / 1.96 * 0.95, 0.89)

                    significant = confidence >= 0.95

                    if significant:
                        if va_rate > vb_rate:
                            winner = "A"
                            recommendation = f"Variant A outperforms B by {(va_rate - vb_rate)*100:.1f}pp. Recommend scaling Variant A to full audience."
                        else:
                            winner = "B"
                            recommendation = f"Variant B outperforms A by {(vb_rate - va_rate)*100:.1f}pp. Recommend scaling Variant B to full audience."
                    else:
                        recommendation = f"No significant difference detected (z={z:.2f}, p>{1-confidence:.2f}). Continue collecting data or increase sample size."

        return ABTestResult(
            campaign_id=campaign_id,
            variant_a="A",
            variant_b="B",
            variant_a_sent=va_sent,
            variant_a_clicked=va_clicked,
            variant_b_sent=vb_sent,
            variant_b_clicked=vb_clicked,
            variant_a_rate=round(va_rate, 4),
            variant_b_rate=round(vb_rate, 4),
            winner=winner,
            confidence=round(confidence, 4),
            statistical_significance=significant,
            recommendation=recommendation,
        )


ab_engine = ABTestingEngine()


# ── Campaign Recommender ────────────────────────────────────────────────────


class CampaignRecommender:
    """Generates campaign recommendations based on customer base analysis."""

    TEMPLATES = {
        "savings_upsell": {
            "type": "upsell",
            "segment": "agent_banking",
            "channels": [CampaignChannel.sms, CampaignChannel.whatsapp],
            "template": "Hi {name}, as a valued customer, we have a special savings account with {interest_rate}% interest just for you. Reply YES to learn more or visit your nearest branch.",
            "conv_rate": 0.08,
        },
        "remittance_forex": {
            "type": "cross_sell",
            "segment": "remittance",
            "channels": [CampaignChannel.whatsapp, CampaignChannel.telegram],
            "template": "Dear {name}, we noticed you send money regularly via {corridor}. Our new FX account offers better rates and zero transfer fees for the first 3 months. Tap below to open yours today.",
            "conv_rate": 0.12,
        },
        "loan_offer": {
            "type": "upsell",
            "segment": "core_banking",
            "channels": [CampaignChannel.sms, CampaignChannel.voice],
            "template": "Good news {name}! Based on your account history, you're pre-approved for a personal loan up to ₦{amount}. No collateral needed. Call us or reply APPLY.",
            "conv_rate": 0.06,
        },
        "reactivation": {
            "type": "reactivation",
            "segment": "dormant",
            "channels": [CampaignChannel.sms, CampaignChannel.email],
            "template": "Hi {name}, we miss you! Come back and enjoy zero transfer fees for 30 days. Your account is safe and ready. Reply ACTIVATE to restart.",
            "conv_rate": 0.04,
        },
        "insurance_cross_sell": {
            "type": "cross_sell",
            "segment": "premium",
            "channels": [CampaignChannel.whatsapp, CampaignChannel.voice],
            "template": "Dear {name}, protect your savings with our new micro-insurance plan. Coverage starts from just ₦500/month. Tap to learn more about plans tailored for you.",
            "conv_rate": 0.10,
        },
    }

    def recommend(self, segment_counts: dict[str, int]) -> list[CampaignRecommendation]:
        """Generate campaign recommendations based on customer segment distribution."""
        recommendations = []

        for key, template in self.TEMPLATES.items():
            reach = segment_counts.get(template["segment"], 0)
            if reach < 10:
                continue

            recommendations.append(
                CampaignRecommendation(
                    campaign_type=template["type"],
                    target_segment=template["segment"],
                    recommended_channels=template["channels"],
                    estimated_reach=reach,
                    estimated_conversion_rate=template["conv_rate"],
                    estimated_revenue=reach * template["conv_rate"] * 15000,
                    optimal_send_time="10:00-12:00 WAT",
                    message_template_suggestion=template["template"],
                    reasoning=f"Targeting {reach:,} {template['segment']} customers. "
                    f"Historical conversion rate: {template['conv_rate']*100:.0f}%. "
                    f"Recommended via {', '.join(c.value for c in template['channels'])}.",
                )
            )

        recommendations.sort(key=lambda r: r.estimated_revenue, reverse=True)
        return recommendations


recommender = CampaignRecommender()


# ── API Endpoints ───────────────────────────────────────────────────────────


@app.post("/api/v1/events", status_code=201)
async def record_delivery_event(event: DeliveryEvent):
    """Record a campaign delivery event (sent, delivered, read, clicked, failed)."""
    analytics_store.record_event(event)
    return {"status": "recorded", "campaign_id": event.campaign_id}


@app.post("/api/v1/events/batch", status_code=201)
async def record_batch_events(events: list[DeliveryEvent]):
    """Record multiple delivery events in a single call."""
    for event in events:
        analytics_store.record_event(event)
    return {"status": "recorded", "count": len(events)}


@app.get("/api/v1/campaigns/{campaign_id}/metrics", response_model=CampaignMetrics)
async def get_campaign_metrics(campaign_id: str):
    """Get real-time metrics for a campaign."""
    return analytics_store.get_metrics(campaign_id)


@app.get("/api/v1/campaigns/{campaign_id}/ab-test", response_model=ABTestResult)
async def get_ab_test_results(campaign_id: str):
    """Get A/B test results with statistical significance analysis."""
    return ab_engine.evaluate(campaign_id)


@app.post("/api/v1/cross-sell/predict", response_model=list[CrossSellPrediction])
async def predict_cross_sell(customer: dict):
    """Generate cross-sell predictions for a customer."""
    if "id" not in customer:
        raise HTTPException(status_code=400, detail="Customer 'id' is required")
    return cross_sell_engine.predict(customer)


@app.post("/api/v1/cross-sell/batch", response_model=list[CrossSellPrediction])
async def batch_predict_cross_sell(customers: list[dict]):
    """Generate cross-sell predictions for multiple customers."""
    all_predictions = []
    for customer in customers:
        predictions = cross_sell_engine.predict(customer)
        all_predictions.extend(predictions)
    return all_predictions


@app.post("/api/v1/campaigns/recommend", response_model=list[CampaignRecommendation])
async def recommend_campaigns(segment_counts: dict[str, int]):
    """Get campaign recommendations based on customer segment distribution."""
    return recommender.recommend(segment_counts)


@app.get("/api/v1/channels/performance")
async def get_channel_performance():
    """Get performance comparison across all channels."""
    # Aggregate from bulk sender metrics in Redis
    metrics_json = redis_client.get("bulk_sender:metrics")
    if metrics_json:
        metrics = json.loads(metrics_json)
        return metrics.get("channels", {})
    return {}


@app.get("/api/v1/health")
async def health():
    """Health check endpoint."""
    try:
        redis_client.ping()
        redis_status = "connected"
    except Exception:
        redis_status = "disconnected"

    return {
        "status": "healthy",
        "service": "campaign-analytics",
        "version": "1.0.0",
        "redis": redis_status,
        "timestamp": datetime.utcnow().isoformat(),
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8094"))
    uvicorn.run(app, host="0.0.0.0", port=port)
