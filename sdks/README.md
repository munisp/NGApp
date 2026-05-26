# Payment Switch SDKs

Official SDKs for integrating with the Payment Switch platform.

## 📦 Available SDKs

### 1. JavaScript/TypeScript SDK
**Platform:** Web (Browser & Node.js)  
**Location:** [payment-switch-js-sdk](./payment-switch-js-sdk/)

**Features:**
- Full TypeScript support with type definitions
- Promise-based async/await API
- Comprehensive error handling
- Webhook signature verification
- Works in both browser and Node.js environments

**Installation:**
```bash
npm install @paymentswitch/js-sdk
```

**Quick Start:**
```typescript
import PaymentSwitch from '@paymentswitch/js-sdk';

const ps = new PaymentSwitch({
  apiKey: 'your-api-key',
  environment: 'sandbox' // or 'production'
});

// Create a payment
const payment = await ps.payments.create({
  amount: 10000,
  currency: 'NGN',
  email: 'customer@example.com'
});
```

---

### 2. Android/Kotlin SDK
**Platform:** Android  
**Location:** [payment-switch-kotlin-sdk](./payment-switch-kotlin-sdk/)

**Features:**
- Native Android integration
- Kotlin coroutines support
- Built-in checkout UI
- Secure payment handling
- Lifecycle-aware components

**Installation:**
```gradle
dependencies {
    implementation 'com.paymentswitch:android-sdk:1.0.0'
}
```

**Quick Start:**
```kotlin
val paymentSwitch = PaymentSwitch(
    apiKey = "your-api-key",
    environment = Environment.SANDBOX
)

// Launch checkout
paymentSwitch.checkout(
    activity = this,
    amount = 10000,
    currency = "NGN",
    email = "customer@example.com"
)
```

---

### 3. iOS/Swift SDK
**Platform:** iOS  
**Location:** [payment-switch-swift-sdk](./payment-switch-swift-sdk/)

**Features:**
- Native iOS integration
- Swift async/await support
- Built-in checkout UI
- Secure payment handling
- SwiftUI and UIKit support

**Installation:**
```swift
// Package.swift
dependencies: [
    .package(url: "https://github.com/paymentswitch/swift-sdk.git", from: "1.0.0")
]
```

**Quick Start:**
```swift
let paymentSwitch = PaymentSwitch(
    apiKey: "your-api-key",
    environment: .sandbox
)

// Launch checkout
paymentSwitch.checkout(
    amount: 10000,
    currency: "NGN",
    email: "customer@example.com"
)
```

---

## 🔑 API Keys

Get your API keys from the [Payment Switch Dashboard](https://dashboard.paymentswitch.com).

**Sandbox Keys:** For testing and development  
**Production Keys:** For live transactions

---

## 🌍 Environments

### Sandbox
- **Base URL:** `https://sandbox-api.paymentswitch.com`
- **Purpose:** Testing and development
- **Test Cards:** Available in documentation

### Production
- **Base URL:** `https://api.paymentswitch.com`
- **Purpose:** Live transactions
- **Real Money:** Yes

---

## 📚 Common Features

All SDKs support:

### Payment Operations
- Create payment
- Verify payment
- Get payment status
- List payments
- Refund payment

### Customer Management
- Create customer
- Update customer
- Get customer
- List customers

### Webhooks
- Signature verification
- Event handling
- Retry logic

### Security
- TLS 1.3 encryption
- API key authentication
- Webhook signature verification
- PCI DSS compliance

---

## 🔐 Security Best Practices

1. **Never expose API keys in client-side code**
   - Use server-side for sensitive operations
   - Only use public keys in mobile/web apps

2. **Verify webhook signatures**
   - Always verify webhook signatures
   - Use provided verification methods

3. **Use HTTPS**
   - Always use HTTPS in production
   - Never send sensitive data over HTTP

4. **Store keys securely**
   - Use environment variables
   - Never commit keys to version control
   - Use secrets management (Vault, AWS Secrets Manager)

---

## 🧪 Testing

### Test Cards

**Successful Payment:**
```
Card Number: 5060990580000217499
Expiry: 12/26
CVV: 123
```

**Failed Payment:**
```
Card Number: 5060990580000217480
Expiry: 12/26
CVV: 123
```

**Insufficient Funds:**
```
Card Number: 5060990580000217481
Expiry: 12/26
CVV: 123
```

### Test Bank Accounts (Nigeria)

**GTBank:**
```
Account Number: 0123456789
Bank Code: 058
```

**Access Bank:**
```
Account Number: 0987654321
Bank Code: 044
```

---

## 📖 Documentation

### SDK-Specific Documentation
- [JavaScript/TypeScript SDK Docs](./payment-switch-js-sdk/README.md)
- [Android/Kotlin SDK Docs](./payment-switch-kotlin-sdk/README.md)
- [iOS/Swift SDK Docs](./payment-switch-swift-sdk/README.md)

### API Documentation
- [API Reference](../docs/api/api_specifications.md)
- [API Examples](../docs/api/API_EXAMPLES.md)
- [Remittance API](../docs/api/REMITTANCE_API_SPECIFICATION.md)

### Integration Guides
- [Complete Implementation Guide](../docs/guides/COMPLETE_IMPLEMENTATION_GUIDE.md)
- [Client Platform Guide](../docs/guides/CLIENT_PLATFORM_GUIDE.md)
- [Security Guide](../docs/security/SECURITY_IMPLEMENTATION_GUIDE.md)

---

## 🐛 Troubleshooting

### Common Issues

**1. "Invalid API Key"**
- Check if you're using the correct environment (sandbox vs production)
- Verify API key is not expired
- Ensure no extra spaces in the key

**2. "Payment Failed"**
- Check if you're using valid test cards in sandbox
- Verify amount is within limits
- Check if currency is supported

**3. "Webhook Not Received"**
- Verify webhook URL is publicly accessible
- Check webhook signature verification
- Review webhook logs in dashboard

### Getting Help

- **Documentation:** [docs.paymentswitch.com](https://docs.paymentswitch.com)
- **Support Email:** support@paymentswitch.com
- **GitHub Issues:** [github.com/paymentswitch/sdks](https://github.com/paymentswitch/sdks)
- **Slack Community:** [paymentswitch.slack.com](https://paymentswitch.slack.com)

---

## 🔄 Changelog

### Version 1.0.0 (Current)
- Initial release
- Payment operations
- Customer management
- Webhook support
- Crypto remittance support

---

## 📄 License

Copyright © 2024 Payment Switch. All rights reserved.

See individual SDK directories for specific license information.

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../CONTRIBUTING.md) for details.

---

## 🎯 Roadmap

### Upcoming Features
- [ ] Recurring payments
- [ ] Subscription management
- [ ] Split payments
- [ ] Multi-currency support
- [ ] Advanced fraud detection
- [ ] Real-time analytics

---

## 📞 Support

For technical support:
- **Email:** developers@paymentswitch.com
- **Phone:** +234 (0) 1 234 5678
- **Hours:** Monday - Friday, 9am - 6pm WAT

For sales inquiries:
- **Email:** sales@paymentswitch.com
- **Phone:** +234 (0) 1 234 5679
