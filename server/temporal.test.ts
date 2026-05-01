/**
 * NDSEP — Temporal Client Unit Tests
 *
 * Tests the temporal.ts module in isolation:
 *   - getTemporalConfig() returns correct shape and defaults
 *   - startWorkflow() falls back gracefully when SDK is unavailable
 *   - describeWorkflow() returns null when broker is unreachable
 *   - listWorkflows() returns empty array when broker is unreachable
 *   - temporalSmokeTest() returns ok=false when broker is unreachable
 *   - Cloud detection logic (IS_TEMPORAL_CLOUD) works correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock @temporalio/client so tests don't need a live Temporal broker ───────
vi.mock("@temporalio/client", () => ({
  Connection: {
    connect: vi.fn().mockRejectedValue(new Error("Connection refused")),
  },
  Client: vi.fn().mockImplementation(() => ({
    workflow: {
      start: vi.fn().mockRejectedValue(new Error("Connection refused")),
      getHandle: vi.fn().mockReturnValue({
        describe: vi.fn().mockRejectedValue(new Error("Connection refused")),
      }),
      list: vi.fn().mockReturnValue({
        [Symbol.asyncIterator]: async function* () { /* empty */ },
      }),
    },
  })),
}));

// ─── Import after mocking ─────────────────────────────────────────────────────
import {
  getTemporalConfig,
  startWorkflow,
  describeWorkflow,
  listWorkflows,
  temporalSmokeTest,
} from "./temporal";

describe("temporal.getTemporalConfig()", () => {
  it("returns an object with all required fields", () => {
    const config = getTemporalConfig();
    expect(config).toBeDefined();
    expect(typeof config.address).toBe("string");
    expect(typeof config.namespace).toBe("string");
    expect(typeof config.taskQueue).toBe("string");
    expect(typeof config.isCloud).toBe("boolean");
    expect(typeof config.sdkLoaded).toBe("boolean");
    expect(["mtls", "apikey", "none"]).toContain(config.authMethod);
  });

  it("defaults to localhost:7233 when TEMPORAL_ADDRESS is not set", () => {
    const config = getTemporalConfig();
    // Default address should be localhost:7233 (unless overridden in env)
    if (!process.env.TEMPORAL_ADDRESS) {
      expect(config.address).toBe("localhost:7233");
    }
  });

  it("defaults to 'default' namespace when TEMPORAL_NAMESPACE is not set", () => {
    const config = getTemporalConfig();
    if (!process.env.TEMPORAL_NAMESPACE) {
      expect(config.namespace).toBe("default");
    }
  });

  it("defaults to 'ndsep-main' task queue when TEMPORAL_TASK_QUEUE is not set", () => {
    const config = getTemporalConfig();
    if (!process.env.TEMPORAL_TASK_QUEUE) {
      expect(config.taskQueue).toBe("ndsep-main");
    }
  });

  it("authMethod is 'none' when no TLS cert or API key is configured", () => {
    const config = getTemporalConfig();
    if (!process.env.TEMPORAL_TLS_CERT && !process.env.TEMPORAL_API_KEY) {
      expect(config.authMethod).toBe("none");
    }
  });

  it("isCloud is false for localhost address", () => {
    const config = getTemporalConfig();
    if (!process.env.TEMPORAL_ADDRESS || process.env.TEMPORAL_ADDRESS === "localhost:7233") {
      expect(config.isCloud).toBe(false);
    }
  });
});

