# OG-RMM Platform — Environment Variable Reference

All environment variables required for production deployment.

## Core

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `production` | Runtime environment |
| `PORT` | `3000` | HTTP server port |

## Database

| Variable | Example | Description |
|---|---|---|
| `POSTGRES_URL` | `postgresql://ogrmm:secret@localhost:5432/ogrmm` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |

## Authentication

| Variable | Description |
|---|---|
| `JWT_SECRET` | Session signing secret (min 32 chars) |
| `VITE_APP_ID` | Manus OAuth application ID |
| `OAUTH_SERVER_URL` | OAuth backend URL |
| `VITE_OAUTH_PORTAL_URL` | OAuth portal URL |
| `OWNER_OPEN_ID` | Platform owner's open ID |
| `OWNER_NAME` | Platform owner's display name |

## Payment Providers

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (`pk_live_...`) |
| `PAYPAL_CLIENT_ID` | PayPal OAuth2 client ID |
| `PAYPAL_CLIENT_SECRET` | PayPal OAuth2 client secret |
| `PAYPAL_ENVIRONMENT` | `sandbox` or `production` |

## Email (Optional — leave blank to disable)

| Variable | Default | Description |
|---|---|---|
| `SMTP_HOST` | — | SMTP server hostname |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASS` | — | SMTP password |
| `ALARM_ESCALATION_EMAILS` | — | Comma-separated escalation recipients |

## Messaging & Streaming

| Variable | Default | Description |
|---|---|---|
| `KAFKA_BROKERS` | `localhost:9092` | Redpanda/Kafka broker addresses |
| `KAFKA_TOPIC_TELEMETRY` | `og-telemetry` | Telemetry ingestion topic |
| `INFLUXDB_URL` | `http://localhost:8086` | InfluxDB URL |
| `INFLUXDB_TOKEN` | `og-rmm-influx-token` | InfluxDB API token |
| `INFLUXDB_ORG` | `og-rmm` | InfluxDB organization |
| `INFLUXDB_BUCKET` | `telemetry` | InfluxDB bucket |

## AI & ML

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API URL |
| `OLLAMA_MODEL` | `llama3.2` | Default Ollama model |
| `OLLAMA_VISION_MODEL` | `qwen2.5-vl:7b` | Vision model for drone AI defect detection |
| `BUILT_IN_FORGE_API_URL` | — | Manus built-in LLM API URL |
| `BUILT_IN_FORGE_API_KEY` | — | Manus built-in LLM API key |

## Observability

| Variable | Default | Description |
|---|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4317` | OTel collector gRPC endpoint |
| `OTEL_SERVICE_NAME` | `og-rmm-app` | Service name for distributed traces |

## External Integrations

| Variable | Description |
|---|---|
| `PI_SERVER_URL` | OSIsoft PI Server URL |
| `OSDU_BASE_URL` | OSDU R3 API base URL |
| `OPCUA_SERVER_URL` | OPC-UA server endpoint |
| `SAP_BASE_URL` | SAP PM API URL |
| `MAXIMO_BASE_URL` | IBM Maximo API URL |
| `KEYCLOAK_URL` | Keycloak server URL |
| `APISIX_ADMIN_URL` | APISIX admin API URL |
| `APISIX_ADMIN_KEY` | APISIX admin API key |
| `PERMIFY_HOST` | Permify authorization server host |
| `TIGERBEETLE_ADDRESS` | TigerBeetle ledger address |

## Push Notifications

| Variable | Description |
|---|---|
| `VAPID_PUBLIC_KEY` | VAPID public key for Web Push |
| `VAPID_PRIVATE_KEY` | VAPID private key for Web Push |
| `VITE_VAPID_PUBLIC_KEY` | VAPID public key (frontend) |
