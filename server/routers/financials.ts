import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { financialEntries, allocationRecords, mojaloopSettlements } from "../../drizzle/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

export const financialsRouter = router({
  list: publicProcedure
    .input(z.object({
      wellId: z.string().optional(),
      entryType: z.enum(["REVENUE","ROYALTY","OPEX","CAPEX","TAX","SETTLEMENT","ADJUSTMENT"]).optional(),
      status: z.enum(["PENDING","POSTED","SETTLED","REVERSED"]).optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      limit: z.number().default(100),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions: any[] = [];
      if (input.wellId) conditions.push(eq(financialEntries.wellId, input.wellId));
      if (input.entryType) conditions.push(eq(financialEntries.entryType, input.entryType));
      if (input.status) conditions.push(eq(financialEntries.status, input.status));
      if (input.from) conditions.push(gte(financialEntries.valueDate, new Date(input.from)));
      if (input.to) conditions.push(lte(financialEntries.valueDate, new Date(input.to)));
      return db.select().from(financialEntries)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(financialEntries.createdAt))
        .limit(input.limit);
    }),

  summary: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const [stats] = await db.select({
      totalRevenue: sql<number>`sum(case when entry_type = 'REVENUE' then CAST(amount_usd AS DECIMAL) else 0 end)`,
      totalOpex: sql<number>`sum(case when entry_type = 'OPEX' then CAST(amount_usd AS DECIMAL) else 0 end)`,
      totalCapex: sql<number>`sum(case when entry_type = 'CAPEX' then CAST(amount_usd AS DECIMAL) else 0 end)`,
      totalRoyalty: sql<number>`sum(case when entry_type = 'ROYALTY' then CAST(amount_usd AS DECIMAL) else 0 end)`,
      totalTax: sql<number>`sum(case when entry_type = 'TAX' then CAST(amount_usd AS DECIMAL) else 0 end)`,
    }).from(financialEntries).where(eq(financialEntries.status, "POSTED"));
    const revenue = Number(stats?.totalRevenue ?? 0);
    const opex = Number(stats?.totalOpex ?? 0);
    const capex = Number(stats?.totalCapex ?? 0);
    const royalty = Number(stats?.totalRoyalty ?? 0);
    const tax = Number(stats?.totalTax ?? 0);
    return { revenue, opex, capex, royalty, tax, netIncome: revenue - opex - capex - royalty - tax };
  }),

  create: protectedProcedure
    .input(z.object({
      wellId: z.string().optional(),
      entryType: z.enum(["REVENUE","ROYALTY","OPEX","CAPEX","TAX","SETTLEMENT","ADJUSTMENT"]),
      amountUsd: z.number(),
      currency: z.string().default("USD"),
      description: z.string(),
      valueDate: z.string().optional(),
      counterparty: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const entryId = `FE-${nanoid(10).toUpperCase()}`;
      const tigerBeetleRef = `TB-${nanoid(10).toUpperCase()}`;
      const [row] = await db.insert(financialEntries).values({
        entryId,
        wellId: input.wellId,
        entryType: input.entryType,
        amountUsd: String(input.amountUsd),
        currency: input.currency,
        description: input.description,
        valueDate: input.valueDate ? new Date(input.valueDate) : new Date(),
        counterparty: input.counterparty,
        tigerBeetleRef,
      }).returning();
      return { id: row.id, entryId, tigerBeetleRef };
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["PENDING","POSTED","SETTLED","REVERSED"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(financialEntries).set({ status: input.status }).where(eq(financialEntries.id, input.id));
      return { success: true };
    }),

  allocations: publicProcedure
    .input(z.object({ wellId: z.string().optional(), limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(allocationRecords)
        .where(input.wellId ? eq(allocationRecords.wellId, input.wellId) : undefined)
        .orderBy(desc(allocationRecords.date))
        .limit(input.limit);
    }),

  createAllocation: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      separatorId: z.string().optional(),
      date: z.string(),
      allocatedOilBbls: z.number().optional(),
      allocatedGasMmscf: z.number().optional(),
      allocatedWaterBbls: z.number().optional(),
      allocationFactor: z.number().optional(),
      method: z.enum(["WELL_TEST","METERED","CALCULATED","ESTIMATED"]).default("WELL_TEST"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [row] = await db.insert(allocationRecords).values({
        wellId: input.wellId,
        separatorId: input.separatorId,
        date: new Date(input.date),
        allocatedOilBbls: input.allocatedOilBbls,
        allocatedGasMmscf: input.allocatedGasMmscf,
        allocatedWaterBbls: input.allocatedWaterBbls,
        allocationFactor: input.allocationFactor,
        method: input.method,
      }).returning();
      return { id: row.id };
    }),

  // ─── MOJALOOP SETTLEMENTS (FRQ-011, BRQ-003) ────────────────────────────────

  settlements: publicProcedure
    .input(z.object({
      status: z.enum(["PENDING","PROCESSING","COMPLETED","FAILED"]).optional(),
      settlementType: z.string().optional(),
      wellId: z.string().optional(),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions: any[] = [];
      if (input?.status) conditions.push(eq(mojaloopSettlements.status, input.status));
      if (input?.settlementType) conditions.push(eq(mojaloopSettlements.settlementType, input.settlementType));
      if (input?.wellId) conditions.push(eq(mojaloopSettlements.wellId, input.wellId));
      return db.select().from(mojaloopSettlements)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(mojaloopSettlements.createdAt))
        .limit(input?.limit ?? 50);
    }),

  settlementsStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, completed: 0, pending: 0, failed: 0, totalAmountUsd: 0 };
    const rows = await db.select().from(mojaloopSettlements);
    const total = rows.length;
    const completed = rows.filter(r => r.status === "COMPLETED").length;
    const pending = rows.filter(r => r.status === "PENDING" || r.status === "PROCESSING").length;
    const failed = rows.filter(r => r.status === "FAILED").length;
    const totalAmountUsd = rows
      .filter(r => r.status === "COMPLETED")
      .reduce((s, r) => s + parseFloat(r.amountUsd ?? "0"), 0);
    return { total, completed, pending, failed, totalAmountUsd };
  }),

  initiateSettlement: protectedProcedure
    .input(z.object({
      counterparty: z.string(),
      counterpartyIdType: z.string().default("ACCOUNT_ID"),
      counterpartyIdValue: z.string(),
      amountUsd: z.number(),
      currency: z.string().default("USD"),
      settlementType: z.enum(["ROYALTY","FEDERAL_ROYALTY","TRANSPORT","TAX","PARTNER"]),
      wellId: z.string().optional(),
      valueDate: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const settlementId = `MJL-${new Date().getFullYear()}-${nanoid(6).toUpperCase()}`;
      const mojaloopQuoteId = `QTE-${nanoid(12).toUpperCase()}`;
      const [row] = await db.insert(mojaloopSettlements).values({
        settlementId,
        counterparty: input.counterparty,
        counterpartyIdType: input.counterpartyIdType,
        counterpartyIdValue: input.counterpartyIdValue,
        amountUsd: String(input.amountUsd),
        currency: input.currency,
        settlementType: input.settlementType,
        wellId: input.wellId,
        status: "PROCESSING",
        mojaloopQuoteId,
        initiatedBy: ctx.user.email ?? ctx.user.id.toString(),
        valueDate: input.valueDate ? new Date(input.valueDate) : new Date(),
      }).returning();
      // Simulate Mojaloop async settlement completion (in production: webhook callback)
      setTimeout(async () => {
        try {
          const dbLate = await getDb();
          if (!dbLate) return;
          const mojaloopTransferId = `TRF-${nanoid(16).toUpperCase()}`;
          await dbLate.update(mojaloopSettlements)
            .set({ status: "COMPLETED", mojaloopTransferId, completedAt: new Date() })
            .where(eq(mojaloopSettlements.id, row.id));
        } catch { /* ignore */ }
      }, 3000);
      return { settlementId, mojaloopQuoteId, status: "PROCESSING" };
    }),

  monthlyTrend: publicProcedure
    .input(z.object({ months: z.number().default(12) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        const rows = await db.select({
          month: sql<string>`TO_CHAR(DATE_TRUNC('month', value_date), 'Mon YYYY')`,
          revenue: sql<number>`COALESCE(sum(case when entry_type = 'REVENUE' then CAST(amount_usd AS DECIMAL) else 0 end), 0)`,
          opex: sql<number>`COALESCE(sum(case when entry_type = 'OPEX' then CAST(amount_usd AS DECIMAL) else 0 end), 0)`,
          capex: sql<number>`COALESCE(sum(case when entry_type = 'CAPEX' then CAST(amount_usd AS DECIMAL) else 0 end), 0)`,
        }).from(financialEntries)
          .where(sql`value_date >= NOW() - (${input.months} || ' months')::interval`)
          .groupBy(sql`DATE_TRUNC('month', value_date)`)
          .orderBy(sql`DATE_TRUNC('month', value_date)`);
        return rows.map(r => ({
          month: r.month,
          revenue: Math.round(Number(r.revenue) / 1_000),
          opex: Math.round(Number(r.opex) / 1_000),
          capex: Math.round(Number(r.capex) / 1_000),
        }));
      } catch { return []; }
    }),

  cancelSettlement: protectedProcedure
    .input(z.object({ settlementId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(mojaloopSettlements)
        .set({ status: "FAILED", errorCode: "USER_CANCEL", errorMessage: "Cancelled by operator" })
        .where(eq(mojaloopSettlements.settlementId, input.settlementId));
      return { success: true };
    }),
});
