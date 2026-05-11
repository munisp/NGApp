import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'services/api_service.dart';
import 'services/offline_service.dart';
import 'services/connectivity_service.dart';
import 'services/cache_service.dart';
import 'screens/home_screen.dart';
import 'screens/customers_screen.dart';
import 'screens/transfers_screen.dart';
import 'screens/loans_screen.dart';
import 'screens/cards_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/account_opening_screen.dart';
import 'screens/account_statements_screen.dart';
import 'screens/accounting_rules_screen.dart';
import 'screens/admin_dashboard_screen.dart';
import 'screens/agent_banking_screen.dart';
import 'screens/agent_performance_screen.dart';
import 'screens/agricultural_insurance_screen.dart';
import 'screens/ai_fraud_detection_screen.dart';
import 'screens/analytics_widgets_screen.dart';
import 'screens/api_marketplace_screen.dart';
import 'screens/approval_workflow_screen.dart';
import 'screens/atm_management_screen.dart';
import 'screens/audit_trail_screen.dart';
import 'screens/bank_guarantees_screen.dart';
import 'screens/basel_engine_screen.dart';
import 'screens/batch_eod_screen.dart';
import 'screens/batch_processing_screen.dart';
import 'screens/beneficiary_mgmt_screen.dart';
import 'screens/billing_engine_screen.dart';
import 'screens/billing_event_processor_screen.dart';
import 'screens/billing_orchestrator_screen.dart';
import 'screens/billing_rbac_screen.dart';
import 'screens/biometric_auth_screen.dart';
import 'screens/branch_operations_screen.dart';
import 'screens/branded_comms_screen.dart';
import 'screens/bulk_payments_screen.dart';
import 'screens/card_fraud_rules_screen.dart';
import 'screens/card_management_screen.dart';
import 'screens/card_tokens_screen.dart';
import 'screens/cash_management_screen.dart';
import 'screens/cash_pooling_screen.dart';
import 'screens/cbn_returns_screen.dart';
import 'screens/channel_management_screen.dart';
import 'screens/chart_of_accounts_screen.dart';
import 'screens/chatbot_screen.dart';
import 'screens/cheque_clearing_screen.dart';
import 'screens/cheque_imaging_screen.dart';
import 'screens/cif_management_screen.dart';
import 'screens/collateral_screen.dart';
import 'screens/collateral_valuation_screen.dart';
import 'screens/complaints_screen.dart';
import 'screens/compliance_checks_screen.dart';
import 'screens/component_showcase_screen.dart';
import 'screens/contingent_liabilities_screen.dart';
import 'screens/correspondent_banking_screen.dart';
import 'screens/credit_bureau_screen.dart';
import 'screens/credit_facilities_screen.dart';
import 'screens/credit_risk_screen.dart';
import 'screens/custody_service_screen.dart';
import 'screens/custom_domain_screen.dart';
import 'screens/customer_360_screen.dart';
import 'screens/customer_bills_screen.dart';
import 'screens/customer_cards_screen.dart';
import 'screens/customer_dashboard_screen.dart';
import 'screens/customer_engagement_screen.dart';
import 'screens/customer_feedback_screen.dart';
import 'screens/customer_insights_screen.dart';
import 'screens/customer_loans_screen.dart';
import 'screens/customer_notifications_screen.dart';
import 'screens/customer_onboarding_screen.dart';
import 'screens/customer_qr_screen.dart';
import 'screens/customer_savings_screen.dart';
import 'screens/customer_segments_screen.dart';
import 'screens/customer_settings_screen.dart';
import 'screens/customer_statements_screen.dart';
import 'screens/customer_transfers_screen.dart';
import 'screens/dapr_sidecar_screen.dart';
import 'screens/data_export_screen.dart';
import 'screens/database_persistence_screen.dart';
import 'screens/db_admin_screen.dart';
import 'screens/ddos_protection_screen.dart';
import 'screens/diaspora_banking_screen.dart';
import 'screens/disaster_recovery_screen.dart';
import 'screens/dispute_management_screen.dart';
import 'screens/doc_collections_screen.dart';
import 'screens/document_management_screen.dart';
import 'screens/dormancy_mgmt_screen.dart';
import 'screens/e2e_tests_screen.dart';
import 'screens/education_loans_screen.dart';
import 'screens/embedded_finance_screen.dart';
import 'screens/enaira_cbdc_screen.dart';
import 'screens/eod_processor_screen.dart';
import 'screens/erp_next_screen.dart';
import 'screens/escrow_screen.dart';
import 'screens/esg_banking_screen.dart';
import 'screens/esusu_screen.dart';
import 'screens/etd_trading_screen.dart';
import 'screens/etl_pipelines_screen.dart';
import 'screens/event_bus_screen.dart';
import 'screens/event_streaming_screen.dart';
import 'screens/exam_management_screen.dart';
import 'screens/expense_mgmt_screen.dart';
import 'screens/face_match_screen.dart';
import 'screens/factoring_screen.dart';
import 'screens/fatca_crs_screen.dart';
import 'screens/feature_flag_engine_screen.dart';
import 'screens/fee_schedules_screen.dart';
import 'screens/fixed_assets_screen.dart';
import 'screens/fixed_deposits_screen.dart';
import 'screens/fluvio_streams_screen.dart';
import 'screens/fraud_alerts_screen.dart';
import 'screens/fraud_detection_screen.dart';
import 'screens/fraud_rules_screen.dart';
import 'screens/fx_dealing_room_screen.dart';
import 'screens/fx_positions_screen.dart';
import 'screens/fx_rates_screen.dart';
import 'screens/fx_revaluation_screen.dart';
import 'screens/gl_accounts_screen.dart';
import 'screens/gl_engine_screen.dart';
import 'screens/graduated_rollout_screen.dart';
import 'screens/identity_channels_screen.dart';
import 'screens/ifrs9_engine_screen.dart';
import 'screens/infra_kafka_screen.dart';
import 'screens/infra_lakehouse_screen.dart';
import 'screens/infra_opensearch_screen.dart';
import 'screens/infra_postgres_screen.dart';
import 'screens/infra_redis_screen.dart';
import 'screens/infra_temporal_screen.dart';
import 'screens/infra_tigerbeetle_screen.dart';
import 'screens/insurance_screen.dart';
import 'screens/integration_tests_screen.dart';
import 'screens/interbank_lending_screen.dart';
import 'screens/interbank_settlement_screen.dart';
import 'screens/interest_accrual_screen.dart';
import 'screens/interest_rate_screen.dart';
import 'screens/inventory_finance_screen.dart';
import 'screens/islamic_banking_screen.dart';
import 'screens/iso20022_hub_screen.dart';
import 'screens/journal_entries_screen.dart';
import 'screens/jwt_auth_screen.dart';
import 'screens/kafka_event_bus_screen.dart';
import 'screens/kafka_streaming_screen.dart';
import 'screens/keycloak_screen.dart';
import 'screens/kyb_engine_screen.dart';
import 'screens/kyb_triggers_screen.dart';
import 'screens/kyc_aml_screen.dart';
import 'screens/kyc_engine_screen.dart';
import 'screens/kyc_event_rules_screen.dart';
import 'screens/kyc_overrides_screen.dart';
import 'screens/kyc_service_gates_screen.dart';
import 'screens/kyc_triggers_screen.dart';
import 'screens/lakehouse_screen.dart';
import 'screens/lc_amendments_screen.dart';
import 'screens/lcr_nsfr_screen.dart';
import 'screens/leasing_screen.dart';
import 'screens/ledger_sync_screen.dart';
import 'screens/limit_management_screen.dart';
import 'screens/liveness_detection_screen.dart';
import 'screens/load_testing_screen.dart';
import 'screens/loan_accounts_screen.dart';
import 'screens/loan_calculator_screen.dart';
import 'screens/loan_origination_screen.dart';
import 'screens/loan_products_screen.dart';
import 'screens/locker_screen.dart';
import 'screens/maker_checker_screen.dart';
import 'screens/mandate_management_screen.dart';
import 'screens/messaging_gateway_screen.dart';
import 'screens/microfinance_engine_screen.dart';
import 'screens/microfinance_screen.dart';
import 'screens/mojaloop_screen.dart';
import 'screens/money_market_screen.dart';
import 'screens/mortgage_screen.dart';
import 'screens/multi_currency_fx_screen.dart';
import 'screens/multi_entity_screen.dart';
import 'screens/murabaha_calculator_screen.dart';
import 'screens/nibss_direct_debit_screen.dart';
import 'screens/notification_center_screen.dart';
import 'screens/notification_prefs_screen.dart';
import 'screens/notifications_engine_screen.dart';
import 'screens/offline_resilience_screen.dart';
import 'screens/open_banking_screen.dart';
import 'screens/opensearch_screen.dart';
import 'screens/operations_center_screen.dart';
import 'screens/otc_derivatives_screen.dart';
import 'screens/partner_onboarding_admin_screen.dart';
import 'screens/partner_onboarding_portal_screen.dart';
import 'screens/payment_investigation_screen.dart';
import 'screens/payment_transactions_screen.dart';
import 'screens/payments_hub_screen.dart';
import 'screens/pbac_engine_screen.dart';
import 'screens/pension_screen.dart';
import 'screens/pep_database_screen.dart';
import 'screens/permify_screen.dart';
import 'screens/plugin_marketplace_screen.dart';
import 'screens/portfolio_mgmt_screen.dart';
import 'screens/pos_terminal_screen.dart';
import 'screens/pricing_model_screen.dart';
import 'screens/product_catalog_screen.dart';
import 'screens/project_finance_screen.dart';
import 'screens/qr_payments_screen.dart';
import 'screens/rate_cascade_screen.dart';
import 'screens/rate_limiting_screen.dart';
import 'screens/reconciliation_screen.dart';
import 'screens/regulatory_automation_screen.dart';
import 'screens/regulatory_calendar_screen.dart';
import 'screens/regulatory_reporting_screen.dart';
import 'screens/relationship_pricing_screen.dart';
import 'screens/remittance_screen.dart';
import 'screens/report_generation_screen.dart';
import 'screens/reporting_screen.dart';
import 'screens/risk_scoring_screen.dart';
import 'screens/safe_deposit_screen.dart';
import 'screens/salary_processing_screen.dart';
import 'screens/sar_reports_screen.dart';
import 'screens/savings_products_screen.dart';
import 'screens/securities_trading_screen.dart';
import 'screens/security_hardening_screen.dart';
import 'screens/seed_registry_screen.dart';
import 'screens/self_service_txns_screen.dart';
import 'screens/service_catalog_screen.dart';
import 'screens/service_health_screen.dart';
import 'screens/signature_verification_screen.dart';
import 'screens/sms_email_gateway_screen.dart';
import 'screens/staff_management_screen.dart';
import 'screens/standing_charges_screen.dart';
import 'screens/standing_instructions_screen.dart';
import 'screens/standing_orders_screen.dart';
import 'screens/statement_generator_screen.dart';
import 'screens/statement_history_screen.dart';
import 'screens/stress_testing_screen.dart';
import 'screens/sukuk_management_screen.dart';
import 'screens/supply_chain_finance_screen.dart';
import 'screens/swift_messaging_screen.dart';
import 'screens/syndicated_loans_screen.dart';
import 'screens/takaful_management_screen.dart';
import 'screens/teller_screen.dart';
import 'screens/temporal_sagas_screen.dart';
import 'screens/tenant_isolation_screen.dart';
import 'screens/tenant_metering_screen.dart';
import 'screens/tenant_provisioning_screen.dart';
import 'screens/tigerbeetle_ledger_screen.dart';
import 'screens/trade_finance_screen.dart';
import 'screens/treasury_investments_screen.dart';
import 'screens/treasury_liquidity_screen.dart';
import 'screens/treasury_screen.dart';
import 'screens/trust_estate_screen.dart';
import 'screens/utility_payments_screen.dart';
import 'screens/virtual_accounts_screen.dart';
import 'screens/wakala_investment_screen.dart';
import 'screens/watchlist_screen.dart';
import 'screens/wealth_mgmt_screen.dart';
import 'screens/webhook_deliveries_screen.dart';
import 'screens/webhook_engine_screen.dart';
import 'screens/webhook_subscriptions_screen.dart';
import 'screens/white_label_config_screen.dart';
import 'screens/workflow_definitions_screen.dart';
import 'screens/workflow_engine_screen.dart';
import 'screens/workflow_instances_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Initialize SQLite cache for offline support
  await CacheService.instance.database;
  await CacheService.instance.clearExpired();
  runApp(const Bank54App());
}