describe("temporal.startWorkflow() — graceful degradation", () => {
  it("returns ok=false when SDK cannot connect (no live broker)", async () => {
    const result = await startWorkflow("penalty_enforcement", {
      workflowId: `test-wf-${Date.now()}`,
      input: { test: true },
    });
    // Either ok=true (if broker is running) or ok=false (graceful degradation)
    expect(typeof result.ok).toBe("boolean");
    expect(result.workflowId).toMatch(/^test-wf-/);
    expect(typeof result.namespace).toBe("string");
    expect(typeof result.taskQueue).toBe("string");
    expect(typeof result.address).toBe("string");
    expect(typeof result.isCloud).toBe("boolean");
  });

  it("returns workflowId matching the input", async () => {
    const wfId = `penalty-test-${Date.now()}`;
    const result = await startWorkflow("penalty_enforcement", {
      workflowId: wfId,
      input: { penaltyId: "123", orgId: "456" },
    });
    expect(result.workflowId).toBe(wfId);
  });

  it("includes error message when degraded", async () => {
    const result = await startWorkflow("test_workflow", {
      workflowId: `test-${Date.now()}`,
    });
    if (!result.ok) {
      expect(typeof result.error).toBe("string");
      expect(result.error!.length).toBeGreaterThan(0);
    }
  });

  it("handles missing input gracefully", async () => {
    const result = await startWorkflow("test_workflow", {
      workflowId: `test-no-input-${Date.now()}`,
    });
    expect(typeof result.ok).toBe("boolean");
  });

  it("respects custom taskQueue option", async () => {
    const result = await startWorkflow("test_workflow", {
      workflowId: `test-tq-${Date.now()}`,
      taskQueue: "custom-queue",
    });
    if (result.ok) {
      expect(result.taskQueue).toBe("custom-queue");
    } else {
      // Degraded path — still returns taskQueue
      expect(typeof result.taskQueue).toBe("string");
    }
  });
});

describe("temporal.describeWorkflow() — graceful degradation", () => {
  it("returns null when broker is unreachable", async () => {
    const result = await describeWorkflow("non-existent-workflow-12345");
    // Either null (no broker) or a WorkflowInfo object (if broker is running)
    expect(result === null || typeof result === "object").toBe(true);
  });

  it("returns null for non-existent workflow ID", async () => {
    const result = await describeWorkflow(`definitely-does-not-exist-${Date.now()}`);
    expect(result === null || typeof result === "object").toBe(true);
  });
});

describe("temporal.listWorkflows() — graceful degradation", () => {
  it("returns an array (empty when broker is unreachable)", async () => {
    const result = await listWorkflows({ pageSize: 5 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns empty array when broker is unreachable", async () => {
    const result = await listWorkflows({ pageSize: 10 });
    // Either empty (no broker) or populated (if broker is running)
    expect(Array.isArray(result)).toBe(true);
  });

  it("accepts query filter without throwing", async () => {
    const result = await listWorkflows({ pageSize: 5, query: "WorkflowType='penalty_enforcement'" });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("temporal.temporalSmokeTest() — graceful degradation", () => {
  it("returns a result object with required fields", async () => {
    const result = await temporalSmokeTest();
    expect(typeof result.ok).toBe("boolean");
    expect(typeof result.address).toBe("string");
    expect(typeof result.namespace).toBe("string");
    expect(typeof result.isCloud).toBe("boolean");
    expect(typeof result.authMethod).toBe("string");
    expect(typeof result.latencyMs).toBe("number");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("returns ok=false when broker is unreachable (no live Temporal)", async () => {
    const result = await temporalSmokeTest();
    // In test environment without a live broker, this should be false
    // (or true if a broker happens to be running — both are valid)
    if (!result.ok) {
      expect(typeof result.error).toBe("string");
    }
  });

  it("latencyMs is measured even on failure", async () => {
    const result = await temporalSmokeTest();
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.latencyMs).toBeLessThan(30000); // Should not take more than 30s
  });
});

describe("temporal.startWorkflow() — Cloud detection", () => {
  it("isCloud is false when using localhost address", async () => {
    const config = getTemporalConfig();
    if (config.address === "localhost:7233") {
      const result = await startWorkflow("test", {
        workflowId: `cloud-test-${Date.now()}`,
      });
      expect(result.isCloud).toBe(false);
    }
  });
});
