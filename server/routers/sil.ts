import { z } from "zod";
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { silFunctions, silTestRecords, type SilFunction } from "../../drizzle/schema";
import { eq, desc, gte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const silRouter = router({
  listFunctions: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      targetSil: z.number().int().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(silFunctions).orderBy(silFunctions.functionId);
      let filtered: SilFunction[] = rows;
      if (input?.status) { const s = input.status; filtered = filtered.filter((r: SilFunction) => r.status === s); }
      if (input?.targetSil !== undefined) { const t = input.targetSil; filtered = filtered.filter((r: SilFunction) => r.targetSil === t); }
      return filtered;
    }),

  getFunction: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.select().from(silFunctions).where(eq(silFunctions.id, input.id));
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  createFunction: adminProcedure
    .input(z.object({
      functionId: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional(),
      processHazard: z.string().optional(),
      initiatingEvent: z.string().optional(),
      safeguard: z.string().optional(),
      consequenceCategory: z.string().optional(),
      targetSil: z.number().int().min(1).max(4).default(2),
      pfdAvg: z.number().optional(),
      rrf: z.number().optional(),
      lopaRef: z.string().optional(),
      status: z.string().default("design"),
      nextTestDue: z.date().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.insert(silFunctions).values({
        ...input,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      return row;
    }),

  updateFunction: adminProcedure
    .input(z.object({
      id: z.number(),
      achievedSil: z.number().int().optional(),
      pfdAvg: z.number().optional(),
      rrf: z.number().optional(),
      status: z.string().optional(),
      lastVerifiedAt: z.date().optional(),
      nextTestDue: z.date().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      const [row] = await db.update(silFunctions)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(silFunctions.id, id))
        .returning();
      return row;
    }),

  listTestRecords: protectedProcedure
    .input(z.object({ silFunctionId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(silTestRecords)
        .where(eq(silTestRecords.silFunctionId, input.silFunctionId))
        .orderBy(desc(silTestRecords.testDate));
    }),

  createTestRecord: adminProcedure
    .input(z.object({
      silFunctionId: z.number(),
      testDate: z.date(),
      testType: z.string().min(1),
      testResult: z.string().min(1),
      responseTimeSec: z.number().optional(),
      testedBy: z.string().optional(),
      witnessedBy: z.string().optional(),
      deviations: z.string().optional(),
      correctiveActions: z.string().optional(),
      nextTestDue: z.date().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.insert(silTestRecords).values({
        ...input,
        createdAt: new Date(),
      }).returning();
      // Update last verified date on the function
      await db.update(silFunctions)
        .set({ lastVerifiedAt: input.testDate, nextTestDue: input.nextTestDue, updatedAt: new Date() })
        .where(eq(silFunctions.id, input.silFunctionId));
      return row;
    }),

  getSummary: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, byStatus: {}, bySil: {}, overdueTests: 0 };
    const fns = await db.select().from(silFunctions);
    const total = fns.length;
    const byStatus: Record<string, number> = {};
    const bySil: Record<number, number> = {};
    let overdueTests = 0;
    const now = new Date();
    for (const f of fns) {
      byStatus[f.status] = (byStatus[f.status] || 0) + 1;
      bySil[f.targetSil] = (bySil[f.targetSil] || 0) + 1;
      if (f.nextTestDue && new Date(f.nextTestDue) < now) overdueTests++;
    }
    return { total, byStatus, bySil, overdueTests };
  }),

  getOverdueFunctions: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const now = new Date();
    const rows = await db.select().from(silFunctions);
    return rows.filter((r: SilFunction) => r.nextTestDue && new Date(r.nextTestDue) < now);
  }),
});
