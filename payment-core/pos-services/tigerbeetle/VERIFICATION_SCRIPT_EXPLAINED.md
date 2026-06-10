# Complete TigerBeetle Balance Verification Script - Detailed Explanation

This document provides a comprehensive explanation of the `verify_transactions_ci.py` script, with a special focus on the TigerBeetle balance verification function.

## Overview

The `verify_transactions_ci.py` script is designed to verify the integrity of the TigerBeetle ledger after POS transactions are processed. It is optimized for use in CI/CD pipelines and provides detailed reporting capabilities.

## Complete Script Structure

### 1. Imports and Constants

```python
#!/usr/bin/env python3
import os
import sys
import json
from datetime import datetime
from typing import List, Dict, Optional
from tigerbeetle import Client, Account, Transfer

# Account codes
MERCHANT_SETTLEMENT_CODE = 1001
BANK_SETTLEMENT_CODE = 2001
CUSTOMER_CARD_CODE = 3001
SYSTEM_FEE_CODE = 4001

# Ledger ID
MAIN_LEDGER = 1
```

The script imports the TigerBeetle Python client and defines account codes that correspond to different types of accounts in the ledger.

### 2. TigerBeetleVerifier Class

The core of the script is the `TigerBeetleVerifier` class, which encapsulates all verification logic.

#### 2.1. Initialization

```python
class TigerBeetleVerifier:
    """Verifies POS transactions in TigerBeetle for CI/CD"""
    
    def __init__(self, cluster_id: int, addresses: List[str]):
        """Initialize the TigerBeetle client"""
        try:
            self.client = Client(cluster_id=cluster_id, addresses=addresses)
            self.results = []
            self.passed = 0
            self.failed = 0
        except Exception as e:
            print(f"❌ Failed to connect to TigerBeetle: {e}")
            sys.exit(1)
```

The constructor creates a TigerBeetle client connection and initializes tracking variables for test results.

#### 2.2. Balance Retrieval Functions

```python
def get_account_balance(self, account_id: int) -> Optional[Account]:
    """Retrieve a single account balance"""
    try:
        accounts = self.client.lookup_accounts([account_id])
        if accounts:
            return accounts[0]
        return None
    except Exception as e:
        print(f"Error looking up account {account_id}: {e}")
        return None

def get_multiple_balances(self, account_ids: List[int]) -> List[Account]:
    """Retrieve multiple account balances"""
    try:
        return self.client.lookup_accounts(account_ids)
    except Exception as e:
        print(f"Error looking up accounts: {e}")
        return []
```

These functions use the TigerBeetle client's `lookup_accounts()` method to retrieve account information. The `get_multiple_balances()` function is more efficient when querying multiple accounts simultaneously.

### 3. Core Verification Function: `verify_pos_transaction()`

This is the **most critical function** in the script. It performs a complete verification of a POS transaction by checking the balances of all involved accounts.

```python
def verify_pos_transaction(self, transaction_id: str, 
                           customer_account_id: int,
                           merchant_account_id: int,
                           bank_account_id: int,
                           expected_amount: int) -> bool:
    """
    Verify a complete POS transaction
    
    Returns:
        True if verification passed, False otherwise
    """
    print(f"\n{'=' * 60}")
    print(f"Verifying POS Transaction: {transaction_id}")
    print(f"{'=' * 60}\n")
    
    result = {
        "transaction_id": transaction_id,
        "timestamp": datetime.utcnow().isoformat(),
        "checks": [],
        "passed": False
    }
```

#### 3.1. Retrieve Account Balances

```python
    # Get all account balances
    account_ids = [customer_account_id, merchant_account_id, bank_account_id]
    accounts = self.get_multiple_balances(account_ids)
    
    if len(accounts) != 3:
        error_msg = f"❌ Error: Expected 3 accounts, found {len(accounts)}"
        print(error_msg)
        result["error"] = error_msg
        self.results.append(result)
        self.failed += 1
        return False
    
    customer_account = accounts[0]
    merchant_account = accounts[1]
    bank_account = accounts[2]
```

This section retrieves the balances for all three accounts involved in the transaction. If any account is missing, the verification fails immediately.

