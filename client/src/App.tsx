// The recovered admin portal keeps its top-level route structure and sidebar-led shell,
// while the customer PWA remains a separate reference surface under /customer so both
// recovered archive applications can coexist in one active project.

import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { Route, Switch } from "wouter";

const ArchiveAdminSidebar = lazy(() => import("@/components/ArchiveAdminSidebar"));

const AdminAgentBankingPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminAgentBankingPage })));
const AdminAlertRulesPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminAlertRulesPage })));
const AdminAlertsPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminAlertsPage })));
const AdminAlertSettingsPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminAlertSettingsPage })));
const AdminBanksPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminBanksPage })));
const AdminBillingPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminBillingPage })));
const AdminCurriculumPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminCurriculumPage })));
const AdminInfrastructurePage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminInfrastructurePage })));
const AdminLabsPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminLabsPage })));
const AdminLoginPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminLoginPage })));
const AdminMonitoringPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminMonitoringPage })));
const AdminOnboardingPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminOnboardingPage })));
const AdminQuickReferencePage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminQuickReferencePage })));
const AdminRegulatoryReportingPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminRegulatoryReportingPage })));
const AdminResourcesPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminResourcesPage })));
const AdminUsageAnalyticsPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminUsageAnalyticsPage })));
const AdminGroupLendingPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminGroupLendingPage })));

const AgricultureAgtechPage = lazy(() => import("@/pages/ArchiveAgricultureRoutes").then((module) => ({ default: module.AgricultureAgtechPage })));
const AgricultureAnalyticsPage = lazy(() => import("@/pages/ArchiveAgricultureRoutes").then((module) => ({ default: module.AgricultureAnalyticsPage })));
const AgricultureCompliancePage = lazy(() => import("@/pages/ArchiveAgricultureRoutes").then((module) => ({ default: module.AgricultureCompliancePage })));
const AgricultureFarmersPage = lazy(() => import("@/pages/ArchiveAgricultureRoutes").then((module) => ({ default: module.AgricultureFarmersPage })));
const AgricultureLoansPage = lazy(() => import("@/pages/ArchiveAgricultureRoutes").then((module) => ({ default: module.AgricultureLoansPage })));
const AgricultureOverviewPage = lazy(() => import("@/pages/ArchiveAgricultureRoutes").then((module) => ({ default: module.AgricultureOverviewPage })));
const AgricultureRiskPage = lazy(() => import("@/pages/ArchiveAgricultureRoutes").then((module) => ({ default: module.AgricultureRiskPage })));
const AgricultureValueChainPage = lazy(() => import("@/pages/ArchiveAgricultureRoutes").then((module) => ({ default: module.AgricultureValueChainPage })));

