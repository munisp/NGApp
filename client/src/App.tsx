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
const AdminAnalyticsPage = lazy(() => import("@/pages/AdminModulePages").then((module) => ({ default: module.AdminAnalyticsPage })));
const AdminBankingOpsPage = lazy(() => import("@/pages/AdminModulePages").then((module) => ({ default: module.AdminBankingOpsPage })));
const AdminFeatureFlagsPage = lazy(() => import("@/pages/AdminModulePages").then((module) => ({ default: module.AdminFeatureFlagsPage })));
const AdminSecurityPage = lazy(() => import("@/pages/AdminModulePages").then((module) => ({ default: module.AdminSecurityPage })));
const AdminUsersPage = lazy(() => import("@/pages/AdminModulePages").then((module) => ({ default: module.AdminUsersPage })));

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

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}
