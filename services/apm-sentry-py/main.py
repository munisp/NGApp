from http.server import HTTPServer, BaseHTTPRequestHandler
import json, os

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        routes = {
            "/healthz": lambda: {"status": "healthy", "service": "apm-sentry-py", "port": PORT},
            "/api/apm-sentry/config": lambda: {
                "sentry": {
                    "dsn": "https://***@o123.ingest.sentry.io/456",
                    "environment": "production", "release": "54bank@2.0.0",
                    "traces_sample_rate": 0.1, "profiles_sample_rate": 0.1,
                    "integrations": ["express", "postgres", "redis", "kafka"],
                    "error_stats_24h": {
                        "total_events": 847, "unique_issues": 23, "resolved": 18, "unresolved": 5,
                        "critical": 0, "high": 2, "medium": 8, "low": 13,
                        "top_errors": [
                            {"issue": "TimeoutError: Postgres query exceeded 30s", "count": 234, "service": "gl-engine-rs"},
                            {"issue": "ConnectionRefused: Redis cluster node down", "count": 189, "service": "redis-cache-rs"},
                            {"issue": "ValidationError: Invalid BVN format", "count": 145, "service": "kyc-engine-py"},
                            {"issue": "RateLimitExceeded: Mojaloop API 429", "count": 98, "service": "mojaloop-connector-go"},
                            {"issue": "DeserializationError: Kafka message schema mismatch", "count": 67, "service": "kafka-streaming-go"},
                        ]
                    }
                },
                "performance": {
                    "p50_latency_ms": 12, "p95_latency_ms": 89, "p99_latency_ms": 340,
                    "apdex_score": 0.94, "throughput_rpm": 24500,
                    "slowest_endpoints": [
                        {"endpoint": "POST /api/transfers", "p99_ms": 890, "calls_24h": 45000},
                        {"endpoint": "POST /api/kyc/verify", "p99_ms": 1200, "calls_24h": 12000},
                        {"endpoint": "GET /api/reports/gl-trial-balance", "p99_ms": 2400, "calls_24h": 340},
                    ]
                },
                "alerting": {
                    "channels": ["pagerduty", "slack", "sms", "email"],
                    "rules": [
                        {"name": "Error Rate Spike", "threshold": "> 5% error rate for 5 min", "severity": "critical"},
                        {"name": "Latency Degradation", "threshold": "p99 > 2s for 10 min", "severity": "high"},
                        {"name": "Service Down", "threshold": "health check fails 3x consecutive", "severity": "critical"},
                        {"name": "Memory Leak", "threshold": "RSS > 90% for 15 min", "severity": "high"},
                    ]
                }
            },
            "/api/apm-sentry/middleware": lambda: {
                "kafka": {"topics": ["apm.errors", "apm.performance"]},
                "dapr": {"stateStore": "apm-state"}, "fluvio": {"topics": ["apm-stream"]},
                "temporal": {"workflows": ["apm-alert-escalation"]},
                "postgres": {"tables": ["apm_errors", "apm_performance_samples"]},
                "keycloak": {"roles": ["apm-admin", "apm-viewer"]},
                "permify": {"relations": ["apm:can_view", "apm:can_manage"]},
                "redis": {"keys": ["apm:error:rate", "apm:latency:p99"]},
                "mojaloop": {"oracle": "apm-oracle"},
                "opensearch": {"indices": ["apm-errors", "apm-traces"]},
                "openappsec": {"policy": "apm-protection"},
                "apisix": {"route": "/api/apm-sentry/*"},
                "tigerbeetle": {"accounts": []},
                "lakehouse": {"tables": ["apm_analytics"]}
            },
        }
        handler = routes.get(self.path)
        if handler:
            self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers()
            self.wfile.write(json.dumps(handler()).encode())
        else:
            self.send_response(404); self.end_headers()
    def log_message(self, *a): pass

PORT = int(os.environ.get("PORT", 8317))
print(f"APM/Sentry on :{PORT}")
HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
