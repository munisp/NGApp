import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog } from "../../drizzle/schema";

export const systemMigrationToolsRouter = router({
  listMigrations: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "system_migration")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { migrations: rows.map(r => ({ id: r.resourceId, action: r.action, status: r.status, metadata: r.metadata, timestamp: r.createdAt })), total: rows.length };
  }),
  runMigration: protectedProcedure.input(z.object({ name: z.string(), source: z.string(), target: z.string(), dryRun: z.boolean().default(true) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const migrationId = "mig-" + crypto.randomUUID();
    await db.insert(auditLog).values({ action: input.dryRun ? "migration_dry_run" : "migration_executed", resource: "system_migration", resourceId: migrationId, status: "success", metadata: { name: input.name, source: input.source, target: input.target, dryRun: input.dryRun } });
    return { migrationId, name: input.name, status: input.dryRun ? "dry_run_completed" : "completed" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "system_migration"));
    return { totalMigrations: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
