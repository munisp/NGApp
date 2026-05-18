import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { systemConfig, platform_health_checks, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const middlewareServiceManagerRouter = router({
  listServices: protectedProcedure.input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [registry] = await db.select().from(systemConfig).where(eq(systemConfig.key, "middleware_services")).limit(1);
      const services = registry ? JSON.parse(String(registry.value)) : [
        { name: "kafka", status: "running", type: "message_broker" },
        { name: "redis", status: "running", type: "cache" },
        { name: "temporal", status: "running", type: "workflow" },
        { name: "fluvio", status: "running", type: "streaming" }
      ];
      return { services: services.slice(0, input?.limit ?? 50), total: services.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  updateServiceConfig: protectedProcedure.input(z.object({ serviceName: z.string().min(1).max(64), config: z.record(z.string(), z.string()) })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const key = `middleware_${input.serviceName}_config`;
      const [existing] = await db.select().from(systemConfig).where(eq(systemConfig.key, key)).limit(1);
      if (existing) {
        await db.update(systemConfig).set({ value: JSON.stringify(input.config) }).where(eq(systemConfig.key, key));
      } else {
        await db.insert(systemConfig).values({ key, value: JSON.stringify(input.config) });
      }
      await db.insert(auditLog).values({ action: "middleware_config_updated", resource: "middleware_service", resourceId: input.serviceName, status: "success", metadata: input.config });
      return { success: true, serviceName: input.serviceName };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [checks] = await db.select({ value: count() }).from(platform_health_checks).limit(100);
    return { totalHealthChecks: Number(checks.value) };
  }),
});
