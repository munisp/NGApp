#!/usr/bin/env python3
"""54Bank KYC Self-Service Portal — Customer-facing KYC management
Status tracking, document upload, tier upgrade requests, re-verification.
Middleware: Kafka, Postgres, Redis, Temporal, Permify
"""
import os, json, logging, uuid
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO, format="[kyc-self-service-py] %(levelname)s %(message)s")
PORT = int(os.environ.get("PORT", "9434"))

customer_profiles = [
    {"customerId": "CUS-001", "firstName": "John", "lastName": "Oko", "tier": "tier2", "status": "verified",
        "bvnVerified": True, "ninVerified": False, "livenessVerified": True,
        "documents": [{"type": "national_id", "status": "verified"}, {"type": "utility_bill", "status": "expired"}],
        "upgradeEligible": True, "nextUpgrade": "tier3",
        "missingForUpgrade": ["nin", "utility_bill"], "lastVerifiedAt": "2026-04-15T10:00:00Z"},
    {"customerId": "CUS-002", "firstName": "Grace", "lastName": "Okafor", "tier": "tier3", "status": "verified",
        "bvnVerified": True, "ninVerified": True, "livenessVerified": True,
        "documents": [{"type": "national_id", "status": "verified"}, {"type": "utility_bill", "status": "verified"},
            {"type": "bank_statement", "status": "verified"}],
        "upgradeEligible": False, "nextUpgrade": None, "missingForUpgrade": [],
        "lastVerifiedAt": "2026-03-20T14:00:00Z"},
]
upload_queue = []
stats = {"total_profiles": len(customer_profiles), "self_service_uploads": 0, "upgrade_requests": 0,
    "reverification_requests": 0, "avg_resolution_hours": 6.0}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        p = urlparse(self.path).path.rstrip("/")
        if p in ("/healthz", "/health"):
            self._j(200, {"service": "kyc-self-service-py", "status": "healthy", "version": "2.0.0",
                "domain": "KYC Self-Service Portal",
                "capabilities": ["status_tracking", "document_upload", "tier_upgrade_request",
                    "reverification", "profile_view", "document_expiry_alerts", "upload_progress"],
                "middleware": {"kafka": "kyc.self-service.uploads, kyc.self-service.requests",
                    "postgres": "kyc_self_service_profiles, kyc_upload_queue",
                    "redis": "upload_progress (TTL 1h)", "temporal": "KYCSelfServiceWorkflow",
                    "permify": "kyc-self:view, kyc-self:upload"}})
        elif p.startswith("/v1/kyc-self-service/profile/"):
            cid = p.split("/")[-1]
            prof = next((x for x in customer_profiles if x["customerId"] == cid), None)
            self._j(200, prof) if prof else self._j(404, {"error": f"Not found: {cid}"})
        elif p == "/v1/kyc-self-service/upload-queue":
            self._j(200, {"queue": upload_queue, "total": len(upload_queue)})
        elif p == "/v1/kyc-self-service/stats": self._j(200, stats)
        else: self._j(404, {"error": "Not found"})

    def do_POST(self):
        p = urlparse(self.path).path.rstrip("/")
        cl = int(self.headers.get("Content-Length", 0))
        b = json.loads(self.rfile.read(cl)) if cl > 0 else {}
        if p == "/v1/kyc-self-service/upload-document":
            uid = f"UPL-{uuid.uuid4().hex[:8].upper()}"
            entry = {"id": uid, "customerId": b.get("customerId", ""), "documentType": b.get("documentType", ""),
                "status": "processing", "ocrRouting": "paddleocr_v4",
                "submittedAt": datetime.now(timezone.utc).isoformat()}
            upload_queue.append(entry); stats["self_service_uploads"] += 1
            self._j(201, {"uploaded": True, "upload": entry})
        elif p == "/v1/kyc-self-service/request-upgrade":
            stats["upgrade_requests"] += 1
            self._j(200, {"requested": True, "customerId": b.get("customerId"),
                "targetTier": b.get("targetTier", "tier3"), "status": "pending_review"})
        elif p == "/v1/kyc-self-service/request-reverification":
            stats["reverification_requests"] += 1
            self._j(200, {"requested": True, "customerId": b.get("customerId"), "status": "scheduled"})
        else: self._j(404, {"error": "Not found"})

    def _j(self, code, data):
        self.send_response(code); self.send_header("Content-Type", "application/json"); self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode())
    def log_message(self, f, *a): pass

if __name__ == "__main__":
    logging.info(f"KYC Self-Service v2.0 on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
