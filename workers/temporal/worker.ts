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
 *   TEMPORAL_ADDRESS   — default: localhost:7233
 *   TEMPORAL_NAMESPACE — default: default
 *   TEMPORAL_TLS_CERT  — PEM client certificate (Temporal Cloud mTLS)
 *   TEMPORAL_TLS_KEY   — PEM client private key  (Temporal Cloud mTLS)
 *   TEMPORAL_API_KEY   — Temporal Cloud API key (alternative to mTLS)
 */

import { logger } from "../../server/logger";

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE ?? "default";
const TEMPORAL_TLS_CERT = process.env.TEMPORAL_TLS_CERT;
const TEMPORAL_TLS_KEY = process.env.TEMPORAL_TLS_KEY;
const TEMPORAL_API_KEY = process.env.TEMPORAL_API_KEY;

const IS_TEMPORAL_CLOUD =
  TEMPORAL_ADDRESS.includes(".tmprl.cloud") ||
  !!(TEMPORAL_TLS_CERT && TEMPORAL_TLS_KEY) ||
  !!TEMPORAL_API_KEY;

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
 * Dynamically imports @temporalio/worker — if not installed, logs and exits.
 */
export async function startTemporalWorker(): Promise<void> {
  logger.info(
    { address: TEMPORAL_ADDRESS, namespace: TEMPORAL_NAMESPACE, isCloud: IS_TEMPORAL_CLOUD },
    "[Temporal] Starting worker"
  );

  let Worker: typeof import("@temporalio/worker").Worker;
  let NativeConnection: typeof import("@temporalio/worker").NativeConnection;
  try {
    const mod = await import("@temporalio/worker");
    Worker = mod.Worker;
    NativeConnection = mod.NativeConnection;
  } catch {
    logger.warn(
      "[Temporal] @temporalio/worker not installed — worker cannot start. " +
      "Install with: pnpm add @temporalio/worker @temporalio/workflow @temporalio/activity"
    );
    return;
  }

  const connectionOptions: Record<string, unknown> = { address: TEMPORAL_ADDRESS };
  if (IS_TEMPORAL_CLOUD) {
    if (TEMPORAL_TLS_CERT && TEMPORAL_TLS_KEY) {
      connectionOptions.tls = {
        clientCertPair: {
          crt: Buffer.from(TEMPORAL_TLS_CERT),
          key: Buffer.from(TEMPORAL_TLS_KEY),
        },
      };
    } else if (TEMPORAL_API_KEY) {
      connectionOptions.apiKey = TEMPORAL_API_KEY;
      connectionOptions.tls = {};
    }
  }

  const connection = await NativeConnection.connect(
    connectionOptions as Parameters<typeof NativeConnection.connect>[0]
  );

  const worker = await Worker.create({
    workflowsPath: require.resolve("./workflows"),
    taskQueue: temporalConfig.taskQueues.accreditation,
    connection,
    namespace: TEMPORAL_NAMESPACE,
  });

  logger.info(
    { taskQueue: temporalConfig.taskQueues.accreditation, namespace: TEMPORAL_NAMESPACE },
    "[Temporal] Worker started — listening for tasks"
  );

  await worker.run();
}

/**
 * Temporal client helper for starting workflows.
 * Dynamically imports @temporalio/client — returns null if unavailable.
 */
export async function getTemporalClient() {
  try {
    const { Client, Connection } = await import("@temporalio/client");

    const connectionOptions: Record<string, unknown> = { address: TEMPORAL_ADDRESS };
    if (IS_TEMPORAL_CLOUD) {
      if (TEMPORAL_TLS_CERT && TEMPORAL_TLS_KEY) {
        connectionOptions.tls = {
          clientCertPair: {
            crt: Buffer.from(TEMPORAL_TLS_CERT),
            key: Buffer.from(TEMPORAL_TLS_KEY),
          },
        };
      } else if (TEMPORAL_API_KEY) {
        connectionOptions.apiKey = TEMPORAL_API_KEY;
        connectionOptions.tls = {};
      }
    }

    const connection = await Connection.connect(
      connectionOptions as Parameters<typeof Connection.connect>[0]
    );
    return new Client({ connection, namespace: TEMPORAL_NAMESPACE });
  } catch {
    logger.warn("[Temporal] Client unavailable — workflows will not be orchestrated");
    return null;
  }
}

/**
 * Start an accreditation workflow.
 * Gracefully degrades when Temporal is not available.
 */
export async function startAccreditationWorkflow(params: {
  applicationId: number;
  dpcoOrgId: number;
  applicantEmail: string;
}): Promise<{ workflowId: string | null }> {
  const client = await getTemporalClient();
  if (!client) {
    logger.info(
      { applicationId: params.applicationId },
      "[Temporal] Client unavailable — accreditation workflow not started"
    );
    return { workflowId: null };
  }

  const workflowId = `accreditation-${params.applicationId}`;
  const handle = await client.workflow.start("accreditationWorkflow", {
    taskQueue: temporalConfig.taskQueues.accreditation,
    workflowId,
    args: [{
      applicationId: params.applicationId,
      dpcoOrgId: params.dpcoOrgId,
      applicantEmail: params.applicantEmail,
      submittedAt: new Date().toISOString(),
    }],
  });
  return { workflowId: handle.workflowId };
}

/**
 * Start a breach notification workflow.
 * Gracefully degrades when Temporal is not available.
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
    logger.info(
      { breachId: params.breachId },
      "[Temporal] Client unavailable — breach notification workflow not started"
    );
    return { workflowId: null };
  }

  const workflowId = `breach-notification-${params.breachId}`;
  const handle = await client.workflow.start("breachNotificationWorkflow", {
    taskQueue: temporalConfig.taskQueues.breach,
    workflowId,
    args: [{
      breachId: params.breachId,
      orgId: params.orgId,
      dpoEmail: params.dpoEmail,
      ceoEmail: params.ceoEmail,
      severity: params.severity,
      estimatedAffectedRecords: params.estimatedAffectedRecords,
      detectedAt: new Date().toISOString(),
    }],
  });
  return { workflowId: handle.workflowId };
}

if (require.main === module) {
  startTemporalWorker().catch(console.error);
}
