/**
 * Webhooks Router
 * CRUD for outbound webhook endpoints + delivery history + manual retry.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { webhookEndpoints, webhookDeliveries } from "../../drizzle/schema";
import { eq, desc, and, count, gte } from "drizzle-orm";
import crypto from "crypto";
import { retryPendingDeliveries } from "../lib/webhookDelivery";

const mgmtProcedure = protectedProcedure;

export const webhooksRouter = router({
  // ── List all webhook endpoints ────────────────────────────────────────────
  list: mgmtProcedure.query(async () => {
    const db = (await getDb())!;
    if (!db) return [];
    return db.select().from(webhookEndpoints).orderBy(desc(webhookEndpoints.createdAt));
  }),

  // ── Create a new webhook endpoint ────────────────────────────────────────
  create: mgmtProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        url: z.string().url(),
        events: z.array(z.string()).min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = (await getDb())!;
      if (!db) throw new Error("Database unavailable");
      const secret = crypto.randomBytes(32).toString("hex");
      const [endpoint] = await db
        .insert(webhookEndpoints)
        .values({
          name: input.name,
          url: input.url,
          secret,
          events: input.events,
          isActive: true,
          createdBy: ctx.user.id,
        })
        .returning();
      return { ...endpoint, secret }; // Return secret only on creation
    }),

  // ── Update a webhook endpoint ─────────────────────────────────────────────
  update: mgmtProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        url: z.string().url().optional(),
        events: z.array(z.string()).min(1).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      if (!db) throw new Error("Database unavailable");
      const { id, ...data } = input;
      const [updated] = await db
        .update(webhookEndpoints)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(webhookEndpoints.id, id))
        .returning();
      return updated;
    }),

  // ── Rotate webhook secret ─────────────────────────────────────────────────
  rotateSecret: mgmtProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      if (!db) throw new Error("Database unavailable");
      const newSecret = crypto.randomBytes(32).toString("hex");
      await db
        .update(webhookEndpoints)
        .set({ secret: newSecret, updatedAt: new Date() })
        .where(eq(webhookEndpoints.id, input.id));
      return { secret: newSecret };
    }),

  // ── Delete a webhook endpoint ─────────────────────────────────────────────
  delete: mgmtProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      if (!db) throw new Error("Database unavailable");
      await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, input.id));
      return { success: true };
    }),

  // ── List delivery history for an endpoint ────────────────────────────────
  deliveries: mgmtProcedure
    .input(
      z.object({
        endpointId: z.number(),
        page: z.number().default(1),
        limit: z.number().default(20),
      })
    )
    .query(async ({ input }) => {
      const db = (await getDb())!;
      if (!db) return { items: [], total: 0 };
      const offset = (input.page - 1) * input.limit;
      const [items, [{ c: total }]] = await Promise.all([
        db
          .select()
          .from(webhookDeliveries)
          .where(eq(webhookDeliveries.endpointId, input.endpointId))
          .orderBy(desc(webhookDeliveries.createdAt))
          .limit(input.limit)
          .offset(offset),
        db
          .select({ c: count() })
          .from(webhookDeliveries)
          .where(eq(webhookDeliveries.endpointId, input.endpointId)),
      ]);
      return { items, total: Number(total) };
    }),

  // ── Delivery stats for all endpoints ─────────────────────────────────────
  stats: mgmtProcedure.query(async () => {
    const db = (await getDb())!;
    if (!db) return { total: 0, delivered: 0, failed: 0, retrying: 0, successRate: 0 };
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h
    const rows = await db
      .select()
      .from(webhookDeliveries)
      .where(gte(webhookDeliveries.createdAt, since));
    const total = rows.length;
    const delivered = rows.filter((r: any) => r.status === "delivered").length;
    const failed = rows.filter((r: any) => r.status === "failed").length;
    const retrying = rows.filter((r: any) => r.status === "retrying").length;
    return {
      total,
      delivered,
      failed,
      retrying,
      successRate: total > 0 ? Math.round((delivered / total) * 100) : 100,
    };
  }),

  // ── Manually retry a failed delivery ─────────────────────────────────────
  retryDelivery: mgmtProcedure
    .input(z.object({ deliveryId: z.number() }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      if (!db) throw new Error("Database unavailable");
      await db
        .update(webhookDeliveries)
        .set({
          status: "retrying",
          nextRetryAt: new Date(),
          attemptCount: 0,
        })
        .where(eq(webhookDeliveries.id, input.deliveryId));
      const retried = await retryPendingDeliveries();
      return { retried };
    }),

  // ── Test a webhook endpoint with a ping ──────────────────────────────────
  ping: mgmtProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      if (!db) throw new Error("Database unavailable");
      const [endpoint] = await db
        .select()
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.id, input.id))
        .limit(1);
      if (!endpoint) throw new Error("Endpoint not found");

      const body = JSON.stringify({
        event: "ping",
        timestamp: new Date().toISOString(),
        data: { message: "54Link webhook ping test" },
      });
      const signature = `sha256=${crypto
        .createHmac("sha256", endpoint.secret)
        .update(body)
        .digest("hex")}`;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        const response = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-54Link-Signature": signature,
            "X-54Link-Event": "ping",
            "User-Agent": "54Link-Webhook/1.0",
          },
          body,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        return { success: response.ok, statusCode: response.status };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    }),
});
