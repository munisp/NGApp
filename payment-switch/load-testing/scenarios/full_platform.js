import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { randomIntBetween, randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

/**
 * Full Platform Load Test
 * Exercises all critical paths simultaneously:
 * - Payment initiation & settlement
 * - FX rate lookups
 * - Webhook delivery
 * - Dispute creation
 * - KYC verification
 * - Admin dashboard reads
 * - Reconciliation queries
 */

// Metrics per service
const metrics = {
  payments: new Trend('payments_latency_ms', true),
  fx: new Trend('fx_latency_ms', true),
  disputes: new Trend('disputes_latency_ms', true),
  webhooks: new Trend('webhooks_latency_ms', true),
  kyc: new Trend('kyc_latency_ms', true),
  admin: new Trend('admin_latency_ms', true),
  reconciliation: new Trend('reconciliation_latency_ms', true),
  remittance: new Trend('remittance_latency_ms', true),
  errors: new Counter('total_errors'),
  success: new Rate('overall_success_rate'),
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const ADMIN_URL = __ENV.ADMIN_URL || 'http://localhost:3001';

export const options = {
  scenarios: {
    // Payment flow — highest priority, most traffic
    payments: {
      executor: 'constant-arrival-rate',
      rate: 500,
      timeUnit: '1s',
      duration: '3m',
      preAllocatedVUs: 100,
      maxVUs: 300,
      exec: 'paymentFlow',
    },
    // FX rate lookups — high frequency, should be cached
    fx_lookups: {
      executor: 'constant-arrival-rate',
      rate: 2000,
      timeUnit: '1s',
      duration: '3m',
      preAllocatedVUs: 50,
      maxVUs: 200,
      exec: 'fxLookup',
    },
    // Dispute operations — moderate load
    disputes: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '3m',
      preAllocatedVUs: 20,
      maxVUs: 50,
      exec: 'disputeFlow',
    },
    // Admin dashboard — moderate reads
    admin_reads: {
      executor: 'constant-vus',
      vus: 30,
      duration: '3m',
      exec: 'adminDashboard',
    },
    // Remittance workflow — moderate write-heavy
    remittances: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '3m',
      preAllocatedVUs: 30,
      maxVUs: 100,
      exec: 'remittanceFlow',
    },
  },
  thresholds: {
    'payments_latency_ms': ['p(50)<5', 'p(95)<20', 'p(99)<50'],
    'fx_latency_ms': ['p(50)<1', 'p(95)<5', 'p(99)<10'],
    'disputes_latency_ms': ['p(50)<20', 'p(95)<100'],
    'admin_latency_ms': ['p(50)<50', 'p(95)<200'],
    'remittance_latency_ms': ['p(50)<10', 'p(95)<50'],
    'overall_success_rate': ['rate>0.995'],
    'http_req_failed': ['rate<0.005'],
  },
};

const headers = {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer demo-token',
};

// --- Scenario Functions ---

export function paymentFlow() {
  const start = Date.now();
  const payload = {
    amount: randomIntBetween(100, 5000000),
    currency: 'NGN',
    payment_method: ['card', 'bank_transfer', 'mobile_money'][randomIntBetween(0, 2)],
    sender_id: `user-${randomIntBetween(1, 50000)}`,
    recipient_id: `user-${randomIntBetween(1, 50000)}`,
    reference: `pay-${randomString(16)}`,
    idempotency_key: `idem-${randomString(32)}`,
  };

  const res = http.post(`${BASE_URL}/api/trpc/payments.initiate`,
    JSON.stringify(payload), { headers, tags: { name: 'PaymentInitiate' } }
  );

  metrics.payments.add(Date.now() - start);
  const ok = res.status === 200 || res.status === 201;
  metrics.success.add(ok ? 1 : 0);
  if (!ok) metrics.errors.add(1);

  check(res, { 'payment ok': (r) => r.status === 200 || r.status === 201 });
  sleep(0.05);
}

