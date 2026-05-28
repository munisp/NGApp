/**
 * k6 Load Test — OG-RMM Platform Critical Paths
 *
 * Run: k6 run tests/k6/load-test.js
 *
 * Targets:
 *   - 100 concurrent users
 *   - p95 < 200ms for read endpoints
 *   - Zero errors for critical paths
 */
import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const errorRate = new Rate("errors");
const wellsLatency = new Trend("wells_latency");
const alarmsLatency = new Trend("alarms_latency");
const telemetryLatency = new Trend("telemetry_latency");
const healthLatency = new Trend("health_latency");

export const options = {
  scenarios: {
    smoke: {
      executor: "constant-vus",
      vus: 5,
      duration: "30s",
      tags: { scenario: "smoke" },
    },
    load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 50 },
        { duration: "1m", target: 100 },
        { duration: "30s", target: 100 },
        { duration: "30s", target: 0 },
      ],
      startTime: "30s",
      tags: { scenario: "load" },
    },
    stress: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 200 },
        { duration: "1m", target: 200 },
        { duration: "30s", target: 0 },
      ],
      startTime: "3m",
      tags: { scenario: "stress" },
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<500"],
    "http_req_duration{scenario:smoke}": ["p(95)<200"],
    errors: ["rate<0.05"],
    wells_latency: ["p(95)<200"],
    alarms_latency: ["p(95)<200"],
    health_latency: ["p(95)<50"],
  },
};

export default function () {
  group("Health Check", () => {
    const res = http.get(`${BASE_URL}/health`);
    healthLatency.add(res.timings.duration);
    check(res, {
      "health status 200": (r) => r.status === 200,
      "health body ok": (r) => JSON.parse(r.body).status === "ok",
    }) || errorRate.add(1);
  });

  group("Wells List (tRPC)", () => {
    const res = http.get(`${BASE_URL}/api/trpc/wells.list`);
    wellsLatency.add(res.timings.duration);
    check(res, {
      "wells status 200": (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  group("Alarms List (tRPC)", () => {
    const res = http.get(`${BASE_URL}/api/trpc/alarms.list`);
    alarmsLatency.add(res.timings.duration);
    check(res, {
      "alarms status 200": (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  group("Telemetry Latest (tRPC)", () => {
    const res = http.get(`${BASE_URL}/api/trpc/telemetry.list`);
    telemetryLatency.add(res.timings.duration);
    check(res, {
      "telemetry status 200": (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  group("API Version", () => {
    const res = http.get(`${BASE_URL}/api/version`);
    check(res, {
      "version status 200": (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(Math.random() * 2 + 0.5);
}
