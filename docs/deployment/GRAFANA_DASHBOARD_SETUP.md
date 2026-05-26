# Grafana Dashboard Setup Guide

## Core Services Performance Dashboard

Comprehensive Grafana dashboard for monitoring all core payment switch services with real-time metrics, alerts, and visualizations.

---

## Dashboard Overview

**Dashboard Name**: Payment Switch - Core Services Performance  
**File**: `grafana-core-services-dashboard.json`  
**Refresh Rate**: 30 seconds  
**Time Range**: Last 1 hour (configurable)

---

## Monitored Services

### 1. Payment Gateway
- **Transactions Per Second** (by status: success, failed, pending)
- **Response Time** (p95, p99 percentiles)
- **Success Rate** (real-time percentage)
- **Active Transactions** (concurrent processing)
- **Transaction Amount** (by currency)

**Key Metrics:**
- `payment_transactions_total`
- `payment_request_duration_seconds_bucket`
- `payment_active_transactions`
- `payment_transaction_amount_total`

### 2. Fraud Detection Service
- **Checks Per Second** (by result: approved, flagged, rejected)
- **Risk Score Distribution** (heatmap visualization)
- **ML Model Accuracy** (real-time model performance)
- **False Positive Rate** (percentage)
- **Processing Time** (p95, p99)

**Key Metrics:**
- `fraud_checks_total`
- `fraud_risk_score_bucket`
- `fraud_model_accuracy`
- `fraud_false_positives_total`
- `fraud_check_duration_seconds_bucket`

### 3. TigerBeetle Ledger
- **Operations Per Second** (by operation type)
- **Latency** (p50, p95, p99 in microseconds)
- **Total Accounts** (current count)
- **Account Balance Sum** (by currency)
- **Transfer Success Rate** (percentage)

**Key Metrics:**
- `tigerbeetle_operations_total`
- `tigerbeetle_operation_duration_seconds_bucket`
- `tigerbeetle_accounts_total`
- `tigerbeetle_account_balance`
- `tigerbeetle_transfers_total`

### 4. Workflow Orchestrator (Temporal)
- **Workflow Executions** (by status)
- **Active Workflows** (concurrent count)
- **Workflow Duration** (p95 by workflow type)
- **Task Queue Depth** (backlog monitoring)
- **Worker Utilization** (percentage)

**Key Metrics:**
- `temporal_workflow_executions_total`
- `temporal_active_workflows`
- `temporal_workflow_duration_seconds_bucket`
- `temporal_task_queue_depth`
- `temporal_worker_utilization`

### 5. Infrastructure Metrics
- **CPU Usage** (by service/pod)
- **Memory Usage** (by service/pod)
- **Network I/O** (RX/TX by service)
- **Pod Restart Count** (table view)

**Key Metrics:**
- `container_cpu_usage_seconds_total`
- `container_memory_usage_bytes`
- `container_network_receive_bytes_total`
- `container_network_transmit_bytes_total`
- `kube_pod_container_status_restarts_total`

---

## Installation Steps

### Method 1: Import via Grafana UI

1. **Access Grafana**
   ```bash
   kubectl port-forward -n payment-switch-monitoring svc/grafana 3000:3000
   ```
   Open http://localhost:3000

2. **Login**
   - Username: `admin`
   - Password: Get from secret
     ```bash
     kubectl get secret -n payment-switch-monitoring grafana -o jsonpath="{.data.admin-password}" | base64 --decode
     ```

3. **Import Dashboard**
   - Click **"+"** → **"Import"** in left sidebar
   - Click **"Upload JSON file"**
   - Select `grafana-core-services-dashboard.json`
   - Select **Prometheus** as datasource
   - Click **"Import"**

### Method 2: Import via API

```bash
# Get Grafana admin password
GRAFANA_PASSWORD=$(kubectl get secret -n payment-switch-monitoring grafana -o jsonpath="{.data.admin-password}" | base64 --decode)

# Import dashboard
curl -X POST http://admin:${GRAFANA_PASSWORD}@localhost:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -d @grafana-core-services-dashboard.json
```

### Method 3: ConfigMap (GitOps)

```bash
# Create ConfigMap from dashboard JSON
kubectl create configmap grafana-dashboard-core-services \
  --from-file=grafana-core-services-dashboard.json \
  --namespace payment-switch-monitoring \
  --dry-run=client -o yaml | kubectl apply -f -

# Label ConfigMap for Grafana auto-discovery
kubectl label configmap grafana-dashboard-core-services \
  grafana_dashboard=1 \
  --namespace payment-switch-monitoring
```

---

## Dashboard Configuration

### Variables (Templates)

The dashboard includes dynamic variables for filtering:

