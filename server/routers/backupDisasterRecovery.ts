import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { backupSnapshots, auditLog } from "../../drizzle/schema";

export const backupDisasterRecoveryRouter = router({
  listBackups: protectedProcedure.input(z.object({ limit: z.number().default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = input?.status ? await db.select().from(backupSnapshots).where(eq(backupSnapshots.status, input.status)).orderBy(desc(backupSnapshots.createdAt)).limit(input?.limit ?? 50) : await db.select().from(backupSnapshots).orderBy(desc(backupSnapshots.createdAt)).limit(input?.limit ?? 50);
    return { backups: rows, total: rows.length };
  }),
  getBackup: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [backup] = await db.select().from(backupSnapshots).where(eq(backupSnapshots.id, input.id)).limit(1);
    return backup ?? null;
  }),
  createBackup: protectedProcedure.input(z.object({ name: z.string(), type: z.enum(["full", "incremental", "differential"]).default("full"), description: z.string().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [backup] = await db.insert(backupSnapshots).values({ name: input.name, type: input.type, status: "in_progress", description: input.description }).returning();
    await db.insert(auditLog).values({ action: "backup_created", resource: "backup_snapshots", resourceId: String(backup.id), status: "success", metadata: { name: input.name, type: input.type } });
    return backup;
  }),
  deleteBackup: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.delete(backupSnapshots).where(eq(backupSnapshots.id, input.id));
    await db.insert(auditLog).values({ action: "backup_deleted", resource: "backup_snapshots", resourceId: String(input.id), status: "success", metadata: {} });
    return { success: true };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(backupSnapshots);
    return { totalBackups: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
