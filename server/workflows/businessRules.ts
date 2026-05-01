/**
 * NDSEP Business Rules Engine
 * =============================
 * Implements Nigerian data protection enforcement business logic.
 *
 * Rules:
 * 1. NDPA penalty calculation (up to 2% of annual turnover or 10M NGN)
 * 2. Compliance scoring algorithm
 * 3. Risk assessment scoring
 * 4. SLA breach detection
 * 5. DPCO licence renewal eligibility
 * 6. Cross-border transfer adequacy checks
 */

import { getPool } from "../db";
import { logger } from "../logger";

// ── Penalty Calculation (NDPA Article 47) ────────────────────────────────────

export interface PenaltyInput {
  organizationId: number;
  violationType: string;
  severity: "low" | "medium" | "high" | "critical";
  affectedRecords: number;
  isRepeatOffender: boolean;
  annualTurnover?: number;
}

export interface PenaltyCalculation {
  baseAmount: number;
  multiplier: number;
  totalAmount: number;
  currency: string;
  formula: string;
  ndpaReference: string;
}

const SEVERITY_BASE_AMOUNTS: Record<string, number> = {
  low: 500_000,       // 500K NGN
  medium: 2_000_000,  // 2M NGN
  high: 5_000_000,    // 5M NGN
  critical: 10_000_000, // 10M NGN
};

const RECORDS_MULTIPLIER_THRESHOLDS = [
  { threshold: 100_000, multiplier: 2.0 },
  { threshold: 50_000, multiplier: 1.5 },
  { threshold: 10_000, multiplier: 1.2 },
  { threshold: 0, multiplier: 1.0 },
];

export function calculatePenalty(input: PenaltyInput): PenaltyCalculation {
  const base = SEVERITY_BASE_AMOUNTS[input.severity] ?? SEVERITY_BASE_AMOUNTS.medium;

  // Records-based multiplier
  let recordsMultiplier = 1.0;
  for (const t of RECORDS_MULTIPLIER_THRESHOLDS) {
    if (input.affectedRecords >= t.threshold) {
      recordsMultiplier = t.multiplier;
      break;
    }
  }

  // Repeat offender surcharge (50%)
  const repeatMultiplier = input.isRepeatOffender ? 1.5 : 1.0;

  // Calculate total
  let total = base * recordsMultiplier * repeatMultiplier;

  // Cap at 2% of annual turnover (NDPA Article 47)
  if (input.annualTurnover) {
    const cap = input.annualTurnover * 0.02;
    total = Math.min(total, cap);
  }

  // Absolute cap: 10M NGN for non-critical
  if (input.severity !== "critical") {
    total = Math.min(total, 10_000_000);
  }

  return {
    baseAmount: base,
    multiplier: recordsMultiplier * repeatMultiplier,
    totalAmount: Math.round(total),
    currency: "NGN",
    formula: `${base} (base) × ${recordsMultiplier} (records) × ${repeatMultiplier} (repeat) = ${Math.round(total)}`,
    ndpaReference: "NDPA Article 47 — Administrative Penalties",
  };
}

// ── Compliance Score Calculation ─────────────────────────────────────────────

export interface ComplianceScoreInput {
  hasDpo: boolean;
  hasPrivacyPolicy: boolean;
  hasConsentMechanism: boolean;
  hasBreachNotificationProcess: boolean;
  hasDpia: boolean;
  hasDataRetentionPolicy: boolean;
  hasSecurityMeasures: boolean;
  hasRecordOfProcessing: boolean;
  openViolations: number;
  resolvedViolations: number;
  breachCount: number;
  lastAuditDate: Date | null;
}

