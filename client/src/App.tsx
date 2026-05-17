// @ts-nocheck — Sprint 69
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import { ThemeProvider } from "./contexts/ThemeContext";
import { usePosStore } from "./store/posStore";
import { useTerminalSocket } from "./hooks/useSocket";
import { useOfflineSync } from "./hooks/useOfflineSync";
import ErrorBoundary from "./components/ErrorBoundary";
import { PWAInstallBanner } from "./components/PWAInstallBanner";
import { GdprConsentBanner } from "./components/GdprConsentBanner";
import AgentLogin from "./pages/AgentLogin";
import POSShell from "./pages/POSShell";
import FraudDashboard from "./pages/FraudDashboard";
import AdminPanel from "./pages/AdminPanel";
import SupervisorDashboard from "./pages/SupervisorDashboard";
import ManagementPortal from "./pages/ManagementPortal";
import AgentPortal from "./pages/AgentPortal";
import CustomerPortal from "./pages/CustomerPortal";
import SuperAdminPortal from "./pages/SuperAdminPortal";
import PlatformHub from "./pages/PlatformHub";
import AnalyticsDashboard from "./pages/AnalyticsDashboard";
import MerchantPortal from "./pages/MerchantPortal";
import DeveloperPortal from "./pages/DeveloperPortal";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import SystemHealth from "./pages/SystemHealth";
import SystemHealthDashboard from "./pages/SystemHealthDashboard";
import LakehouseAnalytics from "./pages/LakehouseAnalytics";
import WebhookManager from "./pages/WebhookManager";
import CommissionPayouts from "./pages/CommissionPayouts";
import AgentOnboarding from "./pages/AgentOnboarding";
import SettlementReconciliation from "./pages/SettlementReconciliation";
import ReferralProgram from "./pages/ReferralProgram";
import AuditLogViewer from "./pages/AuditLogViewer";
import InfrastructureDashboard from "./pages/InfrastructureDashboard";
import LoyaltySystem from "./pages/LoyaltySystem";
import LiveChatSupport from "./pages/LiveChatSupport";
import AgentPerformance from "./pages/AgentPerformance";
import CustomerWallet from "./pages/CustomerWallet";
import NotificationPreferences from "./pages/NotificationPreferences";
import MultiCurrency from "./pages/MultiCurrency";
import ComplianceScheduling from "./pages/ComplianceScheduling";
import AuditExport from "./pages/AuditExport";
import WebhookDeliveryViewer from "./pages/WebhookDeliveryViewer";
import GeofenceZoneEditor from "./pages/GeofenceZoneEditor";
import ApiKeyManagement from "./pages/ApiKeyManagement";
import KycWorkflow from "./pages/KycWorkflow";
import OnboardingWizard from "./pages/OnboardingWizard";
import CommissionConfig from "./pages/CommissionConfig";
import RateAlerts from "./pages/RateAlerts";
import NotificationInbox from "./pages/NotificationInbox";
import NotificationPreferenceMatrix from "./pages/NotificationPreferenceMatrix";
import WebhookConfig from "./pages/WebhookConfig";
import BatchOperations from "./pages/BatchOperations";
import AdminAnalyticsDashboard from "./pages/AdminAnalyticsDashboard";
import GlobalSearch from "./components/GlobalSearch";
import { LiveChatWidget } from "./components/LiveChatWidget";
import { ProactiveHelp } from "./components/ProactiveHelp";
import KeyboardShortcutsHelp, { useKeyboardShortcuts } from "./components/KeyboardShortcuts";
import { ErrorBoundaryRoute } from "./components/ErrorBoundaryRoute";
import BroadcastManager from "./pages/BroadcastManager";
import ScheduledReports from "./pages/ScheduledReports";
import UserNotifSettings from "./pages/UserNotifSettings";
import AnnouncementBanner from "./components/AnnouncementBanner";
import DataThresholdAlerts from "./pages/DataThresholdAlerts";
import SharedLayoutGallery from "./pages/SharedLayoutGallery";
import ReportTemplateDesigner from "./pages/ReportTemplateDesigner";
import EscalationChains from "./pages/EscalationChains";
import NotificationAnalytics from "./pages/NotificationAnalytics";
import UserQuietHours from "./pages/UserQuietHours";
import NotificationTemplateManager from "./pages/NotificationTemplateManager";
import SystemConfigManager from "./pages/SystemConfigManager";
import PaymentNotificationSystem from "./pages/PaymentNotificationSystem";
import DatabaseVisualization from "./pages/DatabaseVisualization";
import MiddlewareServiceManager from "./pages/MiddlewareServiceManager";
import SkillCreatorIntegration from "./pages/SkillCreatorIntegration";
import PaymentReconciliation from "./pages/PaymentReconciliation";
import AgentPerformanceAnalytics from "./pages/AgentPerformanceAnalytics";
import ComplianceReporting from "./pages/ComplianceReporting";
import CustomerFeedbackNps from "./pages/CustomerFeedbackNps";
import MultiCurrencyExchange from "./pages/MultiCurrencyExchange";
import DisputeWorkflowEngine from "./pages/DisputeWorkflowEngine";
import BulkPaymentProcessor from "./pages/BulkPaymentProcessor";
import AgentHierarchyTerritory from "./pages/AgentHierarchyTerritory";
import FinancialReportingSuite from "./pages/FinancialReportingSuite";
import WebhookDeliverySystem from "./pages/WebhookDeliverySystem";
import PlatformConfigCenter from "./pages/PlatformConfigCenter";
import BankAccountManagementPage from "./pages/BankAccountManagementPage";
import KycDocumentManagementPage from "./pages/KycDocumentManagementPage";
import FloatReconciliationPage from "./pages/FloatReconciliationPage";
import CustomerDatabasePage from "./pages/CustomerDatabasePage";
import ReversalApprovalPage from "./pages/ReversalApprovalPage";
import CommissionClawbackPage from "./pages/CommissionClawbackPage";
import PnlReportPage from "./pages/PnlReportPage";
import TransactionLimitsEnginePage from "./pages/TransactionLimitsEnginePage";
import RegulatoryCompliancePage from "./pages/RegulatoryCompliancePage";
import SystemHealthDashboardPage from "./pages/SystemHealthDashboardPage";
import AgentSuspensionWorkflowPage from "./pages/AgentSuspensionWorkflowPage";
import SessionManager from "./pages/SessionManager";
import DataExportCenter from "./pages/DataExportCenter";
import PlatformChangelog from "./pages/PlatformChangelog";
import BulkNotifSender from "./pages/BulkNotifSender";
import RetryQueueViewer from "./pages/RetryQueueViewer";
import RateLimitDashboard from "./pages/RateLimitDashboard";
import ServiceHealthAggregator from "./pages/ServiceHealthAggregator";
import CacheManagement from "./pages/CacheManagement";
import PartnerOnboarding from "./pages/PartnerOnboarding";
import TenantAdminDashboard from "./pages/TenantAdminDashboard";
import InviteCodeManager from "./pages/InviteCodeManager";
import GdprDashboard from "./pages/GdprDashboard";
import CbnReportingDashboard from "./pages/CbnReportingDashboard";
import TigerBeetleLedger from "./pages/TigerBeetleLedger";
import TemporalWorkflowMonitor from "./pages/TemporalWorkflowMonitor";
import VaultSecretsManager from "./pages/VaultSecretsManager";
import ResilienceMonitor from "./pages/ResilienceMonitor";
import SimOrchestratorDashboard from "./pages/SimOrchestratorDashboard";
import MqttBridgeDashboard from "./pages/MqttBridgeDashboard";
import PushNotificationConfig from "./pages/PushNotificationConfig";
import AgentManagementDashboard from "./pages/AgentManagementDashboard";
import BusinessRulesDashboard from "./pages/BusinessRulesDashboard";
import AnnouncementReactions from "./pages/AnnouncementReactions";
import WeeklyReports from "./pages/WeeklyReports";
import ReportComparison from "./pages/ReportComparison";
import ThresholdManager from "./pages/ThresholdManager";
import EndpointRateLimits from "./pages/EndpointRateLimits";
import WebhookDeliveryMonitor from "./pages/WebhookDeliveryMonitor";
import AgentPerformanceScoring from "./pages/AgentPerformanceScoring";
import DisputeAutoRules from "./pages/DisputeAutoRules";
import KycVerificationWorkflow from "./pages/KycVerificationWorkflow";
import ProductionReadinessChecklist from "./pages/ProductionReadinessChecklist";
import ScheduledEmailDelivery from "./pages/ScheduledEmailDelivery";
import GlobalSearchPage from "./pages/GlobalSearchPage";
import UserGuide from "./pages/UserGuide";
import Payments from "./pages/Payments";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancel from "./pages/PaymentCancel";
import AdminDashboardPage from "./pages/AdminDashboard";
import AdminUserManagement from "./pages/AdminUserManagement";
import AdminSystemHealth from "./pages/AdminSystemHealth";
import AdminLivenessDeviceAnalytics from "./pages/AdminLivenessDeviceAnalytics";
import TransactionAnalytics from "./pages/TransactionAnalytics";
import OfflineQueueDashboard from "./pages/OfflineQueueDashboard";
import RansomwareAlertDashboard from "./pages/RansomwareAlertDashboard";
import PBACManagement from "./pages/PBACManagement";
import AlertNotificationPreferences from "./pages/AlertNotificationPreferences";
import NetworkQualityHeatmap from "./pages/NetworkQualityHeatmap";
import VideoTutorials from "./pages/VideoTutorials";
import FeedbackAnalytics from "./pages/FeedbackAnalytics";
import ApiDocs from "./pages/ApiDocs";
import { AccessibilityProvider } from "@/components/AccessibilityProvider";
import SystemStatus from "./pages/SystemStatus";
import AuditTrailPage from "./pages/AuditTrailPage";
// Sprint 28: Nigerian Agency Banking Features
import UssdGateway from "./pages/UssdGateway";
import MobileMoneyPage from "./pages/MobileMoneyPage";
import AgentHierarchyPage from "./pages/AgentHierarchyPage";
import CommissionEnginePage from "./pages/CommissionEnginePage";
import BulkOperationsPage from "./pages/BulkOperationsPage";
import GeoFencingPage from "./pages/GeoFencingPage";
import BiometricAuthPage from "./pages/BiometricAuthPage";
import OfflineSyncPage from "./pages/OfflineSyncPage";
import WhatsAppChannelPage from "./pages/WhatsAppChannelPage";
import MerchantPaymentsPage from "./pages/MerchantPaymentsPage";
import BillPaymentsPage from "./pages/BillPaymentsPage";
import AirtimeVendingPage from "./pages/AirtimeVendingPage";
import LoanDisbursementPage from "./pages/LoanDisbursementPage";
import InsuranceProductsPage from "./pages/InsuranceProductsPage";
import SavingsProductsPage from "./pages/SavingsProductsPage";
import ReferralProgramPage from "./pages/ReferralProgramPage";
import CardRequestPage from "./pages/CardRequestPage";
import AccountOpeningPage from "./pages/AccountOpeningPage";
import TaxCollectionPage from "./pages/TaxCollectionPage";
import PensionCollectionPage from "./pages/PensionCollectionPage";
import RemittancePage from "./pages/RemittancePage";
// Sprint 29: AI/ML/DL/GNN Integrations
import QdrantVectorSearchPage from "./pages/QdrantVectorSearchPage";
import FalkorDBGraphPage from "./pages/FalkorDBGraphPage";
import CocoIndexPipelinePage from "./pages/CocoIndexPipelinePage";
import OllamaLLMPage from "./pages/OllamaLLMPage";
import ARTRobustnessPage from "./pages/ARTRobustnessPage";
import LakehouseAiDashboard from "./pages/LakehouseAiDashboard";
import MLScoringDashboard from "./pages/MLScoringDashboard";
// Sprint 30: AI/ML Follow-ups
import AIMonitoringDashboard from "./pages/AIMonitoringDashboard";
import FraudReportPage from "./pages/FraudReportPage";
import ComplianceChatbotPage from "./pages/ComplianceChatbotPage";
// Sprint 31: Data Pipelines, Security, Production Features
import ApacheNifiPage from "./pages/ApacheNifiPage";
import DbtIntegrationPage from "./pages/DbtIntegrationPage";
import ApacheAirflowPage from "./pages/ApacheAirflowPage";
import WebSocketServicePage from "./pages/WebSocketServicePage";
import ReportSchedulerPage from "./pages/ReportSchedulerPage";
import EventDrivenArchPage from "./pages/EventDrivenArchPage";
import AdvancedNotificationsPage from "./pages/AdvancedNotificationsPage";
import SecurityDashboardPage from "./pages/SecurityDashboardPage";
// Sprint 32: Production Infrastructure & Operations
import FraudRealtimeVizPage from "./pages/FraudRealtimeVizPage";
import PipelineMonitoringPage from "./pages/PipelineMonitoringPage";
import ApiGatewayPage from "./pages/ApiGatewayPage";
import BackupDRPage from "./pages/BackupDRPage";
import PerformanceProfilerPage from "./pages/PerformanceProfilerPage";
import MultiTenancyPage from "./pages/MultiTenancyPage";
import WebhookManagementPage from "./pages/WebhookManagementPage";
import DataExportImportPage from "./pages/DataExportImportPage";
import SlaManagementPage from "./pages/SlaManagementPage";
import CapacityPlanningPage from "./pages/CapacityPlanningPage";
import IncidentManagementPage from "./pages/IncidentManagementPage";
import FeatureFlagsPage from "./pages/FeatureFlagsPage";
// Sprint 33: Final Production
import OpenTelemetryPage from "./pages/OpenTelemetryPage";
import AdvancedBiReportingPage from "./pages/AdvancedBiReportingPage";
import WorkflowAutomationPage from "./pages/WorkflowAutomationPage";
import NotificationCenterPage from "./pages/NotificationCenterPage";
import HelpDeskPage from "./pages/HelpDeskPage";
import DataQualityPage from "./pages/DataQualityPage";
import ConfigManagementPage from "./pages/ConfigManagementPage";
import ServiceMeshPage from "./pages/ServiceMeshPage";
import ComplianceAutomationPage from "./pages/ComplianceAutomationPage";
import Customer360Page from "./pages/Customer360Page";
// Sprint 34: Final Comprehensive Production
import RealtimeNotificationsPage from "./pages/RealtimeNotificationsPage";
import DragDropReportBuilderPage from "./pages/DragDropReportBuilderPage";
import GraphqlFederationPage from "./pages/GraphqlFederationPage";
import ApiVersioningPage from "./pages/ApiVersioningPage";
import AdvancedRateLimiterPage from "./pages/AdvancedRateLimiterPage";
import RealtimeDashboardWidgetsPage from "./pages/RealtimeDashboardWidgetsPage";
import AgentScorecardPage from "./pages/AgentScorecardPage";
import DisputeResolutionPage from "./pages/DisputeResolutionPage";
import RegulatorySandboxPage from "./pages/RegulatorySandboxPage";
import MultiCurrencyPage from "./pages/MultiCurrencyPage";
import DocumentManagementPage from "./pages/DocumentManagementPage";
import AgentTrainingPage from "./pages/AgentTrainingPage";
import RevenueAnalyticsPage from "./pages/RevenueAnalyticsPage";
import PlatformHealthPage from "./pages/PlatformHealthPage";
import BatchProcessingPage from "./pages/BatchProcessingPage";
import IntegrationMarketplacePage from "./pages/IntegrationMarketplacePage";
import MobileApiLayerPage from "./pages/MobileApiLayerPage";
import AutomatedTestingFrameworkPage from "./pages/AutomatedTestingFrameworkPage";
// Sprint 35: Advanced Operations
import TransactionMapVizPage from "./pages/TransactionMapVizPage";
import ReportBuilderTemplatesPage from "./pages/ReportBuilderTemplatesPage";
import NLAnalyticsQueryPage from "./pages/NLAnalyticsQueryPage";
import BankingWorkflowPatternsPage from "./pages/BankingWorkflowPatternsPage";
import AgentOnboardingWizardPage from "./pages/AgentOnboardingWizardPage";
import TransactionReconciliationPage from "./pages/TransactionReconciliationPage";
import ChargebackManagementPage from "./pages/ChargebackManagementPage";
import RegulatoryReportingPage from "./pages/RegulatoryReportingPage";
import TerritoryManagementPage from "./pages/TerritoryManagementPage";
import DynamicPricingPage from "./pages/DynamicPricingPage";
import LoyaltyProgramPage from "./pages/LoyaltyProgramPage";
import FraudCaseManagementPage from "./pages/FraudCaseManagementPage";
import TerminalFleetPage from "./pages/TerminalFleetPage";
import FinancialReconciliationPage from "./pages/FinancialReconciliationPage";
import ApiAnalyticsPage from "./pages/ApiAnalyticsPage";
import AgentCommunicationHubPage from "./pages/AgentCommunicationHubPage";
import DisputeArbitrationPage from "./pages/DisputeArbitrationPage";
import ComplianceTrainingPage from "./pages/ComplianceTrainingPage";
import MigrationToolsPage from "./pages/MigrationToolsPage";
import AuditLogViewerPage from "./pages/AuditLogViewerPage";
// Sprint 36: White-Label Partner Platform
import TransactionCsvExport from "./pages/TransactionCsvExport";
import TransactionMapLoading from "./pages/TransactionMapLoading";
import NlFinancialQuery from "./pages/NlFinancialQuery";
import WhiteLabelOnboarding from "./pages/WhiteLabelOnboarding";
import WhiteLabelBranding from "./pages/WhiteLabelBranding";
import WhiteLabelApproval from "./pages/WhiteLabelApproval";
import PartnerSelfService from "./pages/PartnerSelfService";
import TransactionExportEngine from "./pages/TransactionExportEngine";
import AdvancedLoadingStates from "./pages/AdvancedLoadingStates";
import FinancialNlEngine from "./pages/FinancialNlEngine";
import PartnerRevenueSharing from "./pages/PartnerRevenueSharing";
import AgentGamification from "./pages/AgentGamification";
import BulkTransactionProcessing from "./pages/BulkTransactionProcessing";
import Customer360View from "./pages/Customer360View";
import WebhookMgmtConsole from "./pages/WebhookMgmtConsole";
import PlatformFeatureFlags from "./pages/PlatformFeatureFlags";
import SlaMonitoringDash from "./pages/SlaMonitoringDash";
import DataRetentionPolicy from "./pages/DataRetentionPolicy";
import PlatformChangelogPage from "./pages/PlatformChangelogPage";
import AdvancedSearchFiltering from "./pages/AdvancedSearchFiltering";
// Sprint 37: Production Hardening & Advanced Platform
import E2ETestFramework from "./pages/E2ETestFramework";
import DbSchemaPush from "./pages/DbSchemaPush";
import AgentCommissionCalc from "./pages/AgentCommissionCalc";
import MccManager from "./pages/MccManager";
import SettlementBatchProcessor from "./pages/SettlementBatchProcessor";
import CardBinLookup from "./pages/CardBinLookup";
import TransactionVelocityMonitor from "./pages/TransactionVelocityMonitor";
import MerchantRiskScoring from "./pages/MerchantRiskScoring";
import PaymentGatewayRouter from "./pages/PaymentGatewayRouter";
import AgentFloatForecasting from "./pages/AgentFloatForecasting";
import MultiTenantIsolation from "./pages/MultiTenantIsolation";
import PlatformHealthDash from "./pages/PlatformHealthDash";
import AutomatedComplianceChecker from "./pages/AutomatedComplianceChecker";
import TransactionFeeCalc from "./pages/TransactionFeeCalc";
import AgentNetworkTopology from "./pages/AgentNetworkTopology";
import CustomerDisputePortal from "./pages/CustomerDisputePortal";
import RevenueLeakageDetector from "./pages/RevenueLeakageDetector";
import ApiRateLimiterDash from "./pages/ApiRateLimiterDash";
import OperationalRunbook from "./pages/OperationalRunbook";
import PlatformMetricsExporter from "./pages/PlatformMetricsExporter";
// Sprint 38: Advanced Platform Capabilities & Enhancements
import RealtimeWebSocketFeeds from "./pages/RealtimeWebSocketFeeds";
import MerchantOnboardingPortal from "./pages/MerchantOnboardingPortal";
import PaymentLinkGenerator from "./pages/PaymentLinkGenerator";
import DisputeMediationAI from "./pages/DisputeMediationAI";
import AgentPerformanceLeaderboard from "./pages/AgentPerformanceLeaderboard";
import AutomatedSettlementScheduler from "./pages/AutomatedSettlementScheduler";
import CustomerWalletSystem from "./pages/CustomerWalletSystem";
import MerchantAnalyticsDash from "./pages/MerchantAnalyticsDash";
import POSFirmwareOTA from "./pages/POSFirmwareOTA";
import TransactionReceiptGenerator from "./pages/TransactionReceiptGenerator";
import AgentLoanAdvance from "./pages/AgentLoanAdvance";
import MultiChannelPaymentOrch from "./pages/MultiChannelPaymentOrch";
import RegulatoryFilingAutomation from "./pages/RegulatoryFilingAutomation";
import CustomerSegmentationEngine from "./pages/CustomerSegmentationEngine";
import IncidentCommandCenter from "./pages/IncidentCommandCenter";
import PlatformABTesting from "./pages/PlatformABTesting";
import TransactionEnrichmentService from "./pages/TransactionEnrichmentService";
import AgentInventoryMgmt from "./pages/AgentInventoryMgmt";
import RevenueForecastingEngine from "./pages/RevenueForecastingEngine";
import PlatformRecommendations from "./pages/PlatformRecommendations";

