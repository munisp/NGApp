# OG-RMM Platform — Environment Variables Reference

All variables have sensible defaults in `server/_core/env.ts`. The platform starts without any configuration — override as needed for production.

## Core Platform

| Variable | Default | Description |
|---|---|---|
| `VITE_APP_ID` | `og-rmm-platform` | OAuth application ID |
| `JWT_SECRET` | `og-rmm-jwt-secret-change-in-production` | Session cookie signing secret — **change in production** |
| `POSTGRES_URL` | `postgresql://ogrmm:ogrmm_secure_2026@localhost:5432/og_rmm` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `OAUTH_SERVER_URL` | `https://api.manus.im` | Manus OAuth backend |

## SMTP Email

Used by: regulatory scheduler, alarm escalation, shift handover PDF, calibration due-date alerts, materials reorder alerts, PTW approval notifications.

| Variable | Default | Description |
|---|---|---|
| `SMTP_HOST` | `smtp.gmail.com` | SMTP server hostname |
| `SMTP_PORT` | `587` | SMTP port (587=STARTTLS, 465=SSL) |
| `SMTP_SECURE` | `false` | Use SSL (true for port 465) |
| `SMTP_USER` | `og-rmm-notifications@example.com` | SMTP username |
| `SMTP_PASS` | *(required for email)* | SMTP password |
| `EMAIL_DEFAULT_RECIPIENT` | `operations@example.com` | Default alert recipient |

## Kafka / Redpanda

| Variable | Default | Description |
|---|---|---|
| `KAFKA_BROKERS` | `localhost:19092` | Comma-separated broker list |
| `KAFKA_CLIENT_ID` | `og-rmm-server` | Client identifier |
| `KAFKA_GROUP_ID` | `og-rmm-consumers` | Consumer group ID |

## Grafana

| Variable | Default | Description |
|---|---|---|
| `GRAFANA_URL` | `http://localhost:3001` | Grafana base URL |
| `GRAFANA_USER` | `admin` | Admin username |
| `GRAFANA_PASSWORD` | `og-rmm-grafana-admin` | Admin password |
| `GRAFANA_ORG_ID` | `1` | Organization ID |

## InfluxDB

| Variable | Default | Description |
|---|---|---|
| `INFLUXDB_URL` | `http://localhost:8086` | InfluxDB base URL |
| `INFLUXDB_TOKEN` | `og-rmm-influxdb-token-default` | API token |
| `INFLUXDB_ORG` | `og-rmm` | Organization name |
| `INFLUXDB_BUCKET` | `og-telemetry` | Bucket name |

## Field Protocols (Modbus / OPC-UA / DNP3 / MQTT)

| Variable | Default | Description |
|---|---|---|
| `SIMULATION_FALLBACK` | `true` | Set to `false` to use real PLCs |
| `MODBUS_TCP_HOST` | `192.168.1.100` | PLC/RTU IP address |
| `MODBUS_TCP_PORT` | `502` | Modbus TCP port |
| `MODBUS_UNIT_ID` | `1` | Modbus unit/slave ID |
| `OPCUA_ENDPOINT` | `opc.tcp://localhost:4840` | OPC-UA server endpoint |
| `DNP3_MASTER_ADDR` | `1` | DNP3 master station address |
| `DNP3_OUTSTATION_ADDR` | `10` | DNP3 outstation address |
| `MQTT_BROKER_URL` | `mqtt://localhost:1883` | MQTT broker URL |

## Firebase Push Notifications

| Variable | Default | Description |
|---|---|---|
| `FIREBASE_PROJECT_ID` | `og-rmm-platform` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk@og-rmm-platform.iam.gserviceaccount.com` | Service account email |
| `FIREBASE_PRIVATE_KEY` | *(required for push)* | Service account private key (PEM) |
| `FCM_SERVER_KEY` | *(required for push)* | FCM server key |

## Twilio SMS

| Variable | Default | Description |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | *(required for SMS)* | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | *(required for SMS)* | Twilio auth token |
| `TWILIO_FROM_NUMBER` | `+15550000000` | Sender phone number |

## Aveva PI System

| Variable | Default | Description |
|---|---|---|
| `PI_WEB_API_URL` | `https://pi-server.og-rmm.internal/piwebapi` | PI Web API base URL |
| `PI_USERNAME` | `og_rmm_readonly` | PI read-only user |
| `PI_PASSWORD` | *(required)* | PI user password |

## OSDU (Open Subsurface Data Universe)

| Variable | Default | Description |
|---|---|---|
| `OSDU_BASE_URL` | `https://osdu.og-rmm.internal` | OSDU platform base URL |
| `OSDU_CLIENT_ID` | `og-rmm-osdu-client` | OAuth client ID |
| `OSDU_CLIENT_SECRET` | *(required)* | OAuth client secret |
| `OSDU_DATA_PARTITION` | `og-rmm-partition` | Data partition identifier |

## OpenSearch / Elasticsearch (SIEM)

| Variable | Default | Description |
|---|---|---|
| `OPENSEARCH_URL` | `http://localhost:9200` | OpenSearch base URL |
| `OPENSEARCH_USER` | `admin` | Admin username |
| `OPENSEARCH_PASSWORD` | `og-rmm-opensearch-default` | Admin password |

## SAP S/4HANA

| Variable | Default | Description |
|---|---|---|
| `SAP_BASE_URL` | `https://sap-mock.og-rmm.internal` | SAP OData base URL |
| `SAP_USERNAME` | `og_rmm_svc` | Service account username |
| `SAP_PASSWORD` | *(required)* | Service account password |

## Oracle ERP Cloud

| Variable | Default | Description |
|---|---|---|
| `ORACLE_BASE_URL` | `https://oracle-mock.og-rmm.internal` | Oracle REST API base URL |
| `ORACLE_CLIENT_ID` | `og-rmm-oracle-client` | OAuth client ID |
| `ORACLE_CLIENT_SECRET` | *(required)* | OAuth client secret |

## Multi-Tenant Field Isolation

| Variable | Default | Description |
|---|---|---|
| `MULTI_TENANT_ENABLED` | `false` | Enable row-level security by `fieldId` |
| `DEFAULT_FIELD_ID` | `field-001` | Default field when not specified |

## Rate Limiting

| Variable | Default | Description |
|---|---|---|
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window in milliseconds |
| `RATE_LIMIT_MAX_OPERATOR` | `1000` | Max requests/min for operators |
| `RATE_LIMIT_MAX_ADMIN` | `5000` | Max requests/min for admins |
