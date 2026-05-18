import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { backupSnapshots, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const archivalAdminRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const conditions = [];
      if (input?.status) conditions.push(eq(backupSnapshots.status, input.status));
      const rows = await db.select().from(backupSnapshots).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(backupSnapshots.createdAt)).limit(input?.limit ?? 50);
      return { snapshots: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  create: protectedProcedure.input(z.object({ snapshotType: z.string().min(1), triggeredBy: z.string().default("admin") })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [snap] = await db.insert(backupSnapshots).values({ snapshotType: input.snapshotType, status: "in_progress", triggeredBy: input.triggeredBy }).returning();
      await db.insert(auditLog).values({ action: "backup_initiated", resource: "backup_snapshots", resourceId: String(snap.id), status: "success", metadata: { type: input.snapshotType } });
      return { id: snap.id, status: "in_progress" };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(backupSnapshots).limit(100);
    const [completed] = await db.select({ value: count() }).from(backupSnapshots).where(eq(backupSnapshots.status, "completed")).limit(100);
    return { totalSnapshots: Number(total.value), completedSnapshots: Number(completed.value) };
  }),
});
