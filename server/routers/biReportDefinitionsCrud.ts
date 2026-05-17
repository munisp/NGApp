// Sprint 87: Report scheduling, parameter validation, output formatting
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { biReportDefinitions } from "../../drizzle/schema";
import { eq, desc, and, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const REPORT_FORMATS = ["pdf", "csv", "xlsx", "json"];
const SCHEDULE_FREQUENCIES = ["daily", "weekly", "monthly", "quarterly"];

export const biReportDefinitionsRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().default(20), offset: z.number().default(0) })).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(biReportDefinitions).orderBy(desc(biReportDefinitions.id)).limit(input.limit).offset(input.offset);
    const [{ total }] = await db.select({ total: count() }).from(biReportDefinitions);
    return { items: rows, total };
  }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [row] = await db.select().from(biReportDefinitions).where(eq(biReportDefinitions.id, input.id));
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Report definition not found" });
    return row;
  }),
  create: protectedProcedure.input(z.object({ name: z.string().min(3), description: z.string().optional(), outputFormat: z.enum(["pdf", "csv", "xlsx", "json"]).default("pdf"), schedule: z.enum(["daily", "weekly", "monthly", "quarterly"]).optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [row] = await db.insert(biReportDefinitions).values(input as any).returning();
    return { ...row, message: input.schedule ? `Report scheduled ${input.schedule}` : "Report definition created" };
  }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.delete(biReportDefinitions).where(eq(biReportDefinitions.id, input.id));
    return { success: true } as any;
  }),
  getFormats: protectedProcedure.query(() => ({ formats: REPORT_FORMATS, schedules: SCHEDULE_FREQUENCIES })),
});
