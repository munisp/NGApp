import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum } from "drizzle-orm";
import { transactions, auditLog } from "../../drizzle/schema";

export const cbdcIntegrationGatewayRouter = router({
  getStatus: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [config] = await db.select().from(auditLog).where(eq(auditLog.resource, "cbdc_gateway")).orderBy(desc(auditLog.createdAt)).limit(1);
    return { connected: !!config, lastHeartbeat: config?.createdAt ?? null, currency: "eNaira", issuer: "CBN" };
  }),
  listTransfers: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "cbdc_transfer")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
    return { transfers: rows.map(r => ({ id: r.resourceId, status: r.status, metadata: r.metadata, timestamp: r.createdAt })), total: rows.length };
  }),
  initiateTransfer: protectedProcedure.input(z.object({ fromWallet: z.string(), toWallet: z.string(), amount: z.number().positive(), currency: z.string().default("eNaira") })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const transferId = "cbdc-" + crypto.randomUUID();
    await db.insert(auditLog).values({ action: "cbdc_transfer_initiated", resource: "cbdc_transfer", resourceId: transferId, status: "success", metadata: { fromWallet: input.fromWallet, toWallet: input.toWallet, amount: input.amount, currency: input.currency } });
    return { transferId, status: "completed", amount: input.amount, currency: input.currency };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "cbdc_transfer"));
    return { totalTransfers: Number(total.value), currency: "eNaira", lastUpdated: new Date().toISOString() };
  }),
});
