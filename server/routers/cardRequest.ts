import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { agents, auditLog } from "../../drizzle/schema";

export const cardRequestRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalRequests: 0, pending: 0, approved: 0, shipped: 0, delivered: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "card_requests")).orderBy(desc(auditLog.createdAt)).limit(500);
    const statusMap: Record<string, number> = {};
    rows.forEach(r => { const s = (r.metadata as any)?.status ?? "pending"; statusMap[s] = (statusMap[s] || 0) + 1; });
    return { totalRequests: rows.length, pending: statusMap["pending"] ?? 0, approved: statusMap["approved"] ?? 0, shipped: statusMap["shipped"] ?? 0, delivered: statusMap["delivered"] ?? 0 };
  }),
  list: protectedProcedure.input(z.object({ status: z.string().optional(), agentId: z.number().optional(), limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { requests: [], total: 0 };
    const conditions: any[] = [eq(auditLog.resource, "card_requests")];
    if (input?.status) conditions.push(sql`${auditLog.metadata}->>'status' = ${input.status}`);
    const rows = await db.select().from(auditLog).where(and(...conditions)).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { requests: rows.map(r => ({ id: r.id, ...r.metadata as any, createdAt: r.createdAt })), total: rows.length };
  }),
  submitRequest: protectedProcedure.input(z.object({ agentId: z.number(), cardType: z.enum(["debit", "prepaid", "virtual"]), quantity: z.number().min(1).max(100), deliveryAddress: z.string() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const requestId = "CARD-" + Date.now().toString(36).toUpperCase();
    await db.insert(auditLog).values({ action: "card_request_submitted", resource: "card_requests", resourceId: requestId, status: "success", metadata: { agentId: input.agentId, cardType: input.cardType, quantity: input.quantity, deliveryAddress: input.deliveryAddress, status: "pending" } });
    return { success: true, requestId };
  }),
  updateStatus: protectedProcedure.input(z.object({ requestId: z.string(), status: z.enum(["approved", "rejected", "shipped", "delivered"]) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(auditLog).values({ action: "card_request_status_updated", resource: "card_requests", resourceId: input.requestId, status: "success", metadata: { newStatus: input.status } });
    return { success: true };
  }),
});
