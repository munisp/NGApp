import { describe, it, expect, beforeAll, afterAll } from "vitest";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

async function fetchJSON(path: string) {
  const res = await fetch(`${BASE_URL}${path}`);
  expect(res.status).toBe(200);
  return res.json();
}

describe("Platform Health", () => {
  it("should return platform health status", async () => {
    const data = await fetchJSON("/api/health");
    expect(data).toBeDefined();
  });
});

describe("Core Banking APIs", () => {
  it("should list customers with Nigerian seed data", async () => {
    const data = await fetchJSON("/api/customers");
    expect(data.items).toBeDefined();
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items[0]).toHaveProperty("customerId");
    expect(data.items[0]).toHaveProperty("bvn");
  });

  it("should list accounts", async () => {
    const data = await fetchJSON("/api/accounts");
    expect(data.items).toBeDefined();
  });

  it("should list transfers", async () => {
    const data = await fetchJSON("/api/transfers");
    expect(data.items).toBeDefined();
  });

  it("should list loans", async () => {
    const data = await fetchJSON("/api/loans");
    expect(data.items).toBeDefined();
  });
});

describe("Middleware APIs", () => {
  it("should return APISIX routes", async () => {
    const data = await fetchJSON("/api/platform/apisix/routes");
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items[0]).toHaveProperty("uri");
    expect(data.items[0]).toHaveProperty("upstream");
  });

  it("should return OpenAppSec WAF rules", async () => {
    const data = await fetchJSON("/api/platform/openappsec/rules");
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items[0]).toHaveProperty("category");
    expect(data.items[0]).toHaveProperty("mlConfidence");
  });

  it("should return Keycloak realms", async () => {
    const data = await fetchJSON("/api/platform/keycloak/realms");
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items[0].name).toBe("54bank");
    expect(data.items[0].mfaEnforced).toBe(true);
  });

  it("should return Keycloak clients", async () => {
    const data = await fetchJSON("/api/platform/keycloak/clients");
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items.find((c: any) => c.clientId === "54bank-pwa")).toBeDefined();
  });
});

describe("Postgres Optimization APIs", () => {
  it("should return query profiles", async () => {
    const data = await fetchJSON("/api/platform/postgres/query-profiles");
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items[0]).toHaveProperty("hitRatio");
  });

  it("should return index advisories", async () => {
    const data = await fetchJSON("/api/platform/postgres/index-advisories");
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items[0]).toHaveProperty("createStatement");
  });

  it("should return connection pool stats", async () => {
    const data = await fetchJSON("/api/platform/postgres/connection-pools");
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items[0]).toHaveProperty("poolMode");
  });

  it("should return slow queries", async () => {
    const data = await fetchJSON("/api/platform/postgres/slow-queries");
    expect(data.items.length).toBeGreaterThan(0);
  });

  it("should return table stats", async () => {
    const data = await fetchJSON("/api/platform/postgres/table-stats");
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items[0]).toHaveProperty("bloatPct");
  });

  it("should return tuning parameters", async () => {
    const data = await fetchJSON("/api/platform/postgres/tuning-params");
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items[0]).toHaveProperty("recommendedValue");
  });
});

describe("Service Mesh", () => {
  it("should return service registry", async () => {
    const data = await fetchJSON("/api/platform/service-mesh/registry");
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.healthy).toBeGreaterThan(0);
  });

  it("should return proxy routes", async () => {
    const data = await fetchJSON("/api/platform/service-mesh/proxy-routes");
    expect(data.items.length).toBeGreaterThan(0);
  });
});

describe("Observability", () => {
  it("should return Grafana dashboards", async () => {
    const data = await fetchJSON("/api/platform/observability/grafana-dashboards");
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items[0]).toHaveProperty("uid");
  });

  it("should return alert rules", async () => {
    const data = await fetchJSON("/api/platform/observability/alert-rules");
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items[0]).toHaveProperty("expression");
  });

  it("should return Prometheus metrics", async () => {
    const data = await fetchJSON("/api/platform/observability/prometheus-metrics");
    expect(data.items.length).toBeGreaterThan(0);
  });
});

describe("Mojaloop Interoperability", () => {
  it("should return Mojaloop participants", async () => {
    const data = await fetchJSON("/api/mojaloop/participants");
    expect(data.items).toBeDefined();
  });

  it("should return settlement windows", async () => {
    const data = await fetchJSON("/api/mojaloop/settlement-windows");
    expect(data.items).toBeDefined();
  });
});

describe("TigerBeetle ↔ Postgres Sync", () => {
  it("should return sync configs", async () => {
    const data = await fetchJSON("/api/platform/tigerbeetle-sync/configs");
    expect(data.items).toBeDefined();
  });

  it("should return reconciliation runs", async () => {
    const data = await fetchJSON("/api/platform/tigerbeetle-sync/reconciliation-configs");
    expect(data.items).toBeDefined();
  });
});

describe("Security & Resilience", () => {
  it("should return circuit breaker states", async () => {
    const data = await fetchJSON("/api/platform/circuit-breaker/services");
    expect(data.items).toBeDefined();
  });
});
