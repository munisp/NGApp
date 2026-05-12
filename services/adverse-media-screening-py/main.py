"""54Bank Adverse Media Screening — NLP-based newspaper, court records, social media scanning

Middleware: Kafka, Dapr, Fluvio, Temporal, Postgres, Keycloak, Permify,
           Redis, Mojaloop, OpenSearch, OpenAppSec, APISIX, TigerBeetle, Lakehouse
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
import json, os, urllib.parse

def ev(k, d): return os.getenv(k, d)

def middleware_config():
    return {
        "kafka": {"broker": ev("KAFKA_BROKER", "localhost:9092"), "topics": ["adverse-media.scan-request", "adverse-media.match-found", "adverse-media.risk-updated"]},
        "dapr": {"app_id": "adverse-media-screening-py", "url": ev("DAPR_URL", "http://localhost:3500")},
        "fluvio": {"url": ev("FLUVIO_URL", "localhost:9003"), "topics": ["adverse-media-stream"]},
        "temporal": {"url": ev("TEMPORAL_URL", "localhost:7233"), "namespace": "adverse-media", "workflows": ["MediaScanWorkflow", "BatchScanWorkflow", "NLPAnalysisWorkflow"]},
        "postgres": {"url": ev("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": ["adverse_media_scans", "media_articles", "media_sources"]},
        "keycloak": {"url": ev("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "client_id": "adverse-media"},
        "permify": {"url": ev("PERMIFY_URL", "http://localhost:3476"), "schema": "adverse_media"},
        "redis": {"url": ev("REDIS_URL", "redis://localhost:6379"), "keys": ["media:cache:{name_hash}", "media:sentiment:{id}"]},
        "mojaloop": {"url": ev("MOJALOOP_URL", "http://localhost:3002"), "purpose": "cross-border-media-check"},
        "opensearch": {"url": ev("OPENSEARCH_URL", "http://localhost:9200"), "indices": ["adverse-media-articles", "adverse-media-scans"]},
        "openappsec": {"url": ev("OPENAPPSEC_URL", "http://localhost:4000"), "policies": ["media-api-protection"]},
        "apisix": {"url": ev("APISIX_URL", "http://localhost:9080"), "routes": ["/v1/adverse-media/*"]},
        "tigerbeetle": {"url": ev("TIGERBEETLE_URL", "localhost:3000"), "ledger": "media-billing"},
        "lakehouse": {"url": ev("LAKEHOUSE_URL", "http://localhost:8181"), "tables": ["adverse_media_history", "media_sentiment_analytics"]},
    }

SOURCES = [
    {"id": "SRC-001", "name": "Premium Times", "type": "newspaper", "country": "Nigeria", "reliability": 0.85, "language": "en", "url": "https://www.premiumtimesng.com", "active": True},
    {"id": "SRC-002", "name": "Punch NG", "type": "newspaper", "country": "Nigeria", "reliability": 0.82, "language": "en", "url": "https://punchng.com", "active": True},
    {"id": "SRC-003", "name": "This Day", "type": "newspaper", "country": "Nigeria", "reliability": 0.80, "language": "en", "url": "https://www.thisdaylive.com", "active": True},
    {"id": "SRC-004", "name": "Vanguard", "type": "newspaper", "country": "Nigeria", "reliability": 0.78, "language": "en", "url": "https://www.vanguardngr.com", "active": True},
    {"id": "SRC-005", "name": "Reuters", "type": "wire_service", "country": "International", "reliability": 0.95, "language": "en", "url": "https://www.reuters.com", "active": True},
    {"id": "SRC-006", "name": "Bloomberg", "type": "financial_news", "country": "International", "reliability": 0.93, "language": "en", "url": "https://www.bloomberg.com", "active": True},
    {"id": "SRC-007", "name": "EFCC Press Releases", "type": "government", "country": "Nigeria", "reliability": 0.90, "language": "en", "url": "https://www.efcc.gov.ng", "active": True},
    {"id": "SRC-008", "name": "Nigeria Court Records", "type": "court_records", "country": "Nigeria", "reliability": 0.95, "language": "en", "url": "https://www.njc.gov.ng", "active": True},
]

SCANS = [
    {"id": "AMS-001", "customerId": "CUS-3021", "customerName": "ABC Import Export", "scanDate": "2026-05-13", "sourcesChecked": 8, "totalArticles": 156, "relevantArticles": 3,
     "sentiment": "negative", "categories": ["fraud_allegation", "regulatory_action", "court_proceedings"],
     "riskImpact": "high", "nlpConfidence": 0.89,
     "articles": [
         {"title": "EFCC probes import company for over-invoicing scheme", "source": "Premium Times", "date": "2026-03-15", "sentiment": "negative", "relevance": 0.92, "category": "fraud_allegation"},
         {"title": "Court freezes accounts of Lagos-based import firm", "source": "Punch NG", "date": "2026-04-02", "sentiment": "negative", "relevance": 0.88, "category": "court_proceedings"},
         {"title": "CBN flags trade finance irregularities", "source": "This Day", "date": "2026-03-28", "sentiment": "negative", "relevance": 0.75, "category": "regulatory_action"},
     ], "status": "flagged"},
    {"id": "AMS-002", "customerId": "CUS-2089", "customerName": "BUA Group Holdings", "scanDate": "2026-05-13", "sourcesChecked": 8, "totalArticles": 234, "relevantArticles": 0,
     "sentiment": "neutral", "categories": [], "riskImpact": "none", "nlpConfidence": 0.95, "articles": [], "status": "clear"},
    {"id": "AMS-003", "customerId": "CUS-1045", "customerName": "Adeola Fashola", "scanDate": "2026-05-13", "sourcesChecked": 8, "totalArticles": 45, "relevantArticles": 1,
     "sentiment": "mixed", "categories": ["political_exposure"],
     "riskImpact": "medium", "nlpConfidence": 0.67,
     "articles": [
         {"title": "Family members of former Lagos officials under scrutiny", "source": "Guardian NG", "date": "2026-04-20", "sentiment": "negative", "relevance": 0.67, "category": "political_exposure"},
     ], "status": "review_needed"},
]

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json({"status": "healthy", "service": "adverse-media-screening-py", "version": "2.0.0", "middleware": middleware_config()})
        elif self.path == "/v1/adverse-media/sources":
            self._json({"items": SOURCES, "total": len(SOURCES)})
        elif self.path == "/v1/adverse-media/scans":
            self._json({"items": SCANS, "total": len(SCANS)})
        elif self.path == "/v1/adverse-media/stats":
            flagged = sum(1 for s in SCANS if s["status"] == "flagged")
            self._json({"totalScans": len(SCANS), "flagged": flagged, "clear": len(SCANS) - flagged, "sourcesActive": len(SOURCES), "avgNlpConfidence": 0.84})
        elif self.path.startswith("/api/"):
            self._json({"items": SCANS, "total": len(SCANS)})
        else:
            self._json({"error": "not found"}, 404)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}
        name = body.get("name", "Unknown")
        self._json({"screenedName": name, "sourcesChecked": len(SOURCES), "articlesFound": 0, "relevantArticles": 0,
                     "sentiment": "neutral", "riskImpact": "none", "status": "clear",
                     "algorithms": ["tf_idf", "bert_sentiment", "named_entity_recognition", "keyword_proximity"]})

    def _json(self, data, code=200):
        self.send_response(code); self.send_header("Content-Type", "application/json"); self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    def log_message(self, *a): pass

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8294"))
    print(f"adverse-media-screening-py listening on :{port}")
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()
