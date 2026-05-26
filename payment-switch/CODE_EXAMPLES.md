# Payment Switch - Code Examples

## Table of Contents

1. [Node.js / Express](#nodejs--express)
2. [Python / Flask](#python--flask)
3. [PHP / Laravel](#php--laravel)
4. [React / Next.js](#react--nextjs)
5. [Vue.js](#vuejs)
6. [Ruby on Rails](#ruby-on-rails)

---

## Node.js / Express

### Basic Integration

```javascript
const express = require('express');
const crypto = require('crypto');
const app = express();

app.use(express.json());

// Configuration
const PAYMENT_SWITCH_API_KEY = process.env.PAYMENT_SWITCH_API_KEY;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const API_BASE_URL = 'https://your-domain.com/api';

// Create payment session
app.post('/create-checkout', async (req, res) => {
  try {
    const { amount, orderId, customerEmail } = req.body;

    const response = await fetch(`${API_BASE_URL}/payment/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYMENT_SWITCH_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amount * 100, // Convert to cents
        currency: 'USD',
        description: `Order #${orderId}`,
        customerEmail,
        successUrl: `${req.protocol}://${req.get('host')}/success?order=${orderId}`,
        cancelUrl: `${req.protocol}://${req.get('host')}/cancel`,
        metadata: { orderId }
      })
    });

    const data = await response.json();
    res.json({ checkoutUrl: data.checkoutUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Handle webhook
app.post('/webhooks/payment', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = req.body;

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');

  if (signature !== expectedSignature) {
    return res.status(401).send('Invalid signature');
  }

  // Process webhook
  const { event, data } = payload;

  switch (event) {
    case 'payment.completed':
      // Update order in database
      console.log(`Payment completed for order ${data.metadata.orderId}`);
      break;
    case 'payment.failed':
      console.log(`Payment failed for session ${data.sessionId}`);
      break;
  }

  res.status(200).send('OK');
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

---

## Python / Flask

### Basic Integration

```python
from flask import Flask, request, jsonify
import requests
import hmac
import hashlib
import json
import os

app = Flask(__name__)

# Configuration
PAYMENT_SWITCH_API_KEY = os.environ.get('PAYMENT_SWITCH_API_KEY')
WEBHOOK_SECRET = os.environ.get('WEBHOOK_SECRET')
API_BASE_URL = 'https://your-domain.com/api'

@app.route('/create-checkout', methods=['POST'])
def create_checkout():
    data = request.json
    amount = data['amount']
    order_id = data['orderId']
    customer_email = data['customerEmail']

    # Create payment session
    response = requests.post(
        f'{API_BASE_URL}/payment/create',
        headers={
            'Authorization': f'Bearer {PAYMENT_SWITCH_API_KEY}',
            'Content-Type': 'application/json'
        },
        json={
            'amount': int(amount * 100),  # Convert to cents
            'currency': 'USD',
            'description': f'Order #{order_id}',
            'customerEmail': customer_email,
            'successUrl': f'{request.url_root}success?order={order_id}',
            'cancelUrl': f'{request.url_root}cancel',
            'metadata': {'orderId': order_id}
        }
    )

    return jsonify(response.json())

@app.route('/webhooks/payment', methods=['POST'])
def handle_webhook():
    signature = request.headers.get('X-Webhook-Signature')
    payload = request.get_data()

    # Verify signature
    expected_signature = hmac.new(
        WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()

    if signature != expected_signature:
        return 'Invalid signature', 401

    # Process webhook
    event_data = request.json
    event = event_data['event']
    data = event_data['data']

    if event == 'payment.completed':
        order_id = data['metadata']['orderId']
        print(f'Payment completed for order {order_id}')
        # Update order in database

    elif event == 'payment.failed':
        print(f'Payment failed for session {data["sessionId"]}')

    return 'OK', 200

if __name__ == '__main__':
    app.run(port=3000)
```

---

## PHP / Laravel

### Controller

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PaymentController extends Controller
{
    private $apiKey;
    private $webhookSecret;
    private $apiBaseUrl;

    public function __construct()
    {
        $this->apiKey = env('PAYMENT_SWITCH_API_KEY');
        $this->webhookSecret = env('WEBHOOK_SECRET');
        $this->apiBaseUrl = 'https://your-domain.com/api';
    }

    public function createCheckout(Request $request)
    {
        $validated = $request->validate([
            'amount' => 'required|numeric',
            'orderId' => 'required|string',
            'customerEmail' => 'required|email',
        ]);

        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . $this->apiKey,
            'Content-Type' => 'application/json',
        ])->post($this->apiBaseUrl . '/payment/create', [
            'amount' => $validated['amount'] * 100,
            'currency' => 'USD',
            'description' => 'Order #' . $validated['orderId'],
            'customerEmail' => $validated['customerEmail'],
            'successUrl' => route('payment.success', ['order' => $validated['orderId']]),
            'cancelUrl' => route('payment.cancel'),
            'metadata' => ['orderId' => $validated['orderId']],
        ]);

        return response()->json($response->json());
    }

    public function handleWebhook(Request $request)
    {
        $signature = $request->header('X-Webhook-Signature');
        $payload = $request->getContent();

        // Verify signature
        $expectedSignature = hash_hmac('sha256', $payload, $this->webhookSecret);

        if (!hash_equals($signature, $expectedSignature)) {
            return response('Invalid signature', 401);
        }

        // Process webhook
        $eventData = $request->json()->all();
        $event = $eventData['event'];
        $data = $eventData['data'];

        switch ($event) {
            case 'payment.completed':
                $orderId = $data['metadata']['orderId'];
                Log::info("Payment completed for order {$orderId}");
                // Update order in database
                break;

            case 'payment.failed':
                Log::info("Payment failed for session {$data['sessionId']}");
                break;
        }

        return response('OK', 200);
    }
}
```

### Routes

```php
<?php

use App\Http\Controllers\PaymentController;

Route::post('/create-checkout', [PaymentController::class, 'createCheckout']);
Route::post('/webhooks/payment', [PaymentController::class, 'handleWebhook']);
```

---

## React / Next.js

### Payment Page Component

```typescript
// pages/checkout.tsx
import { useState } from 'react';
import { useRouter } from 'next/router';

export default function CheckoutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheckout = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 100.00,
          orderId: '12345',
          customerEmail: 'customer@example.com',
        }),
      });

      const data = await response.json();

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setError('Failed to create checkout session');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Checkout</h1>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="mb-4">
          <p className="text-lg">Order Total: $100.00</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <button
          onClick={handleCheckout}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Proceed to Payment'}
        </button>
      </div>
    </div>
  );
}
```

### API Route

```typescript
// pages/api/create-checkout.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { amount, orderId, customerEmail } = req.body;

  try {
    const response = await fetch('https://your-domain.com/api/payment/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PAYMENT_SWITCH_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency: 'USD',
        description: `Order #${orderId}`,
        customerEmail,
        successUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/success?order=${orderId}`,
        cancelUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/cancel`,
        metadata: { orderId },
      }),
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
```

---

## Vue.js

### Checkout Component

```vue
<template>
  <div class="checkout-container">
    <h1>Checkout</h1>
    
    <div class="order-summary">
      <p>Order Total: ${{ amount }}</p>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <button 
      @click="handleCheckout" 
      :disabled="loading"
      class="checkout-button"
    >
      {{ loading ? 'Processing...' : 'Proceed to Payment' }}
    </button>
  </div>
