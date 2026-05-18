import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { webhookEndpoints, webhookDeliveries, auditLog } from "../../drizzle/schema";

export const webhookNotificationsRouter = router({
  listEndpoints: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(webhookEndpoints).orderBy(desc(webhookEndpoints.createdAt)).limit(input?.limit ?? 50);
    return { endpoints: rows, total: rows.length };
  }),
  createEndpoint: protectedProcedure.input(z.object({ url: z.string().url(), events: z.array(z.string()), secret: z.string().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [endpoint] = await db.insert(webhookEndpoints).values({ url: input.url, events: input.events, status: "active" }).returning();
    await db.insert(auditLog).values({ action: "webhook_endpoint_created", resource: "webhook_endpoints", resourceId: String(endpoint.id), status: "success", metadata: { url: input.url, events: input.events } });
    return endpoint;
  }),
  deleteEndpoint: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, input.id));
    await db.insert(auditLog).values({ action: "webhook_endpoint_deleted", resource: "webhook_endpoints", resourceId: String(input.id), status: "success", metadata: {} });
    return { success: true };
  }),
  listDeliveries: protectedProcedure.input(z.object({ endpointId: z.number().optional(), limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = input?.endpointId ? await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.endpointId, input.endpointId)).orderBy(desc(webhookDeliveries.createdAt)).limit(input?.limit ?? 50) : await db.select().from(webhookDeliveries).orderBy(desc(webhookDeliveries.createdAt)).limit(input?.limit ?? 50);
    return { deliveries: rows, total: rows.length };
  }),
  retryDelivery: protectedProcedure.input(z.object({ deliveryId: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.update(webhookDeliveries).set({ status: "retrying" }).where(eq(webhookDeliveries.id, input.deliveryId));
    await db.insert(auditLog).values({ action: "webhook_delivery_retried", resource: "webhook_deliveries", resourceId: String(input.deliveryId), status: "success", metadata: {} });
    return { success: true };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalEndpoints] = await db.select({ value: count() }).from(webhookEndpoints);
    const [totalDeliveries] = await db.select({ value: count() }).from(webhookDeliveries);
    return { totalEndpoints: Number(totalEndpoints.value), totalDeliveries: Number(totalDeliveries.value) };
  }),
});
