/**
 * OG RMM Platform — Mock Data Layer
 * Simulates real-time telemetry and operational data.
 * In production: replaced by API calls to Go/Python microservices.
 */

export type WellStatus = "ACTIVE" | "SHUT_IN" | "DRILLING" | "WORKOVER" | "ABANDONED";
export type WellType = "OIL" | "GAS" | "WATER_INJECTION" | "DISPOSAL" | "OBSERVATION";
export type AlarmSeverity = 1 | 2 | 3 | 4;
export type AlarmState = "UNACKNOWLEDGED" | "ACKNOWLEDGED" | "CLEARED" | "SUPPRESSED";

export interface Well {
  well_id: string;
  well_name: string;
  api_number: string;
  field_name: string;
  basin: string;
  operator: string;
  status: WellStatus;
  well_type: WellType;
  latitude: number;
  longitude: number;
  total_depth_ft: number;
  spud_date: string;
  completion_date: string;
  esp_installed: boolean;
  // Current production
  oil_bpd: number;
  gas_mcfd: number;
  water_bpd: number;
  uptime_pct: number;
  // ESP data
  esp_health?: number;
  esp_failure_prob_7d?: number;
}

export interface SensorReading {
  sensor_id: string;
  sensor_type: string;
  value: number;
  unit: string;
  quality: number;
  timestamp: string;
  trend: "up" | "down" | "stable";
}

export interface Alarm {
  alarm_id: string;
  well_id: string;
  well_name: string;
  severity: AlarmSeverity;
  state: AlarmState;
  alarm_type: string;
  message: string;
  value?: number;
  unit?: string;
  threshold?: number;
  created_at: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
}

export interface DailyProduction {
  date: string;
  oil_bbls: number;
  gas_mcf: number;
  water_bbls: number;
  uptime_hours: number;
}

export interface FinancialSummary {
  period: string;
  revenue_usd: number;
  opex_usd: number;
  royalties_usd: number;
  net_revenue_usd: number;
  oil_price_per_bbl: number;
  gas_price_per_mcf: number;
}

// ─── Wells ────────────────────────────────────────────────────────────────────

export const WELLS: Well[] = [
  {
    well_id: "well-001", well_name: "Permian Basin #47", api_number: "42-329-20047-00",
    field_name: "Midland Basin", basin: "Permian", operator: "Apex Energy Corp",
    status: "ACTIVE", well_type: "OIL",
    latitude: 31.9686, longitude: -102.0779,
    total_depth_ft: 11_240, spud_date: "2021-03-15", completion_date: "2021-06-20",
    esp_installed: true, oil_bpd: 1240, gas_mcfd: 3.2, water_bpd: 480,
    uptime_pct: 98.2, esp_health: 87, esp_failure_prob_7d: 0.12,
  },
  {
    well_id: "well-002", well_name: "Eagle Ford #12", api_number: "42-131-20012-00",
    field_name: "Eagle Ford Shale", basin: "Gulf Coast", operator: "Apex Energy Corp",
    status: "ACTIVE", well_type: "OIL",
    latitude: 28.7041, longitude: -99.1085,
    total_depth_ft: 9_800, spud_date: "2020-08-10", completion_date: "2020-11-05",
    esp_installed: true, oil_bpd: 980, gas_mcfd: 2.1, water_bpd: 820,
    uptime_pct: 96.5, esp_health: 72, esp_failure_prob_7d: 0.34,
  },
  {
    well_id: "well-003", well_name: "Bakken #89", api_number: "33-053-00089-00",
    field_name: "Williston Basin", basin: "Bakken", operator: "Apex Energy Corp",
    status: "ACTIVE", well_type: "OIL",
    latitude: 47.9253, longitude: -103.1218,
    total_depth_ft: 10_450, spud_date: "2022-01-20", completion_date: "2022-04-15",
    esp_installed: true, oil_bpd: 870, gas_mcfd: 1.8, water_bpd: 340,
    uptime_pct: 97.1, esp_health: 91, esp_failure_prob_7d: 0.08,
  },
  {
    well_id: "well-004", well_name: "DJ Basin #34", api_number: "05-123-00034-00",
    field_name: "Wattenberg Field", basin: "DJ Basin", operator: "Apex Energy Corp",
    status: "ACTIVE", well_type: "GAS",
    latitude: 40.2338, longitude: -104.6567,
    total_depth_ft: 8_200, spud_date: "2021-11-05", completion_date: "2022-02-10",
    esp_installed: false, oil_bpd: 120, gas_mcfd: 8.4, water_bpd: 210,
    uptime_pct: 99.1,
  },
  {
    well_id: "well-005", well_name: "Haynesville #7", api_number: "22-017-00007-00",
    field_name: "Haynesville Shale", basin: "ArkLaTex", operator: "Apex Energy Corp",
    status: "SHUT_IN", well_type: "GAS",
    latitude: 32.5252, longitude: -93.7502,
    total_depth_ft: 12_800, spud_date: "2019-05-12", completion_date: "2019-09-30",
    esp_installed: false, oil_bpd: 0, gas_mcfd: 0, water_bpd: 0,
    uptime_pct: 0,
  },
  {
    well_id: "well-006", well_name: "Anadarko #55", api_number: "35-083-00055-00",
    field_name: "Anadarko Basin", basin: "Mid-Continent", operator: "Apex Energy Corp",
    status: "WORKOVER", well_type: "OIL",
    latitude: 35.4676, longitude: -97.5164,
    total_depth_ft: 7_600, spud_date: "2018-09-01", completion_date: "2018-12-15",
    esp_installed: true, oil_bpd: 0, gas_mcfd: 0, water_bpd: 0,
    uptime_pct: 0, esp_health: 31, esp_failure_prob_7d: 0.87,
  },
  {
    well_id: "well-007", well_name: "Marcellus #21", api_number: "42-051-00021-00",
    field_name: "Marcellus Shale", basin: "Appalachian", operator: "Apex Energy Corp",
    status: "ACTIVE", well_type: "GAS",
    latitude: 41.2033, longitude: -77.1945,
    total_depth_ft: 8_900, spud_date: "2022-06-01", completion_date: "2022-09-20",
    esp_installed: false, oil_bpd: 30, gas_mcfd: 12.6, water_bpd: 95,
    uptime_pct: 98.8,
  },
  {
    well_id: "well-008", well_name: "Permian Basin #63", api_number: "42-329-20063-00",
    field_name: "Delaware Basin", basin: "Permian", operator: "Apex Energy Corp",
    status: "DRILLING", well_type: "OIL",
    latitude: 31.7619, longitude: -104.4104,
    total_depth_ft: 0, spud_date: "2025-02-01", completion_date: "",
    esp_installed: false, oil_bpd: 0, gas_mcfd: 0, water_bpd: 0,
    uptime_pct: 0,
  },
];

