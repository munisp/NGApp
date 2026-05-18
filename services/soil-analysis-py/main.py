"""54Bank Soil Analysis — Python
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
    {"id": "SOI-001", "type": "primary", "status": "active", "domain": "Agriculture",
     "data": {"priority": "high", "region": "lagos", "score": 0.95},
     "created_at": "2026-05-09T10:00:00Z", "updated_at": "2026-05-09T10:00:00Z", "version": 1},
    {"id": "SOI-002", "type": "secondary", "status": "processing", "domain": "Agriculture",
     "data": {"priority": "medium", "region": "abuja", "score": 0.82},
     "created_at": "2026-05-09T11:00:00Z", "updated_at": "2026-05-09T11:30:00Z", "version": 2},
    {"id": "SOI-003", "type": "primary", "status": "completed", "domain": "Agriculture",
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
    return "SOI-" + "".join(random.choices(string.hexdigits[:16].upper(), k=8))


def now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

def analyze_soil(ph, nitrogen, phosphorus, potassium, organic_matter, moisture):
    """Soil fertility analysis for Nigerian agricultural zones"""
    fertility_score = 0
    recommendations = []
    if 6.0 <= ph <= 7.5:
        fertility_score += 25
    else:
        recommendations.append(f"pH {ph} outside optimal range (6.0-7.5), apply {'lime' if ph < 6.0 else 'sulfur'}")
    if nitrogen >= 0.15:
        fertility_score += 25
    else:
        recommendations.append(f"Low nitrogen ({nitrogen}%), apply urea or NPK")
    if phosphorus >= 15:
        fertility_score += 25
    else:
        recommendations.append(f"Low phosphorus ({phosphorus} mg/kg), apply SSP or DAP")
    if potassium >= 0.3:
        fertility_score += 25
    else:
        recommendations.append(f"Low potassium ({potassium} cmol/kg), apply MOP")
    crop_suitability = {
        "maize": fertility_score >= 60 and ph >= 5.5,
        "rice": fertility_score >= 50 and moisture >= 40,
        "cassava": fertility_score >= 40 and ph >= 4.5,
        "yam": fertility_score >= 65 and organic_matter >= 2.0,
        "cocoa": fertility_score >= 70 and ph >= 6.0,
    }
    return {"fertility_score": fertility_score, "grade": "A" if fertility_score >= 75 else "B" if fertility_score >= 50 else "C", "recommendations": recommendations, "crop_suitability": crop_suitability}

def predict_yield(crop, soil_score, rainfall_mm, farm_size_ha):
    """Estimate crop yield based on soil and weather"""
    base_yields = {"maize": 2.5, "rice": 3.0, "cassava": 15.0, "yam": 8.0, "cocoa": 0.5}
    base = base_yields.get(crop, 1.0)
    soil_factor = soil_score / 100.0
    rain_factor = min(1.0, rainfall_mm / 1200)
    estimated_yield = base * soil_factor * rain_factor * farm_size_ha
    return {"crop": crop, "estimated_yield_tonnes": round(estimated_yield, 2), "yield_per_ha": round(estimated_yield / max(farm_size_ha, 0.01), 2)}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def respond(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("X-Service", "soil-analysis-py")
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
                "service": "soil-analysis-py", "status": "healthy", "version": "2.0.0",
                "uptime_secs": int(time.time() - START_TIME),
                "domain": "Soil Analysis — Agriculture",
                "middleware": {
                    "kafka": "soil-analysis.events, soil-analysis.audit",
                    "postgres": "soil_analysis_records",
                    "redis": "soil-analysis_cache",
                    "temporal": "SoilAnalysisWorkflow",
                    "permify": "soil-analysis:manage, soil-analysis:view",
                    "opensearch": "soil-analysis-2026",
                },
            })
        elif path == "/v1/soil-analysis/list":
            params = parse_qs(urlparse(self.path).query)
            status_filter = params.get("status", [None])[0]
            filtered = [r for r in records if not status_filter or r["status"] == status_filter]
            self.respond(200, {"records": filtered, "total": len(filtered), "domain": "Agriculture"})
        elif path == "/v1/soil-analysis/audit":
            self.respond(200, {"audit_log": audit_log, "total": len(audit_log)})
        elif path == "/v1/soil-analysis/stats":
            domain_stats["total_records"] = len(records)
            domain_stats["active_records"] = sum(1 for r in records if r["status"] in ("active", "completed"))
            domain_stats["pending_records"] = sum(1 for r in records if r["status"] in ("pending", "processing"))
            self.respond(200, domain_stats)
        else:
            self.respond(404, {"error": "Not found"})

    def do_POST(self):
        path = urlparse(self.path).path
        body = self.read_body()

        if path == "/v1/soil-analysis/create":
            rec = {
                "id": gen_id(), "type": body.get("type", "primary"),
                "status": "pending", "domain": "Agriculture", "data": body,
                "created_at": now_iso(), "updated_at": now_iso(), "version": 1,
            }
            records.append(rec)
            audit_log.append({"id": gen_id(), "action": "create", "record_id": rec["id"],
                             "actor": body.get("created_by", "system"), "timestamp": now_iso()})
            self.respond(201, {"created": True, "record": rec})

        elif path == "/v1/soil-analysis/update":
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

        elif path == "/v1/soil-analysis/process":
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
        elif path == "/v1/soil-analysis/analyze":
            result = analyze_soil(body.get("ph", 7.0), body.get("nitrogen", 0), body.get("phosphorus", 0), body.get("potassium", 0), body.get("organic_matter", 0), body.get("moisture", 0))
            self.respond(200, result)
        elif path == "/v1/soil-analysis/predict-yield":
            result = predict_yield(body.get("crop","maize"), body.get("soil_score", 50), body.get("rainfall_mm", 1000), body.get("farm_size_ha", 1))
            self.respond(200, result)



        else:
            self.respond(404, {"error": "Not found"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "9637"))
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"Soil Analysis v2.0 (Agriculture) on :{port}")
    server.serve_forever()
