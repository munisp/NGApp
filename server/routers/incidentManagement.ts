import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const incidentManagementRouter = router({
  dashboard: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalIncidents: 0, open: 0, resolved: 0, critical: 0, mttrMinutes: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "incident_created")).orderBy(desc(auditLog.createdAt)).limit(500);
    const open = rows.filter(r => (r.metadata as any)?.resolved !== true).length;
    const critical = rows.filter(r => (r.metadata as any)?.severity === "critical").length;
    return { totalIncidents: rows.length, open, resolved: rows.length - open, critical, mttrMinutes: 45 };
  }),
  listIncidents: protectedProcedure.input(z.object({ severity: z.string().optional(), limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { incidents: [], total: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "incident_created")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    let incidents = rows.map(r => ({ id: r.id, incidentId: r.resourceId, ...r.metadata as any, createdAt: r.createdAt }));
    if (input?.severity) incidents = incidents.filter((i: any) => i.severity === input.severity);
    return { incidents, total: incidents.length };
  }),
  createIncident: protectedProcedure.input(z.object({ title: z.string(), description: z.string(), severity: z.enum(["low", "medium", "high", "critical"]), assignee: z.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const incidentId = "INC-" + Date.now().toString(36).toUpperCase();
    await db.insert(auditLog).values({ action: "incident_created", resource: "incidents", resourceId: incidentId, status: "warning", metadata: { title: input.title, description: input.description, severity: input.severity, assignee: input.assignee, resolved: false } });
    return { success: true, incidentId };
  }),
  resolveIncident: protectedProcedure.input(z.object({ incidentId: z.string(), resolution: z.string() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(auditLog).values({ action: "incident_resolved", resource: "incidents", resourceId: input.incidentId, status: "success", metadata: { resolution: input.resolution, resolved: true } });
    return { success: true };
  }),
});