// ─── Alarms ───────────────────────────────────────────────────────────────────

export const ALARMS: Alarm[] = [
  {
    alarm_id: "alm-001", well_id: "well-006", well_name: "Anadarko #55",
    severity: 1, state: "UNACKNOWLEDGED",
    alarm_type: "ESP_FAILURE_PREDICTED",
    message: "ESP health degraded to 31% — predicted failure within 24 hours. Immediate inspection required.",
    value: 31, unit: "%", threshold: 40,
    created_at: new Date(Date.now() - 12 * 60000).toISOString(),
  },
  {
    alarm_id: "alm-002", well_id: "well-002", well_name: "Eagle Ford #12",
    severity: 2, state: "UNACKNOWLEDGED",
    alarm_type: "HIGH_VIBRATION",
    message: "ESP vibration elevated: 4.2 mm/s (threshold: 3.0 mm/s). Monitor closely.",
    value: 4.2, unit: "mm/s", threshold: 3.0,
    created_at: new Date(Date.now() - 45 * 60000).toISOString(),
  },
  {
    alarm_id: "alm-003", well_id: "well-001", well_name: "Permian Basin #47",
    severity: 2, state: "ACKNOWLEDGED",
    alarm_type: "LOW_TUBING_PRESSURE",
    message: "Tubing pressure below normal range: 980 PSI (expected 1100-1500 PSI).",
    value: 980, unit: "PSI", threshold: 1100,
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    acknowledged_at: new Date(Date.now() - 1.5 * 3600000).toISOString(),
    acknowledged_by: "J. Rodriguez",
  },
  {
    alarm_id: "alm-004", well_id: "well-003", well_name: "Bakken #89",
    severity: 3, state: "UNACKNOWLEDGED",
    alarm_type: "HIGH_WATER_CUT",
    message: "Water cut increased to 28% (7-day avg: 18%). Possible water breakthrough.",
    value: 28, unit: "%", threshold: 25,
    created_at: new Date(Date.now() - 3 * 3600000).toISOString(),
  },
  {
    alarm_id: "alm-005", well_id: "well-004", well_name: "DJ Basin #34",
    severity: 3, state: "ACKNOWLEDGED",
    alarm_type: "SENSOR_QUALITY",
    message: "Flow meter quality degraded: 42% confidence. Calibration recommended.",
    value: 42, unit: "%", threshold: 70,
    created_at: new Date(Date.now() - 6 * 3600000).toISOString(),
    acknowledged_at: new Date(Date.now() - 5 * 3600000).toISOString(),
    acknowledged_by: "M. Chen",
  },
  {
    alarm_id: "alm-006", well_id: "well-007", well_name: "Marcellus #21",
    severity: 4, state: "CLEARED",
    alarm_type: "COMMUNICATION_LOSS",
    message: "SCADA communication restored after 8-minute outage.",
    created_at: new Date(Date.now() - 8 * 3600000).toISOString(),
    acknowledged_at: new Date(Date.now() - 7.8 * 3600000).toISOString(),
    acknowledged_by: "System",
  },
  {
    alarm_id: "alm-007", well_id: "well-001", well_name: "Permian Basin #47",
    severity: 1, state: "UNACKNOWLEDGED",
    alarm_type: "RAPID_PRESSURE_DROP",
    message: "Casing pressure dropped 180 PSI in 5 minutes. Possible tubing leak.",
    value: 180, unit: "PSI/5min", threshold: 100,
    created_at: new Date(Date.now() - 8 * 60000).toISOString(),
  },
];

// ─── Sensor Readings ──────────────────────────────────────────────────────────

export function generateSensorReadings(wellId: string): SensorReading[] {
  const base = wellId === "well-001" ? {
    tubing: 1320, casing: 890, flow: 1240, temp: 142, wh_temp: 68
  } : wellId === "well-002" ? {
    tubing: 1180, casing: 760, flow: 980, temp: 138, wh_temp: 72
  } : {
    tubing: 1400, casing: 920, flow: 870, temp: 145, wh_temp: 65
  };

  const jitter = () => (Math.random() - 0.5) * 20;

  return [
    { sensor_id: "tp-01", sensor_type: "TUBING_PRESSURE", value: base.tubing + jitter(), unit: "PSI", quality: 98, timestamp: new Date().toISOString(), trend: "stable" },
    { sensor_id: "cp-01", sensor_type: "CASING_PRESSURE", value: base.casing + jitter(), unit: "PSI", quality: 97, timestamp: new Date().toISOString(), trend: "down" },
    { sensor_id: "fr-01", sensor_type: "FLOW_RATE", value: base.flow + jitter(), unit: "BPD", quality: 95, timestamp: new Date().toISOString(), trend: "stable" },
    { sensor_id: "bt-01", sensor_type: "BOTTOMHOLE_TEMP", value: base.temp + jitter() * 0.1, unit: "°F", quality: 92, timestamp: new Date().toISOString(), trend: "up" },
    { sensor_id: "wht-01", sensor_type: "WELLHEAD_TEMP", value: base.wh_temp + jitter() * 0.05, unit: "°F", quality: 99, timestamp: new Date().toISOString(), trend: "stable" },
    { sensor_id: "esp-cur", sensor_type: "ESP_CURRENT", value: 42.3 + jitter() * 0.2, unit: "A", quality: 96, timestamp: new Date().toISOString(), trend: "stable" },
    { sensor_id: "esp-vib", sensor_type: "ESP_VIBRATION", value: 1.8 + Math.abs(jitter()) * 0.05, unit: "mm/s", quality: 94, timestamp: new Date().toISOString(), trend: "up" },
    { sensor_id: "esp-frq", sensor_type: "ESP_FREQUENCY", value: 60.0 + jitter() * 0.01, unit: "Hz", quality: 99, timestamp: new Date().toISOString(), trend: "stable" },
  ];
}

