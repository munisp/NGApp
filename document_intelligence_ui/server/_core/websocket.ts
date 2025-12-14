import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import { IncomingMessage } from "http";
import { sdk } from "./sdk";

/**
 * WebSocket server for real-time notifications
 * Handles OCR processing status updates, batch progress, and system notifications
 */

export interface WebSocketServer {
  io: SocketIOServer;
  notifyDocumentStatus: (userId: number, documentId: number, status: string, data?: any) => void;
  notifyBatchProgress: (userId: number, batchId: number, progress: any) => void;
  notifyUser: (userId: number, event: string, data: any) => void;
}

export function setupWebSocket(server: HTTPServer): WebSocketServer {
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.NODE_ENV === "development" 
        ? ["http://localhost:3000", "http://localhost:5173"]
        : true,
      credentials: true,
    },
    path: "/api/socket.io",
    transports: ["websocket", "polling"],
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      // Create a mock request object for SDK authentication
      const mockReq = {
        headers: socket.handshake.headers,
        cookies: socket.handshake.headers.cookie,
      } as any;

      const user = await sdk.authenticateRequest(mockReq);
      
      if (!user) {
        return next(new Error("Authentication required"));
      }

      // Attach user info to socket
      socket.data.openId = user.openId;
      socket.data.userId = user.id;
      socket.data.user = user;

      next();
    } catch (error) {
      console.error("[WebSocket] Authentication error:", error);
      next(new Error("Authentication failed"));
    }
  });

  // Connection handling
  io.on("connection", (socket) => {
    const userId = socket.data.userId;
    console.log(`[WebSocket] User ${userId} connected (socket: ${socket.id})`);

    // Join user-specific room for targeted notifications
    socket.join(`user:${userId}`);

    // Handle client ping for connection health
    socket.on("ping", () => {
      socket.emit("pong");
    });

    // Handle subscription to specific document updates
    socket.on("subscribe:document", (documentId: number) => {
      socket.join(`document:${documentId}`);
      console.log(`[WebSocket] User ${userId} subscribed to document ${documentId}`);
    });

    // Handle subscription to batch updates
    socket.on("subscribe:batch", (batchId: number) => {
      socket.join(`batch:${batchId}`);
      console.log(`[WebSocket] User ${userId} subscribed to batch ${batchId}`);
    });

    // Handle unsubscribe
    socket.on("unsubscribe:document", (documentId: number) => {
      socket.leave(`document:${documentId}`);
    });

    socket.on("unsubscribe:batch", (batchId: number) => {
      socket.leave(`batch:${batchId}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(`[WebSocket] User ${userId} disconnected (${reason})`);
    });

    socket.on("error", (error) => {
      console.error(`[WebSocket] Socket error for user ${userId}:`, error);
    });
  });

  // Helper functions to emit notifications
  const notifyDocumentStatus = (
    userId: number,
    documentId: number,
    status: string,
    data?: any
  ) => {
    const payload = {
      documentId,
      status,
      timestamp: new Date().toISOString(),
      ...data,
    };

    // Send to user room
    io.to(`user:${userId}`).emit("document:status", payload);
    
    // Send to document-specific room
    io.to(`document:${documentId}`).emit("document:status", payload);

    console.log(`[WebSocket] Notified user ${userId} about document ${documentId} status: ${status}`);
  };

  const notifyBatchProgress = (
    userId: number,
    batchId: number,
    progress: any
  ) => {
    const payload = {
      batchId,
      timestamp: new Date().toISOString(),
      ...progress,
    };

    // Send to user room
    io.to(`user:${userId}`).emit("batch:progress", payload);
    
    // Send to batch-specific room
    io.to(`batch:${batchId}`).emit("batch:progress", payload);

    console.log(`[WebSocket] Notified user ${userId} about batch ${batchId} progress`);
  };

  const notifyUser = (userId: number, event: string, data: any) => {
    io.to(`user:${userId}`).emit(event, {
      timestamp: new Date().toISOString(),
      ...data,
    });

    console.log(`[WebSocket] Sent event '${event}' to user ${userId}`);
  };

  return {
    io,
    notifyDocumentStatus,
    notifyBatchProgress,
    notifyUser,
  };
}

// Global WebSocket server instance
let wsServer: WebSocketServer | null = null;

export function initializeWebSocket(server: HTTPServer): WebSocketServer {
  if (wsServer) {
    return wsServer;
  }
  wsServer = setupWebSocket(server);
  return wsServer;
}

export function getWebSocketServer(): WebSocketServer | null {
  return wsServer;
}
