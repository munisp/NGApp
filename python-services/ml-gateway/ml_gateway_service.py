from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid
import httpx
import asyncio

app = FastAPI(title="ML Gateway Service", version="1.0.0")

ML_SERVICES = {
    "credit_score": {"url": "http://localhost:5003", "name": "Credit Score ML"},
    "categorization": {"url": "http://localhost:5004", "name": "Smart Categorization"},
    "predictive_alerts": {"url": "http://localhost:5005", "name": "Predictive Alerts"},
    "investment_risk": {"url": "http://localhost:5006", "name": "Investment Risk ML"},
    "tax_optimization": {"url": "http://localhost:5007", "name": "Tax Optimization ML"},
    "gnn_fraud": {"url": "http://localhost:8101", "name": "GNN Fraud Detection"},
    "deep_learning": {"url": "http://localhost:8103", "name": "Deep Learning"},
    "feature_store": {"url": "http://localhost:8104", "name": "Feature Store"},
    "mlflow": {"url": "http://localhost:8105", "name": "MLflow Registry"},
    "realtime_inference": {"url": "http://localhost:8106", "name": "Realtime Inference"},
    "ray_cluster": {"url": "http://localhost:8100", "name": "Ray Cluster"},
    "sedona": {"url": "http://localhost:8102", "name": "Sedona Geospatial"},
}

predictions_log: list[dict] = []
model_metrics: dict[str, dict] = {}
ab_tests: dict[str, dict] = {}
feature_pipelines: dict[str, dict] = {}


class PredictionRequest(BaseModel):
    model: str
    user_id: str
    features: dict
    context: Optional[dict] = None

class BatchPredictionRequest(BaseModel):
    model: str
    requests: list[dict]

class FeaturePipelineRequest(BaseModel):
    name: str
    source: str
    transformations: list[str]
    destination: str
    schedule: str = "hourly"

class ABTestRequest(BaseModel):
    name: str
    model_a: str
    model_b: str
    traffic_split: float = 0.5
    metric: str = "accuracy"

class FraudCheckRequest(BaseModel):
    user_id: str
    transaction_id: str
    amount: float
    currency: str = "NGN"
    merchant: str = ""
    location: Optional[dict] = None

class CreditScoreRequest(BaseModel):
    user_id: str
    payment_history: list[dict] = []
    credit_utilization: float = 0.3
    account_age_months: int = 24
    num_accounts: int = 3
    recent_inquiries: int = 1

class CategorizeRequest(BaseModel):
    user_id: str
    transactions: list[dict]

class RiskAssessmentRequest(BaseModel):
    user_id: str
    portfolio: list[dict] = []
    risk_tolerance: str = "moderate"
    investment_horizon_years: int = 5


async def call_service(service_key: str, endpoint: str, data: dict, method: str = "POST") -> dict:
    svc = ML_SERVICES.get(service_key)
    if not svc:
        raise HTTPException(404, f"Unknown service: {service_key}")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            url = f"{svc['url']}{endpoint}"
            if method == "GET":
                resp = await client.get(url, params=data)
            else:
                resp = await client.post(url, json=data)
            resp.raise_for_status()
            return resp.json()
    except httpx.ConnectError:
        return {"error": f"Service {svc['name']} unavailable", "fallback": True}
    except Exception as e:
        return {"error": str(e), "fallback": True}


def log_prediction(model: str, user_id: str, result: dict, latency_ms: float):
    entry = {
        "id": str(uuid.uuid4())[:8],
        "model": model,
        "user_id": user_id,
        "result_summary": str(result)[:200],
        "latency_ms": latency_ms,
        "timestamp": datetime.utcnow().isoformat(),
    }
    predictions_log.append(entry)
    if len(predictions_log) > 10000:
        predictions_log.pop(0)

    if model not in model_metrics:
        model_metrics[model] = {"total": 0, "errors": 0, "avg_latency": 0, "p99_latency": 0}
    m = model_metrics[model]
    m["total"] += 1
    if "error" in result:
        m["errors"] += 1
    m["avg_latency"] = (m["avg_latency"] * (m["total"] - 1) + latency_ms) / m["total"]


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "ml-gateway",
        "version": "1.0.0",
        "registered_services": len(ML_SERVICES),
        "total_predictions": len(predictions_log),
    }


