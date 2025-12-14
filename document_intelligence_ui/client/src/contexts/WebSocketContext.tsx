import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/_core/hooks/useAuth";

interface DocumentStatusUpdate {
  documentId: number;
  status: string;
  timestamp: string;
  confidence?: number;
  processingTimeMs?: number;
  error?: string;
}

interface BatchProgressUpdate {
  batchId: number;
  completedFiles: number;
  failedFiles: number;
  totalFiles: number;
  status: string;
  timestamp: string;
}

interface WebSocketContextType {
  socket: Socket | null;
  connected: boolean;
  subscribeToDocument: (documentId: number) => void;
  unsubscribeFromDocument: (documentId: number) => void;
  subscribeToBatch: (batchId: number) => void;
  unsubscribeFromBatch: (batchId: number) => void;
  onDocumentStatus: (callback: (data: DocumentStatusUpdate) => void) => () => void;
  onBatchProgress: (callback: (data: BatchProgressUpdate) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const { isAuthenticated } = useAuth();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;
  const baseReconnectDelay = 1000; // 1 second

  // Initialize socket connection
  useEffect(() => {
    if (!isAuthenticated) {
      // Disconnect if not authenticated
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    // Create socket connection
    const newSocket = io({
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: baseReconnectDelay,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      withCredentials: true,
    });

    newSocket.on("connect", () => {
      console.log("[WebSocket] Connected");
      setConnected(true);
      reconnectAttemptsRef.current = 0;
    });

    newSocket.on("disconnect", (reason) => {
      console.log("[WebSocket] Disconnected:", reason);
      setConnected(false);

      // Handle manual reconnection for certain disconnect reasons
      if (reason === "io server disconnect" || reason === "io client disconnect") {
        // Server disconnected or client manually disconnected, don't auto-reconnect
        return;
      }

      // Implement exponential backoff for reconnection
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        const delay = Math.min(
          baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current),
          5000
        );
        
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }

        reconnectTimeoutRef.current = setTimeout(() => {
          console.log(`[WebSocket] Attempting to reconnect (${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
          reconnectAttemptsRef.current++;
          newSocket.connect();
        }, delay);
      }
    });

    newSocket.on("connect_error", (error) => {
      console.error("[WebSocket] Connection error:", error.message);
      setConnected(false);
    });

    newSocket.on("error", (error) => {
      console.error("[WebSocket] Socket error:", error);
    });

    // Ping-pong for connection health check
    const pingInterval = setInterval(() => {
      if (newSocket.connected) {
        newSocket.emit("ping");
      }
    }, 30000); // Ping every 30 seconds

    newSocket.on("pong", () => {
      // Connection is healthy
    });

    setSocket(newSocket);

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      clearInterval(pingInterval);
      newSocket.disconnect();
    };
  }, [isAuthenticated]);

  // Subscribe to document updates
  const subscribeToDocument = useCallback((documentId: number) => {
    if (socket && connected) {
      socket.emit("subscribe:document", documentId);
    }
  }, [socket, connected]);

  // Unsubscribe from document updates
  const unsubscribeFromDocument = useCallback((documentId: number) => {
    if (socket && connected) {
      socket.emit("unsubscribe:document", documentId);
    }
  }, [socket, connected]);

  // Subscribe to batch updates
  const subscribeToBatch = useCallback((batchId: number) => {
    if (socket && connected) {
      socket.emit("subscribe:batch", batchId);
    }
  }, [socket, connected]);

  // Unsubscribe from batch updates
  const unsubscribeFromBatch = useCallback((batchId: number) => {
    if (socket && connected) {
      socket.emit("unsubscribe:batch", batchId);
    }
  }, [socket, connected]);

  // Listen to document status updates
  const onDocumentStatus = useCallback((callback: (data: DocumentStatusUpdate) => void) => {
    if (!socket) return () => {};

    socket.on("document:status", callback);

    return () => {
      socket.off("document:status", callback);
    };
  }, [socket]);

  // Listen to batch progress updates
  const onBatchProgress = useCallback((callback: (data: BatchProgressUpdate) => void) => {
    if (!socket) return () => {};

    socket.on("batch:progress", callback);

    return () => {
      socket.off("batch:progress", callback);
    };
  }, [socket]);

  const value: WebSocketContextType = {
    socket,
    connected,
    subscribeToDocument,
    unsubscribeFromDocument,
    subscribeToBatch,
    unsubscribeFromBatch,
    onDocumentStatus,
    onBatchProgress,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
}
