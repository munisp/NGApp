/**
 * Microservice Registry & Proxy Layer
 *
 * Maps the 33 standalone microservices to their ports and provides
 * a generic HTTP proxy function that tRPC routers can use to forward
 * requests to live microservice instances when they are running.
 *
 * If a microservice is not running, the proxy returns null so callers
 * can fall back to the database layer.
 */

export interface MicroserviceConfig {
  name: string;
  port: number;
  healthPath: string;
  basePath: string;
  stack: "go" | "python" | "typescript" | "rust";
}

export const SERVICES: Record<string, MicroserviceConfig> = {
  // Pillar 1 - Accessibility & Distribution
  "ussd-gateway":          { name: "USSD Gateway",              port: 8090, healthPath: "/health",           basePath: "/api/v1/ussd",          stack: "go" },
  "whatsapp-bot":          { name: "WhatsApp Bot",              port: 8091, healthPath: "/health",           basePath: "/api/v1/whatsapp",      stack: "go" },
  "mobile-money":          { name: "Mobile Money Service",      port: 8092, healthPath: "/health",           basePath: "/api/v1/mobile-money",  stack: "go" },
  "agent-network":         { name: "Agent Network Platform",    port: 8093, healthPath: "/health",           basePath: "/api/v1/agents",        stack: "go" },
  "embedded-sdk":          { name: "Embedded Insurance SDK",    port: 8094, healthPath: "/health",           basePath: "/api/v1/embedded",      stack: "typescript" },

  // Pillar 2 - Product Innovation
  "microinsurance":        { name: "Microinsurance Engine",     port: 8095, healthPath: "/health",           basePath: "/api/v1/microinsurance", stack: "go" },
  "parametric":            { name: "Parametric Insurance",      port: 8096, healthPath: "/health",           basePath: "/api/v1/parametric",    stack: "rust" },
  "product-builder":       { name: "No-Code Product Builder",   port: 8097, healthPath: "/health",           basePath: "/api/v1/products",      stack: "go" },
  "usage-based":           { name: "Usage-Based Insurance",     port: 8098, healthPath: "/health",           basePath: "/api/v1/ubi",           stack: "go" },
  "takaful":               { name: "Takaful Module",            port: 8099, healthPath: "/health",           basePath: "/api/v1/takaful",       stack: "go" },

  // Pillar 3 - AI & Intelligence
  "ai-claims":             { name: "AI Claims Engine",          port: 8200, healthPath: "/health",           basePath: "/api/v1/ai-claims",     stack: "python" },
  "ai-underwriting":       { name: "AI Underwriting Engine",    port: 8201, healthPath: "/health",           basePath: "/api/v1/ai-underwriting", stack: "python" },
  "fraud-detection":       { name: "Neural Fraud Detection",    port: 8202, healthPath: "/health",           basePath: "/api/v1/fraud",         stack: "rust" },
  "ai-chatbot":            { name: "AI Chatbot",                port: 8100, healthPath: "/health",           basePath: "/api/v1/chatbot",       stack: "typescript" },
  "predictive-analytics":  { name: "Predictive Analytics",      port: 8203, healthPath: "/health",           basePath: "/api/v1/analytics",     stack: "python" },

  // Pillar 4 - Financial Infrastructure
  "instant-payout":        { name: "Instant Payout Service",    port: 8101, healthPath: "/health",           basePath: "/api/v1/payouts",       stack: "go" },
  "multi-currency":        { name: "Multi-Currency Service",    port: 8102, healthPath: "/health",           basePath: "/api/v1/currency",      stack: "go" },
  "premium-finance":       { name: "Premium Finance Service",   port: 8103, healthPath: "/health",           basePath: "/api/v1/premium-finance", stack: "go" },
  "blockchain":            { name: "Blockchain Transparency",   port: 8104, healthPath: "/health",           basePath: "/api/v1/blockchain",    stack: "go" },

  // Pillar 5 - Regulatory & Compliance
  "multi-country":         { name: "Multi-Country Regulatory",  port: 8105, healthPath: "/health",           basePath: "/api/v1/regulatory",    stack: "go" },
  "ifrs17":                { name: "IFRS 17 Engine",            port: 8210, healthPath: "/health",           basePath: "/api/v1/ifrs17",        stack: "python" },
  "pan-african-ekyc":      { name: "Pan-African eKYC",          port: 8106, healthPath: "/health",           basePath: "/api/v1/ekyc",          stack: "go" },

  // Pillar 6 - Customer Experience
  "multi-language":        { name: "Multi-Language Service",    port: 8108, healthPath: "/health",           basePath: "/api/v1/i18n",          stack: "go" },
  "notification":          { name: "Notification Service",      port: 8109, healthPath: "/health",           basePath: "/api/v1/notifications", stack: "go" },
  "gamification":          { name: "Gamification Service",      port: 8110, healthPath: "/health",           basePath: "/api/v1/gamification",  stack: "go" },

  // Pillar 7 - Data & Analytics
  "lakehouse":             { name: "Lakehouse Analytics",       port: 8211, healthPath: "/health",           basePath: "/api/v1/lakehouse",     stack: "python" },
  "actuarial":             { name: "Actuarial Platform",        port: 8212, healthPath: "/health",           basePath: "/api/v1/actuarial",     stack: "python" },
  "api-marketplace":       { name: "API Marketplace",           port: 8111, healthPath: "/health",           basePath: "/api/v1/marketplace",   stack: "go" },

  // Pillar 8 - Operational Excellence
  "multi-tenant":          { name: "Multi-Tenant Platform",     port: 8112, healthPath: "/health",           basePath: "/api/v1/tenants",       stack: "go" },
  "dr-ha":                 { name: "DR/HA Service",             port: 8113, healthPath: "/health",           basePath: "/api/v1/dr",            stack: "go" },
  "performance-gateway":   { name: "Performance Gateway",       port: 8114, healthPath: "/health",           basePath: "/api/v1/performance",   stack: "rust" },
  "devops":                { name: "DevOps Platform",           port: 8115, healthPath: "/health",           basePath: "/api/v1/devops",        stack: "go" },
};

