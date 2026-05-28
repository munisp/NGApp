/**
 * sse.ts — Server-Sent Events endpoint for real-time telemetry streaming
 *
 * Endpoint: GET /api/telemetry/stream?wellId=PB-047
 *
 * Clients receive a stream of JSON events:
 *   data: {"type":"telemetry","wellId":"PB-047","data":{...}}
 *   data: {"type":"alarm","wellId":"PB-047","data":{...}}
 *   data: {"type":"heartbeat","ts":1234567890}
 *
 * The server polls the database every 5 seconds and pushes any new
 * telemetry readings and unacknowledged alarms to connected clients.
 * When no DB is available it sends simulated readings so the UI always
 * has something to display.
 */
import { Router, Request, Response } from "express";
import { getDb } from "./db";
import { telemetryReadings, alarms } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { getSubClient } from "./cache";
import { sdk } from "./_core/sdk";

export const sseRouter = Router();

// Active SSE connections keyed by wellId (or "*" for all wells)
const clients = new Map<string, Set<Response>>();

function addClient(wellId: string, res: Response) {
  if (!clients.has(wellId)) clients.set(wellId, new Set());
  clients.get(wellId)!.add(res);
}

function removeClient(wellId: string, res: Response) {
  clients.get(wellId)?.delete(res);
  if (clients.get(wellId)?.size === 0) clients.delete(wellId);
}

function sendToClients(wellId: string, event: object) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  // Send to specific well subscribers
  clients.get(wellId)?.forEach(res => {
    try { res.write(payload); } catch { /* client disconnected */ }
  });
  // Send to wildcard subscribers
  clients.get("*")?.forEach(res => {
    try { res.write(payload); } catch { /* client disconnected */ }
  });
}

// Simulate realistic telemetry when DB is unavailable
function simulateTelemetry(wellId: string) {
  return {
    wellId,
    tubingPressure: 2200 + Math.random() * 600,
    casingPressure: 1800 + Math.random() * 400,
    flowRate: 600 + Math.random() * 400,
    waterCut: 20 + Math.random() * 30,
    gasOilRatio: 500 + Math.random() * 200,
    espCurrent: 45 + Math.random() * 15,
    espFrequency: 55 + Math.random() * 5,
    espVibration: 0.15 + Math.random() * 0.2,
    espMotorTemp: 85 + Math.random() * 20,
    espInletPressure: 800 + Math.random() * 200,
    espDischargePressure: 2100 + Math.random() * 300,
    wellheadTemp: 65 + Math.random() * 20,
    chokePosition: 60 + Math.random() * 30,
    protocol: "SIMULATED",
    quality: 85,
    recordedAt: new Date().toISOString(),
  };
}

