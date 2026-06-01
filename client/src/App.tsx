import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/layout/DashboardLayout";
import OverviewPage from "./pages/Overview";
import WellsPage from "./pages/Wells";
import WellDetailPage from "./pages/WellDetail";
import AlarmsPage from "./pages/Alarms";
import AlarmRulesPage from "./pages/AlarmRules";
import FinancialsPage from "./pages/Financials";
import AnalyticsPage from "./pages/Analytics";
import MLInsightsPage from "./pages/MLInsights";
import MapPage from "./pages/Map";
import WorkoversPage from "./pages/Workovers";
import FPSOPage from "./pages/FPSO";
import CalibrationPage from "./pages/Calibration";
import ConnectivityPage from "./pages/Connectivity";
import ActuatorControlPage from "./pages/ActuatorControl";
import CybersecurityPage from "./pages/Cybersecurity";
import DigitalTwinPage from "./pages/DigitalTwin";
import ProductionAllocationPage from "./pages/ProductionAllocation";
import SISPage from "./pages/SIS";
import ShiftHandoverPage from "./pages/ShiftHandover";
import RegulatoryPage from "./pages/Regulatory";
import PermitToWorkPage from "./pages/PermitToWork";
import RegulatoryMEPage from "./pages/RegulatoryME";
import HSEPage from "./pages/HSE";
import GCCInteropPage from "./pages/GCCInterop";
import TemporalWorkflowsPage from "./pages/TemporalWorkflows";
import PIConnectorPage from "./pages/PIConnector";
import SILCertificationPage from "./pages/SILCertification";
import InfluxBenchmarkPage from "./pages/InfluxBenchmark";
import UserOnboardingPage from "./pages/UserOnboarding";
import DeviceManagementPage from "./pages/DeviceManagement";
import OTAManagementPage from "./pages/OTAManagement";
import ProductionOptimizationPage from "./pages/ProductionOptimization";
import SettingsPage from "./pages/Settings";
import InfrastructurePage from "./pages/Infrastructure";
import LakehousePage from "./pages/Lakehouse";
import DemandResponsePage from "./pages/DemandResponse";
import DamageAssessmentPage from "./pages/DamageAssessment";
import DamageAssessmentNewPage from "./pages/DamageAssessmentNew";
import GasWellLiquidLoadingPage from "./pages/GasWellLiquidLoading";
import WellboreGeomechanicsPage from "./pages/WellboreGeomechanics";
import MudManagementPage from "./pages/MudManagement";
import SandManagementPage from "./pages/SandManagement";
import ProducedWaterManagementPage from "./pages/ProducedWaterManagement";
import HeavyOilOptimizationPage from "./pages/HeavyOilOptimization";
import ProductionForecastingPage from "./pages/ProductionForecasting";
import WellboreIntegrityPage from "./pages/WellboreIntegrity";
import ReservoirPressurePage from "./pages/ReservoirPressureManagement";
import AICopilotPage from "./pages/AICopilot";
import MaterialsManagementPage from "./pages/MaterialsManagement";
import OSDUDataExplorerPage from "./pages/OSDUDataExplorer";
import GrafanaDashboardsPage from "./pages/GrafanaDashboards";
import RegulatorySchedulerPage from "./pages/RegulatoryScheduler";
import WaterInjectionPage from "./pages/WaterInjection";
import WellTestsPage from "./pages/WellTests";
import ProductionTargetsPage from "./pages/ProductionTargets";
import { OfflineSyncBanner } from "./components/OfflineSyncBanner";
import AcceptInvitePage from "./pages/AcceptInvite";
import NotFound from "./pages/NotFound";
import Iec62443Page from "./pages/Iec62443";
import SilPage from "./pages/Sil";
import Soc2Page from "./pages/Soc2";
import HistorianPage from "./pages/Historian";
import DigitalTwinV42Page from "./pages/DigitalTwinV42";
import AiAdvancedPage from "./pages/AiAdvanced";
import IntegrationsPage from "./pages/Integrations";
import OperationsPage from "./pages/Operations";
import SaasPlatformPage from "./pages/SaasPlatform";
import BillingPage from "./pages/Billing";
import RustPhysicsEnginePage from "./pages/RustPhysicsEngine";
import SeedAdminPage from "./pages/SeedAdmin";
import PwaTwinPhysicsPage from "./pages/PwaTwinPhysics";
import WellKPIDashboardPage from "./pages/WellKPIDashboard";
import DataExportPage from "./pages/DataExport";
import TelemetryDashboardPage from "./pages/TelemetryDashboard";
import AuditLogPage from "./pages/AuditLog";
import TenantManagementPage from "./pages/TenantManagement";
import ProductionLedgerPage from "./pages/ProductionLedger";
import WorkflowEnginePage from "./pages/WorkflowEngine";

