import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { observabilityAlerts, auditLog } from "../../drizzle/schema";

export const dataThresholdAlertsRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [eq(observabilityAlerts.severity, "warning")];
    if (input?.status) conditions.push(eq(observabilityAlerts.status, input.status));
    const rows = await db.select().from(observabilityAlerts).where(and(...conditions)).orderBy(desc(observabilityAlerts.createdAt)).limit(input?.limit ?? 50);
    return { alerts: rows, total: rows.length };
  }),
  acknowledge: protectedProcedure.input(z.object({ alertId: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [updated] = await db.update(observabilityAlerts).set({ status: "acknowledged", resolvedAt: new Date() }).where(eq(observabilityAlerts.id, input.alertId)).returning();
    await db.insert(auditLog).values({ action: "threshold_alert_acknowledged", resource: "observability_alerts", resourceId: String(input.alertId), status: "success" });
    return { id: updated?.id ?? input.alertId, status: "acknowledged" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(observabilityAlerts);
    const [firing] = await db.select({ value: count() }).from(observabilityAlerts).where(eq(observabilityAlerts.status, "firing"));
    return { totalAlerts: Number(total.value), firingAlerts: Number(firing.value) };
  }),
});
