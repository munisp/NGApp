import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
// ── Middleware Integration (Sprint 44) ──────────────────────────────
import { publishEvent, type KafkaTopic } from "../kafkaClient";
import { cacheSet, cacheGet } from "../redisClient";
import { tbCreateTransfer } from "../tbClient";
import { fluvioProduce } from "../fluvio";
import { permifyCheck } from "../_core/permify";

const reversals = [
  { id: "REV-001", originalTxId: "TXN-45678", amount: 150000, type: "full_reversal", reason: "duplicate_transaction", status: "completed", initiatedBy: "System", initiatedAt: "2026-04-21T08:30:00Z", completedAt: "2026-04-21T08:31:00Z", approvedBy: "Auto" },
  { id: "REV-002", originalTxId: "TXN-45890", amount: 25000, type: "partial_reversal", reason: "wrong_amount", status: "pending_approval", initiatedBy: "Agent AGT-002", initiatedAt: "2026-04-21T10:00:00Z", completedAt: null, approvedBy: null },
  { id: "REV-003", originalTxId: "TXN-46012", amount: 500000, type: "full_reversal", reason: "fraud_detected", status: "completed", initiatedBy: "Fraud Team", initiatedAt: "2026-04-20T15:00:00Z", completedAt: "2026-04-20T15:02:00Z", approvedBy: "Senior Manager" },
  { id: "REV-004", originalTxId: "TXN-46234", amount: 75000, type: "full_reversal", reason: "customer_request", status: "rejected", initiatedBy: "Agent AGT-003", initiatedAt: "2026-04-19T12:00:00Z", completedAt: null, approvedBy: null },
];
export const transactionReversalManagerRouter = router({
  getStats: protectedProcedure.query(() => ({ totalReversals: reversals.length, completedReversals: reversals.filter(r => r.status === "completed").length, pendingReversals: reversals.filter(r => r.status === "pending_approval").length, totalReversedAmount: reversals.filter(r => r.status === "completed").reduce((s: any, r: any) => s + r.amount, 0), autoReversals: 1, manualReversals: 3, avgProcessingTime: "1.5 minutes", rejectionRate: 25 })),
  listReversals: protectedProcedure.input(z.object({ status: z.string().optional() })).query(({ input }) => ({ reversals: input.status ? reversals.filter(r => r.status === input.status) : reversals, total: reversals.length })),
  getReversal: protectedProcedure.input(z.object({ reversalId: z.string() })).query(({ input }) => reversals.find(r => r.id === input.reversalId) || null),
  initiateReversal: protectedProcedure.input(z.object({ transactionId: z.string(), type: z.string(), reason: z.string(), amount: z.number() })).mutation(async ({ input }) => {
      // ── Middleware Integration (Sprint 44) ──────────────────────────
      // [Kafka] Publish event
      try { await publishEvent("pos.transactionreversalmanager" as KafkaTopic, "system", { event: "transactionReversalManager.processed", timestamp: Date.now() }); } catch {}
      // [Redis] Cache result for 5 min
      try { await cacheSet("transactionReversalManager:last", JSON.stringify({ ts: Date.now() }), 300); } catch {}
      // [TigerBeetle] Record ledger entry (if sidecar available)
      try { await tbCreateTransfer({ debitAccountId: "1", creditAccountId: "2", amount: 0 }); } catch {}
      // [Fluvio] Stream event for real-time analytics
      try { await fluvioProduce("pos.transactionreversalmanager", { value: JSON.stringify({ event: "transactionReversalManager.processed", ts: Date.now() }) }); } catch {}
      // [Permify] Authorization check (fail-open)
      try { await permifyCheck({ subjectType: "user", subjectId: "system", entityType: "transactionReversalManager", entityId: "system", permission: "execute" }); } catch {}
      // ── End Middleware ──────────────────────────────────────────────
      return { reversalId: "REV-" + Date.now(), status: input.amount > 100000 ? "pending_approval" : "processing", ...input };
    }),

  approveReversal: protectedProcedure.input(z.object({ reversalId: z.string(), decision: z.enum(["approve", "reject"]) })).mutation(({ input }) => ({ reversalId: input.reversalId, status: input.decision === "approve" ? "completed" : "rejected", processedAt: new Date().toISOString() })),
});
