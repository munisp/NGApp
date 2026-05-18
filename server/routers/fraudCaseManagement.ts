import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { fraudAlerts, auditLog } from "../../drizzle/schema";

export const fraudCaseManagementRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [];
    if (input?.status) conditions.push(eq(fraudAlerts.status, input.status as any));
    const rows = await db.select().from(fraudAlerts).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(fraudAlerts.createdAt)).limit(input?.limit ?? 50);
    return { cases: rows, total: rows.length };
  }),
  updateStatus: protectedProcedure.input(z.object({ caseId: z.number(), status: z.enum(["investigating", "escalated", "dismissed", "resolved"]) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [updated] = await db.update(fraudAlerts).set({ status: input.status as any }).where(eq(fraudAlerts.id, input.caseId)).returning();
    await db.insert(auditLog).values({ action: "fraud_case_updated", resource: "fraud_alerts", resourceId: String(input.caseId), status: "success", metadata: { newStatus: input.status } });
    return { id: updated?.id ?? input.caseId, status: input.status };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(fraudAlerts);
    const [open] = await db.select({ value: count() }).from(fraudAlerts).where(eq(fraudAlerts.status, "open" as any));
    return { totalCases: Number(total.value), openCases: Number(open.value) };
  }),
});
