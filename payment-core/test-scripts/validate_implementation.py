#!/usr/bin/env python3
"""
Validate all implementations
"""

import os
import sys
from pathlib import Path

def check_file_exists(filepath, description):
    """Check if file exists."""
    if os.path.exists(filepath):
        print(f"✓ {description}: {filepath}")
        return True
    else:
        print(f"✗ {description}: {filepath} NOT FOUND")
        return False

def check_file_contains(filepath, pattern, description):
    """Check if file contains pattern."""
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        if pattern in content:
            print(f"✓ {description}")
            return True
        else:
            print(f"✗ {description} - Pattern not found: {pattern}")
            return False
    except:
        print(f"✗ {description} - Could not read file")
        return False

print("=" * 80)
print("IMPLEMENTATION VALIDATION REPORT")
print("=" * 80)

total_checks = 0
passed_checks = 0

# Check routers
print("\n1. ROUTER FILES")
print("-" * 80)

routers = [
    ("/home/ubuntu/nextgen-payment-switch/services/fraud-detection-service/routers.py", "Fraud Detection Service Router"),
    ("/home/ubuntu/nextgen-payment-switch/services/payment-gateway/routers.py", "Payment Gateway Router"),
    ("/home/ubuntu/nextgen-payment-switch/services/settlement/routers.py", "Settlement Router"),
    ("/home/ubuntu/nextgen-payment-switch/services/offline-payments/routers.py", "Offline Payments Router"),
    ("/home/ubuntu/nextgen-payment-switch/services/fraud-detection/routers.py", "Fraud Detection Router"),
]

for filepath, desc in routers:
    total_checks += 1
    if check_file_exists(filepath, desc):
        passed_checks += 1

# Check schemas
print("\n2. SCHEMA FILES")
print("-" * 80)

schemas = [
    ("/home/ubuntu/nextgen-payment-switch/services/fraud-detection-service/schemas.py", "Fraud Detection Service Schemas"),
    ("/home/ubuntu/nextgen-payment-switch/services/payment-gateway/schemas.py", "Payment Gateway Schemas"),
    ("/home/ubuntu/nextgen-payment-switch/services/settlement/schemas.py", "Settlement Schemas"),
    ("/home/ubuntu/nextgen-payment-switch/services/offline-payments/schemas.py", "Offline Payments Schemas"),
    ("/home/ubuntu/nextgen-payment-switch/services/fraud-detection/schemas.py", "Fraud Detection Schemas"),
]

for filepath, desc in schemas:
    total_checks += 1
    if check_file_exists(filepath, desc):
        passed_checks += 1

# Check database schema
print("\n3. DATABASE SCHEMA")
print("-" * 80)

total_checks += 1
if check_file_exists("/home/ubuntu/nextgen-payment-switch/services/database/schema.sql", "Database Schema"):
    passed_checks += 1
    
    # Check for key tables
    schema_file = "/home/ubuntu/nextgen-payment-switch/services/database/schema.sql"
    tables = [
        ("participants", "Participants table"),
        ("accounts", "Accounts table"),
        ("transactions", "Transactions table"),
        ("fraud_checks", "Fraud checks table"),
        ("settlement_windows", "Settlement windows table"),
        ("offline_transactions", "Offline transactions table"),
    ]
    
    for table, desc in tables:
        total_checks += 1
        if check_file_contains(schema_file, f"CREATE TABLE {table}", desc):
            passed_checks += 1

# Check router registration
print("\n4. ROUTER REGISTRATION IN MAIN.PY")
print("-" * 80)

registrations = [
    ("/home/ubuntu/nextgen-payment-switch/services/fraud-detection-service/main.py", "from routers import router", "Fraud Detection Service"),
    ("/home/ubuntu/nextgen-payment-switch/services/payment-gateway/main.py", "from routers import router", "Payment Gateway"),
    ("/home/ubuntu/nextgen-payment-switch/services/settlement/main.py", "from routers import router", "Settlement"),
    ("/home/ubuntu/nextgen-payment-switch/services/offline-payments/main.py", "from routers import router", "Offline Payments"),
    ("/home/ubuntu/nextgen-payment-switch/services/fraud-detection/main.py", "from routers import router", "Fraud Detection"),
]

for filepath, pattern, desc in registrations:
    total_checks += 1
    if check_file_contains(filepath, pattern, f"{desc} router import"):
        passed_checks += 1

# Check __init__.py files
print("\n5. PACKAGE INITIALIZATION FILES")
print("-" * 80)

init_files = [
    "/home/ubuntu/nextgen-payment-switch/services/fraud-detection-service/__init__.py",
    "/home/ubuntu/nextgen-payment-switch/services/payment-gateway/__init__.py",
    "/home/ubuntu/nextgen-payment-switch/services/settlement/__init__.py",
    "/home/ubuntu/nextgen-payment-switch/services/offline-payments/__init__.py",
    "/home/ubuntu/nextgen-payment-switch/services/fraud-detection/__init__.py",
]

for filepath in init_files:
    total_checks += 1
    if check_file_exists(filepath, f"__init__.py for {os.path.dirname(filepath).split('/')[-1]}"):
        passed_checks += 1

# Summary
print("\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)
print(f"Total Checks: {total_checks}")
print(f"Passed: {passed_checks}")
print(f"Failed: {total_checks - passed_checks}")
print(f"Success Rate: {(passed_checks/total_checks)*100:.1f}%")

if passed_checks == total_checks:
    print("\n✓ ALL CHECKS PASSED! Implementation is complete.")
    sys.exit(0)
else:
    print(f"\n✗ {total_checks - passed_checks} checks failed. Please review.")
    sys.exit(1)
