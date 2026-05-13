"""
54Bank Tenant Provisioning & Feature Management — Python
Platform operator workflows for onboarding tenants and white-label partners.
Temporal workflows, tier management, upgrade/downgrade automation.
Features = cost. This service orchestrates what gets turned on during onboarding.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional
import json

# ═══════════════════════════════════════════════════════════════════════════════
# ONBOARDING WORKFLOW DEFINITION (Temporal-style)
# ═══════════════════════════════════════════════════════════════════════════════

PROVISIONING_STEPS = [
    {"step": 1, "name": "create_tenant_record", "service": "postgres", "duration_sec": 2, "rollback": "delete_tenant"},
    {"step": 2, "name": "setup_database_schema", "service": "postgres", "duration_sec": 15, "rollback": "drop_schema"},
    {"step": 3, "name": "apply_rls_policies", "service": "postgres", "duration_sec": 5, "rollback": "revoke_rls"},
    {"step": 4, "name": "configure_keycloak_realm", "service": "keycloak", "duration_sec": 10, "rollback": "delete_realm"},
    {"step": 5, "name": "setup_permify_entitlements", "service": "permify", "duration_sec": 8, "rollback": "revoke_permissions"},
    {"step": 6, "name": "create_kafka_topics", "service": "kafka", "duration_sec": 5, "rollback": "delete_topics"},
    {"step": 7, "name": "initialize_tigerbeetle_accounts", "service": "tigerbeetle", "duration_sec": 3, "rollback": "close_accounts"},
    {"step": 8, "name": "setup_opensearch_indices", "service": "opensearch", "duration_sec": 8, "rollback": "delete_indices"},
    {"step": 9, "name": "configure_redis_cache", "service": "redis", "duration_sec": 2, "rollback": "flush_cache"},
    {"step": 10, "name": "register_dapr_components", "service": "dapr", "duration_sec": 5, "rollback": "unregister_components"},
    {"step": 11, "name": "setup_temporal_workflows", "service": "temporal", "duration_sec": 6, "rollback": "terminate_workflows"},
    {"step": 12, "name": "assign_feature_flags", "service": "feature-entitlement-go", "duration_sec": 2, "rollback": "revoke_flags"},
    {"step": 13, "name": "configure_billing_metering", "service": "billing-enforcement-rs", "duration_sec": 3, "rollback": "disable_metering"},
    {"step": 14, "name": "deploy_white_label_branding", "service": "apisix", "duration_sec": 10, "rollback": "remove_branding"},
    {"step": 15, "name": "provision_growth_features", "service": "growth-features-go", "duration_sec": 12, "rollback": "disable_growth"},
    {"step": 16, "name": "setup_growth_kafka_topics", "service": "kafka", "duration_sec": 4, "rollback": "delete_growth_topics"},
    {"step": 17, "name": "configure_growth_temporal_workflows", "service": "temporal", "duration_sec": 5, "rollback": "terminate_growth_workflows"},
    {"step": 18, "name": "run_smoke_tests", "service": "testing", "duration_sec": 30, "rollback": "flag_failed"},
    {"step": 19, "name": "activate_tenant", "service": "postgres", "duration_sec": 1, "rollback": "deactivate_tenant"},
]

# Growth feature provisioning details per feature
GROWTH_FEATURE_SETUP = {
    "chatbot": {
        "kafka_topics": ["growth.chatbot.sessions", "growth.chatbot.escalations", "growth.chatbot.feedback"],
        "temporal_workflows": ["ChatbotTrainingWorkflow", "ChatbotEscalationWorkflow"],
        "redis_keys": ["chatbot:session:{tenant}", "chatbot:intents:{tenant}"],
        "opensearch_indices": ["chatbot-conversations-{tenant}"],
        "permify_relations": ["chatbot:send_message", "chatbot:view_history", "chatbot:manage_intents"],
        "tigerbeetle_accounts": ["chatbot_cost_center"],
        "estimated_monthly_cost_ngn": 150_000,
    },
    "smart_savings": {
        "kafka_topics": ["growth.savings.deposits", "growth.savings.withdrawals", "growth.savings.goals"],
        "temporal_workflows": ["AutoDebitWorkflow", "GoalMaturityWorkflow", "InterestAccrualWorkflow"],
        "redis_keys": ["savings:balance:{tenant}", "savings:goals:{tenant}"],
        "opensearch_indices": ["savings-goals-{tenant}"],
        "permify_relations": ["savings:create_goal", "savings:withdraw", "savings:configure_auto_debit"],
        "tigerbeetle_accounts": ["savings_pool", "savings_interest_payable"],
        "estimated_monthly_cost_ngn": 200_000,
    },
    "virtual_cards": {
        "kafka_topics": ["growth.cards.issued", "growth.cards.transactions", "growth.cards.blocked"],
        "temporal_workflows": ["CardIssuanceWorkflow", "CardExpiryWorkflow", "CardFraudCheckWorkflow"],
        "redis_keys": ["cards:active:{tenant}", "cards:limits:{tenant}"],
        "opensearch_indices": ["virtual-cards-{tenant}"],
        "permify_relations": ["cards:issue", "cards:freeze", "cards:set_limit", "cards:view_transactions"],
        "tigerbeetle_accounts": ["card_funding_pool", "card_fee_revenue"],
        "estimated_monthly_cost_ngn": 350_000,
    },
    "qr_payments": {
        "kafka_topics": ["growth.qr.scans", "growth.qr.payments", "growth.qr.settlements"],
        "temporal_workflows": ["QRSettlementWorkflow", "MerchantOnboardingWorkflow"],
        "redis_keys": ["qr:merchants:{tenant}", "qr:daily_volume:{tenant}"],
        "opensearch_indices": ["qr-transactions-{tenant}"],
        "permify_relations": ["qr:scan_pay", "qr:onboard_merchant", "qr:view_settlements"],
        "tigerbeetle_accounts": ["qr_settlement_pool", "qr_merchant_fee"],
        "estimated_monthly_cost_ngn": 250_000,
    },
    "bnpl": {
        "kafka_topics": ["growth.bnpl.applications", "growth.bnpl.approvals", "growth.bnpl.repayments", "growth.bnpl.defaults"],
        "temporal_workflows": ["BNPLApprovalWorkflow", "InstallmentScheduleWorkflow", "CollectionWorkflow", "CreditScoringWorkflow"],
        "redis_keys": ["bnpl:credit_scores:{tenant}", "bnpl:active_loans:{tenant}"],
        "opensearch_indices": ["bnpl-orders-{tenant}"],
        "permify_relations": ["bnpl:apply", "bnpl:approve", "bnpl:collect", "bnpl:view_portfolio"],
        "tigerbeetle_accounts": ["bnpl_receivables", "bnpl_interest_income", "bnpl_provision"],
        "estimated_monthly_cost_ngn": 500_000,
    },
    "investments": {
        "kafka_topics": ["growth.invest.orders", "growth.invest.redemptions", "growth.invest.maturity"],
        "temporal_workflows": ["InvestmentMaturityWorkflow", "DividendDistributionWorkflow", "NAVCalculationWorkflow"],
        "redis_keys": ["invest:portfolio:{tenant}", "invest:nav:{tenant}"],
        "opensearch_indices": ["investment-orders-{tenant}"],
        "permify_relations": ["invest:place_order", "invest:redeem", "invest:view_portfolio"],
        "tigerbeetle_accounts": ["investment_pool", "investment_income"],
        "estimated_monthly_cost_ngn": 400_000,
    },
    "remittances": {
        "kafka_topics": ["growth.remit.inbound", "growth.remit.outbound", "growth.remit.settlements"],
        "temporal_workflows": ["RemittanceRoutingWorkflow", "FXConversionWorkflow", "ComplianceScreeningWorkflow"],
        "redis_keys": ["remit:rates:{tenant}", "remit:corridors:{tenant}"],
        "opensearch_indices": ["remittance-transactions-{tenant}"],
        "permify_relations": ["remit:send", "remit:receive", "remit:view_corridors"],
        "tigerbeetle_accounts": ["remit_nostro", "remit_fee_income"],
        "estimated_monthly_cost_ngn": 600_000,
    },
    "gamification": {
        "kafka_topics": ["growth.rewards.earned", "growth.rewards.redeemed", "growth.rewards.tier_changes"],
        "temporal_workflows": ["PointsAccrualWorkflow", "TierUpgradeWorkflow", "RewardExpiryWorkflow"],
        "redis_keys": ["rewards:points:{tenant}", "rewards:tiers:{tenant}", "rewards:streaks:{tenant}"],
        "opensearch_indices": ["rewards-activity-{tenant}"],
        "permify_relations": ["rewards:earn", "rewards:redeem", "rewards:view_tier", "rewards:manage_campaigns"],
        "tigerbeetle_accounts": ["rewards_liability", "rewards_expense"],
        "estimated_monthly_cost_ngn": 200_000,
    },
}

# ═══════════════════════════════════════════════════════════════════════════════
# ONBOARDING WORKFLOW EXECUTION
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class OnboardingExecution:
    execution_id: str
    tenant_id: str
    tenant_name: str
    tier_id: str
    entity_type: str  # tenant | white_label
    operator_email: str
    selected_features: list
    growth_features: list
    add_ons: list
    status: str = "in_progress"
    current_step: int = 0
    total_steps: int = 19
    started_at: str = ""
    completed_at: Optional[str] = None
    steps_completed: list = field(default_factory=list)
    steps_failed: list = field(default_factory=list)
    monthly_cost_ngn: int = 0
    setup_cost_ngn: int = 0

# Sample completed onboardings
ONBOARDING_HISTORY = [
    {
        "execution_id": "ONB-2026-001",
        "tenant_id": "TEN-ZENITH", "tenant_name": "Zenith Bank",
        "tier_id": "TIER-ENTERPRISE", "entity_type": "tenant",
        "operator_email": "admin@54bank.app",
        "status": "completed", "current_step": 19, "total_steps": 19,
        "started_at": "2026-04-01T08:00:00Z", "completed_at": "2026-04-01T08:45:00Z",
        "duration_minutes": 45,
        "growth_features_provisioned": ["chatbot", "smart_savings", "virtual_cards", "qr_payments", "bnpl", "investments", "remittances", "gamification"],
        "monthly_cost_ngn": 25_000_000, "setup_cost_ngn": 50_000_000,
    },
    {
        "execution_id": "ONB-2026-002",
        "tenant_id": "WL-MONIEPOINT", "tenant_name": "Moniepoint",
        "tier_id": "WL-GOLD", "entity_type": "white_label",
        "operator_email": "admin@54bank.app",
        "status": "completed", "current_step": 19, "total_steps": 19,
        "started_at": "2026-04-15T10:00:00Z", "completed_at": "2026-04-15T10:30:00Z",
        "duration_minutes": 30,
        "growth_features_provisioned": ["chatbot", "smart_savings", "virtual_cards", "qr_payments", "bnpl", "gamification"],
        "add_ons_purchased": ["investments"],
        "monthly_cost_ngn": 24_000_000, "setup_cost_ngn": 50_000_000,
    },
    {
        "execution_id": "ONB-2026-003",
        "tenant_id": "WL-KUDA", "tenant_name": "Kuda Bank",
        "tier_id": "WL-PLATINUM", "entity_type": "white_label",
        "operator_email": "admin@54bank.app",
        "status": "completed", "current_step": 19, "total_steps": 19,
        "started_at": "2026-04-20T09:00:00Z", "completed_at": "2026-04-20T09:35:00Z",
        "duration_minutes": 35,
        "growth_features_provisioned": ["chatbot", "smart_savings", "virtual_cards", "qr_payments", "bnpl", "investments", "remittances", "gamification"],
        "monthly_cost_ngn": 40_000_000, "setup_cost_ngn": 100_000_000,
    },
    {
        "execution_id": "ONB-2026-004",
        "tenant_id": "TEN-LAPO-MFB", "tenant_name": "LAPO Microfinance",
        "tier_id": "TIER-STARTER", "entity_type": "tenant",
        "operator_email": "ops@54bank.app",
        "status": "completed", "current_step": 19, "total_steps": 19,
        "started_at": "2026-05-01T09:00:00Z", "completed_at": "2026-05-01T09:25:00Z",
        "duration_minutes": 25,
        "growth_features_provisioned": ["chatbot"],
        "add_ons_purchased": ["smart_savings", "qr_payments"],
        "monthly_cost_ngn": 2_800_000, "setup_cost_ngn": 3_000_000,
    },
    {
        "execution_id": "ONB-2026-005",
        "tenant_id": "WL-OPAY", "tenant_name": "OPay",
        "tier_id": "WL-SILVER", "entity_type": "white_label",
        "operator_email": "ops@54bank.app",
        "status": "completed", "current_step": 19, "total_steps": 19,
        "started_at": "2026-05-05T14:00:00Z", "completed_at": "2026-05-05T14:28:00Z",
        "duration_minutes": 28,
        "growth_features_provisioned": ["chatbot", "smart_savings", "qr_payments"],
        "add_ons_purchased": ["bnpl", "gamification"],
        "monthly_cost_ngn": 12_000_000, "setup_cost_ngn": 20_000_000,
    },
]

# Pending onboarding (in progress)
PENDING_ONBOARDINGS = [
    {
        "execution_id": "ONB-2026-006",
        "tenant_id": "TEN-WEMA-ALAT", "tenant_name": "Wema Bank (ALAT Digital)",
        "tier_id": "TIER-COMMERCIAL", "entity_type": "tenant",
        "operator_email": "ops@54bank.app",
        "status": "in_progress", "current_step": 14, "total_steps": 19,
        "started_at": "2026-05-09T12:00:00Z",
        "growth_features_requested": ["chatbot", "smart_savings", "virtual_cards", "qr_payments", "bnpl", "gamification"],
        "blocking_step": "provision_growth_features",
        "monthly_cost_ngn": 14_000_000, "setup_cost_ngn": 25_000_000,
    },
]

# ═══════════════════════════════════════════════════════════════════════════════
# UPGRADE/DOWNGRADE WORKFLOWS
# ═══════════════════════════════════════════════════════════════════════════════

TIER_CHANGES = [
    {
        "change_id": "TC-001",
        "tenant_id": "TEN-LAPO-MFB", "tenant_name": "LAPO Microfinance",
        "from_tier": "TIER-STARTER", "to_tier": "TIER-STANDARD",
        "type": "upgrade", "reason": "Customer growth exceeded Starter limits",
        "requested_by": "cto@lapo.ng", "approved_by": "admin@54bank.app",
        "new_features_gained": ["cards_digital", "risk_compliance", "smart_savings", "virtual_cards", "qr_payments"],
        "features_lost": [],
        "price_change_ngn": 5_000_000 - 2_800_000,
        "effective_date": "2026-06-01",
        "status": "approved",
        "prorated_amount_ngn": 1_100_000,
    },
    {
        "change_id": "TC-002",
        "tenant_id": "WL-OPAY", "tenant_name": "OPay",
        "from_tier": "WL-SILVER", "to_tier": "WL-GOLD",
        "type": "upgrade", "reason": "Exceeded 50K user limit, need 200K capacity",
        "requested_by": "finance@opay.ng", "approved_by": "admin@54bank.app",
        "new_features_gained": ["virtual_cards", "bnpl_included", "gamification_included", "investments"],
        "features_lost": [],
        "price_change_ngn": 20_000_000 - 12_000_000,
        "effective_date": "2026-06-01",
        "status": "pending_approval",
        "prorated_amount_ngn": 4_000_000,
    },
]

# ═══════════════════════════════════════════════════════════════════════════════
# HTTP API
# ═══════════════════════════════════════════════════════════════════════════════

def middleware_status():
    return {
        "kafka": {"topic": "provisioning.workflow.events", "status": "connected"},
        "temporal": {"namespace": "54bank-provisioning", "workflows_active": 3, "status": "running"},
        "postgres": {"tables": "onboarding_executions, tier_changes, feature_provisions", "status": "connected"},
        "keycloak": {"realm": "platform-admin", "status": "authorized"},
        "permify": {"schema": "provisioning:execute_onboarding", "status": "enforcing"},
        "redis": {"cache": "provisioning_status", "status": "connected"},
        "tigerbeetle": {"account": "setup_fee_ledger", "status": "posting"},
        "opensearch": {"index": "provisioning-audit-2026", "status": "indexed"},
        "dapr": {"pubsub": "provisioning-events", "status": "publishing"},
        "fluvio": {"stream": "onboarding-progress", "status": "streaming"},
        "openappsec": {"policy": "admin-only-provisioning", "status": "active"},
        "apisix": {"route": "platform_operator_authenticated", "status": "enforcing"},
        "mojaloop": {"purpose": "settlement_account_creation", "status": "ready"},
        "lakehouse": {"table": "kpi_catalog.provisioning.history_iceberg", "status": "written"},
    }


def handle_request(path: str) -> dict:
    """Route handler."""
    if path == "/healthz":
        return {
            "status": "healthy", "service": "tenant-provisioning-py", "version": "1.0.0",
            "capabilities": [
                "tenant_onboarding", "white_label_onboarding", "feature_provisioning",
                "tier_upgrade_downgrade", "growth_feature_setup", "rollback_workflows",
            ],
        }
    elif path == "/v1/provisioning/workflow-steps":
        return {"steps": PROVISIONING_STEPS, "total": len(PROVISIONING_STEPS), "middleware": middleware_status()}
    elif path == "/v1/provisioning/growth-feature-setup":
        return {"features": GROWTH_FEATURE_SETUP, "total": len(GROWTH_FEATURE_SETUP), "middleware": middleware_status()}
    elif path == "/v1/provisioning/history":
        return {"items": ONBOARDING_HISTORY, "total": len(ONBOARDING_HISTORY), "middleware": middleware_status()}
    elif path == "/v1/provisioning/pending":
        return {"items": PENDING_ONBOARDINGS, "total": len(PENDING_ONBOARDINGS), "middleware": middleware_status()}
    elif path == "/v1/provisioning/tier-changes":
        return {"items": TIER_CHANGES, "total": len(TIER_CHANGES), "middleware": middleware_status()}
    elif path == "/v1/provisioning/cost-calculator":
        return {
            "calculator": {
                "enterprise": {"base": 25_000_000, "setup": 50_000_000, "growth_features": "all included", "add_ons": "none needed"},
                "commercial": {"base": 12_000_000, "setup": 25_000_000, "growth_included": ["chatbot", "smart_savings", "virtual_cards", "qr_payments"], "add_ons_available": {"bnpl": 2_000_000, "investments": 3_000_000, "remittances": 2_500_000, "gamification": 1_000_000}},
                "standard": {"base": 5_000_000, "setup": 10_000_000, "growth_included": ["chatbot", "smart_savings"], "add_ons_available": {"virtual_cards": 1_500_000, "qr_payments": 1_000_000, "bnpl": 2_000_000, "investments": 3_000_000, "remittances": 2_500_000, "gamification": 1_000_000}},
                "starter": {"base": 1_500_000, "setup": 3_000_000, "growth_included": ["chatbot"], "add_ons_available": {"smart_savings": 500_000, "virtual_cards": 1_500_000, "qr_payments": 800_000, "gamification": 500_000}},
                "wl_platinum": {"base": 40_000_000, "setup": 100_000_000, "growth_features": "all included", "sub_tenants": "unlimited"},
                "wl_gold": {"base": 20_000_000, "setup": 50_000_000, "growth_included": ["chatbot", "smart_savings", "virtual_cards", "qr_payments", "bnpl", "gamification"], "add_ons_available": {"investments": 4_000_000, "remittances": 3_500_000}},
                "wl_silver": {"base": 8_000_000, "setup": 20_000_000, "growth_included": ["chatbot", "smart_savings", "qr_payments"], "add_ons_available": {"virtual_cards": 2_000_000, "bnpl": 2_500_000, "gamification": 1_500_000, "investments": 4_000_000, "remittances": 3_500_000}},
            },
            "middleware": middleware_status(),
        }
    elif path == "/v1/provisioning/revenue-projection":
        return {
            "current_mrr_ngn": 118_288_000,
            "tenants": {
                "count": 4, "revenue_ngn": 53_100_000,
                "breakdown": [
                    {"tenant": "Zenith Bank", "tier": "Enterprise", "monthly_ngn": 25_300_000},
                    {"tenant": "UBA Nigeria", "tier": "Enterprise", "monthly_ngn": 25_000_000},
                    {"tenant": "LAPO MFB", "tier": "Starter + Add-ons", "monthly_ngn": 2_800_000},
                ]
            },
            "white_label": {
                "count": 3, "revenue_ngn": 64_288_000,
                "breakdown": [
                    {"partner": "Kuda Bank", "tier": "Platinum", "monthly_ngn": 40_000_000},
                    {"partner": "Moniepoint", "tier": "Gold + Add-ons", "monthly_ngn": 24_168_000},
                    {"partner": "OPay", "tier": "Silver + Add-ons", "monthly_ngn": 12_120_000},
                ]
            },
            "growth_feature_revenue_ngn": {
                "included_in_base": 85_000_000,
                "add_on_revenue": 9_300_000,
                "overage_revenue": 588_000,
                "total_growth_attribution": 94_888_000,
            },
            "pipeline": [
                {"tenant": "Wema Bank (ALAT)", "tier": "Commercial", "status": "onboarding", "expected_monthly_ngn": 14_000_000},
                {"tenant": "Sterling Bank", "tier": "Commercial", "status": "negotiation", "expected_monthly_ngn": 12_000_000},
                {"tenant": "PalmPay", "tier": "WL-Gold", "status": "negotiation", "expected_monthly_ngn": 22_000_000},
            ],
            "middleware": middleware_status(),
        }
    else:
        return {"error": "not found"}


# ═══════════════════════════════════════════════════════════════════════════════
# SERVER
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import http.server
    import os

    PORT = int(os.environ.get("PORT", "8109"))

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            path = self.path.split("?")[0]
            response = handle_request(path)
            body = json.dumps(response, indent=2).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length) if content_length > 0 else b"{}"
            req = json.loads(body) if body else {}
            path = self.path.split("?")[0]

            if path == "/v1/provisioning/start":
                response = {
                    "success": True,
                    "execution_id": f"ONB-2026-{len(ONBOARDING_HISTORY) + len(PENDING_ONBOARDINGS) + 1:03d}",
                    "tenant_id": req.get("tenantId"),
                    "tenant_name": req.get("tenantName"),
                    "tier_id": req.get("tierId"),
                    "entity_type": req.get("type", "tenant"),
                    "operator": req.get("operatorEmail"),
                    "total_steps": 19,
                    "estimated_duration_minutes": 35,
                    "growth_features_to_provision": req.get("growthFeatures", []),
                    "monthly_cost_ngn": req.get("estimatedMonthlyCost", 0),
                    "setup_cost_ngn": req.get("setupCost", 0),
                    "status": "started",
                    "middleware": middleware_status(),
                }
            elif path == "/v1/provisioning/request-upgrade":
                response = {
                    "success": True,
                    "change_id": f"TC-{len(TIER_CHANGES) + 1:03d}",
                    "tenant_id": req.get("tenantId"),
                    "from_tier": req.get("currentTier"),
                    "to_tier": req.get("newTier"),
                    "type": "upgrade" if req.get("newTier", "") > req.get("currentTier", "") else "downgrade",
                    "new_features": req.get("newFeatures", []),
                    "price_change_ngn": req.get("priceChange", 0),
                    "status": "pending_approval",
                    "requires_approval_from": "platform_admin",
                    "middleware": middleware_status(),
                }
            elif path == "/v1/provisioning/add-feature":
                feature = req.get("feature", "")
                setup = GROWTH_FEATURE_SETUP.get(feature, {})
                response = {
                    "success": True,
                    "tenant_id": req.get("tenantId"),
                    "feature": feature,
                    "setup_details": setup,
                    "provisioning_steps": [
                        f"Create Kafka topics: {setup.get('kafka_topics', [])}",
                        f"Setup Temporal workflows: {setup.get('temporal_workflows', [])}",
                        f"Initialize Redis keys: {setup.get('redis_keys', [])}",
                        f"Create OpenSearch indices: {setup.get('opensearch_indices', [])}",
                        f"Configure Permify relations: {setup.get('permify_relations', [])}",
                        f"Initialize TigerBeetle accounts: {setup.get('tigerbeetle_accounts', [])}",
                    ],
                    "estimated_monthly_cost_ngn": setup.get("estimated_monthly_cost_ngn", 0),
                    "status": "provisioned",
                    "middleware": middleware_status(),
                }
            else:
                response = {"error": "unknown endpoint"}

            resp_body = json.dumps(response, indent=2).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp_body)))
            self.end_headers()
            self.wfile.write(resp_body)

        def log_message(self, format, *args):
            pass  # Suppress default logging

    print(f"Tenant Provisioning (Python) on :{PORT}")
    print("Capabilities: tenant_onboarding, white_label_onboarding, feature_provisioning, tier_upgrade_downgrade")
    server = http.server.HTTPServer(("0.0.0.0", PORT), Handler)
    server.serve_forever()
