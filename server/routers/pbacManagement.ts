/**
 * Sprint 92 — PBAC (Policy-Based Access Control) Management tRPC Router
 *
 * Provides administrators with full control over the 7-role hierarchy,
 * permission assignment, role management, and audit trail for PBAC changes.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

// ── 7-Role Hierarchy Definition ──────────────────────────────────────────────

export interface PbacRole {
  id: string;
  name: string;
  displayName: string;
  level: number; // 1 = highest (super_admin), 7 = lowest (viewer)
  description: string;
  inheritsFrom: string | null;
  permissions: string[];
  userCount: number;
  isSystem: boolean; // system roles can't be deleted
  createdAt: number;
  updatedAt: number;
}

export interface PbacPermission {
  id: string;
  resource: string;
  action: string;
  description: string;
  category: string;
  riskLevel: "critical" | "high" | "medium" | "low";
}

export interface PbacUserAssignment {
  userId: number;
  userName: string;
  email: string;
  roleId: string;
  roleName: string;
  assignedAt: number;
  assignedBy: string;
  expiresAt: number | null;
}

export interface PbacAuditEntry {
  id: string;
  action: string;
  performedBy: string;
  targetUser: string | null;
  targetRole: string | null;
  details: string;
  timestamp: number;
}

// ── In-memory stores (production: PostgreSQL + Permify) ──────────────────────

const roles = new Map<string, PbacRole>();
const permissions: PbacPermission[] = [];
const userAssignments = new Map<number, PbacUserAssignment>();
const auditLog: PbacAuditEntry[] = [];

function seedPbacData() {
  if (roles.size > 0) return;

  // 7-Role Hierarchy
  const roleDefinitions: Omit<PbacRole, "userCount" | "createdAt" | "updatedAt">[] = [
    {
      id: "super_admin", name: "super_admin", displayName: "Super Administrator",
      level: 1, description: "Full system access. Can manage all roles, users, and system configuration. Reserved for platform owners.",
      inheritsFrom: null, permissions: ["*"], isSystem: true,
    },
    {
      id: "admin", name: "admin", displayName: "Administrator",
      level: 2, description: "Full operational access. Can manage users, view all data, configure settings, and manage agents.",
      inheritsFrom: "super_admin",
      permissions: [
        "users:read", "users:write", "users:delete", "agents:read", "agents:write", "agents:delete",
        "transactions:read", "transactions:write", "transactions:reverse",
        "reports:read", "reports:export", "settings:read", "settings:write",
        "kyc:read", "kyc:write", "kyc:approve", "audit:read",
        "billing:read", "billing:write", "inventory:read", "inventory:write",
        "notifications:read", "notifications:write", "alerts:read", "alerts:acknowledge",
      ],
      isSystem: true,
    },
    {
      id: "supervisor", name: "supervisor", displayName: "Supervisor",
      level: 3, description: "Oversees agent operations. Can approve reversals, view reports, and manage agent performance.",
      inheritsFrom: "admin",
      permissions: [
        "agents:read", "agents:write", "transactions:read", "transactions:reverse",
        "reports:read", "reports:export", "kyc:read", "kyc:approve",
        "audit:read", "inventory:read", "notifications:read", "alerts:read",
      ],
      isSystem: true,
    },
    {
      id: "agent_manager", name: "agent_manager", displayName: "Agent Manager",
      level: 4, description: "Manages a group of field agents. Can view agent performance, approve top-ups, and handle escalations.",
      inheritsFrom: "supervisor",
      permissions: [
        "agents:read", "transactions:read", "reports:read",
        "kyc:read", "inventory:read", "notifications:read",
        "topups:approve", "escalations:handle",
      ],
      isSystem: true,
    },
    {
      id: "agent", name: "agent", displayName: "Field Agent",
      level: 5, description: "Performs day-to-day POS transactions. Can process payments, view own transactions, and manage own profile.",
      inheritsFrom: "agent_manager",
      permissions: [
        "transactions:read:own", "transactions:write:own",
        "profile:read", "profile:write",
        "pos:operate", "receipts:generate",
        "notifications:read:own",
      ],
      isSystem: true,
    },
    {
      id: "auditor", name: "auditor", displayName: "Auditor",
      level: 6, description: "Read-only access to all audit trails, transaction logs, and compliance reports. Cannot modify any data.",
      inheritsFrom: null,
      permissions: [
        "transactions:read", "audit:read", "reports:read", "reports:export",
        "kyc:read", "compliance:read", "billing:read",
      ],
      isSystem: true,
    },
    {
      id: "viewer", name: "viewer", displayName: "Viewer",
      level: 7, description: "Minimal read-only access. Can view dashboards and basic reports. Suitable for stakeholders and observers.",
      inheritsFrom: null,
      permissions: [
        "dashboard:read", "reports:read:basic",
      ],
      isSystem: true,
    },
  ];

  const now = Date.now();
  for (const def of roleDefinitions) {
    roles.set(def.id, { ...def, userCount: 0, createdAt: now, updatedAt: now });
  }

  // Seed permissions catalog
  const permDefs: Omit<PbacPermission, "id">[] = [
    { resource: "users", action: "read", description: "View user profiles and lists", category: "User Management", riskLevel: "low" },
    { resource: "users", action: "write", description: "Create and edit user accounts", category: "User Management", riskLevel: "medium" },
    { resource: "users", action: "delete", description: "Delete user accounts permanently", category: "User Management", riskLevel: "critical" },
    { resource: "agents", action: "read", description: "View agent profiles and performance", category: "Agent Management", riskLevel: "low" },
    { resource: "agents", action: "write", description: "Create and edit agent accounts", category: "Agent Management", riskLevel: "medium" },
    { resource: "agents", action: "delete", description: "Deactivate or remove agents", category: "Agent Management", riskLevel: "high" },
    { resource: "transactions", action: "read", description: "View all transaction records", category: "Transactions", riskLevel: "medium" },
    { resource: "transactions", action: "read:own", description: "View own transaction records only", category: "Transactions", riskLevel: "low" },
    { resource: "transactions", action: "write", description: "Create new transactions", category: "Transactions", riskLevel: "medium" },
    { resource: "transactions", action: "write:own", description: "Create transactions for own terminal", category: "Transactions", riskLevel: "low" },
    { resource: "transactions", action: "reverse", description: "Reverse completed transactions", category: "Transactions", riskLevel: "critical" },
    { resource: "reports", action: "read", description: "View all reports and analytics", category: "Reports", riskLevel: "low" },
    { resource: "reports", action: "read:basic", description: "View basic dashboard reports only", category: "Reports", riskLevel: "low" },
    { resource: "reports", action: "export", description: "Export reports to CSV/PDF", category: "Reports", riskLevel: "medium" },
    { resource: "settings", action: "read", description: "View system settings", category: "System", riskLevel: "low" },
    { resource: "settings", action: "write", description: "Modify system settings", category: "System", riskLevel: "critical" },
    { resource: "kyc", action: "read", description: "View KYC documents and status", category: "KYC/Compliance", riskLevel: "medium" },
    { resource: "kyc", action: "write", description: "Submit KYC documents", category: "KYC/Compliance", riskLevel: "medium" },
    { resource: "kyc", action: "approve", description: "Approve or reject KYC submissions", category: "KYC/Compliance", riskLevel: "high" },
    { resource: "audit", action: "read", description: "View audit trails and logs", category: "Audit", riskLevel: "medium" },
    { resource: "billing", action: "read", description: "View billing and invoices", category: "Billing", riskLevel: "medium" },
    { resource: "billing", action: "write", description: "Create and modify billing records", category: "Billing", riskLevel: "high" },
    { resource: "inventory", action: "read", description: "View inventory levels", category: "Inventory", riskLevel: "low" },
    { resource: "inventory", action: "write", description: "Modify inventory records", category: "Inventory", riskLevel: "medium" },
    { resource: "notifications", action: "read", description: "View all notifications", category: "Notifications", riskLevel: "low" },
    { resource: "notifications", action: "read:own", description: "View own notifications only", category: "Notifications", riskLevel: "low" },
    { resource: "notifications", action: "write", description: "Send notifications", category: "Notifications", riskLevel: "medium" },
    { resource: "alerts", action: "read", description: "View security alerts", category: "Security", riskLevel: "medium" },
    { resource: "alerts", action: "acknowledge", description: "Acknowledge and resolve alerts", category: "Security", riskLevel: "high" },
    { resource: "pos", action: "operate", description: "Operate POS terminal", category: "POS", riskLevel: "medium" },
    { resource: "receipts", action: "generate", description: "Generate transaction receipts", category: "POS", riskLevel: "low" },
    { resource: "dashboard", action: "read", description: "View dashboard overview", category: "Dashboard", riskLevel: "low" },
    { resource: "compliance", action: "read", description: "View compliance reports", category: "KYC/Compliance", riskLevel: "medium" },
    { resource: "topups", action: "approve", description: "Approve agent top-up requests", category: "Agent Management", riskLevel: "high" },
    { resource: "escalations", action: "handle", description: "Handle escalated issues", category: "Support", riskLevel: "medium" },
    { resource: "profile", action: "read", description: "View own profile", category: "Profile", riskLevel: "low" },
    { resource: "profile", action: "write", description: "Edit own profile", category: "Profile", riskLevel: "low" },
  ];

  for (const def of permDefs) {
    permissions.push({ id: `${def.resource}:${def.action}`, ...def });
  }

  // Seed user assignments
  const sampleUsers: Omit<PbacUserAssignment, "assignedAt">[] = [
    { userId: 1, userName: "Platform Owner", email: "owner@posshell.com", roleId: "super_admin", roleName: "Super Administrator", assignedBy: "system", expiresAt: null },
    { userId: 2, userName: "Admin Fatima", email: "fatima@posshell.com", roleId: "admin", roleName: "Administrator", assignedBy: "system", expiresAt: null },
    { userId: 3, userName: "Supervisor Kwame", email: "kwame@posshell.com", roleId: "supervisor", roleName: "Supervisor", assignedBy: "admin_fatima", expiresAt: null },
    { userId: 4, userName: "Manager Amara", email: "amara@posshell.com", roleId: "agent_manager", roleName: "Agent Manager", assignedBy: "admin_fatima", expiresAt: null },
    { userId: 5, userName: "Agent Kofi", email: "kofi@posshell.com", roleId: "agent", roleName: "Field Agent", assignedBy: "supervisor_kwame", expiresAt: null },
    { userId: 6, userName: "Auditor Esi", email: "esi@posshell.com", roleId: "auditor", roleName: "Auditor", assignedBy: "admin_fatima", expiresAt: null },
    { userId: 7, userName: "Viewer Yaw", email: "yaw@posshell.com", roleId: "viewer", roleName: "Viewer", assignedBy: "admin_fatima", expiresAt: null },
  ];

  for (const u of sampleUsers) {
    userAssignments.set(u.userId, { ...u, assignedAt: Date.now() - Math.floor(Math.random() * 30 * 86400000) });
    const role = roles.get(u.roleId);
    if (role) role.userCount++;
  }
}
seedPbacData();

function addAudit(action: string, performedBy: string, targetUser: string | null, targetRole: string | null, details: string) {
  auditLog.unshift({
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    action, performedBy, targetUser, targetRole, details,
    timestamp: Date.now(),
  });
  if (auditLog.length > 500) auditLog.length = 500;
}

export const pbacManagementRouter = router({
  // List all roles with hierarchy
  listRoles: protectedProcedure.query(() => {
    return Array.from(roles.values()).sort((a: PbacRole, b: PbacRole) => a.level - b.level);
  }),

  // Get role detail
  getRoleDetail: protectedProcedure
    .input(z.object({ roleId: z.string() }))
    .query(({ input }) => {
      const role = roles.get(input.roleId);
      if (!role) throw new Error("Role not found");
      const users = Array.from(userAssignments.values()).filter((u: PbacUserAssignment) => u.roleId === input.roleId);
      return { role, users };
    }),

  // List all permissions catalog
  listPermissions: protectedProcedure
    .input(z.object({
      category: z.string().optional(),
      riskLevel: z.enum(["all", "critical", "high", "medium", "low"]).default("all"),
    }))
    .query(({ input }) => {
      let perms = [...permissions];
      if (input.category) perms = perms.filter((p: PbacPermission) => p.category === input.category);
      if (input.riskLevel !== "all") perms = perms.filter((p: PbacPermission) => p.riskLevel === input.riskLevel);

      // Group by category
      const grouped: Record<string, PbacPermission[]> = {};
      for (const p of perms) {
        if (!grouped[p.category]) grouped[p.category] = [];
        grouped[p.category].push(p);
      }
      return { permissions: perms, grouped, categories: Object.keys(grouped) };
    }),

  // Assign role to user
  assignRole: protectedProcedure
    .input(z.object({
      userId: z.number(),
      roleId: z.string(),
      expiresAt: z.number().optional(),
    }))
    .mutation(({ input, ctx }) => {
      const role = roles.get(input.roleId);
      if (!role) throw new Error("Role not found");

      // Check if assigner has higher privilege
      const assignerRole = userAssignments.get(ctx.user?.id ?? 0);
      if (assignerRole) {
        const assignerRoleDef = roles.get(assignerRole.roleId);
        if (assignerRoleDef && assignerRoleDef.level >= role.level) {
          throw new Error("Cannot assign a role equal to or higher than your own");
        }
      }

      const existing = userAssignments.get(input.userId);
      if (existing) {
        const oldRole = roles.get(existing.roleId);
        if (oldRole) oldRole.userCount = Math.max(0, oldRole.userCount - 1);
      }

      userAssignments.set(input.userId, {
        userId: input.userId,
        userName: existing?.userName ?? `User ${input.userId}`,
        email: existing?.email ?? `user${input.userId}@posshell.com`,
        roleId: input.roleId,
        roleName: role.displayName,
        assignedAt: Date.now(),
        assignedBy: ctx.user?.name ?? "admin",
        expiresAt: input.expiresAt ?? null,
      });
      role.userCount++;

      addAudit("role_assigned", ctx.user?.name ?? "admin", `User ${input.userId}`, role.displayName,
        `Assigned role ${role.displayName} to user ${input.userId}`);

      return { success: true } as any;
    }),

  // Modify role permissions
  modifyPermissions: protectedProcedure
    .input(z.object({
      roleId: z.string(),
      addPermissions: z.array(z.string()).default([]),
      removePermissions: z.array(z.string()).default([]),
    }))
    .mutation(({ input, ctx }) => {
      const role = roles.get(input.roleId);
      if (!role) throw new Error("Role not found");

      // Add permissions
      for (const perm of input.addPermissions) {
        if (!role.permissions.includes(perm)) {
          role.permissions.push(perm);
        }
      }

      // Remove permissions
      role.permissions = role.permissions.filter((p: string) => !input.removePermissions.includes(p));
      role.updatedAt = Date.now();

      addAudit("permissions_modified", ctx.user?.name ?? "admin", null, role.displayName,
        `Added ${input.addPermissions.length} permissions, removed ${input.removePermissions.length} permissions`);

      return { success: true, role };
    }),

  // List user assignments
  listUserAssignments: protectedProcedure
    .input(z.object({
      roleId: z.string().optional(),
      search: z.string().optional(),
      page: z.number().min(1).default(1),
      pageSize: z.number().min(5).max(100).default(20),
    }))
    .query(({ input }) => {
      let assignments = Array.from(userAssignments.values());
      if (input.roleId) assignments = assignments.filter((a: PbacUserAssignment) => a.roleId === input.roleId);
      if (input.search) {
        const q = input.search.toLowerCase();
        assignments = assignments.filter((a: PbacUserAssignment) =>
          a.userName.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
        );
      }

      assignments.sort((a: PbacUserAssignment, b: PbacUserAssignment) => b.assignedAt - a.assignedAt);
      const total = assignments.length;
      const start = (input.page - 1) * input.pageSize;
      const paged = assignments.slice(start, start + input.pageSize);

      return { items: paged, total, page: input.page, totalPages: Math.ceil(total / input.pageSize) };
    }),

  // Remove role assignment
  removeAssignment: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(({ input, ctx }) => {
      const assignment = userAssignments.get(input.userId);
      if (!assignment) throw new Error("Assignment not found");

      const role = roles.get(assignment.roleId);
      if (role) role.userCount = Math.max(0, role.userCount - 1);

      // Downgrade to viewer instead of removing entirely
      const viewerRole = roles.get("viewer")!;
      userAssignments.set(input.userId, {
        ...assignment,
        roleId: "viewer",
        roleName: "Viewer",
        assignedAt: Date.now(),
        assignedBy: ctx.user?.name ?? "admin",
      });
      viewerRole.userCount++;

      addAudit("role_removed", ctx.user?.name ?? "admin", assignment.userName, assignment.roleName,
        `Downgraded ${assignment.userName} from ${assignment.roleName} to Viewer`);

      return { success: true } as any;
    }),

  // Get PBAC audit log
  getAuditLog: protectedProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      pageSize: z.number().min(5).max(50).default(20),
    }))
    .query(({ input }) => {
      const total = auditLog.length;
      const start = (input.page - 1) * input.pageSize;
      const paged = auditLog.slice(start, start + input.pageSize);
      return { items: paged, total, page: input.page, totalPages: Math.ceil(total / input.pageSize) };
    }),
});
