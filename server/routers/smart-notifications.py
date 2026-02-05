#!/usr/bin/env python3
"""
Smart Notification System with AI Learning
Learns user preferences and optimizes notification timing and relevance
"""

import sys
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import random

def calculate_notification_score(
    notification_type: str,
    user_context: Dict[str, Any],
    historical_interactions: List[Dict[str, Any]]
) -> float:
    """
    Calculate relevance score for a notification based on user behavior
    
    Args:
        notification_type: Type of notification (transaction, bill, goal, etc.)
        user_context: Current user context (time, balance, recent activity)
        historical_interactions: Past notification interactions
        
    Returns:
        Relevance score (0-1)
    """
    score = 0.5  # Base score
    
    # Analyze historical interactions for this notification type
    type_interactions = [i for i in historical_interactions if i.get("type") == notification_type]
    
    if type_interactions:
        # Calculate engagement rate
        engaged = sum(1 for i in type_interactions if i.get("engaged", False))
        engagement_rate = engaged / len(type_interactions)
        score = score * 0.3 + engagement_rate * 0.7
        
        # Check time preferences
        current_hour = datetime.now().hour
        engaged_hours = [datetime.fromisoformat(i["timestamp"]).hour 
                        for i in type_interactions if i.get("engaged", False)]
        
        if engaged_hours:
            avg_hour = sum(engaged_hours) / len(engaged_hours)
            hour_diff = abs(current_hour - avg_hour)
            
            # Penalize if current time is far from preferred time
            if hour_diff > 3:
                score *= 0.7
    
    # Context-based adjustments
    if notification_type == "transaction":
        # High priority for large transactions
        amount = user_context.get("amount", 0)
        if amount > 1000:
            score *= 1.3
        elif amount < 10:
            score *= 0.7
    
    elif notification_type == "bill":
        # Higher priority as due date approaches
        days_until_due = user_context.get("days_until_due", 30)
        if days_until_due <= 1:
            score *= 1.5
        elif days_until_due <= 3:
            score *= 1.2
        elif days_until_due > 7:
            score *= 0.8
    
    elif notification_type == "goal":
        # Higher priority for goals close to completion
        progress = user_context.get("progress", 0)
        if progress >= 90:
            score *= 1.4
        elif progress >= 75:
            score *= 1.2
        elif progress < 25:
            score *= 0.8
    
    elif notification_type == "balance":
        # Critical for low balance
        balance = user_context.get("balance", 1000)
        threshold = user_context.get("threshold", 100)
        if balance < threshold:
            score *= 1.5
        elif balance < threshold * 2:
            score *= 1.2
    
    # Ensure score is within bounds
    return max(0.0, min(1.0, score))


