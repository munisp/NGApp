import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { transactions, agents, auditLog } from "../../drizzle/schema";

const PENSION_LIMITS = { minAmount: 500, maxAmount: 5_000_000, pfaCodePattern: /^PFA\/\d{4,}$/i };

export const pensionCollectionRouter = router({
  listCollections: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), agentId: z.number().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [eq(transactions.type, "Pension")];
    if (input?.agentId) conditions.push(eq(transactions.agentId, input.agentId));
    const rows = await db.select().from(transactions).where(and(...conditions)).orderBy(desc(transactions.createdAt)).limit(input?.limit ?? 50);
    return { collections: rows, total: rows.length };
  }),
  collectPension: protectedProcedure.input(z.object({ contributorId: z.string().min(6).max(20), amount: z.number().min(500).max(5_000_000), pfaCode: z.string().min(4).max(20), rsaPin: z.string().min(10).max(20), agentId: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [agent] = await db.select().from(agents).where(eq(agents.id, input.agentId)).limit(1);
    if (!agent) throw new Error("Agent not found");
    if (!agent.isActive) throw new Error("Agent account is suspended");
    const commission = Math.round(input.amount * 0.005);
    const reference = "PEN-" + crypto.randomUUID().slice(0, 12).toUpperCase();
    const [tx] = await db.insert(transactions).values({ agentId: input.agentId, amount: String(input.amount), fee: String(Math.round(input.amount * 0.01)), commission: String(commission), type: "Pension", status: "success", channel: "POS", reference }).returning();
    await db.insert(auditLog).values({ action: "pension_collected", resource: "pension_collection", resourceId: reference, status: "success", metadata: { contributorId: input.contributorId, pfaCode: input.pfaCode, amount: input.amount, transactionId: tx.id, commission } });
    return { reference, transactionId: tx.id, amount: input.amount, commission, status: "success" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [stats] = await db.select({ totalCollections: count(), totalVolume: sum(sql`CAST(amount AS numeric)`) }).from(transactions).where(eq(transactions.type, "Pension"));
    return { totalCollections: Number(stats.totalCollections), totalVolume: Number(stats.totalVolume ?? 0) };
  }),
});
