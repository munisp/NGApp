# TigerBeetle Account Schema for POS Payment System

This document defines the account structure and schema used in TigerBeetle for the POS payment processing system.

## Account Types

The POS payment system uses the following account types in TigerBeetle:

### 1. Merchant Settlement Accounts

These accounts hold the funds for merchants who accept POS payments.

*   **Account ID Format**: `merchant-{merchant_id}`
*   **Ledger**: `1` (Main ledger for NGN transactions)
*   **Code**: `1001` (Merchant settlement account)
*   **Currency**: NGN (Nigerian Naira)

### 2. Bank Settlement Accounts

These accounts represent the settlement accounts for each of the 20 Nigerian banks.

*   **Account ID Format**: `bank-{bank_code}`
*   **Ledger**: `1` (Main ledger for NGN transactions)
*   **Code**: `2001` (Bank settlement account)
*   **Currency**: NGN

### 3. Customer Card Accounts

These accounts represent the customer's card accounts from which payments are debited.

*   **Account ID Format**: `card-{card_number_hash}`
*   **Ledger**: `1` (Main ledger for NGN transactions)
*   **Code**: `3001` (Customer card account)
*   **Currency**: NGN

### 4. System Fee Account

This account collects transaction fees.

*   **Account ID**: `system-fees`
*   **Ledger**: `1`
*   **Code**: `4001` (System fee account)
*   **Currency**: NGN

## Account ID Mapping for Sample Transactions

For the sample transactions in `test-data/sample-transactions.json`, the following account IDs are used:

| Transaction Scenario | Customer Card Account | Merchant Account | Bank Account |
|----------------------|----------------------|------------------|--------------|
| Normal Transaction (Access Bank) | `card-5399410000000001` | `merchant-MERCH-SHOPRITE-001` | `bank-ACCESS` |
| High-Value Transaction (GTBank) | `card-5399230000000002` | `merchant-MERCH-ELECTRONICS-045` | `bank-GTB` |
| Round Amount (Zenith Bank) | `card-5399250000000003` | `merchant-MERCH-RESTAURANT-078` | `bank-ZENITH` |
| High-Risk Transaction (UBA) | `card-5399270000000004` | `merchant-MERCH-JEWELRY-012` | `bank-UBA` |

## Transfer Schema

Each POS transaction results in the following transfers in TigerBeetle:

1.  **Customer to Merchant**: Debit the customer's card account and credit the merchant's settlement account.
2.  **Merchant to Bank**: Debit the merchant's settlement account and credit the bank's settlement account (for inter-bank transfers).
3.  **Transaction Fee**: Debit the customer's card account and credit the system fee account.

## Example Account Creation

To create accounts in TigerBeetle, you would use the following structure (in JSON format for illustration):

```json
{
  "id": "merchant-MERCH-SHOPRITE-001",
  "ledger": 1,
  "code": 1001,
  "flags": 0,
  "user_data": 0,
  "reserved": 0,
  "debits_pending": 0,
  "debits_posted": 0,
  "credits_pending": 0,
  "credits_posted": 0,
  "timestamp": 0
}
```

In practice, accounts are created using the TigerBeetle client library in Go or Python.
