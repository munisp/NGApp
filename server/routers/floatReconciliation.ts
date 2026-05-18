import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum } from "drizzle-orm";
import { floatReconciliations, floatTopUpRequests, agents, auditLog } from "../../drizzle/schema";

export const floatReconciliationRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = input?.status ? await db.select().from(floatReconciliations).where(eq(floatReconciliations.status, input.status)).orderBy(desc(floatReconciliations.createdAt)).limit(input?.limit ?? 50) : await db.select().from(floatReconciliations).orderBy(desc(floatReconciliations.createdAt)).limit(input?.limit ?? 50);
    return { reconciliations: rows, total: rows.length };
  }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [rec] = await db.select().from(floatReconciliations).where(eq(floatReconciliations.id, input.id)).limit(1);
    return rec ?? null;
  }),
  reconcile: protectedProcedure.input(z.object({ agentId: z.number().optional(), dateFrom: z.string().optional(), dateTo: z.string().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [rec] = await db.insert(floatReconciliations).values({ status: "in_progress", agentId: input.agentId }).returning();
    await db.insert(auditLog).values({ action: "float_reconciliation_started", resource: "float_reconciliations", resourceId: String(rec.id), status: "success", metadata: { agentId: input.agentId } });
    return rec;
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(floatReconciliations);
    const [totalTopUps] = await db.select({ value: count() }).from(floatTopUpRequests);
    return { totalReconciliations: Number(total.value), totalFloatTopUps: Number(totalTopUps.value) };
  }),
});
