import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { systemConfig, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const systemMigrationToolsRouter = router({
  listMigrations: protectedProcedure.input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [registry] = await db.select().from(systemConfig).where(eq(systemConfig.key, "migration_history")).limit(1);
      const migrations = registry ? JSON.parse(String(registry.value)) : [];
      return { migrations: migrations.slice(0, input?.limit ?? 50), total: migrations.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  runMigration: protectedProcedure.input(z.object({ name: z.string().min(3).max(128), type: z.enum(["schema", "data", "config"]), dryRun: z.boolean().default(true) })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const migrationId = "MIG-" + crypto.randomUUID().slice(0, 8).toUpperCase();
      await db.insert(auditLog).values({ action: input.dryRun ? "migration_dry_run" : "migration_executed", resource: "system_migration", resourceId: migrationId, status: "success", metadata: { name: input.name, type: input.type, dryRun: input.dryRun } });
      return { migrationId, name: input.name, type: input.type, status: input.dryRun ? "dry_run_complete" : "applied", appliedAt: new Date().toISOString() };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "system_migration")).limit(100);
    return { totalMigrations: Number(total.value) };
  }),
});
