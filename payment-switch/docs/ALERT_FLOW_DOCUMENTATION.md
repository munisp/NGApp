# Real-Time Anomaly Alert System - End-to-End Data Flow

## Overview

The real-time anomaly alert system monitors production metrics, detects anomalies, triggers alerts based on configurable rules, and delivers notifications through multiple channels including Slack. This document provides a comprehensive walkthrough of the entire data flow from metric collection to final notification delivery.

---

## System Components

### 1. Payment Service (Metric Source)
The production payment service emits metrics every 30 seconds, including transaction throughput (TPS), error rates, average latency, success rates, active connections, and queue depth.

### 2. Production Monitoring Module
Collects and stores metrics in the database with timestamps, providing the foundation for alert rule evaluation and anomaly detection.

### 3. PostgreSQL Database
Stores three critical tables: `production_monitoring` (metric values), `monitoring_alert_rules` (alert configurations), and `monitoring_alerts` (triggered alerts with status tracking).

### 4. Alert Service
Evaluates monitoring data against configured alert rules every 30 seconds, comparing metric values to thresholds using operators (>, <, >=, <=) and triggering alerts when thresholds are exceeded.

### 5. Anomaly Detector
Performs statistical analysis on historical metric data to identify anomalies using mean, standard deviation, and Z-score calculations with a threshold of 2.0 standard deviations.

### 6. Notification Service
Orchestrates multi-channel notification delivery including email and Slack, with special handling for critical severity alerts that notify the project owner.

### 7. Slack Service
Formats and delivers rich Slack messages with severity-based colors, emoji indicators, and structured field layouts through configured webhooks.

### 8. Admin Dashboard
Displays real-time alerts with auto-refresh every 30 seconds, provides manual acknowledge and resolve actions, and shows alert history with status badges.

---

## Data Flow Phases

### Phase 1: Metric Collection & Storage

**Trigger**: Payment service operation (continuous)

**Process**:
1. Payment service emits metrics every 30 seconds during normal operation
2. Production monitoring module receives metric data including type, value, and timestamp
3. Metrics are inserted into `production_monitoring` table with `applicationId`, `metricType`, `value`, and `timestamp`
4. Database confirms successful storage

**Data Structure**:
```sql
INSERT INTO production_monitoring (
    applicationId, 
    metricType,     -- 'tps' | 'error_rate' | 'latency' | 'success_rate' | 'active_connections' | 'queue_depth'
    value,          -- Numeric metric value
    timestamp       -- Current timestamp
)
```

**Frequency**: Every 30 seconds per metric type

---

### Phase 2: Alert Rule Evaluation

**Trigger**: Admin dashboard auto-refresh (every 30 seconds) or manual refresh

**Process**:
1. Admin dashboard initiates alert evaluation via tRPC query
2. Alert service retrieves all enabled alert rules from database
3. Service fetches recent monitoring data within the configured threshold period
4. For each active rule, the service compares metric values against rule thresholds
5. Comparison uses configured operator (>, <, >=, <=)

**Alert Rule Structure**:
```typescript
{
    id: number,
    applicationId: number,
    metricType: string,
    threshold: number,
    operator: '>' | '<' | '>=' | '<=',
    severity: 'critical' | 'warning' | 'info',
    enabled: boolean,
    reminderIntervalDays: number
}
```

**Evaluation Logic**:
```typescript
const thresholdExceeded = 
    (operator === '>' && value > threshold) ||
    (operator === '<' && value < threshold) ||
    (operator === '>=' && value >= threshold) ||
    (operator === '<=' && value <= threshold);
```

---

### Phase 3: Alert Creation & Anomaly Detection

**Trigger**: Threshold exceeded during evaluation

**Process**:

**3.1 Alert Creation**:
1. Service checks for existing active alerts for the same rule
2. If no active alert exists, creates new alert record with severity, message, and 'active' status
3. Database returns the newly created `alertId`