@app.get("/services")
def list_services():
    return {"services": [
        {"key": k, "name": v["name"], "url": v["url"]}
        for k, v in ML_SERVICES.items()
    ]}


@app.get("/services/{service_key}/health")
async def check_service_health(service_key: str):
    result = await call_service(service_key, "/health", {}, method="GET")
    return {"service": service_key, "health": result}


@app.get("/services/health/all")
async def check_all_services():
    tasks = []
    keys = list(ML_SERVICES.keys())
    for key in keys:
        tasks.append(call_service(key, "/health", {}, method="GET"))
    results = await asyncio.gather(*tasks, return_exceptions=True)
    statuses = {}
    for key, result in zip(keys, results):
        if isinstance(result, Exception):
            statuses[key] = {"status": "error", "error": str(result)}
        else:
            statuses[key] = result
    return {"services": statuses}


@app.post("/predict")
async def predict(req: PredictionRequest):
    start = datetime.utcnow()
    result = await call_service(req.model, "/predict", {
        "user_id": req.user_id,
        "features": req.features,
        **(req.context or {}),
    })
    latency = (datetime.utcnow() - start).total_seconds() * 1000
    log_prediction(req.model, req.user_id, result, latency)
    return {"prediction": result, "model": req.model, "latency_ms": round(latency, 2)}


@app.post("/predict/batch")
async def batch_predict(req: BatchPredictionRequest):
    start = datetime.utcnow()
    tasks = []
    for r in req.requests:
        tasks.append(call_service(req.model, "/predict", r))
    results = await asyncio.gather(*tasks, return_exceptions=True)
    latency = (datetime.utcnow() - start).total_seconds() * 1000
    return {
        "predictions": [r if not isinstance(r, Exception) else {"error": str(r)} for r in results],
        "total": len(results),
        "latency_ms": round(latency, 2),
    }


@app.post("/fraud/check")
async def fraud_check(req: FraudCheckRequest):
    start = datetime.utcnow()

    gnn_task = call_service("gnn_fraud", "/predict", {
        "user_id": req.user_id,
        "transaction_id": req.transaction_id,
        "amount": req.amount,
        "currency": req.currency,
        "merchant": req.merchant,
    })

    dl_task = call_service("deep_learning", "/predict", {
        "user_id": req.user_id,
        "amount": req.amount,
        "features": {"merchant": req.merchant, "currency": req.currency},
    })

    geo_task = None
    if req.location:
        geo_task = call_service("sedona", "/risk-check", {
            "latitude": req.location.get("latitude", 0),
            "longitude": req.location.get("longitude", 0),
        })

    tasks = [gnn_task, dl_task]
    if geo_task:
        tasks.append(geo_task)

    results = await asyncio.gather(*tasks, return_exceptions=True)

    gnn_score = 0.0
    dl_score = 0.0
    geo_score = 0.0

    if not isinstance(results[0], Exception) and "error" not in results[0]:
        gnn_score = results[0].get("fraud_score", results[0].get("score", 0))
    if not isinstance(results[1], Exception) and "error" not in results[1]:
        dl_score = results[1].get("fraud_score", results[1].get("score", 0))
    if geo_task and len(results) > 2 and not isinstance(results[2], Exception):
        geo_score = results[2].get("risk_score", 0)

    combined = gnn_score * 0.4 + dl_score * 0.35 + geo_score * 0.25
    decision = "approve" if combined < 0.5 else "review" if combined < 0.75 else "block"

    latency = (datetime.utcnow() - start).total_seconds() * 1000
    log_prediction("fraud_ensemble", req.user_id, {"score": combined}, latency)

    return {
        "transaction_id": req.transaction_id,
        "fraud_score": round(combined, 4),
        "decision": decision,
        "components": {
            "gnn_score": round(gnn_score, 4),
            "dl_score": round(dl_score, 4),
            "geo_score": round(geo_score, 4),
        },
        "latency_ms": round(latency, 2),
    }


