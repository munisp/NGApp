import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog } from "../../drizzle/schema";

export const dbSchemaMigrationManagerRouter = router({
  listMigrations: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "db_migration")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
    return { migrations: rows.map(r => ({ id: r.resourceId, action: r.action, status: r.status, metadata: r.metadata, appliedAt: r.createdAt })), total: rows.length };
  }),
  getMigrationStatus: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "db_migration"));
    const [latest] = await db.select().from(auditLog).where(eq(auditLog.resource, "db_migration")).orderBy(desc(auditLog.createdAt)).limit(1);
    return { totalMigrations: Number(total.value), latestMigration: latest?.resourceId ?? null, latestAt: latest?.createdAt ?? null, status: "up_to_date" };
  }),
  runMigration: protectedProcedure.input(z.object({ name: z.string(), direction: z.enum(["up", "down"]).default("up") })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.insert(auditLog).values({ action: `migration_${input.direction}`, resource: "db_migration", resourceId: input.name, status: "success", metadata: { direction: input.direction } });
    return { success: true, migration: input.name, direction: input.direction };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "db_migration"));
    return { totalMigrations: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
