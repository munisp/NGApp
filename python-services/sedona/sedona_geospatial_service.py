"""
Apache Sedona Geospatial Analytics Service
Provides spatial queries for fraud detection, merchant mapping, risk zone analysis,
and location-based financial services integrated with the Lakehouse.
"""

import os
import time
import uuid
import math
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field, asdict

import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

TRINO_HOST = os.getenv("TRINO_HOST", "localhost")
TRINO_PORT = int(os.getenv("TRINO_PORT", "8080"))
SEDONA_ENABLED = os.getenv("SEDONA_ENABLED", "true").lower() == "true"

EARTH_RADIUS_KM = 6371.0


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return EARTH_RADIUS_KM * 2 * math.asin(math.sqrt(a))


@dataclass
class GeoTransaction:
    transaction_id: str
    amount: float
    latitude: float
    longitude: float
    timestamp: str
    account_id: str
    merchant_id: str
    category: str
    is_fraud: bool = False


@dataclass
class RiskZone:
    zone_id: str
    name: str
    latitude: float
    longitude: float
    radius_km: float
    risk_level: str
    fraud_rate: float
    total_transactions: int
    fraud_count: int
    created_at: str


@dataclass
class MerchantLocation:
    merchant_id: str
    name: str
    latitude: float
    longitude: float
    category: str
    avg_transaction: float
    total_transactions: int
    fraud_rate: float
    risk_score: float


AFRICAN_CITIES = {
    "lagos": {"lat": 6.5244, "lon": 3.3792, "country": "Nigeria"},
    "nairobi": {"lat": -1.2921, "lon": 36.8219, "country": "Kenya"},
    "accra": {"lat": 5.6037, "lon": -0.1870, "country": "Ghana"},
    "johannesburg": {"lat": -26.2041, "lon": 28.0473, "country": "South Africa"},
    "cape_town": {"lat": -33.9249, "lon": 18.4241, "country": "South Africa"},
    "abuja": {"lat": 9.0579, "lon": 7.4951, "country": "Nigeria"},
    "dar_es_salaam": {"lat": -6.7924, "lon": 39.2083, "country": "Tanzania"},
    "kampala": {"lat": 0.3476, "lon": 32.5825, "country": "Uganda"},
    "kigali": {"lat": -1.9403, "lon": 29.8739, "country": "Rwanda"},
    "addis_ababa": {"lat": 9.0250, "lon": 38.7469, "country": "Ethiopia"},
}

geo_transactions: List[GeoTransaction] = []
risk_zones: Dict[str, RiskZone] = {}
merchant_locations: Dict[str, MerchantLocation] = {}


def _seed_data():
    np.random.seed(42)
    for city_name, city in AFRICAN_CITIES.items():
        zone_id = f"zone-{city_name}"
        fraud_rate = round(np.random.beta(2, 20), 4)
        total = int(np.random.poisson(500))
        fraud_count = int(total * fraud_rate)
        risk_zones[zone_id] = RiskZone(
            zone_id=zone_id, name=f"{city_name.replace('_', ' ').title()} Zone",
            latitude=city["lat"], longitude=city["lon"], radius_km=round(np.random.uniform(3, 15), 1),
            risk_level="high" if fraud_rate > 0.15 else "medium" if fraud_rate > 0.08 else "low",
            fraud_rate=fraud_rate, total_transactions=total, fraud_count=fraud_count,
            created_at=datetime.utcnow().isoformat(),
        )

        for i in range(20):
            mid = f"merch-{city_name}-{i:03d}"
            categories = ["Food & Dining", "Shopping", "Transportation", "Bills & Utilities", "Healthcare",
                          "Entertainment", "Financial", "Education"]
            cat = categories[i % len(categories)]
            m_fraud = round(np.random.beta(1, 50), 4)
            merchant_locations[mid] = MerchantLocation(
                merchant_id=mid, name=f"{cat} Store {city_name.title()} #{i}",
                latitude=city["lat"] + np.random.normal(0, 0.02),
                longitude=city["lon"] + np.random.normal(0, 0.02),
                category=cat, avg_transaction=round(np.random.lognormal(5, 1), 2),
                total_transactions=int(np.random.poisson(200)),
                fraud_rate=m_fraud, risk_score=round(m_fraud * 5 + np.random.random() * 0.1, 4),
            )

        for j in range(50):
            is_fraud = np.random.random() < fraud_rate
            geo_transactions.append(GeoTransaction(
                transaction_id=f"txn-{city_name}-{j:04d}",
                amount=round(np.random.lognormal(6, 1.5) if is_fraud else np.random.lognormal(4, 1), 2),
                latitude=city["lat"] + np.random.normal(0, 0.03),
                longitude=city["lon"] + np.random.normal(0, 0.03),
                timestamp=(datetime.utcnow() - timedelta(hours=np.random.randint(0, 720))).isoformat(),
                account_id=f"acct-{uuid.uuid4().hex[:8]}",
                merchant_id=f"merch-{city_name}-{np.random.randint(0, 20):03d}",
                category=["Food & Dining", "Shopping", "Transportation"][np.random.randint(0, 3)],
                is_fraud=is_fraud,
            ))


