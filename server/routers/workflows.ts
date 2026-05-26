/**
 * server/routers/workflows.ts — tRPC router for Temporal workflow management
 *
 * Exposes workflow lifecycle operations: start, status, signal, terminate.
 * Communicates with the Go middleware worker's internal HTTP API.
 * Requires the Go worker to be running — throws SERVICE_UNAVAILABLE if not.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

const WORKER_URL = process.env.GO_WORKER_URL ?? "http://localhost:8090";

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
  const res = await fetch(`${WORKER_URL}/v1${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    signal: AbortSignal.timeout(5000),
  });
  return res;
}

function workerError(message: string): TRPCError {
  return new TRPCError({
    code: "SERVICE_UNAVAILABLE",
    message: `Temporal workflow service unavailable: ${message}. Ensure Go worker is running at ${WORKER_URL}`,
  });
}

// ─── Exported helpers for testing ───────────────────────────────────────────

export async function getWorkflowList(input: { workflowType?: string; limit?: number }) {
  try {
    const res = await workerFetch("/workflows");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { workflows: WorkflowStatus[]; total: number };
    const filtered = input.workflowType
      ? data.workflows.filter(w => w.type === input.workflowType)
      : data.workflows;
    return { workflows: filtered.slice(0, input.limit ?? 20), total: filtered.length, source: "temporal" };
  } catch (err) {
    throw workerError(err instanceof Error ? err.message : "connection failed");
  }
}

// ─── Router ────────────────────────────────────────────────────────────────────

export const workflowsRouter = router({
  /**
   * Start a new workflow instance via the Go worker → Temporal.
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
      try {
        const res = await workerFetch("/workflows/start", {
          method: "POST",
          body: JSON.stringify({
            workflowType: input.workflowType,
            input: input.input ?? {},
          }),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status}: ${errText}`);
        }
        return await res.json() as { workflowId: string };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw workerError(err instanceof Error ? err.message : "start failed");
      }
    }),

  /**
   * Get the status of a workflow instance.
   */
  getStatus: protectedProcedure
    .input(z.object({ workflowId: z.string() }))
    .query(async ({ input }) => {
      try {
        const res = await workerFetch(`/workflows/${encodeURIComponent(input.workflowId)}/status`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new TRPCError({ code: "NOT_FOUND", message: `Workflow ${input.workflowId} not found` });
          }
          throw new Error(`HTTP ${res.status}`);
        }
        return await res.json() as WorkflowStatus;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw workerError(err instanceof Error ? err.message : "status query failed");
      }
    }),

  /**
   * List all workflow instances from Temporal via the Go worker.
   */
  list: protectedProcedure
    .input(
      z.object({
        workflowType: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ input }) => {
      return getWorkflowList(input);
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
      try {
        const res = await workerFetch(`/workflows/${encodeURIComponent(input.workflowId)}/signal`, {
          method: "POST",
          body: JSON.stringify({ signal: input.signal, payload: input.payload ?? {} }),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status}: ${errText}`);
        }
        return await res.json() as { status: string };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw workerError(err instanceof Error ? err.message : "signal failed");
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
      try {
        const res = await workerFetch(
          `/workflows/${encodeURIComponent(input.workflowId)}?reason=${encodeURIComponent(input.reason)}`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status}: ${errText}`);
        }
        return await res.json() as { status: string };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw workerError(err instanceof Error ? err.message : "terminate failed");
      }
    }),
});