export function calculateComplianceScore(input: ComplianceScoreInput): {
  score: number;
  grade: string;
  breakdown: Array<{ category: string; score: number; maxScore: number }>;
} {
  const breakdown = [
    { category: "DPO Appointment", score: input.hasDpo ? 12 : 0, maxScore: 12 },
    { category: "Privacy Policy", score: input.hasPrivacyPolicy ? 10 : 0, maxScore: 10 },
    { category: "Consent Mechanism", score: input.hasConsentMechanism ? 12 : 0, maxScore: 12 },
    { category: "Breach Notification", score: input.hasBreachNotificationProcess ? 10 : 0, maxScore: 10 },
    { category: "DPIA Completed", score: input.hasDpia ? 10 : 0, maxScore: 10 },
    { category: "Data Retention Policy", score: input.hasDataRetentionPolicy ? 8 : 0, maxScore: 8 },
    { category: "Security Measures", score: input.hasSecurityMeasures ? 12 : 0, maxScore: 12 },
    { category: "Record of Processing", score: input.hasRecordOfProcessing ? 8 : 0, maxScore: 8 },
    {
      category: "Violation History",
      score: Math.max(0, 10 - input.openViolations * 3),
      maxScore: 10,
    },
    {
      category: "Incident Response",
      score: input.breachCount === 0 ? 8 : Math.max(0, 8 - input.breachCount * 2),
      maxScore: 8,
    },
  ];

  const total = breakdown.reduce((sum, b) => sum + b.score, 0);

  let grade: string;
  if (total >= 90) grade = "A";
  else if (total >= 80) grade = "B";
  else if (total >= 70) grade = "C";
  else if (total >= 60) grade = "D";
  else grade = "F";

  return { score: total, grade, breakdown };
}

// ── Risk Assessment ──────────────────────────────────────────────────────────

export interface RiskAssessmentInput {
  sector: string;
  dataVolume: "low" | "medium" | "high" | "very_high";
  crossBorderTransfers: boolean;
  sensitiveData: boolean;
  automatedDecisions: boolean;
  previousBreaches: number;
  complianceScore: number;
}

const SECTOR_RISK: Record<string, number> = {
  "Banking & Finance": 8,
  "Fintech": 9,
  "Healthcare": 9,
  "Telecommunications": 7,
  "Insurance": 7,
  "Oil & Gas": 6,
  "Education": 5,
  "Manufacturing": 4,
};

const DATA_VOLUME_RISK: Record<string, number> = {
  low: 2,
  medium: 4,
  high: 7,
  very_high: 10,
};

export function calculateRiskScore(input: RiskAssessmentInput): {
  score: number;
  level: "low" | "medium" | "high" | "critical";
  factors: Array<{ factor: string; impact: number }>;
} {
  const factors: Array<{ factor: string; impact: number }> = [];

  const sectorRisk = SECTOR_RISK[input.sector] ?? 5;
  factors.push({ factor: "Sector Risk", impact: sectorRisk });

  const volumeRisk = DATA_VOLUME_RISK[input.dataVolume] ?? 5;
  factors.push({ factor: "Data Volume", impact: volumeRisk });

  if (input.crossBorderTransfers) factors.push({ factor: "Cross-Border Transfer", impact: 8 });
  if (input.sensitiveData) factors.push({ factor: "Sensitive Data Processing", impact: 7 });
  if (input.automatedDecisions) factors.push({ factor: "Automated Decision-Making", impact: 6 });
  if (input.previousBreaches > 0) factors.push({ factor: "Previous Breaches", impact: Math.min(10, input.previousBreaches * 3) });

  // Compliance score inversely affects risk
  const complianceImpact = Math.round((100 - input.complianceScore) / 10);
  factors.push({ factor: "Compliance Gap", impact: complianceImpact });

  const totalImpact = factors.reduce((sum, f) => sum + f.impact, 0);
  const normalizedScore = Math.min(100, Math.round((totalImpact / (factors.length * 10)) * 100));

  let level: "low" | "medium" | "high" | "critical";
  if (normalizedScore >= 75) level = "critical";
  else if (normalizedScore >= 50) level = "high";
  else if (normalizedScore >= 25) level = "medium";
  else level = "low";

  return { score: normalizedScore, level, factors };
}

// ── SLA Breach Detection ─────────────────────────────────────────────────────

export interface SlaCheckInput {
  entityType: "violation" | "breach" | "dsar" | "appeal";
  createdAt: Date;
  currentStatus: string;
}

const SLA_DEADLINES_HOURS: Record<string, Record<string, number>> = {
  violation: { investigating: 72, resolved: 720 },      // 3 days to start, 30 days to resolve
  breach: { investigating: 24, resolved: 168 },          // 24h to acknowledge, 7 days to resolve
  dsar: { under_review: 48, approved: 720 },             // 2 days to validate, 30 days to complete
  appeal: { under_review: 120, resolved: 2160 },         // 5 days to review, 90 days to resolve
};