// Sprint 39: Platform Maturity & Infrastructure Hardening
import PublishReadinessChecker from "./pages/PublishReadinessChecker";
import DbSchemaMigrationManager from "./pages/DbSchemaMigrationManager";
import GraphqlSubscriptionGateway from "./pages/GraphqlSubscriptionGateway";
import OfflinePosMode from "./pages/OfflinePosMode";
import AiCashFlowPredictor from "./pages/AiCashFlowPredictor";
import BlockchainAuditTrail from "./pages/BlockchainAuditTrail";
import VoiceCommandPos from "./pages/VoiceCommandPos";
import SocialCommerceGateway from "./pages/SocialCommerceGateway";
import EsgCarbonTracker from "./pages/EsgCarbonTracker";
import DistributedTracingDash from "./pages/DistributedTracingDash";
import CanaryReleaseManager from "./pages/CanaryReleaseManager";
import ChaosEngineeringConsole from "./pages/ChaosEngineeringConsole";
import ConnectionPoolMonitor from "./pages/ConnectionPoolMonitor";
import CdnCacheManager from "./pages/CdnCacheManager";
import CqrsEventStore from "./pages/CqrsEventStore";
import DigitalTwinSimulator from "./pages/DigitalTwinSimulator";
import CbdcIntegrationGateway from "./pages/CbdcIntegrationGateway";
import DecentralizedIdentityManager from "./pages/DecentralizedIdentityManager";
import PlatformMaturityScorecard from "./pages/PlatformMaturityScorecard";
// Sprint 40: Enterprise Scaling & Operational Excellence
import SmartContractPayment from "./pages/SmartContractPayment";
import PredictiveAgentChurn from "./pages/PredictiveAgentChurn";
import CurrencyHedging from "./pages/CurrencyHedging";
import AgentClusterAnalytics from "./pages/AgentClusterAnalytics";
import AutoComplianceWorkflow from "./pages/AutoComplianceWorkflow";
import PaymentTokenVault from "./pages/PaymentTokenVault";
import DynamicQrPayment from "./pages/DynamicQrPayment";
import AgentRevenueAttribution from "./pages/AgentRevenueAttribution";
import PlatformCostAllocator from "./pages/PlatformCostAllocator";
import IntelligentRoutingEngine from "./pages/IntelligentRoutingEngine";
import RegulatorySandboxTester from "./pages/RegulatorySandboxTester";
import AgentDeviceFingerprint from "./pages/AgentDeviceFingerprint";
import SettlementNettingEngine from "./pages/SettlementNettingEngine";
import PlatformCapacityPlanner from "./pages/PlatformCapacityPlanner";
import MerchantAcquirerGateway from "./pages/MerchantAcquirerGateway";
import AgentMicroInsurance from "./pages/AgentMicroInsurance";
import TransactionGraphAnalyzer from "./pages/TransactionGraphAnalyzer";
import PlatformRevenueOptimizer from "./pages/PlatformRevenueOptimizer";
import CrossBorderRemittanceHub from "./pages/CrossBorderRemittanceHub";
import OperationalCommandBridge from "./pages/OperationalCommandBridge";
// Sprint 41: Production Finalization & Domain Completeness
import AgentKycDocVault from "./pages/AgentKycDocVault";
import RealtimePnlDashboard from "./pages/RealtimePnlDashboard";
import AutoReconciliationEngine from "./pages/AutoReconciliationEngine";
import AgentTerritoryOptimizer from "./pages/AgentTerritoryOptimizer";
import RegulatoryReportGenerator from "./pages/RegulatoryReportGenerator";
import AgentTrainingAcademy from "./pages/AgentTrainingAcademy";
import DynamicFeeCalculator from "./pages/DynamicFeeCalculator";
import CustomerOnboardingPipeline from "./pages/CustomerOnboardingPipeline";
import MerchantSettlementDashboard from "./pages/MerchantSettlementDashboard";
import AgentFloatInsuranceClaims from "./pages/AgentFloatInsuranceClaims";
import PlatformSlaMonitor from "./pages/PlatformSlaMonitor";
import BulkDisbursementEngine from "./pages/BulkDisbursementEngine";
import TransactionReversalManager from "./pages/TransactionReversalManager";
import AgentLoanOrigination from "./pages/AgentLoanOrigination";
import MultiChannelNotificationHub from "./pages/MultiChannelNotificationHub";
import PlatformMigrationToolkit from "./pages/PlatformMigrationToolkit";
import AgentPerformanceIncentives from "./pages/AgentPerformanceIncentives";
import ExecutiveCommandCenter from "./pages/ExecutiveCommandCenter";
// Sprint 42: Final Production Features
import DisputeNotifications from "./pages/DisputeNotifications";
import DisputeAnalyticsDashboard from "./pages/DisputeAnalyticsDashboard";
import AgentBenchmarking from "./pages/AgentBenchmarking";
import TxVelocityMonitor from "./pages/TxVelocityMonitor";
import CustomerSurveys from "./pages/CustomerSurveys";
import AgentTerritoryHeatmap from "./pages/AgentTerritoryHeatmap";
import ReportScheduler from "./pages/ReportScheduler";
import GatewayHealthMonitor from "./pages/GatewayHealthMonitor";
import AgentLoanOriginationV2 from "./pages/AgentLoanOriginationV2";
import MfaManager from "./pages/MfaManager";
// DataRetentionPolicy already imported above
import IncidentPlaybook from "./pages/IncidentPlaybook";
import DeviceFleetManager from "./pages/DeviceFleetManager";
// RevenueLeakageDetector already imported above
import CustomerJourneyMapper from "./pages/CustomerJourneyMapper";
import ComplianceCertManager from "./pages/ComplianceCertManager";
import PlatformHealthScorecard from "./pages/PlatformHealthScorecard";
import TrainingCertification from "./pages/TrainingCertification";
import BulkTransactionProcessor from "./pages/BulkTransactionProcessor";
// SystemConfigManager already imported above
// Sprint 51: Production-grade feature pages
import RealtimeTxMonitorPage from "./pages/RealtimeTxMonitorPage";
import FraudMlScoringPage from "./pages/FraudMlScoringPage";
import NotificationOrchestratorPage from "./pages/NotificationOrchestratorPage";
import AgentLoanFacilityPage from "./pages/AgentLoanFacilityPage";
import DynamicFeeEnginePage from "./pages/DynamicFeeEnginePage";
import MerchantKycOnboardingPage from "./pages/MerchantKycOnboardingPage";
import MerchantPayoutSettlementPage from "./pages/MerchantPayoutSettlementPage";
import ComplianceFilingPage from "./pages/ComplianceFilingPage";
import TenantFeatureTogglePage from "./pages/TenantFeatureTogglePage";
import ReconciliationEnginePage from "./pages/ReconciliationEnginePage";
import CustomerJourneyAnalyticsPage from "./pages/CustomerJourneyAnalyticsPage";
import BackupDisasterRecoveryPage from "./pages/BackupDisasterRecoveryPage";
import WorkflowEnginePage from "./pages/WorkflowEnginePage";
import GeneralLedgerPage from "./pages/GeneralLedgerPage";
import DataExportHubPage from "./pages/DataExportHubPage";
import SlaMonitoringPage from "./pages/SlaMonitoringPage";
import RateLimitEnginePage from "./pages/RateLimitEnginePage";
import AgentGamificationPage from "./pages/AgentGamificationPage";
import ExecutiveCommandCenterPage from "./pages/ExecutiveCommandCenterPage";
import ActivityAuditLogPage from "./pages/ActivityAuditLogPage";
import SystemSettingsPage from "./pages/SystemSettingsPage";
import AgentPerformanceLeaderboardPage from "./pages/AgentPerformanceLeaderboardPage";
import FloatManagementPage from "./pages/FloatManagementPage";
// Sprint 58: Real-Time Progress, Archival Admin, Load Test Dashboard
import ArchivalAdmin from "./pages/ArchivalAdmin";
import LoadTestDashboard from "./pages/LoadTestDashboard";
import LoadTestComparison from "./pages/LoadTestComparison";
import AdminSupportInbox from "./pages/AdminSupportInbox";
import NetworkStatusDashboard from "./pages/NetworkStatusDashboard";
import SecurityAuditDashboard from "./pages/SecurityAuditDashboard";
import CarrierCostDashboard from "./pages/CarrierCostDashboard";
import CarrierSlaDashboard from "./pages/CarrierSlaDashboard";
import UssdAnalyticsDashboard from "./pages/UssdAnalyticsDashboard";
import UssdLocalizationPage from "./pages/UssdLocalizationPage";
import NetworkDiagnosticPage from "./pages/NetworkDiagnosticPage";
import ConnectionQualityPage from "./pages/ConnectionQualityPage";
// Sprint 78 imports
import UssdSessionReplayPage from "./pages/UssdSessionReplayPage";
import AgentKycPage from "./pages/AgentKycPage";
import TxMonitorPage from "./pages/TxMonitorPage";
import CommissionCalculatorPage from "./pages/CommissionCalculatorPage";
import CarrierLivePricingPage from "./pages/CarrierLivePricingPage";
import AgentGeoFencingPage from "./pages/AgentGeoFencingPage";
import AgentOnboardingWorkflowPage from "./pages/AgentOnboardingWorkflowPage";
import AuditExportPage from "./pages/AuditExportPage";
import AuditTrailExportPage from "./pages/AuditTrailExportPage";
import DailyPnlReportPage from "./pages/DailyPnlReportPage";
import TransactionDisputeResolutionPage from "./pages/TransactionDisputeResolutionPage";
import TransactionReversalWorkflowPage from "./pages/TransactionReversalWorkflowPage";
import BillingDashboardPage from "./pages/BillingDashboardPage";
import RealTimeDashboard from "./pages/RealTimeDashboard";
import InvoiceManagementPage from "./pages/InvoiceManagementPage";
import TenantBillingOnboardingPage from "./pages/TenantBillingOnboardingPage";
import TenantBillingPortalPage from "./pages/TenantBillingPortalPage";
import BillingAnalyticsDashboardPage from "./pages/BillingAnalyticsDashboardPage";

