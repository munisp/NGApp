import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { platform_incidents, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const incidentManagementRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), severity: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const conditions = [];
      if (input?.severity) conditions.push(eq(platform_incidents.severity, input.severity));
      const rows = await db.select().from(platform_incidents).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(platform_incidents.startedAt)).limit(input?.limit ?? 50);
      return { incidents: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  create: protectedProcedure.input(z.object({ title: z.string().min(3).max(256), severity: z.enum(["critical", "high", "medium", "low"]).default("medium"), description: z.string().optional() })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [inc] = await db.insert(platform_incidents).values({ title: input.title, severity: input.severity, status: "open", description: input.description ?? "" }).returning();
      await db.insert(auditLog).values({ action: "incident_created", resource: "platform_incidents", resourceId: String(inc.id), status: "success", metadata: { title: input.title, severity: input.severity } });
      return { id: inc.id, title: input.title, status: "open" };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(platform_incidents).limit(100);
    const [open] = await db.select({ value: count() }).from(platform_incidents).where(eq(platform_incidents.status, "open")).limit(100);
    return { totalIncidents: Number(total.value), openIncidents: Number(open.value) };
  }),
});
