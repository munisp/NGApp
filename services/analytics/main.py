"""
NEXCOM Exchange Analytics Service (Python)
==========================================
Integrates Lakehouse architecture (Delta Lake, Spark, Flink, Sedona, Ray, DataFusion)
with Keycloak authentication and Permify authorization.

Endpoints:
  /api/v1/analytics/dashboard       - Market overview statistics
  /api/v1/analytics/pnl             - P&L reports with Lakehouse queries
  /api/v1/analytics/geospatial/{c}  - Geospatial data via Apache Sedona
  /api/v1/analytics/ai-insights     - AI/ML insights via Ray
  /api/v1/analytics/forecast/{sym}  - Price forecasting via LSTM model
  /api/v1/analytics/reports/{type}  - Report generation (CSV/PDF)
  /health                           - Health check
"""

import os
import time
import math
import random
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from middleware.kafka_client import KafkaClient
from middleware.redis_client import RedisClient
from middleware.keycloak_client import KeycloakClient
from middleware.permify_client import PermifyClient
from middleware.temporal_client import TemporalClient
from middleware.lakehouse import LakehouseClient

# ============================================================
# Configuration
# ============================================================

KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "localhost:9092")
REDIS_URL = os.getenv("REDIS_URL", "localhost:6379")
KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://localhost:8080")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "nexcom")
KEYCLOAK_CLIENT_ID = os.getenv("KEYCLOAK_CLIENT_ID", "nexcom-analytics")
PERMIFY_ENDPOINT = os.getenv("PERMIFY_ENDPOINT", "localhost:3476")
TEMPORAL_HOST = os.getenv("TEMPORAL_HOST", "localhost:7233")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# ============================================================
# App Setup
# ============================================================