**3.2 Anomaly Detection**:
1. Alert service invokes anomaly detector with `applicationId` and `metricType`
2. Detector retrieves last 100 historical values for the metric
3. Statistical analysis calculates mean and standard deviation
4. Z-score threshold of 2.0 identifies anomalies: `|value - mean| > 2 * stdDev`
5. Anomaly results returned to alert service

**Anomaly Detection Algorithm**:
```typescript
const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
const stdDev = Math.sqrt(variance);
const zScoreThreshold = 2.0;

const anomalies = values.filter(v => 
    Math.abs(v - mean) > zScoreThreshold * stdDev
);
```

---

### Phase 4: Notification Dispatch

**Trigger**: New alert created

**Process**:
1. Alert service triggers notification service with alert details and anomaly data
2. Notification service creates pending notification records for each channel (email, Slack)
3. For critical severity alerts, owner notification is triggered immediately
4. Parallel processing handles multiple notification channels simultaneously

**Notification Channels**:
- **Email**: Pending implementation (notification record created)
- **Slack**: Active integration with webhook delivery
- **Owner Notification**: Critical alerts only, using Manus notification API

**Critical Alert Owner Notification**:
```typescript
await notifyOwner({
    title: `Critical Alert: ${metricType} threshold exceeded`,
    content: `Application ${applicationId} has triggered a critical alert. 
              Metric: ${metricType}, Value: ${value}, Threshold: ${threshold}`
});
```

---

### Phase 5: Slack Integration

**Trigger**: Slack notification record created

**Process**:

**5.1 Configuration Retrieval**:
1. Notification service queries `notification_channels` table for enabled Slack configurations
2. Retrieves webhook URL and channel name

**5.2 Message Formatting**:
1. Slack service formats message with severity-based color coding
2. Adds emoji indicators based on severity (🔴 critical, ⚠️ warning, ℹ️ info)
3. Structures fields including metric type, current value, threshold, severity, and timestamp

**Slack Message Format**:
```json
{
    "attachments": [{
        "color": "#dc2626",  // Red for critical, yellow for warning, blue for info
        "title": "🚨 Production Alert Triggered",
        "fields": [
            {
                "title": "Metric",
                "value": "Transaction TPS",
                "short": true
            },
            {
                "title": "Current Value",
                "value": "1250 TPS",
                "short": true
            },
            {
                "title": "Threshold",
                "value": "> 1000 TPS",
                "short": true
            },
            {
                "title": "Severity",
                "value": "CRITICAL",
                "short": true
            },
            {
                "title": "Application",
                "value": "Payment Gateway #42",
                "short": false
            },
            {
                "title": "Timestamp",
                "value": "2024-11-04 19:30:15 UTC",
                "short": false
            }
        ],
        "footer": "Payment Switch Monitoring",
        "ts": 1730751015
    }]
}
```

**5.3 Webhook Delivery**:
1. Slack service posts formatted message to webhook URL
2. Handles response status (200 OK = success, others = failure)
3. Updates notification record with delivery status and timestamp
4. Logs errors for failed deliveries

**Error Handling**:
- Network errors: Logged and notification marked as 'failed'
- Invalid webhook: Logged with error message
- Rate limiting: Retry logic (future enhancement)

---

### Phase 6: Auto-Resolution

**Trigger**: Metric value returns to normal range

**Process**:
1. During next evaluation cycle, alert service detects metric within threshold
2. Service queries for active alerts related to the rule
3. If active alert exists, updates status to 'resolved' with `resolvedAt` timestamp
4. Optional: Sends resolution notification to Slack

**Resolution Message**:
```json
{
    "text": "✅ Alert Resolved: Transaction TPS has returned to normal levels (850 TPS)"
}
```

---

### Phase 7: Admin Dashboard Display

**Trigger**: Alert data changes or auto-refresh interval

**Process**:

**7.1 Real-Time Display**:
1. Dashboard queries active alerts every 30 seconds
2. Renders alert badges with severity-based colors (red, yellow, blue)
3. Displays alert count in navigation tab
4. Shows detailed alert information in alerts tab

