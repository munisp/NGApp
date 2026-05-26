# Load Testing Guide - Payment Switch Platform

## Overview

This directory contains comprehensive load testing scripts for validating the performance targets of the Unified Payment Switch Platform.

## Performance Targets

| Component | Target TPS | P95 Latency | Success Rate |
|-----------|-----------|-------------|--------------|
| Payment Processing | 10,000 | <100ms | >99% |
| Fraud Detection | 5,000 | <200ms | >99% |
| Web Portal API | 1,000 | <300ms | >99% |
| Overall System | 99.9% uptime | - | - |

## Prerequisites

### Install k6

```bash
# macOS
brew install k6

# Ubuntu/Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows (via Chocolatey)
choco install k6

# Docker
docker pull grafana/k6:latest
```

## Test Scripts

### 1. Payment Processing Load Test

**File:** `payment-processing.js`

Tests the Go Ledger Service with TigerBeetle integration.

**Target:** 10,000 TPS  
**Duration:** 30 minutes  
**Stages:**
- Ramp up to 100 users (2 min)
- Hold at 100 users (5 min)
- Ramp up to 500 users (2 min)
- Hold at 500 users (5 min)
- Ramp up to 1,000 users (2 min)
- Hold at 1,000 users (10 min) - **Peak Load**
- Ramp down to 0 users (3 min)

**Run:**
```bash
k6 run --env BASE_URL=http://your-domain.com --env API_KEY=your_api_key payment-processing.js
```

**Expected Results:**
- P95 latency: <100ms
- Success rate: >99%
- Error rate: <1%
- Throughput: 10,000+ TPS at peak

### 2. Fraud Detection Load Test

**File:** `fraud-detection.js`

Tests the Python Fraud Detection Service with GNN and ML models.

**Target:** 5,000 TPS  
**Duration:** 25 minutes  
**Stages:**
- Ramp up to 50 users (1 min)
- Hold at 50 users (3 min)
- Ramp up to 200 users (1 min)
- Hold at 200 users (5 min)
- Ramp up to 500 users (1 min)
- Hold at 500 users (10 min) - **Peak Load**
- Ramp down to 0 users (2 min)

**Run:**
```bash
k6 run --env BASE_URL=http://your-domain.com --env API_KEY=your_api_key fraud-detection.js
```

**Expected Results:**
- P95 latency: <200ms
- Success rate: >99%
- Error rate: <1%
- Throughput: 5,000+ TPS at peak
- Fraud detection rate: ~5% (based on test data)

### 3. Web Portal API Load Test

**File:** `web-portal-api.js`

Tests the Node.js/tRPC API endpoints.

**Target:** 1,000 RPS  
**Duration:** 20 minutes

**Run:**
```bash
k6 run --env BASE_URL=http://your-domain.com --env AUTH_TOKEN=your_jwt_token web-portal-api.js
```

**Expected Results:**
- P95 latency: <300ms
- Success rate: >99%
- Error rate: <1%

### 4. End-to-End Integration Test

**File:** `e2e-integration.js`

Tests complete flow: Authentication → Payment → Fraud Check → Webhook Delivery.

**Run:**
```bash
k6 run --env BASE_URL=http://your-domain.com --env API_KEY=your_api_key e2e-integration.js
```

## Running Tests

### Local Development

```bash
# Start the platform
docker-compose -f docker-compose.unified.yml up -d

# Wait for services to be ready
sleep 30

# Run payment processing test
k6 run --env BASE_URL=http://localhost:80 --env API_KEY=test_key payment-processing.js

# Run fraud detection test
k6 run --env BASE_URL=http://localhost:80 --env API_KEY=test_key fraud-detection.js
```

### Staging Environment

```bash
# Run all tests
./run-all-tests.sh staging

# Or run individually
k6 run --env BASE_URL=https://staging.yourdomain.com --env API_KEY=$STAGING_API_KEY payment-processing.js
```

### Production Environment

```bash
# CAUTION: Only run during maintenance windows or with reduced load
k6 run --env BASE_URL=https://api.yourdomain.com --env API_KEY=$PROD_API_KEY --vus 10 --duration 5m payment-processing.js
```

## Test Results

### Viewing Results

k6 provides real-time console output:

