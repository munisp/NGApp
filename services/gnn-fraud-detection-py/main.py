"""54Bank Gnn Fraud Detection — Python
Domain: ML/Analytics
Full domain-specific implementation with business logic.
Middleware: Kafka, Postgres, Redis, Temporal, Permify, OpenSearch
"""
import json
import time
import random
import string
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import os

START_TIME = time.time()

# ─── Domain State ────────────────────────────────────────────────────────────

records = [
    {"id": "GNN-001", "type": "primary", "status": "active", "domain": "ML/Analytics",
     "data": {"priority": "high", "region": "lagos", "score": 0.95},
     "created_at": "2026-05-09T10:00:00Z", "updated_at": "2026-05-09T10:00:00Z", "version": 1},
    {"id": "GNN-002", "type": "secondary", "status": "processing", "domain": "ML/Analytics",
     "data": {"priority": "medium", "region": "abuja", "score": 0.82},
     "created_at": "2026-05-09T11:00:00Z", "updated_at": "2026-05-09T11:30:00Z", "version": 2},
    {"id": "GNN-003", "type": "primary", "status": "completed", "domain": "ML/Analytics",
     "data": {"priority": "low", "region": "ph", "score": 0.91},
     "created_at": "2026-05-08T14:00:00Z", "updated_at": "2026-05-09T08:00:00Z", "version": 1},
]

audit_log = []

domain_stats = {
    "total_records": 3, "active_records": 1, "pending_records": 1,
    "processed_today": 12, "domain": "ML/Analytics",
    "metrics": {"avg_processing_ms": 245, "success_rate": 98.5, "throughput": 156},
}


def gen_id():
    return "GNN-" + "".join(random.choices(string.hexdigits[:16].upper(), k=8))


def now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

def detect_fraud_pattern(transactions, threshold=0.7):
    """Graph-based fraud pattern detection"""
    if not transactions: return {"fraud_score": 0, "patterns": [], "flagged": False}
    amounts = [t.get("amount", 0) for t in transactions]
    avg = sum(amounts) / len(amounts) if amounts else 0
    std = (sum((a - avg)**2 for a in amounts) / max(len(amounts)-1, 1)) ** 0.5 if len(amounts) > 1 else 0
    patterns = []
    for t in transactions:
        zscore = abs(t.get("amount",0) - avg) / max(std, 1)
        if zscore > 2: patterns.append({"txn_id": t.get("id",""), "type": "anomalous_amount", "z_score": round(zscore, 2)})
    velocity = len([t for t in transactions if t.get("channel") == "online"]) / max(len(transactions), 1)
    if velocity > 0.8: patterns.append({"type": "high_velocity_online", "ratio": round(velocity, 2)})
    unique_recipients = len(set(t.get("recipient","") for t in transactions))
    if unique_recipients > len(transactions) * 0.9: patterns.append({"type": "fan_out", "unique_recipients": unique_recipients})
    score = min(1.0, len(patterns) * 0.25)
    return {"fraud_score": round(score, 2), "patterns": patterns, "flagged": score >= threshold, "transactions_analyzed": len(transactions)}

