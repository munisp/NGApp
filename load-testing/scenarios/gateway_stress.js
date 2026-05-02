import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

/**
 * Gateway Stress Test
 * Tests the Rust gateway engine (rate limiter, JWT validator, circuit breaker)
 * under extreme load to validate sub-microsecond claims.
 */

// Custom metrics
const gatewayLatency = new Trend('gateway_latency_us', true);
const rateLimitHits = new Counter('rate_limit_hits');
const circuitBreakerTrips = new Counter('circuit_breaker_trips');
const jwtValidations = new Counter('jwt_validations');
const gatewayTPS = new Counter('gateway_tps');

const GATEWAY_URL = __ENV.GATEWAY_URL || 'http://localhost:8080';

export const options = {
  scenarios: {
    // Maximum throughput test — find ceiling
    max_throughput: {
      executor: 'constant-arrival-rate',
      rate: 10000, // 10K RPS
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 500,
      maxVUs: 2000,
    },
    // Rate limiter saturation test
    rate_limit_stress: {
      executor: 'per-vu-iterations',
      vus: 50,
      iterations: 10000,
      startTime: '1m30s',
      maxDuration: '2m',
    },
    // Circuit breaker trip test
    circuit_breaker_test: {
      executor: 'constant-vus',
      vus: 20,
      duration: '30s',
      startTime: '4m',
    },
  },
  thresholds: {
    'gateway_latency_us': ['p(50)<800', 'p(95)<5000', 'p(99)<10000'],
    'http_req_failed': ['rate<0.01'], // Allow up to 1% for rate limiting
    'gateway_tps': ['count>100000'], // At least 100K total requests in test
  },
};

// Generate realistic JWT tokens for testing
function generateToken() {
  // Base64url-encoded header and payload (simulated)
  const header = 'eyJhbGciOiJFZDI1NTE5IiwidHlwIjoiSldUIn0';
  const payload = btoa(JSON.stringify({
    sub: `user-${randomIntBetween(1, 100000)}`,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    scope: 'payments:write transfers:read',
    merchant_id: `merchant-${randomIntBetween(1, 1000)}`,
    tier: ['basic', 'standard', 'enterprise'][randomIntBetween(0, 2)],
  })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const signature = randomString(43);
  return `${header}.${payload}.${signature}`;
}

export default function () {
  const scenario = __ENV.K6_SCENARIO_NAME || exec.scenario.name;

  if (scenario === 'rate_limit_stress') {
    rateLimitStress();
  } else if (scenario === 'circuit_breaker_test') {
    circuitBreakerTest();
  } else {
    maxThroughput();
  }
}

function maxThroughput() {
  const token = generateToken();
  const start = Date.now();

  const res = http.get(`${GATEWAY_URL}/api/health`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Forwarded-For': `${randomIntBetween(1, 255)}.${randomIntBetween(1, 255)}.${randomIntBetween(1, 255)}.${randomIntBetween(1, 255)}`,
      'X-Request-ID': randomString(32),
    },
    tags: { name: 'GatewayHealth' },
  });

  const latencyUs = (Date.now() - start) * 1000; // Convert to microseconds
  gatewayLatency.add(latencyUs);
  gatewayTPS.add(1);
  jwtValidations.add(1);

  check(res, {
    'gateway responds': (r) => r.status === 200 || r.status === 429,
    'latency < 5ms': () => (Date.now() - start) < 5,
  });

  if (res.status === 429) {
    rateLimitHits.add(1);
  }
}

function rateLimitStress() {
  // Same IP hammering to trigger rate limits
  const fixedIP = '192.168.1.1';
  const token = generateToken();

  const res = http.post(`${GATEWAY_URL}/api/payments/initiate`, JSON.stringify({
    amount: 1000,
    currency: 'NGN',
  }), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Forwarded-For': fixedIP,
    },
    tags: { name: 'RateLimitStress' },
  });

  if (res.status === 429) {
    rateLimitHits.add(1);
    check(res, {
      'rate limit response fast': () => res.timings.duration < 1, // Should be < 1ms
      'has retry-after header': (r) => r.headers['Retry-After'] !== undefined,
    });
  }
}

function circuitBreakerTest() {
  // Target a specific service that we'll simulate being down
  const token = generateToken();

  const res = http.get(`${GATEWAY_URL}/api/services/failing-service/health`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Forwarded-For': `10.0.${randomIntBetween(1, 255)}.${randomIntBetween(1, 255)}`,
    },
    tags: { name: 'CircuitBreakerTest' },
  });

  if (res.status === 503) {
    circuitBreakerTrips.add(1);
    check(res, {
      'circuit open response fast': () => res.timings.duration < 1,
      'indicates circuit open': (r) => {
        try { return JSON.parse(r.body).reason === 'circuit_open'; }
        catch { return false; }
      },
    });
  }

  sleep(0.01); // 10ms between requests to this endpoint
}

import exec from 'k6/execution';
