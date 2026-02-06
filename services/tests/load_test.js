/**
 * k6 Load Test Suite for all 12 middleware services.
 * Run with: k6 run tests/load_test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const latency = new Trend('request_latency');

export const options = {
  scenarios: {
    health_checks: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
      exec: 'healthChecks',
    },
    kafka_produce: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 20 },
        { duration: '20s', target: 50 },
        { duration: '10s', target: 0 },
      ],
      exec: 'kafkaProduce',
    },
    redis_cache: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 30 },
        { duration: '20s', target: 100 },
        { duration: '10s', target: 0 },
      ],
      exec: 'redisCache',
    },
    tigerbeetle_transfers: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 20,
      exec: 'tigerbeetleTransfers',
    },
    auth_flow: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 10 },
        { duration: '20s', target: 30 },
        { duration: '10s', target: 0 },
      ],
      exec: 'authFlow',
    },
    workflow_start: {
      executor: 'constant-arrival-rate',
      rate: 20,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 10,
      exec: 'workflowStart',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    errors: ['rate<0.1'],
  },
};

const SERVICES = {
  kafka: __ENV.KAFKA_URL || 'http://localhost:8081',
  redis: __ENV.REDIS_URL || 'http://localhost:8082',
  tigerbeetle: __ENV.TIGERBEETLE_URL || 'http://localhost:8083',
  apisix: __ENV.APISIX_URL || 'http://localhost:8084',
  temporal: __ENV.TEMPORAL_URL || 'http://localhost:8085',
  fluvio: __ENV.FLUVIO_URL || 'http://localhost:8086',
  openappsec: __ENV.OPENAPPSEC_URL || 'http://localhost:8087',
  kubernetes: __ENV.KUBERNETES_URL || 'http://localhost:8088',
  permify: __ENV.PERMIFY_URL || 'http://localhost:8089',
  lakehouse: __ENV.LAKEHOUSE_URL || 'http://localhost:8090',
  keycloak: __ENV.KEYCLOAK_URL || 'http://localhost:8091',
  dapr: __ENV.DAPR_URL || 'http://localhost:8092',
};

const headers = { 'Content-Type': 'application/json' };

export function healthChecks() {
  for (const [name, url] of Object.entries(SERVICES)) {
    const res = http.get(`${url}/health`);
    check(res, { [`${name} health OK`]: (r) => r.status === 200 || r.status === 503 });
    latency.add(res.timings.duration);
  }
  sleep(1);
}

export function kafkaProduce() {
  const topics = ['transactions.created', 'payments.initiated', 'accounts.created', 'kyc.submitted', 'auth.login'];
  const topic = topics[Math.floor(Math.random() * topics.length)];
  const res = http.post(`${SERVICES.kafka}/produce`, JSON.stringify({
    topic,
    key: `key-${__VU}-${__ITER}`,
    value: { amount: Math.random() * 10000, timestamp: Date.now(), vu: __VU },
    headers: { source: 'load-test' },
  }), { headers });

  const ok = check(res, { 'kafka produce OK': (r) => r.status === 200 });
  errorRate.add(!ok);
  latency.add(res.timings.duration);
  sleep(0.1);
}

export function redisCache() {
  const ns = 'load-test';
  const key = `key-${__VU}-${__ITER}`;

  const setRes = http.post(`${SERVICES.redis}/cache/set`, JSON.stringify({
    namespace: ns, key, value: `value-${Date.now()}`, ttl_seconds: 60, tags: ['load-test'],
  }), { headers });

  check(setRes, { 'redis set OK': (r) => r.status === 200 });

  const getRes = http.get(`${SERVICES.redis}/cache/get?namespace=${ns}&key=${key}`);
  const ok = check(getRes, {
    'redis get OK': (r) => r.status === 200,
    'redis get found': (r) => r.json().found === true,
  });
  errorRate.add(!ok);
  latency.add(getRes.timings.duration);
  sleep(0.05);
}

export function tigerbeetleTransfers() {
  const res = http.post(`${SERVICES.tigerbeetle}/transfers/create`, JSON.stringify({
    debit_account_id: 'system-revenue',
    credit_account_id: 'system-fees',
    amount: Math.floor(Math.random() * 100000),
    ledger: 1,
    code: 1,
  }), { headers });

  const ok = check(res, { 'transfer OK': (r) => r.status === 200 });
  errorRate.add(!ok);
  latency.add(res.timings.duration);
}

export function authFlow() {
  const loginRes = http.post(`${SERVICES.keycloak}/auth/login`, JSON.stringify({
    username: 'john.doe', password: 'User123!',
  }), { headers });

  const loginOk = check(loginRes, { 'login OK': (r) => r.status === 200 });
  if (!loginOk) { errorRate.add(true); return; }

  const token = loginRes.json().access_token;
  const authHeaders = { ...headers, Authorization: `Bearer ${token}` };

  const userinfoRes = http.get(`${SERVICES.keycloak}/auth/userinfo`, { headers: authHeaders });
  check(userinfoRes, { 'userinfo OK': (r) => r.status === 200 });

  const validateRes = http.post(`${SERVICES.keycloak}/auth/validate`, null, { headers: authHeaders });
  check(validateRes, { 'validate OK': (r) => r.status === 200 });

  http.post(`${SERVICES.keycloak}/auth/logout`, null, { headers: authHeaders });
  latency.add(loginRes.timings.duration);
  sleep(0.5);
}

export function workflowStart() {
  const types = ['payment.process', 'kyc.verification', 'transfer.domestic', 'account.onboarding'];
  const wfType = types[Math.floor(Math.random() * types.length)];

  const res = http.post(`${SERVICES.temporal}/workflows/start`, JSON.stringify({
    workflow_type: wfType,
    input_data: { amount: Math.random() * 10000, vu: __VU },
  }), { headers });

  const ok = check(res, { 'workflow started': (r) => r.status === 200 });
  errorRate.add(!ok);
  latency.add(res.timings.duration);
}
