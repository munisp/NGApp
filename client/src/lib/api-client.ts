/**
 * OG RMM Platform — API Client
 * Connects to Go API Gateway with automatic fallback to mock data in dev.
 * WebSocket hub for real-time alarm and telemetry streaming.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const WS_BASE = import.meta.env.VITE_WS_URL || "";

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}/api/v1${path}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...options?.headers,
    },
    ...options,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

function getToken(): string {
  return localStorage.getItem("og_rmm_token") || "";
}

// ── Well API ──────────────────────────────────────────────────────────────────

export const WellAPI = {
  listWells: (params?: { status?: string; basin?: string; limit?: number }) =>
    apiFetch<WellListResponse>(`/wells?${new URLSearchParams(params as any)}`),

  getWell: (wellId: string) =>
    apiFetch<WellDetailResponse>(`/wells/${wellId}`),

  getWellSensors: (wellId: string) =>
    apiFetch<SensorReadingsResponse>(`/wells/${wellId}/sensors/latest`),

  getWellProduction: (wellId: string, days = 60) =>
    apiFetch<ProductionResponse>(`/wells/${wellId}/production?days=${days}`),

  getWellAlarms: (wellId: string) =>
    apiFetch<AlarmsResponse>(`/wells/${wellId}/alarms`),

  updateWellStatus: (wellId: string, status: string, reason?: string) =>
    apiFetch(`/wells/${wellId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason }),
    }),
};

// ── Alarm API ─────────────────────────────────────────────────────────────────

export const AlarmAPI = {
  listAlarms: (params?: { state?: string; severity?: number; limit?: number }) =>
    apiFetch<AlarmsResponse>(`/alarms?${new URLSearchParams(params as any)}`),

  acknowledgeAlarm: (alarmId: string, comment?: string) =>
    apiFetch(`/alarms/${alarmId}/acknowledge`, {
      method: "POST",
      body: JSON.stringify({ comment }),
    }),

  suppressAlarm: (alarmId: string, durationMin: number) =>
    apiFetch(`/alarms/${alarmId}/suppress`, {
      method: "POST",
      body: JSON.stringify({ duration_minutes: durationMin }),
    }),

  clearAlarm: (alarmId: string) =>
    apiFetch(`/alarms/${alarmId}/clear`, { method: "POST" }),
};

// ── Telemetry API ─────────────────────────────────────────────────────────────

export const TelemetryAPI = {
  getLatestReadings: (wellId: string) =>
    apiFetch<SensorReadingsResponse>(`/telemetry/${wellId}/latest`),

  getPressureHistory: (wellId: string, hours = 24) =>
    apiFetch<TimeSeriesResponse>(`/telemetry/${wellId}/pressure?hours=${hours}`),

  ingestBatch: (wellId: string, readings: SensorReading[]) =>
    apiFetch(`/telemetry/${wellId}/ingest`, {
      method: "POST",
      body: JSON.stringify({ readings }),
    }),
};

// ── ML API ────────────────────────────────────────────────────────────────────

export const MLAPI = {
  getESPPredictions: (wellId?: string) =>
    apiFetch<ESPPredictionsResponse>(`/ml/esp-predictions${wellId ? `?well_id=${wellId}` : ""}`),

  getESPForecast: (wellId: string) =>
    apiFetch<ESPForecastResponse>(`/ml/esp-forecast/${wellId}`),

  getAnomalies: (wellId?: string, hours = 72) =>
    apiFetch<AnomalyResponse>(`/ml/anomalies?hours=${hours}${wellId ? `&well_id=${wellId}` : ""}`),

  getModelMetrics: () =>
    apiFetch<ModelMetricsResponse>(`/ml/model-metrics`),
};

// ── Financial API ─────────────────────────────────────────────────────────────

export const FinancialAPI = {
  getSummary: (period?: string) =>
    apiFetch<FinancialSummaryResponse>(`/financials/summary${period ? `?period=${period}` : ""}`),

  getLedgerEntries: (params?: { limit?: number; offset?: number; type?: string }) =>
    apiFetch<LedgerResponse>(`/financials/ledger?${new URLSearchParams(params as any)}`),

  getSettlements: (status?: string) =>
    apiFetch<SettlementsResponse>(`/financials/settlements${status ? `?status=${status}` : ""}`),
};

// ── Analytics API ─────────────────────────────────────────────────────────────

export const AnalyticsAPI = {
  getFleetKPIs: () =>
    apiFetch<FleetKPIResponse>(`/analytics/fleet-kpi`),

  getProductionSummary: (wellId: string, days = 60) =>
    apiFetch<ProductionResponse>(`/analytics/production/${wellId}?days=${days}`),

  getDeclineCurve: (wellId: string) =>
    apiFetch<DeclineCurveResponse>(`/analytics/decline-curve/${wellId}`),
};

// ── Workover API ──────────────────────────────────────────────────────────────

export const WorkoverAPI = {
  listJobs: (params?: { status?: string; well_id?: string }) =>
    apiFetch<WorkoverListResponse>(`/workovers?${new URLSearchParams(params as any)}`),

  getJob: (jobId: string) =>
    apiFetch<WorkoverJobResponse>(`/workovers/${jobId}`),

  createJob: (job: CreateWorkoverRequest) =>
    apiFetch<WorkoverJobResponse>(`/workovers`, {
      method: "POST",
      body: JSON.stringify(job),
    }),

  updateJob: (jobId: string, updates: Partial<WorkoverJob>) =>
    apiFetch<WorkoverJobResponse>(`/workovers/${jobId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),

  addCostEntry: (jobId: string, cost: WorkoverCostEntry) =>
    apiFetch(`/workovers/${jobId}/costs`, {
      method: "POST",
      body: JSON.stringify(cost),
    }),

  completeJob: (jobId: string, summary: string) =>
    apiFetch(`/workovers/${jobId}/complete`, {
      method: "POST",
      body: JSON.stringify({ summary }),
    }),
};

// ── WebSocket Hub ─────────────────────────────────────────────────────────────

export type WSMessageType = "alarm" | "telemetry" | "well_status" | "prediction" | "ping";

export interface WSMessage {
  type: WSMessageType;
  payload: any;
  timestamp: string;
}

type WSListener = (msg: WSMessage) => void;

class WebSocketHub {
  private ws: WebSocket | null = null;
  private listeners: Map<WSMessageType, Set<WSListener>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 2000;
  private connected = false;
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  connect() {
    if (!this.url || this.connected) return;
    try {
      this.ws = new WebSocket(`${this.url}?token=${getToken()}`);
      this.ws.onopen = () => {
        this.connected = true;
        this.reconnectDelay = 2000;
        console.log("[WS] Connected to OG RMM hub");
      };
      this.ws.onmessage = (e) => {
        try {
          const msg: WSMessage = JSON.parse(e.data);
          const handlers = this.listeners.get(msg.type);
          handlers?.forEach(h => h(msg));
        } catch {}
      };
      this.ws.onclose = () => {
        this.connected = false;
        this.scheduleReconnect();
      };
      this.ws.onerror = () => {
        this.connected = false;
      };
    } catch {}
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000);
      this.connect();
    }, this.reconnectDelay);
  }

  on(type: WSMessageType, listener: WSListener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
    return () => this.listeners.get(type)?.delete(listener);
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.connected = false;
  }

  isConnected() { return this.connected; }
}

export const wsHub = new WebSocketHub(WS_BASE);

// ── Type definitions ──────────────────────────────────────────────────────────

export interface SensorReading {
  sensor_id: string;
  sensor_tag: string;
  sensor_type: string;
  value: number;
  unit: string;
  quality: number;
  timestamp: string;
  trend: "up" | "down" | "stable";
}

export interface WellListResponse { wells: any[]; total: number; }
export interface WellDetailResponse { well: any; }
export interface SensorReadingsResponse { readings: SensorReading[]; well_id: string; }
export interface ProductionResponse { data: any[]; well_id: string; }
export interface AlarmsResponse { alarms: any[]; total: number; unacknowledged: number; }
export interface TimeSeriesResponse { series: { timestamp: string; value: number }[]; }
export interface ESPPredictionsResponse { predictions: any[]; }
export interface ESPForecastResponse {
  well_id: string;
  current_health: number;
  forecast: { day: number; date: string; predicted_health: number; lower: number; upper: number; vibration_forecast: number; current_forecast: number }[];
  failure_probability_7d: number;
  failure_probability_30d: number;
  recommended_action: string;
}
export interface AnomalyResponse { anomalies: any[]; }
export interface ModelMetricsResponse { metrics: any; }
export interface FinancialSummaryResponse { summary: any; }
export interface LedgerResponse { entries: any[]; total: number; }
export interface SettlementsResponse { settlements: any[]; }
export interface FleetKPIResponse { kpis: any; }
export interface DeclineCurveResponse { curve: any[]; }
export interface WorkoverListResponse { jobs: WorkoverJob[]; total: number; }
export interface WorkoverJobResponse { job: WorkoverJob; }

export interface WorkoverJob {
  job_id: string;
  well_id: string;
  well_name: string;
  job_type: WorkoverJobType;
  status: WorkoverStatus;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  description: string;
  reason: string;
  assigned_crew: string;
  supervisor: string;
  rig_name?: string;
  estimated_duration_days: number;
  actual_duration_days?: number;
  estimated_cost_usd: number;
  actual_cost_usd: number;
  cost_entries: WorkoverCostEntry[];
  temporal_workflow_id?: string;
  created_at: string;
  scheduled_start?: string;
  actual_start?: string;
  completed_at?: string;
  notes?: string;
}

export type WorkoverJobType =
  | "ESP_REPLACEMENT"
  | "TUBING_REPLACEMENT"
  | "PERFORATION"
  | "STIMULATION"
  | "SAND_CLEANOUT"
  | "SCALE_REMOVAL"
  | "PACKER_REPLACEMENT"
  | "WELLBORE_CLEANOUT"
  | "CHEMICAL_TREATMENT"
  | "SAFETY_VALVE_REPLACEMENT"
  | "HYDRAULIC_SYSTEM_SERVICE"
  | "PLC_UPGRADE"
  | "SUBSEA_INTERVENTION";

export type WorkoverStatus =
  | "PLANNED"
  | "APPROVED"
  | "MOBILIZING"
  | "IN_PROGRESS"
  | "SUSPENDED"
  | "COMPLETED"
  | "CANCELLED";

export interface WorkoverCostEntry {
  entry_id: string;
  category: "LABOR" | "EQUIPMENT" | "MATERIALS" | "TRANSPORT" | "SERVICES" | "OTHER";
  description: string;
  amount_usd: number;
  date: string;
  vendor?: string;
}

export interface CreateWorkoverRequest {
  well_id: string;
  job_type: WorkoverJobType;
  priority: string;
  description: string;
  reason: string;
  assigned_crew: string;
  supervisor: string;
  rig_name?: string;
  estimated_duration_days: number;
  estimated_cost_usd: number;
  scheduled_start?: string;
}
