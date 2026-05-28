
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