// ─── Auth guard wrapper ───────────────────────────────────────────────────────
// Admin dashboard paths bypass POS agent login — they use DashboardLayout's own
// Keycloak/OAuth auth instead. Any route that wraps its page in <DashboardLayout>
// should be listed here so agents don't need a PIN to reach the admin panel.
const ADMIN_DASHBOARD_PREFIXES = [
  "/agent-float", "/settlement-batch", "/transaction-map", "/report-builder",
  "/nl-analytics", "/banking-workflow", "/agent-onboarding-wizard", "/transaction-reconciliation",
  "/chargeback-management", "/regulatory-reporting", "/agent-territory", "/dynamic-pricing",
  "/customer-loyalty", "/fraud-case", "/pos-terminal-fleet", "/financial-reconciliation",
  "/api-analytics", "/agent-communication", "/tx-dispute", "/compliance-training",
  "/system-migration", "/advanced-audit", "/agent-scorecard", "/dispute-resolution",
  "/graphql-federation", "/api-versioning", "/rate-limiting", "/realtime-dashboard",
  "/regulatory-sandbox", "/multi-currency", "/document-management", "/agent-training",
  "/revenue-analytics", "/platform-health", "/batch-processing", "/integration-marketplace",
  "/mobile-api", "/automated-testing", "/notification-center", "/report-builder-drag",
  "/partner-onboarding", "/partner-data", "/partner-approval", "/partner-branding",
  "/partner-self-service", "/transaction-export", "/financial-nl", "/partner-revenue",
  "/agent-gamification", "/bulk-transaction", "/customer-360", "/webhook-mgmt",
  "/feature-flags", "/sla-monitoring", "/data-retention", "/platform-changelog",
  "/advanced-search", "/e2e-test", "/db-schema", "/graphql-subscription",
  "/offline-pos", "/biometric-auth", "/ai-cash-flow", "/blockchain-audit",
  "/voice-command", "/social-commerce", "/esg-carbon", "/distributed-tracing",
  "/canary-release", "/chaos-engineering", "/connection-pool", "/cdn-cache",
  "/cqrs-event", "/digital-twin", "/cbdc-integration", "/decentralized-identity",
  "/platform-maturity", "/smart-contract-payment", "/predictive-agent-churn",
  "/currency-hedging", "/agent-cluster-analytics", "/auto-compliance-workflow",
  "/payment-token-vault", "/dynamic-qr-payment", "/agent-revenue-attribution",
  "/platform-cost-allocator", "/intelligent-routing", "/regulatory-sandbox-tester",
  "/agent-device-fingerprint", "/settlement-netting", "/capacity-planner",
  "/merchant-acquirer", "/agent-micro-insurance", "/transaction-graph",
  "/revenue-optimizer", "/cross-border-remittance", "/operational-command-bridge",
  "/agent-kyc-vault", "/realtime-pnl", "/auto-reconciliation", "/territory-optimizer",
  "/dispute-arbitration", "/regulatory-reports", "/training-academy", "/fee-calculator",
  "/customer-onboarding", "/merchant-settlement", "/insurance-claims", "/sla-monitor",
  "/bulk-disbursement", "/reversal-manager", "/loan-origination", "/notification-hub",
  "/compliance-training", "/migration-toolkit", "/performance-incentives", "/executive-command",
  "/realtime-websocket", "/merchant-onboarding", "/payment-link",
  "/dispute-mediation", "/agent-leaderboard", "/settlement-scheduler", "/customer-wallet",
  "/merchant-analytics", "/pos-firmware", "/transaction-receipt", "/agent-loan",
  "/payment-orchestrator", "/regulatory-filing", "/customer-segmentation", "/incident-command",
  "/ab-testing", "/transaction-enrichment", "/agent-inventory", "/revenue-forecasting",
  "/platform-recommendations", "/agent-commission", "/mcc-manager", "/card-bin",
  "/transaction-velocity", "/merchant-risk", "/payment-gateway-router", "/multi-tenant",
  "/compliance-checker", "/fee-calculator", "/agent-network", "/customer-dispute-portal",
  "/revenue-leakage", "/api-rate-limiter", "/operational-runbook", "/metrics-exporter",
  "/management", "/super-admin", "/merchant", "/developer", "/infrastructure",
  "/system-health", "/lakehouse", "/webhooks", "/commission-payouts",
  "/settlement-reconciliation", "/referral-program", "/admin",
  "/loyalty", "/live-chat", "/privacy",  "/dispute-auto-rules",
  // Sprint 42
  "/dispute-notifications", "/dispute-analytics-dashboard", "/agent-benchmarking",
  "/tx-velocity-monitor", "/customer-surveys", "/agent-territory-heatmap",
  "/report-scheduler", "/gateway-health-monitor", "/agent-loan-origination-v2",
  "/mfa-manager", "/data-retention-policy", "/incident-playbook",
  "/device-fleet-manager", "/revenue-leakage-detector", "/customer-journey-mapper",
  "/compliance-cert-manager", "/platform-health-scorecard", "/training-certification",
  "/bulk-transaction-processor", "/system-config-manager",
  // Sprint 51: Production-grade feature routes
  "/realtime-tx-monitor", "/fraud-ml-scoring", "/notification-orchestrator",
  "/agent-loan-facility", "/dynamic-fee-engine", "/merchant-kyc-onboarding",
  "/merchant-payout-settlement", "/compliance-filing", "/tenant-feature-toggle",
  "/reconciliation-engine", "/customer-journey-analytics", "/backup-disaster-recovery",
  "/workflow-engine", "/general-ledger", "/data-export-hub", "/sla-monitoring-v2",
  "/rate-limit-engine", "/agent-gamification-v2",
  // Sprint 48-49: Commission, hierarchy, and remaining dashboard routes
  "/commission-engine", "/agent-hierarchy", "/commission-clawback", "/commission-config",
  "/pnl-reports", "/reversal-approval", "/audit-export", "/geo-fencing",
  "/bank-accounts", "/float-reconciliation", "/agent-performance-scoring",
  "/customer-database", "/transaction-limits", "/regulatory-compliance",
  "/agent-suspension", "/kyc-documents", "/agent-onboarding",
  // Additional dashboard routes
  "/account-opening", "/advanced-bi-reporting", "/advanced-loading-states",
  "/advanced-notifications", "/advanced-rate-limiter", "/agent-management",
  "/agent-performance", "/agent-performance-analytics", "/agent-performance-leaderboard",
  "/agent-hierarchy-territory", "/ai-monitoring", "/airtime-vending",
  "/announcement-reactions", "/apache-airflow", "/apache-nifi",
  "/api-docs", "/api-gateway", "/api-key-management", "/api-keys",
  "/art-robustness", "/audit-log-viewer", "/audit-trail",
  "/automated-compliance-checker", "/automated-settlement-scheduler",
  "/backup-dr", "/batch-operations", "/bill-payments",
  "/broadcast-manager", "/bulk-notifications", "/bulk-operations",
  "/bulk-payments", "/business-rules", "/cache-management",
  "/capacity-planning", "/card-requests", "/cbdc-gateway", "/cbn-reporting",
  "/changelog", "/cocoindex-pipeline", "/compliance-automation",
  "/compliance-chatbot", "/compliance-reporting", "/compliance-scheduling",
  "/config-management", "/customer-feedback", "/dashboard-widgets",
  "/data-export", "/data-export-import", "/data-quality",
  "/database-visualization", "/dbt-integration", "/did-manager",
  "/dispute-workflow", "/endpoint-rate-limits", "/escalation-chains",
  "/event-driven-arch", "/falkordb-graph", "/feedback-analytics",
  "/financial-reporting", "/fraud-realtime-viz", "/fraud-reports",
  "/gdpr", "/geofence-editor", "/global-search", "/help-desk",
  "/incident-management", "/insurance-products", "/kyc-verification",
  "/kyc-workflow", "/loan-disbursement", "/maturity-scorecard",
  "/middleware-manager", "/migration-tools", "/ml-scoring",
  "/mobile-money", "/mqtt-bridge", "/multi-channel-payment-orch",
  "/multi-tenancy", "/nl-financial-query", "/notification-analytics",
  "/notification-inbox", "/notification-preference-matrix",
  "/notification-preferences", "/notification-settings",
  "/notification-templates", "/offline-sync", "/ollama-llm",
  "/onboarding-wizard", "/open-telemetry", "/partner/onboard",
  "/payment-notifications", "/payment-reconciliation", "/payments",
  "/pension-collection", "/performance-profiler", "/pipeline-monitoring",
  "/platform-ab-testing", "/platform-analytics", "/platform-config",
  "/platform-feature-flags", "/platform-metrics-exporter",
  "/production-readiness", "/publish-readiness", "/push-notifications",
  "/qdrant-vector-search", "/quiet-hours", "/rate-alerts",
  "/rate-limit-dashboard", "/realtime-notifications", "/remittance",
  "/report-comparison", "/report-designer", "/resilience",
  "/retry-queue", "/savings-products", "/scheduled-email-delivery",
  "/scheduled-reports", "/security-dashboard", "/service-health",
  "/service-mesh", "/session-manager", "/shared-layouts",
  "/sim-orchestrator", "/skill-creator", "/sla-management",
  "/system-config", "/system-status", "/tax-collection",
  "/temporal", "/terminal-fleet", "/territory-management",
  "/threshold-alerts", "/threshold-manager", "/tigerbeetle",
  "/transaction-csv-export", "/transaction-fee-calc",
  "/user-guide", "/ussd-gateway", "/vault", "/video-tutorials",
  "/webhook-config", "/webhook-deliveries", "/webhook-delivery",
  "/webhook-delivery-monitor", "/webhook-management", "/websocket-service",
  "/weekly-reports", "/whatsapp-channel", "/white-label-approval",
  "/white-label-branding", "/white-label-onboarding", "/workflow-automation",
  "/hub", "/supervisor", "/agent", "/customer",
  "/admin-support-inbox",
  "/network-status",
  // Sprint 77
  "/carrier-costs", "/carrier-sla", "/ussd-analytics", "/ussd-localization",
  "/network-diagnostic", "/connection-quality", "/agent-geo-fencing",
  "/agent-onboarding-workflow", "/audit-export-page", "/audit-trail-export",
  "/daily-pnl-report", "/tx-dispute-resolution", "/tx-reversal-workflow",
  "/security-audit",
];
function isAdminDashboardPath(path: string): boolean {
  return ADMIN_DASHBOARD_PREFIXES.some(prefix => path.startsWith(prefix));
}

