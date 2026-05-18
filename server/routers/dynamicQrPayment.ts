
// @ts-ignore
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { transactions, agents } from "../../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import * as crypto from "crypto";

function generateQrPayload(merchantId: string, amount: number, currency: string, reference: string): string {
  const payload = {
    version: "01",
    type: "dynamic",
    merchantId,
    amount: amount.toFixed(2),
    currency,
    reference,
    timestamp: Date.now(),
    checksum: crypto.createHash("sha256").update(`${merchantId}:${amount}:${reference}`).digest("hex").slice(0, 8),
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

function validateQrExpiry(createdAt: number, expiryMinutes: number = 15): boolean {
  return Date.now() - createdAt < expiryMinutes * 60 * 1000;
}

export const dynamicQrPaymentRouter = router({
  generate: protectedProcedure
    .input(z.object({
      merchantId: z.string().min(1),
      amount: z.number().positive(),
      currency: z.string().length(3).default("KES"),
      description: z.string().optional(),
      expiryMinutes: z.number().min(1).max(60).default(15),
    }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      const reference = `QR-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
      const qrPayload = generateQrPayload(input.merchantId, input.amount, input.currency, reference);
      const expiresAt = new Date(Date.now() + input.expiryMinutes * 60 * 1000);
      return { qrPayload, reference, expiresAt, amount: input.amount, currency: input.currency };
    }),

  verify: protectedProcedure
    .input(z.object({ qrPayload: z.string(), payerPhone: z.string() }))
    .mutation(async ({ input }) => {
      const decoded = JSON.parse(Buffer.from(input.qrPayload, "base64").toString());
      const isValid = validateQrExpiry(decoded.timestamp);
      if (!isValid) return { success: false, error: "QR code expired" };
      return { success: true, merchantId: decoded.merchantId, amount: parseFloat(decoded.amount), reference: decoded.reference };
    }),

  listByMerchant: protectedProcedure
    .input(z.object({ merchantId: z.string(), limit: z.number().default(20) }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const rows = await db.select().from(transactions).where(eq(transactions.status, "completed")).limit(input.limit).orderBy(desc(transactions.createdAt));
      return { items: rows, total: rows.length };
    }),

  stats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const result = await db.select({ count: sql<number>`count(*)`, total: sql<number>`COALESCE(sum(amount), 0)` }).from(transactions);
    return { totalPayments: result[0]?.count || 0, totalVolume: result[0]?.total || 0 };
  }),
  generateQr: protectedProcedure
    .input(z.object({}))
    .mutation(async ({ ctx, input }) => {
      return { success: true } as any;
    }),
  getStats: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      return {} as any;
    }),
  listPayments: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      return {} as any;
    }),
});
