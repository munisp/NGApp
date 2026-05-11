import 'package:flutter/material.dart';
import 'services/api_service.dart';
import 'services/cache_service.dart';
import 'widgets/api_list_screen.dart';
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
import 'screens/apisix_plugins_screen.dart';
import 'screens/apisix_routes_screen.dart';
import 'screens/apisix_upstreams_screen.dart';
import 'screens/approval_workflow_screen.dart';
import 'screens/atm_management_screen.dart';
import 'screens/audit_trail_screen.dart';
import 'screens/bandwidth_adaptation_screen.dart';
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
import 'screens/cards_screen.dart';
import 'screens/cash_management_screen.dart';
import 'screens/cash_pooling_screen.dart';
import 'screens/cbn_returns_screen.dart';
import 'screens/channel_management_screen.dart';
import 'screens/chart_of_accounts_screen.dart';
import 'screens/chatbot_screen.dart';
import 'screens/cheque_clearing_screen.dart';
import 'screens/cheque_imaging_screen.dart';
import 'screens/cif_management_screen.dart';
import 'screens/circuit_breaker_dashboard_screen.dart';
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
import 'screens/customers_screen.dart';
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
import 'screens/error_catalog_screen.dart';
import 'screens/error_telemetry_screen.dart';
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
import 'screens/ha_middleware_screen.dart';
import 'screens/ha_services_screen.dart';
import 'screens/ha_zones_screen.dart';
import 'screens/home_screen.dart';
import 'screens/idempotency_dashboard_screen.dart';
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
import 'screens/inventory_screen.dart';
import 'screens/islamic_banking_screen.dart';
import 'screens/iso20022_hub_screen.dart';
import 'screens/journal_entries_screen.dart';
import 'screens/jwt_auth_screen.dart';
import 'screens/kafka_event_bus_screen.dart';
import 'screens/kafka_streaming_screen.dart';
import 'screens/keda_autoscaling_screen.dart';
import 'screens/keda_policies_screen.dart';
import 'screens/keycloak_clients_screen.dart';
import 'screens/keycloak_idps_screen.dart';
import 'screens/keycloak_realms_screen.dart';
import 'screens/keycloak_roles_screen.dart';
import 'screens/keycloak_screen.dart';
import 'screens/kyb_engine_screen.dart';
import 'screens/kyb_triggers_screen.dart';
import 'screens/kyc_aml_screen.dart';
import 'screens/kyc_engine_screen.dart';
import 'screens/kyc_event_rules_screen.dart';
import 'screens/kyc_overrides_screen.dart';
import 'screens/kyc_service_gates_screen.dart';
import 'screens/kyc_triggers_screen.dart';
import 'screens/lakehouse_cdc_events_screen.dart';
import 'screens/lakehouse_clients_screen.dart';
import 'screens/lakehouse_domain_cdc_screen.dart';
import 'screens/lakehouse_lineage_edges_screen.dart';
import 'screens/lakehouse_lineage_nodes_screen.dart';
import 'screens/lakehouse_materialized_views_screen.dart';
import 'screens/lakehouse_query_federation_screen.dart';
import 'screens/lakehouse_screen.dart';
import 'screens/lc_amendments_screen.dart';
import 'screens/lcr_nsfr_screen.dart';
import 'screens/leasing_screen.dart';
import 'screens/ledger_screen.dart';
import 'screens/ledger_sync_screen.dart';
import 'screens/limit_management_screen.dart';
import 'screens/liveness_detection_screen.dart';
import 'screens/load_testing_screen.dart';
import 'screens/loan_accounts_screen.dart';
import 'screens/loan_calculator_screen.dart';
import 'screens/loan_origination_screen.dart';
import 'screens/loan_products_screen.dart';
import 'screens/loans_screen.dart';
import 'screens/locker_screen.dart';
import 'screens/maker_checker_screen.dart';
import 'screens/mandate_management_screen.dart';
import 'screens/messaging_gateway_screen.dart';
import 'screens/microfinance_engine_screen.dart';
import 'screens/microfinance_screen.dart';
import 'screens/mojaloop_admin_limits_screen.dart';
import 'screens/mojaloop_admin_participants_screen.dart';
import 'screens/mojaloop_callback_endpoints_screen.dart';
import 'screens/mojaloop_callbacks_screen.dart';
import 'screens/mojaloop_corridors_screen.dart';
import 'screens/mojaloop_ilp_packets_screen.dart';
import 'screens/mojaloop_screen.dart';
import 'screens/mojaloop_settlement_models_screen.dart';
import 'screens/mojaloop_settlement_windows_screen.dart';
import 'screens/mojaloop_tb_bridge_configs_screen.dart';
import 'screens/mojaloop_tb_bridge_entries_screen.dart';
import 'screens/money_market_screen.dart';
import 'screens/mortgage_screen.dart';
import 'screens/multi_currency_fx_screen.dart';
import 'screens/multi_entity_screen.dart';
import 'screens/murabaha_calculator_screen.dart';
import 'screens/nibss_direct_debit_screen.dart';
import 'screens/notification_center_screen.dart';
import 'screens/notification_prefs_screen.dart';
import 'screens/notifications_engine_screen.dart';
import 'screens/notifications_screen.dart';
import 'screens/offline_resilience_screen.dart';
import 'screens/offline_transactions_screen.dart';
import 'screens/open_banking_screen.dart';
import 'screens/openappsec_events_screen.dart';
import 'screens/openappsec_rules_screen.dart';
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
import 'screens/performance_cache_screen.dart';
import 'screens/performance_metrics_screen.dart';
import 'screens/permify_screen.dart';
import 'screens/pg_connection_pools_screen.dart';
import 'screens/pg_index_advisory_screen.dart';
import 'screens/pg_query_profiles_screen.dart';
import 'screens/pg_slow_queries_screen.dart';
import 'screens/pg_table_stats_screen.dart';
import 'screens/pg_tuning_params_screen.dart';
import 'screens/plugin_marketplace_screen.dart';
import 'screens/portfolio_mgmt_screen.dart';
import 'screens/pos_terminal_screen.dart';
import 'screens/pricing_model_screen.dart';
import 'screens/product_catalog_screen.dart';
import 'screens/product_factory_screen.dart';
import 'screens/project_finance_screen.dart';
import 'screens/qr_payments_screen.dart';
import 'screens/ransomware_protection_screen.dart';
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
import 'screens/resilience_dashboard_screen.dart';
import 'screens/retry_policies_screen.dart';
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
import 'screens/settings_screen.dart';
import 'screens/signature_verification_screen.dart';
import 'screens/sms_banking_screen.dart';
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
import 'screens/tb_pg_balance_cache_configs_screen.dart';
import 'screens/tb_pg_balance_cache_entries_screen.dart';
import 'screens/tb_pg_reconciliation_rules_screen.dart';
import 'screens/tb_pg_reconciliation_runs_screen.dart';
import 'screens/tb_pg_saga_definitions_screen.dart';
import 'screens/tb_pg_saga_executions_screen.dart';
import 'screens/tb_pg_sync_configs_screen.dart';
import 'screens/tb_pg_sync_events_screen.dart';
import 'screens/teller_screen.dart';
import 'screens/temporal_sagas_screen.dart';
import 'screens/tenant_isolation_screen.dart';
import 'screens/tenant_metering_screen.dart';
import 'screens/tenant_provisioning_screen.dart';
import 'screens/tigerbeetle_ledger_screen.dart';
import 'screens/trade_finance_screen.dart';
import 'screens/transfers_screen.dart';
import 'screens/treasury_investments_screen.dart';
import 'screens/treasury_liquidity_screen.dart';
import 'screens/treasury_screen.dart';
import 'screens/trust_estate_screen.dart';
import 'screens/ussd_banking_screen.dart';
import 'screens/utility_payments_screen.dart';
import 'screens/virtual_accounts_screen.dart';
import 'screens/wakala_investment_screen.dart';
import 'screens/watchlist_screen.dart';
import 'screens/wealth_mgmt_screen.dart';
import 'screens/webhook_deliveries_screen.dart';
import 'screens/webhook_engine_screen.dart';
import 'screens/webhook_subscriptions_screen.dart';
import 'screens/white_label_config_screen.dart';
import 'screens/white_label_engine_screen.dart';
import 'screens/workflow_definitions_screen.dart';
import 'screens/workflow_engine_screen.dart';
import 'screens/workflow_instances_screen.dart';

