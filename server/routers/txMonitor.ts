import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { transactions, auditLog, systemConfig } from "../../drizzle/schema";

export const txMonitorRouter = router({
  dashboard: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalTransactions: 0, alertsTriggered: 0, avgTps: 0, activeRules: 0 };
    const [txCount] = await db.select({ value: count() }).from(transactions);
    const rules = await db.select().from(systemConfig).where(sql`${systemConfig.key} LIKE 'tx_alert_rule_%'`).limit(100);
    return { totalTransactions: Number(txCount.value), alertsTriggered: 0, avgTps: 0, activeRules: rules.length };
  }),
  listAlertRules: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { rules: [], total: 0 };
    const rows = await db.select().from(systemConfig).where(sql`${systemConfig.key} LIKE 'tx_alert_rule_%'`).limit(input?.limit ?? 20);
    return { rules: rows.map(r => ({ id: r.key.replace("tx_alert_rule_", ""), ...JSON.parse(String(r.value ?? "{}")) })), total: rows.length };
  }),
  createAlertRule: protectedProcedure.input(z.object({ name: z.string(), conditionType: z.string(), threshold: z.number(), severity: z.enum(["info", "warning", "critical"]).default("warning"), windowSeconds: z.number().default(300), enabled: z.boolean().default(true) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const ruleId = "TXR-" + Date.now().toString(36).toUpperCase();
    await db.insert(systemConfig).values({ key: "tx_alert_rule_" + ruleId, value: JSON.stringify({ ...input, createdAt: new Date().toISOString(), cooldownSeconds: 300, triggeredCount: 0 }) });
    await db.insert(auditLog).values({ action: "tx_alert_rule_created", resource: "tx_monitor", resourceId: ruleId, status: "success", metadata: { name: input.name, conditionType: input.conditionType } });
    return { success: true, ruleId };
  }),
  getRecentTransactions: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { transactions: [], total: 0 };
    const rows = await db.select().from(transactions).orderBy(desc(transactions.createdAt)).limit(input?.limit ?? 50);
    return { transactions: rows, total: rows.length };
  }),
  toggleRule: protectedProcedure.input(z.object({ ruleId: z.string(), enabled: z.boolean() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const rows = await db.select().from(systemConfig).where(eq(systemConfig.key, "tx_alert_rule_" + input.ruleId)).limit(1);
    if (rows.length === 0) return { success: false, error: "Rule not found" };
    const data = JSON.parse(String(rows[0].value ?? "{}"));
    data.enabled = input.enabled;
    await db.update(systemConfig).set({ value: JSON.stringify(data), updatedAt: new Date() }).where(eq(systemConfig.key, "tx_alert_rule_" + input.ruleId));
    return { success: true };
  }),
});