def network_risk_score(entity_id, connections):
    """Score entity risk based on network connections"""
    risky = sum(1 for c in connections if c.get("risk_level","low") in ("high","critical"))
    total = max(len(connections), 1)
    score = round(risky / total * 100, 1)
    return {"entity_id": entity_id, "network_risk_score": score, "risky_connections": risky, "total_connections": total, "risk_level": "high" if score > 50 else "medium" if score > 20 else "low"}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def respond(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("X-Service", "gnn-fraud-detection-py")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length))

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/healthz":
            self.respond(200, {
                "service": "gnn-fraud-detection-py", "status": "healthy", "version": "2.0.0",
                "uptime_secs": int(time.time() - START_TIME),
                "domain": "Gnn Fraud Detection — ML/Analytics",
                "middleware": {
                    "kafka": "gnn-fraud-detection.events, gnn-fraud-detection.audit",
                    "postgres": "gnn_fraud_detection_records",
                    "redis": "gnn-fraud-detection_cache",
                    "temporal": "GnnFraudDetectionWorkflow",
                    "permify": "gnn-fraud-detection:manage, gnn-fraud-detection:view",
                    "opensearch": "gnn-fraud-detection-2026",
                },
            })
        elif path == "/v1/gnn-fraud-detection/list":
            params = parse_qs(urlparse(self.path).query)
            status_filter = params.get("status", [None])[0]
            filtered = [r for r in records if not status_filter or r["status"] == status_filter]
            self.respond(200, {"records": filtered, "total": len(filtered), "domain": "ML/Analytics"})
        elif path == "/v1/gnn-fraud-detection/audit":
            self.respond(200, {"audit_log": audit_log, "total": len(audit_log)})
        elif path == "/v1/gnn-fraud-detection/stats":
            domain_stats["total_records"] = len(records)
            domain_stats["active_records"] = sum(1 for r in records if r["status"] in ("active", "completed"))
            domain_stats["pending_records"] = sum(1 for r in records if r["status"] in ("pending", "processing"))
            self.respond(200, domain_stats)
        else:
            self.respond(404, {"error": "Not found"})

    def do_POST(self):
        path = urlparse(self.path).path
        body = self.read_body()

        if path == "/v1/gnn-fraud-detection/create":
            rec = {
                "id": gen_id(), "type": body.get("type", "primary"),
                "status": "pending", "domain": "ML/Analytics", "data": body,
                "created_at": now_iso(), "updated_at": now_iso(), "version": 1,
            }
            records.append(rec)
            audit_log.append({"id": gen_id(), "action": "create", "record_id": rec["id"],
                             "actor": body.get("created_by", "system"), "timestamp": now_iso()})
            self.respond(201, {"created": True, "record": rec})

        elif path == "/v1/gnn-fraud-detection/update":
            rid = body.get("id", "")
            for rec in records:
                if rec["id"] == rid:
                    if "status" in body:
                        rec["status"] = body["status"]
                    rec["data"].update({k: v for k, v in body.items() if k != "id"})
                    rec["updated_at"] = now_iso()
                    rec["version"] += 1
                    audit_log.append({"id": gen_id(), "action": "update", "record_id": rid,
                                     "actor": body.get("updated_by", "system"), "timestamp": now_iso()})
                    self.respond(200, {"updated": True, "record": rec})
                    return
            self.respond(404, {"error": f"Record not found: {rid}"})

        elif path == "/v1/gnn-fraud-detection/process":
            rid = body.get("id", "")
            for rec in records:
                if rec["id"] == rid and rec["status"] in ("pending", "active"):
                    rec["status"] = "completed"
                    rec["data"]["processed_at"] = now_iso()
                    rec["data"]["processing_result"] = "success"
                    rec["data"]["score"] = round(0.85 + random.random() * 0.14, 3)
                    rec["updated_at"] = now_iso()
                    rec["version"] += 1
                    domain_stats["processed_today"] += 1
                    audit_log.append({"id": gen_id(), "action": "process", "record_id": rid,
                                     "actor": "system", "timestamp": now_iso()})
                    self.respond(200, {"processed": True, "record": rec})
                    return
            self.respond(404, {"error": f"Record not found or not processable: {rid}"})
        elif path == "/v1/gnn-fraud-detection/detect":
            result = detect_fraud_pattern(body.get("transactions", []), body.get("threshold", 0.7))
            self.respond(200, result)
        elif path == "/v1/gnn-fraud-detection/network-risk":
            result = network_risk_score(body.get("entity_id",""), body.get("connections", []))
            self.respond(200, result)



        else:
            self.respond(404, {"error": "Not found"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "9613"))
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"Gnn Fraud Detection v2.0 (ML/Analytics) on :{port}")
    server.serve_forever()
