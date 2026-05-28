/**
 * calibration-workover-bridge.ts
 * Bridges the Calibration module with the Workover/Intervention module.
 *
 * When a sensor is OVERDUE or FAILED, this module auto-generates a
 * Workover job of type "CALIBRATION" and links it to the TigerBeetle
 * financial ledger entry for cost tracking.
 *
 * In production this would POST to:
 *   POST /api/v1/workovers          (Go well-management service)
 *   POST /api/v1/temporal/workflows (Temporal workflow engine)
 *   POST /api/v1/ledger/entries     (TigerBeetle financial ledger)
 */

import type { CalibrationRecord } from "./mock-data";
import type { WorkoverJob, WorkoverCostEntry } from "./mock-data";
import { nanoid } from "nanoid";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CalibrationWorkorderResult {
  workover_job: WorkoverJob;
  temporal_workflow_id: string;
  ledger_entry_id: string;
  tigerbeetle_transfer_id: string;
}

export interface AutoGenerateOptions {
  /** Override the default estimated cost (USD) */
  estimated_cost_usd?: number;
  /** Supervisor who approved the work order */
  supervisor?: string;
  /** Crew assigned to the calibration */
  assigned_crew?: string;
  /** Scheduled start date (ISO 8601) */
  scheduled_start?: string;
}

// ── Cost estimation ───────────────────────────────────────────────────────────

const CALIBRATION_COST_TABLE: Record<string, number> = {
  PRESSURE:    1_200,
  TEMPERATURE:   900,
  FLOW:        2_500,
  VIBRATION:   1_800,
  GAS:         3_200,
  DEFAULT:     1_500,
};

function estimateCost(record: CalibrationRecord): number {
  const base = CALIBRATION_COST_TABLE[record.sensor_type] ?? CALIBRATION_COST_TABLE.DEFAULT;
  // Drift correction costs 40% more than routine
  const multiplier = record.calibration_type === "DRIFT_CORRECTION" ? 1.4 : 1.0;
  return Math.round(base * multiplier);
}

// ── Priority mapping ──────────────────────────────────────────────────────────

function derivePriority(record: CalibrationRecord): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
  if (record.status === "FAILED") return "CRITICAL";
  if (record.status === "OVERDUE" && Math.abs(record.days_until_due) > 14) return "HIGH";
  if (record.status === "OVERDUE") return "MEDIUM";
  return "LOW";
}

// ── Workover job builder ──────────────────────────────────────────────────────

export function buildCalibrationWorkoverJob(
  record: CalibrationRecord,
  opts: AutoGenerateOptions = {}
): WorkoverJob {
  const today = new Date();
  const scheduledStart = opts.scheduled_start ?? new Date(today.getTime() + 2 * 86_400_000).toISOString();
  const estimatedCost = opts.estimated_cost_usd ?? estimateCost(record);

  const costEntries: WorkoverCostEntry[] = [
    {
      entry_id: `ce-${nanoid(8)}`,
      category: "LABOR",
      description: `Calibration technician — ${record.sensor_tag}`,
      amount_usd: Math.round(estimatedCost * 0.45),
      date: scheduledStart.split("T")[0],
      vendor: "WT Petrotech Field Services",
    },
    {
      entry_id: `ce-${nanoid(8)}`,
      category: "EQUIPMENT",
      description: `Calibration equipment — ${record.sensor_type} reference standard`,
      amount_usd: Math.round(estimatedCost * 0.30),
      date: scheduledStart.split("T")[0],
      vendor: "Beamex Calibration Solutions",
    },
    {
      entry_id: `ce-${nanoid(8)}`,
      category: "MATERIALS",
      description: `Calibration certificate & NIST traceability documentation`,
      amount_usd: Math.round(estimatedCost * 0.15),
      date: scheduledStart.split("T")[0],
      vendor: "NIST-Accredited Lab",
    },
    {
      entry_id: `ce-${nanoid(8)}`,
      category: "TRANSPORT",
      description: `Mobilization to ${record.well_name}`,
      amount_usd: Math.round(estimatedCost * 0.10),
      date: scheduledStart.split("T")[0],
    },
  ];

  const job: WorkoverJob = {
    job_id: `WO-CAL-${record.calibration_id}`,
    well_id: record.well_id ?? "well-001",
    well_name: record.well_name,
    job_type: "CALIBRATION",
    status: "PLANNED",
    priority: derivePriority(record),
    description: `Auto-generated calibration work order for ${record.sensor_tag} (${record.sensor_name}). ` +
      `Current drift: ${record.current_drift_pct.toFixed(2)}% (threshold: ${record.drift_threshold_pct}%). ` +
      `Status: ${record.status}. Days overdue: ${Math.abs(record.days_until_due)}.`,
    reason: `Sensor drift alert: ${record.sensor_tag} drift (${record.current_drift_pct.toFixed(2)}%) ` +
      `exceeded ${record.drift_threshold_pct}% threshold. Auto-triggered by Calibration Management module.`,
    supervisor: opts.supervisor ?? "Field Operations Manager",
    assigned_crew: opts.assigned_crew ?? "Calibration Team Alpha",
    estimated_cost_usd: estimatedCost,
    actual_cost_usd: 0,
    estimated_duration_days: 1,
    actual_duration_days: undefined,
    scheduled_start: scheduledStart,
    actual_start: undefined,
    completed_at: undefined,
    rig_name: undefined,
    temporal_workflow_id: `cal-wf-${nanoid(10)}`,
    cost_entries: costEntries,
    // Linked calibration record for traceability (stored in notes)
    notes: `Linked calibration: ${record.calibration_id} | Sensor: ${record.sensor_tag} | Drift: ${record.current_drift_pct.toFixed(2)}%`,
    created_at: new Date().toISOString(),
  };

  return job;
}

