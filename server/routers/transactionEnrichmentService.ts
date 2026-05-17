import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
const enrichmentRules = [
  { id: "ER-1", name: "Merchant Category Mapping", source: "mcc_database", field: "merchantCategory", status: "active", enriched24h: 35000, accuracy: 99.2 },
  { id: "ER-2", name: "Geolocation Enrichment", source: "ip_geolocation", field: "location", status: "active", enriched24h: 35000, accuracy: 95.5 },
  { id: "ER-3", name: "Risk Score Calculation", source: "fraud_model", field: "riskScore", status: "active", enriched24h: 35000, accuracy: 92.8 },
  { id: "ER-4", name: "Customer Segment Tag", source: "segmentation_engine", field: "customerSegment", status: "active", enriched24h: 35000, accuracy: 94.0 },
  { id: "ER-5", name: "Currency Conversion", source: "fx_rates_api", field: "convertedAmount", status: "active", enriched24h: 8000, accuracy: 99.9 },
  { id: "ER-6", name: "Device Fingerprint", source: "device_db", field: "deviceInfo", status: "active", enriched24h: 35000, accuracy: 97.5 },
  { id: "ER-7", name: "Compliance Flag", source: "compliance_engine", field: "complianceStatus", status: "active", enriched24h: 35000, accuracy: 99.0 },
];
export const transactionEnrichmentServiceRouter = router({
  getStats: protectedProcedure.query(async () => ({
    totalRules: 12, activeRules: 10, enriched24h: 35000, avgEnrichmentTime: 25,
    accuracy: 96.8, failedEnrichments24h: 150, dataSourcesConnected: 8, pipelineHealth: "healthy",
  })),
  listRules: protectedProcedure.query(async () => ({ rules: enrichmentRules, total: enrichmentRules.length })),
  enrichTransaction: protectedProcedure.input(z.object({ transactionId: z.string() }))
    .mutation(async ({ input }) => ({ transactionId: input.transactionId, enrichments: { merchantCategory: "Retail", location: "Lagos, Nigeria", riskScore: 15, customerSegment: "High-Value", complianceStatus: "clear" }, enrichedAt: Date.now() })),
  createRule: protectedProcedure.input(z.object({ name: z.string(), source: z.string(), field: z.string() }))
    .mutation(async ({ input }) => ({ id: `ER-${Date.now()}`, ...input, status: "active", createdAt: Date.now() })),
  testRule: protectedProcedure.input(z.object({ ruleId: z.string(), sampleTransactionId: z.string() }))
    .mutation(async ({ input }) => ({ ruleId: input.ruleId, result: "success", enrichedValue: "Retail Electronics", latency: 15 })),
});
