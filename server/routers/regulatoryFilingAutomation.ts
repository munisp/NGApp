import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { complianceFilings, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const regulatoryFilingAutomationRouter = router({
  listFilings: protectedProcedure.input(z.object({ limit: z.number().default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = input?.status ? await db.select().from(complianceFilings).where(eq(complianceFilings.status, input.status)).orderBy(desc(complianceFilings.createdAt)).limit(input?.limit ?? 50) : await db.select().from(complianceFilings).orderBy(desc(complianceFilings.createdAt)).limit(input?.limit ?? 50);
      return { filings: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getFiling: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [filing] = await db.select().from(complianceFilings).where(eq(complianceFilings.id, input.id)).limit(1);
      return filing ?? null;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  submitFiling: protectedProcedure.input(z.object({ type: z.string(), period: z.string(), data: z.record(z.string(), z.unknown()).optional() })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const refNum = "FIL-" + crypto.randomUUID().slice(0, 8).toUpperCase();
      const [filing] = await db.insert(complianceFilings).values({ filingType: input.type, referenceNumber: refNum, reportingPeriod: input.period, status: "submitted", filingData: JSON.stringify(input.data ?? {}) }).returning();
      await db.insert(auditLog).values({ action: "regulatory_filing_submitted", resource: "compliance_filings", resourceId: String(filing.id), status: "success", metadata: { type: input.type, period: input.period } });
      return filing;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(complianceFilings).limit(100);
    return { totalFilings: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