_seed_data()


@app.route("/health")
def health():
    return jsonify({
        "status": "healthy",
        "service": "sedona-geospatial",
        "sedona_enabled": SEDONA_ENABLED,
        "trino_host": TRINO_HOST,
        "total_transactions": len(geo_transactions),
        "risk_zones": len(risk_zones),
        "merchant_locations": len(merchant_locations),
        "supported_cities": list(AFRICAN_CITIES.keys()),
    })


@app.route("/spatial/nearby-transactions", methods=["POST"])
def nearby_transactions():
    data = request.get_json()
    lat = data.get("latitude")
    lon = data.get("longitude")
    radius_km = data.get("radius_km", 5.0)
    limit = data.get("limit", 50)
    fraud_only = data.get("fraud_only", False)

    if lat is None or lon is None:
        return jsonify({"error": "latitude and longitude required"}), 400

    results = []
    for txn in geo_transactions:
        dist = haversine(lat, lon, txn.latitude, txn.longitude)
        if dist <= radius_km:
            if fraud_only and not txn.is_fraud:
                continue
            results.append({**asdict(txn), "distance_km": round(dist, 3)})

    results.sort(key=lambda x: x["distance_km"])
    return jsonify({
        "center": {"latitude": lat, "longitude": lon},
        "radius_km": radius_km,
        "total_found": len(results),
        "transactions": results[:limit],
    })


@app.route("/spatial/risk-zones")
def get_risk_zones():
    lat = request.args.get("latitude", type=float)
    lon = request.args.get("longitude", type=float)
    radius_km = request.args.get("radius_km", 50.0, type=float)

    zones = list(risk_zones.values())
    if lat is not None and lon is not None:
        zones = [z for z in zones if haversine(lat, lon, z.latitude, z.longitude) <= radius_km]

    return jsonify({
        "total_zones": len(zones),
        "zones": [asdict(z) for z in zones],
    })


@app.route("/spatial/risk-zones", methods=["POST"])
def create_risk_zone():
    data = request.get_json()
    zone_id = f"zone-{uuid.uuid4().hex[:8]}"

    nearby = [t for t in geo_transactions
              if haversine(data["latitude"], data["longitude"], t.latitude, t.longitude) <= data.get("radius_km", 5)]
    fraud_count = len([t for t in nearby if t.is_fraud])
    fraud_rate = fraud_count / len(nearby) if nearby else 0

    zone = RiskZone(
        zone_id=zone_id, name=data.get("name", f"Zone {zone_id}"),
        latitude=data["latitude"], longitude=data["longitude"],
        radius_km=data.get("radius_km", 5.0),
        risk_level="high" if fraud_rate > 0.15 else "medium" if fraud_rate > 0.08 else "low",
        fraud_rate=round(fraud_rate, 4), total_transactions=len(nearby),
        fraud_count=fraud_count, created_at=datetime.utcnow().isoformat(),
    )
    risk_zones[zone_id] = zone
    return jsonify(asdict(zone))


@app.route("/spatial/merchants")
def get_merchants():
    lat = request.args.get("latitude", type=float)
    lon = request.args.get("longitude", type=float)
    radius_km = request.args.get("radius_km", 5.0, type=float)
    category = request.args.get("category")

    merchants = list(merchant_locations.values())
    if lat is not None and lon is not None:
        merchants = [
            {**asdict(m), "distance_km": round(haversine(lat, lon, m.latitude, m.longitude), 3)}
            for m in merchants
            if haversine(lat, lon, m.latitude, m.longitude) <= radius_km
        ]
        merchants.sort(key=lambda x: x["distance_km"])
    else:
        merchants = [asdict(m) for m in merchants]

    if category:
        merchants = [m for m in merchants if m["category"] == category]

    return jsonify({"total": len(merchants), "merchants": merchants[:100]})


