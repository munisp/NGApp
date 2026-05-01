import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import {
  getDashboardStats,
  getSecurityAlerts,
  getNetworkEvents,
  getComplianceViolations,
  getOrganizations,
} from "./db";

let io: SocketIOServer | null = null;

// Event types pushed to clients
export type NdsepEvent =
  | { type: "dashboard_update"; payload: Awaited<ReturnType<typeof getDashboardStats>> }
  | { type: "new_alert"; payload: { id: number; title: string; severity: string; source: string; organizationId: number; detectedAt: Date } }
  | { type: "new_violation"; payload: { id: number; title: string; severity: string; organizationId: number; detectedAt: Date } }
  | { type: "new_network_event"; payload: { id: number; protocol: string | null; isBlocked: boolean | null; isCrossBorder: boolean | null; organizationId: number | null; detectedAt: Date } }
  | { type: "streaming_tick"; payload: { topic: string; key: string; partition: number; offset: number; latency: number; payloadJson: string; timestamp: string } }
  | { type: "org_score_update"; payload: { orgId: number; name: string; complianceScore: number; riskScore: number } }
  | { type: "org_portal_update"; payload: { submissionToken: string; orgName: string; newPhase: string; decision: string; notes?: string } }
  | { type: "penalty_issued"; payload: { orgId: number; orgName: string; penaltyId: number; amountUsd: number; reason: string } }
  | { type: "appeal_update"; payload: { orgId: number; orgName: string; appealId: number; decision: string; penaltyId: number } }
  | { type: "nip_settlement"; payload: { sessionId: string; senderBank: string; receiverBank: string; amountNgn: number; status: string; ts: number } }
  | { type: "fraud_alert_new"; payload: { id: number; transactionRef: string; alertType: string; riskScore: number; ts: number } }
  | { type: "kyc_tier_update"; payload: { tier: number; count: number; ts: number } }
  | { type: "sector_compliance_update"; payload: { sector: string; complianceRate: number; ts: number } };

const KAFKA_TOPICS = [
  "ndsep.assets.events",
  "ndsep.compliance.alerts",
  "ndsep.network.events",
  "ndsep.enforcement.actions",
  "ndsep.audit.trail",
  "ndsep.financial.penalties",
  "ndsep.ml.predictions",
] as const;

const TOPIC_SHORT: Record<string, string> = {
  "ndsep.assets.events": "EVENTS",
  "ndsep.compliance.alerts": "ALERTS",
  "ndsep.network.events": "EVENTS",
  "ndsep.enforcement.actions": "ACTIONS",
  "ndsep.audit.trail": "TRAIL",
  "ndsep.financial.penalties": "PENALTIES",
  "ndsep.ml.predictions": "PREDICTIONS",
};

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateStreamingPayload(topic: string): string {
  const orgId = randomInt(1, 20);
  switch (topic) {
    case "ndsep.assets.events":
      return JSON.stringify({ orgId, assetId: randomInt(100, 500), event: "scan_complete", isWithinBorders: Math.random() > 0.3 });
    case "ndsep.compliance.alerts":
      return JSON.stringify({ orgId, violationId: randomInt(50, 200), severity: ["critical", "high", "medium"][randomInt(0, 2)], policy: "data-residency-v2" });
    case "ndsep.network.events":
      return JSON.stringify({ orgId, sourceIp: `10.${randomInt(100, 200)}.${randomInt(1, 254)}.${randomInt(1, 254)}`, action: Math.random() > 0.2 ? "allowed" : "blocked", protocol: ["TCP", "UDP", "HTTPS", "DNS"][randomInt(0, 3)] });
    case "ndsep.enforcement.actions":
      return JSON.stringify({ orgId, workflowId: `WF-${Date.now()}`, actionType: ["fine", "restrict", "audit", "notice"][randomInt(0, 3)], status: "initiated" });
    case "ndsep.audit.trail":
      return JSON.stringify({ actorId: `user-${randomInt(1, 20)}`, action: ["read", "write", "delete", "export"][randomInt(0, 3)], resource: ["data_catalog", "compliance_report", "asset_inventory"][randomInt(0, 2)], result: "success" });
    case "ndsep.financial.penalties":
      return JSON.stringify({ orgId, amount: randomInt(10000, 500000), currency: "USD", status: "issued" });
    case "ndsep.ml.predictions":
      return JSON.stringify({ orgId, predictedRisk: (Math.random() * 100).toFixed(2), model: "risk-v3", confidence: (0.7 + Math.random() * 0.29).toFixed(3) });
    default:
      return JSON.stringify({ orgId, event: "unknown" });
  }
}

