/**
 * temporal.ts — Temporal workflow client for durable workover state machines
 *
 * Connects to the Temporal server defined in docker-compose.yml.
 * When TEMPORAL_ADDRESS is not set (local dev without Docker), all operations
 * degrade gracefully and return mock workflow IDs so the UI remains functional.
 *
 * Workflow types defined here mirror the Go alarm-manager Temporal activities:
 *   - workover.execute      → Full workover lifecycle (plan → mobilize → execute → demob)
 *   - alarm.escalate        → Multi-step alarm escalation with SLA tracking
 *   - calibration.schedule  → Calibration scheduling and reminder workflow
 */

import { Client, Connection, WorkflowExecutionInfo, WorkflowExecutionDescription } from "@temporalio/client";

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? "";
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE ?? "default";
const TEMPORAL_TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE ?? "og-rmm-main";

let temporalClient: Client | null = null;

/**
 * Get or create the Temporal client singleton.
 * Returns null when TEMPORAL_ADDRESS is not configured.
 */
export async function getTemporalClient(): Promise<Client | null> {
  if (!TEMPORAL_ADDRESS) {
    console.warn("[Temporal] TEMPORAL_ADDRESS not set — running in simulation mode");
    return null;
  }

  if (temporalClient) return temporalClient;

  try {
    const connection = await Connection.connect({ address: TEMPORAL_ADDRESS });
    temporalClient = new Client({ connection, namespace: TEMPORAL_NAMESPACE });
    console.log(`[Temporal] Connected to ${TEMPORAL_ADDRESS} (namespace: ${TEMPORAL_NAMESPACE})`);
    return temporalClient;
  } catch (err) {
    console.error("[Temporal] Connection failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── WORKFLOW TYPES ───────────────────────────────────────────────────────────

export interface WorkoverWorkflowInput {
  workoverJobId: string;
  wellId: string;
  jobType: string;
  estimatedDays: number;
  estimatedCost: number;
  contractor: string;
  description: string;
  requestedBy: string;
}

export interface WorkflowStatus {
  workflowId: string;
  runId: string;
  status: "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "TIMED_OUT" | "SIMULATED";
  startTime: string;
  closeTime?: string;
  workflowType: string;
  taskQueue: string;
}

// ─── WORKFLOW OPERATIONS ──────────────────────────────────────────────────────

/**
 * Start a workover execution workflow.
 * Returns a workflow handle with workflowId and runId.
 */
export async function startWorkoverWorkflow(
  input: WorkoverWorkflowInput
): Promise<{ workflowId: string; runId: string; simulated: boolean }> {
  const client = await getTemporalClient();

  if (!client) {
    // Simulation mode: return a deterministic fake workflow ID
    const workflowId = `sim-workover-${input.workoverJobId}-${Date.now()}`;
    console.log(`[Temporal] Simulated workflow started: ${workflowId}`);
    return { workflowId, runId: `sim-run-${Date.now()}`, simulated: true };
  }

  const workflowId = `workover-${input.workoverJobId}`;

  try {
    const handle = await client.workflow.start("workoverExecute", {
      taskQueue: TEMPORAL_TASK_QUEUE,
      workflowId,
      args: [input],
    });

    return { workflowId: handle.workflowId, runId: handle.firstExecutionRunId, simulated: false };
  } catch (err) {
    console.error("[Temporal] Failed to start workflow:", err instanceof Error ? err.message : err);
    // Fallback to simulation on error
    return {
      workflowId: `fallback-${workflowId}-${Date.now()}`,
      runId: `fallback-run-${Date.now()}`,
      simulated: true,
    };
  }
}

/**
 * Cancel a running workflow.
 */
export async function cancelWorkflow(workflowId: string): Promise<boolean> {
  const client = await getTemporalClient();
  if (!client) {
    console.log(`[Temporal] Simulated cancel: ${workflowId}`);
    return true;
  }

  try {
    const handle = client.workflow.getHandle(workflowId);
    await handle.cancel();
    return true;
  } catch (err) {
    console.error("[Temporal] Cancel failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * List recent workflows for a given workflow type.
 * Returns simulated data when Temporal is not available.
 */
export async function listWorkflows(
  workflowType?: string,
  limit = 20
): Promise<WorkflowStatus[]> {
  const client = await getTemporalClient();

  if (!client) {
    // Return simulated workflow list for UI development
    return generateSimulatedWorkflows(limit);
  }

  try {
    const results: WorkflowStatus[] = [];
    const query = workflowType
      ? `WorkflowType = "${workflowType}"`
      : undefined;

    for await (const workflow of client.workflow.list({ query, pageSize: limit })) {
      results.push(mapWorkflowInfo(workflow));
      if (results.length >= limit) break;
    }

    return results;
  } catch (err) {
    console.error("[Temporal] List workflows failed:", err instanceof Error ? err.message : err);
    return generateSimulatedWorkflows(limit);
  }
}

/**
 * Query a specific workflow's status.
 */
export async function getWorkflowStatus(workflowId: string): Promise<WorkflowStatus | null> {
  const client = await getTemporalClient();

  if (!client) {
    return {
      workflowId,
      runId: `sim-run-${workflowId}`,
      status: "SIMULATED",
      startTime: new Date().toISOString(),
      workflowType: "workoverExecute",
      taskQueue: TEMPORAL_TASK_QUEUE,
    };
  }

  try {
    const handle = client.workflow.getHandle(workflowId);
    const desc = await handle.describe();
    return mapWorkflowInfo(desc);
  } catch {
    return null;
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function mapWorkflowInfo(info: WorkflowExecutionInfo | WorkflowExecutionDescription): WorkflowStatus {
  const statusMap: Record<string, WorkflowStatus["status"]> = {
    Running: "RUNNING",
    Completed: "COMPLETED",
    Failed: "FAILED",
    Cancelled: "CANCELLED",
    TimedOut: "TIMED_OUT",
    Terminated: "CANCELLED",
    ContinuedAsNew: "RUNNING",
  };

  const rawStatus = info.status?.name ?? "Running";
  return {
    workflowId: info.workflowId,
    runId: info.runId,
    status: statusMap[rawStatus] ?? "RUNNING",
    startTime: info.startTime?.toISOString() ?? new Date().toISOString(),
    closeTime: info.closeTime?.toISOString(),
    workflowType: info.type ?? "unknown",
    taskQueue: info.taskQueue ?? TEMPORAL_TASK_QUEUE,
  };
}

const SIMULATED_WELL_IDS = ["PB-047", "PB-052", "KW-001", "UAE-001", "GOM-001"];
const SIMULATED_JOB_TYPES = ["PUMP_CHANGE", "TUBING_REPLACEMENT", "ACIDIZING", "PERFORATION", "WELLBORE_CLEANOUT"];
const SIMULATED_STATUSES: WorkflowStatus["status"][] = ["RUNNING", "RUNNING", "COMPLETED", "COMPLETED", "FAILED", "CANCELLED"];

function generateSimulatedWorkflows(count: number): WorkflowStatus[] {
  return Array.from({ length: Math.min(count, 12) }, (_, i) => {
    const wellId = SIMULATED_WELL_IDS[i % SIMULATED_WELL_IDS.length];
    const jobType = SIMULATED_JOB_TYPES[i % SIMULATED_JOB_TYPES.length];
    const status = SIMULATED_STATUSES[i % SIMULATED_STATUSES.length];
    const startTime = new Date(Date.now() - (i + 1) * 3 * 3600 * 1000);
    const closeTime = status !== "RUNNING"
      ? new Date(startTime.getTime() + (i + 1) * 1800 * 1000).toISOString()
      : undefined;

    return {
      workflowId: `sim-workover-WO-${String(1000 + i).padStart(4, "0")}`,
      runId: `sim-run-${i + 1}`,
      status,
      startTime: startTime.toISOString(),
      closeTime,
      workflowType: "workoverExecute",
      taskQueue: TEMPORAL_TASK_QUEUE,
    };
  });
}

// ─── INCIDENT TRIAGE WORKFLOW ─────────────────────────────────────────────────

export interface IncidentTriageWorkflowInput {
  eventId: string;
  severity: number;
  target: string;
  eventType: string;
  triageId: number;
}

/**
 * Start an IncidentTriageWorkflow via Temporal.
 * Falls back to simulation when Temporal is unavailable.
 */
export async function startIncidentTriageWorkflow(
  input: IncidentTriageWorkflowInput
): Promise<{ workflowId: string; runId: string; simulated: boolean }> {
  const client = await getTemporalClient();
  if (!client) {
    const workflowId = `incident-triage-sim-${input.eventId}-${Date.now()}`;
    console.log(`[Temporal] Simulated IncidentTriageWorkflow: ${workflowId}`);
    return { workflowId, runId: `run-sim-${Date.now()}`, simulated: true };
  }
  try {
    const workflowId = `incident-triage-${input.eventId}-${Date.now()}`;
    const handle = await (client as any).start("IncidentTriageWorkflow", {
      taskQueue: TEMPORAL_TASK_QUEUE,
      workflowId,
      args: [input],
    });
    console.log(`[Temporal] Started IncidentTriageWorkflow: ${workflowId}`);
    return { workflowId: handle.workflowId, runId: handle.firstExecutionRunId, simulated: false };
  } catch (err) {
    console.error("[Temporal] startIncidentTriageWorkflow failed:", err);
    const workflowId = `incident-triage-err-${input.eventId}-${Date.now()}`;
    return { workflowId, runId: `run-err-${Date.now()}`, simulated: true };
  }
}

/**
 * Returns whether Temporal is in live mode (TEMPORAL_ADDRESS is configured).
 */
export function isTemporalLive(): boolean {
  return !!TEMPORAL_ADDRESS;
}

/**
 * Returns the configured Temporal address.
 */
export function getTemporalAddress(): string {
  return TEMPORAL_ADDRESS || "not configured";
}
