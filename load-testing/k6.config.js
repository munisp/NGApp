/**
 * k6 Load Testing Configuration for Payment Switch Platform
 * 
 * Usage:
 *   k6 run load-testing/scenarios/payment_flow.js
 *   k6 run --vus 100 --duration 60s load-testing/scenarios/gateway_stress.js
 *   k6 run load-testing/scenarios/full_platform.js --out json=results.json
 */

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
export const ADMIN_URL = __ENV.ADMIN_URL || 'http://localhost:3001';
export const GATEWAY_URL = __ENV.GATEWAY_URL || 'http://localhost:8080';

export const AUTH = {
  username: __ENV.TEST_USER || 'demo',
  password: __ENV.TEST_PASS || 'demo',
};

// Performance SLOs (Service Level Objectives)
export const SLO = {
  // Transaction path
  payment_p50_ms: 2,
  payment_p95_ms: 10,
  payment_p99_ms: 20,
  
  // Gateway (Rust)
  gateway_p50_us: 800,    // 0.8μs
  gateway_p99_us: 5000,   // 5μs
  
  // API endpoints
  api_p50_ms: 15,
  api_p95_ms: 50,
  api_p99_ms: 100,
  
  // Throughput
  min_tps: 1000,
  target_tps: 5000,
  
  // Error rate
  max_error_rate: 0.001, // 0.1%
  
  // Availability
  min_success_rate: 0.999, // 99.9%
};

// Load profiles
export const PROFILES = {
  smoke: {
    vus: 5,
    duration: '30s',
  },
  load: {
    stages: [
      { duration: '30s', target: 50 },
      { duration: '2m', target: 50 },
      { duration: '30s', target: 0 },
    ],
  },
  stress: {
    stages: [
      { duration: '30s', target: 100 },
      { duration: '1m', target: 200 },
      { duration: '1m', target: 500 },
      { duration: '1m', target: 1000 },
      { duration: '30s', target: 0 },
    ],
  },
  spike: {
    stages: [
      { duration: '10s', target: 10 },
      { duration: '5s', target: 2000 },
      { duration: '30s', target: 2000 },
      { duration: '5s', target: 10 },
      { duration: '30s', target: 10 },
    ],
  },
  soak: {
    stages: [
      { duration: '1m', target: 200 },
      { duration: '30m', target: 200 },
      { duration: '1m', target: 0 },
    ],
  },
  breakpoint: {
    stages: [
      { duration: '30s', target: 100 },
      { duration: '30s', target: 500 },
      { duration: '30s', target: 1000 },
      { duration: '30s', target: 2000 },
      { duration: '30s', target: 5000 },
      { duration: '30s', target: 10000 },
      { duration: '30s', target: 0 },
    ],
  },
};
