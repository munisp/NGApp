import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const paymentSuccessRate = new Rate('payment_success_rate');
const paymentDuration = new Trend('payment_duration');
const paymentErrors = new Counter('payment_errors');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '2m', target: 500 },   // Ramp up to 500 users
    { duration: '5m', target: 500 },   // Stay at 500 users
    { duration: '2m', target: 1000 },  // Ramp up to 1000 users
    { duration: '10m', target: 1000 }, // Stay at 1000 users (peak load)
    { duration: '3m', target: 0 },     // Ramp down to 0 users
  ],
  thresholds: {
    'http_req_duration': ['p(95)<100'], // 95% of requests should be below 100ms
    'payment_success_rate': ['rate>0.99'], // 99% success rate
    'http_req_failed': ['rate<0.01'], // Less than 1% errors
  },
};

// Test data generators
function generateTransactionId() {
  return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateAmount() {
  return Math.floor(Math.random() * 100000) + 1000; // 1,000 to 100,000
}

function generateCurrency() {
  const currencies = ['NGN', 'USD', 'BTC', 'ETH', 'USDC'];
  return currencies[Math.floor(Math.random() * currencies.length)];
}

// Main test function
export default function () {
  const BASE_URL = __ENV.BASE_URL || 'http://localhost:80';
  const API_KEY = __ENV.API_KEY || 'test_api_key';

  const payload = JSON.stringify({
    transactionId: generateTransactionId(),
    amount: generateAmount(),
    currency: generateCurrency(),
    fromAccount: `acc_${Math.floor(Math.random() * 1000)}`,
    toAccount: `acc_${Math.floor(Math.random() * 1000)}`,
    description: 'Load test payment',
    metadata: {
      testRun: true,
      timestamp: new Date().toISOString(),
    },
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    tags: {
      name: 'PaymentProcessing',
    },
  };

  // Send payment request
  const startTime = Date.now();
  const response = http.post(`${BASE_URL}/api/payment/process`, payload, params);
  const duration = Date.now() - startTime;

  // Record metrics
  paymentDuration.add(duration);

  // Check response
  const success = check(response, {
    'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'response has transaction ID': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.transactionId !== undefined;
      } catch {
        return false;
      }
    },
    'response time < 100ms': () => duration < 100,
  });

  paymentSuccessRate.add(success);

  if (!success) {
    paymentErrors.add(1);
    console.error(`Payment failed: ${response.status} - ${response.body}`);
  }

  // Think time (simulate real user behavior)
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

// Setup function (runs once per VU at the beginning)
export function setup() {
  console.log('Starting payment processing load test');
  console.log(`Target: 10,000 TPS`);
  console.log(`Base URL: ${__ENV.BASE_URL || 'http://localhost:80'}`);
}

// Teardown function (runs once at the end)
export function teardown(data) {
  console.log('Payment processing load test completed');
}
