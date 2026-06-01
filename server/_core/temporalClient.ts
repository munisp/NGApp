/**
 * server/_core/temporalClient.ts
 *
 * Temporal workflow client for the OG-RMM platform.
 * Uses @temporalio/client to start and query workflows.
 *
 * Mode detection:
 *   - If TEMPORAL_ADDRESS is set and reachable → live mode
 *   - Otherwise → simulation mode (returns mock workflow IDs)
 *
 * Supported workflows:
 *   - IncidentTriageWorkflow  (security triage)
 *   - WorkoverWorkflow        (workover job lifecycle)
 *   - DRDispatchWorkflow      (demand response dispatch)
 */

import { ENV } from "./env";

export interface WorkflowStartResult {
  workflowId: string;
  runId: string;
  mode: "live" | "simulated";
}

export interface WorkflowStatus {
  workflowId: string;
  runId: string;
  status: "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "TIMED_OUT" | "UNKNOWN";
  startTime?: Date;
  closeTime?: Date;
  result?: unknown;
  mode: "live" | "simulated";
}

// ── Temporal address from env ─────────────────────────────────────────────────
const TEMPORAL_ADDRESS = ENV.temporalAddress ?? "localhost:7233";
const TEMPORAL_NAMESPACE = ENV.temporalNamespace ?? "og-rmm";
const TEMPORAL_TASK_QUEUE = (process.env.TEMPORAL_TASK_QUEUE as string | undefined) ?? "og-rmm-workflow";

// ── Live client (lazy-loaded to avoid startup crash when Temporal is down) ───
let _client: unknown = null;
let _liveMode = false;

async function getLiveClient() {
  if (_client) return _client;

  try {
    // Dynamic import to avoid bundling issues when @temporalio/client is not installed
    const { Client, Connection } = await import("@temporalio/client");
    const connection = await Connection.connect({
      address: TEMPORAL_ADDRESS,
    });
    _client = new Client({ connection, namespace: TEMPORAL_NAMESPACE });
    _liveMode = true;
    console.log(`[Temporal] Connected to ${TEMPORAL_ADDRESS} (namespace: ${TEMPORAL_NAMESPACE})`);
    return _client;
  } catch (err) {
    console.warn(`[Temporal] Cannot connect to ${TEMPORAL_ADDRESS} — using simulation mode. Error: ${(err as Error).message}`);
    _liveMode = false;
    return null;
  }
}

// ── Simulation helpers ────────────────────────────────────────────────────────
function makeSimulatedWorkflowId(prefix: string): string {
  return `${prefix}-sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Start an IncidentTriageWorkflow for a security event.
 */
export async function startIncidentTriageWorkflow(params: {
  eventId: string;
  severity: number;
  target: string;
  eventType: string;
  triageId: number;
}): Promise<WorkflowStartResult> {
  const client = await getLiveClient() as any;

  if (client && _liveMode) {
    try {
      const workflowId = `incident-triage-${params.eventId}-${Date.now()}`;
      const handle = await client.start("IncidentTriageWorkflow", {
        taskQueue: TEMPORAL_TASK_QUEUE,
        workflowId,
        args: [params],
      });
      return { workflowId: handle.workflowId, runId: handle.firstExecutionRunId, mode: "live" };
    } catch (err) {
      console.error("[Temporal] startIncidentTriageWorkflow failed:", err);
    }
  }

  // Simulation fallback
  const workflowId = makeSimulatedWorkflowId("incident-triage");
  console.log(`[Temporal] Simulated IncidentTriageWorkflow: ${workflowId}`);
  return { workflowId, runId: `run-${Date.now()}`, mode: "simulated" };
}

/**
 * Start a WorkoverWorkflow for a workover job.
 */
export async function startWorkoverWorkflow(params: {
  workorderId: number;
  wellId: string;
  jobType: string;
  priority: string;
}): Promise<WorkflowStartResult> {
  const client = await getLiveClient() as any;

  if (client && _liveMode) {
    try {
      const workflowId = `workover-${params.workorderId}-${Date.now()}`;
      const handle = await client.start("WorkoverWorkflow", {
        taskQueue: TEMPORAL_TASK_QUEUE,
        workflowId,
        args: [params],
      });
      return { workflowId: handle.workflowId, runId: handle.firstExecutionRunId, mode: "live" };
    } catch (err) {
      console.error("[Temporal] startWorkoverWorkflow failed:", err);
    }
  }

  const workflowId = makeSimulatedWorkflowId("workover");
  return { workflowId, runId: `run-${Date.now()}`, mode: "simulated" };
}

/**
 * Start a DRDispatchWorkflow for a demand response event.
 */
export async function startDRDispatchWorkflow(params: {
  eventId: string;
  targetKw: number;
  durationMin: number;
  wellIds: string[];
}): Promise<WorkflowStartResult> {
  const client = await getLiveClient() as any;

  if (client && _liveMode) {
    try {
      const workflowId = `dr-dispatch-${params.eventId}-${Date.now()}`;
      const handle = await client.start("DRDispatchWorkflow", {
        taskQueue: TEMPORAL_TASK_QUEUE,
        workflowId,
        args: [params],
      });
      return { workflowId: handle.workflowId, runId: handle.firstExecutionRunId, mode: "live" };
    } catch (err) {
      console.error("[Temporal] startDRDispatchWorkflow failed:", err);
    }
  }

  const workflowId = makeSimulatedWorkflowId("dr-dispatch");
  return { workflowId, runId: `run-${Date.now()}`, mode: "simulated" };
}

/**
 * Get the status of any workflow by ID.
 */
export async function getWorkflowStatus(workflowId: string): Promise<WorkflowStatus> {
  const client = await getLiveClient() as any;

  if (client && _liveMode) {
    try {
      const handle = client.getHandle(workflowId);
      const desc = await handle.describe();
      return {
        workflowId,
        runId: desc.runId,
        status: desc.status.name as WorkflowStatus["status"],
        startTime: desc.startTime,
        closeTime: desc.closeTime,
        mode: "live",
      };
    } catch (err) {
      console.error("[Temporal] getWorkflowStatus failed:", err);
    }
  }

  // Simulation: return a plausible status based on workflow ID age
  const isOld = workflowId.includes("-sim-") && parseInt(workflowId.split("-").slice(-2, -1)[0] ?? "0") < Date.now() - 30_000;
  return {
    workflowId,
    runId: `run-sim`,
    status: isOld ? "COMPLETED" : "RUNNING",
    startTime: new Date(Date.now() - 15_000),
    mode: "simulated",
  };
}

/**
 * Returns whether Temporal is in live mode.
 */
export function isTemporalLive(): boolean {
  return _liveMode;
}

/**
 * Returns the configured Temporal address.
 */
export function getTemporalAddress(): string {
  return TEMPORAL_ADDRESS;
}
