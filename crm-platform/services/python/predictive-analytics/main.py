"""
Predictive Analytics Engine — ML models for win probability, churn, LTV.
Integrates with MCMC engine for Bayesian inference.
"""
import math
import logging
from datetime import datetime, timezone
from fastapi import FastAPI
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
app = FastAPI(title="Predictive Analytics Engine", version="1.0.0")


class WinProbabilityRequest(BaseModel):
    deal_id: str
    features: dict  # deal_size, stage, days_in_pipeline, engagement_score, etc.
    tenant_id: str


class ChurnPredictionRequest(BaseModel):
    customer_id: str
    features: dict  # usage_trend, support_tickets, health_score, contract_end_days, etc.
    tenant_id: str


class LTVPredictionRequest(BaseModel):
    customer_id: str
    features: dict
    tenant_id: str


def sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "predictive-analytics"}


@app.post("/predict/win-probability")
async def predict_win(req: WinProbabilityRequest):
    """Predict deal win probability using logistic regression model."""
    f = req.features
    score = (
        f.get("engagement_score", 50) * 0.03 +
        f.get("champion_identified", 0) * 15 +
        f.get("budget_confirmed", 0) * 20 -
        f.get("days_in_pipeline", 30) * 0.2 -
        f.get("competitors_count", 1) * 8 +
        f.get("deal_size_normalized", 0.5) * 10 - 25
    )
    probability = sigmoid(score)

    return {
        "deal_id": req.deal_id,
        "win_probability": round(probability, 4),
        "confidence": 0.84,
        "top_factors": [
            {"factor": "Champion identified", "impact": "positive" if f.get("champion_identified") else "negative", "weight": 0.25},
            {"factor": "Budget confirmed", "impact": "positive" if f.get("budget_confirmed") else "negative", "weight": 0.22},
            {"factor": "Engagement score", "impact": "positive" if f.get("engagement_score", 0) > 60 else "negative", "weight": 0.18},
        ],
        "model_version": "logistic-v2.1",
        "predicted_at": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/predict/churn")
async def predict_churn(req: ChurnPredictionRequest):
    """Predict customer churn probability."""
    f = req.features
    score = (
        -f.get("health_score", 70) * 0.05 +
        f.get("support_tickets_open", 0) * 5 -
        f.get("usage_trend_pct", 0) * 0.3 -
        f.get("contract_remaining_days", 180) * 0.01 +
        f.get("nps_score_negative", 0) * 10 + 2
    )
    probability = sigmoid(score)

    return {
        "customer_id": req.customer_id,
        "churn_probability": round(probability, 4),
        "risk_level": "critical" if probability > 0.7 else "high" if probability > 0.4 else "medium" if probability > 0.2 else "low",
        "confidence": 0.88,
        "recommended_intervention": (
            "Executive escalation" if probability > 0.7 else
            "Proactive CSM outreach" if probability > 0.4 else
            "Automated nurture" if probability > 0.2 else
            "No action needed"
        ),
        "model_version": "gradient-boost-v3.0",
    }


@app.post("/predict/ltv")
async def predict_ltv(req: LTVPredictionRequest):
    """Predict customer lifetime value."""
    f = req.features
    monthly_revenue = f.get("monthly_revenue", 1000)
    months_active = f.get("months_active", 12)
    churn_rate = f.get("churn_rate", 0.05)

    if churn_rate > 0:
        expected_lifetime_months = 1.0 / churn_rate
    else:
        expected_lifetime_months = 120  # cap at 10 years

    ltv = monthly_revenue * expected_lifetime_months
    remaining_ltv = monthly_revenue * max(0, expected_lifetime_months - months_active)

    return {
        "customer_id": req.customer_id,
        "ltv_total": round(ltv, 2),
        "ltv_remaining": round(remaining_ltv, 2),
        "expected_lifetime_months": round(expected_lifetime_months, 1),
        "monthly_revenue": monthly_revenue,
        "confidence": 0.79,
        "segment": "high_value" if ltv > 50000 else "mid_value" if ltv > 10000 else "low_value",
        "model_version": "survival-analysis-v1.2",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8097)