class Bank54App extends StatelessWidget {
  const Bank54App({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<ApiService>(create: (_) => ApiService()),
        Provider<OfflineService>(create: (_) => OfflineService()),
        ChangeNotifierProvider<ConnectivityService>(create: (_) => ConnectivityService()),
      ],
      child: MaterialApp(
        title: '54Bank',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0F766E), brightness: Brightness.light),
          useMaterial3: true,
        ),
        darkTheme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0F766E), brightness: Brightness.dark),
          useMaterial3: true,
        ),
        initialRoute: '/',
        routes: {
          '/': (_) => const HomeScreen(),
          '/customers': (_) => const CustomersScreen(),
          '/transfers': (_) => const TransfersScreen(),
          '/loans': (_) => const LoansScreen(),
          '/cards': (_) => const CardsScreen(),
          '/settings': (_) => const SettingsScreen(),
          '/account-opening': (_) => const AccountOpeningScreen(),
          '/account-statements': (_) => const AccountStatementsScreen(),
          '/accounting-rules': (_) => const AccountingRulesScreen(),
          '/admin-dashboard': (_) => const AdminDashboardScreen(),
          '/agent-banking': (_) => const AgentBankingScreen(),
          '/agent-performance': (_) => const AgentPerformanceScreen(),
          '/agricultural-insurance': (_) => const AgriculturalInsuranceScreen(),
          '/ai-fraud-detection': (_) => const AiFraudDetectionScreen(),
          '/analytics-widgets': (_) => const AnalyticsWidgetsScreen(),
          '/api-marketplace': (_) => const ApiMarketplaceScreen(),
          '/approval-workflow': (_) => const ApprovalWorkflowScreen(),
          '/atm-management': (_) => const AtmManagementScreen(),
          '/audit-trail': (_) => const AuditTrailScreen(),
          '/bank-guarantees': (_) => const BankGuaranteesScreen(),
          '/basel-engine': (_) => const BaselEngineScreen(),
          '/batch-eod': (_) => const BatchEodScreen(),
          '/batch-processing': (_) => const BatchProcessingScreen(),
          '/beneficiary-mgmt': (_) => const BeneficiaryMgmtScreen(),
          '/billing-engine': (_) => const BillingEngineScreen(),
          '/billing-event-processor': (_) => const BillingEventProcessorScreen(),
          '/billing-orchestrator': (_) => const BillingOrchestratorScreen(),
          '/billing-rbac': (_) => const BillingRbacScreen(),
          '/biometric-auth': (_) => const BiometricAuthScreen(),
          '/branch-operations': (_) => const BranchOperationsScreen(),
          '/branded-comms': (_) => const BrandedCommsScreen(),
          '/bulk-payments': (_) => const BulkPaymentsScreen(),
          '/card-fraud-rules': (_) => const CardFraudRulesScreen(),
          '/card-management': (_) => const CardManagementScreen(),
          '/card-tokens': (_) => const CardTokensScreen(),
          '/cash-management': (_) => const CashManagementScreen(),
          '/cash-pooling': (_) => const CashPoolingScreen(),
          '/cbn-returns': (_) => const CbnReturnsScreen(),
          '/channel-management': (_) => const ChannelManagementScreen(),
          '/chart-of-accounts': (_) => const ChartOfAccountsScreen(),
          '/chatbot': (_) => const ChatbotScreen(),
          '/cheque-clearing': (_) => const ChequeClearingScreen(),
          '/cheque-imaging': (_) => const ChequeImagingScreen(),
          '/cif-management': (_) => const CifManagementScreen(),
          '/collateral': (_) => const CollateralScreen(),
          '/collateral-valuation': (_) => const CollateralValuationScreen(),
          '/complaints': (_) => const ComplaintsScreen(),
          '/compliance-checks': (_) => const ComplianceChecksScreen(),
          '/component-showcase': (_) => const ComponentShowcaseScreen(),
          '/contingent-liabilities': (_) => const ContingentLiabilitiesScreen(),
          '/correspondent-banking': (_) => const CorrespondentBankingScreen(),
          '/credit-bureau': (_) => const CreditBureauScreen(),
          '/credit-facilities': (_) => const CreditFacilitiesScreen(),
          '/credit-risk': (_) => const CreditRiskScreen(),
          '/custody-service': (_) => const CustodyServiceScreen(),
          '/custom-domain': (_) => const CustomDomainScreen(),
          '/customer-360': (_) => const Customer360Screen(),
          '/customer-bills': (_) => const CustomerBillsScreen(),
          '/customer-cards': (_) => const CustomerCardsScreen(),
          '/customer-dashboard': (_) => const CustomerDashboardScreen(),
          '/customer-engagement': (_) => const CustomerEngagementScreen(),
          '/customer-feedback': (_) => const CustomerFeedbackScreen(),
          '/customer-insights': (_) => const CustomerInsightsScreen(),
          '/customer-loans': (_) => const CustomerLoansScreen(),
          '/customer-notifications': (_) => const CustomerNotificationsScreen(),
          '/customer-onboarding': (_) => const CustomerOnboardingScreen(),
          '/customer-qr': (_) => const CustomerQrScreen(),
          '/customer-savings': (_) => const CustomerSavingsScreen(),
          '/customer-segments': (_) => const CustomerSegmentsScreen(),
          '/customer-settings': (_) => const CustomerSettingsScreen(),
          '/customer-statements': (_) => const CustomerStatementsScreen(),
          '/customer-transfers': (_) => const CustomerTransfersScreen(),
          '/dapr-sidecar': (_) => const DaprSidecarScreen(),
          '/data-export': (_) => const DataExportScreen(),
          '/database-persistence': (_) => const DatabasePersistenceScreen(),
          '/db-admin': (_) => const DbAdminScreen(),
          '/ddos-protection': (_) => const DdosProtectionScreen(),
          '/diaspora-banking': (_) => const DiasporaBankingScreen(),
          '/disaster-recovery': (_) => const DisasterRecoveryScreen(),
          '/dispute-management': (_) => const DisputeManagementScreen(),
          '/doc-collections': (_) => const DocCollectionsScreen(),
          '/document-management': (_) => const DocumentManagementScreen(),
          '/dormancy-mgmt': (_) => const DormancyMgmtScreen(),
          '/e2e-tests': (_) => const E2eTestsScreen(),
          '/education-loans': (_) => const EducationLoansScreen(),
          '/embedded-finance': (_) => const EmbeddedFinanceScreen(),
          '/enaira-cbdc': (_) => const EnairaCbdcScreen(),
          '/eod-processor': (_) => const EodProcessorScreen(),
          '/erp-next': (_) => const ErpNextScreen(),
          '/escrow': (_) => const EscrowScreen(),
          '/esg-banking': (_) => const EsgBankingScreen(),
          '/esusu': (_) => const EsusuScreen(),
          '/etd-trading': (_) => const EtdTradingScreen(),
          '/etl-pipelines': (_) => const EtlPipelinesScreen(),
          '/event-bus': (_) => const EventBusScreen(),
          '/event-streaming': (_) => const EventStreamingScreen(),
          '/exam-management': (_) => const ExamManagementScreen(),
          '/expense-mgmt': (_) => const ExpenseMgmtScreen(),
          '/face-match': (_) => const FaceMatchScreen(),
          '/factoring': (_) => const FactoringScreen(),
          '/fatca-crs': (_) => const FatcaCrsScreen(),
          '/feature-flag-engine': (_) => const FeatureFlagEngineScreen(),
          '/fee-schedules': (_) => const FeeSchedulesScreen(),
          '/fixed-assets': (_) => const FixedAssetsScreen(),
          '/fixed-deposits': (_) => const FixedDepositsScreen(),
          '/fluvio-streams': (_) => const FluvioStreamsScreen(),
          '/fraud-alerts': (_) => const FraudAlertsScreen(),
          '/fraud-detection': (_) => const FraudDetectionScreen(),
          '/fraud-rules': (_) => const FraudRulesScreen(),
          '/fx-dealing-room': (_) => const FxDealingRoomScreen(),
          '/fx-positions': (_) => const FxPositionsScreen(),
          '/fx-rates': (_) => const FxRatesScreen(),
          '/fx-revaluation': (_) => const FxRevaluationScreen(),
          '/gl-accounts': (_) => const GlAccountsScreen(),
          '/gl-engine': (_) => const GlEngineScreen(),
          '/graduated-rollout': (_) => const GraduatedRolloutScreen(),
          '/identity-channels': (_) => const IdentityChannelsScreen(),
          '/ifrs9-engine': (_) => const Ifrs9EngineScreen(),
          '/infra-kafka': (_) => const InfraKafkaScreen(),
          '/infra-lakehouse': (_) => const InfraLakehouseScreen(),
          '/infra-opensearch': (_) => const InfraOpensearchScreen(),
          '/infra-postgres': (_) => const InfraPostgresScreen(),
          '/infra-redis': (_) => const InfraRedisScreen(),
          '/infra-temporal': (_) => const InfraTemporalScreen(),
          '/infra-tigerbeetle': (_) => const InfraTigerbeetleScreen(),
          '/insurance': (_) => const InsuranceScreen(),
          '/integration-tests': (_) => const IntegrationTestsScreen(),
          '/interbank-lending': (_) => const InterbankLendingScreen(),
          '/interbank-settlement': (_) => const InterbankSettlementScreen(),
          '/interest-accrual': (_) => const InterestAccrualScreen(),
          '/interest-rate': (_) => const InterestRateScreen(),
          '/inventory-finance': (_) => const InventoryFinanceScreen(),
          '/islamic-banking': (_) => const IslamicBankingScreen(),
          '/iso20022-hub': (_) => const Iso20022HubScreen(),
          '/journal-entries': (_) => const JournalEntriesScreen(),
          '/jwt-auth': (_) => const JwtAuthScreen(),
          '/kafka-event-bus': (_) => const KafkaEventBusScreen(),
          '/kafka-streaming': (_) => const KafkaStreamingScreen(),
          '/keycloak': (_) => const KeycloakScreen(),
          '/kyb-engine': (_) => const KybEngineScreen(),
          '/kyb-triggers': (_) => const KybTriggersScreen(),
          '/kyc-aml': (_) => const KycAmlScreen(),
          '/kyc-engine': (_) => const KycEngineScreen(),
          '/kyc-event-rules': (_) => const KycEventRulesScreen(),
          '/kyc-overrides': (_) => const KycOverridesScreen(),
          '/kyc-service-gates': (_) => const KycServiceGatesScreen(),
          '/kyc-triggers': (_) => const KycTriggersScreen(),
          '/lakehouse': (_) => const LakehouseScreen(),
          '/lc-amendments': (_) => const LcAmendmentsScreen(),
          '/lcr-nsfr': (_) => const LcrNsfrScreen(),
          '/leasing': (_) => const LeasingScreen(),
          '/ledger-sync': (_) => const LedgerSyncScreen(),
          '/limit-management': (_) => const LimitManagementScreen(),
          '/liveness-detection': (_) => const LivenessDetectionScreen(),
          '/load-testing': (_) => const LoadTestingScreen(),
          '/loan-accounts': (_) => const LoanAccountsScreen(),
          '/loan-calculator': (_) => const LoanCalculatorScreen(),
          '/loan-origination': (_) => const LoanOriginationScreen(),
          '/loan-products': (_) => const LoanProductsScreen(),
          '/locker': (_) => const LockerScreen(),
          '/maker-checker': (_) => const MakerCheckerScreen(),
          '/mandate-management': (_) => const MandateManagementScreen(),
          '/messaging-gateway': (_) => const MessagingGatewayScreen(),
          '/microfinance-engine': (_) => const MicrofinanceEngineScreen(),
          '/microfinance': (_) => const MicrofinanceScreen(),
          '/mojaloop': (_) => const MojaloopScreen(),
          '/money-market': (_) => const MoneyMarketScreen(),
          '/mortgage': (_) => const MortgageScreen(),
          '/multi-currency-fx': (_) => const MultiCurrencyFxScreen(),
          '/multi-entity': (_) => const MultiEntityScreen(),
          '/murabaha-calculator': (_) => const MurabahaCalculatorScreen(),
          '/nibss-direct-debit': (_) => const NibssDirectDebitScreen(),
          '/notification-center': (_) => const NotificationCenterScreen(),
          '/notification-prefs': (_) => const NotificationPrefsScreen(),
          '/notifications-engine': (_) => const NotificationsEngineScreen(),
          '/offline-resilience': (_) => const OfflineResilienceScreen(),
          '/open-banking': (_) => const OpenBankingScreen(),
          '/opensearch': (_) => const OpensearchScreen(),
          '/operations-center': (_) => const OperationsCenterScreen(),
          '/otc-derivatives': (_) => const OtcDerivativesScreen(),
          '/partner-onboarding-admin': (_) => const PartnerOnboardingAdminScreen(),
          '/partner-onboarding-portal': (_) => const PartnerOnboardingPortalScreen(),
          '/payment-investigation': (_) => const PaymentInvestigationScreen(),
          '/payment-transactions': (_) => const PaymentTransactionsScreen(),
          '/payments-hub': (_) => const PaymentsHubScreen(),
          '/pbac-engine': (_) => const PbacEngineScreen(),
          '/pension': (_) => const PensionScreen(),
          '/pep-database': (_) => const PepDatabaseScreen(),
          '/permify': (_) => const PermifyScreen(),
          '/plugin-marketplace': (_) => const PluginMarketplaceScreen(),
          '/portfolio-mgmt': (_) => const PortfolioMgmtScreen(),
          '/pos-terminal': (_) => const PosTerminalScreen(),
          '/pricing-model': (_) => const PricingModelScreen(),
          '/product-catalog': (_) => const ProductCatalogScreen(),
          '/project-finance': (_) => const ProjectFinanceScreen(),
          '/qr-payments': (_) => const QrPaymentsScreen(),
          '/rate-cascade': (_) => const RateCascadeScreen(),
          '/rate-limiting': (_) => const RateLimitingScreen(),
          '/reconciliation': (_) => const ReconciliationScreen(),
          '/regulatory-automation': (_) => const RegulatoryAutomationScreen(),
          '/regulatory-calendar': (_) => const RegulatoryCalendarScreen(),
          '/regulatory-reporting': (_) => const RegulatoryReportingScreen(),
          '/relationship-pricing': (_) => const RelationshipPricingScreen(),
          '/remittance': (_) => const RemittanceScreen(),
          '/report-generation': (_) => const ReportGenerationScreen(),
          '/reporting': (_) => const ReportingScreen(),
          '/risk-scoring': (_) => const RiskScoringScreen(),
          '/safe-deposit': (_) => const SafeDepositScreen(),
          '/salary-processing': (_) => const SalaryProcessingScreen(),
          '/sar-reports': (_) => const SarReportsScreen(),
          '/savings-products': (_) => const SavingsProductsScreen(),
          '/securities-trading': (_) => const SecuritiesTradingScreen(),
          '/security-hardening': (_) => const SecurityHardeningScreen(),
          '/seed-registry': (_) => const SeedRegistryScreen(),
          '/self-service-txns': (_) => const SelfServiceTxnsScreen(),
          '/service-catalog': (_) => const ServiceCatalogScreen(),
          '/service-health': (_) => const ServiceHealthScreen(),
          '/signature-verification': (_) => const SignatureVerificationScreen(),
          '/sms-email-gateway': (_) => const SmsEmailGatewayScreen(),
          '/staff-management': (_) => const StaffManagementScreen(),
          '/standing-charges': (_) => const StandingChargesScreen(),
          '/standing-instructions': (_) => const StandingInstructionsScreen(),
          '/standing-orders': (_) => const StandingOrdersScreen(),
          '/statement-generator': (_) => const StatementGeneratorScreen(),
          '/statement-history': (_) => const StatementHistoryScreen(),
          '/stress-testing': (_) => const StressTestingScreen(),
          '/sukuk-management': (_) => const SukukManagementScreen(),
          '/supply-chain-finance': (_) => const SupplyChainFinanceScreen(),
          '/swift-messaging': (_) => const SwiftMessagingScreen(),
          '/syndicated-loans': (_) => const SyndicatedLoansScreen(),
          '/takaful-management': (_) => const TakafulManagementScreen(),
          '/teller': (_) => const TellerScreen(),
          '/temporal-sagas': (_) => const TemporalSagasScreen(),
          '/tenant-isolation': (_) => const TenantIsolationScreen(),
          '/tenant-metering': (_) => const TenantMeteringScreen(),
          '/tenant-provisioning': (_) => const TenantProvisioningScreen(),
          '/tigerbeetle-ledger': (_) => const TigerbeetleLedgerScreen(),
          '/trade-finance': (_) => const TradeFinanceScreen(),
          '/treasury-investments': (_) => const TreasuryInvestmentsScreen(),
          '/treasury-liquidity': (_) => const TreasuryLiquidityScreen(),
          '/treasury': (_) => const TreasuryScreen(),
          '/trust-estate': (_) => const TrustEstateScreen(),
          '/utility-payments': (_) => const UtilityPaymentsScreen(),
          '/virtual-accounts': (_) => const VirtualAccountsScreen(),
          '/wakala-investment': (_) => const WakalaInvestmentScreen(),
          '/watchlist': (_) => const WatchlistScreen(),
          '/wealth-mgmt': (_) => const WealthMgmtScreen(),
          '/webhook-deliveries': (_) => const WebhookDeliveriesScreen(),
          '/webhook-engine': (_) => const WebhookEngineScreen(),
          '/webhook-subscriptions': (_) => const WebhookSubscriptionsScreen(),
          '/white-label-config': (_) => const WhiteLabelConfigScreen(),
          '/workflow-definitions': (_) => const WorkflowDefinitionsScreen(),
          '/workflow-engine': (_) => const WorkflowEngineScreen(),
          '/workflow-instances': (_) => const WorkflowInstancesScreen(),
        },
      ),
    );
  }
}

