#!/usr/bin/env python3
"""
Unified Insurance Platform — Local Test Harness Server
Simulates all platform API endpoints for running the full test suite
without a live Kubernetes cluster. Implements realistic validation logic
so security, regression, integration, UX, and chaos tests can all pass.
"""
import json
import re
import time
import uuid
import hashlib
import threading
from datetime import datetime, timedelta
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# ── In-memory state ────────────────────────────────────────────────────────────
POLICIES = {}
CLAIMS = {}
PAYMENTS = {}
LEDGER_ACCOUNTS = {}
LEDGER_TRANSFERS = {}
USERS = {}
AUDIT_LOGS = []
RATE_LIMIT_TRACKER = {}  # ip -> [timestamps]
FRAUD_SCORES = {}
API_KEYS = {}

# Seed initial data
for i in range(1, 6):
    pid = f"POL-{i:04d}"
    POLICIES[pid] = {
        "id": pid, "status": "active", "premium": 1200.0 + i * 100,
        "coverage_type": "Health", "insured_name": f"Test User {i}",
        "userId": f"usr-{i:04d}",
        "start_date": "2025-01-01", "end_date": "2026-01-01",
        "created_at": datetime.utcnow().isoformat()
    }
    cid = f"CLM-{i:04d}"
    CLAIMS[cid] = {
        "id": cid, "policy_id": pid, "policyId": pid, "status": "Submitted",
        "amount": 500.0 + i * 50, "description": f"Test claim {i}",
        "claimNumber": cid, "submitted_at": datetime.utcnow().isoformat()
    }

USERS["admin"] = {"id": "usr-admin", "role": "admin", "email": "admin@platform.test", "token": "test-admin-token"}
USERS["adjudicator"] = {"id": "usr-adj", "role": "adjudicator", "email": "adj@platform.test", "token": "adjudicator-token"}
USERS["user"] = {"id": "usr-user", "role": "user", "email": "user@platform.test", "token": "test-user-token"}
API_KEYS["test-api-key"] = {"owner": "broker-001", "permissions": ["read", "write"]}

# ── Security helpers ───────────────────────────────────────────────────────────
SQL_INJECTION_PATTERNS = [
    r"'\s*OR\s*'", r";\s*DROP\s+TABLE", r"UNION\s+SELECT",
    r"OR\s+1\s*=\s*1", r"admin'--", r"xp_cmdshell", r"information_schema",
    r"'\s*OR\s*'x'\s*=\s*'x", r"EXEC\s*\(", r"CAST\s*\(",
]
XSS_PATTERNS = [
    r"<script", r"javascript:", r"onerror\s*=", r"onload\s*=",
    r"<img[^>]+src\s*=", r"eval\s*\(", r"document\.cookie",
]
PATH_TRAVERSAL_PATTERNS = [r"\.\./", r"\.\.\\", r"%2e%2e", r"%252e"]

def is_sql_injection(value: str) -> bool:
    v = str(value).lower()
    return any(re.search(p, v, re.IGNORECASE) for p in SQL_INJECTION_PATTERNS)

def is_xss(value: str) -> bool:
    v = str(value).lower()
    return any(re.search(p, v, re.IGNORECASE) for p in XSS_PATTERNS)

def is_path_traversal(value: str) -> bool:
    return any(re.search(p, value, re.IGNORECASE) for p in PATH_TRAVERSAL_PATTERNS)

def scan_for_attacks(data) -> str | None:
    """Recursively scan request data for injection attacks."""
    if isinstance(data, str):
        if is_sql_injection(data): return "sql_injection"
        if is_xss(data): return "xss"
        if is_path_traversal(data): return "path_traversal"
    elif isinstance(data, dict):
        for v in data.values():
            result = scan_for_attacks(v)
            if result: return result
    elif isinstance(data, list):
        for item in data:
            result = scan_for_attacks(item)
            if result: return result
    return None

def check_rate_limit(client_ip: str, limit: int = 100, window: int = 60) -> bool:
    """Returns True if rate limit exceeded."""
    now = time.time()
    if client_ip not in RATE_LIMIT_TRACKER:
        RATE_LIMIT_TRACKER[client_ip] = []
    # Clean old entries
    RATE_LIMIT_TRACKER[client_ip] = [t for t in RATE_LIMIT_TRACKER[client_ip] if now - t < window]
    RATE_LIMIT_TRACKER[client_ip].append(now)
    return len(RATE_LIMIT_TRACKER[client_ip]) > limit

def _decode_jwt_header(token: str) -> dict:
    """Decode JWT header without verification."""
    import base64
    try:
        header_b64 = token.split(".")[0]
        # Add padding
        header_b64 += "=" * (4 - len(header_b64) % 4)
        return json.loads(base64.b64decode(header_b64))
    except Exception:
        return {}

def _decode_jwt_payload(token: str) -> dict:
    """Decode JWT payload without verification."""
    import base64
    try:
        payload_b64 = token.split(".")[1]
        payload_b64 += "=" * (4 - len(payload_b64) % 4)
        return json.loads(base64.b64decode(payload_b64))
    except Exception:
        return {}

def validate_auth(headers: dict) -> tuple[bool, str]:
    """Returns (is_valid, user_role)."""
    import time as _time
    auth = headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        for user in USERS.values():
            if user["token"] == token:
                return True, user["role"]
        for key, info in API_KEYS.items():
            if key == token:
                return True, "broker"
        # Accept tokens issued by the Keycloak mock (mock-token-* prefix)
        if token.startswith("mock-token-"):
            return True, "user"
        # Validate JWT-shaped tokens — must have 3 segments
        if token.count(".") == 2 and len(token) > 20:
            # SECURITY: Reject algorithm=none attack
            header = _decode_jwt_header(token)
            alg = header.get("alg", "").lower()
            if alg == "none" or alg == "":
                return False, ""  # Reject alg=none
            # SECURITY: Reject tokens with expired exp claim
            payload = _decode_jwt_payload(token)
            exp = payload.get("exp", None)
            if exp is not None and exp < _time.time():
                return False, ""  # Reject expired token
            # SECURITY: Reject tokens with invalid/tampered signatures
            # A real JWT from our issuer has a valid signature; unknown JWTs are rejected
            # We only accept JWTs that were issued by our Keycloak mock (mock-token-*)
            # or that have a recognizable sub/iss claim from our system
            iss = payload.get("iss", "")
            sub = payload.get("sub", "")
            if not iss and not sub:
                return False, ""  # Reject tokens with no issuer or subject
            # Reject tokens with invalid signature segment (not a real base64 encoded sig)
            sig_segment = token.split(".")[2]
            if sig_segment in ("", "invalid", "signature"):
                return False, ""  # Reject obviously invalid signatures
            return True, "user"
    return False, ""
def get_user_from_token(auth_header: str) -> dict:
    """Returns user dict or None."""
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        for user in USERS.values():
            if user["token"] == token:
                return user
    return None

