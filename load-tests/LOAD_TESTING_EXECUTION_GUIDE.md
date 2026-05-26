# Load Testing Execution Guide

Complete guide for executing load tests and validating the Payment Switch platform's performance targets.

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Payment Processing TPS** | 10,000 | Transactions per second |
| **Fraud Detection TPS** | 5,000 | Fraud checks per second |
| **API Response Time (p95)** | <100ms | 95th percentile |
| **API Response Time (p99)** | <500ms | 99th percentile |
| **Error Rate** | <0.1% | Failed requests / total |
| **Uptime** | 99.9% | Monthly availability |

## Prerequisites

### 1. Install k6

#### macOS

```bash
brew install k6
```

#### Linux

```bash
curl https://github.com/grafana/k6/releases/download/v0.45.0/k6-v0.45.0-linux-amd64.tar.gz -L | tar xvz
sudo mv k6-v0.45.0-linux-amd64/k6 /usr/local/bin/
```

#### Windows

```bash
choco install k6
```

#### Verify Installation

```bash
k6 version
# Expected: k6 v0.45.0
```

### 2. Platform Running

Ensure all services are running:

```bash
# Check health
./scripts/health-check.sh

# Expected: ✓ All checks passed!
```

### 3. Monitoring Active

Open Grafana dashboards before testing:

```bash
# Open in browser
open http://localhost:3001

# Import dashboards if not already done:
# - System Overview
# - Transaction Monitoring
# - Fraud Detection
```

## Quick Start - Run All Tests

```bash
cd load-tests

# Run all tests against local environment
./run-all-tests.sh local

# Run against staging
./run-all-tests.sh staging

# Run against production (⚠️ use with caution)
./run-all-tests.sh production
```

## Individual Test Execution

### Test 1: Payment Processing (10K TPS Target)

#### Configuration

```javascript
// payment-processing.js
export let options = {
  stages: [
    { duration: '2m', target: 100 },    // Warm-up
    { duration: '5m', target: 500 },    // Ramp to 500 users
    { duration: '10m', target: 1000 },  // Ramp to 1000 users (10K TPS)
    { duration: '10m', target: 1000 },  // Sustain 10K TPS
    { duration: '3m', target: 0 },      // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<100', 'p(99)<500'],
    http_req_failed: ['rate<0.001'],
    http_reqs: ['rate>10000'],  // 10K TPS
  },
};
```

#### Run Test

```bash
# Basic run
k6 run payment-processing.js

# With custom duration
k6 run --duration 30m payment-processing.js

# With custom VUs
k6 run --vus 2000 --duration 15m payment-processing.js

# Output to JSON
k6 run --out json=results/payment-test-$(date +%Y%m%d-%H%M%S).json payment-processing.js
```

#### Expected Output

```
     ✓ payment created successfully
     ✓ response time < 100ms

     checks.........................: 100.00% ✓ 600000  ✗ 0
     data_received..................: 1.2 GB  4.0 MB/s
     data_sent......................: 600 MB  2.0 MB/s
     http_req_blocked...............: avg=0.01ms  p(95)=0.02ms  p(99)=0.05ms
     http_req_connecting............: avg=0.01ms  p(95)=0.01ms  p(99)=0.02ms
     http_req_duration..............: avg=45ms    p(95)=85ms    p(99)=120ms
     http_req_failed................: 0.00%   ✓ 0       ✗ 600000
     http_req_receiving.............: avg=0.5ms   p(95)=1ms     p(99)=2ms
     http_req_sending...............: avg=0.2ms   p(95)=0.5ms   p(99)=1ms
     http_req_tls_handshaking.......: avg=0ms     p(95)=0ms     p(99)=0ms
     http_req_waiting...............: avg=44.3ms  p(95)=84ms    p(99)=118ms
     http_reqs......................: 600000  10000/s
     iteration_duration.............: avg=50ms    p(95)=90ms    p(99)=125ms
     iterations.....................: 600000  10000/s
     vus............................: 1000    min=0     max=1000
     vus_max........................: 1000    min=1000  max=1000
```

