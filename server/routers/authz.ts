/**
 * server/routers/authz.ts — tRPC router for Permify authorization
 *
 * Provides fine-grained RBAC/ABAC authorization checks via the Permify gRPC
 * service (proxied through the Go middleware worker's HTTP API).
 *
 * Schema model (Permify DSL):
 *   entity user {}
 *   entity well {
 *     relation owner @user
 *     relation operator @user
 *     relation viewer @user
 *     action read = owner or operator or viewer
 *     action write = owner or operator
 *     action admin = owner
 *   }
 *   entity field {
 *     relation manager @user
 *     relation engineer @user
 *     action read = manager or engineer
 *     action write = manager
 *   }
 *
 * Falls back to role-based simulation when Permify is unavailable.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

const WORKER_URL = process.env.GO_WORKER_URL ?? "http://localhost:8090";
const PERMIFY_ENABLED = process.env.PERMIFY_ENABLED !== "false";

// ─── HTTP helper ───────────────────────────────────────────────────────────────

async function workerFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${WORKER_URL}/v1${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    signal: AbortSignal.timeout(3000),
  });
}

// ─── Simulation ────────────────────────────────────────────────────────────────

export function simulatePermifyCheck(
  subjectType: string,
  subjectId: string,
  permission: string,
  entityType: string,
  entityId: string,
  role: string
): boolean {
  if (role === "admin") return true;
  if (permission === "read") return true;
  if (permission === "write" && role !== "viewer") return true;
  return false;
}

// ─── Router ────────────────────────────────────────────────────────────────────

export const authzRouter = router({
  /**
   * Check if the current user has a specific permission on an entity.
   * Used by UI to conditionally show/hide actions.
   */
  check: protectedProcedure
    .input(
      z.object({
        entityType: z.string(),
        entityId: z.string(),
        permission: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user?.openId ?? "anonymous";
      const userRole = (ctx.user as { role?: string })?.role ?? "user";

      if (!PERMIFY_ENABLED) {
        return {
          allowed: simulatePermifyCheck("user", userId, input.permission, input.entityType, input.entityId, userRole),
          source: "simulated",
        };
      }

      try {
        const res = await workerFetch("/authz/check", {
          method: "POST",
          body: JSON.stringify({
            subjectType: "user",
            subjectId: userId,
            permission: input.permission,
            entityType: input.entityType,
            entityId: input.entityId,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { allowed: boolean };
        return { allowed: data.allowed, source: "permify" };
      } catch {
        return {
          allowed: simulatePermifyCheck("user", userId, input.permission, input.entityType, input.entityId, userRole),
          source: "simulated",
        };
      }
    }),

  /**
   * Bulk permission check for multiple entities at once.
   * Used by list views to determine which actions are available per row.
   */
  bulkCheck: protectedProcedure
    .input(
      z.object({
        checks: z.array(
          z.object({
            entityType: z.string(),
            entityId: z.string(),
            permission: z.string(),
          })
        ).max(50),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user?.openId ?? "anonymous";
      const userRole = (ctx.user as { role?: string })?.role ?? "user";

      if (!PERMIFY_ENABLED) {
        const results = input.checks.map((c) => ({
          ...c,
          allowed: simulatePermifyCheck("user", userId, c.permission, c.entityType, c.entityId, userRole),
        }));
        return { results, source: "simulated" as const };
      }

      try {
        const res = await workerFetch("/authz/bulk-check", {
          method: "POST",
          body: JSON.stringify({
            subjectType: "user",
            subjectId: userId,
            checks: input.checks,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { results: Array<{ entityType: string; entityId: string; permission: string; allowed: boolean }> };
        return { results: data.results, source: "permify" as const };
      } catch {
        const results = input.checks.map((c) => ({
          ...c,
          allowed: simulatePermifyCheck("user", userId, c.permission, c.entityType, c.entityId, userRole),
        }));
        return { results, source: "simulated" as const };
      }
    }),

  /**
   * Write a relationship tuple (e.g., assign user as operator of a well).
   */
  writeRelationship: protectedProcedure
    .input(
      z.object({
        entityType: z.string(),
        entityId: z.string(),
        relation: z.string(),
        subjectType: z.string(),
        subjectId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      if (!PERMIFY_ENABLED) {
        return { status: "simulated" };
      }
      try {
        const res = await workerFetch("/authz/relationship", {
          method: "POST",
          body: JSON.stringify(input),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json() as { status: string };
      } catch {
        return { status: "simulated" };
      }
    }),

  /**
   * Get Permify service health.
   */
  getStatus: protectedProcedure.query(async () => {
    if (!PERMIFY_ENABLED) {
      return { healthy: false, mode: "disabled", schema: "N/A" };
    }
    try {
      const res = await workerFetch("/authz/health");
      return { healthy: res.ok, mode: "permify", schema: "og-rmm-v1" };
    } catch {
      return { healthy: false, mode: "unavailable", schema: "N/A" };
    }
  }),
});