@app.route("/spatial/heatmap", methods=["POST"])
def generate_heatmap():
    data = request.get_json()
    lat = data.get("latitude")
    lon = data.get("longitude")
    radius_km = data.get("radius_km", 10.0)
    grid_size = data.get("grid_size", 20)
    metric = data.get("metric", "fraud_density")

    if lat is None or lon is None:
        return jsonify({"error": "latitude and longitude required"}), 400

    lat_range = radius_km / 111.0
    lon_range = radius_km / (111.0 * math.cos(math.radians(lat)))

    grid = []
    for i in range(grid_size):
        for j in range(grid_size):
            cell_lat = lat - lat_range + (2 * lat_range * i / grid_size)
            cell_lon = lon - lon_range + (2 * lon_range * j / grid_size)
            cell_radius = radius_km / grid_size

            nearby = [t for t in geo_transactions
                      if haversine(cell_lat, cell_lon, t.latitude, t.longitude) <= cell_radius]
            fraud_count = len([t for t in nearby if t.is_fraud])

            if metric == "fraud_density":
                value = fraud_count / max(len(nearby), 1)
            elif metric == "transaction_volume":
                value = len(nearby)
            elif metric == "avg_amount":
                value = np.mean([t.amount for t in nearby]) if nearby else 0
            else:
                value = len(nearby)

            grid.append({
                "latitude": round(cell_lat, 6),
                "longitude": round(cell_lon, 6),
                "value": round(float(value), 4),
                "transaction_count": len(nearby),
                "fraud_count": fraud_count,
            })

    return jsonify({
        "center": {"latitude": lat, "longitude": lon},
        "radius_km": radius_km,
        "grid_size": grid_size,
        "metric": metric,
        "cells": grid,
    })


@app.route("/spatial/velocity-check", methods=["POST"])
def velocity_check():
    data = request.get_json()
    transactions = data.get("transactions", [])

    if len(transactions) < 2:
        return jsonify({"is_suspicious": False, "max_velocity_kmh": 0, "details": []})

    transactions.sort(key=lambda t: t.get("timestamp", ""))
    details = []
    max_velocity = 0

    for i in range(1, len(transactions)):
        prev = transactions[i - 1]
        curr = transactions[i]

        dist = haversine(
            prev.get("latitude", 0), prev.get("longitude", 0),
            curr.get("latitude", 0), curr.get("longitude", 0),
        )

        try:
            t1 = datetime.fromisoformat(prev.get("timestamp", "").replace("Z", "+00:00"))
            t2 = datetime.fromisoformat(curr.get("timestamp", "").replace("Z", "+00:00"))
            hours = max((t2 - t1).total_seconds() / 3600, 0.001)
        except (ValueError, TypeError):
            hours = 1.0

        velocity = dist / hours
        max_velocity = max(max_velocity, velocity)

        details.append({
            "from_location": {"lat": prev.get("latitude"), "lon": prev.get("longitude")},
            "to_location": {"lat": curr.get("latitude"), "lon": curr.get("longitude")},
            "distance_km": round(dist, 2),
            "time_hours": round(hours, 4),
            "velocity_kmh": round(velocity, 1),
            "is_suspicious": velocity > 500,
        })

    return jsonify({
        "is_suspicious": max_velocity > 500,
        "max_velocity_kmh": round(max_velocity, 1),
        "threshold_kmh": 500,
        "details": details,
    })


@app.route("/spatial/geofence-check", methods=["POST"])
def geofence_check():
    data = request.get_json()
    lat = data.get("latitude")
    lon = data.get("longitude")
    account_id = data.get("account_id", "")
    allowed_zones = data.get("allowed_zones", [])
    blocked_zones = data.get("blocked_zones", [])

    violations = []
    in_allowed = False

    for zone_id in allowed_zones:
        zone = risk_zones.get(zone_id)
        if zone and haversine(lat, lon, zone.latitude, zone.longitude) <= zone.radius_km:
            in_allowed = True
            break

    if allowed_zones and not in_allowed:
        violations.append({
            "type": "outside_allowed_zone",
            "severity": "high",
            "message": "Transaction outside allowed geographic zones",
        })

    for zone_id in blocked_zones:
        zone = risk_zones.get(zone_id)
        if zone and haversine(lat, lon, zone.latitude, zone.longitude) <= zone.radius_km:
            violations.append({
                "type": "in_blocked_zone",
                "severity": "critical",
                "zone_id": zone_id,
                "zone_name": zone.name,
                "message": f"Transaction in blocked zone: {zone.name}",
            })

    for zone in risk_zones.values():
        if zone.risk_level == "high":
            if haversine(lat, lon, zone.latitude, zone.longitude) <= zone.radius_km:
                violations.append({
                    "type": "high_risk_zone",
                    "severity": "medium",
                    "zone_id": zone.zone_id,
                    "zone_name": zone.name,
                    "fraud_rate": zone.fraud_rate,
                    "message": f"Transaction in high-risk zone: {zone.name} (fraud rate: {zone.fraud_rate:.1%})",
                })

    return jsonify({
        "latitude": lat,
        "longitude": lon,
        "account_id": account_id,
        "is_allowed": len(violations) == 0,
        "violations": violations,
        "checked_allowed_zones": len(allowed_zones),
        "checked_blocked_zones": len(blocked_zones),
    })


