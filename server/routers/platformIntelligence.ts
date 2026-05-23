/**
 * NDSEP Platform Intelligence tRPC Router
 *
 * Proxies requests to next-generation microservices:
 * - AI Compliance Engine (port 8155)
 * - Audit Chain / Blockchain (port 8165)
 * - Federated Learning (port 8170)
 * - Digital Twin (port 8175)
 * - Sovereign AI (port 8180)
 * - Quantum Crypto (port 8185)
 *
 * Also exposes: Event Store, CQRS, Feature Flags, Multi-Tenancy, Real-Time stats
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { logger } from "../logger";

const AI_URL = process.env.AI_COMPLIANCE_URL ?? "http://localhost:8155";
const AUDIT_URL = process.env.AUDIT_CHAIN_URL ?? "http://localhost:8165";
const FED_URL = process.env.FEDERATED_LEARNING_URL ?? "http://localhost:8170";
const TWIN_URL = process.env.DIGITAL_TWIN_URL ?? "http://localhost:8175";
const SOVEREIGN_URL = process.env.SOVEREIGN_AI_URL ?? "http://localhost:8180";
const PQC_URL = process.env.QUANTUM_CRYPTO_URL ?? "http://localhost:8185";

async function serviceFetch(baseUrl: string, path: string, method = "GET", body?: unknown): Promise<unknown> {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${baseUrl}${path}`, opts);
    if (!res.ok) {
      const text = await res.text();
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Service ${res.status}: ${text}` });
    }
    return res.json();
  } catch (e: unknown) {
    if (e instanceof TRPCError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn({ err: msg, path }, "Service unreachable — returning null");
    return null;
  }
}

export const platformIntelligenceRouter = router({
  // ── AI Compliance Engine ────────────────────────────────────────────────
  aiComplianceQuery: protectedProcedure
    .input(z.object({ question: z.string().min(1), orgContext: z.record(z.string(), z.unknown()).optional() }))
    .mutation(async ({ input }) => {
      return serviceFetch(AI_URL, "/api/v1/compliance/query", "POST", { question: input.question, org_context: input.orgContext });
    }),

  aiGenerateDPIA: protectedProcedure
    .input(z.object({
      orgName: z.string(), processingActivity: z.string(), dataCategories: z.array(z.string()),
      dataSubjects: z.array(z.string()), purpose: z.string(), legalBasis: z.string(),
      crossBorder: z.boolean().default(false), automatedDecision: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      return serviceFetch(AI_URL, "/api/v1/compliance/dpia/generate", "POST", {
        org_name: input.orgName, processing_activity: input.processingActivity,
        data_categories: input.dataCategories, data_subjects: input.dataSubjects,
        purpose: input.purpose, legal_basis: input.legalBasis,
        cross_border: input.crossBorder, automated_decision: input.automatedDecision,
      });
    }),

  aiGapAnalysis: protectedProcedure
    .input(z.object({
      orgName: z.string(), sector: z.string(), currentPolicies: z.array(z.string()),
      dataCategories: z.array(z.string()), hasDpo: z.boolean(), hasBreachPlan: z.boolean(),
      hasConsentMechanism: z.boolean(), hasDpia: z.boolean(), crossBorderTransfers: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      return serviceFetch(AI_URL, "/api/v1/compliance/gap-analysis", "POST", {
        org_name: input.orgName, sector: input.sector, current_policies: input.currentPolicies,
        data_categories: input.dataCategories, has_dpo: input.hasDpo, has_breach_plan: input.hasBreachPlan,
        has_consent_mechanism: input.hasConsentMechanism, has_dpia: input.hasDpia,
        cross_border_transfers: input.crossBorderTransfers,
      });
    }),

  aiImpactAnalysis: protectedProcedure
    .input(z.object({ regulatoryChange: z.string(), affectedArticles: z.array(z.string()), orgSectors: z.array(z.string()).optional() }))
    .mutation(async ({ input }) => {
      return serviceFetch(AI_URL, "/api/v1/compliance/impact-analysis", "POST", {
        regulatory_change: input.regulatoryChange, affected_articles: input.affectedArticles, org_sectors: input.orgSectors,
      });
    }),

  aiNdpaSections: protectedProcedure.query(async () => {
    return serviceFetch(AI_URL, "/api/v1/compliance/ndpa/sections");
  }),

  // ── Blockchain Audit Trail ──────────────────────────────────────────────
  auditChainStats: protectedProcedure.query(async () => {
    return serviceFetch(AUDIT_URL, "/api/v1/audit/stats");
  }),

  auditChainVerify: protectedProcedure.query(async () => {
    return serviceFetch(AUDIT_URL, "/api/v1/audit/verify");
  }),

  auditChainMerkleRoot: protectedProcedure.query(async () => {
    return serviceFetch(AUDIT_URL, "/api/v1/audit/merkle-root");
  }),

  auditChainEntries: protectedProcedure
    .input(z.object({ limit: z.number().default(50) }))
    .query(async ({ input }) => {
      return serviceFetch(AUDIT_URL, `/api/v1/audit/entries?limit=${input.limit}`);
    }),

  auditChainAppend: protectedProcedure
    .input(z.object({ aggregateType: z.string(), aggregateId: z.string(), eventType: z.string(), actorId: z.string().optional(), payload: z.record(z.string(), z.unknown()) }))
    .mutation(async ({ input }) => {
      return serviceFetch(AUDIT_URL, "/api/v1/audit/append", "POST", {
        aggregate_type: input.aggregateType, aggregate_id: input.aggregateId,
        event_type: input.eventType, actor_id: input.actorId, payload: input.payload,
      });
    }),

  // ── Federated Learning ──────────────────────────────────────────────────
  federatedStats: protectedProcedure.query(async () => {
    return serviceFetch(FED_URL, "/api/v1/federated/stats");
  }),

  federatedModel: protectedProcedure.query(async () => {
    return serviceFetch(FED_URL, "/api/v1/federated/model");
  }),

  federatedThreatFeed: protectedProcedure
    .input(z.object({ limit: z.number().default(50), severity: z.string().optional() }))
    .query(async ({ input }) => {
      const params = new URLSearchParams({ limit: String(input.limit) });
      if (input.severity) params.set("severity", input.severity);
      return serviceFetch(FED_URL, `/api/v1/federated/threat-feed?${params}`);
    }),

  federatedHistory: protectedProcedure.query(async () => {
    return serviceFetch(FED_URL, "/api/v1/federated/history");
  }),

  // ── Digital Twin ────────────────────────────────────────────────────────
  twinState: protectedProcedure.query(async () => {
    return serviceFetch(TWIN_URL, "/api/v1/twin/state");
  }),

  twinSimulate: protectedProcedure
    .input(z.object({ scenario: z.string(), parameters: z.record(z.string(), z.number()), durationMonths: z.number().default(12) }))
    .mutation(async ({ input }) => {
      return serviceFetch(TWIN_URL, "/api/v1/twin/simulate", "POST", {
        scenario: input.scenario, parameters: input.parameters, duration_months: input.durationMonths,
      });
    }),

  twinPredictBreaches: protectedProcedure.query(async () => {
    return serviceFetch(TWIN_URL, "/api/v1/twin/predict-breaches");
  }),

  twinHistory: protectedProcedure.query(async () => {
    return serviceFetch(TWIN_URL, "/api/v1/twin/history");
  }),

  // ── Sovereign AI ────────────────────────────────────────────────────────
  sovereignLanguages: protectedProcedure.query(async () => {
    return serviceFetch(SOVEREIGN_URL, "/api/v1/ai/languages");
  }),

  sovereignModels: protectedProcedure.query(async () => {
    return serviceFetch(SOVEREIGN_URL, "/api/v1/ai/models");
  }),

  sovereignTranslate: protectedProcedure
    .input(z.object({ keys: z.array(z.string()), language: z.string() }))
    .mutation(async ({ input }) => {
      return serviceFetch(SOVEREIGN_URL, "/api/v1/ai/translate", "POST", input);
    }),

  sovereignFairnessCheck: protectedProcedure
    .input(z.object({ scoresBySector: z.record(z.string(), z.array(z.number())), scoresByRegion: z.record(z.string(), z.array(z.number())).optional() }))
    .mutation(async ({ input }) => {
      return serviceFetch(SOVEREIGN_URL, "/api/v1/ai/fairness/check", "POST", {
        scores_by_sector: input.scoresBySector, scores_by_region: input.scoresByRegion,
      });
    }),

  sovereignResidencyReport: protectedProcedure.query(async () => {
    return serviceFetch(SOVEREIGN_URL, "/api/v1/ai/residency-report");
  }),

  sovereignRedTeam: protectedProcedure
    .input(z.object({ modelId: z.string(), attackType: z.string(), prompt: z.string() }))
    .mutation(async ({ input }) => {
      return serviceFetch(SOVEREIGN_URL, "/api/v1/ai/red-team", "POST", {
        model_id: input.modelId, attack_type: input.attackType, prompt: input.prompt,
      });
    }),

  // ── Quantum Crypto ──────────────────────────────────────────────────────
  pqcAlgorithms: protectedProcedure.query(async () => {
    return serviceFetch(PQC_URL, "/api/v1/pqc/algorithms");
  }),

  pqcGenerateKemKeypair: protectedProcedure.mutation(async () => {
    return serviceFetch(PQC_URL, "/api/v1/pqc/kem/keypair", "POST");
  }),

  pqcGenerateSigKeypair: protectedProcedure.mutation(async () => {
    return serviceFetch(PQC_URL, "/api/v1/pqc/sig/keypair", "POST");
  }),

  pqcSign: protectedProcedure
    .input(z.object({ message: z.string() }))
    .mutation(async ({ input }) => {
      return serviceFetch(PQC_URL, "/api/v1/pqc/sig/sign", "POST", input);
    }),

  pqcHybridEncrypt: protectedProcedure
    .input(z.object({ plaintext: z.string() }))
    .mutation(async ({ input }) => {
      return serviceFetch(PQC_URL, "/api/v1/pqc/hybrid/encrypt", "POST", input);
    }),
});
