import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { transactions, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const savingsProductsRouter = router({
  listAccounts: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(200).default(50),
          agentId: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      try {
        const db = (await getDb())!;
        const conditions = [];
        if (input?.agentId)
          conditions.push(eq(transactions.agentId, input.agentId));
        const rows = await db
          .select()
          .from(transactions)
          .where(conditions.length ? and(...conditions) : undefined)
          .orderBy(desc(transactions.createdAt))
          .limit(input?.limit ?? 50);
        return { accounts: rows, total: rows.length };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Internal server error",
        });
      }
    }),
  deposit: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        amount: z.number().positive().max(10_000_000),
        agentId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const db = (await getDb())!;
        const ref = "SAV-" + crypto.randomUUID().slice(0, 12).toUpperCase();
        const [tx] = await db
          .insert(transactions)
          .values({
            agentId: input.agentId ?? input.accountId,
            amount: String(input.amount),
            type: "Cash In",
            status: "success",
            channel: "Cash",
            ref,
          })
          .returning();
        await db.insert(auditLog).values({
          action: "savings_deposit",
          resource: "savings_transactions",
          resourceId: String(tx.id),
          status: "success",
          metadata: {
            accountId: input.accountId,
            amount: input.amount,
            type: "deposit",
          },
        });
        return {
          id: tx.id,
          accountId: input.accountId,
          amount: input.amount,
          type: "deposit",
          ref,
          status: "success",
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Internal server error",
        });
      }
    }),
  withdraw: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        amount: z.number().positive().max(5_000_000),
        agentId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const db = (await getDb())!;
        const ref = "SAV-W-" + crypto.randomUUID().slice(0, 12).toUpperCase();
        const [tx] = await db
          .insert(transactions)
          .values({
            agentId: input.agentId ?? input.accountId,
            amount: String(input.amount),
            type: "Cash Out",
            status: "success",
            channel: "Cash",
            ref,
          })
          .returning();
        await db.insert(auditLog).values({
          action: "savings_withdrawal",
          resource: "savings_transactions",
          resourceId: String(tx.id),
          status: "success",
          metadata: {
            accountId: input.accountId,
            amount: input.amount,
            type: "withdrawal",
          },
        });
        return {
          id: tx.id,
          accountId: input.accountId,
          amount: input.amount,
          type: "withdrawal",
          ref,
          status: "success",
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Internal server error",
        });
      }
    }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totals] = await db
      .select({ total: count(), volume: sum(transactions.amount) })
      .from(transactions)
      .limit(100);
    return {
      totalAccounts: 0,
      totalDeposits: Number(totals.total),
      totalVolume: Number(totals.volume ?? 0),
    };
  }),
});
