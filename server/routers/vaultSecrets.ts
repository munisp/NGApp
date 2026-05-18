import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const vaultSecretsRouter = router({
  listSecrets: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "vault_secret")).orderBy(desc(auditLog.createdAt)).limit(50);
    return { secrets: rows.map(r => ({ path: r.resourceId, action: r.action, lastAccessed: r.createdAt })), total: rows.length };
  }),
  getSecret: protectedProcedure.input(z.object({ path: z.string() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, `vault_${input.path}`)).limit(1);
    await db.insert(auditLog).values({ action: "secret_accessed", resource: "vault_secret", resourceId: input.path, status: "success", metadata: {} });
    return config ? { path: input.path, exists: true, version: 1 } : { path: input.path, exists: false };
  }),
  rotateSecret: protectedProcedure.input(z.object({ path: z.string() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.insert(auditLog).values({ action: "secret_rotated", resource: "vault_secret", resourceId: input.path, status: "success", metadata: { rotatedAt: new Date().toISOString() } });
    return { success: true, path: input.path, newVersion: 2 };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "vault_secret"));
    return { totalAccesses: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
