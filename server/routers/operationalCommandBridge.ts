import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { systemConfig, platform_health_checks, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const operationalCommandBridgeRouter = router({
  listCommands: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select().from(systemConfig).orderBy(desc(systemConfig.updatedAt)).limit(input?.limit ?? 50);
      return { commands: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  executeCommand: protectedProcedure.input(z.object({ command: z.string().min(1), target: z.string().min(1) })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      await db.insert(auditLog).values({ action: "command_executed", resource: "operational_command", resourceId: input.command, status: "success", metadata: { command: input.command, target: input.target } });
      return { command: input.command, target: input.target, status: "executed", timestamp: new Date().toISOString() };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getHealth: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalChecks] = await db.select({ value: count() }).from(platform_health_checks).limit(100);
    const [healthy] = await db.select({ value: count() }).from(platform_health_checks).where(eq(platform_health_checks.status, "healthy")).limit(100);
    return { totalChecks: Number(totalChecks.value), healthyChecks: Number(healthy.value), status: "operational" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [configs] = await db.select({ value: count() }).from(systemConfig).limit(100);
    return { totalConfigs: Number(configs.value) };
  }),
});
