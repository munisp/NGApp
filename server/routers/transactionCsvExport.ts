import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, gte, lte } from "drizzle-orm";
import { transactions, auditLog } from "../../drizzle/schema";

export const transactionCsvExportRouter = router({
  exportTransactions: protectedProcedure.input(z.object({ dateFrom: z.string().optional(), dateTo: z.string().optional(), status: z.string().optional(), type: z.string().optional(), limit: z.number().default(1000) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [];
    if (input.dateFrom) conditions.push(gte(transactions.createdAt, new Date(input.dateFrom)));
    if (input.dateTo) conditions.push(lte(transactions.createdAt, new Date(input.dateTo)));
    if (input.status) conditions.push(eq(transactions.status, input.status));
    if (input.type) conditions.push(eq(transactions.type, input.type));
    const rows = conditions.length > 0 ? await db.select().from(transactions).where(and(...conditions)).orderBy(desc(transactions.createdAt)).limit(input.limit) : await db.select().from(transactions).orderBy(desc(transactions.createdAt)).limit(input.limit);
    const header = "id,amount,type,status,channel,reference,createdAt";
    const csvRows = rows.map(r => `${r.id},${r.amount},${r.type},${r.status},${r.channel},${r.reference},${r.createdAt}`);
    await db.insert(auditLog).values({ action: "csv_export", resource: "transactions", resourceId: "export-" + crypto.randomUUID(), status: "success", metadata: { rowCount: rows.length, filters: { dateFrom: input.dateFrom, dateTo: input.dateTo, status: input.status } } });
    return { csv: [header, ...csvRows].join("\n"), rowCount: rows.length, exportedAt: new Date().toISOString() };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.action, "csv_export"));
    return { totalExports: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
