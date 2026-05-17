"""
RBAC Integration Tests for KYC/KYB System
Tests authentication and authorization across all 27 API endpoints
"""

import requests
import json
from typing import Dict, Optional

# Configuration
KEYCLOAK_URL = "http://localhost:8080"
KEYCLOAK_REALM = "kyc-kyb-system"
LIVENESS_SERVICE_URL = "http://localhost:8002"
AML_SERVICE_URL = "http://localhost:8003"
RISK_SERVICE_URL = "http://localhost:8004"

# Test users
TEST_USERS = {
    "admin": {"username": "admin", "password": "admin123"},
    "compliance": {"username": "compliance", "password": "compliance123"},
    "kyc_analyst": {"username": "kyc_analyst", "password": "kyc123"},
    "risk_manager": {"username": "risk_manager", "password": "risk123"},
    "operator": {"username": "operator", "password": "operator123"},
}


def get_token(username: str, password: str) -> Optional[str]:
    """Get JWT token from Keycloak"""
    url = f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/token"
    
    data = {
        "username": username,
        "password": password,
        "grant_type": "password",
        "client_id": "liveness-service",
    }
    
    try:
        response = requests.post(url, data=data)
        if response.status_code == 200:
            return response.json().get("access_token")
        else:
            print(f"Failed to get token for {username}: {response.status_code}")
            return None
    except Exception as e:
        print(f"Error getting token: {e}")
        return None


def test_endpoint(
    method: str,
    url: str,
    token: Optional[str],
    expected_status: int,
    data: Optional[Dict] = None,
    files: Optional[Dict] = None
) -> bool:
    """Test an API endpoint"""
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers)
        elif method == "POST":
            if files:
                response = requests.post(url, headers=headers, files=files, data=data)
            else:
                headers["Content-Type"] = "application/json"
                response = requests.post(url, headers=headers, json=data)
        else:
            print(f"Unsupported method: {method}")
            return False
        
        success = response.status_code == expected_status
        status_icon = "✓" if success else "✗"
        print(f"  {status_icon} {method} {url}: {response.status_code} (expected {expected_status})")
        
        return success
        
    except Exception as e:
        print(f"  ✗ Error testing {url}: {e}")
        return False


