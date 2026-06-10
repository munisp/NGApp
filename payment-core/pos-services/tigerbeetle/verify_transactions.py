#!/usr/bin/env python3
"""
TigerBeetle Transaction Verification Script for POS Payment System

This script provides utilities to query and verify account balances and transfers
in TigerBeetle after processing POS transactions.
"""

import os
import sys
from typing import List, Dict, Optional
from tigerbeetle import Client, Account, Transfer, AccountFlags, TransferFlags

# Account codes
MERCHANT_SETTLEMENT_CODE = 1001
BANK_SETTLEMENT_CODE = 2001
CUSTOMER_CARD_CODE = 3001
SYSTEM_FEE_CODE = 4001

# Ledger ID
MAIN_LEDGER = 1


class TigerBeetleVerifier:
    """Verifies POS transactions in TigerBeetle"""
    
    def __init__(self, cluster_id: int, addresses: List[str]):
        """Initialize the TigerBeetle client"""
        self.client = Client(cluster_id=cluster_id, addresses=addresses)
    
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
    
    def get_transfers(self, transfer_ids: List[int]) -> List[Transfer]:
        """Retrieve transfers by their IDs"""
        try:
            return self.client.lookup_transfers(transfer_ids)
        except Exception as e:
            print(f"Error looking up transfers: {e}")
            return []
    
    def print_account_details(self, account: Account, label: str = ""):
        """Print detailed account information"""
        if label:
            print(f"\n{label}")
            print("=" * len(label))
        
        print(f"Account ID: {account.id}")
        print(f"Ledger: {account.ledger}")
        print(f"Code: {account.code}")
        print(f"Debits Posted: {account.debits_posted} ({account.debits_posted / 100:.2f} NGN)")
        print(f"Credits Posted: {account.credits_posted} ({account.credits_posted / 100:.2f} NGN)")
        
        balance = account.credits_posted - account.debits_posted
        print(f"Balance: {balance} ({balance / 100:.2f} NGN)")
        print()
    
    def print_transfer_details(self, transfer: Transfer, label: str = ""):
        """Print detailed transfer information"""
        if label:
            print(f"\n{label}")
            print("=" * len(label))
        
        print(f"Transfer ID: {transfer.id}")
        print(f"Debit Account: {transfer.debit_account_id}")
        print(f"Credit Account: {transfer.credit_account_id}")
        print(f"Amount: {transfer.amount} ({transfer.amount / 100:.2f} NGN)")
        print(f"Ledger: {transfer.ledger}")
        print(f"Code: {transfer.code}")
        print(f"Timestamp: {transfer.timestamp}")
        print()
    
    def verify_pos_transaction(self, transaction_id: str, 
                               customer_account_id: int,
                               merchant_account_id: int,
                               bank_account_id: int,
                               expected_amount: int):
        """
        Verify a complete POS transaction
        
        Args:
            transaction_id: The transaction ID
            customer_account_id: Customer card account ID
            merchant_account_id: Merchant settlement account ID
            bank_account_id: Bank settlement account ID
            expected_amount: Expected transaction amount in cents
        """
        print(f"\n{'=' * 60}")
        print(f"Verifying POS Transaction: {transaction_id}")
        print(f"{'=' * 60}\n")
        
        # Get all account balances
        account_ids = [customer_account_id, merchant_account_id, bank_account_id]
        accounts = self.get_multiple_balances(account_ids)
        
        if len(accounts) != 3:
            print(f"❌ Error: Expected 3 accounts, found {len(accounts)}")
            return False
        
        # Print account details
        self.print_account_details(accounts[0], "Customer Card Account")
        self.print_account_details(accounts[1], "Merchant Settlement Account")
        self.print_account_details(accounts[2], "Bank Settlement Account")
        
        # Verify balances
        customer_account = accounts[0]
        merchant_account = accounts[1]
        bank_account = accounts[2]
        
        print("Verification Results:")
        print("-" * 40)
        
        # Check if customer was debited
        if customer_account.debits_posted >= expected_amount:
            print(f"✓ Customer account debited: {customer_account.debits_posted / 100:.2f} NGN")
        else:
            print(f"❌ Customer account debit mismatch")
        
        # Check if merchant was credited
        if merchant_account.credits_posted >= expected_amount:
            print(f"✓ Merchant account credited: {merchant_account.credits_posted / 100:.2f} NGN")
        else:
            print(f"❌ Merchant account credit mismatch")
        
        # Check if bank was credited (for inter-bank transfers)
        if bank_account.credits_posted > 0:
            print(f"✓ Bank account credited: {bank_account.credits_posted / 100:.2f} NGN")
        
        print()
        return True


