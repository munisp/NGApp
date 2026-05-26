# Payment Switch Load Testing Suite

Performance and resilience testing using [k6](https://k6.io/).

## Prerequisites

```bash
# Install k6
brew install k6     # macOS
# or
sudo snap install k6  # Linux
# or
docker pull grafana/k6
```

## Quick Start

```bash
# Smoke test (5 VUs, 30s) — verify everything works
k6 run load-testing/scenarios/payment_flow.js --vus 5 --duration 30s

# Standard load test (50 VUs, 2 min steady state)
k6 run load-testing/scenarios/payment_flow.js

# Full platform (all services simultaneously)
k6 run load-testing/scenarios/full_platform.js

# Gateway stress test (find throughput ceiling)
k6 run load-testing/scenarios/gateway_stress.js

# WebSocket resilience (offline/low-bandwidth simulation)
k6 run load-testing/scenarios/websocket_resilience.js
```

## Scenarios

| Scenario | Target | SLO |
|----------|--------|-----|
| `payment_flow.js` | Transaction path | p50 < 2ms, p99 < 20ms, >1000 TPS |
| `gateway_stress.js` | Rust gateway | p50 < 0.8μs, 10K RPS sustained |
| `full_platform.js` | All services | p95 < 50ms, 99.5% success |
| `websocket_resilience.js` | WS under degraded network | <1% message loss, reconnect <500ms |

## Environment Variables

```bash
export BASE_URL=http://localhost:5000      # API server
export ADMIN_URL=http://localhost:3001     # Admin dashboard
export GATEWAY_URL=http://localhost:8080   # Rust gateway
export WS_URL=ws://localhost:5000/ws       # WebSocket endpoint
export TEST_USER=demo
export TEST_PASS=demo
```

## Output & Reporting

```bash
# JSON output for CI
k6 run --out json=results.json load-testing/scenarios/payment_flow.js

# InfluxDB (for Grafana dashboards)
k6 run --out influxdb=http://localhost:8086/k6 load-testing/scenarios/full_platform.js

# Cloud (k6 Cloud)
k6 cloud load-testing/scenarios/full_platform.js
```

## Performance SLOs

| Metric | Target | Critical |
|--------|--------|----------|
| Payment p50 | < 2ms | < 5ms |
| Payment p99 | < 20ms | < 50ms |
| FX lookup p50 | < 1ms | < 5ms |
| Gateway p50 | < 0.8μs | < 5μs |
| Overall success | > 99.9% | > 99.5% |
| Min TPS | 1,000 | 500 |
| Target TPS | 5,000 | 2,000 |

## Load Profiles

- **Smoke**: 5 VUs, 30s — basic functionality check
- **Load**: Ramp to 50 VUs, hold 2 min — standard production load
- **Stress**: Ramp to 1000 VUs — find degradation point
- **Spike**: Jump to 2000 VUs instantly — test auto-scaling
- **Soak**: 200 VUs for 30 min — find memory leaks
- **Breakpoint**: Ramp to 10K VUs — find absolute ceiling
