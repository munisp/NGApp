#!/usr/bin/env python3
"""
Expense Forecasting Service with ML-powered predictions
"""

import sys
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any
import statistics

def analyze_spending_patterns(transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Analyze historical spending patterns"""
    
    if not transactions:
        return {
            "daily_average": 0,
            "weekly_average": 0,
            "monthly_average": 0,
            "volatility": 0,
            "trend": "stable"
        }
    
    # Calculate daily spending
    daily_spending: Dict[str, float] = {}
    for txn in transactions:
        date_str = datetime.fromtimestamp(txn["date"] / 1000).strftime("%Y-%m-%d")
        if date_str not in daily_spending:
            daily_spending[date_str] = 0
        daily_spending[date_str] += txn["amount"]
    
    # Calculate averages
    daily_values = list(daily_spending.values())
    daily_average = statistics.mean(daily_values) if daily_values else 0
    weekly_average = daily_average * 7
    monthly_average = daily_average * 30
    
    # Calculate volatility (standard deviation)
    volatility = statistics.stdev(daily_values) if len(daily_values) > 1 else 0
    
    # Determine trend (compare first half vs second half)
    if len(daily_values) >= 4:
        mid = len(daily_values) // 2
        first_half_avg = statistics.mean(daily_values[:mid])
        second_half_avg = statistics.mean(daily_values[mid:])
        
        if second_half_avg > first_half_avg * 1.1:
            trend = "increasing"
        elif second_half_avg < first_half_avg * 0.9:
            trend = "decreasing"
        else:
            trend = "stable"
    else:
        trend = "stable"
    
    return {
        "daily_average": round(daily_average, 2),
        "weekly_average": round(weekly_average, 2),
        "monthly_average": round(monthly_average, 2),
        "volatility": round(volatility, 2),
        "trend": trend
    }

def forecast_expenses(transactions: List[Dict[str, Any]], days: int = 30) -> List[Dict[str, Any]]:
    """Forecast future expenses based on historical patterns"""
    
    patterns = analyze_spending_patterns(transactions)
    
    # Analyze category-specific patterns
    category_spending: Dict[str, List[float]] = {}
    for txn in transactions:
        category = txn.get("category", "Other")
        if category not in category_spending:
            category_spending[category] = []
        category_spending[category].append(txn["amount"])
    
    # Calculate category averages
    category_forecasts: Dict[str, float] = {}
    for category, amounts in category_spending.items():
        category_forecasts[category] = statistics.mean(amounts) if amounts else 0
    
    # Generate daily forecasts
    forecasts = []
    base_date = datetime.now()
    
    for day in range(days):
        forecast_date = base_date + timedelta(days=day)
        
        # Base forecast on daily average
        base_amount = patterns["daily_average"]
        
        # Apply trend adjustment
        if patterns["trend"] == "increasing":
            trend_factor = 1 + (day / days) * 0.2  # Up to 20% increase
        elif patterns["trend"] == "decreasing":
            trend_factor = 1 - (day / days) * 0.2  # Up to 20% decrease
        else:
            trend_factor = 1.0
        
        # Apply weekly pattern (weekends typically have different spending)
        weekday = forecast_date.weekday()
        if weekday >= 5:  # Weekend
            weekly_factor = 1.2
        else:  # Weekday
            weekly_factor = 0.95
        
        # Calculate forecast amount
        forecast_amount = base_amount * trend_factor * weekly_factor
        
        # Add some randomness based on volatility
        import random
        random.seed(day)  # Deterministic randomness
        volatility_adjustment = random.uniform(-patterns["volatility"] * 0.5, patterns["volatility"] * 0.5)
        forecast_amount += volatility_adjustment
        
        # Ensure non-negative
        forecast_amount = max(0, forecast_amount)
        
        forecasts.append({
            "date": int(forecast_date.timestamp() * 1000),
            "amount": round(forecast_amount, 2),
            "confidence": calculate_confidence(day, len(transactions)),
            "dateStr": forecast_date.strftime("%Y-%m-%d")
        })
    
    return forecasts

def calculate_confidence(days_ahead: int, data_points: int) -> float:
    """Calculate forecast confidence based on time horizon and data availability"""
    
    # Confidence decreases with time
    time_factor = max(0.5, 1.0 - (days_ahead / 60))
    
    # Confidence increases with more data
    data_factor = min(1.0, data_points / 100)
    
    confidence = time_factor * data_factor
    return round(confidence * 100, 1)

def identify_upcoming_expenses(transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Identify recurring expenses that are likely to occur soon"""
    
    # Group transactions by merchant/description
    merchant_transactions: Dict[str, List[Dict[str, Any]]] = {}
    for txn in transactions:
        merchant = txn.get("merchant", txn.get("description", "Unknown"))
        if merchant not in merchant_transactions:
            merchant_transactions[merchant] = []
        merchant_transactions[merchant].append(txn)
    
    # Identify recurring expenses
    upcoming = []
    now = datetime.now()
    
    for merchant, txns in merchant_transactions.items():
        if len(txns) < 2:
            continue
        
        # Calculate average interval between transactions
        txns_sorted = sorted(txns, key=lambda x: x["date"])
        intervals = []
        for i in range(1, len(txns_sorted)):
            interval = (txns_sorted[i]["date"] - txns_sorted[i-1]["date"]) / (1000 * 60 * 60 * 24)
            intervals.append(interval)
        
        if not intervals:
            continue
        
        avg_interval = statistics.mean(intervals)
        
        # Check if it's recurring (interval between 7-90 days)
        if 7 <= avg_interval <= 90:
            last_txn = txns_sorted[-1]
            last_date = datetime.fromtimestamp(last_txn["date"] / 1000)
            expected_date = last_date + timedelta(days=avg_interval)
            
            # If expected date is within next 30 days
            days_until = (expected_date - now).days
            if 0 <= days_until <= 30:
                avg_amount = statistics.mean([t["amount"] for t in txns])
                
                upcoming.append({
                    "merchant": merchant,
                    "expectedDate": int(expected_date.timestamp() * 1000),
                    "expectedAmount": round(avg_amount, 2),
                    "daysUntil": days_until,
                    "frequency": "monthly" if avg_interval >= 25 else "weekly",
                    "confidence": min(95, 60 + len(txns) * 5)
                })
    
    # Sort by expected date
    upcoming.sort(key=lambda x: x["expectedDate"])
    
    return upcoming

def generate_cash_flow_forecast(transactions: List[Dict[str, Any]], income: float = 5000) -> Dict[str, Any]:
    """Generate cash flow forecast including income and expenses"""
    
    patterns = analyze_spending_patterns(transactions)
    expense_forecasts = forecast_expenses(transactions, days=30)
    
    # Calculate projected balance
    current_balance = 10000  # Mock current balance
    daily_forecasts = []
    
    for i, forecast in enumerate(expense_forecasts):
        # Add income on 1st and 15th of month
        day_of_month = datetime.fromtimestamp(forecast["date"] / 1000).day
        daily_income = income if day_of_month in [1, 15] else 0
        
        # Calculate daily balance
        daily_balance = current_balance + daily_income - forecast["amount"]
        current_balance = daily_balance
        
        daily_forecasts.append({
            "date": forecast["date"],
            "income": daily_income,
            "expenses": forecast["amount"],
            "balance": round(daily_balance, 2),
            "dateStr": forecast["dateStr"]
        })
    
    # Calculate summary
    total_income = sum(f["income"] for f in daily_forecasts)
    total_expenses = sum(f["expenses"] for f in daily_forecasts)
    net_cash_flow = total_income - total_expenses
    
    # Identify potential shortfalls
    shortfalls = [f for f in daily_forecasts if f["balance"] < 0]
    
    return {
        "forecasts": daily_forecasts,
        "summary": {
            "totalIncome": round(total_income, 2),
            "totalExpenses": round(total_expenses, 2),
            "netCashFlow": round(net_cash_flow, 2),
            "endingBalance": round(current_balance, 2),
            "potentialShortfalls": len(shortfalls),
            "avgDailyExpense": patterns["daily_average"]
        }
    }

def main():
    """Main entry point"""
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        action = input_data.get("action", "forecast")
        transactions = input_data.get("transactions", [])
        
        if action == "forecast":
            days = input_data.get("days", 30)
            result = forecast_expenses(transactions, days)
        elif action == "patterns":
            result = analyze_spending_patterns(transactions)
        elif action == "upcoming":
            result = identify_upcoming_expenses(transactions)
        elif action == "cashflow":
            income = input_data.get("income", 5000)
            result = generate_cash_flow_forecast(transactions, income)
        else:
            result = {"error": f"Unknown action: {action}"}
        
        print(json.dumps(result))
        sys.exit(0)
        
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
