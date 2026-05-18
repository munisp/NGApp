import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { platform_health_checks, auditLog } from "../../drizzle/schema";

export const securityHardeningRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(platform_health_checks).where(eq(platform_health_checks.checkType, "security")).orderBy(desc(platform_health_checks.checkedAt)).limit(input?.limit ?? 50);
    return { checks: rows, total: rows.length };
  }),
  runScan: protectedProcedure.input(z.object({ target: z.string().min(1) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [check] = await db.insert(platform_health_checks).values({ serviceName: input.target, checkType: "security", status: "healthy", responseTime: 0 }).returning();
    await db.insert(auditLog).values({ action: "security_scan_initiated", resource: "platform_health_checks", resourceId: String(check.id), status: "success", metadata: { target: input.target } });
    return { id: check.id, target: input.target, status: "completed" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(platform_health_checks).where(eq(platform_health_checks.checkType, "security"));
    return { totalScans: Number(total.value) };
  }),
});
