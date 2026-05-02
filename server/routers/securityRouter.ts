import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { securityEvents, ipBlocklist, pbacPolicies, pbacRoleAssignments, apiRateLimits } from "../../drizzle/schema";
import { eq, desc, and, sql, gte } from "drizzle-orm";

export const securityRouter = router({
  // PBAC Policy Management
  createPolicy: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      resource: z.string(),
      action: z.enum(["create", "read", "update", "delete", "approve", "execute"]),
      conditions: z.string().optional(),
      effect: z.string().default("allow"),
      priority: z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const [policy] = await db.getDb().insert(pbacPolicies).values({
        ...input,
        createdBy: ctx.user.id,
      }).returning();
      return policy;
    }),

  listPolicies: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return await db.getDb().select().from(pbacPolicies).orderBy(desc(pbacPolicies.priority));
    }),

  assignPolicy: protectedProcedure
    .input(z.object({
      userId: z.number(),
      policyId: z.number(),
      expiresAt: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const [assignment] = await db.getDb().insert(pbacRoleAssignments).values({
        userId: input.userId,
        policyId: input.policyId,
        grantedBy: ctx.user.id,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      }).returning();
      return assignment;
    }),

  checkAccess: protectedProcedure
    .input(z.object({
      resource: z.string(),
      action: z.enum(["create", "read", "update", "delete", "approve", "execute"]),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role === "admin") return { allowed: true, reason: "Admin bypass" };
      const assignments = await db.getDb().select().from(pbacRoleAssignments)
        .where(eq(pbacRoleAssignments.userId, ctx.user.id));
      const policyIds = assignments.map(a => a.policyId);
      if (policyIds.length === 0) return { allowed: false, reason: "No policies assigned" };
      const policies = await db.getDb().select().from(pbacPolicies)
        .where(and(
          eq(pbacPolicies.resource, input.resource),
          sql`${pbacPolicies.action} = ${input.action}`,
          eq(pbacPolicies.isActive, true),
        ))
        .orderBy(desc(pbacPolicies.priority));
      const matchingPolicy = policies.find(p => policyIds.includes(p.id));
      if (!matchingPolicy) return { allowed: false, reason: "No matching policy" };
      return { allowed: matchingPolicy.effect === "allow", reason: `Policy: ${matchingPolicy.name}` };
    }),

  // Security Events
  listEvents: protectedProcedure
    .input(z.object({
      eventType: z.string().optional(),
      severity: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 50;
      const offset = (page - 1) * limit;
      const conditions = [];
      if (input?.eventType) conditions.push(eq(securityEvents.eventType, input.eventType));
      if (input?.severity) conditions.push(sql`${securityEvents.severity} = ${input.severity}`);
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const items = await db.getDb().select().from(securityEvents)
        .where(whereClause)
        .orderBy(desc(securityEvents.detectedAt))
        .limit(limit).offset(offset);
      const [{ count }] = await db.getDb().select({ count: sql<number>`count(*)` })
        .from(securityEvents).where(whereClause);
      return { items, total: Number(count), page, limit };
    }),

  getSecurityScore: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [{ criticalCount }] = await db.getDb().select({ criticalCount: sql<number>`count(*)` })
        .from(securityEvents).where(and(sql`${securityEvents.severity} = 'critical'`, gte(securityEvents.detectedAt, lastWeek)));
      const [{ highCount }] = await db.getDb().select({ highCount: sql<number>`count(*)` })
        .from(securityEvents).where(and(sql`${securityEvents.severity} = 'high'`, gte(securityEvents.detectedAt, lastWeek)));
      const [{ blockedIps }] = await db.getDb().select({ blockedIps: sql<number>`count(*)` })
        .from(ipBlocklist).where(eq(ipBlocklist.isActive, true));
      const [{ policyCount }] = await db.getDb().select({ policyCount: sql<number>`count(*)` })
        .from(pbacPolicies).where(eq(pbacPolicies.isActive, true));

      let score = 100;
      score -= Number(criticalCount) * 15;
      score -= Number(highCount) * 5;
      if (Number(policyCount) < 5) score -= 10;
      score = Math.max(0, Math.min(100, score));

      return {
        score,
        grade: score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F",
        criticalEvents: Number(criticalCount),
        highEvents: Number(highCount),
        blockedIps: Number(blockedIps),
        activePolicies: Number(policyCount),
        recommendations: [
          ...(Number(policyCount) < 5 ? ["Add more PBAC policies for granular access control"] : []),
          ...(Number(criticalCount) > 0 ? ["Investigate and resolve critical security events"] : []),
          ...(Number(blockedIps) < 1 ? ["Configure IP blocklist for known threat sources"] : []),
        ],
      };
    }),

  // IP Blocklist
  blockIp: protectedProcedure
    .input(z.object({
      ipAddress: z.string(),
      reason: z.string(),
      expiresAt: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const [entry] = await db.getDb().insert(ipBlocklist).values({
        ipAddress: input.ipAddress,
        reason: input.reason,
        blockedBy: ctx.user.name ?? "admin",
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      }).returning();
      return entry;
    }),

  listBlockedIps: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return await db.getDb().select().from(ipBlocklist)
        .where(eq(ipBlocklist.isActive, true))
        .orderBy(desc(ipBlocklist.createdAt));
    }),

  unblockIp: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const [updated] = await db.getDb().update(ipBlocklist)
        .set({ isActive: false })
        .where(eq(ipBlocklist.id, input.id))
        .returning();
      return updated;
    }),

  // Rate Limit Management
  setRateLimit: protectedProcedure
    .input(z.object({
      apiKeyId: z.number().optional(),
      tier: z.string().default("standard"),
      requestsPerMinute: z.number().default(60),
      requestsPerHour: z.number().default(1000),
      requestsPerDay: z.number().default(10000),
      burstLimit: z.number().default(100),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const [limit] = await db.getDb().insert(apiRateLimits).values(input).returning();
      return limit;
    }),

  listRateLimits: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return await db.getDb().select().from(apiRateLimits).orderBy(desc(apiRateLimits.createdAt));
    }),
});
