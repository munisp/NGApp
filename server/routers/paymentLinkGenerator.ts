import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum } from "drizzle-orm";
import { transactions, auditLog } from "../../drizzle/schema";

export const paymentLinkGeneratorRouter = router({
  listLinks: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "payment_link_created")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
    return { links: rows.map(r => ({ id: r.resourceId, metadata: r.metadata, createdAt: r.createdAt, status: r.status })), total: rows.length };
  }),
  createLink: protectedProcedure.input(z.object({ amount: z.number().positive(), currency: z.string().default("NGN"), description: z.string(), expiresInHours: z.number().default(24), merchantId: z.number().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const linkId = "pay-" + crypto.randomUUID().slice(0, 12);
    await db.insert(auditLog).values({ action: "payment_link_created", resource: "payment_links", resourceId: linkId, status: "active", metadata: { amount: input.amount, currency: input.currency, description: input.description, expiresInHours: input.expiresInHours } });
    return { linkId, url: `https://pay.54link.com/${linkId}`, amount: input.amount, currency: input.currency, expiresAt: new Date(Date.now() + input.expiresInHours * 3600000).toISOString() };
  }),
  deactivateLink: protectedProcedure.input(z.object({ linkId: z.string() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.insert(auditLog).values({ action: "payment_link_deactivated", resource: "payment_links", resourceId: input.linkId, status: "success", metadata: {} });
    return { success: true, linkId: input.linkId };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.action, "payment_link_created"));
    return { totalLinks: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
