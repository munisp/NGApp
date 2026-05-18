import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum } from "drizzle-orm";
import { transactions, auditLog } from "../../drizzle/schema";

export const smartContractPaymentRouter = router({
  listContracts: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "smart_contract")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { contracts: rows.map(r => ({ id: r.resourceId, action: r.action, status: r.status, metadata: r.metadata, timestamp: r.createdAt })), total: rows.length };
  }),
  deployContract: protectedProcedure.input(z.object({ name: z.string(), type: z.enum(["escrow", "recurring", "conditional", "milestone"]), conditions: z.record(z.string(), z.unknown()).optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const contractId = "sc-" + crypto.randomUUID();
    await db.insert(auditLog).values({ action: "smart_contract_deployed", resource: "smart_contract", resourceId: contractId, status: "success", metadata: { name: input.name, type: input.type, conditions: input.conditions } });
    return { contractId, name: input.name, type: input.type, status: "deployed" };
  }),
  executePayment: protectedProcedure.input(z.object({ contractId: z.string(), amount: z.number().positive(), agentId: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [tx] = await db.insert(transactions).values({ agentId: input.agentId, amount: String(input.amount), type: "Smart Contract", status: "success", channel: "Blockchain", reference: input.contractId }).returning();
    await db.insert(auditLog).values({ action: "smart_contract_payment", resource: "smart_contract", resourceId: input.contractId, status: "success", metadata: { amount: input.amount, transactionId: tx.id } });
    return { success: true, transactionId: tx.id };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "smart_contract"));
    return { totalContracts: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
