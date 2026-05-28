/**
 * deviceBootstrap.ts — Zero-touch provisioning bootstrap endpoint
 *
 * POST /api/device/bootstrap
 *   Authorization: Bearer <provisioningToken>
 *   Body (JSON):
 *     { deviceId: string, platform?: string, firmwareVersion?: string }
 *
 * Response 200: Full server configuration bundle for the device:
 *   {
 *     accepted: true,
 *     deviceId: string,
 *     config: {
 *       mqttBrokerUrl: string,        // EMQX broker URL (mqtts:// for TLS)
 *       mqttClientId: string,         // Unique MQTT client ID for this device
 *       mqttTopicPrefix: string,      // e.g. "og-rmm/devices/<deviceId>"
 *       telemetryIntervalMs: number,  // How often to publish telemetry (ms)
 *       heartbeatIntervalMs: number,  // How often to POST heartbeat (ms)
 *       heartbeatUrl: string,         // Full URL for heartbeat endpoint
 *       statusUrl: string,            // Full URL for status check endpoint
 *       otaCheckUrl: string,          // URL to check for OTA updates
 *       serverTime: string,           // ISO timestamp for clock sync
 *       tokenExpiresAt: string | null // ISO timestamp when token expires
 *     }
 *   }
 *
 * Response 401: { error: "..." }   — missing/invalid token
 * Response 403: { error: "..." }   — decommissioned or token expired
 * Response 404: { error: "..." }   — unknown device
 *
 * This endpoint completes the zero-touch provisioning flow:
 *   1. Field technician registers device in Device Management UI
 *   2. UI generates a provisioning token and shows a QR code
 *   3. Technician scans QR code on the RTU/PLC — device calls this endpoint
 *   4. Device receives full server config and begins normal operation
 */
import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { devices } from "../drizzle/schema";
import { ENV } from "./_core/env";

const router = Router();

// ── POST /api/device/bootstrap ────────────────────────────────────────────────
router.post("/api/device/bootstrap", async (req: Request, res: Response) => {
  try {
    // Extract Bearer token
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    if (!token) {
      res.status(401).json({ error: "Missing Authorization: Bearer <provisioningToken> header" });
      return;
    }

    const { deviceId, platform, firmwareVersion } = req.body ?? {};
    if (!deviceId || typeof deviceId !== "string") {
      res.status(400).json({ error: "Missing required field: deviceId" });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(503).json({ error: "Database unavailable" });
      return;
    }

    // Look up device by deviceId
    const [device] = await db
      .select()
      .from(devices)
      .where(eq(devices.deviceId, deviceId))
      .limit(1);

    if (!device) {
      res.status(404).json({ error: "Unknown device" });
      return;
    }

    // Validate provisioning token
    if (device.provisioningToken !== token) {
      res.status(401).json({ error: "Invalid provisioning token" });
      return;
    }

    // Reject decommissioned devices
    if (device.status === "decommissioned") {
      res.status(403).json({ error: "Device is decommissioned and cannot be bootstrapped" });
      return;
    }

    // Check token expiry
    if (device.provisioningTokenExpiresAt && new Date(device.provisioningTokenExpiresAt) < new Date()) {
      res.status(403).json({
        error: "Provisioning token has expired. Please generate a new token in the Device Management UI.",
        expiredAt: device.provisioningTokenExpiresAt,
      });
      return;
    }

    const now = new Date();

    // Update device: mark as online, record platform/firmware if provided
    await db
      .update(devices)
      .set({
        status: "online",
        lastHeartbeatAt: now,
        lastSeenAt: now,
        ...(platform ? { deviceType: platform } : {}),
        ...(firmwareVersion ? { firmwareVersion } : {}),
        updatedAt: now,
      })
      .where(eq(devices.id, device.id));

    // Derive the public base URL from the request
    const proto = req.headers["x-forwarded-proto"] ?? req.protocol ?? "https";
    const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:3000";
    const baseUrl = `${proto}://${host}`;

    // Build MQTT broker URL — prefer mqtts:// in production
    const rawMqttUrl = ENV.emqxUrl ?? "mqtt://emqx:1883";
    const mqttBrokerUrl = ENV.isProduction
      ? rawMqttUrl.replace(/^mqtt:\/\//, "mqtts://").replace(/:1883$/, ":8883")
      : rawMqttUrl;

    const topicPrefix = `og-rmm/devices/${deviceId}`;

    const config = {
      // MQTT connectivity
      mqttBrokerUrl,
      mqttClientId: `og-rmm-device-${deviceId}`,
      mqttTopicPrefix: topicPrefix,
      mqttTopics: {
        telemetry: `${topicPrefix}/telemetry`,
        alarms: `${topicPrefix}/alarms`,
        commands: `${topicPrefix}/commands`,
        ota: `${topicPrefix}/ota`,
        status: `${topicPrefix}/status`,
      },

      // Timing
      telemetryIntervalMs: 5_000,   // publish telemetry every 5 seconds
      heartbeatIntervalMs: 60_000,  // POST heartbeat every 60 seconds

      // REST endpoints
      heartbeatUrl: `${baseUrl}/api/devices/${deviceId}/heartbeat`,
      statusUrl: `${baseUrl}/api/devices/${deviceId}/status`,
      otaCheckUrl: `${baseUrl}/api/devices/${deviceId}/ota/pending`,

      // Clock sync
      serverTime: now.toISOString(),
      tokenExpiresAt: device.provisioningTokenExpiresAt
        ? new Date(device.provisioningTokenExpiresAt).toISOString()
        : null,

      // TLS hint for production
      tlsRequired: ENV.isProduction,
      tlsCaUrl: ENV.isProduction ? `${baseUrl}/api/device/ca-cert` : null,
    };

    console.log(`[Bootstrap] Device ${deviceId} bootstrapped successfully from ${req.ip}`);

    res.json({
      accepted: true,
      deviceId,
      config,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[DeviceBootstrap] Error:", message);
    res.status(500).json({ error: message });
  }
});

// ── GET /api/device/ca-cert (TLS CA certificate for production) ───────────────
router.get("/api/device/ca-cert", (_req: Request, res: Response) => {
  // In production, serve the actual CA certificate from an environment variable or file.
  // For development, return a placeholder that informs the device to skip TLS verification.
  const caCert = process.env.DEVICE_CA_CERT ?? null;
  if (!caCert) {
    res.status(404).json({
      error: "CA certificate not configured. Set DEVICE_CA_CERT environment variable.",
      hint: "In development, devices may skip TLS verification (insecure=true).",
    });
    return;
  }
  res.type("text/plain").send(caCert);
});

// ── GET /api/devices/:deviceId/ota/pending (check for pending OTA update) ─────
router.get("/api/devices/:deviceId/ota/pending", async (req: Request, res: Response) => {
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
      .select()
      .from(devices)
      .where(eq(devices.deviceId, deviceId))
      .limit(1);

    if (!device || device.provisioningToken !== token) {
      res.status(404).json({ error: "Device not found or invalid token" });
      return;
    }

    // Check device_updates table for a pending update assigned to this device
    // For now return no pending update (OTA campaigns are managed via the UI)
    res.json({
      deviceId,
      pendingUpdate: null,
      currentFirmware: device.firmwareVersion ?? "unknown",
      checkedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    res.status(500).json({ error: message });
  }
});

export { router as deviceBootstrapRouter };
