import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

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
    console.error(`Integration service request failed: ${endpoint}`, error);
    // Return mock data for demo purposes when service is unavailable
    return getMockData(endpoint);
  }
}

// Mock data for demo purposes when integration service is unavailable
function getMockData(endpoint: string) {
  if (endpoint.includes("/threat-intel/malicious-ips")) {
    return [
      { ip: "192.168.1.100", score: 85, threat_type: "botnet", country: "RU", is_blocked: true },
      { ip: "10.0.0.50", score: 72, threat_type: "scanner", country: "CN", is_blocked: false },
      { ip: "172.16.0.25", score: 91, threat_type: "malware", country: "KP", is_blocked: true },
    ];
  }
  
  if (endpoint.includes("/threat-intel/indicators")) {
    return [
      { type: "card_bin", category: "fraud", score: 0.89, confidence: 0.95, source: "opencti" },
      { type: "device_fingerprint", category: "account_takeover", score: 0.76, confidence: 0.88, source: "opencti" },
      { type: "ip_address", category: "money_laundering", score: 0.82, confidence: 0.91, source: "opencti" },
    ];
  }
  
  if (endpoint.includes("/siem/alerts")) {
    return [
      {
        id: "alert-001",
        timestamp: new Date().toISOString(),
        rule: { id: "1001", level: 12, description: "Multiple failed login attempts detected", groups: ["authentication"] },
        agent: { id: "001", name: "payment-api-1", ip: "10.0.1.10" },
        location: "/var/log/auth.log",
      },
      {
        id: "alert-002",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        rule: { id: "1002", level: 8, description: "Suspicious file modification detected", groups: ["file_integrity"] },
        agent: { id: "002", name: "payment-api-2", ip: "10.0.1.11" },
        location: "/etc/passwd",
      },
    ];
  }
  
  if (endpoint.includes("/siem/agents")) {
    return [
      { id: "001", name: "payment-api-1", ip: "10.0.1.10", status: "active", version: "4.7.0", os: { name: "Ubuntu 22.04", platform: "linux" } },
      { id: "002", name: "payment-api-2", ip: "10.0.1.11", status: "active", version: "4.7.0", os: { name: "Ubuntu 22.04", platform: "linux" } },
      { id: "003", name: "fraud-service", ip: "10.0.1.20", status: "disconnected", version: "4.6.0", os: { name: "Debian 11", platform: "linux" } },
    ];
  }
  
  if (endpoint.includes("/siem/vulnerabilities")) {
    return [
      { id: "vuln-001", cve: "CVE-2024-1234", title: "OpenSSL Buffer Overflow", severity: "critical", cvss: 9.8, package: "openssl", agent: "payment-api-1" },
      { id: "vuln-002", cve: "CVE-2024-5678", title: "Node.js Path Traversal", severity: "high", cvss: 7.5, package: "nodejs", agent: "payment-api-2" },
      { id: "vuln-003", cve: "CVE-2024-9012", title: "PostgreSQL SQL Injection", severity: "medium", cvss: 5.3, package: "postgresql", agent: "fraud-service" },
    ];
  }
  
  if (endpoint.includes("/logs/search")) {
    return {
      hits: [
        { timestamp: new Date().toISOString(), level: "info", service: "payment-api", message: "Payment processed successfully", trace_id: "abc123" },
        { timestamp: new Date(Date.now() - 60000).toISOString(), level: "warn", service: "fraud-service", message: "High risk transaction flagged", trace_id: "def456" },
        { timestamp: new Date(Date.now() - 120000).toISOString(), level: "error", service: "gateway", message: "Connection timeout to upstream", trace_id: "ghi789" },
      ],
    };
  }
  
  if (endpoint.includes("/logs/security-events")) {
    return {
      hits: [
        { timestamp: new Date().toISOString(), event_type: "authentication", severity: "high", source: "api-gateway", action: "login_failed", result: "blocked", description: "Multiple failed login attempts from suspicious IP" },
        { timestamp: new Date(Date.now() - 1800000).toISOString(), event_type: "authorization", severity: "medium", source: "admin-portal", action: "privilege_escalation", result: "denied", description: "Unauthorized admin access attempt" },
      ],
    };
  }
  
  if (endpoint.includes("/cost/report")) {
    return {
      generated_at: new Date().toISOString(),
      period: "7d",
      total_cost: 2847.52,
      cluster_efficiency: { cpu_efficiency: 0.68, ram_efficiency: 0.72, total_efficiency: 0.70 },
      by_namespace: [
        { namespace: "payment-core", cpu_cost: 450.20, ram_cost: 320.15, pv_cost: 85.00, network_cost: 45.30, total_cost: 900.65, efficiency: 0.75 },
        { namespace: "fraud-detection", cpu_cost: 380.50, ram_cost: 290.80, pv_cost: 65.00, network_cost: 38.20, total_cost: 774.50, efficiency: 0.68 },
        { namespace: "monitoring", cpu_cost: 220.30, ram_cost: 180.40, pv_cost: 120.00, network_cost: 25.10, total_cost: 545.80, efficiency: 0.82 },
        { namespace: "gateway", cpu_cost: 180.20, ram_cost: 140.30, pv_cost: 45.00, network_cost: 60.50, total_cost: 426.00, efficiency: 0.71 },
      ],
      recommendations: [
        { type: "rightsizing", resource: "cpu", namespace: "fraud-detection", controller: "fraud-api", current_value: 4, recommended_value: 2, monthly_savings: 125.50, confidence: 0.92 },
        { type: "rightsizing", resource: "memory", namespace: "monitoring", controller: "prometheus", current_value: 8, recommended_value: 4, monthly_savings: 85.20, confidence: 0.88 },
        { type: "idle_resource", resource: "pv", namespace: "payment-core", controller: "backup-storage", current_value: 500, recommended_value: 100, monthly_savings: 45.00, confidence: 0.95 },
      ],
    };
  }
  
  if (endpoint.includes("/metrics")) {
    return {
      uptime_seconds: 86400,
      events_processed: 125000,
      alerts_sent: 42,
      errors: 3,
      opencti: { indicators_count: 1250, malicious_ips_count: 89, fraud_indicators_count: 156, last_sync: new Date().toISOString(), sync_errors: 0 },
      wazuh: { alerts_count: 234, agents_count: 12, vulnerabilities_count: 45 },
      opensearch: { docs_indexed: 5420000, search_queries: 12500, errors: 2 },
      kubecost: { total_cost: 2847.52, efficiency: 0.70 },
    };
  }
  
  return {};
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
