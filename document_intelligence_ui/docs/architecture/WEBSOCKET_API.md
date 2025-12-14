# WebSocket API Documentation

This document describes the real-time WebSocket API for the Document Intelligence Platform UI.

## Overview

The WebSocket server provides real-time notifications for OCR processing status updates, batch progress tracking, and system notifications. It uses Socket.IO for reliable bidirectional communication with automatic reconnection support.

## Connection

**Endpoint**: `/api/socket.io`

**Transports**: WebSocket (primary), Polling (fallback)

**Authentication**: Session cookie-based authentication (same as HTTP API)

### Client Connection Example

```typescript
import { io } from "socket.io-client";

const socket = io({
  path: "/api/socket.io",
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  withCredentials: true,
});

socket.on("connect", () => {
  console.log("Connected to WebSocket server");
});

socket.on("disconnect", (reason) => {
  console.log("Disconnected:", reason);
});
```

## Authentication

All WebSocket connections require authentication via session cookie. The server validates the session token on connection and attaches user information to the socket.

**Authentication Flow:**
1. Client connects with session cookie
2. Server validates session token using SDK
3. User info attached to socket (`socket.data.userId`, `socket.data.openId`)
4. Client joins user-specific room (`user:{userId}`)

**Error Handling:**
- `Authentication required` - No session cookie provided
- `No session token` - Session cookie missing
- `Invalid session token` - Token verification failed
- `Authentication failed` - General authentication error

## Rooms

The server uses Socket.IO rooms for targeted message delivery:

- **User Room** (`user:{userId}`): All notifications for a specific user
- **Document Room** (`document:{documentId}`): Updates for a specific document
- **Batch Room** (`batch:{batchId}`): Updates for a specific batch

## Client Events (Emit)

### `ping`
Health check ping to verify connection.

**Payload**: None

**Response**: Server emits `pong`

**Example:**
```typescript
socket.emit("ping");
socket.on("pong", () => {
  console.log("Connection is healthy");
});
```

### `subscribe:document`
Subscribe to updates for a specific document.

**Payload**: `documentId` (number)

**Example:**
```typescript
socket.emit("subscribe:document", 123);
```

### `unsubscribe:document`
Unsubscribe from document updates.

**Payload**: `documentId` (number)

**Example:**
```typescript
socket.emit("unsubscribe:document", 123);
```

### `subscribe:batch`
Subscribe to updates for a specific batch.

**Payload**: `batchId` (number)

**Example:**
```typescript
socket.emit("subscribe:batch", 456);
```

### `unsubscribe:batch`
Unsubscribe from batch updates.

**Payload**: `batchId` (number)

**Example:**
```typescript
socket.emit("unsubscribe:batch", 456);
```

## Server Events (Listen)

### `connect`
Emitted when the client successfully connects to the server.

**Payload**: None

### `disconnect`
Emitted when the client disconnects from the server.

**Payload**: `reason` (string)

**Disconnect Reasons:**
- `io server disconnect` - Server forcibly disconnected the socket
- `io client disconnect` - Client manually disconnected
- `ping timeout` - Client didn't respond to ping in time
- `transport close` - Underlying transport closed
- `transport error` - Transport error occurred

### `connect_error`
Emitted when a connection attempt fails.

**Payload**: `error` (Error object)

### `document:status`
Emitted when a document's OCR processing status changes.

**Payload:**
```typescript
{
  documentId: number;
  status: "pending" | "processing" | "completed" | "failed";
  timestamp: string; // ISO 8601 format
  confidence?: number; // 0-100 (only for completed)
  processingTimeMs?: number; // milliseconds (only for completed)
  error?: string; // error message (only for failed)
}
```

**Example:**
```typescript
socket.on("document:status", (data) => {
  console.log(`Document ${data.documentId} status: ${data.status}`);
  
  if (data.status === "completed") {
    console.log(`Confidence: ${data.confidence}%`);
    console.log(`Processing time: ${data.processingTimeMs}ms`);
  } else if (data.status === "failed") {
    console.error(`Error: ${data.error}`);
  }
});
```

