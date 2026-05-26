# API Testing Commands - Next-Generation Payment Switch

## Prerequisites

Ensure all services are running:
```bash
docker-compose ps
# or
make ps
```

All services should show status "Up (healthy)".

---

## Test 1: Health Check (All Services)

### Payment Gateway Health
```bash
curl -X GET http://localhost/api/v1/payments/health \
  -H "Accept: application/json"
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "payment-gateway",
  "version": "1.0.0",
  "timestamp": "2024-11-03T18:00:00Z",
  "dependencies": {
    "database": "connected",
    "redis": "connected",
    "temporal": "connected"
  }
}
```

### Fraud Detection Service Health
```bash
curl -X GET http://localhost/api/v1/fraud/health \
  -H "Accept: application/json"
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "fraud-detection-service",
  "version": "1.0.0",
  "timestamp": "2024-11-03T18:00:00Z",
  "models": {
    "gnn_loaded": true,
    "ml_model_loaded": true
  },
  "dependencies": {
    "redis": "connected"
  }
}
```

---

## Test 2: Initiate Payment (P2P Transfer)

### Request
```bash
curl -X POST http://localhost/api/v1/payments/initiate \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "source": {
      "type": "MSISDN",
      "identifier": "+1234567890"
    },
    "destination": {
      "type": "MSISDN",
      "identifier": "+0987654321"
    },
    "amount": {
      "currency": "USD",
      "value": "100.00"
    },
    "transactionType": "P2P",
    "channel": "MOBILE",
    "metadata": {
      "description": "Test payment",
      "reference": "TEST-001"
    }
  }'
```

**Expected Response:**
```json
{
  "transaction_id": "txn_20241103180000_abc123",
  "status": "PENDING",
  "workflow_id": "wf_payment_abc123",
  "message": "Payment initiated successfully",
  "timestamp": "2024-11-03T18:00:00Z",
  "estimated_completion": "2024-11-03T18:00:05Z"
}
```

**Status Codes:**
- `200 OK` - Payment initiated successfully
- `400 Bad Request` - Invalid request data
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

---

## Test 3: Check Fraud Score

### Request
```bash
curl -X POST http://localhost/api/v1/fraud/score \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "transaction_id": "txn_20241103180000_abc123",
    "payer_id": "user_12345",
    "payee_id": "user_67890",
    "amount": 100.00,
    "currency": "USD",
    "channel": "MOBILE",
    "timestamp": "2024-11-03T18:00:00Z",
    "metadata": {
      "device_id": "device_001",
      "ip_address": "192.168.1.100",
      "location": {
        "latitude": 40.7128,
        "longitude": -74.0060
      }
    }
  }'
```

**Expected Response:**
```json
{
  "transaction_id": "txn_20241103180000_abc123",
  "fraud_score": 0.15,
  "risk_level": "LOW",
  "recommendation": "APPROVE",
  "factors": {
    "ml_score": 0.12,
    "gnn_score": 0.18,
    "rule_score": 0.10
  },
  "triggered_rules": [],
  "processing_time_ms": 45,
  "model_version": "gat_v1.0",
  "timestamp": "2024-11-03T18:00:00Z"
}
```

**Risk Levels:**
- `LOW` (0.0 - 0.3): Approve automatically
- `MEDIUM` (0.3 - 0.7): Manual review recommended
- `HIGH` (0.7 - 1.0): Block transaction

**Status Codes:**
- `200 OK` - Fraud check completed
- `400 Bad Request` - Invalid request data
- `429 Too Many Requests` - Rate limit exceeded (100 req/s)
- `500 Internal Server Error` - Server error

---

## Test 4: Check Payment Status

### Request
```bash
curl -X POST http://localhost/api/v1/payments/status \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "transaction_id": "txn_20241103180000_abc123"
  }'
```

**Expected Response:**
```json
{
  "transaction_id": "txn_20241103180000_abc123",
  "status": "COMPLETED",
  "workflow_id": "wf_payment_abc123",
  "amount": {
    "currency": "USD",
    "value": "100.00"
  },
  "source": {
    "type": "MSISDN",
    "identifier": "+1234567890"
  },
  "destination": {
    "type": "MSISDN",
    "identifier": "+0987654321"
  },
  "created_at": "2024-11-03T18:00:00Z",
  "completed_at": "2024-11-03T18:00:05Z",
  "fraud_check": {
    "score": 0.15,
    "status": "APPROVED"
  }
}
```

