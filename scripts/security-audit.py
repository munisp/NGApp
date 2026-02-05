#!/usr/bin/env python3

"""
Security Audit Test Suite for African Fintech Mobile App
Tests security controls, Wazuh SIEM integration, and compliance
"""

import os
import sys
import json
import time
import requests
import subprocess
from typing import Dict, List, Tuple
from datetime import datetime

# Configuration
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:3000")
WAZUH_API_URL = os.getenv("WAZUH_API_URL", "https://localhost:55000")
WAZUH_USERNAME = os.getenv("WAZUH_USERNAME", "admin")
WAZUH_PASSWORD = os.getenv("WAZUH_PASSWORD", "")

# Test results
results = {
    "total_tests": 0,
    "passed": 0,
    "failed": 0,
    "warnings": 0,
    "tests": [],
}


class SecurityTest:
    """Base class for security tests"""
    
    def __init__(self, name: str, category: str):
        self.name = name
        self.category = category
        self.status = "pending"
        self.message = ""
        self.details = {}
    
    def run(self) -> bool:
        """Override this method in subclasses"""
        raise NotImplementedError
    
    def record_result(self, passed: bool, message: str, details: Dict = None):
        """Record test result"""
        self.status = "passed" if passed else "failed"
        self.message = message
        self.details = details or {}
        
        results["total_tests"] += 1
        if passed:
            results["passed"] += 1
        else:
            results["failed"] += 1
        
        results["tests"].append({
            "name": self.name,
            "category": self.category,
            "status": self.status,
            "message": self.message,
            "details": self.details,
        })
        
        return passed


class SSLCertificateTest(SecurityTest):
    """Test SSL/TLS configuration"""
    
    def __init__(self):
        super().__init__("SSL Certificate Validation", "Network Security")
    
    def run(self) -> bool:
        try:
            # Check if HTTPS is enforced
            response = requests.get(
                f"{API_BASE_URL}/health",
                timeout=5,
                verify=True
            )
            
            if response.url.startswith("https://"):
                return self.record_result(
                    True,
                    "HTTPS is properly configured",
                    {"url": response.url}
                )
            else:
                return self.record_result(
                    False,
                    "HTTPS is not enforced",
                    {"url": response.url}
                )
        except requests.exceptions.SSLError as e:
            return self.record_result(
                False,
                f"SSL certificate error: {str(e)}",
                {}
            )
        except Exception as e:
            return self.record_result(
                False,
                f"SSL test failed: {str(e)}",
                {}
            )


class AuthenticationTest(SecurityTest):
    """Test authentication mechanisms"""
    
    def __init__(self):
        super().__init__("Authentication Security", "Access Control")
    
    def run(self) -> bool:
        try:
            # Test 1: Reject unauthenticated requests
            response = requests.get(
                f"{API_BASE_URL}/api/users/me",
                timeout=5
            )
            
            if response.status_code == 401:
                auth_protected = True
            else:
                auth_protected = False
            
            # Test 2: Reject invalid tokens
            response = requests.get(
                f"{API_BASE_URL}/api/users/me",
                headers={"Authorization": "Bearer invalid_token"},
                timeout=5
            )
            
            if response.status_code == 401:
                token_validation = True
            else:
                token_validation = False
            
            # Test 3: Accept valid tokens
            # Register test user
            register_response = requests.post(
                f"{API_BASE_URL}/api/auth/register",
                json={
                    "email": f"sectest-{int(time.time())}@example.com",
                    "password": "SecTest123!",
                    "full_name": "Security Test User",
                },
                timeout=5
            )
            
            if register_response.status_code == 201:
                token = register_response.json().get("token")
                
                response = requests.get(
                    f"{API_BASE_URL}/api/users/me",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=5
                )
                
                if response.status_code == 200:
                    valid_token_accepted = True
                else:
                    valid_token_accepted = False
            else:
                valid_token_accepted = False
            
            all_passed = auth_protected and token_validation and valid_token_accepted
            
            return self.record_result(
                all_passed,
                "Authentication security validated" if all_passed else "Authentication security issues detected",
                {
                    "unauthenticated_rejected": auth_protected,
                    "invalid_token_rejected": token_validation,
                    "valid_token_accepted": valid_token_accepted,
                }
            )
        except Exception as e:
            return self.record_result(
                False,
                f"Authentication test failed: {str(e)}",
                {}
            )


