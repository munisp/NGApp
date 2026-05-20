import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { complianceReports } from "../../drizzle/schema";
import { desc, eq, count } from "drizzle-orm";

export const cbnReportingRouter = router({
  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0, limit: input.limit, offset: input.offset };
      const rows = await db.select().from(complianceReports).orderBy(desc(complianceReports.id)).limit(input.limit).offset(input.offset);
      const totalArr = await db.select({ total: count() }).from(complianceReports); const total = totalArr?.[0]?.total ?? 0;
      return { items: rows, total, limit: input.limit, offset: input.offset };
    }),
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [record] = await db.select().from(complianceReports).where(eq(complianceReports.id, input.id)).limit(1);
      return record ?? null;
    }),
  getSummary: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalReports: 0, lastUpdated: new Date().toISOString() };
    const totalArr = await db.select({ total: count() }).from(complianceReports); const total = totalArr?.[0]?.total ?? 0;
    return { totalReports: total, lastUpdated: new Date().toISOString() };
  }),
  generate: protectedProcedure
    .input(z.object({
      reportType: z.string(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { id: `rpt_${Date.now()}`, status: "generating" };
      const [row] = await db.insert(complianceReports).values({
        reportType: input.reportType,
        status: "generating",
      } as any).returning();
      return row;
    }),
  getRecent: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };
      const rows = await db.select().from(complianceReports).orderBy(desc(complianceReports.id)).limit(input.limit);
      return { items: rows, total: rows.length };
    }),
});
