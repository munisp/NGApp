import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const bulkRoleImportRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalRoles: 0, totalImports: 0, lastImport: null };
    const roles = await db.select().from(systemConfig).where(sql`${systemConfig.key} LIKE 'role_%'`);
    const imports = await db.select().from(auditLog).where(eq(auditLog.action, "bulk_role_import")).orderBy(desc(auditLog.createdAt)).limit(1);
    return { totalRoles: roles.length, totalImports: imports.length, lastImport: imports.length > 0 ? imports[0].createdAt : null };
  }),
  listRoles: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { roles: [], total: 0 };
    const rows = await db.select().from(systemConfig).where(sql`${systemConfig.key} LIKE 'role_%'`).limit(input?.limit ?? 50);
    return { roles: rows.map(r => ({ id: r.key.replace("role_", ""), ...JSON.parse(String(r.value ?? "{}")) })), total: rows.length };
  }),
  importRoles: protectedProcedure.input(z.object({ roles: z.array(z.object({ name: z.string(), permissions: z.array(z.string()), description: z.string().optional() })) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    let imported = 0;
    for (const role of input.roles) {
      const key = "role_" + role.name.toLowerCase().replace(/\s+/g, "_");
      await db.insert(systemConfig).values({ key, value: JSON.stringify(role) }).onConflictDoUpdate({ target: systemConfig.key, set: { value: JSON.stringify(role), updatedAt: new Date() } });
      imported++;
    }
    await db.insert(auditLog).values({ action: "bulk_role_import", resource: "roles", resourceId: "bulk", status: "success", metadata: { imported } });
    return { success: true, imported };
  }),
});
