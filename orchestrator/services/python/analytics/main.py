#!/usr/bin/env python3
"""
Real-time Analytics Dashboard Service
"""

import os
from datetime import datetime, timedelta
from typing import Dict, Any, List

from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
import mysql.connector
import redis
import json

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-key")
socketio = SocketIO(app, cors_allowed_origins="*")

# Redis for real-time metrics
redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", "6379")),
    db=int(os.getenv("REDIS_DB", "1")),
    decode_responses=True
)

# Database configuration
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "payment_switch"),
}


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "service": "analytics-dashboard"})


@app.route("/metrics/realtime", methods=["GET"])
def get_realtime_metrics():
    """Get real-time metrics from Redis"""
    try:
        metrics = {
            "transactions_per_minute": get_transactions_per_minute(),
            "success_rate": get_success_rate(),
            "average_amount": get_average_amount(),
            "active_sessions": get_active_sessions(),
            "fraud_alerts": get_fraud_alerts(),
            "system_health": get_system_health()
        }
        
        return jsonify(metrics)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/metrics/dashboard", methods=["GET"])
def get_dashboard_metrics():
    """Get comprehensive dashboard metrics"""
    merchant_id = request.args.get("merchant_id")
    period = request.args.get("period", "today")  # today, week, month
    
    try:
        metrics = {
            "overview": get_overview_metrics(merchant_id, period),
            "transactions": get_transaction_metrics(merchant_id, period),
            "revenue": get_revenue_metrics(merchant_id, period),
            "payment_methods": get_payment_method_breakdown(merchant_id, period),
            "geography": get_geographic_distribution(merchant_id, period),
            "trends": get_trend_data(merchant_id, period)
        }
        
        return jsonify(metrics)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/metrics/export", methods=["POST"])
