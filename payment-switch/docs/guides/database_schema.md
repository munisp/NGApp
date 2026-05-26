# Next Generation Payment Switch: Database Schema

## 1. Introduction

This document describes the database schemas for the core components of the Next Generation Payment Switch. It focuses on the schemas for Mojaloop (running on MySQL) and TigerBeetle, the high-performance financial ledger.

## 2. Mojaloop Database Schema (MySQL)

Mojaloop uses a MySQL database to store its operational data. The following are some of the key tables in the Mojaloop schema.

### 2.1. `participant` Table

Stores information about the financial institutions (DFSPs) participating in the switch.

| Column Name | Data Type | Description |
|---|---|---|
| `participantId` | INT(11) | Primary key for the participant. |
| `name` | VARCHAR(255) | Name of the participant. |
| `currency` | VARCHAR(3) | The currency supported by the participant. |
| `isActive` | TINYINT(1) | Whether the participant is active. |
| `createdAt` | DATETIME | Timestamp of when the participant was created. |

### 2.2. `party` Table

Stores information about the end-users (customers, merchants).

| Column Name | Data Type | Description |
|---|---|---|
| `partyId` | INT(11) | Primary key for the party. |
| `participantId` | INT(11) | Foreign key to the `participant` table. |
| `msisdn` | VARCHAR(255) | The mobile number of the party. |
| `firstName` | VARCHAR(255) | The first name of the party. |
| `lastName` | VARCHAR(255) | The last name of the party. |
| `createdAt` | DATETIME | Timestamp of when the party was created. |

### 2.3. `transfer` Table

The main table for tracking payment transfers.

| Column Name | Data Type | Description |
|---|---|---|
| `transferId` | VARCHAR(36) | Primary key for the transfer (UUID). |
| `payerParticipantId` | INT(11) | The participant ID of the payer. |
| `payeeParticipantId` | INT(11) | The participant ID of the payee. |
| `amount` | DECIMAL(18,2) | The amount of the transfer. |
| `currency` | VARCHAR(3) | The currency of the transfer. |
| `transferState` | VARCHAR(255) | The current state of the transfer (e.g., `COMMITTED`, `ABORTED`). |
| `createdAt` | DATETIME | Timestamp of when the transfer was created. |
| `completedAt` | DATETIME | Timestamp of when the transfer was completed. |

## 3. TigerBeetle Schema

TigerBeetle is a financial accounting database with a fixed schema optimized for performance and safety. It provides two fundamental data structures: `Account` and `Transfer`.

### 3.1. `Account` Struct

Represents a single account in the ledger.

| Field | Data Type | Description |
|---|---|---|
| `id` | 128-bit unsigned integer | A unique identifier for the account. |
| `user_data` | 128-bit unsigned integer | User-defined data associated with the account. |
| `ledger` | 32-bit unsigned integer | A unique identifier for the ledger this account belongs to. |
| `code` | 16-bit unsigned integer | A user-defined code for the account type (e.g., accounts receivable, accounts payable). |
| `flags` | 16-bit unsigned integer | A bitmask of flags for the account (e.g., `debits_must_not_exceed_credits`). |
| `debits_posted` | 64-bit unsigned integer | The total value of all debits posted to the account. |
| `credits_posted` | 64-bit unsigned integer | The total value of all credits posted to the account. |
| `timestamp` | 64-bit unsigned integer | The timestamp of when the account was last modified. |

### 3.2. `Transfer` Struct

Represents a single transfer of value between two accounts.

| Field | Data Type | Description |
|---|---|---|
| `id` | 128-bit unsigned integer | A unique identifier for the transfer. |
| `debit_account_id` | 128-bit unsigned integer | The ID of the account to be debited. |
| `credit_account_id` | 128-bit unsigned integer | The ID of the account to be credited. |
| `amount` | 64-bit unsigned integer | The amount to be transferred. |
| `pending_id` | 128-bit unsigned integer | A unique identifier for a pending transfer (for two-phase transfers). |
| `user_data` | 128-bit unsigned integer | User-defined data associated with the transfer. |
| `timeout` | 32-bit unsigned integer | The timeout for a pending transfer. |
| `code` | 16-bit unsigned integer | A user-defined code for the transfer type. |
| `flags` | 16-bit unsigned integer | A bitmask of flags for the transfer (e.g., `linked`, `pending`). |
| `timestamp` | 64-bit unsigned integer | The timestamp of when the transfer was created. |

## 4. Temporal Persistence

Temporal uses a persistence store to maintain the state of workflows. It supports multiple database backends, including:

- Cassandra
- PostgreSQL
- MySQL

The choice of database depends on the specific requirements for scalability and operational overhead. The schema for the Temporal persistence layer is managed by Temporal itself and does not need to be defined by the user.
