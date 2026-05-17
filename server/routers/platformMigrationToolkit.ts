import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
const migrations = [
  { id: "MIG-001", name: "Legacy POS Data Import", source: "Old POS System", target: "54Link Platform", status: "completed", totalRecords: 2500000, migratedRecords: 2500000, failedRecords: 0, startedAt: "2026-01-10", completedAt: "2026-01-12", duration: "48 hours" },
  { id: "MIG-002", name: "Agent Profile Migration", source: "Excel Spreadsheets", target: "Agent Database", status: "completed", totalRecords: 1250, migratedRecords: 1248, failedRecords: 2, startedAt: "2026-01-15", completedAt: "2026-01-15", duration: "2 hours" },
  { id: "MIG-003", name: "Transaction History Import", source: "Bank Statements", target: "Transaction Ledger", status: "in_progress", totalRecords: 5000000, migratedRecords: 3200000, failedRecords: 150, startedAt: "2026-04-20", completedAt: null, duration: null },
  { id: "MIG-004", name: "Customer KYC Data", source: "Third-Party KYC Provider", target: "KYC Vault", status: "scheduled", totalRecords: 800000, migratedRecords: 0, failedRecords: 0, startedAt: null, completedAt: null, duration: null },
];
export const platformMigrationToolkitRouter = router({
  getStats: protectedProcedure.query(() => ({ totalMigrations: migrations.length, completedMigrations: migrations.filter(m => m.status === "completed").length, inProgressMigrations: migrations.filter(m => m.status === "in_progress").length, totalRecordsMigrated: migrations.reduce((s: any, m: any) => s + m.migratedRecords, 0), totalFailedRecords: migrations.reduce((s: any, m: any) => s + m.failedRecords, 0), overallSuccessRate: 99.998, scheduledMigrations: 1, dataIntegrityScore: 99.99 })),
  listMigrations: protectedProcedure.query(() => ({ migrations, total: migrations.length })),
  getMigration: protectedProcedure.input(z.object({ migrationId: z.string() })).query(({ input }) => migrations.find(m => m.id === input.migrationId) || null),
  createMigration: protectedProcedure.input(z.object({ name: z.string(), source: z.string(), target: z.string(), scheduledAt: z.string().optional() })).mutation(({ input }) => ({ migrationId: "MIG-" + Date.now(), status: "scheduled", ...input })),
  rollbackMigration: protectedProcedure.input(z.object({ migrationId: z.string(), reason: z.string() })).mutation(({ input }) => ({ migrationId: input.migrationId, status: "rolling_back", estimatedTime: "30 minutes" })),
});
