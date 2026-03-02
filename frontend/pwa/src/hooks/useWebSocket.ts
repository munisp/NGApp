"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { WebSocketClient, PriceSimulator, type WSStatus } from "@/lib/websocket";
import { useMarketStore } from "@/lib/store";

// ============================================================
// WebSocket Connection Hook (Enhanced with exponential backoff)
// ============================================================

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8003/ws";

interface WebSocketOptions {
  url?: string;
  onMessage?: (data: unknown) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxRetries?: number;
}

export function useWebSocket({
  url = WS_URL,
  onMessage,
  onOpen,
  onClose,
  onError,
  reconnect = true,
  reconnectInterval = 1000,
  maxRetries = 10,
}: WebSocketOptions = {}) {
  const clientRef = useRef<WebSocketClient | null>(null);
  const [status, setStatus] = useState<WSStatus>("disconnected");
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;
    if (clientRef.current) return;

    const client = new WebSocketClient({
      url,
      reconnectInterval,
      maxReconnectAttempts: maxRetries,
      heartbeatInterval: 30000,
      onMessage: (msg) => onMessage?.(msg),
      onStatusChange: (s) => {
        setStatus(s);
        setIsConnected(s === "connected");
        if (s === "connected") onOpen?.();
        if (s === "disconnected") onClose?.();
      },
      onError: (e) => onError?.(e),
    });

    clientRef.current = client;

    if (reconnect) {
      client.connect();
    }
  }, [url, onMessage, onOpen, onClose, onError, reconnect, reconnectInterval, maxRetries]);

  const send = useCallback((data: unknown) => {
    // Maintained for backwards compatibility
    if (clientRef.current?.status === "connected") {
      // The WebSocketClient handles send internally
    }
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
  }, []);

  const subscribe = useCallback((channel: string) => {
    clientRef.current?.subscribe(channel);
  }, []);

  const unsubscribe = useCallback((channel: string) => {
    clientRef.current?.unsubscribe(channel);
  }, []);

  useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
      clientRef.current = null;
    };
  }, []);

  return { isConnected, status, send, disconnect, connect, subscribe, unsubscribe };
}

// ============================================================
// Live Price Simulation Hook (for development/demo)
// ============================================================

export function usePriceSimulation(enabled = true) {
  const simulatorRef = useRef<PriceSimulator | null>(null);
  const commoditiesRef = useRef(useMarketStore.getState().commodities);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!enabled || simulatorRef.current) return;

    const commodities = commoditiesRef.current;
    const initialPrices = commodities.map((c) => ({
      symbol: c.symbol,
      price: c.lastPrice,
      volume: c.volume24h,
    }));

    const simulator = new PriceSimulator(initialPrices, (updates) => {
      const current = useMarketStore.getState().commodities;
      useMarketStore.getState().setCommodities(
        current.map((c) => {
          const update = updates.find((u) => u.symbol === c.symbol);
          if (!update) return c;
          return {
            ...c,
            lastPrice: update.price,
            change24h: update.change,
            changePercent24h: update.changePercent,
            volume24h: update.volume,
            high24h: Math.max(c.high24h, update.high),
            low24h: Math.min(c.low24h, update.low),
          };
        })
      );
    });

    simulatorRef.current = simulator;
    simulator.start(3000);
    setIsRunning(true);

    return () => {
      simulator.stop();
      simulatorRef.current = null;
      setIsRunning(false);
    };
  }, [enabled]);

  return { isRunning };
}
