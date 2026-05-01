#!/usr/bin/env python3
"""
NDSEP Fluvio Consumer Worker — Python
Port 8165 | Consumes events from Fluvio topics and routes to downstream services
Implements: topic subscription, event routing, dead-letter queue, Prometheus metrics
"""

import os
import json
import time
import logging
import threading
import queue
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.request import urlopen, Request
from urllib.error import URLError
from datetime import datetime, timezone
from collections import defaultdict

logging.basicConfig(level=logging.INFO, format='[%(asctime)s] [fluvio-consumer] %(message)s')
logger = logging.getLogger(__name__)

PORT = int(os.getenv("FLUVIO_CONSUMER_PORT", "8165"))
FLUVIO_URL = os.getenv("FLUVIO_URL", "http://localhost:9003")
KAFKA_BRIDGE_URL = os.getenv("KAFKA_BRIDGE_URL", "http://localhost:8161")
OPENSEARCH_URL = os.getenv("OPENSEARCH_URL", "http://localhost:9200")

# NDSEP Fluvio topics
NDSEP_TOPICS = [
    "ndsep.compliance.events",
    "ndsep.aml.cases",
    "ndsep.kyc.updates",
    "ndsep.fines.issued",
    "ndsep.accreditation.transitions",
    "ndsep.watchlist.hits",
    "ndsep.breach.notifications",
    "ndsep.cross.agency.alerts",
    "ndsep.sector.metrics",
    "ndsep.audit.trail",
    "ndsep.financial.transactions",
    "ndsep.regulatory.reports",
]

metrics = {
    "messages_consumed": 0,
    "messages_routed": 0,
    "dlq_messages": 0,
    "errors": 0,
    "start_time": time.time(),
    "by_topic": defaultdict(int),
}

# In-memory message buffer (simulates Fluvio consumer group)
message_buffer = queue.Queue(maxsize=10000)
dlq = []  # Dead-letter queue

def post_json(url: str, data: dict) -> dict:
    body = json.dumps(data).encode()
    req = Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    try:
        with urlopen(req, timeout=5) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {"error": str(e)}

def route_event(topic: str, event: dict) -> bool:
    """Route event to appropriate downstream service"""
    try:
        # Route to OpenSearch for indexing
        index = topic.replace(".", "-").replace("ndsep-", "ndsep_")
        post_json(f"{OPENSEARCH_URL}/{index}/_doc", {
            **event,
            "indexed_at": datetime.now(timezone.utc).isoformat(),
            "source_topic": topic,
        })

        # Route high-priority events to Kafka bridge for relay
        if topic in ["ndsep.breach.notifications", "ndsep.cross.agency.alerts", "ndsep.aml.cases"]:
            post_json(f"{KAFKA_BRIDGE_URL}/events/relay", {
                "topic": topic,
                "event": event,
                "priority": "high",
            })

        metrics["messages_routed"] += 1
        metrics["by_topic"][topic] += 1
        return True
    except Exception as e:
        logger.error(f"Route error for topic {topic}: {e}")
        metrics["errors"] += 1
        return False

def consume_loop():
    """Simulate consuming from Fluvio topics"""
    while True:
        try:
            # Try to get a message from the buffer
            try:
                msg = message_buffer.get(timeout=1)
                topic = msg.get("topic", "ndsep.compliance.events")
                event = msg.get("event", {})
                metrics["messages_consumed"] += 1
                if not route_event(topic, event):
                    dlq.append(msg)
                    metrics["dlq_messages"] += 1
                    if len(dlq) > 1000:
                        dlq.pop(0)  # Keep DLQ bounded
            except queue.Empty:
                pass
        except Exception as e:
            metrics["errors"] += 1
            logger.error(f"Consumer loop error: {e}")
        time.sleep(0.01)

def start_consumer_thread():
    t = threading.Thread(target=consume_loop, daemon=True)
    t.start()

class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def send_json(self, data: dict, status: int = 200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length))

    def do_GET(self):
        if self.path == "/health":
            self.send_json({
                "status": "healthy",
                "service": "ndsep-fluvio-consumer",
                "version": "1.0.0",
                "uptime": time.time() - metrics["start_time"],
                "topics": NDSEP_TOPICS,
                "queue_depth": message_buffer.qsize(),
                "dlq_depth": len(dlq),
                "metrics": {k: v for k, v in metrics.items() if k != "by_topic"},
            })
        elif self.path == "/topics":
            self.send_json({"topics": NDSEP_TOPICS, "count": len(NDSEP_TOPICS)})
        elif self.path == "/dlq":
            self.send_json({"dlq": dlq[-20:], "total": len(dlq)})
        elif self.path == "/metrics":
            lines = [
                f"ndsep_fluvio_messages_consumed_total {metrics['messages_consumed']}",
                f"ndsep_fluvio_messages_routed_total {metrics['messages_routed']}",
                f"ndsep_fluvio_dlq_messages_total {metrics['dlq_messages']}",
                f"ndsep_fluvio_errors_total {metrics['errors']}",
                f"ndsep_fluvio_queue_depth {message_buffer.qsize()}",
            ]
            for topic, count in metrics["by_topic"].items():
                safe = topic.replace(".", "_").replace("-", "_")
                lines.append(f"ndsep_fluvio_topic_{safe}_total {count}")
            body = "\n".join(lines).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; version=0.0.4")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_json({"error": "not found"}, 404)

    def do_POST(self):
        body = self.read_body()
        if self.path == "/publish":
            # Accept events to be consumed
            topic = body.get("topic", "ndsep.compliance.events")
            event = body.get("event", body)
            try:
                message_buffer.put_nowait({"topic": topic, "event": event})
                self.send_json({"success": True, "topic": topic, "queued": message_buffer.qsize()})
            except queue.Full:
                self.send_json({"error": "queue full"}, 503)
        elif self.path == "/dlq/replay":
            # Replay DLQ messages
            count = min(body.get("count", 10), len(dlq))
            replayed = []
            for _ in range(count):
                if dlq:
                    msg = dlq.pop(0)
                    message_buffer.put_nowait(msg)
                    replayed.append(msg)
            self.send_json({"success": True, "replayed": len(replayed)})
        else:
            self.send_json({"error": "not found"}, 404)

if __name__ == "__main__":
    logger.info(f"NDSEP Fluvio Consumer starting on port {PORT}")
    logger.info(f"Subscribed to {len(NDSEP_TOPICS)} topics")
    start_consumer_thread()
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    server.serve_forever()
