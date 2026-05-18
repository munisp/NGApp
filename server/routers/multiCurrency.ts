import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { tenantCorridors, auditLog, systemConfig } from "../../drizzle/schema";

export const multiCurrencyRouter = router({
  listCorridors: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(tenantCorridors).orderBy(desc(tenantCorridors.createdAt)).limit(input?.limit ?? 50);
    return { corridors: rows, total: rows.length };
  }),
  getRates: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, "fx_rates")).limit(1);
    return config ? { rates: JSON.parse(String(config.value)), lastUpdated: config.updatedAt } : { rates: { USD: 1550, EUR: 1680, GBP: 1950, GHS: 95 }, lastUpdated: new Date() };
  }),
  convert: protectedProcedure.input(z.object({ from: z.string(), to: z.string(), amount: z.number().positive() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, "fx_rates")).limit(1);
    const rates: Record<string, number> = config ? JSON.parse(String(config.value)) : { USD: 1550, EUR: 1680, GBP: 1950 };
    const fromRate = input.from === "NGN" ? 1 : (rates[input.from] ?? 1);
    const toRate = input.to === "NGN" ? 1 : (rates[input.to] ?? 1);
    return { from: input.from, to: input.to, amount: input.amount, converted: Math.round(input.amount * fromRate / toRate * 100) / 100, rate: fromRate / toRate };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalCorridors] = await db.select({ value: count() }).from(tenantCorridors);
    return { totalCorridors: Number(totalCorridors.value), supportedCurrencies: ["NGN", "USD", "EUR", "GBP", "GHS", "KES"] };
  }),
});
