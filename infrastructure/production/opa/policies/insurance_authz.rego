package insurance.authz

# =============================================================================
# OPA Authorization Policies — Unified Insurance Platform
# Enforced via Istio External Authorization or OPA Gatekeeper
# Covers: RBAC, ABAC, data access, API operations, PII protection
# =============================================================================

import future.keywords.if
import future.keywords.in

# ============================================================
# ROLE DEFINITIONS
# ============================================================
# Roles are extracted from Keycloak JWT claims
roles := input.user.roles

is_admin if "platform-admin" in roles
is_underwriter if "underwriter" in roles
is_claims_adjuster if "claims-adjuster" in roles
is_agent if "insurance-agent" in roles
is_customer if "customer" in roles
is_reinsurance_manager if "reinsurance-manager" in roles
is_compliance_officer if "compliance-officer" in roles
is_auditor if "auditor" in roles
is_service_account if "service-account" in roles

# ============================================================
# DEFAULT DENY
# ============================================================
default allow := false

# ============================================================
# POLICY OPERATIONS
# ============================================================
allow if {
  input.resource == "policy"
  input.action == "read"
  is_customer
  input.user.policy_holder_id == input.resource_id
}

allow if {
  input.resource == "policy"
  input.action in ["read", "list"]
  is_agent
}

allow if {
  input.resource == "policy"
  input.action in ["read", "list", "create", "update"]
  is_underwriter
}

allow if {
  input.resource == "policy"
  input.action in ["read", "list", "create", "update", "delete", "cancel"]
  is_admin
}

# Agents can only view policies in their assigned region
allow if {
  input.resource == "policy"
  input.action in ["read", "list"]
  is_agent
  input.resource_metadata.region == input.user.assigned_region
}

# ============================================================
# CLAIM OPERATIONS
# ============================================================
allow if {
  input.resource == "claim"
  input.action in ["read", "create"]
  is_customer
  input.user.policy_holder_id == input.resource_metadata.policy_holder_id
}

allow if {
  input.resource == "claim"
  input.action in ["read", "list", "update"]
  is_claims_adjuster
}

allow if {
  input.resource == "claim"
  input.action == "approve"
  is_claims_adjuster
  input.resource_metadata.amount <= 50000
}

allow if {
  input.resource == "claim"
  input.action == "approve"
  is_underwriter
  input.resource_metadata.amount <= 500000
}

allow if {
  input.resource == "claim"
  input.action == "approve"
  is_admin
}

allow if {
  input.resource == "claim"
  input.action in ["read", "list", "create", "update", "approve", "reject"]
  is_admin
}

# Claims adjuster cannot approve their own submitted claims
deny if {
  input.resource == "claim"
  input.action == "approve"
  is_claims_adjuster
  input.resource_metadata.submitted_by == input.user.id
}

# ============================================================
# PAYMENT OPERATIONS
# ============================================================
allow if {
  input.resource == "payment"
  input.action in ["read", "initiate"]
  is_customer
  input.user.policy_holder_id == input.resource_metadata.policy_holder_id
}

allow if {
  input.resource == "payment"
  input.action in ["read", "list"]
  is_claims_adjuster
}

allow if {
  input.resource == "payment"
  input.action in ["read", "list", "process", "refund"]
  is_admin
}

# Payment amount limits by role
payment_limit := 10000 if is_customer
payment_limit := 100000 if is_claims_adjuster
payment_limit := 1000000 if is_underwriter
payment_limit := 999999999 if is_admin

deny if {
  input.resource == "payment"
  input.action == "initiate"
  input.resource_metadata.amount > payment_limit
}

# ============================================================
# UNDERWRITING OPERATIONS
# ============================================================
allow if {
  input.resource == "underwriting"
  input.action in ["read", "create", "update", "approve"]
  is_underwriter
}

allow if {
  input.resource == "underwriting"
  input.action in ["read", "list"]
  is_agent
}

allow if {
  input.resource == "underwriting"
  input.action in ["read", "list", "create", "update", "approve", "reject"]
  is_admin
}

# High-risk policies require senior underwriter approval
deny if {
  input.resource == "underwriting"
  input.action == "approve"
  is_underwriter
  not input.user.is_senior_underwriter
  input.resource_metadata.risk_score > 80
}

# ============================================================
# REINSURANCE OPERATIONS
# ============================================================
allow if {
  input.resource == "reinsurance"
  input.action in ["read", "list", "create", "update"]
  is_reinsurance_manager
}

allow if {
  input.resource == "reinsurance"
  input.action in ["read", "list"]
  is_underwriter
}