1. **$datasource** - Prometheus datasource selector
2. **$namespace** - Kubernetes namespace (default: `payment-switch`)
3. **$service** - Service selector (multi-select, includes all)

**Usage:**
- Change variables in dashboard header dropdowns
- Panels automatically update based on selection
- Use `$__all` to view all services

### Time Range

**Default**: Last 1 hour  
**Options**: 5m, 15m, 1h, 6h, 12h, 24h, 2d, 7d, 30d

**Auto-refresh intervals**: 10s, 30s, 1m, 5m, 15m

### Annotations

**Deployment Changes**: Automatically annotates when Kubernetes deployments are updated
- Source: Prometheus query
- Query: `changes(kube_deployment_status_replicas{namespace="payment-switch"}[5m]) > 0`
- Color: Red
- Helps correlate performance changes with deployments

---

## Alerts Configuration

### Built-in Alert: High Error Rate

**Condition**: Error rate > 5%  
**Evaluation**: Every 1 minute  
**Query**: 
```promql
sum(rate(http_requests_total{namespace="$namespace", app=~"$service", status=~"5.."}[5m])) by (app) 
/ 
sum(rate(http_requests_total{namespace="$namespace", app=~"$service"}[5m])) by (app) 
* 100
```

**Actions**:
- Alert state: Alerting
- No data state: No data
- Execution error state: Alerting
- Message: "Error rate exceeded 5%"

### Threshold Indicators

**Payment Gateway Response Time:**
- Warning: > 200ms (orange line)
- Critical: > 500ms (red fill)

**Fraud Detection False Positive Rate:**
- Warning: > 2% (orange line)

**Temporal Task Queue Depth:**
- Warning: > 1000 (orange line)

**Temporal Worker Utilization:**
- Warning: > 80% (orange line)

**Ledger Transfer Success Rate:**
- Critical: < 99.9% (red fill)

---

## Panel Descriptions

### Row 1: System Overview
- **Total Requests Per Second**: Aggregated RPS across all services
- **Error Rate (%)**: 5xx errors as percentage of total requests

### Row 2: Payment Gateway
- **Transactions Per Second**: Stacked area chart by transaction status
- **Response Time (p95)**: Line chart with p95 and p99 percentiles
- **Success Rate**: Large stat panel with color thresholds
- **Active Transactions**: Real-time concurrent transaction count
- **Transaction Amount**: Currency-specific transaction volume

### Row 3: Fraud Detection
- **Checks Per Second**: Stacked area by result (approved/flagged/rejected)
- **Risk Score Distribution**: Heatmap showing risk score patterns over time
- **ML Model Accuracy**: Stat panel with accuracy percentage
- **False Positive Rate**: Line chart with warning threshold
- **Processing Time**: p95 and p99 latency

### Row 4: TigerBeetle Ledger
- **Operations Per Second**: Stacked area by operation type
- **Latency**: Multi-percentile line chart (p50, p95, p99)
- **Total Accounts**: Large stat panel
- **Account Balance Sum**: Line chart by currency
- **Transfer Success Rate**: High-precision success rate (99%+ range)

### Row 5: Workflow Orchestrator
- **Workflow Executions**: Stacked area by status
- **Active Workflows**: Real-time concurrent workflow count
- **Workflow Duration**: p95 by workflow type
- **Task Queue Depth**: Queue backlog monitoring
- **Worker Utilization**: Worker capacity usage percentage

### Row 6: Infrastructure
- **CPU Usage**: Multi-line chart per pod
- **Memory Usage**: Multi-line chart per pod
- **Network I/O**: RX/TX bandwidth per pod
- **Pod Restart Count**: Sortable table

---

## Customization

### Adding New Panels

1. Click **"Add panel"** in dashboard
2. Select **"Add a new panel"**
3. Configure query:
   ```promql
   your_metric_name{namespace="$namespace", app=~"$service"}
   ```
4. Set visualization type (Graph, Stat, Table, etc.)
5. Configure axes, legend, thresholds
6. Click **"Apply"**

### Modifying Existing Panels

1. Hover over panel title
2. Click dropdown arrow → **"Edit"**
3. Modify query, visualization, or settings
4. Click **"Apply"**

### Saving Changes

1. Click **"Save dashboard"** (disk icon in header)
2. Add change description
3. Click **"Save"**

---

## Prometheus Metrics Reference

### Required Metrics

Ensure your services expose these Prometheus metrics:

**HTTP Metrics:**
```go
http_requests_total{app, method, status}
http_request_duration_seconds_bucket{app, method, le}
```

**Payment Gateway:**
```go
payment_transactions_total{app, status}
payment_request_duration_seconds_bucket{app, method, le}
payment_active_transactions{app}
payment_transaction_amount_total{app, currency}
```

