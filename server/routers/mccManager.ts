import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { systemConfig, auditLog } from "../../drizzle/schema";

export const mccManagerRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalCodes: 0, activeCodes: 0, categories: 0 };
    const rows = await db.select().from(systemConfig).where(sql`${systemConfig.key} LIKE 'mcc_%'`).limit(500);
    return { totalCodes: rows.length, activeCodes: rows.length, categories: new Set(rows.map(r => JSON.parse(String(r.value ?? "{}")).category)).size };
  }),
  listCodes: protectedProcedure.input(z.object({ category: z.string().optional(), limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { codes: [], total: 0 };
    const rows = await db.select().from(systemConfig).where(sql`${systemConfig.key} LIKE 'mcc_%'`).limit(input?.limit ?? 50);
    let codes = rows.map(r => ({ code: r.key.replace("mcc_", ""), ...JSON.parse(String(r.value ?? "{}")) }));
    if (input?.category) codes = codes.filter((c: any) => c.category === input.category);
    return { codes, total: codes.length };
  }),
  addCode: protectedProcedure.input(z.object({ code: z.string(), description: z.string(), category: z.string(), riskLevel: z.enum(["low", "medium", "high"]).default("low") })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(systemConfig).values({ key: "mcc_" + input.code, value: JSON.stringify(input) }).onConflictDoUpdate({ target: systemConfig.key, set: { value: JSON.stringify(input), updatedAt: new Date() } });
    return { success: true };
  }),
});