@app.post("/credit-score/calculate")
async def calculate_credit_score(req: CreditScoreRequest):
    start = datetime.utcnow()

    ml_result = await call_service("credit_score", "/predict", {
        "user_id": req.user_id,
        "credit_utilization": req.credit_utilization,
        "account_age_months": req.account_age_months,
        "num_accounts": req.num_accounts,
        "recent_inquiries": req.recent_inquiries,
    })

    features_result = await call_service("feature_store", "/features/get", {
        "user_id": req.user_id,
        "feature_names": ["payment_history_score", "credit_mix_score", "avg_balance"],
    })

    ml_score = 650
    if not isinstance(ml_result, dict) or "error" not in ml_result:
        ml_score = ml_result.get("score", ml_result.get("credit_score", 650))

    payment_factor = min(100, max(0, 100 - len([h for h in req.payment_history if h.get("late", False)]) * 15))
    utilization_factor = max(0, 100 - req.credit_utilization * 100)
    age_factor = min(100, req.account_age_months * 1.5)
    mix_factor = min(100, req.num_accounts * 20)
    inquiry_factor = max(0, 100 - req.recent_inquiries * 10)

    weighted_score = (
        payment_factor * 0.35 +
        utilization_factor * 0.30 +
        age_factor * 0.15 +
        mix_factor * 0.10 +
        inquiry_factor * 0.10
    )
    final_score = int(300 + (weighted_score / 100) * 550)
    final_score = max(300, min(850, final_score))

    latency = (datetime.utcnow() - start).total_seconds() * 1000
    log_prediction("credit_score_ensemble", req.user_id, {"score": final_score}, latency)

    return {
        "user_id": req.user_id,
        "credit_score": final_score,
        "rating": "Excellent" if final_score >= 750 else "Good" if final_score >= 670 else "Fair" if final_score >= 580 else "Poor",
        "factors": {
            "payment_history": {"score": round(payment_factor, 1), "weight": 0.35},
            "credit_utilization": {"score": round(utilization_factor, 1), "weight": 0.30},
            "credit_age": {"score": round(age_factor, 1), "weight": 0.15},
            "credit_mix": {"score": round(mix_factor, 1), "weight": 0.10},
            "new_credit": {"score": round(inquiry_factor, 1), "weight": 0.10},
        },
        "ml_model_score": ml_score,
        "latency_ms": round(latency, 2),
    }


@app.post("/categorize")
async def categorize_transactions(req: CategorizeRequest):
    start = datetime.utcnow()
    result = await call_service("categorization", "/categorize", {
        "user_id": req.user_id,
        "transactions": req.transactions,
    })

    if "error" in result:
        categories = []
        for txn in req.transactions:
            desc = txn.get("description", "").lower()
            cat = "other"
            if any(w in desc for w in ["uber", "bolt", "taxi", "fuel", "petrol"]):
                cat = "transport"
            elif any(w in desc for w in ["shoprite", "spar", "market", "food"]):
                cat = "groceries"
            elif any(w in desc for w in ["mtn", "airtel", "glo", "data", "airtime"]):
                cat = "telecom"
            elif any(w in desc for w in ["rent", "landlord", "housing"]):
                cat = "housing"
            elif any(w in desc for w in ["school", "tuition", "fees"]):
                cat = "education"
            elif any(w in desc for w in ["hospital", "pharmacy", "doctor"]):
                cat = "healthcare"
            elif any(w in desc for w in ["netflix", "dstv", "spotify"]):
                cat = "entertainment"
            categories.append({**txn, "category": cat, "confidence": 0.7})
        result = {"categorized": categories}

    latency = (datetime.utcnow() - start).total_seconds() * 1000
    log_prediction("categorization", req.user_id, {"count": len(req.transactions)}, latency)
    return {**result, "latency_ms": round(latency, 2)}


