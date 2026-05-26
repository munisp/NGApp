"""
Geospatial Analytics Router
Provides spatial queries for well locations, pipeline routes, and field boundaries.
Uses Apache Sedona (PySpark spatial) for large-scale geospatial processing.
PostgreSQL with PostGIS for operational spatial queries.
Spec: BRQ-010 — geospatial field visualization; FRQ-014 — spatial query < 500ms.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from ..database import get_db_pool

logger = logging.getLogger(__name__)
router = APIRouter()


class WellLocation(BaseModel):
    well_id: str
    well_name: str
    latitude: float
    longitude: float
    status: str
    well_type: str
    depth_ft: Optional[float]
    oil_bpd: Optional[float]
    alarm_count: int


class FieldBoundary(BaseModel):
    field_name: str
    basin: str
    geojson: dict


@router.get("/wells", response_model=List[WellLocation])
async def get_well_locations(
    operator_id: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    bbox: Optional[str] = Query(
        default=None,
        description="Bounding box: min_lon,min_lat,max_lon,max_lat"
    ),
):
    """
    Get all well locations with current status for map rendering.
    Supports bounding box filtering for viewport-based loading.
    """
    pool = await get_db_pool()

    # Parse bounding box
    bbox_filter = ""
    bbox_params = []
    if bbox:
        try:
            parts = [float(x) for x in bbox.split(",")]
            if len(parts) == 4:
                bbox_filter = "AND w.longitude BETWEEN $4 AND $6 AND w.latitude BETWEEN $5 AND $7"
                bbox_params = parts
        except ValueError:
            pass

    rows = await pool.fetch(
        f"""
        SELECT
            w.well_id::text,
            w.well_name,
            w.latitude,
            w.longitude,
            w.status,
            w.well_type,
            w.total_depth_ft,
            dp.oil_bbls as oil_today,
            COUNT(a.alarm_id) as alarm_count
        FROM wells w
        LEFT JOIN daily_production dp ON w.well_id = dp.well_id
            AND dp.production_date = CURRENT_DATE
        LEFT JOIN alarms a ON w.well_id = a.well_id
            AND a.state IN ('UNACKNOWLEDGED', 'ACKNOWLEDGED')
        WHERE ($1::uuid IS NULL OR w.operator_id = $1::uuid)
          AND ($2 = '' OR w.status = $2)
          AND w.latitude IS NOT NULL
          AND w.longitude IS NOT NULL
        GROUP BY w.well_id, w.well_name, w.latitude, w.longitude,
                 w.status, w.well_type, w.total_depth_ft, dp.oil_bbls
        ORDER BY w.well_name
        LIMIT 1000
        """,
        operator_id, status or "",
    )

    return [
        WellLocation(
            well_id=r["well_id"],
            well_name=r["well_name"],
            latitude=float(r["latitude"]),
            longitude=float(r["longitude"]),
            status=r["status"],
            well_type=r["well_type"],
            depth_ft=float(r["total_depth_ft"]) if r["total_depth_ft"] else None,
            oil_bpd=float(r["oil_today"]) if r["oil_today"] else None,
            alarm_count=int(r["alarm_count"] or 0),
        )
        for r in rows
    ]


@router.get("/production-heatmap")
async def get_production_heatmap(days: int = Query(default=30)):
    """
    Generate production heatmap data points for Google Maps HeatmapLayer.
    Returns weighted lat/lon points where weight = oil production.
    """
    pool = await get_db_pool()
    rows = await pool.fetch(
        """
        SELECT
            w.latitude,
            w.longitude,
            COALESCE(SUM(dp.oil_bbls), 0) as total_oil
        FROM wells w
        JOIN daily_production dp ON w.well_id = dp.well_id
        WHERE dp.production_date >= CURRENT_DATE - ($1 || ' days')::INTERVAL
          AND w.latitude IS NOT NULL
          AND w.longitude IS NOT NULL
        GROUP BY w.well_id, w.latitude, w.longitude
        HAVING SUM(dp.oil_bbls) > 0
        """,
        str(days),
    )

    max_oil = max((float(r["total_oil"]) for r in rows), default=1)

    return {
        "heatmap_points": [
            {
                "lat": float(r["latitude"]),
                "lng": float(r["longitude"]),
                "weight": float(r["total_oil"]) / max_oil,
            }
            for r in rows
        ],
        "max_production_bbls": max_oil,
    }


@router.get("/pipeline-routes")
async def get_pipeline_routes():
    """
    Return pipeline route GeoJSON for map overlay.
    In production: queries PostGIS pipeline_segments table.
    """
    # Mock pipeline data — in production from PostGIS
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "pipeline_id": "PL-001",
                    "name": "Main Trunk Line",
                    "diameter_inches": 16,
                    "pressure_psi": 850,
                    "status": "ACTIVE",
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [-96.7970, 32.7767],
                        [-97.0, 32.9],
                        [-97.3, 33.1],
                    ],
                },
            }
        ],
    }


# ─── Damage heat-map ──────────────────────────────────────────────────────────

DAMAGE_WEIGHTS = {
    "DESTROYED": 5.0,
    "SEVERELY_DAMAGED": 4.0,
    "MODERATELY_DAMAGED": 3.0,
    "MINOR_DAMAGE": 2.0,
    "INTACT": 1.0,
}

DAMAGE_COLORS = {
    "DESTROYED": "#dc2626",
    "SEVERELY_DAMAGED": "#ea580c",
    "MODERATELY_DAMAGED": "#d97706",
    "MINOR_DAMAGE": "#ca8a04",
    "INTACT": "#16a34a",
}


@router.get("/damage-heatmap")
async def get_damage_heatmap(
    field_name: Optional[str] = Query(default=None),
    damage_level: Optional[str] = Query(default=None),
    limit: int = Query(default=1000, le=5000),
):
    """
    Get damage assessment locations for heat-map rendering.
    Returns GeoJSON FeatureCollection with damage severity weights.
    """
    import time
    start = time.time()

    try:
        pool = await get_db_pool()
        conditions = ["da.latitude IS NOT NULL", "da.longitude IS NOT NULL"]
        params: list = []
        param_idx = 1

        if field_name:
            conditions.append(f"da.field_name = ${param_idx}")
            params.append(field_name)
            param_idx += 1

        if damage_level:
            conditions.append(f"da.damage_level = ${param_idx}")
            params.append(damage_level)
            param_idx += 1

        where_clause = f"WHERE {' AND '.join(conditions)}"

        rows = await pool.fetch(
            f"""
            SELECT
                da.id::text AS assessment_id,
                da.well_id::text,
                da.latitude,
                da.longitude,
                da.damage_level,
                da.asset_type,
                da.repair_priority,
                da.field_name
            FROM damage_assessments da
            {where_clause}
            ORDER BY da.repair_priority DESC
            LIMIT ${param_idx}
            """,
            *params,
            limit,
        )

        elapsed_ms = (time.time() - start) * 1000
        features = []
        for row in rows:
            lvl = row["damage_level"] or "INTACT"
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(row["longitude"]), float(row["latitude"])],
                },
                "properties": {
                    "assessment_id": row["assessment_id"],
                    "well_id": row["well_id"],
                    "damage_level": lvl,
                    "asset_type": row["asset_type"],
                    "repair_priority": row["repair_priority"],
                    "field_name": row["field_name"],
                    "weight": DAMAGE_WEIGHTS.get(lvl, 1.0),
                    "color": DAMAGE_COLORS.get(lvl, "#6b7280"),
                },
            })

        return {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {"count": len(features), "execution_time_ms": round(elapsed_ms, 1), "engine": "postgis"},
        }

    except Exception as e:
        logger.warning(f"Damage heatmap query failed: {e}")
        return {"type": "FeatureCollection", "features": [], "metadata": {"count": 0, "error": str(e)}}


@router.get("/proximity")
async def get_wells_in_radius(
    lat: float = Query(...),
    lon: float = Query(...),
    radius_km: float = Query(default=50.0, le=500.0),
    limit: int = Query(default=20, le=100),
):
    """
    Find wells within a given radius using Haversine distance.
    """
    import time
    start = time.time()
    try:
        pool = await get_db_pool()
        rows = await pool.fetch(
            """
            SELECT
                w.id::text AS well_id,
                w.name AS well_name,
                w.status,
                COALESCE(w.latitude, 29.0) AS latitude,
                COALESCE(w.longitude, 47.0) AS longitude,
                (
                    6371 * acos(
                        LEAST(1.0, cos(radians($1)) * cos(radians(COALESCE(w.latitude, 29.0)))
                        * cos(radians(COALESCE(w.longitude, 47.0)) - radians($2))
                        + sin(radians($1)) * sin(radians(COALESCE(w.latitude, 29.0))))
                    )
                ) AS distance_km
            FROM wells w
            WHERE w.latitude IS NOT NULL AND w.longitude IS NOT NULL
            ORDER BY distance_km
            LIMIT $3
            """,
            lat, lon, limit * 5,
        )
        elapsed_ms = (time.time() - start) * 1000
        results = [
            {
                "well_id": row["well_id"],
                "well_name": row["well_name"] or f"Well-{row['well_id']}",
                "distance_km": round(float(row["distance_km"]), 2),
                "latitude": float(row["latitude"]),
                "longitude": float(row["longitude"]),
                "status": row["status"] or "unknown",
            }
            for row in rows
            if float(row["distance_km"]) <= radius_km
        ][:limit]
        return {"results": results, "count": len(results), "execution_time_ms": round(elapsed_ms, 1)}
    except Exception as e:
        logger.warning(f"Proximity query failed: {e}")
        return {"results": [], "count": 0, "error": str(e)}


@router.get("/spatial-cluster")
async def get_spatial_clusters(radius_km: float = Query(default=10.0)):
    """
    Cluster wells by geographic proximity using DBSCAN.
    Used for field-level aggregation on the map at low zoom levels.
    Spec: FRQ-014 — Apache Sedona spatial clustering.
    """
    pool = await get_db_pool()
    rows = await pool.fetch(
        """
        SELECT
            well_id::text, well_name, latitude, longitude, status, well_type
        FROM wells
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        LIMIT 500
        """
    )

    if not rows:
        return {"clusters": []}

    import math

    # Simple grid-based clustering (production uses Sedona DBSCAN)
    clusters: dict = {}
    grid_size = radius_km / 111.0  # Approx degrees per km

    for r in rows:
        lat = float(r["latitude"])
        lon = float(r["longitude"])
        grid_lat = round(lat / grid_size) * grid_size
        grid_lon = round(lon / grid_size) * grid_size
        key = (grid_lat, grid_lon)

        if key not in clusters:
            clusters[key] = {
                "center_lat": grid_lat,
                "center_lon": grid_lon,
                "wells": [],
                "active_count": 0,
                "alarm_count": 0,
            }
        clusters[key]["wells"].append(r["well_id"])
        if r["status"] == "ACTIVE":
            clusters[key]["active_count"] += 1

    return {
        "clusters": [
            {
                "center_lat": v["center_lat"],
                "center_lon": v["center_lon"],
                "well_count": len(v["wells"]),
                "active_count": v["active_count"],
                "well_ids": v["wells"][:10],  # Limit for response size
            }
            for v in clusters.values()
        ]
    }