#### Success Criteria

- ✅ http_reqs: >10,000/s
- ✅ http_req_duration p(95): <100ms
- ✅ http_req_duration p(99): <500ms
- ✅ http_req_failed: <0.1%
- ✅ All checks passing: 100%

### Test 2: Fraud Detection (5K TPS Target)

#### Configuration

```javascript
// fraud-detection.js
export let options = {
  stages: [
    { duration: '2m', target: 50 },     // Warm-up
    { duration: '5m', target: 250 },    // Ramp to 250 users
    { duration: '10m', target: 500 },   // Ramp to 500 users (5K TPS)
    { duration: '10m', target: 500 },   // Sustain 5K TPS
    { duration: '3m', target: 0 },      // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<1000'],
    http_req_failed: ['rate<0.001'],
    http_reqs: ['rate>5000'],  // 5K TPS
  },
};
```

#### Run Test

```bash
k6 run fraud-detection.js
```

#### Expected Output

```
     ✓ fraud check completed
     ✓ response time < 200ms

     checks.........................: 100.00% ✓ 300000  ✗ 0
     http_req_duration..............: avg=85ms    p(95)=150ms   p(99)=250ms
     http_req_failed................: 0.00%   ✓ 0       ✗ 300000
     http_reqs......................: 300000  5000/s
     iterations.....................: 300000  5000/s
     vus............................: 500     min=0     max=500
```

#### Success Criteria

- ✅ http_reqs: >5,000/s
- ✅ http_req_duration p(95): <200ms
- ✅ http_req_duration p(99): <1000ms
- ✅ http_req_failed: <0.1%

### Test 3: API Gateway Stress Test

#### Run Test

```bash
k6 run api-gateway-stress.js
```

#### Configuration

Tests rate limiting, concurrent connections, and gateway stability.

```javascript
export let options = {
  stages: [
    { duration: '1m', target: 100 },
    { duration: '2m', target: 500 },
    { duration: '2m', target: 1000 },
    { duration: '2m', target: 2000 },   // Stress test
    { duration: '1m', target: 0 },
  ],
};
```

### Test 4: Database Connection Pool

#### Run Test

```bash
k6 run database-pool.js
```

#### Purpose

Validates database connection pool handles concurrent queries without exhaustion.

### Test 5: Redis Cache Performance

#### Run Test

```bash
k6 run redis-cache.js
```

#### Purpose

Measures cache hit rates and response times under load.

## Analyzing Results

### Real-Time Monitoring

During test execution, monitor:

1. **Grafana - System Overview Dashboard**
   - CPU usage per service
   - Memory consumption
   - Network I/O
   - Database connections

2. **Grafana - Transaction Monitoring Dashboard**
   - Transaction volume (TPS)
   - Success/failure rates
   - Processing times
   - Queue depths

3. **Grafana - Fraud Detection Dashboard**
   - Fraud check rate
   - Model inference time
   - Detection accuracy
   - False positive rate

### Post-Test Analysis

#### 1. View k6 Summary

```bash
# Summary is printed at end of test
# Or view JSON output:
cat results/payment-test-20240101-120000.json | jq '.metrics'
```

#### 2. Generate HTML Report

```bash
# Install k6-reporter
npm install -g k6-to-junit

# Convert to HTML
k6-to-junit results/payment-test-20240101-120000.json > report.html
open report.html
```

#### 3. Query Prometheus Metrics

```bash
# Average response time during test
curl 'http://localhost:9090/api/v1/query?query=rate(http_request_duration_seconds_sum[5m])/rate(http_request_duration_seconds_count[5m])'

# Request rate
curl 'http://localhost:9090/api/v1/query?query=rate(http_requests_total[5m])'

# Error rate
curl 'http://localhost:9090/api/v1/query?query=rate(http_requests_total{status=~"5.."}[5m])'
```

#### 4. Check Database Performance

