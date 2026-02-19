"""
Enhanced Agent Performance Analytics Service
Provides comprehensive agent performance tracking, leaderboards, and analytics
"""

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from enum import Enum
import uvicorn
import os
import asyncpg
import redis.asyncio as redis
from contextlib import asynccontextmanager

# Database connection pool
db_pool = None
redis_client = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan"""
    global db_pool, redis_client
    
    # Startup
    db_pool = await asyncpg.create_pool(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", 5432)),
        database=os.getenv("DB_NAME", "agent_banking"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
        min_size=10,
        max_size=50
    )
    
    redis_client = await redis.from_url(
        os.getenv("REDIS_URL", "redis://localhost:6379"),
        encoding="utf-8",
        decode_responses=True
    )
    
    yield
    
    # Shutdown
    await db_pool.close()
    await redis_client.close()

app = FastAPI(
    title="Agent Performance Analytics",
    description="Comprehensive agent performance tracking, leaderboards, and analytics",
    version="2.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Service state
service_start_time = datetime.now()

# ============================================================================
# Models
# ============================================================================

class TimeRange(str, Enum):
    """Time range for analytics"""
    TODAY = "today"
    WEEK = "week"
    MONTH = "month"
    QUARTER = "quarter"
    YEAR = "year"
    ALL_TIME = "all_time"

class MetricType(str, Enum):
    """Performance metric types"""
    TRANSACTION_VOLUME = "transaction_volume"
    TRANSACTION_COUNT = "transaction_count"
    COMMISSION_EARNED = "commission_earned"
    CUSTOMER_COUNT = "customer_count"
    CUSTOMER_SATISFACTION = "customer_satisfaction"
    UPTIME = "uptime"
    FLOAT_UTILIZATION = "float_utilization"

class AgentPerformanceMetrics(BaseModel):
    """Agent performance metrics"""
    agent_id: str
    agent_name: str
    transaction_count: int = 0
    transaction_volume: float = 0.0
    commission_earned: float = 0.0
    customer_count: int = 0
    customer_satisfaction: float = 0.0
    uptime_percentage: float = 0.0
    float_utilization: float = 0.0
    rank: Optional[int] = None
    tier: Optional[str] = None
    period: str
    last_updated: datetime

class LeaderboardEntry(BaseModel):
    """Leaderboard entry"""
    rank: int
    agent_id: str
    agent_name: str
    agent_code: str
    region: Optional[str] = None
    score: float
    metric_type: str
    value: float
    change_from_previous: Optional[float] = None
    badge: Optional[str] = None

class LeaderboardResponse(BaseModel):
    """Leaderboard response"""
    metric_type: str
    time_range: str
    total_agents: int
    leaderboard: List[LeaderboardEntry]
    generated_at: datetime

class PerformanceTrend(BaseModel):
    """Performance trend data point"""
    date: str
    value: float
    metric_type: str

class PerformanceTrendsResponse(BaseModel):
    """Performance trends response"""
    agent_id: str
    agent_name: str
    time_range: str
    trends: Dict[str, List[PerformanceTrend]]

class AgentFeedback(BaseModel):
    """Agent feedback"""
    feedback_id: Optional[str] = None
    agent_id: str
    customer_id: str
    transaction_id: str
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None
    category: Optional[str] = None
    created_at: Optional[datetime] = None

class AgentReward(BaseModel):
    """Agent reward"""
    reward_id: Optional[str] = None
    agent_id: str
    reward_type: str
    reward_name: str
    reward_value: float
    criteria_met: str
    awarded_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

class ComparativeAnalysis(BaseModel):
    """Comparative analysis"""
    agent_id: str
    agent_name: str
    metrics: Dict[str, float]
    percentile_rank: Dict[str, float]
    comparison_to_avg: Dict[str, float]
    comparison_to_top: Dict[str, float]

class PerformanceReport(BaseModel):
    """Comprehensive performance report"""
    agent_id: str
    agent_name: str
    time_range: str
    metrics: AgentPerformanceMetrics
    trends: Dict[str, List[PerformanceTrend]]
    leaderboard_positions: Dict[str, int]
    feedback_summary: Dict[str, Any]
    rewards_earned: List[AgentReward]
    comparative_analysis: ComparativeAnalysis
    generated_at: datetime

# ============================================================================
# Database Functions
# ============================================================================

async def get_agent_metrics(
    agent_id: str,
    time_range: TimeRange
) -> AgentPerformanceMetrics:
    """Get agent performance metrics from database"""
    
    # Calculate date range
    end_date = datetime.now()
    if time_range == TimeRange.TODAY:
        start_date = end_date.replace(hour=0, minute=0, second=0, microsecond=0)
    elif time_range == TimeRange.WEEK:
        start_date = end_date - timedelta(days=7)
    elif time_range == TimeRange.MONTH:
        start_date = end_date - timedelta(days=30)
    elif time_range == TimeRange.QUARTER:
        start_date = end_date - timedelta(days=90)
    elif time_range == TimeRange.YEAR:
        start_date = end_date - timedelta(days=365)
    else:  # ALL_TIME
        start_date = datetime(2020, 1, 1)
    
    async with db_pool.acquire() as conn:
        # Get agent info
        agent = await conn.fetchrow(
            "SELECT name FROM agents WHERE id = $1",
            agent_id
        )
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Get transaction metrics
        txn_metrics = await conn.fetchrow("""
            SELECT 
                COUNT(*) as transaction_count,
                COALESCE(SUM(amount), 0) as transaction_volume
            FROM transactions
            WHERE agent_id = $1 
            AND created_at >= $2 
            AND created_at <= $3
            AND status = 'completed'
        """, agent_id, start_date, end_date)
        
        # Get commission earned
        commission = await conn.fetchval("""
            SELECT COALESCE(SUM(amount), 0)
            FROM commissions
            WHERE agent_id = $1
            AND created_at >= $2
            AND created_at <= $3
        """, agent_id, start_date, end_date)
        
        # Get unique customer count
        customer_count = await conn.fetchval("""
            SELECT COUNT(DISTINCT customer_id)
            FROM transactions
            WHERE agent_id = $1
            AND created_at >= $2
            AND created_at <= $3
        """, agent_id, start_date, end_date)
        
        # Get customer satisfaction (average rating)
        satisfaction = await conn.fetchval("""
            SELECT COALESCE(AVG(rating), 0)
            FROM agent_feedback
            WHERE agent_id = $1
            AND created_at >= $2
            AND created_at <= $3
        """, agent_id, start_date, end_date)
        
        # Calculate uptime percentage (simplified)
        uptime_percentage = 95.0  # TODO: Calculate from agent activity logs
        
        # Calculate float utilization
        float_utilization = 75.0  # TODO: Calculate from float management data
        
        return AgentPerformanceMetrics(
            agent_id=agent_id,
            agent_name=agent["name"],
            transaction_count=txn_metrics["transaction_count"] or 0,
            transaction_volume=float(txn_metrics["transaction_volume"] or 0),
            commission_earned=float(commission or 0),
            customer_count=customer_count or 0,
            customer_satisfaction=float(satisfaction or 0),
            uptime_percentage=uptime_percentage,
            float_utilization=float_utilization,
            period=time_range.value,
            last_updated=datetime.now()
        )

async def get_leaderboard(
    metric_type: MetricType,
    time_range: TimeRange,
    limit: int = 100,
    region: Optional[str] = None
) -> LeaderboardResponse:
    """Get leaderboard for specific metric"""
    
    # Check cache first
    cache_key = f"leaderboard:{metric_type.value}:{time_range.value}:{region or 'all'}"
    cached = await redis_client.get(cache_key)
    
    if cached:
        import json
        return LeaderboardResponse(**json.loads(cached))
    
    # Calculate date range
    end_date = datetime.now()
    if time_range == TimeRange.TODAY:
        start_date = end_date.replace(hour=0, minute=0, second=0, microsecond=0)
    elif time_range == TimeRange.WEEK:
        start_date = end_date - timedelta(days=7)
    elif time_range == TimeRange.MONTH:
        start_date = end_date - timedelta(days=30)
    elif time_range == TimeRange.QUARTER:
        start_date = end_date - timedelta(days=90)
    elif time_range == TimeRange.YEAR:
        start_date = end_date - timedelta(days=365)
    else:
        start_date = datetime(2020, 1, 1)
    
    # Build query based on metric type
    if metric_type == MetricType.TRANSACTION_VOLUME:
        query = """
            SELECT 
                a.id as agent_id,
                a.name as agent_name,
                a.code as agent_code,
                a.region,
                COALESCE(SUM(t.amount), 0) as value
            FROM agents a
            LEFT JOIN transactions t ON a.id = t.agent_id 
                AND t.created_at >= $1 
                AND t.created_at <= $2
                AND t.status = 'completed'
            WHERE 1=1
        """
    elif metric_type == MetricType.TRANSACTION_COUNT:
        query = """
            SELECT 
                a.id as agent_id,
                a.name as agent_name,
                a.code as agent_code,
                a.region,
                COUNT(t.id) as value
            FROM agents a
            LEFT JOIN transactions t ON a.id = t.agent_id 
                AND t.created_at >= $1 
                AND t.created_at <= $2
                AND t.status = 'completed'
            WHERE 1=1
        """
    elif metric_type == MetricType.COMMISSION_EARNED:
        query = """
            SELECT 
                a.id as agent_id,
                a.name as agent_name,
                a.code as agent_code,
                a.region,
                COALESCE(SUM(c.amount), 0) as value
            FROM agents a
            LEFT JOIN commissions c ON a.id = c.agent_id 
                AND c.created_at >= $1 
                AND c.created_at <= $2
            WHERE 1=1
        """
    else:
        query = """
            SELECT 
                a.id as agent_id,
                a.name as agent_name,
                a.code as agent_code,
                a.region,
                0 as value
            FROM agents a
            WHERE 1=1
        """
    
    if region:
        query += " AND a.region = $3"
        params = [start_date, end_date, region]
    else:
        params = [start_date, end_date]
    
    query += """
        GROUP BY a.id, a.name, a.code, a.region
        ORDER BY value DESC
        LIMIT $""" + str(len(params) + 1)
    params.append(limit)
    
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(query, *params)
        
        leaderboard = []
        for rank, row in enumerate(rows, 1):
            # Assign badges
            badge = None
            if rank == 1:
                badge = "🥇 Champion"
            elif rank == 2:
                badge = "🥈 Runner-up"
            elif rank == 3:
                badge = "🥉 Third Place"
            elif rank <= 10:
                badge = "⭐ Top 10"
            
            leaderboard.append(LeaderboardEntry(
                rank=rank,
                agent_id=row["agent_id"],
                agent_name=row["agent_name"],
                agent_code=row["agent_code"],
                region=row["region"],
                score=float(row["value"]),
                metric_type=metric_type.value,
                value=float(row["value"]),
                badge=badge
            ))
        
        response = LeaderboardResponse(
            metric_type=metric_type.value,
            time_range=time_range.value,
            total_agents=len(leaderboard),
            leaderboard=leaderboard,
            generated_at=datetime.now()
        )
        
        # Cache for 5 minutes
        import json
        await redis_client.setex(
            cache_key,
            300,
            json.dumps(response.dict(), default=str)
        )
        
        return response

# ============================================================================
# API Endpoints
# ============================================================================

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "agent-performance",
        "version": "2.0.0",
        "description": "Enhanced agent performance analytics with leaderboards and trends",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    uptime = (datetime.now() - service_start_time).total_seconds()
    
    # Check database connection
    db_healthy = False
    try:
        async with db_pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
            db_healthy = True
    except:
        pass
    
    # Check Redis connection
    redis_healthy = False
    try:
        await redis_client.ping()
        redis_healthy = True
    except:
        pass
    
    return {
        "status": "healthy" if (db_healthy and redis_healthy) else "degraded",
        "service": "agent-performance",
        "timestamp": datetime.now(),
        "uptime_seconds": int(uptime),
        "database": "healthy" if db_healthy else "unhealthy",
        "cache": "healthy" if redis_healthy else "unhealthy"
    }

@app.get("/api/v1/agents/{agent_id}/performance", response_model=AgentPerformanceMetrics)
async def get_agent_performance(
    agent_id: str,
    time_range: TimeRange = Query(TimeRange.MONTH)
):
    """Get agent performance metrics"""
    return await get_agent_metrics(agent_id, time_range)

@app.get("/api/v1/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard_endpoint(
    metric_type: MetricType = Query(MetricType.TRANSACTION_VOLUME),
    time_range: TimeRange = Query(TimeRange.MONTH),
    limit: int = Query(100, ge=1, le=1000),
    region: Optional[str] = Query(None)
):
    """Get leaderboard for specific metric"""
    return await get_leaderboard(metric_type, time_range, limit, region)

@app.get("/api/v1/agents/{agent_id}/trends", response_model=PerformanceTrendsResponse)
async def get_performance_trends(
    agent_id: str,
    time_range: TimeRange = Query(TimeRange.MONTH)
):
    """Get performance trends for agent"""
    
    # Calculate date range
    end_date = datetime.now()
    if time_range == TimeRange.WEEK:
        start_date = end_date - timedelta(days=7)
        interval = "1 day"
    elif time_range == TimeRange.MONTH:
        start_date = end_date - timedelta(days=30)
        interval = "1 day"
    elif time_range == TimeRange.QUARTER:
        start_date = end_date - timedelta(days=90)
        interval = "1 week"
    elif time_range == TimeRange.YEAR:
        start_date = end_date - timedelta(days=365)
        interval = "1 month"
    else:
        start_date = end_date - timedelta(days=30)
        interval = "1 day"
    
    async with db_pool.acquire() as conn:
        # Get agent name
        agent = await conn.fetchrow(
            "SELECT name FROM agents WHERE id = $1",
            agent_id
        )
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Get transaction volume trend
        volume_trend = await conn.fetch("""
            SELECT 
                DATE(created_at) as date,
                COALESCE(SUM(amount), 0) as value
            FROM transactions
            WHERE agent_id = $1
            AND created_at >= $2
            AND created_at <= $3
            AND status = 'completed'
            GROUP BY DATE(created_at)
            ORDER BY date
        """, agent_id, start_date, end_date)
        
        # Get transaction count trend
        count_trend = await conn.fetch("""
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as value
            FROM transactions
            WHERE agent_id = $1
            AND created_at >= $2
            AND created_at <= $3
            AND status = 'completed'
            GROUP BY DATE(created_at)
            ORDER BY date
        """, agent_id, start_date, end_date)
        
        # Get commission trend
        commission_trend = await conn.fetch("""
            SELECT 
                DATE(created_at) as date,
                COALESCE(SUM(amount), 0) as value
            FROM commissions
            WHERE agent_id = $1
            AND created_at >= $2
            AND created_at <= $3
            GROUP BY DATE(created_at)
            ORDER BY date
        """, agent_id, start_date, end_date)
        
        return PerformanceTrendsResponse(
            agent_id=agent_id,
            agent_name=agent["name"],
            time_range=time_range.value,
            trends={
                "transaction_volume": [
                    PerformanceTrend(
                        date=row["date"].isoformat(),
                        value=float(row["value"]),
                        metric_type="transaction_volume"
                    ) for row in volume_trend
                ],
                "transaction_count": [
                    PerformanceTrend(
                        date=row["date"].isoformat(),
                        value=float(row["value"]),
                        metric_type="transaction_count"
                    ) for row in count_trend
                ],
                "commission_earned": [
                    PerformanceTrend(
                        date=row["date"].isoformat(),
                        value=float(row["value"]),
                        metric_type="commission_earned"
                    ) for row in commission_trend
                ]
            }
        )

@app.post("/api/v1/agents/{agent_id}/feedback", response_model=AgentFeedback)
async def submit_agent_feedback(
    agent_id: str,
    feedback: AgentFeedback
):
    """Submit feedback for agent"""
    
    async with db_pool.acquire() as conn:
        # Insert feedback
        row = await conn.fetchrow("""
            INSERT INTO agent_feedback (
                agent_id, customer_id, transaction_id, rating, comment, category, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, created_at
        """, agent_id, feedback.customer_id, feedback.transaction_id,
            feedback.rating, feedback.comment, feedback.category, datetime.now())
        
        feedback.feedback_id = row["id"]
        feedback.created_at = row["created_at"]
        feedback.agent_id = agent_id
        
        return feedback

@app.get("/api/v1/agents/{agent_id}/feedback")
async def get_agent_feedback(
    agent_id: str,
    limit: int = Query(100, ge=1, le=1000)
):
    """Get feedback for agent"""
    
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT 
                id as feedback_id,
                agent_id,
                customer_id,
                transaction_id,
                rating,
                comment,
                category,
                created_at
            FROM agent_feedback
            WHERE agent_id = $1
            ORDER BY created_at DESC
            LIMIT $2
        """, agent_id, limit)
        
        return [dict(row) for row in rows]

