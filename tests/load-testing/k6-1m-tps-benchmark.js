/**
 * k6 Load Testing Script for 1M TPS Benchmark
 * ============================================
 * 
 * This script tests the platform's ability to handle 1 million transactions per second.
 * 
 * Prerequisites:
 * - k6 installed (https://k6.io/docs/getting-started/installation/)
 * - Platform deployed with 1M TPS configuration
 * - Sufficient load generator capacity (recommend 50+ k6 instances)
 * 
 * Usage:
 *   # Single instance test (for development)
 *   k6 run k6-1m-tps-benchmark.js
 * 
 *   # Distributed test for 1M TPS (production)
 *   k6 run --out influxdb=http://influxdb:8086/k6 \
 *          --vus 10000 --duration 10m \
 *          k6-1m-tps-benchmark.js
 * 
 * Target Metrics:
 * - Throughput: 1,000,000 TPS sustained
 * - P50 Latency: < 2ms
 * - P99 Latency: < 10ms
 * - Error Rate: < 0.01%
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend, Gauge } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const transfersCreated = new Counter('transfers_created');
const transfersSuccessful = new Counter('transfers_successful');
const transfersFailed = new Counter('transfers_failed');
const transferLatency = new Trend('transfer_latency', true);
const errorRate = new Rate('error_rate');
const currentTPS = new Gauge('current_tps');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://api-gateway.core-services.svc.cluster.local';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token';

// Test scenarios
export const options = {
  scenarios: {
    // Warm-up phase
    warmup: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 100 },
        { duration: '1m', target: 500 },
        { duration: '1m', target: 1000 },
      ],
      gracefulRampDown: '30s',
      exec: 'transferTest',
    },
    // Ramp to 1M TPS
    ramp_to_1m: {
      executor: 'ramping-vus',
      startVUs: 1000,
      stages: [
        { duration: '2m', target: 5000 },
        { duration: '2m', target: 10000 },
        { duration: '2m', target: 20000 },
        { duration: '2m', target: 50000 },
      ],
      gracefulRampDown: '1m',
      exec: 'transferTest',
      startTime: '3m',
    },
    // Sustained 1M TPS
    sustained_1m: {
      executor: 'constant-vus',
      vus: 50000,
      duration: '10m',
      exec: 'transferTest',
      startTime: '11m',
    },
    // Spike test
    spike: {
      executor: 'ramping-vus',
      startVUs: 50000,
      stages: [
        { duration: '30s', target: 100000 },
        { duration: '1m', target: 100000 },
        { duration: '30s', target: 50000 },
      ],
      gracefulRampDown: '30s',
      exec: 'transferTest',
      startTime: '21m',
    },
    // Cool down
    cooldown: {
      executor: 'ramping-vus',
      startVUs: 50000,
      stages: [
        { duration: '2m', target: 10000 },
        { duration: '1m', target: 1000 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'transferTest',
      startTime: '23m',
    },
  },
  thresholds: {
    // Latency thresholds
    'http_req_duration': ['p(50)<2', 'p(95)<5', 'p(99)<10'],
    'transfer_latency': ['p(50)<2', 'p(95)<5', 'p(99)<10'],
    // Error rate threshold
    'error_rate': ['rate<0.0001'], // < 0.01%
    // Throughput threshold (checked externally)
    'transfers_successful': ['count>50000000'], // 50M in 10 min = ~83K TPS per instance
  },
};

// Pre-generated test data for speed
const TEST_ACCOUNTS = [];
for (let i = 0; i < 10000; i++) {
  TEST_ACCOUNTS.push({
    id: `acc_${i.toString().padStart(8, '0')}`,
    currency: 'NGN',
  });
}

const CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES'];
const TRANSACTION_TYPES = ['transfer', 'deposit', 'withdrawal'];

// Generate random transfer request
function generateTransfer() {
  const debitIdx = randomIntBetween(0, TEST_ACCOUNTS.length - 1);
  let creditIdx = randomIntBetween(0, TEST_ACCOUNTS.length - 1);
  while (creditIdx === debitIdx) {
    creditIdx = randomIntBetween(0, TEST_ACCOUNTS.length - 1);
  }
  
  return {
    debit_account_id: TEST_ACCOUNTS[debitIdx].id,
    credit_account_id: TEST_ACCOUNTS[creditIdx].id,
    amount: randomIntBetween(100, 10000000), // 1 NGN to 100,000 NGN in kobo
    currency: CURRENCIES[randomIntBetween(0, CURRENCIES.length - 1)],
    transaction_type: TRANSACTION_TYPES[randomIntBetween(0, TRANSACTION_TYPES.length - 1)],
    idempotency_key: `${Date.now()}-${randomString(16)}`,
    metadata: {
      source: 'k6-load-test',
      timestamp: new Date().toISOString(),
    },
  };
}

// Main transfer test function
export function transferTest() {
  const transfer = generateTransfer();
  const startTime = Date.now();
  
  const response = http.post(
    `${BASE_URL}/api/v1/transfers`,
    JSON.stringify(transfer),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'X-Idempotency-Key': transfer.idempotency_key,
        'X-Request-ID': randomString(32),
      },
      timeout: '5s',
    }
  );
  
  const latency = Date.now() - startTime;
  transferLatency.add(latency);
  transfersCreated.add(1);
  
  const success = check(response, {
    'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'response has transfer_id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.transfer_id !== undefined;
      } catch {
        return false;
      }
    },
    'latency < 10ms': () => latency < 10,
  });
  
  if (success) {
    transfersSuccessful.add(1);
    errorRate.add(0);
  } else {
    transfersFailed.add(1);
    errorRate.add(1);
    
    // Log failures for debugging
    if (response.status !== 200 && response.status !== 201) {
      console.error(`Transfer failed: ${response.status} - ${response.body}`);
    }
  }
  
  // No sleep - maximum throughput
}

// Batch transfer test for even higher throughput
export function batchTransferTest() {
  const batchSize = 100;
  const transfers = [];
  
  for (let i = 0; i < batchSize; i++) {
    transfers.push(generateTransfer());
  }
  
  const startTime = Date.now();
  
  const response = http.post(
    `${BASE_URL}/api/v1/transfers/batch`,
    JSON.stringify({ transfers }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'X-Request-ID': randomString(32),
      },
      timeout: '30s',
    }
  );
  
  const latency = Date.now() - startTime;
  transferLatency.add(latency / batchSize); // Per-transfer latency
  transfersCreated.add(batchSize);
  
  const success = check(response, {
    'batch status is 200': (r) => r.status === 200,
    'all transfers successful': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.successful === batchSize;
      } catch {
        return false;
      }
    },
  });
  
  if (success) {
    transfersSuccessful.add(batchSize);
    errorRate.add(0);
  } else {
    transfersFailed.add(batchSize);
    errorRate.add(1);
  }
}

// Health check
export function healthCheck() {
  const response = http.get(`${BASE_URL}/health`);
  
  check(response, {
    'health check passed': (r) => r.status === 200,
  });
}

// Setup function - runs once before test
export function setup() {
  console.log('Starting 1M TPS benchmark...');
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`Test accounts: ${TEST_ACCOUNTS.length}`);
  
  // Verify API is accessible
  const healthResponse = http.get(`${BASE_URL}/health`);
  if (healthResponse.status !== 200) {
    throw new Error(`API health check failed: ${healthResponse.status}`);
  }
  
  return {
    startTime: Date.now(),
  };
}

// Teardown function - runs once after test
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Test completed in ${duration}s`);
}

// Handle summary
export function handleSummary(data) {
  const totalTransfers = data.metrics.transfers_created?.values?.count || 0;
  const successfulTransfers = data.metrics.transfers_successful?.values?.count || 0;
  const failedTransfers = data.metrics.transfers_failed?.values?.count || 0;
  const duration = data.state.testRunDurationMs / 1000;
  const avgTPS = totalTransfers / duration;
  
  const summary = {
    '1M TPS Benchmark Results': {
      'Total Transfers': totalTransfers,
      'Successful Transfers': successfulTransfers,
      'Failed Transfers': failedTransfers,
      'Success Rate': `${((successfulTransfers / totalTransfers) * 100).toFixed(4)}%`,
      'Average TPS': avgTPS.toFixed(0),
      'Peak TPS': 'See Grafana dashboard',
      'P50 Latency (ms)': data.metrics.transfer_latency?.values?.['p(50)'] || 'N/A',
      'P95 Latency (ms)': data.metrics.transfer_latency?.values?.['p(95)'] || 'N/A',
      'P99 Latency (ms)': data.metrics.transfer_latency?.values?.['p(99)'] || 'N/A',
      'Test Duration (s)': duration.toFixed(0),
    },
    'Thresholds': {
      'Latency P99 < 10ms': data.metrics.transfer_latency?.values?.['p(99)'] < 10 ? 'PASS' : 'FAIL',
      'Error Rate < 0.01%': (failedTransfers / totalTransfers) < 0.0001 ? 'PASS' : 'FAIL',
    },
  };
  
  console.log('\n========== 1M TPS BENCHMARK RESULTS ==========');
  console.log(JSON.stringify(summary, null, 2));
  console.log('===============================================\n');
  
  return {
    'stdout': JSON.stringify(summary, null, 2),
    'summary.json': JSON.stringify(data, null, 2),
  };
}