**7.2 Alert History**:
1. Displays all alerts with status badges (Active, Acknowledged, Resolved)
2. Shows timestamps for creation, acknowledgment, and resolution
3. Provides filtering and sorting capabilities

**7.3 Anomaly Indicators**:
1. Visual indicators for detected anomalies
2. Historical trend visualization (future enhancement)

**UI Components**:
- Active alert badge: `<Badge variant="destructive">5 Active Alerts</Badge>`
- Alert card with severity color border
- Acknowledge and Resolve action buttons
- Alert history table with status badges

---

### Phase 8: Manual Alert Management

**Trigger**: Admin user action

**Process**:

**8.1 Acknowledge Alert**:
1. Admin clicks "Acknowledge" button on active alert
2. Dashboard sends tRPC mutation to alert service
3. Service updates alert status to 'acknowledged' with timestamp
4. UI updates to show acknowledged badge
5. Alert remains visible but marked as acknowledged

**8.2 Resolve Alert**:
1. Admin clicks "Resolve" button on active or acknowledged alert
2. Dashboard sends tRPC mutation to alert service
3. Service updates alert status to 'resolved' with timestamp
4. UI removes alert from active list
5. Alert moves to history with resolved status

**tRPC Mutations**:
```typescript
// Acknowledge
trpc.productionGoLive.alerts.acknowledgeAlert.mutate({ alertId: 123 });

// Resolve
trpc.productionGoLive.alerts.resolveAlert.mutate({ alertId: 123 });
```

---

## Alert Lifecycle States

### State Diagram
```
[Monitoring Data] 
    ↓
[Threshold Exceeded] → [Active Alert Created]
    ↓
[Admin Acknowledges] → [Acknowledged Status]
    ↓
[Admin Resolves OR Auto-Resolves] → [Resolved Status]
```

### State Descriptions

**Active**: Alert triggered, threshold exceeded, awaiting acknowledgment or resolution

**Acknowledged**: Admin has seen the alert but issue not yet resolved

**Resolved**: Issue resolved either manually by admin or automatically when metric returns to normal

---

## Database Schema

### production_monitoring
```sql
CREATE TABLE production_monitoring (
    id INT PRIMARY KEY AUTO_INCREMENT,
    applicationId INT NOT NULL,
    metricType VARCHAR(50) NOT NULL,  -- 'tps', 'error_rate', 'latency', etc.
    value DECIMAL(10,2) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (applicationId) REFERENCES participant_applications(id)
);
```

### monitoring_alert_rules
```sql
CREATE TABLE monitoring_alert_rules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    applicationId INT NOT NULL,
    metricType VARCHAR(50) NOT NULL,
    threshold DECIMAL(10,2) NOT NULL,
    operator VARCHAR(2) NOT NULL,  -- '>', '<', '>=', '<='
    severity VARCHAR(20) NOT NULL,  -- 'critical', 'warning', 'info'
    enabled BOOLEAN DEFAULT true,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (applicationId) REFERENCES participant_applications(id)
);
```

### monitoring_alerts
```sql
CREATE TABLE monitoring_alerts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ruleId INT NOT NULL,
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL,  -- 'active', 'acknowledged', 'resolved'
    triggeredAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledgedAt TIMESTAMP NULL,
    resolvedAt TIMESTAMP NULL,
    FOREIGN KEY (ruleId) REFERENCES monitoring_alert_rules(id)
);
```

### alert_notifications
```sql
CREATE TABLE alert_notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    alertId INT NOT NULL,
    notificationType VARCHAR(20) NOT NULL,  -- 'email', 'slack', 'owner'
    status VARCHAR(20) NOT NULL,  -- 'pending', 'sent', 'failed'
    sentAt TIMESTAMP NULL,
    error TEXT NULL,
    FOREIGN KEY (alertId) REFERENCES monitoring_alerts(id)
);
```

---

## Performance Characteristics

