#!/usr/bin/env python3
"""
NDSEP Layer 5 — Fluvio Edge Telemetry Ingestion Worker (Python)
================================================================
Simulates Fluvio edge stream ingestion for low-latency packet metadata.
Performs:
  - Edge agent telemetry ingestion from IXP sites
  - Sub-100ms latency event processing
  - Packet metadata aggregation
  - Cross-border flow detection via Fluvio streams
  - Throughput and latency metrics reporting
  - Edge node health monitoring

Technology: Python · Fluvio · Apache Kafka · Protocol Buffers (simulated)
"""

import os
import time
import json
import random
import logging
import threading
import http.server
import socketserver
import collections
from datetime import datetime, timezone

import requests
import psycopg2

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

DB_URL = os.environ.get(
    "WORKER_DATABASE_URL",
    "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"
)
RELAY_URL = os.environ.get("WORKER_RELAY_URL", "http://localhost:3000/api/workers/event")
FLUVIO_HTTP_URL = os.environ.get("FLUVIO_HTTP_URL", "http://localhost:9003")
FLUVIO_HTTP_ENABLED = os.environ.get("FLUVIO_HTTP_ENABLED", "true").lower() == "true"
PORT = int(os.environ.get("FLUVIO_PORT", "8087"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [NDSEP-Fluvio] %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
log = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Global State
# ─────────────────────────────────────────────────────────────────────────────

events_processed = 0
packets_ingested = 0
cross_border_detected = 0
worker_start = time.time()

# ─────────────────────────────────────────────────────────────────────────────
# IXP Edge Node Definitions
# ─────────────────────────────────────────────────────────────────────────────

IXP_SITES = [
    {"id": "IXP-LOS-01", "name": "Lagos IXP", "city": "Lagos", "lat": 6.5244, "lon": 3.3792, "capacity_gbps": 100},
    {"id": "IXP-ABJ-01", "name": "Abuja IXP", "city": "Abuja", "lat": 9.0765, "lon": 7.3986, "capacity_gbps": 40},
    {"id": "IXP-PHC-01", "name": "Port Harcourt IXP", "city": "Port Harcourt", "lat": 4.8156, "lon": 7.0498, "capacity_gbps": 20},
    {"id": "IXP-KAN-01", "name": "Kano IXP", "city": "Kano", "lat": 12.0022, "lon": 8.5920, "capacity_gbps": 20},
]

FLUVIO_TOPICS = [
    "fluvio.edge.telemetry",
    "fluvio.ixp.packets",
    "fluvio.alerts.realtime",
    "fluvio.enforcement.fast",
]

PROTOCOLS = ["TCP", "UDP", "HTTPS", "HTTP", "DNS", "SMTP", "FTP", "SSH", "QUIC"]
COUNTRIES = ["NG", "US", "GB", "DE", "CN", "ZA", "FR", "IN", "SG", "AE"]

# ─────────────────────────────────────────────────────────────────────────────
# Real Fluvio HTTP Producer
# ─────────────────────────────────────────────────────────────────────────────

_fluvio_connected = False
_fluvio_produced = 0
_fluvio_errors = 0

def fluvio_health_check() -> bool:
    """Check Fluvio HTTP gateway connectivity."""
    global _fluvio_connected
    if not FLUVIO_HTTP_ENABLED:
        return False
    try:
        r = requests.get(f"{FLUVIO_HTTP_URL}/health", timeout=3)
        ok = r.status_code == 200
        if ok and not _fluvio_connected:
            log.info(f"[Fluvio] Connected to HTTP gateway at {FLUVIO_HTTP_URL}")
        _fluvio_connected = ok
        return ok
    except Exception:
        _fluvio_connected = False
        return False

def fluvio_produce(topic: str, payload: dict) -> bool:
    """Produce a record to a Fluvio topic via the HTTP gateway."""
    global _fluvio_produced, _fluvio_errors
    if not FLUVIO_HTTP_ENABLED or not _fluvio_connected:
        return False
    try:
        r = requests.post(
            f"{FLUVIO_HTTP_URL}/produce/{topic}",
            json={"key": topic, "value": payload},
            timeout=3,
        )
        if r.status_code < 300:
            _fluvio_produced += 1
            return True
        _fluvio_errors += 1
        return False
    except Exception:
        _fluvio_errors += 1
        return False

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def get_db():
    return psycopg2.connect(DB_URL)

def broadcast(event: str, data: dict):
    try:
        requests.post(RELAY_URL, json={"event": event, "data": data}, timeout=2)
    except Exception:
        pass

def random_ip():
    return f"{random.randint(1,254)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}"

def get_org_ids(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT id, name FROM organizations LIMIT 20")
        return cur.fetchall()

# ─────────────────────────────────────────────────────────────────────────────
# Fluvio Edge Telemetry Ingestion
# ─────────────────────────────────────────────────────────────────────────────

def run_edge_telemetry_ingestion():
    """Ingests edge telemetry from IXP Fluvio streams and writes network events."""
    global events_processed, packets_ingested, cross_border_detected

    log.info("Starting Fluvio edge telemetry ingestion...")

    while True:
        try:
            conn = get_db()
            conn.autocommit = True
            orgs = get_org_ids(conn)

            if not orgs:
                conn.close()
                time.sleep(8)
                continue

            # Process 3-8 packets per cycle (simulating Fluvio stream consumption)
            batch_size = random.randint(3, 8)
            for _ in range(batch_size):
                ixp = random.choice(IXP_SITES)
                org_id, org_name = random.choice(orgs)
                protocol = random.choice(PROTOCOLS)
                src_ip = random_ip()
                dst_ip = random_ip()
                src_country = "NG"
                dst_country = random.choice(COUNTRIES)
                is_cross_border = dst_country != "NG"
                bytes_transferred = random.randint(512, 10_000_000)
                latency_ms = random.randint(1, 15) if not is_cross_border else random.randint(50, 300)
                is_blocked = random.random() < 0.08
                is_encrypted = random.random() < 0.75
                topic = random.choice(FLUVIO_TOPICS)

                if is_cross_border:
                    cross_border_detected += 1

                # Write to network_events table
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO network_events
                            (organization_id, source_ip, destination_ip, protocol,
                             bytes_transferred, is_cross_border, is_blocked,
                             ixp_site, metadata, detected_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    """, (
                        org_id, src_ip, dst_ip, protocol,
                        bytes_transferred, is_cross_border, is_blocked,
                        ixp["id"],
                        json.dumps({"is_encrypted": is_encrypted, "latency_ms": latency_ms, "topic": topic})
                    ))

                packets_ingested += 1

                # Broadcast the packet event
                event_payload = {
                    "type": "fluvio_packet_ingested",
                    "ixpSite": ixp["id"],
                    "ixpName": ixp["name"],
                    "organizationId": org_id,
                    "organizationName": org_name,
                    "sourceIp": src_ip,
                    "destinationIp": dst_ip,
                    "protocol": protocol,
                    "bytesTransferred": bytes_transferred,
                    "isCrossBorder": is_cross_border,
                    "isBlocked": is_blocked,
                    "isEncrypted": is_encrypted,
                    "srcCountry": src_country,
                    "dstCountry": dst_country,
                    "latencyMs": latency_ms,
                    "fluvioTopic": topic,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
                # Produce to real Fluvio HTTP gateway
                fluvio_produce(topic, event_payload)
                broadcast("fluvio_packet_ingested", event_payload)

                # Broadcast cross-border alert
                if is_cross_border and random.random() < 0.3:
                    broadcast("cross_border_flow_detected", {
                        "type": "cross_border_flow_detected",
                        "organizationId": org_id,
                        "organizationName": org_name,
                        "sourceIp": src_ip,
                        "destinationIp": dst_ip,
                        "destinationCountry": dst_country,
                        "bytesTransferred": bytes_transferred,
                        "protocol": protocol,
                        "ixpSite": ixp["id"],
                        "severity": "high" if bytes_transferred > 5_000_000 else "medium",
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    })

            events_processed += 1
            log.info(f"Ingested {batch_size} packets from Fluvio streams | Cross-border: {cross_border_detected}")

            conn.close()

        except Exception as e:
            log.error(f"Edge telemetry ingestion error: {e}")

        time.sleep(8)

# ─────────────────────────────────────────────────────────────────────────────
# IXP Health Monitor
# ─────────────────────────────────────────────────────────────────────────────

def run_ixp_health_monitor():
    """Broadcasts IXP site health and throughput metrics."""
    log.info("Starting IXP health monitor...")

    while True:
        try:
            ixp_metrics = []
            for ixp in IXP_SITES:
                utilization = random.uniform(0.15, 0.92)
                throughput_gbps = round(ixp["capacity_gbps"] * utilization, 2)
                ixp_metrics.append({
                    "id": ixp["id"],
                    "name": ixp["name"],
                    "city": ixp["city"],
                    "lat": ixp["lat"],
                    "lon": ixp["lon"],
                    "capacityGbps": ixp["capacity_gbps"],
                    "throughputGbps": throughput_gbps,
                    "utilizationPct": round(utilization * 100, 1),
                    "packetsPerSec": random.randint(10000, 500000),
                    "activeFlows": random.randint(1000, 50000),
                    "status": "healthy" if utilization < 0.85 else "congested",
                    "latencyMs": random.randint(1, 8),
                    "edgeNodes": random.randint(3, 12),
                })

            broadcast("ixp_health_update", {
                "type": "ixp_health_update",
                "sites": ixp_metrics,
                "totalCapacityGbps": sum(s["capacity_gbps"] for s in IXP_SITES),
                "timestamp": datetime.now(timezone.utc).isoformat()
            })

        except Exception as e:
            log.warning(f"IXP health monitor error: {e}")

        time.sleep(15)

# ─────────────────────────────────────────────────────────────────────────────
# Fluvio Stream Metrics
# ─────────────────────────────────────────────────────────────────────────────

def run_fluvio_stream_metrics():
    """Broadcasts Fluvio stream throughput and latency metrics."""
    log.info("Starting Fluvio stream metrics reporter...")

    while True:
        try:
            topic_metrics = []
            for topic in FLUVIO_TOPICS:
                topic_metrics.append({
                    "topic": topic,
                    "messagesPerSec": random.randint(1000, 100000),
                    "latencyMs": random.randint(1, 12),
                    "bytesPerSec": random.randint(100000, 50000000),
                    "consumerLag": random.randint(0, 50),
                    "partitions": random.randint(4, 16),
                    "status": "healthy",
                })

            broadcast("fluvio_stream_metrics", {
                "type": "fluvio_stream_metrics",
                "topics": topic_metrics,
                "totalMessagesPerSec": sum(t["messagesPerSec"] for t in topic_metrics),
                "avgLatencyMs": round(sum(t["latencyMs"] for t in topic_metrics) / len(topic_metrics), 1),
                "timestamp": datetime.now(timezone.utc).isoformat()
            })

        except Exception as e:
            log.warning(f"Fluvio metrics error: {e}")

        time.sleep(10)


def run_stream_analytics():
    """Real-time stream analytics: DDoS detection, traffic anomalies, bandwidth alerts."""
    log.info("Starting Fluvio stream analytics (DDoS detection, bandwidth anomaly)...")
    ip_packet_counts = collections.defaultdict(int)
    window_start = time.time()
    DDOS_THRESHOLD = 5000

    while True:
        try:
            conn = get_db()
            conn.autocommit = True
            orgs = get_org_ids(conn)

            if time.time() - window_start > 30:
                ip_packet_counts.clear()
                window_start = time.time()

            if random.random() < 0.12 and orgs:
                attacker_ip = random_ip()
                burst = random.randint(3000, 15000)
                ip_packet_counts[attacker_ip] += burst

                if ip_packet_counts[attacker_ip] >= DDOS_THRESHOLD:
                    org_id, org_name = random.choice(orgs)
                    title = f"[DDoS] Volumetric Attack Detected from {attacker_ip}"
                    desc = (
                        f"DDoS attack: {ip_packet_counts[attacker_ip]:,} packets/30s "
                        f"from {attacker_ip} targeting {org_name}. "
                        f"Threshold: {DDOS_THRESHOLD:,} pps. Auto-blocking initiated."
                    )
                    with conn.cursor() as cur:
                        cur.execute("""
                            INSERT INTO security_alerts
                                (organization_id, title, description, severity, source, alert_type, created_at)
                            VALUES (%s, %s, %s, 'critical', 'Fluvio-StreamAnalytics', 'ddos', NOW())
                        """, (org_id, title, desc))
                    broadcast("ddos_detected", {
                        "type": "ddos_detected",
                        "attackerIp": attacker_ip,
                        "packetsPerWindow": ip_packet_counts[attacker_ip],
                        "threshold": DDOS_THRESHOLD,
                        "organizationId": org_id,
                        "organizationName": org_name,
                        "action": "auto_block",
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    })
                    log.info(f"DDoS detected: {attacker_ip} -> {ip_packet_counts[attacker_ip]:,} pps")

            if random.random() < 0.08 and orgs:
                org_id, org_name = random.choice(orgs)
                anomaly_bps = random.randint(10_000_000_000, 100_000_000_000)
                broadcast("bandwidth_anomaly", {
                    "type": "bandwidth_anomaly",
                    "organizationId": org_id,
                    "organizationName": org_name,
                    "bitsPerSecond": anomaly_bps,
                    "gbps": round(anomaly_bps / 1e9, 2),
                    "baselineGbps": round(random.uniform(0.5, 5.0), 2),
                    "deviationFactor": round(anomaly_bps / (random.uniform(0.5, 5.0) * 1e9), 1),
                    "engine": "Fluvio-StreamAnalytics",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })

            conn.close()
        except Exception as e:
            log.warning(f"Stream analytics error: {e}")
        time.sleep(8)

# ─────────────────────────────────────────────────────────────────────────────
# HTTP Status Server
# ─────────────────────────────────────────────────────────────────────────────

class StatusHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_GET(self):
        if self.path == "/health":
            body = json.dumps({"status": "ok", "worker": "fluvio_telemetry"}).encode()
        elif self.path == "/status":
            body = json.dumps({
                "id": "fluvio-telemetry",
                "name": "Fluvio Edge Telemetry",
                "layer": "L5",
                "language": "Python",
                "status": "running",
                "lastRun": datetime.now(timezone.utc).isoformat(),
                "eventsProcessed": events_processed,
                "description": "Ingests low-latency edge telemetry from 4 IXP sites via Fluvio streams. Performs real-time DDoS detection, bandwidth anomaly analysis, and cross-border flow enforcement.",
                "technology": "Python · Fluvio · Apache Kafka · IXP Edge Nodes · DDoS Detection"
            }).encode()
        elif self.path == "/metrics":
            body = json.dumps({
                "eventsProcessed": events_processed,
                "packetsIngested": packets_ingested,
                "crossBorderDetected": cross_border_detected,
                "ixpSites": len(IXP_SITES),
                "fluvioTopics": len(FLUVIO_TOPICS),
                "uptimeSeconds": round(time.time() - worker_start, 1)
            }).encode()
        else:
            self.send_response(404)
            self.end_headers()
            return

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

def start_status_server():
    with socketserver.TCPServer(("", PORT), StatusHandler) as httpd:
        log.info(f"Status server listening on :{PORT}")
        httpd.serve_forever()

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    log.info("=== NDSEP Layer 5 Fluvio Edge Telemetry Worker (Python) ===")
    log.info(f"Port: {PORT} | IXP Sites: {len(IXP_SITES)} | Fluvio: {FLUVIO_HTTP_URL}")
    # Attempt initial Fluvio HTTP gateway connection
    fluvio_health_check()
    # Periodic Fluvio health re-check
    def _fluvio_health_loop():
        while True:
            time.sleep(30)
            fluvio_health_check()
    threading.Thread(target=_fluvio_health_loop, daemon=True).start()
    broadcast("worker_started", {
        "worker": "fluvio_telemetry",
        "layer": "L5",
        "language": "Python",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

    threading.Thread(target=run_edge_telemetry_ingestion, daemon=True).start()
    threading.Thread(target=run_ixp_health_monitor, daemon=True).start()
    threading.Thread(target=run_fluvio_stream_metrics, daemon=True).start()
    threading.Thread(target=run_stream_analytics, daemon=True).start()

    start_status_server()
