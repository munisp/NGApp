export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

// ─── Platform Identity ────────────────────────────────────────────────────────
export const APP_NAME = "OG-RMM Platform";
export const APP_VERSION = "v55.0";
export const APP_ID_DEFAULT = "og-rmm-platform";
export const APP_DESCRIPTION = "Oil & Gas Remote Monitoring & Management Platform — Production-Ready";
export const APP_BUILD_DATE = "2026-04-14";
export const APP_VENDOR = "OG-RMM Technologies";
export const APP_SUPPORT_EMAIL = "support@og-rmm.io";
export const APP_DOCS_URL = "https://docs.og-rmm.io";

// ─── Physics Engine ───────────────────────────────────────────────────────────
export const PHYSICS_ENGINE_URL_DEFAULT = "http://localhost:4001";
export const PHYSICS_ENGINE_TIMEOUT_MS = 30_000;
export const PHYSICS_DEFAULT_WELL_ID = "WELL-001";
export const PHYSICS_DEBOUNCE_MS = 600;
export const PHYSICS_HISTORY_MAX = 10;
export const PHYSICS_RETRY_ATTEMPTS = 3;
export const PHYSICS_RETRY_DELAY_MS = 1_000;

// ─── ML / PINN Service ────────────────────────────────────────────────────────
export const ML_SERVICE_URL_DEFAULT = "http://localhost:4003";
export const ML_SERVICE_TIMEOUT_MS = 60_000;
export const PINN_MC_SAMPLES_DEFAULT = 50;
export const PINN_TRAIN_SAMPLES_DEFAULT = 300;
export const PINN_TRAIN_EPOCHS_DEFAULT = 150;
export const PINN_PHYSICS_WEIGHT_DEFAULT = 0.1;
export const PINN_MODEL_S3_KEY = "pinn-models/pinn-surrogate-latest.pt";
export const PINN_MODEL_VERSION_KEY = "pinn-models/version.json";

// ─── Well & Field Defaults ────────────────────────────────────────────────────
export const DEFAULT_FIELD_ID = "field-001";
export const DEFAULT_OPERATOR = "OG-RMM Operations";
export const DEFAULT_COUNTRY = "US";
export const DEFAULT_CURRENCY = "USD";
export const DEFAULT_TIMEZONE = "America/Chicago";
export const DEFAULT_WELLS = ["WELL-001", "WELL-002", "WELL-003", "WELL-004", "WELL-005", "WELL-006"] as const;
export const DEFAULT_RESERVOIR_PRESSURE_PSIA = 3500;
export const DEFAULT_TVD_FT = 8500;
export const DEFAULT_FLUID_GRADIENT = 0.433;
export const DEFAULT_WATER_CUT = 0.25;
export const DEFAULT_GOR_SCF_BBL = 500;
export const DEFAULT_ESP_FREQUENCY_HZ = 60;
export const DEFAULT_WELLHEAD_PRESSURE_PSIA = 200;
export const DEFAULT_SKIN_FACTOR = 0;
export const DEFAULT_Q_MAX_BPD = 5000;

// ─── Geomechanics Defaults ────────────────────────────────────────────────────
export const DEFAULT_UCS_PSI = 3000;
export const DEFAULT_FRICTION_ANGLE_DEG = 30;
export const DEFAULT_BIOT_COEFFICIENT = 0.8;
export const DEFAULT_POISSON_RATIO = 0.25;
export const DEFAULT_BULK_DENSITY_GCC = 2.35;
export const DEFAULT_MUD_WEIGHT_PPG = 10.5;
export const DEFAULT_LOT_PRESSURE_PPG = 14.5;

// ─── Decline Curve Defaults ───────────────────────────────────────────────────
export const DEFAULT_DECLINE_RATE_DI = 0.08;
export const DEFAULT_B_FACTOR = 0.5;
export const DEFAULT_FORECAST_MONTHS = 240;

