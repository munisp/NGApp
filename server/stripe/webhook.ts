/**
 * Stripe Webhook Handler for OG-RMM SaaS Billing
 * Handles subscription lifecycle events from Stripe
 */
import Stripe from "stripe";
import { Request, Response } from "express";
import { getDb } from "../db";
import { saasSubscriptions } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.error("[Stripe Webhook] Missing signature or secret");
    return res.status(400).json({ error: "Missing webhook signature" });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Stripe Webhook] Signature verification failed:", msg);
    return res.status(400).json({ error: `Webhook Error: ${msg}` });
  }

  // ── Handle test events ──────────────────────────────────────────────────────
  if (event.id.startsWith("evt_test_")) {
    console.log("[Stripe Webhook] Test event detected, returning verification response");
    return res.json({ verified: true });
  }

  console.log(`[Stripe Webhook] Event: ${event.type} | ID: ${event.id}`);

  try {
    const db = await getDb();
    if (!db) {
      console.error("[Stripe Webhook] No DB connection");
      return res.status(500).json({ error: "DB unavailable" });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.metadata?.tenant_id ?? session.client_reference_id ?? "";
        const planId = session.metadata?.plan_id ?? "professional";
        const billingCycle = session.metadata?.billing_cycle ?? "monthly";
        const stripeCustomerId = typeof session.customer === "string"
          ? session.customer
          : (session.customer as Stripe.Customer | null)?.id ?? "";
        const stripeSubscriptionId = typeof session.subscription === "string"
          ? session.subscription
          : (session.subscription as Stripe.Subscription | null)?.id ?? "";

        if (tenantId && stripeSubscriptionId) {
          await db.insert(saasSubscriptions).values({
            subscriptionId: `sub_${Date.now()}`,
            tenantId,
            planId,
            billingCycle,
            status: "active",
            stripeSubscriptionId,
            stripeCustomerId,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + (billingCycle === "annual" ? 365 : 30) * 24 * 60 * 60 * 1000),
          }).onConflictDoNothing();

          console.log(`[Stripe Webhook] Subscription activated for tenant ${tenantId}`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const status = subscription.status === "active" ? "active"
          : subscription.status === "canceled" ? "cancelled"
          : subscription.status === "past_due" ? "past_due"
          : subscription.status;

        const subAny = subscription as unknown as { current_period_start?: number; current_period_end?: number };
        await db.update(saasSubscriptions)
          .set({
            status,
            ...(subAny.current_period_start ? { currentPeriodStart: new Date(subAny.current_period_start * 1000) } : {}),
            ...(subAny.current_period_end ? { currentPeriodEnd: new Date(subAny.current_period_end * 1000) } : {}),
            updatedAt: new Date(),
          })
          .where(eq(saasSubscriptions.stripeSubscriptionId, subscription.id));

        console.log(`[Stripe Webhook] Subscription ${subscription.id} updated to ${status}`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await db.update(saasSubscriptions)
          .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
          .where(eq(saasSubscriptions.stripeSubscriptionId, subscription.id));

        console.log(`[Stripe Webhook] Subscription ${subscription.id} cancelled`);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = (invoice as unknown as { subscription?: string | Stripe.Subscription }).subscription;
        if (subRef) {
          const subId = typeof subRef === "string" ? subRef : subRef.id;
          await db.update(saasSubscriptions)
            .set({ status: "active", updatedAt: new Date() })
            .where(eq(saasSubscriptions.stripeSubscriptionId, subId));
        }
        console.log(`[Stripe Webhook] Invoice paid: ${invoice.id}`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = (invoice as unknown as { subscription?: string | Stripe.Subscription }).subscription;
        if (subRef) {
          const subId = typeof subRef === "string" ? subRef : subRef.id;
          await db.update(saasSubscriptions)
            .set({ status: "past_due", updatedAt: new Date() })
            .where(eq(saasSubscriptions.stripeSubscriptionId, subId));
        }
        console.log(`[Stripe Webhook] Payment failed for invoice ${invoice.id}`);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return res.json({ received: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Stripe Webhook] Processing error:", msg);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
}
