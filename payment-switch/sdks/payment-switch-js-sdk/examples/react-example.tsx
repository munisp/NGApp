/**
 * Payment Switch React Integration Example
 * 
 * This example shows how to use the Payment Switch SDK with React
 */

import React, { useState } from 'react';
import { PaymentButton, CheckoutForm, usePaymentSwitch } from '@payment-switch/js-sdk/react';
import { createPaymentSwitch } from '@payment-switch/js-sdk';

// Initialize Payment Switch instance
const paymentSwitch = createPaymentSwitch({
  apiKey: 'pk_test_your_api_key_here',
  baseUrl: 'http://localhost:3000'
});

/**
 * Example 1: Using the PaymentButton Component
 */
export function Example1() {
  const handleSuccess = (sessionId: string) => {
    alert(`Payment successful! Session: ${sessionId}`);
  };

  const handleError = (error: Error) => {
    alert(`Payment failed: ${error.message}`);
  };

  return (
    <div>
      <h2>Example 1: Payment Button (Redirect)</h2>
      <PaymentButton
        paymentSwitch={paymentSwitch}
        sessionOptions={{
          amount: 5000, // $50.00
          currency: 'USD',
          description: 'Product Purchase',
          customerEmail: 'customer@example.com'
        }}
        mode="redirect"
        onSuccess={handleSuccess}
        onError={handleError}
      >
        Pay $50.00
      </PaymentButton>

      <h2>Example 2: Payment Button (Modal)</h2>
      <PaymentButton
        paymentSwitch={paymentSwitch}
        sessionOptions={{
          amount: 7500, // $75.00
          currency: 'USD',
          description: 'Premium Subscription'
        }}
        mode="modal"
        onSuccess={handleSuccess}
        onError={handleError}
      >
        Subscribe for $75.00
      </PaymentButton>
    </div>
  );
}

/**
 * Example 2: Using the CheckoutForm Component
 */
export function Example2() {
  const handleSuccess = (sessionId: string) => {
    console.log('Payment successful:', sessionId);
    alert('Thank you for your payment!');
  };

  const handleCancel = () => {
    console.log('Payment cancelled');
  };

  const handleError = (error: Error) => {
    console.error('Payment error:', error);
    alert('Payment failed. Please try again.');
  };

  return (
    <div>
      <h2>Example 2: Checkout Form</h2>
      <CheckoutForm
        paymentSwitch={paymentSwitch}
        mode="modal"
        defaultAmount={99.99}
        defaultCurrency="USD"
        onSuccess={handleSuccess}
        onCancel={handleCancel}
        onError={handleError}
      />
    </div>
  );
}

/**
 * Example 3: Using the usePaymentSwitch Hook
 */
export function Example3() {
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'pro' | 'enterprise'>('basic');
  
  const { loading, error, checkout, openModal } = usePaymentSwitch({
    apiKey: 'pk_test_your_api_key_here',
    baseUrl: 'http://localhost:3000'
  });

  const plans = {
    basic: { name: 'Basic Plan', price: 2999 },
    pro: { name: 'Pro Plan', price: 4999 },
    enterprise: { name: 'Enterprise Plan', price: 9999 }
  };

  const handleCheckout = async (mode: 'redirect' | 'modal') => {
    const plan = plans[selectedPlan];
    
    try {
      if (mode === 'redirect') {
        await checkout({
          amount: plan.price,
          currency: 'USD',
          description: plan.name,
          metadata: { plan: selectedPlan }
        });
      } else {
        await openModal(
          {
            amount: plan.price,
            currency: 'USD',
            description: plan.name,
            metadata: { plan: selectedPlan }
          },
          {
            onSuccess: (sessionId) => {
              alert(`Payment successful! Session: ${sessionId}`);
            },
            onCancel: () => {
              alert('Payment cancelled');
            },
            onError: (error) => {
              alert(`Payment error: ${error.message}`);
            }
          }
        );
      }
    } catch (err) {
      console.error('Checkout error:', err);
    }
  };

  return (
    <div>
      <h2>Example 3: Custom Pricing Page</h2>
      
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        {Object.entries(plans).map(([key, plan]) => (
          <div
            key={key}
            onClick={() => setSelectedPlan(key as any)}
            style={{
              padding: '20px',
              border: selectedPlan === key ? '2px solid #2563eb' : '2px solid #e5e7eb',
              borderRadius: '8px',
              cursor: 'pointer',
              flex: 1,
              textAlign: 'center'
            }}
          >
            <h3>{plan.name}</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold' }}>
              ${(plan.price / 100).toFixed(2)}
            </p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={() => handleCheckout('redirect')}
          disabled={loading}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: 600,
            color: 'white',
            backgroundColor: '#2563eb',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Processing...' : 'Checkout (Redirect)'}
        </button>
        
        <button
          onClick={() => handleCheckout('modal')}
          disabled={loading}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: 600,
            color: '#2563eb',
            backgroundColor: 'white',
            border: '2px solid #2563eb',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Processing...' : 'Checkout (Modal)'}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: '10px', color: 'red' }}>
          Error: {error.message}
        </div>
      )}
    </div>
  );
}

/**
 * Example 4: E-commerce Product Page
 */
export function Example4() {
  const [quantity, setQuantity] = useState(1);
  const pricePerUnit = 2999; // $29.99

  const { checkout, loading } = usePaymentSwitch({
    apiKey: 'pk_test_your_api_key_here',
    baseUrl: 'http://localhost:3000'
  });

  const handleBuyNow = async () => {
    await checkout({
      amount: pricePerUnit * quantity,
      currency: 'USD',
      description: `Product Purchase (Qty: ${quantity})`,
      metadata: {
        product_id: 'prod_123',
        quantity: quantity
      }
    });
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2>Example 4: E-commerce Product</h2>
      
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <img
          src="https://via.placeholder.com/300"
          alt="Product"
          style={{ width: '300px', height: '300px', objectFit: 'cover', borderRadius: '8px' }}
        />
        
        <div>
          <h3>Premium Widget</h3>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#2563eb' }}>
            ${(pricePerUnit / 100).toFixed(2)}
          </p>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            High-quality widget with advanced features. Perfect for your needs.
          </p>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>
              Quantity
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value))}
              style={{
                width: '80px',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px'
              }}
            />
          </div>
          
          <div style={{ marginBottom: '10px' }}>
            <strong>Total:</strong> ${((pricePerUnit * quantity) / 100).toFixed(2)}
          </div>
          
          <button
            onClick={handleBuyNow}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 600,
              color: 'white',
              backgroundColor: '#2563eb',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? 'Processing...' : 'Buy Now'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Main App Component
 */
export default function App() {
  const [activeExample, setActiveExample] = useState(1);

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Payment Switch React Examples</h1>
      
      <div style={{ marginBottom: '30px' }}>
        <button onClick={() => setActiveExample(1)}>Example 1</button>
        <button onClick={() => setActiveExample(2)}>Example 2</button>
        <button onClick={() => setActiveExample(3)}>Example 3</button>
        <button onClick={() => setActiveExample(4)}>Example 4</button>
      </div>

      {activeExample === 1 && <Example1 />}
      {activeExample === 2 && <Example2 />}
      {activeExample === 3 && <Example3 />}
      {activeExample === 4 && <Example4 />}
    </div>
  );
}
