/**
 * Mesh Payments router
 * Cross-border micro-payment routing across African corridors.
 * Uses the wallet tables for balance tracking.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { walletBalances, walletTransactions, meshTransactions } from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";

// Supported mesh corridors
export const MESH_CORRIDORS = [
  { id: "NG-GH", from: "NG", to: "GH", fromCurrency: "NGN", toCurrency: "GHS", rate: 0.0032, fee: 0.005 },
  { id: "KE-TZ", from: "KE", to: "TZ", fromCurrency: "KES", toCurrency: "TZS", rate: 22.4, fee: 0.004 },
  { id: "ZA-ZW", from: "ZA", to: "ZW", fromCurrency: "ZAR", toCurrency: "USD", rate: 0.054, fee: 0.006 },
  { id: "GH-CI", from: "GH", to: "CI", fromCurrency: "GHS", toCurrency: "XOF", rate: 55.2, fee: 0.005 },
  { id: "NG-KE", from: "NG", to: "KE", fromCurrency: "NGN", toCurrency: "KES", rate: 0.21, fee: 0.007 },
  { id: "EG-NG", from: "EG", to: "NG", fromCurrency: "EGP", toCurrency: "NGN", rate: 6.8, fee: 0.006 },
];

export const meshPaymentsRouter = router({
  // List available corridors with live-ish rates
  listCorridors: protectedProcedure.query(() => {
    // Return stable rates — fluctuation should come from a real FX feed in production
    return MESH_CORRIDORS.map((c) => ({ ...c }));
  }),

  // Get a quote for a mesh transfer
  getQuote: protectedProcedure
    .input(
      z.object({
        corridorId: z.string().min(1),
        amount: z.number().positive(),
      })
    )
    .query(({ input }) => {
      const corridor = MESH_CORRIDORS.find((c) => c.id === input.corridorId);
      if (!corridor) throw new TRPCError({ code: "NOT_FOUND", message: "Corridor not found" });
      const fee = input.amount * corridor.fee;
      const netAmount = input.amount - fee;
      const receivedAmount = netAmount * corridor.rate;
      return {
        corridorId: corridor.id,
        sendAmount: input.amount,
        sendCurrency: corridor.fromCurrency,
        fee: Math.round(fee * 100) / 100,
        netAmount: Math.round(netAmount * 100) / 100,
        receivedAmount: Math.round(receivedAmount * 100) / 100,
        receiveCurrency: corridor.toCurrency,
        rate: corridor.rate,
        // Deterministic estimate based on corridor: instant (XLM/CBDC) vs bank (2-5 min)
        estimatedMinutes: corridor.fee <= 0.005 ? 1 : corridor.fee <= 0.006 ? 2 : 3,
        expiresAt: Date.now() + 5 * 60 * 1000,
      };
    }),

  // Execute a mesh payment (deducts from wallet)
  send: protectedProcedure
    .input(
      z.object({
        corridorId: z.string().min(1),
        amount: z.number().positive(),
        recipientAddress: z.string().min(1).max(200),
        recipientName: z.string().max(200).optional(),
        note: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const corridor = MESH_CORRIDORS.find((c) => c.id === input.corridorId);
      if (!corridor) throw new TRPCError({ code: "NOT_FOUND", message: "Corridor not found" });

      const fee = input.amount * corridor.fee;
      const total = input.amount + fee;

      // Atomic balance deduction — prevents double-spend under concurrency
      const debitResult = await db.execute(
        sql`UPDATE wallet_balances
            SET balance = CAST(balance AS DECIMAL(30,8)) - ${total},
                updated_at = ${Math.floor(Date.now() / 1000)}
            WHERE user_id = ${String(ctx.user.id)}
              AND currency = ${corridor.fromCurrency}
              AND CAST(balance AS DECIMAL(30,8)) >= ${total}
            RETURNING id, balance`
      );
      if (!(debitResult as any[])[0]) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient balance. Required: ${total.toFixed(2)} ${corridor.fromCurrency}` });
      }

      const txRef = `MESH-${Date.now().toString(36).toUpperCase()}`;
      const [tx] = await db
        .insert(walletTransactions)
        .values({
          userId: String(ctx.user.id),
          type: "send",
          status: "completed",
          fromCurrency: corridor.fromCurrency,
          toCurrency: corridor.toCurrency,
          amount: String(input.amount),
          toAmount: String(Math.round(input.amount * corridor.rate * 100) / 100),
          fee: String(fee.toFixed(6)),
          counterparty: input.recipientName ?? input.recipientAddress,
          counterpartyAddress: input.recipientAddress,
          reference: txRef,
          note: input.note,
          completedAt: Math.floor(Date.now() / 1000),
        })
        .returning();

      // Also insert into dedicated meshTransactions table
      const convertedAmt = Math.round(input.amount * corridor.rate * 100) / 100;
      await db.insert(meshTransactions).values({
        userId: String(ctx.user.id),
        corridorId: corridor.id,
        fromCurrency: corridor.fromCurrency,
        toCurrency: corridor.toCurrency,
        amount: String(input.amount),
        convertedAmount: String(convertedAmt),
        feeAmount: String(fee.toFixed(6)),
        exchangeRate: String(corridor.rate),
        recipientAddress: input.recipientAddress,
        status: "completed",
        txHash: txRef,
        completedAt: Math.floor(Date.now() / 1000),
      });

      return { ...tx, txRef };
    }),

  // History of mesh transactions for the current user (from dedicated meshTransactions table)
  history: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(meshTransactions)
        .where(eq(meshTransactions.userId, String(ctx.user.id)))
        .orderBy(desc(meshTransactions.createdAt))
        .limit(input.limit);
    }),

  // Stats for the MeshPayments page
  stats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { totalSent: 0, totalTransactions: 0, activeCorridors: MESH_CORRIDORS.length };
    const txs = await db
      .select()
      .from(meshTransactions)
      .where(eq(meshTransactions.userId, String(ctx.user.id)));
    const totalSent = txs.reduce((s, t) => s + parseFloat(t.amount), 0);
    return {
      totalSent: Math.round(totalSent * 100) / 100,
      totalTransactions: txs.length,
      activeCorridors: MESH_CORRIDORS.length,
    };
  }),
});
