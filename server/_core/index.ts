import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { sql } from "drizzle-orm";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { sseRouter } from "../sse";
import { startAlarmNotifier } from "../alarmNotifier";
import { probePIConnection } from "../piConnector";
import { startBenchmarkScheduler } from "../benchmarkScheduler";
import { startPTWScheduler } from "../ptwScheduler";
import { startDamageDigestScheduler } from "../damageDigestScheduler";
import { startRegulatoryScheduler } from "../regulatoryScheduler";
import { startCalibrationAlertScheduler } from "../services/calibrationAlerts";
import { startHSEEscalationScheduler } from "../services/hseEscalation";
import { startMaterialsReorderScheduler } from "../services/materialsReorder";
import { startTelemetrySimulator } from "../telemetrySimulator";
import { initWebPush } from "../pushNotifications";
import { firmwareUploadRouter } from "../firmwareUpload";
import { damageImageUploadRouter } from "../damageImageUpload";
import { deviceHeartbeatRouter } from "../deviceHeartbeat";
import { deviceBootstrapRouter } from "../deviceBootstrap";
import { lasParserRouter } from "../lasParser";
import { droneImageUploadRouter } from "../droneImageUpload";
import { logConnectivityStatus } from "./connectivity";
import { registerGracefulShutdown } from "./gracefulShutdown";
import { attachCollaborationWS } from "../collaboration";
import { apiVersionMiddleware, getVersionInfo } from "./apiVersioning";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { corsMiddleware } from "./corsConfig";
import { requestIdMiddleware } from "./requestId";
import { idempotencyMiddleware } from "./idempotency";
import { initSentry, getSentryErrorHandler } from "./sentryInit";
import logger from "./logger";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Initialize Sentry before Express app (must be first)
  initSentry();

  const app = express();
  const server = createServer(app);
  // Attach real-time collaboration WebSocket server
  attachCollaborationWS(server);

  // Trust reverse proxy (Manus hosting / nginx) — required for rate-limit IP detection
  app.set("trust proxy", 1);

  // ── CORS ────────────────────────────────────────────────────────────────────
  app.use(corsMiddleware);

  // ── Request ID / Correlation ID ────────────────────────────────────────────
  app.use(requestIdMiddleware);

  // ── Idempotency keys for mutation safety ───────────────────────────────────
  app.use(idempotencyMiddleware);

  // ── Liveness probe (shallow — always returns 200 if process is alive) ────────
  app.get("/health/live", (_req, res) => {
    res.json({ status: "ok", uptime: Math.floor(process.uptime()) });
  });

  // ── Readiness probe (deep — checks DB + Redis connectivity) ─────────────────
  app.get("/health/ready", async (_req, res) => {
    const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};
    let allHealthy = true;

    // Check PostgreSQL
    const dbStart = Date.now();
    try {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (db) {
        await db.execute(sql`SELECT 1`);
        checks.postgres = { status: "ok", latencyMs: Date.now() - dbStart };
      } else {
        checks.postgres = { status: "degraded", error: "Connection pool unavailable" };
        allHealthy = false;
      }
    } catch (err: any) {
      checks.postgres = { status: "down", latencyMs: Date.now() - dbStart, error: err.message };
      allHealthy = false;
    }

    // Check Redis
    const redisStart = Date.now();
    try {
      const { cacheGet } = await import("../cache");
      await cacheGet<string>("__health_probe__");
      checks.redis = { status: "ok", latencyMs: Date.now() - redisStart };
    } catch (err: any) {
      checks.redis = { status: "degraded", latencyMs: Date.now() - redisStart, error: err.message };
    }

    const statusCode = allHealthy ? 200 : 503;
    res.status(statusCode).json({
      status: allHealthy ? "ok" : "degraded",
      version: "v55.0",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      checks,
    });
  });

  // ── Combined health endpoint (backward-compatible) ──────────────────────────
  app.get("/health", async (_req, res) => {
    const checks: Record<string, string> = {};
    let overallStatus = "ok";

    try {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (db) {
        await db.execute(sql`SELECT 1`);
        checks.postgres = "ok";
      } else {
        checks.postgres = "unavailable";
        overallStatus = "degraded";
      }
    } catch {
      checks.postgres = "down";
      overallStatus = "degraded";
    }

    try {
      const { cacheGet } = await import("../cache");
      await cacheGet<string>("__health_probe__");
      checks.redis = "ok";
    } catch {
      checks.redis = "unavailable";
    }

    res.json({
      status: overallStatus,
      version: "v55.0",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      platform: "OG-RMM Platform — Production-Ready",
      checks,
      services: {
        physicsEngine: process.env.PHYSICS_URL ?? "http://localhost:4001",
        mlService:     process.env.ML_URL      ?? "http://localhost:4003",
        influxdb:      process.env.INFLUXDB_URL ?? "http://localhost:8086",
        grafana:       process.env.GRAFANA_URL  ?? "http://localhost:3001",
      },
    });
  });

  // ── Sitemap (publish readiness / SEO) ──────────────────────────────────
  app.get("/sitemap.xml", (req, res) => {
    const origin = `${req.protocol}://${req.get("host")}`;
    const pages = [
      { url: "/", priority: "1.0", changefreq: "daily" },
      { url: "/wells", priority: "0.9", changefreq: "daily" },
      { url: "/alarms", priority: "0.9", changefreq: "always" },
      { url: "/well-kpi-dashboard", priority: "0.9", changefreq: "always" },
      { url: "/pwa-twin-physics", priority: "0.8", changefreq: "weekly" },
      { url: "/permits", priority: "0.8", changefreq: "daily" },
      { url: "/production", priority: "0.8", changefreq: "daily" },
      { url: "/financials", priority: "0.7", changefreq: "weekly" },
      { url: "/reports", priority: "0.7", changefreq: "weekly" },
      { url: "/rust-physics-engine", priority: "0.6", changefreq: "monthly" },
    ];
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...pages.map(p =>
        `  <url>\n    <loc>${origin}${p.url}</loc>\n    <priority>${p.priority}</priority>\n    <changefreq>${p.changefreq}</changefreq>\n  </url>`
      ),
      '</urlset>',
    ].join("\n");
    res.set("Content-Type", "application/xml").send(xml);
  });

  // ── API Versioning ─────────────────────────────────────────────────────────
  app.use("/api/", apiVersionMiddleware);
  app.get("/api/version", (_req, res) => res.json(getVersionInfo()));

  // ── Security headers (IEC 62443 / OWASP) ──────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://maps.googleapis.com", "https://manus-analytics.com", "https://forge.manus.ai"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "wss:", "https:"],
        frameSrc: ["'self'", "https:"], // Allow PDF preview iframes (S3 URLs)
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Required for Google Maps iframe
  }));

  // ── Rate limiting ──────────────────────────────────────────────────────────
  // General API: 200 requests per minute per IP
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
  });
  app.use("/api/", apiLimiter);

  // Auth endpoints: 20 per minute (brute-force protection)
  const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api/oauth/", authLimiter);

  // ── Stripe webhook (MUST be before express.json — needs raw body for signature verification) ──
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const { handleStripeWebhook } = await import("../stripe/webhook");
    return handleStripeWebhook(req, res);
  });

  // ── Body parser ────────────────────────────────────────────────────────────
  // Global limit: 1mb (prevents DoS via large POST payloads)
  // File upload routes (firmware, LAS, damage images) use their own multer middleware with higher limits
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));

  // ── Routes ─────────────────────────────────────────────────────────────────
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // ── Dev-only E2E test session endpoint ────────────────────────────────────
  // Creates a real JWT session cookie for a seeded test user.
  // Only active in development/test environments — never in production.
  if (process.env.NODE_ENV !== "production") {
    const { sdk } = await import("./sdk");
    const { upsertUser } = await import("../db");
    const { getSessionCookieOptions } = await import("./cookies");
    const { COOKIE_NAME, ONE_YEAR_MS } = await import("../../shared/const");

    app.post("/api/e2e/session", async (req, res) => {
      try {
        const role = (req.body?.role as string) === "admin" ? "admin" : "user";
        const openId = role === "admin" ? "e2e-admin-user" : "e2e-test-user";
        const name = role === "admin" ? "E2E Admin" : "E2E Operator";
        const email = role === "admin" ? "e2e-admin@ogrmm.test" : "e2e-user@ogrmm.test";

        // Upsert the test user into the DB
        await upsertUser({ openId, name, email, loginMethod: "e2e", role });

        const token = await sdk.createSessionToken(openId, {
          expiresInMs: ONE_YEAR_MS,
          name,
        });
        // For E2E tests on localhost, use sameSite=lax so Playwright can capture the cookie
        // (sameSite=none requires secure=true which is not available on localhost)
        const cookieOptions = {
          httpOnly: true,
          path: "/",
          sameSite: "lax" as const,
          secure: false,
          maxAge: ONE_YEAR_MS,
        };
        res.cookie(COOKIE_NAME, token, cookieOptions);
        res.json({ ok: true, openId, role });
      } catch (err) {
        console.error("[E2E] Session creation failed:", err);
        res.status(500).json({ ok: false, error: String(err) });
      }
    });
  }
  // ── E-filing webhook callback endpoint ───────────────────────────────────
  // Authorities POST to /api/efiling/webhook to push async status updates.
  // Payload: { submissionRef, status: ACCEPTED|REJECTED|PROCESSING, authority, message }
  app.post("/api/efiling/webhook", async (req, res) => {
    try {
      const { parseWebhookCallback } = await import("../eFilingService");
      const payload = parseWebhookCallback(
        req.body,
        req.headers["x-efiling-signature"] as string | undefined
      );
      if (!payload) {
        return res.status(400).json({ error: "Invalid webhook payload" });
      }
      // Update the report status in the DB
      const { getDb } = await import("../db");
      const { regulatoryReports } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (db) {
        // Only update to valid DB statuses (PROCESSING is an intermediate state, skip)
        const validDbStatus = payload.status === "PROCESSING" ? undefined : payload.status;
        if (validDbStatus) {
          await db.update(regulatoryReports)
            .set({
              status: validDbStatus as "ACCEPTED" | "REJECTED",
              updatedAt: new Date(),
            })
            .where(eq(regulatoryReports.submissionRef, payload.submissionRef));
        }
        console.log(
          `[E-Filing Webhook] Updated ${payload.submissionRef} → ${payload.status}`
        );
      }
      res.json({ ok: true, submissionRef: payload.submissionRef, status: payload.status });
    } catch (err) {
      console.error("[E-Filing Webhook] Error:", err);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // SSE real-time telemetry streaming
  app.use(sseRouter);
  // Firmware file upload (multipart/form-data → S3)
  app.use(firmwareUploadRouter);
  // War Damage Assessment image upload (PaddleOCR + Ollama LLaVA VLM)
  app.use("/api/damage", damageImageUploadRouter);
  // Device heartbeat (token-authenticated, no session required)
  app.use(deviceHeartbeatRouter);
  // Device bootstrap — zero-touch provisioning (token-authenticated, no session required)
  app.use(deviceBootstrapRouter);
  // LAS 2.0 file parser (multipart/form-data → lasio Python parse → MEM suggestions)
  app.use("/api/las", lasParserRouter);
  // Drone inspection media upload (photos, videos, thermal images → S3)
  app.use(droneImageUploadRouter);
  // tRPC API
  // Per-endpoint rate limiting (stricter for expensive operations)
  const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { error: "AI/ML rate limit exceeded" } });
  app.use("/api/trpc/aiCopilot", aiLimiter);
  app.use("/api/trpc/aiAdvanced", aiLimiter);
  const exportLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: "Export rate limit exceeded" } });
  app.use("/api/trpc/dataExport", exportLimiter);

  // HTTP Cache-Control headers for tRPC
  app.use("/api/trpc", (req, res, next) => {
    if (req.method === "GET") {
      // Query endpoints: allow short-lived browser caching
      res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
    } else {
      // Mutations: never cache
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    }
    next();
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Sentry error handler (must be after routes)
  app.use(getSentryErrorHandler());

  // ── Static / Vite ──────────────────────────────────────────────────────────
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    logger.info({ port }, `Server running on http://localhost:${port}/`);
    // Start background services
    startAlarmNotifier();
    // Probe PI Web API connection (non-blocking)
    probePIConnection().catch(err => console.warn("[PI Connector] Startup probe error:", err));
    // Start nightly benchmark scheduler (02:00 UTC, alerts owner if score < 70%)
    startBenchmarkScheduler();
    // Start PTW expiry scheduler (hourly, auto-closes ACTIVE permits past validUntil)
    startPTWScheduler();
    // Start daily damage digest (06:00 UTC, notifies owner of unaddressed critical assets)
    startDamageDigestScheduler();
    // Start monthly regulatory export scheduler (1st of each month at 06:00 UTC)
    startRegulatoryScheduler();
    // Start calibration due-date alert scheduler (every 6h)
    startCalibrationAlertScheduler();
    // Start HSE severity escalation scheduler (every 4h)
    startHSEEscalationScheduler();
    // Start materials reorder alert scheduler (every 8h)
    startMaterialsReorderScheduler();
    // Start telemetry simulator (every 30s — writes synthetic readings for all active wells)
    startTelemetrySimulator();
    // Initialize VAPID for PWA push notifications
    initWebPush();
    // Log external service connectivity status (non-blocking)
    logConnectivityStatus().catch(err => console.warn("[Connectivity] Health check error:", err));
    // Auto-load latest PINN surrogate model from S3 on startup (non-blocking, best-effort)
    const ML_STARTUP_URL = process.env.ML_URL ?? "http://localhost:4003";
    const PINN_S3_KEY = process.env.PINN_MODEL_S3_KEY ?? "pinn-models/pinn-surrogate-latest.pt";
    setTimeout(() => {
      fetch(`${ML_STARTUP_URL}/pinn/load`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ s3_key: PINN_S3_KEY }),
        signal: AbortSignal.timeout(15000),
      })
        .then(r => r.json())
        .then((d: unknown) => {
          const data = d as { ok?: boolean; version?: string; error?: string };
          if (data.ok) {
            console.log(`[PINN] Auto-loaded model from S3 key=${PINN_S3_KEY} version=${data.version ?? "unknown"}`);
          } else {
            console.warn(`[PINN] Auto-load skipped (no saved model yet): ${data.error ?? "unknown"}`);
          }
        })
        .catch(err => console.warn("[PINN] Auto-load attempt failed (ML service may not be running):", (err as Error).message));
    }, 5000); // Delay 5s to allow ML service to start
    // Register graceful shutdown handlers (SIGTERM/SIGINT with in-flight request draining)
    registerGracefulShutdown(server);
  });
}

startServer().catch(console.error);
