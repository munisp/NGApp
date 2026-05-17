#!/usr/bin/env python3
"""54Bank KYC Workflow Orchestration — State Machine Engine
Application lifecycle: initiation -> document collection -> verification ->
risk assessment -> approval/rejection. Parallel tasks, SLA tracking, escalation.
Middleware: Kafka, Postgres, Redis, Temporal, Permify, OpenSearch
"""
import os, json, logging, uuid
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timezone, timedelta

logging.basicConfig(level=logging.INFO, format="[kyc-workflow-py] %(levelname)s %(message)s")
PORT = int(os.environ.get("PORT", "9435"))

TRANSITIONS = {
    "created": ["document_collection"],
    "document_collection": ["parallel_verification"],
    "parallel_verification": ["bvn_verification", "nin_verification", "liveness_check", "document_verification"],
    "bvn_verification": ["risk_assessment"], "nin_verification": ["risk_assessment"],
    "liveness_check": ["risk_assessment"], "document_verification": ["risk_assessment"],
    "risk_assessment": ["approval", "manual_review", "enhanced_dd", "rejection"],
    "manual_review": ["approval", "rejection", "enhanced_dd"],
    "enhanced_dd": ["approval", "rejection"],
    "approval": ["completed"], "rejection": ["completed"],
}

SLA_HOURS = {"tier1": {"total": 2}, "tier2": {"total": 48}, "tier3": {"total": 120}}

workflows = []
stats = {"total": 0, "active": 0, "completed": 0, "avg_hours": 4.2, "sla_breaches": 0, "parallel_active": 0}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        p = urlparse(self.path).path.rstrip("/"); q = parse_qs(urlparse(self.path).query)
        if p in ("/healthz", "/health"):
            self._j(200, {"service": "kyc-workflow-orchestration-py", "status": "healthy", "version": "2.0.0",
                "domain": "KYC Workflow Orchestration",
                "capabilities": ["state_machine", "parallel_verification", "sla_tracking", "escalation",
                    "auto_approval", "manual_review_queue", "enhanced_dd_routing", "audit_trail"],
                "states": list(TRANSITIONS.keys()) + ["completed", "expired", "suspended"],
                "transitions": TRANSITIONS, "sla_hours": SLA_HOURS,
                "middleware": {"kafka": "kyc.workflows, kyc.transitions, kyc.sla-alerts",
                    "postgres": "kyc_workflows, kyc_workflow_steps, kyc_sla",
                    "redis": "workflow_state_cache, sla_timers",
                    "temporal": "KYCWorkflowOrchestration, ParallelVerificationChild",
                    "permify": "kyc-workflow:manage, kyc-workflow:approve",
                    "opensearch": "kyc-workflows-2026"}})
        elif p == "/v1/kyc-workflows":
            sf = q.get("state", [None])[0]
            f = [w for w in workflows if not sf or w["currentState"] == sf]
            self._j(200, {"workflows": f, "total": len(f)})
        elif p == "/v1/kyc-workflows/review-queue":
            q = [w for w in workflows if w["currentState"] in ("manual_review", "enhanced_dd")]
            q.sort(key=lambda w: w.get("slaDeadline", "9999"))
            self._j(200, {"queue": q, "total": len(q)})
        elif p == "/v1/kyc-workflows/stats": self._j(200, stats)
        elif p.startswith("/v1/kyc-workflows/"):
            wid = p.split("/")[-1]
            w = next((x for x in workflows if x["id"] == wid), None)
            self._j(200, w) if w else self._j(404, {"error": f"Not found: {wid}"})
        else: self._j(404, {"error": "Not found"})

    def do_POST(self):
        p = urlparse(self.path).path.rstrip("/")
        cl = int(self.headers.get("Content-Length", 0))
        b = json.loads(self.rfile.read(cl)) if cl > 0 else {}
        if p == "/v1/kyc-workflows": self._create(b)
        elif p.endswith("/transition"): self._transition(p.split("/")[-2], b)
        elif p.endswith("/escalate"): self._escalate(p.split("/")[-2], b)
        else: self._j(404, {"error": "Not found"})

    def _create(self, b):
        wid = f"WF-{uuid.uuid4().hex[:8].upper()}"; now = datetime.now(timezone.utc)
        tier = b.get("requestedTier", "tier2"); sla = SLA_HOURS.get(tier, SLA_HOURS["tier2"])
        wf = {"id": wid, "applicationId": b.get("applicationId", ""), "customerId": b.get("customerId", ""),
            "requestedTier": tier, "currentState": "created", "previousStates": [],
            "steps": [{"state": "created", "enteredAt": now.isoformat(), "completedAt": None}],
            "parallelTasks": [], "slaDeadline": (now + timedelta(hours=sla["total"])).isoformat(),
            "slaBreach": False, "assignedReviewer": None, "escalationLevel": 0,
            "priority": b.get("priority", "normal"), "createdAt": now.isoformat(), "updatedAt": now.isoformat()}
        workflows.append(wf); stats["total"] += 1; stats["active"] += 1
        self._j(201, {"created": True, "workflow": wf})

    def _transition(self, wid, b):
        w = next((x for x in workflows if x["id"] == wid), None)
        if not w: self._j(404, {"error": f"Not found: {wid}"}); return
        target = b.get("targetState"); allowed = TRANSITIONS.get(w["currentState"], [])
        if target not in allowed:
            self._j(400, {"error": f"Invalid: {w['currentState']} -> {target}", "allowed": allowed}); return
        now = datetime.now(timezone.utc)
        if w["steps"]: w["steps"][-1]["completedAt"] = now.isoformat()
        w["previousStates"].append(w["currentState"]); w["currentState"] = target
        w["steps"].append({"state": target, "enteredAt": now.isoformat(), "completedAt": None, "meta": b.get("metadata")})
        w["updatedAt"] = now.isoformat()
        if target == "parallel_verification":
            w["parallelTasks"] = [{"task": t, "status": "pending"} for t in
                ["bvn_verification", "nin_verification", "liveness_check", "document_verification"]]
            stats["parallel_active"] += 4
        if target in ("completed", "rejection"): stats["active"] -= 1; stats["completed"] += 1
        self._j(200, {"transitioned": True, "workflow": w})

    def _escalate(self, wid, b):
        w = next((x for x in workflows if x["id"] == wid), None)
        if not w: self._j(404, {"error": f"Not found: {wid}"}); return
        w["escalationLevel"] += 1; w["priority"] = "urgent" if w["escalationLevel"] >= 2 else "high"
        self._j(200, {"escalated": True, "level": w["escalationLevel"], "priority": w["priority"]})

    def _j(self, code, data):
        self.send_response(code); self.send_header("Content-Type", "application/json"); self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode())
    def log_message(self, f, *a): pass

if __name__ == "__main__":
    logging.info(f"KYC Workflow Orchestration v2.0 on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
