import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { devices, auditLog } from "../../drizzle/schema";

export const agentDeviceFingerprintRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalDevices: 0, activeDevices: 0, flaggedDevices: 0 };
    const [total] = await db.select({ value: count() }).from(devices);
    return { totalDevices: Number(total.value), activeDevices: Number(total.value), flaggedDevices: 0 };
  }),
  listDevices: protectedProcedure.input(z.object({ agentId: z.number().optional(), limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { devices: [], total: 0 };
    const conditions: any[] = [];
    if (input?.agentId) conditions.push(eq(devices.agentId, input.agentId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db.select().from(devices).where(where).orderBy(desc(devices.lastSeenAt)).limit(input?.limit ?? 20);
    return { devices: rows, total: rows.length };
  }),
  registerDevice: protectedProcedure.input(z.object({ agentId: z.number(), serialNumber: z.string(), model: z.string().optional(), appVersion: z.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const [device] = await db.insert(devices).values({ agentId: input.agentId, serialNumber: input.serialNumber, model: input.model ?? "PAX A920 MAX", appVersion: input.appVersion ?? "1.0.0", status: "active" }).returning();
    await db.insert(auditLog).values({ action: "device_registered", resource: "devices", resourceId: String(device.id), status: "success", metadata: { agentId: input.agentId } });
    return { success: true, device };
  }),
});
