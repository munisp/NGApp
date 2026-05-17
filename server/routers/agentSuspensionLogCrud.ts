// Sprint 87: Full domain logic — suspension workflow (warn→suspend→reinstate), auto-escalation
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { agentSuspensionLog } from "../../drizzle/schema";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const SUSPENSION_WORKFLOW = { warn: "suspended", suspended: "reactivated", reactivated: "warn" };
const MAX_WARNINGS_BEFORE_AUTO_SUSPEND = 3;

export const agentSuspensionLogRouter = router({
  list: protectedProcedure.input(z.object({ agentId: z.number().optional(), action: z.string().optional(), limit: z.number().default(20), offset: z.number().default(0) })).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions: any[] = [];
    if (input.agentId) conditions.push(eq(agentSuspensionLog.agentId, input.agentId));
    if (input.action) conditions.push(eq(agentSuspensionLog.action, input.action));
    const rows = await db.select().from(agentSuspensionLog).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(agentSuspensionLog.id)).limit(input.limit).offset(input.offset);
    const [{ total }] = await db.select({ total: count() }).from(agentSuspensionLog).where(conditions.length ? and(...conditions) : undefined);
    return { items: rows, total };
  }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [row] = await db.select().from(agentSuspensionLog).where(eq(agentSuspensionLog.id, input.id));
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Suspension log entry not found" });
    return row;
  }),
  warn: protectedProcedure.input(z.object({ agentId: z.number(), reason: z.string().min(10, "Reason must be at least 10 characters"), performedBy: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    // Count existing warnings
    const [{ total: warningCount }] = await db.select({ total: count() }).from(agentSuspensionLog).where(and(eq(agentSuspensionLog.agentId, input.agentId), eq(agentSuspensionLog.action, "warn")));
    // Auto-escalate to suspension if too many warnings
    const action = warningCount >= MAX_WARNINGS_BEFORE_AUTO_SUSPEND - 1 ? "suspend" : "warn";
    const [row] = await db.insert(agentSuspensionLog).values({ agentId: input.agentId, action, reason: action === "suspend" ? `AUTO-ESCALATED: ${input.reason} (${warningCount + 1} warnings)` : input.reason, performedBy: input.performedBy } as any).returning();
    return { ...row, autoEscalated: action === "suspend", warningCount: warningCount + 1, message: action === "suspend" ? `Agent auto-suspended after ${warningCount + 1} warnings` : `Warning ${warningCount + 1}/${MAX_WARNINGS_BEFORE_AUTO_SUSPEND} issued` };
  }),
  suspend: protectedProcedure.input(z.object({ agentId: z.number(), reason: z.string().min(10), performedBy: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    // Check if already suspended
    const [lastAction] = await db.select().from(agentSuspensionLog).where(eq(agentSuspensionLog.agentId, input.agentId)).orderBy(desc(agentSuspensionLog.id)).limit(1);
    if (lastAction?.action === "suspend") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Agent is already suspended" });
    const [row] = await db.insert(agentSuspensionLog).values({ agentId: input.agentId, action: "suspend", reason: input.reason, performedBy: input.performedBy } as any).returning();
    return { ...row, message: "Agent suspended successfully" };
  }),
  reinstate: protectedProcedure.input(z.object({ agentId: z.number(), reason: z.string().min(10), performedBy: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [lastAction] = await db.select().from(agentSuspensionLog).where(eq(agentSuspensionLog.agentId, input.agentId)).orderBy(desc(agentSuspensionLog.id)).limit(1);
    if (!lastAction || lastAction.action !== "suspend") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Agent is not currently suspended" });
    const [row] = await db.insert(agentSuspensionLog).values({ agentId: input.agentId, action: "reactivate", reason: input.reason, performedBy: input.performedBy } as any).returning();
    return { ...row, message: "Agent reinstated successfully" };
  }),
  getAgentStatus: protectedProcedure.input(z.object({ agentId: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [lastAction] = await db.select().from(agentSuspensionLog).where(eq(agentSuspensionLog.agentId, input.agentId)).orderBy(desc(agentSuspensionLog.id)).limit(1);
    const [{ total: warningCount }] = await db.select({ total: count() }).from(agentSuspensionLog).where(and(eq(agentSuspensionLog.agentId, input.agentId), eq(agentSuspensionLog.action, "warn")));
    return { agentId: input.agentId, currentStatus: lastAction?.action === "suspend" ? "suspended" : "active", lastAction: lastAction || null, warningCount, maxWarnings: MAX_WARNINGS_BEFORE_AUTO_SUSPEND };
  }),
});
