
// Sprint 90: Production biometric auth router with real microservice integration
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { kycSessions } from "../../drizzle/schema";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// ── Microservice URLs ───────────────────────────────────────────────────────
const BIOMETRIC_SERVICE_URL = process.env.BIOMETRIC_SERVICE_URL || "http://localhost:8046";
const LIVENESS_SERVICE_URL = process.env.LIVENESS_SERVICE_URL || "http://localhost:8104";
const FACE_MATCHING_SERVICE_URL = process.env.FACE_MATCHING_SERVICE_URL || "http://localhost:8105";
const DEEPFAKE_SERVICE_URL = process.env.DEEPFAKE_SERVICE_URL || "http://localhost:8106";

// ── Helper: call microservice ───────────────────────────────────────────────
async function callService(url: string, body: Record<string, unknown>, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`Service returned ${resp.status}`);
    return await resp.json();
  } catch (err: any) {
    console.warn(`[biometricAuth] Service call failed: ${url} — ${err.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const biometricAuthRouter = router({
  // ── Passive Liveness Check ──────────────────────────────────────────────
  passiveLiveness: protectedProcedure
    .input(z.object({ imageBase64: z.string().min(100) }))
    .mutation(async ({ input }) => {
      const result = await callService(`${LIVENESS_SERVICE_URL}/liveness/passive`, {
        image_base64: input.imageBase64,
      });

      if (!result) {
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE" as any,
          message: "Liveness service unavailable",
        });
      }

      return {
        isLive: result.is_live ?? false,
        confidence: result.overall_score ?? 0,
        spoofType: result.spoof_type ?? "unknown",
        checks: result.checks ?? {},
        landmarks68: result.landmarks_68 ?? null,
      };
    }),

  // ── Active Liveness Check ───────────────────────────────────────────────
  activeLiveness: protectedProcedure
    .input(z.object({
      framesBase64: z.array(z.string()).min(3).max(30),
      challengeType: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await callService(`${LIVENESS_SERVICE_URL}/liveness/active`, {
        frames_base64: input.framesBase64,
        challenge_type: input.challengeType,
      });

      if (!result) {
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE" as any,
          message: "Liveness service unavailable",
        });
      }

      return {
        isLive: result.is_live ?? false,
        confidence: result.overall_score ?? 0,
        motionDetected: result.motion_detected ?? false,
        blinkDetected: result.blink_detected ?? false,
        framesAnalyzed: result.frames_analyzed ?? 0,
      };
    }),

  // ── Face Matching (1:1 Verification) ────────────────────────────────────
  matchFaces: protectedProcedure
    .input(z.object({
      image1Base64: z.string().min(100),
      image2Base64: z.string().min(100),
    }))
    .mutation(async ({ input }) => {
      const result = await callService(`${FACE_MATCHING_SERVICE_URL}/face/match`, {
        image1_base64: input.image1Base64,
        image2_base64: input.image2Base64,
      });

      if (!result) {
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE" as any,
          message: "Face matching service unavailable",
        });
      }

      return {
        match: result.match ?? false,
        similarity: result.similarity ?? 0,
        confidence: result.confidence ?? 0,
        model: result.model ?? "unknown",
        demographics: result.demographics ?? {},
        processingTimeMs: result.processing_time_ms ?? 0,
      };
    }),

  // ── Face Detection ──────────────────────────────────────────────────────
  detectFaces: protectedProcedure
    .input(z.object({ imageBase64: z.string().min(100) }))
    .mutation(async ({ input }) => {
      const result = await callService(`${FACE_MATCHING_SERVICE_URL}/face/detect`, {
        image_base64: input.imageBase64,
      });

      if (!result) {
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE" as any,
          message: "Face detection service unavailable",
        });
      }

      return {
        faces: (result.faces ?? []).map((f: any) => ({
          bbox: f.bbox,
          confidence: f.confidence,
          landmarks5pt: f.landmarks_5pt,
          gender: f.gender,
          age: f.age,
          hasEmbedding: f.has_embedding ?? false,
        })),
      };
    }),

  // ── Deepfake Detection ──────────────────────────────────────────────────
  detectDeepfake: protectedProcedure
    .input(z.object({ imageBase64: z.string().min(100) }))
    .mutation(async ({ input }) => {
      const result = await callService(`${DEEPFAKE_SERVICE_URL}/deepfake/detect`, {
        image_base64: input.imageBase64,
      });

      if (!result) {
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE" as any,
          message: "Deepfake detection service unavailable",
        });
      }

      return {
        isReal: result.is_real ?? true,
        confidence: result.confidence ?? 0,
        deepfakeProbability: result.deepfake_probability ?? 0,
        deepfakeType: result.deepfake_type ?? "unknown",
        analysis: result.analysis ?? {},
      };
    }),

  // ── Full Biometric Verification ─────────────────────────────────────────
  fullVerification: protectedProcedure
    .input(z.object({
      selfieBase64: z.string().min(100),
      documentBase64: z.string().min(100),
      sessionRef: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id.toString();

      const result = await callService(`${BIOMETRIC_SERVICE_URL}/api/v1/biometric/verify`, {
        selfie_base64: input.selfieBase64,
        document_base64: input.documentBase64,
        user_id: userId,
      });

      if (!result) {
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE" as any,
          message: "Biometric verification service unavailable",
        });
      }

      // Persist to kycSessions if sessionRef provided
      if (input.sessionRef) {
        const db = getDb();
        try {
          await db.update(kycSessions)
            .set({
              livenessScore: String(result.liveness?.confidence ?? 0),
              livenessPassed: result.liveness?.result === "real",
              livenessMethod: result.liveness?.source ?? "biometric_service",
              livenessRaw: result.liveness ?? {},
              matchScore: String(result.face_match?.similarity ?? 0),
              updatedAt: new Date(),
            })
            .where(eq(kycSessions.sessionRef, input.sessionRef));
        } catch (err) {
          console.warn("[biometricAuth] Failed to persist to kycSessions:", err);
        }
      }

      return {
        verificationId: result.verification_id,
        status: result.status,
        overallConfidence: result.overall_confidence,
        faceMatch: result.face_match,
        liveness: result.liveness,
        deepfake: result.deepfake,
        quality: result.quality,
        landmarks: result.landmarks,
        issues: result.issues ?? [],
        processingTimeMs: result.processing_time_ms,
      };
    }),

  // ── Face Quality Assessment ─────────────────────────────────────────────
  assessQuality: protectedProcedure
    .input(z.object({ imageBase64: z.string().min(100) }))
    .mutation(async ({ input }) => {
      const result = await callService(`${BIOMETRIC_SERVICE_URL}/api/v1/biometric/quality`, {
        image_base64: input.imageBase64,
      });

      if (!result) {
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE" as any,
          message: "Quality assessment service unavailable",
        });
      }

      return {
        overallQuality: result.overall_quality ?? 0,
        scores: result.scores ?? {},
        issues: result.issues ?? [],
        icaoCompliant: result.icao_compliant ?? false,
      };
    }),

  // ── Anti-Spoofing Check ─────────────────────────────────────────────────
  antiSpoof: protectedProcedure
    .input(z.object({ imageBase64: z.string().min(100) }))
    .mutation(async ({ input }) => {
      const result = await callService(`${BIOMETRIC_SERVICE_URL}/api/v1/biometric/anti-spoof`, {
        image_base64: input.imageBase64,
      });

      if (!result) {
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE" as any,
          message: "Anti-spoofing service unavailable",
        });
      }

      return {
        antiSpoofScore: result.anti_spoof_score ?? 0,
        isReal: result.is_real ?? false,
        spoofType: result.spoof_type ?? "unknown",
        checks: result.checks ?? {},
      };
    }),

  // ── List Biometric Records ──────────────────────────────────────────────
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const sessions = await db.select()
      .from(kycSessions)
      .where(and(
        eq(kycSessions.agentId, ctx.user.id),
        sql`${kycSessions.livenessScore} IS NOT NULL`,
      ))
      .orderBy(desc(kycSessions.createdAt))
      .limit(50);

    return {
      records: sessions.map((s: any) => ({
        id: s.id,
        sessionRef: s.sessionRef,
        type: s.type,
        status: s.status,
        livenessScore: s.livenessScore ? parseFloat(s.livenessScore) : null,
        livenessPassed: s.livenessPassed,
        livenessMethod: s.livenessMethod,
        matchScore: s.matchScore ? parseFloat(s.matchScore) : null,
        createdAt: s.createdAt.toISOString(),
      })),
    };
  }),

  // ── Analytics ───────────────────────────────────────────────────────────
  analytics: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();

    const [totalResult] = await db.select({ count: count() })
      .from(kycSessions)
      .where(and(
        eq(kycSessions.agentId, ctx.user.id),
        sql`${kycSessions.livenessScore} IS NOT NULL`,
      ));

    const [passedResult] = await db.select({ count: count() })
      .from(kycSessions)
      .where(and(
        eq(kycSessions.agentId, ctx.user.id),
        eq(kycSessions.livenessPassed, true),
      ));

    const [failedResult] = await db.select({ count: count() })
      .from(kycSessions)
      .where(and(
        eq(kycSessions.agentId, ctx.user.id),
        eq(kycSessions.livenessPassed, false),
      ));

    return {
      enrolled: totalResult?.count ?? 0,
      totalVerifications: totalResult?.count ?? 0,
      totalPassed: passedResult?.count ?? 0,
      totalFailedAttempts: failedResult?.count ?? 0,
    };
  }),

  // ── Service Health ──────────────────────────────────────────────────────
  serviceHealth: protectedProcedure.query(async () => {
    const services = [
      { name: "biometric", url: `${BIOMETRIC_SERVICE_URL}/health` },
      { name: "liveness", url: `${LIVENESS_SERVICE_URL}/health` },
      { name: "face_matching", url: `${FACE_MATCHING_SERVICE_URL}/health` },
      { name: "deepfake", url: `${DEEPFAKE_SERVICE_URL}/health` },
    ];

    const results = await Promise.allSettled(
      services.map(async (s) => {
        try {
          const resp = await fetch(s.url, { signal: AbortSignal.timeout(5000) });
          if (!resp.ok) return { name: s.name, status: "unhealthy", error: `HTTP ${resp.status}` };
          const data = await resp.json();
          return { name: s.name, status: "healthy", data };
        } catch (err: any) {
          return { name: s.name, status: "unavailable", error: err.message };
        }
      })
    );

    return {
      services: results.map((r: any) => r.status === "fulfilled" ? r.value : { name: "unknown", status: "error" }),
    };
  }),
});
