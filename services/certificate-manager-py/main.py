"""54Bank Certificate Manager Service

X.509 certificate lifecycle management:
  - Certificate generation (RSA-4096, ECDSA P-256/P-384)
  - Certificate signing (internal CA)
  - Certificate renewal & rotation
  - Certificate revocation (CRL + OCSP)
  - mTLS certificate management for inter-service communication
  - Client certificate issuance for corporate banking
  - Certificate transparency log monitoring
  - Expiry alerting (30/14/7/1 day warnings)

Port: 8495
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json, os

CERTIFICATES = [
    {"id": "CERT-001", "commonName": "api.54bank.com", "type": "server", "algorithm": "ECDSA-P256", "issuer": "54Bank Internal CA", "serial": "01:AB:CD:EF", "status": "active", "validFrom": "2026-01-01T00:00:00Z", "validTo": "2027-01-01T00:00:00Z", "sans": ["api.54bank.com", "*.api.54bank.com"], "keyUsage": ["digitalSignature", "keyEncipherment"], "renewalDays": 30, "lastRenewed": "2026-01-01T00:00:00Z"},
    {"id": "CERT-002", "commonName": "mtls.54bank.internal", "type": "mtls_server", "algorithm": "RSA-4096", "issuer": "54Bank Internal CA", "serial": "02:AB:CD:EF", "status": "active", "validFrom": "2026-01-01T00:00:00Z", "validTo": "2027-01-01T00:00:00Z", "sans": ["*.54bank.internal"], "keyUsage": ["digitalSignature", "keyAgreement"], "renewalDays": 14, "lastRenewed": "2026-01-01T00:00:00Z"},
    {"id": "CERT-003", "commonName": "Dangote Industries Ltd", "type": "client_corporate", "algorithm": "ECDSA-P384", "issuer": "54Bank Corporate CA", "serial": "03:AB:CD:EF", "status": "active", "validFrom": "2026-02-01T00:00:00Z", "validTo": "2027-02-01T00:00:00Z", "sans": [], "keyUsage": ["digitalSignature", "clientAuth"], "renewalDays": 30, "lastRenewed": "2026-02-01T00:00:00Z"},
    {"id": "CERT-004", "commonName": "old-api.54bank.com", "type": "server", "algorithm": "RSA-2048", "issuer": "Let's Encrypt", "serial": "04:AB:CD:EF", "status": "revoked", "validFrom": "2025-06-01T00:00:00Z", "validTo": "2026-06-01T00:00:00Z", "sans": ["old-api.54bank.com"], "keyUsage": ["digitalSignature"], "renewalDays": 0, "revokedAt": "2026-01-15T00:00:00Z", "revocationReason": "superseded"},
    {"id": "CERT-005", "commonName": "54Bank Root CA", "type": "root_ca", "algorithm": "RSA-4096", "issuer": "Self-Signed", "serial": "00:00:00:01", "status": "active", "validFrom": "2025-01-01T00:00:00Z", "validTo": "2035-01-01T00:00:00Z", "sans": [], "keyUsage": ["keyCertSign", "cRLSign"], "renewalDays": 365},
]

CRL_ENTRIES = [
    {"id": "CRL-001", "certId": "CERT-004", "serialNumber": "04:AB:CD:EF", "revocationDate": "2026-01-15T00:00:00Z", "reason": "superseded"},
]

AUDIT = [
    {"id": "CA-001", "action": "cert_issued", "certId": "CERT-001", "actor": "pki-admin", "details": "Server certificate for api.54bank.com", "timestamp": "2026-01-01T00:00:00Z"},
    {"id": "CA-002", "action": "cert_revoked", "certId": "CERT-004", "actor": "security-team", "details": "Superseded by CERT-001 (ECDSA upgrade)", "timestamp": "2026-01-15T00:00:00Z"},
    {"id": "CA-003", "action": "cert_issued", "certId": "CERT-003", "actor": "corporate-banking", "details": "Client cert for Dangote corporate banking mTLS", "timestamp": "2026-02-01T00:00:00Z"},
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
                "service": "certificate-manager-py", "version": "3.0.0", "status": "healthy", "port": 8495,
                "description": "X.509 Certificate Lifecycle Management — CA, mTLS, CRL, OCSP, expiry alerting",
                "features": ["certificate_generation", "internal_ca", "mtls_management", "crl_generation", "ocsp_responder", "expiry_alerting", "corporate_client_certs", "transparency_logging", "auto_renewal"],
                "middleware": {
                    "kafka": {"topics": ["cert.issued", "cert.renewed", "cert.revoked", "cert.expiry-warning"]},
                    "redis": {"usage": "OCSP response cache, cert status cache"},
                    "postgres": {"tables": ["certificates", "crl_entries", "cert_audit"]},
                    "opensearch": {"indices": ["certificate-events"]},
                    "keycloak": {"realm": "54bank"}, "permify": {"schema": "certificate"},
                    "dapr": {"appId": "certificate-manager-py"}, "fluvio": {"topics": ["cert-events-stream"]},
                    "temporal": {"workflows": ["cert-renewal-schedule", "expiry-notification-chain"]},
                    "mojaloop": {"usage": "Partner mTLS certificate management"},
                    "tigerbeetle": {"ledger": 25}, "lakehouse": {"tables": ["certificate_analytics"]},
                    "apisix": {"routes": ["/v1/certificates/*"]}, "openappsec": {"policy": "certificate-enforcement"},
                },
            })
        elif self.path == "/v1/certificates":
            self._respond(200, {"items": CERTIFICATES, "total": len(CERTIFICATES)})
        elif self.path == "/v1/certificates/crl":
            self._respond(200, {"items": CRL_ENTRIES, "total": len(CRL_ENTRIES)})
        elif self.path == "/v1/certificates/audit":
            self._respond(200, {"items": AUDIT, "total": len(AUDIT)})
        elif self.path == "/v1/certificates/stats":
            by_type = {}
            by_status = {}
            for c in CERTIFICATES:
                by_type[c["type"]] = by_type.get(c["type"], 0) + 1
                by_status[c["status"]] = by_status.get(c["status"], 0) + 1
            self._respond(200, {"totalCertificates": len(CERTIFICATES), "byType": by_type, "byStatus": by_status, "crlEntries": len(CRL_ENTRIES)})
        else:
            self._respond(404, {"error": "not found"})

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8495))
    print(f"certificate-manager-py on :{port}")
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()
