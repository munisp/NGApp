/**
 * k6 Load Test: Telemetry Ingestion Service
 * 
 * Tests the telemetry ingestion endpoint under realistic OG-RMM load patterns:
 * - Ramp up to 100 concurrent sensor streams
 * - Sustain for 5 minutes at peak load
 * - Verify p95 latency < 200ms and error rate < 0.1%
 * 
 * Run: k6 run tests/load/k6/telemetry-ingestion.js
 * Run with output: k6 run --out influxdb=http://localhost:8086/k6 tests/load/k6/telemetry-ingestion.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const ingestLatency = new Trend('ingest_latency_ms', true);
const batchesIngested = new Counter('batches_ingested');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Warm up: ramp to 10 VUs
    { duration: '1m', target: 50 },    // Ramp up: 50 concurrent sensor streams
    { duration: '3m', target: 100 },   // Peak load: 100 concurrent sensor streams
    { duration: '1m', target: 50 },    // Scale down
    { duration: '30s', target: 0 },    // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],  // 95th percentile < 200ms
    errors: ['rate<0.001'],                           // Error rate < 0.1%
    http_req_failed: ['rate<0.001'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// Generate realistic sensor telemetry payload
function generateTelemetryBatch(wellId, sensorCount = 5) {
  const sensors = [];
  const now = Date.now();
  
  for (let i = 0; i < sensorCount; i++) {
    sensors.push({
      sensorId: `SENSOR-${wellId}-${String(i).padStart(3, '0')}`,
      wellId: wellId,
      timestamp: new Date(now - Math.floor(Math.random() * 5000)).toISOString(),
      measurements: {
        pressure_psi: 2000 + Math.random() * 500,
        temperature_f: 150 + Math.random() * 50,
        flow_rate_bpd: 500 + Math.random() * 200,
        gas_oil_ratio: 800 + Math.random() * 100,
        water_cut_pct: Math.random() * 20,
        choke_position_pct: 70 + Math.random() * 20,
      },
      quality: Math.random() > 0.05 ? 'GOOD' : 'UNCERTAIN',
    });
  }
  
  return {
    batchId: `BATCH-${wellId}-${now}`,
    source: 'k6-load-test',
    sensors,
  };
}

export default function () {
  // Simulate 50 different wells
  const wellId = `WELL-${String(Math.floor(Math.random() * 50) + 1).padStart(4, '0')}`;
  
  const payload = JSON.stringify(generateTelemetryBatch(wellId, 5));
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Source': 'k6-load-test',
      'X-Well-Id': wellId,
    },
    timeout: '10s',
  };
  
  const startTime = Date.now();
  const res = http.post(`${BASE_URL}/ingest/batch`, payload, params);
  const duration = Date.now() - startTime;
  
  // Record metrics
  ingestLatency.add(duration);
  batchesIngested.add(1);
  
  const success = check(res, {
    'status is 200 or 202': (r) => r.status === 200 || r.status === 202,
    'response has batchId': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.batchId !== undefined || body.accepted !== undefined;
      } catch {
        return false;
      }
    },
    'response time < 200ms': () => duration < 200,
  });
  
  errorRate.add(!success);
  
  // Simulate realistic sensor polling interval (100ms between batches)
  sleep(0.1);
}

export function handleSummary(data) {
  return {
    'tests/load/results/telemetry-ingestion-summary.json': JSON.stringify(data, null, 2),
    stdout: formatSummary(data),
  };
}

function formatSummary(data) {
  const metrics = data.metrics;
  const p95 = metrics.http_req_duration?.values?.['p(95)'] ?? 0;
  const p99 = metrics.http_req_duration?.values?.['p(99)'] ?? 0;
  const errRate = metrics.errors?.values?.rate ?? 0;
  const totalBatches = metrics.batches_ingested?.values?.count ?? 0;
  
  return `
=== Telemetry Ingestion Load Test Results ===
Total batches ingested: ${totalBatches}
p95 latency: ${p95.toFixed(2)}ms (threshold: <200ms) ${p95 < 200 ? '✅' : '❌'}
p99 latency: ${p99.toFixed(2)}ms (threshold: <500ms) ${p99 < 500 ? '✅' : '❌'}
Error rate: ${(errRate * 100).toFixed(3)}% (threshold: <0.1%) ${errRate < 0.001 ? '✅' : '❌'}
`;
}
