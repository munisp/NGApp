/**
 * Stripe Billing tRPC Router
 * Handles SaaS subscription checkout, portal, and billing management
 */
import { z } from "zod";
import Stripe from "stripe";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { saasSubscriptions, saasPlans } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { STRIPE_PRODUCTS } from "../stripe/products";

const stripeKey = process.env.STRIPE_SECRET_KEY || "sk_test_placeholder";
const stripe = new Stripe(stripeKey);

export const stripeBillingRouter = router({
  // List all available plans with Stripe price IDs
  listPlans: protectedProcedure.query(async () => {
    return STRIPE_PRODUCTS.map(p => ({
      planId: p.planId,
      name: p.name,
      description: p.description,
      priceMonthly: p.priceMonthly,
      priceAnnual: p.priceAnnual,
      maxWells: p.maxWells,
      maxUsers: p.maxUsers,
      features: p.features,
    }));
  }),

  // Create a Stripe Checkout Session for a subscription
  createCheckoutSession: protectedProcedure
    .input(z.object({
      planId: z.string(),
      billingCycle: z.enum(["monthly", "annual"]),
      tenantId: z.string(),
      origin: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = STRIPE_PRODUCTS.find(p => p.planId === input.planId);
      if (!plan) throw new Error(`Plan ${input.planId} not found`);

      const unitAmount = input.billingCycle === "annual" ? plan.priceAnnual : plan.priceMonthly;
      const interval = input.billingCycle === "annual" ? "year" : "month";

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer_email: ctx.user.email ?? undefined,
        allow_promotion_codes: true,
        client_reference_id: ctx.user.openId,
        metadata: {
          user_id: ctx.user.openId,
          tenant_id: input.tenantId,
          plan_id: input.planId,
          billing_cycle: input.billingCycle,
          customer_email: ctx.user.email ?? "",
          customer_name: ctx.user.name ?? "",
        },
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `OG-RMM ${plan.name}`,
                description: plan.description,
                metadata: { plan_id: input.planId },
              },
              unit_amount: unitAmount,
              recurring: { interval },
            },
            quantity: 1,
          },
        ],
        success_url: `${input.origin}/saas-platform?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${input.origin}/saas-platform?checkout=cancelled`,
      });

      return { checkoutUrl: session.url, sessionId: session.id };
    }),

  // Create a Stripe Customer Portal session for subscription management
  createPortalSession: protectedProcedure
    .input(z.object({
      tenantId: z.string(),
      origin: z.string().url(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const [sub] = await db.select()
        .from(saasSubscriptions)
        .where(eq(saasSubscriptions.tenantId, input.tenantId))
        .orderBy(desc(saasSubscriptions.createdAt))
        .limit(1);

      if (!sub?.stripeCustomerId) {
        throw new Error("No active Stripe subscription found for this tenant");
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: `${input.origin}/saas-platform`,
      });

      return { portalUrl: portalSession.url };
    }),

  // Get current subscription status for a tenant
  getSubscriptionStatus: protectedProcedure
    .input(z.object({ tenantId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [sub] = await db.select()
        .from(saasSubscriptions)
        .where(eq(saasSubscriptions.tenantId, input.tenantId))
        .orderBy(desc(saasSubscriptions.createdAt))
        .limit(1);

      if (!sub) return null;

      // If we have a Stripe subscription ID, fetch live status
      if (sub.stripeSubscriptionId) {
        try {
          const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
          return {
            ...sub,
            stripeStatus: stripeSub.status,
            isActive: stripeSub.status === "active" || stripeSub.status === "trialing",
          };
        } catch {
          // Fall through to local data
        }
      }

      return {
        ...sub,
        stripeStatus: sub.status,
        isActive: sub.status === "active",
      };
    }),

  // List payment history (invoices) from Stripe
  listInvoices: protectedProcedure
    .input(z.object({ tenantId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const [sub] = await db.select()
        .from(saasSubscriptions)
        .where(eq(saasSubscriptions.tenantId, input.tenantId))
        .orderBy(desc(saasSubscriptions.createdAt))
        .limit(1);

      if (!sub?.stripeCustomerId) return [];

      try {
        const invoices = await stripe.invoices.list({
          customer: sub.stripeCustomerId,
          limit: 24,
        });

        return invoices.data.map(inv => ({
          id: inv.id,
          number: inv.number,
          status: inv.status,
          amount: inv.amount_paid / 100,
          currency: inv.currency.toUpperCase(),
          created: new Date(inv.created * 1000).toISOString(),
          pdfUrl: inv.invoice_pdf,
          hostedUrl: inv.hosted_invoice_url,
        }));
      } catch {
        return [];
      }
    }),

  // Cancel subscription
  cancelSubscription: protectedProcedure
    .input(z.object({ tenantId: z.string(), immediately: z.boolean().default(false) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const [sub] = await db.select()
        .from(saasSubscriptions)
        .where(eq(saasSubscriptions.tenantId, input.tenantId))
        .orderBy(desc(saasSubscriptions.createdAt))
        .limit(1);

      if (!sub?.stripeSubscriptionId) throw new Error("No active subscription found");

      if (input.immediately) {
        await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
      } else {
        await stripe.subscriptions.update(sub.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
      }

      await db.update(saasSubscriptions)
        .set({ status: input.immediately ? "cancelled" : "cancelling", updatedAt: new Date() })
        .where(eq(saasSubscriptions.subscriptionId, sub.subscriptionId));

      return { success: true };
    }),
});