```
     ✓ status is 200 or 201
     ✓ response has transaction ID
     ✓ response time < 100ms

     checks.........................: 99.50% ✓ 29850 ✗ 150
     data_received..................: 15 MB  500 kB/s
     data_sent......................: 7.5 MB 250 kB/s
     http_req_blocked...............: avg=1.2ms  min=0ms   med=0ms   max=50ms  p(90)=2ms   p(95)=5ms
     http_req_connecting............: avg=0.8ms  min=0ms   med=0ms   max=30ms  p(90)=1ms   p(95)=2ms
     http_req_duration..............: avg=45ms   min=10ms  med=40ms  max=200ms p(90)=80ms  p(95)=95ms
     http_req_failed................: 0.50%  ✓ 150  ✗ 29850
     http_req_receiving.............: avg=0.5ms  min=0ms   med=0ms   max=10ms  p(90)=1ms   p(95)=2ms
     http_req_sending...............: avg=0.3ms  min=0ms   med=0ms   max=5ms   p(90)=0ms   p(95)=1ms
     http_req_tls_handshaking.......: avg=0ms    min=0ms   med=0ms   max=0ms   p(90)=0ms   p(95)=0ms
     http_req_waiting...............: avg=44ms   min=10ms  med=39ms  max=195ms p(90)=79ms  p(95)=94ms
     http_reqs......................: 30000  1000/s
     iteration_duration.............: avg=2.5s   min=1s    med=2.4s  max=5s    p(90)=3.2s  p(95)=3.8s
     iterations.....................: 30000  1000/s
     vus............................: 1000   min=0  max=1000
     vus_max........................: 1000   min=1000 max=1000
```

### Exporting Results

#### JSON Output

```bash
k6 run --out json=results.json payment-processing.js
```

#### CSV Output

```bash
k6 run --out csv=results.csv payment-processing.js
```

#### InfluxDB + Grafana

```bash
# Start InfluxDB
docker run -d -p 8086:8086 influxdb:1.8

# Run test with InfluxDB output
k6 run --out influxdb=http://localhost:8086/k6 payment-processing.js

# View in Grafana
# Import k6 dashboard: https://grafana.com/grafana/dashboards/2587
```

## Performance Analysis

### Key Metrics to Monitor

1. **Request Rate (RPS/TPS)**
   - Actual throughput vs target
   - Consistency across test duration

2. **Response Time**
   - P50, P95, P99 percentiles
   - Max response time
   - Standard deviation

3. **Error Rate**
   - HTTP errors (4xx, 5xx)
   - Timeout errors
   - Connection errors

4. **Resource Utilization**
   - CPU usage per service
   - Memory usage per service
   - Database connection pool
   - Network bandwidth

### Bottleneck Identification

#### High Latency (P95 > target)

**Possible Causes:**
- Database query optimization needed
- Insufficient database connections
- Network latency
- CPU bottleneck

**Solutions:**
- Add database indexes
- Increase connection pool size
- Enable query caching
- Scale horizontally

#### High Error Rate (>1%)

**Possible Causes:**
- Rate limiting triggered
- Database connection exhaustion
- Memory leaks
- Timeout configuration

**Solutions:**
- Increase rate limits
- Increase database connections
- Fix memory leaks
- Adjust timeout values

#### Low Throughput (<target TPS)

**Possible Causes:**
- CPU bottleneck
- Database bottleneck
- Network bottleneck
- Synchronous processing

**Solutions:**
- Scale horizontally
- Optimize hot code paths
- Enable async processing
- Add caching layer

## Continuous Performance Testing

### CI/CD Integration

```yaml
# .github/workflows/performance-test.yml
name: Performance Tests

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM

jobs:
  performance-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      
      - name: Run performance tests
        run: |
          k6 run --env BASE_URL=${{ secrets.STAGING_URL }} --env API_KEY=${{ secrets.STAGING_API_KEY }} load-tests/payment-processing.js
          k6 run --env BASE_URL=${{ secrets.STAGING_URL }} --env API_KEY=${{ secrets.STAGING_API_KEY }} load-tests/fraud-detection.js
      
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: results/
```

## Best Practices

1. **Start Small**: Begin with low load and gradually increase
2. **Monitor Resources**: Watch CPU, memory, disk I/O during tests
3. **Test Realistic Scenarios**: Use production-like data and patterns
4. **Run Multiple Times**: Ensure consistency across runs
5. **Test Different Times**: Peak hours, off-hours, weekends
6. **Document Results**: Keep historical performance data
7. **Set Alerts**: Configure alerts for performance degradation
8. **Regular Testing**: Run performance tests regularly (weekly/monthly)

## Troubleshooting

### k6 Installation Issues

```bash
# Verify installation
k6 version

# Test with simple script
k6 run --vus 10 --duration 30s https://test.k6.io
```

### Connection Refused Errors

```bash
# Check if services are running
docker-compose ps

# Check service health
curl http://localhost:80/health
```

### High Error Rates

```bash
# Check service logs
docker-compose logs web-portal
docker-compose logs go-ledger
docker-compose logs fraud-detection

# Check resource usage
docker stats
```

## Additional Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 Examples](https://k6.io/docs/examples/)
- [Performance Testing Best Practices](https://k6.io/docs/testing-guides/test-types/)
- [Grafana k6 Cloud](https://k6.io/cloud/)

## Support

For issues or questions about load testing:
- Check logs: `docker-compose logs`
- Review metrics: Grafana dashboards
- Contact: devops@paymentswitch.com