const serviceStatus = new Map<string, { alive: boolean; checkedAt: number }>();
const HEALTH_CHECK_TTL_MS = 30_000; // cache health status for 30s

/**
 * Check if a microservice is reachable. Caches results for 30s.
 */
export async function isServiceAlive(serviceKey: string): Promise<boolean> {
  const config = SERVICES[serviceKey];
  if (!config) return false;

  const cached = serviceStatus.get(serviceKey);
  if (cached && Date.now() - cached.checkedAt < HEALTH_CHECK_TTL_MS) {
    return cached.alive;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`http://localhost:${config.port}${config.healthPath}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const alive = res.ok;
    serviceStatus.set(serviceKey, { alive, checkedAt: Date.now() });
    return alive;
  } catch {
    serviceStatus.set(serviceKey, { alive: false, checkedAt: Date.now() });
    return false;
  }
}

/**
 * Proxy a GET request to a microservice endpoint.
 * Returns the parsed JSON body, or null if the service is unavailable.
 */
export async function proxyGet<T = unknown>(
  serviceKey: string,
  path: string,
  headers?: Record<string, string>,
): Promise<T | null> {
  const config = SERVICES[serviceKey];
  if (!config) return null;

  const alive = await isServiceAlive(serviceKey);
  if (!alive) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const url = `http://localhost:${config.port}${config.basePath}${path}`;
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...headers },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Proxy a POST request to a microservice endpoint.
 * Returns the parsed JSON body, or null if the service is unavailable.
 */
export async function proxyPost<T = unknown>(
  serviceKey: string,
  path: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<T | null> {
  const config = SERVICES[serviceKey];
  if (!config) return null;

  const alive = await isServiceAlive(serviceKey);
  if (!alive) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const url = `http://localhost:${config.port}${config.basePath}${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Get the status of all registered microservices.
 */
export async function getAllServiceStatuses(): Promise<
  Array<{ key: string; name: string; port: number; stack: string; alive: boolean }>
> {
  const results = await Promise.all(
    Object.entries(SERVICES).map(async ([key, config]) => ({
      key,
      name: config.name,
      port: config.port,
      stack: config.stack,
      alive: await isServiceAlive(key),
    })),
  );
  return results;
}

/**
 * Clear cached health check for a service (useful after starting a service).
 */
export function invalidateHealthCache(serviceKey?: string): void {
  if (serviceKey) {
    serviceStatus.delete(serviceKey);
  } else {
    serviceStatus.clear();
  }
}
