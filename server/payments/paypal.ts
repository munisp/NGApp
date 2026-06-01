/**
 * PayPal Payment Provider for OG-RMM SaaS Billing
 *
 * Implements PayPal Orders API v2 for one-time and subscription payments.
 * Supports sandbox and production environments via PAYPAL_ENV env var.
 *
 * Environment variables:
 *   PAYPAL_CLIENT_ID     — PayPal app client ID (default: sandbox test client)
 *   PAYPAL_CLIENT_SECRET — PayPal app client secret
 *   PAYPAL_ENV           — "sandbox" | "production" (default: "sandbox")
 *   PAYPAL_WEBHOOK_ID    — PayPal webhook ID for signature verification
 */

import axios from "axios";

const PAYPAL_ENV = process.env.PAYPAL_ENV ?? "sandbox";
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID ?? "AZDxjDScFpQtjWTOUtWKbyN_bDt4OgqaF4eYXlewfBP4-8aqIcE4AvZcdxq2B6Gg";
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET ?? "EGnHDxD_qRPbzvrc6RxgynNDde76b";

const BASE_URL =
  PAYPAL_ENV === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

// ── Token cache ────────────────────────────────────────────────────────────
let cachedToken: { access_token: string; expires_at: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires_at - 30_000) {
    return cachedToken.access_token;
  }

  const res = await axios.post(
    `${BASE_URL}/v1/oauth2/token`,
    "grant_type=client_credentials",
    {
      auth: { username: PAYPAL_CLIENT_ID, password: PAYPAL_CLIENT_SECRET },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );

  cachedToken = {
    access_token: res.data.access_token,
    expires_at: Date.now() + res.data.expires_in * 1000,
  };
  return cachedToken.access_token;
}

function paypalHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "PayPal-Request-Id": `og-rmm-${Date.now()}`,
    Prefer: "return=representation",
  };
}

// ── Order API ──────────────────────────────────────────────────────────────

export interface CreateOrderInput {
  amount: number;        // USD cents
  currency?: string;     // default "USD"
  description: string;
  returnUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface PayPalOrder {
  id: string;
  status: string;
  approveUrl: string;
}

export async function createPayPalOrder(input: CreateOrderInput): Promise<PayPalOrder> {
  const token = await getAccessToken();
  const amountStr = (input.amount / 100).toFixed(2);
  const currency = input.currency ?? "USD";

  const res = await axios.post(
    `${BASE_URL}/v2/checkout/orders`,
    {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: { currency_code: currency, value: amountStr },
          description: input.description,
          custom_id: JSON.stringify(input.metadata ?? {}),
        },
      ],
      application_context: {
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
        brand_name: "OG-RMM Platform",
        landing_page: "BILLING",
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",
      },
    },
    { headers: paypalHeaders(token) }
  );

  const approveLink = res.data.links?.find((l: { rel: string; href: string }) => l.rel === "approve");
  return {
    id: res.data.id,
    status: res.data.status,
    approveUrl: approveLink?.href ?? "",
  };
}

export async function capturePayPalOrder(orderId: string): Promise<{
  id: string;
  status: string;
  amount: number;
  currency: string;
  payerId: string;
  payerEmail: string;
}> {
  const token = await getAccessToken();
  const res = await axios.post(
    `${BASE_URL}/v2/checkout/orders/${orderId}/capture`,
    {},
    { headers: paypalHeaders(token) }
  );

  const capture = res.data.purchase_units?.[0]?.payments?.captures?.[0];
  const payer = res.data.payer;

  return {
    id: res.data.id,
    status: res.data.status,
    amount: Math.round(parseFloat(capture?.amount?.value ?? "0") * 100),
    currency: capture?.amount?.currency_code ?? "USD",
    payerId: payer?.payer_id ?? "",
    payerEmail: payer?.email_address ?? "",
  };
}

export async function getPayPalOrder(orderId: string) {
  const token = await getAccessToken();
  const res = await axios.get(`${BASE_URL}/v2/checkout/orders/${orderId}`, {
    headers: paypalHeaders(token),
  });
  return res.data;
}

// ── Subscription API ───────────────────────────────────────────────────────

export interface CreateSubscriptionInput {
  planId: string;        // PayPal billing plan ID
  subscriberEmail: string;
  subscriberName: string;
  returnUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export async function createPayPalSubscription(input: CreateSubscriptionInput) {
  const token = await getAccessToken();

  const res = await axios.post(
    `${BASE_URL}/v1/billing/subscriptions`,
    {
      plan_id: input.planId,
      subscriber: {
        name: { given_name: input.subscriberName.split(" ")[0], surname: input.subscriberName.split(" ").slice(1).join(" ") || "." },
        email_address: input.subscriberEmail,
      },
      application_context: {
        brand_name: "OG-RMM Platform",
        locale: "en-US",
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
        payment_method: { payer_selected: "PAYPAL", payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED" },
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
      },
      custom_id: JSON.stringify(input.metadata ?? {}),
    },
    { headers: paypalHeaders(token) }
  );

  const approveLink = res.data.links?.find((l: { rel: string; href: string }) => l.rel === "approve");
  return {
    id: res.data.id,
    status: res.data.status,
    approveUrl: approveLink?.href ?? "",
  };
}

export async function cancelPayPalSubscription(subscriptionId: string, reason = "Customer requested cancellation") {
  const token = await getAccessToken();
  await axios.post(
    `${BASE_URL}/v1/billing/subscriptions/${subscriptionId}/cancel`,
    { reason },
    { headers: paypalHeaders(token) }
  );
  return { success: true };
}

// ── Webhook verification ───────────────────────────────────────────────────

export async function verifyPayPalWebhook(
  webhookId: string,
  headers: Record<string, string>,
  body: string
): Promise<boolean> {
  try {
    const token = await getAccessToken();
    const res = await axios.post(
      `${BASE_URL}/v1/notifications/verify-webhook-signature`,
      {
        auth_algo: headers["paypal-auth-algo"],
        cert_url: headers["paypal-cert-url"],
        transmission_id: headers["paypal-transmission-id"],
        transmission_sig: headers["paypal-transmission-sig"],
        transmission_time: headers["paypal-transmission-time"],
        webhook_id: webhookId,
        webhook_event: JSON.parse(body),
      },
      { headers: paypalHeaders(token) }
    );
    return res.data.verification_status === "SUCCESS";
  } catch {
    return false;
  }
}