**Transaction Statuses:**
- `PENDING` - Transaction initiated, processing
- `FRAUD_CHECK` - Undergoing fraud detection
- `APPROVED` - Fraud check passed, proceeding
- `PROCESSING` - Being processed by ledger
- `COMPLETED` - Successfully completed
- `FAILED` - Transaction failed
- `REJECTED` - Rejected by fraud detection
- `CANCELLED` - Cancelled by user

---

## Test 5: Create Settlement Window

### Request
```bash
curl -X POST http://localhost/api/v1/settlement/windows/create \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "start_time": "2024-11-03T00:00:00Z",
    "end_time": "2024-11-03T23:59:59Z",
    "settlement_model": "DEFERRED_NET",
    "currency": "USD",
    "participants": [
      "dfsp_001",
      "dfsp_002",
      "dfsp_003"
    ]
  }'
```

**Expected Response:**
```json
{
  "window_id": "sw_20241103_001",
  "status": "OPEN",
  "start_time": "2024-11-03T00:00:00Z",
  "end_time": "2024-11-03T23:59:59Z",
  "settlement_model": "DEFERRED_NET",
  "currency": "USD",
  "participants": [
    "dfsp_001",
    "dfsp_002",
    "dfsp_003"
  ],
  "created_at": "2024-11-03T18:00:00Z"
}
```

**Settlement Models:**
- `DEFERRED_NET` - Net settlement at end of window
- `IMMEDIATE_GROSS` - Real-time gross settlement
- `MULTILATERAL_NET` - Multilateral netting

---

## Bonus Tests

### Test 6: Batch Fraud Scoring

```bash
curl -X POST http://localhost/api/v1/fraud/score/batch \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "transactions": [
      {
        "transaction_id": "txn_001",
        "payer_id": "user_001",
        "payee_id": "user_002",
        "amount": 50.00,
        "currency": "USD",
        "channel": "MOBILE",
        "timestamp": "2024-11-03T18:00:00Z"
      },
      {
        "transaction_id": "txn_002",
        "payer_id": "user_003",
        "payee_id": "user_004",
        "amount": 150.00,
        "currency": "USD",
        "channel": "WEB",
        "timestamp": "2024-11-03T18:00:01Z"
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "results": [
    {
      "transaction_id": "txn_001",
      "fraud_score": 0.12,
      "risk_level": "LOW",
      "recommendation": "APPROVE"
    },
    {
      "transaction_id": "txn_002",
      "fraud_score": 0.45,
      "risk_level": "MEDIUM",
      "recommendation": "REVIEW"
    }
  ],
  "total_processed": 2,
  "processing_time_ms": 78,
  "timestamp": "2024-11-03T18:00:00Z"
}
```

### Test 7: Sync Offline Payments

```bash
curl -X POST http://localhost/api/v1/offline/sync \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "device_id": "device_offline_001",
    "transactions": [
      {
        "local_id": "offline_txn_001",
        "payer_msisdn": "+1234567890",
        "payee_msisdn": "+0987654321",
        "amount": 25.00,
        "currency": "USD",
        "timestamp": "2024-11-03T12:00:00Z",
        "signature": "a1b2c3d4e5f6..."
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "sync_id": "sync_20241103_001",
  "device_id": "device_offline_001",
  "total_transactions": 1,
  "successful": 1,
  "failed": 0,
  "results": [
    {
      "local_id": "offline_txn_001",
      "transaction_id": "txn_20241103180000_xyz789",
      "status": "SYNCED",
      "message": "Transaction synced successfully"
    }
  ],
  "timestamp": "2024-11-03T18:00:00Z"
}
```

### Test 8: Get Fraud Detection Statistics

```bash
curl -X GET http://localhost/api/v1/fraud/stats \
  -H "Accept: application/json"
```

**Expected Response:**
```json
{
  "total_checks": 15234,
  "fraud_detected": 342,
  "fraud_rate": 0.0224,
  "average_score": 0.18,
  "average_latency_ms": 47,
  "model_accuracy": 0.96,
  "last_updated": "2024-11-03T18:00:00Z",
  "risk_distribution": {
    "LOW": 13892,
    "MEDIUM": 1000,
    "HIGH": 342
  }
}
```

---

## Rate Limiting Tests

### Test Payment Rate Limit (10 req/s)

```bash
# Send 15 requests rapidly
for i in {1..15}; do
  curl -X POST http://localhost/api/v1/payments/initiate \
    -H "Content-Type: application/json" \
    -d '{"source":{"type":"MSISDN","identifier":"+1234567890"},"destination":{"type":"MSISDN","identifier":"+0987654321"},"amount":{"currency":"USD","value":"10.00"},"transactionType":"P2P","channel":"MOBILE"}' &
done
wait
```

