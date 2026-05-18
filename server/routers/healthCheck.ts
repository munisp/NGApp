
import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { TRPCError } from "@trpc/server";

export const healthCheckRouter = router({
  status: publicProcedure.query(async () => {
    const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};
    
    // Database check
    const dbStart = Date.now();
    try {
      const db = await getDb();
      if (db) {
        await db.execute({ sql: "SELECT 1" });
        checks.database = { status: "healthy", latencyMs: Date.now() - dbStart };
      } else {
        checks.database = { status: "unavailable", error: "No DB connection" };
      }
    } catch (e) {
      checks.database = { status: "unhealthy", latencyMs: Date.now() - dbStart, error: (e as Error).message };
    }
    
    // Redis check
    try {
      const { cacheGet } = await import("../../redisClient");
      const redisStart = Date.now();
      await cacheGet("health_check_ping");
      checks.redis = { status: "healthy", latencyMs: Date.now() - redisStart };
    } catch (e) {
      checks.redis = { status: "unavailable", error: (e as Error).message };
    }
    
    // Kafka check
    try {
      const kafkaStart = Date.now();
      const { getKafkaStatus } = await import("../../kafkaClient");
      const kafkaUp = await getKafkaStatus?.() ?? false;
      checks.kafka = kafkaUp 
        ? { status: "healthy", latencyMs: Date.now() - kafkaStart }
        : { status: "unavailable" };
    } catch {
      checks.kafka = { status: "unavailable" };
    }
    
    // TigerBeetle sidecar check
    try {
      const tbStart = Date.now();
      const resp = await fetch("http://localhost:9090/health", { signal: AbortSignal.timeout(2000) });
      checks.tigerBeetle = resp.ok 
        ? { status: "healthy", latencyMs: Date.now() - tbStart }
        : { status: "unhealthy", error: `HTTP ${resp.status}` };
    } catch {
      checks.tigerBeetle = { status: "unavailable" };
    }
    
    const overallHealthy = checks.database?.status === "healthy";
    return {
      status: overallHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version ?? "1.0.0",
      services: checks,
    };
  }),
});