export function checkSlaBreach(input: SlaCheckInput): {
  breached: boolean;
  hoursElapsed: number;
  slaHours: number;
  urgency: "normal" | "warning" | "overdue" | "critical";
} {
  const deadlines = SLA_DEADLINES_HOURS[input.entityType] ?? {};
  const slaHours = deadlines[input.currentStatus] ?? 720; // Default 30-day SLA
  const hoursElapsed = (Date.now() - input.createdAt.getTime()) / (1000 * 60 * 60);

  let urgency: "normal" | "warning" | "overdue" | "critical";
  if (hoursElapsed > slaHours * 1.5) urgency = "critical";
  else if (hoursElapsed > slaHours) urgency = "overdue";
  else if (hoursElapsed > slaHours * 0.75) urgency = "warning";
  else urgency = "normal";

  return {
    breached: hoursElapsed > slaHours,
    hoursElapsed: Math.round(hoursElapsed),
    slaHours,
    urgency,
  };
}

// ── DPCO Licence Renewal Eligibility ─────────────────────────────────────────

export async function checkRenewalEligibility(orgId: number): Promise<{
  eligible: boolean;
  reasons: string[];
  requiresDpia: boolean;
  outstandingPenalties: number;
}> {
  const pool = getPool();
  if (!pool) return { eligible: false, reasons: ["Database unavailable"], requiresDpia: false, outstandingPenalties: 0 };

  const reasons: string[] = [];
  let eligible = true;

  // Check outstanding violations
  const violations = await pool.query(
    "SELECT COUNT(*) as cnt FROM compliance_violations WHERE organization_id = $1 AND status NOT IN ('resolved', 'closed')",
    [orgId]
  );
  if (Number(violations.rows[0].cnt) > 0) {
    eligible = false;
    reasons.push(`${violations.rows[0].cnt} unresolved compliance violations`);
  }

  // Check outstanding penalties
  const penalties = await pool.query(
    "SELECT COALESCE(SUM(amount), 0) as total FROM financial_penalties WHERE organization_id = $1 AND status = 'pending'",
    [orgId]
  );
  const outstandingPenalties = Number(penalties.rows[0].total);
  if (outstandingPenalties > 0) {
    eligible = false;
    reasons.push(`Outstanding penalties: ₦${outstandingPenalties.toLocaleString()}`);
  }

  // Check if DPIA is needed
  const org = await pool.query(
    "SELECT sector, compliance_score FROM organizations WHERE id = $1",
    [orgId]
  );
  const highRiskSectors = ["Banking & Finance", "Fintech", "Healthcare", "Telecommunications"];
  const requiresDpia = highRiskSectors.includes(org.rows[0]?.sector);

  if (eligible) {
    reasons.push("All requirements met for licence renewal");
  }

  return { eligible, reasons, requiresDpia, outstandingPenalties };
}

// ── Cross-Border Transfer Adequacy Check ─────────────────────────────────────

const ADEQUATE_COUNTRIES = new Set([
  "South Africa", "Kenya", "Ghana", "Rwanda", "Mauritius", "Senegal", "Tanzania",
  "United Kingdom", "Germany", "France", "Netherlands", "Ireland",
  "Canada", "Japan", "South Korea", "Israel", "Switzerland",
  "New Zealand", "Argentina", "Uruguay",
]);

export function checkCrossBorderAdequacy(destinationCountry: string): {
  adequate: boolean;
  safeguards: string[];
  ndpaReference: string;
} {
  const adequate = ADEQUATE_COUNTRIES.has(destinationCountry);

  const safeguards: string[] = [];
  if (!adequate) {
    safeguards.push("Standard Contractual Clauses (SCCs) required");
    safeguards.push("Binding Corporate Rules (BCRs) may be used");
    safeguards.push("Explicit consent from data subject with risk acknowledgment");
    safeguards.push("NDPC pre-approval required for transfer");
  }

  return {
    adequate,
    safeguards,
    ndpaReference: "NDPA Article 28 — Transfer of Personal Data Outside Nigeria",
  };
}
