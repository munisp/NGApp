import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const agentMicroInsuranceRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalPolicies: 0, activePolicies: 0, totalPremiums: 0, totalCoverage: 0, totalClaims: 0 };
    const rows = await db.select().from(systemConfig).where(eq(systemConfig.key, "insurance_stats")).limit(1);
    if (rows.length > 0 && rows[0].value) return JSON.parse(String(rows[0].value));
    return { totalPolicies: 0, activePolicies: 0, totalPremiums: 0, totalCoverage: 0, totalClaims: 0 };
  }),
  listPolicies: protectedProcedure.input(z.object({ agentId: z.number().optional(), status: z.string().optional(), limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { policies: [], total: 0 };
    const rows = await db.select().from(systemConfig).where(eq(systemConfig.key, "insurance_policies")).limit(1);
    let policies: any[] = rows.length > 0 && rows[0].value ? JSON.parse(String(rows[0].value)) : [];
    if (input?.status) policies = policies.filter((p: any) => p.status === input.status);
    return { policies: policies.slice(0, input?.limit ?? 20), total: policies.length };
  }),
  createPolicy: protectedProcedure.input(z.object({ agentId: z.number(), type: z.string(), coverageAmount: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const premium = Math.floor(input.coverageAmount * 0.003);
    await db.insert(auditLog).values({ action: "insurance_policy_created", resource: "insurance", resourceId: String(input.agentId), status: "success", metadata: { type: input.type, coverageAmount: input.coverageAmount, premium } });
    return { success: true, policy: { agentId: input.agentId, type: input.type, coverageAmount: input.coverageAmount, premium, status: "pending_underwriting", createdAt: new Date().toISOString() } };
  }),
  fileClaim: protectedProcedure.input(z.object({ policyId: z.string(), amount: z.number(), description: z.string() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(auditLog).values({ action: "insurance_claim_filed", resource: "insurance", resourceId: input.policyId, status: "success", metadata: { amount: input.amount, description: input.description } });
    return { success: true, claimId: "CLM-" + Date.now().toString(36).toUpperCase(), status: "under_review" };
  }),
});
