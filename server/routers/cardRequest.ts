import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { agents, transactions, auditLog } from "../../drizzle/schema";

export const cardRequestRouter = router({
  listRequests: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.enum(["pending", "approved", "rejected", "shipped", "delivered"]).optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [eq(auditLog.resource, "card_request")];
    if (input?.status) conditions.push(eq(auditLog.status, input.status));
    const rows = await db.select().from(auditLog).where(and(...conditions)).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
    return { requests: rows.map(r => ({ id: r.id, resourceId: r.resourceId, action: r.action, status: r.status, metadata: r.metadata, createdAt: r.createdAt })), total: rows.length };
  }),
  submitRequest: protectedProcedure.input(z.object({ agentId: z.number(), cardType: z.enum(["debit", "prepaid", "virtual"]), deliveryAddress: z.string().min(10).max(500) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [agent] = await db.select().from(agents).where(eq(agents.id, input.agentId)).limit(1);
    if (!agent) throw new Error("Agent not found");
    if (!agent.isActive) throw new Error("Agent account is suspended");
    const requestId = "CARD-" + crypto.randomUUID().slice(0, 12).toUpperCase();
    await db.insert(auditLog).values({ action: "card_requested", resource: "card_request", resourceId: requestId, status: "success", metadata: { agentId: input.agentId, cardType: input.cardType, deliveryAddress: input.deliveryAddress } });
    return { requestId, agentId: input.agentId, cardType: input.cardType, status: "pending", estimatedDelivery: new Date(Date.now() + 7 * 86400000).toISOString() };
  }),
  approveRequest: protectedProcedure.input(z.object({ requestId: z.string().min(1) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.insert(auditLog).values({ action: "card_approved", resource: "card_request", resourceId: input.requestId, status: "success", metadata: {} });
    return { requestId: input.requestId, status: "approved" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "card_request"));
    const [approved] = await db.select({ value: count() }).from(auditLog).where(and(eq(auditLog.resource, "card_request"), eq(auditLog.action, "card_approved")));
    return { totalRequests: Number(total.value), approvedRequests: Number(approved.value) };
  }),
});
