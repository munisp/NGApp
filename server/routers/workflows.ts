/**
 * server/routers/workflows.ts — tRPC router for Temporal workflow management
 *
 * Exposes workflow lifecycle operations: start, status, signal, terminate.
 * Communicates with the Go middleware worker's internal HTTP API.
 * Falls back to simulated data when the Go worker is unavailable.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

const WORKER_URL = process.env.GO_WORKER_URL ?? "http://localhost:8090";
const WORKER_ENABLED = process.env.GO_WORKER_ENABLED !== "false";

// ─── Types ─────────────────────────────────────────────────────────────────────

export const WORKFLOW_TYPES = {
  PTW: "PTWWorkflow",
  OTA_CAMPAIGN: "OTACampaignWorkflow",
  REGULATORY_SUBMISSION: "RegulatorySubmissionWorkflow",
} as const;

interface WorkflowStatus {
  workflowId: string;
  status: string;
  startTime: string | null;
  closeTime: string | null;
  type: string;
  lastSignal?: string;
}

// ─── HTTP helper ───────────────────────────────────────────────────────────────

async function workerFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${WORKER_URL}/v1${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    signal: AbortSignal.timeout(5000),
  });
}

// ─── Simulated workflow store ─────────────────────────────────────────────────

const simulatedWorkflows: Map<string, WorkflowStatus> = new Map();

function simulateWorkflow(type: string, input: unknown): string {
  const id = `${type}-${Date.now()}`;
  simulatedWorkflows.set(id, {
    workflowId: id,
    status: "RUNNING",
    startTime: new Date().toISOString(),
    closeTime: null,
    type,
  });
  return id;
}

// ─── Exported helpers for testing ───────────────────────────────────────────

export async function getWorkflowList(input: { workflowType?: string; limit?: number }) {
  try {
    const res = await workerFetch("/workflows");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { workflows: WorkflowStatus[]; total: number };
    return { ...data, source: "temporal" };
  } catch {
    const demos: WorkflowStatus[] = [
      { workflowId: "PTWWorkflow-demo-001", status: "RUNNING", startTime: new Date(Date.now() - 3600000).toISOString(), closeTime: null, type: WORKFLOW_TYPES.PTW },
      { workflowId: "OTACampaignWorkflow-demo-001", status: "COMPLETED", startTime: new Date(Date.now() - 86400000).toISOString(), closeTime: new Date(Date.now() - 82800000).toISOString(), type: WORKFLOW_TYPES.OTA_CAMPAIGN },
    ];
    const filtered = input.workflowType ? demos.filter((w) => w.type === input.workflowType) : demos;
    return { workflows: filtered.slice(0, input.limit ?? 20), total: filtered.length, source: "simulated" };
  }
}

// ─── Router ────────────────────────────────────────────────────────────────────

export const workflowsRouter = router({
  /**
   * Start a new workflow instance.
   */
  start: protectedProcedure
    .input(
      z.object({
        workflowType: z.enum([
          WORKFLOW_TYPES.PTW,
          WORKFLOW_TYPES.OTA_CAMPAIGN,
          WORKFLOW_TYPES.REGULATORY_SUBMISSION,
        ]),
        input: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (!WORKER_ENABLED) {
        const id = simulateWorkflow(input.workflowType, input.input);
        return { workflowId: id };
      }
      try {
        const res = await workerFetch("/workflows/start", {
          method: "POST",
          body: JSON.stringify({
            workflowType: input.workflowType,
            input: input.input ?? {},
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json() as { workflowId: string };
      } catch {
        const id = simulateWorkflow(input.workflowType, input.input);
        return { workflowId: id };
      }
    }),

  /**
   * Get the status of a workflow instance.
   */
  getStatus: protectedProcedure
    .input(z.object({ workflowId: z.string() }))
    .query(async ({ input }) => {
      if (!WORKER_ENABLED) {
        const wf = simulatedWorkflows.get(input.workflowId);
        return wf ?? { workflowId: input.workflowId, status: "NOT_FOUND", startTime: null, closeTime: null, type: "Unknown" };
      }
      try {
        const res = await workerFetch(`/workflows/${encodeURIComponent(input.workflowId)}/status`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json() as WorkflowStatus;
      } catch {
        const wf = simulatedWorkflows.get(input.workflowId);
        return wf ?? { workflowId: input.workflowId, status: "UNAVAILABLE", startTime: null, closeTime: null, type: "Unknown" };
      }
    }),

  /**
   * List all known workflow instances (simulated + active).
   */
  list: protectedProcedure
    .input(
      z.object({
        workflowType: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ input }) => {
      // Return simulated workflows + some demo entries
      const demos: WorkflowStatus[] = [
        {
          workflowId: "PTWWorkflow-demo-001",
          status: "RUNNING",
          startTime: new Date(Date.now() - 3600000).toISOString(),
          closeTime: null,
          type: WORKFLOW_TYPES.PTW,
        },
        {
          workflowId: "OTACampaignWorkflow-demo-001",
          status: "COMPLETED",
          startTime: new Date(Date.now() - 86400000).toISOString(),
          closeTime: new Date(Date.now() - 82800000).toISOString(),
          type: WORKFLOW_TYPES.OTA_CAMPAIGN,
        },
        {
          workflowId: "RegulatorySubmissionWorkflow-demo-001",
          status: "RUNNING",
          startTime: new Date(Date.now() - 7200000).toISOString(),
          closeTime: null,
          type: WORKFLOW_TYPES.REGULATORY_SUBMISSION,
        },
      ];

      const active = Array.from(simulatedWorkflows.values());
      const all = [...demos, ...active];

      const filtered = input.workflowType
        ? all.filter((w) => w.type === input.workflowType)
        : all;

      return {
        workflows: filtered.slice(0, input.limit),
        total: filtered.length,
      };
    }),

  /**
   * Send a signal to a running workflow.
   */
  signal: protectedProcedure
    .input(
      z.object({
        workflowId: z.string(),
        signal: z.string(),
        payload: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (!WORKER_ENABLED) {
        const wf = simulatedWorkflows.get(input.workflowId);
        if (wf) {
          wf.lastSignal = input.signal;
          if (["ptw.close", "regulatory.callback"].includes(input.signal)) {
            wf.status = "COMPLETED";
            wf.closeTime = new Date().toISOString();
          }
        }
        return { status: "signalled" };
      }
      try {
        const res = await workerFetch(`/workflows/${encodeURIComponent(input.workflowId)}/signal`, {
          method: "POST",
          body: JSON.stringify({ signal: input.signal, payload: input.payload ?? {} }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json() as { status: string };
      } catch {
        return { status: "simulated" };
      }
    }),

  /**
   * Terminate a running workflow.
   */
  terminate: protectedProcedure
    .input(
      z.object({
        workflowId: z.string(),
        reason: z.string().default("terminated by operator"),
      })
    )
    .mutation(async ({ input }) => {
      if (!WORKER_ENABLED) {
        const wf = simulatedWorkflows.get(input.workflowId);
        if (wf) {
          wf.status = "TERMINATED";
          wf.closeTime = new Date().toISOString();
        }
        return { status: "terminated" };
      }
      try {
        const res = await workerFetch(
          `/workflows/${encodeURIComponent(input.workflowId)}?reason=${encodeURIComponent(input.reason)}`,
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json() as { status: string };
      } catch {
        return { status: "simulated" };
      }
    }),
});