**Status Flow:**
1. `pending` → Document uploaded, queued for processing
2. `processing` → OCR analysis in progress
3. `completed` → OCR completed successfully
4. `failed` → OCR processing failed

### `batch:progress`
Emitted when batch processing progress updates.

**Payload:**
```typescript
{
  batchId: number;
  completedFiles: number;
  failedFiles: number;
  totalFiles: number;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  timestamp: string; // ISO 8601 format
}
```

**Example:**
```typescript
socket.on("batch:progress", (data) => {
  const progress = ((data.completedFiles + data.failedFiles) / data.totalFiles) * 100;
  console.log(`Batch ${data.batchId} progress: ${progress.toFixed(1)}%`);
  console.log(`Completed: ${data.completedFiles}, Failed: ${data.failedFiles}`);
});
```

**Status Flow:**
1. `pending` → Batch created, not yet started
2. `processing` → Files being processed
3. `completed` → All files processed successfully
4. `failed` → All files failed
5. `cancelled` → Batch cancelled by user

### `pong`
Response to `ping` event for connection health check.

**Payload**: None

## Frontend Integration

### Using the WebSocket Context

The application provides a React context for easy WebSocket integration:

```typescript
import { useWebSocket } from "@/contexts/WebSocketContext";
import { useEffect } from "react";

function MyComponent() {
  const { 
    connected, 
    subscribeToDocument, 
    unsubscribeFromDocument,
    onDocumentStatus 
  } = useWebSocket();

  useEffect(() => {
    if (!connected) return;

    // Subscribe to document updates
    const documentId = 123;
    subscribeToDocument(documentId);

    // Listen for status updates
    const unsubscribe = onDocumentStatus((data) => {
      if (data.documentId === documentId) {
        console.log("Status update:", data);
      }
    });

    // Cleanup
    return () => {
      unsubscribe();
      unsubscribeFromDocument(documentId);
    };
  }, [connected, subscribeToDocument, unsubscribeFromDocument, onDocumentStatus]);

  return (
    <div>
      Connection status: {connected ? "Connected" : "Disconnected"}
    </div>
  );
}
```

### Context API

**`useWebSocket()` Hook:**

Returns:
```typescript
{
  socket: Socket | null;
  connected: boolean;
  subscribeToDocument: (documentId: number) => void;
  unsubscribeFromDocument: (documentId: number) => void;
  subscribeToBatch: (batchId: number) => void;
  unsubscribeFromBatch: (batchId: number) => void;
  onDocumentStatus: (callback: (data: DocumentStatusUpdate) => void) => () => void;
  onBatchProgress: (callback: (data: BatchProgressUpdate) => void) => () => void;
}
```

## Reconnection Strategy

The client implements exponential backoff for reconnection:

- **Max Attempts**: 10
- **Base Delay**: 1 second
- **Max Delay**: 5 seconds
- **Strategy**: `delay = min(baseDelay * 2^attempt, maxDelay)`

**Reconnection Sequence:**
1. Attempt 1: 1s delay
2. Attempt 2: 2s delay
3. Attempt 3: 4s delay
4. Attempt 4+: 5s delay (capped)

## Connection Health Check

The client sends periodic ping messages every 30 seconds to verify connection health:

```typescript
setInterval(() => {
  if (socket.connected) {
    socket.emit("ping");
  }
}, 30000);

socket.on("pong", () => {
  // Connection is healthy
});
```

## Error Handling

### Connection Errors

```typescript
socket.on("connect_error", (error) => {
  console.error("Connection error:", error.message);
  // Show user notification
  toast.error("Failed to connect to real-time updates");
});
```

### Authentication Errors

```typescript
socket.on("error", (error) => {
  console.error("Socket error:", error);
  if (error.message.includes("Authentication")) {
    // Redirect to login
    window.location.href = getLoginUrl();
  }
});
```

### Disconnect Handling

