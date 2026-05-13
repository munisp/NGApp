import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createChildLogger } from '../lib/logger';

const log = createChildLogger('integrations');

// Integration service URL - in production this would be configured via environment
const INTEGRATION_SERVICE_URL = process.env.INTEGRATION_SERVICE_URL || "http://localhost:8090";

// Helper to make requests to the integration service
async function fetchIntegrationService(endpoint: string, options?: RequestInit) {
  try {
    const response = await fetch(`${INTEGRATION_SERVICE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Integration service error: ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    log.error({ endpoint, err: error }, 'Integration service request failed');
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Integration service unavailable for ${endpoint}. Ensure INTEGRATION_SERVICE_URL is configured and the service is running.`,
      cause: error,
    });
  }
}

// Admin procedure - requires admin role
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const integrationsRouter = router({
  // OpenCTI - Threat Intelligence
  threatIntel: router({
    getMaliciousIPs: adminProcedure.query(async () => {
      return fetchIntegrationService("/api/v1/threat-intel/malicious-ips");
    }),
    
    getIndicators: adminProcedure.query(async () => {
      return fetchIntegrationService("/api/v1/threat-intel/indicators");
    }),
    
    triggerSync: adminProcedure.mutation(async () => {
      return fetchIntegrationService("/api/v1/threat-intel/sync", { method: "POST" });
    }),
  }),
  
  // Wazuh - SIEM
  siem: router({
    getAlerts: adminProcedure.query(async () => {
      return fetchIntegrationService("/api/v1/siem/alerts");
    }),
    
    getAgents: adminProcedure.query(async () => {
      return fetchIntegrationService("/api/v1/siem/agents");
    }),
    
    getVulnerabilities: adminProcedure.query(async () => {
      return fetchIntegrationService("/api/v1/siem/vulnerabilities");
    }),
  }),
  
  // OpenSearch - Log Analytics
  logs: router({
    search: adminProcedure
      .input(z.object({
        service: z.string().optional(),
        level: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.number().optional().default(100),
      }))
      .query(async ({ input }) => {
        const params = new URLSearchParams();
        if (input.service) params.set("service", input.service);
        if (input.level) params.set("level", input.level);
        return fetchIntegrationService(`/api/v1/logs/search?${params}`);
      }),
    
    getSecurityEvents: adminProcedure
      .input(z.object({
        severity: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const params = new URLSearchParams();
        if (input.severity) params.set("severity", input.severity);
        return fetchIntegrationService(`/api/v1/logs/security-events?${params}`);
      }),
    
    getTransactions: adminProcedure.query(async () => {
      return fetchIntegrationService("/api/v1/logs/transactions");
    }),
  }),
  
  // Kubecost - Cost Monitoring
  cost: router({
    getReport: adminProcedure.query(async () => {
      return fetchIntegrationService("/api/v1/cost/report");
    }),
    
    getByNamespace: adminProcedure.query(async () => {
      return fetchIntegrationService("/api/v1/cost/by-namespace");
    }),
    
    getRecommendations: adminProcedure.query(async () => {
      return fetchIntegrationService("/api/v1/cost/recommendations");
    }),
    
    getEfficiency: adminProcedure.query(async () => {
      return fetchIntegrationService("/api/v1/cost/efficiency");
    }),
  }),
  
  // Unified metrics
  getMetrics: adminProcedure.query(async () => {
    return fetchIntegrationService("/api/v1/metrics");
  }),
  
  // Health check
  health: adminProcedure.query(async () => {
    return fetchIntegrationService("/health");
  }),
});
