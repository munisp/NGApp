import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { platform_incidents, auditLog } from "../../drizzle/schema";

export const incidentManagementRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), severity: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [];
    if (input?.severity) conditions.push(eq(platform_incidents.severity, input.severity));
    const rows = await db.select().from(platform_incidents).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(platform_incidents.startedAt)).limit(input?.limit ?? 50);
    return { incidents: rows, total: rows.length };
  }),
  create: protectedProcedure.input(z.object({ title: z.string().min(3).max(256), severity: z.enum(["critical", "high", "medium", "low"]).default("medium"), description: z.string().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [inc] = await db.insert(platform_incidents).values({ title: input.title, severity: input.severity, status: "open", description: input.description ?? "" }).returning();
    await db.insert(auditLog).values({ action: "incident_created", resource: "platform_incidents", resourceId: String(inc.id), status: "success", metadata: { title: input.title, severity: input.severity } });
    return { id: inc.id, title: input.title, status: "open" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(platform_incidents);
    const [open] = await db.select({ value: count() }).from(platform_incidents).where(eq(platform_incidents.status, "open"));
    return { totalIncidents: Number(total.value), openIncidents: Number(open.value) };
  }),
});
