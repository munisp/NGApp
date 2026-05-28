/**
 * External Service Connectivity Health Checker
 * Validates all external service connections at startup and on-demand.
 * Services use ENV defaults and fall back to simulation mode gracefully.
 */

import { ENV } from "./env";

export type ServiceStatus = "connected" | "degraded" | "offline" | "simulated";

export interface ServiceHealth {
  name: string;
  url: string;
  status: ServiceStatus;
  latencyMs?: number;
  error?: string;
  simulationMode: boolean;
}

const DEFAULT_TIMEOUT_MS = 3000;

async function pingHttp(url: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal, method: "GET" });
    clearTimeout(timer);
    return { ok: res.status < 500, latencyMs: Date.now() - start };
  } catch (err: unknown) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function isSimulationDefault(value: string, defaultSuffix: string): boolean {
  return value.includes("mock") || value.includes("default") || value.endsWith(defaultSuffix);
}

export async function checkAllServices(): Promise<ServiceHealth[]> {
  const checks: Array<{ name: string; url: string; simulationMode: boolean }> = [
    {
      name: "InfluxDB",
      url: `${ENV.influxdbUrl}/health`,
      simulationMode: isSimulationDefault(ENV.influxdbUrl, "8086") && ENV.influxdbToken.includes("default"),
    },
    {
      name: "Redis",
      url: `${ENV.redisUrl.replace("redis://", "http://")}/ping`,
      simulationMode: ENV.redisUrl.includes("default") || ENV.redisUrl === "redis://redis:6379",
    },
    {
      name: "OpenCTI",
      url: `${ENV.openCtiUrl}/health`,
      simulationMode: ENV.openCtiToken.includes("default"),
    },
    {
      name: "Grafana OnCall",
      url: ENV.grafanaOnCallUrl,
      simulationMode: ENV.grafanaOnCallToken.includes("default"),
    },
    {
      name: "TDengine",
      url: `${ENV.tdengineUrl}/rest/login/root/taosdata`,
      simulationMode: ENV.tdengineUrl === "http://tdengine:6041",
    },
    {
      name: "OpenSearch",
      url: `${ENV.openSearchUrl}/_cluster/health`,
      simulationMode: ENV.openSearchUrl === "http://opensearch:9200",
    },
    {
      name: "EdgeX Core Data",
      url: `${ENV.edgexCoreDataUrl}/api/v3/ping`,
      simulationMode: ENV.edgexCoreDataUrl.includes("edgex-core-data"),
    },
    {
      name: "SAP S/4HANA",
      url: `${ENV.sapBaseUrl}/sap/opu/odata/sap/API_BUSINESS_PARTNER/$metadata`,
      simulationMode: ENV.sapBaseUrl.includes("mock") || ENV.sapPassword.includes("default"),
    },
    {
      name: "Oracle ERP Cloud",
      url: `${ENV.oracleBaseUrl}/fscmRestApi/resources/11.13.18.05/purchaseOrders`,
      simulationMode: ENV.oracleClientSecret.includes("default"),
    },
  ];

  const results = await Promise.allSettled(
    checks.map(async (svc) => {
      if (svc.simulationMode) {
        return {
          name: svc.name,
          url: svc.url,
          status: "simulated" as ServiceStatus,
          simulationMode: true,
        };
      }
      const ping = await pingHttp(svc.url);
      return {
        name: svc.name,
        url: svc.url,
        status: ping.ok ? ("connected" as ServiceStatus) : ("offline" as ServiceStatus),
        latencyMs: ping.latencyMs,
        error: ping.error,
        simulationMode: false,
      };
    })
  );

  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      name: checks[i].name,
      url: checks[i].url,
      status: "offline" as ServiceStatus,
      simulationMode: checks[i].simulationMode,
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    };
  });
}

export async function logConnectivityStatus(): Promise<void> {
  const services = await checkAllServices();
  const connected = services.filter((s) => s.status === "connected").length;
  const simulated = services.filter((s) => s.status === "simulated").length;
  const offline = services.filter((s) => s.status === "offline").length;

  console.log(
    `[Connectivity] ${connected} live | ${simulated} simulated | ${offline} offline — ${services.length} external services checked`
  );

  for (const svc of services) {
    const icon = svc.status === "connected" ? "✓" : svc.status === "simulated" ? "~" : "✗";
    const latency = svc.latencyMs ? ` (${svc.latencyMs}ms)` : "";
    const err = svc.error ? ` — ${svc.error}` : "";
    console.log(`  [${icon}] ${svc.name}: ${svc.status}${latency}${err}`);
  }
}
