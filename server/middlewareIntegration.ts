/**
 * NDSEP Middleware Integration Layer
 * ===================================
 * Centralised event emission for all mutations across routers.
 * Integrates with Dapr, Fluvio, OpenSearch, Lakehouse, and Permify.
 * All calls are fire-and-forget with graceful degradation.
 */
import { emitComplianceEvent, opensearchIndex, lakehouseIngest, daprPublish, fluvioPublish, permifyCheck } from "./middlewareExtensions";

// ── Event type constants ─────────────────────────────────────────────────────

export const EVENTS = {
  // Accreditation
  ACCREDITATION_SUBMITTED: "ndsep.accreditation.submitted",
  ACCREDITATION_REVIEWED: "ndsep.accreditation.reviewed",
  ACCREDITATION_APPROVED: "ndsep.accreditation.approved",
  ACCREDITATION_REJECTED: "ndsep.accreditation.rejected",
  ACCREDITATION_LICENCE_ISSUED: "ndsep.accreditation.licence_issued",

  // Banking
  AML_CASE_CREATED: "ndsep.banking.aml_case_created",
  AML_CASE_UPDATED: "ndsep.banking.aml_case_updated",
  SWIFT_TRANSACTION: "ndsep.banking.swift_transaction",
  KYC_VERIFICATION: "ndsep.banking.kyc_verification",
  FRAUD_ALERT: "ndsep.banking.fraud_alert",
  CORRESPONDENT_BANK: "ndsep.banking.correspondent_bank",
  CBN_REPORT: "ndsep.banking.cbn_report",

  // Billing
  INVOICE_CREATED: "ndsep.billing.invoice_created",
  PAYMENT_RECEIVED: "ndsep.billing.payment_received",
  SUBSCRIPTION_CHANGED: "ndsep.billing.subscription_changed",

  // DPCO
  DPCO_ENGAGEMENT_CREATED: "ndsep.dpco.engagement_created",
  DPCO_EVIDENCE_UPLOADED: "ndsep.dpco.evidence_uploaded",
  DPCO_CAR_GENERATED: "ndsep.dpco.car_generated",
  DPCO_VERIFICATION_SUBMITTED: "ndsep.dpco.verification_submitted",
  DPCO_SCORECARD_UPDATED: "ndsep.dpco.scorecard_updated",

  // Compliance
  COMPLIANCE_VIOLATION_DETECTED: "ndsep.compliance.violation_detected",
  COMPLIANCE_SCORE_UPDATED: "ndsep.compliance.score_updated",
  COMPLIANCE_GAP_IDENTIFIED: "ndsep.compliance.gap_identified",
  COMPLIANCE_REMEDIATION: "ndsep.compliance.remediation",

  // Enforcement
  ENFORCEMENT_CASE_OPENED: "ndsep.enforcement.case_opened",
  ENFORCEMENT_PENALTY_ISSUED: "ndsep.enforcement.penalty_issued",
  ENFORCEMENT_APPEAL: "ndsep.enforcement.appeal",
  ENFORCEMENT_PAYMENT: "ndsep.enforcement.payment",

  // DSAR
  DSAR_SUBMITTED: "ndsep.dsar.submitted",
  DSAR_COMPLETED: "ndsep.dsar.completed",

  // DPIA
  DPIA_CREATED: "ndsep.dpia.created",
  DPIA_APPROVED: "ndsep.dpia.approved",

  // Breach
  BREACH_REPORTED: "ndsep.breach.reported",
  BREACH_ESCALATED: "ndsep.breach.escalated",
  BREACH_RESOLVED: "ndsep.breach.resolved",

  // Consent
  CONSENT_GRANTED: "ndsep.consent.granted",
  CONSENT_WITHDRAWN: "ndsep.consent.withdrawn",

  // Vendor Risk
  VENDOR_RISK_ASSESSED: "ndsep.vendor.risk_assessed",
  VENDOR_RISK_UPDATED: "ndsep.vendor.risk_updated",

  // Incident Response
  INCIDENT_ACTIVATED: "ndsep.incident.activated",
  INCIDENT_RESOLVED: "ndsep.incident.resolved",

  // Regulatory
  REGULATORY_INTELLIGENCE: "ndsep.regulatory.intelligence_update",
  REGULATORY_SANDBOX: "ndsep.regulatory.sandbox_application",

  // Whistleblower
  WHISTLEBLOWER_REPORT: "ndsep.whistleblower.report_filed",
  WHISTLEBLOWER_INVESTIGATED: "ndsep.whistleblower.investigated",

  // AI/ML
  AI_MODEL_DEPLOYED: "ndsep.ai.model_deployed",
  AI_ETHICS_REVIEW: "ndsep.ai.ethics_review",
  AI_GOVERNANCE_SCORE: "ndsep.ai.governance_score",

  // Security
  SECURITY_AUDIT: "ndsep.security.audit_event",
  SECURITY_ANOMALY: "ndsep.security.anomaly_detected",

  // Data Pipeline
  DATA_PIPELINE_TRIGGERED: "ndsep.data.pipeline_triggered",
  DATA_LINEAGE_UPDATED: "ndsep.data.lineage_updated",

  // Workflow
  WORKFLOW_TRANSITION: "ndsep.workflow.transition",
  WORKFLOW_PENALTY_CALCULATED: "ndsep.workflow.penalty_calculated",
  WORKFLOW_SLA_BREACH: "ndsep.workflow.sla_breach",

  // Cross-Agency
  CROSS_AGENCY_SHARE: "ndsep.cross_agency.data_shared",
  CROSS_BORDER_TRANSFER: "ndsep.cross_border.transfer",

  // Telecom
  TELECOM_MONITORING: "ndsep.telecom.monitoring_event",
  TELECOM_QOS_VIOLATION: "ndsep.telecom.qos_violation",

  // Sectors
  SECTOR_BENCHMARK: "ndsep.sector.benchmark_updated",
  SECTOR_ALERT: "ndsep.sector.alert",
} as const;

// ── Emit to all middleware ───────────────────────────────────────────────────

/**
 * Fire-and-forget event emission to all middleware layers.
 * Publishes to Dapr (→ Kafka), Fluvio, OpenSearch, and Lakehouse simultaneously.
 */
export async function emitMutationEvent(
  event: string,
  data: Record<string, unknown>,
  options?: {
    indexName?: string;
    skipOpenSearch?: boolean;
    skipLakehouse?: boolean;
  }
): Promise<void> {
  const payload = { ...data, event, timestamp: new Date().toISOString() };
  const indexName = options?.indexName ?? event.replace(/\./g, "-");

  // Fire all middleware calls in parallel, each with its own error handling
  const promises: Promise<void>[] = [
    daprPublish(event, payload).catch(() => {}),
    fluvioPublish(event, payload).catch(() => {}),
  ];

  if (!options?.skipOpenSearch) {
    promises.push(opensearchIndex(indexName, payload).catch(() => {}));
  }
  if (!options?.skipLakehouse) {
    promises.push(lakehouseIngest(indexName, [payload]).catch(() => {}));
  }

  await Promise.allSettled(promises);
}

/**
 * Check Permify authorization before a mutation.
 * Returns true if allowed, false if denied.
 * Gracefully degrades to allowing if Permify is unavailable.
 */
export async function checkPermission(
  userId: string | number,
  resource: string,
  action: string
): Promise<boolean> {
  try {
    const result = await permifyCheck(resource, String(userId), action, `user:${userId}`);
    return result !== false;
  } catch {
    return true; // Graceful degradation
  }
}
