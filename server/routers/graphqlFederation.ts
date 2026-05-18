import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const graphqlFederationRouter = router({
  getSchemaRegistry: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "graphql_schema")).orderBy(desc(auditLog.createdAt)).limit(20);
    return { schemas: rows.map(r => ({ service: r.resourceId, action: r.action, registeredAt: r.createdAt })), total: rows.length };
  }),
  getConfig: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, "graphql_federation_config")).limit(1);
    return config ? JSON.parse(String(config.value)) : { gateway: "apollo", services: [], introspection: false, playground: false };
  }),
  registerSubgraph: protectedProcedure.input(z.object({ name: z.string(), url: z.string(), sdl: z.string().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.insert(auditLog).values({ action: "subgraph_registered", resource: "graphql_schema", resourceId: input.name, status: "success", metadata: { url: input.url } });
    return { success: true, name: input.name, url: input.url };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "graphql_schema"));
    return { totalSchemas: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
