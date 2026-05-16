#!/usr/bin/env python3
"""
Mock services for integration testing.
Simulates: Permify (3476), OpenIMIS (8001), Dapr (3500), Keycloak OIDC (8180)
"""
import json
import threading
import time
import uuid
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, unquote_plus
from datetime import datetime, timedelta

# In-memory state store for Dapr state tests
DAPR_STATE: dict = {}
# Brute force tracking for Keycloak mock
KEYCLOAK_FAILED_ATTEMPTS: dict = {}  # username -> [timestamps]

class MockServiceHandler(BaseHTTPRequestHandler):
    service_name = "mock"
    server_version = "mock-service"
    sys_version = ""

    def log_message(self, format, *args):
        pass  # Suppress request logs

    def send_json(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def send_empty(self, status):
        self.send_response(status)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def read_body_raw(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return b""
        return self.rfile.read(length)

    def read_body_json(self):
        raw = self.read_body_raw()
        if not raw:
            return {}
        try:
            return json.loads(raw)
        except Exception:
            return {}

    def read_body_form(self):
        raw = self.read_body_raw().decode("utf-8", errors="replace")
        form = {}
        for part in raw.split("&"):
            if "=" in part:
                k, v = part.split("=", 1)
                form[unquote_plus(k)] = unquote_plus(v)
        return form

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        qs = parse_qs(parsed.query)

        # ── Health ────────────────────────────────────────────────────────────
        if path in ("/healthz", "/health", "/livez", "/readyz"):
            if self.service_name == "dapr":
                self.send_empty(204)
            else:
                self.send_json(200, {"status": "SERVING", "service": self.service_name})
            return

        # ── Dapr endpoints ────────────────────────────────────────────────────
        if self.service_name == "dapr":
            if path.startswith("/v1.0/state/"):
                parts = path.split("/")
                if len(parts) >= 5:
                    key = parts[4]
                    if key in DAPR_STATE:
                        self.send_json(200, DAPR_STATE[key])
                    else:
                        self.send_empty(204)
                    return
            if path == "/v1.0/metadata":
                self.send_json(200, {
                    "id": "insurance-service",
                    "runtimeVersion": "1.12.0",
                    "enabledFeatures": ["ServiceInvocation", "PubSub", "StateManagement"]
                })
                return
            self.send_empty(204)
            return

        # ── Keycloak OIDC endpoints ───────────────────────────────────────────
        if self.service_name == "keycloak":
            if path == "/realms/insurance/.well-known/openid-configuration":
                base = "http://localhost:8180/realms/insurance"
                self.send_json(200, {
                    "issuer": base,
                    "authorization_endpoint": f"{base}/protocol/openid-connect/auth",
                    "token_endpoint": f"{base}/protocol/openid-connect/token",
                    "introspection_endpoint": f"{base}/protocol/openid-connect/token/introspect",
                    "userinfo_endpoint": f"{base}/protocol/openid-connect/userinfo",
                    "end_session_endpoint": f"{base}/protocol/openid-connect/logout",
                    "jwks_uri": f"{base}/protocol/openid-connect/certs",
                    "response_types_supported": ["code", "token", "id_token"],
                    "subject_types_supported": ["public"],
                    "id_token_signing_alg_values_supported": ["RS256"],
                    "scopes_supported": ["openid", "profile", "email"],
                    "token_endpoint_auth_methods_supported": [
                        "client_secret_post", "client_secret_basic"
                    ],
                    "claims_supported": ["sub", "iss", "aud", "exp", "iat", "email", "name", "roles"]
                })
                return
            if path.endswith("/protocol/openid-connect/certs"):
                self.send_json(200, {
                    "keys": [{"kty": "RSA", "use": "sig", "alg": "RS256", "kid": "test-key-1"}]
                })
                return
            if path.endswith("/protocol/openid-connect/userinfo"):
                self.send_json(200, {
                    "sub": "user-001", "email": "user@example.com", "name": "Test User"
                })
                return
            self.send_json(404, {"error": "not found"})
            return

        # ── Permify endpoints ─────────────────────────────────────────────────
        if path.startswith("/v1/tenants"):
            self.send_json(200, {"status": "SERVING"})
            return

        # ── OpenIMIS endpoints ────────────────────────────────────────────────
        if path in ("/api/graphql", "/api/health", "/api/v1/health"):
            self.send_json(200, {"status": "ok", "version": "2.0"})
            return
        if path.startswith("/api/v1/policies"):
            self.send_json(200, {"data": [{"id": "POL-001", "status": "Active"}]})
            return
        if path.startswith("/api/v1/claims"):
            self.send_json(200, {"data": [{"id": "CLM-001", "status": "Submitted"}]})
            return

        self.send_json(404, {"error": "not found"})

    def do_POST(self):
        path = urlparse(self.path).path.rstrip("/")
        content_type = self.headers.get("Content-Type", "")

        # ── Dapr endpoints ────────────────────────────────────────────────────
        if self.service_name == "dapr":
            body = self.read_body_json()
            if path.startswith("/v1.0/publish/"):
                self.send_empty(204)
                return
            if path.startswith("/v1.0/state/"):
                if isinstance(body, list):
                    for item in body:
                        DAPR_STATE[item["key"]] = item["value"]
                self.send_empty(204)
                return
            if path.startswith("/v1.0/invoke/"):
                self.send_json(200, {"status": "ok", "invoked": True})
                return
            if path.startswith("/v1.0/bindings/"):
                self.send_json(200, {"status": "ok"})
                return
            self.send_empty(204)
            return

        # ── Keycloak token endpoint ───────────────────────────────────────────
        if self.service_name == "keycloak":
            if path.endswith("/protocol/openid-connect/token"):
                # Parse form-encoded body
                form = self.read_body_form()
                grant_type = form.get("grant_type", "")
                username = form.get("username", "system")
                password = form.get("password", "")

                # For password grant, validate credentials and enforce brute force protection
                if grant_type == "password":
                    now = time.time()
                    attempts = KEYCLOAK_FAILED_ATTEMPTS.get(username, [])
                    attempts = [t for t in attempts if now - t < 60]
                    if len(attempts) >= 5:
                        KEYCLOAK_FAILED_ATTEMPTS[username] = attempts
                        self.send_json(429, {
                            "error": "too_many_requests",
                            "error_description": "Too many failed login attempts. Try again later."
                        })
                        return
                    # Only accept known test credentials
                    valid_creds = {"admin": "admin-password", "user": "user-password"}
                    if password not in (valid_creds.get(username, []) or []):
                        attempts.append(now)
                        KEYCLOAK_FAILED_ATTEMPTS[username] = attempts
                        self.send_json(401, {
                            "error": "invalid_grant",
                            "error_description": "Invalid user credentials"
                        })
                        return
                    # Success — clear failed attempts
                    KEYCLOAK_FAILED_ATTEMPTS.pop(username, None)

                self.send_json(200, {
                    "access_token": f"mock-token-{uuid.uuid4().hex[:16]}",
                    "token_type": "Bearer",
                    "expires_in": 300,
                    "refresh_token": f"mock-refresh-{uuid.uuid4().hex[:16]}",
                    "scope": "openid profile email"
                })
                return
            if path.endswith("/protocol/openid-connect/token/introspect"):
                self.send_json(200, {
                    "active": True,
                    "sub": "user-001",
                    "email": "user@example.com",
                    "realm_access": {"roles": ["user", "policy_read"]},
                    "exp": int((datetime.utcnow() + timedelta(hours=1)).timestamp())
                })
                return
            self.send_json(404, {"error": "not found"})
            return

        body = self.read_body_json()

        # ── Permify permission check ──────────────────────────────────────────
        if "/permissions/check" in path:
            self.send_json(200, {
                "can": "RESULT_ALLOWED",
                "metadata": {"snap_token": "", "schema_version": ""}
            })
            return
        if "/schemas/write" in path:
            self.send_json(200, {"schema_version": "v1"})
            return
        if "/relationships/write" in path:
            self.send_json(200, {"snap_token": str(uuid.uuid4())})
            return

        # ── OpenIMIS GraphQL ──────────────────────────────────────────────────
        if path in ("/api/graphql",):
            query = body.get("query", "")
            if "policies" in query:
                self.send_json(200, {"data": {"policies": {"edges": [
                    {"node": {"id": "POL-001", "status": "Active", "premium": 1200.0}}
                ]}}})
            elif "claims" in query:
                self.send_json(200, {"data": {"claims": {"edges": [
                    {"node": {"id": "CLM-001", "status": "Submitted", "amount": 5000.0}}
                ]}}})
            else:
                self.send_json(200, {"data": {}})
            return

        self.send_json(404, {"error": "not found"})

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.end_headers()

def run_mock_service(port: int, service_name: str):
    class NamedHandler(MockServiceHandler):
        pass
    NamedHandler.service_name = service_name
    server = HTTPServer(("0.0.0.0", port), NamedHandler)
    print(f"Mock {service_name} running on port {port}")
    server.serve_forever()

if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3476
    service = sys.argv[2] if len(sys.argv) > 2 else "permify"
    run_mock_service(port, service)