class RateLimitingTest(SecurityTest):
    """Test rate limiting"""
    
    def __init__(self):
        super().__init__("Rate Limiting", "DDoS Protection")
    
    def run(self) -> bool:
        try:
            # Send multiple requests rapidly
            rate_limited = False
            
            for i in range(150):  # Exceed typical rate limit
                response = requests.get(
                    f"{API_BASE_URL}/health",
                    timeout=5
                )
                
                if response.status_code == 429:
                    rate_limited = True
                    break
            
            return self.record_result(
                rate_limited,
                "Rate limiting is active" if rate_limited else "Rate limiting not detected",
                {"rate_limited_after": i + 1 if rate_limited else "never"}
            )
        except Exception as e:
            return self.record_result(
                False,
                f"Rate limiting test failed: {str(e)}",
                {}
            )


class InputValidationTest(SecurityTest):
    """Test input validation and sanitization"""
    
    def __init__(self):
        super().__init__("Input Validation", "Injection Prevention")
    
    def run(self) -> bool:
        try:
            # Test SQL injection
            sql_injection_payloads = [
                "' OR '1'='1",
                "'; DROP TABLE users--",
                "1' UNION SELECT * FROM users--",
            ]
            
            sql_injection_blocked = True
            for payload in sql_injection_payloads:
                response = requests.post(
                    f"{API_BASE_URL}/api/auth/login",
                    json={
                        "email": payload,
                        "password": "test",
                    },
                    timeout=5
                )
                
                if response.status_code == 200:
                    sql_injection_blocked = False
                    break
            
            # Test XSS
            xss_payloads = [
                "<script>alert('XSS')</script>",
                "<img src=x onerror=alert('XSS')>",
                "javascript:alert('XSS')",
            ]
            
            xss_blocked = True
            for payload in xss_payloads:
                response = requests.post(
                    f"{API_BASE_URL}/api/auth/register",
                    json={
                        "email": f"test-{int(time.time())}@example.com",
                        "password": "Test123!",
                        "full_name": payload,
                    },
                    timeout=5
                )
                
                if response.status_code == 201:
                    data = response.json()
                    if payload in json.dumps(data):
                        xss_blocked = False
                        break
            
            all_passed = sql_injection_blocked and xss_blocked
            
            return self.record_result(
                all_passed,
                "Input validation is effective" if all_passed else "Input validation issues detected",
                {
                    "sql_injection_blocked": sql_injection_blocked,
                    "xss_blocked": xss_blocked,
                }
            )
        except Exception as e:
            return self.record_result(
                False,
                f"Input validation test failed: {str(e)}",
                {}
            )


