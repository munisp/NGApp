import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { backupSnapshots, auditLog } from "../../drizzle/schema";

export const archivalAdminRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [];
    if (input?.status) conditions.push(eq(backupSnapshots.status, input.status));
    const rows = await db.select().from(backupSnapshots).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(backupSnapshots.createdAt)).limit(input?.limit ?? 50);
    return { snapshots: rows, total: rows.length };
  }),
  create: protectedProcedure.input(z.object({ snapshotType: z.string().min(1), triggeredBy: z.string().default("admin") })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [snap] = await db.insert(backupSnapshots).values({ snapshotType: input.snapshotType, status: "in_progress", triggeredBy: input.triggeredBy }).returning();
    await db.insert(auditLog).values({ action: "backup_initiated", resource: "backup_snapshots", resourceId: String(snap.id), status: "success", metadata: { type: input.snapshotType } });
    return { id: snap.id, status: "in_progress" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(backupSnapshots);
    const [completed] = await db.select({ value: count() }).from(backupSnapshots).where(eq(backupSnapshots.status, "completed"));
    return { totalSnapshots: Number(total.value), completedSnapshots: Number(completed.value) };
  }),
});