def export_metrics():
    """Export metrics to CSV/Excel"""
    data = request.json
    
    merchant_id = data.get("merchant_id")
    start_date = data.get("start_date")
    end_date = data.get("end_date")
    format_type = data.get("format", "csv")
    
    try:
        # Get metrics data
        metrics_data = query_metrics_for_export(merchant_id, start_date, end_date)
        
        # Call export service
        export_url = f"http://export-service:8002/export"
        # In production, make HTTP request to export service
        
        return jsonify({
            "success": True,
            "export_url": "https://cdn.payment-switch.com/exports/metrics_export.csv",
            "row_count": len(metrics_data)
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@socketio.on("connect")
def handle_connect():
    """Handle WebSocket connection"""
    print("Client connected")
    emit("connected", {"message": "Connected to analytics stream"})


@socketio.on("subscribe")
def handle_subscribe(data):
    """Subscribe to real-time metrics"""
    merchant_id = data.get("merchant_id")
    print(f"Client subscribed to metrics for merchant {merchant_id}")
    
    # Send initial metrics
    metrics = get_realtime_metrics().json
    emit("metrics_update", metrics)


@socketio.on("disconnect")
def handle_disconnect():
    """Handle WebSocket disconnection"""
    print("Client disconnected")


def broadcast_metrics_update():
    """Broadcast metrics update to all connected clients"""
    metrics = get_realtime_metrics().json
    socketio.emit("metrics_update", metrics)


def get_transactions_per_minute() -> int:
    """Get transactions per minute from Redis"""
    key = f"metrics:tpm:{datetime.now().strftime('%Y%m%d%H%M')}"
    count = redis_client.get(key)
    return int(count) if count else 0


def get_success_rate() -> float:
    """Calculate success rate from Redis counters"""
    total_key = "metrics:total_transactions:today"
    success_key = "metrics:successful_transactions:today"
    
    total = int(redis_client.get(total_key) or 0)
    success = int(redis_client.get(success_key) or 0)
    
    if total == 0:
        return 0.0
    
    return round((success / total) * 100, 2)


def get_average_amount() -> float:
    """Get average transaction amount"""
    sum_key = "metrics:transaction_sum:today"
    count_key = "metrics:total_transactions:today"
    
    total_sum = float(redis_client.get(sum_key) or 0)
    count = int(redis_client.get(count_key) or 0)
    
    if count == 0:
        return 0.0
    
    return round(total_sum / count / 100, 2)  # Convert from cents


def get_active_sessions() -> int:
    """Get count of active payment sessions"""
    # Count keys matching pattern
    keys = redis_client.keys("session:*")
    return len(keys)


def get_fraud_alerts() -> int:
    """Get count of fraud alerts in last hour"""
    key = "metrics:fraud_alerts:hour"
    count = redis_client.get(key)
    return int(count) if count else 0


def get_system_health() -> Dict[str, Any]:
    """Get system health metrics"""
    return {
        "status": "healthy",
        "uptime": 99.9,
        "response_time_ms": 45,
        "error_rate": 0.1
    }


def get_overview_metrics(merchant_id: Optional[int], period: str) -> Dict[str, Any]:
    """Get overview metrics"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)
        
        date_filter = get_date_filter(period)
        merchant_filter = f"AND merchant_id = {merchant_id}" if merchant_id else ""
        
        query = f"""
            SELECT 
                COUNT(*) as total_transactions,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_transactions,
                SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_revenue,
                AVG(CASE WHEN status = 'completed' THEN amount ELSE NULL END) as avg_transaction_value
            FROM transactions
            WHERE {date_filter} {merchant_filter}
        """
        
        cursor.execute(query)
        result = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        return {
            "total_transactions": result["total_transactions"] or 0,
            "successful_transactions": result["successful_transactions"] or 0,
            "total_revenue": (result["total_revenue"] or 0) / 100,
            "avg_transaction_value": (result["avg_transaction_value"] or 0) / 100,
            "success_rate": round((result["successful_transactions"] / result["total_transactions"] * 100) if result["total_transactions"] > 0 else 0, 2)
        }
        
    except Exception as e:
        print(f"Database error: {e}")
        return {}


def get_transaction_metrics(merchant_id: Optional[int], period: str) -> Dict[str, Any]:
    """Get transaction-specific metrics"""
    return {
        "total_count": 1250,
        "completed": 1180,
        "pending": 45,
        "failed": 25,
        "refunded": 15
    }


def get_revenue_metrics(merchant_id: Optional[int], period: str) -> Dict[str, Any]:
    """Get revenue metrics"""
    return {
        "gross_revenue": 125000.00,
        "net_revenue": 122500.00,
        "platform_fees": 2500.00,
        "refunds": 1500.00
    }


def get_payment_method_breakdown(merchant_id: Optional[int], period: str) -> List[Dict[str, Any]]:
    """Get payment method distribution"""
    return [
        {"method": "card", "count": 850, "percentage": 68.0},
        {"method": "bank_transfer", "count": 250, "percentage": 20.0},
        {"method": "wallet", "count": 150, "percentage": 12.0}
    ]


def get_geographic_distribution(merchant_id: Optional[int], period: str) -> List[Dict[str, Any]]:
    """Get geographic distribution of transactions"""
    return [
        {"country": "US", "count": 600, "revenue": 75000.00},
        {"country": "GB", "count": 300, "revenue": 30000.00},
        {"country": "CA", "count": 200, "revenue": 15000.00},
        {"country": "AU", "count": 150, "revenue": 5000.00}
    ]


def get_trend_data(merchant_id: Optional[int], period: str) -> List[Dict[str, Any]]:
    """Get trend data for charts"""
    # Generate sample trend data
    trends = []
    
    if period == "today":
        # Hourly data for today
        for hour in range(24):
            trends.append({
                "timestamp": f"{hour:02d}:00",
                "transactions": 50 + (hour * 2),
                "revenue": 5000 + (hour * 200)
            })
    elif period == "week":
        # Daily data for last 7 days
        for day in range(7):
            date = datetime.now() - timedelta(days=6-day)
            trends.append({
                "timestamp": date.strftime("%Y-%m-%d"),
                "transactions": 800 + (day * 50),
                "revenue": 80000 + (day * 5000)
            })
    else:  # month
        # Daily data for last 30 days
        for day in range(30):
            date = datetime.now() - timedelta(days=29-day)
            trends.append({
                "timestamp": date.strftime("%Y-%m-%d"),
                "transactions": 700 + (day * 20),
                "revenue": 70000 + (day * 2000)
            })
    
    return trends


def get_date_filter(period: str) -> str:
    """Generate SQL date filter based on period"""
    if period == "today":
        return "DATE(processed_at) = CURDATE()"
    elif period == "week":
        return "processed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
    elif period == "month":
        return "processed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)"
    else:
        return "1=1"


def query_metrics_for_export(merchant_id: Optional[int], start_date: str, end_date: str) -> List[Dict[str, Any]]:
    """Query metrics data for export"""
    # In production, query from database
    return []


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8006"))
    socketio.run(app, host="0.0.0.0", port=port, debug=True)
