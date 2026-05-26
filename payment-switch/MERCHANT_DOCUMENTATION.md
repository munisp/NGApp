# Payment Switch - Merchant Documentation

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [Creating Payment Sessions](#creating-payment-sessions)
4. [Handling Webhooks](#handling-webhooks)
5. [Processing Refunds](#processing-refunds)
6. [Security Best Practices](#security-best-practices)
7. [Testing](#testing)
8. [API Reference](#api-reference)

---

## Getting Started

### Prerequisites

- A Payment Switch merchant account
- API credentials (API Key and API Secret)
- HTTPS-enabled website for production webhooks

### Quick Start

1. **Create a merchant account** via the dashboard
2. **Get your API credentials** from the Settings page
3. **Create a payment session** using the API
4. **Redirect customers** to the hosted checkout page
5. **Handle webhook notifications** for payment status updates

---

## Authentication

All API requests must be authenticated using your API key.

### API Key Authentication

Include your API key in the request headers:

```http
POST /api/payment/create
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

### Security Notes

- Never expose your API secret in client-side code
- Rotate your API credentials regularly
- Use environment variables to store credentials
- Implement IP whitelisting for additional security

---

## Creating Payment Sessions

### Basic Payment Session

```javascript
const response = await fetch('https://your-domain.com/api/payment/create', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    amount: 10000, // Amount in cents ($100.00)
    currency: 'USD',
    description: 'Order #12345',
    customerEmail: 'customer@example.com',
    customerName: 'John Doe',
    successUrl: 'https://yoursite.com/success',
    cancelUrl: 'https://yoursite.com/cancel',
    metadata: {
      orderId: '12345',
      customField: 'value'
    }
  })
});

const { sessionId, checkoutUrl } = await response.json();

// Redirect customer to checkout
window.location.href = checkoutUrl;
```

### Using the Embeddable Checkout

```html
<!-- Include the checkout script -->
<script src="https://your-domain.com/checkout.js"></script>

<!-- Initialize checkout -->
<script>
  PaymentSwitch.init({
    apiKey: 'YOUR_API_KEY',
    sessionId: 'SESSION_ID',
    mode: 'modal', // or 'redirect'
    onSuccess: function(result) {
      console.log('Payment successful!', result);
      // Handle success
    },
    onError: function(error) {
      console.error('Payment failed:', error);
      // Handle error
    },
    onCancel: function() {
      console.log('Payment cancelled');
      // Handle cancellation
    }
  });
</script>
```

### Payment Session Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | integer | Yes | Amount in smallest currency unit (cents) |
| `currency` | string | Yes | 3-letter ISO currency code (e.g., USD) |
| `description` | string | No | Payment description |
| `customerEmail` | string | No | Customer's email address |
| `customerName` | string | No | Customer's full name |
| `customerPhone` | string | No | Customer's phone number |
| `successUrl` | string | Yes | URL to redirect after successful payment |
| `cancelUrl` | string | Yes | URL to redirect if payment is cancelled |
| `metadata` | object | No | Custom key-value pairs for your reference |

---

## Handling Webhooks

Webhooks notify your server about payment events in real-time.

### Setting Up Webhooks

1. Navigate to **Settings → Webhooks** in your dashboard
2. Click **Add Webhook Endpoint**
3. Enter your webhook URL (must be HTTPS)
4. Select the events you want to receive
5. Save and note your webhook secret

### Webhook Events

- `payment.created` - Payment session created
- `payment.completed` - Payment successfully completed
- `payment.failed` - Payment failed
- `payment.refunded` - Payment refunded
- `payment.disputed` - Payment disputed by customer

### Webhook Payload Example

```json
{
  "event": "payment.completed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "transactionId": "txn_abc123",
    "sessionId": "sess_xyz789",
    "amount": 10000,
    "currency": "USD",
    "status": "completed",
    "paymentMethod": "card",
    "cardLast4": "4242",
    "cardBrand": "visa",
    "customerEmail": "customer@example.com",
    "metadata": {
      "orderId": "12345"
    }
  }
}
```

### Verifying Webhook Signatures

Always verify webhook signatures to ensure requests are from Payment Switch:

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Express.js example
app.post('/webhooks/payment', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = req.body;
  
  if (!verifyWebhookSignature(payload, signature, WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process webhook
  const { event, data } = payload;
  
  switch (event) {
    case 'payment.completed':
      // Update order status
      break;
    case 'payment.failed':
      // Handle failure
      break;
    // ... handle other events
  }
  
  res.status(200).send('OK');
});
```

### Webhook Best Practices

- **Respond quickly**: Return 200 OK within 5 seconds
- **Process asynchronously**: Queue webhook processing for later
- **Handle duplicates**: Use `transactionId` to detect duplicate events
- **Implement retries**: We retry failed webhooks up to 3 times
- **Monitor failures**: Check webhook logs in your dashboard

---

## Processing Refunds

### Full Refund

```javascript
const response = await fetch('https://your-domain.com/api/refund/create', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    transactionId: 'txn_abc123',
    reason: 'Customer request'
  })
});

const { refundId, status } = await response.json();
```

### Partial Refund

```javascript
const response = await fetch('https://your-domain.com/api/refund/create', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    transactionId: 'txn_abc123',
    amount: 5000, // Refund $50.00 of a $100.00 transaction
    reason: 'Partial refund'
  })
});
```

### Refund Limitations

- Refunds can only be processed on completed payments
- Maximum refund amount is the original transaction amount
- Refunds typically process within 5-10 business days
- Some payment methods may not support instant refunds

---

## Security Best Practices

### PCI DSS Compliance

Payment Switch is PCI DSS Level 1 compliant. Follow these guidelines:

- **Never store full card numbers** - We handle all card data
- **Use HTTPS** - Always use secure connections
- **Validate input** - Sanitize all user inputs
- **Implement CSP** - Use Content Security Policy headers
- **Monitor transactions** - Review unusual activity regularly

### Fraud Prevention

- Enable **3D Secure** for card payments (automatic)
- Monitor **fraud scores** in transaction details
- Set **velocity limits** to prevent abuse
- Use **address verification** (AVS) when available
- Implement **device fingerprinting**

### Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **100 requests per 15 minutes** per IP address
- **1000 requests per hour** per API key
- Rate limit headers included in responses:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

---

## Testing

### Test Mode

Use test API credentials for development:

- Test API Key: `pk_test_...`
- Test API Secret: `sk_test_...`

### Test Card Numbers

| Card Number | Brand | Behavior |
|-------------|-------|----------|
| 4242 4242 4242 4242 | Visa | Success |
| 4000 0000 0000 0002 | Visa | Declined |
| 4000 0000 0000 3220 | Visa | 3D Secure required |
| 5555 5555 5555 4444 | Mastercard | Success |
| 3782 822463 10005 | Amex | Success |

### Test Scenarios

```javascript
// Successful payment
{
  cardNumber: '4242424242424242',
  cardExpiry: '12/25',
  cardCvc: '123'
}

// Declined payment
{
  cardNumber: '4000000000000002',
  cardExpiry: '12/25',
  cardCvc: '123'
}

// 3D Secure authentication
{
  cardNumber: '4000000000003220',
  cardExpiry: '12/25',
  cardCvc: '123'
}
```

---

## API Reference

### Endpoints

#### Create Payment Session
```
POST /api/payment/create
```

#### Get Payment Status
```
GET /api/payment/:sessionId
```

#### Process Refund
```
POST /api/refund/create
```

#### List Transactions
```
GET /api/transactions?limit=50&offset=0
```

#### Get Transaction Details
```
GET /api/transaction/:transactionId
```

### Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid API key |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

### Error Handling

```javascript
try {
  const response = await createPaymentSession(data);
  // Handle success
} catch (error) {
  if (error.status === 400) {
    // Invalid request parameters
  } else if (error.status === 401) {
    // Authentication failed
  } else if (error.status === 429) {
    // Rate limit exceeded - retry after delay
  } else {
    // Other error
  }
}
```

---

## Support

- **Documentation**: https://docs.paymentswitch.com
- **API Status**: https://status.paymentswitch.com
- **Support Email**: support@paymentswitch.com
- **Developer Chat**: Available in the Developer Portal

---

## Changelog

### Version 1.0.0 (2024-01-15)
- Initial release
- Support for card payments
- 3D Secure authentication
- Webhook notifications
- Refund processing
- Analytics dashboard
