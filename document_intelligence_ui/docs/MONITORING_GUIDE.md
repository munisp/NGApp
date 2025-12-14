# Monitoring & Alerting Guide

## Overview

Comprehensive monitoring setup for the Document Intelligence Platform to ensure reliability, performance, and quick incident response.

## Monitoring Stack Recommendations

### Option 1: Datadog (Recommended for Enterprise)

**Pros:** All-in-one solution, excellent UI, powerful alerting  
**Cons:** Can be expensive at scale

### Option 2: Prometheus + Grafana (Open Source)

**Pros:** Free, highly customizable, industry standard  
**Cons:** Requires more setup and maintenance

### Option 3: New Relic

**Pros:** Easy setup, good APM features  
**Cons:** Pricing based on data ingestion

### Option 4: AWS CloudWatch (If on AWS)

**Pros:** Native AWS integration, simple setup  
**Cons:** Limited features compared to dedicated solutions

## Key Metrics to Monitor

### Application Metrics

#### 1. Request Rate & Latency

```javascript
// Add to server/_core/index.ts
import { performance } from 'perf_hooks';

app.use((req, res, next) => {
  const start = performance.now();
  
  res.on('finish', () => {
    const duration = performance.now() - start;
    
    // Log metrics
    console.log(JSON.stringify({
      type: 'request',
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
      timestamp: new Date().toISOString()
    }));
  });
  
  next();
});
```

**Key Metrics:**
- Average response time (target: < 200ms)
- 95th percentile response time (target: < 500ms)
- 99th percentile response time (target: < 1000ms)
- Requests per second
- Error rate (target: < 1%)

#### 2. OCR Processing Metrics

```python
# Add to ocr_pipeline/ensemble_ocr_service.py
import time
import logging

def process_with_metrics(image_data):
    start_time = time.time()
    
    try:
        result = process_ocr(image_data)
        duration = time.time() - start_time
        
        logging.info({
            'type': 'ocr_processing',
            'duration_ms': duration * 1000,
            'confidence': result['confidence'],
            'success': True,
            'timestamp': time.time()
        })
        
        return result
    except Exception as e:
        duration = time.time() - start_time
        logging.error({
            'type': 'ocr_processing',
            'duration_ms': duration * 1000,
            'error': str(e),
            'success': False,
            'timestamp': time.time()
        })
        raise
```

**Key Metrics:**
- OCR processing time (target: < 500ms)
- OCR success rate (target: > 95%)
- Average confidence score (target: > 90%)
- Queue depth
- Concurrent processing count

#### 3. Database Metrics

**Key Metrics:**
- Query execution time
- Connection pool utilization
- Slow queries (> 1 second)
- Deadlocks
- Failed connections

#### 4. S3 Storage Metrics

**Key Metrics:**
- Upload success rate
- Upload duration
- Storage usage
- Failed uploads
- Bandwidth usage

### System Metrics

#### 1. Resource Utilization

**CPU:**
- Average CPU usage (alert if > 80%)
- Peak CPU usage
- CPU usage by process

**Memory:**
- Memory usage (alert if > 85%)
- Memory leaks (increasing trend)
- Swap usage (should be minimal)

**Disk:**
- Disk usage (alert if > 80%)
- Disk I/O
- Inode usage

#### 2. Network Metrics

- Network throughput
- Connection count
- Failed connections
- DNS resolution time

### Business Metrics

- Documents processed per hour
- Active users
- Upload success rate
- Processing success rate
- Average time to process
- Revenue (if applicable)

## Monitoring Setup

### 1. Prometheus + Grafana Setup

#### Install Prometheus

```bash
# Download Prometheus
wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz
tar xvfz prometheus-*.tar.gz
cd prometheus-*

# Create config
cat > prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'doc-intel-ui'
    static_configs:
      - targets: ['localhost:3000']
  
  - job_name: 'ocr-service'
    static_configs:
      - targets: ['localhost:8001']
  
  - job_name: 'api-gateway'
    static_configs:
      - targets: ['localhost:8002']
  
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']
EOF

# Start Prometheus
./prometheus --config.file=prometheus.yml
```

