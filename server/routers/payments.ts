/**
 * Unified Payment Router — Stripe + PayPal + Bank Transfer
 *
 * Provides a single tRPC interface for all payment methods.
 * Frontend selects the payment method; backend routes to the correct provider.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { createPayPalOrder, capturePayPalOrder, createPayPalSubscription, cancelPayPalSubscription } from "../payments/paypal";
import { createBankTransferRequest, verifyBankTransferReference, generateBankTransferInvoiceData } from "../payments/bankTransfer";
import { STRIPE_PRODUCTS, type StripeProduct } from "../stripe/products";

// Map STRIPE_PRODUCTS to the unified plan format used by payments router
const SAAS_PLANS = STRIPE_PRODUCTS.map((p: StripeProduct) => ({
  id: p.planId,
  name: p.name,
  description: p.description,
  priceMonthly: Math.round(p.priceMonthly / 100), // convert cents to dollars
  features: p.features,
  stripePriceId: `price_${p.planId}_monthly`, // placeholder — set real Stripe price IDs via env
}));
import Stripe from "stripe";

const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  throw new Error("STRIPE_SECRET_KEY environment variable is required");
}
const stripe = new Stripe(stripeKey, {
  apiVersion: "2026-04-22.dahlia",
});

export const paymentsRouter = router({
  // ── List available payment methods ──────────────────────────────────────
  listMethods: protectedProcedure.query(() => {
    return [
      {
        id: "stripe",
        name: "Credit / Debit Card",
        description: "Pay securely with Visa, Mastercard, Amex, or any major card",
        icon: "credit-card",
        instant: true,
        currencies: ["USD", "EUR", "GBP", "AED", "SAR"],
        enabled: true,
      },
      {
        id: "paypal",
        name: "PayPal",
        description: "Pay with your PayPal account or PayPal credit",
        icon: "paypal",
        instant: true,
        currencies: ["USD", "EUR", "GBP"],
        enabled: true,
      },
      {
        id: "bank_transfer",
        name: "Bank Transfer",
        description: "ACH, SEPA, or SWIFT wire transfer — Net 30 payment terms",
        icon: "building-columns",
        instant: false,
        currencies: ["USD", "EUR", "GBP", "AED"],
        enabled: true,
        note: "Recommended for enterprise customers (>$5,000/month)",
      },
    ];
  }),

  // ── Stripe checkout ──────────────────────────────────────────────────────
  createStripeCheckout: protectedProcedure
    .input(z.object({
      planId: z.string(),
      origin: z.string().url(),
    }))
    .mutation(async ({ input, ctx }) => {
      const plan = SAAS_PLANS.find(p => p.id === input.planId);
      if (!plan) throw new Error("Plan not found");

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: plan.stripePriceId, quantity: 1 }],
        success_url: `${input.origin}/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${input.origin}/billing?cancelled=1`,
        customer_email: ctx.user.email ?? undefined,
        client_reference_id: ctx.user.openId,
        metadata: {
          user_id: ctx.user.openId,
          plan_id: input.planId,
          customer_email: ctx.user.email ?? "",
          customer_name: ctx.user.name ?? "",
        },
        allow_promotion_codes: true,
      });

      return { checkoutUrl: session.url, sessionId: session.id };
    }),

  // ── PayPal order ─────────────────────────────────────────────────────────
  createPayPalOrder: protectedProcedure
    .input(z.object({
      planId: z.string(),
      origin: z.string().url(),
    }))
    .mutation(async ({ input, ctx }) => {
      const plan = SAAS_PLANS.find(p => p.id === input.planId);
      if (!plan) throw new Error("Plan not found");

      const order = await createPayPalOrder({
        amount: plan.priceMonthly * 100,
        currency: "USD",
        description: `OG-RMM ${plan.name} Plan — Monthly Subscription`,
        returnUrl: `${input.origin}/billing?paypal=success&orderId={orderId}`,
        cancelUrl: `${input.origin}/billing?paypal=cancelled`,
        metadata: {
          user_id: ctx.user.openId,
          plan_id: input.planId,
          customer_name: ctx.user.name ?? "",
        },
      });

      return { approveUrl: order.approveUrl, orderId: order.id };
    }),

  // ── PayPal capture ───────────────────────────────────────────────────────
  capturePayPalOrder: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .mutation(async ({ input }) => {
      const result = await capturePayPalOrder(input.orderId);
      return {
        success: result.status === "COMPLETED",
        orderId: result.id,
        amount: result.amount,
        currency: result.currency,
        payerEmail: result.payerEmail,
      };
    }),

  // ── PayPal subscription ──────────────────────────────────────────────────
  createPayPalSubscription: protectedProcedure
    .input(z.object({
      planId: z.string(),
      paypalPlanId: z.string(),
      origin: z.string().url(),
    }))
    .mutation(async ({ input, ctx }) => {
      const sub = await createPayPalSubscription({
        planId: input.paypalPlanId,
        subscriberEmail: ctx.user.email ?? `${ctx.user.openId}@og-rmm.io`,
        subscriberName: ctx.user.name ?? "OG-RMM User",
        returnUrl: `${input.origin}/billing?paypal_sub=success`,
        cancelUrl: `${input.origin}/billing?paypal_sub=cancelled`,
        metadata: { user_id: ctx.user.openId, plan_id: input.planId },
      });
      return { approveUrl: sub.approveUrl, subscriptionId: sub.id };
    }),

  // ── Cancel PayPal subscription ───────────────────────────────────────────
  cancelPayPalSubscription: protectedProcedure
    .input(z.object({
      subscriptionId: z.string(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return cancelPayPalSubscription(input.subscriptionId, input.reason);
    }),

  // ── Bank transfer request ────────────────────────────────────────────────
  createBankTransfer: protectedProcedure
    .input(z.object({
      planId: z.string(),
      companyName: z.string().optional(),
      daysUntilDue: z.number().min(7).max(90).default(30),
    }))
    .mutation(async ({ input, ctx }) => {
      const plan = SAAS_PLANS.find(p => p.id === input.planId);
      if (!plan) throw new Error("Plan not found");

      const transfer = createBankTransferRequest({
        amount: plan.priceMonthly * 100,
        currency: "USD",
        customerName: ctx.user.name ?? "OG-RMM Customer",
        customerEmail: ctx.user.email ?? `${ctx.user.openId}@og-rmm.io`,
        description: `OG-RMM ${plan.name} Plan — Monthly Subscription`,
        daysUntilDue: input.daysUntilDue,
        metadata: { user_id: ctx.user.openId, plan_id: input.planId },
      });

      // Generate invoice data
      const invoiceData = generateBankTransferInvoiceData(
        transfer,
        {
          name: ctx.user.name ?? "OG-RMM Customer",
          email: ctx.user.email ?? `${ctx.user.openId}@og-rmm.io`,
          company: input.companyName,
        },
        [{ description: `${plan.name} Plan — Monthly Subscription`, quantity: 1, unitPrice: plan.priceMonthly * 100 }]
      );

      return { transfer, invoiceData };
    }),

  // ── Verify bank transfer reference ───────────────────────────────────────
  verifyBankTransferRef: protectedProcedure
    .input(z.object({ referenceId: z.string() }))
    .query(({ input }) => {
      return verifyBankTransferReference(input.referenceId);
    }),

  // ── Get billing history (all providers) ─────────────────────────────────
  getBillingHistory: protectedProcedure.query(async ({ ctx }) => {
    try {
      // Fetch from Stripe
      const stripeSessions = await stripe.checkout.sessions.list({
        limit: 20,
      });

      const stripePayments = stripeSessions.data
        .filter(s => s.client_reference_id === ctx.user.openId && s.payment_status === "paid")
        .map(s => ({
          provider: "stripe" as const,
          id: s.id,
          amount: s.amount_total ?? 0,
          currency: s.currency?.toUpperCase() ?? "USD",
          status: "paid" as const,
          date: new Date(s.created * 1000).toISOString(),
          description: "Subscription payment",
        }));

      return {
        payments: stripePayments,
        total: stripePayments.length,
      };
    } catch {
      return { payments: [], total: 0 };
    }
  }),

  // ── Get available plans ──────────────────────────────────────────────────
  listPlans: protectedProcedure.query(() => {
    return SAAS_PLANS.map((p: typeof SAAS_PLANS[0]) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      priceMonthly: p.priceMonthly,
      priceAnnual: Math.round(p.priceMonthly * 10), // 2 months free
      features: p.features,
      stripePriceId: p.stripePriceId,
      recommended: p.id === "professional",
    }));
  }),
});
