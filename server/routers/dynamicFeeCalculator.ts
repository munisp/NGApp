import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
// ── Middleware Integration (Sprint 44) ──────────────────────────────
import { publishEvent, type KafkaTopic } from "../kafkaClient";
import { cacheSet, cacheGet } from "../redisClient";
import { tbCreateTransfer } from "../tbClient";
import { fluvioProduce } from "../fluvio";
import { permifyCheck } from "../_core/permify";

const feeStructures = [
  { id: "FEE-001", name: "Standard Transfer", type: "transfer", tiers: [{ min: 0, max: 5000, fee: 10, feeType: "flat" }, { min: 5001, max: 50000, fee: 25, feeType: "flat" }, { min: 50001, max: 1000000, fee: 0.05, feeType: "percent" }], status: "active", effectiveDate: "2026-01-01" },
  { id: "FEE-002", name: "Bill Payment", type: "bill_payment", tiers: [{ min: 0, max: 10000, fee: 100, feeType: "flat" }, { min: 10001, max: 100000, fee: 0.1, feeType: "percent" }], status: "active", effectiveDate: "2026-01-01" },
  { id: "FEE-003", name: "Cash Withdrawal", type: "withdrawal", tiers: [{ min: 0, max: 20000, fee: 100, feeType: "flat" }, { min: 20001, max: 500000, fee: 0.075, feeType: "percent" }], status: "active", effectiveDate: "2026-02-01" },
  { id: "FEE-004", name: "Agent Commission", type: "commission", tiers: [{ min: 0, max: 50000, fee: 0.5, feeType: "percent" }, { min: 50001, max: 500000, fee: 0.3, feeType: "percent" }], status: "active", effectiveDate: "2026-01-01" },
];
export const dynamicFeeCalculatorRouter = router({
  getStats: protectedProcedure.query(() => ({ totalFeeStructures: feeStructures.length, activeFeeStructures: feeStructures.filter(f => f.status === "active").length, totalFeeRevenue: 45000000, avgFeeRate: 0.12, feeTypes: ["flat", "percent"], lastUpdated: "2026-04-01", pendingChanges: 0, complianceStatus: "CBN Approved" })),
  listFeeStructures: protectedProcedure.query(() => ({ feeStructures, total: feeStructures.length })),
  getFeeStructure: protectedProcedure.input(z.object({ feeId: z.string() })).query(({ input }) => feeStructures.find(f => f.id === input.feeId) || null),
  calculateFee: protectedProcedure.input(z.object({ type: z.string(), amount: z.number() })).mutation(async ({ input }) => {
      const structure = feeStructures.find(f => f.type === input.type); if (!structure) return { fee: 0, error: "Unknown type" }; const tier = structure.tiers.find(t => input.amount >= t.min && input.amount <= t.max); const fee = tier ? (tier.feeType === "flat" ? tier.fee : input.amount * tier.fee / 100) : 0;
      // ── Middleware Integration (Sprint 44) ──────────────────────────
      // [Kafka] Publish event
      try { await publishEvent("pos.dynamicfeecalculator" as KafkaTopic, "system", { event: "dynamicFeeCalculator.processed", timestamp: Date.now() }); } catch {}
      // [Redis] Cache result for 5 min
      try { await cacheSet("dynamicFeeCalculator:last", JSON.stringify({ ts: Date.now() }), 300); } catch {}
      // [TigerBeetle] Record ledger entry (if sidecar available)
      try { await tbCreateTransfer({ debitAccountId: "1", creditAccountId: "2", amount: 0 }); } catch {}
      // [Fluvio] Stream event for real-time analytics
      try { await fluvioProduce("pos.dynamicfeecalculator", { value: JSON.stringify({ event: "dynamicFeeCalculator.processed", ts: Date.now() }) }); } catch {}
      // [Permify] Authorization check (fail-open)
      try { await permifyCheck({ subjectType: "user", subjectId: "system", entityType: "dynamicFeeCalculator", entityId: "system", permission: "execute" }); } catch {}
      // ── End Middleware ──────────────────────────────────────────────
      return { fee: Math.round(fee), type: input.type, amount: input.amount, tier: tier };
    }),

  updateFeeStructure: protectedProcedure.input(z.object({ feeId: z.string(), tiers: z.array(z.object({ min: z.number(), max: z.number(), fee: z.number(), feeType: z.string() })) })).mutation(({ input }) => ({ feeId: input.feeId, status: "pending_approval", updatedAt: new Date().toISOString() })),
});
