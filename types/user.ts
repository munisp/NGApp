/**
 * User role types and permission definitions
 */

export type UserRole = 'admin' | 'reviewer' | 'analyst' | 'support';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface Permissions {
  dashboard: {
    view: boolean;
    export: boolean;
  };
  fraud: {
    view: boolean;
    review: boolean;
    approve: boolean;
    reject: boolean;
  };
  loans: {
    view: boolean;
    approve: boolean;
    reject: boolean;
    bulk: boolean;
  };
  analytics: {
    view: boolean;
    export: boolean;
  };
  users: {
    view: boolean;
    edit: boolean;
    manage_tiers: boolean;
    suspend: boolean;
  };
  settings: {
    view: boolean;
    edit: boolean;
    manage_admins: boolean;
    audit_logs: boolean;
  };
}

/**
 * Get permissions for a given user role
 */
export function getPermissions(role: UserRole): Permissions {
  const permissions: Record<UserRole, Permissions> = {
    admin: {
      dashboard: { view: true, export: true },
      fraud: { view: true, review: true, approve: true, reject: true },
      loans: { view: true, approve: true, reject: true, bulk: true },
      analytics: { view: true, export: true },
      users: { view: true, edit: true, manage_tiers: true, suspend: true },
      settings: { view: true, edit: true, manage_admins: true, audit_logs: true },
    },
    reviewer: {
      dashboard: { view: true, export: true },
      fraud: { view: true, review: true, approve: true, reject: true },
      loans: { view: true, approve: true, reject: true, bulk: true },
      analytics: { view: true, export: false },
      users: { view: true, edit: false, manage_tiers: false, suspend: false },
      settings: { view: false, edit: false, manage_admins: false, audit_logs: false },
    },
    analyst: {
      dashboard: { view: true, export: true },
      fraud: { view: true, review: false, approve: false, reject: false },
      loans: { view: true, approve: false, reject: false, bulk: false },
      analytics: { view: true, export: true },
      users: { view: true, edit: false, manage_tiers: false, suspend: false },
      settings: { view: false, edit: false, manage_admins: false, audit_logs: false },
    },
    support: {
      dashboard: { view: true, export: false },
      fraud: { view: false, review: false, approve: false, reject: false },
      loans: { view: true, approve: false, reject: false, bulk: false },
      analytics: { view: false, export: false },
      users: { view: true, edit: true, manage_tiers: false, suspend: false },
      settings: { view: false, edit: false, manage_admins: false, audit_logs: false },
    },
  };

  return permissions[role];
}

/**
 * Check if a user has a specific permission
 */
export function hasPermission(
  role: UserRole,
  category: keyof Permissions,
  action: string
): boolean {
  const perms = getPermissions(role);
  const categoryPerms = perms[category] as Record<string, boolean>;
  return categoryPerms[action] === true;
}
