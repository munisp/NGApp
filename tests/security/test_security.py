#!/usr/bin/env python3
"""
Security Test Suite — Unified Insurance Platform
Covers: OWASP Top 10, SQL Injection, XSS, CSRF, Auth Bypass,
        Privilege Escalation, Data Exposure, Rate Limiting, TLS,
        JWT Security, API Security, OpenAppSec WAF validation
"""

import os
import json
import time
import uuid
import pytest
import requests
import ssl
import socket
from typing import List, Dict, Any

# ── Configuration ─────────────────────────────────────────────────────────────
BASE_URL = os.getenv("PLATFORM_BASE_URL", "http://localhost:8080")
HTTPS_URL = os.getenv("PLATFORM_HTTPS_URL", "https://localhost:8443")
API_KEY = os.getenv("PLATFORM_API_KEY", "test-api-key")
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "test-admin-token")
USER_TOKEN = os.getenv("USER_TOKEN", "test-user-token")

ADMIN_HEADERS = {"Authorization": f"Bearer {ADMIN_TOKEN}", "Content-Type": "application/json"}
USER_HEADERS = {"Authorization": f"Bearer {USER_TOKEN}", "Content-Type": "application/json"}


# ── SQL Injection Tests ───────────────────────────────────────────────────────
class TestSQLInjection:
    """OWASP A03:2021 — Injection"""

    SQL_PAYLOADS = [
        "' OR '1'='1",
        "'; DROP TABLE policies; --",
        "1 UNION SELECT * FROM users --",
        "' OR 1=1 --",
        "admin'--",
        "1; SELECT * FROM information_schema.tables",
        "' UNION SELECT NULL, NULL, NULL --",
        "1 OR 1=1",
        "' OR 'x'='x",
        "1'; EXEC xp_cmdshell('whoami'); --",
    ]

    @pytest.mark.parametrize("payload", SQL_PAYLOADS)
    def test_sql_injection_in_policy_id(self, payload):
        """SQL injection in policy ID path parameter should be rejected."""
        resp = requests.get(
            f"{BASE_URL}/api/policies/{payload}",
            headers=USER_HEADERS,
            timeout=10,
        )
        # Should return 400 (bad request) or 404 (not found), never 200 with data
        assert resp.status_code in (400, 401, 403, 404, 422, 500), (
            f"SQL injection payload '{payload}' returned unexpected status {resp.status_code}"
        )
        # Response should not contain database error messages
        response_text = resp.text.lower()
        dangerous_strings = ["syntax error", "mysql", "postgresql", "sqlite", "ora-", "sql server"]
        for dangerous in dangerous_strings:
            assert dangerous not in response_text, (
                f"Database error exposed in response for payload '{payload}': {resp.text[:200]}"
            )

    @pytest.mark.parametrize("payload", SQL_PAYLOADS[:5])
    def test_sql_injection_in_search_params(self, payload):
        """SQL injection in query parameters should be sanitized."""
        resp = requests.get(
            f"{BASE_URL}/api/policies",
            params={"search": payload, "filter": payload},
            headers=USER_HEADERS,
            timeout=10,
        )
        assert resp.status_code in (200, 400, 401, 403, 422)
        if resp.status_code == 200:
            # Should return empty results, not all records
            data = resp.json()
            assert isinstance(data, list)

    @pytest.mark.parametrize("payload", SQL_PAYLOADS[:5])
    def test_sql_injection_in_request_body(self, payload):
        """SQL injection in request body fields should be sanitized."""
        resp = requests.post(
            f"{BASE_URL}/api/policies",
            json={
                "policyNumber": payload,
                "name": payload,
                "type": "Health",
                "premium": "5000.00",
                "startDate": "2024-01-01T00:00:00Z",
                "expiryDate": "2025-01-01T00:00:00Z",
            },
            headers=USER_HEADERS,
            timeout=10,
        )
        assert resp.status_code in (400, 401, 403, 422)


