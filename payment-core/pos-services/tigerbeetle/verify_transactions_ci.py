#!/usr/bin/env python3
"""
TigerBeetle Transaction Verification Script for CI/CD

This script is optimized for CI/CD pipelines and outputs results to files
for artifact upload and reporting.
"""

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
        
        # Verify balances
        checks_passed = 0
        total_checks = 3
        
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
        
        result["checks_passed"] = checks_passed
        result["total_checks"] = total_checks
        result["passed"] = checks_passed == total_checks
        
        if result["passed"]:
            self.passed += 1
        else:
            self.failed += 1
        
        self.results.append(result)
        return result["passed"]
    
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
        
        print(f"\n✓ Reports generated:")
        print(f"  - Text report: {output_file}")
        print(f"  - JSON report: {json_file}")


def hash_account_id(identifier: str) -> int:
    """Convert a string identifier to a 128-bit account ID"""
    return hash(identifier) & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF


def main():
    """Main function for CI/CD verification"""
    
    # Configuration
    cluster_id = int(os.getenv("TIGERBEETLE_CLUSTER_ID", "0"))
    address = os.getenv("TIGERBEETLE_ADDRESS", "127.0.0.1:3000")
    
    print("=" * 60)
    print("TigerBeetle POS Transaction Verification (CI/CD)")
    print("=" * 60)
    print(f"\nConnecting to TigerBeetle at: {address}")
    print(f"Cluster ID: {cluster_id}\n")
    
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
        {
            "name": "High-Value Transaction - GTBank",
            "transaction_id": "txn-high-value-gtb-001",
            "customer_account": "card-5399230000000002",
            "merchant_account": "merchant-MERCH-ELECTRONICS-045",
            "bank_account": "bank-GTB",
            "amount": 25000000  # 250,000 NGN in cents
        },
        {
            "name": "Round Amount Transaction - Zenith Bank",
            "transaction_id": "txn-round-zenith-001",
            "customer_account": "card-5399250000000003",
            "merchant_account": "merchant-MERCH-RESTAURANT-078",
            "bank_account": "bank-ZENITH",
            "amount": 10000000  # 100,000 NGN in cents
        }
    ]
    
    # Run verification for each scenario
    for scenario in test_scenarios:
        print(f"\n{'=' * 60}")
        print(f"Scenario: {scenario['name']}")
        print(f"{'=' * 60}")
        
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


if __name__ == "__main__":
    main()