### Metric Collection
- **Frequency**: Every 30 seconds
- **Latency**: < 100ms per metric insert
- **Throughput**: 6 metrics × 2 inserts/minute = 12 inserts/minute per application

### Alert Evaluation
- **Frequency**: Every 30 seconds (dashboard refresh)
- **Latency**: < 500ms for full evaluation cycle
- **Scalability**: Handles 100+ active rules efficiently

### Anomaly Detection
- **Dataset Size**: Last 100 metric values
- **Computation Time**: < 200ms
- **Algorithm**: Statistical (mean, standard deviation, Z-score)

### Slack Delivery
- **Latency**: 500ms - 2s (network dependent)
- **Retry**: Not implemented (future enhancement)
- **Rate Limit**: Slack webhook limits apply

---

## Configuration Examples

### Example 1: High TPS Alert
```typescript
{
    metricType: 'tps',
    threshold: 1000,
    operator: '>',
    severity: 'critical',
    enabled: true
}
```
**Trigger**: When transaction TPS exceeds 1000

### Example 2: High Error Rate Alert
```typescript
{
    metricType: 'error_rate',
    threshold: 5,
    operator: '>',
    severity: 'warning',
    enabled: true
}
```
**Trigger**: When error rate exceeds 5%

### Example 3: Low Success Rate Alert
```typescript
{
    metricType: 'success_rate',
    threshold: 95,
    operator: '<',
    severity: 'critical',
    enabled: true
}
```
**Trigger**: When success rate drops below 95%

---

## Monitoring Best Practices

### Alert Rule Configuration
1. Set appropriate thresholds based on baseline metrics
2. Use 'warning' severity for early indicators
3. Reserve 'critical' for business-impacting issues
4. Enable auto-resolution for transient issues
5. Configure reminder intervals to avoid alert fatigue

### Slack Integration
1. Create dedicated alert channel
2. Use webhook URL from Slack app configuration
3. Test webhook before enabling
4. Monitor delivery status in notification logs
5. Set up escalation for failed deliveries

### Dashboard Usage
1. Check active alerts regularly
2. Acknowledge alerts to track awareness
3. Resolve alerts only when issue is confirmed fixed
4. Review alert history for patterns
5. Adjust rules based on false positive rate

---

## Troubleshooting

### No Alerts Triggered
- **Check**: Alert rules enabled in database
- **Check**: Monitoring data being collected
- **Check**: Threshold values configured correctly
- **Check**: Dashboard auto-refresh working

### Slack Notifications Not Delivered
- **Check**: Webhook URL configured and valid
- **Check**: Slack channel enabled in notification_channels
- **Check**: Network connectivity to Slack API
- **Check**: Notification logs for error messages

### False Positive Alerts
- **Solution**: Adjust threshold values
- **Solution**: Increase anomaly detection Z-score threshold
- **Solution**: Use longer historical window for anomaly detection

### Alert Fatigue
- **Solution**: Increase reminder intervals
- **Solution**: Set max reminders limit
- **Solution**: Use auto-resolution for transient issues
- **Solution**: Consolidate similar alerts

---

## Future Enhancements

### Planned Features
- Email notification implementation
- SMS/phone call for critical alerts
- Alert grouping and deduplication
- Custom notification templates
- Alert escalation policies
- Machine learning-based anomaly detection
- Predictive alerting
- Alert correlation analysis
- Webhook retry logic with exponential backoff
- Multi-channel delivery confirmation

### Performance Improvements
- Batch metric inserts
- Cached alert rule evaluation
- Parallel anomaly detection
- Optimized database queries with indexes

---

## Conclusion

The real-time anomaly alert system provides comprehensive monitoring with intelligent anomaly detection, multi-channel notifications, and flexible alert management. The end-to-end data flow ensures timely detection and notification of production issues while minimizing false positives through statistical analysis and configurable thresholds.

---

**Document Version**: 1.0  
**Last Updated**: November 4, 2024  
**Author**: Payment Switch Engineering Team
