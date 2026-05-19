// ─────────────────────────────────────────────────────────────────────────────
// k6 Load Test — Stress Test (find breaking point)
// Run: k6 run tests/load/k6-stress.js
// ─────────────────────────────────────────────────────────────────────────────

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

const errorRate = new Rate("errors");
const latency = new Trend("api_latency", true);
const requests = new Counter("total_requests");

const BASE_URL = __ENV.BASE_URL || "http://localhost:3002";

export const options = {
  stages: [
    { duration: "1m", target: 10 },   // ramp up
    { duration: "2m", target: 50 },   // stress
    { duration: "2m", target: 100 },  // peak load
    { duration: "1m", target: 200 },  // breaking point
    { duration: "2m", target: 0 },    // recovery
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"],  // 95% under 2s at peak
    errors: ["rate<0.3"],               // error rate below 30% at peak
  },
};

const ENDPOINTS = [
  "/api/health",
  "/api/trpc/agentHierarchy.list?input=%7B%22limit%22%3A10%2C%22offset%22%3A0%7D",
  "/api/trpc/transactions.list?input=%7B%22limit%22%3A10%2C%22offset%22%3A0%7D",
  "/api/trpc/disputes.list?input=%7B%22limit%22%3A10%2C%22offset%22%3A0%7D",
  "/api/trpc/agentBanking.list?input=%7B%22limit%22%3A10%2C%22offset%22%3A0%7D",
  "/api/trpc/adminDashboard.stats?input=%7B%7D",
];

export default function () {
  const endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
  const res = http.get(`${BASE_URL}${endpoint}`);

  requests.add(1);
  latency.add(res.timings.duration);

  check(res, {
    "status is 200 or 401": (r) => r.status === 200 || r.status === 401,
    "response time < 2000ms": (r) => r.timings.duration < 2000,
  });

  errorRate.add(res.status >= 500);
  sleep(0.5);
}
