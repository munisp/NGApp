import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { systemConfig, auditLog } from "../../drizzle/schema";

export const businessRulesRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalRules: 0, activeRules: 0, disabledRules: 0, lastEvaluated: null };
    const rows = await db.select().from(systemConfig).where(sql`${systemConfig.key} LIKE 'biz_rule_%'`).limit(200);
    const active = rows.filter(r => { try { return JSON.parse(String(r.value ?? "{}")).enabled !== false; } catch { return true; } });
    return { totalRules: rows.length, activeRules: active.length, disabledRules: rows.length - active.length, lastEvaluated: new Date().toISOString() };
  }),
  listRules: protectedProcedure.input(z.object({ category: z.string().optional(), enabled: z.boolean().optional(), limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { rules: [], total: 0 };
    const rows = await db.select().from(systemConfig).where(sql`${systemConfig.key} LIKE 'biz_rule_%'`).limit(input?.limit ?? 50);
    let rules = rows.map(r => {
      const data = JSON.parse(String(r.value ?? "{}"));
      return { id: r.key.replace("biz_rule_", ""), ...data, updatedAt: r.updatedAt };
    });
    if (input?.category) rules = rules.filter((r: any) => r.category === input.category);
    if (input?.enabled !== undefined) rules = rules.filter((r: any) => r.enabled === input.enabled);
    return { rules, total: rules.length };
  }),
  getRule: protectedProcedure.input(z.object({ ruleId: z.string() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(systemConfig).where(eq(systemConfig.key, "biz_rule_" + input.ruleId)).limit(1);
    if (rows.length === 0) return null;
    return { id: input.ruleId, ...JSON.parse(String(rows[0].value ?? "{}")) };
  }),
  createRule: protectedProcedure.input(z.object({ name: z.string(), category: z.enum(["transaction", "compliance", "agent", "commission", "security"]), condition: z.string(), action: z.string(), priority: z.number().default(0), enabled: z.boolean().default(true) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const ruleId = input.name.toLowerCase().replace(/\s+/g, "_");
    await db.insert(systemConfig).values({ key: "biz_rule_" + ruleId, value: JSON.stringify({ ...input, createdAt: new Date().toISOString() }) });
    await db.insert(auditLog).values({ action: "business_rule_created", resource: "business_rules", resourceId: ruleId, status: "success", metadata: { name: input.name, category: input.category } });
    return { success: true, ruleId };
  }),
  updateRule: protectedProcedure.input(z.object({ ruleId: z.string(), name: z.string().optional(), condition: z.string().optional(), action: z.string().optional(), priority: z.number().optional(), enabled: z.boolean().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const rows = await db.select().from(systemConfig).where(eq(systemConfig.key, "biz_rule_" + input.ruleId)).limit(1);
    if (rows.length === 0) return { success: false, error: "Rule not found" };
    const existing = JSON.parse(String(rows[0].value ?? "{}"));
    const { ruleId, ...updates } = input;
    const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await db.update(systemConfig).set({ value: JSON.stringify(merged), updatedAt: new Date() }).where(eq(systemConfig.key, "biz_rule_" + ruleId));
    await db.insert(auditLog).values({ action: "business_rule_updated", resource: "business_rules", resourceId: ruleId, status: "success", metadata: updates as any });
    return { success: true };
  }),
  deleteRule: protectedProcedure.input(z.object({ ruleId: z.string() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.delete(systemConfig).where(eq(systemConfig.key, "biz_rule_" + input.ruleId));
    await db.insert(auditLog).values({ action: "business_rule_deleted", resource: "business_rules", resourceId: input.ruleId, status: "success" });
    return { success: true };
  }),
  evaluate: protectedProcedure.input(z.object({ context: z.record(z.string(), z.any()) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) return { results: [], evaluated: 0 };
    const rows = await db.select().from(systemConfig).where(sql`${systemConfig.key} LIKE 'biz_rule_%'`).limit(200);
    const rules = rows.map(r => JSON.parse(String(r.value ?? "{}"))).filter((r: any) => r.enabled !== false);
    return { results: rules.map((r: any) => ({ name: r.name, category: r.category, matched: true, action: r.action })), evaluated: rules.length };
  }),
});