const CustomerBills = lazy(() => import("@/pages/CustomerBills"));
const CustomerCards = lazy(() => import("@/pages/CustomerCards"));
const CustomerDashboard = lazy(() => import("@/pages/CustomerDashboard"));
const CustomerLoans = lazy(() => import("@/pages/CustomerLoans"));
const CustomerNotifications = lazy(() => import("@/pages/CustomerNotifications"));
const CustomerQr = lazy(() => import("@/pages/CustomerQr"));
const CustomerSavings = lazy(() => import("@/pages/CustomerSavings"));
const CustomerSettings = lazy(() => import("@/pages/CustomerSettings"));
const CustomerStatements = lazy(() => import("@/pages/CustomerStatements"));
const CustomerTransfers = lazy(() => import("@/pages/CustomerTransfers"));
const DisputeManagementWorkspace = lazy(() => import("@/pages/DisputeManagementWorkspace"));
const ERPNextWorkspace = lazy(() => import("@/pages/ERPNextWorkspace"));
const EducationLoansWorkspace = lazy(() => import("@/pages/EducationLoansWorkspace"));
const EsusuWorkspace = lazy(() => import("@/pages/EsusuWorkspace"));
const Home = lazy(() => import("@/pages/Home"));
const VirtualAccountsWorkspace = lazy(() => import("@/pages/VirtualAccountsWorkspace"));
const IdentityChannelsWorkspace = lazy(() => import("@/pages/IdentityChannelsWorkspace"));
const IslamicBankingWorkspace = lazy(() => import("@/pages/IslamicBankingWorkspace"));
const LedgerSyncWorkspace = lazy(() => import("@/pages/LedgerSyncWorkspace"));
const MortgageWorkspace = lazy(() => import("@/pages/MortgageWorkspace"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const OperationsCenter = lazy(() => import("@/pages/OperationsCenter"));
const PartnerOnboardingAdminPage = lazy(() => import("@/pages/PartnerOnboardingAdminPage"));
const PartnerOnboardingPortalPage = lazy(() => import("@/pages/PartnerOnboardingPortalPage"));
const PricingModelWorkspace = lazy(() => import("@/pages/PricingModelWorkspace"));
const TellerWorkspace = lazy(() => import("@/pages/TellerWorkspace"));
const TradeFinanceWorkspace = lazy(() => import("@/pages/TradeFinanceWorkspace"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const BillingEngineWorkspace = lazy(() => import("@/pages/BillingEngineWorkspace"));
const PaymentsHubWorkspace = lazy(() => import("@/pages/PaymentsHubWorkspace"));
const SavingsProductsWorkspace = lazy(() => import("@/pages/SavingsProductsWorkspace"));
const CardManagementWorkspace = lazy(() => import("@/pages/CardManagementWorkspace"));
const TreasuryWorkspace = lazy(() => import("@/pages/TreasuryWorkspace"));
const CustomerEngagementWorkspace = lazy(() => import("@/pages/CustomerEngagementWorkspace"));
const FraudDetectionWorkspace = lazy(() => import("@/pages/FraudDetectionWorkspace"));
const NotificationCenterWorkspace = lazy(() => import("@/pages/NotificationCenterWorkspace"));
const AccountOpeningWorkspace = lazy(() => import("@/pages/AccountOpeningWorkspace"));
const StandingOrdersWorkspace = lazy(() => import("@/pages/StandingOrdersWorkspace"));
const BeneficiaryManagementWorkspace = lazy(() => import("@/pages/BeneficiaryManagementWorkspace"));
const LoanCalculatorWorkspace = lazy(() => import("@/pages/LoanCalculatorWorkspace"));
const BatchProcessingWorkspace = lazy(() => import("@/pages/BatchProcessingWorkspace"));
const FXRatesWorkspace = lazy(() => import("@/pages/FXRatesWorkspace"));
const BranchOperationsWorkspace = lazy(() => import("@/pages/BranchOperationsWorkspace"));
const LedgerWorkspace = lazy(() => import("@/pages/LedgerWorkspace"));
const EventBusWorkspace = lazy(() => import("@/pages/EventBusWorkspace"));
const WorkflowEngineWorkspace = lazy(() => import("@/pages/WorkflowEngineWorkspace"));
const MojaloopWorkspace = lazy(() => import("@/pages/MojaloopWorkspace"));
const OpenSearchWorkspace = lazy(() => import("@/pages/OpenSearchWorkspace"));
const LakehouseWorkspace = lazy(() => import("@/pages/LakehouseWorkspace"));
const FluvioStreamsWorkspace = lazy(() => import("@/pages/FluvioStreamsWorkspace"));
const DaprSidecarWorkspace = lazy(() => import("@/pages/DaprSidecarWorkspace"));
const PermifyWorkspace = lazy(() => import("@/pages/PermifyWorkspace"));
const KeycloakWorkspace = lazy(() => import("@/pages/KeycloakWorkspace"));
const InterestRateWorkspace = lazy(() => import("@/pages/InterestRateWorkspace"));
const ChequeClearingWorkspace = lazy(() => import("@/pages/ChequeClearingWorkspace"));
const Customer360Workspace = lazy(() => import("@/pages/Customer360Workspace"));
const NIBSSDirectDebitWorkspace = lazy(() => import("@/pages/NIBSSDirectDebitWorkspace"));
const DiasporaBankingWorkspace = lazy(() => import("@/pages/DiasporaBankingWorkspace"));
const KYCAMLWorkspace = lazy(() => import("@/pages/KYCAMLWorkspace"));
const LoanOriginationWorkspace = lazy(() => import("@/pages/LoanOriginationWorkspace"));
const AccountStatementsWorkspace = lazy(() => import("@/pages/AccountStatementsWorkspace"));
const BulkPaymentsWorkspace = lazy(() => import("@/pages/BulkPaymentsWorkspace"));
const CardManagementWorkspace2 = lazy(() => import("@/pages/CardManagementWorkspace2"));
const TreasuryLiquidityWorkspace = lazy(() => import("@/pages/TreasuryLiquidityWorkspace"));
const AgentBankingWorkspace2 = lazy(() => import("@/pages/AgentBankingWorkspace2"));
const ChartOfAccountsWorkspace = lazy(() => import("@/pages/ChartOfAccountsWorkspace"));
const JournalEntriesWorkspace = lazy(() => import("@/pages/JournalEntriesWorkspace"));
const ReportingWorkspace = lazy(() => import("@/pages/ReportingWorkspace"));
const PaymentTransactionsWorkspace = lazy(() => import("@/pages/PaymentTransactionsWorkspace"));
const LoanProductsWorkspace = lazy(() => import("@/pages/LoanProductsWorkspace"));
const LoanAccountsWorkspace = lazy(() => import("@/pages/LoanAccountsWorkspace"));
const AnalyticsWidgetsWorkspace = lazy(() => import("@/pages/AnalyticsWidgetsWorkspace"));
const ETLPipelinesWorkspace = lazy(() => import("@/pages/ETLPipelinesWorkspace"));
const FraudRulesWorkspace = lazy(() => import("@/pages/FraudRulesWorkspace"));
const FraudAlertsWorkspace = lazy(() => import("@/pages/FraudAlertsWorkspace"));
const WebhookSubscriptionsWorkspace = lazy(() => import("@/pages/WebhookSubscriptionsWorkspace"));
const WebhookDeliveriesWorkspace = lazy(() => import("@/pages/WebhookDeliveriesWorkspace"));
const AuditTrailWorkspace = lazy(() => import("@/pages/AuditTrailWorkspace"));
const ComplianceChecksWorkspace = lazy(() => import("@/pages/ComplianceChecksWorkspace"));
const RegulatoryCalendarWorkspace = lazy(() => import("@/pages/RegulatoryCalendarWorkspace"));
const CustomerOnboardingWorkspace = lazy(() => import("@/pages/CustomerOnboardingWorkspace"));
const FXDealingRoomWorkspace = lazy(() => import("@/pages/FXDealingRoomWorkspace"));
const FXPositionsWorkspace = lazy(() => import("@/pages/FXPositionsWorkspace"));
const DocCollectionsWorkspace = lazy(() => import("@/pages/DocCollectionsWorkspace"));
const TreasuryInvestmentsWorkspace = lazy(() => import("@/pages/TreasuryInvestmentsWorkspace"));
const SWIFTMessagesWorkspace = lazy(() => import("@/pages/SWIFTMessagesWorkspace"));
const CreditRiskWorkspace = lazy(() => import("@/pages/CreditRiskWorkspace"));
const ReconciliationWorkspace = lazy(() => import("@/pages/ReconciliationWorkspace"));
const FeeSchedulesWorkspace = lazy(() => import("@/pages/FeeSchedulesWorkspace"));
const NotificationPreferencesWorkspace = lazy(() => import("@/pages/NotificationPreferencesWorkspace"));
const DormancyWorkspace = lazy(() => import("@/pages/DormancyWorkspace"));
const InterestAccrualWorkspace = lazy(() => import("@/pages/InterestAccrualWorkspace"));
const LimitManagementWorkspace = lazy(() => import("@/pages/LimitManagementWorkspace"));
const GLAccountsWorkspace = lazy(() => import("@/pages/GLAccountsWorkspace"));
const CollateralWorkspace = lazy(() => import("@/pages/CollateralWorkspace"));
const ComplaintsWorkspace = lazy(() => import("@/pages/ComplaintsWorkspace"));
const InterbankSettlementWorkspace = lazy(() => import("@/pages/InterbankSettlementWorkspace"));
const StaffManagementWorkspace = lazy(() => import("@/pages/StaffManagementWorkspace"));
const ChannelManagementWorkspace = lazy(() => import("@/pages/ChannelManagementWorkspace"));
const FixedDepositsWorkspace = lazy(() => import("@/pages/FixedDepositsWorkspace"));
const StandingInstructionsWorkspace = lazy(() => import("@/pages/StandingInstructionsWorkspace"));
const CashManagementWorkspace = lazy(() => import("@/pages/CashManagementWorkspace"));
const CorrespondentBankingWorkspace = lazy(() => import("@/pages/CorrespondentBankingWorkspace"));
const ProductCatalogWorkspace = lazy(() => import("@/pages/ProductCatalogWorkspace"));
const CustomerSegmentsWorkspace = lazy(() => import("@/pages/CustomerSegmentsWorkspace"));
const SMSEmailGatewayWorkspace = lazy(() => import("@/pages/SMSEmailGatewayWorkspace"));
const RiskScoringWorkspace = lazy(() => import("@/pages/RiskScoringWorkspace"));
const RegulatoryReportingWorkspace = lazy(() => import("@/pages/RegulatoryReportingWorkspace"));
const ATMManagementWorkspace = lazy(() => import("@/pages/ATMManagementWorkspace"));
const DataExportWorkspace = lazy(() => import("@/pages/DataExportWorkspace"));
const CustomerInsightsWorkspace = lazy(() => import("@/pages/CustomerInsightsWorkspace"));
const SalaryProcessingWorkspace = lazy(() => import("@/pages/SalaryProcessingWorkspace"));
const CreditBureauWorkspace = lazy(() => import("@/pages/CreditBureauWorkspace"));
const DocumentManagementWorkspace = lazy(() => import("@/pages/DocumentManagementWorkspace"));
const POSTerminalWorkspace = lazy(() => import("@/pages/POSTerminalWorkspace"));
const CollateralValuationWorkspace = lazy(() => import("@/pages/CollateralValuationWorkspace"));
const CustomerFeedbackWorkspace = lazy(() => import("@/pages/CustomerFeedbackWorkspace"));
const MoneyMarketWorkspace = lazy(() => import("@/pages/MoneyMarketWorkspace"));
const SecuritiesTradingWorkspace = lazy(() => import("@/pages/SecuritiesTradingWorkspace"));
const SupplyChainFinanceWorkspace = lazy(() => import("@/pages/SupplyChainFinanceWorkspace"));
const CashPoolingWorkspace = lazy(() => import("@/pages/CashPoolingWorkspace"));
const BankGuaranteesWorkspace = lazy(() => import("@/pages/BankGuaranteesWorkspace"));
const OtcDerivativesWorkspace = lazy(() => import("@/pages/OtcDerivativesWorkspace"));
const ISO20022HubWorkspace = lazy(() => import("@/pages/ISO20022HubWorkspace"));
const BaselEngineWorkspace = lazy(() => import("@/pages/BaselEngineWorkspace"));
const IFRS9EngineWorkspace = lazy(() => import("@/pages/IFRS9EngineWorkspace"));
const OpenBankingWorkspace = lazy(() => import("@/pages/OpenBankingWorkspace"));
const InterbankLendingWorkspace = lazy(() => import("@/pages/InterbankLendingWorkspace"));
const PortfolioMgmtWorkspace = lazy(() => import("@/pages/PortfolioMgmtWorkspace"));
const WealthMgmtWorkspace = lazy(() => import("@/pages/WealthMgmtWorkspace"));
const CustodyServiceWorkspace = lazy(() => import("@/pages/CustodyServiceWorkspace"));
const FactoringWorkspace = lazy(() => import("@/pages/FactoringWorkspace"));
const SyndicatedLoansWorkspace = lazy(() => import("@/pages/SyndicatedLoansWorkspace"));
const ProjectFinanceWorkspace = lazy(() => import("@/pages/ProjectFinanceWorkspace"));
const LeasingWorkspace = lazy(() => import("@/pages/LeasingWorkspace"));
const ContingentLiabilitiesWorkspace = lazy(() => import("@/pages/ContingentLiabilitiesWorkspace"));
const ETDTradingWorkspace = lazy(() => import("@/pages/ETDTradingWorkspace"));
const PaymentInvestigationWorkspace = lazy(() => import("@/pages/PaymentInvestigationWorkspace"));
const StressTestingWorkspace = lazy(() => import("@/pages/StressTestingWorkspace"));
const APIMarketplaceWorkspace = lazy(() => import("@/pages/APIMarketplaceWorkspace"));
const ChatbotWorkspace = lazy(() => import("@/pages/ChatbotWorkspace"));
const SignatureVerificationWorkspace = lazy(() => import("@/pages/SignatureVerificationWorkspace"));
const RemittanceWorkspace = lazy(() => import("@/pages/RemittanceWorkspace"));
const MicrofinanceWorkspace = lazy(() => import("@/pages/MicrofinanceWorkspace"));
const UtilityPaymentsWorkspace = lazy(() => import("@/pages/UtilityPaymentsWorkspace"));
const MultiEntityWorkspace = lazy(() => import("@/pages/MultiEntityWorkspace"));
const TrustEstateWorkspace = lazy(() => import("@/pages/TrustEstateWorkspace"));
const EscrowWorkspace = lazy(() => import("@/pages/EscrowWorkspace"));
const QRPaymentsWorkspace = lazy(() => import("@/pages/QRPaymentsWorkspace"));
const FATCACRSWorkspace = lazy(() => import("@/pages/FATCACRSWorkspace"));
const BiometricAuthWorkspace = lazy(() => import("@/pages/BiometricAuthWorkspace"));
const SafeDepositWorkspace = lazy(() => import("@/pages/SafeDepositWorkspace"));
const FixedAssetsWorkspace = lazy(() => import("@/pages/FixedAssetsWorkspace"));
const ExpenseMgmtWorkspace = lazy(() => import("@/pages/ExpenseMgmtWorkspace"));
const InventoryWorkspace = lazy(() => import("@/pages/InventoryWorkspace"));
const InsuranceWorkspace = lazy(() => import("@/pages/InsuranceWorkspace"));
const PensionWorkspace = lazy(() => import("@/pages/PensionWorkspace"));
const LockerWorkspace = lazy(() => import("@/pages/LockerWorkspace"));
const StandingChargesWorkspace = lazy(() => import("@/pages/StandingChargesWorkspace"));
const SukukManagementWorkspace = lazy(() => import("@/pages/SukukManagementWorkspace"));
const TakafulManagementWorkspace = lazy(() => import("@/pages/TakafulManagementWorkspace"));
const WakalaInvestmentWorkspace = lazy(() => import("@/pages/WakalaInvestmentWorkspace"));
const AgentPerformanceWorkspace = lazy(() => import("@/pages/AgentPerformanceWorkspace"));
const WatchlistWorkspace = lazy(() => import("@/pages/WatchlistWorkspace"));
const SARReportsWorkspace = lazy(() => import("@/pages/SARReportsWorkspace"));
const PEPDatabaseWorkspace = lazy(() => import("@/pages/PEPDatabaseWorkspace"));
const CardTokensWorkspace = lazy(() => import("@/pages/CardTokensWorkspace"));
const CardFraudRulesWorkspace = lazy(() => import("@/pages/CardFraudRulesWorkspace"));
const StatementHistoryWorkspace = lazy(() => import("@/pages/StatementHistoryWorkspace"));
const WorkflowDefinitionsWorkspace = lazy(() => import("@/pages/WorkflowDefinitionsWorkspace"));
const WorkflowInstancesWorkspace = lazy(() => import("@/pages/WorkflowInstancesWorkspace"));
const SelfServiceTransactionsWorkspace = lazy(() => import("@/pages/SelfServiceTransactionsWorkspace"));
const ServiceHealthWorkspace = lazy(() => import("@/pages/ServiceHealthWorkspace"));
const MurabahaCalculatorWorkspace = lazy(() => import("@/pages/MurabahaCalculatorWorkspace"));
const LCAmendmentsWorkspace = lazy(() => import("@/pages/LCAmendmentsWorkspace"));
const ChequeImagingWorkspace = lazy(() => import("@/pages/ChequeImagingWorkspace"));
const IntegrationTestsWorkspace = lazy(() => import("@/pages/IntegrationTestsWorkspace"));
const SeedRegistryWorkspace = lazy(() => import("@/pages/SeedRegistryWorkspace"));
const InfraPostgresWorkspace = lazy(() => import("@/pages/InfraPostgresWorkspace"));
const InfraKafkaWorkspace = lazy(() => import("@/pages/InfraKafkaWorkspace"));
const InfraRedisWorkspace = lazy(() => import("@/pages/InfraRedisWorkspace"));
const InfraTemporalWorkspace = lazy(() => import("@/pages/InfraTemporalWorkspace"));
const InfraOpenSearchWorkspace = lazy(() => import("@/pages/InfraOpenSearchWorkspace"));
const InfraTigerBeetleWorkspace = lazy(() => import("@/pages/InfraTigerBeetleWorkspace"));
const InfraLakehouseWorkspace = lazy(() => import("@/pages/InfraLakehouseWorkspace"));
// Gap Closure — Batch 1 (CRITICAL)
const EODProcessorWorkspace = lazy(() => import("@/pages/EODProcessorWorkspace"));
const ProductFactoryWorkspace = lazy(() => import("@/pages/ProductFactoryWorkspace"));
const AccountingRulesWorkspace = lazy(() => import("@/pages/AccountingRulesWorkspace"));
const MakerCheckerWorkspace = lazy(() => import("@/pages/MakerCheckerWorkspace"));
const FXRevaluationWorkspace = lazy(() => import("@/pages/FXRevaluationWorkspace"));
const DBAdminWorkspace = lazy(() => import("@/pages/DBAdminWorkspace"));
// Gap Closure — Batch 2 (HIGH)
const CBNReturnsWorkspace = lazy(() => import("@/pages/CBNReturnsWorkspace"));
const CreditFacilitiesWorkspace = lazy(() => import("@/pages/CreditFacilitiesWorkspace"));
const StatementGeneratorWorkspace = lazy(() => import("@/pages/StatementGeneratorWorkspace"));
const RateCascadeWorkspace = lazy(() => import("@/pages/RateCascadeWorkspace"));
const LCRNSFRWorkspace = lazy(() => import("@/pages/LCRNSFRWorkspace"));
// Gap Closure — Batch 3 (MEDIUM)
const RelationshipPricingWorkspace = lazy(() => import("@/pages/RelationshipPricingWorkspace"));
const KafkaStreamingWorkspace = lazy(() => import("@/pages/KafkaStreamingWorkspace"));
const TemporalSagasWorkspace = lazy(() => import("@/pages/TemporalSagasWorkspace"));
const MandateManagementWorkspace = lazy(() => import("@/pages/MandateManagementWorkspace"));
const CIFManagementWorkspace = lazy(() => import("@/pages/CIFManagementWorkspace"));
const ExamManagementWorkspace = lazy(() => import("@/pages/ExamManagementWorkspace"));
// KYC/KYB — World-Class Identity Verification (PaddleOCR + Docling + VLM + Liveness + ArcFace)
const KYCEngineWorkspace = lazy(() => import("@/pages/KYCEngineWorkspace"));
const KYBEngineWorkspace = lazy(() => import("@/pages/KYBEngineWorkspace"));
const LivenessDetectionWorkspace = lazy(() => import("@/pages/LivenessDetectionWorkspace"));
const FaceMatchWorkspace = lazy(() => import("@/pages/FaceMatchWorkspace"));
const KYCTriggersWorkspace = lazy(() => import("@/pages/KYCTriggersWorkspace"));
const KYBTriggersWorkspace = lazy(() => import("@/pages/KYBTriggersWorkspace"));
const KYCEventRulesWorkspace = lazy(() => import("@/pages/KYCEventRulesWorkspace"));
const KYCServiceGatesWorkspace = lazy(() => import("@/pages/KYCServiceGatesWorkspace"));
const KYCOverridesWorkspace = lazy(() => import("@/pages/KYCOverridesWorkspace"));
const TenantIsolationWorkspace = lazy(() => import("@/pages/TenantIsolationWorkspace"));
const FeatureFlagEngineWorkspace = lazy(() => import("@/pages/FeatureFlagEngineWorkspace"));
const WhiteLabelEngineWorkspace = lazy(() => import("@/pages/WhiteLabelEngineWorkspace"));
const TenantProvisioningWorkspace = lazy(() => import("@/pages/TenantProvisioningWorkspace"));
const BrandedCommsWorkspace = lazy(() => import("@/pages/BrandedCommsWorkspace"));
const EventStreamingWorkspace = lazy(() => import("@/pages/EventStreamingWorkspace"));
const GraduatedRolloutWorkspace = lazy(() => import("@/pages/GraduatedRolloutWorkspace"));
const CustomDomainWorkspace = lazy(() => import("@/pages/CustomDomainWorkspace"));
const TenantMeteringWorkspace = lazy(() => import("@/pages/TenantMeteringWorkspace"));
const WebhookEngineWorkspace = lazy(() => import("@/pages/WebhookEngineWorkspace"));
const ApprovalWorkflowWorkspace = lazy(() => import("@/pages/ApprovalWorkflowWorkspace"));
const PluginMarketplaceWorkspace = lazy(() => import("@/pages/PluginMarketplaceWorkspace"));
const BillingOrchestratorWorkspace = lazy(() => import("@/pages/BillingOrchestratorWorkspace"));
const BillingRbacWorkspace = lazy(() => import("@/pages/BillingRbacWorkspace"));
const BillingEventProcessorWorkspace = lazy(() => import("@/pages/BillingEventProcessorWorkspace"));
const AdminAnalyticsPage = lazy(() => import("@/pages/AdminModulePages").then((module) => ({ default: module.AdminAnalyticsPage })));
const AdminBankingOpsPage = lazy(() => import("@/pages/AdminModulePages").then((module) => ({ default: module.AdminBankingOpsPage })));
const AdminFeatureFlagsPage = lazy(() => import("@/pages/AdminModulePages").then((module) => ({ default: module.AdminFeatureFlagsPage })));
const AdminSecurityPage = lazy(() => import("@/pages/AdminModulePages").then((module) => ({ default: module.AdminSecurityPage })));
const AdminUsersPage = lazy(() => import("@/pages/AdminModulePages").then((module) => ({ default: module.AdminUsersPage })));
const SecurityHardeningWorkspace = lazy(() => import("@/pages/SecurityHardeningWorkspace"));
const DDoSProtectionWorkspace = lazy(() => import("@/pages/DDoSProtectionWorkspace"));
const SwiftMessagingWorkspace = lazy(() => import("@/pages/SwiftMessagingWorkspace"));
const BranchOperationsWorkspace2 = lazy(() => import("@/pages/BranchOperationsWorkspace"));
const MicrofinanceEngineWorkspace = lazy(() => import("@/pages/MicrofinanceEngineWorkspace"));
const PBACEngineWorkspace = lazy(() => import("@/pages/PBACEngineWorkspace"));
const GLEngineWorkspace = lazy(() => import("@/pages/GLEngineWorkspace"));
const OfflineResilienceWorkspace = lazy(() => import("@/pages/OfflineResilienceWorkspace"));
const RegulatoryAutomationWorkspace = lazy(() => import("@/pages/RegulatoryAutomationWorkspace"));
const ServiceCatalogWorkspace = lazy(() => import("@/pages/ServiceCatalogWorkspace"));
const WhiteLabelConfigWorkspace = lazy(() => import("@/pages/WhiteLabelConfigWorkspace"));
const DatabasePersistenceWorkspace = lazy(() => import("@/pages/DatabasePersistenceWorkspace"));
const KafkaEventBusWorkspace = lazy(() => import("@/pages/KafkaEventBusWorkspace"));
const JWTAuthWorkspace = lazy(() => import("@/pages/JWTAuthWorkspace"));
const E2ETestSuiteWorkspace = lazy(() => import("@/pages/E2ETestSuiteWorkspace"));
const TigerBeetleLedgerWorkspace = lazy(() => import("@/pages/TigerBeetleLedgerWorkspace"));
const NotificationsWorkspace = lazy(() => import("@/pages/NotificationsWorkspace"));
const ReportGenerationWorkspace = lazy(() => import("@/pages/ReportGenerationWorkspace"));
const BatchEodWorkspace = lazy(() => import("@/pages/BatchEodWorkspace"));
const RateLimitingWorkspace = lazy(() => import("@/pages/RateLimitingWorkspace"));
const MultiCurrencyFxWorkspace = lazy(() => import("@/pages/MultiCurrencyFxWorkspace"));
const DisasterRecoveryWorkspace = lazy(() => import("@/pages/DisasterRecoveryWorkspace"));
const LoadTestingWorkspace = lazy(() => import("@/pages/LoadTestingWorkspace"));
const AIFraudDetectionWorkspace = lazy(() => import("@/pages/AIFraudDetectionWorkspace"));
const ENairaWorkspace = lazy(() => import("@/pages/ENairaWorkspace"));
const ESGBankingWorkspace = lazy(() => import("@/pages/ESGBankingWorkspace"));
const EmbeddedFinanceWorkspace = lazy(() => import("@/pages/EmbeddedFinanceWorkspace"));
const RansomwareProtectionWorkspace = lazy(() => import("@/pages/RansomwareProtectionWorkspace"));
const USSDBankingWorkspace = lazy(() => import("@/pages/USSDBankingWorkspace"));
const SMSBankingWorkspace = lazy(() => import("@/pages/SMSBankingWorkspace"));
const OfflineTransactionsWorkspace = lazy(() => import("@/pages/OfflineTransactionsWorkspace"));
const BandwidthAdaptationWorkspace = lazy(() => import("@/pages/BandwidthAdaptationWorkspace"));
const ResilienceDashboardWorkspace = lazy(() => import("@/pages/ResilienceDashboardWorkspace"));
const CircuitBreakerDashboardWorkspace = lazy(() => import("@/pages/CircuitBreakerDashboardWorkspace"));
const IdempotencyDashboardWorkspace = lazy(() => import("@/pages/IdempotencyDashboardWorkspace"));
const ErrorCatalogWorkspace = lazy(() => import("@/pages/ErrorCatalogWorkspace"));
const RetryPoliciesWorkspace = lazy(() => import("@/pages/RetryPoliciesWorkspace"));
const ErrorTelemetryWorkspace = lazy(() => import("@/pages/ErrorTelemetryWorkspace"));
const PerformanceCacheWorkspace = lazy(() => import("@/pages/PerformanceCacheWorkspace"));
const PerformanceMetricsWorkspace = lazy(() => import("@/pages/PerformanceMetricsWorkspace"));
const KedaAutoscalingWorkspace = lazy(() => import("@/pages/KedaAutoscalingWorkspace"));
const KedaPoliciesWorkspace = lazy(() => import("@/pages/KedaPoliciesWorkspace"));
const HAServicesWorkspace = lazy(() => import("@/pages/HAServicesWorkspace"));
const HAMiddlewareWorkspace = lazy(() => import("@/pages/HAMiddlewareWorkspace"));
const HAZonesWorkspace = lazy(() => import("@/pages/HAZonesWorkspace"));

function RouteFallback() {
  return <div className="min-h-screen bg-slate-50" />;
}

function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <ArchiveAdminSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function renderInAdminShell(Page: ComponentType) {
  return () => (
    <AdminShell>
      <Page />
    </AdminShell>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/login" component={AdminLoginPage} />

        <Route path="/customer/dashboard" component={CustomerDashboard} />
        <Route path="/customer/transfers" component={CustomerTransfers} />
        <Route path="/customer/cards" component={CustomerCards} />
        <Route path="/customer/savings" component={CustomerSavings} />
        <Route path="/customer/loans" component={CustomerLoans} />
        <Route path="/customer/bills" component={CustomerBills} />
        <Route path="/customer/statements" component={CustomerStatements} />
        <Route path="/customer/notifications" component={CustomerNotifications} />
        <Route path="/customer/settings" component={CustomerSettings} />
        <Route path="/customer/qr" component={CustomerQr} />

        <Route path="/" component={renderInAdminShell(AdminDashboard)} />
        <Route path="/banks" component={renderInAdminShell(AdminBanksPage)} />
        <Route path="/features" component={renderInAdminShell(AdminFeatureFlagsPage)} />
        <Route path="/billing" component={renderInAdminShell(AdminBillingPage)} />
        <Route path="/billing-engine" component={renderInAdminShell(BillingEngineWorkspace)} />
        <Route path="/pricing-model" component={renderInAdminShell(PricingModelWorkspace)} />
        <Route path="/monitoring" component={renderInAdminShell(AdminMonitoringPage)} />
        <Route path="/usage-analytics" component={renderInAdminShell(AdminUsageAnalyticsPage)} />
        <Route path="/alert-settings" component={renderInAdminShell(AdminAlertSettingsPage)} />
        <Route path="/alerts" component={renderInAdminShell(AdminAlertsPage)} />
        <Route path="/alert-rules" component={renderInAdminShell(AdminAlertRulesPage)} />
        <Route path="/group-lending" component={renderInAdminShell(AdminGroupLendingPage)} />
        <Route path="/agent-banking" component={renderInAdminShell(AdminAgentBankingPage)} />
        <Route path="/regulatory-reporting" component={renderInAdminShell(AdminRegulatoryReportingPage)} />
        <Route path="/onboarding" component={renderInAdminShell(PartnerOnboardingAdminPage)} />
        <Route path="/partner/onboarding" component={PartnerOnboardingPortalPage} />
        <Route path="/home" component={renderInAdminShell(AdminDashboard)} />
        <Route path="/curriculum" component={renderInAdminShell(AdminCurriculumPage)} />
        <Route path="/infrastructure" component={renderInAdminShell(AdminInfrastructurePage)} />
        <Route path="/resources" component={renderInAdminShell(AdminResourcesPage)} />
        <Route path="/quick-reference" component={renderInAdminShell(AdminQuickReferencePage)} />
        <Route path="/labs" component={renderInAdminShell(AdminLabsPage)} />
        <Route path="/agriculture" component={renderInAdminShell(AgricultureOverviewPage)} />
        <Route path="/agriculture/farmers" component={renderInAdminShell(AgricultureFarmersPage)} />
        <Route path="/agriculture/loans" component={renderInAdminShell(AgricultureLoansPage)} />
        <Route path="/agriculture/risk" component={renderInAdminShell(AgricultureRiskPage)} />
        <Route path="/agriculture/agtech" component={renderInAdminShell(AgricultureAgtechPage)} />
        <Route path="/agriculture/value-chain" component={renderInAdminShell(AgricultureValueChainPage)} />
        <Route path="/agriculture/regulatory" component={renderInAdminShell(AgricultureCompliancePage)} />
        <Route path="/agriculture/compliance" component={renderInAdminShell(AgricultureCompliancePage)} />
        <Route path="/agriculture/analytics" component={renderInAdminShell(AgricultureAnalyticsPage)} />

        <Route path="/admin" component={renderInAdminShell(AdminDashboard)} />
        <Route path="/admin/login" component={AdminLoginPage} />
        <Route path="/admin/feature-flags" component={renderInAdminShell(AdminFeatureFlagsPage)} />
        <Route path="/admin/features" component={renderInAdminShell(AdminFeatureFlagsPage)} />
        <Route path="/admin/security" component={renderInAdminShell(AdminSecurityPage)} />
        <Route path="/admin/banking" component={renderInAdminShell(AdminBankingOpsPage)} />
        <Route path="/admin/analytics" component={renderInAdminShell(AdminAnalyticsPage)} />
        <Route path="/admin/users" component={renderInAdminShell(AdminUsersPage)} />
        <Route path="/admin/banks" component={renderInAdminShell(AdminBanksPage)} />
        <Route path="/admin/billing" component={renderInAdminShell(AdminBillingPage)} />
        <Route path="/admin/billing-engine" component={renderInAdminShell(BillingEngineWorkspace)} />
        <Route path="/admin/pricing-model" component={renderInAdminShell(PricingModelWorkspace)} />
        <Route path="/admin/monitoring" component={renderInAdminShell(AdminMonitoringPage)} />
        <Route path="/admin/usage-analytics" component={renderInAdminShell(AdminUsageAnalyticsPage)} />
        <Route path="/admin/alerts" component={renderInAdminShell(AdminAlertsPage)} />
        <Route path="/admin/alert-settings" component={renderInAdminShell(AdminAlertSettingsPage)} />
        <Route path="/admin/alert-rules" component={renderInAdminShell(AdminAlertRulesPage)} />
        <Route path="/admin/group-lending" component={renderInAdminShell(AdminGroupLendingPage)} />
        <Route path="/admin/agent-banking" component={renderInAdminShell(AdminAgentBankingPage)} />
        <Route path="/admin/regulatory-reporting" component={renderInAdminShell(AdminRegulatoryReportingPage)} />
        <Route path="/admin/onboarding" component={renderInAdminShell(PartnerOnboardingAdminPage)} />
        <Route path="/admin/curriculum" component={renderInAdminShell(AdminCurriculumPage)} />
        <Route path="/admin/infrastructure" component={renderInAdminShell(AdminInfrastructurePage)} />
        <Route path="/admin/resources" component={renderInAdminShell(AdminResourcesPage)} />
        <Route path="/admin/quick-reference" component={renderInAdminShell(AdminQuickReferencePage)} />
        <Route path="/admin/labs" component={renderInAdminShell(AdminLabsPage)} />

        <Route path="/control-center" component={renderInAdminShell(Home)} />
        <Route path="/operations" component={renderInAdminShell(OperationsCenter)} />
        <Route path="/teller" component={renderInAdminShell(TellerWorkspace)} />
        <Route path="/trade-finance" component={renderInAdminShell(TradeFinanceWorkspace)} />
        <Route path="/mortgage" component={renderInAdminShell(MortgageWorkspace)} />
        <Route path="/education-loans" component={renderInAdminShell(EducationLoansWorkspace)} />
        <Route path="/esusu" component={renderInAdminShell(EsusuWorkspace)} />
        <Route path="/virtual-accounts" component={renderInAdminShell(VirtualAccountsWorkspace)} />
        <Route path="/disputes" component={renderInAdminShell(DisputeManagementWorkspace)} />
        <Route path="/agricultural-insurance" component={renderInAdminShell(AgricultureOverviewPage)} />
        <Route path="/ledger-sync" component={renderInAdminShell(LedgerSyncWorkspace)} />
        <Route path="/erpnext-sync" component={renderInAdminShell(ERPNextWorkspace)} />
        <Route path="/identity-channels" component={renderInAdminShell(IdentityChannelsWorkspace)} />
        <Route path="/islamic-banking" component={renderInAdminShell(IslamicBankingWorkspace)} />
        <Route path="/payments-hub" component={renderInAdminShell(PaymentsHubWorkspace)} />
        <Route path="/savings-products" component={renderInAdminShell(SavingsProductsWorkspace)} />
        <Route path="/card-management" component={renderInAdminShell(CardManagementWorkspace)} />
        <Route path="/treasury" component={renderInAdminShell(TreasuryWorkspace)} />
        <Route path="/customer-engagement" component={renderInAdminShell(CustomerEngagementWorkspace)} />
        <Route path="/fraud-detection" component={renderInAdminShell(FraudDetectionWorkspace)} />
        <Route path="/notification-center" component={renderInAdminShell(NotificationCenterWorkspace)} />
        <Route path="/account-opening" component={renderInAdminShell(AccountOpeningWorkspace)} />
        <Route path="/standing-orders" component={renderInAdminShell(StandingOrdersWorkspace)} />
        <Route path="/beneficiary-management" component={renderInAdminShell(BeneficiaryManagementWorkspace)} />
        <Route path="/loan-calculator" component={renderInAdminShell(LoanCalculatorWorkspace)} />
        <Route path="/batch-processing" component={renderInAdminShell(BatchProcessingWorkspace)} />
        <Route path="/fx-rates" component={renderInAdminShell(FXRatesWorkspace)} />
        <Route path="/branch-operations" component={renderInAdminShell(BranchOperationsWorkspace)} />
        <Route path="/ledger" component={renderInAdminShell(LedgerWorkspace)} />
        <Route path="/event-bus" component={renderInAdminShell(EventBusWorkspace)} />
        <Route path="/workflow-engine" component={renderInAdminShell(WorkflowEngineWorkspace)} />
        <Route path="/mojaloop" component={renderInAdminShell(MojaloopWorkspace)} />
        <Route path="/opensearch" component={renderInAdminShell(OpenSearchWorkspace)} />
        <Route path="/lakehouse" component={renderInAdminShell(LakehouseWorkspace)} />
        <Route path="/fluvio-streams" component={renderInAdminShell(FluvioStreamsWorkspace)} />
        <Route path="/dapr" component={renderInAdminShell(DaprSidecarWorkspace)} />
        <Route path="/permify" component={renderInAdminShell(PermifyWorkspace)} />
        <Route path="/keycloak" component={renderInAdminShell(KeycloakWorkspace)} />
        <Route path="/interest-rates" component={renderInAdminShell(InterestRateWorkspace)} />
        <Route path="/cheque-clearing" component={renderInAdminShell(ChequeClearingWorkspace)} />
        <Route path="/customer-360" component={renderInAdminShell(Customer360Workspace)} />
        <Route path="/nibss-direct-debit" component={renderInAdminShell(NIBSSDirectDebitWorkspace)} />
        <Route path="/diaspora-banking" component={renderInAdminShell(DiasporaBankingWorkspace)} />
        <Route path="/kyc-aml" component={renderInAdminShell(KYCAMLWorkspace)} />
        <Route path="/loan-origination" component={renderInAdminShell(LoanOriginationWorkspace)} />
        <Route path="/account-statements" component={renderInAdminShell(AccountStatementsWorkspace)} />
        <Route path="/bulk-payments" component={renderInAdminShell(BulkPaymentsWorkspace)} />
        <Route path="/card-management-v2" component={renderInAdminShell(CardManagementWorkspace2)} />
        <Route path="/treasury-liquidity" component={renderInAdminShell(TreasuryLiquidityWorkspace)} />
        <Route path="/agent-banking-v2" component={renderInAdminShell(AgentBankingWorkspace2)} />
        <Route path="/chart-of-accounts" component={renderInAdminShell(ChartOfAccountsWorkspace)} />
        <Route path="/journal-entries" component={renderInAdminShell(JournalEntriesWorkspace)} />
        <Route path="/reporting" component={renderInAdminShell(ReportingWorkspace)} />
        <Route path="/payment-transactions" component={renderInAdminShell(PaymentTransactionsWorkspace)} />
        <Route path="/loan-products" component={renderInAdminShell(LoanProductsWorkspace)} />
        <Route path="/loan-accounts" component={renderInAdminShell(LoanAccountsWorkspace)} />
        <Route path="/analytics" component={renderInAdminShell(AnalyticsWidgetsWorkspace)} />
        <Route path="/etl-pipelines" component={renderInAdminShell(ETLPipelinesWorkspace)} />
        <Route path="/fraud-rules" component={renderInAdminShell(FraudRulesWorkspace)} />
        <Route path="/fraud-alerts" component={renderInAdminShell(FraudAlertsWorkspace)} />
        <Route path="/webhook-subscriptions" component={renderInAdminShell(WebhookSubscriptionsWorkspace)} />
        <Route path="/webhook-deliveries" component={renderInAdminShell(WebhookDeliveriesWorkspace)} />
        <Route path="/audit-trail" component={renderInAdminShell(AuditTrailWorkspace)} />
        <Route path="/compliance-checks" component={renderInAdminShell(ComplianceChecksWorkspace)} />
        <Route path="/regulatory-calendar" component={renderInAdminShell(RegulatoryCalendarWorkspace)} />
        <Route path="/customer-onboarding" component={renderInAdminShell(CustomerOnboardingWorkspace)} />
        <Route path="/fx-dealing-room" component={renderInAdminShell(FXDealingRoomWorkspace)} />
        <Route path="/fx-positions" component={renderInAdminShell(FXPositionsWorkspace)} />
        <Route path="/doc-collections" component={renderInAdminShell(DocCollectionsWorkspace)} />
        <Route path="/treasury-investments" component={renderInAdminShell(TreasuryInvestmentsWorkspace)} />
        <Route path="/swift-messages" component={renderInAdminShell(SWIFTMessagesWorkspace)} />
        <Route path="/credit-risk" component={renderInAdminShell(CreditRiskWorkspace)} />
        <Route path="/reconciliation" component={renderInAdminShell(ReconciliationWorkspace)} />
        <Route path="/fee-schedules" component={renderInAdminShell(FeeSchedulesWorkspace)} />
        <Route path="/notification-preferences" component={renderInAdminShell(NotificationPreferencesWorkspace)} />
        <Route path="/dormancy" component={renderInAdminShell(DormancyWorkspace)} />
        <Route path="/interest-accrual" component={renderInAdminShell(InterestAccrualWorkspace)} />
        <Route path="/limit-management" component={renderInAdminShell(LimitManagementWorkspace)} />
        <Route path="/gl-accounts" component={renderInAdminShell(GLAccountsWorkspace)} />
        <Route path="/collateral" component={renderInAdminShell(CollateralWorkspace)} />
        <Route path="/complaints" component={renderInAdminShell(ComplaintsWorkspace)} />
        <Route path="/interbank-settlement" component={renderInAdminShell(InterbankSettlementWorkspace)} />
        <Route path="/staff-management" component={renderInAdminShell(StaffManagementWorkspace)} />
        <Route path="/channel-management" component={renderInAdminShell(ChannelManagementWorkspace)} />
        <Route path="/fixed-deposits" component={renderInAdminShell(FixedDepositsWorkspace)} />
        <Route path="/standing-instructions" component={renderInAdminShell(StandingInstructionsWorkspace)} />
        <Route path="/cash-management" component={renderInAdminShell(CashManagementWorkspace)} />
        <Route path="/correspondent-banking" component={renderInAdminShell(CorrespondentBankingWorkspace)} />
        <Route path="/product-catalog" component={renderInAdminShell(ProductCatalogWorkspace)} />
        <Route path="/customer-segments" component={renderInAdminShell(CustomerSegmentsWorkspace)} />
        <Route path="/messaging-gateway" component={renderInAdminShell(SMSEmailGatewayWorkspace)} />
        <Route path="/risk-scoring" component={renderInAdminShell(RiskScoringWorkspace)} />
        <Route path="/regulatory-reporting" component={renderInAdminShell(RegulatoryReportingWorkspace)} />
        <Route path="/atm-management" component={renderInAdminShell(ATMManagementWorkspace)} />
        <Route path="/data-export" component={renderInAdminShell(DataExportWorkspace)} />
        <Route path="/customer-insights" component={renderInAdminShell(CustomerInsightsWorkspace)} />
        <Route path="/salary-processing" component={renderInAdminShell(SalaryProcessingWorkspace)} />
        <Route path="/credit-bureau" component={renderInAdminShell(CreditBureauWorkspace)} />
        <Route path="/document-management" component={renderInAdminShell(DocumentManagementWorkspace)} />
        <Route path="/pos-terminals" component={renderInAdminShell(POSTerminalWorkspace)} />
        <Route path="/collateral-valuation" component={renderInAdminShell(CollateralValuationWorkspace)} />
        <Route path="/customer-feedback" component={renderInAdminShell(CustomerFeedbackWorkspace)} />
        <Route path="/money-market" component={renderInAdminShell(MoneyMarketWorkspace)} />
        <Route path="/securities-trading" component={renderInAdminShell(SecuritiesTradingWorkspace)} />
        <Route path="/supply-chain-finance" component={renderInAdminShell(SupplyChainFinanceWorkspace)} />
        <Route path="/cash-pooling" component={renderInAdminShell(CashPoolingWorkspace)} />
        <Route path="/bank-guarantees" component={renderInAdminShell(BankGuaranteesWorkspace)} />
        <Route path="/otc-derivatives" component={renderInAdminShell(OtcDerivativesWorkspace)} />
        <Route path="/iso20022-hub" component={renderInAdminShell(ISO20022HubWorkspace)} />
        <Route path="/basel-engine" component={renderInAdminShell(BaselEngineWorkspace)} />
        <Route path="/ifrs9-engine" component={renderInAdminShell(IFRS9EngineWorkspace)} />
        <Route path="/open-banking" component={renderInAdminShell(OpenBankingWorkspace)} />
        <Route path="/interbank-lending" component={renderInAdminShell(InterbankLendingWorkspace)} />
        <Route path="/portfolio-mgmt" component={renderInAdminShell(PortfolioMgmtWorkspace)} />
        <Route path="/wealth-mgmt" component={renderInAdminShell(WealthMgmtWorkspace)} />
        <Route path="/custody-service" component={renderInAdminShell(CustodyServiceWorkspace)} />
        <Route path="/factoring" component={renderInAdminShell(FactoringWorkspace)} />
        <Route path="/syndicated-loans" component={renderInAdminShell(SyndicatedLoansWorkspace)} />
        <Route path="/project-finance" component={renderInAdminShell(ProjectFinanceWorkspace)} />
        <Route path="/leasing" component={renderInAdminShell(LeasingWorkspace)} />
        <Route path="/contingent-liabilities" component={renderInAdminShell(ContingentLiabilitiesWorkspace)} />
        <Route path="/etd-trading" component={renderInAdminShell(ETDTradingWorkspace)} />
        <Route path="/payment-investigation" component={renderInAdminShell(PaymentInvestigationWorkspace)} />
        <Route path="/stress-testing" component={renderInAdminShell(StressTestingWorkspace)} />
        <Route path="/api-marketplace" component={renderInAdminShell(APIMarketplaceWorkspace)} />
        <Route path="/chatbot" component={renderInAdminShell(ChatbotWorkspace)} />
        <Route path="/signature-verification" component={renderInAdminShell(SignatureVerificationWorkspace)} />
        <Route path="/remittance" component={renderInAdminShell(RemittanceWorkspace)} />
        <Route path="/microfinance" component={renderInAdminShell(MicrofinanceWorkspace)} />
        <Route path="/utility-payments" component={renderInAdminShell(UtilityPaymentsWorkspace)} />
        <Route path="/multi-entity" component={renderInAdminShell(MultiEntityWorkspace)} />
        <Route path="/trust-estate" component={renderInAdminShell(TrustEstateWorkspace)} />
        <Route path="/escrow" component={renderInAdminShell(EscrowWorkspace)} />
        <Route path="/qr-payments" component={renderInAdminShell(QRPaymentsWorkspace)} />
        <Route path="/fatca-crs" component={renderInAdminShell(FATCACRSWorkspace)} />
        <Route path="/biometric-auth" component={renderInAdminShell(BiometricAuthWorkspace)} />
        <Route path="/safe-deposit" component={renderInAdminShell(SafeDepositWorkspace)} />
        <Route path="/fixed-assets" component={renderInAdminShell(FixedAssetsWorkspace)} />
        <Route path="/expense-mgmt" component={renderInAdminShell(ExpenseMgmtWorkspace)} />
        <Route path="/inventory" component={renderInAdminShell(InventoryWorkspace)} />
        <Route path="/insurance" component={renderInAdminShell(InsuranceWorkspace)} />
        <Route path="/pension" component={renderInAdminShell(PensionWorkspace)} />
        <Route path="/locker" component={renderInAdminShell(LockerWorkspace)} />
        <Route path="/standing-charges" component={renderInAdminShell(StandingChargesWorkspace)} />
        <Route path="/sukuk-management" component={renderInAdminShell(SukukManagementWorkspace)} />
        <Route path="/takaful-management" component={renderInAdminShell(TakafulManagementWorkspace)} />
        <Route path="/wakala-investments" component={renderInAdminShell(WakalaInvestmentWorkspace)} />
        <Route path="/agent-performance" component={renderInAdminShell(AgentPerformanceWorkspace)} />
        <Route path="/watchlist-screening" component={renderInAdminShell(WatchlistWorkspace)} />
        <Route path="/sar-reports" component={renderInAdminShell(SARReportsWorkspace)} />
        <Route path="/pep-database" component={renderInAdminShell(PEPDatabaseWorkspace)} />
        <Route path="/card-tokens" component={renderInAdminShell(CardTokensWorkspace)} />
        <Route path="/card-fraud-rules" component={renderInAdminShell(CardFraudRulesWorkspace)} />
        <Route path="/statement-history" component={renderInAdminShell(StatementHistoryWorkspace)} />
        <Route path="/workflow-definitions" component={renderInAdminShell(WorkflowDefinitionsWorkspace)} />
        <Route path="/workflow-instances" component={renderInAdminShell(WorkflowInstancesWorkspace)} />
        <Route path="/my-transactions" component={renderInAdminShell(SelfServiceTransactionsWorkspace)} />
        <Route path="/service-health" component={renderInAdminShell(ServiceHealthWorkspace)} />
        <Route path="/murabaha-calculator" component={renderInAdminShell(MurabahaCalculatorWorkspace)} />
        <Route path="/lc-amendments" component={renderInAdminShell(LCAmendmentsWorkspace)} />
        <Route path="/cheque-imaging" component={renderInAdminShell(ChequeImagingWorkspace)} />
        <Route path="/integration-tests" component={renderInAdminShell(IntegrationTestsWorkspace)} />
        <Route path="/seed-registry" component={renderInAdminShell(SeedRegistryWorkspace)} />
        <Route path="/infra-postgres" component={renderInAdminShell(InfraPostgresWorkspace)} />
        <Route path="/infra-kafka" component={renderInAdminShell(InfraKafkaWorkspace)} />
        <Route path="/infra-redis" component={renderInAdminShell(InfraRedisWorkspace)} />
        <Route path="/infra-temporal" component={renderInAdminShell(InfraTemporalWorkspace)} />
        <Route path="/infra-opensearch" component={renderInAdminShell(InfraOpenSearchWorkspace)} />
        <Route path="/infra-tigerbeetle" component={renderInAdminShell(InfraTigerBeetleWorkspace)} />
        <Route path="/infra-lakehouse" component={renderInAdminShell(InfraLakehouseWorkspace)} />
        {/* Gap Closure — Batch 1 (CRITICAL) */}
        <Route path="/eod-processor" component={renderInAdminShell(EODProcessorWorkspace)} />
        <Route path="/product-factory" component={renderInAdminShell(ProductFactoryWorkspace)} />
        <Route path="/accounting-rules" component={renderInAdminShell(AccountingRulesWorkspace)} />
        <Route path="/maker-checker" component={renderInAdminShell(MakerCheckerWorkspace)} />
        <Route path="/fx-revaluation" component={renderInAdminShell(FXRevaluationWorkspace)} />
        <Route path="/db-admin" component={renderInAdminShell(DBAdminWorkspace)} />
        {/* Gap Closure — Batch 2 (HIGH) */}
        <Route path="/cbn-returns" component={renderInAdminShell(CBNReturnsWorkspace)} />
        <Route path="/credit-facilities" component={renderInAdminShell(CreditFacilitiesWorkspace)} />
        <Route path="/statement-generator" component={renderInAdminShell(StatementGeneratorWorkspace)} />
        <Route path="/rate-cascade" component={renderInAdminShell(RateCascadeWorkspace)} />
        <Route path="/lcr-nsfr" component={renderInAdminShell(LCRNSFRWorkspace)} />
        {/* Gap Closure — Batch 3 (MEDIUM) */}
        <Route path="/relationship-pricing" component={renderInAdminShell(RelationshipPricingWorkspace)} />
        <Route path="/kafka-streaming" component={renderInAdminShell(KafkaStreamingWorkspace)} />
        <Route path="/temporal-sagas" component={renderInAdminShell(TemporalSagasWorkspace)} />
        <Route path="/mandate-management" component={renderInAdminShell(MandateManagementWorkspace)} />
        <Route path="/cif-management" component={renderInAdminShell(CIFManagementWorkspace)} />
        <Route path="/exam-management" component={renderInAdminShell(ExamManagementWorkspace)} />
        {/* KYC/KYB — World-Class Identity Verification */}
        <Route path="/kyc-engine" component={renderInAdminShell(KYCEngineWorkspace)} />
        <Route path="/kyb-engine" component={renderInAdminShell(KYBEngineWorkspace)} />
        <Route path="/liveness-detection" component={renderInAdminShell(LivenessDetectionWorkspace)} />
        <Route path="/face-match" component={renderInAdminShell(FaceMatchWorkspace)} />
        {/* KYC/KYB Integration — Admin Triggers, Events, Service Gates */}
        <Route path="/kyc-triggers" component={renderInAdminShell(KYCTriggersWorkspace)} />
        <Route path="/kyb-triggers" component={renderInAdminShell(KYBTriggersWorkspace)} />
        <Route path="/kyc-event-rules" component={renderInAdminShell(KYCEventRulesWorkspace)} />
        <Route path="/kyc-service-gates" component={renderInAdminShell(KYCServiceGatesWorkspace)} />
        <Route path="/kyc-overrides" component={renderInAdminShell(KYCOverridesWorkspace)} />
        {/* Multi-Tenant Platform */}
        <Route path="/tenant-isolation" component={renderInAdminShell(TenantIsolationWorkspace)} />
        <Route path="/feature-flag-engine" component={renderInAdminShell(FeatureFlagEngineWorkspace)} />
        <Route path="/white-label-engine" component={renderInAdminShell(WhiteLabelEngineWorkspace)} />
        <Route path="/white-label-config" component={renderInAdminShell(WhiteLabelConfigWorkspace)} />
        <Route path="/service-catalog" component={renderInAdminShell(ServiceCatalogWorkspace)} />
        <Route path="/tenant-provisioning" component={renderInAdminShell(TenantProvisioningWorkspace)} />
        <Route path="/branded-comms" component={renderInAdminShell(BrandedCommsWorkspace)} />
        <Route path="/event-streaming" component={renderInAdminShell(EventStreamingWorkspace)} />
        <Route path="/graduated-rollout" component={renderInAdminShell(GraduatedRolloutWorkspace)} />
        <Route path="/custom-domains" component={renderInAdminShell(CustomDomainWorkspace)} />
        <Route path="/tenant-metering" component={renderInAdminShell(TenantMeteringWorkspace)} />
        <Route path="/webhook-engine" component={renderInAdminShell(WebhookEngineWorkspace)} />
        <Route path="/approval-workflows" component={renderInAdminShell(ApprovalWorkflowWorkspace)} />
        <Route path="/plugin-marketplace" component={renderInAdminShell(PluginMarketplaceWorkspace)} />
        <Route path="/billing-orchestrator" component={renderInAdminShell(BillingOrchestratorWorkspace)} />
        <Route path="/billing-rbac" component={renderInAdminShell(BillingRbacWorkspace)} />
        <Route path="/billing-event-processor" component={renderInAdminShell(BillingEventProcessorWorkspace)} />
        <Route path="/security-hardening" component={renderInAdminShell(SecurityHardeningWorkspace)} />
        <Route path="/ddos-protection" component={renderInAdminShell(DDoSProtectionWorkspace)} />
        <Route path="/swift-messaging" component={renderInAdminShell(SwiftMessagingWorkspace)} />
        <Route path="/branch-operations-2" component={renderInAdminShell(BranchOperationsWorkspace2)} />
        <Route path="/microfinance-engine" component={renderInAdminShell(MicrofinanceEngineWorkspace)} />
        <Route path="/pbac-engine" component={renderInAdminShell(PBACEngineWorkspace)} />
        <Route path="/gl-engine" component={renderInAdminShell(GLEngineWorkspace)} />
        <Route path="/offline-resilience" component={renderInAdminShell(OfflineResilienceWorkspace)} />
        <Route path="/regulatory-automation" component={renderInAdminShell(RegulatoryAutomationWorkspace)} />
        <Route path="/database-persistence" component={renderInAdminShell(DatabasePersistenceWorkspace)} />
        <Route path="/kafka-event-bus" component={renderInAdminShell(KafkaEventBusWorkspace)} />
        <Route path="/jwt-auth" component={renderInAdminShell(JWTAuthWorkspace)} />
        <Route path="/e2e-tests" component={renderInAdminShell(E2ETestSuiteWorkspace)} />
        <Route path="/tigerbeetle-ledger" component={renderInAdminShell(TigerBeetleLedgerWorkspace)} />
        <Route path="/notifications-engine" component={renderInAdminShell(NotificationsWorkspace)} />
        <Route path="/report-generation" component={renderInAdminShell(ReportGenerationWorkspace)} />
        <Route path="/batch-eod" component={renderInAdminShell(BatchEodWorkspace)} />
        <Route path="/rate-limiting" component={renderInAdminShell(RateLimitingWorkspace)} />
        <Route path="/multi-currency-fx" component={renderInAdminShell(MultiCurrencyFxWorkspace)} />
        <Route path="/disaster-recovery" component={renderInAdminShell(DisasterRecoveryWorkspace)} />
        <Route path="/load-testing" component={renderInAdminShell(LoadTestingWorkspace)} />
        <Route path="/ai-fraud-detection" component={renderInAdminShell(AIFraudDetectionWorkspace)} />
        <Route path="/enaira-cbdc" component={renderInAdminShell(ENairaWorkspace)} />
        <Route path="/esg-banking" component={renderInAdminShell(ESGBankingWorkspace)} />
        <Route path="/embedded-finance" component={renderInAdminShell(EmbeddedFinanceWorkspace)} />
        <Route path="/ransomware-protection" component={renderInAdminShell(RansomwareProtectionWorkspace)} />
        <Route path="/ussd-banking" component={renderInAdminShell(USSDBankingWorkspace)} />
        <Route path="/sms-banking" component={renderInAdminShell(SMSBankingWorkspace)} />
        <Route path="/offline-transactions" component={renderInAdminShell(OfflineTransactionsWorkspace)} />
        <Route path="/bandwidth-adaptation" component={renderInAdminShell(BandwidthAdaptationWorkspace)} />
        <Route path="/resilience-dashboard" component={renderInAdminShell(ResilienceDashboardWorkspace)} />
        <Route path="/circuit-breaker-dashboard" component={renderInAdminShell(CircuitBreakerDashboardWorkspace)} />
        <Route path="/idempotency-dashboard" component={renderInAdminShell(IdempotencyDashboardWorkspace)} />
        <Route path="/error-catalog" component={renderInAdminShell(ErrorCatalogWorkspace)} />
        <Route path="/retry-policies" component={renderInAdminShell(RetryPoliciesWorkspace)} />
        <Route path="/error-telemetry" component={renderInAdminShell(ErrorTelemetryWorkspace)} />
        <Route path="/performance-cache" component={renderInAdminShell(PerformanceCacheWorkspace)} />
        <Route path="/performance-metrics" component={renderInAdminShell(PerformanceMetricsWorkspace)} />
        <Route path="/keda-autoscaling" component={renderInAdminShell(KedaAutoscalingWorkspace)} />
        <Route path="/keda-policies" component={renderInAdminShell(KedaPoliciesWorkspace)} />
        <Route path="/ha-services" component={renderInAdminShell(HAServicesWorkspace)} />
        <Route path="/ha-middleware" component={renderInAdminShell(HAMiddlewareWorkspace)} />
        <Route path="/ha-zones" component={renderInAdminShell(HAZonesWorkspace)} />

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}