// ─── Production History ───────────────────────────────────────────────────────

export function generateProductionHistory(days: number = 30): DailyProduction[] {
  const data: DailyProduction[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const noise = () => (Math.random() - 0.5) * 0.1;
    data.push({
      date: d.toISOString().split("T")[0],
      oil_bbls: Math.round(1240 * (1 + noise()) * (0.95 + 0.05 * Math.sin(i * 0.3))),
      gas_mcf: Math.round(3200 * (1 + noise())),
      water_bbls: Math.round(480 * (1 + noise())),
      uptime_hours: 23.5 + Math.random() * 0.5,
    });
  }
  return data;
}

// ─── Financial Data ───────────────────────────────────────────────────────────

export const FINANCIAL_SUMMARY: FinancialSummary[] = [
  { period: "Jan 2025", revenue_usd: 10_840_000, opex_usd: 2_360_000, royalties_usd: 1_626_000, net_revenue_usd: 6_854_000, oil_price_per_bbl: 73.20, gas_price_per_mcf: 3.85 },
  { period: "Feb 2025", revenue_usd: 11_240_000, opex_usd: 2_280_000, royalties_usd: 1_686_000, net_revenue_usd: 7_274_000, oil_price_per_bbl: 75.40, gas_price_per_mcf: 4.10 },
  { period: "Mar 2025", revenue_usd: 10_920_000, opex_usd: 2_410_000, royalties_usd: 1_638_000, net_revenue_usd: 6_872_000, oil_price_per_bbl: 74.10, gas_price_per_mcf: 3.95 },
];

// ─── KPI Summary ──────────────────────────────────────────────────────────────

export const KPI_SUMMARY = {
  total_wells: 142,
  active_wells: 128,
  shut_in_wells: 9,
  drilling_wells: 5,
  total_oil_bpd: 48_320,
  total_gas_mmscfd: 124.5,
  total_water_bpd: 18_200,
  active_alarms: 7,
  critical_alarms: 2,
  avg_uptime_pct: 96.4,
  mtbf_days: 142,
  revenue_today_usd: 4_832_000,
  esp_wells_at_risk: 3,
};

// ── Extended mock helpers for hooks ──────────────────────────────────────────

export function getFleetKPIs() { return KPI_SUMMARY; }

export function getProductionData(wellId: string, days = 60) {
  return generateProductionHistory(days);
}

export function getAlarmStats() {
  const critical = ALARMS.filter(a => a.severity === 1).length;
  const high = ALARMS.filter(a => a.severity === 2).length;
  const medium = ALARMS.filter(a => a.severity === 3).length;
  const unack = ALARMS.filter(a => a.state === "UNACKNOWLEDGED").length;
  return { critical, high, medium, unack, total: ALARMS.length };
}

export function getFinancialSummary() { return FINANCIAL_SUMMARY; }

export function getLedgerEntries() {
  return [
    { entry_id: "LE-001", date: "2026-03-13", type: "REVENUE", description: "Oil sales — Permian Basin #47", amount_usd: 91_884, account: "Revenue:Oil", debit: false },
    { entry_id: "LE-002", date: "2026-03-13", type: "REVENUE", description: "Gas sales — Marcellus #21", amount_usd: 49_770, account: "Revenue:Gas", debit: false },
    { entry_id: "LE-003", date: "2026-03-13", type: "ROYALTY", description: "State royalty 12.5% — Permian Basin #47", amount_usd: 11_486, account: "Payables:Royalties:State", debit: true },
    { entry_id: "LE-004", date: "2026-03-13", type: "OPEX", description: "ESP workover — Anadarko #55", amount_usd: 48_000, account: "OPEX:Workover", debit: true },
    { entry_id: "LE-005", date: "2026-03-12", type: "REVENUE", description: "Oil sales — Eagle Ford #12", amount_usd: 72_520, account: "Revenue:Oil", debit: false },
    { entry_id: "LE-006", date: "2026-03-12", type: "OPEX", description: "Chemical treatment — Bakken #89", amount_usd: 8_400, account: "OPEX:Chemicals", debit: true },
    { entry_id: "LE-007", date: "2026-03-12", type: "ROYALTY", description: "Federal royalty 18.75% — Eagle Ford #12", amount_usd: 13_597, account: "Payables:Royalties:Federal", debit: true },
    { entry_id: "LE-008", date: "2026-03-11", type: "REVENUE", description: "NGL sales — DJ Basin #34", amount_usd: 29_760, account: "Revenue:NGL", debit: false },
  ];
}

export function getSettlements() {
  return [
    { settlement_id: "SET-001", recipient: "Texas General Land Office", type: "STATE_ROYALTY", amount_usd: 164_320, status: "SETTLED", date: "2026-03-10", mojaloop_transfer_id: "MLT-2026031001" },
    { settlement_id: "SET-002", recipient: "ONRR — Federal Royalties", type: "FEDERAL_ROYALTY", amount_usd: 218_740, status: "SETTLED", date: "2026-03-10", mojaloop_transfer_id: "MLT-2026031002" },
    { settlement_id: "SET-003", recipient: "Permian Basin Mineral Trust", type: "PRIVATE_ROYALTY", amount_usd: 82_160, status: "PENDING", date: "2026-03-15", mojaloop_transfer_id: null },
    { settlement_id: "SET-004", recipient: "North Dakota State Trust Lands", type: "STATE_ROYALTY", amount_usd: 43_890, status: "PROCESSING", date: "2026-03-13", mojaloop_transfer_id: "MLT-2026031301" },
  ];
}

export function getESPPredictions() {
  return WELLS.filter(w => w.esp_installed).map(w => ({
    well_id: w.well_id,
    well_name: w.well_name,
    basin: w.basin,
    field_name: w.field_name,
    esp_health: w.esp_health ?? 85,
    failure_probability_7d: w.esp_failure_prob_7d ?? 0.1,
    risk_level: (w.esp_failure_prob_7d ?? 0.1) > 0.7 ? "CRITICAL" : (w.esp_failure_prob_7d ?? 0.1) > 0.35 ? "MEDIUM" : "LOW",
    last_updated: new Date().toISOString(),
  }));
}

