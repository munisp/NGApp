import { TRPCError } from "@trpc/server";
/**
 * server/routers/ledger.ts — tRPC router for TigerBeetle production ledger
 *
 * Provides double-entry accounting for production volume allocation.
 * All volumes are stored as integer units × 1000 (millibbl or mscf).
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getAccountBalance,
  getTransfers,
  recordTransfer,
  ensureAccount,
  LEDGER_IDS,
  LEDGER_CODES,
} from "../tigerBeetleClient";
import { getDb } from "../db";
import { wells } from "../../drizzle/schema";

export const ledgerRouter = router({
  /**
   * Get the current production balance for a well account.
   */
  getWellBalance: protectedProcedure
    .input(z.object({ wellId: z.string() }))
    .query(async ({ input }) => {
      await ensureAccount(input.wellId, LEDGER_IDS.PRODUCTION, LEDGER_CODES.OIL_BBL);
      return getAccountBalance(input.wellId);
    }),

  /**
   * Get balances for all wells in a field.
   */
  getFieldAllocation: protectedProcedure
    .input(z.object({ fieldId: z.string() }))
    .query(async ({ input }) => {
      try {
        await ensureAccount(input.fieldId, LEDGER_IDS.ALLOCATION, LEDGER_CODES.OIL_BBL);
        return getAccountBalance(input.fieldId);
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  /**
   * Get transfer history for a well or field account.
   */
  getHistory: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        limit: z.number().int().min(1).max(200).default(50),
      })
    )
    .query(async ({ input }) => {
      return getTransfers(input.accountId, input.limit);
    }),

  /**
   * Record a production allocation transfer.
   * Creates a double-entry: debit field account, credit well account.
   */
  recordTransfer: protectedProcedure
    .input(
      z.object({
        wellId: z.string(),
        fieldId: z.string(),
        oilVolumeMillibbl: z.number().int().min(0).optional(),
        gasVolumeMscf: z.number().int().min(0).optional(),
        waterVolumeMillibbl: z.number().int().min(0).optional(),
        date: z.string(), // ISO date string
      })
    )
    .mutation(async ({ input }) => {
      try {
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
      const transferId = `${input.wellId}-${input.fieldId}-${Date.now()}`;

      // Ensure accounts exist
      await Promise.all([
        ensureAccount(input.wellId, LEDGER_IDS.PRODUCTION, LEDGER_CODES.OIL_BBL),
        ensureAccount(input.fieldId, LEDGER_IDS.ALLOCATION, LEDGER_CODES.OIL_BBL),
      ]);

      const transfers: Promise<void>[] = [];

      if (input.oilVolumeMillibbl && input.oilVolumeMillibbl > 0) {
        transfers.push(recordTransfer({
          id: `${transferId}-oil`,
          debitAccountId: input.fieldId,
          creditAccountId: input.wellId,
          amount: input.oilVolumeMillibbl,
          ledger: LEDGER_IDS.PRODUCTION,
          code: LEDGER_CODES.OIL_BBL,
        }));
      }

      if (input.gasVolumeMscf && input.gasVolumeMscf > 0) {
        transfers.push(recordTransfer({
          id: `${transferId}-gas`,
          debitAccountId: input.fieldId,
          creditAccountId: input.wellId,
          amount: input.gasVolumeMscf,
          ledger: LEDGER_IDS.PRODUCTION,
          code: LEDGER_CODES.GAS_MSCF,
        }));
      }

      if (input.waterVolumeMillibbl && input.waterVolumeMillibbl > 0) {
        transfers.push(recordTransfer({
          id: `${transferId}-water`,
          debitAccountId: input.fieldId,
          creditAccountId: input.wellId,
          amount: input.waterVolumeMillibbl,
          ledger: LEDGER_IDS.PRODUCTION,
          code: LEDGER_CODES.WATER_BBL,
        }));
      }

      await Promise.all(transfers);

      return {
        transferId,
        wellId: input.wellId,
        fieldId: input.fieldId,
        date: input.date,
        transfers: transfers.length,
      };
    }),

  /**
   * Get a portfolio summary: balances for all wells.
   * Used by the Production Allocation ledger tab.
   */
  getPortfolioSummary: protectedProcedure.query(async () => {
    // Fetch all wells from DB
    const db = await getDb();
    const wellRows = db ? await db.select({ id: wells.wellId, name: wells.name }).from(wells).limit(20) : [];

    const balances = await Promise.all(
      wellRows.map(async (well) => {
        try {
          const balance = await getAccountBalance(well.id);
          return { wellName: well.name, ...balance };
        } catch (err: unknown) {
          if (err instanceof TRPCError) throw err;
          const msg = err instanceof Error ? err.message : String(err);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
        }
      })
    );

    const totalCredits = balances.reduce((s: number, b: { credits: number }) => s + b.credits, 0);
    const totalDebits = balances.reduce((s: number, b: { debits: number }) => s + b.debits, 0);

    return {
      wells: balances,
      totalCredits,
      totalDebits,
      netBalance: totalCredits - totalDebits,
    };
  }),
});
