import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { fraudAlerts, fraudMlScores, auditLog } from "../../drizzle/schema";

export const fraudReportGeneratorRouter = router({
  generate: protectedProcedure.input(z.object({ period: z.string().default("monthly") })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [totalAlerts] = await db.select({ value: count() }).from(fraudAlerts);
    const [openAlerts] = await db.select({ value: count() }).from(fraudAlerts).where(eq(fraudAlerts.status, "open" as any));
    const [totalScores] = await db.select({ value: count() }).from(fraudMlScores);
    return { period: input.period, totalAlerts: Number(totalAlerts.value), openAlerts: Number(openAlerts.value), totalMlScores: Number(totalScores.value) };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(fraudAlerts);
    const [scores] = await db.select({ value: count() }).from(fraudMlScores);
    return { totalAlerts: Number(total.value), totalMlScores: Number(scores.value) };
  }),
});
