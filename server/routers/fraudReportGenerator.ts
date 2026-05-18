import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { fraudAlerts, fraudMlScores, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const fraudReportGeneratorRouter = router({
  generate: protectedProcedure.input(z.object({ period: z.string().default("monthly") })).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [totalAlerts] = await db.select({ value: count() }).from(fraudAlerts).limit(100);
      const [openAlerts] = await db.select({ value: count() }).from(fraudAlerts).where(eq(fraudAlerts.status, "open" as any)).limit(100);
      const [totalScores] = await db.select({ value: count() }).from(fraudMlScores).limit(100);
      return { period: input.period, totalAlerts: Number(totalAlerts.value), openAlerts: Number(openAlerts.value), totalMlScores: Number(totalScores.value) };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(fraudAlerts).limit(100);
    const [scores] = await db.select({ value: count() }).from(fraudMlScores).limit(100);
    return { totalAlerts: Number(total.value), totalMlScores: Number(scores.value) };
  }),
});
