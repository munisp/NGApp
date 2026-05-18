import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { simFailoverLog, auditLog } from "../../drizzle/schema";

export const carrierSwitchingRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), terminalId: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [];
    if (input?.terminalId) conditions.push(eq(simFailoverLog.terminalId, input.terminalId));
    const rows = await db.select().from(simFailoverLog).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(simFailoverLog.switchedAt)).limit(input?.limit ?? 50);
    return { switches: rows, total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(simFailoverLog);
    return { totalSwitches: Number(total.value) };
  }),
});
