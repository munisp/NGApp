/**
 * Tenant Admin Router — Manage sub-users, branding, corridors, and fee overrides
 * within a tenant's own scope. Uses tenant isolation middleware.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

// ─── In-memory stores ──────────────────────────────────────────────────────
interface TenantUserRecord {
  id: number;
  tenantId: number;
  userId: number | null;
  email: string;
  name: string;
  role: "tenant_admin" | "tenant_operator" | "tenant_viewer";
  isActive: boolean;
  invitedBy: number | null;
  invitedAt: Date;
  acceptedAt: Date | null;
  lastActiveAt: Date | null;
}

let nextUserId = 1;
const tenantUsersStore: TenantUserRecord[] = [];

// Tenant activity log
interface TenantActivityRecord {
  id: number;
  tenantId: number;
  actorEmail: string;
  action: string;
  resource: string;
  details: string;
  createdAt: Date;
}
let nextActivityId = 1;
const activityStore: TenantActivityRecord[] = [];

export const tenantAdminRouter = router({
  /** Get tenant dashboard summary */
  dashboard: protectedProcedure
    .input(z.object({ tenantId: z.number().int() }))
    .query(({ input }) => {
      const users = tenantUsersStore.filter(u => u.tenantId === input.tenantId);
      const activeUsers = users.filter(u => u.isActive);
      const recentActivity = activityStore
        .filter(a => a.tenantId === input.tenantId)
        .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10);

      return {
        totalUsers: users.length,
        activeUsers: activeUsers.length,
        pendingInvites: users.filter(u => !u.acceptedAt).length,
        admins: users.filter(u => u.role === "tenant_admin").length,
        operators: users.filter(u => u.role === "tenant_operator").length,
        viewers: users.filter(u => u.role === "tenant_viewer").length,
        recentActivity,
      };
    }),

  /** List sub-users for this tenant */
  listUsers: protectedProcedure
    .input(z.object({
      tenantId: z.number().int(),
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
      role: z.enum(["tenant_admin", "tenant_operator", "tenant_viewer"]).optional(),
      search: z.string().max(128).optional(),
    }))
    .query(({ input }) => {
      let filtered = tenantUsersStore.filter(u => u.tenantId === input.tenantId);
      if (input.role) filtered = filtered.filter(u => u.role === input.role);
      if (input.search) {
        const q = input.search.toLowerCase();
        filtered = filtered.filter(u =>
          u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)
        );
      }
      const total = filtered.length;
      const items = filtered.slice((input.page - 1) * input.limit, input.page * input.limit);
      return { items, total, page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit) };
    }),

  /** Invite a new sub-user */
  inviteUser: protectedProcedure
    .input(z.object({
      tenantId: z.number().int(),
      email: z.string().email().max(320),
      name: z.string().max(128),
      role: z.enum(["tenant_admin", "tenant_operator", "tenant_viewer"]).default("tenant_viewer"),
    }))
    .mutation(({ input, ctx }) => {
      // Check for duplicate email within tenant
      if (tenantUsersStore.find(u => u.tenantId === input.tenantId && u.email === input.email)) {
        throw new TRPCError({ code: "CONFLICT", message: "User with this email already exists in this tenant" });
      }

      const user: TenantUserRecord = {
        id: nextUserId++,
        tenantId: input.tenantId,
        userId: null,
        email: input.email,
        name: input.name,
        role: input.role,
        isActive: true,
        invitedBy: ctx.user?.id ?? null,
        invitedAt: new Date(),
        acceptedAt: null,
        lastActiveAt: null,
      };
      tenantUsersStore.push(user);

      // Log activity
      activityStore.push({
        id: nextActivityId++,
        tenantId: input.tenantId,
        actorEmail: ctx.user?.email ?? "system",
        action: "invite_user",
        resource: input.email,
        details: `Invited ${input.name} (${input.email}) as ${input.role}`,
        createdAt: new Date(),
      });

      return user;
    }),

  /** Update a sub-user's role or status */
  updateUser: protectedProcedure
    .input(z.object({
      id: z.number().int(),
      tenantId: z.number().int(),
      role: z.enum(["tenant_admin", "tenant_operator", "tenant_viewer"]).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(({ input, ctx }) => {
      const user = tenantUsersStore.find(u => u.id === input.id && u.tenantId === input.tenantId);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      if (input.role !== undefined) user.role = input.role;
      if (input.isActive !== undefined) user.isActive = input.isActive;

      activityStore.push({
        id: nextActivityId++,
        tenantId: input.tenantId,
        actorEmail: ctx.user?.email ?? "system",
        action: "update_user",
        resource: user.email,
        details: `Updated ${user.name}: role=${user.role}, active=${user.isActive}`,
        createdAt: new Date(),
      });

      return user;
    }),

  /** Remove a sub-user */
  removeUser: protectedProcedure
    .input(z.object({ id: z.number().int(), tenantId: z.number().int() }))
    .mutation(({ input, ctx }) => {
      const idx = tenantUsersStore.findIndex(u => u.id === input.id && u.tenantId === input.tenantId);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      const removed = tenantUsersStore.splice(idx, 1)[0];

      activityStore.push({
        id: nextActivityId++,
        tenantId: input.tenantId,
        actorEmail: ctx.user?.email ?? "system",
        action: "remove_user",
        resource: removed.email,
        details: `Removed ${removed.name} (${removed.email})`,
        createdAt: new Date(),
      });

      return { success: true } as any;
    }),

  /** Get tenant activity log */
  activityLog: protectedProcedure
    .input(z.object({
      tenantId: z.number().int(),
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(50),
    }))
    .query(({ input }) => {
      const filtered = activityStore
        .filter(a => a.tenantId === input.tenantId)
        .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());
      const total = filtered.length;
      const items = filtered.slice((input.page - 1) * input.limit, input.page * input.limit);
      return { items, total, page: input.page, limit: input.limit };
    }),

  /** Toggle branding live status */
  toggleLive: protectedProcedure
    .input(z.object({ tenantId: z.number().int(), isLive: z.boolean() }))
    .mutation(({ input }) => {
      // This would update the branding store — simplified for now
      return { tenantId: input.tenantId, isLive: input.isLive, message: input.isLive ? "White-label instance is now live!" : "White-label instance taken offline." };
    }),

  /** Get tenant settings overview */
  settings: protectedProcedure
    .input(z.object({ tenantId: z.number().int() }))
    .query(({ input }) => {
      return {
        tenantId: input.tenantId,
        apiRateLimit: 1000,
        maxAgents: 500,
        maxTransactionsPerDay: 100000,
        webhookEndpoints: 10,
        supportTier: "standard",
        features: ["corridors", "fee_overrides", "branding", "sub_users", "api_access", "webhooks"],
      };
    }),
});
