import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum } from "drizzle-orm";
import { transactions, agents, auditLog } from "../../drizzle/schema";

export const taxCollectionRouter = router({
  listCollections: protectedProcedure.input(z.object({ limit: z.number().default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "tax_collection")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
    return { collections: rows.map(r => ({ id: r.resourceId, status: r.status, metadata: r.metadata, collectedAt: r.createdAt })), total: rows.length };
  }),
  collectTax: protectedProcedure.input(z.object({ taxpayerId: z.string(), taxType: z.enum(["PAYE", "VAT", "WHT", "CIT", "CGT", "stamp_duty"]), amount: z.number().positive(), period: z.string(), agentId: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const collectionId = "tax-" + crypto.randomUUID();
    const [tx] = await db.insert(transactions).values({ agentId: input.agentId, amount: String(input.amount), type: "Tax", status: "success", channel: "POS", reference: collectionId }).returning();
    await db.insert(auditLog).values({ action: "tax_collected", resource: "tax_collection", resourceId: collectionId, status: "success", metadata: { taxpayerId: input.taxpayerId, taxType: input.taxType, amount: input.amount, period: input.period, transactionId: tx.id } });
    return { collectionId, transactionId: tx.id, amount: input.amount, taxType: input.taxType, status: "success" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "tax_collection"));
    return { totalCollections: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
