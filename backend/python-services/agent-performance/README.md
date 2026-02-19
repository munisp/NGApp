# Enhanced Agent Performance Analytics Service

## Overview

The Enhanced Agent Performance Analytics Service provides comprehensive agent performance tracking, leaderboards, trends analysis, feedback management, and reward systems for the Agent Banking Platform.

## Features

### 1. Performance Metrics
- **Transaction Volume**: Total value of transactions processed
- **Transaction Count**: Number of transactions completed
- **Commission Earned**: Total commission earned
- **Customer Count**: Unique customers served
- **Customer Satisfaction**: Average rating from customer feedback
- **Uptime Percentage**: Agent availability and activity
- **Float Utilization**: Efficiency of cash float usage

### 2. Leaderboards
- **Multi-Metric Leaderboards**: Rank agents by various metrics
- **Time-Based Rankings**: Daily, weekly, monthly, quarterly, yearly, all-time
- **Regional Leaderboards**: Compare agents within specific regions
- **Real-Time Updates**: Cached for performance with 5-minute refresh
- **Badges and Recognition**: Automatic badge assignment for top performers

### 3. Performance Trends
- **Historical Analysis**: Track performance over time
- **Multiple Metrics**: Volume, count, commission trends
- **Customizable Time Ranges**: Week, month, quarter, year
- **Visual Data**: Ready for charting and visualization

### 4. Feedback Management
- **Customer Ratings**: 1-5 star rating system
- **Comments**: Detailed feedback from customers
- **Categories**: Service, speed, professionalism, etc.
- **Feedback Analytics**: Average ratings, positive/negative counts

### 5. Reward System
- **Multiple Reward Types**: Bonuses, badges, prizes, recognition
- **Achievement Tracking**: Record criteria met for each reward
- **Expiration Management**: Time-limited rewards
- **Claim Tracking**: Monitor reward redemption

### 6. Tier System
- **Five-Tier Structure**: Bronze, Silver, Gold, Platinum, Diamond
- **Automatic Tier Assignment**: Based on performance metrics
- **Commission Multipliers**: Higher tiers earn more commission
- **Tier Benefits**: Increased float limits, priority support
- **Tier History**: Track tier changes over time

### 7. Comparative Analysis
- **Percentile Rankings**: See where agents stand relative to peers
- **Comparison to Average**: Performance vs. platform average
- **Comparison to Top**: Gap analysis with top performers
- **Multi-Metric Comparison**: Across all performance dimensions

### 8. Comprehensive Reports
- **All-in-One Report**: Complete performance overview
- **Metrics Summary**: Current performance metrics
- **Trend Analysis**: Historical performance trends
- **Leaderboard Positions**: Rankings across all metrics
- **Feedback Summary**: Customer satisfaction overview
- **Recent Rewards**: Latest achievements and awards
- **Comparative Analysis**: Benchmarking against peers

## API Endpoints

### Health & Status
```
GET  /                      # Service information
GET  /health                # Health check with dependency status
```

### Performance Metrics
```
GET  /api/v1/agents/{agent_id}/performance
     ?time_range=month      # Get agent performance metrics
```

**Time Range Options**: `today`, `week`, `month`, `quarter`, `year`, `all_time`

### Leaderboards
```
GET  /api/v1/leaderboard
     ?metric_type=transaction_volume
     &time_range=month
     &limit=100
     &region=lagos          # Get leaderboard
```

**Metric Types**:
- `transaction_volume`
- `transaction_count`
- `commission_earned`
- `customer_count`
- `customer_satisfaction`
- `uptime`
- `float_utilization`

### Performance Trends
```
GET  /api/v1/agents/{agent_id}/trends
     ?time_range=month      # Get performance trends
```

### Feedback Management
```
POST /api/v1/agents/{agent_id}/feedback    # Submit feedback
GET  /api/v1/agents/{agent_id}/feedback    # Get feedback
     ?limit=100
```

### Reward Management
```
POST /api/v1/agents/{agent_id}/rewards     # Award reward
GET  /api/v1/agents/{agent_id}/rewards     # Get rewards
     ?active_only=false
```

### Comprehensive Report
```
GET  /api/v1/agents/{agent_id}/report
     ?time_range=month      # Get full performance report
```

## Installation

```bash
cd /home/ubuntu/agent-banking-platform/backend/python-services/agent-performance
pip install -r requirements.txt
```

## Running the Service

```bash
# Development
python main.py

# Production
uvicorn main:app --host 0.0.0.0 --port 8050 --workers 4
```

## Environment Variables

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=agent_banking
DB_USER=postgres
DB_PASSWORD=postgres

# Redis
REDIS_URL=redis://localhost:6379

# Service
PORT=8050
```

## Integration with User Stories

This enhanced service supports:

- **Story 9**: Commission Earning & Tracking
- **Story 10**: Agent Hierarchy & Downline Management
- **Story 23**: Agent Performance Analytics

## Version History

- **v2.0.0** (2025-11-11): Complete enhancement with leaderboards, trends, feedback, rewards, tiers
- **v1.0.0** (2025-10-01): Basic implementation

