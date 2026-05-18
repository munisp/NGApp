import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { regulatoryFilings, auditLog } from "../../drizzle/schema";

export const regulatoryFilingAutomationRouter = router({
  listFilings: protectedProcedure.input(z.object({ limit: z.number().default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = input?.status ? await db.select().from(regulatoryFilings).where(eq(regulatoryFilings.status, input.status)).orderBy(desc(regulatoryFilings.createdAt)).limit(input?.limit ?? 50) : await db.select().from(regulatoryFilings).orderBy(desc(regulatoryFilings.createdAt)).limit(input?.limit ?? 50);
    return { filings: rows, total: rows.length };
  }),
  getFiling: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [filing] = await db.select().from(regulatoryFilings).where(eq(regulatoryFilings.id, input.id)).limit(1);
    return filing ?? null;
  }),
  submitFiling: protectedProcedure.input(z.object({ type: z.string(), period: z.string(), data: z.record(z.string(), z.unknown()).optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [filing] = await db.insert(regulatoryFilings).values({ type: input.type, period: input.period, status: "submitted", data: input.data ?? {} }).returning();
    await db.insert(auditLog).values({ action: "regulatory_filing_submitted", resource: "regulatory_filings", resourceId: String(filing.id), status: "success", metadata: { type: input.type, period: input.period } });
    return filing;
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(regulatoryFilings);
    return { totalFilings: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
