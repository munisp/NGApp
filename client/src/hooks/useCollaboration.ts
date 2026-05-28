/**
 * useCollaboration — Real-time multi-user collaboration hook
 *
 * Connects to the WebSocket server at /api/collab?wellId=...
 * Manages:
 *   - Presence list (who is in the room)
 *   - Remote cursor positions (SVG overlay)
 *   - Parameter sync (slider changes broadcast to all users)
 *   - Connection state (connecting / connected / disconnected)
 */

import { useEffect, useRef, useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CollabUser {
  userId: string;
  userName: string;
  color: string;
  cursor?: { x: number; y: number };
  joinedAt: number;
}

export type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

export interface CollabState {
  connectionState: ConnectionState;
  users: CollabUser[];
  remoteParams: Record<string, Record<string, number | string>>;
}

export interface CollabActions {
  sendCursorMove: (x: number, y: number) => void;
  sendParamUpdate: (tab: string, key: string, value: number | string) => void;
  disconnect: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

const USER_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316", "#ec4899",
];

function generateUserId(): string {
  return `user-${Math.random().toString(36).slice(2, 9)}`;
}

function getStoredUserId(): string {
  const stored = localStorage.getItem("collab_user_id");
  if (stored) return stored;
  const id = generateUserId();
  localStorage.setItem("collab_user_id", id);
  return id;
}

export function useCollaboration(
  wellId: string,
  userName: string,
  enabled: boolean = true
): CollabState & CollabActions {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const userId = useRef(getStoredUserId());
  const mountedRef = useRef(true);

  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [users, setUsers] = useState<CollabUser[]>([]);
  const [remoteParams, setRemoteParams] = useState<Record<string, Record<string, number | string>>>({});

  const connect = useCallback(() => {
    if (!enabled || !wellId) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionState("connecting");

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const url = `${protocol}//${host}/api/collab?wellId=${encodeURIComponent(wellId)}&userId=${encodeURIComponent(userId.current)}&userName=${encodeURIComponent(userName)}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setConnectionState("connected");
      // Start ping interval to keep connection alive
      pingTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 25_000);
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case "room_state":
            setUsers(msg.users ?? []);
            setRemoteParams(msg.params ?? {});
            break;
          case "presence":
            setUsers(msg.users ?? []);
            break;
          case "cursor_move":
            setUsers(prev => prev.map(u =>
              u.userId === msg.userId
                ? { ...u, cursor: { x: msg.x, y: msg.y } }
                : u
            ));
            break;
          case "param_update":
            if (msg.userId !== userId.current) {
              setRemoteParams(prev => ({
                ...prev,
                [msg.tab]: { ...(prev[msg.tab] ?? {}), [msg.key]: msg.value },
              }));
            }
            break;
          case "join":
          case "leave":
            // Presence update will follow immediately
            break;
          default:
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnectionState("disconnected");
      if (pingTimer.current) clearInterval(pingTimer.current);
      // Auto-reconnect after 3 seconds
      reconnectTimer.current = setTimeout(() => {
        if (mountedRef.current && enabled) connect();
      }, 3_000);
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      setConnectionState("error");
    };
  }, [wellId, userName, enabled]);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled) connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (pingTimer.current) clearInterval(pingTimer.current);
      wsRef.current?.close();
    };
  }, [connect, enabled]);

  // Reconnect when wellId changes
  useEffect(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
  }, [wellId]);

  const sendCursorMove = useCallback((x: number, y: number) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "cursor_move", wellId, userId: userId.current, x, y }));
    }
  }, [wellId]);

  const sendParamUpdate = useCallback((tab: string, key: string, value: number | string) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "param_update", wellId, userId: userId.current, tab, key, value }));
    }
  }, [wellId]);

  const disconnect = useCallback(() => {
    mountedRef.current = false;
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    if (pingTimer.current) clearInterval(pingTimer.current);
    wsRef.current?.close();
    setConnectionState("disconnected");
  }, []);

  return {
    connectionState,
    users,
    remoteParams,
    sendCursorMove,
    sendParamUpdate,
    disconnect,
  };
}