</template>

<script>
export default {
  data() {
    return {
      amount: 100.00,
      orderId: '12345',
      customerEmail: 'customer@example.com',
      loading: false,
      error: '',
    };
  },
  methods: {
    async handleCheckout() {
      this.loading = true;
      this.error = '';

      try {
        const response = await fetch('/api/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: this.amount,
            orderId: this.orderId,
            customerEmail: this.customerEmail,
          }),
        });

        const data = await response.json();

        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } else {
          this.error = 'Failed to create checkout session';
        }
      } catch (err) {
        this.error = 'An error occurred';
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
.checkout-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
}

.error-message {
  background-color: #fee;
  border: 1px solid #fcc;
  color: #c00;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.checkout-button {
  background-color: #2563eb;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
}

.checkout-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
```

---

## Ruby on Rails

### Controller

```ruby
# app/controllers/payments_controller.rb
class PaymentsController < ApplicationController
  skip_before_action :verify_authenticity_token, only: [:webhook]

  def create_checkout
    response = HTTParty.post(
      "#{ENV['API_BASE_URL']}/payment/create",
      headers: {
        'Authorization' => "Bearer #{ENV['PAYMENT_SWITCH_API_KEY']}",
        'Content-Type' => 'application/json'
      },
      body: {
        amount: (params[:amount].to_f * 100).to_i,
        currency: 'USD',
        description: "Order ##{params[:orderId]}",
        customerEmail: params[:customerEmail],
        successUrl: success_url(order: params[:orderId]),
        cancelUrl: cancel_url,
        metadata: { orderId: params[:orderId] }
      }.to_json
    )

    render json: response.parsed_response
  end

  def webhook
    signature = request.headers['X-Webhook-Signature']
    payload = request.raw_post

    # Verify signature
    expected_signature = OpenSSL::HMAC.hexdigest(
      'SHA256',
      ENV['WEBHOOK_SECRET'],
      payload
    )

    unless ActiveSupport::SecurityUtils.secure_compare(signature, expected_signature)
      return head :unauthorized
    end

    # Process webhook
    event_data = JSON.parse(payload)
    event = event_data['event']
    data = event_data['data']

    case event
    when 'payment.completed'
      order_id = data['metadata']['orderId']
      Rails.logger.info "Payment completed for order #{order_id}"
      # Update order in database

    when 'payment.failed'
      Rails.logger.info "Payment failed for session #{data['sessionId']}"
    end

    head :ok
  end
end
```

### Routes

```ruby
# config/routes.rb
Rails.application.routes.draw do
  post 'create-checkout', to: 'payments#create_checkout'
  post 'webhooks/payment', to: 'payments#webhook'
end
```

---

## Additional Resources

- [Full API Documentation](./MERCHANT_DOCUMENTATION.md)
- [Developer Portal](https://your-domain.com/developer-portal)
- [SDK Libraries](https://github.com/payment-switch)
- [Support](mailto:support@paymentswitch.com)
