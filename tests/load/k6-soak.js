// ─────────────────────────────────────────────────────────────────────────────
// k6 Load Test — Soak Test (memory leaks, connection pool exhaustion)
// Run: k6 run --duration 30m tests/load/k6-soak.js
// ─────────────────────────────────────────────────────────────────────────────

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("errors");
const latency = new Trend("api_latency", true);

const BASE_URL = __ENV.BASE_URL || "http://localhost:3002";

export const options = {
  stages: [
    { duration: "2m", target: 20 },   // ramp up
    { duration: "26m", target: 20 },  // soak at moderate load
    { duration: "2m", target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<1000"],  // 95% under 1s throughout soak
    errors: ["rate<0.05"],              // error rate below 5%
  },
};

export default function () {
  // Mix of read and write operations
  const read = http.get(`${BASE_URL}/api/trpc/agentHierarchy.list?input=${encodeURIComponent(JSON.stringify({ limit: 10, offset: 0 }))}`);
  check(read, { "read ok": (r) => r.status === 200 || r.status === 401 });
  latency.add(read.timings.duration);
  errorRate.add(read.status >= 500);

  // Simulate write (mutation)
  const payload = JSON.stringify({ name: `test-${Date.now()}`, email: `test${Date.now()}@example.com` });
  const write = http.post(`${BASE_URL}/api/trpc/agentOnboarding.submit`, payload, {
    headers: { "Content-Type": "application/json" },
  });
  check(write, { "write ok": (r) => r.status === 200 || r.status === 401 });
  latency.add(write.timings.duration);
  errorRate.add(write.status >= 500);

  sleep(2);
}
