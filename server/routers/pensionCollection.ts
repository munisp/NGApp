import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum } from "drizzle-orm";
import { transactions, agents, auditLog } from "../../drizzle/schema";

export const pensionCollectionRouter = router({
  listCollections: protectedProcedure.input(z.object({ limit: z.number().default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "pension_collection")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
    return { collections: rows.map(r => ({ id: r.resourceId, status: r.status, metadata: r.metadata, collectedAt: r.createdAt })), total: rows.length };
  }),
  collectPension: protectedProcedure.input(z.object({ contributorId: z.string(), amount: z.number().positive(), pfaCode: z.string(), rsaPin: z.string(), agentId: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const collectionId = "pen-" + crypto.randomUUID();
    const [tx] = await db.insert(transactions).values({ agentId: input.agentId, amount: String(input.amount), type: "Pension", status: "success", channel: "POS", reference: collectionId }).returning();
    await db.insert(auditLog).values({ action: "pension_collected", resource: "pension_collection", resourceId: collectionId, status: "success", metadata: { contributorId: input.contributorId, pfaCode: input.pfaCode, amount: input.amount, transactionId: tx.id } });
    return { collectionId, transactionId: tx.id, amount: input.amount, status: "success" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "pension_collection"));
    return { totalCollections: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
