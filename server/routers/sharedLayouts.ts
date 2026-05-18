import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const sharedLayoutsRouter = router({
  listLayouts: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "shared_layout")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { layouts: rows.map(r => ({ id: r.resourceId, name: r.action, metadata: r.metadata, createdAt: r.createdAt })), total: rows.length };
  }),
  getLayout: protectedProcedure.input(z.object({ name: z.string() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, `layout_${input.name}`)).limit(1);
    return config ? { name: input.name, config: JSON.parse(String(config.value)) } : null;
  }),
  saveLayout: protectedProcedure.input(z.object({ name: z.string(), config: z.record(z.string(), z.unknown()) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.insert(systemConfig).values({ key: `layout_${input.name}`, value: JSON.stringify(input.config) }).onConflictDoUpdate({ target: systemConfig.key, set: { value: JSON.stringify(input.config), updatedAt: new Date() } });
    await db.insert(auditLog).values({ action: input.name, resource: "shared_layout", resourceId: input.name, status: "success", metadata: {} });
    return { success: true, name: input.name };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "shared_layout"));
    return { totalLayouts: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
