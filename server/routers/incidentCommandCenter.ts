import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { platform_incidents, auditLog } from "../../drizzle/schema";

export const incidentCommandCenterRouter = router({
  listIncidents: protectedProcedure.input(z.object({ limit: z.number().default(50), severity: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = input?.severity ? await db.select().from(platform_incidents).where(eq(platform_incidents.severity, input.severity)).orderBy(desc(platform_incidents.startedAt)).limit(input?.limit ?? 50) : await db.select().from(platform_incidents).orderBy(desc(platform_incidents.startedAt)).limit(input?.limit ?? 50);
    return { incidents: rows, total: rows.length };
  }),
  getIncident: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [incident] = await db.select().from(platform_incidents).where(eq(platform_incidents.id, input.id)).limit(1);
    return incident ?? null;
  }),
  createIncident: protectedProcedure.input(z.object({ title: z.string(), description: z.string(), severity: z.enum(["low", "medium", "high", "critical"]), service: z.string() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [incident] = await db.insert(platform_incidents).values({ title: input.title, description: input.description, severity: input.severity, service: input.service, status: "open" }).returning();
    await db.insert(auditLog).values({ action: "incident_created", resource: "platform_incidents", resourceId: String(incident.id), status: "success", metadata: { title: input.title, severity: input.severity } });
    return incident;
  }),
  resolveIncident: protectedProcedure.input(z.object({ id: z.number(), resolution: z.string() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.update(platform_incidents).set({ status: "resolved", resolution: input.resolution, resolvedAt: new Date() }).where(eq(platform_incidents.id, input.id));
    await db.insert(auditLog).values({ action: "incident_resolved", resource: "platform_incidents", resourceId: String(input.id), status: "success", metadata: { resolution: input.resolution } });
    return { success: true };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(platform_incidents);
    const [open] = await db.select({ value: count() }).from(platform_incidents).where(eq(platform_incidents.status, "open"));
    return { totalIncidents: Number(total.value), openIncidents: Number(open.value) };
  }),
});
