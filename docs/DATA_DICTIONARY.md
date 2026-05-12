# 54Bank Data Dictionary

## Core Banking Tables

### accounts
Primary account storage for all customer accounts.

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| accountId | varchar(64) | Unique account identifier (e.g., ACC-001) |
| customerId | varchar(64) | FK to customers table |
| accountName | varchar(191) | Account holder name |
| accountType | text | savings, current, fixed-deposit, domiciliary |
| currency | varchar(3) | ISO 4217 code (NGN, USD, GBP, EUR) |
| balance | numeric | Current available balance |
| status | text | active, dormant, frozen, closed |
| branchCode | varchar(10) | Branch identifier |
| createdAt | timestamp | Account opening date |

### customers
Master customer records with KYC data.

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| customerId | varchar(64) | Unique customer identifier |
| firstName | varchar(100) | Customer first name |
| lastName | varchar(100) | Customer last name |
| email | varchar(191) | Email address |
| phone | varchar(20) | Nigerian phone number (+234...) |
| bvn | varchar(11) | Bank Verification Number |
| nin | varchar(11) | National Identification Number |
| accountType | text | individual, corporate, sme |
| riskRating | text | low, medium, high, critical |
| kycStatus | text | pending, verified, expired, rejected |
| createdAt | timestamp | Customer onboarding date |

### transactions
All financial transaction records.

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| transactionId | varchar(64) | Unique transaction reference |
| accountId | varchar(64) | FK to accounts table |
| type | text | credit, debit, transfer, reversal |
| amount | numeric | Transaction amount |
| currency | varchar(3) | ISO 4217 currency code |
| narration | text | Transaction description |
| channel | text | branch, mobile, internet, ussd, pos, atm |
| status | text | pending, completed, failed, reversed |
| createdAt | timestamp | Transaction timestamp |

## Total: 267 tables across 46 banking domains
See drizzle/schema.ts for complete schema definitions.
