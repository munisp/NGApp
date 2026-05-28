"""
Pytest test suite for the OG-RMM ML Service.
Tests all endpoints without requiring Ollama or OpenSTEF to be running.
"""

import math
import sys
import os

import pytest
from fastapi.testclient import TestClient

# Ensure the app module is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

from main import app, _fit_arps, _compute_eur, _zscore_anomaly, _rule_based_recommendations, RecommendationRequest

client = TestClient(app)

# ─── Health ───────────────────────────────────────────────────────────────────


def test_health_returns_ok():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "capabilities" in body
    assert "ollama" in body


def test_metrics_returns_prometheus_format():
    r = client.get("/metrics")
    assert r.status_code == 200
    assert "og_ml_service_uptime_seconds" in r.text
    assert "og_ml_ollama_available" in r.text


# ─── Forecasting ──────────────────────────────────────────────────────────────


def test_forecast_returns_correct_point_count():
    r = client.post("/forecast", json={
        "well_id": "W-001",
        "horizon_hours": 6,
        "resolution_minutes": 30,
        "historical_values": [850.0, 840.0, 860.0],
    })
    assert r.status_code == 200
    body = r.json()
    assert body["well_id"] == "W-001"
    # 6h * 60min / 30min = 12 points
    assert len(body["points"]) == 12


def test_forecast_simulation_flag_is_true_without_opensteef():
    r = client.post("/forecast", json={
        "well_id": "W-002",
        "horizon_hours": 1,
        "resolution_minutes": 15,
    })
    assert r.status_code == 200
    assert r.json()["simulation"] is True


def test_forecast_all_values_non_negative():
    r = client.post("/forecast", json={
        "well_id": "W-003",
        "horizon_hours": 24,
        "resolution_minutes": 60,
        "historical_values": [500.0] * 10,
    })
    assert r.status_code == 200
    for pt in r.json()["points"]:
        assert pt["value"] >= 0
        assert pt["lower_bound"] >= 0
        assert pt["upper_bound"] >= pt["lower_bound"]


# ─── Arps Decline Calibration ─────────────────────────────────────────────────


def test_decline_calibration_returns_valid_params():
    production = [1000.0, 920.0, 850.0, 790.0, 735.0, 685.0, 640.0, 600.0]
    r = client.post("/decline/calibrate", json={
        "well_id": "W-004",
        "production_history": production,
    })
    assert r.status_code == 200
    body = r.json()
    assert body["qi"] > 0
    assert 0 < body["di"] < 1
    assert 0 <= body["b"] <= 2
    assert 0 <= body["r_squared"] <= 1
    assert body["eur_mbbl"] > 0


def test_decline_calibration_rejects_single_point():
    r = client.post("/decline/calibrate", json={
        "well_id": "W-005",
        "production_history": [1000.0],
    })
    assert r.status_code == 422


def test_fit_arps_exponential_decline():
    """Exponential decline: q(t) = qi * exp(-di*t). b should be near 0."""
    qi_true, di_true = 1000.0, 0.1
    production = [qi_true * math.exp(-di_true * t) for t in range(12)]
    qi, di, b, r2 = _fit_arps(production)
    assert abs(qi - qi_true) / qi_true < 0.05, f"qi error: {qi} vs {qi_true}"
    assert r2 > 0.95


def test_compute_eur_is_positive():
    eur = _compute_eur(qi=1000.0, di=0.08, b=0.5, months=240)
    assert eur > 0


# ─── Anomaly Detection ────────────────────────────────────────────────────────


def test_anomaly_detection_finds_spike():
    # Insert a clear spike at index 5 -- value is 10x the baseline so Z-score >> 3
    values = [100.0] * 10
    values[5] = 1000.0
    r = client.post("/anomaly/detect", json={
        "well_id": "W-006",
        "parameter": "tubing_pressure_psi",
        "values": values,
    })
    assert r.status_code == 200
    body = r.json()
    assert body["anomaly_count"] >= 1
    anomaly_indices = [a["index"] for a in body["anomalies"]]
    assert 5 in anomaly_indices


def test_anomaly_detection_rejects_too_few_points():
    r = client.post("/anomaly/detect", json={
        "well_id": "W-007",
        "parameter": "pressure",
        "values": [100.0, 101.0, 99.0],
    })
    assert r.status_code == 422


def test_zscore_anomaly_no_false_positives_on_flat_signal():
    values = [100.0] * 20
    points = _zscore_anomaly(values)
    assert all(not p.is_anomaly for p in points)


# ─── Rule-Based Recommendations ───────────────────────────────────────────────


def test_rule_based_low_esp_frequency():
    req = RecommendationRequest(
        well_id="W-008",
        current_rate_bpd=600.0,
        operating_point_pwf=1500.0,
        reservoir_pressure=3000.0,
        esp_frequency_hz=35.0,
        water_cut_pct=20.0,
    )
    resp = _rule_based_recommendations(req)
    assert any("ESP frequency" in r or "frequency" in r.lower() for r in resp.recommendations)
    assert resp.estimated_uplift_bpd > 0


def test_rule_based_high_water_cut():
    req = RecommendationRequest(
        well_id="W-009",
        current_rate_bpd=400.0,
        operating_point_pwf=2000.0,
        reservoir_pressure=3500.0,
        esp_frequency_hz=50.0,
        water_cut_pct=75.0,
    )
    resp = _rule_based_recommendations(req)
    assert any("water cut" in r.lower() or "water" in r.lower() for r in resp.recommendations)


def test_rule_based_optimal_well_returns_maintenance_advice():
    req = RecommendationRequest(
        well_id="W-010",
        current_rate_bpd=900.0,
        operating_point_pwf=1800.0,
        reservoir_pressure=2500.0,
        esp_frequency_hz=52.0,
        water_cut_pct=30.0,
    )
    resp = _rule_based_recommendations(req)
    assert len(resp.recommendations) >= 1
    assert resp.priority in ("HIGH", "MEDIUM", "LOW")


def test_recommend_endpoint_returns_valid_response():
    r = client.post("/recommend", json={
        "well_id": "W-011",
        "current_rate_bpd": 750.0,
        "operating_point_pwf": 1600.0,
        "reservoir_pressure": 2800.0,
        "esp_frequency_hz": 48.0,
        "water_cut_pct": 35.0,
        "recent_anomalies": ["High vibration on ESP motor"],
    })
    assert r.status_code == 200
    body = r.json()
    assert len(body["recommendations"]) >= 1
    assert body["priority"] in ("HIGH", "MEDIUM", "LOW")
    assert 0 <= body["confidence"] <= 1
