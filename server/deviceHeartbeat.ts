/**
 * deviceHeartbeat.ts — REST heartbeat endpoint for field devices
 *
 * POST /api/devices/:deviceId/heartbeat
 *   Authorization: Bearer <provisioningToken>
 *   Body (JSON, optional):
 *     { firmwareVersion?: string, ipAddress?: string, metrics?: object }
 *
 * Response 200: { accepted: true, deviceId, serverTime }
 * Response 401: { error: "..." }
 * Response 404: { error: "Unknown device" }
 *
 * This endpoint is intentionally outside tRPC so that field RTUs, PLCs,
 * and edge nodes can call it with a simple curl/HTTP client without any
 * knowledge of tRPC protocol.  The provisioning token acts as the device
 * credential — it is stored in devices.provisioning_token and can be
 * rotated via the Device Management UI.
 *
 * On success the handler:
 *   1. Updates devices.last_heartbeat_at and devices.last_seen_at to NOW
 *   2. Flips status → "online" (from any non-decommissioned state)
 *   3. Updates firmware_version and ip_address if provided
 */

import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { devices } from "../drizzle/schema";

const router = Router();

// ── POST /api/devices/:deviceId/heartbeat ─────────────────────────────────────
router.post("/api/devices/:deviceId/heartbeat", async (req: Request, res: Response) => {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

    if (!token) {
      res.status(401).json({ error: "Missing Authorization: Bearer <token> header" });
      return;
    }

    const { deviceId } = req.params;
    const { firmwareVersion, ipAddress } = req.body ?? {};

    const db = await getDb();
    if (!db) {
      res.status(503).json({ error: "Database unavailable" });
      return;
    }

    // Look up device
    const [device] = await db
      .select()
      .from(devices)
      .where(eq(devices.deviceId, deviceId))
      .limit(1);

    if (!device) {
      res.status(404).json({ error: "Unknown device" });
      return;
    }

    // Validate token
    if (device.provisioningToken !== token) {
      res.status(401).json({ error: "Invalid provisioning token" });
      return;
    }

    // Reject decommissioned devices
    if (device.status === "decommissioned") {
      res.status(403).json({ error: "Device is decommissioned" });
      return;
    }

    const now = new Date();

    // Update heartbeat fields
    await db
      .update(devices)
      .set({
        lastHeartbeatAt: now,
        lastSeenAt: now,
        status: "online",
        ...(firmwareVersion ? { firmwareVersion } : {}),
        ...(ipAddress ? { ipAddress } : {}),
        updatedAt: now,
      })
      .where(eq(devices.id, device.id));

    res.json({
      accepted: true,
      deviceId,
      serverTime: now.toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[DeviceHeartbeat] Error:", message);
    res.status(500).json({ error: message });
  }
});

// ── GET /api/devices/:deviceId/status (lightweight status check) ──────────────
router.get("/api/devices/:deviceId/status", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    if (!token) {
      res.status(401).json({ error: "Missing Authorization header" });
      return;
    }

    const { deviceId } = req.params;
    const db = await getDb();
    if (!db) {
      res.status(503).json({ error: "Database unavailable" });
      return;
    }

    const [device] = await db
      .select({
        deviceId: devices.deviceId,
        status: devices.status,
        firmwareVersion: devices.firmwareVersion,
        lastHeartbeatAt: devices.lastHeartbeatAt,
        provisioningToken: devices.provisioningToken,
      })
      .from(devices)
      .where(eq(devices.deviceId, deviceId))
      .limit(1);

    if (!device || device.provisioningToken !== token) {
      // Don't leak whether device exists to unauthenticated callers
      res.status(404).json({ error: "Device not found or invalid token" });
      return;
    }

    res.json({
      deviceId: device.deviceId,
      status: device.status,
      firmwareVersion: device.firmwareVersion,
      lastHeartbeatAt: device.lastHeartbeatAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    res.status(500).json({ error: message });
  }
});

export { router as deviceHeartbeatRouter };