void main() async { WidgetsFlutterBinding.ensureInitialized(); await CacheService().init(); runApp(const FiftyFourBankApp()); }
class FiftyFourBankApp extends StatelessWidget { const FiftyFourBankApp({super.key}); @override Widget build(BuildContext context) { return MaterialApp(title: "54Bank", theme: ThemeData(colorSchemeSeed: const Color(0xFF1B5E20), useMaterial3: true), home: const HomeScreen(), routes: {
  '/account-opening': (context) => const AccountOpeningScreen(),
  '/account-statements': (context) => const AccountStatementsScreen(),
  '/accounting-rules': (context) => const AccountingRulesScreen(),
  '/admin-dashboard': (context) => const AdminDashboardScreen(),
  '/agent-banking': (context) => const AgentBankingScreen(),
  '/agent-performance': (context) => const AgentPerformanceScreen(),
  '/agricultural-insurance': (context) => const AgriculturalInsuranceScreen(),
  '/ai-fraud-detection': (context) => const AiFraudDetectionScreen(),
  '/analytics-widgets': (context) => const AnalyticsWidgetsScreen(),
  '/api-marketplace': (context) => const ApiMarketplaceScreen(),
  '/apisix-plugins': (context) => const ApisixPluginsScreen(),
  '/apisix-routes': (context) => const ApisixRoutesScreen(),
  '/apisix-upstreams': (context) => const ApisixUpstreamsScreen(),
  '/approval-workflow': (context) => const ApprovalWorkflowScreen(),
  '/atm-management': (context) => const AtmManagementScreen(),
  '/audit-trail': (context) => const AuditTrailScreen(),
  '/bandwidth-adaptation': (context) => const BandwidthAdaptationScreen(),
  '/bank-guarantees': (context) => const BankGuaranteesScreen(),
  '/basel-engine': (context) => const BaselEngineScreen(),
  '/batch-eod': (context) => const BatchEodScreen(),
  '/batch-processing': (context) => const BatchProcessingScreen(),
  '/beneficiary-mgmt': (context) => const BeneficiaryMgmtScreen(),
  '/billing-engine': (context) => const BillingEngineScreen(),
  '/billing-event-processor': (context) => const BillingEventProcessorScreen(),
  '/billing-orchestrator': (context) => const BillingOrchestratorScreen(),
  '/billing-rbac': (context) => const BillingRbacScreen(),
  '/biometric-auth': (context) => const BiometricAuthScreen(),
  '/branch-operations': (context) => const BranchOperationsScreen(),
  '/branded-comms': (context) => const BrandedCommsScreen(),
  '/bulk-payments': (context) => const BulkPaymentsScreen(),
  '/card-fraud-rules': (context) => const CardFraudRulesScreen(),
  '/card-management': (context) => const CardManagementScreen(),
  '/card-tokens': (context) => const CardTokensScreen(),
  '/cards': (context) => const CardsScreen(),
  '/cash-management': (context) => const CashManagementScreen(),
  '/cash-pooling': (context) => const CashPoolingScreen(),
  '/cbn-returns': (context) => const CbnReturnsScreen(),
  '/channel-management': (context) => const ChannelManagementScreen(),
  '/chart-of-accounts': (context) => const ChartOfAccountsScreen(),
  '/chatbot': (context) => const ChatbotScreen(),
  '/cheque-clearing': (context) => const ChequeClearingScreen(),
  '/cheque-imaging': (context) => const ChequeImagingScreen(),
  '/cif-management': (context) => const CifManagementScreen(),
  '/circuit-breaker-dashboard': (context) => const CircuitBreakerDashboardScreen(),
  '/collateral': (context) => const CollateralScreen(),
  '/collateral-valuation': (context) => const CollateralValuationScreen(),
  '/complaints': (context) => const ComplaintsScreen(),
  '/compliance-checks': (context) => const ComplianceChecksScreen(),
  '/component-showcase': (context) => const ComponentShowcaseScreen(),
  '/contingent-liabilities': (context) => const ContingentLiabilitiesScreen(),
  '/correspondent-banking': (context) => const CorrespondentBankingScreen(),
  '/credit-bureau': (context) => const CreditBureauScreen(),
  '/credit-facilities': (context) => const CreditFacilitiesScreen(),
  '/credit-risk': (context) => const CreditRiskScreen(),
  '/custody-service': (context) => const CustodyServiceScreen(),
  '/custom-domain': (context) => const CustomDomainScreen(),
  '/customer-360': (context) => const Customer360Screen(),
  '/customer-bills': (context) => const CustomerBillsScreen(),
  '/customer-cards': (context) => const CustomerCardsScreen(),
  '/customer-dashboard': (context) => const CustomerDashboardScreen(),
  '/customer-engagement': (context) => const CustomerEngagementScreen(),
  '/customer-feedback': (context) => const CustomerFeedbackScreen(),
  '/customer-insights': (context) => const CustomerInsightsScreen(),
  '/customer-loans': (context) => const CustomerLoansScreen(),
  '/customer-notifications': (context) => const CustomerNotificationsScreen(),
  '/customer-onboarding': (context) => const CustomerOnboardingScreen(),
  '/customer-qr': (context) => const CustomerQrScreen(),
  '/customer-savings': (context) => const CustomerSavingsScreen(),
  '/customer-segments': (context) => const CustomerSegmentsScreen(),
  '/customer-settings': (context) => const CustomerSettingsScreen(),
  '/customer-statements': (context) => const CustomerStatementsScreen(),
  '/customer-transfers': (context) => const CustomerTransfersScreen(),
  '/customers': (context) => const CustomersScreen(),
  '/dapr-sidecar': (context) => const DaprSidecarScreen(),
  '/data-export': (context) => const DataExportScreen(),
  '/database-persistence': (context) => const DatabasePersistenceScreen(),
  '/db-admin': (context) => const DbAdminScreen(),
  '/ddos-protection': (context) => const DdosProtectionScreen(),
  '/diaspora-banking': (context) => const DiasporaBankingScreen(),
  '/disaster-recovery': (context) => const DisasterRecoveryScreen(),
  '/dispute-management': (context) => const DisputeManagementScreen(),
  '/doc-collections': (context) => const DocCollectionsScreen(),
  '/document-management': (context) => const DocumentManagementScreen(),
  '/dormancy-mgmt': (context) => const DormancyMgmtScreen(),
  '/e2e-tests': (context) => const E2eTestsScreen(),
  '/education-loans': (context) => const EducationLoansScreen(),
  '/embedded-finance': (context) => const EmbeddedFinanceScreen(),
  '/enaira-cbdc': (context) => const EnairaCbdcScreen(),
  '/eod-processor': (context) => const EodProcessorScreen(),
  '/erp-next': (context) => const ErpNextScreen(),
  '/error-catalog': (context) => const ErrorCatalogScreen(),
  '/error-telemetry': (context) => const ErrorTelemetryScreen(),
  '/escrow': (context) => const EscrowScreen(),
  '/esg-banking': (context) => const EsgBankingScreen(),
  '/esusu': (context) => const EsusuScreen(),
  '/etd-trading': (context) => const EtdTradingScreen(),
  '/etl-pipelines': (context) => const EtlPipelinesScreen(),
  '/event-bus': (context) => const EventBusScreen(),
  '/event-streaming': (context) => const EventStreamingScreen(),
  '/exam-management': (context) => const ExamManagementScreen(),
  '/expense-mgmt': (context) => const ExpenseMgmtScreen(),
  '/face-match': (context) => const FaceMatchScreen(),
  '/factoring': (context) => const FactoringScreen(),
  '/fatca-crs': (context) => const FatcaCrsScreen(),
  '/feature-flag-engine': (context) => const FeatureFlagEngineScreen(),
  '/fee-schedules': (context) => const FeeSchedulesScreen(),
  '/fixed-assets': (context) => const FixedAssetsScreen(),
  '/fixed-deposits': (context) => const FixedDepositsScreen(),
  '/fluvio-streams': (context) => const FluvioStreamsScreen(),
  '/fraud-alerts': (context) => const FraudAlertsScreen(),
  '/fraud-detection': (context) => const FraudDetectionScreen(),
  '/fraud-rules': (context) => const FraudRulesScreen(),
  '/fx-dealing-room': (context) => const FxDealingRoomScreen(),
  '/fx-positions': (context) => const FxPositionsScreen(),
  '/fx-rates': (context) => const FxRatesScreen(),
  '/fx-revaluation': (context) => const FxRevaluationScreen(),
  '/gl-accounts': (context) => const GlAccountsScreen(),
  '/gl-engine': (context) => const GlEngineScreen(),
  '/graduated-rollout': (context) => const GraduatedRolloutScreen(),
  '/ha-middleware': (context) => const HAMiddlewareScreen(),
  '/ha-services': (context) => const HAServicesScreen(),
  '/ha-zones': (context) => const HAZonesScreen(),
  '/home': (context) => const HomeScreen(),
  '/idempotency-dashboard': (context) => const IdempotencyDashboardScreen(),
  '/identity-channels': (context) => const IdentityChannelsScreen(),
  '/ifrs9-engine': (context) => const Ifrs9EngineScreen(),
  '/infra-kafka': (context) => const InfraKafkaScreen(),
  '/infra-lakehouse': (context) => const InfraLakehouseScreen(),
  '/infra-opensearch': (context) => const InfraOpensearchScreen(),
  '/infra-postgres': (context) => const InfraPostgresScreen(),
  '/infra-redis': (context) => const InfraRedisScreen(),
  '/infra-temporal': (context) => const InfraTemporalScreen(),
  '/infra-tigerbeetle': (context) => const InfraTigerbeetleScreen(),
  '/insurance': (context) => const InsuranceScreen(),
  '/integration-tests': (context) => const IntegrationTestsScreen(),
  '/interbank-lending': (context) => const InterbankLendingScreen(),
  '/interbank-settlement': (context) => const InterbankSettlementScreen(),
  '/interest-accrual': (context) => const InterestAccrualScreen(),
  '/interest-rate': (context) => const InterestRateScreen(),
  '/inventory-finance': (context) => const InventoryFinanceScreen(),
  '/inventory': (context) => const InventoryScreen(),
  '/islamic-banking': (context) => const IslamicBankingScreen(),
  '/iso20022-hub': (context) => const Iso20022HubScreen(),
  '/journal-entries': (context) => const JournalEntriesScreen(),
  '/jwt-auth': (context) => const JwtAuthScreen(),
  '/kafka-event-bus': (context) => const KafkaEventBusScreen(),
  '/kafka-streaming': (context) => const KafkaStreamingScreen(),
  '/keda-autoscaling': (context) => const KedaAutoscalingScreen(),
  '/keda-policies': (context) => const KedaPoliciesScreen(),
  '/keycloak-clients': (context) => const KeycloakClientsScreen(),
  '/keycloak-idps': (context) => const KeycloakIdPsScreen(),
  '/keycloak-realms': (context) => const KeycloakRealmsScreen(),
  '/keycloak-roles': (context) => const KeycloakRolesScreen(),
  '/keycloak': (context) => const KeycloakScreen(),
  '/kyb-engine': (context) => const KybEngineScreen(),
  '/kyb-triggers': (context) => const KybTriggersScreen(),
  '/kyc-aml': (context) => const KycAmlScreen(),
  '/kyc-engine': (context) => const KycEngineScreen(),
  '/kyc-event-rules': (context) => const KycEventRulesScreen(),
  '/kyc-overrides': (context) => const KycOverridesScreen(),
  '/kyc-service-gates': (context) => const KycServiceGatesScreen(),
  '/kyc-triggers': (context) => const KycTriggersScreen(),
  '/lakehouse-cdc-events': (context) => const LakehouseCDCEventsScreen(),
  '/lakehouse-clients': (context) => const LakehouseClientsScreen(),
  '/lakehouse-domain-cdc': (context) => const LakehouseDomainCDCScreen(),
  '/lakehouse-lineage-edges': (context) => const LakehouseLineageEdgesScreen(),
  '/lakehouse-lineage-nodes': (context) => const LakehouseLineageNodesScreen(),
  '/lakehouse-materialized-views': (context) => const LakehouseMaterializedViewsScreen(),
  '/lakehouse-query-federation': (context) => const LakehouseQueryFederationScreen(),
  '/lakehouse': (context) => const LakehouseScreen(),
  '/lc-amendments': (context) => const LcAmendmentsScreen(),
  '/lcr-nsfr': (context) => const LcrNsfrScreen(),
  '/leasing': (context) => const LeasingScreen(),
  '/ledger': (context) => const LedgerScreen(),
  '/ledger-sync': (context) => const LedgerSyncScreen(),
  '/limit-management': (context) => const LimitManagementScreen(),
  '/liveness-detection': (context) => const LivenessDetectionScreen(),
  '/load-testing': (context) => const LoadTestingScreen(),
  '/loan-accounts': (context) => const LoanAccountsScreen(),
  '/loan-calculator': (context) => const LoanCalculatorScreen(),
  '/loan-origination': (context) => const LoanOriginationScreen(),
  '/loan-products': (context) => const LoanProductsScreen(),
  '/loans': (context) => const LoansScreen(),
  '/locker': (context) => const LockerScreen(),
  '/maker-checker': (context) => const MakerCheckerScreen(),
  '/mandate-management': (context) => const MandateManagementScreen(),
  '/messaging-gateway': (context) => const MessagingGatewayScreen(),
  '/microfinance-engine': (context) => const MicrofinanceEngineScreen(),
  '/microfinance': (context) => const MicrofinanceScreen(),
  '/mojaloop-admin-limits': (context) => const MojaloopAdminLimitsScreen(),
  '/mojaloop-admin-participants': (context) => const MojaloopAdminParticipantsScreen(),
  '/mojaloop-callback-endpoints': (context) => const MojaloopCallbackEndpointsScreen(),
  '/mojaloop-callbacks': (context) => const MojaloopCallbacksScreen(),
  '/mojaloop-corridors': (context) => const MojaloopCorridorsScreen(),
  '/mojaloop-ilp-packets': (context) => const MojaloopILPPacketsScreen(),
  '/mojaloop': (context) => const MojaloopScreen(),
  '/mojaloop-settlement-models': (context) => const MojaloopSettlementModelsScreen(),
  '/mojaloop-settlement-windows': (context) => const MojaloopSettlementWindowsScreen(),
  '/mojaloop-tb-bridge-configs': (context) => const MojaloopTBBridgeConfigsScreen(),
  '/mojaloop-tb-bridge-entries': (context) => const MojaloopTBBridgeEntriesScreen(),
  '/money-market': (context) => const MoneyMarketScreen(),
  '/mortgage': (context) => const MortgageScreen(),
  '/multi-currency-fx': (context) => const MultiCurrencyFxScreen(),
  '/multi-entity': (context) => const MultiEntityScreen(),
  '/murabaha-calculator': (context) => const MurabahaCalculatorScreen(),
  '/nibss-direct-debit': (context) => const NibssDirectDebitScreen(),
  '/notification-center': (context) => const NotificationCenterScreen(),
  '/notification-prefs': (context) => const NotificationPrefsScreen(),
  '/notifications-engine': (context) => const NotificationsEngineScreen(),
  '/notifications': (context) => const NotificationsScreen(),
  '/offline-resilience': (context) => const OfflineResilienceScreen(),
  '/offline-transactions': (context) => const OfflineTransactionsScreen(),
  '/open-banking': (context) => const OpenBankingScreen(),
  '/openappsec-events': (context) => const OpenappsecEventsScreen(),
  '/openappsec-rules': (context) => const OpenappsecRulesScreen(),
  '/opensearch': (context) => const OpensearchScreen(),
  '/operations-center': (context) => const OperationsCenterScreen(),
  '/otc-derivatives': (context) => const OtcDerivativesScreen(),
  '/partner-onboarding-admin': (context) => const PartnerOnboardingAdminScreen(),
  '/partner-onboarding-portal': (context) => const PartnerOnboardingPortalScreen(),
  '/payment-investigation': (context) => const PaymentInvestigationScreen(),
  '/payment-transactions': (context) => const PaymentTransactionsScreen(),
  '/payments-hub': (context) => const PaymentsHubScreen(),
  '/pbac-engine': (context) => const PbacEngineScreen(),
  '/pension': (context) => const PensionScreen(),
  '/pep-database': (context) => const PepDatabaseScreen(),
  '/performance-cache': (context) => const PerformanceCacheScreen(),
  '/performance-metrics': (context) => const PerformanceMetricsScreen(),
  '/permify': (context) => const PermifyScreen(),
  '/pg-connection-pools': (context) => const PgConnectionPoolsScreen(),
  '/pg-index-advisory': (context) => const PgIndexAdvisoryScreen(),
  '/pg-query-profiles': (context) => const PgQueryProfilesScreen(),
  '/pg-slow-queries': (context) => const PgSlowQueriesScreen(),
  '/pg-table-stats': (context) => const PgTableStatsScreen(),
  '/pg-tuning-params': (context) => const PgTuningParamsScreen(),
  '/plugin-marketplace': (context) => const PluginMarketplaceScreen(),
  '/portfolio-mgmt': (context) => const PortfolioMgmtScreen(),
  '/pos-terminal': (context) => const PosTerminalScreen(),
  '/pricing-model': (context) => const PricingModelScreen(),
  '/product-catalog': (context) => const ProductCatalogScreen(),
  '/product-factory': (context) => const ProductFactoryScreen(),
  '/project-finance': (context) => const ProjectFinanceScreen(),
  '/qr-payments': (context) => const QrPaymentsScreen(),
  '/ransomware-protection': (context) => const RansomwareProtectionScreen(),
  '/rate-cascade': (context) => const RateCascadeScreen(),
  '/rate-limiting': (context) => const RateLimitingScreen(),
  '/reconciliation': (context) => const ReconciliationScreen(),
  '/regulatory-automation': (context) => const RegulatoryAutomationScreen(),
  '/regulatory-calendar': (context) => const RegulatoryCalendarScreen(),
  '/regulatory-reporting': (context) => const RegulatoryReportingScreen(),
  '/relationship-pricing': (context) => const RelationshipPricingScreen(),
  '/remittance': (context) => const RemittanceScreen(),
  '/report-generation': (context) => const ReportGenerationScreen(),
  '/reporting': (context) => const ReportingScreen(),
  '/resilience-dashboard': (context) => const ResilienceDashboardScreen(),
  '/retry-policies': (context) => const RetryPoliciesScreen(),
  '/risk-scoring': (context) => const RiskScoringScreen(),
  '/safe-deposit': (context) => const SafeDepositScreen(),
  '/salary-processing': (context) => const SalaryProcessingScreen(),
  '/sar-reports': (context) => const SarReportsScreen(),
  '/savings-products': (context) => const SavingsProductsScreen(),
  '/securities-trading': (context) => const SecuritiesTradingScreen(),
  '/security-hardening': (context) => const SecurityHardeningScreen(),
  '/seed-registry': (context) => const SeedRegistryScreen(),
  '/self-service-txns': (context) => const SelfServiceTxnsScreen(),
  '/service-catalog': (context) => const ServiceCatalogScreen(),
  '/service-health': (context) => const ServiceHealthScreen(),
  '/settings': (context) => const SettingsScreen(),
  '/signature-verification': (context) => const SignatureVerificationScreen(),
  '/sms-banking': (context) => const SmsBankingScreen(),
  '/sms-email-gateway': (context) => const SmsEmailGatewayScreen(),
  '/staff-management': (context) => const StaffManagementScreen(),
  '/standing-charges': (context) => const StandingChargesScreen(),
  '/standing-instructions': (context) => const StandingInstructionsScreen(),
  '/standing-orders': (context) => const StandingOrdersScreen(),
  '/statement-generator': (context) => const StatementGeneratorScreen(),
  '/statement-history': (context) => const StatementHistoryScreen(),
  '/stress-testing': (context) => const StressTestingScreen(),
  '/sukuk-management': (context) => const SukukManagementScreen(),
  '/supply-chain-finance': (context) => const SupplyChainFinanceScreen(),
  '/swift-messaging': (context) => const SwiftMessagingScreen(),
  '/syndicated-loans': (context) => const SyndicatedLoansScreen(),
  '/takaful-management': (context) => const TakafulManagementScreen(),
  '/tb-pg-balance-cache-configs': (context) => const TBPGBalanceCacheConfigsScreen(),
  '/tb-pg-balance-cache-entries': (context) => const TBPGBalanceCacheEntriesScreen(),
  '/tb-pg-reconciliation-rules': (context) => const TBPGReconciliationRulesScreen(),
  '/tb-pg-reconciliation-runs': (context) => const TBPGReconciliationRunsScreen(),
  '/tb-pg-saga-definitions': (context) => const TBPGSagaDefinitionsScreen(),
  '/tb-pg-saga-executions': (context) => const TBPGSagaExecutionsScreen(),
  '/tb-pg-sync-configs': (context) => const TBPGSyncConfigsScreen(),
  '/tb-pg-sync-events': (context) => const TBPGSyncEventsScreen(),
  '/teller': (context) => const TellerScreen(),
  '/temporal-sagas': (context) => const TemporalSagasScreen(),
  '/tenant-isolation': (context) => const TenantIsolationScreen(),
  '/tenant-metering': (context) => const TenantMeteringScreen(),
  '/tenant-provisioning': (context) => const TenantProvisioningScreen(),
  '/tigerbeetle-ledger': (context) => const TigerbeetleLedgerScreen(),
  '/trade-finance': (context) => const TradeFinanceScreen(),
  '/transfers': (context) => const TransfersScreen(),
  '/treasury-investments': (context) => const TreasuryInvestmentsScreen(),
  '/treasury-liquidity': (context) => const TreasuryLiquidityScreen(),
  '/treasury': (context) => const TreasuryScreen(),
  '/trust-estate': (context) => const TrustEstateScreen(),
  '/ussd-banking': (context) => const UssdBankingScreen(),
  '/utility-payments': (context) => const UtilityPaymentsScreen(),
  '/virtual-accounts': (context) => const VirtualAccountsScreen(),
  '/wakala-investment': (context) => const WakalaInvestmentScreen(),
  '/watchlist': (context) => const WatchlistScreen(),
  '/wealth-mgmt': (context) => const WealthMgmtScreen(),
  '/webhook-deliveries': (context) => const WebhookDeliveriesScreen(),
  '/webhook-engine': (context) => const WebhookEngineScreen(),
  '/webhook-subscriptions': (context) => const WebhookSubscriptionsScreen(),
  '/white-label-config': (context) => const WhiteLabelConfigScreen(),
  '/white-label-engine': (context) => const WhiteLabelEngineScreen(),
  '/workflow-definitions': (context) => const WorkflowDefinitionsScreen(),
  '/workflow-engine': (context) => const WorkflowEngineScreen(),
  '/workflow-instances': (context) => const WorkflowInstancesScreen(),
}); } }
class HomeScreen extends StatelessWidget { const HomeScreen({super.key}); @override Widget build(BuildContext context) { return Scaffold(appBar: AppBar(title: const Text("54Bank")), drawer: Drawer(child: ListView(padding: EdgeInsets.zero, children: [const DrawerHeader(decoration: BoxDecoration(color: Color(0xFF1B5E20)), child: Text("54Bank", style: TextStyle(color: Colors.white, fontSize: 24))),
  ListTile(title: const Text('Account Opening'), onTap: () => Navigator.pushNamed(context, '/account-opening')),
  ListTile(title: const Text('Account Statements'), onTap: () => Navigator.pushNamed(context, '/account-statements')),
  ListTile(title: const Text('Accounting Rules'), onTap: () => Navigator.pushNamed(context, '/accounting-rules')),
  ListTile(title: const Text('Admin Dashboard'), onTap: () => Navigator.pushNamed(context, '/admin-dashboard')),
  ListTile(title: const Text('Agent Banking'), onTap: () => Navigator.pushNamed(context, '/agent-banking')),
  ListTile(title: const Text('Agent Performance'), onTap: () => Navigator.pushNamed(context, '/agent-performance')),
  ListTile(title: const Text('Agricultural Insurance'), onTap: () => Navigator.pushNamed(context, '/agricultural-insurance')),
  ListTile(title: const Text('Ai Fraud Detection'), onTap: () => Navigator.pushNamed(context, '/ai-fraud-detection')),
  ListTile(title: const Text('Analytics Widgets'), onTap: () => Navigator.pushNamed(context, '/analytics-widgets')),
  ListTile(title: const Text('Api Marketplace'), onTap: () => Navigator.pushNamed(context, '/api-marketplace')),
  ListTile(title: const Text('Apisix Plugins'), onTap: () => Navigator.pushNamed(context, '/apisix-plugins')),
  ListTile(title: const Text('Apisix Routes'), onTap: () => Navigator.pushNamed(context, '/apisix-routes')),
  ListTile(title: const Text('Apisix Upstreams'), onTap: () => Navigator.pushNamed(context, '/apisix-upstreams')),
  ListTile(title: const Text('Approval Workflow'), onTap: () => Navigator.pushNamed(context, '/approval-workflow')),
  ListTile(title: const Text('Atm Management'), onTap: () => Navigator.pushNamed(context, '/atm-management')),
  ListTile(title: const Text('Audit Trail'), onTap: () => Navigator.pushNamed(context, '/audit-trail')),
  ListTile(title: const Text('Bandwidth Adaptation'), onTap: () => Navigator.pushNamed(context, '/bandwidth-adaptation')),
  ListTile(title: const Text('Bank Guarantees'), onTap: () => Navigator.pushNamed(context, '/bank-guarantees')),
  ListTile(title: const Text('Basel Engine'), onTap: () => Navigator.pushNamed(context, '/basel-engine')),
  ListTile(title: const Text('Batch Eod'), onTap: () => Navigator.pushNamed(context, '/batch-eod')),
  ListTile(title: const Text('Batch Processing'), onTap: () => Navigator.pushNamed(context, '/batch-processing')),
  ListTile(title: const Text('Beneficiary Mgmt'), onTap: () => Navigator.pushNamed(context, '/beneficiary-mgmt')),
  ListTile(title: const Text('Billing Engine'), onTap: () => Navigator.pushNamed(context, '/billing-engine')),
  ListTile(title: const Text('Billing Event Processor'), onTap: () => Navigator.pushNamed(context, '/billing-event-processor')),
  ListTile(title: const Text('Billing Orchestrator'), onTap: () => Navigator.pushNamed(context, '/billing-orchestrator')),
  ListTile(title: const Text('Billing Rbac'), onTap: () => Navigator.pushNamed(context, '/billing-rbac')),
  ListTile(title: const Text('Biometric Auth'), onTap: () => Navigator.pushNamed(context, '/biometric-auth')),
  ListTile(title: const Text('Branch Operations'), onTap: () => Navigator.pushNamed(context, '/branch-operations')),
  ListTile(title: const Text('Branded Comms'), onTap: () => Navigator.pushNamed(context, '/branded-comms')),
  ListTile(title: const Text('Bulk Payments'), onTap: () => Navigator.pushNamed(context, '/bulk-payments')),
  ListTile(title: const Text('Card Fraud Rules'), onTap: () => Navigator.pushNamed(context, '/card-fraud-rules')),
  ListTile(title: const Text('Card Management'), onTap: () => Navigator.pushNamed(context, '/card-management')),
  ListTile(title: const Text('Card Tokens'), onTap: () => Navigator.pushNamed(context, '/card-tokens')),
  ListTile(title: const Text('Cards'), onTap: () => Navigator.pushNamed(context, '/cards')),
  ListTile(title: const Text('Cash Management'), onTap: () => Navigator.pushNamed(context, '/cash-management')),
  ListTile(title: const Text('Cash Pooling'), onTap: () => Navigator.pushNamed(context, '/cash-pooling')),
  ListTile(title: const Text('Cbn Returns'), onTap: () => Navigator.pushNamed(context, '/cbn-returns')),
  ListTile(title: const Text('Channel Management'), onTap: () => Navigator.pushNamed(context, '/channel-management')),
  ListTile(title: const Text('Chart Of Accounts'), onTap: () => Navigator.pushNamed(context, '/chart-of-accounts')),
  ListTile(title: const Text('Chatbot'), onTap: () => Navigator.pushNamed(context, '/chatbot')),
  ListTile(title: const Text('Cheque Clearing'), onTap: () => Navigator.pushNamed(context, '/cheque-clearing')),
  ListTile(title: const Text('Cheque Imaging'), onTap: () => Navigator.pushNamed(context, '/cheque-imaging')),
  ListTile(title: const Text('Cif Management'), onTap: () => Navigator.pushNamed(context, '/cif-management')),
  ListTile(title: const Text('Circuit Breaker Dashboard'), onTap: () => Navigator.pushNamed(context, '/circuit-breaker-dashboard')),
  ListTile(title: const Text('Collateral'), onTap: () => Navigator.pushNamed(context, '/collateral')),
  ListTile(title: const Text('Collateral Valuation'), onTap: () => Navigator.pushNamed(context, '/collateral-valuation')),
  ListTile(title: const Text('Complaints'), onTap: () => Navigator.pushNamed(context, '/complaints')),
  ListTile(title: const Text('Compliance Checks'), onTap: () => Navigator.pushNamed(context, '/compliance-checks')),
  ListTile(title: const Text('Component Showcase'), onTap: () => Navigator.pushNamed(context, '/component-showcase')),
  ListTile(title: const Text('Contingent Liabilities'), onTap: () => Navigator.pushNamed(context, '/contingent-liabilities')),
  ListTile(title: const Text('Correspondent Banking'), onTap: () => Navigator.pushNamed(context, '/correspondent-banking')),
  ListTile(title: const Text('Credit Bureau'), onTap: () => Navigator.pushNamed(context, '/credit-bureau')),
  ListTile(title: const Text('Credit Facilities'), onTap: () => Navigator.pushNamed(context, '/credit-facilities')),
  ListTile(title: const Text('Credit Risk'), onTap: () => Navigator.pushNamed(context, '/credit-risk')),
  ListTile(title: const Text('Custody Service'), onTap: () => Navigator.pushNamed(context, '/custody-service')),
  ListTile(title: const Text('Custom Domain'), onTap: () => Navigator.pushNamed(context, '/custom-domain')),
  ListTile(title: const Text('Customer360'), onTap: () => Navigator.pushNamed(context, '/customer-360')),
  ListTile(title: const Text('Customer Bills'), onTap: () => Navigator.pushNamed(context, '/customer-bills')),
  ListTile(title: const Text('Customer Cards'), onTap: () => Navigator.pushNamed(context, '/customer-cards')),
  ListTile(title: const Text('Customer Dashboard'), onTap: () => Navigator.pushNamed(context, '/customer-dashboard')),
  ListTile(title: const Text('Customer Engagement'), onTap: () => Navigator.pushNamed(context, '/customer-engagement')),
  ListTile(title: const Text('Customer Feedback'), onTap: () => Navigator.pushNamed(context, '/customer-feedback')),
  ListTile(title: const Text('Customer Insights'), onTap: () => Navigator.pushNamed(context, '/customer-insights')),
  ListTile(title: const Text('Customer Loans'), onTap: () => Navigator.pushNamed(context, '/customer-loans')),
  ListTile(title: const Text('Customer Notifications'), onTap: () => Navigator.pushNamed(context, '/customer-notifications')),
  ListTile(title: const Text('Customer Onboarding'), onTap: () => Navigator.pushNamed(context, '/customer-onboarding')),
  ListTile(title: const Text('Customer Qr'), onTap: () => Navigator.pushNamed(context, '/customer-qr')),
  ListTile(title: const Text('Customer Savings'), onTap: () => Navigator.pushNamed(context, '/customer-savings')),
  ListTile(title: const Text('Customer Segments'), onTap: () => Navigator.pushNamed(context, '/customer-segments')),
  ListTile(title: const Text('Customer Settings'), onTap: () => Navigator.pushNamed(context, '/customer-settings')),
  ListTile(title: const Text('Customer Statements'), onTap: () => Navigator.pushNamed(context, '/customer-statements')),
  ListTile(title: const Text('Customer Transfers'), onTap: () => Navigator.pushNamed(context, '/customer-transfers')),
  ListTile(title: const Text('Customers'), onTap: () => Navigator.pushNamed(context, '/customers')),
  ListTile(title: const Text('Dapr Sidecar'), onTap: () => Navigator.pushNamed(context, '/dapr-sidecar')),
  ListTile(title: const Text('Data Export'), onTap: () => Navigator.pushNamed(context, '/data-export')),
  ListTile(title: const Text('Database Persistence'), onTap: () => Navigator.pushNamed(context, '/database-persistence')),
  ListTile(title: const Text('Db Admin'), onTap: () => Navigator.pushNamed(context, '/db-admin')),
  ListTile(title: const Text('Ddos Protection'), onTap: () => Navigator.pushNamed(context, '/ddos-protection')),
  ListTile(title: const Text('Diaspora Banking'), onTap: () => Navigator.pushNamed(context, '/diaspora-banking')),
  ListTile(title: const Text('Disaster Recovery'), onTap: () => Navigator.pushNamed(context, '/disaster-recovery')),
  ListTile(title: const Text('Dispute Management'), onTap: () => Navigator.pushNamed(context, '/dispute-management')),
  ListTile(title: const Text('Doc Collections'), onTap: () => Navigator.pushNamed(context, '/doc-collections')),
  ListTile(title: const Text('Document Management'), onTap: () => Navigator.pushNamed(context, '/document-management')),
  ListTile(title: const Text('Dormancy Mgmt'), onTap: () => Navigator.pushNamed(context, '/dormancy-mgmt')),
  ListTile(title: const Text('E2e Tests'), onTap: () => Navigator.pushNamed(context, '/e2e-tests')),
  ListTile(title: const Text('Education Loans'), onTap: () => Navigator.pushNamed(context, '/education-loans')),
  ListTile(title: const Text('Embedded Finance'), onTap: () => Navigator.pushNamed(context, '/embedded-finance')),
  ListTile(title: const Text('Enaira Cbdc'), onTap: () => Navigator.pushNamed(context, '/enaira-cbdc')),
  ListTile(title: const Text('Eod Processor'), onTap: () => Navigator.pushNamed(context, '/eod-processor')),
  ListTile(title: const Text('Erp Next'), onTap: () => Navigator.pushNamed(context, '/erp-next')),
  ListTile(title: const Text('Error Catalog'), onTap: () => Navigator.pushNamed(context, '/error-catalog')),
  ListTile(title: const Text('Error Telemetry'), onTap: () => Navigator.pushNamed(context, '/error-telemetry')),
  ListTile(title: const Text('Escrow'), onTap: () => Navigator.pushNamed(context, '/escrow')),
  ListTile(title: const Text('Esg Banking'), onTap: () => Navigator.pushNamed(context, '/esg-banking')),
  ListTile(title: const Text('Esusu'), onTap: () => Navigator.pushNamed(context, '/esusu')),
  ListTile(title: const Text('Etd Trading'), onTap: () => Navigator.pushNamed(context, '/etd-trading')),
  ListTile(title: const Text('Etl Pipelines'), onTap: () => Navigator.pushNamed(context, '/etl-pipelines')),
  ListTile(title: const Text('Event Bus'), onTap: () => Navigator.pushNamed(context, '/event-bus')),
  ListTile(title: const Text('Event Streaming'), onTap: () => Navigator.pushNamed(context, '/event-streaming')),
  ListTile(title: const Text('Exam Management'), onTap: () => Navigator.pushNamed(context, '/exam-management')),
  ListTile(title: const Text('Expense Mgmt'), onTap: () => Navigator.pushNamed(context, '/expense-mgmt')),
  ListTile(title: const Text('Face Match'), onTap: () => Navigator.pushNamed(context, '/face-match')),
  ListTile(title: const Text('Factoring'), onTap: () => Navigator.pushNamed(context, '/factoring')),
  ListTile(title: const Text('Fatca Crs'), onTap: () => Navigator.pushNamed(context, '/fatca-crs')),
  ListTile(title: const Text('Feature Flag Engine'), onTap: () => Navigator.pushNamed(context, '/feature-flag-engine')),
  ListTile(title: const Text('Fee Schedules'), onTap: () => Navigator.pushNamed(context, '/fee-schedules')),
  ListTile(title: const Text('Fixed Assets'), onTap: () => Navigator.pushNamed(context, '/fixed-assets')),
  ListTile(title: const Text('Fixed Deposits'), onTap: () => Navigator.pushNamed(context, '/fixed-deposits')),
  ListTile(title: const Text('Fluvio Streams'), onTap: () => Navigator.pushNamed(context, '/fluvio-streams')),
  ListTile(title: const Text('Fraud Alerts'), onTap: () => Navigator.pushNamed(context, '/fraud-alerts')),
  ListTile(title: const Text('Fraud Detection'), onTap: () => Navigator.pushNamed(context, '/fraud-detection')),
  ListTile(title: const Text('Fraud Rules'), onTap: () => Navigator.pushNamed(context, '/fraud-rules')),
  ListTile(title: const Text('Fx Dealing Room'), onTap: () => Navigator.pushNamed(context, '/fx-dealing-room')),
  ListTile(title: const Text('Fx Positions'), onTap: () => Navigator.pushNamed(context, '/fx-positions')),
  ListTile(title: const Text('Fx Rates'), onTap: () => Navigator.pushNamed(context, '/fx-rates')),
  ListTile(title: const Text('Fx Revaluation'), onTap: () => Navigator.pushNamed(context, '/fx-revaluation')),
  ListTile(title: const Text('Gl Accounts'), onTap: () => Navigator.pushNamed(context, '/gl-accounts')),
  ListTile(title: const Text('Gl Engine'), onTap: () => Navigator.pushNamed(context, '/gl-engine')),
  ListTile(title: const Text('Graduated Rollout'), onTap: () => Navigator.pushNamed(context, '/graduated-rollout')),
  ListTile(title: const Text('H A Middleware'), onTap: () => Navigator.pushNamed(context, '/ha-middleware')),
  ListTile(title: const Text('H A Services'), onTap: () => Navigator.pushNamed(context, '/ha-services')),
  ListTile(title: const Text('H A Zones'), onTap: () => Navigator.pushNamed(context, '/ha-zones')),
  ListTile(title: const Text('Home'), onTap: () => Navigator.pushNamed(context, '/home')),
  ListTile(title: const Text('Idempotency Dashboard'), onTap: () => Navigator.pushNamed(context, '/idempotency-dashboard')),
  ListTile(title: const Text('Identity Channels'), onTap: () => Navigator.pushNamed(context, '/identity-channels')),
  ListTile(title: const Text('Ifrs9 Engine'), onTap: () => Navigator.pushNamed(context, '/ifrs9-engine')),
  ListTile(title: const Text('Infra Kafka'), onTap: () => Navigator.pushNamed(context, '/infra-kafka')),
  ListTile(title: const Text('Infra Lakehouse'), onTap: () => Navigator.pushNamed(context, '/infra-lakehouse')),
  ListTile(title: const Text('Infra Opensearch'), onTap: () => Navigator.pushNamed(context, '/infra-opensearch')),
  ListTile(title: const Text('Infra Postgres'), onTap: () => Navigator.pushNamed(context, '/infra-postgres')),
  ListTile(title: const Text('Infra Redis'), onTap: () => Navigator.pushNamed(context, '/infra-redis')),
  ListTile(title: const Text('Infra Temporal'), onTap: () => Navigator.pushNamed(context, '/infra-temporal')),
  ListTile(title: const Text('Infra Tigerbeetle'), onTap: () => Navigator.pushNamed(context, '/infra-tigerbeetle')),
  ListTile(title: const Text('Insurance'), onTap: () => Navigator.pushNamed(context, '/insurance')),
  ListTile(title: const Text('Integration Tests'), onTap: () => Navigator.pushNamed(context, '/integration-tests')),
  ListTile(title: const Text('Interbank Lending'), onTap: () => Navigator.pushNamed(context, '/interbank-lending')),
  ListTile(title: const Text('Interbank Settlement'), onTap: () => Navigator.pushNamed(context, '/interbank-settlement')),
  ListTile(title: const Text('Interest Accrual'), onTap: () => Navigator.pushNamed(context, '/interest-accrual')),
  ListTile(title: const Text('Interest Rate'), onTap: () => Navigator.pushNamed(context, '/interest-rate')),
  ListTile(title: const Text('Inventory Finance'), onTap: () => Navigator.pushNamed(context, '/inventory-finance')),
  ListTile(title: const Text('Inventory'), onTap: () => Navigator.pushNamed(context, '/inventory')),
  ListTile(title: const Text('Islamic Banking'), onTap: () => Navigator.pushNamed(context, '/islamic-banking')),
  ListTile(title: const Text('Iso20022 Hub'), onTap: () => Navigator.pushNamed(context, '/iso20022-hub')),
  ListTile(title: const Text('Journal Entries'), onTap: () => Navigator.pushNamed(context, '/journal-entries')),
  ListTile(title: const Text('Jwt Auth'), onTap: () => Navigator.pushNamed(context, '/jwt-auth')),
  ListTile(title: const Text('Kafka Event Bus'), onTap: () => Navigator.pushNamed(context, '/kafka-event-bus')),
  ListTile(title: const Text('Kafka Streaming'), onTap: () => Navigator.pushNamed(context, '/kafka-streaming')),
  ListTile(title: const Text('Keda Autoscaling'), onTap: () => Navigator.pushNamed(context, '/keda-autoscaling')),
  ListTile(title: const Text('Keda Policies'), onTap: () => Navigator.pushNamed(context, '/keda-policies')),
  ListTile(title: const Text('Keycloak Clients'), onTap: () => Navigator.pushNamed(context, '/keycloak-clients')),
  ListTile(title: const Text('Keycloak Id Ps'), onTap: () => Navigator.pushNamed(context, '/keycloak-idps')),
  ListTile(title: const Text('Keycloak Realms'), onTap: () => Navigator.pushNamed(context, '/keycloak-realms')),
  ListTile(title: const Text('Keycloak Roles'), onTap: () => Navigator.pushNamed(context, '/keycloak-roles')),
  ListTile(title: const Text('Keycloak'), onTap: () => Navigator.pushNamed(context, '/keycloak')),
  ListTile(title: const Text('Kyb Engine'), onTap: () => Navigator.pushNamed(context, '/kyb-engine')),
  ListTile(title: const Text('Kyb Triggers'), onTap: () => Navigator.pushNamed(context, '/kyb-triggers')),
  ListTile(title: const Text('Kyc Aml'), onTap: () => Navigator.pushNamed(context, '/kyc-aml')),
  ListTile(title: const Text('Kyc Engine'), onTap: () => Navigator.pushNamed(context, '/kyc-engine')),
  ListTile(title: const Text('Kyc Event Rules'), onTap: () => Navigator.pushNamed(context, '/kyc-event-rules')),
  ListTile(title: const Text('Kyc Overrides'), onTap: () => Navigator.pushNamed(context, '/kyc-overrides')),
  ListTile(title: const Text('Kyc Service Gates'), onTap: () => Navigator.pushNamed(context, '/kyc-service-gates')),
  ListTile(title: const Text('Kyc Triggers'), onTap: () => Navigator.pushNamed(context, '/kyc-triggers')),
  ListTile(title: const Text('Lakehouse C D C Events'), onTap: () => Navigator.pushNamed(context, '/lakehouse-cdc-events')),
  ListTile(title: const Text('Lakehouse Clients'), onTap: () => Navigator.pushNamed(context, '/lakehouse-clients')),
  ListTile(title: const Text('Lakehouse Domain C D C'), onTap: () => Navigator.pushNamed(context, '/lakehouse-domain-cdc')),
  ListTile(title: const Text('Lakehouse Lineage Edges'), onTap: () => Navigator.pushNamed(context, '/lakehouse-lineage-edges')),
  ListTile(title: const Text('Lakehouse Lineage Nodes'), onTap: () => Navigator.pushNamed(context, '/lakehouse-lineage-nodes')),
  ListTile(title: const Text('Lakehouse Materialized Views'), onTap: () => Navigator.pushNamed(context, '/lakehouse-materialized-views')),
  ListTile(title: const Text('Lakehouse Query Federation'), onTap: () => Navigator.pushNamed(context, '/lakehouse-query-federation')),
  ListTile(title: const Text('Lakehouse'), onTap: () => Navigator.pushNamed(context, '/lakehouse')),
  ListTile(title: const Text('Lc Amendments'), onTap: () => Navigator.pushNamed(context, '/lc-amendments')),
  ListTile(title: const Text('Lcr Nsfr'), onTap: () => Navigator.pushNamed(context, '/lcr-nsfr')),
  ListTile(title: const Text('Leasing'), onTap: () => Navigator.pushNamed(context, '/leasing')),
  ListTile(title: const Text('Ledger'), onTap: () => Navigator.pushNamed(context, '/ledger')),
  ListTile(title: const Text('Ledger Sync'), onTap: () => Navigator.pushNamed(context, '/ledger-sync')),
  ListTile(title: const Text('Limit Management'), onTap: () => Navigator.pushNamed(context, '/limit-management')),
  ListTile(title: const Text('Liveness Detection'), onTap: () => Navigator.pushNamed(context, '/liveness-detection')),
  ListTile(title: const Text('Load Testing'), onTap: () => Navigator.pushNamed(context, '/load-testing')),
  ListTile(title: const Text('Loan Accounts'), onTap: () => Navigator.pushNamed(context, '/loan-accounts')),
  ListTile(title: const Text('Loan Calculator'), onTap: () => Navigator.pushNamed(context, '/loan-calculator')),
  ListTile(title: const Text('Loan Origination'), onTap: () => Navigator.pushNamed(context, '/loan-origination')),
  ListTile(title: const Text('Loan Products'), onTap: () => Navigator.pushNamed(context, '/loan-products')),
  ListTile(title: const Text('Loans'), onTap: () => Navigator.pushNamed(context, '/loans')),
  ListTile(title: const Text('Locker'), onTap: () => Navigator.pushNamed(context, '/locker')),
  ListTile(title: const Text('Maker Checker'), onTap: () => Navigator.pushNamed(context, '/maker-checker')),
  ListTile(title: const Text('Mandate Management'), onTap: () => Navigator.pushNamed(context, '/mandate-management')),
  ListTile(title: const Text('Messaging Gateway'), onTap: () => Navigator.pushNamed(context, '/messaging-gateway')),
  ListTile(title: const Text('Microfinance Engine'), onTap: () => Navigator.pushNamed(context, '/microfinance-engine')),
  ListTile(title: const Text('Microfinance'), onTap: () => Navigator.pushNamed(context, '/microfinance')),
  ListTile(title: const Text('Mojaloop Admin Limits'), onTap: () => Navigator.pushNamed(context, '/mojaloop-admin-limits')),
  ListTile(title: const Text('Mojaloop Admin Participants'), onTap: () => Navigator.pushNamed(context, '/mojaloop-admin-participants')),
  ListTile(title: const Text('Mojaloop Callback Endpoints'), onTap: () => Navigator.pushNamed(context, '/mojaloop-callback-endpoints')),
  ListTile(title: const Text('Mojaloop Callbacks'), onTap: () => Navigator.pushNamed(context, '/mojaloop-callbacks')),
  ListTile(title: const Text('Mojaloop Corridors'), onTap: () => Navigator.pushNamed(context, '/mojaloop-corridors')),
  ListTile(title: const Text('Mojaloop I L P Packets'), onTap: () => Navigator.pushNamed(context, '/mojaloop-ilp-packets')),
  ListTile(title: const Text('Mojaloop'), onTap: () => Navigator.pushNamed(context, '/mojaloop')),
  ListTile(title: const Text('Mojaloop Settlement Models'), onTap: () => Navigator.pushNamed(context, '/mojaloop-settlement-models')),
  ListTile(title: const Text('Mojaloop Settlement Windows'), onTap: () => Navigator.pushNamed(context, '/mojaloop-settlement-windows')),
  ListTile(title: const Text('Mojaloop T B Bridge Configs'), onTap: () => Navigator.pushNamed(context, '/mojaloop-tb-bridge-configs')),
  ListTile(title: const Text('Mojaloop T B Bridge Entries'), onTap: () => Navigator.pushNamed(context, '/mojaloop-tb-bridge-entries')),
  ListTile(title: const Text('Money Market'), onTap: () => Navigator.pushNamed(context, '/money-market')),
  ListTile(title: const Text('Mortgage'), onTap: () => Navigator.pushNamed(context, '/mortgage')),
  ListTile(title: const Text('Multi Currency Fx'), onTap: () => Navigator.pushNamed(context, '/multi-currency-fx')),
  ListTile(title: const Text('Multi Entity'), onTap: () => Navigator.pushNamed(context, '/multi-entity')),
  ListTile(title: const Text('Murabaha Calculator'), onTap: () => Navigator.pushNamed(context, '/murabaha-calculator')),
  ListTile(title: const Text('Nibss Direct Debit'), onTap: () => Navigator.pushNamed(context, '/nibss-direct-debit')),
  ListTile(title: const Text('Notification Center'), onTap: () => Navigator.pushNamed(context, '/notification-center')),
  ListTile(title: const Text('Notification Prefs'), onTap: () => Navigator.pushNamed(context, '/notification-prefs')),
  ListTile(title: const Text('Notifications Engine'), onTap: () => Navigator.pushNamed(context, '/notifications-engine')),
  ListTile(title: const Text('Notifications'), onTap: () => Navigator.pushNamed(context, '/notifications')),
  ListTile(title: const Text('Offline Resilience'), onTap: () => Navigator.pushNamed(context, '/offline-resilience')),
  ListTile(title: const Text('Offline Transactions'), onTap: () => Navigator.pushNamed(context, '/offline-transactions')),
  ListTile(title: const Text('Open Banking'), onTap: () => Navigator.pushNamed(context, '/open-banking')),
  ListTile(title: const Text('Openappsec Events'), onTap: () => Navigator.pushNamed(context, '/openappsec-events')),
  ListTile(title: const Text('Openappsec Rules'), onTap: () => Navigator.pushNamed(context, '/openappsec-rules')),
  ListTile(title: const Text('Opensearch'), onTap: () => Navigator.pushNamed(context, '/opensearch')),
  ListTile(title: const Text('Operations Center'), onTap: () => Navigator.pushNamed(context, '/operations-center')),
  ListTile(title: const Text('Otc Derivatives'), onTap: () => Navigator.pushNamed(context, '/otc-derivatives')),
  ListTile(title: const Text('Partner Onboarding Admin'), onTap: () => Navigator.pushNamed(context, '/partner-onboarding-admin')),
  ListTile(title: const Text('Partner Onboarding Portal'), onTap: () => Navigator.pushNamed(context, '/partner-onboarding-portal')),
  ListTile(title: const Text('Payment Investigation'), onTap: () => Navigator.pushNamed(context, '/payment-investigation')),
  ListTile(title: const Text('Payment Transactions'), onTap: () => Navigator.pushNamed(context, '/payment-transactions')),
  ListTile(title: const Text('Payments Hub'), onTap: () => Navigator.pushNamed(context, '/payments-hub')),
  ListTile(title: const Text('Pbac Engine'), onTap: () => Navigator.pushNamed(context, '/pbac-engine')),
  ListTile(title: const Text('Pension'), onTap: () => Navigator.pushNamed(context, '/pension')),
  ListTile(title: const Text('Pep Database'), onTap: () => Navigator.pushNamed(context, '/pep-database')),
  ListTile(title: const Text('Performance Cache'), onTap: () => Navigator.pushNamed(context, '/performance-cache')),
  ListTile(title: const Text('Performance Metrics'), onTap: () => Navigator.pushNamed(context, '/performance-metrics')),
  ListTile(title: const Text('Permify'), onTap: () => Navigator.pushNamed(context, '/permify')),
  ListTile(title: const Text('Pg Connection Pools'), onTap: () => Navigator.pushNamed(context, '/pg-connection-pools')),
  ListTile(title: const Text('Pg Index Advisory'), onTap: () => Navigator.pushNamed(context, '/pg-index-advisory')),
  ListTile(title: const Text('Pg Query Profiles'), onTap: () => Navigator.pushNamed(context, '/pg-query-profiles')),
  ListTile(title: const Text('Pg Slow Queries'), onTap: () => Navigator.pushNamed(context, '/pg-slow-queries')),
  ListTile(title: const Text('Pg Table Stats'), onTap: () => Navigator.pushNamed(context, '/pg-table-stats')),
  ListTile(title: const Text('Pg Tuning Params'), onTap: () => Navigator.pushNamed(context, '/pg-tuning-params')),
  ListTile(title: const Text('Plugin Marketplace'), onTap: () => Navigator.pushNamed(context, '/plugin-marketplace')),
  ListTile(title: const Text('Portfolio Mgmt'), onTap: () => Navigator.pushNamed(context, '/portfolio-mgmt')),
  ListTile(title: const Text('Pos Terminal'), onTap: () => Navigator.pushNamed(context, '/pos-terminal')),
  ListTile(title: const Text('Pricing Model'), onTap: () => Navigator.pushNamed(context, '/pricing-model')),
  ListTile(title: const Text('Product Catalog'), onTap: () => Navigator.pushNamed(context, '/product-catalog')),
  ListTile(title: const Text('Product Factory'), onTap: () => Navigator.pushNamed(context, '/product-factory')),
  ListTile(title: const Text('Project Finance'), onTap: () => Navigator.pushNamed(context, '/project-finance')),
  ListTile(title: const Text('Qr Payments'), onTap: () => Navigator.pushNamed(context, '/qr-payments')),
  ListTile(title: const Text('Ransomware Protection'), onTap: () => Navigator.pushNamed(context, '/ransomware-protection')),
  ListTile(title: const Text('Rate Cascade'), onTap: () => Navigator.pushNamed(context, '/rate-cascade')),
  ListTile(title: const Text('Rate Limiting'), onTap: () => Navigator.pushNamed(context, '/rate-limiting')),
  ListTile(title: const Text('Reconciliation'), onTap: () => Navigator.pushNamed(context, '/reconciliation')),
  ListTile(title: const Text('Regulatory Automation'), onTap: () => Navigator.pushNamed(context, '/regulatory-automation')),
  ListTile(title: const Text('Regulatory Calendar'), onTap: () => Navigator.pushNamed(context, '/regulatory-calendar')),
  ListTile(title: const Text('Regulatory Reporting'), onTap: () => Navigator.pushNamed(context, '/regulatory-reporting')),
  ListTile(title: const Text('Relationship Pricing'), onTap: () => Navigator.pushNamed(context, '/relationship-pricing')),
  ListTile(title: const Text('Remittance'), onTap: () => Navigator.pushNamed(context, '/remittance')),
  ListTile(title: const Text('Report Generation'), onTap: () => Navigator.pushNamed(context, '/report-generation')),
  ListTile(title: const Text('Reporting'), onTap: () => Navigator.pushNamed(context, '/reporting')),
  ListTile(title: const Text('Resilience Dashboard'), onTap: () => Navigator.pushNamed(context, '/resilience-dashboard')),
  ListTile(title: const Text('Retry Policies'), onTap: () => Navigator.pushNamed(context, '/retry-policies')),
  ListTile(title: const Text('Risk Scoring'), onTap: () => Navigator.pushNamed(context, '/risk-scoring')),
  ListTile(title: const Text('Safe Deposit'), onTap: () => Navigator.pushNamed(context, '/safe-deposit')),
  ListTile(title: const Text('Salary Processing'), onTap: () => Navigator.pushNamed(context, '/salary-processing')),
  ListTile(title: const Text('Sar Reports'), onTap: () => Navigator.pushNamed(context, '/sar-reports')),
  ListTile(title: const Text('Savings Products'), onTap: () => Navigator.pushNamed(context, '/savings-products')),
  ListTile(title: const Text('Securities Trading'), onTap: () => Navigator.pushNamed(context, '/securities-trading')),
  ListTile(title: const Text('Security Hardening'), onTap: () => Navigator.pushNamed(context, '/security-hardening')),
  ListTile(title: const Text('Seed Registry'), onTap: () => Navigator.pushNamed(context, '/seed-registry')),
  ListTile(title: const Text('Self Service Txns'), onTap: () => Navigator.pushNamed(context, '/self-service-txns')),
  ListTile(title: const Text('Service Catalog'), onTap: () => Navigator.pushNamed(context, '/service-catalog')),
  ListTile(title: const Text('Service Health'), onTap: () => Navigator.pushNamed(context, '/service-health')),
  ListTile(title: const Text('Settings'), onTap: () => Navigator.pushNamed(context, '/settings')),
  ListTile(title: const Text('Signature Verification'), onTap: () => Navigator.pushNamed(context, '/signature-verification')),
  ListTile(title: const Text('Sms Banking'), onTap: () => Navigator.pushNamed(context, '/sms-banking')),
  ListTile(title: const Text('Sms Email Gateway'), onTap: () => Navigator.pushNamed(context, '/sms-email-gateway')),
  ListTile(title: const Text('Staff Management'), onTap: () => Navigator.pushNamed(context, '/staff-management')),
  ListTile(title: const Text('Standing Charges'), onTap: () => Navigator.pushNamed(context, '/standing-charges')),
  ListTile(title: const Text('Standing Instructions'), onTap: () => Navigator.pushNamed(context, '/standing-instructions')),
  ListTile(title: const Text('Standing Orders'), onTap: () => Navigator.pushNamed(context, '/standing-orders')),
  ListTile(title: const Text('Statement Generator'), onTap: () => Navigator.pushNamed(context, '/statement-generator')),
  ListTile(title: const Text('Statement History'), onTap: () => Navigator.pushNamed(context, '/statement-history')),
  ListTile(title: const Text('Stress Testing'), onTap: () => Navigator.pushNamed(context, '/stress-testing')),
  ListTile(title: const Text('Sukuk Management'), onTap: () => Navigator.pushNamed(context, '/sukuk-management')),
  ListTile(title: const Text('Supply Chain Finance'), onTap: () => Navigator.pushNamed(context, '/supply-chain-finance')),
  ListTile(title: const Text('Swift Messaging'), onTap: () => Navigator.pushNamed(context, '/swift-messaging')),
  ListTile(title: const Text('Syndicated Loans'), onTap: () => Navigator.pushNamed(context, '/syndicated-loans')),
  ListTile(title: const Text('Takaful Management'), onTap: () => Navigator.pushNamed(context, '/takaful-management')),
  ListTile(title: const Text('T B P G Balance Cache Configs'), onTap: () => Navigator.pushNamed(context, '/tb-pg-balance-cache-configs')),
  ListTile(title: const Text('T B P G Balance Cache Entries'), onTap: () => Navigator.pushNamed(context, '/tb-pg-balance-cache-entries')),
  ListTile(title: const Text('T B P G Reconciliation Rules'), onTap: () => Navigator.pushNamed(context, '/tb-pg-reconciliation-rules')),
  ListTile(title: const Text('T B P G Reconciliation Runs'), onTap: () => Navigator.pushNamed(context, '/tb-pg-reconciliation-runs')),
  ListTile(title: const Text('T B P G Saga Definitions'), onTap: () => Navigator.pushNamed(context, '/tb-pg-saga-definitions')),
  ListTile(title: const Text('T B P G Saga Executions'), onTap: () => Navigator.pushNamed(context, '/tb-pg-saga-executions')),
  ListTile(title: const Text('T B P G Sync Configs'), onTap: () => Navigator.pushNamed(context, '/tb-pg-sync-configs')),
  ListTile(title: const Text('T B P G Sync Events'), onTap: () => Navigator.pushNamed(context, '/tb-pg-sync-events')),
  ListTile(title: const Text('Teller'), onTap: () => Navigator.pushNamed(context, '/teller')),
  ListTile(title: const Text('Temporal Sagas'), onTap: () => Navigator.pushNamed(context, '/temporal-sagas')),
  ListTile(title: const Text('Tenant Isolation'), onTap: () => Navigator.pushNamed(context, '/tenant-isolation')),
  ListTile(title: const Text('Tenant Metering'), onTap: () => Navigator.pushNamed(context, '/tenant-metering')),
  ListTile(title: const Text('Tenant Provisioning'), onTap: () => Navigator.pushNamed(context, '/tenant-provisioning')),
  ListTile(title: const Text('Tigerbeetle Ledger'), onTap: () => Navigator.pushNamed(context, '/tigerbeetle-ledger')),
  ListTile(title: const Text('Trade Finance'), onTap: () => Navigator.pushNamed(context, '/trade-finance')),
  ListTile(title: const Text('Transfers'), onTap: () => Navigator.pushNamed(context, '/transfers')),
  ListTile(title: const Text('Treasury Investments'), onTap: () => Navigator.pushNamed(context, '/treasury-investments')),
  ListTile(title: const Text('Treasury Liquidity'), onTap: () => Navigator.pushNamed(context, '/treasury-liquidity')),
  ListTile(title: const Text('Treasury'), onTap: () => Navigator.pushNamed(context, '/treasury')),
  ListTile(title: const Text('Trust Estate'), onTap: () => Navigator.pushNamed(context, '/trust-estate')),
  ListTile(title: const Text('Ussd Banking'), onTap: () => Navigator.pushNamed(context, '/ussd-banking')),
  ListTile(title: const Text('Utility Payments'), onTap: () => Navigator.pushNamed(context, '/utility-payments')),
  ListTile(title: const Text('Virtual Accounts'), onTap: () => Navigator.pushNamed(context, '/virtual-accounts')),
  ListTile(title: const Text('Wakala Investment'), onTap: () => Navigator.pushNamed(context, '/wakala-investment')),
  ListTile(title: const Text('Watchlist'), onTap: () => Navigator.pushNamed(context, '/watchlist')),
  ListTile(title: const Text('Wealth Mgmt'), onTap: () => Navigator.pushNamed(context, '/wealth-mgmt')),
  ListTile(title: const Text('Webhook Deliveries'), onTap: () => Navigator.pushNamed(context, '/webhook-deliveries')),
  ListTile(title: const Text('Webhook Engine'), onTap: () => Navigator.pushNamed(context, '/webhook-engine')),
  ListTile(title: const Text('Webhook Subscriptions'), onTap: () => Navigator.pushNamed(context, '/webhook-subscriptions')),
  ListTile(title: const Text('White Label Config'), onTap: () => Navigator.pushNamed(context, '/white-label-config')),
  ListTile(title: const Text('White Label Engine'), onTap: () => Navigator.pushNamed(context, '/white-label-engine')),
  ListTile(title: const Text('Workflow Definitions'), onTap: () => Navigator.pushNamed(context, '/workflow-definitions')),
  ListTile(title: const Text('Workflow Engine'), onTap: () => Navigator.pushNamed(context, '/workflow-engine')),
  ListTile(title: const Text('Workflow Instances'), onTap: () => Navigator.pushNamed(context, '/workflow-instances')),
])), body: const Center(child: Text("Welcome to 54Bank", style: TextStyle(fontSize: 24)))); } }
