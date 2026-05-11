"""54Bank KYB (Know Your Business) Engine — business verification and due diligence."""
from http.server import HTTPServer, BaseHTTPRequestHandler
import json, os

SEED_DATA = [
    {"id": "KYB-001", "businessName": "Dangote Industries Limited", "rcNumber": "RC-6789", "tinNumber": "TIN-1234567890", "status": "verified", "riskScore": 15, "sector": "Manufacturing", "incorporationDate": "1981-05-06", "state": "Lagos", "directors": ["Aliko Dangote", "Halima Dangote"], "verifiedAt": "2026-05-01T10:00:00Z"},
    {"id": "KYB-002", "businessName": "BUA Group", "rcNumber": "RC-12345", "tinNumber": "TIN-9876543210", "status": "verified", "riskScore": 12, "sector": "Conglomerate", "incorporationDate": "1988-03-15", "state": "Lagos", "directors": ["Abdul Samad Rabiu"], "verifiedAt": "2026-05-02T11:00:00Z"},
    {"id": "KYB-003", "businessName": "Paystack Payments Limited", "rcNumber": "RC-1456789", "tinNumber": "TIN-5551234567", "status": "pending_review", "riskScore": 25, "sector": "Fintech", "incorporationDate": "2015-01-20", "state": "Lagos", "directors": ["Shola Akinlade", "Ezra Olubi"], "verifiedAt": None},
    {"id": "KYB-004", "businessName": "Flutterwave Inc", "rcNumber": "RC-1567890", "tinNumber": "TIN-7778889990", "status": "verified", "riskScore": 18, "sector": "Fintech", "incorporationDate": "2016-06-10", "state": "Lagos", "directors": ["Olugbenga Agboola"], "verifiedAt": "2026-04-28T09:00:00Z"},
    {"id": "KYB-005", "businessName": "Kuda Technologies", "rcNumber": "RC-1678901", "tinNumber": "TIN-3334445556", "status": "enhanced_due_diligence", "riskScore": 45, "sector": "Digital Banking", "incorporationDate": "2019-02-14", "state": "Lagos", "directors": ["Babs Ogundeyi"], "verifiedAt": None},
]

STATS = {"total_businesses": 5, "verified": 3, "pending_review": 1, "enhanced_due_diligence": 1, "avg_risk_score": 23.0, "compliance_rate": 60.0}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json({"status": "healthy", "service": "kyb-engine-py", "port": 8260})
        elif self.path.startswith("/v1/kyb/businesses"):
            self._json({"items": SEED_DATA, "total": len(SEED_DATA)})
        elif self.path.startswith("/v1/stats"):
            self._json(STATS)
        else:
            self._json({"items": [], "total": 0})
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}
        body["id"] = f"KYB-{len(SEED_DATA)+1:03d}"
        body["status"] = "pending_review"
        SEED_DATA.append(body)
        self._json(body, 201)
    def _json(self, data, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode())

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8260))
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()
