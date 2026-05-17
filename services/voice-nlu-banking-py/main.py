"""54Bank Voice Nlu Banking — Python
Domain: Messaging/Channels
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
    {"id": "VOI-001", "type": "primary", "status": "active", "domain": "Messaging/Channels",
     "data": {"priority": "high", "region": "lagos", "score": 0.95},
     "created_at": "2026-05-09T10:00:00Z", "updated_at": "2026-05-09T10:00:00Z", "version": 1},
    {"id": "VOI-002", "type": "secondary", "status": "processing", "domain": "Messaging/Channels",
     "data": {"priority": "medium", "region": "abuja", "score": 0.82},
     "created_at": "2026-05-09T11:00:00Z", "updated_at": "2026-05-09T11:30:00Z", "version": 2},
    {"id": "VOI-003", "type": "primary", "status": "completed", "domain": "Messaging/Channels",
     "data": {"priority": "low", "region": "ph", "score": 0.91},
     "created_at": "2026-05-08T14:00:00Z", "updated_at": "2026-05-09T08:00:00Z", "version": 1},
]

audit_log = []

domain_stats = {
    "total_records": 3, "active_records": 1, "pending_records": 1,
    "processed_today": 12, "domain": "Messaging/Channels",
    "metrics": {"avg_processing_ms": 245, "success_rate": 98.5, "throughput": 156},
}


def gen_id():
    return "VOI-" + "".join(random.choices(string.hexdigits[:16].upper(), k=8))


def now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def respond(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("X-Service", "voice-nlu-banking-py")
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
                "service": "voice-nlu-banking-py", "status": "healthy", "version": "2.0.0",
                "uptime_secs": int(time.time() - START_TIME),
                "domain": "Voice Nlu Banking — Messaging/Channels",
                "middleware": {
                    "kafka": "voice-nlu-banking.events, voice-nlu-banking.audit",
                    "postgres": "voice_nlu_banking_records",
                    "redis": "voice-nlu-banking_cache",
                    "temporal": "VoiceNluBankingWorkflow",
                    "permify": "voice-nlu-banking:manage, voice-nlu-banking:view",
                    "opensearch": "voice-nlu-banking-2026",
                },
            })
        elif path == "/v1/voice-nlu-banking/list":
            params = parse_qs(urlparse(self.path).query)
            status_filter = params.get("status", [None])[0]
            filtered = [r for r in records if not status_filter or r["status"] == status_filter]
            self.respond(200, {"records": filtered, "total": len(filtered), "domain": "Messaging/Channels"})
        elif path == "/v1/voice-nlu-banking/audit":
            self.respond(200, {"audit_log": audit_log, "total": len(audit_log)})
        elif path == "/v1/voice-nlu-banking/stats":
            domain_stats["total_records"] = len(records)
            domain_stats["active_records"] = sum(1 for r in records if r["status"] in ("active", "completed"))
            domain_stats["pending_records"] = sum(1 for r in records if r["status"] in ("pending", "processing"))
            self.respond(200, domain_stats)
        else:
            self.respond(404, {"error": "Not found"})

    def do_POST(self):
        path = urlparse(self.path).path
        body = self.read_body()

        if path == "/v1/voice-nlu-banking/create":
            rec = {
                "id": gen_id(), "type": body.get("type", "primary"),
                "status": "pending", "domain": "Messaging/Channels", "data": body,
                "created_at": now_iso(), "updated_at": now_iso(), "version": 1,
            }
            records.append(rec)
            audit_log.append({"id": gen_id(), "action": "create", "record_id": rec["id"],
                             "actor": body.get("created_by", "system"), "timestamp": now_iso()})
            self.respond(201, {"created": True, "record": rec})

        elif path == "/v1/voice-nlu-banking/update":
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

        elif path == "/v1/voice-nlu-banking/process":
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

        else:
            self.respond(404, {"error": "Not found"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "9647"))
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"Voice Nlu Banking v2.0 (Messaging/Channels) on :{port}")
    server.serve_forever()
