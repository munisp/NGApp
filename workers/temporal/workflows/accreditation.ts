/**
 * Temporal Workflow — DPCO Accreditation Lifecycle
 * Manages the full accreditation workflow from submission to certificate issuance.
 *
 * State machine:
 *   submitted → document_review → technical_assessment → committee_review
 *   → approved/rejected → certificate_issued (if approved)
 *
 * SLA enforcement:
 *   - Document review: 5 business days
 *   - Technical assessment: 10 business days
 *   - Committee review: 5 business days
 *   - Total: max 90 calendar days (NDPA requirement)
 */

// ─── Workflow Types ──────────────────────────────────────────────────────────

export interface AccreditationInput {
  applicationId: number;
  dpcoOrgId: number;
  applicantEmail: string;
  submittedAt: string; // ISO-8601
}

export interface AccreditationResult {
  applicationId: number;
  status: "approved" | "rejected" | "expired";
  certificateToken?: string;
  completedAt: string;
  durationDays: number;
}

export type AccreditationStage =
  | "submitted"
  | "document_review"
  | "technical_assessment"
  | "committee_review"
  | "approved"
  | "rejected"
  | "certificate_issued";

// ─── Activity Stubs ──────────────────────────────────────────────────────────
// These are the activity function signatures. Actual implementations live in
// workers/temporal/activities/accreditation.ts and are registered with the
// Temporal worker at startup.

export interface AccreditationActivities {
  /**
   * Validates all submitted documents are present and readable.
   * Returns list of missing or invalid documents.
   */
  validateDocuments(applicationId: number): Promise<{ valid: boolean; missing: string[] }>;

  /**
   * Sends an email notification to the applicant about stage transition.
   */
  notifyApplicant(params: {
    applicationId: number;
    email: string;
    stage: AccreditationStage;
    message: string;
  }): Promise<void>;

  /**
   * Updates the application status in the database.
   */
  updateApplicationStatus(params: {
    applicationId: number;
    status: AccreditationStage;
    notes?: string;
  }): Promise<void>;

  /**
   * Runs the automated technical assessment scoring.
   * Returns a score 0-100 and a list of findings.
   */
  runTechnicalAssessment(applicationId: number): Promise<{
    score: number;
    findings: Array<{ category: string; severity: "critical" | "major" | "minor"; description: string }>;
    passThreshold: boolean;
  }>;

  /**
   * Issues a certificate and stores the token in the database.
   */
  issueCertificate(params: {
    applicationId: number;
    dpcoOrgId: number;
    validityYears: number;
  }): Promise<{ certificateToken: string; expiresAt: string }>;

  /**
   * Sends the owner a notification about the accreditation outcome.
   */
  notifyOwner(params: {
    applicationId: number;
    outcome: "approved" | "rejected";
    dpcoOrgId: number;
  }): Promise<void>;

  /**
   * Escalates an overdue review to the committee chair.
   */
  escalateOverdueReview(params: {
    applicationId: number;
    stage: AccreditationStage;
    daysPastSla: number;
  }): Promise<void>;
}

// ─── Workflow Definition ─────────────────────────────────────────────────────
// This is the workflow orchestration logic. In a live Temporal deployment,
// this file is bundled and executed by the Temporal worker runtime.
// The `workflow` object below is the stub interface — replace with actual
// @temporalio/workflow imports when deploying the Temporal worker.

export interface AccreditationWorkflow {
  /**
   * Main workflow entry point.
   * Orchestrates the full accreditation lifecycle with SLA enforcement.
   */
  run(input: AccreditationInput): Promise<AccreditationResult>;

  /**
   * Signal: admin has completed document review.
   */
  documentReviewComplete(params: { approved: boolean; notes: string }): Promise<void>;

  /**
   * Signal: committee has made a decision.
   */
  committeeDecision(params: { approved: boolean; notes: string }): Promise<void>;

  /**
   * Query: get current workflow state.
   */
  getState(): AccreditationStage;
}

// ─── Workflow Implementation Stub ────────────────────────────────────────────
// Replace with actual @temporalio/workflow implementation:
//
// import { defineSignal, defineQuery, setHandler, sleep, proxyActivities } from "@temporalio/workflow";
// import type { AccreditationActivities } from "./accreditation";
//
// const acts = proxyActivities<AccreditationActivities>({ startToCloseTimeout: "1 day" });
//
// export const documentReviewCompleteSignal = defineSignal<[{ approved: boolean; notes: string }]>("documentReviewComplete");
// export const committeeDecisionSignal = defineSignal<[{ approved: boolean; notes: string }]>("committeeDecision");
// export const getStateQuery = defineQuery<AccreditationStage>("getState");
//
// export async function accreditationWorkflow(input: AccreditationInput): Promise<AccreditationResult> {
//   let stage: AccreditationStage = "submitted";
//   let documentApproved = false;
//   let committeeApproved = false;
//
//   setHandler(getStateQuery, () => stage);
//
//   // Stage 1: Document review (5 business day SLA)
//   stage = "document_review";
//   await acts.updateApplicationStatus({ applicationId: input.applicationId, status: stage });
//   await acts.notifyApplicant({ applicationId: input.applicationId, email: input.applicantEmail, stage, message: "Your documents are under review." });
//
//   await Promise.race([
//     new Promise<void>(resolve => setHandler(documentReviewCompleteSignal, ({ approved, notes }) => { documentApproved = approved; resolve(); })),
//     sleep("5d").then(() => acts.escalateOverdueReview({ applicationId: input.applicationId, stage, daysPastSla: 5 })),
//   ]);
//
//   // ... (continue for each stage)
// }

export const ACCREDITATION_WORKFLOW_ID_PREFIX = "accreditation-";
export const ACCREDITATION_TASK_QUEUE = "ndsep-accreditation";
export const ACCREDITATION_SLA_DAYS = 90;
export const DOCUMENT_REVIEW_SLA_DAYS = 5;
export const TECHNICAL_ASSESSMENT_SLA_DAYS = 10;
export const COMMITTEE_REVIEW_SLA_DAYS = 5;
