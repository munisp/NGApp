import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { ENV } from "../_core/env";

/**
 * Health check router for monitoring service status
 */
export const healthRouter = router({
  /**
   * Check OCR service health
   */
  checkOcrService: publicProcedure.query(async () => {
    const ocrServiceUrl = process.env.OCR_SERVICE_URL;
    
    if (!ocrServiceUrl) {
      return {
        status: "unconfigured",
        message: "OCR_SERVICE_URL not configured",
        available: false,
      };
    }

    try {
      const response = await fetch(`${ocrServiceUrl}/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(5000), // 5s timeout
      });

      if (response.ok) {
        const data = await response.json();
        return {
          status: "healthy",
          message: "OCR service is operational",
          available: true,
          details: data,
        };
      } else {
        return {
          status: "unhealthy",
          message: `OCR service returned ${response.status}`,
          available: false,
        };
      }
    } catch (error: any) {
      return {
        status: "error",
        message: error.message || "Failed to connect to OCR service",
        available: false,
      };
    }
  }),

  /**
   * Check orchestration API health
   */
  checkOrchestration: publicProcedure.query(async () => {
    try {
      const response = await fetch("http://localhost:8003/api/stats", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          status: "healthy",
          message: "Orchestration API is operational",
          available: true,
          workers: data.workers?.length || 0,
          queues: data.queueStats?.length || 0,
        };
      } else {
        return {
          status: "unhealthy",
          message: `Orchestration API returned ${response.status}`,
          available: false,
        };
      }
    } catch (error: any) {
      return {
        status: "error",
        message: error.message || "Failed to connect to orchestration API",
        available: false,
      };
    }
  }),

  /**
   * Check database health
   */
  checkDatabase: publicProcedure.query(async () => {
    try {
      const { getDb } = await import("../db");
      const db = await getDb();
      
      if (!db) {
        return {
          status: "unconfigured",
          message: "Database not configured",
          available: false,
        };
      }

      // Simple query to check connection
      await db.execute("SELECT 1");
      
      return {
        status: "healthy",
        message: "Database connection is operational",
        available: true,
      };
    } catch (error: any) {
      return {
        status: "error",
        message: error.message || "Database connection failed",
        available: false,
      };
    }
  }),

  /**
   * Get overall system health
   */
  getSystemHealth: publicProcedure.query(async ({ ctx }) => {
    // Call health check functions directly
    const checkOcr = async () => {
      try {
        const response = await fetch(`${ENV.ocrServiceUrl}/health`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000),
        });
        return { available: response.ok, status: response.ok ? 'healthy' : 'unhealthy' };
      } catch (error) {
        return { available: false, status: 'unavailable', error: error instanceof Error ? error.message : 'Unknown error' };
      }
    };

    const checkOrch = async () => {
      try {
        const response = await fetch('http://localhost:8003/api/stats', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000),
        });
        return { available: response.ok, status: response.ok ? 'healthy' : 'unhealthy' };
      } catch (error) {
        return { available: false, status: 'unavailable', error: error instanceof Error ? error.message : 'Unknown error' };
      }
    };

    const checkDb = async () => {
      try {
        const db = await getDb();
        if (!db) return { available: false, status: 'unavailable' };
        await db.select().from(users).limit(1);
        return { available: true, status: 'healthy' };
      } catch (error) {
        return { available: false, status: 'unavailable', error: error instanceof Error ? error.message : 'Unknown error' };
      }
    };

    const [ocr, orchestration, database] = await Promise.all([
      checkOcr(),
      checkOrch(),
      checkDb(),
    ]);

    const allHealthy = ocr.available && orchestration.available && database.available;

    return {
      overall: allHealthy ? "healthy" : "degraded",
      services: {
        ocr,
        orchestration,
        database,
      },
      timestamp: new Date().toISOString(),
    };
  }),
});