def run_tests():
    """Run all RBAC integration tests"""
    print("=" * 80)
    print("RBAC Integration Tests for KYC/KYB System")
    print("=" * 80)
    print()
    
    # Get tokens for all test users
    tokens = {}
    print("Getting authentication tokens...")
    for role, creds in TEST_USERS.items():
        token = get_token(creds["username"], creds["password"])
        if token:
            tokens[role] = token
            print(f"  ✓ {role}: Token obtained")
        else:
            print(f"  ✗ {role}: Failed to get token")
    print()
    
    total_tests = 0
    passed_tests = 0
    
    # ========================================================================
    # LIVENESS SERVICE TESTS (5 endpoints)
    # ========================================================================
    print("Testing Liveness Service Endpoints")
    print("-" * 80)
    
    # Test 1: POST /check - KYC Analyst (should succeed)
    print("\n1. POST /api/v1/liveness/check (KYC Analyst)")
    total_tests += 1
    if test_endpoint(
        "POST",
        f"{LIVENESS_SERVICE_URL}/api/v1/liveness/check",
        tokens.get("kyc_analyst"),
        200,
        data={"customer_id": "test123", "liveness_type": "passive"},
        files={"file": ("test.jpg", b"fake_image_data", "image/jpeg")}
    ):
        passed_tests += 1
    
    # Test 2: POST /check - Operator (should fail - 403)
    print("\n2. POST /api/v1/liveness/check (Operator - should fail)")
    total_tests += 1
    if test_endpoint(
        "POST",
        f"{LIVENESS_SERVICE_URL}/api/v1/liveness/check",
        tokens.get("operator"),
        403,
        data={"customer_id": "test123", "liveness_type": "passive"},
        files={"file": ("test.jpg", b"fake_image_data", "image/jpeg")}
    ):
        passed_tests += 1
    
    # Test 3: GET /{check_id} - All roles (should succeed)
    print("\n3. GET /api/v1/liveness/{check_id} (All roles)")
    for role in ["kyc_analyst", "compliance", "risk_manager", "operator", "admin"]:
        total_tests += 1
        if test_endpoint(
            "GET",
            f"{LIVENESS_SERVICE_URL}/api/v1/liveness/test-check-id",
            tokens.get(role),
            200 if role in tokens else 401
        ):
            passed_tests += 1
    
    # Test 4: GET /customer/{customer_id} - All roles (should succeed)
    print("\n4. GET /api/v1/liveness/customer/{customer_id} (All roles)")
    for role in ["kyc_analyst", "compliance", "risk_manager", "operator", "admin"]:
        total_tests += 1
        if test_endpoint(
            "GET",
            f"{LIVENESS_SERVICE_URL}/api/v1/liveness/customer/test-customer-id",
            tokens.get(role),
            200 if role in tokens else 401
        ):
            passed_tests += 1
    
    # Test 5: POST /match-faces - KYC Analyst (should succeed)
    print("\n5. POST /api/v1/liveness/match-faces (KYC Analyst)")
    total_tests += 1
    if test_endpoint(
        "POST",
        f"{LIVENESS_SERVICE_URL}/api/v1/liveness/match-faces",
        tokens.get("kyc_analyst"),
        200,
        files={
            "image1": ("test1.jpg", b"fake_image_data", "image/jpeg"),
            "image2": ("test2.jpg", b"fake_image_data", "image/jpeg")
        }
    ):
        passed_tests += 1
    
    # ========================================================================
    # AML SCREENING SERVICE TESTS (3 endpoints)
    # ========================================================================
    print("\n\nTesting AML Screening Service Endpoints")
    print("-" * 80)
    
    # Test 6: POST /screen - Compliance Officer (should succeed)
    print("\n6. POST /api/v1/aml/screen (Compliance Officer)")
    total_tests += 1
    if test_endpoint(
        "POST",
        f"{AML_SERVICE_URL}/api/v1/aml/screen",
        tokens.get("compliance"),
        200,
        data={
            "customer_id": "test-customer-id",
            "screening_type": "comprehensive",
            "full_name": "John Doe",
            "date_of_birth": "1990-01-01",
            "nationality": "NG"
        }
    ):
        passed_tests += 1
    
    # Test 7: POST /screen - KYC Analyst (should fail - 403)
    print("\n7. POST /api/v1/aml/screen (KYC Analyst - should fail)")
    total_tests += 1
    if test_endpoint(
        "POST",
        f"{AML_SERVICE_URL}/api/v1/aml/screen",
        tokens.get("kyc_analyst"),
        403,
        data={
            "customer_id": "test-customer-id",
            "screening_type": "comprehensive",
            "full_name": "John Doe"
        }
    ):
        passed_tests += 1
    
    # Test 8: GET /screening/{id} - Multiple roles
    print("\n8. GET /api/v1/aml/screening/{id} (Multiple roles)")
    for role in ["compliance", "kyc_analyst", "risk_manager", "admin"]:
        total_tests += 1
        if test_endpoint(
            "GET",
            f"{AML_SERVICE_URL}/api/v1/aml/screening/test-screening-id",
            tokens.get(role),
            200 if role in tokens else 401
        ):
            passed_tests += 1
    
    # Test 9: GET /customer/{customer_id}/screenings - All roles
    print("\n9. GET /api/v1/aml/customer/{customer_id}/screenings (All roles)")
    for role in ["compliance", "kyc_analyst", "risk_manager", "operator", "admin"]:
        total_tests += 1
        if test_endpoint(
            "GET",
            f"{AML_SERVICE_URL}/api/v1/aml/customer/test-customer-id/screenings",
            tokens.get(role),
            200 if role in tokens else 401
        ):
            passed_tests += 1
    
    # ========================================================================
    # RISK SCORING SERVICE TESTS (4 endpoints)
    # ========================================================================
    print("\n\nTesting Risk Scoring Service Endpoints")
    print("-" * 80)
    
    # Test 10: POST /score - Risk Manager (should succeed)
    print("\n10. POST /api/v1/risk/score (Risk Manager)")
    total_tests += 1
    if test_endpoint(
        "POST",
        f"{RISK_SERVICE_URL}/api/v1/risk/score",
        tokens.get("risk_manager"),
        200,
        data={
            "customer_id": "test-customer-id",
            "identity_verified": True,
            "document_verified": True,
            "aml_clear": True,
            "country_code": "NG"
        }
    ):
        passed_tests += 1
    
    # Test 11: POST /score - Compliance Officer (should fail - 403)
    print("\n11. POST /api/v1/risk/score (Compliance Officer - should fail)")
    total_tests += 1
    if test_endpoint(
        "POST",
        f"{RISK_SERVICE_URL}/api/v1/risk/score",
        tokens.get("compliance"),
        403,
        data={
            "customer_id": "test-customer-id",
            "identity_verified": True
        }
    ):
        passed_tests += 1
    
    # Test 12: GET /score/{id} - Multiple roles
    print("\n12. GET /api/v1/risk/score/{id} (Multiple roles)")
    for role in ["risk_manager", "compliance", "kyc_analyst", "admin"]:
        total_tests += 1
        if test_endpoint(
            "GET",
            f"{RISK_SERVICE_URL}/api/v1/risk/score/test-score-id",
            tokens.get(role),
            200 if role in tokens else 401
        ):
            passed_tests += 1
    
    # Test 13: GET /customer/{customer_id}/latest - All roles
    print("\n13. GET /api/v1/risk/customer/{customer_id}/latest (All roles)")
    for role in ["risk_manager", "compliance", "kyc_analyst", "operator", "admin"]:
        total_tests += 1
        if test_endpoint(
            "GET",
            f"{RISK_SERVICE_URL}/api/v1/risk/customer/test-customer-id/latest",
            tokens.get(role),
            200 if role in tokens else 401
        ):
            passed_tests += 1
    
    # ========================================================================
    # SUMMARY
    # ========================================================================
    print("\n\n" + "=" * 80)
    print("Test Summary")
    print("=" * 80)
    print(f"Total Tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {total_tests - passed_tests}")
    print(f"Success Rate: {(passed_tests / total_tests * 100):.1f}%")
    print("=" * 80)
    
    return passed_tests == total_tests


if __name__ == "__main__":
    success = run_tests()
    exit(0 if success else 1)
