/**
 * userOnboarding.ts — User invitation and management router
 *
 * Procedures:
 *   - listUsers          : list all platform users with roles
 *   - updateUserRole     : change a user's role (admin only)
 *   - removeUser         : soft-remove a user (admin only)
 *   - createInvitation   : send an email invite with a time-limited token
 *   - listInvitations    : list all pending/accepted invitations
 *   - revokeInvitation   : revoke a pending invitation
 *   - acceptInvitation   : validate token and return invitation details
 *   - completeOnboarding : mark invitation accepted and upsert user record
 *   - resendInvitation   : re-send an expired invitation with new token
 */

import { z } from "zod";
import { eq, desc, and, gt, lt } from "drizzle-orm";
import crypto from "crypto";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { users, userInvitations } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";
import { notifyOwner } from "../_core/notification";
import { sendInvitationEmail } from "../email";

// Admin guard
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

const INVITATION_TTL_HOURS = 72; // 3 days

function generateToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

export const userOnboardingRouter = router({
  // ── List all users ──────────────────────────────────────────────────────────
  listUsers: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select({
      id: users.id,
      openId: users.openId,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
    }).from(users).orderBy(desc(users.createdAt));
  }),

  // ── Update user role ─────────────────────────────────────────────────────────
  updateUserRole: adminProcedure
    .input(z.object({
      userId: z.number(),
      role: z.enum(["user", "admin", "operator", "supervisor", "engineer"]),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        await db.update(users)
          .set({ role: input.role, updatedAt: new Date() })
          .where(eq(users.id, input.userId));
        return { success: true };
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  // ── Remove user ──────────────────────────────────────────────────────────────
  removeUser: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot remove your own account" });
      }
      await db.delete(users).where(eq(users.id, input.userId));
      return { success: true };
    }),

  // ── Create invitation ────────────────────────────────────────────────────────
  createInvitation: adminProcedure
    .input(z.object({
      email: z.string().email(),
      role: z.enum(["user", "admin", "operator", "supervisor", "engineer"]).default("operator"),
      message: z.string().max(500).optional(),
      origin: z.string().url(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        // Check for existing pending invitation
        const existing = await db.select({ id: userInvitations.id, status: userInvitations.status })
          .from(userInvitations)
          .where(and(
            eq(userInvitations.email, input.email),
            eq(userInvitations.status, "pending"),
            gt(userInvitations.expiresAt, new Date())
          ))
          .limit(1);

        if (existing.length > 0) {
          throw new TRPCError({ code: "CONFLICT", message: `A pending invitation already exists for ${input.email}` });
        }

        const token = generateToken();
        const expiresAt = new Date(Date.now() + INVITATION_TTL_HOURS * 60 * 60 * 1000);
        const inviteUrl = `${input.origin}/accept-invite?token=${token}`;
        const inviterName = ctx.user.name ?? "Platform Admin";

        const [invitation] = await db.insert(userInvitations).values({
          email: input.email,
          role: input.role,
          token,
          invitedBy: ctx.user.id,
          inviterName,
          message: input.message,
          status: "pending",
          expiresAt,
        }).returning();

        // Send invitation email to the invitee
        const emailSent = await sendInvitationEmail({
          to: input.email,
          inviterName,
          role: input.role,
          inviteUrl,
          expiresAt,
          message: input.message,
        }).catch(() => false);

        // Also notify the platform owner
        await notifyOwner({
          title: `New User Invitation — ${input.email}`,
          content: `${inviterName} invited ${input.email} as ${input.role}.\n\nInvite URL: ${inviteUrl}\nExpires: ${expiresAt.toISOString()}\nEmail sent: ${emailSent}`,
        }).catch(() => {});

        return {
          id: invitation.id,
          token,
          inviteUrl,
          expiresAt,
          email: input.email,
          role: input.role,
          emailSent,
        };
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  // ── List invitations ─────────────────────────────────────────────────────────
  listInvitations: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    // Auto-expire stale pending invitations
    await db.update(userInvitations)
      .set({ status: "expired" })
      .where(and(
        eq(userInvitations.status, "pending"),
        lt(userInvitations.expiresAt, new Date())
      ));
    return db.select().from(userInvitations).orderBy(desc(userInvitations.createdAt)).limit(100);
  }),

  // ── Revoke invitation ────────────────────────────────────────────────────────
  revokeInvitation: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        await db.update(userInvitations)
          .set({ status: "revoked" })
          .where(eq(userInvitations.id, input.id));
        return { success: true };
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  // ── Accept invitation (public, token-gated) — validates token only ───────────
  acceptInvitation: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [inv] = await db.select().from(userInvitations)
        .where(eq(userInvitations.token, input.token))
        .limit(1);
      if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found or already used" });
      if (inv.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: `Invitation is ${inv.status}` });
      if (inv.expiresAt < new Date()) {
        await db.update(userInvitations).set({ status: "expired" }).where(eq(userInvitations.id, inv.id));
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invitation has expired. Please request a new one." });
      }
      return {
        valid: true,
        email: inv.email,
        role: inv.role,
        inviterName: inv.inviterName,
        message: inv.message,
        expiresAt: inv.expiresAt,
      };
    }),

  // ── Complete onboarding — called after OAuth login to link user to invitation ─
  completeOnboarding: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const [inv] = await db.select().from(userInvitations)
          .where(eq(userInvitations.token, input.token))
          .limit(1);
        if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
        if (inv.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: `Invitation is ${inv.status}` });
        if (inv.expiresAt < new Date()) {
          await db.update(userInvitations).set({ status: "expired" }).where(eq(userInvitations.id, inv.id));
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invitation has expired" });
        }
        // Assign the invited role to the current user
        await db.update(users)
          .set({ role: inv.role as "user" | "admin", updatedAt: new Date() })
          .where(eq(users.id, ctx.user.id));
        // Mark invitation as accepted
        await db.update(userInvitations)
          .set({ status: "accepted" })
          .where(eq(userInvitations.id, inv.id));
        return { success: true, role: inv.role };
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  // ── Resend invitation ────────────────────────────────────────────────────────
  resendInvitation: adminProcedure
    .input(z.object({ id: z.number(), origin: z.string().url() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [inv] = await db.select().from(userInvitations)
        .where(eq(userInvitations.id, input.id)).limit(1);
      if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });

      const token = generateToken();
      const expiresAt = new Date(Date.now() + INVITATION_TTL_HOURS * 60 * 60 * 1000);
      const inviteUrl = `${input.origin}/accept-invite?token=${token}`;

      await db.update(userInvitations)
        .set({ token, status: "pending", expiresAt })
        .where(eq(userInvitations.id, input.id));

      // Resend email to invitee
      const emailSent = await sendInvitationEmail({
        to: inv.email,
        inviterName: inv.inviterName ?? "Platform Admin",
        role: inv.role,
        inviteUrl,
        expiresAt,
        message: inv.message ?? undefined,
      }).catch(() => false);

      return { token, inviteUrl, expiresAt, emailSent };
    }),
});
