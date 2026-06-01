import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

// Existing routers
import { shiftHandoverRouter } from "./routers/shiftHandover";
import { nvdCveRouter } from "./routers/nvdCve";
import { permitToWorkRouter } from "./routers/permitToWork";

// Core platform routers
import { wellsRouter } from "./routers/wells";
import { financialsRouter } from "./routers/financials";

// Domain routers
import {
  calibrationRouter,
  fpsoRouter,
  connectivityRouter,
  actuatorRouter,
  hseRouter,
  cybersecurityRouter,
  regulatoryRouter,
  mlRouter,
  digitalTwinRouter,
  digitalTwinExtRouter,
  productionRouter,
  auditRouter,
} from "./routers/domain";

// Platform routers (previously orphaned)
import {
  telemetryRouter,
  alarmsRouter,
  workoverRouter,
  securityRouter,
  allocationRouter,
  overviewRouter,
  temporalRouter,
} from "./routers/platform";
import { piConnectorRouter } from "./routers/piConnector";
import { silCertificationRouter } from "./routers/silCertification";
import { influxBenchmarkRouter } from "./routers/influxBenchmark";
import { userOnboardingRouter } from "./routers/userOnboarding";
import { deviceManagementRouter } from "./routers/deviceManagement";
import { otaManagementRouter } from "./routers/otaManagement";
import { productionOptimizationRouter } from "./routers/productionOptimization";
import { pushRouter } from "./routers/pushRouter";
import { cacheRouter } from "./routers/cache";
import { streamingRouter } from "./routers/streaming";
import { ledgerRouter } from "./routers/ledger";
import { workflowsRouter } from "./routers/workflows";
import { lakehouseRouter } from "./routers/lakehouse";
import { demandResponseRouter } from "./routers/demandResponse";
import { authzRouter } from "./routers/authz";
import { openStefRouter } from "./routers/openstef";
import { fledgeRouter } from "./routers/fledge";
import { damageAssessmentRouter, alertThresholdsRouter } from "./routers/damageAssessment";
import {
  geomechanicsRouter,
  mudManagementRouter,
  sandManagementRouter,
  producedWaterRouter,
  heavyOilRouter,
  liquidLoadingRouter,
} from "./routers/trexm";
import { productionForecastingRouter } from "./routers/productionForecasting";
import { wellboreIntegrityRouter } from "./routers/wellboreIntegrity";
import { reservoirPressureRouter } from "./routers/reservoirPressure";
import { aiCopilotRouter } from "./routers/aiCopilot";
import { materialsManagementRouter } from "./routers/materialsManagement";
import { osduMetadataRouter } from "./routers/osduMetadata";
import { grafanaRouter } from "./routers/grafana";
import { regulatorySchedulerRouter } from "./routers/regulatoryScheduler";
// v41.0 New production routers
import { productionTargetsRouter } from "./routers/productionTargets";
import { wellTestsRouter } from "./routers/wellTests";
import { waterInjectionRouter } from "./routers/waterInjection";
import { tenantIsolationRouter } from "./routers/tenantIsolation";
// v42.0 20-item enhancement routers
import { iec62443Router } from "./routers/iec62443";
import { silRouter } from "./routers/sil";
import { soc2Router } from "./routers/soc2";
import { historianRouter } from "./routers/historian";
import { digitalTwinRouter as digitalTwinV42Router } from "./routers/digitalTwin";
import { aiAdvancedRouter } from "./routers/aiAdvanced";
import { integrationsRouter } from "./routers/integrations";
import { operationsRouter } from "./routers/operations";
import { saasRouter } from "./routers/saas";
import { stripeBillingRouter } from "./routers/stripeBilling";
import { paymentsRouter } from "./routers/payments";
import { physicsEngineRouter, pinnRouter } from "./routers/physicsEngine";
import { masterSeedRouter } from "./routers/masterSeed";
import { collaborationRouter } from "./routers/collaboration";
import { dataExportRouter } from "./routers/dataExport";
// v56.0 Platform improvements
import { featureFlagsRouter } from "./routers/featureFlags";
import { dataQualityRouter } from "./routers/dataQuality";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ── Core O&G modules ──────────────────────────────────────────────────────
  wells: wellsRouter,
  production: productionRouter,
  telemetry: telemetryRouter,
  alarms: alarmsRouter,
  workovers: workoverRouter,
  overview: overviewRouter,

  // ── Financial ─────────────────────────────────────────────────────────────
  financials: financialsRouter,
  allocation: allocationRouter,

  // ── Offshore / FPSO ───────────────────────────────────────────────────────
  fpso: fpsoRouter,

  // ── Field operations ──────────────────────────────────────────────────────
  calibration: calibrationRouter,
  connectivity: connectivityRouter,
  actuator: actuatorRouter,
  permitToWork: permitToWorkRouter,

  // ── Safety & compliance ───────────────────────────────────────────────────
  hse: hseRouter,
  cybersecurity: cybersecurityRouter,
  security: securityRouter,
  regulatory: regulatoryRouter,

  // ── Intelligence ──────────────────────────────────────────────────────────
  ml: mlRouter,
  digitalTwin: digitalTwinRouter,
  nvdCve: nvdCveRouter,

  // ── Workflow engine ───────────────────────────────────────────────────────
  temporal: temporalRouter,

  // ── Historian integration ────────────────────────────────────────────────
  piConnector: piConnectorRouter,

  // ── Functional safety ────────────────────────────────────────────────────
  silCertification: silCertificationRouter,

  // ── Performance benchmarking ─────────────────────────────────────────────
  influxBenchmark: influxBenchmarkRouter,

  // ── User & device management ───────────────────────────────────────────────
  userOnboarding: userOnboardingRouter,
  deviceManagement: deviceManagementRouter,
  otaManagement: otaManagementRouter,

  // ── Production optimization ────────────────────────────────────
  productionOptimization: productionOptimizationRouter,

  // ── Shift management ──────────────────────────────────────────
  shiftHandover: shiftHandoverRouter,

  // ── PWA push notifications ────────────────────────────────────
  push: pushRouter,

  // ── Audit ─────────────────────────────────────────────────────────────────
  audit: auditRouter,

  // ── v12.0 Middleware stack ─────────────────────────────────────────────────
  cache: cacheRouter,
  streaming: streamingRouter,
  ledger: ledgerRouter,
  workflows: workflowsRouter,
  lakehouse: lakehouseRouter,
  demandResponse: demandResponseRouter,
  authz: authzRouter,
  // ── v12.2 OpenSTEF forecasting ──────────────────────────────────────────
  openstef: openStefRouter,
  // ── v12.4 FledgePower protocol bridge ─────────────────────────────────────
  fledge: fledgeRouter,
  // ── v20.0 Digital Twin ML extensions (Ollama, sensitivity, multi-scenario) ──
  digitalTwinExt: digitalTwinExtRouter,
  // ── v21.0 War Damage Assessment ──────────────────────────────────────────────
  damageAssessment: damageAssessmentRouter,
  alertThresholds: alertThresholdsRouter,
  // ── v23.0 Lakehouse Extension: Rust DataFusion + Python Sedona + DuckDB ──────

  // ── v35.0 Trexm Co-Creation: Geomechanics, Mud, Sand, Water, Heavy Oil, Liquid Loading ──
  geomechanics: geomechanicsRouter,
  mudManagement: mudManagementRouter,
  sandManagement: sandManagementRouter,
  producedWater: producedWaterRouter,
  heavyOil: heavyOilRouter,
  liquidLoading: liquidLoadingRouter,
  // ── v37.0 Production Finalization: Forecasting, Integrity, Reservoir, AI Co-Pilot ──
  productionForecasting: productionForecastingRouter,
  wellboreIntegrity: wellboreIntegrityRouter,
  reservoirPressure: reservoirPressureRouter,
  aiCopilot: aiCopilotRouter,
  // ── v38.0 ERPNext-inspired Materials Management ──
  materials: materialsManagementRouter,
  // ── v38.0 OSDU Metadata Layer (Open Subsurface Data Universe R3) ──
  osdu: osduMetadataRouter,
  // ── v39.0 Grafana Dashboard Proxy ──
  grafana: grafanaRouter,
  // ── v39.0 Regulatory Export Scheduler ──
  regulatoryScheduler: regulatorySchedulerRouter,
  // ── v41.0 Production Targets, Well Tests, Water Injection, Multi-tenant ──
  productionTargets: productionTargetsRouter,
  wellTests: wellTestsRouter,
  waterInjection: waterInjectionRouter,
  tenantIsolation: tenantIsolationRouter,
  // ── v42.0 20-item enhancements ──────────────────────────────────────────────
  iec62443: iec62443Router,
  sil: silRouter,
  soc2: soc2Router,
  historian: historianRouter,
  digitalTwinV42: digitalTwinV42Router,
  aiAdvanced: aiAdvancedRouter,
  integrations: integrationsRouter,
  operations: operationsRouter,
  saas: saasRouter,
  // ── v43.0 Stripe SaaS Billing + Unified Payments ────────────────────────────
  stripeBilling: stripeBillingRouter,
  payments: paymentsRouter,
  // ── v45.0 Rust Physics Engine (live proxy to :4001) ──────────────────────
  physicsEngine: physicsEngineRouter,
  // ── v45.0 Master Seeder (admin-only one-click demo data) ──────────────────────
  masterSeed: masterSeedRouter,
  // ── v50.0 Real-time Collaboration + ML Failure Prediction ────────────────────
  collaboration: collaborationRouter,
  // ── v54.0 PINN Surrogate ML (proxy to :4003) ──────────────────────────────
  pinn: pinnRouter,
  // ── v54.0 Data Export (CSV/JSON production, alarms, KPI, audit, physics) ──
  dataExport: dataExportRouter,
  // ── v56.0 Platform Improvements ─────────────────────────────────────────
  featureFlags: featureFlagsRouter,
  dataQuality: dataQualityRouter,
});

export type AppRouter = typeof appRouter;
