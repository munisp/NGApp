#!/usr/bin/env python3
"""
Predictive Spending Alerts Service
Uses ML to analyze spending patterns and predict budget overruns
"""

import json
import sys
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import statistics

def analyze_spending_pattern(transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyze spending patterns from transaction history
    """
    if not transactions:
        return {
            "average_daily_spending": 0,
            "spending_trend": "stable",
            "high_spending_days": [],
            "spending_velocity": 0,
        }
    
    # Calculate daily spending
    daily_spending = {}
    for txn in transactions:
        date = datetime.fromtimestamp(txn["date"] / 1000).date()
        date_str = date.isoformat()
        
        if date_str not in daily_spending:
            daily_spending[date_str] = 0
        
        daily_spending[date_str] += txn["amount"]
    
    # Calculate statistics
    spending_values = list(daily_spending.values())
    avg_daily = statistics.mean(spending_values) if spending_values else 0
    
    # Determine trend (last 7 days vs previous 7 days)
    sorted_dates = sorted(daily_spending.keys(), reverse=True)
    recent_spending = [daily_spending[d] for d in sorted_dates[:7]]
    previous_spending = [daily_spending[d] for d in sorted_dates[7:14]] if len(sorted_dates) > 7 else []
    
    recent_avg = statistics.mean(recent_spending) if recent_spending else 0
    previous_avg = statistics.mean(previous_spending) if previous_spending else recent_avg
    
    if recent_avg > previous_avg * 1.2:
        trend = "increasing"
    elif recent_avg < previous_avg * 0.8:
        trend = "decreasing"
    else:
        trend = "stable"
    
    # Identify high spending days (above 1.5x average)
    high_spending_days = [
        {"date": date, "amount": amount}
        for date, amount in daily_spending.items()
        if amount > avg_daily * 1.5
    ]
    
    # Calculate spending velocity (rate of change)
    if len(spending_values) > 1:
        velocity = (spending_values[-1] - spending_values[0]) / len(spending_values)
    else:
        velocity = 0
    
    return {
        "average_daily_spending": round(avg_daily, 2),
        "spending_trend": trend,
        "high_spending_days": high_spending_days[-5:],  # Last 5 high spending days
        "spending_velocity": round(velocity, 2),
    }

def predict_budget_risk(
    current_spending: float,
    budget_limit: float,
    days_remaining: int,
    spending_pattern: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Predict likelihood of exceeding budget based on current patterns
    """
    if days_remaining <= 0:
        return {
            "risk_level": "none",
            "risk_score": 0,
            "predicted_total": current_spending,
            "predicted_overage": 0,
            "confidence": 100,
        }
    
    avg_daily = spending_pattern["average_daily_spending"]
    velocity = spending_pattern["spending_velocity"]
    trend = spending_pattern["spending_trend"]
    
    # Adjust prediction based on trend
    if trend == "increasing":
        adjusted_daily = avg_daily * 1.2
    elif trend == "decreasing":
        adjusted_daily = avg_daily * 0.8
    else:
        adjusted_daily = avg_daily
    
    # Factor in velocity
    adjusted_daily += velocity * 0.5
    
    # Predict total spending
    predicted_total = current_spending + (adjusted_daily * days_remaining)
    predicted_overage = max(0, predicted_total - budget_limit)
    
    # Calculate risk score (0-100)
    if budget_limit > 0:
        risk_score = min(100, (predicted_total / budget_limit) * 100)
    else:
        risk_score = 0
    
    # Determine risk level
    if risk_score < 70:
        risk_level = "low"
    elif risk_score < 90:
        risk_level = "medium"
    elif risk_score < 100:
        risk_level = "high"
    else:
        risk_level = "critical"
    
    # Calculate confidence based on data quality
    data_points = len(spending_pattern.get("high_spending_days", []))
    confidence = min(100, 50 + (data_points * 10))
    
    return {
        "risk_level": risk_level,
        "risk_score": round(risk_score, 1),
        "predicted_total": round(predicted_total, 2),
        "predicted_overage": round(predicted_overage, 2),
        "confidence": confidence,
        "recommended_daily_limit": round((budget_limit - current_spending) / days_remaining, 2) if days_remaining > 0 else 0,
    }

def generate_alert_message(
    category: str,
    risk_prediction: Dict[str, Any],
    budget_limit: float
) -> Dict[str, Any]:
    """
    Generate user-friendly alert message based on risk level
    """
    risk_level = risk_prediction["risk_level"]
    risk_score = risk_prediction["risk_score"]
    predicted_overage = risk_prediction["predicted_overage"]
    recommended_limit = risk_prediction["recommended_daily_limit"]
    
    if risk_level == "low":
        title = f"✅ {category} Budget On Track"
        message = f"You're doing great! At your current pace, you'll stay within budget."
        urgency = "info"
    elif risk_level == "medium":
        title = f"⚠️ {category} Budget Alert"
        message = f"You're at {risk_score:.0f}% of your budget. Consider reducing daily spending to ${recommended_limit:.2f}."
        urgency = "warning"
    elif risk_level == "high":
        title = f"🚨 {category} Budget Warning"
        message = f"You're likely to exceed your budget by ${predicted_overage:.2f}. Immediate action recommended."
        urgency = "high"
    else:  # critical
        title = f"🔴 {category} Budget Critical"
        message = f"You're on track to exceed your budget by ${predicted_overage:.2f}. Stop non-essential spending now."
        urgency = "critical"
    
    return {
        "title": title,
        "message": message,
        "urgency": urgency,
        "risk_level": risk_level,
        "risk_score": risk_score,
        "recommended_action": f"Limit daily spending to ${recommended_limit:.2f}",
    }

def analyze_category_spending(
    transactions: List[Dict[str, Any]],
    category: str,
    budget_limit: float,
    period_start: int,
    period_end: int
) -> Dict[str, Any]:
    """
    Analyze spending for a specific category and predict budget risk
    """
    # Filter transactions for category and period
    category_transactions = [
        txn for txn in transactions
        if txn.get("category") == category
        and period_start <= txn["date"] <= period_end
    ]
    
    # Calculate current spending
    current_spending = sum(txn["amount"] for txn in category_transactions)
    
    # Calculate days remaining in period
    now = datetime.now().timestamp() * 1000
    days_remaining = max(0, (period_end - now) / (24 * 60 * 60 * 1000))
    
    # Analyze spending pattern
    spending_pattern = analyze_spending_pattern(category_transactions)
    
    # Predict budget risk
    risk_prediction = predict_budget_risk(
        current_spending,
        budget_limit,
        int(days_remaining),
        spending_pattern
    )
    
    # Generate alert message
    alert = generate_alert_message(category, risk_prediction, budget_limit)
    
    return {
        "category": category,
        "current_spending": round(current_spending, 2),
        "budget_limit": budget_limit,
        "budget_used_percentage": round((current_spending / budget_limit * 100) if budget_limit > 0 else 0, 1),
        "days_remaining": int(days_remaining),
        "spending_pattern": spending_pattern,
        "risk_prediction": risk_prediction,
        "alert": alert,
    }

def get_all_predictive_alerts(
    transactions: List[Dict[str, Any]],
    budgets: List[Dict[str, Any]],
    period_start: int,
    period_end: int
) -> List[Dict[str, Any]]:
    """
    Generate predictive alerts for all budget categories
    """
    alerts = []
    
    for budget in budgets:
        category = budget["category"]
        limit = budget["limit"]
        
        analysis = analyze_category_spending(
            transactions,
            category,
            limit,
            period_start,
            period_end
        )
        
        # Only include alerts for medium risk and above
        if analysis["risk_prediction"]["risk_level"] in ["medium", "high", "critical"]:
            alerts.append(analysis)
    
    # Sort by risk score descending
    alerts.sort(key=lambda x: x["risk_prediction"]["risk_score"], reverse=True)
    
    return alerts

def main():
    """Main entry point for the predictive alerts service"""
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        action = input_data.get("action")
        
        if action == "analyze_category":
            result = analyze_category_spending(
                input_data["transactions"],
                input_data["category"],
                input_data["budget_limit"],
                input_data["period_start"],
                input_data["period_end"]
            )
        elif action == "get_all_alerts":
            result = get_all_predictive_alerts(
                input_data["transactions"],
                input_data["budgets"],
                input_data["period_start"],
                input_data["period_end"]
            )
        elif action == "analyze_pattern":
            result = analyze_spending_pattern(input_data["transactions"])
        else:
            result = {"error": f"Unknown action: {action}"}
        
        # Write result to stdout
        print(json.dumps(result))
        sys.exit(0)
        
    except Exception as e:
        error_result = {"error": str(e)}
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    main()