function DashboardRouter() {
  // make sure to consider if you need authentication for certain routes
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={OverviewPage} />
        <Route path="/wells" component={WellsPage} />
        <Route path="/wells/:wellId" component={WellDetailPage} />
        <Route path="/alarms" component={AlarmsPage} />
        <Route path="/alarm-rules" component={AlarmRulesPage} />
        <Route path="/financials" component={FinancialsPage} />
        <Route path="/analytics" component={AnalyticsPage} />
        <Route path="/ml-insights" component={MLInsightsPage} />
        <Route path="/map" component={MapPage} />
        <Route path="/workovers" component={WorkoversPage} />
        <Route path="/fpso" component={FPSOPage} />
        <Route path="/calibration" component={CalibrationPage} />
        <Route path="/connectivity" component={ConnectivityPage} />
        <Route path="/actuator-control" component={ActuatorControlPage} />
        <Route path="/cybersecurity" component={CybersecurityPage} />
        <Route path="/digital-twin" component={DigitalTwinPage} />
        <Route path="/production-allocation" component={ProductionAllocationPage} />
        <Route path="/sis" component={SISPage} />
        <Route path="/shift-handover" component={ShiftHandoverPage} />
        <Route path="/regulatory" component={RegulatoryPage} />
        <Route path="/permits" component={PermitToWorkPage} />
        <Route path="/regulatory-me" component={RegulatoryMEPage} />
        <Route path="/hse" component={HSEPage} />
        <Route path="/gcc-interop" component={GCCInteropPage} />
        <Route path="/temporal-workflows" component={TemporalWorkflowsPage} />
        <Route path="/pi-connector" component={PIConnectorPage} />
        <Route path="/sil-certification" component={SILCertificationPage} />
        <Route path="/influx-benchmark" component={InfluxBenchmarkPage} />
        <Route path="/user-management" component={UserOnboardingPage} />
        <Route path="/device-management" component={DeviceManagementPage} />
        <Route path="/ota-management" component={OTAManagementPage} />
        <Route path="/production-optimization" component={ProductionOptimizationPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/infrastructure" component={InfrastructurePage} />
        <Route path="/lakehouse" component={LakehousePage} />
        <Route path="/demand-response" component={DemandResponsePage} />
        <Route path="/damage-assessment" component={DamageAssessmentPage} />
        <Route path="/damage-assessment/new" component={DamageAssessmentNewPage} />
        {/* ── v35.0 Trexm Co-Creation ── */}
        <Route path="/gas-well-liquid-loading" component={GasWellLiquidLoadingPage} />
        <Route path="/wellbore-geomechanics" component={WellboreGeomechanicsPage} />
        <Route path="/mud-management" component={MudManagementPage} />
        <Route path="/sand-management" component={SandManagementPage} />
        <Route path="/produced-water" component={ProducedWaterManagementPage} />
        <Route path="/heavy-oil" component={HeavyOilOptimizationPage} />
        {/* ── v36.0 Finalization ── */}
        <Route path="/production-forecasting" component={ProductionForecastingPage} />
        <Route path="/wellbore-integrity" component={WellboreIntegrityPage} />
        <Route path="/reservoir-pressure" component={ReservoirPressurePage} />
        <Route path="/ai-copilot" component={AICopilotPage} />
        {/* ── v38.0 ERPNext Materials Management ── */}
        <Route path="/materials-management" component={MaterialsManagementPage} />
        {/* ── v38.0 OSDU Data Explorer ── */}
        <Route path="/osdu-explorer" component={OSDUDataExplorerPage} />
        {/* ── v39.0 Grafana Dashboards + Regulatory Scheduler ── */}
        <Route path="/grafana-dashboards" component={GrafanaDashboardsPage} />
        <Route path="/regulatory-scheduler" component={RegulatorySchedulerPage} />
        {/* ── v41.0 Production Completeness ── */}
        <Route path="/water-injection" component={WaterInjectionPage} />
        <Route path="/well-tests" component={WellTestsPage} />
        <Route path="/production-targets" component={ProductionTargetsPage} />
        {/* ── v42.0 20-Enhancement Sprint ── */}
        <Route path="/iec62443" component={Iec62443Page} />
        <Route path="/sil" component={SilPage} />
        <Route path="/soc2" component={Soc2Page} />
        <Route path="/historian" component={HistorianPage} />
        <Route path="/digital-twin-v42" component={DigitalTwinV42Page} />
        <Route path="/ai-advanced" component={AiAdvancedPage} />
        <Route path="/integrations-v42" component={IntegrationsPage} />
        <Route path="/operations-v42" component={OperationsPage} />
        <Route path="/saas-platform" component={SaasPlatformPage} />
        <Route path="/billing" component={BillingPage} />
        {/* ── v45.0 Rust Physics Engine ── */}
        <Route path="/rust-physics-engine" component={RustPhysicsEnginePage} />
        {/* ── v45.0 Seed Admin ── */}
        <Route path="/seed-admin" component={SeedAdminPage} />
        {/* ── v48.0 PWA Digital Twin with Rust Physics ── */}
        <Route path="/pwa-twin-physics" component={PwaTwinPhysicsPage} />
        {/* ── v50.0 6-Well KPI Dashboard ── */}
        <Route path="/well-kpi-dashboard" component={WellKPIDashboardPage} />
        {/* ── v54.0 Data Export Center ── */}
        <Route path="/data-export" component={DataExportPage} />
        {/* ── v55.0 Real-time Telemetry Dashboard ── */}
        <Route path="/telemetry-dashboard" component={TelemetryDashboardPage} />
        {/* ── v56.0 Orphan Feature Completions ── */}
        <Route path="/audit-log" component={AuditLogPage} />
        <Route path="/tenant-management" component={TenantManagementPage} />
        <Route path="/production-ledger" component={ProductionLedgerPage} />
        <Route path="/workflow-engine" component={WorkflowEnginePage} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public routes — no DashboardLayout, no auth required */}
      <Route path="/accept-invite" component={AcceptInvitePage} />
      {/* All other routes go through the authenticated dashboard */}
      <Route component={DashboardRouter} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
          <OfflineSyncBanner />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
