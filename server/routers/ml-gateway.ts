import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";

const ML_GATEWAY_URL = process.env.ML_GATEWAY_URL || "http://127.0.0.1:8119";

async function mlRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${ML_GATEWAY_URL}${endpoint}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "ML service unavailable" }));
    throw new Error(error.detail || `ML request failed: ${response.status}`);
  }
  return response.json();
}

export const mlGatewayRouter = router({
  getServices: publicProcedure.query(async () => {
    return mlRequest<{ services: Record<string, unknown>; total: number }>("/services");
  }),

  healthCheck: publicProcedure.query(async () => {
    return mlRequest<{ results: Record<string, { healthy: boolean; latency_ms: number }> }>("/services/health/all");
  }),

  predict: protectedProcedure
    .input(z.object({
      service: z.string(),
      model: z.string(),
      input_data: z.record(z.unknown()),
      options: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ input }) => {
      return mlRequest("/predict", { method: "POST", body: JSON.stringify(input) });
    }),

  batchPredict: protectedProcedure
    .input(z.object({
      service: z.string(),
      model: z.string(),
      inputs: z.array(z.record(z.unknown())),
    }))
    .mutation(async ({ input }) => {
      return mlRequest("/predict/batch", { method: "POST", body: JSON.stringify(input) });
    }),

  checkFraud: protectedProcedure
    .input(z.object({
      transaction_id: z.string(),
      user_id: z.string(),
      amount: z.number(),
      currency: z.string(),
      merchant: z.string(),
      location: z.object({ lat: z.number(), lng: z.number() }).optional(),
      device_id: z.string().optional(),
      ip_address: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return mlRequest("/fraud/check", { method: "POST", body: JSON.stringify(input) });
    }),

  calculateCreditScore: protectedProcedure
    .input(z.object({
      user_id: z.string(),
      income: z.number(),
      expenses: z.number(),
      existing_loans: z.number(),
      account_age_months: z.number(),
      transaction_count: z.number(),
      savings_balance: z.number(),
    }))
    .mutation(async ({ input }) => {
      return mlRequest("/credit-score/calculate", { method: "POST", body: JSON.stringify(input) });
    }),

  categorizeTransaction: protectedProcedure
    .input(z.object({
      transaction_id: z.string(),
      description: z.string(),
      amount: z.number(),
      merchant: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return mlRequest("/categorize", { method: "POST", body: JSON.stringify(input) });
    }),

  assessRisk: protectedProcedure
    .input(z.object({
      entity_id: z.string(),
      entity_type: z.string(),
      data: z.record(z.unknown()),
    }))
    .mutation(async ({ input }) => {
      return mlRequest("/risk-assessment", { method: "POST", body: JSON.stringify(input) });
    }),

  createABTest: protectedProcedure
    .input(z.object({
      name: z.string(),
      model_a: z.string(),
      model_b: z.string(),
      traffic_split: z.number(),
    }))
    .mutation(async ({ input }) => {
      return mlRequest("/ab-test/create", { method: "POST", body: JSON.stringify(input) });
    }),

  getMetrics: publicProcedure.query(async () => {
    return mlRequest<Record<string, unknown>>("/metrics");
  }),

  getRecentPredictions: protectedProcedure
    .input(z.object({ limit: z.number().optional() }))
    .query(async ({ input }) => {
      return mlRequest(`/predictions/recent?limit=${input.limit || 20}`);
    }),
});
