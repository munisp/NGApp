# Anomaly Detection

**Language:** Python
**Platform:** CRM Multi-Vertical

## Quick Start

```bash
cd services/python/anomaly-detection
pip install -r requirements.txt
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Service port |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | `redis://redis:6379/0` | Redis connection string |
| `KAFKA_BROKERS` | `kafka:9092` | Kafka broker addresses |
| `LOG_LEVEL` | `info` | Log verbosity |

## Health Checks

- `GET /health` — Liveness probe
- `GET /ready` — Readiness probe
- `GET /metrics` — Prometheus metrics

## API

See OpenAPI spec at `GET /swagger/` when running.

## Docker

```bash
docker build -t crm-platform/anomaly-detection:latest .
docker run -p 8080:8080 crm-platform/anomaly-detection:latest
```
