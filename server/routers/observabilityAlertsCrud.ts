// Sprint 87: Alert correlation, deduplication, escalation chains
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { observabilityAlerts } from "../../drizzle/schema";
import { eq, desc, and, count, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const ESCALATION_CHAIN = ["on_call_engineer", "team_lead", "engineering_manager", "vp_engineering", "cto"];
const DEDUP_WINDOW_MS = 300000; // 5 minutes

export const observabilityAlertsRouter = router({
  list: protectedProcedure.input(z.object({ status: z.string().optional(), severity: z.string().optional(), service: z.string().optional(), limit: z.number().default(20), offset: z.number().default(0) })).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions: any[] = [];
    if (input.status) conditions.push(eq(observabilityAlerts.status, input.status));
    if (input.severity) conditions.push(eq(observabilityAlerts.severity, input.severity));
    if (input.service) conditions.push(eq(observabilityAlerts.service, input.service));
    const rows = await db.select().from(observabilityAlerts).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(observabilityAlerts.createdAt)).limit(input.limit).offset(input.offset);
    const [{ total }] = await db.select({ total: count() }).from(observabilityAlerts).where(conditions.length ? and(...conditions) : undefined);
    return { items: rows, total };
  }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [row] = await db.select().from(observabilityAlerts).where(eq(observabilityAlerts.id, input.id));
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
    return row;
  }),
  create: protectedProcedure.input(z.object({ alertName: z.string(), service: z.string(), severity: z.enum(["critical", "warning", "info"]), metric: z.string(), threshold: z.string(), currentValue: z.string().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    // Deduplication: check for same alert within window
    const [recent] = await db.select().from(observabilityAlerts).where(and(eq(observabilityAlerts.alertName, input.alertName), eq(observabilityAlerts.service, input.service), eq(observabilityAlerts.status, "firing"), sql`created_at > NOW() - INTERVAL '5 minutes'`));
    if (recent) return { ...recent, deduplicated: true, message: "Alert deduplicated — existing alert still firing" };
    const [row] = await db.insert(observabilityAlerts).values(input as any).returning();
    const escalationLevel = input.severity === "critical" ? 2 : input.severity === "warning" ? 1 : 0;
    return { ...row, deduplicated: false, escalateTo: ESCALATION_CHAIN[escalationLevel] };
  }),
  acknowledge: protectedProcedure.input(z.object({ id: z.number(), acknowledgedBy: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [alert] = await db.select().from(observabilityAlerts).where(eq(observabilityAlerts.id, input.id));
    if (!alert) throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
    if (alert.status !== "firing") throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Cannot acknowledge alert with status: ${alert.status}` });
    const [row] = await db.update(observabilityAlerts).set({ status: "acknowledged", acknowledgedBy: input.acknowledgedBy, acknowledgedAt: new Date() }).where(eq(observabilityAlerts.id, input.id)).returning();
    return { ...row, message: "Alert acknowledged" };
  }),
  resolve: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [row] = await db.update(observabilityAlerts).set({ status: "resolved", resolvedAt: new Date() }).where(eq(observabilityAlerts.id, input.id)).returning();
    return { ...row, message: "Alert resolved" };
  }),
  getSummary: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [stats] = await db.select({ total: count(), firing: sql<number>`COUNT(*) FILTER (WHERE status = 'firing')`, acknowledged: sql<number>`COUNT(*) FILTER (WHERE status = 'acknowledged')`, resolved: sql<number>`COUNT(*) FILTER (WHERE status = 'resolved')` }).from(observabilityAlerts);
    return { ...stats, escalationChain: ESCALATION_CHAIN };
  }),
});
