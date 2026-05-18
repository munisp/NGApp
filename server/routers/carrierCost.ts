import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const carrierCostRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalCarriers: 0, avgCostPerTx: 0, totalSpend30d: 0, cheapestCarrier: "N/A" };
    const rows = await db.select().from(systemConfig).where(sql`${systemConfig.key} LIKE 'carrier_cost_%'`).limit(100);
    const costs = rows.map(r => JSON.parse(String(r.value ?? "{}")));
    return { totalCarriers: costs.length, avgCostPerTx: costs.length > 0 ? Math.round(costs.reduce((a: number, c: any) => a + (c.costPerTx ?? 0), 0) / costs.length * 100) / 100 : 0, totalSpend30d: 0, cheapestCarrier: costs.length > 0 ? costs.sort((a: any, b: any) => (a.costPerTx ?? 0) - (b.costPerTx ?? 0))[0]?.name ?? "N/A" : "N/A" };
  }),
  listCosts: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    try {
      const db = await getDb();
      if (!db) return { costs: [], total: 0 };
      const rows = await db.select().from(systemConfig).where(sql`${systemConfig.key} LIKE 'carrier_cost_%'`).limit(input?.limit ?? 20);
      return { costs: rows.map(r => ({ id: r.key.replace("carrier_cost_", ""), ...JSON.parse(String(r.value ?? "{}")) })), total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  updateCost: protectedProcedure.input(z.object({ carrierId: z.string(), costPerTx: z.number(), costPerSms: z.number().optional(), monthlyFixed: z.number().optional() })).mutation(async ({ input }) => {
    try {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const { carrierId, ...costs } = input;
      await db.insert(systemConfig).values({ key: "carrier_cost_" + carrierId, value: JSON.stringify({ ...costs, updatedAt: new Date().toISOString() }) }).onConflictDoUpdate({ target: systemConfig.key, set: { value: JSON.stringify({ ...costs, updatedAt: new Date().toISOString() }), updatedAt: new Date() } });
      await db.insert(auditLog).values({ action: "carrier_cost_updated", resource: "carrier_costs", resourceId: carrierId, status: "success", metadata: costs as any });
      return { success: true };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
});