@app.post("/api/v1/agents/{agent_id}/rewards", response_model=AgentReward)
async def award_agent_reward(
    agent_id: str,
    reward: AgentReward
):
    """Award reward to agent"""
    
    async with db_pool.acquire() as conn:
        # Insert reward
        row = await conn.fetchrow("""
            INSERT INTO agent_rewards (
                agent_id, reward_type, reward_name, reward_value, 
                criteria_met, awarded_at, expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, awarded_at
        """, agent_id, reward.reward_type, reward.reward_name, reward.reward_value,
            reward.criteria_met, datetime.now(), reward.expires_at)
        
        reward.reward_id = row["id"]
        reward.awarded_at = row["awarded_at"]
        reward.agent_id = agent_id
        
        return reward

@app.get("/api/v1/agents/{agent_id}/rewards")
async def get_agent_rewards(
    agent_id: str,
    active_only: bool = Query(False)
):
    """Get rewards for agent"""
    
    query = """
        SELECT 
            id as reward_id,
            agent_id,
            reward_type,
            reward_name,
            reward_value,
            criteria_met,
            awarded_at,
            expires_at
        FROM agent_rewards
        WHERE agent_id = $1
    """
    
    if active_only:
        query += " AND (expires_at IS NULL OR expires_at > NOW())"
    
    query += " ORDER BY awarded_at DESC"
    
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(query, agent_id)
        return [dict(row) for row in rows]