// ─── Alarm Thresholds ────────────────────────────────────────────────────────
export const ALARM_WELLHEAD_PRESSURE_HIGH_PSIA = 3000;
export const ALARM_WELLHEAD_PRESSURE_LOW_PSIA = 50;
export const ALARM_TEMPERATURE_HIGH_F = 250;
export const ALARM_FLOW_RATE_LOW_BPD = 10;
export const ALARM_SAND_RATE_HIGH_MGL = 100;
export const ALARM_VIBRATION_HIGH_G = 5.0;
export const ALARM_MOTOR_TEMP_HIGH_F = 300;
export const ALARM_CURRENT_IMBALANCE_PCT = 10;

// ─── Pagination ───────────────────────────────────────────────────────────────
export const PAGE_SIZE_DEFAULT = 25;
export const PAGE_SIZE_MAX = 200;

// ─── File Upload ──────────────────────────────────────────────────────────────
export const MAX_UPLOAD_SIZE_MB = 16;
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

// ─── Rate Limiting ────────────────────────────────────────────────────────────
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_API = 200;
export const RATE_LIMIT_MAX_AUTH = 20;
export const RATE_LIMIT_MAX_PHYSICS = 120;

// ─── WebSocket / Real-time ────────────────────────────────────────────────────
export const WS_HEARTBEAT_INTERVAL_MS = 30_000;
export const WS_RECONNECT_DELAY_MS = 5_000;
export const WS_MAX_RECONNECT_ATTEMPTS = 10;
export const SSE_TELEMETRY_INTERVAL_MS = 5_000;
export const TELEMETRY_HISTORY_POINTS = 60;

// ─── Units ────────────────────────────────────────────────────────────────────
export const UNIT_CONVERSIONS = {
  bblToM3: 0.158987,
  psiToBar: 0.0689476,
  ftToM: 0.3048,
  lbFt3ToKgM3: 16.0185,
  fpsMps: 0.3048,
  mscfdToMm3d: 0.028317,
  degFToDegC: (f: number) => (f - 32) * 5 / 9,
  degCToDegF: (c: number) => c * 9 / 5 + 32,
} as const;

// ─── Export / Reporting ───────────────────────────────────────────────────────
export const EXPORT_FORMATS = ["csv", "json", "pdf"] as const;
export const EXPORT_MAX_ROWS = 50_000;
export const REPORT_LOGO_URL = "https://og-rmm.io/assets/logo.png";

// ─── Compliance ───────────────────────────────────────────────────────────────
export const IEC_62443_LEVELS = ["SL-0", "SL-1", "SL-2", "SL-3", "SL-4"] as const;
export const API_STANDARDS = ["API-14E", "API-RP-14C", "API-RP-500", "API-RP-505"] as const;
export const ISO_STANDARDS = ["ISO-45001", "ISO-14001", "ISO-9001", "ISO-27001"] as const;

// ─── glTF / 3D Asset CDN URLs ─────────────────────────────────────────────────
export const GLTF_CDN_BASE = "https://cdn.og-rmm.io/assets/3d";
export const GLTF_MODELS = {
  ESP_PUMP:    `${GLTF_CDN_BASE}/esp_pump.gltf`,
  WELLHEAD:    `${GLTF_CDN_BASE}/wellhead.gltf`,
  MANIFOLD:    `${GLTF_CDN_BASE}/manifold.gltf`,
  FPSO:        `${GLTF_CDN_BASE}/fpso.gltf`,
  SUBSEA_TREE: `${GLTF_CDN_BASE}/subsea_tree.gltf`,
} as const;

// ─── Health Check ─────────────────────────────────────────────────────────────
export const HEALTH_CHECK_SERVICES = [
  { name: "physics-engine", url: "http://localhost:4001/health" },
  { name: "ml-service",     url: "http://localhost:4003/health" },
  { name: "influxdb",       url: "http://localhost:8086/health" },
  { name: "grafana",        url: "http://localhost:3001/api/health" },
] as const;
