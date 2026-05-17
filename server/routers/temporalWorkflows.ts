/**
 * Temporal Workflow Management tRPC Router
 *
 * Exposes Temporal workflow operations:
 *   - List running/completed workflows
 *   - Start a workflow (settlement, float replenishment, KYC, dispute)
 *   - Signal a running workflow
 *   - Query workflow state
 *   - Terminate a workflow
 *   - Get workflow history
 *
 * Uses the Temporal HTTP API (via Go gateway) when available.
 * Falls back gracefully when Temporal is offline.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

const TEMPORAL_HTTP_URL = process.env.TEMPORAL_HTTP_URL ?? "http://temporal:7233";
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE ?? "54link-production";
const TEMPORAL_TIMEOUT_MS = 5000;

async function temporalFetch(path: string, opts?: RequestInit): Promise<unknown> {
  try {
    const res = await fetch(`${TEMPORAL_HTTP_URL}${path}`, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(opts?.headers ?? {}),
      },
      signal: AbortSignal.timeout(TEMPORAL_TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Temporal error ${res.status}: ${body}` });
    }
    return res.json();
  } catch (err) {
    if (err instanceof TRPCError) throw err;
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Temporal server unavailable",
    });
  }
}

// Well-known workflow types for the 54Link platform
const WORKFLOW_TYPES = [
  { type: "SettlementWorkflow", description: "Daily settlement batch processing", taskQueue: "settlement-queue" },
  { type: "FloatReplenishmentWorkflow", description: "Agent float top-up approval and transfer", taskQueue: "settlement-queue" },
  { type: "KYCApprovalWorkflow", description: "KYC document review and approval", taskQueue: "kyc-queue" },
  { type: "DisputeResolutionWorkflow", description: "Dispute investigation and resolution", taskQueue: "dispute-queue" },
  { type: "CommissionPayoutWorkflow", description: "Commission calculation and payout", taskQueue: "settlement-queue" },
  { type: "AgentOnboardingWorkflow", description: "Agent onboarding 5-step process", taskQueue: "onboarding-queue" },
];

export const temporalWorkflowsRouter = router({
  /** List workflows (running, completed, failed) */
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["RUNNING", "COMPLETED", "FAILED", "CANCELED", "TERMINATED", "TIMED_OUT"]).optional(),
      workflowType: z.string().optional(),
      limit: z.number().min(1).max(100).default(20),
      nextPageToken: z.string().optional(),
    }))
    .query(async ({ input }) => {
      try {
        const query = [
          input.status ? `ExecutionStatus="${input.status}"` : "",
          input.workflowType ? `WorkflowType="${input.workflowType}"` : "",
        ].filter(Boolean).join(" AND ") || "WorkflowType!=\"\"";

        const params = new URLSearchParams({
          namespace: TEMPORAL_NAMESPACE,
          query,
          pageSize: String(input.limit),
        });
        if (input.nextPageToken) params.set("nextPageToken", input.nextPageToken);

        const data = await temporalFetch(
          `/api/v1/namespaces/${TEMPORAL_NAMESPACE}/workflows?${params}`
        ) as {
          executions: Array<{
            execution: { workflowId: string; runId: string };
            type: { name: string };
            startTime: string;
            closeTime?: string;
            status: string;
            historyLength: number;
          }>;
          nextPageToken?: string;
        };
        return { workflows: data.executions, nextPageToken: data.nextPageToken, source: "live" as const };
      } catch {
        return { workflows: [], nextPageToken: undefined, source: "offline" as const };
      }
    }),

  /** Start a new workflow */
  start: protectedProcedure
    .input(z.object({
      workflowType: z.string(),
      workflowId: z.string().optional(),
      taskQueue: z.string().optional(),
      input: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input }) => {
      const wfType = WORKFLOW_TYPES.find(w => w.type === input.workflowType);
      const workflowId = input.workflowId ?? `${input.workflowType}-${Date.now()}`;
      const taskQueue = input.taskQueue ?? wfType?.taskQueue ?? "settlement-queue";
      try {
        await temporalFetch(
          `/api/v1/namespaces/${TEMPORAL_NAMESPACE}/workflows`,
          {
            method: "POST",
            body: JSON.stringify({
              workflowId,
              workflowType: { name: input.workflowType },
              taskQueue: { name: taskQueue },
              input: input.input ? { payloads: [{ data: Buffer.from(JSON.stringify(input.input)).toString("base64") }] } : undefined,
            }),
          }
        );
        return { started: true, workflowId, taskQueue };
      } catch {
        return { started: false, workflowId, error: "Temporal unavailable" };
      }
    }),

  /** Signal a running workflow */
  signal: protectedProcedure
    .input(z.object({
      workflowId: z.string(),
      runId: z.string().optional(),
      signalName: z.string(),
      payload: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        await temporalFetch(
          `/api/v1/namespaces/${TEMPORAL_NAMESPACE}/workflows/${input.workflowId}/signal`,
          {
            method: "POST",
            body: JSON.stringify({
              workflowExecution: { workflowId: input.workflowId, runId: input.runId },
              signalName: input.signalName,
              input: input.payload ? { payloads: [{ data: Buffer.from(JSON.stringify(input.payload)).toString("base64") }] } : undefined,
            }),
          }
        );
        return { signaled: true };
      } catch {
        return { signaled: false, error: "Temporal unavailable" };
      }
    }),

  /** Query a workflow's current state */
  query: protectedProcedure
    .input(z.object({
      workflowId: z.string(),
      runId: z.string().optional(),
      queryType: z.string().default("getState"),
    }))
    .query(async ({ input }) => {
      try {
        const data = await temporalFetch(
          `/api/v1/namespaces/${TEMPORAL_NAMESPACE}/workflows/${input.workflowId}/query/${input.queryType}`,
          { method: "POST", body: JSON.stringify({}) }
        ) as { queryResult?: { payloads?: Array<{ data?: string }> } };
        const payload = data.queryResult?.payloads?.[0]?.data;
        const state = payload ? JSON.parse(Buffer.from(payload, "base64").toString()) : null;
        return { state, workflowId: input.workflowId };
      } catch {
        return { state: null, workflowId: input.workflowId, error: "Temporal unavailable" };
      }
    }),

  /** Terminate a workflow */
  terminate: protectedProcedure
    .input(z.object({
      workflowId: z.string(),
      runId: z.string().optional(),
      reason: z.string().default("Terminated by admin"),
    }))
    .mutation(async ({ input }) => {
      try {
        await temporalFetch(
          `/api/v1/namespaces/${TEMPORAL_NAMESPACE}/workflows/${input.workflowId}/terminate`,
          {
            method: "POST",
            body: JSON.stringify({ reason: input.reason }),
          }
        );
        return { terminated: true };
      } catch {
        return { terminated: false, error: "Temporal unavailable" };
      }
    }),

  /** Get workflow history events */
  history: protectedProcedure
    .input(z.object({
      workflowId: z.string(),
      runId: z.string().optional(),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input }) => {
      try {
        const params = new URLSearchParams({
          maximumPageSize: String(input.limit),
        });
        const data = await temporalFetch(
          `/api/v1/namespaces/${TEMPORAL_NAMESPACE}/workflows/${input.workflowId}/history?${params}`
        ) as { history?: { events?: unknown[] } };
        return { events: data.history?.events ?? [], workflowId: input.workflowId };
      } catch {
        return { events: [], workflowId: input.workflowId, error: "Temporal unavailable" };
      }
    }),

  /** Get available workflow types */
  workflowTypes: protectedProcedure.query(async () => {
    return { types: WORKFLOW_TYPES };
  }),

  /** Temporal server health */
  health: protectedProcedure.query(async () => {
    try {
      await temporalFetch(`/api/v1/namespaces/${TEMPORAL_NAMESPACE}`);
      return { healthy: true, namespace: TEMPORAL_NAMESPACE, address: TEMPORAL_HTTP_URL };
    } catch {
      return { healthy: false, namespace: TEMPORAL_NAMESPACE, address: TEMPORAL_HTTP_URL };
    }
  }),

  /** Summary: running count, failed count, health */
  summary: protectedProcedure.query(async () => {
    try {
      const [running, failed] = await Promise.all([
        temporalFetch(`/api/v1/namespaces/${TEMPORAL_NAMESPACE}/workflows?query=ExecutionStatus%3D%22RUNNING%22&pageSize=1`) as Promise<{ count?: number }>,
        temporalFetch(`/api/v1/namespaces/${TEMPORAL_NAMESPACE}/workflows?query=ExecutionStatus%3D%22FAILED%22&pageSize=1`) as Promise<{ count?: number }>,
      ]);
      return {
        healthy: true,
        running: (running as any).executions?.length ?? 0,
        failed: (failed as any).executions?.length ?? 0,
        namespace: TEMPORAL_NAMESPACE,
      };
    } catch {
      return { healthy: false, running: 0, failed: 0, namespace: TEMPORAL_NAMESPACE };
    }
  }),
});
