# Payment Switch JavaScript SDK

A lightweight, modern JavaScript SDK for integrating Payment Switch checkout into your website. Supports both vanilla JavaScript and React.

## Features

- 🚀 **Simple Integration** - Get started in minutes
- 💳 **Multiple Checkout Modes** - Redirect or modal checkout
- ⚛️ **React Components** - Pre-built components for React apps
- 📱 **Responsive** - Works on all devices
- 🔒 **Secure** - PCI DSS compliant
- 📦 **Lightweight** - < 10KB gzipped
- 🎨 **Customizable** - Style to match your brand

## Installation

### NPM

```bash
npm install @payment-switch/js-sdk
```

### Yarn

```bash
yarn add @payment-switch/js-sdk
```

### CDN

```html
<script src="https://cdn.payment-switch.com/js-sdk/v1/payment-switch.js"></script>
```

## Quick Start

### Vanilla JavaScript

```html
<!DOCTYPE html>
<html>
<head>
  <title>Checkout</title>
</head>
<body>
  <button id="checkout-btn">Pay $50.00</button>

  <script src="https://cdn.payment-switch.com/js-sdk/v1/payment-switch.js"></script>
  <script>
    const paymentSwitch = new PaymentSwitch({
      apiKey: 'pk_test_your_api_key_here'
    });

    document.getElementById('checkout-btn').addEventListener('click', async () => {
      await paymentSwitch.checkout({
        amount: 5000, // $50.00 in cents
        currency: 'USD',
        description: 'Product Purchase',
        customerEmail: 'customer@example.com'
      });
    });
  </script>
</body>
</html>
```

### React

```tsx
import { PaymentButton } from '@payment-switch/js-sdk/react';
import { createPaymentSwitch } from '@payment-switch/js-sdk';

const paymentSwitch = createPaymentSwitch({
  apiKey: 'pk_test_your_api_key_here'
});

function App() {
  return (
    <PaymentButton
      paymentSwitch={paymentSwitch}
      sessionOptions={{
        amount: 5000,
        currency: 'USD',
        description: 'Product Purchase'
      }}
      onSuccess={(sessionId) => alert('Payment successful!')}
    >
      Pay $50.00
    </PaymentButton>
  );
}
```

## API Reference

### PaymentSwitch Class

#### Constructor

```typescript
new PaymentSwitch(config: PaymentSwitchConfig)
```

**Parameters:**
- `config.apiKey` (string, required) - Your Payment Switch API key
- `config.baseUrl` (string, optional) - Custom base URL (default: production URL)

#### Methods

##### createSession

Create a payment session.

```typescript
await paymentSwitch.createSession(options: CreateSessionOptions): Promise<PaymentSession>
```

**Parameters:**
- `amount` (number, required) - Amount in smallest currency unit (cents)
- `currency` (string, optional) - Currency code (default: 'USD')
- `description` (string, optional) - Payment description
- `customerEmail` (string, optional) - Customer email
- `customerName` (string, optional) - Customer name
- `customerPhone` (string, optional) - Customer phone
- `merchantReference` (string, optional) - Your internal reference
- `successUrl` (string, optional) - Redirect URL after success
- `cancelUrl` (string, optional) - Redirect URL after cancellation
- `metadata` (object, optional) - Custom metadata

**Returns:**
```typescript
{
  sessionId: string;
  checkoutUrl: string;
  expiresAt: string;
}
```

##### redirectToCheckout

Redirect to the checkout page.

```typescript
paymentSwitch.redirectToCheckout(sessionId: string): void
```

##### checkout

Create a session and redirect in one step.

```typescript
await paymentSwitch.checkout(options: CreateSessionOptions): Promise<void>
```

##### openCheckoutModal

Open checkout in a modal.

```typescript
paymentSwitch.openCheckoutModal(options: CheckoutOptions): void
```

**Parameters:**
- `sessionId` (string, required) - Payment session ID
- `onSuccess` (function, optional) - Called when payment succeeds
- `onCancel` (function, optional) - Called when payment is cancelled
- `onError` (function, optional) - Called when an error occurs

##### getSession

Get session details.

