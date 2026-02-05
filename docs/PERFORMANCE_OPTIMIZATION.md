# Performance Optimization Guide

Comprehensive guide for optimizing the African Fintech Mobile App for production performance.

## Table of Contents

1. [Running Load Tests](#running-load-tests)
2. [Database Optimization](#database-optimization)
3. [API Optimization](#api-optimization)
4. [ML Services Optimization](#ml-services-optimization)
5. [Caching Strategies](#caching-strategies)
6. [Connection Pooling](#connection-pooling)
7. [Request Queuing](#request-queuing)
8. [Monitoring & Profiling](#monitoring--profiling)

---

## Running Load Tests

### Prerequisites

```bash
# k6 is already installed
k6 version

# Ensure services are running
pm2 status
sudo systemctl status ml-*
```

### Run API Load Test

```bash
cd /home/ubuntu/fintech-mobile-app

# Create results directory
mkdir -p load-test-results

# Run API load test
k6 run load-tests/api-load-test.js

# Run with custom configuration
k6 run --vus 100 --duration 5m load-tests/api-load-test.js

# Run with custom API URL
API_URL=https://api.yourfintech.app k6 run load-tests/api-load-test.js
```

### Run ML Services Load Test

```bash
# Ensure ML services are running
for port in 5003 5004 5005 5006 5007; do
  curl -s http://localhost:$port/health || echo "Service on port $port is down"
done

# Run ML load test
k6 run load-tests/ml-services-load-test.js

# Run with custom ML URL
ML_URL=http://your-ml-server k6 run load-tests/ml-services-load-test.js
```

### Analyze Results

```bash
# View JSON results
cat load-test-results/api-summary.json | jq .

# Open HTML report
# Upload load-test-results/api-summary.html to browser

# Key metrics to check:
# - http_req_duration p(95) < 500ms (API)
# - http_req_duration p(95) < 3000ms (ML)
# - http_req_failed rate < 1%
# - errors rate < 5%
```

---

## Database Optimization

### 1. Add Indexes

```sql
-- Connect to database
psql -U fintech_user -d fintech_app

-- Transactions table indexes
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);

-- Budgets table indexes
CREATE INDEX idx_budgets_user_id ON budgets(user_id);
CREATE INDEX idx_budgets_category ON budgets(category);

-- Investments table indexes
CREATE INDEX idx_investments_user_id ON investments(user_id);
CREATE INDEX idx_investments_symbol ON investments(symbol);

-- Goals table indexes
CREATE INDEX idx_goals_user_id ON goals(user_id);
CREATE INDEX idx_goals_status ON goals(status);

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### 2. Query Optimization

```typescript
// BEFORE: N+1 query problem
const users = await db.select().from(usersTable);
for (const user of users) {
  const transactions = await db.select().from(transactionsTable).where(eq(transactionsTable.userId, user.id));
}

// AFTER: Single query with join
const usersWithTransactions = await db
  .select()
  .from(usersTable)
  .leftJoin(transactionsTable, eq(usersTable.id, transactionsTable.userId));
```

### 3. Connection Pooling

```typescript
// server/db.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // Maximum connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Fail fast if can't connect
});

export const db = drizzle(pool);
```

### 4. Query Result Caching

```typescript
import NodeCache from 'node-cache';

const queryCache = new NodeCache({ 
  stdTTL: 300,  // 5 minutes
  checkperiod: 60 
});

async function getCachedQuery<T>(key: string, queryFn: () => Promise<T>): Promise<T> {
  const cached = queryCache.get<T>(key);
  if (cached) return cached;
  
  const result = await queryFn();
  queryCache.set(key, result);
  return result;
}

// Usage
const transactions = await getCachedQuery(
  `transactions_${userId}_${month}`,
  () => db.select().from(transactionsTable).where(eq(transactionsTable.userId, userId))
);
```

---

## API Optimization

### 1. Response Compression

```typescript
// server/_core/index.ts
import compression from 'compression';

app.use(compression({
  level: 6,
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
}));
```

### 2. Request Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.',
});

const mlLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // ML endpoints are more expensive
});

app.use('/api/', apiLimiter);
app.use('/ml/', mlLimiter);
```

### 3. Response Caching Headers

```typescript
app.get('/api/stocks/:symbol', (req, res) => {
  // Cache for 5 minutes
  res.set('Cache-Control', 'public, max-age=300');
  
  // ... fetch and return stock data
});

app.get('/api/user/profile', (req, res) => {
  // Don't cache user-specific data
  res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  
  // ... fetch and return user profile
});
```

### 4. Async Processing for Heavy Operations

```typescript
import Queue from 'bull';

const emailQueue = new Queue('email', process.env.REDIS_URL);
const reportQueue = new Queue('reports', process.env.REDIS_URL);

// Add job to queue instead of processing immediately
app.post('/api/reports/generate', async (req, res) => {
  const job = await reportQueue.add({
    userId: req.user.id,
    reportType: req.body.type,
  });
  
  res.json({ 
    jobId: job.id,
    status: 'processing',
    message: 'Report generation started'
  });
});

// Process jobs in background
reportQueue.process(async (job) => {
  const { userId, reportType } = job.data;
  // Generate report...
  return { reportUrl: '...' };
});
```

---

## ML Services Optimization

### 1. Model Inference Caching

```python
# python-services/ml/cache.py
from functools import lru_cache
import hashlib
import json

class MLCache:
    def __init__(self, maxsize=1000):
        self.cache = {}
        self.maxsize = maxsize
    
    def get_cache_key(self, data):
        """Generate cache key from input data"""
        json_str = json.dumps(data, sort_keys=True)
        return hashlib.md5(json_str.encode()).hexdigest()
    
    def get(self, key):
        return self.cache.get(key)
    
    def set(self, key, value):
        if len(self.cache) >= self.maxsize:
            # Remove oldest entry
            self.cache.pop(next(iter(self.cache)))
        self.cache[key] = value

ml_cache = MLCache(maxsize=1000)

# Usage in ML service
@app.route('/predict', methods=['POST'])
def predict():
    data = request.json
    cache_key = ml_cache.get_cache_key(data)
    
    # Check cache
    cached_result = ml_cache.get(cache_key)
    if cached_result:
        return jsonify(cached_result)
    
    # Run prediction
    result = model.predict(data)
    
    # Cache result
    ml_cache.set(cache_key, result)
    
    return jsonify(result)
```

### 2. Batch Processing

```python
# Process multiple requests in a single batch
@app.route('/batch-predict', methods=['POST'])
def batch_predict():
    items = request.json['items']
    
    # Process all items in one batch (faster than individual)
    results = model.predict_batch(items)
    
    return jsonify({'results': results})
```

### 3. Model Optimization

```python
# Use quantized models for faster inference
from transformers import AutoModelForSequenceClassification
import torch

# Load model with quantization
model = AutoModelForSequenceClassification.from_pretrained(
    'model_name',
    torch_dtype=torch.float16,  # Use half precision
    device_map='auto'
)

# Or use ONNX for even faster inference
import onnxruntime as ort

session = ort.InferenceSession('model.onnx')
outputs = session.run(None, {'input': input_data})
```

### 4. Async Processing with Celery

```python
# celery_app.py
from celery import Celery

celery_app = Celery('ml_tasks', broker='redis://localhost:6379/0')

@celery_app.task
def predict_async(data):
    result = model.predict(data)
    return result

# In ML service
@app.route('/predict-async', methods=['POST'])
def predict_async_endpoint():
    data = request.json
    task = predict_async.delay(data)
    return jsonify({'task_id': task.id, 'status': 'processing'})

@app.route('/result/<task_id>', methods=['GET'])
def get_result(task_id):
    task = predict_async.AsyncResult(task_id)
    if task.ready():
        return jsonify({'status': 'completed', 'result': task.result})
    return jsonify({'status': 'processing'})
```

---

## Caching Strategies

### 1. Redis Setup

```bash
# Install Redis client
sudo pip3 install redis

# Configure Redis
sudo nano /etc/redis/redis.conf
# Set: maxmemory 2gb
# Set: maxmemory-policy allkeys-lru

sudo systemctl restart redis-server
```

### 2. Implement Redis Caching

```typescript
// lib/cache.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function getCached<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = 300
): Promise<T> {
  // Try to get from cache
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Fetch fresh data
  const data = await fetchFn();
  
  // Store in cache
  await redis.setex(key, ttl, JSON.stringify(data));
  
  return data;
}

// Usage
const stockPrice = await getCached(
  `stock:${symbol}`,
  () => fetchStockPrice(symbol),
  300 // Cache for 5 minutes
);
```

### 3. Cache Invalidation

```typescript
// Invalidate specific cache
await redis.del(`stock:${symbol}`);

// Invalidate pattern
const keys = await redis.keys('stock:*');
if (keys.length > 0) {
  await redis.del(...keys);
}

// Invalidate on data update
app.post('/api/transactions', async (req, res) => {
  const transaction = await createTransaction(req.body);
  
  // Invalidate related caches
  await redis.del(`transactions:${req.user.id}`);
  await redis.del(`budget:${req.user.id}`);
  
  res.json(transaction);
});
```

---

## Connection Pooling

### 1. PostgreSQL Connection Pool

```typescript
// server/db.ts
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                      // Max connections
  min: 5,                       // Min connections
  idleTimeoutMillis: 30000,     // Close idle after 30s
  connectionTimeoutMillis: 2000, // Timeout if can't connect
  maxUses: 7500,                // Close connection after 7500 uses
});

// Monitor pool
pool.on('connect', () => {
  console.log('New client connected to pool');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});
```

### 2. HTTP Connection Pooling

```typescript
// For external API calls
import axios from 'axios';
import http from 'http';
import https from 'https';

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
});

const apiClient = axios.create({
  httpAgent,
  httpsAgent,
  timeout: 30000,
});
```

---

## Request Queuing

### 1. Bull Queue Setup

```typescript
// lib/queue.ts
import Queue from 'bull';

export const mlQueue = new Queue('ml-predictions', process.env.REDIS_URL, {
  limiter: {
    max: 10,        // Max 10 jobs
    duration: 1000, // Per second
  },
});

export const reportQueue = new Queue('reports', process.env.REDIS_URL);

// Process ML predictions
mlQueue.process(5, async (job) => {
  const { service, data } = job.data;
  const result = await callMLService(service, data);
  return result;
});

// Usage
app.post('/api/ml/predict', async (req, res) => {
  const job = await mlQueue.add({
    service: req.body.service,
    data: req.body.data,
  }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  });
  
  res.json({ jobId: job.id });
});
```

### 2. Priority Queue

```typescript
// High priority for premium users
const job = await mlQueue.add(data, {
  priority: user.isPremium ? 1 : 10,
});
```

---

## Monitoring & Profiling

### 1. Add Performance Metrics

```typescript
// lib/metrics.ts
import { register, Counter, Histogram } from 'prom-client';

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// Middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.labels(req.method, req.route?.path || req.path, res.statusCode.toString()).observe(duration);
    httpRequestTotal.labels(req.method, req.route?.path || req.path, res.statusCode.toString()).inc();
  });
  
  next();
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### 2. Application Profiling

```bash
# Profile Node.js application
node --prof server/index.js

# Generate profile report
node --prof-process isolate-*.log > profile.txt

# Use clinic.js for detailed profiling
npm install -g clinic
clinic doctor -- node server/index.js
clinic flame -- node server/index.js
```

### 3. Database Query Profiling

```sql
-- Enable query logging
ALTER DATABASE fintech_app SET log_statement = 'all';
ALTER DATABASE fintech_app SET log_duration = on;
ALTER DATABASE fintech_app SET log_min_duration_statement = 100; -- Log queries > 100ms

-- Find slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Find most frequent queries
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 10;
```

---

## Performance Checklist

- [ ] Run baseline load tests
- [ ] Add database indexes
- [ ] Implement connection pooling
- [ ] Add response caching
- [ ] Enable compression
- [ ] Implement rate limiting
- [ ] Add Redis caching
- [ ] Optimize ML model inference
- [ ] Set up request queuing
- [ ] Add performance monitoring
- [ ] Profile slow endpoints
- [ ] Optimize database queries
- [ ] Run post-optimization load tests
- [ ] Document performance improvements

---

## Expected Performance Targets

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| API P95 Response Time | < 500ms | TBD | ⏳ |
| ML P95 Response Time | < 3000ms | TBD | ⏳ |
| Error Rate | < 1% | TBD | ⏳ |
| Throughput (API) | > 100 req/s | TBD | ⏳ |
| Throughput (ML) | > 20 req/s | TBD | ⏳ |
| Database Query Time | < 100ms | TBD | ⏳ |
| Cache Hit Rate | > 80% | TBD | ⏳ |

---

## Next Steps

1. Run baseline load tests to establish current performance
2. Identify bottlenecks from load test results
3. Implement optimizations based on findings
4. Run post-optimization tests to measure improvements
5. Set up continuous performance monitoring
6. Document all changes and improvements
