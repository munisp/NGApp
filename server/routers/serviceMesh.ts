import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

export const serviceMeshRouter = router({
  dashboard: protectedProcedure.query(() => {
    return {
      totalServices: 12,
      healthyServices: 11,
      degradedServices: 1,
      circuitBreakers: [
        { service: "bank-integration", state: "closed", failureRate: 2.1, threshold: 50, halfOpenAt: null },
        { service: "sms-gateway", state: "half-open", failureRate: 48.5, threshold: 50, halfOpenAt: new Date(Date.now() - 60000).toISOString() },
        { service: "fraud-ml-service", state: "closed", failureRate: 0.5, threshold: 30, halfOpenAt: null },
        { service: "settlement-engine", state: "closed", failureRate: 1.2, threshold: 40, halfOpenAt: null },
      ],
      loadBalancing: [
        { service: "api-gateway", algorithm: "round-robin", instances: 3, activeConnections: 450, requestsPerSec: 1250 },
        { service: "pos-terminal", algorithm: "least-connections", instances: 5, activeConnections: 320, requestsPerSec: 980 },
        { service: "fraud-detection", algorithm: "weighted-round-robin", instances: 3, activeConnections: 180, requestsPerSec: 890 },
      ],
      serviceRegistry: [
        { name: "api-gateway", version: "3.2.1", instances: 3, status: "healthy", lastHeartbeat: new Date().toISOString() },
        { name: "pos-terminal-service", version: "2.8.0", instances: 5, status: "healthy", lastHeartbeat: new Date().toISOString() },
        { name: "fraud-detection", version: "4.1.0", instances: 3, status: "healthy", lastHeartbeat: new Date().toISOString() },
        { name: "settlement-engine", version: "2.5.3", instances: 2, status: "healthy", lastHeartbeat: new Date().toISOString() },
        { name: "sms-gateway", version: "1.3.2", instances: 2, status: "degraded", lastHeartbeat: new Date(Date.now() - 30000).toISOString() },
        { name: "ml-scoring", version: "5.0.0", instances: 4, status: "healthy", lastHeartbeat: new Date().toISOString() },
      ],
    };
  }),

  toggleCircuitBreaker: protectedProcedure.input(z.object({
    service: z.string(),
    action: z.enum(["open", "close", "half-open"]),
  })).mutation(({ input }) => {
    return { service: input.service, newState: input.action, updatedAt: new Date().toISOString() };
  }),

  healthCheck: protectedProcedure.input(z.object({ service: z.string() })).query(({ input }) => {
    return {
      service: input.service,
      status: "healthy",
      checks: [
        { name: "tcp_connect", status: "pass", duration: 2 },
        { name: "http_200", status: "pass", duration: 15 },
        { name: "database", status: "pass", duration: 8 },
        { name: "memory", status: "pass", value: "62%" },
        { name: "cpu", status: "pass", value: "35%" },
        { name: "disk", status: "pass", value: "45%" },
      ],
      lastChecked: new Date().toISOString(),
    };
  }),
});
