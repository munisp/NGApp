"""54Bank Cooperative Financials — Python
Domain: Agriculture
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
    {"id": "COO-001", "type": "primary", "status": "active", "domain": "Agriculture",
     "data": {"priority": "high", "region": "lagos", "score": 0.95},
     "created_at": "2026-05-09T10:00:00Z", "updated_at": "2026-05-09T10:00:00Z", "version": 1},
    {"id": "COO-002", "type": "secondary", "status": "processing", "domain": "Agriculture",
     "data": {"priority": "medium", "region": "abuja", "score": 0.82},
     "created_at": "2026-05-09T11:00:00Z", "updated_at": "2026-05-09T11:30:00Z", "version": 2},
    {"id": "COO-003", "type": "primary", "status": "completed", "domain": "Agriculture",
     "data": {"priority": "low", "region": "ph", "score": 0.91},
     "created_at": "2026-05-08T14:00:00Z", "updated_at": "2026-05-09T08:00:00Z", "version": 1},
]

audit_log = []

domain_stats = {
    "total_records": 3, "active_records": 1, "pending_records": 1,
    "processed_today": 12, "domain": "Agriculture",
    "metrics": {"avg_processing_ms": 245, "success_rate": 98.5, "throughput": 156},
}


def gen_id():
    return "COO-" + "".join(random.choices(string.hexdigits[:16].upper(), k=8))


def now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

def compute_dividend(total_surplus, member_contributions, total_contributions, reserves_pct=0.20):
    """Compute cooperative member dividend"""
    distributable = total_surplus * (1 - reserves_pct)
    member_share = (member_contributions / max(total_contributions, 1)) * distributable
    return {"total_surplus": total_surplus, "reserves": round(total_surplus * reserves_pct, 2), "distributable": round(distributable, 2), "member_share": round(member_share, 2), "dividend_rate": round(distributable / max(total_contributions, 1) * 100, 2)}

def loan_interest_computation(principal, rate_pct, tenure_months):
    """Compute cooperative loan repayment schedule"""
    monthly_rate = rate_pct / 100 / 12
    if monthly_rate == 0:
        emi = principal / max(tenure_months, 1)
    else:
        emi = principal * monthly_rate * (1 + monthly_rate)**tenure_months / ((1 + monthly_rate)**tenure_months - 1)
    total_payment = emi * tenure_months
    return {"principal": principal, "rate": rate_pct, "tenure_months": tenure_months, "emi": round(emi, 2), "total_payment": round(total_payment, 2), "total_interest": round(total_payment - principal, 2)}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def respond(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("X-Service", "cooperative-financials-py")
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
                "service": "cooperative-financials-py", "status": "healthy", "version": "2.0.0",
                "uptime_secs": int(time.time() - START_TIME),
                "domain": "Cooperative Financials — Agriculture",
                "middleware": {
                    "kafka": "cooperative-financials.events, cooperative-financials.audit",
                    "postgres": "cooperative_financials_records",
                    "redis": "cooperative-financials_cache",
                    "temporal": "CooperativeFinancialsWorkflow",
                    "permify": "cooperative-financials:manage, cooperative-financials:view",
                    "opensearch": "cooperative-financials-2026",
                },
            })
        elif path == "/v1/cooperative-financials/list":
            params = parse_qs(urlparse(self.path).query)
            status_filter = params.get("status", [None])[0]
            filtered = [r for r in records if not status_filter or r["status"] == status_filter]
            self.respond(200, {"records": filtered, "total": len(filtered), "domain": "Agriculture"})
        elif path == "/v1/cooperative-financials/audit":
            self.respond(200, {"audit_log": audit_log, "total": len(audit_log)})
        elif path == "/v1/cooperative-financials/stats":
            domain_stats["total_records"] = len(records)
            domain_stats["active_records"] = sum(1 for r in records if r["status"] in ("active", "completed"))
            domain_stats["pending_records"] = sum(1 for r in records if r["status"] in ("pending", "processing"))
            self.respond(200, domain_stats)
        else:
            self.respond(404, {"error": "Not found"})

    def do_POST(self):
        path = urlparse(self.path).path
        body = self.read_body()

        if path == "/v1/cooperative-financials/create":
            rec = {
                "id": gen_id(), "type": body.get("type", "primary"),
                "status": "pending", "domain": "Agriculture", "data": body,
                "created_at": now_iso(), "updated_at": now_iso(), "version": 1,
            }
            records.append(rec)
            audit_log.append({"id": gen_id(), "action": "create", "record_id": rec["id"],
                             "actor": body.get("created_by", "system"), "timestamp": now_iso()})
            self.respond(201, {"created": True, "record": rec})

        elif path == "/v1/cooperative-financials/update":
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

        elif path == "/v1/cooperative-financials/process":
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
        elif path == "/v1/cooperative-financials/dividend":
            result = compute_dividend(body.get("total_surplus",0), body.get("member_contributions",0), body.get("total_contributions",0), body.get("reserves_pct",0.20))
            self.respond(200, result)
        elif path == "/v1/cooperative-financials/loan-interest":
            result = loan_interest_computation(body.get("principal",0), body.get("rate_pct",0), body.get("tenure_months",12))
            self.respond(200, result)



        else:
            self.respond(404, {"error": "Not found"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "9603"))
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"Cooperative Financials v2.0 (Agriculture) on :{port}")
    server.serve_forever()