**Fraud Detection:**
```go
fraud_checks_total{app, result}
fraud_risk_score_bucket{app, le}
fraud_model_accuracy{app}
fraud_false_positives_total{app}
fraud_check_duration_seconds_bucket{app, le}
```

**TigerBeetle:**
```go
tigerbeetle_operations_total{operation}
tigerbeetle_operation_duration_seconds_bucket{le}
tigerbeetle_accounts_total
tigerbeetle_account_balance{currency}
tigerbeetle_transfers_total{status}
```

**Temporal:**
```go
temporal_workflow_executions_total{status}
temporal_active_workflows
temporal_workflow_duration_seconds_bucket{workflow_type, le}
temporal_task_queue_depth{queue}
temporal_worker_utilization{worker}
```

### Metric Instrumentation Example (Go)

```go
import (
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promauto"
)

var (
    paymentTransactions = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "payment_transactions_total",
            Help: "Total number of payment transactions",
        },
        []string{"app", "status"},
    )
    
    paymentDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "payment_request_duration_seconds",
            Help:    "Payment request duration in seconds",
            Buckets: prometheus.DefBuckets,
        },
        []string{"app", "method"},
    )
)

// Usage
paymentTransactions.WithLabelValues("payment-gateway", "success").Inc()
timer := prometheus.NewTimer(paymentDuration.WithLabelValues("payment-gateway", "POST"))
defer timer.ObserveDuration()
```

---

## Troubleshooting

### Dashboard Not Loading

**Issue**: Dashboard shows "No data"

**Solutions**:
1. Verify Prometheus datasource is configured:
   ```bash
   kubectl get svc -n payment-switch-monitoring prometheus
   ```

2. Check Prometheus is scraping metrics:
   - Open Prometheus UI: http://localhost:9090
   - Go to Status → Targets
   - Verify targets are "UP"

3. Test query manually in Prometheus:
   ```promql
   up{namespace="payment-switch"}
   ```

### Missing Metrics

**Issue**: Some panels show "No data" but others work

**Solutions**:
1. Check if service is exposing metrics:
   ```bash
   kubectl exec -n payment-switch <POD_NAME> -- curl localhost:9090/metrics
   ```

2. Verify ServiceMonitor is created:
   ```bash
   kubectl get servicemonitor -n payment-switch
   ```

3. Check Prometheus configuration:
   ```bash
   kubectl get configmap -n payment-switch-monitoring prometheus-config -o yaml
   ```

### High Cardinality Warnings

**Issue**: Grafana shows "Too many time series" warning

**Solutions**:
1. Reduce time range (use shorter window)
2. Add more specific label filters
3. Increase Prometheus memory limits
4. Use recording rules for expensive queries

### Slow Dashboard Loading

**Issue**: Dashboard takes long time to load

**Solutions**:
1. Reduce number of visible panels (collapse rows)
2. Increase refresh interval (from 30s to 1m)
3. Use shorter time range
4. Optimize Prometheus queries (add rate intervals)

---

## Best Practices

### Query Optimization

1. **Always use rate() for counters**:
   ```promql
   rate(metric_total[5m])  # Good
   metric_total            # Bad (shows cumulative)
   ```

2. **Use appropriate time windows**:
   ```promql
   rate(metric[5m])   # For 1h time range
   rate(metric[1m])   # For 15m time range
   ```

3. **Aggregate before calculating**:
   ```promql
   sum(rate(metric[5m])) by (label)  # Good
   rate(sum(metric) by (label)[5m])  # Bad
   ```

### Dashboard Organization

1. **Group related panels in rows**
2. **Use consistent panel heights** (8 units recommended)
3. **Place most important metrics at top**
4. **Use stat panels for single values**
5. **Use graphs for time series**
6. **Use tables for lists**

### Alert Configuration

1. **Set realistic thresholds** based on baseline metrics
2. **Use appropriate evaluation intervals** (1m for critical, 5m for warnings)
3. **Add meaningful alert messages**
4. **Test alerts before enabling** in production

---

## Additional Dashboards

Consider creating separate dashboards for:

1. **Database Performance** (PostgreSQL, Redis)
2. **Message Queue** (Kafka)
3. **API Gateway** (APISIX)
4. **Security Monitoring** (Wazuh, OpenAppSec)
5. **Cost Monitoring** (Kubecost)
6. **Business Metrics** (Revenue, user signups, conversions)

---

## Support

For dashboard issues or feature requests:
- Check Grafana documentation: https://grafana.com/docs/
- Review Prometheus query syntax: https://prometheus.io/docs/prometheus/latest/querying/basics/
- Consult team documentation in `/home/ubuntu/UNIFIED_ARCHITECTURE_OVERVIEW.md`

---

**Dashboard Version**: 1.0  
**Last Updated**: November 4, 2024  
**Maintainer**: Payment Switch Engineering Team
