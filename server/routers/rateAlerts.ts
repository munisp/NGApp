import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { rateAlerts, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const rateAlertsRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const conditions = [];
      if (input?.status) conditions.push(eq(rateAlerts.status, input.status as any));
      const rows = await db.select().from(rateAlerts).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(rateAlerts.createdAt)).limit(input?.limit ?? 50);
      return { alerts: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(rateAlerts).limit(100);
    const [active] = await db.select({ value: count() }).from(rateAlerts).where(eq(rateAlerts.status, "active" as any)).limit(100);
    return { totalAlerts: Number(total.value), activeAlerts: Number(active.value) };
  }),
});
