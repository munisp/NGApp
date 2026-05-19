// ─────────────────────────────────────────────────────────────────────────────
// k6 Load Test — Smoke Test (baseline validation)
// Run: k6 run tests/load/k6-smoke.js
// ─────────────────────────────────────────────────────────────────────────────

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("errors");
const latency = new Trend("api_latency", true);

const BASE_URL = __ENV.BASE_URL || "http://localhost:3002";

export const options = {
  stages: [
    { duration: "30s", target: 5 },   // ramp up to 5 users
    { duration: "1m", target: 5 },    // hold at 5 users
    { duration: "10s", target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],  // 95% of requests under 500ms
    errors: ["rate<0.1"],              // error rate below 10%
  },
};

export default function () {
  // Health check
  const health = http.get(`${BASE_URL}/api/health`);
  check(health, {
    "health status 200": (r) => r.status === 200,
  });
  latency.add(health.timings.duration);
  errorRate.add(health.status !== 200);

  // tRPC batch call (common pattern)
  const trpc = http.get(`${BASE_URL}/api/trpc/agentHierarchy.list?input=${encodeURIComponent(JSON.stringify({ limit: 10, offset: 0 }))}`);
  check(trpc, {
    "tRPC status 200": (r) => r.status === 200,
    "tRPC has result": (r) => r.body.includes("result"),
  });
  latency.add(trpc.timings.duration);
  errorRate.add(trpc.status !== 200);

  sleep(1);
}
