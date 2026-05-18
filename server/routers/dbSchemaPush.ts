import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog } from "../../drizzle/schema";

export const dbSchemaPushRouter = router({
  listPushHistory: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "schema_push")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { history: rows.map(r => ({ id: r.id, status: r.status, metadata: r.metadata, pushedAt: r.createdAt })), total: rows.length };
  }),
  getStatus: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [latest] = await db.select().from(auditLog).where(eq(auditLog.resource, "schema_push")).orderBy(desc(auditLog.createdAt)).limit(1);
    return { lastPush: latest?.createdAt ?? null, status: latest?.status ?? "unknown", metadata: latest?.metadata };
  }),
  push: protectedProcedure.input(z.object({ dryRun: z.boolean().default(false), force: z.boolean().default(false) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.insert(auditLog).values({ action: input.dryRun ? "schema_push_dry_run" : "schema_push", resource: "schema_push", resourceId: "push-" + crypto.randomUUID(), status: "success", metadata: { dryRun: input.dryRun, force: input.force } });
    return { success: true, dryRun: input.dryRun };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "schema_push"));
    return { totalPushes: Number(total.value) };
  }),
});
