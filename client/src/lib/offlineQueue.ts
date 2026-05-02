/**
 * Offline Queue Manager
 * Provides offline-first resilience for low-bandwidth and unreliable network environments.
 * Queues operations when offline and syncs when connectivity is restored.
 */

interface QueuedOperation {
  id: string;
  type: string;
  payload: unknown;
  priority: number;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

interface ConnectionStatus {
  isOnline: boolean;
  type: string;
  bandwidth: number | null;
  latency: number | null;
  lastCheck: number;
}

class OfflineQueueManager {
  private queue: QueuedOperation[] = [];
  private dbName = "payment-switch-offline-queue";
  private storeName = "operations";
  private isProcessing = false;
  private connectionStatus: ConnectionStatus = {
    isOnline: navigator.onLine,
    type: "unknown",
    bandwidth: null,
    latency: null,
    lastCheck: Date.now(),
  };
  private listeners: Array<(status: ConnectionStatus) => void> = [];
  private syncInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.setupNetworkListeners();
    this.loadQueue();
    this.startPeriodicSync();
  }

  private setupNetworkListeners(): void {
    window.addEventListener("online", () => {
      this.connectionStatus.isOnline = true;
      this.connectionStatus.lastCheck = Date.now();
      this.notifyListeners();
      this.processQueue();
    });

    window.addEventListener("offline", () => {
      this.connectionStatus.isOnline = false;
      this.connectionStatus.lastCheck = Date.now();
      this.notifyListeners();
    });

    // Monitor connection quality
    if ("connection" in navigator) {
      const conn = (navigator as unknown as { connection: { effectiveType: string; downlink: number; addEventListener: (e: string, cb: () => void) => void } }).connection;
      conn.addEventListener("change", () => {
        this.connectionStatus.type = conn.effectiveType;
        this.connectionStatus.bandwidth = conn.downlink;
        this.notifyListeners();
      });
    }
  }

  private startPeriodicSync(): void {
    this.syncInterval = setInterval(() => {
      if (this.connectionStatus.isOnline && this.queue.length > 0) {
        this.processQueue();
      }
      this.checkLatency();
    }, 30000); // Check every 30 seconds
  }

  private async checkLatency(): Promise<void> {
    try {
      const start = performance.now();
      await fetch("/api/health", { method: "HEAD", cache: "no-cache" });
      this.connectionStatus.latency = Math.round(performance.now() - start);
      this.connectionStatus.isOnline = true;
    } catch {
      this.connectionStatus.isOnline = false;
      this.connectionStatus.latency = null;
    }
    this.connectionStatus.lastCheck = Date.now();
    this.notifyListeners();
  }

  enqueue(type: string, payload: unknown, priority: number = 5): string {
    const id = `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const operation: QueuedOperation = {
      id,
      type,
      payload,
      priority,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 5,
    };
    this.queue.push(operation);
    this.queue.sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp);
    this.saveQueue();

    if (this.connectionStatus.isOnline) {
      this.processQueue();
    }

    return id;
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing || !this.connectionStatus.isOnline || this.queue.length === 0) return;
    this.isProcessing = true;

    const batch = this.getBatchForBandwidth();

    for (const op of batch) {
      try {
        const response = await fetch("/api/trpc/resilience.enqueue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            json: {
              operationType: op.type,
              payload: JSON.stringify(op.payload),
              priority: op.priority,
            },
          }),
        });

        if (response.ok) {
          this.queue = this.queue.filter(q => q.id !== op.id);
        } else if (op.retryCount < op.maxRetries) {
          op.retryCount++;
        } else {
          this.queue = this.queue.filter(q => q.id !== op.id);
          console.error(`Operation ${op.id} exceeded max retries`);
        }
      } catch {
        if (op.retryCount < op.maxRetries) {
          op.retryCount++;
        }
        break; // Network error, stop processing
      }
    }

    this.saveQueue();
    this.isProcessing = false;
  }

  private getBatchForBandwidth(): QueuedOperation[] {
    const bandwidth = this.connectionStatus.bandwidth;
    // Adaptive batch sizing based on connection quality
    if (!bandwidth || bandwidth < 0.5) return this.queue.slice(0, 1); // Very slow: 1 at a time
    if (bandwidth < 2) return this.queue.slice(0, 3); // Slow: 3 at a time
    if (bandwidth < 10) return this.queue.slice(0, 10); // Medium: 10 at a time
    return this.queue.slice(0, 50); // Fast: up to 50
  }

  getStatus(): { queueLength: number; connection: ConnectionStatus } {
    return {
      queueLength: this.queue.length,
      connection: { ...this.connectionStatus },
    };
  }

  onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener({ ...this.connectionStatus });
    }
  }

  private saveQueue(): void {
    try {
      localStorage.setItem("offline-queue", JSON.stringify(this.queue));
    } catch {
      // localStorage full, queue is only in memory
    }
  }

  private loadQueue(): void {
    try {
      const saved = localStorage.getItem("offline-queue");
      if (saved) {
        this.queue = JSON.parse(saved);
      }
    } catch {
      this.queue = [];
    }
  }

  destroy(): void {
    if (this.syncInterval) clearInterval(this.syncInterval);
  }
}

export const offlineQueue = new OfflineQueueManager();
export type { ConnectionStatus, QueuedOperation };
