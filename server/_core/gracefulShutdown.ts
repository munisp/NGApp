/**
 * Graceful shutdown handler for the OG-RMM Node.js server.
 *
 * Implements a two-phase shutdown:
 * 1. Stop accepting new connections (server.close)
 * 2. Wait for in-flight requests to complete (up to SHUTDOWN_TIMEOUT_MS)
 * 3. Force-close remaining connections if timeout exceeded
 *
 * Usage:
 *   import { registerGracefulShutdown } from './_core/gracefulShutdown';
 *   const server = app.listen(port);
 *   registerGracefulShutdown(server);
 */

import type { Server } from 'http';
import logger from './logger';

const SHUTDOWN_TIMEOUT_MS = parseInt(process.env.SHUTDOWN_TIMEOUT_MS ?? '30000', 10);

let isShuttingDown = false;
let activeConnections = 0;
const connections = new Set<import('net').Socket>();

/**
 * Registers SIGTERM and SIGINT handlers for graceful shutdown.
 * Tracks active connections and waits for them to drain before exiting.
 */
export function registerGracefulShutdown(server: Server): void {
  // Track all open connections
  server.on('connection', (socket) => {
    connections.add(socket);
    activeConnections++;
    socket.on('close', () => {
      connections.delete(socket);
      activeConnections--;
    });
  });

  // Middleware-like request tracking via server events
  server.on('request', (_req, res) => {
    activeConnections++;
    res.on('finish', () => {
      activeConnections--;
    });
    res.on('close', () => {
      activeConnections--;
    });
  });

  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      console.log(`[GracefulShutdown] Already shutting down, ignoring ${signal}`);
      return;
    }
    isShuttingDown = true;
    console.log(`[GracefulShutdown] Received ${signal} — starting graceful shutdown`);
    console.log(`[GracefulShutdown] Active connections: ${activeConnections}`);

    // Stop accepting new connections
    server.close((err) => {
      if (err) {
        logger.error({ err }, '[GracefulShutdown] Error closing server');
      } else {
        logger.info('[GracefulShutdown] Server closed — no new connections accepted');
      }
    });

    // Close DB pool
    try {
      const { closePool } = await import('../db');
      await closePool();
    } catch (e) {
      logger.error({ err: e }, '[GracefulShutdown] Error closing DB pool');
    }

    // Wait for in-flight requests with timeout
    const deadline = Date.now() + SHUTDOWN_TIMEOUT_MS;
    const checkDrain = () => {
      if (activeConnections <= 0 || Date.now() >= deadline) {
        if (activeConnections > 0) {
          console.warn(`[GracefulShutdown] Timeout exceeded — force-closing ${connections.size} connections`);
          connections.forEach((socket) => socket.destroy());
        } else {
          console.log('[GracefulShutdown] All connections drained — exiting cleanly');
        }
        process.exit(0);
      } else {
        console.log(`[GracefulShutdown] Waiting for ${activeConnections} in-flight requests...`);
        setTimeout(checkDrain, 500);
      }
    };

    setTimeout(checkDrain, 100);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions — log and attempt graceful shutdown
  process.on('uncaughtException', (err) => {
    console.error('[GracefulShutdown] Uncaught exception:', err);
    shutdown('uncaughtException').catch(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[GracefulShutdown] Unhandled rejection:', reason);
    // Don't exit on unhandled rejections in production — just log
  });

  console.log(`[GracefulShutdown] Registered (timeout: ${SHUTDOWN_TIMEOUT_MS}ms)`);
}

/**
 * Returns true if the server is in the process of shutting down.
 * Use this to reject new long-running operations during shutdown.
 */
export function isServerShuttingDown(): boolean {
  return isShuttingDown;
}
