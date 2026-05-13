import "dotenv/config";
import express from "express";
import compression from "compression";
import { createServer } from "http";
import net from "net";
import { logger } from "../lib/logger";
import { securityHeaders } from "../middleware/security-headers";
import { corsMiddleware } from "../middleware/cors-config";
import { startRetryProcessor } from "../onboarding/retryScheduler";
import { startTestScheduler } from "../onboarding/testScheduler";
import { startRateAlertMonitor } from "../jobs/rateAlertMonitor";
import { startCleanupJob } from "../jobs/cleanupJob";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { generalRateLimiter, rateLimitErrorHandler } from "../middleware/rateLimitMiddleware";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

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
  const app = express();
  const server = createServer(app);
  
  // Trust proxy for proper protocol detection behind reverse proxies (nginx, APISIX, etc.)
  const trustProxy = process.env.TRUST_PROXY || '1';
  app.set('trust proxy', trustProxy === 'true' ? true : trustProxy === 'false' ? false : trustProxy);

  // Security headers (CSP, HSTS, X-Frame-Options, etc.)
  app.use(securityHeaders);

  // CORS
  app.use(corsMiddleware);
  
  // Gzip/deflate compression for all responses
  app.use(compression({ level: 6, threshold: 1024 }));

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  // Apply general rate limiting to all API routes
  app.use('/api', generalRateLimiter);
  
  // Rate limit error handler
  app.use(rateLimitErrorHandler);
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    logger.warn({ preferredPort, port }, 'Port busy, using alternative');
  }

  server.listen(port, () => {
    logger.info({ port, env: process.env.NODE_ENV }, 'Server started');
    
    // Start webhook retry processor
    startRetryProcessor();
    
    // Start test scheduler
    startTestScheduler();
    
    // Start rate alert monitor
    startRateAlertMonitor();
    
    // Start cleanup job
    startCleanupJob();
  });
}

startServer().catch((err) => {
  logger.fatal({ err }, 'Server failed to start');
  process.exit(1);
});
