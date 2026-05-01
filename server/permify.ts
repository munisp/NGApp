/**
 * Permify resource-level access control helper.
 *
 * This module provides a lightweight wrapper around the Permify HTTP API
 * so tRPC procedures can enforce fine-grained permissions without coupling
 * business logic to the IAM layer.
 *
 * In production, PERMIFY_URL should point to the Permify sidecar running
 * alongside the NDSEP server (default: http://localhost:3476).
 *
 * Schema (loaded into Permify on first boot):
 *   entity user {}
 *   entity organization { relation admin @user; relation member @user; }
 *   action issue_penalty = admin
 *   action issue_certificate = admin
 *   action approve_transfer = admin
 *   action access_pcap = admin
 *   action assign_role = admin
 */

import { TRPCError } from "@trpc/server";

const PERMIFY_URL = process.env.PERMIFY_URL ?? "http://localhost:3476";
const PERMIFY_TENANT = process.env.PERMIFY_TENANT ?? "ndsep";

export type PermifyAction =
  | "issue_penalty"
  | "issue_certificate"
  | "approve_transfer"
  | "access_pcap"
  | "assign_role";

interface CheckResult {
  can: "RESULT_ALLOWED" | "RESULT_DENIED" | "RESULT_UNKNOWN";
}

/**
 * Check if a user is allowed to perform `action` on `resourceType:resourceId`.
 * Falls back to ALLOWED when Permify is unreachable (dev/test environments).
 */
export async function permifyCheck(
  subjectId: string | number,
  action: PermifyAction,
  resourceType: string,
  resourceId: string | number
): Promise<boolean> {
  try {
    const body = {
      metadata: { schema_version: "", snap_token: "", depth: 20 },
      entity: { type: resourceType, id: String(resourceId) },
      permission: action,
      subject: { type: "user", id: String(subjectId) },
    };

    const res = await fetch(
      `${PERMIFY_URL}/v1/tenants/${PERMIFY_TENANT}/permissions/check`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(2000),
      }
    );

    if (!res.ok) {
      // Permify returned an error — fail open in dev, fail closed in prod
      if (process.env.NODE_ENV === "production") return false;
      return true;
    }

    const data: CheckResult = await res.json();
    return data.can === "RESULT_ALLOWED";
  } catch {
    // Permify unreachable — fail open in dev, fail closed in prod
    if (process.env.NODE_ENV === "production") return false;
    return true;
  }
}

/**
 * Convenience wrapper: throws FORBIDDEN if the check fails.
 * Use inside tRPC procedures:
 *
 *   await requirePermission(ctx.user.id, "issue_penalty", "organization", input.organizationId);
 */
export async function requirePermission(
  subjectId: string | number,
  action: PermifyAction,
  resourceType: string,
  resourceId: string | number
): Promise<void> {
  const allowed = await permifyCheck(subjectId, action, resourceType, resourceId);
  if (!allowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Permission denied: ${action} on ${resourceType}:${resourceId}`,
    });
  }
}

/**
 * Write a relationship tuple to Permify (e.g., when a user is assigned admin).
 * Idempotent — safe to call multiple times.
 */
export async function permifyWriteRelationship(
  resourceType: string,
  resourceId: string | number,
  relation: string,
  subjectType: string,
  subjectId: string | number
): Promise<void> {
  try {
    const body = {
      metadata: { schema_version: "" },
      tuples: [
        {
          entity: { type: resourceType, id: String(resourceId) },
          relation,
          subject: { type: subjectType, id: String(subjectId) },
        },
      ],
    };

    await fetch(
      `${PERMIFY_URL}/v1/tenants/${PERMIFY_TENANT}/relationships/write`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(2000),
      }
    );
  } catch {
    // Non-critical — log but don't throw
    console.warn("[permify] Failed to write relationship tuple");
  }
}
