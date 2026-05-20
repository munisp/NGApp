# Schema Patterns — 54Link POS Platform

## Core Tables

### agents

- Primary table for agent network
- Fields: id, agentCode, name, pin, phone, location, tier, float, status
- Used across transactions, MDM, KYC flows

### transactions

- Records all financial transactions
- Fields: id, ref, agentId, type, amount, fee, commission, status, channel
- Supports: Cash In, Cash Out, Transfer, Airtime, Bills Payment

### fraud_alerts

- Fraud detection and scoring results
- Fields: id, transactionId, score, reason, status, reviewedBy
- Integrates with ML scoring pipeline

### devices

- MDM device registry for POS terminals
- Fields: id, agentId, serialNumber, model, status, lastSeenAt

### rate_alerts

- Data threshold monitoring rules
- Fields: id, alertType, severity, status, createdAt

### kyc_sessions

- KYC verification workflow state
- Fields: id, agentId, status, documentType, livenessResult

### settlement_batches

- Daily settlement processing records
- Fields: id, date, status, totalAmount, bankRef

## Relationships

- agents → transactions (1:N)
- agents → devices (1:N)
- agents → kyc_sessions (1:N)
- transactions → fraud_alerts (1:1)
