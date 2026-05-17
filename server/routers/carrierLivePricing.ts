import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const carrierLivePricingRouter = router({
  dashboard: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalCarriers: 0, avgSmsRate: 0, avgUssdRate: 0, lastUpdated: null };
    const rows = await db.select().from(systemConfig).where(sql`${systemConfig.key} LIKE 'carrier_rate_%'`).limit(100);
    const rates = rows.map(r => JSON.parse(String(r.value ?? "{}")));
    const avgSms = rates.length > 0 ? rates.reduce((a: number, r: any) => a + (r.smsRate ?? 0), 0) / rates.length : 0;
    return { totalCarriers: rates.length, avgSmsRate: Math.round(avgSms * 100) / 100, avgUssdRate: 0, lastUpdated: new Date().toISOString() };
  }),
  listRates: protectedProcedure.input(z.object({ country: z.string().optional(), limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { rates: [], total: 0 };
    const rows = await db.select().from(systemConfig).where(sql`${systemConfig.key} LIKE 'carrier_rate_%'`).limit(input?.limit ?? 20);
    let rates = rows.map(r => ({ id: r.key.replace("carrier_rate_", ""), ...JSON.parse(String(r.value ?? "{}")) }));
    if (input?.country) rates = rates.filter((r: any) => r.country === input.country);
    return { rates, total: rates.length };
  }),
  updateRate: protectedProcedure.input(z.object({ carrierId: z.string(), smsRate: z.number().optional(), ussdRate: z.number().optional(), dataRatePerMb: z.number().optional(), voiceRatePerMin: z.number().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const { carrierId, ...rateUpdates } = input;
    const rows = await db.select().from(systemConfig).where(eq(systemConfig.key, "carrier_rate_" + carrierId)).limit(1);
    const existing = rows.length > 0 ? JSON.parse(String(rows[0].value ?? "{}")) : {};
    const updated = { ...existing, ...rateUpdates, updatedAt: new Date().toISOString() };
    await db.insert(systemConfig).values({ key: "carrier_rate_" + carrierId, value: JSON.stringify(updated) }).onConflictDoUpdate({ target: systemConfig.key, set: { value: JSON.stringify(updated), updatedAt: new Date() } });
    await db.insert(auditLog).values({ action: "carrier_rate_updated", resource: "carrier_pricing", resourceId: carrierId, status: "success", metadata: rateUpdates as any });
    return { success: true };
  }),
  compareRates: protectedProcedure.input(z.object({ country: z.string(), serviceType: z.enum(["sms", "ussd", "data", "voice"]) })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { comparison: [] };
    const rows = await db.select().from(systemConfig).where(sql`${systemConfig.key} LIKE 'carrier_rate_%'`).limit(100);
    const rates = rows.map(r => ({ id: r.key.replace("carrier_rate_", ""), ...JSON.parse(String(r.value ?? "{}")) }));
    const filtered = rates.filter((r: any) => r.country === input.country);
    return { comparison: filtered.map((r: any) => ({ carrier: r.carrierName ?? r.id, rate: r[input.serviceType + "Rate"] ?? 0 })).sort((a: any, b: any) => a.rate - b.rate) };
  }),
});
