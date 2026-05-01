import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

// ─── NDSEP RBAC Procedures ────────────────────────────────────────────────────

/** Government staff: full read access to all platform data */
export const governmentStaffProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    const allowedRoles: string[] = ['admin', 'government_staff'];
    if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Government staff access required" });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  }),
);

/** Org admin: can manage their own organization's data only */
export const orgAdminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    const allowedRoles: string[] = ['admin', 'government_staff', 'org_admin'];
    if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Organization admin access required" });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  }),
);

/** Auditor: read-only access to audit trail, compliance, and violations */
export const auditorProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    const allowedRoles: string[] = ['admin', 'government_staff', 'org_admin', 'auditor'];
    if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Auditor access required" });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  }),
);

// ─── PBAC-enforced procedure factories ───────────────────────────────────────
import { pbacMiddleware } from "../security/pbac";

/** protectedProcedure + PBAC export guard (admin-only export operations) */
export const exportProcedure = protectedProcedure.use(pbacMiddleware("*", "export"));

/** protectedProcedure + PBAC delete guard (admin-only delete operations) */
export const deleteProcedure = protectedProcedure.use(pbacMiddleware("*", "delete"));

/** protectedProcedure + PBAC approve guard (admin-only approval operations) */
export const approveProcedure = protectedProcedure.use(pbacMiddleware("*", "approve"));

/** Helper: check if a user can access a specific organization's data */
export function canAccessOrg(
  user: { role: string; organizationId?: number | null },
  orgId: number
): boolean {
  if (['admin', 'government_staff'].includes(user.role)) return true;
  if (user.role === 'org_admin' && user.organizationId === orgId) return true;
  return false;
}