**Expected Behavior:**
- First 10 requests: `200 OK`
- Next 5 requests: `429 Too Many Requests`

**429 Response:**
```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests. Please try again later.",
  "retry_after": 1
}
```

### Test Fraud Detection Rate Limit (100 req/s)

```bash
# Send 110 requests rapidly
for i in {1..110}; do
  curl -X POST http://localhost/api/v1/fraud/score \
    -H "Content-Type: application/json" \
    -d '{"transaction_id":"txn_'$i'","payer_id":"user_1","payee_id":"user_2","amount":100.00,"currency":"USD","channel":"MOBILE","timestamp":"2024-11-03T18:00:00Z"}' &
done
wait
```

**Expected Behavior:**
- First 100 requests: `200 OK`
- Next 10 requests: `429 Too Many Requests`

---

## Error Handling Tests

### Test 9: Invalid Payment Request

```bash
curl -X POST http://localhost/api/v1/payments/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "source": {
      "type": "INVALID_TYPE",
      "identifier": "invalid"
    },
    "amount": {
      "currency": "INVALID",
      "value": "-100.00"
    }
  }'
```

**Expected Response (400 Bad Request):**
```json
{
  "error": "validation_error",
  "message": "Invalid request data",
  "details": [
    {
      "field": "source.type",
      "message": "Invalid identifier type. Must be one of: MSISDN, ACCOUNT_ID, EMAIL"
    },
    {
      "field": "amount.currency",
      "message": "Invalid currency code. Must be ISO 4217 format"
    },
    {
      "field": "amount.value",
      "message": "Amount must be positive"
    }
  ]
}
```

---

## Performance Benchmarking

### Apache Bench (ab) - Payment Gateway

```bash
ab -n 1000 -c 10 -p payment_data.json -T application/json \
  http://localhost/api/v1/payments/initiate
```

### wrk - Fraud Detection

```bash
wrk -t4 -c100 -d30s --latency \
  -s fraud_check.lua \
  http://localhost/api/v1/fraud/score
```

---

## Testing Workflow

### Complete Payment Flow

```bash
#!/bin/bash

# 1. Initiate payment
PAYMENT_RESPONSE=$(curl -s -X POST http://localhost/api/v1/payments/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "source": {"type": "MSISDN", "identifier": "+1234567890"},
    "destination": {"type": "MSISDN", "identifier": "+0987654321"},
    "amount": {"currency": "USD", "value": "100.00"},
    "transactionType": "P2P",
    "channel": "MOBILE"
  }')

echo "Payment Response: $PAYMENT_RESPONSE"

# Extract transaction ID
TXN_ID=$(echo $PAYMENT_RESPONSE | jq -r '.transaction_id')
echo "Transaction ID: $TXN_ID"

# 2. Check fraud score
FRAUD_RESPONSE=$(curl -s -X POST http://localhost/api/v1/fraud/score \
  -H "Content-Type: application/json" \
  -d "{
    \"transaction_id\": \"$TXN_ID\",
    \"payer_id\": \"user_12345\",
    \"payee_id\": \"user_67890\",
    \"amount\": 100.00,
    \"currency\": \"USD\",
    \"channel\": \"MOBILE\",
    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
  }")

echo "Fraud Response: $FRAUD_RESPONSE"

# 3. Wait 2 seconds
sleep 2

# 4. Check payment status
STATUS_RESPONSE=$(curl -s -X POST http://localhost/api/v1/payments/status \
  -H "Content-Type: application/json" \
  -d "{\"transaction_id\": \"$TXN_ID\"}")

echo "Status Response: $STATUS_RESPONSE"
```

---

## Summary

| Test | Endpoint | Method | Expected Status |
|------|----------|--------|-----------------|
| Health Check | `/api/v1/payments/health` | GET | 200 |
| Initiate Payment | `/api/v1/payments/initiate` | POST | 200 |
| Fraud Score | `/api/v1/fraud/score` | POST | 200 |
| Payment Status | `/api/v1/payments/status` | POST | 200 |
| Settlement Window | `/api/v1/settlement/windows/create` | POST | 200 |
| Batch Fraud | `/api/v1/fraud/score/batch` | POST | 200 |
| Offline Sync | `/api/v1/offline/sync` | POST | 200 |
| Fraud Stats | `/api/v1/fraud/stats` | GET | 200 |

All requests go through NGINX at `http://localhost` with rate limiting applied.
