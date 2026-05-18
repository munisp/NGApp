import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { simFailoverLog, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const carrierSwitchingRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), terminalId: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const conditions = [];
      if (input?.terminalId) conditions.push(eq(simFailoverLog.terminalId, input.terminalId));
      const rows = await db.select().from(simFailoverLog).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(simFailoverLog.switchedAt)).limit(input?.limit ?? 50);
      return { switches: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(simFailoverLog).limit(100);
    return { totalSwitches: Number(total.value) };
  }),
});
