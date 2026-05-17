/**
 * Sprint 92 — Offline Queue Status tRPC Router
 *
 * Provides server-side endpoints for monitoring offline queue status,
 * sync history, and retry management for agents on unstable 2G/3G networks.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import crypto from "crypto";

// ── In-memory sync tracking (production: use Redis + PostgreSQL) ─────────────

interface SyncRecord {
  id: string;
  agentId: number;
  queuedAt: number;
  syncedAt: number | null;
  status: "pending" | "syncing" | "synced" | "failed" | "retrying";
  retryCount: number;
  maxRetries: number;
  operationType: string;
  payloadSize: number;
  errorMessage: string | null;
  networkType: string | null;
}

const syncRecords = new Map<string, SyncRecord>();
const agentQueueStats = new Map<number, {
  totalQueued: number;
  totalSynced: number;
  totalFailed: number;
  lastSyncAt: number | null;
  avgSyncTimeMs: number;
  networkQuality: string;
}>();

// Seed some demo data
function seedDemoData() {
  if (syncRecords.size > 0) return;
  const ops = ["cash_in", "cash_out", "transfer", "airtime", "bill_pay", "card_payment"];
  const networks = ["2g", "3g", "4g", "edge", "wifi"];
  const statuses: SyncRecord["status"][] = ["pending", "syncing", "synced", "failed", "retrying"];

  for (let i = 0; i < 50; i++) {
    const id = `sync_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const agentId = Math.floor(Math.random() * 5) + 1;
    const queuedAt = Date.now() - Math.floor(Math.random() * 86400000);
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    syncRecords.set(id, {
      id,
      agentId,
      queuedAt,
      syncedAt: status === "synced" ? queuedAt + Math.floor(Math.random() * 60000) : null,
      status,
      retryCount: status === "retrying" ? Math.floor(Math.random() * 3) + 1 : 0,
      maxRetries: 5,
      operationType: ops[Math.floor(Math.random() * ops.length)],
      payloadSize: Math.floor(Math.random() * 5000) + 200,
      errorMessage: status === "failed" ? "Network timeout after 30s" : null,
      networkType: networks[Math.floor(Math.random() * networks.length)],
    });
  }
}
seedDemoData();

export const offlineQueueRouter = router({
  // Get current queue status for an agent (or all agents for admin)
  getQueueStatus: protectedProcedure
    .input(z.object({
      agentId: z.number().optional(),
    }))
    .query(({ input }) => {
      let records = Array.from(syncRecords.values());
      if (input.agentId) {
        records = records.filter((r: SyncRecord) => r.agentId === input.agentId);
      }

      const pending = records.filter((r: SyncRecord) => r.status === "pending");
      const syncing = records.filter((r: SyncRecord) => r.status === "syncing");
      const synced = records.filter((r: SyncRecord) => r.status === "synced");
      const failed = records.filter((r: SyncRecord) => r.status === "failed");
      const retrying = records.filter((r: SyncRecord) => r.status === "retrying");

      const totalPayloadBytes = pending.reduce((sum: number, r: SyncRecord) => sum + r.payloadSize, 0) +
        retrying.reduce((sum: number, r: SyncRecord) => sum + r.payloadSize, 0);

      // Estimate sync time based on network type
      const estimatedSyncTimeMs = totalPayloadBytes > 0
        ? Math.round(totalPayloadBytes / 50) * 1000 // ~50 bytes/sec on 2G
        : 0;

      return {
        summary: {
          pendingCount: pending.length,
          syncingCount: syncing.length,
          syncedCount: synced.length,
          failedCount: failed.length,
          retryingCount: retrying.length,
          totalQueuedBytes: totalPayloadBytes,
          estimatedSyncTimeMs,
          oldestPendingAt: pending.length > 0
            ? Math.min(...pending.map((r: SyncRecord) => r.queuedAt))
            : null,
        },
        recentItems: records
          .sort((a: SyncRecord, b: SyncRecord) => b.queuedAt - a.queuedAt)
          .slice(0, 20)
          .map((r: SyncRecord) => ({
            id: r.id,
            operationType: r.operationType,
            status: r.status,
            queuedAt: r.queuedAt,
            syncedAt: r.syncedAt,
            retryCount: r.retryCount,
            payloadSize: r.payloadSize,
            networkType: r.networkType,
            errorMessage: r.errorMessage,
          })),
      };
    }),

  // Get sync history with pagination
  getSyncHistory: protectedProcedure
    .input(z.object({
      agentId: z.number().optional(),
      status: z.enum(["all", "pending", "syncing", "synced", "failed", "retrying"]).default("all"),
      page: z.number().min(1).default(1),
      pageSize: z.number().min(5).max(100).default(20),
      sortBy: z.enum(["queuedAt", "syncedAt", "payloadSize"]).default("queuedAt"),
      sortOrder: z.enum(["asc", "desc"]).default("desc"),
    }))
    .query(({ input }) => {
      let records = Array.from(syncRecords.values());
      if (input.agentId) records = records.filter((r: SyncRecord) => r.agentId === input.agentId);
      if (input.status !== "all") records = records.filter((r: SyncRecord) => r.status === input.status);

      records.sort((a: SyncRecord, b: SyncRecord) => {
        const aVal = a[input.sortBy] ?? 0;
        const bVal = b[input.sortBy] ?? 0;
        return input.sortOrder === "desc"
          ? (bVal as number) - (aVal as number)
          : (aVal as number) - (bVal as number);
      });

      const total = records.length;
      const start = (input.page - 1) * input.pageSize;
      const paged = records.slice(start, start + input.pageSize);

      return {
        items: paged,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  // Retry failed sync items
  retryFailed: protectedProcedure
    .input(z.object({
      ids: z.array(z.string()).min(1).max(50).optional(),
      agentId: z.number().optional(),
    }))
    .mutation(({ input }) => {
      let retried = 0;
      const targets = input.ids
        ? input.ids.map((id: string) => syncRecords.get(id)).filter(Boolean) as SyncRecord[]
        : Array.from(syncRecords.values()).filter((r: SyncRecord) =>
            r.status === "failed" && (!input.agentId || r.agentId === input.agentId)
          );

      for (const record of targets) {
        if (record.status === "failed" && record.retryCount < record.maxRetries) {
          record.status = "retrying";
          record.retryCount++;
          record.errorMessage = null;
          retried++;
        }
      }

      return { retried, total: targets.length };
    }),

  // Get network quality metrics per agent
  getNetworkMetrics: protectedProcedure
    .input(z.object({ agentId: z.number().optional() }))
    .query(({ input }) => {
      const records = Array.from(syncRecords.values())
        .filter((r: SyncRecord) => !input.agentId || r.agentId === input.agentId);

      const networkBreakdown: Record<string, { count: number; avgPayload: number; failRate: number }> = {};
      for (const r of records) {
        const net = r.networkType ?? "unknown";
        if (!networkBreakdown[net]) networkBreakdown[net] = { count: 0, avgPayload: 0, failRate: 0 };
        networkBreakdown[net].count++;
        networkBreakdown[net].avgPayload += r.payloadSize;
        if (r.status === "failed") networkBreakdown[net].failRate++;
      }

      for (const net of Object.keys(networkBreakdown)) {
        const b = networkBreakdown[net];
        b.avgPayload = b.count > 0 ? Math.round(b.avgPayload / b.count) : 0;
        b.failRate = b.count > 0 ? Math.round((b.failRate / b.count) * 100) : 0;
      }

      return {
        networkBreakdown,
        totalRecords: records.length,
        overallFailRate: records.length > 0
          ? Math.round((records.filter((r: SyncRecord) => r.status === "failed").length / records.length) * 100)
          : 0,
      };
    }),

  // Clear synced items (cleanup)
  clearSynced: protectedProcedure
    .input(z.object({
      olderThanMs: z.number().default(86400000), // 24h default
    }))
    .mutation(({ input }) => {
      let cleared = 0;
      const cutoff = Date.now() - input.olderThanMs;
      for (const [id, record] of syncRecords) {
        if (record.status === "synced" && record.syncedAt && record.syncedAt < cutoff) {
          syncRecords.delete(id);
          cleared++;
        }
      }
      return { cleared };
    }),
});
