/**
 * Multi-tenant isolation helper.
 * Provides utility to automatically filter queries by tenantId.
 *
 * Usage in routers:
 *   import { getTenantFilter } from "../_core/tenantFilter";
 *   const filter = getTenantFilter(ctx);
 *   const rows = await db.select().from(wells).where(and(filter(wells.tenantId), ...));
 */
import { eq, type SQL, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

interface TenantContext {
  user?: { tenantId?: string; role?: string } | null;
}

export function getTenantFilter(ctx: TenantContext) {
  return (column: PgColumn): SQL | undefined => {
    // Admin users can see all tenants
    if (ctx.user?.role === "admin") return undefined;
    // If user has tenantId, filter by it
    if (ctx.user?.tenantId) {
      return eq(column, ctx.user.tenantId);
    }
    return undefined;
  };
}

export function requireTenantId(ctx: TenantContext): string {
  const tenantId = ctx.user?.tenantId;
  if (!tenantId && ctx.user?.role !== "admin") {
    throw new Error("Tenant ID required for non-admin users");
  }
  return tenantId ?? "";
}
