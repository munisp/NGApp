import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { randomIntBetween, randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const paymentLatency = new Trend('payment_latency_ms', true);
const paymentSuccess = new Rate('payment_success_rate');
const paymentThroughput = new Counter('payment_throughput');
const fxLatency = new Trend('fx_conversion_latency_ms', true);
const settlementLatency = new Trend('settlement_latency_ms', true);

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

export const options = {
  scenarios: {
    // Constant load — validates sustained TPS
    steady_payments: {
      executor: 'constant-arrival-rate',
      rate: 1000,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 200,
      maxVUs: 500,
    },
    // Ramping — finds breaking point
    ramp_payments: {
      executor: 'ramping-arrival-rate',
      startRate: 100,
      timeUnit: '1s',
      stages: [
        { duration: '30s', target: 500 },
        { duration: '30s', target: 1000 },
        { duration: '30s', target: 2000 },
        { duration: '30s', target: 5000 },
        { duration: '30s', target: 1000 },
      ],
      preAllocatedVUs: 500,
      maxVUs: 2000,
    },
  },
  thresholds: {
    'payment_latency_ms': ['p(50)<2', 'p(95)<10', 'p(99)<20'],
    'payment_success_rate': ['rate>0.999'],
    'http_req_failed': ['rate<0.001'],
    'http_req_duration': ['p(95)<50'],
  },
};

// Test data pools
const currencies = ['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES', 'ZAR'];
const paymentMethods = ['card', 'bank_transfer', 'mobile_money', 'ussd', 'qr'];
const banks = ['access-bank', 'gtbank', 'uba', 'zenith', 'firstbank', 'stanbic', 'wema', 'fcmb'];

function generatePaymentRequest() {
  return {
    amount: randomIntBetween(100, 10000000), // 1 NGN to 100K NGN (in kobo)
    currency: currencies[randomIntBetween(0, currencies.length - 1)],
    source_currency: 'NGN',
    dest_currency: currencies[randomIntBetween(0, currencies.length - 1)],
    payment_method: paymentMethods[randomIntBetween(0, paymentMethods.length - 1)],
    sender_id: `user-${randomIntBetween(1, 100000)}`,
    recipient_id: `user-${randomIntBetween(1, 100000)}`,
    recipient_bank: banks[randomIntBetween(0, banks.length - 1)],
    reference: `pay-${randomString(16)}`,
    narration: 'Load test payment',
    idempotency_key: `idem-${randomString(32)}`,
  };
}

export default function () {
  const authToken = authenticate();

  group('Payment Transaction Flow', () => {
    // Step 1: Initiate payment
    const payment = initiatePayment(authToken);
    if (!payment) return;

    // Step 2: FX conversion (if cross-currency)
    if (payment.requires_fx) {
      convertCurrency(authToken, payment.id);
    }

    // Step 3: Execute transfer
    executeTransfer(authToken, payment.id);

    // Step 4: Verify settlement
    verifySettlement(authToken, payment.id);
  });

  sleep(0.1); // Small think time between iterations
}

function authenticate() {
  const res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    username: 'demo',
    password: 'demo',
  }), { headers: { 'Content-Type': 'application/json' } });

  if (res.status === 200) {
    return JSON.parse(res.body).token || 'demo-token';
  }
  return 'demo-token'; // Fallback for dev mode
}

function initiatePayment(token) {
  const payload = generatePaymentRequest();
  const start = Date.now();

  const res = http.post(`${BASE_URL}/api/trpc/payments.initiate`, JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Idempotency-Key': payload.idempotency_key,
    },
    tags: { name: 'InitiatePayment' },
  });

  const latency = Date.now() - start;
  paymentLatency.add(latency);

  const success = check(res, {
    'payment initiated': (r) => r.status === 200 || r.status === 201,
    'has payment id': (r) => {
      try { return JSON.parse(r.body).result?.data?.id !== undefined; }
      catch { return false; }
    },
    'latency < 20ms': () => latency < 20,
  });

  paymentSuccess.add(success ? 1 : 0);
  paymentThroughput.add(1);

  if (success && res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      return body.result?.data || { id: payload.reference, requires_fx: payload.source_currency !== payload.dest_currency };
    } catch {
      return { id: payload.reference, requires_fx: false };
    }
  }
  return { id: payload.reference, requires_fx: false };
}

function convertCurrency(token, paymentId) {
  const start = Date.now();

  const res = http.post(`${BASE_URL}/api/trpc/payments.convertFx`, JSON.stringify({
    payment_id: paymentId,
    source_currency: 'NGN',
    dest_currency: 'USD',
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    tags: { name: 'FXConversion' },
  });

  fxLatency.add(Date.now() - start);

  check(res, {
    'fx conversion ok': (r) => r.status === 200,
    'fx latency < 5ms': () => (Date.now() - start) < 5,
  });
}

function executeTransfer(token, paymentId) {
  const start = Date.now();

  const res = http.post(`${BASE_URL}/api/trpc/payments.execute`, JSON.stringify({
    payment_id: paymentId,
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    tags: { name: 'ExecuteTransfer' },
  });

  paymentLatency.add(Date.now() - start);

  check(res, {
    'transfer executed': (r) => r.status === 200,
  });
}

function verifySettlement(token, paymentId) {
  const start = Date.now();

  const res = http.get(`${BASE_URL}/api/trpc/payments.status?input=${encodeURIComponent(JSON.stringify({ id: paymentId }))}`, {
    headers: { 'Authorization': `Bearer ${token}` },
    tags: { name: 'VerifySettlement' },
  });

  settlementLatency.add(Date.now() - start);

  check(res, {
    'settlement verified': (r) => r.status === 200,
  });
}
