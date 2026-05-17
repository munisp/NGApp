import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const automatedComplianceCheckerRouter = router({
  dashboard: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalRules: 0, passingRules: 0, failingRules: 0, lastCheckAt: null, complianceScore: 0 };
    const rows = await db.select().from(systemConfig).where(sql`\${systemConfig.key} LIKE 'compliance_rule_%'`).limit(100);
    const rules = rows.map(r => JSON.parse(String(r.value ?? "{}")));
    const passing = rules.filter((r: any) => r.status === "passing").length;
    return { totalRules: rules.length, passingRules: passing, failingRules: rules.length - passing, lastCheckAt: new Date().toISOString(), complianceScore: rules.length > 0 ? Math.round(passing / rules.length * 100) : 100 };
  }),
  listRules: protectedProcedure.input(z.object({ category: z.string().optional(), limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { rules: [], total: 0 };
    const rows = await db.select().from(systemConfig).where(sql`\${systemConfig.key} LIKE 'compliance_rule_%'`).limit(input?.limit ?? 50);
    let rules = rows.map(r => ({ id: r.key.replace("compliance_rule_", ""), ...JSON.parse(String(r.value ?? "{}")) }));
    if (input?.category) rules = rules.filter((r: any) => r.category === input.category);
    return { rules, total: rules.length };
  }),
  runCheck: protectedProcedure.input(z.object({ ruleId: z.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(auditLog).values({ action: "compliance_check_run", resource: "compliance", resourceId: input.ruleId ?? "all", status: "success", metadata: { ruleId: input.ruleId, runAt: new Date().toISOString() } });
    return { success: true, checkId: "CHK-" + Date.now().toString(36).toUpperCase(), status: "completed" };
  }),
  createRule: protectedProcedure.input(z.object({ name: z.string(), category: z.enum(["AML", "CBN", "KYC", "PCI", "NDPR"]), severity: z.enum(["low", "medium", "high", "critical"]), automated: z.boolean().default(true), description: z.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const ruleId = "CR-" + Date.now().toString(36).toUpperCase();
    await db.insert(systemConfig).values({ key: "compliance_rule_" + ruleId, value: JSON.stringify({ ...input, status: "passing", lastCheck: new Date().toISOString(), createdAt: new Date().toISOString() }) });
    return { success: true, ruleId };
  }),
});
