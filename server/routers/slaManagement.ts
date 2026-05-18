import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { slaDefinitions, slaBreaches, auditLog } from "../../drizzle/schema";

export const slaManagementRouter = router({
  listSlas: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(slaDefinitions).orderBy(desc(slaDefinitions.createdAt)).limit(input?.limit ?? 50);
    return { slas: rows, total: rows.length };
  }),
  getSla: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [sla] = await db.select().from(slaDefinitions).where(eq(slaDefinitions.id, input.id)).limit(1);
    if (!sla) return null;
    const breaches = await db.select().from(slaBreaches).where(eq(slaBreaches.slaId, input.id)).orderBy(desc(slaBreaches.createdAt)).limit(20);
    return { ...sla, breaches };
  }),
  createSla: protectedProcedure.input(z.object({ name: z.string(), metric: z.string(), threshold: z.number(), unit: z.string().default("minutes") })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [sla] = await db.insert(slaDefinitions).values({ name: input.name, metric: input.metric, threshold: input.threshold, unit: input.unit }).returning();
    await db.insert(auditLog).values({ action: "sla_created", resource: "sla_definitions", resourceId: String(sla.id), status: "success", metadata: { name: input.name, metric: input.metric } });
    return sla;
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalSlas] = await db.select({ value: count() }).from(slaDefinitions);
    const [totalBreaches] = await db.select({ value: count() }).from(slaBreaches);
    return { totalSlas: Number(totalSlas.value), totalBreaches: Number(totalBreaches.value) };
  }),
});
