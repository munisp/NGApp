/**
 * Resilient WebSocket Manager
 * Handles unreliable connections in low-bandwidth environments.
 * Features: auto-reconnect, exponential backoff, message queuing,
 * connection quality monitoring, and graceful degradation to HTTP polling.
 */

type MessageHandler = (data: unknown) => void;

interface WSConfig {
  url: string;
  maxReconnectAttempts: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  heartbeatIntervalMs: number;
  messageQueueSize: number;
  fallbackToPolling: boolean;
  pollingIntervalMs: number;
}

const DEFAULT_CONFIG: WSConfig = {
  url: `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`,
  maxReconnectAttempts: 20,
  initialBackoffMs: 1000,
  maxBackoffMs: 60000,
  heartbeatIntervalMs: 30000,
  messageQueueSize: 100,
  fallbackToPolling: true,
  pollingIntervalMs: 5000,
};

class ResilientWebSocket {
  private ws: WebSocket | null = null;
  private config: WSConfig;
  private reconnectAttempts = 0;
  private messageQueue: Array<{ topic: string; data: unknown }> = [];
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private isUsingPolling = false;
  private lastMessageTime = 0;
  private connectionQuality: "good" | "degraded" | "poor" | "offline" = "offline";

  constructor(config: Partial<WSConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(this.config.url);
      this.ws.onopen = this.onOpen.bind(this);
      this.ws.onmessage = this.onMessage.bind(this);
      this.ws.onclose = this.onClose.bind(this);
      this.ws.onerror = this.onError.bind(this);
    } catch {
      this.scheduleReconnect();
    }
  }

  private onOpen(): void {
    this.reconnectAttempts = 0;
    this.connectionQuality = "good";
    this.isUsingPolling = false;
    this.stopPolling();
    this.startHeartbeat();
    this.flushMessageQueue();
    this.notifyHandlers("connection", { status: "connected", quality: this.connectionQuality });
  }

  private onMessage(event: MessageEvent): void {
    this.lastMessageTime = Date.now();
    try {
      const message = JSON.parse(event.data);
      if (message.type === "pong") return; // Heartbeat response
      const topic = message.topic || "default";
      this.notifyHandlers(topic, message.data);
    } catch {
      // Non-JSON message
    }
  }

  private onClose(event: CloseEvent): void {
    this.stopHeartbeat();
    this.connectionQuality = "offline";
    this.notifyHandlers("connection", { status: "disconnected", code: event.code });

    if (!event.wasClean) {
      this.scheduleReconnect();
    }
  }

  private onError(): void {
    this.connectionQuality = "poor";
    this.notifyHandlers("connection", { status: "error", quality: this.connectionQuality });
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      if (this.config.fallbackToPolling) {
        this.startPollingFallback();
      }
      return;
    }

    const backoff = Math.min(
      this.config.initialBackoffMs * Math.pow(2, this.reconnectAttempts),
      this.config.maxBackoffMs
    );
    // Add jitter (±25%)
    const jitter = backoff * (0.75 + Math.random() * 0.5);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, jitter);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));

        // Check if last message was too long ago
        const timeSinceLastMessage = Date.now() - this.lastMessageTime;
        if (timeSinceLastMessage > this.config.heartbeatIntervalMs * 3) {
          this.connectionQuality = "poor";
        } else if (timeSinceLastMessage > this.config.heartbeatIntervalMs * 2) {
          this.connectionQuality = "degraded";
        } else {
          this.connectionQuality = "good";
        }
      }
    }, this.config.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private startPollingFallback(): void {
    if (this.isUsingPolling) return;
    this.isUsingPolling = true;
    this.notifyHandlers("connection", { status: "polling_fallback" });

    this.pollingTimer = setInterval(async () => {
      try {
        const response = await fetch("/api/trpc/resilience.healthCheck", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (response.ok) {
          const data = await response.json();
          this.notifyHandlers("poll", data);
          // Try to reconnect WebSocket
          this.reconnectAttempts = 0;
          this.connect();
        }
      } catch {
        // Continue polling
      }
    }, this.config.pollingIntervalMs);
  }

  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  send(topic: string, data: unknown): void {
    const message = { topic, data, timestamp: Date.now() };

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for later delivery
      if (this.messageQueue.length >= this.config.messageQueueSize) {
        this.messageQueue.shift(); // Remove oldest
      }
      this.messageQueue.push({ topic, data });
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const msg = this.messageQueue.shift();
      if (msg) {
        this.ws.send(JSON.stringify({ ...msg, timestamp: Date.now() }));
      }
    }
  }

  subscribe(topic: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, new Set());
    }
    this.handlers.get(topic)!.add(handler);
    return () => {
      this.handlers.get(topic)?.delete(handler);
    };
  }

  private notifyHandlers(topic: string, data: unknown): void {
    this.handlers.get(topic)?.forEach(handler => {
      try {
        handler(data);
      } catch (e) {
        console.error(`WebSocket handler error for topic ${topic}:`, e);
      }
    });
  }

  getConnectionQuality(): string {
    return this.connectionQuality;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN || this.isUsingPolling;
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.stopPolling();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnect
      this.ws.close();
      this.ws = null;
    }
  }
}

export const wsManager = new ResilientWebSocket();
export type { WSConfig, MessageHandler };
