import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { transactions, auditLog } from "../../drizzle/schema";

export const transactionExportEngineRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalExports: 0, pendingExports: 0, exportFormats: 3 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "transaction_export")).orderBy(desc(auditLog.createdAt)).limit(100);
    return { totalExports: rows.length, pendingExports: rows.filter(r => r.status === "warning").length, exportFormats: 3 };
  }),
  export: protectedProcedure.input(z.object({ format: z.enum(["csv", "xlsx", "pdf"]).default("csv"), dateFrom: z.string().optional(), dateTo: z.string().optional(), agentId: z.number().optional(), status: z.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const exportId = "EXP-" + Date.now().toString(36).toUpperCase();
    const conditions: any[] = [];
    if (input.dateFrom) conditions.push(gte(transactions.createdAt, new Date(input.dateFrom)));
    if (input.dateTo) conditions.push(lte(transactions.createdAt, new Date(input.dateTo)));
    if (input.agentId) conditions.push(eq(transactions.agentId, input.agentId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [{ value: txCount }] = await db.select({ value: count() }).from(transactions).where(where);
    await db.insert(auditLog).values({ action: "transaction_export", resource: "exports", resourceId: exportId, status: "success", metadata: { format: input.format, transactionCount: Number(txCount), dateFrom: input.dateFrom, dateTo: input.dateTo } });
    return { success: true, exportId, transactionCount: Number(txCount), format: input.format };
  }),
  listExports: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { exports: [], total: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "transaction_export")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { exports: rows.map(r => ({ id: r.id, exportId: r.resourceId, ...r.metadata as any, createdAt: r.createdAt })), total: rows.length };
  }),
});