export function initWebSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000", "https://localhost:3000"],
      methods: ["GET", "POST"],
    },
    path: "/api/ws",
  });

  io.on("connection", (socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    // Send initial dashboard snapshot on connect
    getDashboardStats().then((stats) => {
      socket.emit("ndsep_event", { type: "dashboard_update", payload: stats } satisfies NdsepEvent);
    }).catch(() => {});

    socket.on("subscribe", (room: string) => {
      socket.join(room);
      console.log(`[WebSocket] ${socket.id} subscribed to ${room}`);
    });

    socket.on("unsubscribe", (room: string) => {
      socket.leave(room);
    });

    socket.on("disconnect", () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);
    });
  });

  // ── Real-time streaming tick (800ms) ──────────────────────────────────────
  setInterval(() => {
    if (!io || io.engine.clientsCount === 0) return;
    const topic = KAFKA_TOPICS[randomInt(0, KAFKA_TOPICS.length - 1)];
    const event: NdsepEvent = {
      type: "streaming_tick",
      payload: {
        topic: TOPIC_SHORT[topic] ?? "EVENTS",
        key: `org-${randomInt(1, 20)}`,
        partition: randomInt(0, 11),
        offset: randomInt(1, 999999),
        latency: randomInt(1, 50),
        payloadJson: generateStreamingPayload(topic),
        timestamp: new Date().toLocaleTimeString(),
      },
    };
    io.to("streaming").emit("ndsep_event", event);
    io.to("dashboard").emit("ndsep_event", event);
  }, 800);

  // ── Dashboard stats refresh (10s) ─────────────────────────────────────────
  setInterval(async () => {
    if (!io || io.engine.clientsCount === 0) return;
    try {
      const stats = await getDashboardStats();
      const event: NdsepEvent = { type: "dashboard_update", payload: stats };
      io.to("dashboard").emit("ndsep_event", event);
    } catch {}
  }, 10000);

  // ── New alert simulation (15s) ────────────────────────────────────────────
  setInterval(async () => {
    if (!io || io.engine.clientsCount === 0) return;
    try {
      const alerts = await getSecurityAlerts(3, false);
      if (alerts.length > 0) {
        const alert = alerts[randomInt(0, Math.min(2, alerts.length - 1))];
        const event: NdsepEvent = {
          type: "new_alert",
          payload: {
            id: alert.id,
            title: alert.title ?? "Unknown Alert",
            severity: alert.severity ?? "medium",
            source: alert.source ?? "unknown",
            organizationId: alert.organizationId ?? 0,
            detectedAt: alert.detectedAt,
          },
        };
        io.to("siem").emit("ndsep_event", event);
        io.to("dashboard").emit("ndsep_event", event);
      }
    } catch {}
  }, 15000);

  // ── New violation simulation (20s) ────────────────────────────────────────
  setInterval(async () => {
    if (!io || io.engine.clientsCount === 0) return;
    try {
      const violations = await getComplianceViolations(3);
      if (violations.length > 0) {
        const v = violations[randomInt(0, Math.min(2, violations.length - 1))];
        const event: NdsepEvent = {
          type: "new_violation",
          payload: {
            id: v.id,
            title: v.title,
            severity: v.severity ?? "medium",
            organizationId: v.organizationId,
            detectedAt: v.detectedAt,
          },
        };
        io.to("compliance").emit("ndsep_event", event);
        io.to("dashboard").emit("ndsep_event", event);
      }
    } catch {}
  }, 20000);

  // ── Network event simulation (5s) ─────────────────────────────────────────
  setInterval(async () => {
    if (!io || io.engine.clientsCount === 0) return;
    try {
      const events = await getNetworkEvents(3, false);
      if (events.length > 0) {
        const ev = events[randomInt(0, Math.min(2, events.length - 1))];
        const event: NdsepEvent = {
          type: "new_network_event",
          payload: {
            id: ev.id,
            protocol: ev.protocol,
            isBlocked: ev.isBlocked,
            isCrossBorder: ev.isCrossBorder,
            organizationId: ev.organizationId,
            detectedAt: ev.detectedAt,
          },
        };
        io.to("network").emit("ndsep_event", event);
      }
    } catch {}
  }, 5000);

  // -- Banking NIP settlement simulation (8s) ---------------------------------
  const BANKS = ["GTBank","Access Bank","Zenith Bank","UBA","First Bank","Fidelity Bank","Sterling Bank","Polaris Bank"];
  setInterval(() => {
    if (!io || io.engine.clientsCount === 0) return;
    const event: NdsepEvent = {
      type: "nip_settlement",
      payload: {
        sessionId: `NIP${Date.now()}`,
        senderBank: BANKS[randomInt(0, BANKS.length - 1)],
        receiverBank: BANKS[randomInt(0, BANKS.length - 1)],
        amountNgn: randomInt(5000, 5000000),
        status: Math.random() > 0.05 ? "settled" : "failed",
        ts: Date.now(),
      },
    };
    io.to("banking").emit("ndsep_event", event);
    io.to("dashboard").emit("ndsep_event", event);
  }, 8000);
  // -- Fraud alert simulation (15s) -------------------------------------------
  setInterval(() => {
    if (!io || io.engine.clientsCount === 0) return;
    if (Math.random() > 0.4) return;
    const event: NdsepEvent = {
      type: "fraud_alert_new",
      payload: {
        id: randomInt(1000, 9999),
        transactionRef: `TXN${Date.now()}`,
        alertType: ["velocity_breach","geo_anomaly","account_takeover","synthetic_identity"][randomInt(0, 3)],
        riskScore: randomInt(65, 99),
        ts: Date.now(),
      },
    };
    io.to("banking").emit("ndsep_event", event);
    io.to("dashboard").emit("ndsep_event", event);
  }, 15000);
  // -- Sector compliance pulse (30s) ------------------------------------------
  const SECTORS = ["Banking","Telecom","Healthcare","Energy","Insurance","Fintech"];
  setInterval(() => {
    if (!io || io.engine.clientsCount === 0) return;
    const event: NdsepEvent = {
      type: "sector_compliance_update",
      payload: {
        sector: SECTORS[randomInt(0, SECTORS.length - 1)],
        complianceRate: randomInt(55, 98),
        ts: Date.now(),
      },
    };
    io.to("dashboard").emit("ndsep_event", event);
  }, 30000);
  console.log("[WebSocket] Socket.io initialized on /api/ws");
  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

// Broadcast a custom event to all connected clients in a room
export function broadcast(room: string, event: NdsepEvent): void {
  if (io) {
    io.to(room).emit("ndsep_event", event);
  }
}

// Broadcast a raw event from Go/Python workers to all connected clients
export function broadcastEvent(event: string, data: unknown): void {
  if (io) {
    // Emit as worker_event for the Workers Dashboard
    io.emit("worker_event", { event, data, timestamp: new Date().toISOString() });
    // Also emit as ndsep_event for pages that subscribe to it
    const payload = typeof data === "object" && data !== null ? data : { payload: data };
    io.emit("ndsep_event", { type: event, ...(payload as object) });
  }
}