#### 3.2. Store Account Details

```python
    # Store account details
    result["accounts"] = {
        "customer": {
            "id": customer_account.id,
            "debits_posted": customer_account.debits_posted,
            "credits_posted": customer_account.credits_posted,
            "balance": customer_account.credits_posted - customer_account.debits_posted
        },
        "merchant": {
            "id": merchant_account.id,
            "debits_posted": merchant_account.debits_posted,
            "credits_posted": merchant_account.credits_posted,
            "balance": merchant_account.credits_posted - merchant_account.debits_posted
        },
        "bank": {
            "id": bank_account.id,
            "debits_posted": bank_account.debits_posted,
            "credits_posted": bank_account.credits_posted,
            "balance": bank_account.credits_posted - bank_account.debits_posted
        }
    }
```

The script stores detailed information about each account, including:

*   **`debits_posted`**: The total amount debited from the account.
*   **`credits_posted`**: The total amount credited to the account.
*   **`balance`**: The net balance (credits - debits).

#### 3.3. Perform Balance Verification Checks

This is the **heart of the verification logic**. The script performs three critical checks:

**Check 1: Customer Account Debit**

```python
    # Check 1: Customer was debited
    if customer_account.debits_posted >= expected_amount:
        msg = f"✓ Customer account debited: {customer_account.debits_posted / 100:.2f} NGN"
        print(msg)
        result["checks"].append({"name": "customer_debit", "passed": True, "message": msg})
        checks_passed += 1
    else:
        msg = f"❌ Customer account debit mismatch: expected {expected_amount / 100:.2f}, got {customer_account.debits_posted / 100:.2f} NGN"
        print(msg)
        result["checks"].append({"name": "customer_debit", "passed": False, "message": msg})
```

This check verifies that the customer's account has been debited by at least the expected transaction amount. The `>=` comparison allows for cumulative balances if multiple transactions have been processed.

**Check 2: Merchant Account Credit**

```python
    # Check 2: Merchant was credited
    if merchant_account.credits_posted >= expected_amount:
        msg = f"✓ Merchant account credited: {merchant_account.credits_posted / 100:.2f} NGN"
        print(msg)
        result["checks"].append({"name": "merchant_credit", "passed": True, "message": msg})
        checks_passed += 1
    else:
        msg = f"❌ Merchant account credit mismatch: expected {expected_amount / 100:.2f}, got {merchant_account.credits_posted / 100:.2f} NGN"
        print(msg)
        result["checks"].append({"name": "merchant_credit", "passed": False, "message": msg})
```

This check ensures that the merchant's account has been credited with the transaction amount.

**Check 3: Bank Account Credit**

```python
    # Check 3: Bank was credited (for inter-bank transfers)
    if bank_account.credits_posted > 0:
        msg = f"✓ Bank account credited: {bank_account.credits_posted / 100:.2f} NGN"
        print(msg)
        result["checks"].append({"name": "bank_credit", "passed": True, "message": msg})
        checks_passed += 1
    else:
        msg = f"❌ Bank account not credited"
        print(msg)
        result["checks"].append({"name": "bank_credit", "passed": False, "message": msg})
```

This check verifies that the bank's settlement account has been credited, which is essential for inter-bank reconciliation.

#### 3.4. Determine Overall Pass/Fail Status

```python
    result["checks_passed"] = checks_passed
    result["total_checks"] = total_checks
    result["passed"] = checks_passed == total_checks
    
    if result["passed"]:
        self.passed += 1
    else:
        self.failed += 1
    
    self.results.append(result)
    return result["passed"]
```

The transaction verification passes only if **all three checks** pass. The result is stored for later reporting.

### 4. Report Generation

