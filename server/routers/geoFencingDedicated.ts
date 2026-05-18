import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { geofenceZones, agentGeofenceZones, deviceLocations, auditLog } from "../../drizzle/schema";

export const geoFencingDedicatedRouter = router({
  listZones: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(geofenceZones).orderBy(desc(geofenceZones.createdAt)).limit(input?.limit ?? 50);
    return { zones: rows, total: rows.length };
  }),
  getZone: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [zone] = await db.select().from(geofenceZones).where(eq(geofenceZones.id, input.id)).limit(1);
    if (!zone) return null;
    const agents = await db.select().from(agentGeofenceZones).where(eq(agentGeofenceZones.zoneId, input.id));
    return { ...zone, agentCount: agents.length };
  }),
  createZone: protectedProcedure.input(z.object({ name: z.string(), latitude: z.number(), longitude: z.number(), radiusMeters: z.number(), type: z.string().default("operational") })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [zone] = await db.insert(geofenceZones).values({ name: input.name, latitude: String(input.latitude), longitude: String(input.longitude), radiusMeters: input.radiusMeters, type: input.type }).returning();
    await db.insert(auditLog).values({ action: "geofence_zone_created", resource: "geofence_zones", resourceId: String(zone.id), status: "success", metadata: { name: input.name } });
    return zone;
  }),
  deleteZone: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.delete(agentGeofenceZones).where(eq(agentGeofenceZones.zoneId, input.id));
    await db.delete(geofenceZones).where(eq(geofenceZones.id, input.id));
    await db.insert(auditLog).values({ action: "geofence_zone_deleted", resource: "geofence_zones", resourceId: String(input.id), status: "success", metadata: {} });
    return { success: true };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalZones] = await db.select({ value: count() }).from(geofenceZones);
    const [totalAssignments] = await db.select({ value: count() }).from(agentGeofenceZones);
    return { totalZones: Number(totalZones.value), totalAssignments: Number(totalAssignments.value) };
  }),
});