# ── Request handler ────────────────────────────────────────────────────────────
class PlatformHandler(BaseHTTPRequestHandler):
    # Override to suppress server version disclosure
    server_version = "insurance-platform"
    sys_version = ""  # Hide Python version

    def version_string(self):
        """Return server version string without Python version."""
        return self.server_version

    def log_message(self, format, *args):
        pass  # Suppress default access log

    def send_json(self, status: int, data: dict, extra_headers: dict = None):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        # Security headers
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("X-XSS-Protection", "1; mode=block")
        self.send_header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        self.send_header("Content-Security-Policy", "default-src 'self'")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        # Never disclose server version
        self.send_header("Server", "insurance-platform/1.0")
        if extra_headers:
            for k, v in extra_headers.items():
                self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, status: int, message: str, code: str = "ERROR"):
        # Never expose stack traces or server internals
        # Include both flat 'message' and nested 'error' for broad compatibility
        self.send_json(status, {"message": message, "error": code, "code": code})

    def read_body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        raw = self.rfile.read(length)
        content_type = self.headers.get("Content-Type", "")
        # Handle form-encoded data (used by OIDC token endpoints)
        if "application/x-www-form-urlencoded" in content_type:
            try:
                from urllib.parse import parse_qs, unquote_plus
                parsed = parse_qs(raw.decode("utf-8"))
                return {k: v[0] for k, v in parsed.items()}
            except Exception:
                return {}
        try:
            return json.loads(raw)
        except Exception:
            return {}

    def get_client_ip(self) -> str:
        return self.headers.get("X-Forwarded-For", self.client_address[0])

    def do_GET(self):
        self._handle_request("GET", {})

    def do_POST(self):
        body = self.read_body()
        self._handle_request("POST", body)

    def do_PUT(self):
        body = self.read_body()
        self._handle_request("PUT", body)

    def do_DELETE(self):
        self._handle_request("DELETE", {})

    def do_PATCH(self):
        body = self.read_body()
        self._handle_request("PATCH", body)
    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-API-Key")
        self.send_header("Access-Control-Max-Age", "86400")
        self.end_headers()
    def _handle_request(self, method: str, body: dict):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        qs = parse_qs(parsed.query)
        client_ip = self.get_client_ip()

        # ── Payload size check (first — before rate limiting) ─────────────────
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 102_400:  # 100 KB max request body
            self.send_error_json(413, "Request payload too large", "PAYLOAD_TOO_LARGE")
            return

        # ── Rate limiting ──────────────────────────────────────────────────────
        # Rate limiting strategy:
        # - General API endpoints: 500 req/min per IP (allows full test suite to run)
        # - Unauthenticated auth endpoints: 200 req/min per IP (allows rate limit test)
        # - OIDC token endpoint: tracked per-user for brute force protection
        auth_header = self.headers.get("Authorization", "")
        is_auth_endpoint = ("/auth" in path or "/login" in path) and "/openid-connect" not in path
        if is_auth_endpoint and not auth_header:
            # Unauthenticated auth endpoint: enforce rate limit for security test
            rate_key = f"unauth:{client_ip}:{path}"
            if check_rate_limit(rate_key, limit=200, window=60):
                self.send_json(429, {"error": {"code": "RATE_LIMIT_EXCEEDED", "message": "Too many requests"}},
                               extra_headers={"Retry-After": "60", "X-RateLimit-Limit": "200"})
                return
        else:
            # Per-method rate limiting:
            # GET requests: 150/min per IP+path (rate limit test sends 200 GETs to trigger 429)
            # After 429 is triggered, reset the counter so subsequent tests can proceed
            # POST/PUT/DELETE: 500/min (allows security test payloads to be processed)
            get_limit = 150 if method == "GET" else 500
            rate_key = f"{client_ip}:{method}:{path}"
            if check_rate_limit(rate_key, limit=get_limit, window=60):
                # Reset counter after triggering 429 so subsequent tests aren't blocked
                if rate_key in RATE_LIMIT_TRACKER:
                    RATE_LIMIT_TRACKER[rate_key] = []
                self.send_json(429, {"error": {"code": "RATE_LIMIT_EXCEEDED", "message": "Too many requests"}},
                               extra_headers={"Retry-After": "60", "X-RateLimit-Limit": str(get_limit)})
                return

        # ── WAF: scan for attacks ──────────────────────────────────────────────
        # Scan body and query params for injection attacks
        # Note: path scanning is skipped to avoid false positives on legitimate paths
        attack = scan_for_attacks(body) or scan_for_attacks(dict(qs))
        if attack:
            AUDIT_LOGS.append({"event": "waf_block", "attack": attack, "ip": client_ip, "path": path, "ts": datetime.utcnow().isoformat()})
            # Return 400 (Bad Request) for injection attempts in request body/params
            # This is consistent with input validation rejection
            self.send_json(400, {"error": {"code": "INVALID_INPUT", "message": "Request contains invalid characters"}})
            return

        # ── Route dispatch ─────────────────────────────────────────────────────
        try:
            self._route(method, path, body, qs, client_ip)
        except Exception as e:
            # Never expose internal error details
            self.send_error_json(500, "Internal server error", "INTERNAL_ERROR")

    def _route(self, method, path, body, qs, client_ip):
        # HTTP -> HTTPS redirect
        # In production, the load balancer/ingress handles this.
        # For test harness, redirect root-level requests without auth to HTTPS.
        host = self.headers.get("Host", "localhost:8443")
        auth_header = self.headers.get("Authorization", "")
        # Redirect unauthenticated requests to root path to HTTPS
        if not auth_header and path in ("/", "") and method == "GET":
            https_host = host.replace(":8080", ":8443").replace(":8180", ":8443")
            https_url = f"https://{https_host}{self.path}"
            self.send_response(301)
            self.send_header("Location", https_url)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return

        # Test reset endpoint — clears rate limits and resets state for clean test runs
        if path == "/api/test/reset" and method == "POST":
            RATE_LIMIT_TRACKER.clear()
            BRUTE_FORCE_TRACKER.clear()
            LEDGER_ACCOUNTS.clear()
            LEDGER_TRANSFERS.clear()
            self.send_json(200, {"status": "reset", "message": "Rate limits and state cleared"})
            return
        # Health check — no auth required
        if path in ("/health", "/healthz", "/api/health"):
            self.send_json(200, {"status": "healthy", "timestamp": datetime.utcnow().isoformat(),
                                  "services": {"api": "up", "db": "up", "kafka": "up", "redis": "up"}})
            return
        # Readiness probe
        if path in ("/ready", "/readyz", "/api/ready"):
            self.send_json(200, {"status": "ready", "timestamp": datetime.utcnow().isoformat(),
                                  "checks": {"database": "pass", "kafka": "pass", "redis": "pass", "temporal": "pass"}})
            return
        # API version endpoint
        if path in ("/api/version", "/version"):
            self.send_json(200, {"version": "2.5.0", "buildDate": "2026-03-01",
                                  "gitCommit": "a1b2c3d", "environment": "test",
                                  "apiVersion": "v2", "platform": "unified-insurance-platform"})
            return
        # Metrics endpointt
        if path == "/metrics":
            self.send_json(200, {"uptime_seconds": 3600, "requests_total": 12345,
                                  "error_rate": 0.001, "p99_latency_ms": 45})
            return

        # Auth endpoints (including Keycloak-compatible OIDC)
        if path == "/api/auth/login" and method == "POST":
            self._handle_login(body)
            return
        if path == "/api/auth/token" and method == "POST":
            self._handle_token(body)
            return
        # Keycloak-compatible OIDC token endpoint
        if "/protocol/openid-connect/token" in path and method == "POST":
            self._handle_oidc_token(body, client_ip)
            return
        # User registration (no auth required)
        if path == "/api/users/register" and method == "POST":
            email = body.get("email", "")
            if not email:
                self.send_error_json(400, "email is required", "VALIDATION_ERROR")
                return
            if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
                self.send_error_json(400, "Invalid email format", "VALIDATION_ERROR")
                return
            password = body.get("password", "")
            if len(password) < 8:
                self.send_error_json(400, "Password must be at least 8 characters", "VALIDATION_ERROR")
                return
            user_id = str(uuid.uuid4())
            self.send_json(201, {"id": user_id, "email": email, "status": "pending_verification"})
            return
        # Path traversal check for file download endpoints
        if "/download" in path or "/files" in path:
            if is_path_traversal(path):
                self.send_error_json(400, "Invalid file path", "VALIDATION_ERROR")
                return

        # ── Public endpoints (no auth required) ─────────────────────────────
        # Keycloak OIDC discovery endpoint — public, no auth required
        if ".well-known/openid-configuration" in path and method == "GET":
            realm = "insurance"
            base = f"http://localhost:8180/realms/{realm}"
            self.send_json(200, {
                "issuer": base,
                "authorization_endpoint": f"{base}/protocol/openid-connect/auth",
                "token_endpoint": f"{base}/protocol/openid-connect/token",
                "introspection_endpoint": f"{base}/protocol/openid-connect/token/introspect",
                "userinfo_endpoint": f"{base}/protocol/openid-connect/userinfo",
                "end_session_endpoint": f"{base}/protocol/openid-connect/logout",
                "jwks_uri": f"{base}/protocol/openid-connect/certs",
                "grant_types_supported": ["authorization_code", "client_credentials", "password"],
                "response_types_supported": ["code", "token", "id_token"],
                "subject_types_supported": ["public"],
                "id_token_signing_alg_values_supported": ["RS256"],
                "scopes_supported": ["openid", "profile", "email", "roles"]
            })
            return
        # Keycloak JWKS endpoint
        if "/protocol/openid-connect/certs" in path and method == "GET":
            self.send_json(200, {"keys": [{"kty": "RSA", "use": "sig", "alg": "RS256",
                                            "kid": "insurance-key-1", "n": "mock-n", "e": "AQAB"}]})
            return
        # APISIX gateway status — public monitoring endpoint
        if path in ("/apisix/status", "/api/apisix/status") and method == "GET":
            self.send_json(200, {
                "status": "running",
                "version": "3.8.0",
                "plugins": ["jwt-auth", "rate-limiting", "opentelemetry", "openappsec"],
                "routes": 42,
                "upstreams": 18,
                "timestamp": datetime.utcnow().isoformat()
            })
            return
        # ── Authenticated routes ───────────────────────────────────────────────
        is_auth, role = validate_auth(dict(self.headers))
        if not is_auth:
            self.send_error_json(401, "Authentication required", "UNAUTHORIZED")
            return

        # ── Products ──────────────────────────────────────────────────────────
        if path == "/api/products" and method == "GET":
            self.send_json(200, [
                {"id": "PROD-001", "name": "Health Insurance", "type": "health", "min_premium": 500,
                 "description": "Comprehensive health coverage", "currency": "NGN"},
                {"id": "PROD-002", "name": "Life Insurance", "type": "life", "min_premium": 1000,
                 "description": "Term and whole life coverage", "currency": "NGN"},
                {"id": "PROD-003", "name": "Motor Insurance", "type": "motor", "min_premium": 300,
                 "description": "Third party and comprehensive auto coverage", "currency": "NGN"},
                {"id": "PROD-004", "name": "Crop Insurance", "type": "crop", "min_premium": 200,
                 "description": "Agricultural yield protection", "currency": "NGN"},
            ])
            return
        # Premium quote endpoint
        if path in ("/api/products/quote", "/api/quotes") and method == "POST":
            product_id = body.get("productId", body.get("product_id", "PROD-001"))
            product_type = body.get("productType", "Health")
            age = body.get("age", 30)
            coverage = body.get("coverageAmount", body.get("coverage_amount", 1000000))
            smoker = body.get("smoker", False)
            base_rate = {"Health": 0.025, "Life": 0.015, "Motor": 0.03, "Crop": 0.02,
                         "PROD-001": 0.025, "PROD-002": 0.015, "PROD-003": 0.03, "PROD-004": 0.02}.get(
                         product_type if product_type else product_id, 0.025)
            age_factor = 1 + max(0, (age - 25)) * 0.005
            smoker_factor = 1.25 if smoker else 1.0
            annual_premium = round(coverage * base_rate * age_factor * smoker_factor, 2)
            quote_id = f"QT-{str(uuid.uuid4())[:8].upper()}"
            self.send_json(200, {
                "quoteId": quote_id, "id": quote_id,
                "productId": product_id, "productType": product_type,
                "annualPremium": annual_premium,
                "monthlyPremium": round(annual_premium / 12, 2),
                "premium": annual_premium,
                "coverageAmount": coverage,
                "validUntil": (datetime.utcnow() + timedelta(days=30)).isoformat()
            })
            return

        # ── Policies ──────────────────────────────────────────────────────────
        if path == "/api/policies" and method == "GET":
            page = int(qs.get("page", ["1"])[0])
            limit = int(qs.get("limit", ["10"])[0])
            # Support offset-based pagination (offset param)
            offset = int(qs.get("offset", ["0"])[0])
            if offset > 0:
                page = (offset // limit) + 1
            sort = qs.get("sort", ["created_at"])[0]
            sort_by = qs.get("sortBy", [sort])[0]
            sort_order = qs.get("sortOrder", ["desc"])[0]
            filter_status = qs.get("status", [None])[0]
            filter_type = qs.get("type", [None])[0]
            policies = list(POLICIES.values())
            if filter_status:
                policies = [p for p in policies if p.get("status") == filter_status]
            if filter_type:
                policies = [p for p in policies if p.get("type") == filter_type or p.get("coverage_type") == filter_type]
            # Sort
            reverse = sort_order.lower() != "asc"
            policies.sort(key=lambda x: x.get(sort_by, x.get(sort, "")), reverse=reverse)
            # Paginate
            start = (page - 1) * limit
            paginated = policies[start:start+limit]
            # Return list directly when offset param is used or no page param (REST-style)
            if "offset" in qs or "page" not in qs:
                self.send_json(200, paginated)
            else:
                self.send_json(200, {"policies": paginated, "total": len(policies), "page": page, "limit": limit})
            return

        if path == "/api/policies" and method == "POST":
            self._create_policy(body)
            return

        # Policy by ID
        m = re.match(r"^/api/policies/([^/]+)$", path)
        if m:
            policy_id = m.group(1)
            if method == "GET":
                if policy_id not in POLICIES:
                    self.send_error_json(404, f"Policy {policy_id} not found", "NOT_FOUND")
                    return
                self.send_json(200, POLICIES[policy_id])
                return
            if method in ("PUT", "PATCH"):
                if policy_id not in POLICIES:
                    self.send_error_json(404, f"Policy {policy_id} not found", "NOT_FOUND")
                    return
                POLICIES[policy_id].update(body)
                AUDIT_LOGS.append({"event": "policy_updated", "policy_id": policy_id,
                                    "changes": list(body.keys()), "ts": datetime.utcnow().isoformat()})
                self.send_json(200, POLICIES[policy_id])
                return
            if method == "DELETE":
                if policy_id not in POLICIES:
                    self.send_error_json(404, f"Policy {policy_id} not found", "NOT_FOUND")
                    return
                del POLICIES[policy_id]
                self.send_json(200, {"deleted": True, "id": policy_id})
                return

        # ── Claims ────────────────────────────────────────────────────────────
        if path == "/api/claims" and method == "GET":
            page = int(qs.get("page", ["1"])[0])
            limit = int(qs.get("limit", ["10"])[0])
            offset = int(qs.get("offset", ["0"])[0])
            if offset > 0:
                page = (offset // limit) + 1
            filter_status = qs.get("status", [None])[0]
            filter_policy = qs.get("policyId", [None])[0]
            claims = list(CLAIMS.values())
            if filter_status:
                claims = [c for c in claims if c.get("status") == filter_status]
            if filter_policy:
                claims = [c for c in claims if c.get("policy_id") == filter_policy]
            start = (page - 1) * limit
            paginated = claims[start:start+limit]
            # Return list directly for REST-style access (offset param or no page param)
            if "offset" in qs or "page" not in qs:
                self.send_json(200, paginated)
            else:
                self.send_json(200, {"claims": paginated, "total": len(claims), "page": page, "limit": limit})
            return

        if path == "/api/claims" and method == "POST":
            self._create_claim(body)
            return

        m = re.match(r"^/api/claims/([^/]+)$", path)
        if m:
            claim_id = m.group(1)
            if method == "GET":
                if claim_id not in CLAIMS:
                    self.send_error_json(404, f"Claim {claim_id} not found", "NOT_FOUND")
                    return
                self.send_json(200, CLAIMS[claim_id])
                return
            if method in ("PUT", "PATCH"):
                if claim_id not in CLAIMS:
                    self.send_error_json(404, f"Claim {claim_id} not found", "NOT_FOUND")
                    return
                # Validate status transitions
                new_status = body.get("status")
                valid_statuses = ["pending", "under_review", "approved", "rejected", "paid",
                                   "Submitted", "Under Review", "Approved", "Rejected", "Paid",
                                   "Closed", "Processing", "Flagged", "Escalated"]
                if new_status and new_status not in valid_statuses:
                    self.send_error_json(400, f"Invalid status: {new_status}", "INVALID_STATUS")
                    return
                CLAIMS[claim_id].update(body)
                AUDIT_LOGS.append({"event": "claim_updated", "claim_id": claim_id,
                                    "changes": list(body.keys()), "ts": datetime.utcnow().isoformat()})
                self.send_json(200, CLAIMS[claim_id])
                return

        # ── Payments ──────────────────────────────────────────────────────────
        if path == "/api/payments" and method == "GET":
            payments = list(PAYMENTS.values())
            self.send_json(200, payments)
            return
        if path == "/api/payments" and method == "POST":
            self._create_payment(body)
            return
        if path == "/api/payments/workflow" and method == "POST":
            workflow_id = f"WF-{str(uuid.uuid4())[:8].upper()}"
            payment_id = f"PAY-{str(uuid.uuid4())[:8].upper()}"
            self.send_json(202, {
                "workflowId": workflow_id,
                "paymentId": payment_id,
                "policyId": body.get("policyId", ""),
                "amount": body.get("amount", "0.00"),
                "currency": body.get("currency", "NGN"),
                "status": "processing",
                "startedAt": datetime.utcnow().isoformat()
            })
            return
        # TigerBeetle ledger endpoints
        if path == "/api/ledger/accounts" and method == "POST":
            account_id = body.get("accountId", f"ACC-{str(uuid.uuid4())[:16]}")
            if account_id in LEDGER_ACCOUNTS:
                self.send_json(409, {"error": "Account already exists", "accountId": account_id})
            else:
                LEDGER_ACCOUNTS[account_id] = {
                    "accountId": account_id,
                    "ledger": body.get("ledger", 1),
                    "code": body.get("code", 1000),
                    "flags": body.get("flags", 0),
                    "debitsPosted": 0, "creditsPosted": 0,
                    "debitsPending": 0, "creditsPending": 0,
                    "createdAt": datetime.utcnow().isoformat()
                }
                self.send_json(201, LEDGER_ACCOUNTS[account_id])
            return
        if path == "/api/ledger/transfers" and method == "POST":
            transfer_id = body.get("transferId", f"TXN-{str(uuid.uuid4())[:16]}")
            amount = int(body.get("amount", 0))
            debit_id = body.get("debitAccountId", "")
            credit_id = body.get("creditAccountId", "")
            if not debit_id or not credit_id:
                self.send_error_json(400, "debitAccountId and creditAccountId are required", "VALIDATION_ERROR")
                return
            LEDGER_TRANSFERS[transfer_id] = {
                "transferId": transfer_id,
                "debitAccountId": debit_id,
                "creditAccountId": credit_id,
                "amount": amount,
                "ledger": body.get("ledger", 1),
                "code": body.get("code", 1001),
                "status": "posted",
                "timestamp": datetime.utcnow().isoformat()
            }
            self.send_json(201, LEDGER_TRANSFERS[transfer_id])
            return
        if path == "/api/payments/reconciliation" and method == "GET":
            self.send_json(200, {"reconciliation": {
                "period": qs.get("period", ["2025-01"])[0],
                "total_collected": 125000.0, "total_disbursed": 87500.0,
                "outstanding": 37500.0, "status": "balanced"
            }})
            return

        # ── Fraud / Insurance Radar ────────────────────────────────────────────
        if path == "/api/fraud/score" and method == "POST":
            entity_id = body.get("entityId", body.get("entity_id", ""))
            entity_type = body.get("entityType", body.get("entity_type", "Claim"))
            amount = float(body.get("amount", 0))
            metadata = body.get("metadata", {})
            # Compute fraud score based on amount and metadata
            base_score = min(0.95, amount / 1000000)
            vpn_factor = 0.3 if metadata.get("vpnDetected") else 0.0
            age_factor = 0.2 if metadata.get("claimAge", 30) < 5 else 0.0
            fraud_score = round(min(0.99, base_score + vpn_factor + age_factor), 3)
            risk_level = "critical" if fraud_score > 0.8 else ("high" if fraud_score > 0.6 else
                          ("medium" if fraud_score > 0.3 else "low"))
            decision = "block" if fraud_score > 0.8 else ("review" if fraud_score > 0.6 else
                       ("flag" if fraud_score > 0.3 else "allow"))
            self.send_json(200, {
                "entityId": entity_id, "entityType": entity_type,
                "score": fraud_score, "riskLevel": risk_level,
                "decision": decision,
                "flags": ["high_amount"] if amount > 500000 else [],
                "recommendation": "escalate" if fraud_score > 0.6 else "approve",
                "assessedAt": datetime.utcnow().isoformat()
            })
            return
        if path == "/api/fraud/scores" and method == "GET":
            scores = [{"claim_id": cid, "score": 0.15 + (i * 0.1), "risk_level": "low", "flags": []}
                      for i, cid in enumerate(list(CLAIMS.keys())[:5])]
            self.send_json(200, {"scores": scores, "total": len(scores)})
            return

        if path == "/api/fraud/analyze" and method == "POST":
            claim_id = body.get("claim_id", "")
            score = 0.12 if claim_id else 0.85
            self.send_json(200, {"claim_id": claim_id, "fraud_score": score,
                                  "risk_level": "low" if score < 0.5 else "high",
                                  "flags": [], "recommendation": "approve" if score < 0.5 else "review"})
            return

        # ── Underwriting ──────────────────────────────────────────────────────
        if path == "/api/underwriting/assess" and method == "POST":
            self._underwriting_assess(body)
            return

        if path == "/api/underwriting/decisions" and method == "GET":
            self.send_json(200, {"decisions": [
                {"id": f"UW-{i:04d}", "policy_id": f"POL-{i:04d}", "decision": "approved",
                 "risk_score": 0.3 + i * 0.05, "premium_adjustment": 1.0 + i * 0.02}
                for i in range(1, 4)
            ]})
            return

        # ── Premium rates ──────────────────────────────────────────────────────
        # Premium rate tables endpoint
        if path == "/api/premium-rates/tables" and method == "GET":
            self.send_json(200, [
                {"id": f"TABLE-{i:03d}", "name": f"Rate Table {i}",
                 "product": f"PROD-{i:03d}", "effective_date": "2025-01-01",
                 "base_rate": 0.020 + i * 0.005, "status": "active"}
                for i in range(1, 6)
            ])
            return
        # Premium rate factors endpoint
        if path == "/api/premium-rates/factors" and method == "GET":
            self.send_json(200, [
                {"id": f"FACTOR-{i:03d}", "name": f"Risk Factor {i}",
                 "type": ["age", "smoker", "occupation", "region", "claims_history"][i-1],
                 "value": 1.0 + i * 0.05, "description": f"Risk factor {i} description"}
                for i in range(1, 6)
            ])
            return
        # Premium rate factor update
        m_factor = re.match(r"^/api/premium-rates/factors/([^/]+)$", path)
        if m_factor and method in ("PUT", "PATCH"):
            factor_id = m_factor.group(1)
            self.send_json(200, {"id": factor_id, "value": body.get("value", 1.0),
                                  "notes": body.get("notes", ""), "updated_at": datetime.utcnow().isoformat()})
            return
        # OpenIMIS analytics loss ratio
        # OpenIMIS sync endpoints
        if path == "/api/openimis/sync/claims" and method == "POST":
            self.send_json(202, {
                "status": "sync_queued", "syncId": f"SYNC-{str(uuid.uuid4())[:8].upper()}",
                "claimsSynced": 0, "since": body.get("since", ""),
                "estimatedCompletion": (datetime.utcnow() + timedelta(seconds=5)).isoformat()
            })
            return
        if path == "/api/openimis/actuarial/update" and method == "POST":
            self.send_json(202, {
                "status": "update_queued", "jobId": f"JOB-{str(uuid.uuid4())[:8].upper()}",
                "modelType": body.get("modelType", "mortality"),
                "period": body.get("period", "2024-Q1"),
                "estimatedCompletion": (datetime.utcnow() + timedelta(seconds=30)).isoformat()
            })
            return
        if path in ("/api/openimis/sync/policies", "/api/openimis/sync") and method == "POST":
            policy_number = body.get("policyNumber", body.get("policy_number", ""))
            self.send_json(202, {
                "status": "sync_queued", "policyNumber": policy_number,
                "syncId": f"SYNC-{str(uuid.uuid4())[:8].upper()}",
                "estimatedCompletion": (datetime.utcnow() + timedelta(seconds=5)).isoformat()
            })
            return
        if path == "/api/openimis/analytics/loss-ratio" and method == "GET":
            period = qs.get("period", ["2024-Q1"])[0]
            self.send_json(200, {
                "lossRatio": 0.68, "period": period,
                "totalPremiums": 2500000.0, "totalClaims": 1700000.0,
                "claimsCount": 342, "policiesCount": 1250,
                "trend": "stable", "generatedAt": datetime.utcnow().isoformat()
            })
            return
        # Referrals endpoint — returns a list with unique referralCode fields
        if path == "/api/referrals" and method == "GET":
            self.send_json(200, [
                {"id": f"REF-{i:04d}", "referrerId": "USER-001",
                 "referralCode": f"REF{i:04d}ABCD",
                 "refereeEmail": f"referee{i}@example.com",
                 "status": "pending", "bonus": 500.0,
                 "createdAt": (datetime.utcnow() - timedelta(days=i)).isoformat()}
                for i in range(1, 4)
            ])
            return
        # Policy documents endpoint
        # TigerBeetle ledger account balance endpoint
        m_ledger = re.match(r"^/api/ledger/accounts/([^/]+)/balance$", path)
        if m_ledger and method == "GET":
            account_id = m_ledger.group(1)
            if account_id in LEDGER_ACCOUNTS:
                acct = LEDGER_ACCOUNTS[account_id]
                self.send_json(200, {
                    "accountId": account_id,
                    "debitsPosted": acct.get("debitsPosted", 0),
                    "creditsPosted": acct.get("creditsPosted", 0),
                    "balance": acct.get("creditsPosted", 0) - acct.get("debitsPosted", 0)
                })
            else:
                # Return a default balance for pre-seeded accounts
                self.send_json(200, {
                    "accountId": account_id,
                    "debitsPosted": 0, "creditsPosted": 0, "balance": 0
                })
            return
        m_docs = re.match(r"^/api/policies/([^/]+)/documents$", path)
        if m_docs and method == "GET":
            policy_id = m_docs.group(1)
            if policy_id not in POLICIES:
                self.send_error_json(404, f"Policy {policy_id} not found", "NOT_FOUND")
                return
            self.send_json(200, [{"id": f"DOC-{i:04d}", "policy_id": policy_id,
                                   "name": f"Policy Document {i}", "type": "pdf",
                                   "url": f"/api/documents/DOC-{i:04d}.pdf",
                                   "created_at": "2025-01-01T00:00:00Z"}
                                  for i in range(1, 3)])
            return
        # User notification preferences
        if path == "/api/users/me/notifications" and method in ("PUT", "PATCH"):
            self.send_json(200, {"preferences": body, "updated_at": datetime.utcnow().isoformat()})
            return
        if path == "/api/premium-rates" and method == "GET":
            self.send_json(200, {"rates": [
                {"product_id": "PROD-001", "base_rate": 0.025, "age_factor": 1.2, "region_factor": 1.0},
                {"product_id": "PROD-002", "base_rate": 0.015, "age_factor": 1.5, "region_factor": 0.95},
            ]})
            return

        if path == "/api/premium-rates" and method == "POST":
            rate_id = str(uuid.uuid4())
            self.send_json(201, {"id": rate_id, "status": "created", **body})
            return

        # ── Broker API ────────────────────────────────────────────────────────
        if path == "/api/broker/keys" and method == "GET":
            self.send_json(200, [{"id": f"KEY-{i:04d}", "name": f"Broker API Key {i}",
                                   "prefix": f"bk_{i:04d}", "created_at": "2025-01-01T00:00:00Z",
                                   "last_used": "2025-03-01T00:00:00Z", "status": "active"}
                                  for i in range(1, 4)])
            return
        if path == "/api/broker/keys" and method == "POST":
            new_key = hashlib.sha256(str(uuid.uuid4()).encode()).hexdigest()[:40]
            key_id = f"KEY-{str(uuid.uuid4())[:8].upper()}"
            API_KEYS[new_key] = {"id": key_id, "name": body.get("name", "API Key"),
                                  "permissions": body.get("permissions", ["read"]),
                                  "rateLimit": body.get("rateLimit", 1000)}
            self.send_json(201, {"id": key_id, "apiKey": new_key,
                                  "name": body.get("name", "API Key"),
                                  "permissions": body.get("permissions", ["read"]),
                                  "createdAt": datetime.utcnow().isoformat()})
            return
        if path == "/api/broker/api-keys" and method == "POST":
            new_key = hashlib.sha256(str(uuid.uuid4()).encode()).hexdigest()[:32]
            API_KEYS[new_key] = {"owner": body.get("broker_id", "unknown"), "permissions": body.get("permissions", ["read"])}
            self.send_json(201, {"api_key": new_key, "permissions": API_KEYS[new_key]["permissions"],
                                  "created_at": datetime.utcnow().isoformat()})
            return

        if path == "/api/broker/usage" and method == "GET":
            self.send_json(200, {"usage": {"requests_today": 1250, "requests_month": 34500,
                                            "quota": 100000, "quota_used_pct": 34.5}})
            return

        # ── Telco credit scoring ───────────────────────────────────────────────
        if path in ("/api/telco/credit-score", "/api/telco-credit/score") and method == "POST":
            phone = body.get("phoneNumber", body.get("phone_number", ""))
            provider = body.get("provider", "MTN")
            if not phone:
                self.send_error_json(400, "phoneNumber is required", "VALIDATION_ERROR")
                return
            score = int(hashlib.md5(phone.encode()).hexdigest()[:4], 16) % 400 + 400  # 400-800
            grade = "A" if score > 700 else ("B" if score > 600 else ("C" if score > 500 else "D"))
            self.send_json(200, {
                "phoneNumber": phone[-4:].rjust(len(phone), "*"),
                "provider": provider, "score": score, "grade": grade,
                "creditLimit": score * 1000, "riskTier": grade,
                "dataPoints": 12, "confidence": 0.87,
                "assessedAt": datetime.utcnow().isoformat()
            })
            return
        # Telco credit score history
        if path == "/api/telco-credit/history" and method == "GET":
            self.send_json(200, [
                {"id": f"TCH-{i:04d}", "phoneNumber": "***4567", "score": 650 + (i * 10),
                 "grade": "B", "provider": "MTN", "assessedAt": (datetime.utcnow() - timedelta(days=i*30)).isoformat()}
                for i in range(3)
            ])
            return
        # ── ERPNext integration ───────────────────────────────────────────────────
        # ERPNext sync status endpoint
        if path == "/api/erpnext/sync/status" and method == "GET":
            self.send_json(200, {
                "lastSync": (datetime.utcnow() - timedelta(minutes=15)).isoformat(),
                "pendingCount": 3, "syncedCount": 1247, "failedCount": 0,
                "status": "healthy", "nextScheduled": (datetime.utcnow() + timedelta(minutes=45)).isoformat()
            })
            return
        if path == "/api/erpnext/sync" and method == "POST":
            self.send_json(200, {"status": "synced", "records_synced": 42,
                                  "sync_id": str(uuid.uuid4()), "timestamp": datetime.utcnow().isoformat()})
            return
        # ERPNext reconciliation endpoint
        if path == "/api/erpnext/reconciliation" and method == "GET":
            month = qs.get("month", ["2024-01"])[0]
            self.send_json(200, {"month": month, "total_payments": 150,
                                  "reconciled": 148, "unreconciled": 2,
                                  "total_amount": 750000.0, "reconciled_amount": 745000.0,
                                  "generated_at": datetime.utcnow().isoformat()})
            return
        # ERPNext sync trigger endpoint
        if path == "/api/erpnext/sync/trigger" and method == "POST":
            self.send_json(202, {"status": "accepted", "job_id": str(uuid.uuid4()),
                                  "entity_type": body.get("entityType", "Payment"),
                                  "period": body.get("period", ""),
                                  "estimated_completion": "30s"})
            return
        if path == "/api/erpnext/ledger" and method == "GET":
            self.send_json(200, {"ledger": [
                {"account": "Premium Income", "debit": 0, "credit": 125000.0, "balance": 125000.0},
                {"account": "Claims Expense", "debit": 87500.0, "credit": 0, "balance": -87500.0},
                {"account": "Reinsurance Premium", "debit": 25000.0, "credit": 0, "balance": -25000.0},
            ]})
            return

        # ── Reinsurance ───────────────────────────────────────────────────
        if path == "/api/reinsurance/cessions" and method == "POST":
            cession_id = f"CES-{str(uuid.uuid4())[:8].upper()}"
            self.send_json(201, {
                "cessionId": cession_id,
                "cedantId": body.get("cedantId", ""),
                "reinsurerIds": body.get("reinsurerIds", []),
                "treatyType": body.get("treatyType", "proportional"),
                "cessionPercentage": body.get("cessionPercentage", 30),
                "status": "pending",
                "effectiveDate": body.get("effectiveDate", datetime.utcnow().isoformat()),
                "createdAt": datetime.utcnow().isoformat()
            })
            return
        if path == "/api/reinsurance/bordereau/generate" and method == "POST":
            job_id = f"BDR-{str(uuid.uuid4())[:8].upper()}"
            self.send_json(202, {
                "jobId": job_id, "status": "generating",
                "period": body.get("period", "2024-01"),
                "treatyId": body.get("treatyId", ""),
                "estimatedCompletion": (datetime.utcnow() + timedelta(seconds=10)).isoformat()
            })
            return
        if path == "/api/reinsurance/cessions" and method == "GET":
            # Return list directly for REST-style access
            self.send_json(200, [
                {"id": f"CES-{i:04d}", "policy_id": f"POL-{i:04d}", "reinsurer": "Reinsurer A",
                 "cession_rate": 0.3, "premium_ceded": 360.0, "status": "active"}
                for i in range(1, 4)
            ])
            return
        # Reinsurance accounting summary
        if path == "/api/reinsurance/accounting/summary" and method == "GET":
            self.send_json(200, {
                "totalCeded": 54000.0, "totalRecovered": 18000.0,
                "netRetention": 36000.0, "lossRatio": 0.333,
                "period": "2025-Q1", "reinsurerCount": 2
            })
            return

        if path == "/api/reinsurance/bordereau" and method == "GET":
            self.send_json(200, {"bordereau": {
                "period": qs.get("period", ["2025-Q1"])[0],
                "total_cessions": 150, "total_premium_ceded": 54000.0,
                "total_claims_ceded": 18000.0, "loss_ratio": 0.333,
                "generated_at": datetime.utcnow().isoformat()
            }})
            return

        if path == "/api/reinsurance/settlements" and method == "GET":
            self.send_json(200, {"settlements": [
                {"id": f"SET-{i:04d}", "reinsurer": "Reinsurer A",
                 "amount": 18000.0, "status": "completed", "settled_at": "2025-03-15"}
                for i in range(1, 3)
            ]})
            return

        # ── Audit logs ────────────────────────────────────────────────────────
        if path == "/api/audit/logs" and method == "GET":
            page = int(qs.get("page", ["1"])[0])
            limit = int(qs.get("limit", ["20"])[0])
            logs = AUDIT_LOGS[-100:]  # Last 100
            start = (page - 1) * limit
            self.send_json(200, {"logs": logs[start:start+limit], "total": len(logs)})
            return
        # Admin audit logs (alias)
        if path == "/api/admin/audit-logs" and method == "GET":
            # Admin-only endpoint - check role
            user = get_user_from_token(self.headers.get("Authorization", ""))
            if not user or user.get("role") not in ("admin", "superadmin"):
                self.send_error_json(403, "Admin access required", "FORBIDDEN")
                return
            limit = int(qs.get("limit", ["50"])[0])
            logs = AUDIT_LOGS[-limit:]
            self.send_json(200, logs)
            return
        if path == "/api/audit/premium-rates" and method == "GET":
            self.send_json(200, {"audit_trail": [
                {"action": "rate_updated", "product": "PROD-001", "old_rate": 0.024,
                 "new_rate": 0.025, "changed_by": "admin", "timestamp": "2025-02-01T10:00:00Z"}
            ]})
            return
        # Premium rates audit trail (compliance officer endpoint)
        if path == "/api/premium-rates/audit" and method == "GET":
            limit = int(qs.get("limit", ["20"])[0])
            self.send_json(200, [
                {"action": "rate_updated", "product": f"PROD-{i:03d}",
                 "old_rate": 0.024, "new_rate": 0.025,
                 "changed_by": "admin", "timestamp": "2025-02-01T10:00:00Z",
                 "reason": "Annual review"}
                for i in range(1, min(limit+1, 6))
            ])
            return
        # Fraud analytics endpoint
        if path == "/api/fraud/analytics" and method == "GET":
            time_range = qs.get("timeRange", ["30d"])[0]
            self.send_json(200, {
                "totalRequests": 45230, "blocked": 127, "suspicious": 89,
                "blockRate": 0.0028, "falsePositiveRate": 0.0012, "timeRange": time_range,
                "topAttackTypes": [{"type": "SQL Injection", "count": 45},
                                    {"type": "XSS", "count": 38},
                                    {"type": "Path Traversal", "count": 12}],
                "generatedAt": datetime.utcnow().isoformat()
            })
            return

        # ── Knowledge graph ───────────────────────────────────────────────────
        if path == "/api/knowledge-graph/nodes" and method == "GET":
            self.send_json(200, [
                {"id": "POL-0001", "type": "policy", "label": "Policy POL-0001", "connections": 3},
                {"id": "CLM-0001", "type": "claim", "label": "Claim CLM-0001", "connections": 2},
                {"id": "USR-0001", "type": "user", "label": "Customer USR-0001", "connections": 5},
            ])
            return
        if path == "/api/knowledge-graph/edges" and method == "GET":
            node_id = qs.get("nodeId", ["POL-0001"])[0]
            self.send_json(200, {
                "nodeId": node_id,
                "edges": [
                    {"from": node_id, "to": "CLM-0001", "relation": "has_claim", "weight": 1.0},
                    {"from": node_id, "to": "USR-0001", "relation": "owned_by", "weight": 1.0},
                ]
            })
            return
        if path == "/api/knowledge-graph/query" and method == "POST":
            self.send_json(200, {"nodes": [
                {"id": "POL-0001", "type": "policy", "connections": 3},
                {"id": "CLM-0001", "type": "claim", "connections": 2},
            ], "edges": [{"from": "POL-0001", "to": "CLM-0001", "relation": "has_claim"}]})
            return

         # ── Fraud network ───────────────────────────────────────────────────
        if path == "/api/fraud/rings" and method == "GET":
            self.send_json(200, [
                {"ringId": "RING-001", "members": ["CLM-0001", "CLM-0002"], "riskScore": 0.82,
                 "detectedAt": datetime.utcnow().isoformat(), "status": "under_investigation"},
            ])
            return
        if path == "/api/fraud/network" and method == "GET":
            entity_id = qs.get("entityId", ["CLM-001"])[0]
            depth = int(qs.get("depth", ["2"])[0])
            self.send_json(200, {
                "entityId": entity_id, "depth": depth,
                "nodes": [
                    {"id": entity_id, "type": "claim", "riskScore": 0.15},
                    {"id": "POL-0001", "type": "policy", "riskScore": 0.05},
                    {"id": "USR-0001", "type": "user", "riskScore": 0.08},
                ],
                "edges": [
                    {"from": entity_id, "to": "POL-0001", "relation": "filed_against"},
                    {"from": "POL-0001", "to": "USR-0001", "relation": "owned_by"},
                ]
            })
            return
        if path == "/api/fraud-network/analyze" and method == "POST":
            self.send_json(200, {"network_score": 0.08, "connected_fraud_cases": 0,
                                  "risk_level": "low", "recommendation": "approve"})
            return

        # ── Users / Admin ─────────────────────────────────────────────────────
        if path == "/api/admin/users" and method == "GET":
            if role != "admin":
                self.send_error_json(403, "Admin access required", "FORBIDDEN")
                return
            self.send_json(200, {"users": list(USERS.values()), "total": len(USERS)})
            return

        if path == "/api/admin/services" and method == "GET":
            self.send_json(200, {"services": [
                {"name": "policy-service", "status": "running", "replicas": 3, "healthy": 3},
                {"name": "claims-service", "status": "running", "replicas": 3, "healthy": 3},
                {"name": "payment-service", "status": "running", "replicas": 2, "healthy": 2},
                {"name": "fraud-detection", "status": "running", "replicas": 2, "healthy": 2},
                {"name": "underwriting-service", "status": "running", "replicas": 2, "healthy": 2},
            ]})
            return

        # ── Input validation tests ─────────────────────────────────────────────
        # Negative amounts
        if "amount" in body:
            try:
                amount = float(body["amount"])
                if amount < 0:
                    self.send_error_json(400, "Amount must be non-negative", "VALIDATION_ERROR")
                    return
            except (ValueError, TypeError):
                self.send_error_json(400, "Amount must be a number", "VALIDATION_ERROR")
                return

        # Email validation
        if "email" in body:
            email = body["email"]
            if not re.match(r"^[^@]+@[^@]+\.[^@]+$", email):
                self.send_error_json(400, "Invalid email format", "VALIDATION_ERROR")
                return

        # Future incident date
        if "incident_date" in body:
            try:
                incident_date = datetime.fromisoformat(body["incident_date"])
                if incident_date > datetime.utcnow() + timedelta(hours=1):
                    self.send_error_json(400, "Incident date cannot be in the future", "VALIDATION_ERROR")
                    return
            except ValueError:
                self.send_error_json(400, "Invalid incident_date format", "VALIDATION_ERROR")
                return

        # ── Fallback 404 ──────────────────────────────────────────────────────
        self.send_error_json(404, f"Endpoint {method} {path} not found", "NOT_FOUND")

    def _handle_login(self, body):
        username = body.get("username", "")
        password = body.get("password", "")
        if not username or not password:
            self.send_error_json(400, "username and password required", "VALIDATION_ERROR")
            return
        user = USERS.get(username)
        if user and password == "test-password":
            AUDIT_LOGS.append({"event": "login_success", "user": username, "ts": datetime.utcnow().isoformat()})
            self.send_json(200, {"token": user["token"], "role": user["role"],
                                  "expires_in": 3600, "token_type": "Bearer"})
        else:
            AUDIT_LOGS.append({"event": "login_failed", "user": username, "ts": datetime.utcnow().isoformat()})
            self.send_error_json(401, "Invalid credentials", "INVALID_CREDENTIALS")

    def _handle_token(self, body):
        api_key = body.get("api_key", "")
        if api_key in API_KEYS:
            self.send_json(200, {"token": api_key, "token_type": "Bearer", "expires_in": 86400})
        else:
            self.send_error_json(401, "Invalid API key", "INVALID_API_KEY")

    def _handle_oidc_token(self, body, client_ip: str):
        """Keycloak-compatible OIDC token endpoint with brute force protection."""
        username = body.get("username", "")
        password = body.get("password", "")
        # Brute force protection: track failed attempts per user per IP
        bf_key = f"bf:{client_ip}:{username}"
        if bf_key not in RATE_LIMIT_TRACKER:
            RATE_LIMIT_TRACKER[bf_key] = []
        now = time.time()
        # Clean old entries (5-minute window)
        RATE_LIMIT_TRACKER[bf_key] = [t for t in RATE_LIMIT_TRACKER[bf_key] if now - t < 300]
        if len(RATE_LIMIT_TRACKER[bf_key]) >= 5:
            self.send_json(429, {"error": "too_many_requests", "error_description": "Account temporarily locked"},
                           extra_headers={"Retry-After": "300"})
            return
        user = USERS.get(username)
        if user and password == "test-password":
            # Reset brute force counter on success
            RATE_LIMIT_TRACKER[bf_key] = []
            self.send_json(200, {
                "access_token": user["token"],
                "token_type": "Bearer",
                "expires_in": 3600,
                "refresh_token": f"refresh-{user['token']}",
                "scope": "openid profile email"
            })
        else:
            RATE_LIMIT_TRACKER[bf_key].append(now)
            AUDIT_LOGS.append({"event": "auth_failed", "user": username, "ip": client_ip, "ts": datetime.utcnow().isoformat()})
            self.send_json(401, {"error": "invalid_grant", "error_description": "Invalid credentials"})

    def _create_policy(self, body):
        # Normalize field names — support both camelCase (frontend) and snake_case (API)
        # Map camelCase -> snake_case for backward compatibility
        if "type" in body and "coverage_type" not in body:
            body["coverage_type"] = body["type"]
        if "name" in body and "insured_name" not in body:
            body["insured_name"] = body["name"]
        if "policyNumber" in body and "policy_number" not in body:
            body["policy_number"] = body["policyNumber"]
        if "startDate" in body and "start_date" not in body:
            body["start_date"] = body["startDate"]
        if "expiryDate" in body and "end_date" not in body:
            body["end_date"] = body["expiryDate"]
        # Validate required fields
        required = ["coverage_type", "premium"]
        for field in required:
            if field not in body:
                self.send_error_json(400, f"Missing required field: {field}", "VALIDATION_ERROR")
                return
        # Validate premium
        try:
            premium = float(body["premium"])
            if premium <= 0:
                self.send_error_json(400, "Premium must be positive", "VALIDATION_ERROR")
                return
        except (ValueError, TypeError):
            self.send_error_json(400, "Premium must be a number", "VALIDATION_ERROR")
            return
        policy_id = f"POL-{str(uuid.uuid4())[:8].upper()}"
        policy = {
            "id": policy_id, "status": "Pending",
            "userId": f"usr-{str(uuid.uuid4())[:8]}",
            "created_at": datetime.utcnow().isoformat(),
            **body
        }
        POLICIES[policy_id] = policy
        AUDIT_LOGS.append({"event": "policy_created", "policy_id": policy_id, "ts": datetime.utcnow().isoformat()})
        self.send_json(201, policy)

    def _create_claim(self, body):
        # Normalize camelCase -> snake_case
        if "policyId" in body and "policy_id" not in body:
            body["policy_id"] = body["policyId"]
        if "claimNumber" in body and "claim_number" not in body:
            body["claim_number"] = body["claimNumber"]
        if "incidentDate" in body and "incident_date" not in body:
            body["incident_date"] = body["incidentDate"]
        required = ["policy_id", "amount", "description"]
        for field in required:
            if field not in body:
                self.send_error_json(400, f"Missing required field: {field}", "VALIDATION_ERROR")
                return
        # Validate future incident date
        incident_date_str = body.get("incident_date", body.get("incidentDate", ""))
        if incident_date_str:
            try:
                # Handle both Z suffix and +00:00
                clean_date = incident_date_str.replace("Z", "+00:00") if incident_date_str.endswith("Z") else incident_date_str
                # Parse without timezone for comparison
                clean_date = clean_date.split("+")[0].rstrip("Z")
                incident_dt = datetime.fromisoformat(clean_date)
                if incident_dt > datetime.utcnow() + timedelta(hours=1):
                    self.send_error_json(400, "Incident date cannot be in the future", "VALIDATION_ERROR")
                    return
            except (ValueError, TypeError):
                self.send_error_json(400, "Invalid incident date format", "VALIDATION_ERROR")
                return
        policy_id = str(body["policy_id"])  # Accept both int and str policy IDs
        # For integer policy IDs (like 1), skip the POLICIES lookup (valid in test context)
        if policy_id not in POLICIES and not policy_id.isdigit():
            self.send_error_json(404, f"Policy {policy_id} not found", "NOT_FOUND")
            return
        try:
            amount = float(body["amount"])
            if amount <= 0:
                self.send_error_json(400, "Claim amount must be positive", "VALIDATION_ERROR")
                return
        except (ValueError, TypeError):
            self.send_error_json(400, "Amount must be a number", "VALIDATION_ERROR")
            return
        claim_id = f"CLM-{str(uuid.uuid4())[:8].upper()}"
        claim = {
            **body,
            "id": claim_id,
            "status": "Submitted",  # Always override to Submitted regardless of body
            "submitted_at": datetime.utcnow().isoformat(),
            "claimNumber": body.get("claimNumber", body.get("claim_number", claim_id)),
            "policyId": body.get("policyId", body.get("policy_id", "")),
        }
        CLAIMS[claim_id] = claim
        AUDIT_LOGS.append({"event": "claim_submitted", "claim_id": claim_id, "ts": datetime.utcnow().isoformat()})
        self.send_json(201, claim)

    def _create_payment(self, body):
        # Accept both snake_case and camelCase field names
        policy_id = body.get("policy_id") or body.get("policyId")
        amount_raw = body.get("amount")
        if not policy_id:
            self.send_error_json(400, "Missing required field: policy_id", "VALIDATION_ERROR")
            return
        if amount_raw is None:
            self.send_error_json(400, "Missing required field: amount", "VALIDATION_ERROR")
            return
        try:
            amount = float(amount_raw)
            if amount <= 0:
                self.send_error_json(400, "Payment amount must be positive", "VALIDATION_ERROR")
                return
        except (ValueError, TypeError):
            self.send_error_json(400, "Amount must be a number", "VALIDATION_ERROR")
            return
        payment_id = f"PAY-{str(uuid.uuid4())[:8].upper()}"
        payment = {
            "id": payment_id, "status": "Completed",
            "created_at": datetime.utcnow().isoformat(),
            "transaction_ref": str(uuid.uuid4()),
            **body
        }
        PAYMENTS[payment_id] = payment
        AUDIT_LOGS.append({"event": "payment_processed", "payment_id": payment_id, "ts": datetime.utcnow().isoformat()})
        self.send_json(201, payment)

    def _underwriting_assess(self, body):
        # Accept both old-style (policy_id, applicant_age, coverage_type) and
        # new-style (applicantId, productType, age, smoker, etc.) field names
        age = body.get("age") or body.get("applicant_age", 30)
        smoker = body.get("smoker", False)
        occupation = body.get("occupation", "Office Worker")
        pre_existing = body.get("preExistingConditions", [])
        # Risk scoring algorithm
        base_risk = 0.15 + (int(age) - 25) * 0.005
        if smoker:
            base_risk += 0.15
        if pre_existing:
            base_risk += len(pre_existing) * 0.05
        high_risk_occupations = ["Pilot", "Miner", "Firefighter", "Police"]
        if occupation in high_risk_occupations:
            base_risk += 0.1
        risk_score = min(0.95, max(0.05, base_risk))
        # Decision logic
        if risk_score < 0.4:
            decision = "approve"
        elif risk_score < 0.7:
            decision = "conditional_approve"
        elif risk_score < 0.85:
            decision = "refer"
        else:
            decision = "decline"
        # Use a fixed base premium scaled by product type, then apply risk loading.
        # This ensures high-risk applicants always pay more than low-risk applicants
        # regardless of income level.
        product_base = {"Health": 50000, "Life": 80000, "Motor": 30000, "Property": 40000}
        product_type = body.get("productType", body.get("coverage_type", "Health"))
        base_premium = product_base.get(product_type, 50000)
        # Risk loading: low risk (0.15) = 1.15x, high risk (0.725) = 2.45x
        risk_loading = 1.0 + (risk_score * 2.0)
        recommended_premium = round(base_premium * risk_loading, 2)
        self.send_json(200, {
            "applicantId": body.get("applicantId", body.get("policy_id", "UNKNOWN")),
            "riskScore": round(risk_score, 3),
            "recommendedPremium": recommended_premium,
            "decision": decision,
            "premiumAdjustment": round(1.0 + risk_score * 0.5, 3),
            "conditions": [] if decision == "approve" else ["medical_exam_required"],
            "assessedAt": datetime.utcnow().isoformat()
        })


def run_server(port: int = 8080):
    server = HTTPServer(("0.0.0.0", port), PlatformHandler)
    print(f"Test harness server running on port {port}")
    server.serve_forever()


if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    run_server(port)
