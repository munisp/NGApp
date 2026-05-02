import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const fraudCheckSuccessRate = new Rate('fraud_check_success_rate');
const fraudCheckDuration = new Trend('fraud_check_duration');
const fraudDetected = new Counter('fraud_detected');
const fraudCheckErrors = new Counter('fraud_check_errors');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 50 },    // Ramp up to 50 users
    { duration: '3m', target: 50 },    // Stay at 50 users
    { duration: '1m', target: 200 },   // Ramp up to 200 users
    { duration: '5m', target: 200 },   // Stay at 200 users
    { duration: '1m', target: 500 },   // Ramp up to 500 users
    { duration: '10m', target: 500 },  // Stay at 500 users (peak load)
    { duration: '2m', target: 0 },     // Ramp down to 0 users
  ],
  thresholds: {
    'http_req_duration': ['p(95)<200'], // 95% of requests should be below 200ms
    'fraud_check_success_rate': ['rate>0.99'], // 99% success rate
    'http_req_failed': ['rate<0.01'], // Less than 1% errors
  },
};

// Test data generators
function generateTransaction() {
  const isFraudulent = Math.random() < 0.05; // 5% fraudulent transactions

  return {
    transactionId: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    amount: isFraudulent 
      ? Math.floor(Math.random() * 1000000) + 500000 // Large amounts for fraud
      : Math.floor(Math.random() * 100000) + 1000,    // Normal amounts
    currency: 'NGN',
    fromAccount: `acc_${Math.floor(Math.random() * 1000)}`,
    toAccount: `acc_${Math.floor(Math.random() * 1000)}`,
    ipAddress: isFraudulent 
      ? `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
      : '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    deviceFingerprint: Math.random().toString(36).substr(2, 16),
    timestamp: new Date().toISOString(),
    metadata: {
      testRun: true,
      expectedFraud: isFraudulent,
    },
  };
}

// Main test function
export default function () {
  const BASE_URL = __ENV.BASE_URL || 'http://localhost:80';
  const API_KEY = __ENV.API_KEY || 'test_api_key';

  const transaction = generateTransaction();
  const payload = JSON.stringify(transaction);

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    tags: {
      name: 'FraudDetection',
    },
  };

  // Send fraud check request
  const startTime = Date.now();
  const response = http.post(`${BASE_URL}/api/fraud/check`, payload, params);
  const duration = Date.now() - startTime;

  // Record metrics
  fraudCheckDuration.add(duration);

  // Check response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has fraud score': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.fraudScore !== undefined && body.fraudScore >= 0 && body.fraudScore <= 1;
      } catch {
        return false;
      }
    },
    'response has risk level': (r) => {
      try {
        const body = JSON.parse(r.body);
        return ['low', 'medium', 'high'].includes(body.riskLevel);
      } catch {
        return false;
      }
    },
    'response time < 200ms': () => duration < 200,
  });

  fraudCheckSuccessRate.add(success);

  if (success) {
    try {
      const body = JSON.parse(response.body);
      if (body.fraudScore > 0.7) {
        fraudDetected.add(1);
      }
    } catch (e) {
      // Ignore parse errors
    }
  } else {
    fraudCheckErrors.add(1);
    console.error(`Fraud check failed: ${response.status} - ${response.body}`);
  }

  // Think time
  sleep(Math.random() * 1.5 + 0.5); // 0.5-2 seconds
}

// Setup function
export function setup() {
  console.log('Starting fraud detection load test');
  console.log(`Target: 5,000 TPS`);
  console.log(`Base URL: ${__ENV.BASE_URL || 'http://localhost:80'}`);
}

// Teardown function
export function teardown(data) {
  console.log('Fraud detection load test completed');
}