class EncryptionTest(SecurityTest):
    """Test data encryption"""
    
    def __init__(self):
        super().__init__("Data Encryption", "Data Protection")
    
    def run(self) -> bool:
        try:
            # Register user and submit KYC
            register_response = requests.post(
                f"{API_BASE_URL}/api/auth/register",
                json={
                    "email": f"enctest-{int(time.time())}@example.com",
                    "password": "EncTest123!",
                    "full_name": "Encryption Test User",
                },
                timeout=5
            )
            
            if register_response.status_code != 201:
                return self.record_result(
                    False,
                    "Failed to create test user",
                    {}
                )
            
            token = register_response.json().get("token")
            
            # Submit KYC with sensitive data
            kyc_response = requests.post(
                f"{API_BASE_URL}/api/kyc/submissions",
                json={
                    "document_type": "passport",
                    "front_image": "data:image/jpeg;base64,test_image_data",
                    "liveness_verified": True,
                },
                headers={"Authorization": f"Bearer {token}"},
                timeout=5
            )
            
            if kyc_response.status_code != 201:
                return self.record_result(
                    False,
                    "Failed to submit KYC",
                    {}
                )
            
            # Retrieve KYC data
            kyc_id = kyc_response.json().get("id")
            get_response = requests.get(
                f"{API_BASE_URL}/api/kyc/submissions/{kyc_id}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=5
            )
            
            if get_response.status_code == 200:
                data = get_response.json()
                
                # Check that sensitive fields are not in plain text
                # (This is a simplified check - in reality, you'd verify encryption)
                encrypted = "front_image" not in data or not data["front_image"].startswith("data:image")
                
                return self.record_result(
                    encrypted,
                    "Sensitive data appears to be encrypted" if encrypted else "Sensitive data may not be encrypted",
                    {"encrypted": encrypted}
                )
            else:
                return self.record_result(
                    False,
                    "Failed to retrieve KYC data",
                    {}
                )
        except Exception as e:
            return self.record_result(
                False,
                f"Encryption test failed: {str(e)}",
                {}
            )


class WazuhIntegrationTest(SecurityTest):
    """Test Wazuh SIEM integration"""
    
    def __init__(self):
        super().__init__("Wazuh SIEM Integration", "Security Monitoring")
    
    def run(self) -> bool:
        try:
            # Get Wazuh API token
            auth_response = requests.post(
                f"{WAZUH_API_URL}/security/user/authenticate",
                auth=(WAZUH_USERNAME, WAZUH_PASSWORD),
                verify=False,
                timeout=10
            )
            
            if auth_response.status_code != 200:
                return self.record_result(
                    False,
                    "Failed to authenticate with Wazuh API",
                    {"status_code": auth_response.status_code}
                )
            
            token = auth_response.json().get("data", {}).get("token")
            headers = {"Authorization": f"Bearer {token}"}
            
            # Check Wazuh manager status
            manager_response = requests.get(
                f"{WAZUH_API_URL}/manager/status",
                headers=headers,
                verify=False,
                timeout=10
            )
            
            if manager_response.status_code != 200:
                return self.record_result(
                    False,
                    "Wazuh manager is not running",
                    {}
                )
            
            # Check agents
            agents_response = requests.get(
                f"{WAZUH_API_URL}/agents",
                headers=headers,
                verify=False,
                timeout=10
            )
            
            if agents_response.status_code == 200:
                agents_data = agents_response.json().get("data", {})
                total_agents = agents_data.get("total_affected_items", 0)
                active_agents = sum(1 for agent in agents_data.get("affected_items", []) if agent.get("status") == "active")
                
                return self.record_result(
                    total_agents > 0,
                    f"Wazuh is monitoring {active_agents}/{total_agents} agents",
                    {
                        "total_agents": total_agents,
                        "active_agents": active_agents,
                    }
                )
            else:
                return self.record_result(
                    False,
                    "Failed to retrieve Wazuh agents",
                    {}
                )
        except requests.exceptions.ConnectionError:
            return self.record_result(
                False,
                "Cannot connect to Wazuh API - ensure Wazuh is deployed",
                {}
            )
        except Exception as e:
            return self.record_result(
                False,
                f"Wazuh integration test failed: {str(e)}",
                {}
            )


