/**
 * Real-time Collaboration WebSocket Server
 *
 * Architecture:
 *   - One WebSocket room per well (identified by wellId)
 *   - Messages: join, leave, cursor_move, param_update, presence
 *   - Last-write-wins merge for parameter updates
 *   - Presence list broadcast on join/leave
 *
 * Client connects to: ws://host/api/collab?wellId=WELL-001&userId=xxx&userName=xxx
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { COOKIE_NAME } from "@shared/const";
import cookie from "cookie";
// ── Types ─────────────────────────────────────────────────────────────────────

export interface CollabUser {
  userId: string;
  userName: string;
  color: string;
  cursor?: { x: number; y: number };
  joinedAt: number;
}

export interface CollabRoom {
  wellId: string;
  users: Map<string, CollabUser>;
  params: Record<string, Record<string, number | string>>; // tabId -> paramKey -> value
  lastActivity: number;
}

export type CollabMessage =
  | { type: "join"; wellId: string; userId: string; userName: string }
  | { type: "leave"; wellId: string; userId: string }
  | { type: "cursor_move"; wellId: string; userId: string; x: number; y: number }
  | { type: "param_update"; wellId: string; userId: string; tab: string; key: string; value: number | string }
  | { type: "presence"; users: CollabUser[] }
  | { type: "room_state"; params: Record<string, Record<string, number | string>>; users: CollabUser[] }
  | { type: "error"; message: string }
  | { type: "ping" }
  | { type: "pong" };

// ── Room Registry ─────────────────────────────────────────────────────────────

const rooms = new Map<string, CollabRoom>();
const clientRooms = new Map<WebSocket, { wellId: string; userId: string }>();

const USER_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316", "#ec4899",
];

function getOrCreateRoom(wellId: string): CollabRoom {
  if (!rooms.has(wellId)) {
    rooms.set(wellId, {
      wellId,
      users: new Map(),
      params: {},
      lastActivity: Date.now(),
    });
  }
  return rooms.get(wellId)!;
}

function broadcastToRoom(wellId: string, message: CollabMessage, exclude?: WebSocket) {
  const payload = JSON.stringify(message);
    for (const [ws, meta] of Array.from(clientRooms.entries())) {
    if (meta.wellId === wellId && ws !== exclude && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function broadcastPresence(wellId: string) {
  const room = rooms.get(wellId);
  if (!room) return;
  const users = Array.from(room.users.values());
  broadcastToRoom(wellId, { type: "presence", users });
}

function assignColor(wellId: string, userId: string): string {
  const room = getOrCreateRoom(wellId);
  const existingColors = new Set(Array.from(room.users.values()).map(u => u.color));
  const available = USER_COLORS.filter(c => !existingColors.has(c));
  if (available.length > 0) return available[0];
  // Cycle through colors if all taken
  const idx = room.users.size % USER_COLORS.length;
  return USER_COLORS[idx];
}

// ── WebSocket Server ──────────────────────────────────────────────────────────

export function attachCollaborationWS(httpServer: Server) {
  const wss = new WebSocketServer({
    server: httpServer,
    path: "/api/collab",
  });

  wss.on("connection", (ws, req) => {
    // Verify session cookie for WebSocket authentication
    const cookies = cookie.parse(req.headers.cookie ?? "");
    const sessionToken = cookies[COOKIE_NAME];
    if (!sessionToken && process.env.NODE_ENV === "production") {
      ws.close(4001, "Authentication required");
      return;
    }

    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const wellId = url.searchParams.get("wellId") ?? "WELL-001";
    const userId = url.searchParams.get("userId") ?? `user-${Date.now()}`;
    const userName = decodeURIComponent(url.searchParams.get("userName") ?? "Anonymous");

    // Register client
    clientRooms.set(ws, { wellId, userId });
    const room = getOrCreateRoom(wellId);
    const color = assignColor(wellId, userId);

    const user: CollabUser = {
      userId,
      userName,
      color,
      joinedAt: Date.now(),
    };
    room.users.set(userId, user);
    room.lastActivity = Date.now();

    // Send current room state to the new joiner
    ws.send(JSON.stringify({
      type: "room_state",
      params: room.params,
      users: Array.from(room.users.values()),
    } satisfies CollabMessage));

    // Broadcast join to others
    broadcastToRoom(wellId, { type: "join", wellId, userId, userName }, ws);
    broadcastPresence(wellId);

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString()) as CollabMessage;
        room.lastActivity = Date.now();

        switch (msg.type) {
          case "cursor_move": {
            const u = room.users.get(userId);
            if (u) u.cursor = { x: msg.x, y: msg.y };
            broadcastToRoom(wellId, { ...msg, userId }, ws);
            break;
          }
          case "param_update": {
            if (!room.params[msg.tab]) room.params[msg.tab] = {};
            room.params[msg.tab][msg.key] = msg.value;
            broadcastToRoom(wellId, { ...msg, userId }, ws);
            break;
          }
          case "ping": {
            ws.send(JSON.stringify({ type: "pong" } satisfies CollabMessage));
            break;
          }
          default:
            break;
        }
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid message format" } satisfies CollabMessage));
      }
    });

    ws.on("close", () => {
      room.users.delete(userId);
      clientRooms.delete(ws);
      broadcastToRoom(wellId, { type: "leave", wellId, userId });
      broadcastPresence(wellId);
      // Clean up empty rooms after 5 minutes
      if (room.users.size === 0) {
        setTimeout(() => {
          if (rooms.get(wellId)?.users.size === 0) {
            rooms.delete(wellId);
          }
        }, 5 * 60 * 1000);
      }
    });

    ws.on("error", (err) => {
      console.error(`[Collab WS] Error for user ${userId} in room ${wellId}:`, err.message);
    });
  });

  // Heartbeat: ping all clients every 30s to detect stale connections
  const heartbeat = setInterval(() => {
    for (const ws of Array.from(wss.clients)) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }
  }, 30_000);

  wss.on("close", () => clearInterval(heartbeat));

  console.log("[Collab WS] Real-time collaboration WebSocket server attached at /api/collab");
  return wss;
}

// ── Room Stats (for tRPC procedure) ──────────────────────────────────────────

export function getCollabRoomStats() {
  return Array.from(rooms.values()).map(r => ({
    wellId: r.wellId,
    userCount: r.users.size,
    users: Array.from(r.users.values()),
    lastActivity: r.lastActivity,
  }));
}

export function getCollabRoom(wellId: string) {
  const room = rooms.get(wellId);
  if (!room) return null;
  return {
    wellId: room.wellId,
    userCount: room.users.size,
    users: Array.from(room.users.values()),
    params: room.params,
    lastActivity: room.lastActivity,
  };
}
