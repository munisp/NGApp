# Payment Switch Merchant Portal - Complete Guide

## Overview

The Payment Switch Merchant Portal is a comprehensive payment gateway solution that enables businesses to accept payments, manage transactions, customize checkout experiences, and integrate payment processing into their applications.

---

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Getting Started](#getting-started)
4. [Merchant Dashboard](#merchant-dashboard)
5. [Payment Gateway Integration](#payment-gateway-integration)
6. [Branding & Customization](#branding--customization)
7. [Analytics & Reporting](#analytics--reporting)
8. [Developer Portal](#developer-portal)
9. [API Reference](#api-reference)
10. [Webhooks](#webhooks)
11. [Security](#security)
12. [Testing](#testing)

---

## Features

### Core Capabilities

**Payment Processing:**
- Multiple payment methods (cards, bank transfers, mobile money, QR codes)
- Real-time transaction processing
- Automatic retry logic for failed payments
- Refund and chargeback management
- Multi-currency support

**Merchant Dashboard:**
- Real-time transaction monitoring
- Revenue analytics and reporting
- Customer management
- Payment method configuration
- Webhook management
- API key generation

**Customization:**
- White-label checkout pages
- Custom branding (logo, colors, fonts)
- Branded email notifications
- Custom success/failure pages
- Localization support

**Developer Tools:**
- RESTful API
- Multiple SDKs (JavaScript, Kotlin, Swift, Python, Java, PHP, Go)
- Comprehensive API documentation
- Sandbox environment for testing
- Webhook event notifications
- API logs and debugging tools

**Security:**
- PCI DSS compliant
- End-to-end encryption
- Fraud detection and prevention
- 3D Secure authentication
- Tokenization for sensitive data
- Role-based access control

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Merchant Portal (Frontend)                │
│  ┌──────────┬──────────┬──────────┬──────────┬───────────┐ │
│  │Dashboard │ Gateway  │ Branding │Analytics │  Developer│ │
│  │          │          │ Settings │          │   Portal  │ │
│  └──────────┴──────────┴──────────┴──────────┴───────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Backend API (tRPC)                        │
│  ┌──────────┬──────────┬──────────┬──────────┬───────────┐ │
│  │ Payment  │Merchant  │ Branding │Analytics │  Webhook  │ │
│  │ Service  │ Service  │ Service  │ Service  │  Service  │ │
│  └──────────┴──────────┴──────────┴──────────┴───────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Database Layer                            │
│  ┌──────────┬──────────┬──────────┬──────────┬───────────┐ │
│  │merchants │ payment  │  trans   │ webhooks │  refunds  │ │
│  │          │ sessions │ actions  │          │           │ │
│  └──────────┴──────────┴──────────┴──────────┴───────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                Payment Core (Backend Services)               │
│  ┌──────────┬──────────┬──────────┬──────────┬───────────┐ │
│  │ Payment  │  Fraud   │ Workflow │Settlement│ TigerBeetle│ │
│  │ Gateway  │Detection │Orchestr. │ Service  │   Ledger  │ │
│  └──────────┴──────────┴──────────┴──────────┴───────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend:**
- React 19 with TypeScript
- Tailwind CSS 4
- shadcn/ui components
- Wouter (routing)
- tRPC React Query
- Recharts (analytics)

**Backend:**
- Node.js with Express
- tRPC 11 (type-safe APIs)
- Drizzle ORM
- PostgreSQL (database)
- TigerBeetle (ledger)
- Redis (caching)

**Infrastructure:**
- Docker & Kubernetes
- Apache APISIX (API gateway)
- Istio (service mesh)
- Prometheus & Grafana (monitoring)

---

## Getting Started

### 1. Access the Merchant Portal

**Production URL:** `https://portal.paymentswitch.example.com`

**Development:**
```bash
cd payment-switch-complete-v2/merchant-portal/web-checkout/
pnpm install
pnpm dev
# Access at http://localhost:3000
```

### 2. Create Merchant Account

1. Navigate to the portal
2. Click "Sign Up" or "Register as Merchant"
3. Complete registration form:
   - Business name
   - Business type (ecommerce, SaaS, marketplace, nonprofit, other)
   - Website URL
   - Contact information
4. Verify email address
5. Complete business verification (if required)

### 3. Get API Credentials

1. Log in to merchant dashboard
2. Navigate to **Settings** → **API Keys**
3. Click **"Generate New API Key"**
4. Save your credentials securely:
   - **API Key**: Used for authentication
   - **API Secret**: Used for webhook signature verification
5. **Important**: API Secret is shown only once!

### 4. Configure Webhooks

1. Go to **Settings** → **Webhooks**
2. Enter your webhook URL (must be HTTPS)
3. Select events to receive:
   - `payment.succeeded`
   - `payment.failed`
   - `payment.pending`
   - `refund.completed`
   - `chargeback.created`
4. Save configuration
5. Test webhook with "Send Test Event" button

---

## Merchant Dashboard

### Overview Page

**Key Metrics:**
- Total revenue (today, this week, this month)
- Transaction count
- Success rate
- Average transaction value
- Active payment methods

**Recent Transactions:**
- Real-time transaction list
- Status indicators (success, pending, failed)
- Quick actions (view details, refund)
- Search and filter capabilities

**Revenue Chart:**
- Line chart showing revenue over time
- Configurable time range (7d, 30d, 90d, 1y)
- Comparison with previous period
- Export to CSV/PDF

### Transactions Page

**Transaction List:**
- Paginated table with all transactions
- Columns: ID, Date, Amount, Customer, Status, Payment Method
- Advanced filters:
  - Date range
  - Status
  - Payment method
  - Amount range
  - Customer email
- Bulk actions (export, refund)

**Transaction Details:**
- Complete transaction information
- Customer details
- Payment method details
- Timeline of events
- Related transactions (refunds, chargebacks)
- Raw API logs

**Actions:**
- Issue full or partial refund
- Download receipt
- Send receipt to customer
- Mark as fraudulent
- Add notes

### Customers Page

**Customer Management:**
- List of all customers
- Customer profiles with transaction history
- Saved payment methods
- Customer lifetime value
- Risk score (fraud detection)

**Customer Details:**
- Contact information
- Transaction history
- Total spend
- Average order value
- Refund history
- Notes and tags

### Payment Methods Page

**Supported Methods:**
- Credit/Debit Cards (Visa, Mastercard, Amex)
- Bank Transfers
- Mobile Money (M-Pesa, Airtel Money, etc.)
- QR Code Payments
- Digital Wallets

**Configuration:**
- Enable/disable payment methods
- Set minimum/maximum amounts
- Configure currency support
- Set processing fees
- Custom labels and descriptions

---

## Payment Gateway Integration

### Integration Methods

#### 1. Hosted Checkout (Easiest)

Redirect customers to Payment Switch hosted checkout page.

**Step 1: Create Payment Session**

```javascript
// Using JavaScript SDK
import PaymentSwitch from '@payment-switch/js-sdk';

const client = new PaymentSwitch('YOUR_API_KEY');

const session = await client.createPaymentSession({
  amount: 10000, // Amount in cents ($100.00)
  currency: 'USD',
  customerEmail: 'customer@example.com',
  successUrl: 'https://yoursite.com/success',
  cancelUrl: 'https://yoursite.com/cancel',
  metadata: {
    orderId: 'order_12345',
    customerId: 'cust_67890'
  }
});

// Redirect customer to checkout
window.location.href = session.checkoutUrl;
```

**Step 2: Handle Redirect**

Customer completes payment and is redirected to your `successUrl` or `cancelUrl`.

**Step 3: Verify Payment (Webhook)**

Receive webhook notification to confirm payment status.

#### 2. Embedded Checkout

Embed checkout form directly in your website.

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.paymentswitch.com/v1/checkout.js"></script>
</head>
<body>
  <div id="payment-checkout"></div>
  
  <script>
    const checkout = PaymentSwitchCheckout.create('YOUR_API_KEY', {
      sessionId: 'sess_abc123',
      container: '#payment-checkout',
      onSuccess: (transaction) => {
        console.log('Payment successful:', transaction);
        window.location.href = '/success';
      },
      onError: (error) => {
        console.error('Payment failed:', error);
      }
    });
  </script>
</body>
</html>
```

#### 3. API Integration (Advanced)

Direct API integration for custom payment flows.

```javascript
// Create payment
const response = await fetch('https://api.paymentswitch.com/v1/payments', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${YOUR_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 10000,
    currency: 'USD',
    paymentMethod: {
      type: 'card',
      card: {
        number: '4111111111111111',
        expMonth: 12,
        expYear: 2025,
        cvc: '123'
      }
    },
    customerEmail: 'customer@example.com',
    metadata: {
      orderId: 'order_12345'
    }
  })
});

const payment = await response.json();
console.log('Payment status:', payment.status);
```

### SDK Integration Examples

**JavaScript/TypeScript:**
```bash
npm install @payment-switch/js-sdk
```

```typescript
import PaymentSwitch from '@payment-switch/js-sdk';

const client = new PaymentSwitch('YOUR_API_KEY');

// Create payment
const payment = await client.createPayment({
  amount: 10000,
  currency: 'USD',
  customerEmail: 'customer@example.com'
});

// Get payment status
const status = await client.getPayment(payment.id);

// Create refund
const refund = await client.createRefund({
  paymentId: payment.id,
  amount: 5000 // Partial refund
});
```

**Kotlin (Android):**
```kotlin
import com.paymentswitch.sdk.PaymentSwitchClient
import kotlinx.coroutines.runBlocking

val client = PaymentSwitchClient("YOUR_API_KEY")

runBlocking {
    val payment = client.createPayment(
        amount = 10000,
        currency = "USD",
        customerEmail = "customer@example.com"
    )
    
    println("Payment ID: ${payment.id}")
    println("Status: ${payment.status}")
}
```

**Swift (iOS):**
```swift
import PaymentSwitchSDK

let client = PaymentSwitchClient(apiKey: "YOUR_API_KEY")

Task {
    let payment = try await client.createPayment(
        amount: 10000,
        currency: "USD",
        customerEmail: "customer@example.com"
    )
    
    print("Payment ID: \(payment.id)")
    print("Status: \(payment.status)")
}
```

**Python:**
```python
from payment_switch import PaymentSwitchClient

client = PaymentSwitchClient("YOUR_API_KEY")

payment = client.create_payment(
    amount=10000,
    currency="USD",
    customer_email="customer@example.com"
)

print(f"Payment ID: {payment.id}")
print(f"Status: {payment.status}")
```

---

## Branding & Customization

### Checkout Customization

**Access:** Dashboard → **Settings** → **Branding**

**Customizable Elements:**

1. **Logo**
   - Upload custom logo (PNG, SVG, JPG)
   - Maximum size: 2MB
   - Recommended dimensions: 200x60px

2. **Colors**
   - Primary color (buttons, links)
   - Secondary color (accents)
   - Background color
   - Text color
   - Error color
   - Success color

3. **Typography**
   - Font family (Google Fonts supported)
   - Font sizes
   - Font weights

4. **Layout**
   - Border radius
   - Button style
   - Input style
   - Card shadows

5. **Custom CSS**
   - Advanced customization with custom CSS

**Preview:**
- Live preview of checkout page
- Test with different payment methods
- Mobile responsive preview

**Example Configuration:**

```json
{
  "logo": "https://yoursite.com/logo.png",
  "primaryColor": "#2563eb",
  "secondaryColor": "#1e40af",
  "backgroundColor": "#ffffff",
  "textColor": "#1f2937",
  "fontFamily": "Inter",
  "borderRadius": "8px"
}
```

### Email Customization

**Receipt Emails:**
- Custom email template
- Include logo and branding
- Configurable footer
- Add custom message

**Notification Emails:**
- Payment success
- Payment failed
- Refund processed
- Chargeback notification

---

## Analytics & Reporting

### Dashboard Analytics

**Revenue Metrics:**
- Total revenue (all time, monthly, weekly, daily)
- Revenue growth rate
- Average transaction value
- Revenue by payment method
- Revenue by currency

**Transaction Metrics:**
- Total transactions
- Success rate
- Failure rate
- Pending transactions
- Refund rate

**Customer Metrics:**
- Total customers
- New customers (period)
- Returning customers
- Customer lifetime value
- Customer acquisition cost

**Performance Metrics:**
- Average processing time
- Peak transaction times
- Payment method popularity
- Geographic distribution

### Reports

**Available Reports:**
1. **Transaction Report**
   - All transactions with filters
   - Export to CSV, Excel, PDF
   - Scheduled email delivery

2. **Revenue Report**
   - Revenue breakdown by period
   - Comparison charts
   - Trend analysis

3. **Refund Report**
   - All refunds with reasons
   - Refund rate analysis
   - Top refunded products

4. **Customer Report**
   - Customer list with metrics
   - Segmentation analysis
   - Cohort analysis

5. **Reconciliation Report**
   - Transaction matching
   - Settlement verification
   - Discrepancy detection

**Export Options:**
- CSV (Excel compatible)
- PDF (formatted report)
- JSON (API integration)

**Scheduling:**
- Daily, weekly, monthly reports
- Email delivery
- Automated generation

---

## Developer Portal

### API Documentation

**Access:** Dashboard → **Developer** → **API Docs**

**Features:**
- Interactive API explorer
- Code examples in multiple languages
- Request/response samples
- Error code reference
- Rate limiting information

### API Keys Management

**Types of Keys:**
1. **Live Keys** - Production environment
2. **Test Keys** - Sandbox environment

**Key Management:**
- Generate new keys
- Rotate keys
- Revoke keys
- View key usage statistics
- Set key permissions

**Best Practices:**
- Rotate keys regularly (every 90 days)
- Use different keys for different environments
- Never commit keys to version control
- Use environment variables
- Implement key rotation without downtime

### Webhooks

**Webhook Events:**

```javascript
// payment.succeeded
{
  "event": "payment.succeeded",
  "data": {
    "id": "pay_abc123",
    "amount": 10000,
    "currency": "USD",
    "status": "succeeded",
    "customerEmail": "customer@example.com",
    "metadata": {
      "orderId": "order_12345"
    },
    "createdAt": "2024-11-04T20:00:00Z"
  }
}

// payment.failed
{
  "event": "payment.failed",
  "data": {
    "id": "pay_def456",
    "amount": 10000,
    "currency": "USD",
    "status": "failed",
    "errorCode": "card_declined",
    "errorMessage": "Your card was declined",
    "createdAt": "2024-11-04T20:00:00Z"
  }
}

// refund.completed
{
  "event": "refund.completed",
  "data": {
    "id": "ref_ghi789",
    "paymentId": "pay_abc123",
    "amount": 5000,
    "status": "completed",
    "createdAt": "2024-11-04T20:00:00Z"
  }
}
```

**Webhook Verification:**

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Express.js example
app.post('/webhooks/payment-switch', express.raw({type: 'application/json'}), (req, res) => {
  const signature = req.headers['x-payment-switch-signature'];
  const payload = req.body;
  
  if (!verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  
  const event = JSON.parse(payload);
  
  // Handle event
  switch (event.event) {
    case 'payment.succeeded':
      // Update order status
      break;
    case 'payment.failed':
      // Notify customer
      break;
    case 'refund.completed':
      // Update accounting
      break;
  }
  
  res.status(200).send('OK');
});
```

### API Logs

**Features:**
- Real-time API request logs
- Request/response inspection
- Error tracking
- Performance metrics
- Search and filter
- Export logs

---

## API Reference

### Authentication

All API requests require authentication via API key in the Authorization header:

```
Authorization: Bearer YOUR_API_KEY
```

### Base URL

**Production:** `https://api.paymentswitch.com/v1`  
**Sandbox:** `https://sandbox-api.paymentswitch.com/v1`

### Endpoints

#### Create Payment Session

```http
POST /payment-sessions
```

**Request:**
```json
{
  "amount": 10000,
  "currency": "USD",
  "customerEmail": "customer@example.com",
  "successUrl": "https://yoursite.com/success",
  "cancelUrl": "https://yoursite.com/cancel",
  "metadata": {
    "orderId": "order_12345"
  }
}
```

**Response:**
```json
{
  "id": "sess_abc123",
  "checkoutUrl": "https://checkout.paymentswitch.com/sess_abc123",
  "status": "pending",
  "expiresAt": "2024-11-04T21:00:00Z"
}
```

#### Create Payment

```http
POST /payments
```

**Request:**
```json
{
  "amount": 10000,
  "currency": "USD",
  "paymentMethod": {
    "type": "card",
    "card": {
      "number": "4111111111111111",
      "expMonth": 12,
      "expYear": 2025,
      "cvc": "123"
    }
  },
  "customerEmail": "customer@example.com"
}
```

**Response:**
```json
{
  "id": "pay_abc123",
  "status": "succeeded",
  "amount": 10000,
  "currency": "USD",
  "createdAt": "2024-11-04T20:00:00Z"
}
```

#### Get Payment

```http
GET /payments/:id
```

**Response:**
```json
{
  "id": "pay_abc123",
  "status": "succeeded",
  "amount": 10000,
  "currency": "USD",
  "paymentMethod": {
    "type": "card",
    "last4": "1111",
    "brand": "visa"
  },
  "customerEmail": "customer@example.com",
  "createdAt": "2024-11-04T20:00:00Z"
}
```

#### Create Refund

```http
POST /refunds
```

**Request:**
```json
{
  "paymentId": "pay_abc123",
  "amount": 5000,
  "reason": "customer_request"
}
```

**Response:**
```json
{
  "id": "ref_ghi789",
  "paymentId": "pay_abc123",
  "amount": 5000,
  "status": "completed",
  "createdAt": "2024-11-04T20:00:00Z"
}
```

#### List Transactions

```http
GET /transactions?limit=100&offset=0&status=succeeded
```

**Response:**
```json
{
  "data": [
    {
      "id": "pay_abc123",
      "amount": 10000,
      "currency": "USD",
      "status": "succeeded",
      "createdAt": "2024-11-04T20:00:00Z"
    }
  ],
  "total": 1,
  "hasMore": false
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `authentication_failed` | Invalid API key |
| `invalid_request` | Missing or invalid parameters |
| `card_declined` | Card was declined by issuer |
| `insufficient_funds` | Insufficient funds in account |
| `expired_card` | Card has expired |
| `invalid_cvc` | Invalid CVC code |
| `processing_error` | Payment processing error |
| `rate_limit_exceeded` | Too many requests |

---

## Security

### PCI DSS Compliance

Payment Switch is PCI DSS Level 1 compliant. When using hosted checkout or embedded checkout, your PCI compliance burden is minimized.

**Best Practices:**
- Never store card numbers
- Use tokenization for recurring payments
- Implement 3D Secure for card payments
- Use HTTPS for all communications
- Validate webhook signatures

### Fraud Prevention

**Built-in Fraud Detection:**
- Machine learning-based risk scoring
- Velocity checks
- Geolocation verification
- Device fingerprinting
- Behavioral analysis

**Merchant Controls:**
- Block/allow lists
- Custom fraud rules
- Manual review queue
- Chargeback management

### Data Security

**Encryption:**
- TLS 1.3 for data in transit
- AES-256 for data at rest
- End-to-end encryption for sensitive data

**Access Control:**
- Role-based access control (RBAC)
- Two-factor authentication (2FA)
- API key permissions
- Audit logs

---

## Testing

### Sandbox Environment

**Access:** Use test API keys (prefix `test_`)

**Sandbox URL:** `https://sandbox.paymentswitch.com`

### Test Cards

**Successful Payment:**
```
Card Number: 4111 1111 1111 1111
Expiry: Any future date
CVC: Any 3 digits
```

**Declined Payment:**
```
Card Number: 4000 0000 0000 0002
Expiry: Any future date
CVC: Any 3 digits
```

**Insufficient Funds:**
```
Card Number: 4000 0000 0000 9995
Expiry: Any future date
CVC: Any 3 digits
```

**3D Secure Required:**
```
Card Number: 4000 0027 6000 3184
Expiry: Any future date
CVC: Any 3 digits
```

### Testing Webhooks

1. Use webhook testing tool in dashboard
2. Send test events to your webhook URL
3. Verify signature validation
4. Check event handling logic

---

## Support

**Documentation:** https://docs.paymentswitch.com  
**API Status:** https://status.paymentswitch.com  
**Support Email:** support@paymentswitch.com  
**Developer Forum:** https://community.paymentswitch.com

---

**Version:** 1.0  
**Last Updated:** November 4, 2024
