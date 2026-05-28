import {
  boolean,
  integer,
  json,
  numeric,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// -------------------------------------------
// ENUMS
// -------------------------------------------
export const userRoleEnum = pgEnum("user_role", ["user", "admin", "operator", "supervisor", "engineer"]);
export const wellStatusEnum = pgEnum("well_status", ["ACTIVE", "SHUT_IN", "DRILLING", "WORKOVER", "ABANDONED"]);
export const wellTypeEnum = pgEnum("well_type", ["OIL", "GAS", "WATER_INJECTION", "DISPOSAL", "OBSERVATION"]);
export const dataClassificationEnum = pgEnum("data_classification", ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"]);
export const telemetryProtocolEnum = pgEnum("telemetry_protocol", ["MQTT", "MODBUS_TCP", "MODBUS_RTU", "OPC_UA", "DNP3", "HART"]);
export const alarmStateEnum = pgEnum("alarm_state", ["UNACKNOWLEDGED", "ACKNOWLEDGED", "CLEARED", "SUPPRESSED"]);
export const alarmConditionEnum = pgEnum("alarm_condition", ["GT", "LT", "GTE", "LTE"]);
export const workoverJobTypeEnum = pgEnum("workover_job_type", ["PUMP_REPLACEMENT", "TUBING_REPAIR", "STIMULATION", "PERFORATION", "SAND_CONTROL", "SCALE_REMOVAL", "CALIBRATION", "INSPECTION", "OTHER"]);
export const workoverStatusEnum = pgEnum("workover_status", ["PLANNED", "MOBILIZING", "IN_PROGRESS", "SUSPENDED", "COMPLETED", "CANCELLED"]);
export const workoverPriorityEnum = pgEnum("workover_priority", ["CRITICAL", "HIGH", "MEDIUM", "LOW"]);
export const workoverCostCategoryEnum = pgEnum("workover_cost_category", ["LABOR", "EQUIPMENT", "MATERIALS", "TRANSPORT", "THIRD_PARTY", "OTHER"]);
export const sensorTypeEnum = pgEnum("sensor_type", ["PRESSURE", "TEMPERATURE", "FLOW", "LEVEL", "VIBRATION", "CURRENT", "VOLTAGE", "GAS_DETECTOR", "SAFETY_VALVE"]);
export const calibrationStatusEnum = pgEnum("calibration_status", ["CURRENT", "DUE_SOON", "OVERDUE", "IN_PROGRESS", "FAILED"]);
export const permitTypeEnum = pgEnum("permit_type", ["HOT_WORK", "CONFINED_SPACE", "ELECTRICAL", "EXCAVATION", "RADIATION", "COLD_WORK", "WORKING_AT_HEIGHT"]);
export const permitStatusEnum = pgEnum("permit_status", ["DRAFT", "PENDING", "APPROVED", "ACTIVE", "CLOSED", "CANCELLED", "EXPIRED"]);
export const fpsoStatusEnum = pgEnum("fpso_status", ["OPERATIONAL", "MAINTENANCE", "STANDBY", "OFFHIRE"]);
export const hpuStatusEnum = pgEnum("hpu_status", ["RUNNING", "STANDBY", "FAULT", "MAINTENANCE"]);
export const pumpStatusEnum = pgEnum("pump_status", ["RUNNING", "STANDBY", "FAULT"]);
export const treeStatusEnum = pgEnum("tree_status", ["ACTIVE", "SHUT_IN", "MAINTENANCE", "ABANDONED"]);
export const siteStatusEnum = pgEnum("site_status", ["ONLINE", "DEGRADED", "OFFLINE", "BUFFERING", "MAINTENANCE"]);
export const compressorStatusEnum = pgEnum("compressor_status", ["RUNNING", "STANDBY", "FAULT", "OFF"]);
export const commandTypeEnum = pgEnum("command_type", ["VALVE_OPEN", "VALVE_CLOSE", "CHOKE_SETPOINT", "PRESSURE_SETPOINT", "PUMP_START", "PUMP_STOP", "ESD_ACTIVATE", "ESD_RESET"]);
export const commandStatusEnum = pgEnum("command_status", ["PENDING", "SENT", "ACKNOWLEDGED", "EXECUTED", "FAILED", "CANCELLED"]);
export const entryTypeEnum = pgEnum("entry_type", ["REVENUE", "ROYALTY", "OPEX", "CAPEX", "TAX", "SETTLEMENT", "ADJUSTMENT"]);
export const entryStatusEnum = pgEnum("entry_status", ["PENDING", "POSTED", "SETTLED", "REVERSED"]);
export const allocationMethodEnum = pgEnum("allocation_method", ["WELL_TEST", "METERED", "CALCULATED", "ESTIMATED"]);
export const shiftTypeEnum = pgEnum("shift_type", ["MORNING", "EVENING", "NIGHT"]);
export const reportTypeEnum = pgEnum("report_type", ["API_14C", "BSEE_OGOR", "EPA_SUBPART_W", "MOCCAE", "ADNOC_HSE", "KOC_ENV", "NCSC_INCIDENT"]);
export const reportStatusEnum = pgEnum("report_status", ["DRAFT", "PENDING", "SUBMITTED", "ACCEPTED", "REJECTED"]);
export const reportLanguageEnum = pgEnum("report_language", ["EN", "AR", "BILINGUAL"]);
export const incidentTypeEnum = pgEnum("incident_type", ["NEAR_MISS", "FIRST_AID", "RECORDABLE", "LTI", "FATALITY", "SPILL", "FIRE", "EXPLOSION", "RELEASE"]);
export const incidentSeverityEnum = pgEnum("incident_severity", ["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const securityEventTypeEnum = pgEnum("security_event_type", ["INTRUSION_ATTEMPT", "MALWARE", "UNAUTHORIZED_ACCESS", "POLICY_VIOLATION", "ANOMALY", "PHISHING", "RANSOMWARE", "SCADA_ATTACK"]);
export const mlModelTypeEnum = pgEnum("ml_model_type", ["ESP_FAILURE", "ANOMALY_DETECTION", "PRODUCTION_FORECAST", "DECLINE_CURVE"]);

// -------------------------------------------
// USERS
// -------------------------------------------
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("open_id", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),  // E.164 format for Twilio SMS escalation
  loginMethod: varchar("login_method", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// -------------------------------------------
// WELLS
// -------------------------------------------
export const wells = pgTable("wells", {
  id: serial("id").primaryKey(),
  wellId: varchar("well_id", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  field: varchar("field", { length: 64 }).notNull(),
  basin: varchar("basin", { length: 64 }),
  country: varchar("country", { length: 64 }).default("Kuwait"),
  latitude: numeric("latitude", { precision: 10, scale: 6 }),
  longitude: numeric("longitude", { precision: 10, scale: 6 }),
  status: wellStatusEnum("status").default("ACTIVE").notNull(),
  wellType: wellTypeEnum("well_type").default("OIL").notNull(),
  depth: integer("depth"),
  completionDate: timestamp("completion_date"),
  operator: varchar("operator", { length: 128 }),
  apiNumber: varchar("api_number", { length: 32 }),
  dataClassification: dataClassificationEnum("data_classification").default("INTERNAL").notNull(),
  // ── Reservoir / production physics (for Digital Twin) ──────────────────────
  reservoirPressurePsi: real("reservoir_pressure_psi"),
  qMaxBpd: real("q_max_bpd"),
  fluidGradientPsiPerFt: real("fluid_gradient_psi_per_ft"),
  skinFactor: real("skin_factor"),
  perforationIntervalFt: real("perforation_interval_ft"),
  waterCutFraction: real("water_cut_fraction"),
  gorScfPerBbl: real("gor_scf_per_bbl"),
  espFrequencyHz: real("esp_frequency_hz"),
  // ── Extended physics columns (v20.0) ──────────────────────────────────────
  tubingIdIn: real("tubing_id_in"),
  casingIdIn: real("casing_id_in"),
  permeabilityMd: real("permeability_md"),
  porosityFraction: real("porosity_fraction"),
  netPayFt: real("net_pay_ft"),
  // ───────────────────────────────────────────────────────────────────────────
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type Well = typeof wells.$inferSelect;
export type InsertWell = typeof wells.$inferInsert;

// -------------------------------------------
// TELEMETRY
// -------------------------------------------
export const telemetryReadings = pgTable("telemetry_readings", {
  id: serial("id").primaryKey(),
  wellId: varchar("well_id", { length: 32 }).notNull(),
  tubingPressure: real("tubing_pressure"),
  casingPressure: real("casing_pressure"),
  flowRate: real("flow_rate"),
  waterCut: real("water_cut"),
  gasOilRatio: real("gas_oil_ratio"),
  espCurrent: real("esp_current"),
  espFrequency: real("esp_frequency"),
  espVibration: real("esp_vibration"),
  espMotorTemp: real("esp_motor_temp"),
  espInletPressure: real("esp_inlet_pressure"),
  espDischargePressure: real("esp_discharge_pressure"),
  wellheadTemp: real("wellhead_temp"),
  chokePosition: real("choke_position"),
  oilRate: real("oil_rate"),
  gasRate: real("gas_rate"),
  waterRate: real("water_rate"),
  gor: real("gor"),
  bhp: real("bhp"),
  bht: real("bht"),
  protocol: telemetryProtocolEnum("protocol").default("MQTT"),
  quality: integer("quality").default(100),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
});
export type TelemetryReading = typeof telemetryReadings.$inferSelect;

// -------------------------------------------
// ALARMS
// -------------------------------------------
export const alarms = pgTable("alarms", {
  id: serial("id").primaryKey(),
  alarmId: varchar("alarm_id", { length: 32 }).notNull().unique(),
  wellId: varchar("well_id", { length: 32 }).notNull(),
  tag: varchar("tag", { length: 64 }).notNull(),
  description: text("description").notNull(),
  severity: integer("severity").notNull(),
  state: alarmStateEnum("state").default("UNACKNOWLEDGED").notNull(),
  value: real("value"),
  setpoint: real("setpoint"),
  unit: varchar("unit", { length: 16 }),
  acknowledgedBy: varchar("acknowledged_by", { length: 128 }),
  acknowledgedAt: timestamp("acknowledged_at"),
  suppressedUntil: timestamp("suppressed_until"),
  clearedAt: timestamp("cleared_at"),
  isa182Category: varchar("isa182_category", { length: 32 }),
  isStanding: boolean("is_standing").default(false),
  isChattering: boolean("is_chattering").default(false),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type Alarm = typeof alarms.$inferSelect;
export type InsertAlarm = typeof alarms.$inferInsert;

// -------------------------------------------
// ALARM RULES (SCADA setpoint-based evaluation)
// -------------------------------------------
export const alarmRules = pgTable("alarm_rules", {
  id: serial("id").primaryKey(),
  ruleId: varchar("rule_id", { length: 32 }).notNull().unique(),
  wellId: varchar("well_id", { length: 32 }).notNull(),
  tag: varchar("tag", { length: 64 }).notNull(),
  sensorField: varchar("sensor_field", { length: 64 }).notNull(),
  condition: alarmConditionEnum("condition").notNull(),
  threshold: real("threshold").notNull(),
  deadBand: real("dead_band").default(0),
  severity: integer("severity").notNull(),
  description: text("description").notNull(),
  unit: varchar("unit", { length: 16 }),
  isa182Category: varchar("isa182_category", { length: 32 }).default("PROCESS"),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type AlarmRule = typeof alarmRules.$inferSelect;
export type InsertAlarmRule = typeof alarmRules.$inferInsert;

// -------------------------------------------
// PRODUCTION
// -------------------------------------------
export const productionRecords = pgTable("production_records", {
  id: serial("id").primaryKey(),
  wellId: varchar("well_id", { length: 32 }).notNull(),
  date: timestamp("date").notNull(),
  oilBbls: real("oil_bbls").default(0),
  gasMmscf: real("gas_mmscf").default(0),
  waterBbls: real("water_bbls").default(0),
  injectionBbls: real("injection_bbls").default(0),
  uptimeHours: real("uptime_hours").default(24),
  downtime: text("downtime"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ProductionRecord = typeof productionRecords.$inferSelect;

// -------------------------------------------
// WORKOVERS
// -------------------------------------------
export const workovers = pgTable("workovers", {
  id: serial("id").primaryKey(),
  jobId: varchar("job_id", { length: 32 }).notNull().unique(),
  wellId: varchar("well_id", { length: 32 }).notNull(),
  jobType: workoverJobTypeEnum("job_type").notNull(),
  status: workoverStatusEnum("status").default("PLANNED").notNull(),
  priority: workoverPriorityEnum("priority").default("MEDIUM").notNull(),
  description: text("description"),
  trigger: text("trigger"),
  assignedTo: varchar("assigned_to", { length: 128 }),
  estimatedDays: integer("estimated_days"),
  actualDays: integer("actual_days"),
  budgetUsd: numeric("budget_usd", { precision: 12, scale: 2 }),
  actualCostUsd: numeric("actual_cost_usd", { precision: 12, scale: 2 }),
  temporalWorkflowId: varchar("temporal_workflow_id", { length: 128 }),
  tigerBeetleRef: varchar("tiger_beetle_ref", { length: 64 }),
  fromCalibration: boolean("from_calibration").default(false),
  calibrationSensorId: varchar("calibration_sensor_id", { length: 64 }),
  startDate: timestamp("start_date"),
  completedDate: timestamp("completed_date"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type Workover = typeof workovers.$inferSelect;
export type InsertWorkover = typeof workovers.$inferInsert;

export const workoverCosts = pgTable("workover_costs", {
  id: serial("id").primaryKey(),
  workoverId: integer("workover_id").notNull(),
  category: workoverCostCategoryEnum("category").notNull(),
  description: text("description"),
  amountUsd: numeric("amount_usd", { precision: 12, scale: 2 }).notNull(),
  vendor: varchar("vendor", { length: 128 }),
  invoiceRef: varchar("invoice_ref", { length: 64 }),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
});
export type WorkoverCost = typeof workoverCosts.$inferSelect;

// -------------------------------------------
// CALIBRATION
// -------------------------------------------
export const calibrationRecords = pgTable("calibration_records", {
  id: serial("id").primaryKey(),
  sensorId: varchar("sensor_id", { length: 64 }).notNull(),
  wellId: varchar("well_id", { length: 32 }).notNull(),
  sensorType: sensorTypeEnum("sensor_type").notNull(),
  tag: varchar("tag", { length: 64 }).notNull(),
  status: calibrationStatusEnum("status").default("CURRENT").notNull(),
  qualityScore: integer("quality_score").default(100),
  driftPct: real("drift_pct").default(0),
  lastCalibratedAt: timestamp("last_calibrated_at"),
  nextDueAt: timestamp("next_due_at"),
  intervalDays: integer("interval_days").default(90),
  certificateRef: varchar("certificate_ref", { length: 64 }),
  nistTraceable: boolean("nist_traceable").default(true),
  technician: varchar("technician", { length: 128 }),
  notes: text("notes"),
  workoverId: integer("workover_id"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type CalibrationRecord = typeof calibrationRecords.$inferSelect;
export type InsertCalibrationRecord = typeof calibrationRecords.$inferInsert;

// -------------------------------------------
// PERMITS TO WORK
// -------------------------------------------
export const permits = pgTable("permits", {
  id: serial("id").primaryKey(),
  permitId: varchar("permit_id", { length: 32 }).notNull().unique(),
  wellId: varchar("well_id", { length: 32 }).notNull(),
  permitType: permitTypeEnum("permit_type").notNull(),
  status: permitStatusEnum("status").default("DRAFT").notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  location: varchar("location", { length: 256 }),
  requestedBy: varchar("requested_by", { length: 128 }).notNull(),
  approvedBy: varchar("approved_by", { length: 128 }),
  approvedAt: timestamp("approved_at"),
  closedBy: varchar("closed_by", { length: 128 }),
  closedAt: timestamp("closed_at"),
  validFrom: timestamp("valid_from"),
  validUntil: timestamp("valid_until"),
  sifBypassRequired: boolean("sif_bypass_required").default(false),
  sifBypassed: varchar("sif_bypassed", { length: 256 }),
  hazards: json("hazards"),
  controls: json("controls"),
  isolations: json("isolations"),
  temporalWorkflowId: varchar("temporal_workflow_id", { length: 128 }),
  issuerSignatureUrl: text("issuer_signature_url"),
  approverSignatureUrl: text("approver_signature_url"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type Permit = typeof permits.$inferSelect;
export type InsertPermit = typeof permits.$inferInsert;

// -------------------------------------------
// FPSO / OFFSHORE ASSETS
// -------------------------------------------
export const fpsoVessels = pgTable("fpso_vessels", {
  id: serial("id").primaryKey(),
  vesselId: varchar("vessel_id", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  imoNumber: varchar("imo_number", { length: 16 }),
  field: varchar("field", { length: 64 }),
  status: fpsoStatusEnum("status").default("OPERATIONAL").notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 6 }),
  longitude: numeric("longitude", { precision: 10, scale: 6 }),
  storageBbls: integer("storage_bbls"),
  currentInventoryBbls: integer("current_inventory_bbls"),
  processingCapacityBpd: integer("processing_capacity_bpd"),
  currentProductionBpd: integer("current_production_bpd"),
  dataClassification: dataClassificationEnum("data_classification").default("CONFIDENTIAL").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type FpsoVessel = typeof fpsoVessels.$inferSelect;

export const hpuUnits = pgTable("hpu_units", {
  id: serial("id").primaryKey(),
  hpuId: varchar("hpu_id", { length: 32 }).notNull().unique(),
  fpsoId: varchar("fpso_id", { length: 32 }),
  wellId: varchar("well_id", { length: 32 }),
  name: varchar("name", { length: 128 }).notNull(),
  status: hpuStatusEnum("status").default("RUNNING").notNull(),
  systemPressureBar: real("system_pressure_bar"),
  reservoirLevelPct: real("reservoir_level_pct"),
  pumpAStatus: pumpStatusEnum("pump_a_status").default("RUNNING"),
  pumpBStatus: pumpStatusEnum("pump_b_status").default("STANDBY"),
  filterDpBar: real("filter_dp_bar"),
  oilTempC: real("oil_temp_c"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type HpuUnit = typeof hpuUnits.$inferSelect;

export const subseaTrees = pgTable("subsea_trees", {
  id: serial("id").primaryKey(),
  treeId: varchar("tree_id", { length: 32 }).notNull().unique(),
  wellId: varchar("well_id", { length: 32 }),
  fpsoId: varchar("fpso_id", { length: 32 }),
  name: varchar("name", { length: 128 }).notNull(),
  status: treeStatusEnum("status").default("ACTIVE").notNull(),
  waterDepthM: integer("water_depth_m"),
  latitude: numeric("latitude", { precision: 10, scale: 6 }),
  longitude: numeric("longitude", { precision: 10, scale: 6 }),
  flowlineId: varchar("flowline_id", { length: 32 }),
  umbilicalId: varchar("umbilical_id", { length: 32 }),
  masterValveOpen: boolean("master_valve_open").default(true),
  wingValveOpen: boolean("wing_valve_open").default(true),
  swabValveOpen: boolean("swab_valve_open").default(false),
  annulusMasterOpen: boolean("annulus_master_open").default(true),
  wellheadPressureBar: real("wellhead_pressure_bar"),
  flowTempC: real("flow_temp_c"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type SubseaTree = typeof subseaTrees.$inferSelect;

// -------------------------------------------
// SITE CONNECTIVITY
// -------------------------------------------
export const siteConnectivity = pgTable("site_connectivity", {
  id: serial("id").primaryKey(),
  siteId: varchar("site_id", { length: 32 }).notNull().unique(),
  wellId: varchar("well_id", { length: 32 }),
  siteName: varchar("site_name", { length: 128 }).notNull(),
  status: siteStatusEnum("status").default("ONLINE").notNull(),
  protocol: telemetryProtocolEnum("protocol").default("MQTT"),
  linkQualityPct: integer("link_quality_pct").default(100),
  latencyMs: integer("latency_ms"),
  bufferDepth: integer("buffer_depth").default(0),
  lastSeenAt: timestamp("last_seen_at"),
  isSolarPowered: boolean("is_solar_powered").default(false),
  solarVolts: real("solar_volts"),
  batteryPct: real("battery_pct"),
  compressorStatus: compressorStatusEnum("compressor_status"),
  edgeAgentVersion: varchar("edge_agent_version", { length: 32 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type SiteConnectivity = typeof siteConnectivity.$inferSelect;

// -------------------------------------------
// ACTUATOR COMMANDS
// -------------------------------------------
export const actuatorCommands = pgTable("actuator_commands", {
  id: serial("id").primaryKey(),
  commandId: varchar("command_id", { length: 32 }).notNull().unique(),
  wellId: varchar("well_id", { length: 32 }).notNull(),
  assetId: varchar("asset_id", { length: 64 }).notNull(),
  assetName: varchar("asset_name", { length: 128 }),
  commandType: commandTypeEnum("command_type").notNull(),
  targetValue: real("target_value"),
  status: commandStatusEnum("status").default("PENDING").notNull(),
  issuedBy: varchar("issued_by", { length: 128 }).notNull(),
  approvedBy: varchar("approved_by", { length: 128 }),
  confirmationCode: varchar("confirmation_code", { length: 32 }),
  executedAt: timestamp("executed_at"),
  failureReason: text("failure_reason"),
  auditTrail: json("audit_trail"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type ActuatorCommand = typeof actuatorCommands.$inferSelect;
export type InsertActuatorCommand = typeof actuatorCommands.$inferInsert;

// -------------------------------------------
// FINANCIAL LEDGER
// -------------------------------------------
export const financialEntries = pgTable("financial_entries", {
  id: serial("id").primaryKey(),
  entryId: varchar("entry_id", { length: 32 }).notNull().unique(),
  wellId: varchar("well_id", { length: 32 }),
  entryType: entryTypeEnum("entry_type").notNull(),
  description: text("description").notNull(),
  amountUsd: numeric("amount_usd", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 8 }).default("USD"),
  counterparty: varchar("counterparty", { length: 128 }),
  tigerBeetleRef: varchar("tiger_beetle_ref", { length: 64 }),
  mojalooopRef: varchar("mojalooop_ref", { length: 64 }),
  status: entryStatusEnum("status").default("PENDING").notNull(),
  valueDate: timestamp("value_date"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type FinancialEntry = typeof financialEntries.$inferSelect;
export type InsertFinancialEntry = typeof financialEntries.$inferInsert;

// -------------------------------------------
// PRODUCTION ALLOCATION
// -------------------------------------------
export const allocationRecords = pgTable("allocation_records", {
  id: serial("id").primaryKey(),
  wellId: varchar("well_id", { length: 32 }).notNull(),
  separatorId: varchar("separator_id", { length: 32 }),
  date: timestamp("date").notNull(),
  allocatedOilBbls: real("allocated_oil_bbls"),
  allocatedGasMmscf: real("allocated_gas_mmscf"),
  allocatedWaterBbls: real("allocated_water_bbls"),
  allocationFactor: real("allocation_factor"),
  method: allocationMethodEnum("method").default("WELL_TEST"),
  imbalanceBbls: real("imbalance_bbls").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AllocationRecord = typeof allocationRecords.$inferSelect;

// -------------------------------------------
// SHIFT HANDOVER
// -------------------------------------------
export const shiftHandovers = pgTable("shift_handovers", {
  id: serial("id").primaryKey(),
  shiftId: varchar("shift_id", { length: 32 }).notNull().unique(),
  shiftType: shiftTypeEnum("shift_type").notNull(),
  date: timestamp("date").notNull(),
  outgoingOperator: varchar("outgoing_operator", { length: 128 }).notNull(),
  incomingOperator: varchar("incoming_operator", { length: 128 }),
  signedOffAt: timestamp("signed_off_at"),
  emailSentAt: timestamp("email_sent_at"),
  emailRecipient: varchar("email_recipient", { length: 320 }),
  summary: text("summary"),
  criticalAlarms: integer("critical_alarms").default(0),
  activeWorkovers: integer("active_workovers").default(0),
  productionBpd: real("production_bpd"),
  notes: text("notes"),
  hijriDate: varchar("hijri_date", { length: 32 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ShiftHandover = typeof shiftHandovers.$inferSelect;

// -------------------------------------------
// REGULATORY REPORTS
// -------------------------------------------
export const regulatoryReports = pgTable("regulatory_reports", {
  id: serial("id").primaryKey(),
  reportId: varchar("report_id", { length: 32 }).notNull().unique(),
  reportType: reportTypeEnum("report_type").notNull(),
  period: varchar("period", { length: 16 }).notNull(),
  status: reportStatusEnum("status").default("DRAFT").notNull(),
  language: reportLanguageEnum("language").default("EN"),
  generatedAt: timestamp("generated_at"),
  submittedAt: timestamp("submitted_at"),
  submittedBy: varchar("submitted_by", { length: 128 }),
  submissionRef: varchar("submission_ref", { length: 128 }),
  fileUrl: varchar("file_url", { length: 512 }),
  notes: text("notes"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type RegulatoryReport = typeof regulatoryReports.$inferSelect;
export type InsertRegulatoryReport = typeof regulatoryReports.$inferInsert;

// -------------------------------------------
// HSE INCIDENTS
// -------------------------------------------
export const hseIncidents = pgTable("hse_incidents", {
  id: serial("id").primaryKey(),
  incidentId: varchar("incident_id", { length: 32 }).notNull().unique(),
  wellId: varchar("well_id", { length: 32 }),
  incidentType: incidentTypeEnum("incident_type").notNull(),
  severity: incidentSeverityEnum("severity").default("LOW").notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  location: varchar("location", { length: 256 }),
  reportedBy: varchar("reported_by", { length: 128 }),
  investigatedBy: varchar("investigated_by", { length: 128 }),
  rootCause: text("root_cause"),
  correctiveActions: json("corrective_actions"),
  iogpCode: varchar("iogp_code", { length: 16 }),
  lostTimeDays: integer("lost_time_days").default(0),
  occurredAt: timestamp("occurred_at").notNull(),
  closedAt: timestamp("closed_at"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type HseIncident = typeof hseIncidents.$inferSelect;
export type InsertHseIncident = typeof hseIncidents.$inferInsert;

// -------------------------------------------
// CYBERSECURITY EVENTS
// -------------------------------------------
export const securityEvents = pgTable("security_events", {
  id: serial("id").primaryKey(),
  eventId: varchar("event_id", { length: 32 }).notNull().unique(),
  eventType: securityEventTypeEnum("event_type").notNull(),
  severity: incidentSeverityEnum("severity").default("LOW").notNull(),
  source: varchar("source", { length: 256 }),
  target: varchar("target", { length: 256 }),
  description: text("description"),
  cveId: varchar("cve_id", { length: 32 }),
  mitigated: boolean("mitigated").default(false),
  mitigatedAt: timestamp("mitigated_at"),
  mitigatedBy: varchar("mitigated_by", { length: 128 }),
  iec62443Zone: varchar("iec62443_zone", { length: 32 }),
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type SecurityEvent = typeof securityEvents.$inferSelect;

// -------------------------------------------
// ML PREDICTIONS
// -------------------------------------------
export const mlPredictions = pgTable("ml_predictions", {
  id: serial("id").primaryKey(),
  wellId: varchar("well_id", { length: 32 }).notNull(),
  modelType: mlModelTypeEnum("model_type").notNull(),
  healthScore: real("health_score"),
  failureProbability: real("failure_probability"),
  daysToFailure: integer("days_to_failure"),
  confidence: real("confidence"),
  anomalyScore: real("anomaly_score"),
  features: json("features"),
  recommendation: text("recommendation"),
  modelVersion: varchar("model_version", { length: 32 }),
  predictedAt: timestamp("predicted_at").defaultNow().notNull(),
});
export type MlPrediction = typeof mlPredictions.$inferSelect;

// -------------------------------------------
// DIGITAL TWIN SCENARIOS
// -------------------------------------------
export const digitalTwinScenarios = pgTable("digital_twin_scenarios", {
  id: serial("id").primaryKey(),
  scenarioId: varchar("scenario_id", { length: 32 }).notNull().unique(),
  wellId: varchar("well_id", { length: 32 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  reservoirPressurePsi: real("reservoir_pressure_psi"),
  skinFactor: real("skin_factor"),
  perforationInterval: real("perforation_interval"),
  espFrequencyHz: real("esp_frequency_hz"),
  chokeOpeningPct: real("choke_opening_pct"),
  predictedRateBpd: real("predicted_rate_bpd"),
  iprAofBpd: real("ipr_aof_bpd"),
  optimumRateBpd: real("optimum_rate_bpd"),
  createdBy: varchar("created_by", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type DigitalTwinScenario = typeof digitalTwinScenarios.$inferSelect;

// -------------------------------------------
// AUDIT LOG
// -------------------------------------------
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  userEmail: varchar("user_email", { length: 320 }),
  action: varchar("action", { length: 128 }).notNull(),
  resource: varchar("resource", { length: 64 }).notNull(),
  resourceId: varchar("resource_id", { length: 64 }),
  details: json("details"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: varchar("user_agent", { length: 512 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AuditLog = typeof auditLog.$inferSelect;

// -------------------------------------------
// SIL CERTIFICATION (IEC 61511 / TÜV)
// -------------------------------------------
export const silLevelEnum = pgEnum("sil_level", ["SIL_0", "SIL_1", "SIL_2", "SIL_3", "SIL_4"]);
export const silStatusEnum = pgEnum("sil_status", ["NOT_STARTED", "IN_PROGRESS", "COMPLIANT", "NON_COMPLIANT", "WAIVED"]);
export const silPhaseEnum = pgEnum("sil_phase", ["CONCEPT", "DESIGN", "IMPLEMENTATION", "OPERATION", "MODIFICATION", "DECOMMISSION"]);

export const silAssessments = pgTable("sil_assessments", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  scope: text("scope"),                                     // Systems/loops in scope
  targetSilLevel: silLevelEnum("target_sil_level").notNull().default("SIL_1"),
  achievedSilLevel: silLevelEnum("achieved_sil_level"),
  phase: silPhaseEnum("phase").notNull().default("CONCEPT"),
  assessorName: varchar("assessor_name", { length: 128 }),
  assessorOrg: varchar("assessor_org", { length: 128 }),   // e.g. "TÜV SÜD", "Exida"
  assessmentDate: timestamp("assessment_date"),
  nextReviewDate: timestamp("next_review_date"),
  pfdAvg: real("pfd_avg"),                                  // Average Probability of Failure on Demand
  pfhAvg: real("pfh_avg"),                                  // Probability of Failure per Hour
  rrf: real("rrf"),                                         // Risk Reduction Factor
  status: silStatusEnum("status").notNull().default("NOT_STARTED"),
  notes: text("notes"),
  createdBy: integer("created_by"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type SilAssessment = typeof silAssessments.$inferSelect;
export type InsertSilAssessment = typeof silAssessments.$inferInsert;

export const silControls = pgTable("sil_controls", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id").notNull(),
  clauseRef: varchar("clause_ref", { length: 32 }).notNull(),  // e.g. "IEC 61511-1:2016 §9.3"
  controlTitle: varchar("control_title", { length: 256 }).notNull(),
  controlDescription: text("control_description"),
  category: varchar("category", { length: 64 }).notNull(),     // e.g. "Management", "Design", "Verification"
  silApplicability: varchar("sil_applicability", { length: 32 }), // "SIL 1-3", "SIL 2-4", "All"
  status: silStatusEnum("status").notNull().default("NOT_STARTED"),
  evidence: text("evidence"),                                   // Description of evidence/artefacts
  evidenceUrl: text("evidence_url"),                            // Link to document/artefact
  gapDescription: text("gap_description"),
  remediationAction: text("remediation_action"),
  remediationOwner: varchar("remediation_owner", { length: 128 }),
  remediationDueDate: timestamp("remediation_due_date"),
  verifiedBy: varchar("verified_by", { length: 128 }),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type SilControl = typeof silControls.$inferSelect;
export type InsertSilControl = typeof silControls.$inferInsert;

export const silGaps = pgTable("sil_gaps", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id").notNull(),
  controlId: integer("control_id"),
  gapTitle: varchar("gap_title", { length: 256 }).notNull(),
  severity: varchar("severity", { length: 16 }).notNull().default("MEDIUM"), // CRITICAL, HIGH, MEDIUM, LOW
  description: text("description"),
  impactedSilLevel: silLevelEnum("impacted_sil_level"),
  remediationPlan: text("remediation_plan"),
  owner: varchar("owner", { length: 128 }),
  targetDate: timestamp("target_date"),
  closedAt: timestamp("closed_at"),
  status: varchar("status", { length: 32 }).notNull().default("OPEN"), // OPEN, IN_PROGRESS, CLOSED, ACCEPTED_RISK
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type SilGap = typeof silGaps.$inferSelect;
export type InsertSilGap = typeof silGaps.$inferInsert;

// -------------------------------------------
// USER ONBOARDING - invitations
// -------------------------------------------
export const invitationStatusEnum = pgEnum("invitation_status", ["pending", "accepted", "expired", "revoked"]);

export const userInvitations = pgTable("user_invitations", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  role: userRoleEnum("role").default("user").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  invitedBy: integer("invited_by"),
  inviterName: varchar("inviter_name", { length: 128 }),
  message: text("message"),
  status: invitationStatusEnum("status").default("pending").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  acceptedByUserId: integer("accepted_by_user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type UserInvitation = typeof userInvitations.$inferSelect;
export type InsertUserInvitation = typeof userInvitations.$inferInsert;

// -------------------------------------------
// DEVICE REGISTRY
// -------------------------------------------
export const deviceTypeEnum = pgEnum("device_type", ["RTU", "PLC", "SCADA_GATEWAY", "FLOW_COMPUTER", "SENSOR_HUB", "ESP_CONTROLLER", "WELLHEAD_CONTROLLER", "EDGE_NODE"]);
export const deviceStatusEnum = pgEnum("device_status", ["provisioning", "online", "offline", "maintenance", "decommissioned", "error"]);

export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  deviceId: varchar("device_id", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  deviceType: deviceTypeEnum("device_type").notNull(),
  manufacturer: varchar("manufacturer", { length: 128 }),
  model: varchar("model", { length: 128 }),
  serialNumber: varchar("serial_number", { length: 128 }),
  firmwareVersion: varchar("firmware_version", { length: 64 }),
  hardwareRevision: varchar("hardware_revision", { length: 32 }),
  wellId: varchar("well_id", { length: 64 }),
  fieldLocation: varchar("field_location", { length: 128 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  macAddress: varchar("mac_address", { length: 17 }),
  provisioningToken: varchar("provisioning_token", { length: 128 }),
  provisioningTokenExpiresAt: timestamp("provisioning_token_expires_at"),
  status: deviceStatusEnum("status").default("provisioning").notNull(),
  lastSeenAt: timestamp("last_seen_at"),
  lastHeartbeatAt: timestamp("last_heartbeat_at"),
  registeredAt: timestamp("registered_at").defaultNow().notNull(),
  registeredBy: integer("registered_by"),
  notes: text("notes"),
  tags: text("tags"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type Device = typeof devices.$inferSelect;
export type InsertDevice = typeof devices.$inferInsert;

// -------------------------------------------
// OTA FIRMWARE MANAGEMENT
// -------------------------------------------
export const otaStatusEnum = pgEnum("ota_status", ["draft", "scheduled", "in_progress", "completed", "failed", "cancelled", "rolled_back"]);
export const otaDeviceStatusEnum = pgEnum("ota_device_status", ["pending", "downloading", "installing", "verifying", "success", "failed", "skipped", "rolled_back"]);

export const firmwareVersions = pgTable("firmware_versions", {
  id: serial("id").primaryKey(),
  version: varchar("version", { length: 64 }).notNull(),
  deviceType: deviceTypeEnum("device_type").notNull(),
  releaseNotes: text("release_notes"),
  changelogUrl: text("changelog_url"),
  firmwareUrl: text("firmware_url").notNull(),
  firmwareSize: integer("firmware_size"),
  checksum: varchar("checksum", { length: 128 }),
  isStable: boolean("is_stable").default(false).notNull(),
  isDeprecated: boolean("is_deprecated").default(false).notNull(),
  minHardwareRevision: varchar("min_hardware_revision", { length: 32 }),
  uploadedBy: integer("uploaded_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type FirmwareVersion = typeof firmwareVersions.$inferSelect;
export type InsertFirmwareVersion = typeof firmwareVersions.$inferInsert;

export const otaCampaigns = pgTable("ota_campaigns", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  firmwareVersionId: integer("firmware_version_id").notNull(),
  targetDeviceType: deviceTypeEnum("target_device_type").notNull(),
  targetDeviceIds: text("target_device_ids"),
  rolloutStrategy: varchar("rollout_strategy", { length: 32 }).default("sequential").notNull(),
  canaryPercentage: integer("canary_percentage").default(10),
  status: otaStatusEnum("status").default("draft").notNull(),
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  totalDevices: integer("total_devices").default(0).notNull(),
  successCount: integer("success_count").default(0).notNull(),
  failureCount: integer("failure_count").default(0).notNull(),
  pendingCount: integer("pending_count").default(0).notNull(),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type OtaCampaign = typeof otaCampaigns.$inferSelect;
export type InsertOtaCampaign = typeof otaCampaigns.$inferInsert;

export const otaDeviceUpdates = pgTable("ota_device_updates", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  deviceId: integer("device_id").notNull(),
  deviceDeviceId: varchar("device_device_id", { length: 64 }),
  fromVersion: varchar("from_version", { length: 64 }),
  toVersion: varchar("to_version", { length: 64 }).notNull(),
  status: otaDeviceStatusEnum("status").default("pending").notNull(),
  progress: integer("progress").default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type OtaDeviceUpdate = typeof otaDeviceUpdates.$inferSelect;
export type InsertOtaDeviceUpdate = typeof otaDeviceUpdates.$inferInsert;


// -------------------------------------------
// PRODUCTION OPTIMIZATION - Decline Curve Analysis
// -------------------------------------------
export const declineCurveTypeEnum = pgEnum("decline_curve_type", ["EXPONENTIAL", "HYPERBOLIC", "HARMONIC"]);

export const declineCurveParams = pgTable("decline_curve_params", {
  id: serial("id").primaryKey(),
  wellId: varchar("well_id", { length: 32 }).notNull(),
  curveType: declineCurveTypeEnum("curve_type").default("EXPONENTIAL").notNull(),
  qi: real("qi").notNull(),
  di: real("di").notNull(),
  b: real("b").default(0),
  economicLimit: real("economic_limit").default(5),
  eurBbls: real("eur_bbls"),
  remainingLifeYears: real("remaining_life_years"),
  fittedAt: timestamp("fitted_at").defaultNow().notNull(),
  createdBy: varchar("created_by", { length: 128 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type DeclineCurveParam = typeof declineCurveParams.$inferSelect;
export type InsertDeclineCurveParam = typeof declineCurveParams.$inferInsert;

// -------------------------------------------
// WELL PHYSICS PARAMS (IPR / VLP calibration)
// -------------------------------------------
// Stores calibrated Vogel IPR + Beggs-Brill VLP parameters per well.
// Updated by the Digital Twin scenario engine when a scenario is accepted.
export const wellPhysicsParams = pgTable("well_physics_params", {
  id: serial("id").primaryKey(),
  wellId: varchar("well_id", { length: 32 }).notNull().unique(),
  // Vogel IPR
  reservoirPressurePsi: real("reservoir_pressure_psi").notNull().default(3200),
  qMaxBpd: real("q_max_bpd").notNull().default(1200),
  skinFactor: real("skin_factor").default(0),
  perforationIntervalFt: real("perforation_interval_ft").default(120),
  // Beggs-Brill VLP
  tvdFt: integer("tvd_ft").default(8500),
  fluidGradientPsiPerFt: real("fluid_gradient_psi_per_ft").default(0.433),
  waterCutFraction: real("water_cut_fraction").default(0.25),
  gorScfPerBbl: real("gor_scf_per_bbl").default(450),
  // ESP
  espFrequencyHz: real("esp_frequency_hz").default(50),
  espMinFreqHz: real("esp_min_freq_hz").default(35),
  espMaxFreqHz: real("esp_max_freq_hz").default(65),
  // Decline curve (Arps)
  qi: real("qi").default(1200),
  di: real("di").default(0.08),
  b: real("b").default(0),
  curveType: declineCurveTypeEnum("curve_type").default("EXPONENTIAL"),
  // Calibration metadata
  calibratedAt: timestamp("calibrated_at").defaultNow().notNull(),
  calibratedBy: varchar("calibrated_by", { length: 128 }),
  confidenceScore: real("confidence_score").default(0.75),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type WellPhysicsParam = typeof wellPhysicsParams.$inferSelect;
export type InsertWellPhysicsParam = typeof wellPhysicsParams.$inferInsert;

// -------------------------------------------
// PWA PUSH SUBSCRIPTIONS
// -------------------------------------------
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 128 }).notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscriptionRow = typeof pushSubscriptions.$inferInsert;

// -------------------------------------------
// OPENADDR 3.1 DEMAND RESPONSE — Programs, Events, VENs
// -------------------------------------------
export const drProgramStatusEnum = pgEnum("dr_program_status", ["ACTIVE", "INACTIVE", "DRAFT"]);
export const drEventStatusEnum = pgEnum("dr_event_status", ["SCHEDULED", "ACTIVE", "CANCELLED", "COMPLETED"]);
export const drSignalTypeEnum = pgEnum("dr_signal_type", ["SIMPLE", "PRICE", "LOAD", "EMERGENCY"]);

export const drPrograms = pgTable("dr_programs", {
  id: serial("id").primaryKey(),
  programId: varchar("program_id", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  programType: varchar("program_type", { length: 64 }).notNull().default("DEMAND_RESPONSE"),
  country: varchar("country", { length: 8 }).notNull().default("US"),
  principalProgram: boolean("principal_program").default(false).notNull(),
  bindingEvents: boolean("binding_events").default(true).notNull(),
  localPrice: boolean("local_price").default(false).notNull(),
  timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),
  status: drProgramStatusEnum("status").default("ACTIVE").notNull(),
  description: text("description"),
  intervalPeriod: varchar("interval_period", { length: 32 }).default("PT1H"),
  payloadDescriptors: text("payload_descriptors"),
  targets: text("targets"),
  createdBy: varchar("created_by", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type DrProgram = typeof drPrograms.$inferSelect;
export type InsertDrProgram = typeof drPrograms.$inferInsert;

export const drEvents = pgTable("dr_events", {
  id: serial("id").primaryKey(),
  eventId: varchar("event_id", { length: 64 }).notNull().unique(),
  programId: varchar("program_id", { length: 64 }).notNull(),
  eventName: varchar("event_name", { length: 128 }).notNull(),
  status: drEventStatusEnum("status").default("SCHEDULED").notNull(),
  priority: integer("priority").default(0).notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  signalType: drSignalTypeEnum("signal_type").default("SIMPLE").notNull(),
  payloadValue: real("payload_value").notNull().default(0),
  payloadUnit: varchar("payload_unit", { length: 32 }).default("kW"),
  targets: text("targets"),
  intervalPeriod: varchar("interval_period", { length: 32 }).default("PT1H"),
  reportRequired: boolean("report_required").default(false).notNull(),
  createdBy: varchar("created_by", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type DrEvent = typeof drEvents.$inferSelect;
export type InsertDrEvent = typeof drEvents.$inferInsert;

export const drVens = pgTable("dr_vens", {
  id: serial("id").primaryKey(),
  venId: varchar("ven_id", { length: 64 }).notNull().unique(),
  venName: varchar("ven_name", { length: 128 }).notNull(),
  programId: varchar("program_id", { length: 64 }).notNull(),
  facilityId: varchar("facility_id", { length: 64 }),
  resourceType: varchar("resource_type", { length: 64 }).default("COMPRESSOR"),
  maxLoadKw: real("max_load_kw"),
  currentLoadKw: real("current_load_kw"),
  availableKw: real("available_kw"),
  status: varchar("status", { length: 32 }).default("REGISTERED").notNull(),
  capabilities: text("capabilities"),
  lastHeartbeat: timestamp("last_heartbeat"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type DrVen = typeof drVens.$inferSelect;
export type InsertDrVen = typeof drVens.$inferInsert;


// OpenSTEF Model Metrics
export const modelMetrics = pgTable("model_metrics", {
  id: serial("id").primaryKey(),
  tag: varchar("tag", { length: 128 }).notNull(),
  modelType: varchar("model_type", { length: 64 }).default("xgb_quantile").notNull(),
  mae: real("mae"),
  rmse: real("rmse"),
  mape: real("mape"),
  bias: real("bias"),
  r2: real("r2"),
  trainingSamples: integer("training_samples"),
  horizon: integer("horizon").default(48),
  trainedAt: timestamp("trained_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ModelMetric = typeof modelMetrics.$inferSelect;
export type InsertModelMetric = typeof modelMetrics.$inferInsert;

// DR Event Audit Log
export const drAuditLog = pgTable("dr_audit_log", {
  id: serial("id").primaryKey(),
  eventId: varchar("event_id", { length: 64 }).notNull(),
  programId: varchar("program_id", { length: 64 }),
  venId: varchar("ven_id", { length: 64 }),
  tag: varchar("tag", { length: 128 }),
  setpointKw: real("setpoint_kw"),
  baselineKw: real("baseline_kw"),
  actualKw: real("actual_kw"),
  deviationKw: real("deviation_kw"),
  curtailmentKw: real("curtailment_kw"),
  opcuaStatus: varchar("opcua_status", { length: 32 }).default("PENDING"),
  dispatchedAt: timestamp("dispatched_at").defaultNow().notNull(),
  confirmedAt: timestamp("confirmed_at"),
  regulatoryRef: varchar("regulatory_ref", { length: 128 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type DrAuditEntry = typeof drAuditLog.$inferSelect;
export type InsertDrAuditEntry = typeof drAuditLog.$inferInsert;


// -------------------------------------------
// INCIDENT TRIAGE (IEC 62443 S21.2)
// -------------------------------------------
export const incidentTriage = pgTable("incident_triage", {
  id: serial("id").primaryKey(),
  eventId: varchar("event_id", { length: 32 }).notNull().unique(),
  workflowId: varchar("workflow_id", { length: 128 }),
  status: varchar("status", { length: 32 }).default("PENDING").notNull(),
  openCtiScore: integer("opencti_score").default(0),
  tlpClassification: varchar("tlp_classification", { length: 16 }).default("TLP:WHITE"),
  finalSeverity: varchar("final_severity", { length: 16 }),
  nodeIsolated: boolean("node_isolated").default(false),
  networkPolicyId: varchar("network_policy_id", { length: 128 }),
  alertGroupId: varchar("alert_group_id", { length: 128 }),
  recommendedAction: text("recommended_action"),
  nodeReadmittedAt: timestamp("node_readmitted_at"),
  nodeReadmittedBy: varchar("node_readmitted_by", { length: 128 }),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type IncidentTriage = typeof incidentTriage.$inferSelect;
export type InsertIncidentTriage = typeof incidentTriage.$inferInsert;

// -------------------------------------------
// MOJALOOP SETTLEMENTS (FRQ-011, BRQ-003)
// -------------------------------------------
export const mojaloopSettlements = pgTable("mojaloop_settlements", {
  id: serial("id").primaryKey(),
  settlementId: varchar("settlement_id", { length: 32 }).notNull().unique(),
  counterparty: varchar("counterparty", { length: 256 }).notNull(),
  counterpartyIdType: varchar("counterparty_id_type", { length: 32 }).default("ACCOUNT_ID").notNull(),
  counterpartyIdValue: varchar("counterparty_id_value", { length: 128 }).notNull(),
  amountUsd: varchar("amount_usd", { length: 32 }).notNull(),
  currency: varchar("currency", { length: 8 }).default("USD").notNull(),
  settlementType: varchar("settlement_type", { length: 32 }).notNull(),
  wellId: varchar("well_id", { length: 32 }),
  status: varchar("status", { length: 32 }).default("PENDING").notNull(),
  mojaloopTransferId: varchar("mojaloop_transfer_id", { length: 128 }),
  mojaloopQuoteId: varchar("mojaloop_quote_id", { length: 128 }),
  errorCode: varchar("error_code", { length: 16 }),
  errorMessage: text("error_message"),
  initiatedBy: varchar("initiated_by", { length: 128 }),
  completedAt: timestamp("completed_at"),
  valueDate: timestamp("value_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type MojaloopSettlement = typeof mojaloopSettlements.$inferSelect;
export type InsertMojaloopSettlement = typeof mojaloopSettlements.$inferInsert;

// -------------------------------------------
// WAR DAMAGE ASSESSMENT (v21.0)
// -------------------------------------------
export const damageClassificationEnum = pgEnum("damage_classification", [
  "DESTROYED",
  "SEVERELY_DAMAGED",
  "MODERATELY_DAMAGED",
  "MINOR_DAMAGE",
  "INTACT",
  "UNKNOWN",
]);

export const damageAssetTypeEnum = pgEnum("damage_asset_type", [
  "WELLHEAD",
  "CHRISTMAS_TREE",
  "PIPELINE",
  "FLOWLINE",
  "SEPARATOR",
  "PUMP_STATION",
  "COMPRESSOR_STATION",
  "STORAGE_TANK",
  "CONTROL_ROOM",
  "POWER_SUPPLY",
  "ROAD_ACCESS",
  "MANIFOLD",
  "FLARE_STACK",
  "WATER_INJECTION",
  "FPSO",
  "OTHER",
]);

export const damageCauseEnum = pgEnum("damage_cause", [
  "DIRECT_STRIKE",
  "BLAST_OVERPRESSURE",
  "SHRAPNEL",
  "FIRE",
  "SABOTAGE",
  "LOOTING",
  "NEGLECT_DURING_CONFLICT",
  "SECONDARY_DAMAGE",
  "UNKNOWN",
]);

export const repairPriorityEnum = pgEnum("repair_priority", [
  "CRITICAL",     // HSE risk / production loss > 5000 BPD
  "HIGH",         // Production loss 1000–5000 BPD
  "MEDIUM",       // Production loss < 1000 BPD
  "LOW",          // Non-production-critical
  "DEFERRED",     // Requires further assessment
]);

export const repairStatusEnum = pgEnum("repair_status", [
  "PENDING_ASSESSMENT",
  "ASSESSED",
  "APPROVED",
  "MOBILIZING",
  "IN_PROGRESS",
  "COMPLETED",
  "DEFERRED",
  "CANCELLED",
]);

// Main damage assessment record — one per asset
export const damageAssessments = pgTable("damage_assessments", {
  id: serial("id").primaryKey(),
  assessmentId: varchar("assessment_id", { length: 32 }).notNull().unique(), // DA-2024-001
  wellId: varchar("well_id", { length: 32 }),                               // linked well (if applicable)
  assetType: damageAssetTypeEnum("asset_type").notNull(),
  assetName: varchar("asset_name", { length: 256 }).notNull(),              // e.g. "Well KW-14 Wellhead"
  assetTag: varchar("asset_tag", { length: 64 }),                           // plant/equipment tag
  fieldName: varchar("field_name", { length: 128 }),                        // e.g. "Rumaila North"
  country: varchar("country", { length: 64 }).notNull().default("Iraq"),
  coordinates: json("coordinates"),                                          // { lat, lng }
  classification: damageClassificationEnum("classification").notNull().default("UNKNOWN"),
  cause: damageCauseEnum("cause").default("UNKNOWN"),
  incidentDate: timestamp("incident_date"),                                  // when damage occurred
  assessmentDate: timestamp("assessment_date").defaultNow(),
  assessedBy: varchar("assessed_by", { length: 128 }),
  // Production impact
  productionLossBpd: real("production_loss_bpd").default(0),
  productionLossGasMmscfd: real("production_loss_gas_mmscfd").default(0),
  estimatedDowntimeDays: integer("estimated_downtime_days"),
  // Financial impact
  estimatedRepairCostUsd: real("estimated_repair_cost_usd"),
  estimatedReplacementCostUsd: real("estimated_replacement_cost_usd"),
  // Triage score (0–100, higher = more urgent)
  triageScore: real("triage_score"),
  repairPriority: repairPriorityEnum("repair_priority").default("DEFERRED"),
  // Narrative
  description: text("description"),
  aiSummary: text("ai_summary"),                                            // LLM-generated triage summary
  aiRecommendations: json("ai_recommendations"),                            // structured recs array
  // Status
  repairStatus: repairStatusEnum("repair_status").default("PENDING_ASSESSMENT"),
  // Safety flags
  hseRisk: boolean("hse_risk").default(false),
  environmentalRisk: boolean("environmental_risk").default(false),
  accessSafe: boolean("access_safe").default(false),
  // Metadata
  createdBy: varchar("created_by", { length: 128 }),
  updatedBy: varchar("updated_by", { length: 128 }),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type DamageAssessment = typeof damageAssessments.$inferSelect;
export type InsertDamageAssessment = typeof damageAssessments.$inferInsert;

// Photo / document evidence attached to an assessment
export const damageEvidence = pgTable("damage_evidence", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id").notNull(),                         // FK → damageAssessments.id
  evidenceType: varchar("evidence_type", { length: 32 }).notNull(),         // PHOTO / VIDEO / DOCUMENT / SATELLITE
  fileName: varchar("file_name", { length: 256 }),
  fileUrl: text("file_url"),                                                // S3 URL
  fileKey: varchar("file_key", { length: 512 }),
  caption: text("caption"),
  takenAt: timestamp("taken_at"),
  uploadedBy: varchar("uploaded_by", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type DamageEvidence = typeof damageEvidence.$inferSelect;
export type InsertDamageEvidence = typeof damageEvidence.$inferInsert;

// Repair work orders linked to an assessment
export const repairTickets = pgTable("repair_tickets", {
  id: serial("id").primaryKey(),
  ticketId: varchar("ticket_id", { length: 32 }).notNull().unique(),        // RT-2024-001
  assessmentId: integer("assessment_id").notNull(),                         // FK → damageAssessments.id
  title: varchar("title", { length: 256 }).notNull(),
  scope: text("scope"),                                                     // work scope description
  contractor: varchar("contractor", { length: 128 }),
  estimatedCostUsd: real("estimated_cost_usd"),
  actualCostUsd: real("actual_cost_usd"),
  plannedStartDate: timestamp("planned_start_date"),
  plannedEndDate: timestamp("planned_end_date"),
  actualStartDate: timestamp("actual_start_date"),
  actualEndDate: timestamp("actual_end_date"),
  status: repairStatusEnum("status").default("PENDING_ASSESSMENT"),
  priority: repairPriorityEnum("priority").default("MEDIUM"),
  assignedTo: varchar("assigned_to", { length: 128 }),
  assignedContractorId: integer("assigned_contractor_id"),                 // FK → contractors.id
  notes: text("notes"),
  createdBy: varchar("created_by", { length: 128 }),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type RepairTicket = typeof repairTickets.$inferSelect;
export type InsertRepairTicket = typeof repairTickets.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// War Damage Assessment v22.0 — Image Ingestion, Contractors, Cost Estimates
// ─────────────────────────────────────────────────────────────────────────────

/** Satellite / drone images attached to a damage assessment */
export const damageImages = pgTable("damage_images", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id").notNull(),
  s3Key: varchar("s3_key", { length: 512 }).notNull(),
  s3Url: text("s3_url").notNull(),
  filename: varchar("filename", { length: 256 }).notNull(),
  mimeType: varchar("mime_type", { length: 64 }).notNull(),
  fileSizeBytes: integer("file_size_bytes"),
  lat: real("lat"),
  lng: real("lng"),
  capturedAt: timestamp("captured_at"),
  aiSeverity: varchar("ai_severity", { length: 32 }),
  aiConfidence: real("ai_confidence"),
  aiSummary: text("ai_summary"),
  aiAssetType: varchar("ai_asset_type", { length: 64 }),
  uploadedBy: varchar("uploaded_by", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type DamageImage = typeof damageImages.$inferSelect;
export type InsertDamageImage = typeof damageImages.$inferInsert;

/** Contractor specialization */
export const contractorSpecializationEnum = pgEnum("contractor_specialization", [
  "WELL_INTERVENTION",
  "PIPELINE_REPAIR",
  "MECHANICAL_INTEGRITY",
  "ELECTRICAL_INSTRUMENTATION",
  "CIVIL_STRUCTURAL",
  "ENVIRONMENTAL_REMEDIATION",
  "GENERAL_OILFIELD",
]);

/** Regional O&G contractors available for post-conflict repair mobilisation */
export const contractors = pgTable("contractors", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  company: varchar("company", { length: 256 }).notNull(),
  specialization: contractorSpecializationEnum("specialization").notNull(),
  country: varchar("country", { length: 64 }).notNull(),
  city: varchar("city", { length: 64 }),
  locationLat: real("location_lat"),
  locationLng: real("location_lng"),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 128 }),
  mobilizationCostUsd: real("mobilization_cost_usd"),
  dayRateUsd: real("day_rate_usd"),
  available: boolean("available").default(true),
  certifications: text("certifications"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type Contractor = typeof contractors.$inferSelect;
export type InsertContractor = typeof contractors.$inferInsert;

/** Detailed cost estimate for a repair ticket */
export const repairCostEstimates = pgTable("repair_cost_estimates", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull(),
  laborDays: real("labor_days"),
  laborCostUsd: real("labor_cost_usd"),
  materialCostUsd: real("material_cost_usd"),
  mobilizationCostUsd: real("mobilization_cost_usd"),
  contingencyPct: real("contingency_pct").default(15),
  totalCostUsd: real("total_cost_usd"),
  currency: varchar("currency", { length: 8 }).default("USD"),
  estimatedBy: varchar("estimated_by", { length: 128 }),
  basisOfEstimate: text("basis_of_estimate"),
  contractorId: integer("contractor_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type RepairCostEstimate = typeof repairCostEstimates.$inferSelect;
export type InsertRepairCostEstimate = typeof repairCostEstimates.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// Alert Thresholds (v25.0) — per-well sensor min/max thresholds
// ─────────────────────────────────────────────────────────────────────────────
export const alertThresholds = pgTable("alert_thresholds", {
  id: serial("id").primaryKey(),
  wellId: varchar("well_id", { length: 32 }).notNull(),
  sensorType: varchar("sensor_type", { length: 64 }).notNull(),             // e.g. TUBING_PRESSURE, FLOW_RATE
  minValue: real("min_value"),
  maxValue: real("max_value"),
  unit: varchar("unit", { length: 16 }),
  enabled: boolean("enabled").default(true).notNull(),
  createdBy: varchar("created_by", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type AlertThreshold = typeof alertThresholds.$inferSelect;
export type InsertAlertThreshold = typeof alertThresholds.$inferInsert;

// =============================================================================
// TREXM CO-CREATION GAP TABLES (v35.0)
// =============================================================================

export const stressRegimeEnum = pgEnum("stress_regime", [
  "NORMAL_FAULTING", "STRIKE_SLIP", "THRUST_FAULTING",
]);
export const mudWeightStatusEnum = pgEnum("mud_weight_status", [
  "OPTIMAL", "NEAR_COLLAPSE_LIMIT", "NEAR_FRACTURE_LIMIT", "BELOW_COLLAPSE", "ABOVE_FRACTURE",
]);
export const stabilityRiskLevelEnum = pgEnum("stability_risk_level", [
  "LOW", "MEDIUM", "HIGH", "CRITICAL",
]);
export const mudTypeEnum = pgEnum("mud_type", [
  "OBM", "SBM", "WBM", "BRINE",
]);
export const mudTransactionTypeEnum = pgEnum("mud_transaction_type", [
  "RECEIVED", "CONSUMED", "TRANSFERRED", "DISPOSED", "RETURNED",
]);
export const sandRiskLevelEnum = pgEnum("sand_risk_level_v2", [
  "LOW", "MODERATE", "HIGH", "CRITICAL",
]);
export const sandControlMethodEnum = pgEnum("sand_control_method", [
  "NONE", "CHOKEBACK", "GRAVEL_PACK", "FRAC_PACK",
  "EXPANDABLE_SAND_SCREEN", "STANDALONE_SCREEN", "CHEMICAL_CONSOLIDATION",
]);
export const completionTypeEnum = pgEnum("completion_type", [
  "OPEN_HOLE", "CASED_PERFORATED", "GRAVEL_PACK", "FRAC_PACK",
  "EXPANDABLE_SAND_SCREEN", "STANDALONE_SCREEN",
]);
export const waterQualityStatusEnum = pgEnum("water_quality_status", [
  "COMPLIANT", "MARGINAL", "NON_COMPLIANT",
]);
export const eorMethodEnum = pgEnum("eor_method", [
  "PRIMARY_DEPLETION", "WATER_FLOOD", "POLYMER_FLOOD",
  "STEAM_FLOOD", "CYCLIC_STEAM_STIMULATION", "SAGD",
  "IN_SITU_COMBUSTION", "SOLVENT_INJECTION",
]);
export const liquidLoadingStatusEnum = pgEnum("liquid_loading_status", [
  "UNLOADED", "AT_RISK", "LOADING", "SEVERE_LOADING",
]);
export const remediationMethodEnum = pgEnum("remediation_method", [
  "PLUNGER_LIFT", "VELOCITY_STRING", "FOAM_INJECTION",
  "GAS_LIFT", "COMPRESSION", "WELLBORE_CLEANOUT",
]);

export const geomechanicalModels = pgTable("geomechanical_models", {
  id: serial("id").primaryKey(),
  wellId: varchar("well_id", { length: 32 }).notNull(),
  tvdFt: real("tvd_ft").notNull(),
  avgBulkDensityGcc: real("avg_bulk_density_gcc").default(2.3),
  porePressureGradientPpg: real("pore_pressure_gradient_ppg"),
  normalPpGradientPpg: real("normal_pp_gradient_ppg").default(8.6),
  eatonExponent: real("eaton_exponent").default(3.0),
  lotPressurePpg: real("lot_pressure_ppg"),
  ucsPsi: real("ucs_psi").default(3000),
  frictionAngleDeg: real("friction_angle_deg").default(30),
  biotCoefficient: real("biot_coefficient").default(0.8),
  poissonRatio: real("poisson_ratio").default(0.25),
  inclinationDeg: real("inclination_deg").default(0),
  azimuthDeg: real("azimuth_deg").default(0),
  currentMudWeightPpg: real("current_mud_weight_ppg").notNull(),
  stressRegime: stressRegimeEnum("stress_regime").default("NORMAL_FAULTING"),
  overburdenGradientPpg: real("overburden_gradient_ppg"),
  shminGradientPpg: real("shmin_gradient_ppg"),
  fractureGradientPpg: real("fracture_gradient_ppg"),
  collapseGradientPpg: real("collapse_gradient_ppg"),
  mwLowerPpg: real("mw_lower_ppg"),
  mwUpperPpg: real("mw_upper_ppg"),
  mwWindowWidthPpg: real("mw_window_width_ppg"),
  mudWeightStatus: mudWeightStatusEnum("mud_weight_status"),
  stabilityRisk: stabilityRiskLevelEnum("stability_risk"),
  recommendedMwPpg: real("recommended_mw_ppg"),
  analysisNotes: text("analysis_notes"),
  computedAt: timestamp("computed_at"),
  createdBy: varchar("created_by", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type GeomechanicalModel = typeof geomechanicalModels.$inferSelect;
export type InsertGeomechanicalModel = typeof geomechanicalModels.$inferInsert;

export const stressProfiles = pgTable("stress_profiles", {
  id: serial("id").primaryKey(),
  modelId: integer("model_id").notNull(),
  wellId: varchar("well_id", { length: 32 }).notNull(),
  depthFt: real("depth_ft").notNull(),
  overburdenPpg: real("overburden_ppg"),
  porePressurePpg: real("pore_pressure_ppg"),
  shminPpg: real("shmin_ppg"),
  fractureGradientPpg: real("fracture_gradient_ppg"),
  collapseGradientPpg: real("collapse_gradient_ppg"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type StressProfile = typeof stressProfiles.$inferSelect;
export type InsertStressProfile = typeof stressProfiles.$inferInsert;

export const mudInventory = pgTable("mud_inventory", {
  id: serial("id").primaryKey(),
  locationId: varchar("location_id", { length: 64 }).notNull(),
  locationName: varchar("location_name", { length: 128 }).notNull(),
  mudType: mudTypeEnum("mud_type").notNull(),
  mudGrade: varchar("mud_grade", { length: 64 }),
  currentVolumeBbl: real("current_volume_bbl").default(0).notNull(),
  maxCapacityBbl: real("max_capacity_bbl").notNull(),
  reorderPointBbl: real("reorder_point_bbl"),
  costPerBblUsd: real("cost_per_bbl_usd"),
  supplierName: varchar("supplier_name", { length: 128 }),
  lastReceivedAt: timestamp("last_received_at"),
  expiryDate: timestamp("expiry_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type MudInventory = typeof mudInventory.$inferSelect;
export type InsertMudInventory = typeof mudInventory.$inferInsert;

export const mudTransactions = pgTable("mud_transactions", {
  id: serial("id").primaryKey(),
  inventoryId: integer("inventory_id").notNull(),
  transactionType: mudTransactionTypeEnum("transaction_type").notNull(),
  volumeBbl: real("volume_bbl").notNull(),
  costUsd: real("cost_usd"),
  wellId: varchar("well_id", { length: 32 }),
  fromLocationId: varchar("from_location_id", { length: 64 }),
  toLocationId: varchar("to_location_id", { length: 64 }),
  referenceNumber: varchar("reference_number", { length: 64 }),
  performedBy: varchar("performed_by", { length: 128 }),
  notes: text("notes"),
  transactionAt: timestamp("transaction_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type MudTransaction = typeof mudTransactions.$inferSelect;
export type InsertMudTransaction = typeof mudTransactions.$inferInsert;

export const sandProductionRecords = pgTable("sand_production_records", {
  id: serial("id").primaryKey(),
  wellId: varchar("well_id", { length: 32 }).notNull(),
  recordedAt: timestamp("recorded_at").notNull(),
  sandRateMgL: real("sand_rate_mg_l"),
  cumulativeSandKg: real("cumulative_sand_kg"),
  drawdownPsi: real("drawdown_psi"),
  flowRateBpd: real("flow_rate_bpd"),
  waterCut: real("water_cut"),
  sandRisk: sandRiskLevelEnum("sand_risk"),
  criticalDrawdownPsi: real("critical_drawdown_psi"),
  safetyMarginPsi: real("safety_margin_psi"),
  sandControlMethod: sandControlMethodEnum("sand_control_method"),
  completionType: completionTypeEnum("completion_type"),
  ucsPsi: real("ucs_psi"),
  actionTaken: text("action_taken"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type SandProductionRecord = typeof sandProductionRecords.$inferSelect;
export type InsertSandProductionRecord = typeof sandProductionRecords.$inferInsert;

export const producedWaterRecords = pgTable("produced_water_records", {
  id: serial("id").primaryKey(),
  fieldId: varchar("field_id", { length: 64 }).notNull(),
  recordDate: timestamp("record_date").notNull(),
  producedWaterBbl: real("produced_water_bbl").default(0).notNull(),
  injectedWaterBbl: real("injected_water_bbl").default(0),
  disposedWaterBbl: real("disposed_water_bbl").default(0),
  recycledWaterBbl: real("recycled_water_bbl").default(0),
  evaporatedWaterBbl: real("evaporated_water_bbl").default(0),
  oilInWaterMgL: real("oil_in_water_mg_l"),
  tssMgL: real("tss_mg_l"),
  bacteriaCountCfuMl: real("bacteria_count_cfu_ml"),
  phValue: real("ph_value"),
  chlorideMgL: real("chloride_mg_l"),
  waterBalanceBbl: real("water_balance_bbl"),
  balanceStatus: varchar("balance_status", { length: 32 }),
  waterQualityStatus: waterQualityStatusEnum("water_quality_status"),
  injectionEfficiencyPct: real("injection_efficiency_pct"),
  recyclingRatePct: real("recycling_rate_pct"),
  treatmentCostUsd: real("treatment_cost_usd"),
  environmentalRisk: varchar("environmental_risk", { length: 16 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ProducedWaterRecord = typeof producedWaterRecords.$inferSelect;
export type InsertProducedWaterRecord = typeof producedWaterRecords.$inferInsert;

export const heavyOilParameters = pgTable("heavy_oil_parameters", {
  id: serial("id").primaryKey(),
  wellId: varchar("well_id", { length: 32 }).notNull(),
  apiGravity: real("api_gravity").notNull(),
  reservoirTempF: real("reservoir_temp_f").notNull(),
  currentRateBpd: real("current_rate_bpd"),
  waterCut: real("water_cut").default(0),
  steamInjectionCweBpd: real("steam_injection_cwe_bpd").default(0),
  steamQuality: real("steam_quality").default(0.8),
  gorScfPerBbl: real("gor_scf_per_bbl").default(50),
  netPayFt: real("net_pay_ft"),
  porosityFraction: real("porosity_fraction"),
  eorMethod: eorMethodEnum("eor_method").default("PRIMARY_DEPLETION"),
  steamCostUsdPerBblCwe: real("steam_cost_usd_per_bbl_cwe").default(8.0),
  currentViscosityCp: real("current_viscosity_cp"),
  recommendedEorMethod: eorMethodEnum("recommended_eor_method"),
  projectedRateUpliftPct: real("projected_rate_uplift_pct"),
  steamToOilRatio: real("steam_to_oil_ratio"),
  thermalEfficiencyPct: real("thermal_efficiency_pct"),
  netBenefitUsdPerYear: real("net_benefit_usd_per_year"),
  computedAt: timestamp("computed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type HeavyOilParameter = typeof heavyOilParameters.$inferSelect;
export type InsertHeavyOilParameter = typeof heavyOilParameters.$inferInsert;

export const liquidLoadingEvents = pgTable("liquid_loading_events", {
  id: serial("id").primaryKey(),
  wellId: varchar("well_id", { length: 32 }).notNull(),
  detectedAt: timestamp("detected_at").notNull(),
  wellheadPressurePsia: real("wellhead_pressure_psia"),
  wellheadTempF: real("wellhead_temp_f"),
  gasRateMscfd: real("gas_rate_mscfd"),
  tubingIdIn: real("tubing_id_in"),
  criticalVelocityFps: real("critical_velocity_fps"),
  actualVelocityFps: real("actual_velocity_fps"),
  criticalRateMscfd: real("critical_rate_mscfd"),
  velocityRatio: real("velocity_ratio"),
  loadingStatus: liquidLoadingStatusEnum("loading_status"),
  daysToLoading: real("days_to_loading"),
  declineRateMscfdPerDay: real("decline_rate_mscfd_per_day"),
  remediationMethod: remediationMethodEnum("remediation_method"),
  remediationAppliedAt: timestamp("remediation_applied_at"),
  remediationNotes: text("remediation_notes"),
  urgency: varchar("urgency", { length: 32 }),
  resolvedAt: timestamp("resolved_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LiquidLoadingEvent = typeof liquidLoadingEvents.$inferSelect;
export type InsertLiquidLoadingEvent = typeof liquidLoadingEvents.$inferInsert;

// ─── Production Forecasting ────────────────────────────────────────────────
export const productionForecasts = pgTable("production_forecasts", {
  id: serial("id").primaryKey(),
  wellId: varchar("well_id", { length: 32 }).notNull(),
  forecastName: varchar("forecast_name", { length: 128 }).notNull(),
  declineType: varchar("decline_type", { length: 16 }).notNull().default("exponential"),
  initialRateBopd: real("initial_rate_bopd").notNull(),
  declineRateMonthly: real("decline_rate_monthly").notNull(),
  bFactor: real("b_factor").default(0),
  forecastYears: integer("forecast_years").notNull().default(10),
  eurBbl: real("eur_bbl"),
  p10EurBbl: real("p10_eur_bbl"),
  p50EurBbl: real("p50_eur_bbl"),
  p90EurBbl: real("p90_eur_bbl"),
  oilPriceUsdPerBbl: real("oil_price_usd_per_bbl").default(70),
  npv10M: real("npv10_m"),
  createdBy: varchar("created_by", { length: 64 }),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type ProductionForecast = typeof productionForecasts.$inferSelect;
export type InsertProductionForecast = typeof productionForecasts.$inferInsert;

// ─── Wellbore Integrity ────────────────────────────────────────────────────
export const casingInspections = pgTable("casing_inspections", {
  id: serial("id").primaryKey(),
  wellId: varchar("well_id", { length: 32 }).notNull(),
  inspectionDate: timestamp("inspection_date").notNull(),
  inspectionType: varchar("inspection_type", { length: 32 }).notNull(),
  casingString: varchar("casing_string", { length: 32 }).notNull(),
  topDepthFt: real("top_depth_ft").notNull(),
  bottomDepthFt: real("bottom_depth_ft").notNull(),
  wallThicknessIn: real("wall_thickness_in"),
  corrosionPct: real("corrosion_pct"),
  ovalityPct: real("ovality_pct"),
  integrityScore: real("integrity_score"),
  anomaliesFound: integer("anomalies_found").default(0),
  passedTest: boolean("passed_test").default(true),
  nextInspectionDue: timestamp("next_inspection_due"),
  notes: text("notes"),
  inspectedBy: varchar("inspected_by", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CasingInspection = typeof casingInspections.$inferSelect;
export type InsertCasingInspection = typeof casingInspections.$inferInsert;

export const pressureTests = pgTable("pressure_tests", {
  id: serial("id").primaryKey(),
  wellId: varchar("well_id", { length: 32 }).notNull(),
  testDate: timestamp("test_date").notNull(),
  testType: varchar("test_type", { length: 32 }).notNull(),
  testPressurePsi: real("test_pressure_psi").notNull(),
  holdTimeMins: integer("hold_time_mins").notNull(),
  pressureDropPsi: real("pressure_drop_psi"),
  acceptanceCriteriaPsi: real("acceptance_criteria_psi"),
  passed: boolean("passed").notNull().default(true),
  testFluid: varchar("test_fluid", { length: 32 }).default("water"),
  notes: text("notes"),
  testedBy: varchar("tested_by", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type PressureTest = typeof pressureTests.$inferSelect;
export type InsertPressureTest = typeof pressureTests.$inferInsert;

// ─── Reservoir Pressure Management ────────────────────────────────────────
export const reservoirPressureRecords = pgTable("reservoir_pressure_records", {
  id: serial("id").primaryKey(),
  fieldId: varchar("field_id", { length: 32 }).notNull().default("DEFAULT"),
  wellId: varchar("well_id", { length: 32 }),
  recordDate: timestamp("record_date").notNull(),
  measuredPressurePsia: real("measured_pressure_psia").notNull(),
  measurementMethod: varchar("measurement_method", { length: 32 }).default("BHP"),
  depthFt: real("depth_ft"),
  waterCutFrac: real("water_cut_frac"),
  gasCap: boolean("gas_cap").default(false),
  aquiferStrength: varchar("aquifer_strength", { length: 16 }).default("NONE"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ReservoirPressureRecord = typeof reservoirPressureRecords.$inferSelect;
export type InsertReservoirPressureRecord = typeof reservoirPressureRecords.$inferInsert;

// ─── AI Co-Pilot Chat History ──────────────────────────────────────────────
export const aiCopilotChats = pgTable("ai_copilot_chats", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  sessionId: varchar("session_id", { length: 64 }).notNull(),
  role: varchar("role", { length: 16 }).notNull(),
  content: text("content").notNull(),
  toolCalls: text("tool_calls"),
  contextWellId: varchar("context_well_id", { length: 32 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AiCopilotChat = typeof aiCopilotChats.$inferSelect;
export type InsertAiCopilotChat = typeof aiCopilotChats.$inferInsert;


// ═══════════════════════════════════════════════════════════════════════════
// v42 ENHANCEMENT SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

// ─── TIER 1: IEC 62443 Cybersecurity Certification ────────────────────────
export const iec62443Controls = pgTable("iec62443_controls", {
  id: serial("id").primaryKey(),
  controlId: varchar("control_id", { length: 32 }).notNull().unique(),
  zone: varchar("zone", { length: 32 }).notNull().default("SL2"),
  category: varchar("category", { length: 64 }).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  requirement: text("requirement"),
  status: varchar("status", { length: 32 }).notNull().default("not_started"),
  evidenceUrl: text("evidence_url"),
  assignedTo: varchar("assigned_to", { length: 64 }),
  targetDate: timestamp("target_date"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type Iec62443Control = typeof iec62443Controls.$inferSelect;
export type InsertIec62443Control = typeof iec62443Controls.$inferInsert;

export const iec62443Assessments = pgTable("iec62443_assessments", {
  id: serial("id").primaryKey(),
  assessmentDate: timestamp("assessment_date").notNull(),
  assessorName: varchar("assessor_name", { length: 128 }),
  assessorOrg: varchar("assessor_org", { length: 128 }),
  targetSl: integer("target_sl").notNull().default(2),
  achievedSl: integer("achieved_sl"),
  overallScore: real("overall_score"),
  findings: text("findings"),
  recommendations: text("recommendations"),
  reportUrl: text("report_url"),
  status: varchar("status", { length: 32 }).notNull().default("in_progress"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type Iec62443Assessment = typeof iec62443Assessments.$inferSelect;

// ─── TIER 1: SIL 2 Functional Safety ──────────────────────────────────────
export const silFunctions = pgTable("sil_functions", {
  id: serial("id").primaryKey(),
  functionId: varchar("function_id", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  processHazard: text("process_hazard"),
  initiatingEvent: varchar("initiating_event", { length: 256 }),
  safeguard: varchar("safeguard", { length: 256 }),
  consequenceCategory: varchar("consequence_category", { length: 32 }),
  targetSil: integer("target_sil").notNull().default(2),
  achievedSil: integer("achieved_sil"),
  pfdAvg: real("pfd_avg"),
  rrf: real("rrf"),
  lopaRef: varchar("lopa_ref", { length: 64 }),
  status: varchar("status", { length: 32 }).notNull().default("design"),
  lastVerifiedAt: timestamp("last_verified_at"),
  nextTestDue: timestamp("next_test_due"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type SilFunction = typeof silFunctions.$inferSelect;
export type InsertSilFunction = typeof silFunctions.$inferInsert;

export const silTestRecords = pgTable("sil_test_records", {
  id: serial("id").primaryKey(),
  silFunctionId: integer("sil_function_id").notNull(),
  testDate: timestamp("test_date").notNull(),
  testType: varchar("test_type", { length: 64 }).notNull(),
  testResult: varchar("test_result", { length: 32 }).notNull(),
  responseTimeSec: real("response_time_sec"),
  testedBy: varchar("tested_by", { length: 64 }),
  witnessedBy: varchar("witnessed_by", { length: 64 }),
  deviations: text("deviations"),
  correctiveActions: text("corrective_actions"),
  nextTestDue: timestamp("next_test_due"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type SilTestRecord = typeof silTestRecords.$inferSelect;

// ─── TIER 1: SOC 2 Audit Trail ────────────────────────────────────────────
export const soc2AuditEvents = pgTable("soc2_audit_events", {
  id: serial("id").primaryKey(),
  eventTime: timestamp("event_time").defaultNow().notNull(),
  userId: varchar("user_id", { length: 64 }),
  userEmail: varchar("user_email", { length: 128 }),
  ipAddress: varchar("ip_address", { length: 64 }),
  action: varchar("action", { length: 128 }).notNull(),
  resource: varchar("resource", { length: 128 }),
  resourceId: varchar("resource_id", { length: 64 }),
  outcome: varchar("outcome", { length: 32 }).notNull().default("success"),
  details: text("details"),
  sessionId: varchar("session_id", { length: 128 }),
  userAgent: varchar("user_agent", { length: 512 }),
  traceId: varchar("trace_id", { length: 64 }),
});
export type Soc2AuditEvent = typeof soc2AuditEvents.$inferSelect;

export const soc2Controls = pgTable("soc2_controls", {
  id: serial("id").primaryKey(),
  controlRef: varchar("control_ref", { length: 32 }).notNull().unique(),
  trustServiceCriteria: varchar("trust_service_criteria", { length: 32 }).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  controlType: varchar("control_type", { length: 32 }).notNull().default("preventive"),
  frequency: varchar("frequency", { length: 32 }).notNull().default("continuous"),
  owner: varchar("owner", { length: 64 }),
  status: varchar("status", { length: 32 }).notNull().default("in_place"),
  lastTestedAt: timestamp("last_tested_at"),
  testResult: varchar("test_result", { length: 32 }),
  evidence: text("evidence"),
  deficiencies: text("deficiencies"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type Soc2Control = typeof soc2Controls.$inferSelect;

// ─── TIER 2: QuestDB Historian ────────────────────────────────────────────
export const historianStreams = pgTable("historian_streams", {
  id: serial("id").primaryKey(),
  tagName: varchar("tag_name", { length: 128 }).notNull().unique(),
  wellId: varchar("well_id", { length: 32 }),
  deviceId: varchar("device_id", { length: 64 }),
  description: varchar("description", { length: 256 }),
  engineeringUnit: varchar("engineering_unit", { length: 32 }),
  dataType: varchar("data_type", { length: 32 }).notNull().default("float"),
  sampleRateHz: real("sample_rate_hz").notNull().default(1.0),
  compressionEnabled: boolean("compression_enabled").notNull().default(true),
  compressionDeviation: real("compression_deviation").notNull().default(0.1),
  retentionDays: integer("retention_days").notNull().default(730),
  questdbTable: varchar("questdb_table", { length: 128 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type HistorianStream = typeof historianStreams.$inferSelect;
export type InsertHistorianStream = typeof historianStreams.$inferInsert;

// ─── TIER 3: 3D Digital Twin Models ──────────────────────────────────────
export const digitalTwinModels = pgTable("digital_twin_models", {
  id: serial("id").primaryKey(),
  modelId: varchar("model_id", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 256 }).notNull(),
  assetType: varchar("asset_type", { length: 64 }).notNull(),
  wellId: varchar("well_id", { length: 32 }),
  facilityId: varchar("facility_id", { length: 64 }),
  gltfUrl: text("gltf_url"),
  thumbnailUrl: text("thumbnail_url"),
  positionLat: real("position_lat"),
  positionLon: real("position_lon"),
  sceneConfig: text("scene_config"),
  sensorBindings: text("sensor_bindings"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type DigitalTwinModel = typeof digitalTwinModels.$inferSelect;
export type InsertDigitalTwinModel = typeof digitalTwinModels.$inferInsert;

export const fpsoTwinSessions = pgTable("fpso_twin_sessions", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 64 }).notNull().unique(),
  fpsoId: varchar("fpso_id", { length: 32 }).notNull(),
  userId: varchar("user_id", { length: 64 }),
  streamUrl: text("stream_url"),
  status: varchar("status", { length: 32 }).notNull().default("initializing"),
  gpuNodeId: varchar("gpu_node_id", { length: 64 }),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  durationSec: integer("duration_sec"),
});
export type FpsoTwinSession = typeof fpsoTwinSessions.$inferSelect;

// ─── TIER 4: PINN Well Performance ────────────────────────────────────────
export const pinnModels = pgTable("pinn_models", {
  id: serial("id").primaryKey(),
  modelId: varchar("model_id", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 256 }).notNull(),
  modelType: varchar("model_type", { length: 64 }).notNull(),
  wellId: varchar("well_id", { length: 32 }),
  fieldId: varchar("field_id", { length: 32 }),
  onnxUrl: text("onnx_url"),
  trainingDataPoints: integer("training_data_points"),
  validationRmse: real("validation_rmse"),
  physicsLossWeight: real("physics_loss_weight").notNull().default(0.1),
  dataLossWeight: real("data_loss_weight").notNull().default(0.9),
  epochs: integer("epochs"),
  status: varchar("status", { length: 32 }).notNull().default("training"),
  trainedAt: timestamp("trained_at"),
  inferenceCount: integer("inference_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type PinnModel = typeof pinnModels.$inferSelect;
export type InsertPinnModel = typeof pinnModels.$inferInsert;

// ─── TIER 4: Agentic AI Workflows ─────────────────────────────────────────
export const agentWorkflows = pgTable("agent_workflows", {
  id: serial("id").primaryKey(),
  workflowId: varchar("workflow_id", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  triggerType: varchar("trigger_type", { length: 64 }).notNull(),
  triggerConfig: text("trigger_config"),
  steps: text("steps").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  lastRunAt: timestamp("last_run_at"),
  runCount: integer("run_count").notNull().default(0),
  successCount: integer("success_count").notNull().default(0),
  failureCount: integer("failure_count").notNull().default(0),
  createdBy: varchar("created_by", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type AgentWorkflow = typeof agentWorkflows.$inferSelect;
export type InsertAgentWorkflow = typeof agentWorkflows.$inferInsert;

export const agentWorkflowRuns = pgTable("agent_workflow_runs", {
  id: serial("id").primaryKey(),
  runId: varchar("run_id", { length: 64 }).notNull().unique(),
  workflowId: varchar("workflow_id", { length: 64 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("running"),
  currentStep: integer("current_step").notNull().default(0),
  totalSteps: integer("total_steps").notNull().default(0),
  context: text("context"),
  stepResults: text("step_results"),
  errorMessage: text("error_message"),
  triggeredBy: varchar("triggered_by", { length: 64 }),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),
});
export type AgentWorkflowRun = typeof agentWorkflowRuns.$inferSelect;

// ─── TIER 4: Federated Learning ───────────────────────────────────────────
export const federatedModels = pgTable("federated_models", {
  id: serial("id").primaryKey(),
  modelId: varchar("model_id", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 256 }).notNull(),
  modelType: varchar("model_type", { length: 64 }).notNull(),
  aggregationStrategy: varchar("aggregation_strategy", { length: 32 }).notNull().default("fedavg"),
  globalRound: integer("global_round").notNull().default(0),
  participantCount: integer("participant_count").notNull().default(0),
  minParticipants: integer("min_participants").notNull().default(3),
  globalAccuracy: real("global_accuracy"),
  globalLoss: real("global_loss"),
  modelWeightsUrl: text("model_weights_url"),
  differentialPrivacyEpsilon: real("differential_privacy_epsilon").notNull().default(1.0),
  status: varchar("status", { length: 32 }).notNull().default("recruiting"),
  lastAggregatedAt: timestamp("last_aggregated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type FederatedModel = typeof federatedModels.$inferSelect;
export type InsertFederatedModel = typeof federatedModels.$inferInsert;

export const federatedParticipants = pgTable("federated_participants", {
  id: serial("id").primaryKey(),
  modelId: varchar("model_id", { length: 64 }).notNull(),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  participantName: varchar("participant_name", { length: 128 }),
  localDataPoints: integer("local_data_points"),
  localAccuracy: real("local_accuracy"),
  lastContributedAt: timestamp("last_contributed_at"),
  contributionRound: integer("contribution_round").notNull().default(0),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

// ─── TIER 5: OSDU R3 Datasets ─────────────────────────────────────────────
export const osduDatasets = pgTable("osdu_datasets", {
  id: serial("id").primaryKey(),
  datasetId: varchar("dataset_id", { length: 128 }).notNull().unique(),
  kind: varchar("kind", { length: 256 }).notNull(),
  namespace: varchar("namespace", { length: 64 }).notNull().default("opendes"),
  version: varchar("version", { length: 32 }).notNull().default("1.0.0"),
  acl: text("acl"),
  legal: text("legal"),
  tags: text("tags"),
  data: text("data"),
  ancestry: text("ancestry"),
  source: varchar("source", { length: 128 }),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type OsduDataset = typeof osduDatasets.$inferSelect;
export type InsertOsduDataset = typeof osduDatasets.$inferInsert;

// ─── TIER 5: WITSML / PRODML ──────────────────────────────────────────────
export const witsmlWells = pgTable("witsml_wells", {
  id: serial("id").primaryKey(),
  uid: varchar("uid", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 256 }).notNull(),
  nameLegal: varchar("name_legal", { length: 256 }),
  country: varchar("country", { length: 64 }),
  field: varchar("field", { length: 128 }),
  operator: varchar("operator", { length: 128 }),
  numLicense: varchar("num_license", { length: 64 }),
  statusWell: varchar("status_well", { length: 32 }),
  purposeWell: varchar("purpose_well", { length: 32 }),
  fluidWell: varchar("fluid_well", { length: 32 }),
  groundElevation: real("ground_elevation"),
  waterDepth: real("water_depth"),
  dTimSpud: timestamp("d_tim_spud"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type WitsmlWell = typeof witsmlWells.$inferSelect;
export type InsertWitsmlWell = typeof witsmlWells.$inferInsert;

export const prodmlProductionSets = pgTable("prodml_production_sets", {
  id: serial("id").primaryKey(),
  uid: varchar("uid", { length: 64 }).notNull().unique(),
  uidWell: varchar("uid_well", { length: 64 }).notNull(),
  dTimStart: timestamp("d_tim_start").notNull(),
  dTimEnd: timestamp("d_tim_end").notNull(),
  oilVolume: real("oil_volume"),
  gasVolume: real("gas_volume"),
  waterVolume: real("water_volume"),
  condensateVolume: real("condensate_volume"),
  injectedWaterVolume: real("injected_water_volume"),
  volumeUom: varchar("volume_uom", { length: 16 }).default("bbl"),
  pressureAvg: real("pressure_avg"),
  tempAvg: real("temp_avg"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ProdmlProductionSet = typeof prodmlProductionSets.$inferSelect;

// ─── TIER 5: SAP PM / IBM Maximo Integration ──────────────────────────────
export const cmmsWorkOrders = pgTable("cmms_work_orders", {
  id: serial("id").primaryKey(),
  externalId: varchar("external_id", { length: 64 }),
  cmmsSystem: varchar("cmms_system", { length: 32 }).notNull().default("sap_pm"),
  workOrderNumber: varchar("work_order_number", { length: 64 }),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  wellId: varchar("well_id", { length: 32 }),
  assetId: varchar("asset_id", { length: 64 }),
  priority: varchar("priority", { length: 32 }).notNull().default("medium"),
  workOrderType: varchar("work_order_type", { length: 32 }).notNull().default("corrective"),
  status: varchar("status", { length: 32 }).notNull().default("open"),
  assignedTo: varchar("assigned_to", { length: 64 }),
  plannedStart: timestamp("planned_start"),
  plannedEnd: timestamp("planned_end"),
  actualStart: timestamp("actual_start"),
  actualEnd: timestamp("actual_end"),
  estimatedHours: real("estimated_hours"),
  actualHours: real("actual_hours"),
  estimatedCost: real("estimated_cost"),
  actualCost: real("actual_cost"),
  syncStatus: varchar("sync_status", { length: 32 }).notNull().default("pending"),
  lastSyncedAt: timestamp("last_synced_at"),
  syncError: text("sync_error"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type CmmsWorkOrder = typeof cmmsWorkOrders.$inferSelect;
export type InsertCmmsWorkOrder = typeof cmmsWorkOrders.$inferInsert;

export const cmmsIntegrations = pgTable("cmms_integrations", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  cmmsSystem: varchar("cmms_system", { length: 32 }).notNull(),
  baseUrl: varchar("base_url", { length: 512 }),
  authType: varchar("auth_type", { length: 32 }).notNull().default("basic"),
  username: varchar("username", { length: 128 }),
  isActive: boolean("is_active").notNull().default(true),
  lastTestAt: timestamp("last_test_at"),
  lastTestStatus: varchar("last_test_status", { length: 32 }),
  syncInterval: integer("sync_interval").notNull().default(300),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type CmmsIntegration = typeof cmmsIntegrations.$inferSelect;

// ─── TIER 6: Production Allocation Engine ─────────────────────────────────
export const productionAllocationRules = pgTable("production_allocation_rules", {
  id: serial("id").primaryKey(),
  ruleId: varchar("rule_id", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 256 }).notNull(),
  fieldId: varchar("field_id", { length: 32 }).notNull(),
  separatorId: varchar("separator_id", { length: 64 }),
  method: varchar("method", { length: 32 }).notNull().default("well_test_ratio"),
  oilAllocationBbl: real("oil_allocation_bbl"),
  gasAllocationMcf: real("gas_allocation_mcf"),
  waterAllocationBbl: real("water_allocation_bbl"),
  effectiveFrom: timestamp("effective_from").notNull(),
  effectiveTo: timestamp("effective_to"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type ProductionAllocationRule = typeof productionAllocationRules.$inferSelect;
export type InsertProductionAllocationRule = typeof productionAllocationRules.$inferInsert;

export const wellAllocationFactors = pgTable("well_allocation_factors", {
  id: serial("id").primaryKey(),
  ruleId: varchar("rule_id", { length: 64 }).notNull(),
  wellId: varchar("well_id", { length: 32 }).notNull(),
  oilFactor: real("oil_factor").notNull().default(0.0),
  gasFactor: real("gas_factor").notNull().default(0.0),
  waterFactor: real("water_factor").notNull().default(0.0),
  basisType: varchar("basis_type", { length: 32 }).notNull().default("well_test"),
  basisDate: timestamp("basis_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const allocatedProduction = pgTable("allocated_production", {
  id: serial("id").primaryKey(),
  allocationDate: timestamp("allocation_date").notNull(),
  wellId: varchar("well_id", { length: 32 }).notNull(),
  ruleId: varchar("rule_id", { length: 64 }).notNull(),
  allocatedOilBbl: real("allocated_oil_bbl"),
  allocatedGasMcf: real("allocated_gas_mcf"),
  allocatedWaterBbl: real("allocated_water_bbl"),
  allocationMethod: varchar("allocation_method", { length: 32 }),
  isFinalized: boolean("is_finalized").notNull().default(false),
  finalizedAt: timestamp("finalized_at"),
  finalizedBy: varchar("finalized_by", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AllocatedProduction = typeof allocatedProduction.$inferSelect;

// ─── TIER 6: Reservoir Simulation ─────────────────────────────────────────
export const reservoirSimulations = pgTable("reservoir_simulations", {
  id: serial("id").primaryKey(),
  simId: varchar("sim_id", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 256 }).notNull(),
  simulator: varchar("simulator", { length: 32 }).notNull().default("opm_flow"),
  fieldId: varchar("field_id", { length: 32 }),
  modelFile: text("model_file"),
  status: varchar("status", { length: 32 }).notNull().default("queued"),
  submittedBy: varchar("submitted_by", { length: 64 }),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  durationSec: integer("duration_sec"),
  outputUrl: text("output_url"),
  summaryStats: text("summary_stats"),
  errorMessage: text("error_message"),
  cpuCores: integer("cpu_cores").notNull().default(4),
  memoryGb: integer("memory_gb").notNull().default(8),
});
export type ReservoirSimulation = typeof reservoirSimulations.$inferSelect;
export type InsertReservoirSimulation = typeof reservoirSimulations.$inferInsert;

// ─── TIER 6: Emissions / Carbon Accounting ────────────────────────────────
export const emissionSources = pgTable("emission_sources", {
  id: serial("id").primaryKey(),
  sourceId: varchar("source_id", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 256 }).notNull(),
  sourceType: varchar("source_type", { length: 64 }).notNull(),
  wellId: varchar("well_id", { length: 32 }),
  facilityId: varchar("facility_id", { length: 64 }),
  emissionScope: varchar("emission_scope", { length: 16 }).notNull().default("scope1"),
  ghgComponent: varchar("ghg_component", { length: 32 }).notNull().default("co2"),
  emissionFactor: real("emission_factor"),
  emissionFactorUnit: varchar("emission_factor_unit", { length: 64 }),
  emissionFactorSource: varchar("emission_factor_source", { length: 128 }).default("EPA_AP42"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type EmissionSource = typeof emissionSources.$inferSelect;
export type InsertEmissionSource = typeof emissionSources.$inferInsert;

export const emissionRecords = pgTable("emission_records", {
  id: serial("id").primaryKey(),
  sourceId: varchar("source_id", { length: 64 }).notNull(),
  reportingPeriodStart: timestamp("reporting_period_start").notNull(),
  reportingPeriodEnd: timestamp("reporting_period_end").notNull(),
  activityData: real("activity_data").notNull(),
  activityUnit: varchar("activity_unit", { length: 32 }).notNull(),
  co2Tonnes: real("co2_tonnes"),
  ch4Tonnes: real("ch4_tonnes"),
  n2oTonnes: real("n2o_tonnes"),
  co2eTonnes: real("co2e_tonnes"),
  calculationMethod: varchar("calculation_method", { length: 64 }).notNull().default("emission_factor"),
  verificationStatus: varchar("verification_status", { length: 32 }).notNull().default("unverified"),
  verifiedBy: varchar("verified_by", { length: 64 }),
  verifiedAt: timestamp("verified_at"),
  reportingStandard: varchar("reporting_standard", { length: 64 }).default("GHG_Protocol"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type EmissionRecord = typeof emissionRecords.$inferSelect;
export type InsertEmissionRecord = typeof emissionRecords.$inferInsert;

export const carbonTargets = pgTable("carbon_targets", {
  id: serial("id").primaryKey(),
  targetYear: integer("target_year").notNull(),
  scope: varchar("scope", { length: 16 }).notNull(),
  baselineYear: integer("baseline_year").notNull().default(2019),
  baselineCo2eTonnes: real("baseline_co2e_tonnes"),
  targetCo2eTonnes: real("target_co2e_tonnes"),
  reductionPercent: real("reduction_percent"),
  actualCo2eTonnes: real("actual_co2e_tonnes"),
  status: varchar("status", { length: 32 }).notNull().default("on_track"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type CarbonTarget = typeof carbonTargets.$inferSelect;

// ─── TIER 6: Drone Inspection Management ──────────────────────────────────
export const droneInspections = pgTable("drone_inspections", {
  id: serial("id").primaryKey(),
  inspectionId: varchar("inspection_id", { length: 64 }).notNull().unique(),
  wellId: varchar("well_id", { length: 32 }),
  facilityId: varchar("facility_id", { length: 64 }),
  droneModel: varchar("drone_model", { length: 64 }),
  pilotName: varchar("pilot_name", { length: 128 }),
  inspectionType: varchar("inspection_type", { length: 64 }).notNull().default("visual"),
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  flightDurationMin: integer("flight_duration_min"),
  flightLogUrl: text("flight_log_url"),
  imageCount: integer("image_count").notNull().default(0),
  thermalImageCount: integer("thermal_image_count").notNull().default(0),
  status: varchar("status", { length: 32 }).notNull().default("scheduled"),
  weatherConditions: varchar("weather_conditions", { length: 128 }),
  windSpeedKnots: real("wind_speed_knots"),
  notes: text("notes"),
  mediaUrls: text("media_urls"), // JSON array of S3 URLs for photos/videos
  reportUrl: text("report_url"), // Final inspection report PDF URL
  aiDefectSummary: text("ai_defect_summary"), // AI-generated defect analysis
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type DroneInspection = typeof droneInspections.$inferSelect;
export type InsertDroneInspection = typeof droneInspections.$inferInsert;

export const droneFindings = pgTable("drone_findings", {
  id: serial("id").primaryKey(),
  inspectionId: varchar("inspection_id", { length: 64 }).notNull(),
  findingType: varchar("finding_type", { length: 64 }).notNull(),
  severity: varchar("severity", { length: 32 }).notNull().default("low"),
  location: varchar("location", { length: 256 }),
  description: text("description"),
  imageUrl: text("image_url"),
  thermalImageUrl: text("thermal_image_url"),
  aiDetectionConfidence: real("ai_detection_confidence"),
  aiModelVersion: varchar("ai_model_version", { length: 32 }),
  workOrderId: integer("work_order_id"),
  status: varchar("status", { length: 32 }).notNull().default("open"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type DroneFinding = typeof droneFindings.$inferSelect;
export type InsertDroneFinding = typeof droneFindings.$inferInsert;

// ─── TIER 7: White-Label SaaS ─────────────────────────────────────────────
export const saasPlans = pgTable("saas_plans", {
  id: serial("id").primaryKey(),
  planId: varchar("plan_id", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  pricePerWellMonthly: real("price_per_well_monthly").notNull(),
  pricePerWellAnnual: real("price_per_well_annual"),
  maxWells: integer("max_wells"),
  maxUsers: integer("max_users"),
  maxDataRetentionDays: integer("max_data_retention_days").notNull().default(365),
  featuresIncluded: text("features_included"),
  isActive: boolean("is_active").notNull().default(true),
  stripePriceIdMonthly: varchar("stripe_price_id_monthly", { length: 128 }),
  stripePriceIdAnnual: varchar("stripe_price_id_annual", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type SaasPlan = typeof saasPlans.$inferSelect;
export type InsertSaasPlan = typeof saasPlans.$inferInsert;

export const saasSubscriptions = pgTable("saas_subscriptions", {
  id: serial("id").primaryKey(),
  subscriptionId: varchar("subscription_id", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  planId: varchar("plan_id", { length: 64 }).notNull(),
  billingCycle: varchar("billing_cycle", { length: 16 }).notNull().default("monthly"),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 128 }),
  stripeCustomerId: varchar("stripe_customer_id", { length: 128 }),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  wellCount: integer("well_count").notNull().default(0),
  monthlyRevenue: real("monthly_revenue"),
  trialEndsAt: timestamp("trial_ends_at"),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type SaasSubscription = typeof saasSubscriptions.$inferSelect;
export type InsertSaasSubscription = typeof saasSubscriptions.$inferInsert;

export const saasUsageMetrics = pgTable("saas_usage_metrics", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  metricDate: timestamp("metric_date").notNull(),
  activeWells: integer("active_wells").notNull().default(0),
  activeUsers: integer("active_users").notNull().default(0),
  apiCallsTotal: integer("api_calls_total").notNull().default(0),
  dataIngestGb: real("data_ingest_gb").notNull().default(0),
  storageUsedGb: real("storage_used_gb").notNull().default(0),
  aiCopilotQueries: integer("ai_copilot_queries").notNull().default(0),
  optimizationRuns: integer("optimization_runs").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── TIER 7: Analytics Marketplace ────────────────────────────────────────
export const marketplaceApps = pgTable("marketplace_apps", {
  id: serial("id").primaryKey(),
  appId: varchar("app_id", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  longDescription: text("long_description"),
  category: varchar("category", { length: 64 }).notNull(),
  author: varchar("author", { length: 128 }).notNull(),
  authorOrg: varchar("author_org", { length: 128 }),
  version: varchar("version", { length: 32 }).notNull().default("1.0.0"),
  iconUrl: text("icon_url"),
  entrypoint: text("entrypoint"),
  runtime: varchar("runtime", { length: 32 }).notNull().default("python"),
  inputSchema: text("input_schema"),
  outputSchema: text("output_schema"),
  requiredPermissions: text("required_permissions"),
  pricingModel: varchar("pricing_model", { length: 32 }).notNull().default("free"),
  pricePerRun: real("price_per_run"),
  priceMonthly: real("price_monthly"),
  installCount: integer("install_count").notNull().default(0),
  rating: real("rating"),
  ratingCount: integer("rating_count").notNull().default(0),
  isVerified: boolean("is_verified").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  tags: text("tags"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type MarketplaceApp = typeof marketplaceApps.$inferSelect;
export type InsertMarketplaceApp = typeof marketplaceApps.$inferInsert;

export const marketplaceInstalls = pgTable("marketplace_installs", {
  id: serial("id").primaryKey(),
  appId: varchar("app_id", { length: 64 }).notNull(),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  installedBy: varchar("installed_by", { length: 64 }),
  configJson: text("config_json"),
  isActive: boolean("is_active").notNull().default(true),
  installedAt: timestamp("installed_at").defaultNow().notNull(),
  lastRunAt: timestamp("last_run_at"),
  runCount: integer("run_count").notNull().default(0),
});

export const marketplaceRuns = pgTable("marketplace_runs", {
  id: serial("id").primaryKey(),
  runId: varchar("run_id", { length: 64 }).notNull().unique(),
  appId: varchar("app_id", { length: 64 }).notNull(),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  triggeredBy: varchar("triggered_by", { length: 64 }),
  inputData: text("input_data"),
  outputData: text("output_data"),
  status: varchar("status", { length: 32 }).notNull().default("queued"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),
  errorMessage: text("error_message"),
  cost: real("cost"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type MarketplaceRun = typeof marketplaceRuns.$inferSelect;

// ─── OPC-UA Server Registry ────────────────────────────────────────────────
export const opcuaServerNodes = pgTable("opcua_server_nodes", {
  id: serial("id").primaryKey(),
  nodeId: varchar("node_id", { length: 128 }).notNull().unique(),
  displayName: varchar("display_name", { length: 256 }).notNull(),
  nodeClass: varchar("node_class", { length: 32 }).notNull().default("Variable"),
  dataType: varchar("data_type", { length: 32 }).notNull().default("Double"),
  tagName: varchar("tag_name", { length: 128 }),
  wellId: varchar("well_id", { length: 32 }),
  accessLevel: varchar("access_level", { length: 32 }).notNull().default("read"),
  description: text("description"),
  engineeringUnit: varchar("engineering_unit", { length: 32 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type OpcuaServerNode = typeof opcuaServerNodes.$inferSelect;
export type InsertOpcuaServerNode = typeof opcuaServerNodes.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════
// v56 PLATFORM IMPROVEMENTS — Soft Delete, Idempotency, Feature Flags, DQ
// ═══════════════════════════════════════════════════════════════════════════

// ─── Idempotency Keys ─────────────────────────────────────────────────────
export const idempotencyKeys = pgTable("idempotency_keys", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  userId: varchar("user_id", { length: 128 }).notNull(),
  route: varchar("route", { length: 256 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("processing"),
  responseStatus: integer("response_status"),
  responseBody: text("response_body"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});
export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;
export type InsertIdempotencyKey = typeof idempotencyKeys.$inferInsert;

// ─── Feature Flags ────────────────────────────────────────────────────────
export const featureFlags = pgTable("feature_flags", {
  id: serial("id").primaryKey(),
  flagKey: varchar("flag_key", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  enabled: boolean("enabled").notNull().default(false),
  tenantIds: text("tenant_ids"),
  percentage: integer("percentage").default(100),
  createdBy: varchar("created_by", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type FeatureFlag = typeof featureFlags.$inferSelect;
export type InsertFeatureFlag = typeof featureFlags.$inferInsert;

// ─── Data Quality Rules ───────────────────────────────────────────────────
export const dataQualityRules = pgTable("data_quality_rules", {
  id: serial("id").primaryKey(),
  ruleName: varchar("rule_name", { length: 128 }).notNull(),
  sensorType: varchar("sensor_type", { length: 64 }).notNull(),
  minValue: real("min_value"),
  maxValue: real("max_value"),
  maxRateOfChange: real("max_rate_of_change"),
  unit: varchar("unit", { length: 16 }),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type DataQualityRule = typeof dataQualityRules.$inferSelect;
export type InsertDataQualityRule = typeof dataQualityRules.$inferInsert;

export const dataQualityViolations = pgTable("data_quality_violations", {
  id: serial("id").primaryKey(),
  ruleId: integer("rule_id").notNull(),
  wellId: varchar("well_id", { length: 32 }).notNull(),
  sensorType: varchar("sensor_type", { length: 64 }).notNull(),
  value: real("value").notNull(),
  expectedRange: varchar("expected_range", { length: 64 }),
  violationType: varchar("violation_type", { length: 32 }).notNull(),
  severity: varchar("severity", { length: 16 }).notNull().default("warning"),
  acknowledged: boolean("acknowledged").notNull().default(false),
  acknowledgedBy: varchar("acknowledged_by", { length: 128 }),
  acknowledgedAt: timestamp("acknowledged_at"),
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type DataQualityViolation = typeof dataQualityViolations.$inferSelect;
export type InsertDataQualityViolation = typeof dataQualityViolations.$inferInsert;