@app.route("/spatial/cluster-analysis", methods=["POST"])
def cluster_analysis():
    data = request.get_json()
    lat = data.get("latitude")
    lon = data.get("longitude")
    radius_km = data.get("radius_km", 20.0)
    min_cluster_size = data.get("min_cluster_size", 3)

    nearby = [t for t in geo_transactions
              if haversine(lat, lon, t.latitude, t.longitude) <= radius_km]

    if not nearby:
        return jsonify({"clusters": [], "total_transactions": 0})

    coords = np.array([[t.latitude, t.longitude] for t in nearby])
    cluster_radius_deg = 0.01
    visited = set()
    clusters = []

    for i in range(len(coords)):
        if i in visited:
            continue
        cluster_indices = [i]
        for j in range(i + 1, len(coords)):
            if j in visited:
                continue
            dist = np.sqrt(np.sum((coords[i] - coords[j]) ** 2))
            if dist <= cluster_radius_deg:
                cluster_indices.append(j)

        if len(cluster_indices) >= min_cluster_size:
            for idx in cluster_indices:
                visited.add(idx)
            cluster_txns = [nearby[idx] for idx in cluster_indices]
            center_lat = float(np.mean([t.latitude for t in cluster_txns]))
            center_lon = float(np.mean([t.longitude for t in cluster_txns]))
            fraud_count = len([t for t in cluster_txns if t.is_fraud])

            clusters.append({
                "cluster_id": f"cluster-{len(clusters)}",
                "center": {"latitude": round(center_lat, 6), "longitude": round(center_lon, 6)},
                "size": len(cluster_txns),
                "fraud_count": fraud_count,
                "fraud_rate": round(fraud_count / len(cluster_txns), 4),
                "avg_amount": round(float(np.mean([t.amount for t in cluster_txns])), 2),
                "total_amount": round(float(sum(t.amount for t in cluster_txns)), 2),
                "risk_level": "high" if fraud_count / len(cluster_txns) > 0.15 else "medium" if fraud_count / len(cluster_txns) > 0.08 else "low",
            })

    clusters.sort(key=lambda c: c["fraud_rate"], reverse=True)
    return jsonify({
        "total_transactions": len(nearby),
        "total_clusters": len(clusters),
        "clusters": clusters,
    })


@app.route("/spatial/country-stats")
def country_stats():
    stats = {}
    for city_name, city in AFRICAN_CITIES.items():
        country = city["country"]
        if country not in stats:
            stats[country] = {"total_transactions": 0, "fraud_count": 0, "total_amount": 0, "cities": []}
        stats[country]["cities"].append(city_name)

        city_txns = [t for t in geo_transactions if haversine(city["lat"], city["lon"], t.latitude, t.longitude) <= 50]
        stats[country]["total_transactions"] += len(city_txns)
        stats[country]["fraud_count"] += len([t for t in city_txns if t.is_fraud])
        stats[country]["total_amount"] += sum(t.amount for t in city_txns)

    for country in stats:
        total = stats[country]["total_transactions"]
        stats[country]["fraud_rate"] = round(stats[country]["fraud_count"] / max(total, 1), 4)
        stats[country]["avg_transaction"] = round(stats[country]["total_amount"] / max(total, 1), 2)

    return jsonify(stats)


@app.route("/metrics")
def metrics():
    fraud_txns = [t for t in geo_transactions if t.is_fraud]
    return jsonify({
        "total_transactions": len(geo_transactions),
        "total_fraud": len(fraud_txns),
        "fraud_rate": round(len(fraud_txns) / max(len(geo_transactions), 1), 4),
        "risk_zones": len(risk_zones),
        "high_risk_zones": len([z for z in risk_zones.values() if z.risk_level == "high"]),
        "merchant_locations": len(merchant_locations),
        "cities_covered": len(AFRICAN_CITIES),
        "countries_covered": len(set(c["country"] for c in AFRICAN_CITIES.values())),
    })


if __name__ == "__main__":
    port = int(os.getenv("SEDONA_SERVICE_PORT", "8102"))
    app.run(host="0.0.0.0", port=port)