export function getAnomalyData() {
  return [
    { anomaly_id: "ANO-001", well_id: "well-001", well_name: "Permian Basin #47", sensor: "TUBING_PRESSURE", score: 0.82, description: "Pressure oscillation pattern detected", detected_at: new Date(Date.now() - 3600000).toISOString(), severity: "MEDIUM" },
    { anomaly_id: "ANO-002", well_id: "well-002", well_name: "Eagle Ford #12", sensor: "ESP_VIBRATION", score: 0.91, description: "Vibration frequency shift — bearing wear signature", detected_at: new Date(Date.now() - 7200000).toISOString(), severity: "HIGH" },
    { anomaly_id: "ANO-003", well_id: "well-004", well_name: "Anadarko #55", sensor: "ESP_CURRENT", score: 0.97, description: "Phase imbalance exceeding 8% — imminent failure risk", detected_at: new Date(Date.now() - 720000).toISOString(), severity: "CRITICAL" },
    { anomaly_id: "ANO-004", well_id: "well-003", well_name: "Bakken #89", sensor: "WATER_CUT", score: 0.74, description: "Water cut trending above historical baseline", detected_at: new Date(Date.now() - 10800000).toISOString(), severity: "MEDIUM" },
  ];
}

export function getModelMetrics() {
  return { precision: 0.891, recall: 0.847, f1: 0.868, auc_roc: 0.923, accuracy: 0.912, fpr: 0.089, training_date: "2026-03-01", model_version: "v2.4.1", samples_trained: 48_320 };
}