class PIIAccessLoggingTest(SecurityTest):
    """Test PII access logging"""
    
    def __init__(self):
        super().__init__("PII Access Logging", "Compliance")
    
    def run(self) -> bool:
        try:
            # Register user and submit KYC
            register_response = requests.post(
                f"{API_BASE_URL}/api/auth/register",
                json={
                    "email": f"piitest-{int(time.time())}@example.com",
                    "password": "PIITest123!",
                    "full_name": "PII Test User",
                },
                timeout=5
            )
            
            if register_response.status_code != 201:
                return self.record_result(
                    False,
                    "Failed to create test user",
                    {}
                )
            
            token = register_response.json().get("token")
            
            # Submit KYC
            kyc_response = requests.post(
                f"{API_BASE_URL}/api/kyc/submissions",
                json={
                    "document_type": "passport",
                    "front_image": "data:image/jpeg;base64,test_image_data",
                    "liveness_verified": True,
                },
                headers={"Authorization": f"Bearer {token}"},
                timeout=5
            )
            
            if kyc_response.status_code != 201:
                return self.record_result(
                    False,
                    "Failed to submit KYC",
                    {}
                )
            
            kyc_id = kyc_response.json().get("id")
            
            # Access KYC data (should be logged)
            get_response = requests.get(
                f"{API_BASE_URL}/api/kyc/submissions/{kyc_id}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=5
            )
            
            if get_response.status_code != 200:
                return self.record_result(
                    False,
                    "Failed to access KYC data",
                    {}
                )
            
            # Check audit logs
            time.sleep(2)  # Wait for logs to be written
            
            audit_response = requests.get(
                f"{API_BASE_URL}/api/kyc/audit-logs?submission_id={kyc_id}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=5
            )
            
            if audit_response.status_code == 200:
                logs = audit_response.json().get("logs", [])
                access_logged = any(log.get("action") == "document_access" for log in logs)
                
                return self.record_result(
                    access_logged,
                    "PII access is being logged" if access_logged else "PII access logging not detected",
                    {"logs_found": len(logs)}
                )
            else:
                return self.record_result(
                    False,
                    "Failed to retrieve audit logs",
                    {}
                )
        except Exception as e:
            return self.record_result(
                False,
                f"PII access logging test failed: {str(e)}",
                {}
            )


class RBACTest(SecurityTest):
    """Test Role-Based Access Control"""
    
    def __init__(self):
        super().__init__("Role-Based Access Control", "Authorization")
    
    def run(self) -> bool:
        try:
            # Register regular user
            user_response = requests.post(
                f"{API_BASE_URL}/api/auth/register",
                json={
                    "email": f"rbacuser-{int(time.time())}@example.com",
                    "password": "RBACUser123!",
                    "full_name": "RBAC Test User",
                },
                timeout=5
            )
            
            if user_response.status_code != 201:
                return self.record_result(
                    False,
                    "Failed to create test user",
                    {}
                )
            
            user_token = user_response.json().get("token")
            
            # Try to access admin endpoint
            admin_response = requests.get(
                f"{API_BASE_URL}/api/admin/users",
                headers={"Authorization": f"Bearer {user_token}"},
                timeout=5
            )
            
            user_blocked = admin_response.status_code == 403
            
            # Register admin user
            admin_response = requests.post(
                f"{API_BASE_URL}/api/auth/register",
                json={
                    "email": f"rbacadmin-{int(time.time())}@example.com",
                    "password": "RBACAdmin123!",
                    "full_name": "RBAC Test Admin",
                    "role": "admin",
                },
                timeout=5
            )
            
            if admin_response.status_code == 201:
                admin_token = admin_response.json().get("token")
                
                # Try to access admin endpoint
                admin_access_response = requests.get(
                    f"{API_BASE_URL}/api/admin/users",
                    headers={"Authorization": f"Bearer {admin_token}"},
                    timeout=5
                )
                
                admin_allowed = admin_access_response.status_code == 200
            else:
                admin_allowed = False
            
            all_passed = user_blocked and admin_allowed
            
            return self.record_result(
                all_passed,
                "RBAC is properly configured" if all_passed else "RBAC issues detected",
                {
                    "regular_user_blocked": user_blocked,
                    "admin_user_allowed": admin_allowed,
                }
            )
        except Exception as e:
            return self.record_result(
                False,
                f"RBAC test failed: {str(e)}",
                {}
            )


