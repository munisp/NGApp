// @ts-nocheck
// Sprint 90: Biometric Auth Gateway — public-facing endpoints for
// merchant/agent onboarding biometric verification flow
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { kycSessions } from "../../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const BIOMETRIC_SERVICE_URL = process.env.BIOMETRIC_SERVICE_URL || "http://localhost:8046";

async function callBiometric(path: string, body: Record<string, unknown>) {
  try {
    const resp = await fetch(`${BIOMETRIC_SERVICE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch (err: any) {
    console.warn(`[biometricGateway] ${path} failed: ${err.message}`);
    return null;
  }
}

export const biometricAuthGatewayRouter = router({
  // ── Initiate Biometric Session ──────────────────────────────────────────
  initSession: protectedProcedure
    .input(z.object({
      type: z.enum(["agent_onboarding", "customer_verification", "transaction_auth"]).default("agent_onboarding"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [session] = await db.insert(kycSessions)
        .values({
          agentId: ctx.user.id,
          type: input.type,
          status: "pending",
          livenessMethod: "biometric_v3",
        })
        .returning();

      return {
        sessionRef: session.sessionRef,
        sessionId: session.id,
        status: session.status,
      };
    }),

  // ── Submit Selfie + Document for Full Verification ──────────────────────
  submitVerification: protectedProcedure
    .input(z.object({
      sessionRef: z.string(),
      selfieBase64: z.string().min(100),
      documentBase64: z.string().min(100),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Validate session
      const [session] = await db.select()
        .from(kycSessions)
        .where(and(
          eq(kycSessions.sessionRef, input.sessionRef),
          eq(kycSessions.agentId, ctx.user.id),
        ));

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }

      if (session.status === "approved") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Session already approved" });
      }

      // Update session status
      await db.update(kycSessions)
        .set({ status: "processing", updatedAt: new Date() })
        .where(eq(kycSessions.sessionRef, input.sessionRef));

      // Call biometric verification service
      const result = await callBiometric("/api/v1/biometric/verify", {
        selfie_base64: input.selfieBase64,
        document_base64: input.documentBase64,
        user_id: ctx.user.id.toString(),
      });

      if (!result) {
        await db.update(kycSessions)
          .set({ status: "failed", rejectionReason: "Biometric service unavailable", updatedAt: new Date() })
          .where(eq(kycSessions.sessionRef, input.sessionRef));

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Biometric verification service unavailable",
        });
      }

      // Map result to session update
      const newStatus = result.status === "verified" ? "approved"
        : result.status === "rejected" ? "rejected"
        : "review_required";

      await db.update(kycSessions)
        .set({
          status: newStatus,
          livenessScore: String(result.liveness?.confidence ?? 0),
          livenessPassed: result.liveness?.result === "real",
          livenessMethod: result.liveness?.source ?? "biometric_v3",
          livenessRaw: result.liveness ?? {},
          matchScore: String(result.face_match?.similarity ?? 0),
          rejectionReason: result.issues?.length > 0 ? result.issues.join("; ") : null,
          updatedAt: new Date(),
        })
        .where(eq(kycSessions.sessionRef, input.sessionRef));

      return {
        sessionRef: input.sessionRef,
        status: newStatus,
        verificationId: result.verification_id,
        overallConfidence: result.overall_confidence,
        faceMatch: {
          match: result.face_match?.match ?? false,
          similarity: result.face_match?.similarity ?? 0,
        },
        liveness: {
          result: result.liveness?.result ?? "uncertain",
          confidence: result.liveness?.confidence ?? 0,
          spoofType: result.liveness?.spoof_type ?? "none",
        },
        deepfake: {
          isReal: result.deepfake?.is_real ?? true,
          confidence: result.deepfake?.confidence ?? 0,
        },
        quality: result.quality ?? {},
        issues: result.issues ?? [],
        processingTimeMs: result.processing_time_ms,
      };
    }),

  // ── Quick Liveness Check (no document needed) ───────────────────────────
  quickLiveness: protectedProcedure
    .input(z.object({
      imageBase64: z.string().min(100),
      sessionRef: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await callBiometric("/api/v1/biometric/liveness", {
        image_base64: input.imageBase64,
      });

      if (!result) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Liveness service unavailable",
        });
      }

      // Persist if session provided
      if (input.sessionRef) {
        const db = getDb();
        await db.update(kycSessions)
          .set({
            livenessScore: String(result.confidence ?? 0),
            livenessPassed: result.is_live ?? false,
            livenessMethod: result.source ?? "quick_liveness",
            updatedAt: new Date(),
          })
          .where(and(
            eq(kycSessions.sessionRef, input.sessionRef),
            eq(kycSessions.agentId, ctx.user.id),
          ));
      }

      return {
        isLive: result.is_live ?? false,
        confidence: result.confidence ?? 0,
        spoofType: result.spoof_type ?? "none",
        source: result.source ?? "unknown",
      };
    }),

  // ── Get Session Status ──────────────────────────────────────────────────
  getSession: protectedProcedure
    .input(z.object({ sessionRef: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const [session] = await db.select()
        .from(kycSessions)
        .where(and(
          eq(kycSessions.sessionRef, input.sessionRef),
          eq(kycSessions.agentId, ctx.user.id),
        ));

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }

      return {
        sessionRef: session.sessionRef,
        type: session.type,
        status: session.status,
        livenessScore: session.livenessScore ? parseFloat(session.livenessScore) : null,
        livenessPassed: session.livenessPassed,
        livenessMethod: session.livenessMethod,
        matchScore: session.matchScore ? parseFloat(session.matchScore) : null,
        rejectionReason: session.rejectionReason,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      };
    }),

  // ── List User Sessions ──────────────────────────────────────────────────
  listSessions: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      status: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const conditions = [eq(kycSessions.agentId, ctx.user.id)];
      if (input.status) {
        conditions.push(eq(kycSessions.status, input.status));
      }

      const sessions = await db.select()
        .from(kycSessions)
        .where(and(...conditions))
        .orderBy(desc(kycSessions.createdAt))
        .limit(input.limit);

      return {
        sessions: sessions.map((s: any) => ({
          sessionRef: s.sessionRef,
          type: s.type,
          status: s.status,
          livenessScore: s.livenessScore ? parseFloat(s.livenessScore) : null,
          livenessPassed: s.livenessPassed,
          matchScore: s.matchScore ? parseFloat(s.matchScore) : null,
          createdAt: s.createdAt.toISOString(),
        })),
      };
    }),
  getStats: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      return {} as any;
    }),
});
