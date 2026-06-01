/**
 * tenantIsolation.ts — Multi-tenant field isolation management
 * Manages field-level access control for multi-operator environments
 */
import { z } from "zod";
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { getPool } from "../db";

export const tenantIsolationRouter = router({
  // List all tenants/operators
  listTenants: adminProcedure.query(async () => {
    const pool = await getPool();
    if (!pool) return [];
    try {
      const result = await pool.query(`
        SELECT id, tenant_id, name, fields, contact_email, active, created_at
        FROM tenants ORDER BY name
      `);
      return result.rows;
    } catch { return []; }
  }),

  // Get fields accessible to the current user's tenant
  myFields: protectedProcedure.query(async ({ ctx }) => {
    const pool = await getPool();
    if (!pool) return [];
    try {
      // Admin sees all fields
      if (ctx.user.role === "admin") {
        const result = await pool.query("SELECT DISTINCT field FROM wells ORDER BY field");
        return result.rows.map((r: any) => r.field);
      }
      // Regular users see their tenant's fields
      const result = await pool.query(`
        SELECT t.fields FROM tenants t
        JOIN tenant_users tu ON tu.tenant_id = t.tenant_id
        WHERE tu.user_open_id = $1 AND t.active = true
        LIMIT 1
      `, [ctx.user.openId]);
      return result.rows[0]?.fields ?? [];
    } catch { return []; }
  }),

  // Create a new tenant
  createTenant: adminProcedure
    .input(z.object({
      tenantId: z.string().min(3).max(50),
      name: z.string().min(1),
      fields: z.array(z.string()),
      contactEmail: z.string().email().optional(),
    }))
    .mutation(async ({ input }) => {
      const pool = await getPool();
      if (!pool) throw new Error("Database unavailable");
      await pool.query(`
        INSERT INTO tenants (tenant_id, name, fields, contact_email, active)
        VALUES ($1, $2, $3, $4, true)
        ON CONFLICT (tenant_id) DO UPDATE SET name = EXCLUDED.name, fields = EXCLUDED.fields, contact_email = EXCLUDED.contact_email
      `, [input.tenantId, input.name, input.fields, input.contactEmail]);
      return { success: true };
    }),

  // Assign user to tenant
  assignUser: adminProcedure
    .input(z.object({
      tenantId: z.string(),
      userOpenId: z.string(),
      role: z.enum(["VIEWER", "OPERATOR", "SUPERVISOR", "ADMIN"]).default("OPERATOR"),
    }))
    .mutation(async ({ input }) => {
      const pool = await getPool();
      if (!pool) throw new Error("Database unavailable");
      await pool.query(`
        INSERT INTO tenant_users (tenant_id, user_open_id, role, assigned_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (tenant_id, user_open_id) DO UPDATE SET role = EXCLUDED.role
      `, [input.tenantId, input.userOpenId, input.role]);
      return { success: true };
    }),

  // Remove user from tenant
  removeUser: adminProcedure
    .input(z.object({ tenantId: z.string(), userOpenId: z.string() }))
    .mutation(async ({ input }) => {
      const pool = await getPool();
      if (!pool) throw new Error("Database unavailable");
      await pool.query("DELETE FROM tenant_users WHERE tenant_id = $1 AND user_open_id = $2", [input.tenantId, input.userOpenId]);
      return { success: true };
    }),

  // Delete tenant
  deleteTenant: adminProcedure
    .input(z.object({ tenantId: z.string() }))
    .mutation(async ({ input }) => {
      const pool = await getPool();
      if (!pool) throw new Error("Database unavailable");
      await pool.query("UPDATE tenants SET active = false WHERE tenant_id = $1", [input.tenantId]);
      return { success: true };
    }),
});
