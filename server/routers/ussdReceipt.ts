import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { transactions, auditLog } from "../../drizzle/schema";

export const ussdReceiptRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalReceipts: 0, smsReceipts: 0, ussdReceipts: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "receipt_generated")).orderBy(desc(auditLog.createdAt)).limit(500);
    return { totalReceipts: rows.length, smsReceipts: rows.filter(r => (r.metadata as any)?.channel === "sms").length, ussdReceipts: rows.filter(r => (r.metadata as any)?.channel === "ussd").length };
  }),
  generateReceipt: protectedProcedure.input(z.object({ transactionId: z.number(), channel: z.enum(["sms", "ussd", "email"]).default("sms"), phone: z.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const txRows = await db.select().from(transactions).where(eq(transactions.id, input.transactionId)).limit(1);
    if (txRows.length === 0) return { success: false, error: "Transaction not found" };
    const tx = txRows[0];
    const receiptId = "RCP-" + crypto.randomUUID().toUpperCase();
    await db.insert(auditLog).values({ action: "receipt_generated", resource: "receipts", resourceId: receiptId, status: "success", metadata: { transactionId: input.transactionId, channel: input.channel, amount: tx.amount, type: tx.type } });
    return { success: true, receiptId, receipt: { id: receiptId, transactionId: input.transactionId, amount: tx.amount, type: tx.type, channel: input.channel, generatedAt: new Date().toISOString() } };
  }),
  getReceipt: protectedProcedure.input(z.object({ receiptId: z.string() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(auditLog).where(and(eq(auditLog.action, "receipt_generated"), eq(auditLog.resourceId, input.receiptId))).limit(1);
    if (rows.length === 0) return null;
    return { id: rows[0].resourceId, ...rows[0].metadata as any, createdAt: rows[0].createdAt };
  }),
  resendReceipt: protectedProcedure.input(z.object({ receiptId: z.string(), channel: z.enum(["sms", "ussd", "email"]), phone: z.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(auditLog).values({ action: "receipt_resent", resource: "receipts", resourceId: input.receiptId, status: "success", metadata: { channel: input.channel, phone: input.phone } });
    return { success: true };
  }),
});