#### Install Grafana

```bash
# Install Grafana
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
sudo apt-get update
sudo apt-get install grafana

# Start Grafana
sudo systemctl start grafana-server
sudo systemctl enable grafana-server

# Access at http://localhost:3000 (default: admin/admin)
```

#### Install Node Exporter (System Metrics)

```bash
wget https://github.com/prometheus/node_exporter/releases/download/v1.6.0/node_exporter-1.6.0.linux-amd64.tar.gz
tar xvfz node_exporter-*.tar.gz
cd node_exporter-*
./node_exporter &
```

### 2. Add Metrics Endpoint to Node.js

```bash
npm install prom-client
```

```typescript
// server/_core/metrics.ts
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export const register = new Registry();

// Request metrics
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

// OCR metrics
export const ocrProcessingDuration = new Histogram({
  name: 'ocr_processing_duration_seconds',
  help: 'Duration of OCR processing in seconds',
  registers: [register]
});

export const ocrProcessingTotal = new Counter({
  name: 'ocr_processing_total',
  help: 'Total number of OCR processing requests',
  labelNames: ['status'],
  registers: [register]
});

// WebSocket metrics
export const websocketConnections = new Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections',
  registers: [register]
});

// Add metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### 3. Grafana Dashboards

#### Import Pre-built Dashboard

1. Open Grafana (http://localhost:3000)
2. Go to Dashboards → Import
3. Use dashboard ID: 1860 (Node Exporter Full)
4. Select Prometheus data source

#### Create Custom Dashboard

```json
{
  "dashboard": {
    "title": "Document Intelligence Platform",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Response Time (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
          }
        ]
      },
      {
        "title": "OCR Processing Time",
        "targets": [
          {
            "expr": "rate(ocr_processing_duration_seconds_sum[5m]) / rate(ocr_processing_duration_seconds_count[5m])"
          }
        ]
      },
      {
        "title": "Active WebSocket Connections",
        "targets": [
          {
            "expr": "websocket_connections_active"
          }
        ]
      }
    ]
  }
}
```

## Alerting Rules

### Prometheus Alerting

```yaml
# alerts.yml
groups:
  - name: doc_intel_alerts
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: rate(http_requests_total{status_code=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} requests/sec"
      
      # Slow response time
      - alert: SlowResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow response time detected"
          description: "95th percentile response time is {{ $value }}s"
      
      # High CPU usage
      - alert: HighCPUUsage
        expr: 100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage detected"
          description: "CPU usage is {{ $value }}%"
      
      # High memory usage
      - alert: HighMemoryUsage
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 85
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage detected"
          description: "Memory usage is {{ $value }}%"
      
      # Service down
      - alert: ServiceDown
        expr: up == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Service is down"
          description: "{{ $labels.job }} has been down for more than 2 minutes"
      
      # OCR processing failures
      - alert: HighOCRFailureRate
        expr: rate(ocr_processing_total{status="failed"}[5m]) / rate(ocr_processing_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High OCR failure rate"
          description: "OCR failure rate is {{ $value | humanizePercentage }}"
```

### Alertmanager Configuration

```yaml
# alertmanager.yml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'cluster']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty'
    - match:
        severity: warning
      receiver: 'slack'

receivers:
  - name: 'default'
    email_configs:
      - to: 'alerts@your-domain.com'
        from: 'alertmanager@your-domain.com'
        smarthost: 'smtp.gmail.com:587'
        auth_username: 'your-email@gmail.com'
        auth_password: 'your-app-password'
  
  - name: 'slack'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
        channel: '#alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
  
  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: 'your-pagerduty-service-key'
```

## Log Aggregation

### Option 1: ELK Stack (Elasticsearch, Logstash, Kibana)

```bash
# Install Elasticsearch
wget https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-8.9.0-linux-x86_64.tar.gz
tar -xzf elasticsearch-8.9.0-linux-x86_64.tar.gz
cd elasticsearch-8.9.0/
./bin/elasticsearch

# Install Logstash
wget https://artifacts.elastic.co/downloads/logstash/logstash-8.9.0-linux-x86_64.tar.gz
tar -xzf logstash-8.9.0-linux-x86_64.tar.gz

# Configure Logstash
cat > logstash.conf << 'EOF'
input {
  file {
    path => "/home/ubuntu/document_intelligence_platform/logs/*.log"
    start_position => "beginning"
  }
}

filter {
  json {
    source => "message"
  }
}

output {
  elasticsearch {
    hosts => ["localhost:9200"]
    index => "doc-intel-%{+YYYY.MM.dd}"
  }
}
EOF

# Install Kibana
wget https://artifacts.elastic.co/downloads/kibana/kibana-8.9.0-linux-x86_64.tar.gz
tar -xzf kibana-8.9.0-linux-x86_64.tar.gz
cd kibana-8.9.0/
./bin/kibana
```

### Option 2: Loki + Grafana

```bash
# Install Loki
wget https://github.com/grafana/loki/releases/download/v2.8.0/loki-linux-amd64.zip
unzip loki-linux-amd64.zip
chmod +x loki-linux-amd64

# Start Loki
./loki-linux-amd64 -config.file=loki-config.yaml

# Install Promtail (log shipper)
wget https://github.com/grafana/loki/releases/download/v2.8.0/promtail-linux-amd64.zip
unzip promtail-linux-amd64.zip
chmod +x promtail-linux-amd64

# Configure Promtail
cat > promtail-config.yaml << 'EOF'
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://localhost:3100/loki/api/v1/push

scrape_configs:
  - job_name: doc-intel-logs
    static_configs:
      - targets:
          - localhost
        labels:
          job: doc-intel
          __path__: /home/ubuntu/document_intelligence_platform/logs/*.log
EOF

# Start Promtail
./promtail-linux-amd64 -config.file=promtail-config.yaml
```

## Uptime Monitoring

### External Monitoring Services

1. **UptimeRobot** (Free tier available)
   - Monitor: https://your-domain.com
   - Check interval: 5 minutes
   - Alert via email, SMS, Slack

2. **Pingdom**
   - More advanced features
   - Transaction monitoring
   - Real user monitoring

3. **StatusCake**
   - Free tier available
   - Page speed monitoring
   - SSL certificate monitoring

### Self-hosted: Uptime Kuma

```bash
# Install with Docker
docker run -d --restart=always -p 3001:3001 -v uptime-kuma:/app/data --name uptime-kuma louislam/uptime-kuma:1

# Access at http://localhost:3001
```

## Performance Monitoring (APM)

### Sentry Integration

```bash
npm install @sentry/node @sentry/tracing
```

```typescript
// server/_core/index.ts
import * as Sentry from "@sentry/node";
import * as Tracing from "@sentry/tracing";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Tracing.Integrations.Express({ app }),
  ],
});

// Add Sentry middleware
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

// Add error handler (must be last)
app.use(Sentry.Handlers.errorHandler());
```

## Monitoring Checklist

- [ ] Prometheus installed and scraping metrics
- [ ] Grafana dashboards created
- [ ] Alerting rules configured
- [ ] Alertmanager notifications working
- [ ] Log aggregation setup (ELK or Loki)
- [ ] Uptime monitoring configured
- [ ] APM tool integrated (Sentry)
- [ ] On-call rotation established
- [ ] Incident response playbook created
- [ ] Regular review of metrics and alerts

## Best Practices

1. **Start Simple:** Begin with basic metrics and add more as needed
2. **Alert on Symptoms:** Alert on user-facing issues, not internal metrics
3. **Reduce Alert Fatigue:** Only alert on actionable issues
4. **Document Runbooks:** Create playbooks for common alerts
5. **Regular Reviews:** Review metrics and alerts weekly
6. **Capacity Planning:** Monitor trends for capacity planning
7. **Test Alerts:** Regularly test alert delivery
8. **Backup Monitoring:** Monitor your monitoring system

---

**Remember:** Good monitoring is essential for maintaining a reliable platform. Invest time in proper setup and regular review.