```typescript
socket.on("disconnect", (reason) => {
  if (reason === "io server disconnect") {
    // Server forcibly disconnected, don't auto-reconnect
    toast.error("Disconnected by server");
  } else {
    // Automatic reconnection will be attempted
    toast.info("Connection lost, reconnecting...");
  }
});
```

## Best Practices

### 1. Subscribe Only When Needed

Subscribe to specific documents/batches only when viewing them:

```typescript
useEffect(() => {
  if (!documentId || !connected) return;
  
  subscribeToDocument(documentId);
  return () => unsubscribeFromDocument(documentId);
}, [documentId, connected]);
```

### 2. Clean Up Listeners

Always clean up event listeners to prevent memory leaks:

```typescript
useEffect(() => {
  const unsubscribe = onDocumentStatus(handleStatus);
  return unsubscribe; // Cleanup on unmount
}, [onDocumentStatus]);
```

### 3. Handle Connection State

Check connection state before subscribing:

```typescript
if (connected) {
  subscribeToDocument(documentId);
}
```

### 4. Combine with Query Invalidation

Invalidate tRPC queries when receiving updates:

```typescript
const utils = trpc.useUtils();

onDocumentStatus((data) => {
  utils.documents.getById.invalidate({ id: data.documentId });
});
```

### 5. Show User Feedback

Display toast notifications for important events:

```typescript
onDocumentStatus((data) => {
  if (data.status === "completed") {
    toast.success("Document processed successfully");
  } else if (data.status === "failed") {
    toast.error("Processing failed", { description: data.error });
  }
});
```

## Server-Side API

### Emitting Notifications

The server provides helper functions for emitting notifications:

```typescript
import { getWebSocketServer } from "./_core/websocket";

const wsServer = getWebSocketServer();

if (wsServer) {
  // Notify document status change
  wsServer.notifyDocumentStatus(
    userId,
    documentId,
    "completed",
    { confidence: 95, processingTimeMs: 425 }
  );

  // Notify batch progress
  wsServer.notifyBatchProgress(
    userId,
    batchId,
    {
      completedFiles: 5,
      failedFiles: 1,
      totalFiles: 10,
      status: "processing",
    }
  );

  // Send custom notification
  wsServer.notifyUser(userId, "custom:event", { data: "value" });
}
```

## Security Considerations

1. **Authentication Required**: All connections must be authenticated
2. **User Isolation**: Users only receive notifications for their own data
3. **Room-Based Access**: Subscriptions are validated against user ownership
4. **Rate Limiting**: Consider implementing rate limiting for subscriptions
5. **Input Validation**: All event payloads should be validated

## Troubleshooting

### Connection Fails

- Check that session cookie is present and valid
- Verify CORS settings allow credentials
- Check network connectivity

### No Notifications Received

- Verify subscription to correct document/batch ID
- Check connection status (`connected === true`)
- Ensure user has access to the resource
- Check browser console for errors

### Frequent Disconnections

- Check network stability
- Verify server is running and accessible
- Check for firewall or proxy issues
- Review server logs for errors

## Performance Considerations

- **Connection Pooling**: Socket.IO reuses connections efficiently
- **Binary Support**: Socket.IO supports binary data for large payloads
- **Compression**: Enable compression for large messages
- **Batching**: Group multiple updates when possible
- **Throttling**: Implement client-side throttling for high-frequency updates

## Monitoring

Monitor WebSocket health using:

```typescript
// Connection metrics
socket.on("connect", () => {
  console.log("[Metrics] Connected at", new Date().toISOString());
});

socket.on("disconnect", (reason) => {
  console.log("[Metrics] Disconnected:", reason);
});

// Message metrics
socket.onAny((event, ...args) => {
  console.log("[Metrics] Event received:", event, args);
});
```

## Future Enhancements

- [ ] Add typing indicators for collaborative features
- [ ] Implement presence tracking (online/offline users)
- [ ] Add message acknowledgments for critical updates
- [ ] Implement message queuing for offline clients
- [ ] Add compression for large payloads
- [ ] Implement rate limiting per user
- [ ] Add WebSocket metrics dashboard
