// G3: Swagger UI per microservice — auto-generated OpenAPI specs
import type { Express, Request, Response } from "express";

interface ServiceOpenAPI {
  service: string; port: number; language: string;
  openapi: string; info: { title: string; version: string; description: string };
  paths: Record<string, Record<string, { summary: string; tags: string[] }>>;
}

function generateServiceSpec(name: string, port: number, lang: string, endpoints: string[]): ServiceOpenAPI {
  const paths: Record<string, Record<string, { summary: string; tags: string[] }>> = {};
  for (const ep of endpoints) {
    const method = ep.startsWith("POST") ? "post" : "get";
    const path = ep.replace(/^(GET|POST|PUT|DELETE)\s+/, "");
    paths[path] = { [method]: { summary: `${name} - ${path}`, tags: [name] } };
  }
  return {
    service: name, port, language: lang,
    openapi: "3.0.3",
    info: { title: `54Bank ${name} API`, version: "1.0.0", description: `${name} microservice (${lang} on :${port})` },
    paths,
  };
}

const serviceSpecs: ServiceOpenAPI[] = [
  generateServiceSpec("escrow", 8186, "go", ["GET /v1/escrow/list", "GET /v1/escrow/healthz", "GET /v1/escrow/stats", "POST /v1/escrow/create"]),
  generateServiceSpec("qr-payments", 8187, "go", ["GET /v1/qr-payments/list", "GET /v1/qr-payments/healthz", "POST /v1/qr-payments/generate"]),
  generateServiceSpec("chatbot", 8179, "python", ["GET /v1/chatbot/list", "POST /v1/chatbot/classify", "GET /v1/chatbot/healthz"]),
  generateServiceSpec("insurance", 8194, "python", ["GET /v1/insurance/list", "GET /v1/insurance/healthz", "POST /v1/insurance/claims"]),
  generateServiceSpec("interest-rate-engine", 8131, "go", ["GET /v1/interest-rates/list", "GET /v1/interest-rates/healthz"]),
  generateServiceSpec("risk-scoring", 8145, "rust", ["GET /v1/risk-scoring/list", "GET /v1/risk-scoring/healthz", "POST /v1/risk-scoring/assess"]),
  generateServiceSpec("salary-processing", 8150, "go", ["GET /v1/salary/list", "POST /v1/salary/batch", "GET /v1/salary/healthz"]),
  generateServiceSpec("credit-bureau", 8151, "rust", ["GET /v1/credit-bureau/list", "POST /v1/credit-bureau/check", "GET /v1/credit-bureau/healthz"]),
];

export function registerSwaggerPerService(app: Express) {
  app.get("/api/platform/swagger/services", (_: Request, res: Response) => {
    res.json({ items: serviceSpecs.map(s => ({ service: s.service, port: s.port, language: s.language, endpoint_count: Object.keys(s.paths).length })), total: serviceSpecs.length });
  });

  app.get("/api/platform/swagger/:serviceName", (req: Request, res: Response) => {
    const spec = serviceSpecs.find(s => s.service === req.params.serviceName);
    if (!spec) return res.status(404).json({ error: "Service not found", available: serviceSpecs.map(s => s.service) });
    res.json(spec);
  });
}
