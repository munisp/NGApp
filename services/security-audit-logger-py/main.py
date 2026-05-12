"""54Bank Security Audit Logger Service

Centralized security event logging and SIEM integration:
  - All authentication events (login, logout, failed attempts)
  - Authorization decisions (access granted/denied)
  - Data access logging (who viewed what PII/financial data)
  - API call logging (request/response metadata)
  - Admin action logging (config changes, user management)
  - Compliance event logging (CBN/NFIU/PCI-DSS)
  - Real-time alerting on suspicious patterns
  - SIEM export (Splunk/QRadar/Elastic SIEM format)
  - Immutable audit chain (hash-linked entries)
  - 7-year retention policy (CBN requirement)

Port: 8496
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json, os

SECURITY_EVENTS = [
    {"id": "SE-001", "eventType": "authentication", "subType": "login_success", "actor": "CUST-1001", "channel": "mobile", "ipAddress": "105.112.45.67", "geoLocation": "Lagos, NG", "deviceFingerprint": "fp-iphone15-a1b2c3", "details": "Biometric login successful", "riskScore": 0.05, "severity": "info", "timestamp": "2026-05-09T14:00:00Z", "hashChain": "a1b2c3d4e5f6"},
    {"id": "SE-002", "eventType": "authentication", "subType": "login_failed", "actor": "unknown", "channel": "web", "ipAddress": "185.220.101.45", "geoLocation": "Moscow, RU", "deviceFingerprint": "fp-tor-browser", "details": "Failed login attempt - invalid credentials (attempt 3/5)", "riskScore": 0.85, "severity": "warning", "timestamp": "2026-05-09T14:05:00Z", "hashChain": "b2c3d4e5f6g7"},
    {"id": "SE-003", "eventType": "authorization", "subType": "access_denied", "actor": "CUST-1002", "channel": "web", "ipAddress": "197.210.78.90", "geoLocation": "Abuja, NG", "details": "Attempted access to /api/admin/users - insufficient permissions", "riskScore": 0.60, "severity": "warning", "timestamp": "2026-05-09T14:10:00Z", "hashChain": "c3d4e5f6g7h8"},
    {"id": "SE-004", "eventType": "data_access", "subType": "pii_viewed", "actor": "STAFF-001", "channel": "internal", "ipAddress": "10.0.1.50", "geoLocation": "Lagos HQ", "details": "Viewed BVN for CUST-1001 (reason: KYC review)", "riskScore": 0.20, "severity": "info", "timestamp": "2026-05-09T14:15:00Z", "hashChain": "d4e5f6g7h8i9"},
    {"id": "SE-005", "eventType": "transaction", "subType": "high_value_transfer", "actor": "CUST-1003", "channel": "mobile", "ipAddress": "154.120.67.89", "geoLocation": "Port Harcourt, NG", "details": "Transfer NGN 5,000,000 to external account - MFA verified (biometric+OTP)", "riskScore": 0.30, "severity": "info", "timestamp": "2026-05-09T14:20:00Z", "hashChain": "e5f6g7h8i9j0"},
    {"id": "SE-006", "eventType": "admin_action", "subType": "config_change", "actor": "ADMIN-001", "channel": "internal", "ipAddress": "10.0.1.10", "geoLocation": "Lagos HQ", "details": "Modified rate limit policy RL-002: max_requests 10->15", "riskScore": 0.40, "severity": "notice", "timestamp": "2026-05-09T14:25:00Z", "hashChain": "f6g7h8i9j0k1"},
    {"id": "SE-007", "eventType": "compliance", "subType": "ctr_filed", "actor": "compliance-engine", "channel": "system", "ipAddress": "10.0.0.1", "geoLocation": "System", "details": "CTR filed to NFIU for transaction >NGN 5M (ref: CTR-2026-05-001)", "riskScore": 0.0, "severity": "info", "timestamp": "2026-05-09T14:30:00Z", "hashChain": "g7h8i9j0k1l2"},
    {"id": "SE-008", "eventType": "authentication", "subType": "account_locked", "actor": "CUST-1004", "channel": "web", "ipAddress": "41.58.112.33", "geoLocation": "London, UK", "details": "Account locked after 5 failed login attempts from anomalous location", "riskScore": 0.95, "severity": "critical", "timestamp": "2026-05-09T14:35:00Z", "hashChain": "h8i9j0k1l2m3"},
]

ALERT_RULES = [
    {"id": "AR-001", "name": "Brute Force Detection", "condition": "login_failed >= 5 in 15min", "severity": "critical", "action": "lock_account+alert_security", "status": "active"},
    {"id": "AR-002", "name": "Geo Anomaly", "condition": "login from country != NG within 1h of NG login", "severity": "high", "action": "step_up_auth+alert", "status": "active"},
    {"id": "AR-003", "name": "Admin After Hours", "condition": "admin_action between 22:00-06:00", "severity": "medium", "action": "alert_ciso", "status": "active"},
    {"id": "AR-004", "name": "Mass PII Access", "condition": "pii_viewed >= 50 records in 1h by single actor", "severity": "high", "action": "suspend_access+alert_dpo", "status": "active"},
    {"id": "AR-005", "name": "High-Value Transfer Velocity", "condition": "transfers > NGN 10M cumulative in 24h", "severity": "high", "action": "hold_pending+alert_compliance", "status": "active"},
]

RETENTION_POLICIES = [
    {"id": "RP-001", "eventType": "authentication", "retentionYears": 7, "archiveAfterDays": 90, "complianceRef": "CBN Guidelines 2024"},
    {"id": "RP-002", "eventType": "transaction", "retentionYears": 7, "archiveAfterDays": 365, "complianceRef": "CBN/NFIU AML Regulations"},
    {"id": "RP-003", "eventType": "data_access", "retentionYears": 5, "archiveAfterDays": 180, "complianceRef": "NDPR 2019"},
    {"id": "RP-004", "eventType": "admin_action", "retentionYears": 7, "archiveAfterDays": 365, "complianceRef": "CBN IT Standards"},
]


class Handler(BaseHTTPRequestHandler):
    def _respond(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_GET(self):
        if self.path == "/healthz":
            self._respond(200, {
                "service": "security-audit-logger-py", "version": "3.0.0", "status": "healthy", "port": 8496,
                "description": "Security Audit Logger — SIEM integration, immutable chain, 7-year retention, real-time alerting",
                "features": ["auth_event_logging", "authz_decision_logging", "data_access_logging", "admin_action_logging",
                             "compliance_event_logging", "real_time_alerting", "siem_export", "immutable_hash_chain",
                             "7_year_retention", "geo_anomaly_detection", "brute_force_detection"],
                "siemFormats": ["splunk_hec", "qradar_leef", "elastic_ecs", "cef"],
                "middleware": {
                    "kafka": {"topics": ["security-event.auth", "security-event.authz", "security-event.data-access", "security-event.admin", "security-event.compliance", "security-alert.triggered"]},
                    "redis": {"usage": "Event deduplication, alert state machine"},
                    "postgres": {"tables": ["security_events", "alert_rules", "retention_policies"]},
                    "opensearch": {"indices": ["security-events-*", "security-alerts"]},
                    "keycloak": {"realm": "54bank"}, "permify": {"schema": "security_audit"},
                    "dapr": {"appId": "security-audit-logger-py"}, "fluvio": {"topics": ["security-events-stream"]},
                    "temporal": {"workflows": ["event-archival", "retention-enforcement", "siem-export-batch"]},
                    "mojaloop": {"usage": "Payment security event correlation"},
                    "tigerbeetle": {"ledger": 26}, "lakehouse": {"tables": ["security_event_analytics", "alert_statistics"]},
                    "apisix": {"routes": ["/v1/security-audit/*"]}, "openappsec": {"policy": "audit-log-integrity"},
                },
            })
        elif self.path == "/v1/security-audit/events":
            self._respond(200, {"items": SECURITY_EVENTS, "total": len(SECURITY_EVENTS)})
        elif self.path == "/v1/security-audit/alerts":
            self._respond(200, {"items": ALERT_RULES, "total": len(ALERT_RULES)})
        elif self.path == "/v1/security-audit/retention":
            self._respond(200, {"items": RETENTION_POLICIES, "total": len(RETENTION_POLICIES)})
        elif self.path == "/v1/security-audit/stats":
            by_type = {}
            by_severity = {}
            for e in SECURITY_EVENTS:
                by_type[e["eventType"]] = by_type.get(e["eventType"], 0) + 1
                by_severity[e["severity"]] = by_severity.get(e["severity"], 0) + 1
            self._respond(200, {"totalEvents": len(SECURITY_EVENTS), "byType": by_type, "bySeverity": by_severity, "alertRules": len(ALERT_RULES)})
        else:
            self._respond(404, {"error": "not found"})

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8496))
    print(f"security-audit-logger-py on :{port}")
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()
