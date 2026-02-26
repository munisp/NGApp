"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface WebSocketOptions {
  url: string;
  onMessage?: (data: unknown) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxRetries?: number;
}

export function useWebSocket({
  url,
  onMessage,
  onOpen,
  onClose,
  onError,
  reconnect = true,
  reconnectInterval = 3000,
  maxRetries = 10,
}: WebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        setIsConnected(true);
        retriesRef.current = 0;
        onOpen?.();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage?.(data);
        } catch {
          onMessage?.(event.data);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        onClose?.();
        if (reconnect && retriesRef.current < maxRetries) {
          retriesRef.current++;
          setTimeout(connect, reconnectInterval);
        }
      };

      ws.onerror = (error) => {
        onError?.(error);
      };

      wsRef.current = ws;
    } catch {
      if (reconnect && retriesRef.current < maxRetries) {
        retriesRef.current++;
        setTimeout(connect, reconnectInterval);
      }
    }
  }, [url, onMessage, onOpen, onClose, onError, reconnect, reconnectInterval, maxRetries]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === "string" ? data : JSON.stringify(data));
    }
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { isConnected, send, disconnect };
}
