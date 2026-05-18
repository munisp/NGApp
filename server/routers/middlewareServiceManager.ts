import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const middlewareServiceManagerRouter = router({
  listServices: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const services = ["kafka", "redis", "postgresql", "keycloak", "permify", "opensearch", "temporal", "dapr", "fluvio", "apisix", "tigerbeetle"];
    const statuses = [];
    for (const svc of services) {
      const [latest] = await db.select().from(auditLog).where(eq(auditLog.resourceId, svc)).orderBy(desc(auditLog.createdAt)).limit(1);
      statuses.push({ name: svc, status: latest?.status ?? "unknown", lastSeen: latest?.createdAt ?? null });
    }
    return { services: statuses };
  }),
  getServiceHealth: protectedProcedure.input(z.object({ service: z.string() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resourceId, input.service)).orderBy(desc(auditLog.createdAt)).limit(10);
    return { service: input.service, events: rows, total: rows.length };
  }),
  restartService: protectedProcedure.input(z.object({ service: z.string() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.insert(auditLog).values({ action: "service_restart", resource: "middleware", resourceId: input.service, status: "success", metadata: { restartedAt: new Date().toISOString() } });
    return { success: true, service: input.service, status: "restarting" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "middleware"));
    return { totalEvents: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