```typescript
await paymentSwitch.getSession(sessionId: string): Promise<Session>
```

## React Components

### PaymentButton

A button that creates a payment session and redirects or opens a modal.

```tsx
import { PaymentButton } from '@payment-switch/js-sdk/react';

<PaymentButton
  paymentSwitch={paymentSwitch}
  sessionOptions={{
    amount: 5000,
    currency: 'USD',
    description: 'Product Purchase'
  }}
  mode="modal" // or "redirect"
  onSuccess={(sessionId) => console.log('Success:', sessionId)}
  onCancel={() => console.log('Cancelled')}
  onError={(error) => console.error('Error:', error)}
>
  Pay Now
</PaymentButton>
```

### CheckoutForm

A form that collects payment details.

```tsx
import { CheckoutForm } from '@payment-switch/js-sdk/react';

<CheckoutForm
  paymentSwitch={paymentSwitch}
  mode="modal"
  defaultAmount={99.99}
  defaultCurrency="USD"
  onSuccess={(sessionId) => console.log('Success:', sessionId)}
/>
```

### usePaymentSwitch Hook

A React hook for using Payment Switch.

```tsx
import { usePaymentSwitch } from '@payment-switch/js-sdk/react';

function MyComponent() {
  const { checkout, openModal, loading, error } = usePaymentSwitch({
    apiKey: 'pk_test_your_api_key_here'
  });

  const handleCheckout = async () => {
    await checkout({
      amount: 5000,
      currency: 'USD',
      description: 'Product Purchase'
    });
  };

  return (
    <button onClick={handleCheckout} disabled={loading}>
      {loading ? 'Processing...' : 'Pay Now'}
    </button>
  );
}
```

## Examples

### Redirect Checkout

```javascript
const paymentSwitch = new PaymentSwitch({
  apiKey: 'pk_test_your_api_key_here'
});

await paymentSwitch.checkout({
  amount: 5000,
  currency: 'USD',
  description: 'Product Purchase',
  successUrl: 'https://yoursite.com/success',
  cancelUrl: 'https://yoursite.com/cancel'
});
```

### Modal Checkout

```javascript
const session = await paymentSwitch.createSession({
  amount: 5000,
  currency: 'USD',
  description: 'Product Purchase'
});

paymentSwitch.openCheckoutModal({
  sessionId: session.sessionId,
  onSuccess: (sessionId) => {
    alert('Payment successful!');
  },
  onCancel: () => {
    alert('Payment cancelled');
  }
});
```

### Custom Metadata

```javascript
await paymentSwitch.checkout({
  amount: 5000,
  currency: 'USD',
  description: 'Product Purchase',
  metadata: {
    product_id: 'prod_123',
    quantity: 2,
    custom_field: 'value'
  }
});
```

### E-commerce Integration

```javascript
// Add to cart button
document.getElementById('buy-btn').addEventListener('click', async () => {
  const quantity = document.getElementById('quantity').value;
  const pricePerUnit = 2999; // $29.99
  
  await paymentSwitch.checkout({
    amount: pricePerUnit * quantity,
    currency: 'USD',
    description: `Product Purchase (Qty: ${quantity})`,
    customerEmail: document.getElementById('email').value,
    metadata: {
      product_id: 'prod_123',
      quantity: quantity
    }
  });
});
```

## Testing

Use test API keys for development:

```javascript
const paymentSwitch = new PaymentSwitch({
  apiKey: 'pk_test_...' // Test API key
});
```

Test cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers

## TypeScript

The SDK is written in TypeScript and includes type definitions.

```typescript
import { PaymentSwitch, CreateSessionOptions, PaymentSession } from '@payment-switch/js-sdk';

const options: CreateSessionOptions = {
  amount: 5000,
  currency: 'USD',
  description: 'Product Purchase'
};

const session: PaymentSession = await paymentSwitch.createSession(options);
```

## Security

- Never expose your secret API key in client-side code
- Always use HTTPS in production
- Validate webhooks on your server
- Use test keys for development

## Support

- Documentation: https://docs.payment-switch.com
- Email: support@payment-switch.com
- GitHub: https://github.com/payment-switch/js-sdk

## License

MIT
