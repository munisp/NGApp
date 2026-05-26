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
 * Requires the Go worker + Permify to be running.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

const WORKER_URL = process.env.GO_WORKER_URL ?? "http://localhost:8090";

// ─── HTTP helper ───────────────────────────────────────────────────────────────

async function workerFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${WORKER_URL}/v1${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    signal: AbortSignal.timeout(3000),
  });
}

function authzError(message: string): TRPCError {
  return new TRPCError({
    code: "SERVICE_UNAVAILABLE",
    message: `Permify authorization service unavailable: ${message}. Ensure Go worker is running at ${WORKER_URL}`,
  });
}

// ─── Exported helpers for testing ───────────────────────────────────────────

export async function checkPermission(
  subjectType: string,
  subjectId: string,
  permission: string,
  entityType: string,
  entityId: string,
): Promise<boolean> {
  try {
    const res = await workerFetch("/authz/check", {
      method: "POST",
      body: JSON.stringify({ subjectType, subjectId, permission, entityType, entityId }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { allowed: boolean };
    return data.allowed;
  } catch (err) {
    throw authzError(err instanceof Error ? err.message : "check failed");
  }
}

// ─── Router ────────────────────────────────────────────────────────────────────

export const authzRouter = router({
  /**
   * Check if the current user has a specific permission on an entity.
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
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw authzError(err instanceof Error ? err.message : "check failed");
      }
    }),

  /**
   * Bulk permission check for multiple entities at once.
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
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw authzError(err instanceof Error ? err.message : "bulk check failed");
      }
    }),

  /**
   * Write a relationship tuple to Permify.
   */
  writeRelation: protectedProcedure
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
      try {
        const res = await workerFetch("/authz/relations", {
          method: "POST",
          body: JSON.stringify(input),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json() as { success: boolean };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw authzError(err instanceof Error ? err.message : "write relation failed");
      }
    }),

  /**
   * Delete a relationship tuple from Permify.
   */
  deleteRelation: protectedProcedure
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
      try {
        const res = await workerFetch("/authz/relations", {
          method: "DELETE",
          body: JSON.stringify(input),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json() as { success: boolean };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw authzError(err instanceof Error ? err.message : "delete relation failed");
      }
    }),
});