def hash_account_id(identifier: str) -> int:
    """
    Convert a string identifier to a 128-bit account ID
    In production, use a proper hashing function
    """
    # Simple hash for demonstration - in production, use a proper method
    return hash(identifier) & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF


def main():
    """Main function to demonstrate TigerBeetle queries"""
    
    # Configuration
    cluster_id = int(os.getenv("TIGERBEETLE_CLUSTER_ID", "0"))
    address = os.getenv("TIGERBEETLE_ADDRESS", "tigerbeetle-0.tigerbeetle.payment-switch.svc.cluster.local:3000")
    
    print("=" * 60)
    print("TigerBeetle POS Transaction Verification Tool")
    print("=" * 60)
    print(f"\nConnecting to TigerBeetle at: {address}")
    print(f"Cluster ID: {cluster_id}\n")
    
    # Create verifier
    verifier = TigerBeetleVerifier(cluster_id=cluster_id, addresses=[address])
    
    # Example 1: Verify Normal Transaction (Access Bank)
    print("\n" + "=" * 60)
    print("Example 1: Normal Transaction - Access Bank")
    print("=" * 60)
    
    customer_id = hash_account_id("card-5399410000000001")
    merchant_id = hash_account_id("merchant-MERCH-SHOPRITE-001")
    bank_id = hash_account_id("bank-ACCESS")
    
    verifier.verify_pos_transaction(
        transaction_id="txn-normal-access-001",
        customer_account_id=customer_id,
        merchant_account_id=merchant_id,
        bank_account_id=bank_id,
        expected_amount=500000  # 5000 NGN in cents
    )
    
    # Example 2: Verify High-Value Transaction (GTBank)
    print("\n" + "=" * 60)
    print("Example 2: High-Value Transaction - GTBank")
    print("=" * 60)
    
    customer_id = hash_account_id("card-5399230000000002")
    merchant_id = hash_account_id("merchant-MERCH-ELECTRONICS-045")
    bank_id = hash_account_id("bank-GTB")
    
    verifier.verify_pos_transaction(
        transaction_id="txn-high-value-gtb-001",
        customer_account_id=customer_id,
        merchant_account_id=merchant_id,
        bank_account_id=bank_id,
        expected_amount=25000000  # 250,000 NGN in cents
    )
    
    # Example 3: Query all bank settlement accounts
    print("\n" + "=" * 60)
    print("Example 3: All Bank Settlement Account Balances")
    print("=" * 60)
    
    nigerian_banks = [
        "ACCESS", "GTB", "ZENITH", "UBA", "FIRST", "FCMB", "UNION", "STANBIC",
        "STERLING", "FIDELITY", "WEMA", "POLARIS", "ECOBANK", "KEYSTONE",
        "UNITY", "PROVIDUS", "JAIZ", "SUNTRUST", "HERITAGE", "TITAN"
    ]
    
    bank_account_ids = [hash_account_id(f"bank-{bank}") for bank in nigerian_banks]
    bank_accounts = verifier.get_multiple_balances(bank_account_ids)
    
    print(f"\nFound {len(bank_accounts)} bank accounts:\n")
    
    total_settlement = 0
    for i, account in enumerate(bank_accounts):
        balance = account.credits_posted - account.debits_posted
        total_settlement += balance
        print(f"{nigerian_banks[i]:15} | Balance: {balance / 100:15,.2f} NGN")
    
    print(f"\n{'Total Settlement':15} | Balance: {total_settlement / 100:15,.2f} NGN")
    
    print("\n" + "=" * 60)
    print("Verification Complete")
    print("=" * 60)


if __name__ == "__main__":
    main()