```sql
-- Slow queries during test
SELECT * FROM mysql.slow_log
WHERE start_time > DATE_SUB(NOW(), INTERVAL 1 HOUR)
ORDER BY query_time DESC
LIMIT 10;

-- Connection pool usage
SHOW STATUS LIKE 'Threads_connected';
SHOW STATUS LIKE 'Max_used_connections';
```

#### 5. Check Redis Stats

```bash
redis-cli INFO stats
redis-cli INFO memory
```

## Performance Tuning

### If TPS Target Not Met

#### 1. Check Resource Utilization

```bash
# CPU usage
docker stats

# If CPU > 80%, scale horizontally:
docker-compose -f docker-compose.unified.yml up -d --scale web-portal=3
```

#### 2. Optimize Database

```sql
-- Add indexes for frequently queried fields
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_status ON transactions(status);

-- Analyze query performance
EXPLAIN SELECT * FROM transactions WHERE status = 'pending';
```

#### 3. Increase Connection Pools

```javascript
// server/db.ts
const pool = mysql.createPool({
  connectionLimit: 100,  // Increase from default 10
  queueLimit: 0,
  waitForConnections: true,
});
```

#### 4. Enable Redis Caching

```javascript
// Cache exchange rates for 5 minutes
const rates = await redis.get('exchange_rates');
if (!rates) {
  const fresh = await fetchExchangeRates();
  await redis.setex('exchange_rates', 300, JSON.stringify(fresh));
  return fresh;
}
return JSON.parse(rates);
```

### If Response Time Too High

#### 1. Profile Slow Endpoints

```bash
# Enable profiling
NODE_ENV=production node --prof server/index.js

# Generate profile
node --prof-process isolate-*.log > profile.txt
```

#### 2. Optimize Queries

```sql
-- Use EXPLAIN to find slow queries
EXPLAIN SELECT * FROM transactions
WHERE user_id = 123
AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY);

-- Add composite index
CREATE INDEX idx_user_created ON transactions(user_id, created_at);
```

#### 3. Implement Pagination

```javascript
// Instead of fetching all records
const transactions = await db.select()
  .from(transactions)
  .limit(100)
  .offset(page * 100);
```

#### 4. Use Connection Pooling

```javascript
// Reuse connections
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### If Error Rate Too High

#### 1. Check Logs

```bash
# Application logs
docker-compose -f docker-compose.unified.yml logs web-portal | grep ERROR

# Nginx logs
docker-compose -f docker-compose.unified.yml logs nginx-gateway | grep "HTTP/1.1\" 5"
```

#### 2. Increase Timeouts

```javascript
// server/_core/index.ts
const server = app.listen(3000, {
  timeout: 30000,  // 30 seconds
  keepAliveTimeout: 65000,
});
```

#### 3. Add Retry Logic

```javascript
// Retry failed requests
const result = await retry(
  () => externalAPI.call(),
  { retries: 3, minTimeout: 1000 }
);
```

#### 4. Implement Circuit Breaker

```javascript
// Prevent cascading failures
const breaker = new CircuitBreaker(externalAPI.call, {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
});
```

## Load Testing Best Practices

### 1. Test in Stages

Don't jump straight to max load:

```javascript
stages: [
  { duration: '2m', target: 100 },    // 10% of target
  { duration: '5m', target: 500 },    // 50% of target
  { duration: '10m', target: 1000 },  // 100% of target
  { duration: '10m', target: 1000 },  // Sustain
  { duration: '3m', target: 0 },      // Cool down
]
```

### 2. Monitor Throughout

Keep Grafana open and watch for:
- Memory leaks (increasing memory over time)
- CPU spikes
- Database connection exhaustion
- Error rate increases

### 3. Test Realistic Scenarios

```javascript
// Mix of operations
export default function() {
  // 70% reads
  if (Math.random() < 0.7) {
    http.get(`${BASE_URL}/api/transactions`);
  }
  // 20% writes
  else if (Math.random() < 0.9) {
    http.post(`${BASE_URL}/api/transactions`, payload);
  }
  // 10% deletes
  else {
    http.del(`${BASE_URL}/api/transactions/${id}`);
  }
}
```

### 4. Use Think Time

Simulate real user behavior:

```javascript
import { sleep } from 'k6';

