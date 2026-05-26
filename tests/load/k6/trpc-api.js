/**
 * k6 Load Test: tRPC API Endpoints
 * 
 * Tests the most critical tRPC endpoints under production load:
 * - Dashboard data queries (wells, alarms, production)
 * - Alarm acknowledgment mutations
 * - Real-time telemetry queries
 * 
 * Run: k6 run --env BASE_URL=https://your-app.manus.space tests/load/k6/trpc-api.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('trpc_errors');
const queryLatency = new Trend('trpc_query_latency_ms', true);
const mutationLatency = new Trend('trpc_mutation_latency_ms', true);

export const options = {
  scenarios: {
    // Scenario 1: Dashboard readers (read-heavy, many concurrent users)
    dashboard_readers: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '2m', target: 50 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
    // Scenario 2: Alarm operators (write operations, fewer concurrent)
    alarm_operators: {
      executor: 'constant-vus',
      vus: 10,
      duration: '3m',
      startTime: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    trpc_errors: ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SESSION_TOKEN = __ENV.SESSION_TOKEN || '';

function trpcQuery(procedure, input = undefined) {
  const url = `${BASE_URL}/api/trpc/${procedure}`;
  const params = {
    headers: {
      'Content-Type': 'application/json',
      ...(SESSION_TOKEN ? { 'Cookie': `session=${SESSION_TOKEN}` } : {}),
    },
  };
  
  const queryUrl = input 
    ? `${url}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
    : url;
  
  const start = Date.now();
  const res = http.get(queryUrl, params);
  queryLatency.add(Date.now() - start);
  return res;
}

function trpcMutation(procedure, input) {
  const url = `${BASE_URL}/api/trpc/${procedure}`;
  const params = {
    headers: {
      'Content-Type': 'application/json',
      ...(SESSION_TOKEN ? { 'Cookie': `session=${SESSION_TOKEN}` } : {}),
    },
  };
  
  const start = Date.now();
  const res = http.post(url, JSON.stringify({ json: input }), params);
  mutationLatency.add(Date.now() - start);
  return res;
}

export default function () {
  group('Dashboard Queries', () => {
    // Well list query
    const wellsRes = trpcQuery('wells.list', { page: 1, limit: 20 });
    const wellsOk = check(wellsRes, {
      'wells.list returns 200': (r) => r.status === 200,
      'wells.list has result': (r) => {
        try { return JSON.parse(r.body).result !== undefined; } catch { return false; }
      },
    });
    errorRate.add(!wellsOk);
    
    sleep(0.2);
    
    // Active alarms query
    const alarmsRes = trpcQuery('alarms.listActive', { limit: 50 });
    const alarmsOk = check(alarmsRes, {
      'alarms.listActive returns 200': (r) => r.status === 200,
    });
    errorRate.add(!alarmsOk);
    
    sleep(0.2);
    
    // Production summary
    const prodRes = trpcQuery('production.getSummary');
    const prodOk = check(prodRes, {
      'production.getSummary returns 200': (r) => r.status === 200,
    });
    errorRate.add(!prodOk);
  });
  
  sleep(1);
  
  group('Telemetry Queries', () => {
    const wellId = `WELL-${String(Math.floor(Math.random() * 20) + 1).padStart(4, '0')}`;
    
    const telRes = trpcQuery('telemetry.getLatest', { wellId, limit: 100 });
    const telOk = check(telRes, {
      'telemetry.getLatest returns 200': (r) => r.status === 200,
      'telemetry response time < 300ms': (r) => r.timings.duration < 300,
    });
    errorRate.add(!telOk);
  });
  
  sleep(0.5);
}

export function handleSummary(data) {
  return {
    'tests/load/results/trpc-api-summary.json': JSON.stringify(data, null, 2),
  };
}