class BankDrawer extends StatelessWidget {
  const BankDrawer({super.key});

  @override
  Widget build(BuildContext context) {
    return Drawer(
      child: SafeArea(
        child: ListView(padding: EdgeInsets.zero, children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [Color(0xFF0F766E), Color(0xFF0D9488)]),
            ),
            child: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('54Bank', style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
              SizedBox(height: 4),
              Text('Banking Platform', style: TextStyle(color: Colors.white70, fontSize: 14)),
            ]),
          ),
          ListTile(leading: const Icon(Icons.home), title: const Text('Home'),
            onTap: () { Navigator.pop(context); Navigator.pushNamedAndRemoveUntil(context, '/', (r) => false); }),
          ListTile(leading: const Icon(Icons.people), title: const Text('Customers'),
            onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/customers'); }),
          ListTile(leading: const Icon(Icons.swap_horiz), title: const Text('Transfers'),
            onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/transfers'); }),
          ListTile(leading: const Icon(Icons.account_balance), title: const Text('Loans'),
            onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/loans'); }),
          ListTile(leading: const Icon(Icons.credit_card), title: const Text('Cards'),
            onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/cards'); }),
          ListTile(leading: const Icon(Icons.settings), title: const Text('Settings'),
            onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/settings'); }),
          const Divider(),
            ListTile(dense: true, title: Text('Account Opening'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/account-opening'); }),
            ListTile(dense: true, title: Text('Account Statements'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/account-statements'); }),
            ListTile(dense: true, title: Text('Accounting Rules'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/accounting-rules'); }),
            ListTile(dense: true, title: Text('Admin Dashboard'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/admin-dashboard'); }),
            ListTile(dense: true, title: Text('Agent Banking'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/agent-banking'); }),
            ListTile(dense: true, title: Text('Agent Performance'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/agent-performance'); }),
            ListTile(dense: true, title: Text('Agricultural Insurance'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/agricultural-insurance'); }),
            ListTile(dense: true, title: Text('Ai Fraud Detection'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/ai-fraud-detection'); }),
            ListTile(dense: true, title: Text('Analytics Widgets'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/analytics-widgets'); }),
            ListTile(dense: true, title: Text('Api Marketplace'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/api-marketplace'); }),
            ListTile(dense: true, title: Text('Approval Workflow'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/approval-workflow'); }),
            ListTile(dense: true, title: Text('Atm Management'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/atm-management'); }),
            ListTile(dense: true, title: Text('Audit Trail'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/audit-trail'); }),
            ListTile(dense: true, title: Text('Bank Guarantees'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/bank-guarantees'); }),
            ListTile(dense: true, title: Text('Basel Engine'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/basel-engine'); }),
            ListTile(dense: true, title: Text('Batch Eod'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/batch-eod'); }),
            ListTile(dense: true, title: Text('Batch Processing'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/batch-processing'); }),
            ListTile(dense: true, title: Text('Beneficiary Mgmt'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/beneficiary-mgmt'); }),
            ListTile(dense: true, title: Text('Billing Engine'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/billing-engine'); }),
            ListTile(dense: true, title: Text('Billing Event Processor'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/billing-event-processor'); }),
            ListTile(dense: true, title: Text('Billing Orchestrator'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/billing-orchestrator'); }),
            ListTile(dense: true, title: Text('Billing Rbac'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/billing-rbac'); }),
            ListTile(dense: true, title: Text('Biometric Auth'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/biometric-auth'); }),
            ListTile(dense: true, title: Text('Branch Operations'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/branch-operations'); }),
            ListTile(dense: true, title: Text('Branded Comms'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/branded-comms'); }),
            ListTile(dense: true, title: Text('Bulk Payments'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/bulk-payments'); }),
            ListTile(dense: true, title: Text('Card Fraud Rules'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/card-fraud-rules'); }),
            ListTile(dense: true, title: Text('Card Management'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/card-management'); }),
            ListTile(dense: true, title: Text('Card Tokens'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/card-tokens'); }),
            ListTile(dense: true, title: Text('Cash Management'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/cash-management'); }),
            ListTile(dense: true, title: Text('Cash Pooling'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/cash-pooling'); }),
            ListTile(dense: true, title: Text('Cbn Returns'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/cbn-returns'); }),
            ListTile(dense: true, title: Text('Channel Management'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/channel-management'); }),
            ListTile(dense: true, title: Text('Chart Of Accounts'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/chart-of-accounts'); }),
            ListTile(dense: true, title: Text('Chatbot'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/chatbot'); }),
            ListTile(dense: true, title: Text('Cheque Clearing'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/cheque-clearing'); }),
            ListTile(dense: true, title: Text('Cheque Imaging'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/cheque-imaging'); }),
            ListTile(dense: true, title: Text('Cif Management'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/cif-management'); }),
            ListTile(dense: true, title: Text('Collateral'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/collateral'); }),
            ListTile(dense: true, title: Text('Collateral Valuation'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/collateral-valuation'); }),
            ListTile(dense: true, title: Text('Complaints'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/complaints'); }),
            ListTile(dense: true, title: Text('Compliance Checks'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/compliance-checks'); }),
            ListTile(dense: true, title: Text('Component Showcase'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/component-showcase'); }),
            ListTile(dense: true, title: Text('Contingent Liabilities'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/contingent-liabilities'); }),
            ListTile(dense: true, title: Text('Correspondent Banking'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/correspondent-banking'); }),
            ListTile(dense: true, title: Text('Credit Bureau'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/credit-bureau'); }),
            ListTile(dense: true, title: Text('Credit Facilities'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/credit-facilities'); }),
            ListTile(dense: true, title: Text('Credit Risk'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/credit-risk'); }),
            ListTile(dense: true, title: Text('Custody Service'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/custody-service'); }),
            ListTile(dense: true, title: Text('Custom Domain'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/custom-domain'); }),
            ListTile(dense: true, title: Text('Customer 360'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/customer-360'); }),
            ListTile(dense: true, title: Text('Customer Bills'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/customer-bills'); }),
            ListTile(dense: true, title: Text('Customer Cards'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/customer-cards'); }),
            ListTile(dense: true, title: Text('Customer Dashboard'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/customer-dashboard'); }),
            ListTile(dense: true, title: Text('Customer Engagement'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/customer-engagement'); }),
            ListTile(dense: true, title: Text('Customer Feedback'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/customer-feedback'); }),
            ListTile(dense: true, title: Text('Customer Insights'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/customer-insights'); }),
            ListTile(dense: true, title: Text('Customer Loans'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/customer-loans'); }),
            ListTile(dense: true, title: Text('Customer Notifications'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/customer-notifications'); }),
            ListTile(dense: true, title: Text('Customer Onboarding'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/customer-onboarding'); }),
            ListTile(dense: true, title: Text('Customer Qr'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/customer-qr'); }),
            ListTile(dense: true, title: Text('Customer Savings'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/customer-savings'); }),
            ListTile(dense: true, title: Text('Customer Segments'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/customer-segments'); }),
            ListTile(dense: true, title: Text('Customer Settings'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/customer-settings'); }),
            ListTile(dense: true, title: Text('Customer Statements'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/customer-statements'); }),
            ListTile(dense: true, title: Text('Customer Transfers'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/customer-transfers'); }),
            ListTile(dense: true, title: Text('Dapr Sidecar'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/dapr-sidecar'); }),
            ListTile(dense: true, title: Text('Data Export'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/data-export'); }),
            ListTile(dense: true, title: Text('Database Persistence'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/database-persistence'); }),
            ListTile(dense: true, title: Text('Db Admin'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/db-admin'); }),
            ListTile(dense: true, title: Text('Ddos Protection'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/ddos-protection'); }),
            ListTile(dense: true, title: Text('Diaspora Banking'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/diaspora-banking'); }),
            ListTile(dense: true, title: Text('Disaster Recovery'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/disaster-recovery'); }),
            ListTile(dense: true, title: Text('Dispute Management'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/dispute-management'); }),
            ListTile(dense: true, title: Text('Doc Collections'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/doc-collections'); }),
            ListTile(dense: true, title: Text('Document Management'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/document-management'); }),
            ListTile(dense: true, title: Text('Dormancy Mgmt'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/dormancy-mgmt'); }),
            ListTile(dense: true, title: Text('E2E Tests'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/e2e-tests'); }),
            ListTile(dense: true, title: Text('Education Loans'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/education-loans'); }),
            ListTile(dense: true, title: Text('Embedded Finance'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/embedded-finance'); }),
            ListTile(dense: true, title: Text('Enaira Cbdc'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/enaira-cbdc'); }),
            ListTile(dense: true, title: Text('Eod Processor'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/eod-processor'); }),
            ListTile(dense: true, title: Text('Erp Next'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/erp-next'); }),
            ListTile(dense: true, title: Text('Escrow'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/escrow'); }),
            ListTile(dense: true, title: Text('Esg Banking'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/esg-banking'); }),
            ListTile(dense: true, title: Text('Esusu'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/esusu'); }),
            ListTile(dense: true, title: Text('Etd Trading'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/etd-trading'); }),
            ListTile(dense: true, title: Text('Etl Pipelines'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/etl-pipelines'); }),
            ListTile(dense: true, title: Text('Event Bus'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/event-bus'); }),
            ListTile(dense: true, title: Text('Event Streaming'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/event-streaming'); }),
            ListTile(dense: true, title: Text('Exam Management'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/exam-management'); }),
            ListTile(dense: true, title: Text('Expense Mgmt'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/expense-mgmt'); }),
            ListTile(dense: true, title: Text('Face Match'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/face-match'); }),
            ListTile(dense: true, title: Text('Factoring'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/factoring'); }),
            ListTile(dense: true, title: Text('Fatca Crs'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/fatca-crs'); }),
            ListTile(dense: true, title: Text('Feature Flag Engine'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/feature-flag-engine'); }),
            ListTile(dense: true, title: Text('Fee Schedules'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/fee-schedules'); }),
            ListTile(dense: true, title: Text('Fixed Assets'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/fixed-assets'); }),
            ListTile(dense: true, title: Text('Fixed Deposits'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/fixed-deposits'); }),
            ListTile(dense: true, title: Text('Fluvio Streams'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/fluvio-streams'); }),
            ListTile(dense: true, title: Text('Fraud Alerts'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/fraud-alerts'); }),
            ListTile(dense: true, title: Text('Fraud Detection'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/fraud-detection'); }),
            ListTile(dense: true, title: Text('Fraud Rules'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/fraud-rules'); }),
            ListTile(dense: true, title: Text('Fx Dealing Room'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/fx-dealing-room'); }),
            ListTile(dense: true, title: Text('Fx Positions'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/fx-positions'); }),
            ListTile(dense: true, title: Text('Fx Rates'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/fx-rates'); }),
            ListTile(dense: true, title: Text('Fx Revaluation'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/fx-revaluation'); }),
            ListTile(dense: true, title: Text('Gl Accounts'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/gl-accounts'); }),
            ListTile(dense: true, title: Text('Gl Engine'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/gl-engine'); }),
            ListTile(dense: true, title: Text('Graduated Rollout'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/graduated-rollout'); }),
            ListTile(dense: true, title: Text('Identity Channels'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/identity-channels'); }),
            ListTile(dense: true, title: Text('Ifrs9 Engine'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/ifrs9-engine'); }),
            ListTile(dense: true, title: Text('Infra Kafka'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/infra-kafka'); }),
            ListTile(dense: true, title: Text('Infra Lakehouse'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/infra-lakehouse'); }),
            ListTile(dense: true, title: Text('Infra Opensearch'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/infra-opensearch'); }),
            ListTile(dense: true, title: Text('Infra Postgres'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/infra-postgres'); }),
            ListTile(dense: true, title: Text('Infra Redis'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/infra-redis'); }),
            ListTile(dense: true, title: Text('Infra Temporal'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/infra-temporal'); }),
            ListTile(dense: true, title: Text('Infra Tigerbeetle'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/infra-tigerbeetle'); }),
            ListTile(dense: true, title: Text('Insurance'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/insurance'); }),
            ListTile(dense: true, title: Text('Integration Tests'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/integration-tests'); }),
            ListTile(dense: true, title: Text('Interbank Lending'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/interbank-lending'); }),
            ListTile(dense: true, title: Text('Interbank Settlement'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/interbank-settlement'); }),
            ListTile(dense: true, title: Text('Interest Accrual'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/interest-accrual'); }),
            ListTile(dense: true, title: Text('Interest Rate'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/interest-rate'); }),
            ListTile(dense: true, title: Text('Inventory Finance'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/inventory-finance'); }),
            ListTile(dense: true, title: Text('Islamic Banking'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/islamic-banking'); }),
            ListTile(dense: true, title: Text('Iso20022 Hub'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/iso20022-hub'); }),
            ListTile(dense: true, title: Text('Journal Entries'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/journal-entries'); }),
            ListTile(dense: true, title: Text('Jwt Auth'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/jwt-auth'); }),
            ListTile(dense: true, title: Text('Kafka Event Bus'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/kafka-event-bus'); }),
            ListTile(dense: true, title: Text('Kafka Streaming'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/kafka-streaming'); }),
            ListTile(dense: true, title: Text('Keycloak'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/keycloak'); }),
            ListTile(dense: true, title: Text('Kyb Engine'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/kyb-engine'); }),
            ListTile(dense: true, title: Text('Kyb Triggers'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/kyb-triggers'); }),
            ListTile(dense: true, title: Text('Kyc Aml'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/kyc-aml'); }),
            ListTile(dense: true, title: Text('Kyc Engine'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/kyc-engine'); }),
            ListTile(dense: true, title: Text('Kyc Event Rules'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/kyc-event-rules'); }),
            ListTile(dense: true, title: Text('Kyc Overrides'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/kyc-overrides'); }),
            ListTile(dense: true, title: Text('Kyc Service Gates'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/kyc-service-gates'); }),
            ListTile(dense: true, title: Text('Kyc Triggers'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/kyc-triggers'); }),
            ListTile(dense: true, title: Text('Lakehouse'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/lakehouse'); }),
            ListTile(dense: true, title: Text('Lc Amendments'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/lc-amendments'); }),
            ListTile(dense: true, title: Text('Lcr Nsfr'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/lcr-nsfr'); }),
            ListTile(dense: true, title: Text('Leasing'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/leasing'); }),
            ListTile(dense: true, title: Text('Ledger Sync'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/ledger-sync'); }),
            ListTile(dense: true, title: Text('Limit Management'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/limit-management'); }),
            ListTile(dense: true, title: Text('Liveness Detection'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/liveness-detection'); }),
            ListTile(dense: true, title: Text('Load Testing'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/load-testing'); }),
            ListTile(dense: true, title: Text('Loan Accounts'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/loan-accounts'); }),
            ListTile(dense: true, title: Text('Loan Calculator'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/loan-calculator'); }),
            ListTile(dense: true, title: Text('Loan Origination'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/loan-origination'); }),
            ListTile(dense: true, title: Text('Loan Products'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/loan-products'); }),
            ListTile(dense: true, title: Text('Locker'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/locker'); }),
            ListTile(dense: true, title: Text('Maker Checker'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/maker-checker'); }),
            ListTile(dense: true, title: Text('Mandate Management'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/mandate-management'); }),
            ListTile(dense: true, title: Text('Messaging Gateway'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/messaging-gateway'); }),
            ListTile(dense: true, title: Text('Microfinance Engine'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/microfinance-engine'); }),
            ListTile(dense: true, title: Text('Microfinance'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/microfinance'); }),
            ListTile(dense: true, title: Text('Mojaloop'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/mojaloop'); }),
            ListTile(dense: true, title: Text('Money Market'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/money-market'); }),
            ListTile(dense: true, title: Text('Mortgage'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/mortgage'); }),
            ListTile(dense: true, title: Text('Multi Currency Fx'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/multi-currency-fx'); }),
            ListTile(dense: true, title: Text('Multi Entity'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/multi-entity'); }),
            ListTile(dense: true, title: Text('Murabaha Calculator'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/murabaha-calculator'); }),
            ListTile(dense: true, title: Text('Nibss Direct Debit'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/nibss-direct-debit'); }),
            ListTile(dense: true, title: Text('Notification Center'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/notification-center'); }),
            ListTile(dense: true, title: Text('Notification Prefs'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/notification-prefs'); }),
            ListTile(dense: true, title: Text('Notifications Engine'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/notifications-engine'); }),
            ListTile(dense: true, title: Text('Offline Resilience'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/offline-resilience'); }),
            ListTile(dense: true, title: Text('Open Banking'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/open-banking'); }),
            ListTile(dense: true, title: Text('Opensearch'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/opensearch'); }),
            ListTile(dense: true, title: Text('Operations Center'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/operations-center'); }),
            ListTile(dense: true, title: Text('Otc Derivatives'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/otc-derivatives'); }),
            ListTile(dense: true, title: Text('Partner Onboarding Admin'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/partner-onboarding-admin'); }),
            ListTile(dense: true, title: Text('Partner Onboarding Portal'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/partner-onboarding-portal'); }),
            ListTile(dense: true, title: Text('Payment Investigation'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/payment-investigation'); }),
            ListTile(dense: true, title: Text('Payment Transactions'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/payment-transactions'); }),
            ListTile(dense: true, title: Text('Payments Hub'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/payments-hub'); }),
            ListTile(dense: true, title: Text('Pbac Engine'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/pbac-engine'); }),
            ListTile(dense: true, title: Text('Pension'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/pension'); }),
            ListTile(dense: true, title: Text('Pep Database'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/pep-database'); }),
            ListTile(dense: true, title: Text('Permify'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/permify'); }),
            ListTile(dense: true, title: Text('Plugin Marketplace'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/plugin-marketplace'); }),
            ListTile(dense: true, title: Text('Portfolio Mgmt'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/portfolio-mgmt'); }),
            ListTile(dense: true, title: Text('Pos Terminal'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/pos-terminal'); }),
            ListTile(dense: true, title: Text('Pricing Model'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/pricing-model'); }),
            ListTile(dense: true, title: Text('Product Catalog'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/product-catalog'); }),
            ListTile(dense: true, title: Text('Project Finance'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/project-finance'); }),
            ListTile(dense: true, title: Text('Qr Payments'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/qr-payments'); }),
            ListTile(dense: true, title: Text('Rate Cascade'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/rate-cascade'); }),
            ListTile(dense: true, title: Text('Rate Limiting'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/rate-limiting'); }),
            ListTile(dense: true, title: Text('Reconciliation'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/reconciliation'); }),
            ListTile(dense: true, title: Text('Regulatory Automation'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/regulatory-automation'); }),
            ListTile(dense: true, title: Text('Regulatory Calendar'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/regulatory-calendar'); }),
            ListTile(dense: true, title: Text('Regulatory Reporting'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/regulatory-reporting'); }),
            ListTile(dense: true, title: Text('Relationship Pricing'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/relationship-pricing'); }),
            ListTile(dense: true, title: Text('Remittance'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/remittance'); }),
            ListTile(dense: true, title: Text('Report Generation'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/report-generation'); }),
            ListTile(dense: true, title: Text('Reporting'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/reporting'); }),
            ListTile(dense: true, title: Text('Risk Scoring'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/risk-scoring'); }),
            ListTile(dense: true, title: Text('Safe Deposit'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/safe-deposit'); }),
            ListTile(dense: true, title: Text('Salary Processing'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/salary-processing'); }),
            ListTile(dense: true, title: Text('Sar Reports'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/sar-reports'); }),
            ListTile(dense: true, title: Text('Savings Products'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/savings-products'); }),
            ListTile(dense: true, title: Text('Securities Trading'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/securities-trading'); }),
            ListTile(dense: true, title: Text('Security Hardening'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/security-hardening'); }),
            ListTile(dense: true, title: Text('Seed Registry'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/seed-registry'); }),
            ListTile(dense: true, title: Text('Self Service Txns'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/self-service-txns'); }),
            ListTile(dense: true, title: Text('Service Catalog'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/service-catalog'); }),
            ListTile(dense: true, title: Text('Service Health'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/service-health'); }),
            ListTile(dense: true, title: Text('Signature Verification'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/signature-verification'); }),
            ListTile(dense: true, title: Text('Sms Email Gateway'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/sms-email-gateway'); }),
            ListTile(dense: true, title: Text('Staff Management'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/staff-management'); }),
            ListTile(dense: true, title: Text('Standing Charges'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/standing-charges'); }),
            ListTile(dense: true, title: Text('Standing Instructions'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/standing-instructions'); }),
            ListTile(dense: true, title: Text('Standing Orders'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/standing-orders'); }),
            ListTile(dense: true, title: Text('Statement Generator'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/statement-generator'); }),
            ListTile(dense: true, title: Text('Statement History'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/statement-history'); }),
            ListTile(dense: true, title: Text('Stress Testing'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/stress-testing'); }),
            ListTile(dense: true, title: Text('Sukuk Management'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/sukuk-management'); }),
            ListTile(dense: true, title: Text('Supply Chain Finance'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/supply-chain-finance'); }),
            ListTile(dense: true, title: Text('Swift Messaging'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/swift-messaging'); }),
            ListTile(dense: true, title: Text('Syndicated Loans'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/syndicated-loans'); }),
            ListTile(dense: true, title: Text('Takaful Management'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/takaful-management'); }),
            ListTile(dense: true, title: Text('Teller'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/teller'); }),
            ListTile(dense: true, title: Text('Temporal Sagas'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/temporal-sagas'); }),
            ListTile(dense: true, title: Text('Tenant Isolation'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/tenant-isolation'); }),
            ListTile(dense: true, title: Text('Tenant Metering'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/tenant-metering'); }),
            ListTile(dense: true, title: Text('Tenant Provisioning'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/tenant-provisioning'); }),
            ListTile(dense: true, title: Text('Tigerbeetle Ledger'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/tigerbeetle-ledger'); }),
            ListTile(dense: true, title: Text('Trade Finance'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/trade-finance'); }),
            ListTile(dense: true, title: Text('Treasury Investments'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/treasury-investments'); }),
            ListTile(dense: true, title: Text('Treasury Liquidity'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/treasury-liquidity'); }),
            ListTile(dense: true, title: Text('Treasury'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/treasury'); }),
            ListTile(dense: true, title: Text('Trust Estate'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/trust-estate'); }),
            ListTile(dense: true, title: Text('Utility Payments'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/utility-payments'); }),
            ListTile(dense: true, title: Text('Virtual Accounts'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/virtual-accounts'); }),
            ListTile(dense: true, title: Text('Wakala Investment'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/wakala-investment'); }),
            ListTile(dense: true, title: Text('Watchlist'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/watchlist'); }),
            ListTile(dense: true, title: Text('Wealth Mgmt'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/wealth-mgmt'); }),
            ListTile(dense: true, title: Text('Webhook Deliveries'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/webhook-deliveries'); }),
            ListTile(dense: true, title: Text('Webhook Engine'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/webhook-engine'); }),
            ListTile(dense: true, title: Text('Webhook Subscriptions'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/webhook-subscriptions'); }),
            ListTile(dense: true, title: Text('White Label Config'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/white-label-config'); }),
            ListTile(dense: true, title: Text('Workflow Definitions'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/workflow-definitions'); }),
            ListTile(dense: true, title: Text('Workflow Engine'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/workflow-engine'); }),
            ListTile(dense: true, title: Text('Workflow Instances'), onTap: () { Navigator.pop(context); Navigator.pushNamed(context, '/workflow-instances'); }),
        ]),
      ),
    );
  }
}