```python
def generate_report(self, output_file: str = "verification-results.txt", 
                   json_file: str = "verification-report.json"):
    """Generate verification report"""
    
    # Text report
    with open(output_file, 'w') as f:
        f.write("=" * 60 + "\n")
        f.write("TigerBeetle Ledger Verification Report\n")
        f.write("=" * 60 + "\n\n")
        f.write(f"Timestamp: {datetime.utcnow().isoformat()}\n")
        f.write(f"Total Transactions Verified: {len(self.results)}\n")
        f.write(f"Passed: {self.passed}\n")
        f.write(f"Failed: {self.failed}\n\n")
        
        for result in self.results:
            f.write(f"\nTransaction: {result['transaction_id']}\n")
            f.write(f"Status: {'✅ PASSED' if result['passed'] else '❌ FAILED'}\n")
            f.write(f"Checks: {result['checks_passed']}/{result['total_checks']}\n")
            
            for check in result['checks']:
                f.write(f"  {check['message']}\n")
            
            f.write("\n")
        
        f.write("\n" + "=" * 60 + "\n")
        f.write(f"Overall Status: {'✅ ALL PASSED' if self.failed == 0 else '❌ SOME FAILED'}\n")
        f.write("=" * 60 + "\n")
    
    # JSON report
    report = {
        "timestamp": datetime.utcnow().isoformat(),
        "summary": {
            "total": len(self.results),
            "passed": self.passed,
            "failed": self.failed,
            "success_rate": (self.passed / len(self.results) * 100) if self.results else 0
        },
        "transactions": self.results
    }
    
    with open(json_file, 'w') as f:
        json.dump(report, f, indent=2)
```

The script generates two reports:

1.  **Text Report** (`verification-results.txt`): A human-readable summary of the verification results.
2.  **JSON Report** (`verification-report.json`): A machine-readable report for integration with CI/CD tools.

### 5. Main Function

```python
def main():
    """Main function for CI/CD verification"""
    
    # Configuration
    cluster_id = int(os.getenv("TIGERBEETLE_CLUSTER_ID", "0"))
    address = os.getenv("TIGERBEETLE_ADDRESS", "127.0.0.1:3000")
    
    # Create verifier
    verifier = TigerBeetleVerifier(cluster_id=cluster_id, addresses=[address])
    
    # Define test scenarios
    test_scenarios = [
        {
            "name": "Normal Transaction - Access Bank",
            "transaction_id": "txn-normal-access-001",
            "customer_account": "card-5399410000000001",
            "merchant_account": "merchant-MERCH-SHOPRITE-001",
            "bank_account": "bank-ACCESS",
            "amount": 500000  # 5000 NGN in cents
        },
        # ... more scenarios
    ]
    
    # Run verification for each scenario
    for scenario in test_scenarios:
        customer_id = hash_account_id(scenario['customer_account'])
        merchant_id = hash_account_id(scenario['merchant_account'])
        bank_id = hash_account_id(scenario['bank_account'])
        
        verifier.verify_pos_transaction(
            transaction_id=scenario['transaction_id'],
            customer_account_id=customer_id,
            merchant_account_id=merchant_id,
            bank_account_id=bank_id,
            expected_amount=scenario['amount']
        )
    
    # Generate reports
    verifier.generate_report()
    
    # Exit with appropriate code
    if verifier.failed > 0:
        print(f"\n❌ Verification failed: {verifier.failed} transaction(s) failed")
        sys.exit(1)
    else:
        print(f"\n✅ All verifications passed: {verifier.passed} transaction(s)")
        sys.exit(0)
```

The main function orchestrates the entire verification process and exits with a non-zero code if any verification fails, which will cause the CI/CD pipeline to fail.

## Key Features

1.  **Atomic Verification**: Each transaction is verified as a complete unit, ensuring all accounts are in the correct state.
2.  **Detailed Reporting**: Both human-readable and machine-readable reports are generated.
3.  **CI/CD Integration**: The script exits with appropriate status codes for integration with CI/CD pipelines.
4.  **Error Handling**: Robust error handling ensures that failures are properly detected and reported.

## Usage in CI/CD

In a GitHub Actions workflow, the script is invoked as follows:

```yaml
- name: Verify TigerBeetle ledger integrity
  env:
    TIGERBEETLE_ADDRESS: "127.0.0.1:3000"
    TIGERBEETLE_CLUSTER_ID: "0"
  run: |
    python3 pos-services/tigerbeetle/verify_transactions_ci.py
```

If any verification check fails, the script will exit with code 1, causing the GitHub Actions job to fail and preventing the deployment from being marked as successful.