@app.get("/api/v1/agents/{agent_id}/report", response_model=PerformanceReport)
async def get_performance_report(
    agent_id: str,
    time_range: TimeRange = Query(TimeRange.MONTH)
):
    """Get comprehensive performance report for agent"""
    
    # Get metrics
    metrics = await get_agent_metrics(agent_id, time_range)
    
    # Get trends
    trends_response = await get_performance_trends(agent_id, time_range)
    
    # Get leaderboard positions
    leaderboard_positions = {}
    for metric_type in [MetricType.TRANSACTION_VOLUME, MetricType.TRANSACTION_COUNT, MetricType.COMMISSION_EARNED]:
        lb = await get_leaderboard(metric_type, time_range, 1000)
        for entry in lb.leaderboard:
            if entry.agent_id == agent_id:
                leaderboard_positions[metric_type.value] = entry.rank
                break
    
    # Get feedback summary
    async with db_pool.acquire() as conn:
        feedback_summary = await conn.fetchrow("""
            SELECT 
                COUNT(*) as total_feedback,
                AVG(rating) as avg_rating,
                COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive_feedback,
                COUNT(CASE WHEN rating <= 2 THEN 1 END) as negative_feedback
            FROM agent_feedback
            WHERE agent_id = $1
        """, agent_id)
    
    # Get rewards
    rewards_data = await get_agent_rewards(agent_id, active_only=False)
    rewards = [AgentReward(**r) for r in rewards_data[:10]]  # Last 10 rewards
    
    # Calculate comparative analysis
    async with db_pool.acquire() as conn:
        # Get platform averages
        avg_metrics = await conn.fetchrow("""
            SELECT 
                AVG(transaction_count) as avg_txn_count,
                AVG(transaction_volume) as avg_txn_volume,
                AVG(commission_earned) as avg_commission
            FROM (
                SELECT 
                    agent_id,
                    COUNT(*) as transaction_count,
                    SUM(amount) as transaction_volume,
                    0 as commission_earned
                FROM transactions
                WHERE status = 'completed'
                GROUP BY agent_id
            ) agent_stats
        """)
    
    comparative_analysis = ComparativeAnalysis(
        agent_id=agent_id,
        agent_name=metrics.agent_name,
        metrics={
            "transaction_count": metrics.transaction_count,
            "transaction_volume": metrics.transaction_volume,
            "commission_earned": metrics.commission_earned
        },
        percentile_rank={
            "transaction_count": 75.0,  # TODO: Calculate actual percentile
            "transaction_volume": 80.0,
            "commission_earned": 70.0
        },
        comparison_to_avg={
            "transaction_count": (metrics.transaction_count / (avg_metrics["avg_txn_count"] or 1) - 1) * 100,
            "transaction_volume": (metrics.transaction_volume / (avg_metrics["avg_txn_volume"] or 1) - 1) * 100,
            "commission_earned": (metrics.commission_earned / (avg_metrics["avg_commission"] or 1) - 1) * 100 if avg_metrics["avg_commission"] else 0
        },
        comparison_to_top={
            "transaction_count": -20.0,  # TODO: Calculate actual comparison
            "transaction_volume": -15.0,
            "commission_earned": -25.0
        }
    )
    
    return PerformanceReport(
        agent_id=agent_id,
        agent_name=metrics.agent_name,
        time_range=time_range.value,
        metrics=metrics,
        trends=trends_response.trends,
        leaderboard_positions=leaderboard_positions,
        feedback_summary=dict(feedback_summary) if feedback_summary else {},
        rewards_earned=rewards,
        comparative_analysis=comparative_analysis,
        generated_at=datetime.now()
    )

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8050))
    uvicorn.run(app, host="0.0.0.0", port=port)