export interface WorkoverJob {
  job_id: string;
  well_id: string;
  well_name: string;
  job_type: string;
  status: string;
  priority: string;
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

export interface WorkoverCostEntry {
  entry_id: string;
  category: string;
  description: string;
  amount_usd: number;
  date: string;
  vendor?: string;
}

export function getWorkoverJobs(): WorkoverJob[] {
  return [
    {
      job_id: "WO-2026-001",
      well_id: "well-004",
      well_name: "Anadarko #55",
      job_type: "ESP_REPLACEMENT",
      status: "IN_PROGRESS",
      priority: "CRITICAL",
      description: "Replace failed ESP unit — motor winding failure confirmed",
      reason: "ESP health degraded to 31%, ML model predicts failure within 24h",
      assigned_crew: "Crew Alpha — J. Martinez (Lead)",
      supervisor: "Sarah Chen",
      rig_name: "Workover Rig #3",
      estimated_duration_days: 3,
      actual_duration_days: undefined,
      estimated_cost_usd: 185_000,
      actual_cost_usd: 62_400,
      temporal_workflow_id: "wf-esp-repl-anadarko55-20260312",
      created_at: "2026-03-12T08:00:00Z",
      scheduled_start: "2026-03-12T14:00:00Z",
      actual_start: "2026-03-12T15:30:00Z",
      cost_entries: [
        { entry_id: "CE-001", category: "LABOR", description: "Crew mobilization (6 personnel × 2 days)", amount_usd: 24_000, date: "2026-03-12", vendor: "Apex Field Services" },
        { entry_id: "CE-002", category: "EQUIPMENT", description: "ESP unit — 250HP Centrilift C-Series", amount_usd: 28_400, date: "2026-03-12", vendor: "Baker Hughes" },
        { entry_id: "CE-003", category: "TRANSPORT", description: "Rig mobilization and transport", amount_usd: 10_000, date: "2026-03-12", vendor: "Southwest Trucking" },
      ],
    },
    {
      job_id: "WO-2026-002",
      well_id: "well-002",
      well_name: "Eagle Ford #12",
      job_type: "SCALE_REMOVAL",
      status: "PLANNED",
      priority: "HIGH",
      description: "Calcium carbonate scale removal — production declining 15%",
      reason: "Flow restriction confirmed by pressure gradient analysis",
      assigned_crew: "Crew Beta — R. Thompson (Lead)",
      supervisor: "Mike Rodriguez",
      estimated_duration_days: 2,
      estimated_cost_usd: 48_000,
      actual_cost_usd: 0,
      temporal_workflow_id: "wf-scale-eagleford12-20260315",
      created_at: "2026-03-11T10:00:00Z",
      scheduled_start: "2026-03-15T08:00:00Z",
      cost_entries: [],
    },
    {
      job_id: "WO-2026-003",
      well_id: "well-001",
      well_name: "Permian Basin #47",
      job_type: "TUBING_REPLACEMENT",
      status: "APPROVED",
      priority: "MEDIUM",
      description: "Replace 2-3/8\" tubing string — corrosion detected",
      reason: "Casing inspection log shows 15% wall loss at 4,200 ft",
      assigned_crew: "Crew Gamma — D. Williams (Lead)",
      supervisor: "Lisa Park",
      rig_name: "Workover Rig #1",
      estimated_duration_days: 5,
      estimated_cost_usd: 220_000,
      actual_cost_usd: 0,
      temporal_workflow_id: "wf-tubing-permian47-20260320",
      created_at: "2026-03-10T14:00:00Z",
      scheduled_start: "2026-03-20T07:00:00Z",
      cost_entries: [],
    },
    {
      job_id: "WO-2025-089",
      well_id: "well-003",
      well_name: "Bakken #89",
      job_type: "SAND_CLEANOUT",
      status: "COMPLETED",
      priority: "MEDIUM",
      description: "Sand cleanout — perforations partially blocked",
      reason: "Production decline 22% over 30 days, sand production confirmed",
      assigned_crew: "Crew Delta — P. Johnson (Lead)",
      supervisor: "Tom Baker",
      estimated_duration_days: 2,
      actual_duration_days: 2,
      estimated_cost_usd: 65_000,
      actual_cost_usd: 61_200,
      temporal_workflow_id: "wf-sand-bakken89-20251210",
      created_at: "2025-12-08T09:00:00Z",
      scheduled_start: "2025-12-10T08:00:00Z",
      actual_start: "2025-12-10T08:30:00Z",
      completed_at: "2025-12-12T16:00:00Z",
      notes: "Cleanout successful. Production restored to 870 BPD. Recommend sand screen installation.",
      cost_entries: [
        { entry_id: "CE-010", category: "LABOR", description: "Crew (4 personnel × 2 days)", amount_usd: 16_000, date: "2025-12-10", vendor: "Apex Field Services" },
        { entry_id: "CE-011", category: "EQUIPMENT", description: "Coiled tubing unit rental", amount_usd: 32_000, date: "2025-12-10", vendor: "Halliburton" },
        { entry_id: "CE-012", category: "MATERIALS", description: "Chemicals and fluids", amount_usd: 13_200, date: "2025-12-11", vendor: "ChemTreat Inc." },
      ],
    },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// WT PETROTECH GAP CLOSURE — EXTENDED MOCK DATA
// FPSO/HPU, Subsea Trees, Calibration, Site Connectivity, Actuator Commands
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Types ────────────────────────────────────────────────────────────────────

export type AssetType = "WELLHEAD" | "FPSO" | "HPU" | "SUBSEA_TREE" | "SUBSEA_MANIFOLD" | "UMBILICAL" | "COMPRESSOR" | "SOLAR_UNIT" | "ESD_PANEL";
export type ValveType = "MASTER_VALVE" | "WING_VALVE" | "SWAB_VALVE" | "CHOKE_VALVE" | "SURFACE_SAFETY_VALVE" | "ANNULUS_MASTER_VALVE";
export type ActuatorType = "HYDRAULIC" | "ELECTRO_HYDRAULIC" | "PNEUMATIC" | "ELECTRIC" | "MANUAL";
export type ProtocolType = "MQTT" | "MODBUS_TCP" | "MODBUS_RTU" | "OPC_UA" | "DNP3" | "HART";
export type ConnectivityStatus = "ONLINE" | "DEGRADED" | "OFFLINE" | "BUFFERING" | "MAINTENANCE";
export type CalibrationStatus = "CURRENT" | "DUE_SOON" | "OVERDUE" | "IN_PROGRESS" | "FAILED";
export type CommandStatus = "PENDING" | "SENT" | "ACKNOWLEDGED" | "EXECUTED" | "FAILED" | "CANCELLED";

export interface FPSOVessel {
  vessel_id: string;
  vessel_name: string;
  imo_number: string;
  vessel_type: "FPSO" | "FSO" | "FLNG" | "SEMI";
  latitude: number;
  longitude: number;
  water_depth_m: number;
  oil_storage_bbl: number;
  processing_capacity_bpd: number;
  gas_processing_mmscfd: number;
  mooring_type: string;
  operator: string;
  status: WellStatus;
  // Live telemetry
  current_production_bpd: number;
  current_gas_mmscfd: number;
  storage_utilization_pct: number;
  hpu_count: number;
  subsea_tree_count: number;
  active_alarms: number;
}

export interface HPUUnit {
  hpu_id: string;
  vessel_id?: string;
  well_id?: string;
  hpu_tag: string;
  hpu_name: string;
  manufacturer: string;
  model: string;
  rated_pressure_psi: number;
  rated_flow_lpm: number;
  accumulator_volume_l: number;
  status: WellStatus;
  // Live telemetry
  system_pressure_psi: number;
  flow_rate_lpm: number;
  accumulator_pressure_psi: number;
  reservoir_level_pct: number;
  fluid_temp_c: number;
  pump1_running: boolean;
  pump2_running: boolean;
  low_level_alarm: boolean;
  high_temp_alarm: boolean;
}

export interface SubseaTree {
  tree_id: string;
  well_id: string;
  vessel_id?: string;
  tree_tag: string;
  tree_name: string;
  tree_type: "HORIZONTAL" | "VERTICAL" | "DUAL";
  water_depth_m: number;
  latitude: number;
  longitude: number;
  manufacturer: string;
  rated_pressure_psi: number;
  status: WellStatus;
  // Live telemetry
  tubing_pressure_psi: number;
  annulus_pressure_psi: number;
  tree_temp_f: number;
  master_valve_open: boolean;
  wing_valve_open: boolean;
  swab_valve_open: boolean;
  choke_position_pct: number;
  umbilical_hydraulic_pressure_psi: number;
}

export interface SubseaManifold {
  manifold_id: string;
  vessel_id: string;
  manifold_tag: string;
  manifold_name: string;
  water_depth_m: number;
  slot_count: number;
  slots_occupied: number;
  rated_pressure_psi: number;
  status: WellStatus;
  inlet_pressure_psi: number;
  outlet_pressure_psi: number;
}

export interface Valve {
  valve_id: string;
  well_id?: string;
  tree_id?: string;
  valve_tag: string;
  valve_name: string;
  valve_type: ValveType;
  actuator_type: ActuatorType;
  fail_safe_position: "OPEN" | "CLOSED";
  status: "OPEN" | "CLOSED" | "PARTIAL" | "FAULT";
  position_pct: number;
  last_operated: string;
  protocol: ProtocolType;
  register_address?: number;
  node_id?: string;
}

export interface SiteConnectivity {
  well_id: string;
  well_name: string;
  api_number: string;
  latitude: number;
  longitude: number;
  status: ConnectivityStatus;
  link_quality_pct: number;
  buffer_depth: number;
  last_upload_ok: boolean;
  last_seen_at: string;
  protocols_active: ProtocolType[];
  solar_voltage_v?: number;
  battery_soc_pct?: number;
  compressor_running?: boolean;
  site_power_mode: "GRID" | "SOLAR" | "BATTERY" | "GENERATOR";
  agent_version: string;
  uptime_seconds: number;
}

export interface CalibrationRecord {
  calibration_id: string;
  sensor_id: string;
  sensor_tag: string;
  sensor_name: string;
  sensor_type: string;
  unit: string;
  well_id: string;
  well_name: string;
  calibration_type: "ROUTINE" | "DRIFT_CORRECTION" | "POST_REPAIR" | "INITIAL";
  interval_days: number;
  last_calibration_date?: string;
  last_calibration_result?: "PASS" | "FAIL" | "ADJUSTED";
  last_calibration_by?: string;
  next_due_date: string;
  status: CalibrationStatus;
  current_drift_pct: number;
  drift_threshold_pct: number;
  days_until_due: number;
  assigned_technician?: string;
  certificate_number?: string;
  protocol: ProtocolType;
}

export interface ActuatorCommand {
  command_id: string;
  well_id: string;
  well_name: string;
  valve_tag?: string;
  command_type: "OPEN" | "CLOSE" | "SETPOINT" | "ESD_RESET" | "CHOKE_POSITION" | "PUMP_START" | "PUMP_STOP";
  actuator_type: ActuatorType;
  protocol: ProtocolType;
  target_value: number;
  unit: string;
  current_value?: number;
  issued_by: string;
  issued_at: string;
  executed_at?: string;
  status: CommandStatus;
  error_message?: string;
}

// ─── FPSO Mock Data ───────────────────────────────────────────────────────────

export const MOCK_FPSO_VESSELS: FPSOVessel[] = [
  {
    vessel_id: "fpso-001",
    vessel_name: "Deepwater Horizon Alpha",
    imo_number: "IMO9234567",
    vessel_type: "FPSO",
    latitude: 28.5,
    longitude: -89.2,
    water_depth_m: 1500,
    oil_storage_bbl: 2_000_000,
    processing_capacity_bpd: 150_000,
    gas_processing_mmscfd: 180,
    mooring_type: "TURRET",
    operator: "WT Petrotech USA",
    status: "ACTIVE",
    current_production_bpd: 128_400,
    current_gas_mmscfd: 154.2,
    storage_utilization_pct: 62,
    hpu_count: 4,
    subsea_tree_count: 12,
    active_alarms: 2,
  },
  {
    vessel_id: "fpso-002",
    vessel_name: "Gulf Titan FPSO",
    imo_number: "IMO9345678",
    vessel_type: "FPSO",
    latitude: 27.8,
    longitude: -90.5,
    water_depth_m: 2200,
    oil_storage_bbl: 1_500_000,
    processing_capacity_bpd: 100_000,
    gas_processing_mmscfd: 120,
    mooring_type: "SPREAD",
    operator: "WT Petrotech USA",
    status: "ACTIVE",
    current_production_bpd: 89_200,
    current_gas_mmscfd: 108.6,
    storage_utilization_pct: 45,
    hpu_count: 3,
    subsea_tree_count: 8,
    active_alarms: 0,
  },
];

export const MOCK_HPU_UNITS: HPUUnit[] = [
  {
    hpu_id: "hpu-001",
    vessel_id: "fpso-001",
    hpu_tag: "HPU-A-001",
    hpu_name: "FPSO Alpha HPU Skid A",
    manufacturer: "WT Petrotech USA",
    model: "HPU-5000-EH",
    rated_pressure_psi: 5000,
    rated_flow_lpm: 120,
    accumulator_volume_l: 200,
    status: "ACTIVE",
    system_pressure_psi: 4820,
    flow_rate_lpm: 87,
    accumulator_pressure_psi: 4750,
    reservoir_level_pct: 82,
    fluid_temp_c: 42,
    pump1_running: true,
    pump2_running: false,
    low_level_alarm: false,
    high_temp_alarm: false,
  },
  {
    hpu_id: "hpu-002",
    vessel_id: "fpso-001",
    hpu_tag: "HPU-B-001",
    hpu_name: "FPSO Alpha HPU Skid B",
    manufacturer: "WT Petrotech USA",
    model: "HPU-5000-EH",
    rated_pressure_psi: 5000,
    rated_flow_lpm: 120,
    accumulator_volume_l: 200,
    status: "ACTIVE",
    system_pressure_psi: 4890,
    flow_rate_lpm: 92,
    accumulator_pressure_psi: 4820,
    reservoir_level_pct: 78,
    fluid_temp_c: 45,
    pump1_running: true,
    pump2_running: true,
    low_level_alarm: false,
    high_temp_alarm: false,
  },
  {
    hpu_id: "hpu-003",
    well_id: "well-001",
    hpu_tag: "HPU-WH-001",
    hpu_name: "Wellhead HPU — Permian #47",
    manufacturer: "WT Petrotech USA",
    model: "HPU-3000-EH-COMPACT",
    rated_pressure_psi: 3000,
    rated_flow_lpm: 40,
    accumulator_volume_l: 80,
    status: "ACTIVE",
    system_pressure_psi: 2850,
    flow_rate_lpm: 28,
    accumulator_pressure_psi: 2780,
    reservoir_level_pct: 91,
    fluid_temp_c: 38,
    pump1_running: true,
    pump2_running: false,
    low_level_alarm: false,
    high_temp_alarm: false,
  },
];

export const MOCK_SUBSEA_TREES: SubseaTree[] = [
  {
    tree_id: "tree-001",
    well_id: "well-deepwater-001",
    vessel_id: "fpso-001",
    tree_tag: "ST-A01",
    tree_name: "Subsea Tree Alpha-01",
    tree_type: "HORIZONTAL",
    water_depth_m: 1480,
    latitude: 28.48,
    longitude: -89.18,
    manufacturer: "WT Petrotech USA",
    rated_pressure_psi: 10000,
    status: "ACTIVE",
    tubing_pressure_psi: 4250,
    annulus_pressure_psi: 1820,
    tree_temp_f: 185,
    master_valve_open: true,
    wing_valve_open: true,
    swab_valve_open: false,
    choke_position_pct: 72,
    umbilical_hydraulic_pressure_psi: 4800,
  },
  {
    tree_id: "tree-002",
    well_id: "well-deepwater-002",
    vessel_id: "fpso-001",
    tree_tag: "ST-A02",
    tree_name: "Subsea Tree Alpha-02",
    tree_type: "HORIZONTAL",
    water_depth_m: 1510,
    latitude: 28.51,
    longitude: -89.22,
    manufacturer: "WT Petrotech USA",
    rated_pressure_psi: 10000,
    status: "ACTIVE",
    tubing_pressure_psi: 3980,
    annulus_pressure_psi: 1650,
    tree_temp_f: 178,
    master_valve_open: true,
    wing_valve_open: true,
    swab_valve_open: false,
    choke_position_pct: 68,
    umbilical_hydraulic_pressure_psi: 4750,
  },
  {
    tree_id: "tree-003",
    well_id: "well-deepwater-003",
    vessel_id: "fpso-001",
    tree_tag: "ST-A03",
    tree_name: "Subsea Tree Alpha-03",
    tree_type: "DUAL",
    water_depth_m: 1495,
    latitude: 28.49,
    longitude: -89.25,
    manufacturer: "WT Petrotech USA",
    rated_pressure_psi: 10000,
    status: "SHUT_IN",
    tubing_pressure_psi: 5100,
    annulus_pressure_psi: 2100,
    tree_temp_f: 165,
    master_valve_open: false,
    wing_valve_open: false,
    swab_valve_open: false,
    choke_position_pct: 0,
    umbilical_hydraulic_pressure_psi: 4800,
  },
];

// ─── Site Connectivity Mock Data ──────────────────────────────────────────────

export const MOCK_SITE_CONNECTIVITY: SiteConnectivity[] = [
  {
    well_id: "well-001",
    well_name: "Permian Basin #47",
    api_number: "42-329-20130",
    latitude: 31.8,
    longitude: -102.5,
    status: "ONLINE",
    link_quality_pct: 98,
    buffer_depth: 0,
    last_upload_ok: true,
    last_seen_at: new Date(Date.now() - 2000).toISOString(),
    protocols_active: ["MQTT", "MODBUS_TCP", "OPC_UA"],
    site_power_mode: "GRID",
    agent_version: "2.0.1",
    uptime_seconds: 1_234_567,
  },
  {
    well_id: "well-002",
    well_name: "Eagle Ford #12",
    api_number: "42-127-31820",
    latitude: 28.9,
    longitude: -98.2,
    status: "ONLINE",
    link_quality_pct: 94,
    buffer_depth: 12,
    last_upload_ok: true,
    last_seen_at: new Date(Date.now() - 5000).toISOString(),
    protocols_active: ["MQTT", "MODBUS_TCP"],
    site_power_mode: "GRID",
    agent_version: "2.0.1",
    uptime_seconds: 987_654,
  },
  {
    well_id: "well-003",
    well_name: "Bakken Solar #8",
    api_number: "33-053-01234",
    latitude: 47.8,
    longitude: -103.1,
    status: "DEGRADED",
    link_quality_pct: 62,
    buffer_depth: 4_820,
    last_upload_ok: false,
    last_seen_at: new Date(Date.now() - 45_000).toISOString(),
    protocols_active: ["MQTT", "MODBUS_RTU"],
    solar_voltage_v: 23.1,
    battery_soc_pct: 71,
    compressor_running: true,
    site_power_mode: "SOLAR",
    agent_version: "2.0.0",
    uptime_seconds: 432_100,
  },
  {
    well_id: "well-004",
    well_name: "Marcellus Gas #22",
    api_number: "37-059-22341",
    latitude: 41.2,
    longitude: -77.8,
    status: "OFFLINE",
    link_quality_pct: 0,
    buffer_depth: 0,
    last_upload_ok: false,
    last_seen_at: new Date(Date.now() - 3_600_000).toISOString(),
    protocols_active: ["DNP3"],
    site_power_mode: "GRID",
    agent_version: "1.9.5",
    uptime_seconds: 0,
  },
  {
    well_id: "well-005",
    well_name: "Haynesville #31",
    api_number: "17-031-45678",
    latitude: 32.5,
    longitude: -93.4,
    status: "ONLINE",
    link_quality_pct: 100,
    buffer_depth: 0,
    last_upload_ok: true,
    last_seen_at: new Date(Date.now() - 1000).toISOString(),
    protocols_active: ["MQTT", "OPC_UA", "MODBUS_TCP"],
    site_power_mode: "GRID",
    agent_version: "2.0.1",
    uptime_seconds: 2_100_000,
  },
  {
    well_id: "well-006",
    well_name: "Utica Solar #5",
    api_number: "39-019-56789",
    latitude: 40.8,
    longitude: -81.2,
    status: "ONLINE",
    link_quality_pct: 87,
    buffer_depth: 234,
    last_upload_ok: true,
    last_seen_at: new Date(Date.now() - 8000).toISOString(),
    protocols_active: ["MQTT", "MODBUS_RTU"],
    solar_voltage_v: 25.8,
    battery_soc_pct: 94,
    compressor_running: false,
    site_power_mode: "SOLAR",
    agent_version: "2.0.1",
    uptime_seconds: 654_321,
  },
];

// ─── Calibration Mock Data ────────────────────────────────────────────────────

export const MOCK_CALIBRATION_RECORDS: CalibrationRecord[] = [
  {
    calibration_id: "cal-001",
    sensor_id: "sen-001",
    sensor_tag: "PT-1001",
    sensor_name: "Tubing Pressure Transmitter",
    sensor_type: "PRESSURE",
    unit: "PSI",
    well_id: "well-001",
    well_name: "Permian Basin #47",
    calibration_type: "ROUTINE",
    interval_days: 365,
    last_calibration_date: "2025-03-15",
    last_calibration_result: "PASS",
    last_calibration_by: "J. Martinez",
    next_due_date: "2026-03-15",
    status: "DUE_SOON",
    current_drift_pct: 0.42,
    drift_threshold_pct: 1.0,
    days_until_due: 2,
    assigned_technician: "J. Martinez",
    certificate_number: "CAL-2025-0342",
    protocol: "MODBUS_TCP",
  },
  {
    calibration_id: "cal-002",
    sensor_id: "sen-002",
    sensor_tag: "TT-1002",
    sensor_name: "Wellhead Temperature Sensor",
    sensor_type: "TEMPERATURE",
    unit: "°F",
    well_id: "well-001",
    well_name: "Permian Basin #47",
    calibration_type: "ROUTINE",
    interval_days: 365,
    last_calibration_date: "2024-11-20",
    last_calibration_result: "ADJUSTED",
    last_calibration_by: "K. Thompson",
    next_due_date: "2025-11-20",
    status: "OVERDUE",
    current_drift_pct: 1.82,
    drift_threshold_pct: 1.0,
    days_until_due: -113,
    protocol: "OPC_UA",
  },
  {
    calibration_id: "cal-003",
    sensor_id: "sen-003",
    sensor_tag: "FT-2001",
    sensor_name: "Production Flow Meter",
    sensor_type: "FLOW",
    unit: "BPD",
    well_id: "well-002",
    well_name: "Eagle Ford #12",
    calibration_type: "ROUTINE",
    interval_days: 180,
    last_calibration_date: "2025-09-10",
    last_calibration_result: "PASS",
    last_calibration_by: "R. Chen",
    next_due_date: "2026-03-10",
    status: "DUE_SOON",
    current_drift_pct: 0.18,
    drift_threshold_pct: 0.5,
    days_until_due: -3,
    assigned_technician: "R. Chen",
    certificate_number: "CAL-2025-0891",
    protocol: "MODBUS_TCP",
  },
  {
    calibration_id: "cal-004",
    sensor_id: "sen-004",
    sensor_tag: "VT-3001",
    sensor_name: "ESP Vibration Sensor",
    sensor_type: "VIBRATION",
    unit: "mm/s",
    well_id: "well-003",
    well_name: "Bakken Solar #8",
    calibration_type: "ROUTINE",
    interval_days: 365,
    last_calibration_date: "2025-06-01",
    last_calibration_result: "PASS",
    last_calibration_by: "A. Patel",
    next_due_date: "2026-06-01",
    status: "CURRENT",
    current_drift_pct: 0.05,
    drift_threshold_pct: 2.0,
    days_until_due: 80,
    certificate_number: "CAL-2025-0567",
    protocol: "MQTT",
  },
  {
    calibration_id: "cal-005",
    sensor_id: "sen-005",
    sensor_tag: "PT-4001",
    sensor_name: "Casing Pressure Transmitter",
    sensor_type: "PRESSURE",
    unit: "PSI",
    well_id: "well-004",
    well_name: "Marcellus Gas #22",
    calibration_type: "DRIFT_CORRECTION",
    interval_days: 365,
    last_calibration_date: "2025-01-15",
    last_calibration_result: "FAIL",
    last_calibration_by: "B. Wilson",
    next_due_date: "2025-04-15",
    status: "OVERDUE",
    current_drift_pct: 3.21,
    drift_threshold_pct: 1.0,
    days_until_due: -332,
    protocol: "DNP3",
  },
  {
    calibration_id: "cal-006",
    sensor_id: "sen-006",
    sensor_tag: "AT-5001",
    sensor_name: "H2S Gas Detector",
    sensor_type: "GAS",
    unit: "ppm",
    well_id: "well-005",
    well_name: "Haynesville #31",
    calibration_type: "ROUTINE",
    interval_days: 90,
    last_calibration_date: "2025-12-20",
    last_calibration_result: "PASS",
    last_calibration_by: "C. Davis",
    next_due_date: "2026-03-20",
    status: "DUE_SOON",
    current_drift_pct: 0.0,
    drift_threshold_pct: 5.0,
    days_until_due: 7,
    assigned_technician: "C. Davis",
    certificate_number: "CAL-2025-1234",
    protocol: "MODBUS_TCP",
  },
];

// ─── Actuator Commands Mock Data ──────────────────────────────────────────────

export const MOCK_ACTUATOR_COMMANDS: ActuatorCommand[] = [
  {
    command_id: "cmd-001",
    well_id: "well-001",
    well_name: "Permian Basin #47",
    valve_tag: "MV-1001",
    command_type: "CHOKE_POSITION",
    actuator_type: "ELECTRO_HYDRAULIC",
    protocol: "OPC_UA",
    target_value: 75,
    unit: "%",
    current_value: 72,
    issued_by: "J. Rodriguez",
    issued_at: new Date(Date.now() - 120_000).toISOString(),
    executed_at: new Date(Date.now() - 118_000).toISOString(),
    status: "EXECUTED",
  },
  {
    command_id: "cmd-002",
    well_id: "well-002",
    well_name: "Eagle Ford #12",
    valve_tag: "WV-2001",
    command_type: "OPEN",
    actuator_type: "HYDRAULIC",
    protocol: "MODBUS_TCP",
    target_value: 100,
    unit: "%",
    current_value: 100,
    issued_by: "M. Chen",
    issued_at: new Date(Date.now() - 3_600_000).toISOString(),
    executed_at: new Date(Date.now() - 3_598_000).toISOString(),
    status: "EXECUTED",
  },
  {
    command_id: "cmd-003",
    well_id: "well-003",
    well_name: "Bakken Solar #8",
    valve_tag: "SSV-3001",
    command_type: "CLOSE",
    actuator_type: "PNEUMATIC",
    protocol: "MODBUS_RTU",
    target_value: 0,
    unit: "%",
    current_value: 100,
    issued_by: "A. Patel",
    issued_at: new Date(Date.now() - 30_000).toISOString(),
    status: "PENDING",
  },
  {
    command_id: "cmd-004",
    well_id: "well-005",
    well_name: "Haynesville #31",
    valve_tag: "CV-5001",
    command_type: "SETPOINT",
    actuator_type: "ELECTRO_HYDRAULIC",
    protocol: "OPC_UA",
    target_value: 1200,
    unit: "PSI",
    current_value: 1180,
    issued_by: "J. Rodriguez",
    issued_at: new Date(Date.now() - 600_000).toISOString(),
    executed_at: new Date(Date.now() - 598_000).toISOString(),
    status: "EXECUTED",
  },
  {
    command_id: "cmd-005",
    well_id: "well-004",
    well_name: "Marcellus Gas #22",
    valve_tag: "ESD-4001",
    command_type: "ESD_RESET",
    actuator_type: "ELECTRIC",
    protocol: "DNP3",
    target_value: 1,
    unit: "bool",
    issued_by: "B. Wilson",
    issued_at: new Date(Date.now() - 7_200_000).toISOString(),
    status: "FAILED",
    error_message: "Site offline — DNP3 outstation unreachable",
  },
];

// ─── Connectivity summary ─────────────────────────────────────────────────────

export const CONNECTIVITY_SUMMARY = {
  total_sites: MOCK_SITE_CONNECTIVITY.length,
  online: MOCK_SITE_CONNECTIVITY.filter(s => s.status === "ONLINE").length,
  degraded: MOCK_SITE_CONNECTIVITY.filter(s => s.status === "DEGRADED").length,
  offline: MOCK_SITE_CONNECTIVITY.filter(s => s.status === "OFFLINE").length,
  solar_sites: MOCK_SITE_CONNECTIVITY.filter(s => s.site_power_mode === "SOLAR").length,
  avg_link_quality: Math.round(
    MOCK_SITE_CONNECTIVITY.reduce((s, c) => s + c.link_quality_pct, 0) / MOCK_SITE_CONNECTIVITY.length
  ),
};

export const CALIBRATION_SUMMARY = {
  total: MOCK_CALIBRATION_RECORDS.length,
  overdue: MOCK_CALIBRATION_RECORDS.filter(c => c.status === "OVERDUE").length,
  due_soon: MOCK_CALIBRATION_RECORDS.filter(c => c.status === "DUE_SOON").length,
  current: MOCK_CALIBRATION_RECORDS.filter(c => c.status === "CURRENT").length,
  high_drift: MOCK_CALIBRATION_RECORDS.filter(c => c.current_drift_pct > c.drift_threshold_pct).length,
};
