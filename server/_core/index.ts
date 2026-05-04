import "dotenv/config";
import express from "express";
import compression from "compression";
import { createServer } from "http";
import net from "net";
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
  // This ensures req.protocol and req.ip are correct when behind a TLS-terminating proxy
  // Set to 1 for single proxy hop, or 'loopback' for localhost proxies
  const trustProxy = process.env.TRUST_PROXY || '1';
  app.set('trust proxy', trustProxy === 'true' ? true : trustProxy === 'false' ? false : trustProxy);
  
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
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // API versioning header middleware
  app.use('/api', (req, res, next) => {
    const requestedVersion = req.headers['accept-version'] || req.headers['x-api-version'] || 'v1';
    res.setHeader('X-API-Version', 'v1');
    res.setHeader('X-Supported-Versions', 'v1');
    (req as any).apiVersion = requestedVersion;
    next();
  });

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      version: process.env.APP_VERSION || '2.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness probe
  app.get('/ready', (_req, res) => {
    res.json({ status: 'ready' });
  });

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    
    // Start webhook retry processor
    startRetryProcessor();
    
    // Start test scheduler
    startTestScheduler();
    
    // Start rate alert monitor
    startRateAlertMonitor();
    
    // Start cleanup job
    startCleanupJob();
  });

  // Graceful shutdown — wait for in-flight requests
  let shuttingDown = false;
  const connections = new Set<import('net').Socket>();

  server.on('connection', (conn) => {
    connections.add(conn);
    conn.on('close', () => connections.delete(conn));
  });

  function gracefulShutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[shutdown] Received ${signal}, draining connections...`);

    // Stop accepting new connections
    server.close(() => {
      console.log('[shutdown] All connections drained, exiting.');
      process.exit(0);
    });

    // Give in-flight requests time to complete
    const SHUTDOWN_TIMEOUT = parseInt(process.env.SHUTDOWN_TIMEOUT || '30000');
    setTimeout(() => {
      console.warn('[shutdown] Timeout reached, forcing shutdown.');
      for (const conn of connections) conn.destroy();
      process.exit(1);
    }, SHUTDOWN_TIMEOUT);
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer().catch(console.error);
