import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { observabilityAlerts, auditLog } from "../../drizzle/schema";

export const escalationChainsRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(observabilityAlerts).where(eq(observabilityAlerts.status, "escalated")).orderBy(desc(observabilityAlerts.createdAt)).limit(input?.limit ?? 50);
    return { escalations: rows, total: rows.length };
  }),
  escalate: protectedProcedure.input(z.object({ alertId: z.number(), level: z.number().int().min(1).max(5) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [updated] = await db.update(observabilityAlerts).set({ status: "escalated" }).where(eq(observabilityAlerts.id, input.alertId)).returning();
    await db.insert(auditLog).values({ action: "escalation_triggered", resource: "observability_alerts", resourceId: String(input.alertId), status: "success", metadata: { level: input.level } });
    return { id: updated?.id ?? input.alertId, level: input.level, status: "escalated" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(observabilityAlerts).where(eq(observabilityAlerts.status, "escalated"));
    return { totalEscalations: Number(total.value) };
  }),
});
