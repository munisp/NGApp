/**
 * Payment Switch JavaScript SDK
 * 
 * A lightweight SDK for integrating Payment Switch checkout into your website
 */

export interface PaymentSwitchConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface CreateSessionOptions {
  amount: number;
  currency?: string;
  description?: string;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  merchantReference?: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, any>;
}

export interface PaymentSession {
  sessionId: string;
  checkoutUrl: string;
  expiresAt: string;
}

export interface CheckoutOptions {
  sessionId?: string;
  onSuccess?: (sessionId: string) => void;
  onCancel?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Main PaymentSwitch class
 */
export class PaymentSwitch {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: PaymentSwitchConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://checkout.payment-switch.com';
  }

  /**
   * Create a payment session
   */
  async createSession(options: CreateSessionOptions): Promise<PaymentSession> {
    const response = await fetch(`${this.baseUrl}/api/trpc/payment.createSession`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: this.apiKey,
        ...options,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create payment session');
    }

    const data = await response.json();
    return data.result.data;
  }

  /**
   * Redirect to checkout page
   */
  redirectToCheckout(sessionId: string): void {
    window.location.href = `${this.baseUrl}/checkout/${sessionId}`;
  }

  /**
   * Create session and redirect in one step
   */
  async checkout(options: CreateSessionOptions): Promise<void> {
    const session = await this.createSession(options);
    this.redirectToCheckout(session.sessionId);
  }

  /**
   * Open checkout in a modal/popup
   */
  openCheckoutModal(options: CheckoutOptions): void {
    const { sessionId, onSuccess, onCancel, onError } = options;

    if (!sessionId) {
      throw new Error('sessionId is required for modal checkout');
    }

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'payment-switch-modal';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
    `;

    // Create iframe container
    const container = document.createElement('div');
    container.style.cssText = `
      position: relative;
      width: 90%;
      max-width: 800px;
      height: 90%;
      max-height: 600px;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `;

    // Create close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      width: 32px;
      height: 32px;
      border: none;
      background: rgba(0, 0, 0, 0.1);
      color: #333;
      font-size: 24px;
      line-height: 1;
      cursor: pointer;
      border-radius: 50%;
      z-index: 1;
      transition: background 0.2s;
    `;
    closeBtn.onmouseover = () => closeBtn.style.background = 'rgba(0, 0, 0, 0.2)';
    closeBtn.onmouseout = () => closeBtn.style.background = 'rgba(0, 0, 0, 0.1)';
    closeBtn.onclick = () => {
      document.body.removeChild(overlay);
      onCancel?.();
    };

    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.src = `${this.baseUrl}/checkout/${sessionId}`;
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
    `;

    // Listen for messages from iframe
    window.addEventListener('message', (event) => {
      if (event.origin !== this.baseUrl) return;

      if (event.data.type === 'payment-success') {
        document.body.removeChild(overlay);
        onSuccess?.(event.data.sessionId);
      } else if (event.data.type === 'payment-cancel') {
        document.body.removeChild(overlay);
        onCancel?.();
      } else if (event.data.type === 'payment-error') {
        document.body.removeChild(overlay);
        onError?.(new Error(event.data.message));
      }
    });

    container.appendChild(closeBtn);
    container.appendChild(iframe);
    overlay.appendChild(container);
    document.body.appendChild(overlay);
  }

  /**
   * Get session status
   */
  async getSession(sessionId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/trpc/payment.getSession?input=${encodeURIComponent(JSON.stringify({ sessionId }))}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get session');
    }

    const data = await response.json();
    return data.result.data;
  }
}

/**
 * Create a PaymentSwitch instance
 */
export function createPaymentSwitch(config: PaymentSwitchConfig): PaymentSwitch {
  return new PaymentSwitch(config);
}

// Default export
export default PaymentSwitch;
