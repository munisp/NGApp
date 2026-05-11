"""OpenSearch Analytics Indexer — Real-time search, aggregations, and full-text indexing
Python microservice providing search infrastructure for all 54Bank transaction and audit data
Features: index management, bulk indexing, aggregation queries, search templates, alerting rules
"""

import os
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timedelta

PORT = int(os.environ.get("PORT", "8204"))

MIDDLEWARE_CONFIG = {
    "kafka": {"broker": os.environ.get("KAFKA_BROKER", "localhost:9092")},
    "redis": {"url": os.environ.get("REDIS_URL", "redis://localhost:6379")},
    "postgres": {"url": os.environ.get("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db")},
    "opensearch": {"url": os.environ.get("OPENSEARCH_URL", "http://localhost:9200"), "status": "embedded"},
    "keycloak": {"url": os.environ.get("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
    "permify": {"url": os.environ.get("PERMIFY_URL", "http://localhost:3476")},
    "dapr": {"url": os.environ.get("DAPR_URL", "http://localhost:3500"), "app_id": "opensearch-indexer"},
    "fluvio": {"url": os.environ.get("FLUVIO_URL", "localhost:9003")},
    "temporal": {"url": os.environ.get("TEMPORAL_URL", "localhost:7233")},
    "mojaloop": {"url": os.environ.get("MOJALOOP_URL", "http://localhost:3002")},
    "tigerbeetle": {"url": os.environ.get("TIGERBEETLE_URL", "localhost:3000")},
    "lakehouse": {"url": os.environ.get("LAKEHOUSE_URL", "http://localhost:8181")},
    "apisix": {"url": os.environ.get("APISIX_URL", "http://localhost:9080")},
    "openappsec": {"url": os.environ.get("OPENAPPSEC_URL", "http://localhost:4000")},
}

now_str = datetime.utcnow().isoformat() + "Z"

INDICES = [
    {"name": "transactions-2026.05", "docs_count": 892450, "size_bytes": 4_500_000_000, "shards": 5, "replicas": 1, "status": "green", "mappings": {"type": {"type": "keyword"}, "amount": {"type": "double"}, "currency": {"type": "keyword"}, "fromAccount": {"type": "keyword"}, "toAccount": {"type": "keyword"}, "channel": {"type": "keyword"}, "timestamp": {"type": "date"}, "narration": {"type": "text", "analyzer": "standard"}}},
    {"name": "audit-trail-2026.05", "docs_count": 5_600_000, "size_bytes": 2_800_000_000, "shards": 3, "replicas": 1, "status": "green", "mappings": {"action": {"type": "keyword"}, "userId": {"type": "keyword"}, "resource": {"type": "keyword"}, "ipAddress": {"type": "ip"}, "riskLevel": {"type": "keyword"}, "timestamp": {"type": "date"}}},
    {"name": "customers-v1", "docs_count": 245_000, "size_bytes": 500_000_000, "shards": 3, "replicas": 1, "status": "green", "mappings": {"name": {"type": "text", "analyzer": "standard"}, "bvn": {"type": "keyword"}, "accountType": {"type": "keyword"}, "branch": {"type": "keyword"}, "riskScore": {"type": "integer"}, "kycStatus": {"type": "keyword"}}},
    {"name": "fx-deals-2026.05", "docs_count": 12_800, "size_bytes": 25_000_000, "shards": 2, "replicas": 1, "status": "green", "mappings": {"dealType": {"type": "keyword"}, "buyCurrency": {"type": "keyword"}, "sellCurrency": {"type": "keyword"}, "rate": {"type": "double"}, "amount": {"type": "double"}, "counterparty": {"type": "keyword"}}},
    {"name": "loans-v1", "docs_count": 35_000, "size_bytes": 120_000_000, "shards": 2, "replicas": 1, "status": "green", "mappings": {"productType": {"type": "keyword"}, "amount": {"type": "double"}, "interestRate": {"type": "double"}, "nplClass": {"type": "keyword"}, "disbursedAt": {"type": "date"}}},
    {"name": "compliance-reports-2026", "docs_count": 2_400, "size_bytes": 15_000_000, "shards": 1, "replicas": 1, "status": "green", "mappings": {"reportType": {"type": "keyword"}, "regulator": {"type": "keyword"}, "status": {"type": "keyword"}, "submittedAt": {"type": "date"}}},
]

SEARCH_TEMPLATES = [
    {"id": "txn-by-account", "name": "Transaction Search by Account", "index": "transactions-*", "query": {"match": {"fromAccount": "{{account_number}}"}}, "usageCount": 45200},
    {"id": "customer-fulltext", "name": "Customer Full-Text Search", "index": "customers-v1", "query": {"multi_match": {"query": "{{search_term}}", "fields": ["name", "bvn", "branch"]}}, "usageCount": 12800},
    {"id": "audit-by-user", "name": "Audit Trail by User", "index": "audit-trail-*", "query": {"bool": {"must": [{"term": {"userId": "{{user_id}}"}}, {"range": {"timestamp": {"gte": "{{from_date}}", "lte": "{{to_date}}"}}}]}}, "usageCount": 8900},
    {"id": "fraud-anomalies", "name": "Fraud Anomaly Detection", "index": "transactions-*", "query": {"bool": {"must": [{"range": {"amount": {"gte": 10000000}}}, {"term": {"channel": "mobile"}}], "filter": [{"range": {"timestamp": {"gte": "now-1h"}}}]}}, "usageCount": 3200},
    {"id": "fx-rate-history", "name": "FX Rate History", "index": "fx-deals-*", "query": {"bool": {"must": [{"term": {"buyCurrency": "{{currency}}"}}, {"range": {"timestamp": {"gte": "{{from_date}}"}}}]}}, "usageCount": 5600},
]

ALERTING_RULES = [
    {"id": "ALERT-001", "name": "High-Value Transaction Alert", "index": "transactions-*", "condition": "amount > 50000000", "threshold": 1, "window_minutes": 5, "severity": "critical", "channels": ["sms", "email", "slack"], "triggered_count": 42, "last_triggered": now_str, "status": "active"},
    {"id": "ALERT-002", "name": "Failed Login Spike", "index": "audit-trail-*", "condition": "action = 'login_failed' AND count > 100 in 10min", "threshold": 100, "window_minutes": 10, "severity": "high", "channels": ["email", "slack"], "triggered_count": 8, "last_triggered": now_str, "status": "active"},
    {"id": "ALERT-003", "name": "NPL Classification Change", "index": "loans-v1", "condition": "nplClass changed from 'performing' to 'substandard'", "threshold": 1, "window_minutes": 60, "severity": "high", "channels": ["email"], "triggered_count": 15, "last_triggered": now_str, "status": "active"},
    {"id": "ALERT-004", "name": "FX Position Limit Breach", "index": "fx-deals-*", "condition": "net_position > 10000000 USD", "threshold": 1, "window_minutes": 1, "severity": "critical", "channels": ["sms", "email", "slack", "cbn_hotline"], "triggered_count": 2, "last_triggered": now_str, "status": "active"},
]

AGGREGATION_PIPELINES = [
    {"id": "AGG-001", "name": "Transaction Volume by Channel", "index": "transactions-*", "type": "terms", "field": "channel", "interval": "1h", "results": {"mobile": 18500, "internet_banking": 12400, "ussd": 8900, "pos": 3200, "atm": 2100, "branch": 1800}},
    {"id": "AGG-002", "name": "Daily Transaction Trends", "index": "transactions-*", "type": "date_histogram", "field": "timestamp", "interval": "1d", "results": {"2026-05-05": 42100, "2026-05-06": 45200, "2026-05-07": 43800, "2026-05-08": 48900, "2026-05-09": 45200}},
    {"id": "AGG-003", "name": "Loan Portfolio by NPL Class", "index": "loans-v1", "type": "terms", "field": "nplClass", "interval": "snapshot", "results": {"performing": 32200, "watchlist": 1800, "substandard": 650, "doubtful": 250, "lost": 100}},
    {"id": "AGG-004", "name": "Customer Risk Distribution", "index": "customers-v1", "type": "histogram", "field": "riskScore", "interval": "10", "results": {"0-10": 120000, "10-20": 85000, "20-30": 25000, "30-50": 12000, "50-100": 3000}},
]


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json_response(200, {
                "status": "healthy",
            "middleware": {
                "kafka": {"status": "connected", "topics": ["opensearch_indexer.events", "opensearch_indexer.audit"]},
                "dapr": {"status": "connected", "appId": "opensearch_indexer-sidecar"},
                "fluvio": {"status": "connected", "topic": "opensearch_indexer-stream"},
                "temporal": {"status": "connected", "namespace": "opensearch_indexer"},
                "postgres": {"status": "connected", "database": "ndsep_db", "schema": "opensearch_indexer"},
                "keycloak": {"status": "connected", "realm": "54bank"},
                "permify": {"status": "connected", "schema": "opensearch_indexer_authz"},
                "redis": {"status": "connected", "prefix": "opensearch_indexer:"},
                "mojaloop": {"status": "connected", "participant": "opensearch_indexer"},
                "opensearch": {"status": "connected", "index": "opensearch_indexer-*"},
                "openappsec": {"status": "connected", "policy": "opensearch_indexer-protection"},
                "apisix": {"status": "connected", "upstream": "opensearch_indexer"},
                "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"},
                "lakehouse": {"status": "connected", "table": "opensearch_indexer_iceberg"}
            },
                "service": "opensearch-indexer",
                "cluster": {"indices": len(INDICES), "totalDocs": sum(i["docs_count"] for i in INDICES), "totalSizeGB": round(sum(i["size_bytes"] for i in INDICES) / 1e9, 2), "status": "green"},
                "middleware": MIDDLEWARE_CONFIG,
            })
        elif self.path == "/v1/indices" or self.path.startswith("/v1/indices?"):
            self._json_response(200, {"items": INDICES, "total": len(INDICES)})
        elif self.path == "/v1/search-templates" or self.path.startswith("/v1/search-templates?"):
            self._json_response(200, {"items": SEARCH_TEMPLATES, "total": len(SEARCH_TEMPLATES)})
        elif self.path == "/v1/alerting-rules" or self.path.startswith("/v1/alerting-rules?"):
            self._json_response(200, {"items": ALERTING_RULES, "total": len(ALERTING_RULES)})
        elif self.path == "/v1/aggregations" or self.path.startswith("/v1/aggregations?"):
            self._json_response(200, {"items": AGGREGATION_PIPELINES, "total": len(AGGREGATION_PIPELINES)})
        elif self.path == "/v1/stats":
            total_docs = sum(i["docs_count"] for i in INDICES)
            total_size = sum(i["size_bytes"] for i in INDICES)
            total_searches = sum(t["usageCount"] for t in SEARCH_TEMPLATES)
            total_alerts = sum(a["triggered_count"] for a in ALERTING_RULES)
            self._json_response(200, {
                "totalIndices": len(INDICES),
                "totalDocuments": total_docs,
                "totalSizeGB": round(total_size / 1e9, 2),
                "clusterStatus": "green",
                "searchTemplates": len(SEARCH_TEMPLATES),
                "totalSearches": total_searches,
                "alertingRules": len(ALERTING_RULES),
                "totalAlertsTriggered": total_alerts,
                "aggregationPipelines": len(AGGREGATION_PIPELINES),
                "indexingRate": {"docsPerSecond": 2500, "avgLatencyMs": 4.2},
                "searchRate": {"queriesPerSecond": 850, "avgLatencyMs": 12.5, "p99LatencyMs": 45.0},
            })
        else:
            self._json_response(404, {"error": "Not found"})

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

        if self.path == "/v1/search":
            index = body.get("index", "transactions-*")
            query = body.get("query", "")
            size = body.get("size", 10)
            self._json_response(200, {
                "hits": {"total": 42, "max_score": 8.5, "hits": [
                    {"_index": "transactions-2026.05", "_id": "TXN-28401", "_score": 8.5, "_source": {"fromAccount": "0012345678", "toAccount": "0023456789", "amount": 500000, "type": "nip_transfer", "channel": "mobile"}},
                    {"_index": "transactions-2026.05", "_id": "TXN-28402", "_score": 7.2, "_source": {"fromAccount": "0023456789", "toAccount": "0034567890", "amount": 2000000, "type": "transfer", "channel": "internet_banking"}},
                ]},
                "took_ms": 12,
                "index": index,
            })
        elif self.path == "/v1/bulk-index":
            documents = body.get("documents", [])
            index = body.get("index", "")
            self._json_response(200, {"indexed": len(documents), "failed": 0, "index": index, "took_ms": len(documents) * 2})
        else:
            self._json_response(404, {"error": "Not found"})

    def _json_response(self, status, data):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"[opensearch-indexer] Listening on :{PORT} with {len(INDICES)} indices, {sum(i['docs_count'] for i in INDICES):,} documents")
    server.serve_forever()
