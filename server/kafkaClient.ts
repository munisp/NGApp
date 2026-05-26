/**
 * server/kafkaClient.ts — Kafka client for OG-RMM Platform
 *
 * Provides a thin wrapper around the Go middleware worker's internal HTTP API
 * for publishing sensor readings and alarm events to Kafka.
 * Falls back to a no-op stub when the Go worker is unavailable.
 */

const WORKER_URL = process.env.GO_WORKER_URL ?? "http://localhost:8090";
const WORKER_ENABLED = process.env.GO_WORKER_ENABLED !== "false";

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
  mode: "kafka" | "simulated";
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
 * Publish a sensor reading to the Kafka topic og.sensor.readings.
 * The Go worker handles the actual Kafka produce operation.
 */
export async function publishSensorReading(reading: SensorReading): Promise<void> {
  if (!WORKER_ENABLED) return;
  try {
    await workerFetch("/kafka/publish/sensor", {
      method: "POST",
      body: JSON.stringify(reading),
    });
  } catch {
    // Non-critical — sensor data loss is acceptable in degraded mode
  }
}

/**
 * Publish an alarm event to the appropriate Kafka topic.
 * Critical alarms (severity >= 4) go to og.alarms.critical.
 */
export async function publishAlarmEvent(alarm: AlarmEvent): Promise<void> {
  if (!WORKER_ENABLED) return;
  try {
    await workerFetch("/kafka/publish/alarm", {
      method: "POST",
      body: JSON.stringify(alarm),
    });
  } catch {
    // Non-critical — alarm events are also stored in DB
  }
}

/**
 * Get Kafka consumer statistics from the Go worker.
 */
export async function getKafkaStats(): Promise<KafkaStats> {
  if (!WORKER_ENABLED) {
    return { messagesProcessed: 0, errors: 0, lastMessage: null, mode: "simulated" };
  }
  try {
    const res = await workerFetch("/kafka/stats");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as KafkaStats;
  } catch {
    return { messagesProcessed: 0, errors: 0, lastMessage: null, mode: "simulated" };
  }
}

/**
 * Check if the Go worker is healthy.
 */
export async function isWorkerHealthy(): Promise<boolean> {
  if (!WORKER_ENABLED) return false;
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
  if (!WORKER_ENABLED) {
    return { mode: "disabled", services: {} };
  }
  try {
    const res = await workerFetch("/status");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as Record<string, unknown>;
  } catch {
    return { mode: "unavailable", services: {} };
  }
}