@app.post("/risk-assessment")
async def risk_assessment(req: RiskAssessmentRequest):
    start = datetime.utcnow()
    result = await call_service("investment_risk", "/assess", {
        "user_id": req.user_id,
        "portfolio": req.portfolio,
        "risk_tolerance": req.risk_tolerance,
        "horizon_years": req.investment_horizon_years,
    })

    if "error" in result:
        total_value = sum(h.get("value", 0) for h in req.portfolio)
        risk_scores = {"conservative": 0.2, "moderate": 0.5, "aggressive": 0.8}
        risk_score = risk_scores.get(req.risk_tolerance, 0.5)
        result = {
            "risk_score": risk_score,
            "var_95": total_value * risk_score * 0.1,
            "sharpe_ratio": 1.2 - risk_score * 0.5,
            "recommendation": f"Portfolio aligned with {req.risk_tolerance} profile",
            "diversification_score": min(1.0, len(req.portfolio) * 0.15),
        }

    latency = (datetime.utcnow() - start).total_seconds() * 1000
    return {**result, "latency_ms": round(latency, 2)}


@app.post("/ab-test/create")
def create_ab_test(req: ABTestRequest):
    test_id = f"ab_{uuid.uuid4().hex[:8]}"
    ab_tests[test_id] = {
        "id": test_id,
        "name": req.name,
        "model_a": req.model_a,
        "model_b": req.model_b,
        "traffic_split": req.traffic_split,
        "metric": req.metric,
        "results_a": {"total": 0, "metric_sum": 0},
        "results_b": {"total": 0, "metric_sum": 0},
        "status": "active",
        "created_at": datetime.utcnow().isoformat(),
    }
    return ab_tests[test_id]


@app.get("/ab-test/{test_id}")
def get_ab_test(test_id: str):
    test = ab_tests.get(test_id)
    if not test:
        raise HTTPException(404, "A/B test not found")
    a = test["results_a"]
    b = test["results_b"]
    return {
        **test,
        "model_a_avg": a["metric_sum"] / a["total"] if a["total"] else 0,
        "model_b_avg": b["metric_sum"] / b["total"] if b["total"] else 0,
        "winner": "model_a" if (a["metric_sum"] / max(a["total"], 1)) > (b["metric_sum"] / max(b["total"], 1)) else "model_b",
    }


@app.post("/feature-pipeline/create")
def create_feature_pipeline(req: FeaturePipelineRequest):
    pipeline_id = f"fp_{uuid.uuid4().hex[:8]}"
    feature_pipelines[pipeline_id] = {
        "id": pipeline_id,
        "name": req.name,
        "source": req.source,
        "transformations": req.transformations,
        "destination": req.destination,
        "schedule": req.schedule,
        "status": "active",
        "last_run": None,
        "created_at": datetime.utcnow().isoformat(),
    }
    return feature_pipelines[pipeline_id]


@app.get("/feature-pipelines")
def list_feature_pipelines():
    return {"pipelines": list(feature_pipelines.values()), "total": len(feature_pipelines)}


@app.get("/metrics")
def get_metrics():
    return {
        "total_predictions": len(predictions_log),
        "model_metrics": model_metrics,
        "ab_tests": len(ab_tests),
        "feature_pipelines": len(feature_pipelines),
    }


@app.get("/predictions/recent")
def recent_predictions(limit: int = 50):
    return {"predictions": predictions_log[-limit:], "total": len(predictions_log)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8119)