// ── Ledger entry builder ──────────────────────────────────────────────────────

export interface LedgerEntry {
  entry_id: string;
  account_debit: string;   // "OPEX:MAINTENANCE:CALIBRATION"
  account_credit: string;  // "AP:VENDORS:CALIBRATION_SERVICES"
  amount_usd: number;
  currency: "USD";
  description: string;
  reference: string;       // workover job ID
  timestamp: string;
}

export function buildLedgerEntry(job: WorkoverJob): LedgerEntry {
  return {
    entry_id: `LE-${nanoid(12)}`,
    account_debit: "OPEX:MAINTENANCE:CALIBRATION",
    account_credit: "AP:VENDORS:CALIBRATION_SERVICES",
    amount_usd: job.estimated_cost_usd,
    currency: "USD",
    description: `Calibration work order ${job.job_id} — ${job.well_name}`,
    reference: job.job_id,
    timestamp: new Date().toISOString(),
  };
}

// ── Main auto-generate function ───────────────────────────────────────────────

/**
 * Auto-generates a Workover job from an overdue/failed CalibrationRecord.
 * In production this would call the Go API + Temporal + TigerBeetle.
 * In the UI layer, it returns the generated objects for optimistic state update.
 */
export async function autoGenerateCalibrationWorkorder(
  record: CalibrationRecord,
  opts: AutoGenerateOptions = {}
): Promise<CalibrationWorkorderResult> {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 600));

  const job = buildCalibrationWorkoverJob(record, opts);
  const ledgerEntry = buildLedgerEntry(job);

  // In production:
  // await apiClient.post("/api/v1/workovers", job);
  // await apiClient.post("/api/v1/temporal/workflows", { type: "CALIBRATION_WORKFLOW", payload: job });
  // await apiClient.post("/api/v1/ledger/entries", ledgerEntry);

  return {
    workover_job: job,
    temporal_workflow_id: job.temporal_workflow_id!,
    ledger_entry_id: ledgerEntry.entry_id,
    tigerbeetle_transfer_id: `TB-${nanoid(16)}`,
  };
}

// ── Batch auto-generate for all overdue sensors ───────────────────────────────

export async function autoGenerateAllOverdueWorkorders(
  records: CalibrationRecord[]
): Promise<CalibrationWorkorderResult[]> {
  const overdue = records.filter(r => r.status === "OVERDUE" || r.status === "FAILED");
  const results = await Promise.all(overdue.map(r => autoGenerateCalibrationWorkorder(r)));
  return results;
}
