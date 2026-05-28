/**
 * temporal.ts — Temporal workflow client for durable workover state machines
 *
 * Connects to the Temporal server defined in docker-compose.yml.
 * Requires TEMPORAL_ADDRESS to be set. Throws on connection failure.
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
 * Throws when TEMPORAL_ADDRESS is not configured or connection fails.
 */
export async function getTemporalClient(): Promise<Client> {
  if (!TEMPORAL_ADDRESS) {
    throw new Error("[Temporal] TEMPORAL_ADDRESS not configured. Set the environment variable to connect.");
  }

  if (temporalClient) return temporalClient;

  const connection = await Connection.connect({ address: TEMPORAL_ADDRESS });
  temporalClient = new Client({ connection, namespace: TEMPORAL_NAMESPACE });
  console.log(`[Temporal] Connected to ${TEMPORAL_ADDRESS} (namespace: ${TEMPORAL_NAMESPACE})`);
  return temporalClient;
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
  status: "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "TIMED_OUT";
  startTime: string;
  closeTime?: string;
  workflowType: string;
  taskQueue: string;
}

// ─── WORKFLOW OPERATIONS ──────────────────────────────────────────────────────

/**
 * Start a workover execution workflow.
 */
export async function startWorkoverWorkflow(
  input: WorkoverWorkflowInput
): Promise<{ workflowId: string; runId: string }> {
  const client = await getTemporalClient();
  const workflowId = `workover-${input.workoverJobId}`;

  const handle = await client.workflow.start("workoverExecute", {
    taskQueue: TEMPORAL_TASK_QUEUE,
    workflowId,
    args: [input],
  });

  return { workflowId: handle.workflowId, runId: handle.firstExecutionRunId };
}

/**
 * Cancel a running workflow.
 */
export async function cancelWorkflow(workflowId: string): Promise<boolean> {
  const client = await getTemporalClient();
  const handle = client.workflow.getHandle(workflowId);
  await handle.cancel();
  return true;
}

/**
 * List recent workflows for a given workflow type.
 */
export async function listWorkflows(
  workflowType?: string,
  limit = 20
): Promise<WorkflowStatus[]> {
  const client = await getTemporalClient();
  const results: WorkflowStatus[] = [];
  const query = workflowType
    ? `WorkflowType = "${workflowType}"`
    : undefined;

  for await (const workflow of client.workflow.list({ query, pageSize: limit })) {
    results.push(mapWorkflowInfo(workflow));
    if (results.length >= limit) break;
  }

  return results;
}

/**
 * Query a specific workflow's status.
 */
export async function getWorkflowStatus(workflowId: string): Promise<WorkflowStatus | null> {
  const client = await getTemporalClient();

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
 */
export async function startIncidentTriageWorkflow(
  input: IncidentTriageWorkflowInput
): Promise<{ workflowId: string; runId: string }> {
  const client = await getTemporalClient();
  const workflowId = `incident-triage-${input.eventId}-${Date.now()}`;
  const handle = await client.workflow.start("IncidentTriageWorkflow", {
    taskQueue: TEMPORAL_TASK_QUEUE,
    workflowId,
    args: [input],
  });
  console.log(`[Temporal] Started IncidentTriageWorkflow: ${workflowId}`);
  return { workflowId: handle.workflowId, runId: handle.firstExecutionRunId };
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
