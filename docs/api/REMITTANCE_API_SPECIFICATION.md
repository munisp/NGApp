# Crypto Remittance Integration - API Specification

## Overview

Complete API specification for integrating crypto-to-fiat remittance functionality with Payment Switch platform for USA→Nigeria corridor with four last-mile delivery options.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Core Remittance APIs](#core-remittance-apis)
3. [Crypto Exchange Integration](#crypto-exchange-integration)
4. [Bank Account APIs](#bank-account-apis)
5. [Agent Banking APIs](#agent-banking-apis)
6. [Bill Payment APIs](#bill-payment-apis)
7. [Webhooks](#webhooks)
8. [Error Handling](#error-handling)
9. [Rate Limiting](#rate-limiting)
10. [Testing](#testing)

---

## Authentication

All API requests require Bearer token authentication.

```http
Authorization: Bearer {api_key}
Content-Type: application/json
```

**Obtain API Key:**
```bash
POST /api/auth/register
{
  "businessName": "RemitCrypto Inc",
  "email": "api@remitcrypto.com",
  "country": "US"
}

Response:
{
  "apiKey": "pk_live_abc123...",
  "secretKey": "sk_live_xyz789..."
}
```

---

## Core Remittance APIs

### 1. Initiate Remittance

Create a new remittance transaction.

```http
POST /api/v1/remittances
```

**Request Body:**
```json
{
  "senderCurrency": "USDC",
  "senderAmount": 500,
  "recipientPhone": "+2348012345678",
  "recipientCountry": "NG",
  "deliveryOption": "NEW_ACCOUNT" | "EXISTING_ACCOUNT" | "AGENT_CASH" | "PAY_BILLS",
  "metadata": {
    "senderName": "John Smith",
    "senderEmail": "john@example.com",
    "purpose": "Family support"
  }
}
```

**Response:**
```json
{
  "remittanceId": "rem_abc123",
  "status": "pending_recipient_info",
  "senderAmount": 500,
  "senderCurrency": "USDC",
  "estimatedRecipientAmount": 771900,
  "recipientCurrency": "NGN",
  "exchangeRate": 1550,
  "fees": {
    "cryptoExchangeFee": 2,
    "platformFee": 5,
    "totalFees": 7
  },
  "expiresAt": "2024-01-12T10:00:00Z",
  "nextStep": {
    "action": "collect_recipient_kyc",
    "url": "https://remit.example.com/kyc/rem_abc123"
  }
}
```

### 2. Get Remittance Status

```http
GET /api/v1/remittances/{remittanceId}
```

**Response:**
```json
{
  "remittanceId": "rem_abc123",
  "status": "completed",
  "timeline": [
    {
      "status": "initiated",
      "timestamp": "2024-01-05T10:00:00Z"
    },
    {
      "status": "crypto_converted",
      "timestamp": "2024-01-05T10:01:30Z"
    },
    {
      "status": "account_opened",
      "timestamp": "2024-01-05T10:05:00Z"
    },
    {
      "status": "funds_deposited",
      "timestamp": "2024-01-05T10:06:00Z"
    },
    {
      "status": "completed",
      "timestamp": "2024-01-05T10:06:30Z"
    }
  ],
  "deliveryDetails": {
    "method": "NEW_ACCOUNT",
    "bankName": "Access Bank",
    "accountNumber": "0123456789",
    "accountName": "Jane Doe"
  }
}
```

### 3. Get Exchange Rate Quote

```http
GET /api/v1/rates/quote?from=USDC&to=NGN&amount=500
```

**Response:**
```json
{
  "fromCurrency": "USDC",
  "toCurrency": "NGN",
  "fromAmount": 500,
  "toAmount": 771900,
  "exchangeRate": 1550,
  "fees": 7,
  "validUntil": "2024-01-05T10:15:00Z"
}
```

---

## Crypto Exchange Integration

### Supported Exchanges

- Coinbase Commerce
- Binance Pay
- Circle (USDC)
- Kraken

### 1. Convert Crypto to Fiat

```http
POST /api/v1/crypto/convert
```

**Request:**
```json
{
  "fromCurrency": "USDC",
  "fromAmount": 500,
  "toCurrency": "NGN",
  "remittanceId": "rem_abc123"
}
```

**Response:**
```json
{
  "conversionId": "conv_xyz789",
  "status": "completed",
  "fromAmount": 500,
  "fromCurrency": "USDC",
  "toAmount": 771900,
  "toCurrency": "NGN",
  "exchangeRate": 1550,
  "fees": 2,
  "completedAt": "2024-01-05T10:01:30Z"
}
```

---

## Bank Account APIs

### 1. Open New Bank Account

```http
POST /api/v1/accounts/open
```

**Request:**
```json
{
  "remittanceId": "rem_abc123",
  "recipientPhone": "+2348012345678",
  "kycData": {
    "firstName": "Jane",
    "lastName": "Doe",
    "bvn": "12345678901",
    "dateOfBirth": "1990-05-15",
    "address": "123 Lagos Street, Lagos",
    "idType": "NIN",
    "idNumber": "12345678901234",
    "photoUrl": "https://storage.example.com/kyc/photo.jpg"
  },
  "preferredBank": "ACCESS_BANK" | "GTB" | "ZENITH" | "FIRST_BANK"
}
```

**Response:**
```json
{
  "accountId": "acc_123",
  "accountNumber": "0123456789",
  "bankName": "Access Bank",
  "bankCode": "044",
  "accountName": "Jane Doe",
  "accountType": "SAVINGS",
  "status": "active",
  "createdAt": "2024-01-05T10:05:00Z"
}
```

### 2. Verify Existing Account

```http
POST /api/v1/accounts/verify
```

**Request:**
```json
{
  "accountNumber": "0234567890",
  "bankCode": "058"
}
```

**Response:**
```json
{
  "accountNumber": "0234567890",
  "bankName": "GTBank",
  "accountName": "John Doe",
  "verified": true
}
```

### 3. Deposit to Account

```http
POST /api/v1/transfers/bank
```

**Request:**
```json
{
  "remittanceId": "rem_abc123",
  "accountNumber": "0123456789",
  "bankCode": "044",
  "amount": 771900,
  "currency": "NGN",
  "narration": "Remittance from John Smith"
}
```

**Response:**
```json
{
  "transferId": "txn_def456",
  "status": "completed",
  "reference": "NIP20240105ABC",
  "amount": 771900,
  "currency": "NGN",
  "completedAt": "2024-01-05T10:06:00Z"
}
```

---

## Agent Banking APIs

### 1. Find Nearby Agents

```http
GET /api/v1/agents/nearby?lat=6.5244&lng=3.3792&radius=5000
```

**Response:**
```json
{
  "agents": [
    {
      "agentId": "agt_001",
      "name": "Kudi Agent - Ikeja",
      "network": "KUDI",
      "address": "45 Allen Avenue, Ikeja, Lagos",
      "distance": 800,
      "rating": 4.8,
      "hoursOfOperation": "Mon-Sat 8AM-8PM",
      "coordinates": {
        "lat": 6.5300,
        "lng": 3.3800
      }
    },
    {
      "agentId": "agt_002",
      "name": "Paga Agent - Victoria Island",
      "network": "PAGA",
      "address": "12 Adeola Odeku, VI, Lagos",
      "distance": 1200,
      "rating": 4.9,
      "hoursOfOperation": "Mon-Sun 7AM-10PM",
      "coordinates": {
        "lat": 6.4280,
        "lng": 3.4219
      }
    }
  ]
}
```

### 2. Generate Collection Code

```http
POST /api/v1/agent-collections/create
```

**Request:**
```json
{
  "remittanceId": "rem_abc123",
  "amount": 308450,
  "currency": "NGN",
  "recipientPhone": "+2348012345678",
  "agentId": "agt_001",
  "expiryDays": 7
}
```

**Response:**
```json
{
  "collectionId": "col_789",
  "collectionCode": "456789",
  "qrCodeUrl": "https://api.example.com/qr/456789.png",
  "amount": 308450,
  "currency": "NGN",
  "agentName": "Kudi Agent - Ikeja",
  "expiresAt": "2024-01-12T10:00:00Z",
  "instructions": "Show this code and valid ID to the agent to collect cash"
}
```

### 3. Verify Collection Code (Agent-side)

```http
POST /api/v1/agent-collections/verify
```

**Request:**
```json
{
  "collectionCode": "456789",
  "agentId": "agt_001",
  "recipientIdType": "NIN",
  "recipientIdNumber": "12345678901234"
}
```

**Response:**
```json
{
  "collectionId": "col_789",
  "status": "approved",
  "amount": 308450,
  "currency": "NGN",
  "recipientName": "Jane Doe",
  "recipientPhone": "+2348012345678",
  "instructions": "Disburse ₦308,450 cash to recipient"
}
```

### 4. Complete Disbursement

```http
POST /api/v1/agent-collections/complete
```

**Request:**
```json
{
  "collectionId": "col_789",
  "agentId": "agt_001",
  "disbursedAmount": 308450,
  "receiptPhotoUrl": "https://storage.example.com/receipts/col_789.jpg"
}
```

**Response:**
```json
{
  "collectionId": "col_789",
  "status": "completed",
  "disbursedAmount": 308450,
  "agentCommission": 500,
  "completedAt": "2024-01-05T14:30:00Z"
}
```

---

## Bill Payment APIs

### 1. Get Available Billers

```http
GET /api/v1/bills/categories
```

**Response:**
```json
{
  "categories": [
    {
      "category": "ELECTRICITY",
      "billers": [
        {"code": "PHCN_EKEDC", "name": "Eko Electricity (EKEDC)"},
        {"code": "PHCN_IKEDC", "name": "Ikeja Electric (IKEDC)"},
        {"code": "PHCN_IBEDC", "name": "Ibadan Electricity (IBEDC)"}
      ]
    },
    {
      "category": "CABLE_TV",
      "billers": [
        {"code": "DSTV", "name": "DSTV"},
        {"code": "GOTV", "name": "GOtv"},
        {"code": "STARTIMES", "name": "StarTimes"}
      ]
    },
    {
      "category": "MOBILE_AIRTIME",
      "billers": [
        {"code": "MTN", "name": "MTN Nigeria"},
        {"code": "AIRTEL", "name": "Airtel Nigeria"},
        {"code": "GLO", "name": "Globacom"},
        {"code": "9MOBILE", "name": "9mobile"}
      ]
    },
    {
      "category": "INTERNET",
      "billers": [
        {"code": "SPECTRANET", "name": "Spectranet"},
        {"code": "SMILE", "name": "Smile Communications"}
      ]
    }
  ]
}
```

### 2. Fetch Bill Amount

```http
POST /api/v1/bills/fetch
```

**Request:**
```json
{
  "billerCode": "PHCN_EKEDC",
  "customerIdentifier": "1234567890"
}
```

**Response:**
```json
{
  "billerCode": "PHCN_EKEDC",
  "billerName": "Eko Electricity (EKEDC)",
  "customerName": "Jane Doe",
  "customerIdentifier": "1234567890",
  "outstandingAmount": 45000,
  "currency": "NGN",
  "dueDate": "2024-01-10"
}
```

### 3. Pay Bill

```http
POST /api/v1/bills/pay
```

**Request:**
```json
{
  "remittanceId": "rem_abc123",
  "billerCode": "PHCN_EKEDC",
  "customerIdentifier": "1234567890",
  "amount": 45000,
  "currency": "NGN"
}
```

**Response:**
```json
{
  "paymentId": "pay_123",
  "status": "completed",
  "billerCode": "PHCN_EKEDC",
  "amount": 45000,
  "currency": "NGN",
  "reference": "PHCN20240105",
  "token": "1234-5678-9012-3456",
  "completedAt": "2024-01-05T10:07:00Z"
}
```

### 4. Purchase Airtime

```http
POST /api/v1/airtime/purchase
```

**Request:**
```json
{
  "remittanceId": "rem_abc123",
  "network": "MTN",
  "phoneNumber": "+2348012345678",
  "amount": 10000,
  "currency": "NGN"
}
```

**Response:**
```json
{
  "purchaseId": "air_456",
  "status": "completed",
  "network": "MTN",
  "phoneNumber": "+2348012345678",
  "amount": 10000,
  "currency": "NGN",
  "completedAt": "2024-01-05T10:08:00Z"
}
```

---

## Webhooks

Configure webhook URLs to receive real-time updates.

### Webhook Events

- `remittance.initiated`
- `remittance.crypto_converted`
- `remittance.account_opened`
- `remittance.funds_deposited`
- `remittance.collection_code_generated`
- `remittance.cash_collected`
- `remittance.bill_paid`
- `remittance.completed`
- `remittance.failed`

### Webhook Payload Example

```json
{
  "event": "remittance.completed",
  "timestamp": "2024-01-05T10:06:30Z",
  "data": {
    "remittanceId": "rem_abc123",
    "status": "completed",
    "senderAmount": 500,
    "senderCurrency": "USDC",
    "recipientAmount": 771900,
    "recipientCurrency": "NGN",
    "deliveryMethod": "NEW_ACCOUNT",
    "deliveryDetails": {
      "bankName": "Access Bank",
      "accountNumber": "0123456789"
    }
  }
}
```

### Webhook Verification

All webhooks include a signature header for verification:

```
X-Webhook-Signature: sha256=abc123...
```

**Verify signature:**
```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return `sha256=${expectedSignature}` === signature;
}
```

---

## Error Handling

### Standard Error Response

```json
{
  "error": {
    "code": "insufficient_funds",
    "message": "Insufficient funds in escrow account",
    "details": {
      "required": 771900,
      "available": 500000
    }
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `invalid_request` | 400 | Malformed request |
| `unauthorized` | 401 | Invalid API key |
| `forbidden` | 403 | Insufficient permissions |
| `not_found` | 404 | Resource not found |
| `rate_limit_exceeded` | 429 | Too many requests |
| `insufficient_funds` | 400 | Not enough balance |
| `kyc_failed` | 400 | KYC verification failed |
| `account_not_found` | 404 | Bank account doesn't exist |
| `agent_unavailable` | 503 | Agent network down |
| `bill_payment_failed` | 500 | Biller service error |
| `crypto_conversion_failed` | 500 | Exchange error |
| `internal_error` | 500 | Server error |

---

## Rate Limiting

- **Standard tier:** 100 requests/minute
- **Premium tier:** 1,000 requests/minute
- **Enterprise tier:** 10,000 requests/minute

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704456000
```

---

## Testing

### Sandbox Environment

Base URL: `https://sandbox-api.example.com`

### Test API Keys

```
API Key: pk_test_abc123
Secret Key: sk_test_xyz789
```

### Test Crypto Addresses

- **USDC (Ethereum):** `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`
- **BTC:** `tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx`
- **ETH:** `0x71C7656EC7ab88b098defB751B7401B5f6d8976F`

### Test Bank Accounts (Nigeria)

- **Access Bank:** `0123456789` (Always succeeds)
- **GTBank:** `0234567890` (Always succeeds)
- **Test Failure:** `9999999999` (Always fails)

### Test Agent Collection Codes

- **Success:** `111111` (Always succeeds)
- **Expired:** `222222` (Always returns expired)
- **Invalid:** `999999` (Always returns invalid)

### Test Bill Accounts

- **PHCN Meter:** `1234567890` (₦45,000 outstanding)
- **DSTV Smartcard:** `0012345678` (Premium package)
- **MTN Phone:** `+2348012345678` (Active)

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import { RemittanceClient } from '@payment-switch/remittance-sdk';

const client = new RemittanceClient({
  apiKey: 'pk_live_abc123',
  environment: 'production'
});

// Initiate remittance
const remittance = await client.remittances.create({
  senderCurrency: 'USDC',
  senderAmount: 500,
  recipientPhone: '+2348012345678',
  recipientCountry: 'NG',
  deliveryOption: 'NEW_ACCOUNT'
});

console.log(`Remittance ID: ${remittance.remittanceId}`);
console.log(`Status: ${remittance.status}`);
console.log(`Estimated amount: ₦${remittance.estimatedRecipientAmount}`);

// Check status
const status = await client.remittances.get(remittance.remittanceId);
console.log(`Current status: ${status.status}`);
```

### Python

```python
from payment_switch import RemittanceClient

client = RemittanceClient(
    api_key='pk_live_abc123',
    environment='production'
)

# Initiate remittance
remittance = client.remittances.create(
    sender_currency='USDC',
    sender_amount=500,
    recipient_phone='+2348012345678',
    recipient_country='NG',
    delivery_option='NEW_ACCOUNT'
)

print(f"Remittance ID: {remittance.remittance_id}")
print(f"Status: {remittance.status}")
print(f"Estimated amount: ₦{remittance.estimated_recipient_amount}")

# Check status
status = client.remittances.get(remittance.remittance_id)
print(f"Current status: {status.status}")
```

---

## Support

- **Documentation:** https://docs.payment-switch.com/remittance
- **API Status:** https://status.payment-switch.com
- **Support Email:** support@payment-switch.com
- **Developer Slack:** https://slack.payment-switch.com

---

## Changelog

### v1.0.0 (2024-01-05)
- Initial release
- Support for USA→Nigeria corridor
- Four last-mile delivery options
- Crypto exchange integration (USDC, BTC, ETH)
- Bank account opening via KYC
- Agent banking cash collection
- Bill payment integration
- Webhooks support