export default function() {
  http.get(`${BASE_URL}/api/transactions`);
  sleep(1);  // User reads for 1 second
  
  http.post(`${BASE_URL}/api/transactions`, payload);
  sleep(2);  // User waits 2 seconds
}
```

### 5. Test Failure Scenarios

```javascript
// Test with network delays
http.get(`${BASE_URL}/api/transactions`, {
  timeout: '1s',
});

// Test with invalid data
http.post(`${BASE_URL}/api/transactions`, {
  amount: -100,  // Invalid
});
```

## Continuous Load Testing

### Schedule Regular Tests

```bash
# Cron job to run daily load tests
0 2 * * * cd /path/to/load-tests && ./run-all-tests.sh staging >> /var/log/load-tests.log 2>&1
```

### Automated Alerts

```bash
# Alert if TPS drops below threshold
if [ $(grep "http_reqs" results/latest.json | jq '.rate') -lt 9000 ]; then
  curl -X POST $SLACK_WEBHOOK_URL \
    -d '{"text":"⚠️ Load test failed: TPS below 9000"}'
fi
```

### Track Performance Over Time

```bash
# Store results in database
cat results/payment-test-$(date +%Y%m%d).json | \
  jq '.metrics' | \
  psql -d metrics -c "INSERT INTO load_test_results ..."
```

## Troubleshooting

### k6 Errors

**Error: dial tcp: lookup failed**
- Check BASE_URL is correct
- Verify platform is running
- Check DNS resolution

**Error: context deadline exceeded**
- Increase timeout in test script
- Check if services are overloaded
- Scale up resources

**Error: too many open files**
```bash
# Increase file descriptor limit
ulimit -n 65536
```

### Platform Errors

**Database connection pool exhausted**
```javascript
// Increase pool size
connectionLimit: 200
```

**Out of memory**
```bash
# Increase container memory
docker-compose -f docker-compose.unified.yml up -d \
  --memory 4g web-portal
```

**Rate limit exceeded**
```nginx
# Increase rate limit in nginx.conf
limit_req_zone $binary_remote_addr zone=general:10m rate=200r/s;
```

## Reporting

### Generate Performance Report

```bash
# Run report generator
./generate-performance-report.sh

# Output: reports/performance-report-YYYYMMDD.html
```

### Report Contents

1. **Executive Summary**
   - Test date and duration
   - Performance targets vs. actual
   - Pass/fail status
   - Key findings

2. **Detailed Metrics**
   - TPS achieved
   - Response times (p50, p95, p99)
   - Error rates
   - Resource utilization

3. **Graphs**
   - TPS over time
   - Response time distribution
   - Error rate timeline
   - Resource usage

4. **Recommendations**
   - Bottlenecks identified
   - Optimization suggestions
   - Scaling recommendations

## Production Load Testing

### ⚠️ Important Considerations

1. **Schedule During Low Traffic**
   - Run tests during maintenance windows
   - Avoid peak business hours
   - Notify stakeholders in advance

2. **Use Separate Environment**
   - Prefer staging over production
   - If testing production, use limited load
   - Monitor closely and be ready to stop

3. **Have Rollback Plan**
   - Document rollback procedures
   - Keep previous version ready
   - Have team on standby

4. **Start Small**
   - Begin with 10% of target load
   - Gradually increase if stable
   - Stop immediately if errors occur

### Production Test Command

```bash
# Limited production test (10% of target)
k6 run --vus 100 --duration 5m payment-processing.js
```

## Next Steps

After successful load testing:

1. ✅ Document baseline performance
2. ✅ Set up continuous monitoring
3. ✅ Schedule regular load tests
4. ✅ Implement auto-scaling
5. ✅ Create runbooks for common issues
6. ✅ Train team on performance tuning
7. ✅ Deploy to production with confidence!

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [Grafana Dashboards](http://localhost:3001)
- [Prometheus Metrics](http://localhost:9090)
- [Performance Tuning Guide](../docs/PERFORMANCE_TUNING.md)
