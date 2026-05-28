/**
 * deviceManagement.ts — Device registry and provisioning router
 *
 * Procedures:
 *   - listDevices          : list all registered devices with status
 *   - getDevice            : get a single device by ID
 *   - registerDevice       : register a new device and generate a provisioning token
 *   - updateDevice         : update device metadata
 *   - deleteDevice         : remove a device from the registry
 *   - generateToken        : generate a new provisioning token for a device
 *   - heartbeat            : device heartbeat (public, token-gated)
 *   - updateStatus         : manually update device status
 *   - getStats             : fleet-level statistics
 */

import { z } from "zod";
import { eq, desc, count, and, lt } from "drizzle-orm";
import crypto from "crypto";
import { protectedProcedure, router, adminProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { devices, wells } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";
import { withCache, cacheKey, cacheInvalidateRouter, TTL } from "../cache";

const PROVISIONING_TOKEN_TTL_HOURS = 24;

function generateProvisioningToken(): string {
  return `prov_${crypto.randomBytes(32).toString("hex")}`;
}

const deviceTypeValues = ["RTU", "PLC", "SCADA_GATEWAY", "FLOW_COMPUTER", "SENSOR_HUB", "ESP_CONTROLLER", "WELLHEAD_CONTROLLER", "EDGE_NODE"] as const;
const deviceStatusValues = ["provisioning", "online", "offline", "maintenance", "decommissioned", "error"] as const;

export const deviceManagementRouter = router({
  // ── List devices ─────────────────────────────────────────────────────────────
  listDevices: protectedProcedure
    .input(z.object({
      deviceType: z.enum(deviceTypeValues).optional(),
      status: z.enum(deviceStatusValues).optional(),
      wellId: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const key = cacheKey("devices", "list", { type: input?.deviceType, status: input?.status, well: input?.wellId });
      return withCache(key, TTL.DEVICE_MANAGEMENT, async () => {
        const db = await getDb();
        if (!db) return [];
        const conditions = [];
        if (input?.deviceType) conditions.push(eq(devices.deviceType, input.deviceType));
        if (input?.status) conditions.push(eq(devices.status, input.status));
        if (input?.wellId) conditions.push(eq(devices.wellId, input.wellId));
        const rows = conditions.length > 0
          ? await db.select().from(devices).where(and(...conditions)).orderBy(desc(devices.createdAt))
          : await db.select().from(devices).orderBy(desc(devices.createdAt));
        return rows;
      });
    }),

  // ── Get single device ────────────────────────────────────────────────────────
  getDevice: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const [device] = await db.select().from(devices).where(eq(devices.id, input.id)).limit(1);
        if (!device) throw new TRPCError({ code: "NOT_FOUND", message: "Device not found" });
        return device;
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  // ── Register device ──────────────────────────────────────────────────────────
  registerDevice: protectedProcedure
    .input(z.object({
      deviceId: z.string().min(3).max(64),
      name: z.string().min(1).max(128),
      deviceType: z.enum(deviceTypeValues),
      manufacturer: z.string().max(128).optional(),
      model: z.string().max(128).optional(),
      serialNumber: z.string().max(128).optional(),
      firmwareVersion: z.string().max(64).optional(),
      hardwareRevision: z.string().max(32).optional(),
      wellId: z.string().max(64).optional(),
      fieldLocation: z.string().max(128).optional(),
      ipAddress: z.string().max(45).optional(),
      macAddress: z.string().max(17).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Check uniqueness
      const existing = await db.select({ id: devices.id }).from(devices)
        .where(eq(devices.deviceId, input.deviceId)).limit(1);
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: `Device ID '${input.deviceId}' is already registered` });
      }

      const provisioningToken = generateProvisioningToken();
      const provisioningTokenExpiresAt = new Date(Date.now() + PROVISIONING_TOKEN_TTL_HOURS * 60 * 60 * 1000);

      const [device] = await db.insert(devices).values({
        ...input,
        provisioningToken,
        provisioningTokenExpiresAt,
        status: "provisioning",
        registeredBy: ctx.user.id,
      }).returning();

      return {
        ...device,
        provisioningToken, // Return token only on creation
        bootstrapCommand: `curl -X POST /api/device/bootstrap -H "Authorization: Bearer ${provisioningToken}" -d '{"deviceId":"${input.deviceId}"}'`,
      };
    }),

  // ── Update device ────────────────────────────────────────────────────────────
  updateDevice: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().max(128).optional(),
      firmwareVersion: z.string().max(64).optional(),
      wellId: z.string().max(64).optional(),
      fieldLocation: z.string().max(128).optional(),
      ipAddress: z.string().max(45).optional(),
      macAddress: z.string().max(17).optional(),
      notes: z.string().optional(),
      tags: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const { id, ...updates } = input;
        await db.update(devices).set({ ...updates, updatedAt: new Date() }).where(eq(devices.id, id));
        return { success: true };
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  // ── Delete device ────────────────────────────────────────────────────────────
  deleteDevice: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.update(devices)
        .set({ status: "decommissioned", updatedAt: new Date() })
        .where(eq(devices.id, input.id));
      return { success: true };
    }),

  // ── Generate new provisioning token ─────────────────────────────────────────
  generateToken: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const token = generateProvisioningToken();
        const expiresAt = new Date(Date.now() + PROVISIONING_TOKEN_TTL_HOURS * 60 * 60 * 1000);
        await db.update(devices)
          .set({ provisioningToken: token, provisioningTokenExpiresAt: expiresAt, updatedAt: new Date() })
          .where(eq(devices.id, input.id));
        return { token, expiresAt };
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  // ── Device heartbeat (public, token-gated) ───────────────────────────────────
  heartbeat: protectedProcedure
    .input(z.object({
      deviceId: z.string(),
      token: z.string(),
      firmwareVersion: z.string().optional(),
      ipAddress: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { accepted: false, reason: "Database unavailable" };
      const [device] = await db.select().from(devices)
        .where(eq(devices.deviceId, input.deviceId)).limit(1);
      if (!device) return { accepted: false, reason: "Unknown device" };
      if (device.provisioningToken !== input.token) return { accepted: false, reason: "Invalid token" };
      // Check provisioning token expiry
      if (device.provisioningTokenExpiresAt && device.provisioningTokenExpiresAt < new Date()) {
        return { accepted: false, reason: "Provisioning token expired. Please regenerate a token from the Device Management console." };
      }

      const now = new Date();
      await db.update(devices).set({
        lastHeartbeatAt: now,
        lastSeenAt: now,
        status: "online",
        firmwareVersion: input.firmwareVersion ?? device.firmwareVersion,
        ipAddress: input.ipAddress ?? device.ipAddress,
        updatedAt: now,
      }).where(eq(devices.id, device.id));

      return { accepted: true, deviceId: input.deviceId, serverTime: now.toISOString() };
    }),

  // ── Update device status ─────────────────────────────────────────────────────
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(deviceStatusValues),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        await db.update(devices)
          .set({ status: input.status, updatedAt: new Date() })
          .where(eq(devices.id, input.id));
        return { success: true };
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  // ── List devices for map overlay (joins with wells for lat/lng) ─────────────
  listForMap: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        deviceId: devices.deviceId,
        name: devices.name,
        deviceType: devices.deviceType,
        status: devices.status,
        lastSeenAt: devices.lastSeenAt,
        firmwareVersion: devices.firmwareVersion,
        wellId: devices.wellId,
        wellName: wells.name,
        latitude: wells.latitude,
        longitude: wells.longitude,
      })
      .from(devices)
      .leftJoin(wells, eq(devices.wellId, wells.wellId));
    return rows
      .filter((r) => r.latitude != null && r.longitude != null)
      .map((r) => ({
        ...r,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        lastSeenAt: r.lastSeenAt ? r.lastSeenAt.toISOString() : null,
      }));
  }),

  // ── Mark stale devices offline (called by cron) ───────────────────────────
  markStaleOffline: protectedProcedure
    .input(z.object({ thresholdMinutes: z.number().min(1).max(60).default(10) }).optional())
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { updated: 0 };
      const threshold = new Date(Date.now() - (input?.thresholdMinutes ?? 10) * 60 * 1000);
      const result = await db.update(devices)
        .set({ status: "offline", updatedAt: new Date() })
        .where(and(
          eq(devices.status, "online"),
          lt(devices.lastHeartbeatAt, threshold)
        ))
        .returning({ id: devices.id });
      return { updated: result.length };
    }),

  // ── Fleet statistics ─────────────────────────────────────────────────────────
  getStats: protectedProcedure.query(async () => {
    try {
      const key = cacheKey("devices", "stats");
      return await withCache(key, TTL.DEVICE_MANAGEMENT, async () => {
        const db = await getDb();
        if (!db) return { total: 0, online: 0, offline: 0, provisioning: 0, maintenance: 0, error: 0 };
        const rows = await db.select({
          status: devices.status,
          cnt: count(),
        }).from(devices).groupBy(devices.status);
    
        const stats: Record<string, number> = { total: 0, online: 0, offline: 0, provisioning: 0, maintenance: 0, error: 0, decommissioned: 0 };
        for (const row of rows) {
          stats[row.status] = Number(row.cnt);
          stats.total += Number(row.cnt);
        }
        return stats;
      });
    } catch (err: unknown) {
      if (err instanceof TRPCError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
    }
  }),
});
