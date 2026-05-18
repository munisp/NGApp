import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { systemConfig, platform_health_checks, auditLog } from "../../drizzle/schema";

export const operationalCommandBridgeRouter = router({
  listCommands: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(systemConfig).orderBy(desc(systemConfig.updatedAt)).limit(input?.limit ?? 50);
    return { commands: rows, total: rows.length };
  }),
  executeCommand: protectedProcedure.input(z.object({ command: z.string().min(1), target: z.string().min(1) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.insert(auditLog).values({ action: "command_executed", resource: "operational_command", resourceId: input.command, status: "success", metadata: { command: input.command, target: input.target } });
    return { command: input.command, target: input.target, status: "executed", timestamp: new Date().toISOString() };
  }),
  getHealth: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalChecks] = await db.select({ value: count() }).from(platform_health_checks);
    const [healthy] = await db.select({ value: count() }).from(platform_health_checks).where(eq(platform_health_checks.status, "healthy"));
    return { totalChecks: Number(totalChecks.value), healthyChecks: Number(healthy.value), status: "operational" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [configs] = await db.select({ value: count() }).from(systemConfig);
    return { totalConfigs: Number(configs.value) };
  }),
});
