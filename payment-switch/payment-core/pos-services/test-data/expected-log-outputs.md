
# Expected Log Outputs for POS Transaction Processing

This document provides the expected log outputs at each stage of the real-time POS payment processing pipeline for the scenarios defined in `sample-transactions.json`. This is crucial for verifying that the system is behaving as expected.

## Scenario 1: Normal Transaction - Access Bank

### 1.1. POS Gateway (Go Service)

```json
{"level":"info","ts":1705329000.000,"caller":"gateway/main.go:123","msg":"Received POS transaction","transaction_id":"txn-normal-access-001","terminal_id":"TERM-LAG-00123456","amount":5000}
{"level":"info","ts":1705329000.050,"caller":"gateway/main.go:150","msg":"Ingesting transaction to Fluvio","transaction_id":"txn-normal-access-001"}
```

### 1.2. Fluvio SmartModule Output (JSON)

This is the record that the SmartModule writes to the `processed-transactions` topic.

```json
{
  "transaction_id": "txn-normal-access-001",
  "terminal_id": "TERM-LAG-00123456",
  "merchant_id": "MERCH-SHOPRITE-001",
  "card_number_masked": "************0001",
  "amount": 5000,
  "currency": "NGN",
  "timestamp": "2024-01-15T14:30:00Z",
  "location": {
    "latitude": 6.5244,
    "longitude": 3.3792,
    "city": "Lagos",
    "state": "Lagos"
  },
  "fraud_score": 0.1,
  "risk_level": "low",
  "bank_code": "ACCESS",
  "enriched": true,
  "validation_status": "valid"
}
```

### 1.3. Fluvio Consumer (Python Service)

```log
INFO:root:Consuming transaction: {"transaction_id": "txn-normal-access-001", ...}
INFO:root:Starting workflow pos-payment-txn-normal-access-001 for transaction txn-normal-access-001
```

### 1.4. Temporal Workflow (Python Service)

```log
INFO:temporal.worker:Starting POS payment workflow for transaction txn-normal-access-001
INFO:temporal.worker:Validating fraud score for transaction txn-normal-access-001: 0.1
INFO:temporal.worker:Creating ledger transaction for txn-normal-access-001
INFO:temporal.worker:Ledger transaction created: ledger-txn-normal-access-001
INFO:temporal.worker:Processing bank payment for transaction txn-normal-access-001 via ACCESS
INFO:temporal.worker:Bank payment processed: ACCESS-txn-norm
INFO:temporal.worker:Updating transaction status: txn-normal-access-001 -> success
INFO:temporal.worker:Sending notification for transaction txn-normal-access-001 to merchant MERCH-SHOPRITE-001
INFO:temporal.worker:Initiating reconciliation for transaction txn-normal-access-001
INFO:temporal.worker:POS payment workflow completed successfully for txn-normal-access-001
```

### 1.5. BankAdapter (Go Service)

```json
{"level":"info","ts":1705329001.200,"caller":"adapter/main.go:123","msg":"Processing payment via Access Bank","transaction_id":"txn-normal-access-001","amount":5000}
```

---

## Scenario 2: High-Value Transaction - GTBank

### 2.1. POS Gateway

```json
{"level":"info","ts":1705337100.000,"caller":"gateway/main.go:123","msg":"Received POS transaction","transaction_id":"txn-high-value-gtb-001","terminal_id":"TERM-ABJ-00987654","amount":250000}
```

### 2.2. Fluvio SmartModule Output

```json
{
  "transaction_id": "txn-high-value-gtb-001",
  "fraud_score": 0.4,
  "risk_level": "medium",
  "bank_code": "GTB",
  ...
}
```

### 2.3. Temporal Workflow

```log
INFO:temporal.worker:Validating fraud score for transaction txn-high-value-gtb-001: 0.4
INFO:temporal.worker:Transaction txn-high-value-gtb-001 requires manual review
...
```

### 2.4. BankAdapter

```json
{"level":"info","ts":1705337101.500,"caller":"adapter/main.go:234","msg":"Processing payment via GT Bank","transaction_id":"txn-high-value-gtb-001","amount":250000}
```

---

## Scenario 3: Suspicious High-Risk Transaction - UBA

### 3.1. POS Gateway

```json
{"level":"info","ts":1705351800.000,"caller":"gateway/main.go:123","msg":"Received POS transaction","transaction_id":"txn-high-risk-uba-001","terminal_id":"TERM-KAN-00234567","amount":500000}
```

### 3.2. Fluvio SmartModule Output

```json
{
  "transaction_id": "txn-high-risk-uba-001",
  "fraud_score": 0.8,
  "risk_level": "high",
  "bank_code": "UBA",
  ...
}
```

### 3.3. Fluvio Consumer

```log
INFO:root:Consuming transaction: {"transaction_id": "txn-high-risk-uba-001", ...}
INFO:root:Starting workflow pos-payment-txn-high-risk-uba-001 for transaction txn-high-risk-uba-001
```

### 3.4. Temporal Workflow

```log
INFO:temporal.worker:Starting POS payment workflow for transaction txn-high-risk-uba-001
INFO:temporal.worker:Validating fraud score for transaction txn-high-risk-uba-001: 0.8
WARNING:temporal.worker:Transaction txn-high-risk-uba-001 blocked due to high fraud risk
WARNING:temporal.worker:Fraud alert triggered for transaction txn-high-risk-uba-001
INFO:temporal.worker:Updating transaction status: txn-high-risk-uba-001 -> blocked
```

### 3.5. BankAdapter

*No log output from BankAdapter as the transaction is blocked before reaching it.*

---

## Scenario 4: Invalid Card Number

### 4.1. POS Gateway

```json
{"level":"info","ts":1705317600.000,"caller":"gateway/main.go:123","msg":"Received POS transaction","transaction_id":"txn-invalid-card-001","terminal_id":"TERM-IBA-00345678","amount":15000}
```

### 4.2. Fluvio SmartModule Output

This will be an error record.

```json
{
  "error": "Validation failed",
  "transaction_id": "txn-invalid-card-001"
}
```

### 4.3. Fluvio Consumer

*No log output from the consumer for this transaction as it will be filtered out by the SmartModule or routed to a dead-letter queue.*

---

This detailed log output specification will be instrumental in building a robust testing and verification framework for the real-time POS payment processing system.
