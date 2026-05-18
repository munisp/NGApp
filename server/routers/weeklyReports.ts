import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { biReportDefinitions, auditLog } from "../../drizzle/schema";

export const weeklyReportsRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(biReportDefinitions).orderBy(desc(biReportDefinitions.createdAt)).limit(input?.limit ?? 50);
    return { reports: rows, total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(biReportDefinitions);
    return { totalReports: Number(total.value) };
  }),
});
