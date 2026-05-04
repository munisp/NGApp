
# Comprehensive TigerBeetle Verification Guide for POS Transactions

This document provides a complete guide for verifying account balances and transaction postings in TigerBeetle after processing the sample POS transactions. It includes instructions on how to use the provided Go and Python verification scripts.

## 1. Overview

Verifying the state of the TigerBeetle ledger is a critical step in ensuring the correctness and integrity of the POS payment processing system. This guide will walk you through the process of querying TigerBeetle to:

*   Check the balances of customer, merchant, and bank accounts.
*   Verify that transactions have been correctly posted.
*   Ensure that the overall system state is consistent.

## 2. Prerequisites

Before you begin, ensure you have the following:

*   A running instance of the Next-Generation Payment Switch with the POS payment system deployed.
*   `kubectl` configured to connect to your Kubernetes cluster.
*   The `tigerbeetle` CLI installed (optional, for manual queries).
*   Go (v1.18+) and Python (v3.8+) installed on your local machine if you want to run the verification scripts locally.

## 3. Account and Transfer Schema

For a detailed understanding of the account and transfer structure used in TigerBeetle, please refer to the `account_schema.md` document.

## 4. Verification Scripts

We have provided two verification scripts, one in Go and one in Python, that you can use to query TigerBeetle. Both scripts provide similar functionality.

### 4.1. Go Verification Script (`verify_transactions.go`)

This script is a command-line tool that connects to your TigerBeetle cluster and performs a series of queries.

#### How to Run

1.  **Set up port-forwarding to your TigerBeetle cluster**:

    ```bash
    kubectl port-forward -n payment-switch svc/tigerbeetle-0 3000:3000
    ```

2.  **Set the `TIGERBEETLE_ADDRESS` environment variable**:

    ```bash
    export TIGERBEETLE_ADDRESS=127.0.0.1:3000
    ```

3.  **Run the script**:

    ```bash
    go run verify_transactions.go
    ```

### 4.2. Python Verification Script (`verify_transactions.py`)

This script provides a more detailed and user-friendly output for verifying the sample transactions.

#### How to Run

1.  **Install the TigerBeetle Python client**:

    ```bash
    pip install tigerbeetle
    ```

2.  **Set up port-forwarding** (if not already done):

    ```bash
    kubectl port-forward -n payment-switch svc/tigerbeetle-0 3000:3000
    ```

3.  **Set the `TIGERBEETLE_ADDRESS` environment variable**:

    ```bash
    export TIGERBEETLE_ADDRESS=127.0.0.1:3000
    ```

4.  **Run the script**:

    ```bash
    python3 verify_transactions.py
    ```

## 5. Expected Output and Verification Steps

When you run the Python verification script, you should see output similar to the following for each sample transaction:

### Example: Normal Transaction - Access Bank

```
============================================================
Verifying POS Transaction: txn-normal-access-001
============================================================

Customer Card Account
=====================
Account ID: 1234567890123456789
Debits Posted: 500000 (5000.00 NGN)
Credits Posted: 0 (0.00 NGN)
Balance: -500000 (-5000.00 NGN)

Merchant Settlement Account
===========================
Account ID: 9876543210987654321
Debits Posted: 0 (0.00 NGN)
Credits Posted: 500000 (5000.00 NGN)
Balance: 500000 (5000.00 NGN)

Bank Settlement Account
=======================
Account ID: 1122334455667788990
Debits Posted: 0 (0.00 NGN)
Credits Posted: 500000 (5000.00 NGN)
Balance: 500000 (5000.00 NGN)

Verification Results:
----------------------------------------
✓ Customer account debited: 5000.00 NGN
✓ Merchant account credited: 5000.00 NGN
✓ Bank account credited: 5000.00 NGN
```

### Verification Checklist

*   **Customer Account**: The `debits_posted` should be equal to the transaction amount.
*   **Merchant Account**: The `credits_posted` should be equal to the transaction amount.
*   **Bank Account**: The `credits_posted` should be equal to the transaction amount (for inter-bank settlement).
*   **System Fee Account**: The `credits_posted` should reflect the accumulated transaction fees.
*   **High-Risk Transaction**: For the suspicious high-risk transaction, you should verify that **no transfers** were posted to the ledger, as the transaction should have been blocked.

## 6. Manual Queries with `tigerbeetle` CLI

If you have the `tigerbeetle` CLI installed, you can also perform manual queries.

1.  **Connect to the cluster**:

    ```bash
    tigerbeetle repl --cluster=0 --addresses=127.0.0.1:3000
    ```

2.  **Look up an account**:

    ```
    lookup_accounts id=1234567890123456789
    ```

## 7. Conclusion

This guide provides you with the tools and knowledge necessary to verify the integrity of your TigerBeetle ledger. By following these steps, you can be confident that your POS payment processing system is correctly recording all financial transactions.
