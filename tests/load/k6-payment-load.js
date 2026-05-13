/**
 * K6 Load Test — Payment Switch Platform
 * 
 * Validates performance under production-like load:
 * - Target: 1000 concurrent users
 * - Target: <200ms p95 latency for API calls
 * - Target: <500ms p95 for payment processing
 * - Target: 0% error rate under normal load
 * 
 * Run: k6 run --env BASE_URL=http://localhost:3000 tests/load/k6-payment-load.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('errors');
const paymentDuration = new Trend('payment_duration', true);
const transactionsProcessed = new Counter('transactions_processed');

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Warm up
    { duration: '3m', target: 200 },   // Ramp to normal load
    { duration: '5m', target: 500 },   // Sustained normal load
    { duration: '3m', target: 1000 },  // Peak load
    { duration: '2m', target: 500 },   // Scale down
    { duration: '1m', target: 0 },     // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    errors: ['rate<0.01'],
    payment_duration: ['p(95)<500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

function trpcCall(procedure, input) {
  const url = `${BASE_URL}/api/trpc/${procedure}`;
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'x-dev-role': 'participant',
    },
  };

  if (input) {
    const encoded = encodeURIComponent(JSON.stringify({ json: input }));
    return http.get(`${url}?input=${encoded}`, params);
  }
  return http.get(url, params);
}

export default function () {
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/`);
    check(res, { 'status 200': (r) => r.status === 200 });
  });

  group('Domestic Payments', () => {
    const start = Date.now();
    const res = trpcCall('domesticPayments.listPayments', { limit: 20 });
    paymentDuration.add(Date.now() - start);
    const success = check(res, {
      'domestic payments status 200': (r) => r.status === 200,
      'response has data': (r) => r.body.length > 0,
    });
    errorRate.add(!success);
    if (success) transactionsProcessed.add(1);
  });

  group('Remittance Rates', () => {
    const res = trpcCall('remittance.getCorridors');
    check(res, { 'corridors status 200': (r) => r.status === 200 });
  });

  group('Card Processing', () => {
    const start = Date.now();
    const res = trpcCall('cardProcessing.listTransactions', { limit: 10 });
    paymentDuration.add(Date.now() - start);
    check(res, { 'card transactions status 200': (r) => r.status === 200 });
  });

  group('Settlement', () => {
    const res = trpcCall('settlement.listSettlements');
    check(res, { 'settlements status 200': (r) => r.status === 200 });
  });

  group('Compliance', () => {
    const res = trpcCall('complianceReport.getReports');
    check(res, { 'compliance status 200': (r) => r.status === 200 });
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
    stdout: `
=== Payment Switch Load Test Results ===
VUs:           ${data.metrics.vus.values.max}
Requests:      ${data.metrics.http_reqs.values.count}
Duration:      ${Math.round(data.metrics.http_req_duration.values['p(95)'])}ms (p95)
Error Rate:    ${(data.metrics.errors.values.rate * 100).toFixed(2)}%
Transactions:  ${data.metrics.transactions_processed.values.count}
`,
  };
}