class SecurityHeadersTest(SecurityTest):
    """Test security headers"""
    
    def __init__(self):
        super().__init__("Security Headers", "Network Security")
    
    def run(self) -> bool:
        try:
            response = requests.get(
                f"{API_BASE_URL}/health",
                timeout=5
            )
            
            headers = response.headers
            
            # Check for important security headers
            required_headers = {
                "X-Content-Type-Options": "nosniff",
                "X-Frame-Options": ["DENY", "SAMEORIGIN"],
                "X-XSS-Protection": "1; mode=block",
                "Strict-Transport-Security": None,  # Should exist
                "Content-Security-Policy": None,  # Should exist
            }
            
            header_results = {}
            all_present = True
            
            for header, expected_value in required_headers.items():
                if header in headers:
                    if expected_value is None:
                        header_results[header] = "present"
                    elif isinstance(expected_value, list):
                        if headers[header] in expected_value:
                            header_results[header] = "correct"
                        else:
                            header_results[header] = f"incorrect: {headers[header]}"
                            all_present = False
                    else:
                        if headers[header] == expected_value:
                            header_results[header] = "correct"
                        else:
                            header_results[header] = f"incorrect: {headers[header]}"
                            all_present = False
                else:
                    header_results[header] = "missing"
                    all_present = False
            
            return self.record_result(
                all_present,
                "All security headers are present" if all_present else "Some security headers are missing or incorrect",
                header_results
            )
        except Exception as e:
            return self.record_result(
                False,
                f"Security headers test failed: {str(e)}",
                {}
            )


def run_all_tests():
    """Run all security tests"""
    print("\n" + "=" * 80)
    print("SECURITY AUDIT TEST SUITE")
    print("=" * 80)
    print(f"API Base URL: {API_BASE_URL}")
    print(f"Wazuh API URL: {WAZUH_API_URL}")
    print("=" * 80 + "\n")
    
    tests = [
        SSLCertificateTest(),
        AuthenticationTest(),
        RateLimitingTest(),
        InputValidationTest(),
        EncryptionTest(),
        WazuhIntegrationTest(),
        PIIAccessLoggingTest(),
        RBACTest(),
        SecurityHeadersTest(),
    ]
    
    for test in tests:
        print(f"Running: {test.name}...", end=" ")
        try:
            passed = test.run()
            if passed:
                print("✅ PASSED")
            else:
                print("❌ FAILED")
            print(f"  {test.message}")
        except Exception as e:
            print(f"❌ ERROR: {str(e)}")
            test.record_result(False, f"Test error: {str(e)}", {})
        print()
    
    print_summary()
    save_report()


def print_summary():
    """Print test summary"""
    print("\n" + "=" * 80)
    print("SECURITY AUDIT SUMMARY")
    print("=" * 80)
    print(f"Total Tests: {results['total_tests']}")
    print(f"Passed: {results['passed']} ✅")
    print(f"Failed: {results['failed']} ❌")
    
    if results['total_tests'] > 0:
        pass_rate = (results['passed'] / results['total_tests']) * 100
        print(f"Pass Rate: {pass_rate:.2f}%")
    
    print("=" * 80 + "\n")
    
    if results['failed'] > 0:
        print("Failed Tests:")
        for test in results['tests']:
            if test['status'] == 'failed':
                print(f"  - {test['name']}: {test['message']}")
        print()


def save_report():
    """Save detailed report to file"""
    report_file = "/tmp/security-audit-report.json"
    
    with open(report_file, "w") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "summary": {
                "total_tests": results['total_tests'],
                "passed": results['passed'],
                "failed": results['failed'],
                "pass_rate": (results['passed'] / results['total_tests'] * 100) if results['total_tests'] > 0 else 0,
            },
            "tests": results['tests'],
        }, f, indent=2)
    
    print(f"📊 Detailed report saved to {report_file}\n")


if __name__ == "__main__":
    run_all_tests()
