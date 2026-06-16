/**
 * Temporal Workflow — Breach Notification Lifecycle
 * Manages the 72-hour NDPA breach notification obligation (Section 40).
 *
 * Timeline:
 *   T+0h:  Breach discovered → workflow started
 *   T+24h: Preliminary internal assessment due
 *   T+48h: Remediation steps must be documented
 *   T+72h: NDPC notification mandatory (NDPA Section 40(1))
 *   T+30d: Full post-incident report due (NDPA Section 40(3))
 *
 * Escalation:
 *   T+60h: Auto-escalate to DPO if notification not yet submitted
 *   T+70h: Auto-escalate to CEO/Board if still not submitted
 */

export interface BreachNotificationInput {
  breachId: number;
  orgId: number;
  dpoEmail: string;
  ceoEmail: string;
  discoveredAt: string; // ISO-8601
  severity: "low" | "medium" | "high" | "critical";
  estimatedAffectedRecords: number;
}

export interface BreachNotificationResult {
  breachId: number;
  ndpcNotifiedAt?: string;
  notificationStatus: "submitted_on_time" | "submitted_late" | "missed_deadline" | "not_required";
  penaltyRisk: boolean;
  completedAt: string;
}

export type BreachNotificationStage =
  | "discovered"
  | "internal_assessment"
  | "remediation_in_progress"
  | "ndpc_notification_pending"
  | "ndpc_notified"
  | "post_incident_review"
  | "closed";

export interface BreachNotificationActivities {
  /**
   * Sends an urgent notification to the DPO about the breach.
   */
  notifyDpo(params: {
    breachId: number;
    email: string;
    severity: string;
    deadline: string;
  }): Promise<void>;

  /**
   * Sends an escalation notification to the CEO/Board.
   */
  escalateToCeo(params: {
    breachId: number;
    email: string;
    hoursRemaining: number;
  }): Promise<void>;

  /**
   * Submits the breach notification to NDPC via the regulatory API.
   */
  submitNdpcNotification(params: {
    breachId: number;
    orgId: number;
  }): Promise<{ referenceNumber: string; submittedAt: string }>;

  /**
   * Updates the breach record status in the database.
   */
  updateBreachStatus(params: {
    breachId: number;
    stage: BreachNotificationStage;
    notes?: string;
  }): Promise<void>;

  /**
   * Calculates penalty risk based on breach severity and notification timing.
   */
  assessPenaltyRisk(params: {
    breachId: number;
    notifiedAt?: string;
    discoveredAt: string;
    severity: string;
    affectedRecords: number;
  }): Promise<{ penaltyRisk: boolean; estimatedPenalty?: number; reasoning: string }>;

  /**
   * Generates the post-incident report PDF.
   */
  generatePostIncidentReport(breachId: number): Promise<{ reportUrl: string }>;
}

// ─── Workflow Implementation Stub ────────────────────────────────────────────
// Replace with actual @temporalio/workflow implementation:
//
// import { defineSignal, defineQuery, setHandler, sleep, proxyActivities } from "@temporalio/workflow";
//
// export const ndpcNotificationSubmittedSignal = defineSignal<[{ referenceNumber: string }]>("ndpcNotificationSubmitted");
// export const breachContainedSignal = defineSignal("breachContained");
// export const getStageQuery = defineQuery<BreachNotificationStage>("getStage");
//
// export async function breachNotificationWorkflow(input: BreachNotificationInput): Promise<BreachNotificationResult> {
//   let stage: BreachNotificationStage = "discovered";
//   let ndpcNotifiedAt: string | undefined;
//   const deadline72h = new Date(new Date(input.discoveredAt).getTime() + 72 * 60 * 60 * 1000).toISOString();
//
//   setHandler(getStageQuery, () => stage);
//
//   // Immediate DPO notification
//   await acts.notifyDpo({ breachId: input.breachId, email: input.dpoEmail, severity: input.severity, deadline: deadline72h });
//
//   // T+24h: Internal assessment
//   await sleep("24h");
//   stage = "internal_assessment";
//   await acts.updateBreachStatus({ breachId: input.breachId, stage });
//
//   // T+48h: Remediation
//   await sleep("24h");
//   stage = "remediation_in_progress";
//
//   // T+60h: Escalate if not yet notified
//   await sleep("12h");
//   if (!ndpcNotifiedAt) {
//     await acts.escalateToCeo({ breachId: input.breachId, email: input.ceoEmail, hoursRemaining: 12 });
//   }
//
//   // T+72h: Mandatory NDPC notification deadline
//   await sleep("12h");
//   // ... (auto-submit if not yet submitted)
// }

export const BREACH_WORKFLOW_ID_PREFIX = "breach-";
export const BREACH_TASK_QUEUE = "ndsep-breach";
export const NDPC_NOTIFICATION_DEADLINE_HOURS = 72;
export const POST_INCIDENT_REPORT_DEADLINE_DAYS = 30;
export const ESCALATION_TO_DPO_HOURS = 24;
export const ESCALATION_TO_CEO_HOURS = 60;
