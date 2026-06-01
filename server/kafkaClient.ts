/**
 * server/kafkaClient.ts — Kafka client for OG-RMM Platform
 *
 * Provides a thin wrapper around the Go middleware worker's internal HTTP API
 * for publishing sensor readings and alarm events to Kafka.
 * Requires the Go worker to be running.
 */

const WORKER_URL = process.env.GO_WORKER_URL ?? "http://localhost:8090";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SensorReading {
  wellId: string;
  tag: string;
  value: number;
  unit: string;
  quality: number;
  timestamp: Date;
}

export interface AlarmEvent {
  alarmId: number;
  wellId: string;
  severity: number;
  message: string;
  timestamp: Date;
}

export interface KafkaStats {
  messagesProcessed: number;
  errors: number;
  lastMessage: string | null;
  mode: "kafka" | "unavailable";
}

// ─── Client ────────────────────────────────────────────────────────────────────

async function workerFetch(path: string, options?: RequestInit): Promise<Response> {
  const url = `${WORKER_URL}/v1${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    signal: AbortSignal.timeout(5000),
  });
  return response;
}

/**
 * Publish a sensor reading to Kafka via the Go worker.
 */
export async function publishSensorReading(reading: SensorReading): Promise<void> {
  const res = await workerFetch("/kafka/publish/sensor", {
    method: "POST",
    body: JSON.stringify(reading),
  });
  if (!res.ok) {
    throw new Error(`Kafka publish sensor failed: HTTP ${res.status}`);
  }
}

/**
 * Publish an alarm event to Kafka.
 */
export async function publishAlarmEvent(alarm: AlarmEvent): Promise<void> {
  const res = await workerFetch("/kafka/publish/alarm", {
    method: "POST",
    body: JSON.stringify(alarm),
  });
  if (!res.ok) {
    throw new Error(`Kafka publish alarm failed: HTTP ${res.status}`);
  }
}

/**
 * Get Kafka consumer statistics from the Go worker.
 */
export async function getKafkaStats(): Promise<KafkaStats> {
  try {
    const res = await workerFetch("/kafka/stats");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as KafkaStats;
  } catch {
    return { messagesProcessed: 0, errors: 0, lastMessage: null, mode: "unavailable" };
  }
}

/**
 * Check if the Go worker is healthy.
 */
export async function isWorkerHealthy(): Promise<boolean> {
  try {
    const res = await workerFetch("/health");
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Get overall worker status including all middleware service stats.
 */
export async function getWorkerStatus(): Promise<Record<string, unknown>> {
  const res = await workerFetch("/status");
  if (!res.ok) {
    throw new Error(`Worker status failed: HTTP ${res.status}`);
  }
  return await res.json() as Record<string, unknown>;
}
