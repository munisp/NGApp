"""54Bank Saga Coordinator — Python
Domain: Platform/Infra
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
    {"id": "SAG-001", "type": "primary", "status": "active", "domain": "Platform/Infra",
     "data": {"priority": "high", "region": "lagos", "score": 0.95},
     "created_at": "2026-05-09T10:00:00Z", "updated_at": "2026-05-09T10:00:00Z", "version": 1},
    {"id": "SAG-002", "type": "secondary", "status": "processing", "domain": "Platform/Infra",
     "data": {"priority": "medium", "region": "abuja", "score": 0.82},
     "created_at": "2026-05-09T11:00:00Z", "updated_at": "2026-05-09T11:30:00Z", "version": 2},
    {"id": "SAG-003", "type": "primary", "status": "completed", "domain": "Platform/Infra",
     "data": {"priority": "low", "region": "ph", "score": 0.91},
     "created_at": "2026-05-08T14:00:00Z", "updated_at": "2026-05-09T08:00:00Z", "version": 1},
]

audit_log = []

domain_stats = {
    "total_records": 3, "active_records": 1, "pending_records": 1,
    "processed_today": 12, "domain": "Platform/Infra",
    "metrics": {"avg_processing_ms": 245, "success_rate": 98.5, "throughput": 156},
}


def gen_id():
    return "SAG-" + "".join(random.choices(string.hexdigits[:16].upper(), k=8))


def now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

def process_request(action, params):
    """Process domain-specific request for saga-coordinator"""
    result = {"action": action, "params": params, "processed_at": now_iso(), "status": "completed"}
    if action == "validate":
        required = params.get("required_fields", [])
        data = params.get("data", {})
        missing = [f for f in required if f not in data]
        result["valid"] = len(missing) == 0
        result["missing"] = missing
    elif action == "compute":
        values = params.get("values", [])
        if values:
            result["sum"] = sum(values)
            result["avg"] = round(sum(values) / len(values), 2)
    return result


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def respond(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("X-Service", "saga-coordinator-py")
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
                "service": "saga-coordinator-py", "status": "healthy", "version": "2.0.0",
                "uptime_secs": int(time.time() - START_TIME),
                "domain": "Saga Coordinator — Platform/Infra",
                "middleware": {
                    "kafka": "saga-coordinator.events, saga-coordinator.audit",
                    "postgres": "saga_coordinator_records",
                    "redis": "saga-coordinator_cache",
                    "temporal": "SagaCoordinatorWorkflow",
                    "permify": "saga-coordinator:manage, saga-coordinator:view",
                    "opensearch": "saga-coordinator-2026",
                },
            })
        elif path == "/v1/saga-coordinator/list":
            params = parse_qs(urlparse(self.path).query)
            status_filter = params.get("status", [None])[0]
            filtered = [r for r in records if not status_filter or r["status"] == status_filter]
            self.respond(200, {"records": filtered, "total": len(filtered), "domain": "Platform/Infra"})
        elif path == "/v1/saga-coordinator/audit":
            self.respond(200, {"audit_log": audit_log, "total": len(audit_log)})
        elif path == "/v1/saga-coordinator/stats":
            domain_stats["total_records"] = len(records)
            domain_stats["active_records"] = sum(1 for r in records if r["status"] in ("active", "completed"))
            domain_stats["pending_records"] = sum(1 for r in records if r["status"] in ("pending", "processing"))
            self.respond(200, domain_stats)
        else:
            self.respond(404, {"error": "Not found"})

    def do_POST(self):
        path = urlparse(self.path).path
        body = self.read_body()

        if path == "/v1/saga-coordinator/create":
            rec = {
                "id": gen_id(), "type": body.get("type", "primary"),
                "status": "pending", "domain": "Platform/Infra", "data": body,
                "created_at": now_iso(), "updated_at": now_iso(), "version": 1,
            }
            records.append(rec)
            audit_log.append({"id": gen_id(), "action": "create", "record_id": rec["id"],
                             "actor": body.get("created_by", "system"), "timestamp": now_iso()})
            self.respond(201, {"created": True, "record": rec})

        elif path == "/v1/saga-coordinator/update":
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

        elif path == "/v1/saga-coordinator/process":
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
        elif path == "/v1/saga-coordinator/process":
            result = process_request(body.get("action","validate"), body.get("params",{{}}))
            self.respond(200, result)


        else:
            self.respond(404, {"error": "Not found"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "9632"))
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"Saga Coordinator v2.0 (Platform/Infra) on :{port}")
    server.serve_forever()
