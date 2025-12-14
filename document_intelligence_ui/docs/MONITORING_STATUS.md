# Monitoring Infrastructure Status

**Date:** November 8, 2025  
**Status:** Partially Complete

---

## Installed Components

### ✅ Prometheus (Port 9090)

**Status:** Running and healthy  
**Location:** `/home/ubuntu/prometheus`  
**Configuration:** `/home/ubuntu/prometheus/prometheus.yml`  
**Access:** http://localhost:9090

**Configured Targets:**
- Prometheus itself (localhost:9090)
- Document Intelligence UI (localhost:3000/metrics)
- OCR Service (localhost:8001/metrics)
- API Gateway (localhost:8002/metrics)
- Node Exporter (localhost:9100)

**Health Check:**
```bash
curl http://localhost:9090/-/healthy
# Response: Prometheus Server is Healthy.
```

### ✅ Node Exporter (Port 9100)

**Status:** Running and collecting system metrics  
**Location:** `/home/ubuntu/node_exporter`  
**Access:** http://localhost:9100/metrics

**Metrics Collected:**
- CPU usage
- Memory usage
- Disk I/O
- Network statistics
- System load

**Health Check:**
```bash
curl http://localhost:9100/metrics | head -10
```

### ⏳ Grafana (Port 3001)

**Status:** Installation complete, startup issues  
**Location:** `/home/ubuntu/grafana`  
**Configuration:** `/home/ubuntu/grafana/custom.ini`  
**Expected Access:** http://localhost:3001

**Issue:** Grafana is not starting properly on the custom port. The service can be configured later when needed for visualization.

**Workaround:** Use Prometheus web UI directly at http://localhost:9090 for now.

---

## Current Monitoring Capabilities

### What's Working Now

1. **Prometheus Metrics Collection**
   - All services configured for scraping
   - 15-second collection interval
   - Metrics stored in time-series database

2. **System Metrics**
   - Node Exporter providing detailed system stats
   - CPU, memory, disk, network monitoring
   - Available in Prometheus UI

3. **Service Health Checks**
   - All services can be monitored via Prometheus
   - Health endpoints configured
   - Ready for alerting rules

### What Needs Setup

1. **Grafana Dashboards**
   - Installation complete but not running
   - Can be set up later for better visualization
   - Not critical for basic monitoring

2. **Alerting Rules**
   - Prometheus supports alerting
   - Rules need to be defined in `alerts.yml`
   - Alertmanager not yet configured

3. **Application Metrics**
   - Services need to expose `/metrics` endpoints
   - Requires adding prom-client to Node.js app
   - OCR and API Gateway need metrics endpoints

---

## Using Prometheus for Monitoring

### Accessing Prometheus

1. Open http://localhost:9090 in your browser
2. Use the "Graph" tab to query metrics
3. Use the "Status" → "Targets" to see service health

### Useful Queries

**Check if services are up:**
```promql
up
```

**System CPU usage:**
```promql
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
```

**System memory usage:**
```promql
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100
```

**Disk usage:**
```promql
(node_filesystem_size_bytes - node_filesystem_free_bytes) / node_filesystem_size_bytes * 100
```

### Viewing Metrics

1. Go to http://localhost:9090/graph
2. Enter a query in the expression box
3. Click "Execute"
4. Switch between "Table" and "Graph" views

---

## Next Steps for Complete Monitoring

### 1. Fix Grafana (Optional)

Grafana provides better visualization than Prometheus UI, but it's not critical for basic monitoring.

**To fix:**
```bash
# Check Grafana logs
tail -f /home/ubuntu/grafana/grafana.log

# Try restarting with default config
cd /home/ubuntu/grafana
./bin/grafana-server --config conf/defaults.ini --homepath .
```

### 2. Add Application Metrics

Add metrics endpoints to your services for detailed monitoring.

**For Node.js UI:**
```bash
cd /home/ubuntu/document_intelligence_ui
npm install prom-client
```

Then add metrics endpoint (see `docs/MONITORING_GUIDE.md` for details).

### 3. Configure Alerting

Create alert rules for critical issues.

**Create `/home/ubuntu/prometheus/alerts.yml`:**
```yaml
groups:
  - name: basic_alerts
    rules:
      - alert: ServiceDown
        expr: up == 0
        for: 2m
        annotations:
          summary: "Service {{ $labels.job }} is down"
      
      - alert: HighCPU
        expr: 100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        annotations:
          summary: "High CPU usage detected"
```

Then update `prometheus.yml`:
```yaml
rule_files:
  - "alerts.yml"
```

And restart Prometheus.

### 4. Set Up Alertmanager (Optional)

For email/Slack notifications when alerts fire.

```bash
# Download Alertmanager
wget https://github.com/prometheus/alertmanager/releases/download/v0.25.0/alertmanager-0.25.0.linux-amd64.tar.gz
tar xzf alertmanager-0.25.0.linux-amd64.tar.gz
cd alertmanager-0.25.0.linux-amd64

# Configure and start
./alertmanager --config.file=alertmanager.yml
```

---

## Monitoring Checklist

- [x] Prometheus installed
- [x] Prometheus configured with all service targets
- [x] Prometheus running and healthy
- [x] Node Exporter installed
- [x] Node Exporter running and collecting metrics
- [x] System metrics available in Prometheus
- [ ] Grafana running (optional, can be done later)
- [ ] Grafana dashboards created (optional)
- [ ] Application metrics endpoints added
- [ ] Alert rules configured
- [ ] Alertmanager set up (optional)
- [ ] Notification channels configured (optional)

---

## Quick Commands

**Check Prometheus status:**
```bash
curl http://localhost:9090/-/healthy
```

**Check Node Exporter:**
```bash
curl http://localhost:9100/metrics | head -20
```

**View Prometheus targets:**
```bash
curl http://localhost:9090/api/v1/targets | python3 -m json.tool
```

**Restart Prometheus:**
```bash
pkill prometheus
cd /home/ubuntu/prometheus
./prometheus --config.file=prometheus.yml &
```

**Restart Node Exporter:**
```bash
pkill node_exporter
cd /home/ubuntu/node_exporter
./node_exporter &
```

---

## Summary

**Current State:**
- ✅ Core monitoring infrastructure (Prometheus + Node Exporter) is running
- ✅ System metrics are being collected
- ✅ Service health can be monitored
- ⏳ Grafana visualization pending (optional)
- ⏳ Application-specific metrics pending
- ⏳ Alerting configuration pending

**Immediate Value:**
You can monitor system health and service availability through Prometheus UI right now.

**Future Enhancements:**
Complete Grafana setup and add application metrics for deeper insights when needed.

---

**For detailed monitoring setup instructions, see:** `docs/MONITORING_GUIDE.md`
