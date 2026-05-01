/**
 * Temporal Worker Registration — NDSEP
 * Registers all workflow and activity implementations with the Temporal server.
 *
 * Prerequisites:
 *   1. Run a Temporal server: docker run --rm -p 7233:7233 temporalio/auto-setup:latest
 *   2. Install deps: pnpm add @temporalio/worker @temporalio/workflow @temporalio/activity @temporalio/client
 *   3. Start this worker: npx ts-node workers/temporal/worker.ts
 *
 * Environment variables:
 *   TEMPORAL_ADDRESS  — default: localhost:7233
 *   TEMPORAL_NAMESPACE — default: default
 */

// ─── Stub implementation (replace with actual Temporal imports when deploying) ─

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE ?? "default";

export const temporalConfig = {
  address: TEMPORAL_ADDRESS,
  namespace: TEMPORAL_NAMESPACE,
  taskQueues: {
    accreditation: "ndsep-accreditation",
    breach: "ndsep-breach",
    car: "ndsep-car",
    dsar: "ndsep-dsar",
  },
};

/**
 * Start the Temporal worker.
 * Uncomment and adapt when @temporalio/worker is installed.
 */
export async function startTemporalWorker(): Promise<void> {
  console.log(`[Temporal] Worker stub — connect to ${TEMPORAL_ADDRESS} namespace=${TEMPORAL_NAMESPACE}`);
  console.log("[Temporal] Install @temporalio/worker and uncomment the implementation below.");

  // ── Actual implementation (uncomment when @temporalio/worker is installed) ──
  //
  // const { Worker } = await import("@temporalio/worker");
  // const worker = await Worker.create({
  //   workflowsPath: require.resolve("./workflows"),
  //   activities: {
  //     ...accreditationActivities,
  //     ...breachNotificationActivities,
  //     ...dsarActivities,
  //     ...carActivities,
  //   },
  //   taskQueue: temporalConfig.taskQueues.accreditation,
  //   connection: await NativeConnection.connect({ address: TEMPORAL_ADDRESS }),
  //   namespace: TEMPORAL_NAMESPACE,
  // });
  // await worker.run();
}

/**
 * Temporal client helper for starting workflows from tRPC procedures.
 * Returns a stub client when Temporal is not available.
 */
export async function getTemporalClient() {
  try {
    // Attempt real connection
    // const { Client, Connection } = await import("@temporalio/client");
    // const connection = await Connection.connect({ address: TEMPORAL_ADDRESS });
    // return new Client({ connection, namespace: TEMPORAL_NAMESPACE });
    return null; // stub
  } catch {
    console.warn("[Temporal] Client unavailable — workflows will not be orchestrated");
    return null;
  }
}

/**
 * Start an accreditation workflow.
 * No-ops gracefully when Temporal is not available.
 */
export async function startAccreditationWorkflow(params: {
  applicationId: number;
  dpcoOrgId: number;
  applicantEmail: string;
}): Promise<{ workflowId: string | null }> {
  const client = await getTemporalClient();
  if (!client) {
    console.log(`[Temporal] Stub: would start accreditation workflow for application ${params.applicationId}`);
    return { workflowId: null };
  }
  // const handle = await client.workflow.start("accreditationWorkflow", {
  //   taskQueue: temporalConfig.taskQueues.accreditation,
  //   workflowId: `accreditation-${params.applicationId}`,
  //   args: [{ applicationId: params.applicationId, dpcoOrgId: params.dpcoOrgId, applicantEmail: params.applicantEmail, submittedAt: new Date().toISOString() }],
  // });
  // return { workflowId: handle.workflowId };
  return { workflowId: null };
}

/**
 * Start a breach notification workflow.
 * No-ops gracefully when Temporal is not available.
 */
export async function startBreachNotificationWorkflow(params: {
  breachId: number;
  orgId: number;
  dpoEmail: string;
  ceoEmail: string;
  severity: "low" | "medium" | "high" | "critical";
  estimatedAffectedRecords: number;
}): Promise<{ workflowId: string | null }> {
  const client = await getTemporalClient();
  if (!client) {
    console.log(`[Temporal] Stub: would start breach notification workflow for breach ${params.breachId}`);
    return { workflowId: null };
  }
  return { workflowId: null };
}

if (require.main === module) {
  startTemporalWorker().catch(console.error);
}