function AuthenticatedApp() {
  const isLoggedIn = usePosStore((s) => s.isLoggedIn);
  const agentCode = usePosStore((s) => s.agent?.agentCode);
  const [location] = useLocation();
  // Always mount terminal socket (tracks online status + receives fraud alerts)
  useTerminalSocket(agentCode);
  // Sync offline queue when back online
  useOfflineSync();

  // Admin dashboard routes bypass POS agent login — DashboardLayout handles its own auth
  if (!isLoggedIn && !isAdminDashboardPath(location)) {
    return <AgentLogin />;
  }

  return (
    <Switch>
      {/* Core POS routes */}
      <Route path="/hub" component={PlatformHub} />
      <Route path="/" component={POSShell} />
      <Route path="/admin/fraud" component={FraudDashboard} />
      <Route path="/admin/analytics" component={AnalyticsDashboard} />
      <Route path="/admin" component={AdminPanel} />
      <Route path="/supervisor" component={SupervisorDashboard} />
      {/* Platform portal routes */}
      <Route path="/management" component={ManagementPortal} />
      <Route path="/management/:section" component={ManagementPortal} />
      <Route path="/agent" component={AgentPortal} />
      <Route path="/customer" component={CustomerPortal} />
      <Route path="/super-admin" component={SuperAdminPortal} />
      <Route path="/super-admin/:section" component={SuperAdminPortal} />
      {/* Merchant & Developer portals */}
      <Route path="/merchant" component={MerchantPortal} />
      <Route path="/merchant/:section" component={MerchantPortal} />
      <Route path="/developer" component={DeveloperPortal} />
      <Route path="/developer/:section" component={DeveloperPortal} />
      {/* Legal */}
      <Route path="/privacy" component={PrivacyPolicy} />
      {/* Infrastructure monitoring */}
      <Route path="/system-health" component={SystemHealth} />
      <Route path="/system-health-monitor" component={SystemHealthDashboard} />
      {/* Data Lakehouse Analytics */}
      <Route path="/lakehouse" component={LakehouseAnalytics} />
      {/* Operations & Finance */}
      <Route path="/webhooks" component={WebhookManager} />
      <Route path="/commission-payouts" component={CommissionPayouts} />
      <Route path="/agent-onboarding" component={AgentOnboarding} />
      <Route path="/settlement-reconciliation" component={SettlementReconciliation} />
      <Route path="/referral-program" component={ReferralProgram} />
      {/* Audit & Compliance */}
      <Route path="/admin/audit" component={AuditLogViewer} />
      {/* Infrastructure: TigerBeetle, Kafka, Temporal, Vault */}
      <Route path="/infrastructure" component={InfrastructureDashboard} />
      {/* Loyalty & Live Chat */}
      <Route path="/loyalty">{() => <LoyaltySystem />}</Route>
      <Route path="/live-chat">{() => <LiveChatSupport />}</Route>
      {/* Agent Performance, Wallet, Notifications, Multi-Currency */}
      <Route path="/agent-performance" component={AgentPerformance} />
      <Route path="/customer-wallet" component={CustomerWallet} />
      <Route path="/notification-preferences" component={NotificationPreferences} />
      <Route path="/multi-currency" component={MultiCurrency} />
      {/* Compliance, Audit Export, Webhook Delivery, Geofence Editor */}
      <Route path="/compliance-scheduling" component={ComplianceScheduling} />
      <Route path="/audit-export" component={AuditExport} />
      <Route path="/webhook-deliveries" component={WebhookDeliveryViewer} />
      <Route path="/geofence-editor" component={GeofenceZoneEditor} />
      {/* API Keys, KYC, Onboarding, Commission */}
      <Route path="/api-keys" component={ApiKeyManagement} />
      <Route path="/kyc-workflow" component={KycWorkflow} />
      <Route path="/onboarding-wizard" component={OnboardingWizard} />
      <Route path="/commission-config" component={CommissionConfig} />
      {/* Rate Alert Subscriptions */}
      <Route path="/rate-alerts" component={RateAlerts} />
          <Route path="/notification-inbox" component={NotificationInbox} />
      <Route path="/notification-preference-matrix" component={NotificationPreferenceMatrix} />
      <Route path="/webhook-config" component={WebhookConfig} />
      <Route path="/batch-operations" component={BatchOperations} />
      {/* Platform Analytics Dashboard */}
      <Route path="/platform-analytics" component={AdminAnalyticsDashboard} />
      {/* Broadcast, Scheduled Reports, User Notification Settings */}
      <Route path="/broadcast-manager" component={BroadcastManager} />
      <Route path="/scheduled-reports" component={ScheduledReports} />
      <Route path="/notification-settings" component={UserNotifSettings} />
      {/* Data Threshold Alerts, Shared Layouts, Report Template Designer */}
      <Route path="/threshold-alerts" component={DataThresholdAlerts} />
      <Route path="/shared-layouts" component={SharedLayoutGallery} />
      <Route path="/report-designer" component={ReportTemplateDesigner} />
      {/* Sprint 16: Multi-Tenant White-Label */}
      <Route path="/partner/onboard" component={PartnerOnboarding} />
      <Route path="/admin/tenant" component={TenantAdminDashboard} />
      <Route path="/admin/invite-codes" component={InviteCodeManager} />
      {/* Sprint 15 routes */}
      <Route path="/escalation-chains" component={EscalationChains} />
      <Route path="/notification-analytics" component={NotificationAnalytics} />
      <Route path="/quiet-hours" component={UserQuietHours} />
      <Route path="/notification-templates" component={NotificationTemplateManager} />
      <Route path="/system-config" component={SystemConfigManager} />
      <Route path="/session-manager" component={SessionManager} />
      <Route path="/data-export" component={DataExportCenter} />
      <Route path="/changelog" component={PlatformChangelog} />
      <Route path="/bulk-notifications" component={BulkNotifSender} />
      <Route path="/retry-queue" component={RetryQueueViewer} />
      <Route path="/rate-limit-dashboard" component={RateLimitDashboard} />
      <Route path="/service-health" component={ServiceHealthAggregator} />
      <Route path="/cache-management" component={CacheManagement} />
      {/* Sprint 19: Full CRUD pages for all routers */}
      <Route path="/gdpr" component={GdprDashboard} />
      <Route path="/cbn-reporting" component={CbnReportingDashboard} />
      <Route path="/tigerbeetle" component={TigerBeetleLedger} />
      <Route path="/temporal" component={TemporalWorkflowMonitor} />
      <Route path="/vault" component={VaultSecretsManager} />
      <Route path="/resilience" component={ResilienceMonitor} />
      <Route path="/sim-orchestrator" component={SimOrchestratorDashboard} />
      <Route path="/mqtt-bridge" component={MqttBridgeDashboard} />
      <Route path="/push-notifications" component={PushNotificationConfig} />
      <Route path="/agent-management" component={AgentManagementDashboard} />
      <Route path="/business-rules" component={BusinessRulesDashboard} />
      <Route path="/announcement-reactions" component={AnnouncementReactions} />
      <Route path="/weekly-reports" component={WeeklyReports} />
      {/* Sprint 23: Final Production Features */}
      <Route path="/report-comparison" component={ReportComparison} />
      <Route path="/threshold-manager" component={ThresholdManager} />
      <Route path="/endpoint-rate-limits" component={EndpointRateLimits} />
      <Route path="/webhook-delivery-monitor" component={WebhookDeliveryMonitor} />
      <Route path="/agent-performance-scoring" component={AgentPerformanceScoring} />
      <Route path="/dispute-auto-rules" component={DisputeAutoRules} />
      <Route path="/kyc-verification" component={KycVerificationWorkflow} />
      <Route path="/production-readiness" component={ProductionReadinessChecklist} />
      <Route path="/scheduled-email-delivery" component={ScheduledEmailDelivery} />
      <Route path="/global-search" component={GlobalSearchPage} />
      {/* Sprint 24: User Guide */}
      <Route path="/user-guide" component={UserGuide} />
      <Route path="/video-tutorials" component={VideoTutorials} />
      <Route path="/payments" component={Payments} />
      <Route path="/payment-success" component={PaymentSuccess} />
      <Route path="/payment-cancel" component={PaymentCancel} />
      <Route path="/feedback-analytics" component={FeedbackAnalytics} />
      {/* Sprint 27: API Docs & System Status */}
      <Route path="/api-docs" component={ApiDocs} />
      <Route path="/system-status" component={SystemStatus} />
      <Route path="/audit-trail" component={AuditTrailPage} />
      {/* Sprint 28: Nigerian Agency Banking Features */}
      <Route path="/ussd-gateway" component={UssdGateway} />
      <Route path="/mobile-money" component={MobileMoneyPage} />
      <Route path="/agent-hierarchy" component={AgentHierarchyPage} />
      <Route path="/commission-engine" component={CommissionEnginePage} />
      <Route path="/bulk-operations" component={BulkOperationsPage} />
      <Route path="/geo-fencing" component={GeoFencingPage} />
      <Route path="/biometric-auth" component={BiometricAuthPage} />
      <Route path="/offline-sync" component={OfflineSyncPage} />
      <Route path="/whatsapp-channel" component={WhatsAppChannelPage} />
      <Route path="/merchant-payments" component={MerchantPaymentsPage} />
      <Route path="/bill-payments" component={BillPaymentsPage} />
      <Route path="/airtime-vending" component={AirtimeVendingPage} />
      <Route path="/loan-disbursement" component={LoanDisbursementPage} />
      <Route path="/insurance-products" component={InsuranceProductsPage} />
      <Route path="/savings-products" component={SavingsProductsPage} />
      <Route path="/referral-program-v2" component={ReferralProgramPage} />
      <Route path="/card-requests" component={CardRequestPage} />
      <Route path="/account-opening" component={AccountOpeningPage} />
      <Route path="/tax-collection" component={TaxCollectionPage} />
      <Route path="/pension-collection" component={PensionCollectionPage} />
      <Route path="/remittance" component={RemittancePage} />
      {/* Sprint 29: AI/ML/DL/GNN Integrations */}
      <Route path="/qdrant-vector-search" component={QdrantVectorSearchPage} />
      <Route path="/falkordb-graph" component={FalkorDBGraphPage} />
      <Route path="/cocoindex-pipeline" component={CocoIndexPipelinePage} />
      <Route path="/ollama-llm" component={OllamaLLMPage} />
      <Route path="/art-robustness" component={ARTRobustnessPage} />
      <Route path="/lakehouse-ai" component={LakehouseAiDashboard} />
      <Route path="/ml-scoring" component={MLScoringDashboard} />
      {/* Sprint 30: AI/ML Follow-ups */}
      <Route path="/ai-monitoring" component={AIMonitoringDashboard} />
      <Route path="/fraud-reports" component={FraudReportPage} />
      <Route path="/compliance-chatbot" component={ComplianceChatbotPage} />
      {/* Sprint 31: Data Pipelines, Security, Production Features */}
      <Route path="/apache-nifi" component={ApacheNifiPage} />
      <Route path="/dbt-integration" component={DbtIntegrationPage} />
      <Route path="/apache-airflow" component={ApacheAirflowPage} />
      <Route path="/websocket-service" component={WebSocketServicePage} />
      <Route path="/report-scheduler" component={ReportSchedulerPage} />
      <Route path="/event-driven-arch" component={EventDrivenArchPage} />
      <Route path="/advanced-notifications" component={AdvancedNotificationsPage} />
      <Route path="/security-dashboard" component={SecurityDashboardPage} />
      {/* Sprint 32: Production Infrastructure */}
      <Route path="/fraud-realtime-viz" component={FraudRealtimeVizPage} />
      <Route path="/pipeline-monitoring" component={PipelineMonitoringPage} />
      <Route path="/api-gateway" component={ApiGatewayPage} />
      <Route path="/backup-dr" component={BackupDRPage} />
      <Route path="/performance-profiler" component={PerformanceProfilerPage} />
      <Route path="/multi-tenancy" component={MultiTenancyPage} />
      <Route path="/webhook-management" component={WebhookManagementPage} />
      <Route path="/data-export-import" component={DataExportImportPage} />
      <Route path="/sla-management" component={SlaManagementPage} />
      <Route path="/capacity-planning" component={CapacityPlanningPage} />
      <Route path="/incident-management" component={IncidentManagementPage} />
      <Route path="/feature-flags" component={FeatureFlagsPage} />
      {/* Sprint 33: Final Production */}
      <Route path="/open-telemetry" component={OpenTelemetryPage} />
      <Route path="/advanced-bi-reporting" component={AdvancedBiReportingPage} />
      <Route path="/workflow-automation" component={WorkflowAutomationPage} />
      <Route path="/notification-center" component={NotificationCenterPage} />
      <Route path="/help-desk" component={HelpDeskPage} />
      <Route path="/data-quality" component={DataQualityPage} />
      <Route path="/config-management" component={ConfigManagementPage} />
      <Route path="/service-mesh" component={ServiceMeshPage} />
      <Route path="/compliance-automation" component={ComplianceAutomationPage} />
      <Route path="/customer-360" component={Customer360Page} />
      {/* Sprint 34: Final Comprehensive Production */}
      <Route path="/realtime-notifications" component={RealtimeNotificationsPage} />
      <Route path="/report-builder" component={DragDropReportBuilderPage} />
      <Route path="/graphql-federation" component={GraphqlFederationPage} />
      <Route path="/api-versioning" component={ApiVersioningPage} />
      <Route path="/advanced-rate-limiter" component={AdvancedRateLimiterPage} />
      <Route path="/dashboard-widgets" component={RealtimeDashboardWidgetsPage} />
      <Route path="/agent-scorecard" component={AgentScorecardPage} />
      <Route path="/dispute-resolution" component={DisputeResolutionPage} />
      <Route path="/regulatory-sandbox" component={RegulatorySandboxPage} />
      <Route path="/multi-currency-engine" component={MultiCurrencyPage} />
      <Route path="/document-management" component={DocumentManagementPage} />
      <Route path="/agent-training" component={AgentTrainingPage} />
      <Route path="/revenue-analytics" component={RevenueAnalyticsPage} />
      <Route path="/platform-health" component={PlatformHealthPage} />
      <Route path="/batch-processing" component={BatchProcessingPage} />
      <Route path="/integration-marketplace" component={IntegrationMarketplacePage} />
      <Route path="/mobile-api" component={MobileApiLayerPage} />
      <Route path="/automated-testing" component={AutomatedTestingFrameworkPage} />
      {/* Sprint 35: Advanced Operations */}
      <Route path="/transaction-map-viz" component={TransactionMapVizPage} />
      <Route path="/report-builder-templates" component={ReportBuilderTemplatesPage} />
      <Route path="/nl-analytics-query" component={NLAnalyticsQueryPage} />
      <Route path="/banking-workflows" component={BankingWorkflowPatternsPage} />
      <Route path="/agent-onboarding-wizard" component={AgentOnboardingWizardPage} />
      <Route path="/transaction-reconciliation" component={TransactionReconciliationPage} />
      <Route path="/chargeback-management" component={ChargebackManagementPage} />
      <Route path="/regulatory-reporting" component={RegulatoryReportingPage} />
      <Route path="/territory-management" component={TerritoryManagementPage} />
      <Route path="/dynamic-pricing" component={DynamicPricingPage} />
      <Route path="/loyalty-program" component={LoyaltyProgramPage} />
      <Route path="/fraud-case-management" component={FraudCaseManagementPage} />
      <Route path="/terminal-fleet" component={TerminalFleetPage} />
      <Route path="/financial-reconciliation" component={FinancialReconciliationPage} />
      <Route path="/api-analytics" component={ApiAnalyticsPage} />
      <Route path="/agent-communication-hub" component={AgentCommunicationHubPage} />
      <Route path="/dispute-arbitration" component={DisputeArbitrationPage} />
      <Route path="/compliance-training" component={ComplianceTrainingPage} />
      <Route path="/migration-tools" component={MigrationToolsPage} />
      <Route path="/audit-log-viewer" component={AuditLogViewerPage} />
      {/* Sprint 36: White-Label Partner Platform */}
      <Route path="/transaction-csv-export" component={TransactionCsvExport} />
      <Route path="/transaction-map-loading" component={TransactionMapLoading} />
      <Route path="/nl-financial-query" component={NlFinancialQuery} />
      <Route path="/white-label-onboarding" component={WhiteLabelOnboarding} />
      <Route path="/white-label-branding" component={WhiteLabelBranding} />
      <Route path="/white-label-approval" component={WhiteLabelApproval} />
      <Route path="/partner-self-service" component={PartnerSelfService} />
      <Route path="/transaction-export-engine" component={TransactionExportEngine} />
      <Route path="/advanced-loading-states" component={AdvancedLoadingStates} />
      <Route path="/financial-nl-engine" component={FinancialNlEngine} />
      <Route path="/partner-revenue-sharing" component={PartnerRevenueSharing} />
      <Route path="/agent-gamification" component={AgentGamification} />
      <Route path="/bulk-transaction-processing" component={BulkTransactionProcessing} />
      <Route path="/customer-360-view" component={Customer360View} />
      <Route path="/webhook-mgmt-console" component={WebhookMgmtConsole} />
      <Route path="/platform-feature-flags" component={PlatformFeatureFlags} />
      <Route path="/sla-monitoring" component={SlaMonitoringDash} />
      <Route path="/data-retention-policy" component={DataRetentionPolicy} />
      <Route path="/platform-changelog" component={PlatformChangelogPage} />
      <Route path="/advanced-search" component={AdvancedSearchFiltering} />
      {/* Sprint 37: Production Hardening & Advanced Platform */}
      <Route path="/e2e-test-framework" component={E2ETestFramework} />
      <Route path="/db-schema-push" component={DbSchemaPush} />
      <Route path="/agent-commission-calc" component={AgentCommissionCalc} />
      <Route path="/mcc-manager" component={MccManager} />
      <Route path="/settlement-batch-processor" component={SettlementBatchProcessor} />
      <Route path="/card-bin-lookup" component={CardBinLookup} />
      <Route path="/transaction-velocity-monitor" component={TransactionVelocityMonitor} />
      <Route path="/merchant-risk-scoring" component={MerchantRiskScoring} />
      <Route path="/payment-gateway-router" component={PaymentGatewayRouter} />
      <Route path="/agent-float-forecasting" component={AgentFloatForecasting} />
      <Route path="/multi-tenant-isolation" component={MultiTenantIsolation} />
      <Route path="/platform-health-dash" component={PlatformHealthDash} />
      <Route path="/automated-compliance-checker" component={AutomatedComplianceChecker} />
      <Route path="/transaction-fee-calc" component={TransactionFeeCalc} />
      <Route path="/agent-network-topology" component={AgentNetworkTopology} />
      <Route path="/customer-dispute-portal" component={CustomerDisputePortal} />
      <Route path="/revenue-leakage-detector" component={RevenueLeakageDetector} />
      <Route path="/api-rate-limiter-dash" component={ApiRateLimiterDash} />
      <Route path="/operational-runbook" component={OperationalRunbook} />
      <Route path="/platform-metrics-exporter" component={PlatformMetricsExporter} />
      {/* Sprint 38: Advanced Platform Capabilities */}
      <Route path="/realtime-websocket-feeds" component={RealtimeWebSocketFeeds} />
      <Route path="/merchant-onboarding-portal" component={MerchantOnboardingPortal} />
      <Route path="/payment-link-generator" component={PaymentLinkGenerator} />
      <Route path="/dispute-mediation-ai" component={DisputeMediationAI} />
      <Route path="/agent-performance-leaderboard" component={AgentPerformanceLeaderboard} />
      <Route path="/automated-settlement-scheduler" component={AutomatedSettlementScheduler} />
      <Route path="/customer-wallet-system" component={CustomerWalletSystem} />
      <Route path="/merchant-analytics-dash" component={MerchantAnalyticsDash} />
      <Route path="/pos-firmware-ota" component={POSFirmwareOTA} />
      <Route path="/transaction-receipt-generator" component={TransactionReceiptGenerator} />
      <Route path="/agent-loan-advance" component={AgentLoanAdvance} />
      <Route path="/multi-channel-payment-orch" component={MultiChannelPaymentOrch} />
      <Route path="/regulatory-filing-automation" component={RegulatoryFilingAutomation} />
      <Route path="/customer-segmentation-engine" component={CustomerSegmentationEngine} />
      <Route path="/incident-command-center" component={IncidentCommandCenter} />
      <Route path="/platform-ab-testing" component={PlatformABTesting} />
      <Route path="/transaction-enrichment-service" component={TransactionEnrichmentService} />
      <Route path="/agent-inventory-mgmt" component={AgentInventoryMgmt} />
      <Route path="/revenue-forecasting-engine" component={RevenueForecastingEngine} />
      <Route path="/platform-recommendations" component={PlatformRecommendations} />
      {/* Sprint 39: Platform Maturity & Infrastructure */}
      <Route path="/publish-readiness" component={PublishReadinessChecker} />
      <Route path="/db-schema-migration" component={DbSchemaMigrationManager} />
      <Route path="/graphql-subscriptions" component={GraphqlSubscriptionGateway} />
      <Route path="/offline-pos-mode" component={OfflinePosMode} />
      <Route path="/ai-cash-flow" component={AiCashFlowPredictor} />
      <Route path="/blockchain-audit" component={BlockchainAuditTrail} />
      <Route path="/voice-command-pos" component={VoiceCommandPos} />
      <Route path="/social-commerce" component={SocialCommerceGateway} />
      <Route path="/esg-carbon-tracker" component={EsgCarbonTracker} />
      <Route path="/distributed-tracing" component={DistributedTracingDash} />
      <Route path="/canary-releases" component={CanaryReleaseManager} />
      <Route path="/chaos-engineering" component={ChaosEngineeringConsole} />
      <Route path="/connection-pools" component={ConnectionPoolMonitor} />
      <Route path="/cdn-cache" component={CdnCacheManager} />
      <Route path="/cqrs-events" component={CqrsEventStore} />
      <Route path="/digital-twin" component={DigitalTwinSimulator} />
      <Route path="/cbdc-gateway" component={CbdcIntegrationGateway} />
      <Route path="/did-manager" component={DecentralizedIdentityManager} />
      <Route path="/maturity-scorecard" component={PlatformMaturityScorecard} />
      {/* Sprint 40 Routes */}
      <Route path="/smart-contract-payment" component={SmartContractPayment} />
      <Route path="/predictive-agent-churn" component={PredictiveAgentChurn} />
      <Route path="/currency-hedging" component={CurrencyHedging} />
      <Route path="/agent-cluster-analytics" component={AgentClusterAnalytics} />
      <Route path="/auto-compliance-workflow" component={AutoComplianceWorkflow} />
      <Route path="/payment-token-vault" component={PaymentTokenVault} />
      <Route path="/dynamic-qr-payment" component={DynamicQrPayment} />
      <Route path="/agent-revenue-attribution" component={AgentRevenueAttribution} />
      <Route path="/platform-cost-allocator" component={PlatformCostAllocator} />
      <Route path="/intelligent-routing" component={IntelligentRoutingEngine} />
      <Route path="/regulatory-sandbox-tester" component={RegulatorySandboxTester} />
      <Route path="/agent-device-fingerprint" component={AgentDeviceFingerprint} />
      <Route path="/settlement-netting" component={SettlementNettingEngine} />
      <Route path="/capacity-planner" component={PlatformCapacityPlanner} />
      <Route path="/merchant-acquirer" component={MerchantAcquirerGateway} />
      <Route path="/agent-micro-insurance" component={AgentMicroInsurance} />
      <Route path="/transaction-graph" component={TransactionGraphAnalyzer} />
      <Route path="/revenue-optimizer" component={PlatformRevenueOptimizer} />
      <Route path="/cross-border-remittance" component={CrossBorderRemittanceHub} />
      <Route path="/operational-command-bridge" component={OperationalCommandBridge} />
      {/* Sprint 41 Routes */}
      <Route path="/agent-kyc-vault" component={AgentKycDocVault} />
      <Route path="/realtime-pnl" component={RealtimePnlDashboard} />
      <Route path="/auto-reconciliation" component={AutoReconciliationEngine} />
      <Route path="/territory-optimizer" component={AgentTerritoryOptimizer} />
      <Route path="/regulatory-reports" component={RegulatoryReportGenerator} />
      <Route path="/training-academy" component={AgentTrainingAcademy} />
      <Route path="/fee-calculator" component={DynamicFeeCalculator} />
      <Route path="/customer-onboarding" component={CustomerOnboardingPipeline} />
      <Route path="/merchant-settlement" component={MerchantSettlementDashboard} />
      <Route path="/insurance-claims" component={AgentFloatInsuranceClaims} />
      <Route path="/sla-monitor" component={PlatformSlaMonitor} />
      <Route path="/bulk-disbursement" component={BulkDisbursementEngine} />
      <Route path="/reversal-manager" component={TransactionReversalManager} />
      <Route path="/loan-origination" component={AgentLoanOrigination} />
      <Route path="/notification-hub" component={MultiChannelNotificationHub} />
      <Route path="/migration-toolkit" component={PlatformMigrationToolkit} />
      <Route path="/performance-incentives" component={AgentPerformanceIncentives} />
      <Route path="/executive-command" component={ExecutiveCommandCenter} />
      {/* Sprint 42 Routes */}
      <Route path="/dispute-notifications" component={DisputeNotifications} />
      <Route path="/dispute-analytics-dashboard" component={DisputeAnalyticsDashboard} />
      <Route path="/agent-benchmarking" component={AgentBenchmarking} />
      <Route path="/tx-velocity-monitor" component={TxVelocityMonitor} />
      <Route path="/customer-surveys" component={CustomerSurveys} />
      <Route path="/agent-territory-heatmap" component={AgentTerritoryHeatmap} />
      <Route path="/gateway-health-monitor" component={GatewayHealthMonitor} />
      <Route path="/agent-loan-origination-v2" component={AgentLoanOriginationV2} />
      <Route path="/mfa-manager" component={MfaManager} />
      <Route path="/incident-playbook" component={IncidentPlaybook} />
      <Route path="/device-fleet-manager" component={DeviceFleetManager} />
      <Route path="/customer-journey-mapper" component={CustomerJourneyMapper} />
      <Route path="/compliance-cert-manager" component={ComplianceCertManager} />
      <Route path="/platform-health-scorecard" component={PlatformHealthScorecard} />
      <Route path="/training-certification" component={TrainingCertification} />
      <Route path="/bulk-transaction-processor" component={BulkTransactionProcessor} />
      <Route path="/system-config-manager" component={SystemConfigManager} />
      {/* Sprint 46: Production Features */}
      <Route path="/payment-notifications" component={PaymentNotificationSystem} />
      <Route path="/database-visualization" component={DatabaseVisualization} />
      <Route path="/middleware-manager" component={MiddlewareServiceManager} />
      <Route path="/skill-creator" component={SkillCreatorIntegration} />
      <Route path="/payment-reconciliation" component={PaymentReconciliation} />
      <Route path="/agent-performance-analytics" component={AgentPerformanceAnalytics} />
      <Route path="/compliance-reporting" component={ComplianceReporting} />
      <Route path="/customer-feedback" component={CustomerFeedbackNps} />
      <Route path="/multi-currency-exchange" component={MultiCurrencyExchange} />
      <Route path="/dispute-workflow" component={DisputeWorkflowEngine} />
      <Route path="/bulk-payments" component={BulkPaymentProcessor} />
      <Route path="/agent-hierarchy-territory" component={AgentHierarchyTerritory} />
      <Route path="/financial-reporting" component={FinancialReportingSuite} />
      <Route path="/api-key-management" component={ApiKeyManagement} />
      <Route path="/webhook-delivery" component={WebhookDeliverySystem} />
      <Route path="/platform-config" component={PlatformConfigCenter} />
      <Route path="/bank-accounts" component={BankAccountManagementPage} />
      <Route path="/kyc-documents" component={KycDocumentManagementPage} />
      <Route path="/float-reconciliation" component={FloatReconciliationPage} />
      <Route path="/customer-database" component={CustomerDatabasePage} />
      <Route path="/reversal-approval" component={ReversalApprovalPage} />
      <Route path="/commission-clawback" component={CommissionClawbackPage} />
      <Route path="/pnl-reports" component={PnlReportPage} />
      <Route path="/transaction-limits" component={TransactionLimitsEnginePage} />
      <Route path="/regulatory-compliance" component={RegulatoryCompliancePage} />
      <Route path="/system-health-dashboard" component={SystemHealthDashboardPage} />
      <Route path="/agent-suspension" component={AgentSuspensionWorkflowPage} />
      {/* Sprint 51: Production-grade feature routes */}
      <Route path="/realtime-tx-monitor" component={RealtimeTxMonitorPage} />
      <Route path="/fraud-ml-scoring" component={FraudMlScoringPage} />
      <Route path="/notification-orchestrator" component={NotificationOrchestratorPage} />
      <Route path="/agent-loan-facility" component={AgentLoanFacilityPage} />
      <Route path="/dynamic-fee-engine" component={DynamicFeeEnginePage} />
      <Route path="/merchant-kyc-onboarding" component={MerchantKycOnboardingPage} />
      <Route path="/merchant-payout-settlement" component={MerchantPayoutSettlementPage} />
      <Route path="/compliance-filing" component={ComplianceFilingPage} />
      <Route path="/tenant-feature-toggle" component={TenantFeatureTogglePage} />
      <Route path="/reconciliation-engine" component={ReconciliationEnginePage} />
      <Route path="/customer-journey-analytics" component={CustomerJourneyAnalyticsPage} />
      <Route path="/backup-disaster-recovery" component={BackupDisasterRecoveryPage} />
      <Route path="/workflow-engine" component={WorkflowEnginePage} />
      <Route path="/general-ledger" component={GeneralLedgerPage} />
      <Route path="/data-export-hub" component={DataExportHubPage} />
      <Route path="/sla-monitoring-v2" component={SlaMonitoringPage} />
      <Route path="/rate-limit-engine" component={RateLimitEnginePage} />
      <Route path="/agent-gamification-v2" component={AgentGamificationPage} />
      <Route path="/executive-command-center" component={ExecutiveCommandCenterPage} />
      <Route path="/activity-audit-log" component={ActivityAuditLogPage} />
      <Route path="/system-settings" component={SystemSettingsPage} />
      <Route path="/agent-leaderboard" component={AgentPerformanceLeaderboardPage} />
      <Route path="/float-management" component={FloatManagementPage} />
      {/* Sprint 58: Archival Admin + Load Test Dashboard */}
      <Route path="/archival-admin" component={ArchivalAdmin} />
      <Route path="/load-test-dashboard" component={LoadTestDashboard} />
      <Route path="/load-test-comparison" component={LoadTestComparison} />
      <Route path="/admin-support-inbox">{() => <AdminSupportInbox />}</Route>
      <Route path="/network-status" component={NetworkStatusDashboard} />
      <Route path="/security-audit" component={SecurityAuditDashboard} />
      <Route path="/carrier-costs" component={CarrierCostDashboard} />
      <Route path="/carrier-sla" component={CarrierSlaDashboard} />
      <Route path="/ussd-analytics" component={UssdAnalyticsDashboard} />
      <Route path="/ussd-localization" component={UssdLocalizationPage} />
      <Route path="/network-diagnostic" component={NetworkDiagnosticPage} />
      <Route path="/connection-quality" component={ConnectionQualityPage} />
      {/* Sprint 78 routes */}
      <Route path="/ussd-session-replay" component={UssdSessionReplayPage} />
      <Route path="/agent-kyc" component={AgentKycPage} />
      <Route path="/tx-monitor" component={TxMonitorPage} />
      <Route path="/commission-calculator" component={CommissionCalculatorPage} />
      <Route path="/carrier-live-pricing" component={CarrierLivePricingPage} />
      <Route path="/agent-geo-fencing" component={AgentGeoFencingPage} />
      <Route path="/agent-onboarding-workflow" component={AgentOnboardingWorkflowPage} />
      <Route path="/audit-export-page" component={AuditExportPage} />
      <Route path="/audit-trail-export" component={AuditTrailExportPage} />
      <Route path="/daily-pnl-report" component={DailyPnlReportPage} />
      <Route path="/tx-dispute-resolution" component={TransactionDisputeResolutionPage} />
      <Route path="/real-time-dashboard" component={RealTimeDashboard} />
      <Route path="/tx-reversal-workflow" component={TransactionReversalWorkflowPage} />
      <Route path="/billing-dashboard" component={BillingDashboardPage} />
      <Route path="/invoice-management" component={InvoiceManagementPage} />
      <Route path="/tenant-billing-onboarding" component={TenantBillingOnboardingPage} />
      <Route path="/billing/portal" component={TenantBillingPortalPage} />
      <Route path="/billing/analytics" component={BillingAnalyticsDashboardPage} />
      {/* Sprint 89: Admin Dashboard & Analytics */}
      <Route path="/admin-dashboard" component={AdminDashboardPage} />
      <Route path="/admin/users" component={AdminUserManagement} />
      <Route path="/admin/health" component={AdminSystemHealth} />
      <Route path="/admin/liveness-devices" component={AdminLivenessDeviceAnalytics} />
      <Route path="/transaction-analytics" component={TransactionAnalytics} />
      {/* Sprint 92: Offline Queue, Security Alerts, PBAC Management */}
      <Route path="/offline-queue" component={OfflineQueueDashboard} />
      <Route path="/security-alerts" component={RansomwareAlertDashboard} />
      <Route path="/pbac-management" component={PBACManagement} />
      {/* Sprint 93: Alert Preferences, Network Heatmap */}
      <Route path="/alert-preferences" component={AlertNotificationPreferences} />
      <Route path="/network-heatmap" component={NetworkQualityHeatmap} />
      {/* Fallback — POSShell handles named screens */}
      <Route path="/:screen" component={POSShell} />
    </Switch>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  const { shortcuts, helpOpen, setHelpOpen } = useKeyboardShortcuts();

  return (
    <ErrorBoundary>
      <AccessibilityProvider>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster richColors position="top-center" />
          <AnnouncementBanner />
          <ErrorBoundaryRoute>
            <AuthenticatedApp />
          </ErrorBoundaryRoute>
          <GlobalSearch />
          <KeyboardShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} shortcuts={shortcuts} />
          <PWAInstallBanner />
          <GdprConsentBanner />
          <LiveChatWidget />
          <ProactiveHelp />
        </TooltipProvider>
      </ThemeProvider>
      </AccessibilityProvider>
    </ErrorBoundary>
  );
}