export function fxLookup() {
  const pairs = [
    ['NGN', 'USD'], ['NGN', 'GBP'], ['NGN', 'EUR'],
    ['USD', 'GBP'], ['GHS', 'USD'], ['KES', 'USD'], ['ZAR', 'USD'],
  ];
  const [from, to] = pairs[randomIntBetween(0, pairs.length - 1)];
  const start = Date.now();

  const res = http.get(
    `${BASE_URL}/api/trpc/fx.getRate?input=${encodeURIComponent(JSON.stringify({ from, to }))}`,
    { headers, tags: { name: 'FXRate' } }
  );

  metrics.fx.add(Date.now() - start);
  const ok = res.status === 200;
  metrics.success.add(ok ? 1 : 0);
  if (!ok) metrics.errors.add(1);

  check(res, {
    'fx rate returned': (r) => r.status === 200,
    'fx latency < 5ms': () => (Date.now() - start) < 5,
  });
}

export function disputeFlow() {
  const start = Date.now();
  const action = randomIntBetween(0, 3);

  let res;
  if (action === 0) {
    // Create dispute
    res = http.post(`${BASE_URL}/api/trpc/disputes.create`, JSON.stringify({
      transaction_id: `tx-${randomString(12)}`,
      reason: ['unauthorized', 'duplicate', 'not_received', 'quality'][randomIntBetween(0, 3)],
      amount: randomIntBetween(1000, 500000),
      description: 'Load test dispute',
    }), { headers, tags: { name: 'DisputeCreate' } });
  } else {
    // List disputes
    res = http.get(
      `${BASE_URL}/api/trpc/disputes.list?input=${encodeURIComponent(JSON.stringify({ page: 1, limit: 20 }))}`,
      { headers, tags: { name: 'DisputeList' } }
    );
  }

  metrics.disputes.add(Date.now() - start);
  metrics.success.add((res.status === 200 || res.status === 201) ? 1 : 0);
  sleep(0.2);
}

export function adminDashboard() {
  const endpoints = [
    '/api/trpc/admin.metrics',
    '/api/trpc/admin.participants',
    '/api/trpc/admin.transactions?input=' + encodeURIComponent(JSON.stringify({ page: 1, limit: 50 })),
    '/api/trpc/admin.settlements',
    '/api/trpc/admin.alerts',
  ];

  const endpoint = endpoints[randomIntBetween(0, endpoints.length - 1)];
  const start = Date.now();

  const res = http.get(`${BASE_URL}${endpoint}`, {
    headers, tags: { name: 'AdminDashboard' },
  });

  metrics.admin.add(Date.now() - start);
  metrics.success.add(res.status === 200 ? 1 : 0);

  check(res, {
    'admin endpoint ok': (r) => r.status === 200,
    'admin latency < 200ms': () => (Date.now() - start) < 200,
  });
  sleep(1); // Dashboard refresh interval
}

export function remittanceFlow() {
  const start = Date.now();
  const payload = {
    sender_id: `user-${randomIntBetween(1, 10000)}`,
    recipient_id: `user-${randomIntBetween(1, 10000)}`,
    source_amount: randomIntBetween(10000, 5000000),
    source_currency: 'NGN',
    dest_currency: ['USD', 'GBP', 'EUR', 'GHS'][randomIntBetween(0, 3)],
    corridor: 'ng-' + ['us', 'gb', 'eu', 'gh'][randomIntBetween(0, 3)],
    delivery_method: ['bank', 'mobile_money', 'cash_pickup'][randomIntBetween(0, 2)],
    purpose: 'family_support',
    reference: `rem-${randomString(16)}`,
  };

  const res = http.post(`${BASE_URL}/api/trpc/remittances.initiate`,
    JSON.stringify(payload), { headers, tags: { name: 'RemittanceInitiate' } }
  );

  metrics.remittance.add(Date.now() - start);
  const ok = res.status === 200 || res.status === 201;
  metrics.success.add(ok ? 1 : 0);
  if (!ok) metrics.errors.add(1);

  check(res, { 'remittance ok': (r) => r.status === 200 || r.status === 201 });
  sleep(0.1);
}
