// ============================================================
// NEXCOM Exchange - WebSocket Client with Reconnection
// ============================================================

export type WSStatus = "connecting" | "connected" | "disconnected" | "reconnecting";

export interface WSMessage {
  type: "ticker" | "orderbook" | "trade" | "order_update" | "notification" | "heartbeat";
  channel?: string;
  data: unknown;
  timestamp: number;
}

interface WSClientOptions {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  onMessage?: (msg: WSMessage) => void;
  onStatusChange?: (status: WSStatus) => void;
  onError?: (error: Event) => void;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private options: Required<WSClientOptions>;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private subscriptions = new Set<string>();
  private _status: WSStatus = "disconnected";

  constructor(options: WSClientOptions) {
    this.options = {
      reconnectInterval: 1000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      onMessage: () => {},
      onStatusChange: () => {},
      onError: () => {},
      ...options,
    };
  }

  get status(): WSStatus {
    return this._status;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.setStatus("connecting");

    try {
      this.ws = new WebSocket(this.options.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus("connected");
        this.startHeartbeat();

        // Resubscribe to channels
        this.subscriptions.forEach((channel) => {
          this.send({ type: "subscribe", channel });
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WSMessage;
          if (msg.type === "heartbeat") return;
          this.options.onMessage(msg);
        } catch {
          // Non-JSON message, ignore
        }
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        this.setStatus("disconnected");
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        this.options.onError(error);
      };
    } catch {
      this.setStatus("disconnected");
      this.attemptReconnect();
    }
  }

  disconnect(): void {
    this.clearReconnectTimer();
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.setStatus("disconnected");
  }

  subscribe(channel: string): void {
    this.subscriptions.add(channel);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: "subscribe", channel });
    }
  }

  unsubscribe(channel: string): void {
    this.subscriptions.delete(channel);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: "unsubscribe", channel });
    }
  }

  private send(data: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private setStatus(status: WSStatus): void {
    this._status = status;
    this.options.onStatusChange(status);
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.setStatus("disconnected");
      return;
    }

    this.setStatus("reconnecting");
    this.reconnectAttempts++;

    // Exponential backoff: 1s, 2s, 4s, 8s, ...
    const delay = this.options.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, Math.min(delay, 30000));
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: "ping", timestamp: Date.now() });
    }, this.options.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

// ============================================================
// Price Simulation Engine (for demo/development)
// ============================================================

interface PriceUpdate {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  bid: number;
  ask: number;
  high: number;
  low: number;
  timestamp: number;
}

type PriceUpdateCallback = (updates: PriceUpdate[]) => void;

export class PriceSimulator {
  private interval: ReturnType<typeof setInterval> | null = null;
  private prices: Map<string, { price: number; open: number; high: number; low: number; volume: number }> = new Map();
  private callback: PriceUpdateCallback;

  constructor(
    initialPrices: Array<{ symbol: string; price: number; volume: number }>,
    callback: PriceUpdateCallback
  ) {
    this.callback = callback;
    initialPrices.forEach(({ symbol, price, volume }) => {
      this.prices.set(symbol, {
        price,
        open: price,
        high: price * 1.005,
        low: price * 0.995,
        volume,
      });
    });
  }

  start(intervalMs = 2000): void {
    if (this.interval) return;
    this.interval = setInterval(() => this.tick(), intervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private tick(): void {
    const updates: PriceUpdate[] = [];

    this.prices.forEach((data, symbol) => {
      // Random walk with mean reversion
      const volatility = data.price * 0.001;
      const drift = (data.open - data.price) * 0.01; // Mean reversion
      const change = drift + (Math.random() - 0.5) * 2 * volatility;
      const newPrice = Math.max(data.price * 0.9, data.price + change);

      data.price = Number(newPrice.toFixed(2));
      data.high = Math.max(data.high, data.price);
      data.low = Math.min(data.low, data.price);
      data.volume += Math.floor(Math.random() * 100);

      const spread = data.price * 0.0005;

      updates.push({
        symbol,
        price: data.price,
        change: Number((data.price - data.open).toFixed(2)),
        changePercent: Number((((data.price - data.open) / data.open) * 100).toFixed(2)),
        volume: data.volume,
        bid: Number((data.price - spread).toFixed(2)),
        ask: Number((data.price + spread).toFixed(2)),
        high: data.high,
        low: data.low,
        timestamp: Date.now(),
      });
    });

    this.callback(updates);
  }
}