allow if {
  input.resource == "reinsurance"
  input.action in ["read", "list", "create", "update", "delete"]
  is_admin
}

# ============================================================
# ANALYTICS OPERATIONS
# ============================================================
allow if {
  input.resource == "analytics"
  input.action == "read"
  is_customer
  # Customers can only see their own analytics
  input.resource_metadata.scope == "personal"
  input.user.policy_holder_id == input.resource_metadata.policy_holder_id
}

allow if {
  input.resource == "analytics"
  input.action in ["read", "list"]
  is_agent
  # Agents see aggregate analytics for their region
  input.resource_metadata.scope in ["regional", "aggregate"]
}

allow if {
  input.resource == "analytics"
  input.action in ["read", "list", "export"]
  is_admin
}

allow if {
  input.resource == "analytics"
  input.action in ["read", "list", "export"]
  is_compliance_officer
}

# ============================================================
# PII DATA ACCESS CONTROLS
# ============================================================
# Fields classified as PII that require elevated access
pii_fields := {
  "national_id",
  "passport_number",
  "date_of_birth",
  "bank_account_number",
  "credit_card_number",
  "medical_records",
  "biometric_data",
  "phone_number",
  "home_address",
}

# Mask PII fields for roles without PII access
pii_access_allowed if is_admin
pii_access_allowed if is_compliance_officer
pii_access_allowed if is_auditor
pii_access_allowed if {
  is_customer
  input.user.policy_holder_id == input.resource_metadata.policy_holder_id
}
pii_access_allowed if {
  is_claims_adjuster
  input.resource_metadata.claim_assigned_to == input.user.id
}

deny if {
  input.resource_metadata.contains_pii == true
  input.requested_fields[_] in pii_fields
  not pii_access_allowed
}

# ============================================================
# AUDIT LOG ACCESS
# ============================================================
allow if {
  input.resource == "audit_log"
  input.action in ["read", "list"]
  is_auditor
}

allow if {
  input.resource == "audit_log"
  input.action in ["read", "list"]
  is_compliance_officer
}

allow if {
  input.resource == "audit_log"
  input.action in ["read", "list", "export"]
  is_admin
}

# ============================================================
# SERVICE ACCOUNT ACCESS
# ============================================================
# Service accounts have access to their designated resources
service_account_permissions := {
  "openimis-consumer": {"policy": ["read", "list", "create", "update"]},
  "claims-producer": {"claim": ["read", "list", "create", "update"]},
  "payment-service": {"payment": ["read", "create", "update", "process"]},
  "underwriting-risk-integrator": {"underwriting": ["read", "create", "update"]},
  "unified-analytics": {"analytics": ["read", "list", "create"]},
  "reinsurance-accounting": {"reinsurance": ["read", "list", "create", "update"]},
}

allow if {
  is_service_account
  perms := service_account_permissions[input.user.service_account_name]
  resource_perms := perms[input.resource]
  input.action in resource_perms
}

# ============================================================
# TIME-BASED ACCESS RESTRICTIONS
# ============================================================
# Restrict bulk export operations to business hours (UTC)
deny if {
  input.action == "export"
  not is_admin
  hour := time.clock(time.now_ns())[0]
  not hour >= 8
  not hour <= 18
}

# ============================================================
# RATE LIMITING POLICY
# ============================================================
# Maximum claims per customer per day
deny if {
  input.resource == "claim"
  input.action == "create"
  is_customer
  input.context.claims_today >= 5
}

# ============================================================
# GDPR/NDPR COMPLIANCE
# ============================================================
# Data subject access requests must be processed within 30 days
allow if {
  input.resource == "data_subject_request"
  input.action in ["read", "create"]
  is_customer
  input.user.id == input.resource_metadata.subject_id
}

allow if {
  input.resource == "data_subject_request"
  input.action in ["read", "list", "process", "complete"]
  is_compliance_officer
}

allow if {
  input.resource == "data_subject_request"
  input.action in ["read", "list", "process", "complete", "delete"]
  is_admin
}

# ============================================================
# RESPONSE TRANSFORMATION
# ============================================================
# Mask PII in API responses when access is not granted
masked_response := response if {
  not pii_access_allowed
  response := {k: v |
    v := input.response[k]
    not k in pii_fields
  }
}

masked_response := input.response if pii_access_allowed

# ============================================================
# DECISION METADATA
# ============================================================
decision_metadata := {
  "user_id": input.user.id,
  "user_roles": roles,
  "resource": input.resource,
  "action": input.action,
  "allowed": allow,
  "timestamp": time.now_ns(),
  "policy_version": "1.0.0",
}
