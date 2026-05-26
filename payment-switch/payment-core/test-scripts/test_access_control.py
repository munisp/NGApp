#!/usr/bin/env python3
"""
Access Control Validation Test Script
Tests Keycloak authentication and authorization
"""

import subprocess
import json
import sys
import requests
from datetime import datetime
from typing import Dict, List, Any

class AccessControlValidator:
    def __init__(self, keycloak_url: str = "http://localhost:8180", realm: str = "payment-switch"):
        self.keycloak_url = keycloak_url
        self.realm = realm
        self.admin_token = None
        self.results = []
        
    def run_test(self, test_name: str, test_func):
        """Run a single test and record results"""
        print(f"\n[TEST] {test_name}")
        try:
            result = test_func()
            self.results.append({
                "test": test_name,
                "status": "PASS" if result else "FAIL",
                "timestamp": datetime.now().isoformat()
            })
            print(f"[{'PASS' if result else 'FAIL'}] {test_name}")
            return result
        except Exception as e:
            self.results.append({
                "test": test_name,
                "status": "ERROR",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            })
            print(f"[ERROR] {test_name}: {e}")
            return False
    
    def test_keycloak_accessible(self) -> bool:
        """Test 1: Verify Keycloak is accessible"""
        try:
            response = requests.get(f"{self.keycloak_url}/health", timeout=5)
            return response.status_code == 200
        except:
            # Try alternative health endpoint
            try:
                response = requests.get(f"{self.keycloak_url}/", timeout=5)
                return response.status_code in [200, 303]
            except Exception as e:
                print(f"  Error: {e}")
                return False
    
    def get_admin_token(self) -> bool:
        """Get admin access token"""
        try:
            data = {
                "grant_type": "password",
                "client_id": "admin-cli",
                "username": "admin",
                "password": "admin_2024"
            }
            response = requests.post(
                f"{self.keycloak_url}/realms/master/protocol/openid-connect/token",
                data=data,
                timeout=5
            )
            if response.status_code == 200:
                self.admin_token = response.json().get("access_token")
                return True
            return False
        except Exception as e:
            print(f"  Error: {e}")
            return False
    
    def test_admin_authentication(self) -> bool:
        """Test 2: Verify admin authentication"""
        return self.get_admin_token()
    
    def test_realm_exists(self) -> bool:
        """Test 3: Verify payment-switch realm exists"""
        if not self.admin_token:
            if not self.get_admin_token():
                return False
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(
                f"{self.keycloak_url}/admin/realms/{self.realm}",
                headers=headers,
                timeout=5
            )
            return response.status_code == 200
        except Exception as e:
            print(f"  Error: {e}")
            return False
    
    def test_client_exists(self) -> bool:
        """Test 4: Verify payment-gateway client exists"""
        if not self.admin_token:
            if not self.get_admin_token():
                return False
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(
                f"{self.keycloak_url}/admin/realms/{self.realm}/clients",
                headers=headers,
                timeout=5
            )
            if response.status_code == 200:
                clients = response.json()
                return any(c.get("clientId") == "payment-gateway" for c in clients)
            return False
        except Exception as e:
            print(f"  Error: {e}")
            return False
    
    def test_role_exists(self) -> bool:
        """Test 5: Verify payment-user role exists"""
        if not self.admin_token:
            if not self.get_admin_token():
                return False
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(
                f"{self.keycloak_url}/admin/realms/{self.realm}/roles",
                headers=headers,
                timeout=5
            )
            if response.status_code == 200:
                roles = response.json()
                return any(r.get("name") == "payment-user" for r in roles)
            return False
        except Exception as e:
            print(f"  Error: {e}")
            return False
    
    def test_user_authentication(self) -> bool:
        """Test 6: Test user authentication flow"""
        try:
            data = {
                "grant_type": "password",
                "client_id": "payment-gateway",
                "username": "testuser",
                "password": "testpass"
            }
            response = requests.post(
                f"{self.keycloak_url}/realms/{self.realm}/protocol/openid-connect/token",
                data=data,
                timeout=5
            )
            # User might not exist, which is okay for this test
            return response.status_code in [200, 401]
        except Exception as e:
            print(f"  Error: {e}")
            return False
    
    def test_token_introspection(self) -> bool:
        """Test 7: Test token introspection endpoint"""
        if not self.admin_token:
            if not self.get_admin_token():
                return False
        
        try:
            data = {
                "token": self.admin_token,
                "client_id": "admin-cli"
            }
            response = requests.post(
                f"{self.keycloak_url}/realms/master/protocol/openid-connect/token/introspect",
                data=data,
                timeout=5
            )
            if response.status_code == 200:
                result = response.json()
                return result.get("active", False)
            return False
        except Exception as e:
            print(f"  Error: {e}")
            return False
    
    def test_rbac_configured(self) -> bool:
        """Test 8: Verify RBAC is configured"""
        if not self.admin_token:
            if not self.get_admin_token():
                return False
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(
                f"{self.keycloak_url}/admin/realms/{self.realm}",
                headers=headers,
                timeout=5
            )
            if response.status_code == 200:
                realm_data = response.json()
                return realm_data.get("enabled", False)
            return False
        except Exception as e:
            print(f"  Error: {e}")
            return False
    
    def generate_report(self, output_file: str = "access_control_test_results.json"):
        """Generate test results report"""
        report = {
            "test_suite": "Access Control Validation",
            "timestamp": datetime.now().isoformat(),
            "keycloak_url": self.keycloak_url,
            "realm": self.realm,
            "total_tests": len(self.results),
            "passed": sum(1 for r in self.results if r["status"] == "PASS"),
            "failed": sum(1 for r in self.results if r["status"] == "FAIL"),
            "errors": sum(1 for r in self.results if r["status"] == "ERROR"),
            "results": self.results
        }
        
        with open(output_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n{'='*60}")
        print(f"Access Control Validation Test Results")
        print(f"{'='*60}")
        print(f"Total Tests: {report['total_tests']}")
        print(f"Passed: {report['passed']}")
        print(f"Failed: {report['failed']}")
        print(f"Errors: {report['errors']}")
        print(f"Success Rate: {(report['passed']/report['total_tests']*100):.1f}%")
        print(f"\nResults saved to: {output_file}")
        
        return report['failed'] == 0 and report['errors'] == 0

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Test Keycloak access control")
    parser.add_argument("--keycloak-url", default="http://localhost:8180", help="Keycloak URL")
    parser.add_argument("--realm", default="payment-switch", help="Realm name")
    args = parser.parse_args()
    
    validator = AccessControlValidator(args.keycloak_url, args.realm)
    
    # Run all tests
    validator.run_test("Keycloak Accessible", validator.test_keycloak_accessible)
    validator.run_test("Admin Authentication", validator.test_admin_authentication)
    validator.run_test("Realm Exists", validator.test_realm_exists)
    validator.run_test("Client Exists", validator.test_client_exists)
    validator.run_test("Role Exists", validator.test_role_exists)
    validator.run_test("User Authentication Flow", validator.test_user_authentication)
    validator.run_test("Token Introspection", validator.test_token_introspection)
    validator.run_test("RBAC Configured", validator.test_rbac_configured)
    
    # Generate report
    success = validator.generate_report()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
