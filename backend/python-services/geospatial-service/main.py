from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Tuple
from datetime import datetime
from math import radians, cos, sin, asin, sqrt
import uuid

app = FastAPI(
    title="Geospatial Service",
    description="Geospatial analysis for agent network optimization and fraud detection",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class GeoLocation(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    altitude: Optional[float] = None
    accuracy: Optional[float] = None

class AgentLocation(BaseModel):
    agent_id: str
    location: GeoLocation
    address: Optional[str] = None
    timestamp: datetime

class TransactionLocation(BaseModel):
    transaction_id: str
    agent_id: str
    location: GeoLocation
    timestamp: datetime
    amount: float

class GeoFence(BaseModel):
    fence_id: str
    name: str
    center: GeoLocation
    radius_meters: float
    active: bool = True

class ProximityResult(BaseModel):
    agent_id: str
    distance_meters: float
    location: GeoLocation

# In-memory storage
agent_locations = {}
transaction_locations = []
geofences = {}

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "geospatial-service",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.post("/agents/{agent_id}/location")
async def update_agent_location(
    agent_id: str,
    location: AgentLocation
):
    """
    Update agent's current location
    """
    agent_locations[agent_id] = location.dict()
    
    # Check if agent is in any geofence
    violations = check_geofence_violations(agent_id, location.location)
    
    return {
        "status": "updated",
        "agent_id": agent_id,
        "location": location.location,
        "geofence_violations": violations
    }

@app.get("/agents/{agent_id}/location")
async def get_agent_location(agent_id: str):
    """
    Get agent's current location
    """
    if agent_id not in agent_locations:
        raise HTTPException(status_code=404, detail="Agent location not found")
    
    return agent_locations[agent_id]

@app.post("/agents/nearby")
async def find_nearby_agents(
    location: GeoLocation,
    radius_meters: float = 5000,
    limit: int = 10
):
    """
    Find agents within radius of a location
    """
    nearby_agents = []
    
    for agent_id, agent_data in agent_locations.items():
        agent_loc = GeoLocation(**agent_data["location"])
        distance = calculate_distance(location, agent_loc)
        
        if distance <= radius_meters:
            nearby_agents.append(ProximityResult(
                agent_id=agent_id,
                distance_meters=distance,
                location=agent_loc
            ))
    
    # Sort by distance
    nearby_agents.sort(key=lambda x: x.distance_meters)
    
    return nearby_agents[:limit]

@app.post("/transactions/location")
async def record_transaction_location(
    transaction: TransactionLocation
):
    """
    Record transaction location for fraud detection
    """
    transaction_locations.append(transaction.dict())
    
    # Check for suspicious patterns
    fraud_score = analyze_transaction_location(transaction)
    
    return {
        "status": "recorded",
        "transaction_id": transaction.transaction_id,
        "fraud_score": fraud_score
    }

@app.get("/transactions/{transaction_id}/location")
async def get_transaction_location(transaction_id: str):
    """
    Get transaction location
    """
    for txn in transaction_locations:
        if txn["transaction_id"] == transaction_id:
            return txn
    
    raise HTTPException(status_code=404, detail="Transaction location not found")

@app.post("/geofences")
async def create_geofence(geofence: GeoFence):
    """
    Create a geofence for monitoring
    """
    geofences[geofence.fence_id] = geofence.dict()
    return geofence

@app.get("/geofences/{fence_id}")
async def get_geofence(fence_id: str):
    """
    Get geofence details
    """
    if fence_id not in geofences:
        raise HTTPException(status_code=404, detail="Geofence not found")
    
    return geofences[fence_id]

@app.get("/geofences")
async def list_geofences():
    """
    List all geofences
    """
    return list(geofences.values())

@app.post("/geofences/{fence_id}/check")
async def check_location_in_geofence(
    fence_id: str,
    location: GeoLocation
):
    """
    Check if a location is within a geofence
    """
    if fence_id not in geofences:
        raise HTTPException(status_code=404, detail="Geofence not found")
    
    fence = geofences[fence_id]
    fence_center = GeoLocation(**fence["center"])
    
    distance = calculate_distance(location, fence_center)
    is_inside = distance <= fence["radius_meters"]
    
    return {
        "fence_id": fence_id,
        "is_inside": is_inside,
        "distance_from_center": distance,
        "radius": fence["radius_meters"]
    }

@app.get("/analytics/agent-density")
async def get_agent_density(
    sw_lat: float,
    sw_lng: float,
    ne_lat: float,
    ne_lng: float,
    grid_size: int = 10
):
    """
    Get agent density heatmap for a bounding box
    """
    # Create grid
    lat_step = (ne_lat - sw_lat) / grid_size
    lng_step = (ne_lng - sw_lng) / grid_size
    
    density_grid = []
    
    for i in range(grid_size):
        for j in range(grid_size):
            cell_lat = sw_lat + (i * lat_step)
            cell_lng = sw_lng + (j * lng_step)
            cell_center = GeoLocation(latitude=cell_lat, longitude=cell_lng)
            
            # Count agents in cell
            agent_count = 0
            for agent_data in agent_locations.values():
                agent_loc = GeoLocation(**agent_data["location"])
                if is_in_cell(agent_loc, cell_lat, cell_lng, lat_step, lng_step):
                    agent_count += 1
            
            density_grid.append({
                "lat": cell_lat,
                "lng": cell_lng,
                "count": agent_count
            })
    
    return {
        "grid_size": grid_size,
        "density": density_grid
    }

@app.get("/analytics/transaction-heatmap")
async def get_transaction_heatmap(
    hours: int = 24
):
    """
    Get transaction heatmap for recent transactions
    """
    cutoff_time = datetime.utcnow().timestamp() - (hours * 3600)
    
    recent_transactions = [
        txn for txn in transaction_locations
        if datetime.fromisoformat(txn["timestamp"]).timestamp() > cutoff_time
    ]
    
    heatmap_data = []
    for txn in recent_transactions:
        heatmap_data.append({
            "lat": txn["location"]["latitude"],
            "lng": txn["location"]["longitude"],
            "amount": txn["amount"],
            "timestamp": txn["timestamp"]
        })
    
    return {
        "hours": hours,
        "transaction_count": len(heatmap_data),
        "heatmap": heatmap_data
    }

def calculate_distance(loc1: GeoLocation, loc2: GeoLocation) -> float:
    """
    Calculate distance between two locations using Haversine formula
    Returns distance in meters
    """
    # Convert to radians
    lat1, lon1 = radians(loc1.latitude), radians(loc1.longitude)
    lat2, lon2 = radians(loc2.latitude), radians(loc2.longitude)
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    
    # Earth radius in meters
    r = 6371000
    
    return c * r

def check_geofence_violations(agent_id: str, location: GeoLocation) -> List[str]:
    """
    Check if agent location violates any geofences
    """
    violations = []
    
    for fence_id, fence in geofences.items():
        if not fence["active"]:
            continue
        
        fence_center = GeoLocation(**fence["center"])
        distance = calculate_distance(location, fence_center)
        
        # Check if outside allowed geofence
        if distance > fence["radius_meters"]:
            violations.append(fence_id)
    
    return violations

def analyze_transaction_location(transaction: TransactionLocation) -> float:
    """
    Analyze transaction location for fraud detection
    Returns fraud score (0-1)
    """
    fraud_score = 0.0
    
    # Check if agent location matches transaction location
    if transaction.agent_id in agent_locations:
        agent_loc = GeoLocation(**agent_locations[transaction.agent_id]["location"])
        distance = calculate_distance(transaction.location, agent_loc)
        
        # Suspicious if transaction is far from agent's registered location
        if distance > 10000:  # 10km
            fraud_score += 0.5
    
    # Check for velocity fraud (rapid location changes)
    agent_transactions = [
        t for t in transaction_locations
        if t["agent_id"] == transaction.agent_id
    ]
    
    if len(agent_transactions) > 0:
        last_txn = agent_transactions[-1]
        last_loc = GeoLocation(**last_txn["location"])
        time_diff = (transaction.timestamp - datetime.fromisoformat(last_txn["timestamp"])).total_seconds()
        distance = calculate_distance(transaction.location, last_loc)
        
        # Calculate velocity (m/s)
        if time_diff > 0:
            velocity = distance / time_diff
            # Suspicious if velocity > 50 m/s (180 km/h)
            if velocity > 50:
                fraud_score += 0.3
    
    return min(fraud_score, 1.0)

def is_in_cell(location: GeoLocation, cell_lat: float, cell_lng: float, lat_step: float, lng_step: float) -> bool:
    """
    Check if location is within a grid cell
    """
    return (cell_lat <= location.latitude < cell_lat + lat_step and
            cell_lng <= location.longitude < cell_lng + lng_step)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8011)