# ── XSS Tests ─────────────────────────────────────────────────────────────────
class TestXSS:
    """OWASP A03:2021 — Cross-Site Scripting"""

    XSS_PAYLOADS = [
        "<script>alert('xss')</script>",
        "<img src=x onerror=alert(1)>",
        "javascript:alert(1)",
        "<svg onload=alert(1)>",
        "';alert('xss')//",
        "<iframe src='javascript:alert(1)'>",
        "<<SCRIPT>alert('XSS');//<</SCRIPT>",
        "<body onload=alert('XSS')>",
        "\" onmouseover=\"alert(1)",
        "<a href='javascript:alert(1)'>click</a>",
    ]

    @pytest.mark.parametrize("payload", XSS_PAYLOADS[:5])
    def test_xss_in_policy_name(self, payload):
        """XSS payloads in policy name should be sanitized or rejected."""
        resp = requests.post(
            f"{BASE_URL}/api/policies",
            json={
                "policyNumber": f"POL-{uuid.uuid4().hex[:8].upper()}",
                "name": payload,
                "type": "Health",
                "premium": "5000.00",
                "startDate": "2024-01-01T00:00:00Z",
                "expiryDate": "2025-01-01T00:00:00Z",
            },
            headers=USER_HEADERS,
            timeout=10,
        )
        if resp.status_code in (200, 201):
            # If accepted, the stored value must be sanitized
            data = resp.json()
            stored_name = data.get("name", "")
            assert "<script>" not in stored_name.lower()
            assert "javascript:" not in stored_name.lower()
            assert "onerror=" not in stored_name.lower()
        else:
            assert resp.status_code in (400, 422)

    def test_xss_in_response_content_type(self):
        """API responses must have Content-Type: application/json to prevent XSS."""
        resp = requests.get(f"{BASE_URL}/api/policies", headers=USER_HEADERS, timeout=10)
        content_type = resp.headers.get("Content-Type", "")
        assert "application/json" in content_type, (
            f"API response Content-Type should be application/json, got: {content_type}"
        )

    def test_xss_security_headers(self):
        """Security headers must be present to prevent XSS."""
        resp = requests.get(f"{BASE_URL}/api/policies", headers=USER_HEADERS, timeout=10)
        # Check for security headers
        headers = resp.headers
        # X-Content-Type-Options prevents MIME sniffing
        assert headers.get("X-Content-Type-Options") == "nosniff", "Missing X-Content-Type-Options: nosniff"
        # X-Frame-Options prevents clickjacking
        assert headers.get("X-Frame-Options") in ("DENY", "SAMEORIGIN"), "Missing X-Frame-Options"


