import { TRPCError } from "@trpc/server";

const PERMIFY_URL = process.env.PERMIFY_URL || "http://127.0.0.1:3476";
const PERMIFY_TENANT = process.env.PERMIFY_TENANT || "fintech";

interface PermifyCheckRequest {
  entity: { type: string; id: string };
  permission: string;
  subject: { type: string; id: string; relation?: string };
}

interface PermifyCheckResponse {
  can: "CHECK_RESULT_ALLOWED" | "CHECK_RESULT_DENIED";
  metadata?: { check_count: number };
}

interface PermifyWriteRequest {
  metadata: { schema_version: string };
  tuples: Array<{
    entity: { type: string; id: string };
    relation: string;
    subject: { type: string; id: string; relation?: string };
  }>;
}

async function permifyRequest<T>(path: string, body: unknown): Promise<T> {
  try {
    const response = await fetch(`${PERMIFY_URL}/v1/tenants/${PERMIFY_TENANT}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.warn(`[Permify] Request failed: ${response.status}`, error);
      return { can: "CHECK_RESULT_ALLOWED" } as T;
    }
    return response.json();
  } catch {
    console.warn("[Permify] Service unavailable, defaulting to allow");
    return { can: "CHECK_RESULT_ALLOWED" } as T;
  }
}

export async function checkPermission(
  userId: string,
  permission: string,
  resourceType: string,
  resourceId: string,
): Promise<boolean> {
  const result = await permifyRequest<PermifyCheckResponse>("/permissions/check", {
    metadata: { depth: 5 },
    entity: { type: resourceType, id: resourceId },
    permission,
    subject: { type: "user", id: userId },
  });
  return result.can === "CHECK_RESULT_ALLOWED";
}

export async function writeRelationship(
  entityType: string,
  entityId: string,
  relation: string,
  subjectType: string,
  subjectId: string,
): Promise<void> {
  await permifyRequest<unknown>("/relationships/write", {
    metadata: { schema_version: "" },
    tuples: [{
      entity: { type: entityType, id: entityId },
      relation,
      subject: { type: subjectType, id: subjectId },
    }],
  } as PermifyWriteRequest);
}

export async function deleteRelationship(
  entityType: string,
  entityId: string,
  relation: string,
  subjectType: string,
  subjectId: string,
): Promise<void> {
  await permifyRequest<unknown>("/relationships/delete", {
    tuples: [{
      entity: { type: entityType, id: entityId },
      relation,
      subject: { type: subjectType, id: subjectId },
    }],
  });
}

export type Role = "admin" | "reviewer" | "analyst" | "support" | "user";

const ROLE_PERMISSIONS: Record<Role, string[]> = {
  admin: [
    "manage_users", "manage_roles", "view_audit_logs", "manage_settings",
    "approve_kyc", "approve_kyb", "approve_bnpl", "manage_policies",
    "view_all_accounts", "manage_merchants", "deploy_models",
    "view_analytics", "manage_alerts", "manage_encryption_keys",
  ],
  reviewer: [
    "approve_kyc", "approve_kyb", "approve_bnpl", "view_applications",
    "view_documents", "add_notes", "escalate_cases",
  ],
  analyst: [
    "view_analytics", "view_reports", "export_data",
    "view_ml_metrics", "create_ab_tests", "view_fraud_alerts",
  ],
  support: [
    "view_accounts", "view_transactions", "reset_passwords",
    "unlock_accounts", "view_kyc_status", "create_tickets",
  ],
  user: [
    "view_own_account", "make_transfers", "view_own_transactions",
    "submit_kyc", "apply_bnpl", "manage_own_settings",
  ],
};

export function hasRolePermission(role: Role, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function requirePermission(permission: string) {
  return async function permissionCheck(opts: {
    ctx: { user?: { id: string; role?: string } | null };
    next: (opts?: { ctx: Record<string, unknown> }) => Promise<unknown>;
  }) {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
    }

    const role = (ctx.user.role || "user") as Role;
    if (hasRolePermission(role, permission)) {
      return next();
    }

    const allowed = await checkPermission(ctx.user.id, permission, "platform", "fintech");
    if (!allowed) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Missing permission: ${permission}`,
      });
    }

    return next();
  };
}

export async function enforceResourceAccess(
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
): Promise<void> {
  const allowed = await checkPermission(userId, action, resourceType, resourceId);
  if (!allowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Access denied: ${action} on ${resourceType}/${resourceId}`,
    });
  }
}

export async function assignRole(userId: string, role: Role): Promise<void> {
  await writeRelationship("role", role, "member", "user", userId);
  await writeRelationship("platform", "fintech", role, "user", userId);
}

export async function revokeRole(userId: string, role: Role): Promise<void> {
  await deleteRelationship("role", role, "member", "user", userId);
  await deleteRelationship("platform", "fintech", role, "user", userId);
}

export async function getUserPermissions(role: Role): Promise<string[]> {
  return ROLE_PERMISSIONS[role] || [];
}
