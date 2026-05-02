/**
 * Payment Switch React Components
 * 
 * Pre-built React components for easy integration
 */

import React, { useState, useEffect } from 'react';
import { PaymentSwitch, CreateSessionOptions, CheckoutOptions } from './index';

export interface PaymentButtonProps {
  paymentSwitch: PaymentSwitch;
  sessionOptions: CreateSessionOptions;
  className?: string;
  children?: React.ReactNode;
  onSuccess?: (sessionId: string) => void;
  onCancel?: () => void;
  onError?: (error: Error) => void;
  mode?: 'redirect' | 'modal';
}

/**
 * PaymentButton Component
 * 
 * A button that creates a payment session and redirects/opens modal
 */
export const PaymentButton: React.FC<PaymentButtonProps> = ({
  paymentSwitch,
  sessionOptions,
  className = 'payment-switch-button',
  children = 'Pay Now',
  onSuccess,
  onCancel,
  onError,
  mode = 'redirect',
}) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const session = await paymentSwitch.createSession(sessionOptions);
      
      if (mode === 'modal') {
        paymentSwitch.openCheckoutModal({
          sessionId: session.sessionId,
          onSuccess,
          onCancel,
          onError,
        });
        setLoading(false);
      } else {
        paymentSwitch.redirectToCheckout(session.sessionId);
      }
    } catch (error) {
      setLoading(false);
      onError?.(error as Error);
    }
  };

  return (
    <button
      className={className}
      onClick={handleClick}
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
        opacity: loading ? 0.6 : 1,
        transition: 'all 0.2s',
      }}
    >
      {loading ? 'Processing...' : children}
    </button>
  );
};

export interface CheckoutFormProps {
  paymentSwitch: PaymentSwitch;
  onSuccess?: (sessionId: string) => void;
  onCancel?: () => void;
  onError?: (error: Error) => void;
  mode?: 'redirect' | 'modal';
  defaultAmount?: number;
  defaultCurrency?: string;
  className?: string;
}

/**
 * CheckoutForm Component
 * 
 * A form that collects payment details and creates a session
 */
export const CheckoutForm: React.FC<CheckoutFormProps> = ({
  paymentSwitch,
  onSuccess,
  onCancel,
  onError,
  mode = 'redirect',
  defaultAmount = 0,
  defaultCurrency = 'USD',
  className = 'payment-switch-form',
}) => {
  const [amount, setAmount] = useState(defaultAmount);
  const [currency, setCurrency] = useState(defaultCurrency);
  const [description, setDescription] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const session = await paymentSwitch.createSession({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        description,
        customerEmail,
        customerName,
      });

      if (mode === 'modal') {
        paymentSwitch.openCheckoutModal({
          sessionId: session.sessionId,
          onSuccess,
          onCancel,
          onError,
        });
        setLoading(false);
      } else {
        paymentSwitch.redirectToCheckout(session.sessionId);
      }
    } catch (error) {
      setLoading(false);
      onError?.(error as Error);
    }
  };

  return (
    <form className={className} onSubmit={handleSubmit} style={{ maxWidth: '400px' }}>
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
          Amount
        </label>
        <input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(parseFloat(e.target.value))}
          required
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
          Currency
        </label>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        >
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
          <option value="JPY">JPY</option>
        </select>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
          Description
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this payment for?"
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
          Customer Email
        </label>
        <input
          type="email"
          value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)}
          placeholder="customer@example.com"
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
          Customer Name
        </label>
        <input
          type="text"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="John Doe"
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        />
      </div>

      <button
        type="submit"
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
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? 'Processing...' : 'Proceed to Checkout'}
      </button>
    </form>
  );
};

export interface UsePaymentSwitchOptions {
  apiKey: string;
  baseUrl?: string;
}

/**
 * usePaymentSwitch Hook
 * 
 * React hook for using PaymentSwitch in functional components
 */
export function usePaymentSwitch(options: UsePaymentSwitchOptions) {
  const [paymentSwitch] = useState(() => new PaymentSwitch(options));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createSession = async (sessionOptions: CreateSessionOptions) => {
    setLoading(true);
    setError(null);
    try {
      const session = await paymentSwitch.createSession(sessionOptions);
      setLoading(false);
      return session;
    } catch (err) {
      setError(err as Error);
      setLoading(false);
      throw err;
    }
  };

  const checkout = async (sessionOptions: CreateSessionOptions) => {
    const session = await createSession(sessionOptions);
    paymentSwitch.redirectToCheckout(session.sessionId);
  };

  const openModal = async (sessionOptions: CreateSessionOptions, callbacks?: Omit<CheckoutOptions, 'sessionId'>) => {
    const session = await createSession(sessionOptions);
    paymentSwitch.openCheckoutModal({
      sessionId: session.sessionId,
      ...callbacks,
    });
  };

  return {
    paymentSwitch,
    loading,
    error,
    createSession,
    checkout,
    openModal,
  };
}