// SSE endpoint — requires valid session cookie (IEC 62443 SR 2.1)
sseRouter.get("/api/telemetry/stream", async (req: Request, res: Response) => {
  // Authenticate before establishing the stream
  let user: { openId: string; name: string | null } | null = null;
  try {
    user = await sdk.authenticateRequest(req);
  } catch {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const wellId = (req.query.wellId as string) || "*";

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
  res.flushHeaders();

  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({ type: "connected", wellId, user: user.name, ts: Date.now() })}\n\n`);

  addClient(wellId, res);

  // Clean up on client disconnect
  req.on("close", () => {
    removeClient(wellId, res);
  });
});

// Track last seen telemetry timestamps to detect new readings
const lastTelemetryId = new Map<string, number>();

// Polling loop — runs every 5 seconds
async function pollAndBroadcast() {
  if (clients.size === 0) return; // No clients connected, skip

  const db = await getDb();

  // Get all wellIds being watched
  const watchedWells = new Set<string>();
  Array.from(clients.keys()).forEach(wellId => {
    if (wellId !== "*") watchedWells.add(wellId);
  });

  // If wildcard subscribers exist, we need to poll all active wells
  if (clients.has("*")) {
    // Broadcast heartbeat to all wildcard clients
    const heartbeat = JSON.stringify({ type: "heartbeat", ts: Date.now() });
    clients.get("*")?.forEach(res => {
      try { res.write(`data: ${heartbeat}\n\n`); } catch { /* disconnected */ }
    });
  }

  if (!db) {
    // No DB — notify clients that telemetry is unavailable
    Array.from(clients.keys()).forEach(wellId => {
      if (wellId === "*") return;
      sendToClients(wellId, { type: "error", wellId, message: "Database unavailable" });
    });
    return;
  }

  // Poll DB for each watched well
  for (const wellId of Array.from(watchedWells)) {
    try {
      // Get latest telemetry reading
      const [latest] = await db.select()
        .from(telemetryReadings)
        .where(eq(telemetryReadings.wellId, wellId))
        .orderBy(desc(telemetryReadings.recordedAt))
        .limit(1);

      if (latest) {
        const lastId = lastTelemetryId.get(wellId) ?? 0;
        if (latest.id > lastId) {
          lastTelemetryId.set(wellId, latest.id);
          sendToClients(wellId, { type: "telemetry", wellId, data: latest });
        }
      }

      // Get active unacknowledged alarms for this well
      const activeAlarms = await db.select()
        .from(alarms)
        .where(eq(alarms.wellId, wellId))
        .limit(10);

      const unacked = activeAlarms.filter(a => a.state === "UNACKNOWLEDGED");
      if (unacked.length > 0) {
        sendToClients(wellId, { type: "alarms", wellId, data: unacked, count: unacked.length });
      }
    } catch (err) {
      console.warn(`[SSE] Poll error for well ${wellId}:`, err);
    }
  }
}

// Start polling loop
setInterval(pollAndBroadcast, 5000);

export function broadcastTelemetry(wellId: string, data: object) {
  sendToClients(wellId, { type: "telemetry", wellId, data });
}

export function broadcastAlarm(wellId: string, alarm: object) {
  sendToClients(wellId, { type: "alarm", wellId, data: alarm });
}

// ── Redis Pub/Sub integration ─────────────────────────────────────────────────
// Subscribe to Redis alarm channels and broadcast to SSE clients immediately
// This eliminates the 5-second polling delay for alarm events.

function initRedisSubscriptions() {
  const sub = getSubClient();
  if (!sub) {
    console.info("[SSE] Redis unavailable — using polling-only mode");
    return;
  }

  const channels = [
    "og-rmm:alarm:created",
    "og-rmm:alarm:acknowledged",
    "og-rmm:alarm:cleared",
    "og-rmm:telemetry",
    "og-rmm:well:status",
  ];

  const doSubscribe = () => {
    sub.subscribe(...channels).then(() => {
      console.info(`[SSE] Subscribed to Redis channels: ${channels.join(", ")}`);
    }).catch((err: Error) => {
      console.warn("[SSE] Redis subscribe failed:", err.message);
    });
  };

  // If already connected, subscribe immediately; otherwise wait for connect event
  if ((sub as { status?: string }).status === "ready") {
    doSubscribe();
  } else {
    sub.once("ready", doSubscribe);
    sub.once("error", () => {
      console.info("[SSE] Redis sub-client error — using polling-only mode");
    });
  }

  sub.on("message", (channel: string, message: string) => {
    try {
      const payload = JSON.parse(message);
      const wellId = payload.wellId ?? "*";

      switch (channel) {
        case "og-rmm:alarm:created":
          // Broadcast to the specific well and all wildcard subscribers
          sendToClients(wellId, { type: "alarm", wellId, data: payload, event: "created" });
          sendToClients("*", { type: "alarm", wellId, data: payload, event: "created" });
          break;
        case "og-rmm:alarm:acknowledged":
          sendToClients(wellId, { type: "alarm_ack", wellId, data: payload });
          sendToClients("*", { type: "alarm_ack", wellId, data: payload });
          break;
        case "og-rmm:alarm:cleared":
          sendToClients(wellId, { type: "alarm_cleared", wellId, data: payload });
          sendToClients("*", { type: "alarm_cleared", wellId, data: payload });
          break;
        case "og-rmm:telemetry":
          sendToClients(wellId, { type: "telemetry", wellId, data: payload });
          break;
        case "og-rmm:well:status":
          sendToClients("*", { type: "well_status", wellId, data: payload });
          break;
      }
    } catch (err) {
      console.warn("[SSE] Redis message parse error:", err);
    }
  });
}

// Initialize Redis subscriptions after a short delay to allow server startup
setTimeout(initRedisSubscriptions, 2000);
