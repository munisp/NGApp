import { z } from "zod";
import { notifyOwner } from "./notification";
import { ENV } from "./env";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { redisHealthCheck } from "./redis";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  deepHealth: publicProcedure.query(async () => {
    const checks: Record<string, { status: string; latencyMs?: number }> = {};
    const start = Date.now();

    // Database connectivity
    try {
      const { db } = await import("../../server/db");
      const dbStart = Date.now();
      await db.execute("SELECT 1");
      checks.database = { status: "healthy", latencyMs: Date.now() - dbStart };
    } catch {
      checks.database = { status: "unhealthy", latencyMs: -1 };
    }

    // Redis connectivity
    try {
      checks.redis = await redisHealthCheck();
    } catch {
      checks.redis = { status: "unhealthy", latencyMs: -1 };
    }

    // Auth service connectivity
    try {
      const authUrl = process.env.AUTH_SERVICE_URL || "http://auth-service:8080";
      const authStart = Date.now();
      const resp = await fetch(`${authUrl}/health`, { signal: AbortSignal.timeout(3000) });
      checks.authService = {
        status: resp.ok ? "healthy" : "degraded",
        latencyMs: Date.now() - authStart,
      };
    } catch {
      checks.authService = { status: "unreachable", latencyMs: -1 };
    }

    const allHealthy = Object.values(checks).every((c) => c.status === "healthy");
    return {
      ok: allHealthy,
      status: allHealthy ? "healthy" : "degraded",
      uptime: process.uptime(),
      totalLatencyMs: Date.now() - start,
      checks,
    };
  }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  // Returns the VAPID public key for web push subscriptions.
  // Safe to expose publicly — the private key never leaves the server.
  vapidPublicKey: publicProcedure.query(() => ({
    key: ENV.vapidPublicKey,
  })),
});
