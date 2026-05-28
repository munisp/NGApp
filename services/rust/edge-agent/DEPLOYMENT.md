# Edge Agent Deployment Guide

## Overview

The OG-RMM Edge Agent is a Rust binary that bridges field sensors to the central platform. It supports Modbus TCP/RTU, OPC-UA, DNP3, MQTT, and solar/HPU monitoring. It buffers readings locally and uploads them in batches to the platform's telemetry ingestion endpoint.

---

## Quick Start

```bash
# Build
cargo build --release

# Run with Modbus TCP enabled
WELL_ID=well-001 \
MODBUS_ENABLED=true \
MODBUS_TCP_HOST=192.168.1.100 \
MODBUS_TCP_PORT=502 \
UPSTREAM_URL=https://your-platform.example.com/api/trpc \
./target/release/edge-agent
```

---

## Environment Variables

### Identity

| Variable | Default | Description |
|---|---|---|
| `WELL_ID` | `well-001` | Unique well identifier (must match platform database) |
| `SITE_NAME` | `Well Site 001` | Human-readable site name for logging |

### Modbus TCP/RTU

| Variable | Default | Description |
|---|---|---|
| `MODBUS_ENABLED` | `false` | Set to `true` to enable Modbus polling |
| `MODBUS_TCP_HOST` | _(none)_ | PLC IP address (e.g., `192.168.1.100`) |
| `MODBUS_TCP_PORT` | `502` | Modbus TCP port (standard: 502) |
| `SIMULATION_FALLBACK` | `true` | Fall back to simulation if PLC unreachable |

**Register map (default):**

| Register | Sensor | Unit |
|---|---|---|
| 0 | Tubing Head Pressure | PSI |
| 1 | Casing Head Pressure | PSI |
| 2 | Flow Rate | BBL/day |
| 3 | Bottomhole Temperature | °F |
| 4 | Wellhead Temperature | °F |
| 5 | ESP Current | A |
| 6 | ESP Vibration | mm/s |
| 7 | ESP Frequency | Hz |

### OPC-UA

| Variable | Default | Description |
|---|---|---|
| `OPCUA_ENABLED` | `false` | Set to `true` to enable OPC-UA polling |
| `OPCUA_ENDPOINT` | _(none)_ | OPC-UA server endpoint URL (e.g., `opc.tcp://192.168.1.101:4840`) |

**Supported PLCs:** Allen-Bradley ControlLogix, Siemens S7-1500, Schneider Modicon M580

### DNP3

| Variable | Default | Description |
|---|---|---|
| `DNP3_ENABLED` | `false` | Set to `true` to enable DNP3 polling |
| `DNP3_HOST` | _(none)_ | DNP3 outstation IP address |
| `DNP3_PORT` | `20000` | DNP3 TCP port |
| `DNP3_MASTER_ADDR` | `1` | DNP3 master address (this agent) |
| `DNP3_OUTSTATION_ADDR` | `10` | DNP3 outstation address (RTU/SCADA) |

### MQTT

| Variable | Default | Description |
|---|---|---|
| `MQTT_ENABLED` | `true` | Set to `false` to disable MQTT |
| `MQTT_HOST` | `localhost` | MQTT broker hostname |
| `MQTT_PORT` | `1883` | MQTT broker port |
| `MQTT_USER` | _(none)_ | MQTT username (optional) |
| `MQTT_PASS` | _(none)_ | MQTT password (optional) |

### Solar / HPU Monitoring

| Variable | Default | Description |
|---|---|---|
| `SOLAR_ENABLED` | `false` | Set to `true` to enable solar/HPU monitoring |
| `SOLAR_MONITOR_PIN` | _(none)_ | GPIO pin or ADC channel for solar voltage |

### Platform Connectivity

| Variable | Default | Description |
|---|---|---|
| `UPSTREAM_URL` | `http://telemetry-ingestion:8082` | Platform telemetry ingestion URL |
| `UPLOAD_INTERVAL_MS` | `500` | How often to upload buffered readings (ms) |
| `BATCH_SIZE` | `500` | Max readings per upload batch |
| `BUFFER_MAX_SIZE` | `100000` | Max in-memory buffer size before oldest readings are dropped |
| `STATUS_REPORT_INTERVAL_SECS` | `30` | How often to send site status reports |

---

## Production Deployment Examples

### Minimal: Modbus TCP only

```bash
WELL_ID=well-A01 \
SITE_NAME="Alpha Platform Well A01" \
MODBUS_ENABLED=true \
MODBUS_TCP_HOST=10.0.1.50 \
SIMULATION_FALLBACK=false \
UPSTREAM_URL=https://og-rmm.example.com/api/trpc \
./edge-agent
```

### Full stack: Modbus + OPC-UA + MQTT

```bash
WELL_ID=well-B03 \
MODBUS_ENABLED=true \
MODBUS_TCP_HOST=10.0.2.100 \
OPCUA_ENABLED=true \
OPCUA_ENDPOINT=opc.tcp://10.0.2.101:4840 \
MQTT_ENABLED=true \
MQTT_HOST=10.0.0.10 \
MQTT_USER=edge-agent \
MQTT_PASS=secret \
UPSTREAM_URL=https://og-rmm.example.com/api/trpc \
./edge-agent
```

### Docker / Kubernetes

```yaml
# docker-compose.yml
services:
  edge-agent-well-a01:
    image: og-rmm/edge-agent:latest
    restart: unless-stopped
    environment:
      WELL_ID: well-A01
      MODBUS_ENABLED: "true"
      MODBUS_TCP_HOST: "10.0.1.50"
      MODBUS_TCP_PORT: "502"
      SIMULATION_FALLBACK: "false"
      UPSTREAM_URL: "https://og-rmm.example.com/api/trpc"
    network_mode: host  # Required for direct PLC access
```

```yaml
# kubernetes/edge-agent-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: edge-agent-well-a01
spec:
  replicas: 1
  template:
    spec:
      hostNetwork: true  # Required for direct PLC access
      containers:
      - name: edge-agent
        image: og-rmm/edge-agent:latest
        env:
        - name: WELL_ID
          value: "well-A01"
        - name: MODBUS_ENABLED
          value: "true"
        - name: MODBUS_TCP_HOST
          value: "10.0.1.50"
        - name: SIMULATION_FALLBACK
          value: "false"
        - name: UPSTREAM_URL
          valueFrom:
            secretKeyRef:
              name: og-rmm-secrets
              key: upstream-url
```

---

## Simulation Mode

When `SIMULATION_FALLBACK=true` (default) and the PLC is unreachable, the agent generates realistic simulated readings. This is useful for development and staging. In production, set `SIMULATION_FALLBACK=false` to fail fast if the PLC is unreachable.

---

## Security

The agent implements IEC 62443 TLS 1.3 for all upstream communications. For OPC-UA, configure the server certificate in the `PKI/` directory. For Modbus TCP, ensure the PLC is on a dedicated SCADA VLAN with no direct internet access.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Modbus connection failed` | Wrong IP or port | Verify `MODBUS_TCP_HOST` and `MODBUS_TCP_PORT` |
| `MQTT connection refused` | Broker not running | Check `MQTT_HOST` and broker status |
| `upstream upload failed` | Platform unreachable | Check `UPSTREAM_URL` and network connectivity |
| High buffer depth | Upload interval too slow | Decrease `UPLOAD_INTERVAL_MS` |
| Readings dropped | Buffer overflow | Increase `BUFFER_MAX_SIZE` or decrease `UPLOAD_INTERVAL_MS` |