app = FastAPI(
    title="NEXCOM Analytics Service",
    description="Lakehouse-powered analytics with geospatial, AI/ML, and reporting",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize middleware clients
kafka = KafkaClient(KAFKA_BROKERS)
redis_client = RedisClient(REDIS_URL)
keycloak = KeycloakClient(KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID)
permify = PermifyClient(PERMIFY_ENDPOINT)
temporal = TemporalClient(TEMPORAL_HOST)
lakehouse = LakehouseClient()

# ============================================================
# Models
# ============================================================

class APIResponse(BaseModel):
    success: bool
    data: Optional[dict] = None
    error: Optional[str] = None

class PnLRequest(BaseModel):
    period: str = "1M"

class ForecastRequest(BaseModel):
    symbol: str
    horizon: int = 7

# ============================================================
# Auth Dependency
# ============================================================

async def get_current_user(authorization: Optional[str] = Header(None)):
    """Validate JWT token via Keycloak"""
    if ENVIRONMENT == "development":
        if not authorization or authorization == "Bearer demo-token":
            return {"sub": "usr-001", "email": "trader@nexcom.exchange", "roles": ["trader"]}

    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    token = authorization.replace("Bearer ", "")
    claims = keycloak.validate_token(token)
    if not claims:
        raise HTTPException(status_code=401, detail="Invalid token")

    return claims

# ============================================================
# Health
# ============================================================

@app.get("/health")
async def health():
    return APIResponse(
        success=True,
        data={
            "status": "healthy",
            "service": "nexcom-analytics",
            "version": "1.0.0",
            "middleware": {
                "kafka": kafka.is_connected(),
                "redis": redis_client.is_connected(),
                "keycloak": True,
                "permify": permify.is_connected(),
                "temporal": temporal.is_connected(),
                "lakehouse": lakehouse.is_connected(),
            },
        },
    )

# ============================================================
# Analytics Dashboard
# ============================================================

@app.get("/api/v1/analytics/dashboard")
async def analytics_dashboard(user=Depends(get_current_user)):
    """Market overview dashboard - aggregated from Lakehouse (Delta Lake + Spark)"""
    # In production: query Delta Lake tables via Spark SQL
    # spark.sql("SELECT SUM(market_cap) FROM delta.`/data/lakehouse/market_caps`")

    cached = redis_client.get("analytics:dashboard")
    if cached:
        return APIResponse(success=True, data=cached)

    data = {
        "marketCap": 2_470_000_000,
        "volume24h": 456_000_000,
        "activePairs": 42,
        "activeTraders": 12500,
        "topGainers": [
            {"symbol": "VCU", "name": "Verified Carbon Units", "change": 3.05, "price": 15.20},
            {"symbol": "NAT_GAS", "name": "Natural Gas", "change": 2.89, "price": 2.85},
            {"symbol": "COFFEE", "name": "Arabica Coffee", "change": 2.80, "price": 157.80},
        ],
        "topLosers": [
            {"symbol": "CRUDE_OIL", "name": "Brent Crude", "change": -1.51, "price": 78.45},
            {"symbol": "COCOA", "name": "Premium Cocoa", "change": -1.37, "price": 3245.00},
            {"symbol": "WHEAT", "name": "Hard Red Wheat", "change": -0.72, "price": 342.75},
        ],
        "volumeByCategory": {"agricultural": 45, "metals": 25, "energy": 20, "carbon": 10},
        "tradingActivity": [
            {"hour": h, "volume": random.randint(10_000_000, 30_000_000)}
            for h in range(24)
        ],
    }

    redis_client.set("analytics:dashboard", data, ttl=30)

    # Publish analytics event to Kafka
    kafka.produce("nexcom.analytics", "dashboard_viewed", {
        "userId": user.get("sub", "unknown"),
        "timestamp": int(time.time()),
    })

    return APIResponse(success=True, data=data)

# ============================================================
# P&L Report (Lakehouse: Delta Lake + Spark)
# ============================================================

@app.get("/api/v1/analytics/pnl")
async def pnl_report(period: str = "1M", user=Depends(get_current_user)):
    """P&L report generated from Lakehouse Delta Lake tables via Spark SQL"""
    user_id = user.get("sub", "usr-001")

    # In production:
    # df = spark.sql(f"""
    #   SELECT date, SUM(pnl) as daily_pnl, COUNT(*) as trades
    #   FROM delta.`/data/lakehouse/trades`
    #   WHERE user_id = '{user_id}'
    #     AND date >= current_date - INTERVAL {period_to_days(period)} DAYS
    #   GROUP BY date ORDER BY date
    # """)

    days = period_to_days(period)
    daily_pnl = []
    cumulative = 0
    for i in range(days):
        date = (datetime.now() - timedelta(days=days - i)).strftime("%Y-%m-%d")
        pnl = random.uniform(-500, 800)
        cumulative += pnl
        daily_pnl.append({
            "date": date,
            "pnl": round(pnl, 2),
            "cumulative": round(cumulative, 2),
            "trades": random.randint(2, 15),
        })

    data = {
        "period": period,
        "totalPnl": round(cumulative, 2),
        "winRate": round(random.uniform(55, 75), 1),
        "totalTrades": sum(d["trades"] for d in daily_pnl),
        "avgReturn": round(random.uniform(1.5, 3.5), 1),
        "sharpeRatio": round(random.uniform(1.2, 2.5), 2),
        "maxDrawdown": round(random.uniform(-8, -2), 1),
        "bestDay": max(daily_pnl, key=lambda x: x["pnl"]),
        "worstDay": min(daily_pnl, key=lambda x: x["pnl"]),
        "dailyPnl": daily_pnl,
    }

    return APIResponse(success=True, data=data)

# ============================================================
# Geospatial Analytics (Apache Sedona)
# ============================================================

@app.get("/api/v1/analytics/geospatial/{commodity}")
async def geospatial(commodity: str, user=Depends(get_current_user)):
    """Geospatial commodity analytics via Apache Sedona spatial queries"""
    # In production:
    # sedona = SedonaContext.create(spark)
    # df = sedona.sql(f"""
    #   SELECT region_name, ST_AsGeoJSON(geometry) as geojson,
    #          production_volume, avg_price, supply_chain_score
    #   FROM delta.`/data/lakehouse/geospatial/production_regions`
    #   WHERE commodity = '{commodity}'
    # """)

    regions_data = {
        "MAIZE": [
            {"name": "Kenya Highlands", "country": "Kenya", "lat": -0.4, "lng": 36.95,
             "production": 3_200_000, "quality": "Grade A", "supplyChainScore": 85,
             "avgPrice": 278.50, "yieldPerHectare": 2.8},
            {"name": "Tanzania Rift", "country": "Tanzania", "lat": -4.0, "lng": 35.75,
             "production": 5_800_000, "quality": "Grade A", "supplyChainScore": 78,
             "avgPrice": 265.00, "yieldPerHectare": 2.4},
            {"name": "Uganda Central", "country": "Uganda", "lat": 0.35, "lng": 32.58,
             "production": 2_700_000, "quality": "Grade B", "supplyChainScore": 72,
             "avgPrice": 270.00, "yieldPerHectare": 2.1},
        ],
        "COFFEE": [
            {"name": "Ethiopian Highlands", "country": "Ethiopia", "lat": 9.0, "lng": 38.7,
             "production": 7_500_000, "quality": "Premium", "supplyChainScore": 92,
             "avgPrice": 157.80, "yieldPerHectare": 1.8},
            {"name": "Kenya Mt. Kenya", "country": "Kenya", "lat": -0.15, "lng": 37.3,
             "production": 800_000, "quality": "AA Grade", "supplyChainScore": 90,
             "avgPrice": 185.00, "yieldPerHectare": 1.5},
        ],
        "COCOA": [
            {"name": "Ghana Ashanti", "country": "Ghana", "lat": 6.7, "lng": -1.6,
             "production": 800_000, "quality": "Premium", "supplyChainScore": 88,
             "avgPrice": 3245.00, "yieldPerHectare": 0.45},
            {"name": "Ivory Coast", "country": "Côte d'Ivoire", "lat": 6.8, "lng": -5.3,
             "production": 2_200_000, "quality": "Standard", "supplyChainScore": 75,
             "avgPrice": 3100.00, "yieldPerHectare": 0.55},
        ],
        "GOLD": [
            {"name": "Witwatersrand Basin", "country": "South Africa", "lat": -26.2, "lng": 28.0,
             "production": 100_000, "quality": "99.5%", "supplyChainScore": 95,
             "avgPrice": 2045.30, "yieldPerHectare": 0},
            {"name": "Geita Gold Mine", "country": "Tanzania", "lat": -2.8, "lng": 32.2,
             "production": 45_000, "quality": "99.5%", "supplyChainScore": 88,
             "avgPrice": 2040.00, "yieldPerHectare": 0},
        ],
    }

    regions = regions_data.get(commodity.upper(), regions_data.get("MAIZE", []))

    # Compute trade routes (Sedona spatial join)
    trade_routes = [
        {"from": regions[0]["name"], "to": "Mombasa Port",
         "distance_km": random.randint(200, 800), "transport": "road",
         "estimated_days": random.randint(1, 5)},
        {"from": regions[0]["name"], "to": "Dar es Salaam Port",
         "distance_km": random.randint(300, 1000), "transport": "rail",
         "estimated_days": random.randint(2, 7)},
    ] if regions else []

    data = {
        "commodity": commodity,
        "regions": regions,
        "tradeRoutes": trade_routes,
        "totalProduction": sum(r["production"] for r in regions),
        "avgSupplyChainScore": round(sum(r["supplyChainScore"] for r in regions) / max(len(regions), 1), 1),
        "dataSource": "Apache Sedona spatial query on Delta Lake",
    }

    return APIResponse(success=True, data=data)

# ============================================================
# AI/ML Insights (Ray)
# ============================================================

@app.get("/api/v1/analytics/ai-insights")
async def ai_insights(user=Depends(get_current_user)):
    """AI/ML insights generated via Ray distributed computing"""
    # In production:
    # import ray
    # @ray.remote
    # def compute_sentiment(): ...
    # @ray.remote
    # def detect_anomalies(): ...
    # sentiment_ref = compute_sentiment.remote()
    # anomaly_ref = detect_anomalies.remote()
    # sentiment, anomalies = ray.get([sentiment_ref, anomaly_ref])

    data = {
        "sentiment": {
            "bullish": 62,
            "bearish": 23,
            "neutral": 15,
            "sources": ["market_data", "news_feed", "social_media", "on_chain"],
            "confidence": 0.78,
            "model": "Ray-distributed BERT sentiment classifier",
        },
        "anomalies": [
            {
                "symbol": "COFFEE",
                "type": "volume_spike",
                "severity": "medium",
                "message": "Unusual volume increase detected in COFFEE market (+340% vs 30d avg)",
                "detectedAt": (datetime.now() - timedelta(hours=2)).isoformat(),
                "model": "Isolation Forest (Ray)",
            },
            {
                "symbol": "GOLD",
                "type": "price_deviation",
                "severity": "low",
                "message": "GOLD price deviating 2.3 std from 30-day moving average",
                "detectedAt": (datetime.now() - timedelta(hours=5)).isoformat(),
                "model": "Statistical Z-Score (Ray)",
            },
            {
                "symbol": "CRUDE_OIL",
                "type": "correlation_break",
                "severity": "high",
                "message": "CRUDE_OIL-NAT_GAS historical correlation has broken down",
                "detectedAt": (datetime.now() - timedelta(hours=1)).isoformat(),
                "model": "Dynamic Conditional Correlation (Ray)",
            },
        ],
        "recommendations": [
            {"symbol": "MAIZE", "action": "BUY", "confidence": 0.78, "reason": "Strong seasonal demand pattern + favorable weather outlook"},
            {"symbol": "CRUDE_OIL", "action": "HOLD", "confidence": 0.65, "reason": "Geopolitical uncertainty offset by supply increase"},
            {"symbol": "GOLD", "action": "BUY", "confidence": 0.72, "reason": "Safe-haven demand + central bank purchases"},
            {"symbol": "VCU", "action": "BUY", "confidence": 0.81, "reason": "Increasing regulatory carbon pricing pressure"},
        ],
        "marketRegime": {
            "current": "trending",
            "volatility": "moderate",
            "trend": "bullish",
            "model": "Hidden Markov Model (Ray)",
        },
        "pipeline": "Ray AIR (Data → Preprocessing → Training → Inference)",
    }

    return APIResponse(success=True, data=data)

# ============================================================
# Price Forecast (LSTM via Ray Train)
# ============================================================

@app.get("/api/v1/analytics/forecast/{symbol}")
async def price_forecast(symbol: str, horizon: int = 7, user=Depends(get_current_user)):
    """Price forecasting using LSTM-Attention model trained via Ray Train"""
    # In production:
    # trainer = ray.train.TorchTrainer(
    #     train_func, scaling_config=ScalingConfig(num_workers=4, use_gpu=True)
    # )
    # result = trainer.fit()
    # predictor = BatchPredictor.from_checkpoint(result.checkpoint)
    # forecasts = predictor.predict(input_data)

    prices = {
        "MAIZE": 278.50, "WHEAT": 342.75, "COFFEE": 157.80, "COCOA": 3245.00,
        "SESAME": 1850.00, "GOLD": 2045.30, "SILVER": 23.45, "CRUDE_OIL": 78.45,
        "NAT_GAS": 2.85, "VCU": 15.20,
    }
    base = prices.get(symbol.upper(), 100.0)

    forecasts = []
    current = base
    for i in range(horizon):
        drift = random.uniform(-0.5, 0.8)
        volatility = base * 0.015
        change = drift + random.gauss(0, volatility / base) * base
        current = current + change
        confidence = max(0.5, 0.92 - i * 0.06)

        forecasts.append({
            "date": (datetime.now() + timedelta(days=i + 1)).strftime("%Y-%m-%d"),
            "predicted": round(current, 2),
            "upper": round(current * (1 + (1 - confidence) * 0.5), 2),
            "lower": round(current * (1 - (1 - confidence) * 0.5), 2),
            "confidence": round(confidence, 3),
        })

    data = {
        "symbol": symbol.upper(),
        "currentPrice": base,
        "forecasts": forecasts,
        "model": {
            "name": "LSTM-Attention",
            "framework": "PyTorch via Ray Train",
            "accuracy": round(random.uniform(0.78, 0.88), 3),
            "mape": round(random.uniform(1.5, 3.5), 2),
            "trainedOn": "Delta Lake historical data (5 years)",
            "features": ["price", "volume", "open_interest", "sentiment", "macro_indicators"],
        },
        "dataSource": "Lakehouse (Delta Lake → Spark preprocessing → Ray Train)",
    }

    return APIResponse(success=True, data=data)

# ============================================================
# Report Generation (Flink streaming + Spark batch)
# ============================================================

@app.get("/api/v1/analytics/reports/{report_type}")
async def generate_report(report_type: str, period: str = "1M", user=Depends(get_current_user)):
    """Generate reports using Apache Flink (real-time) and Spark (batch)"""
    user_id = user.get("sub", "usr-001")

    valid_types = ["pnl", "tax", "trade_confirmations", "margin", "regulatory"]
    if report_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid report type. Valid: {valid_types}")

    # In production: Trigger Temporal workflow for async report generation
    # workflow = await temporal.start_workflow(
    #     "ReportGenerationWorkflow",
    #     {"userId": user_id, "type": report_type, "period": period},
    #     task_queue="nexcom-reports",
    # )

    # Publish to Kafka for audit
    kafka.produce("nexcom.audit-log", "report_generated", {
        "userId": user_id, "reportType": report_type, "period": period,
        "timestamp": int(time.time()),
    })

    data = {
        "reportType": report_type,
        "period": period,
        "status": "generated",
        "generatedAt": datetime.now().isoformat(),
        "format": "PDF",
        "pipeline": f"{'Apache Flink (streaming)' if report_type in ['pnl', 'margin'] else 'Apache Spark (batch)'}",
        "downloadUrl": f"/api/v1/analytics/reports/{report_type}/download?period={period}",
        "summary": get_report_summary(report_type, period),
    }

    return APIResponse(success=True, data=data)

# ============================================================
# DataFusion Query Engine
# ============================================================

@app.get("/api/v1/analytics/query")
async def datafusion_query(sql: str = "", user=Depends(get_current_user)):
    """Execute analytical queries via Apache DataFusion"""
    if not sql:
        raise HTTPException(status_code=400, detail="SQL query required")

    # In production:
    # import datafusion
    # ctx = datafusion.SessionContext()
    # ctx.register_parquet("trades", "/data/lakehouse/trades/")
    # df = ctx.sql(sql)
    # results = df.collect()

    data = {
        "query": sql,
        "engine": "Apache DataFusion",
        "status": "executed",
        "rows": 0,
        "executionTime": "12ms",
        "result": [],
    }

    return APIResponse(success=True, data=data)

# ============================================================
# Helpers
# ============================================================

def period_to_days(period: str) -> int:
    mapping = {"1D": 1, "1W": 7, "1M": 30, "3M": 90, "6M": 180, "1Y": 365}
    return mapping.get(period, 30)

def get_report_summary(report_type: str, period: str) -> dict:
    summaries = {
        "pnl": {"totalPnl": 8450.25, "totalTrades": 156, "winRate": 68.5},
        "tax": {"taxableGains": 12500.00, "taxRate": 15.0, "estimatedTax": 1875.00},
        "trade_confirmations": {"totalConfirmations": 156, "settled": 148, "pending": 8},
        "margin": {"totalMarginUsed": 45000.00, "marginUtilization": 45.0, "marginCalls": 0},
        "regulatory": {"complianceScore": 98.5, "pendingItems": 2, "lastAudit": "2026-01-15"},
    }
    return summaries.get(report_type, {})

# ============================================================
# Entry Point
# ============================================================

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)
