
## 1. P2P (Person-to-Person) API Examples

### Request

```json
{
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
    "value": 100.00
  },
  "transactionType": "P2P",
  "channel": "MOBILE"
}
```

### Response

```json
{
  "transactionId": "txn_1699012497",
  "status": "PENDING",
  "message": "Payment submitted successfully"
}
```
---

## 2. P2M (Person-to-Merchant) API Examples

### Request

```json
{
  "source": {
    "type": "VPA",
    "identifier": "customer@bank"
  },
  "destination": {
    "type": "MERCHANT_ID",
    "identifier": "merchant_12345"
  },
  "amount": {
    "currency": "USD",
    "value": 75.50
  },
  "transactionType": "P2M",
  "channel": "POS"
}
```

### Response

```json
{
  "transactionId": "txn_1699012530",
  "status": "COMPLETED",
  "message": "Payment successful"
}
```

---

## 3. P2B (Person-to-Business) API Examples

### Request

```json
{
  "source": {
    "type": "BANK_ACCOUNT",
    "identifier": "123456789"
  },
  "destination": {
    "type": "BUSINESS_ID",
    "identifier": "business_67890"
  },
  "amount": {
    "currency": "USD",
    "value": 500.00
  },
  "transactionType": "P2B",
  "channel": "WEB"
}
```

### Response

```json
{
  "transactionId": "txn_1699012560",
  "status": "COMPLETED",
  "message": "Payment successful"
}
```

---

## 4. B2P (Business-to-Person) API Examples

### Request (Batch)

```json
{
  "batchId": "batch_1699012590",
  "payments": [
    {
      "source": {
        "type": "BUSINESS_ID",
        "identifier": "business_12345"
      },
      "destination": {
        "type": "MSISDN",
        "identifier": "+1111111111"
      },
      "amount": {
        "currency": "USD",
        "value": 2500.00
      },
      "transactionType": "B2P",
      "channel": "BATCH"
    },
    {
      "source": {
        "type": "BUSINESS_ID",
        "identifier": "business_12345"
      },
      "destination": {
        "type": "MSISDN",
        "identifier": "+2222222222"
      },
      "amount": {
        "currency": "USD",
        "value": 3000.00
      },
      "transactionType": "B2P",
      "channel": "BATCH"
    }
  ]
}
```

### Response

```json
{
  "batchId": "batch_1699012590",
  "status": "PROCESSING",
  "message": "Batch submitted for processing"
}
```

---

## 5. B2B (Business-to-Business) API Examples

### Request

```json
{
  "source": {
    "type": "BUSINESS_ID",
    "identifier": "business_12345"
  },
  "destination": {
    "type": "BUSINESS_ID",
    "identifier": "business_67890"
  },
  "amount": {
    "currency": "USD",
    "value": 10000.00
  },
  "transactionType": "B2B",
  "channel": "API"
}
```

### Response

```json
{
  "transactionId": "txn_1699012620",
  "status": "COMPLETED",
  "message": "Payment successful"
}
```