def determine_optimal_time(
    notification_type: str,
    historical_interactions: List[Dict[str, Any]],
    current_time: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    Determine the optimal time to send a notification
    
    Args:
        notification_type: Type of notification
        historical_interactions: Past notification interactions
        current_time: Current time (defaults to now)
        
    Returns:
        Optimal time information
    """
    if current_time is None:
        current_time = datetime.now()
    
    # Analyze engagement patterns
    type_interactions = [i for i in historical_interactions if i.get("type") == notification_type]
    
    if not type_interactions:
        # Default optimal times by type
        default_hours = {
            "transaction": 9,  # Morning
            "bill": 18,  # Evening
            "goal": 20,  # Night
            "balance": 8,  # Early morning
            "security": 0,  # Immediate
        }
        
        optimal_hour = default_hours.get(notification_type, 12)
        optimal_time = current_time.replace(hour=optimal_hour, minute=0, second=0, microsecond=0)
        
        # If optimal time has passed today, schedule for tomorrow
        if optimal_time < current_time:
            optimal_time += timedelta(days=1)
        
        return {
            "optimal_time": optimal_time.isoformat(),
            "confidence": 0.5,
            "reason": "default_schedule",
        }
    
    # Calculate engagement by hour
    hour_engagement: Dict[int, List[bool]] = {}
    for interaction in type_interactions:
        hour = datetime.fromisoformat(interaction["timestamp"]).hour
        engaged = interaction.get("engaged", False)
        
        if hour not in hour_engagement:
            hour_engagement[hour] = []
        hour_engagement[hour].append(engaged)
    
    # Find hour with highest engagement rate
    best_hour = 12
    best_rate = 0.0
    
    for hour, engagements in hour_engagement.items():
        rate = sum(engagements) / len(engagements)
        if rate > best_rate:
            best_rate = rate
            best_hour = hour
    
    # Calculate optimal time
    optimal_time = current_time.replace(hour=best_hour, minute=0, second=0, microsecond=0)
    
    # If optimal time has passed today, schedule for tomorrow
    if optimal_time < current_time:
        optimal_time += timedelta(days=1)
    
    return {
        "optimal_time": optimal_time.isoformat(),
        "confidence": best_rate,
        "reason": "learned_preference",
        "engagement_rate": best_rate,
    }


def optimize_notification_frequency(
    notification_type: str,
    recent_notifications: List[Dict[str, Any]],
    user_preferences: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Determine if a notification should be sent based on frequency limits
    
    Args:
        notification_type: Type of notification
        recent_notifications: Recent notifications sent
        user_preferences: User notification preferences
        
    Returns:
        Frequency optimization result
    """
    # Get user's frequency preference
    max_per_day = user_preferences.get(f"{notification_type}_max_per_day", 5)
    min_interval_minutes = user_preferences.get(f"{notification_type}_min_interval", 60)
    
    # Count recent notifications of this type
    now = datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    today_count = sum(
        1 for n in recent_notifications
        if n.get("type") == notification_type
        and datetime.fromisoformat(n["timestamp"]) >= today_start
    )
    
    # Check if daily limit reached
    if today_count >= max_per_day:
        return {
            "should_send": False,
            "reason": "daily_limit_reached",
            "count_today": today_count,
            "max_per_day": max_per_day,
        }
    
    # Check minimum interval
    type_notifications = [
        n for n in recent_notifications
        if n.get("type") == notification_type
    ]
    
    if type_notifications:
        last_notification = max(
            type_notifications,
            key=lambda n: datetime.fromisoformat(n["timestamp"])
        )
        last_time = datetime.fromisoformat(last_notification["timestamp"])
        minutes_since_last = (now - last_time).total_seconds() / 60
        
        if minutes_since_last < min_interval_minutes:
            return {
                "should_send": False,
                "reason": "too_soon",
                "minutes_since_last": int(minutes_since_last),
                "min_interval": min_interval_minutes,
            }
    
    return {
        "should_send": True,
        "reason": "within_limits",
        "count_today": today_count,
        "max_per_day": max_per_day,
    }


def generate_smart_notification(
    notification_type: str,
    context: Dict[str, Any],
    historical_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Generate a smart notification with AI-optimized timing and content
    
    Args:
        notification_type: Type of notification
        context: Notification context
        historical_data: Historical interaction data
        
    Returns:
        Smart notification object
    """
    historical_interactions = historical_data.get("interactions", [])
    recent_notifications = historical_data.get("recent_notifications", [])
    user_preferences = historical_data.get("preferences", {})
    
    # Calculate relevance score
    relevance_score = calculate_notification_score(
        notification_type,
        context,
        historical_interactions
    )
    
    # Determine optimal timing
    optimal_timing = determine_optimal_time(
        notification_type,
        historical_interactions
    )
    
    # Check frequency limits
    frequency_check = optimize_notification_frequency(
        notification_type,
        recent_notifications,
        user_preferences
    )
    
    # Decide whether to send
    should_send = (
        relevance_score >= 0.3 and
        frequency_check["should_send"]
    )
    
    return {
        "should_send": should_send,
        "relevance_score": relevance_score,
        "optimal_timing": optimal_timing,
        "frequency_check": frequency_check,
        "notification_type": notification_type,
        "context": context,
        "timestamp": datetime.now().isoformat(),
    }


def main():
    """Main entry point for smart notification processing"""
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        notification_type = input_data.get("notification_type", "")
        context = input_data.get("context", {})
        historical_data = input_data.get("historical_data", {})
        
        if not notification_type:
            raise ValueError("notification_type is required")
        
        # Generate smart notification
        result = generate_smart_notification(
            notification_type,
            context,
            historical_data
        )
        
        # Output result
        print(json.dumps(result, indent=2))
        sys.exit(0)
        
    except Exception as e:
        error_result = {
            "error": str(e),
            "timestamp": datetime.now().isoformat(),
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)


if __name__ == "__main__":
    main()