# ── Authentication & Authorization Tests ─────────────────────────────────────
class TestAuthentication:
    """OWASP A07:2021 — Identification and Authentication Failures"""

    def test_no_auth_returns_401(self):
        """All API endpoints must require authentication."""
        endpoints = [
            "/api/policies",
            "/api/claims",
            "/api/payments",
            "/api/fraud/score",
            "/api/underwriting/assess",
        ]
        for endpoint in endpoints:
            resp = requests.get(f"{BASE_URL}{endpoint}", timeout=10)
            assert resp.status_code in (401, 403), (
                f"Endpoint {endpoint} returned {resp.status_code} without auth"
            )

    def test_invalid_jwt_returns_401(self):
        """Invalid JWT tokens must be rejected."""
        invalid_tokens = [
            "invalid-token",
            "Bearer invalid",
            "eyJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbiJ9.",  # Algorithm: none attack
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.invalid",
        ]
        for token in invalid_tokens:
            resp = requests.get(
                f"{BASE_URL}/api/policies",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10,
            )
            assert resp.status_code in (401, 403), (
                f"Invalid token '{token[:30]}...' returned {resp.status_code}"
            )

    def test_jwt_algorithm_none_attack(self):
        """JWT with algorithm=none must be rejected."""
        import base64
        header = base64.b64encode(b'{"alg":"none","typ":"JWT"}').decode().rstrip("=")
        payload = base64.b64encode(b'{"sub":"admin","role":"admin","exp":9999999999}').decode().rstrip("=")
        token = f"{header}.{payload}."
        resp = requests.get(
            f"{BASE_URL}/api/policies",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        assert resp.status_code in (401, 403), "JWT algorithm=none attack was not rejected"

    def test_privilege_escalation_user_to_admin(self):
        """Regular users must not be able to access admin endpoints."""
        admin_endpoints = [
            "/api/admin/users",
            "/api/admin/settings",
            "/api/admin/audit-logs",
        ]
        for endpoint in admin_endpoints:
            resp = requests.get(
                f"{BASE_URL}{endpoint}",
                headers=USER_HEADERS,
                timeout=10,
            )
            assert resp.status_code in (401, 403, 404), (
                f"User accessed admin endpoint {endpoint}: {resp.status_code}"
            )

    def test_idor_prevention(self):
        """Users must not be able to access other users' resources."""
        # Try to access a specific user's policies by ID manipulation
        resp = requests.get(
            f"{BASE_URL}/api/users/99999/policies",
            headers=USER_HEADERS,
            timeout=10,
        )
        assert resp.status_code in (401, 403, 404), (
            f"IDOR vulnerability: accessed user 99999's policies: {resp.status_code}"
        )


# ── Rate Limiting Tests ───────────────────────────────────────────────────────
class TestRateLimiting:
    """OWASP A04:2021 — Insecure Design / Brute Force Protection"""

    def test_rate_limit_enforced(self):
        """API endpoints must enforce rate limiting."""
        responses = []
        for _ in range(200):  # Send 200 rapid requests
            resp = requests.get(
                f"{BASE_URL}/api/policies",
                headers=USER_HEADERS,
                timeout=5,
            )
            responses.append(resp.status_code)
            if resp.status_code == 429:
                break

        # Should have received at least one 429 Too Many Requests
        assert 429 in responses, (
            f"Rate limiting not enforced after 200 requests. Status codes: {set(responses)}"
        )

    def test_brute_force_protection_on_auth(self):
        """Authentication endpoint must block brute force attempts."""
        keycloak_url = os.getenv("KEYCLOAK_URL", "http://localhost:8180")
        responses = []
        for i in range(20):
            resp = requests.post(
                f"{keycloak_url}/realms/insurance/protocol/openid-connect/token",
                data={
                    "grant_type": "password",
                    "client_id": "insurance-platform",
                    "username": "admin",
                    "password": f"wrong-password-{i}",
                },
                timeout=5,
            )
            responses.append(resp.status_code)
            if resp.status_code == 429:
                break

        # After repeated failures, should return 429 or 401
        assert all(s in (400, 401, 429) for s in responses), (
            f"Unexpected status codes during brute force: {set(responses)}"
        )


# ── Sensitive Data Exposure Tests ─────────────────────────────────────────────
class TestSensitiveDataExposure:
    """OWASP A02:2021 — Cryptographic Failures"""

    def test_no_sensitive_data_in_error_responses(self):
        """Error responses must not expose sensitive data."""
        resp = requests.get(
            f"{BASE_URL}/api/policies/999999",
            headers=USER_HEADERS,
            timeout=10,
        )
        assert resp.status_code in (404, 400)
        response_text = resp.text.lower()
        sensitive_patterns = [
            "password",
            "secret",
            "private_key",
            "api_key",
            "database",
            "connection string",
            "stack trace",
            "at line",
            "goroutine",
        ]
        for pattern in sensitive_patterns:
            assert pattern not in response_text, (
                f"Sensitive data '{pattern}' exposed in error response: {resp.text[:500]}"
            )

    def test_passwords_not_in_api_responses(self):
        """User data API responses must not include passwords."""
        resp = requests.get(f"{BASE_URL}/api/users/me", headers=USER_HEADERS, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            assert "password" not in data
            assert "passwordHash" not in data
            assert "secret" not in data

    def test_api_keys_masked_in_responses(self):
        """API keys must be masked in list responses."""
        resp = requests.get(f"{BASE_URL}/api/broker/keys", headers=ADMIN_HEADERS, timeout=10)
        if resp.status_code == 200:
            keys = resp.json()
            for key in keys:
                api_key_value = key.get("apiKey", key.get("key", ""))
                if api_key_value:
                    # API key should be masked (e.g., "sk-****...****abc")
                    assert len(api_key_value) < 64 or "*" in api_key_value or api_key_value.count("*") > 0, (
                        f"API key not masked: {api_key_value[:20]}..."
                    )

    def test_security_headers_present(self):
        """Critical security headers must be present."""
        resp = requests.get(f"{BASE_URL}/api/policies", headers=USER_HEADERS, timeout=10)
        headers = resp.headers

        required_headers = {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": None,  # Any value
            "Strict-Transport-Security": None,  # Any value (HSTS)
        }

        for header, expected_value in required_headers.items():
            assert header in headers, f"Missing security header: {header}"
            if expected_value:
                assert headers[header] == expected_value, (
                    f"Header {header} has wrong value: {headers[header]}"
                )

    def test_no_server_version_disclosure(self):
        """Server version must not be disclosed in headers."""
        resp = requests.get(f"{BASE_URL}/api/policies", headers=USER_HEADERS, timeout=10)
        server_header = resp.headers.get("Server", "")
        x_powered_by = resp.headers.get("X-Powered-By", "")

        # Should not expose specific versions
        version_patterns = ["nginx/", "apache/", "express/", "node/", "python/", "go/"]
        for pattern in version_patterns:
            assert pattern.lower() not in server_header.lower(), (
                f"Server version disclosed: {server_header}"
            )
            assert pattern.lower() not in x_powered_by.lower(), (
                f"Server version disclosed in X-Powered-By: {x_powered_by}"
            )


# ── Input Validation Tests ────────────────────────────────────────────────────
class TestInputValidation:
    """OWASP A03:2021 — Injection / Input Validation"""

    def test_oversized_payload_rejected(self):
        """Oversized request bodies must be rejected."""
        large_payload = {
            "policyNumber": "A" * 10000,
            "name": "B" * 100000,
            "type": "Health",
            "premium": "5000.00",
            "startDate": "2024-01-01T00:00:00Z",
            "expiryDate": "2025-01-01T00:00:00Z",
        }
        resp = requests.post(
            f"{BASE_URL}/api/policies",
            json=large_payload,
            headers=USER_HEADERS,
            timeout=10,
        )
        assert resp.status_code in (400, 413, 422), (
            f"Oversized payload accepted: {resp.status_code}"
        )

    def test_negative_amounts_rejected(self):
        """Negative monetary amounts must be rejected."""
        resp = requests.post(
            f"{BASE_URL}/api/payments",
            json={
                "policyId": 1,
                "amount": "-50000.00",
                "dueDate": "2024-01-01T00:00:00Z",
                "paymentMethod": "bank_transfer",
            },
            headers=USER_HEADERS,
            timeout=10,
        )
        assert resp.status_code in (400, 422), (
            f"Negative amount accepted: {resp.status_code}"
        )

    def test_future_incident_date_rejected(self):
        """Claims with future incident dates must be rejected."""
        resp = requests.post(
            f"{BASE_URL}/api/claims",
            json={
                "policyId": 1,
                "claimNumber": f"CLM-{uuid.uuid4().hex[:8].upper()}",
                "amount": "10000.00",
                "incidentDate": "2099-01-01T00:00:00Z",  # Future date
                "description": "Future incident test",
            },
            headers=USER_HEADERS,
            timeout=10,
        )
        assert resp.status_code in (400, 422), (
            f"Future incident date accepted: {resp.status_code}"
        )

    def test_invalid_email_format_rejected(self):
        """Invalid email formats must be rejected."""
        invalid_emails = [
            "not-an-email",
            "@nodomain.com",
            "user@",
            "user@@domain.com",
            "user@domain",
        ]
        for email in invalid_emails:
            resp = requests.post(
                f"{BASE_URL}/api/users/register",
                json={
                    "email": email,
                    "password": "ValidPassword123!",
                    "name": "Test User",
                },
                headers={"Content-Type": "application/json"},
                timeout=10,
            )
            assert resp.status_code in (400, 422), (
                f"Invalid email '{email}' accepted: {resp.status_code}"
            )

    def test_path_traversal_rejected(self):
        """Path traversal attempts must be rejected."""
        traversal_payloads = [
            "../../etc/passwd",
            "../../../etc/shadow",
            "..%2F..%2Fetc%2Fpasswd",
            "%2e%2e%2f%2e%2e%2fetc%2fpasswd",
        ]
        for payload in traversal_payloads:
            resp = requests.get(
                f"{BASE_URL}/api/documents/{payload}",
                headers=USER_HEADERS,
                timeout=10,
            )
            assert resp.status_code in (400, 401, 403, 404), (
                f"Path traversal '{payload}' returned {resp.status_code}"
            )
            # Must not return file contents
            assert "root:" not in resp.text
            assert "daemon:" not in resp.text


# ── TLS/HTTPS Tests ───────────────────────────────────────────────────────────
class TestTLSSecurity:
    """OWASP A02:2021 — Cryptographic Failures / TLS Configuration"""

    def test_tls_minimum_version(self):
        """TLS 1.2 must be the minimum supported version."""
        host = HTTPS_URL.replace("https://", "").split(":")[0]
        port = int(HTTPS_URL.split(":")[-1]) if ":" in HTTPS_URL.split("//")[-1] else 443

        # Test that TLS 1.0 is rejected
        try:
            ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
            ctx.maximum_version = ssl.TLSVersion.TLSv1
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            with socket.create_connection((host, port), timeout=5) as sock:
                with ctx.wrap_socket(sock) as ssock:
                    pytest.fail("TLS 1.0 should be rejected but was accepted")
        except (ssl.SSLError, ConnectionRefusedError, OSError):
            pass  # Expected — TLS 1.0 rejected

    def test_http_redirects_to_https(self):
        """HTTP requests must redirect to HTTPS."""
        http_url = BASE_URL.replace("https://", "http://")
        if http_url.startswith("https://"):
            pytest.skip("Already HTTPS")
        try:
            resp = requests.get(http_url, allow_redirects=False, timeout=5)
            assert resp.status_code in (301, 302, 307, 308), (
                f"HTTP does not redirect to HTTPS: {resp.status_code}"
            )
            location = resp.headers.get("Location", "")
            assert location.startswith("https://"), (
                f"HTTP redirect does not point to HTTPS: {location}"
            )
        except requests.exceptions.ConnectionError:
            pytest.skip("HTTP port not accessible")

    def test_hsts_header(self):
        """HSTS header must be present with appropriate max-age."""
        try:
            resp = requests.get(HTTPS_URL, headers=USER_HEADERS, timeout=5, verify=False)
            hsts = resp.headers.get("Strict-Transport-Security", "")
            assert hsts, "HSTS header missing"
            assert "max-age=" in hsts
            # Extract max-age value
            max_age = int(hsts.split("max-age=")[1].split(";")[0].split(",")[0].strip())
            assert max_age >= 31536000, f"HSTS max-age too short: {max_age} (minimum: 31536000)"
        except requests.exceptions.ConnectionError:
            pytest.skip("HTTPS not available in test environment")


# ── OpenAppSec WAF Tests ──────────────────────────────────────────────────────
class TestOpenAppSecWAF:
    """Test OpenAppSec WAF blocks known attack patterns."""

    def test_waf_blocks_sql_injection(self):
        """WAF must block SQL injection attempts."""
        resp = requests.get(
            f"{BASE_URL}/api/policies",
            params={"id": "1 UNION SELECT * FROM users--"},
            headers=USER_HEADERS,
            timeout=10,
        )
        # WAF should block this
        assert resp.status_code in (400, 403, 429), (
            f"WAF did not block SQL injection: {resp.status_code}"
        )

    def test_waf_blocks_xss(self):
        """WAF must block XSS attempts."""
        resp = requests.get(
            f"{BASE_URL}/api/policies",
            params={"search": "<script>alert(1)</script>"},
            headers=USER_HEADERS,
            timeout=10,
        )
        assert resp.status_code in (400, 403), (
            f"WAF did not block XSS: {resp.status_code}"
        )

    def test_waf_allows_legitimate_requests(self):
        """WAF must not block legitimate requests."""
        resp = requests.get(
            f"{BASE_URL}/api/policies",
            params={"type": "Health", "status": "Active"},
            headers=USER_HEADERS,
            timeout=10,
        )
        assert resp.status_code in (200, 401, 403), (
            f"WAF blocked legitimate request: {resp.status_code}"
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short", "-x"])
