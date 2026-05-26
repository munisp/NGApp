/**
 * usePermission — React hook for Permify-backed RBAC permission checks
 *
 * Usage:
 *   const { allowed, loading } = usePermission("well", wellId, "write");
 *   const { allowed: canDelete } = usePermission("well", wellId, "delete");
 *
 * Falls back to role-based simulation when Permify is unavailable.
 * The hook is optimistic — it returns `allowed: true` while loading
 * to prevent UI flicker on fast connections.
 */
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export type Permission =
  | "read"
  | "write"
  | "delete"
  | "admin"
  | "acknowledge_alarm"
  | "suppress_alarm"
  | "issue_command"
  | "approve"
  | "submit"
  | "export_reports"
  | "view_audit_log"
  | "manage_users";

export type EntityType =
  | "organization"
  | "field"
  | "well"
  | "alarm"
  | "permit"
  | "report"
  | "workorder";

/**
 * Check a single permission on an entity.
 */
export function usePermission(
  entityType: EntityType,
  entityId: string,
  permission: Permission
): { allowed: boolean; loading: boolean; source: string } {
  const { user } = useAuth();

  const { data, isLoading } = trpc.authz.check.useQuery(
    { entityType, entityId, permission },
    {
      enabled: !!user,
      staleTime: 30_000, // Cache permission checks for 30 seconds
      retry: false,
    }
  );

  if (!user) return { allowed: false, loading: false, source: "unauthenticated" };
  if (isLoading) return { allowed: true, loading: true, source: "loading" }; // Optimistic
  return {
    allowed: data?.allowed ?? false,
    loading: false,
    source: data?.source ?? "unknown",
  };
}

/**
 * Bulk-check multiple permissions at once (for list views).
 * Returns a map of entityId → permission → allowed.
 */
export function useBulkPermissions(
  checks: Array<{ entityType: EntityType; entityId: string; permission: Permission }>
): { results: Map<string, boolean>; loading: boolean } {
  const { user } = useAuth();

  const { data, isLoading } = trpc.authz.bulkCheck.useQuery(
    { checks },
    {
      enabled: !!user && checks.length > 0,
      staleTime: 30_000,
      retry: false,
    }
  );

  const results = new Map<string, boolean>();
  if (data?.results) {
    for (const r of data.results) {
      results.set(`${r.entityType}:${r.entityId}:${r.permission}`, r.allowed);
    }
  }

  return { results, loading: isLoading };
}

/**
 * Simple role-based check without Permify (uses local auth state).
 * Use this for UI-only gates where latency matters more than accuracy.
 */
export function useRole(): {
  isAdmin: boolean;
  isOperator: boolean;
  isViewer: boolean;
  isAuditor: boolean;
  role: string;
} {
  const { user } = useAuth();
  const role = (user as { role?: string })?.role ?? "viewer";
  return {
    isAdmin: role === "admin",
    isOperator: role === "admin" || role === "operator",
    isViewer: true, // All authenticated users can view
    isAuditor: role === "admin" || role === "auditor",
    role,
  };
}
