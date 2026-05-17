// @ts-ignore
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { transactions, agents } from "../../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";

interface AcquirerConfig {
  acquirerId: string;
  name: string;
  mcc: string;
  terminalPrefix: string;
  settlementCycle: "T+0" | "T+1" | "T+2";
  feePercent: number;
}

const ACQUIRER_CONFIGS: AcquirerConfig[] = [
  { acquirerId: "ACQ001", name: "Primary Bank", mcc: "5411", terminalPrefix: "PB", settlementCycle: "T+1", feePercent: 1.5 },
  { acquirerId: "ACQ002", name: "Mobile Money", mcc: "6012", terminalPrefix: "MM", settlementCycle: "T+0", feePercent: 0.8 },
  { acquirerId: "ACQ003", name: "Card Network", mcc: "5999", terminalPrefix: "CN", settlementCycle: "T+2", feePercent: 2.2 },
];

function selectAcquirer(amount: number, paymentMethod: string): AcquirerConfig {
  if (paymentMethod === "mobile_money") return ACQUIRER_CONFIGS[1];
  if (amount > 100000) return ACQUIRER_CONFIGS[0];
  return ACQUIRER_CONFIGS[2];
}

function calculateFee(amount: number, acquirer: AcquirerConfig): number {
  return Math.round(amount * acquirer.feePercent / 100);
}

export const merchantAcquirerGatewayRouter = router({
  processPayment: protectedProcedure
    .input(z.object({
      merchantId: z.string(),
      amount: z.number().positive(),
      currency: z.string().default("KES"),
      paymentMethod: z.enum(["card", "mobile_money", "bank_transfer"]),
      cardLast4: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const acquirer = selectAcquirer(input.amount, input.paymentMethod);
      const fee = calculateFee(input.amount, acquirer);
      const netAmount = input.amount - fee;
      return {
        transactionId: `TXN-\${Date.now()}`,
        acquirer: acquirer.name,
        acquirerId: acquirer.acquirerId,
        grossAmount: input.amount,
        fee,
        netAmount,
        settlementCycle: acquirer.settlementCycle,
        status: "authorized",
      };
    }),

  listAcquirers: protectedProcedure.query(async () => {
    return { acquirers: ACQUIRER_CONFIGS };
  }),

  getSettlementForecast: protectedProcedure
    .input(z.object({ merchantId: z.string(), days: z.number().default(7) }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const rows = await db.select().from(transactions).limit(100).orderBy(desc(transactions.createdAt));
      const dailyAvg = rows.length > 0 ? rows.reduce((sum: any, r: any) => sum + Number(r.amount || 0), 0) / Math.max(rows.length, 1) : 0;
      return { forecastDays: input.days, estimatedDailySettlement: dailyAvg, totalForecast: dailyAvg * input.days };
    }),

  getMerchantStats: protectedProcedure
    .input(z.object({ merchantId: z.string() }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const result = await db.select({ count: sql<number>`count(*)`, total: sql<number>`COALESCE(sum(amount), 0)` }).from(transactions);
      return { totalTransactions: result[0]?.count || 0, totalVolume: result[0]?.total || 0, avgTransactionSize: (result[0]?.total || 0) / Math.max(result[0]?.count || 1, 1) };
    }),
  getStats: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      return {} as any;
    }),
  listMerchants: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      return {} as any;
    }),
  onboardMerchant: protectedProcedure
    .input(z.object({}))
    .mutation(async ({ ctx, input }) => {
      return { success: true } as any;
    }),
});
