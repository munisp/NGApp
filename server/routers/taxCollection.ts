import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { transactions, vatRecords, agents, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const taxCollectionRouter = router({
  listCollections: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), taxType: z.enum(["VAT", "WHT", "PAYE", "CIT"]).optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select().from(vatRecords).orderBy(desc(vatRecords.createdAt)).limit(input?.limit ?? 50);
      return { collections: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  collectTax: protectedProcedure.input(z.object({ taxpayerId: z.string().min(6).max(20), amount: z.number().positive().max(50_000_000), taxType: z.enum(["VAT", "WHT", "PAYE", "CIT"]), period: z.string(), agentId: z.number() })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [agent] = await db.select().from(agents).where(eq(agents.id, input.agentId)).limit(1);
      if (!agent) throw new Error("Agent not found");
      const ref = "TAX-" + crypto.randomUUID().slice(0, 12).toUpperCase();
      const [tx] = await db.insert(transactions).values({ agentId: input.agentId, amount: String(input.amount), type: "Bill Payment", status: "success", channel: "Cash", ref }).returning();
      await db.insert(auditLog).values({ action: "tax_collected", resource: "tax_collection", resourceId: ref, status: "success", metadata: { taxpayerId: input.taxpayerId, taxType: input.taxType, period: input.period, amount: input.amount, transactionId: tx.id } });
      return { ref, transactionId: tx.id, amount: input.amount, taxType: input.taxType, status: "success" };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [stats] = await db.select({ totalCollections: count(), totalVolume: sum(transactions.amount) }).from(vatRecords).limit(100);
    return { totalCollections: Number(stats.totalCollections), totalVolume: Number(stats.totalVolume ?? 0) };
  }),
});
