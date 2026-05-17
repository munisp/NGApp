/**
 * qdrantVectorSearch.ts — Qdrant Vector Database Integration
 *
 * Production-grade vector similarity search for:
 *  - Transaction anomaly detection (embedding-based fraud scoring)
 *  - Agent behavioral profiling (performance embeddings)
 *  - Knowledge base RAG (semantic search over support docs)
 *  - Customer similarity clustering
 *
 * Architecture:
 *   Node.js tRPC ──► Qdrant REST API (http://localhost:6333)
 *   Embeddings generated via built-in LLM or local Ollama
 *
 * Collections:
 *   - transaction_embeddings (384-dim, fraud pattern matching)
 *   - agent_profiles (384-dim, behavioral clustering)
 *   - knowledge_base (384-dim, RAG for support)
 *   - customer_embeddings (384-dim, similarity matching)
 */
import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import logger from "../_core/logger";

// ── Qdrant Client ─────────────────────────────────────────────────────────────
const QDRANT_URL = process.env.QDRANT_URL ?? "http://localhost:6333";
const QDRANT_API_KEY = process.env.QDRANT_API_KEY ?? "";
const EMBEDDING_DIM = 384;

interface QdrantPoint {
  id: string | number;
  vector: number[];
  payload: Record<string, unknown>;
}

interface QdrantSearchResult {
  id: string | number;
  version: number;
  score: number;
  payload: Record<string, unknown>;
}

async function qdrantFetch(path: string, options: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(QDRANT_API_KEY ? { "api-key": QDRANT_API_KEY } : {}),
  };
  try {
    const res = await fetch(`${QDRANT_URL}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers as Record<string, string> ?? {}) },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Qdrant ${res.status}: ${text}`);
    }
    return res.json();
  } catch (err: any) {
    if (err.message?.includes("fetch failed") || err.cause?.code === "ECONNREFUSED") {
      logger.warn("[Qdrant] Service unavailable — using fallback");
      return null;
    }
    throw err;
  }
}

// ── Embedding Generation ──────────────────────────────────────────────────────
// Uses LLM to generate text embeddings; falls back to deterministic hash-based
// embeddings when LLM is unavailable (for offline POS terminals)

function hashEmbedding(text: string, dim: number = EMBEDDING_DIM): number[] {
  // Deterministic pseudo-embedding from text hash (fallback for offline)
  const vec: number[] = [];
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  for (let i = 0; i < dim; i++) {
    hash = ((hash * 1103515245 + 12345) & 0x7fffffff);
    vec.push((hash / 0x7fffffff) * 2 - 1);
  }
  // L2 normalize
  const norm = Math.sqrt(vec.reduce((s: any, v: any) => s + v * v, 0));
  return vec.map(v => v / (norm || 1));
}

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Try Ollama first (local, fast, no cost)
    const ollamaUrl = process.env.OLLAMA_URL ?? "http://localhost:11434";
    const ollamaRes = await fetch(`${ollamaUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "nomic-embed-text", prompt: text }),
      signal: AbortSignal.timeout(5_000),
    });
    if (ollamaRes.ok) {
      const data = await ollamaRes.json();
      if (data.embedding?.length > 0) return data.embedding.slice(0, EMBEDDING_DIM);
    }
  } catch { /* Ollama unavailable */ }

  try {
    // Fallback: use built-in LLM to generate a semantic hash
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "Generate a JSON array of 10 key semantic features (floats -1 to 1) for the following text. Return ONLY the JSON array." },
        { role: "user", content: text.slice(0, 500) },
      ],
    });
    const rawContent = response.choices?.[0]?.message?.content;
    const contentStr = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
    const features = JSON.parse(contentStr ?? "[]");
    if (Array.isArray(features) && features.length > 0) {
      // Expand sparse features to full dimension via interpolation
      const vec: number[] = [];
      for (let i = 0; i < EMBEDDING_DIM; i++) {
        const idx = (i / EMBEDDING_DIM) * features.length;
        const lo = Math.floor(idx);
        const hi = Math.min(lo + 1, features.length - 1);
        const t = idx - lo;
        vec.push((1 - t) * (features[lo] ?? 0) + t * (features[hi] ?? 0));
      }
      const norm = Math.sqrt(vec.reduce((s: any, v: any) => s + v * v, 0));
      return vec.map(v => v / (norm || 1));
    }
  } catch { /* LLM unavailable */ }

  // Final fallback: deterministic hash embedding
  return hashEmbedding(text);
}

// ── Transaction Embedding ─────────────────────────────────────────────────────
function transactionToText(tx: Record<string, any>): string {
  return `Transaction: type=${tx.type} amount=${tx.amount} channel=${tx.channel} ` +
    `customer=${tx.customer || "unknown"} agent=${tx.agentCode || "unknown"} ` +
    `status=${tx.status} fee=${tx.fee || 0} time=${tx.createdAt || "now"}`;
}

// ── Collection Management ─────────────────────────────────────────────────────
const COLLECTIONS = {
  transactions: "transaction_embeddings",
  agents: "agent_profiles",
  knowledge: "knowledge_base",
  customers: "customer_embeddings",
} as const;

// ── In-Memory Fallback Store ──────────────────────────────────────────────────
// When Qdrant is unavailable, we store vectors in memory for demo/development
const fallbackStore: Record<string, QdrantPoint[]> = {
  [COLLECTIONS.transactions]: [],
  [COLLECTIONS.agents]: [],
  [COLLECTIONS.knowledge]: [],
  [COLLECTIONS.customers]: [],
};

// Seed knowledge base with platform documentation
const KNOWLEDGE_DOCS = [
  { id: "kb-001", text: "Cash withdrawal allows agents to dispense cash to customers. Maximum single withdrawal is NGN 500,000. Daily limit per customer is NGN 2,000,000. Commission rate is 0.5% of transaction amount.", category: "operations" },
  { id: "kb-002", text: "Cash deposit allows customers to deposit money through agents. No maximum limit for deposits. Commission rate is 0.3% of transaction amount. Receipts are mandatory for all deposits.", category: "operations" },
  { id: "kb-003", text: "Fund transfer enables P2P money movement. Supported channels: bank transfer, mobile money, wallet-to-wallet. Fee structure: NGN 10 for amounts under NGN 5,000, NGN 25 for NGN 5,000-50,000, NGN 50 above.", category: "operations" },
  { id: "kb-004", text: "KYC verification requires BVN, NIN, and proof of address. Tier 1 (basic) allows up to NGN 300,000 daily. Tier 2 (enhanced) allows up to NGN 1,000,000. Tier 3 (full) has no daily limit.", category: "compliance" },
  { id: "kb-005", text: "Fraud detection uses multi-layer analysis: velocity checks (transaction frequency), geofencing (location anomalies), device fingerprinting, amount anomaly detection, and graph-based relationship analysis.", category: "security" },
  { id: "kb-006", text: "Agent onboarding process: 1) Submit application with BVN/NIN, 2) Background check (3-5 days), 3) Training certification, 4) Device provisioning, 5) Float allocation, 6) Go-live with supervisor monitoring.", category: "onboarding" },
  { id: "kb-007", text: "Commission structure: Cash-in 0.3%, Cash-out 0.5%, Transfer 0.2%, Bills 1.0%, Airtime 3.5%. Volume bonuses: Bronze (>500 tx/month) +10%, Silver (>1000) +20%, Gold (>2500) +30%.", category: "finance" },
  { id: "kb-008", text: "Settlement runs daily at 17:00 WAT. Aggregates per-agent transactions, calculates net position, initiates bank transfers. Failed settlements retry at 21:00 WAT. Manual settlement available for admins.", category: "finance" },
  { id: "kb-009", text: "Offline mode: POS terminal queues transactions in encrypted SQLite (Rust offline-queue). Auto-syncs when connectivity restored. USSD fallback available for critical transactions. Maximum offline queue: 200 transactions.", category: "resilience" },
  { id: "kb-010", text: "AML compliance: All transactions above NGN 5,000,000 require enhanced due diligence. Suspicious transaction reports (STR) auto-filed for pattern matches. CBN reporting deadline: 72 hours for STRs, monthly for CTRs.", category: "compliance" },
];

// Initialize fallback knowledge base
(async () => {
  for (const doc of KNOWLEDGE_DOCS) {
    const vec = hashEmbedding(doc.text);
    fallbackStore[COLLECTIONS.knowledge].push({
      id: doc.id,
      vector: vec,
      payload: { text: doc.text, category: doc.category, source: "platform_docs" },
    });
  }
})();

// ── Cosine Similarity ─────────────────────────────────────────────────────────
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

function fallbackSearch(collection: string, queryVec: number[], limit: number): QdrantSearchResult[] {
  const points = fallbackStore[collection] ?? [];
  return points
    .map(p => ({ id: p.id, version: 0, score: cosineSimilarity(queryVec, p.vector), payload: p.payload }))
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, limit);
}

// ── Router ────────────────────────────────────────────────────────────────────
export const qdrantVectorSearchRouter = router({
  // ── Health Check ──────────────────────────────────────────────────────────
  health: protectedProcedure.query(async () => {
    const qdrantAlive = await qdrantFetch("/healthz").then(() => true).catch(() => false);
    const ollamaAlive = await fetch(
      `${process.env.OLLAMA_URL ?? "http://localhost:11434"}/api/tags`,
      { signal: AbortSignal.timeout(2000) }
    ).then(() => true).catch(() => false);
    return {
      qdrant: qdrantAlive ? "connected" : "fallback_mode",
      ollama: ollamaAlive ? "connected" : "fallback_mode",
      embeddingDim: EMBEDDING_DIM,
      collections: Object.values(COLLECTIONS),
      fallbackStoreSize: Object.fromEntries(
        Object.entries(fallbackStore).map(([k, v]) => [k, v.length])
      ),
    };
  }),

  // ── Collection Stats ──────────────────────────────────────────────────────
  collectionStats: protectedProcedure.query(async () => {
    const stats: Record<string, { count: number; status: string }> = {};
    for (const [key, name] of Object.entries(COLLECTIONS)) {
      const qdrantData = await qdrantFetch(`/collections/${name}`);
      if (qdrantData?.result) {
        stats[key] = {
          count: qdrantData.result.points_count ?? 0,
          status: qdrantData.result.status ?? "unknown",
        };
      } else {
        stats[key] = {
          count: fallbackStore[name]?.length ?? 0,
          status: "fallback",
        };
      }
    }
    return { collections: stats };
  }),

  // ── Semantic Search (RAG Knowledge Base) ──────────────────────────────────
  semanticSearch: protectedProcedure
    .input(z.object({
      query: z.string().min(1).max(1000),
      collection: z.enum(["transactions", "agents", "knowledge", "customers"]).default("knowledge"),
      limit: z.number().min(1).max(50).default(5),
      scoreThreshold: z.number().min(0).max(1).default(0.3),
    }))
    .query(async ({ input }) => {
      const collectionName = COLLECTIONS[input.collection];
      const queryVec = await generateEmbedding(input.query);

      // Try Qdrant first
      const qdrantResult = await qdrantFetch(`/collections/${collectionName}/points/search`, {
        method: "POST",
        body: JSON.stringify({
          vector: queryVec,
          limit: input.limit,
          score_threshold: input.scoreThreshold,
          with_payload: true,
        }),
      });

      let results: QdrantSearchResult[];
      let source: string;

      if (qdrantResult?.result) {
        results = qdrantResult.result;
        source = "qdrant";
      } else {
        results = fallbackSearch(collectionName, queryVec, input.limit)
          .filter(r => r.score >= input.scoreThreshold);
        source = "fallback";
      }

      return {
        query: input.query,
        collection: input.collection,
        results: results.map(r => ({
          id: r.id,
          score: Math.round(r.score * 1000) / 1000,
          payload: r.payload,
        })),
        source,
        totalResults: results.length,
      };
    }),

  // ── RAG Answer Generation ─────────────────────────────────────────────────
  ragAnswer: protectedProcedure
    .input(z.object({
      question: z.string().min(1).max(1000),
      collection: z.enum(["knowledge", "transactions", "agents"]).default("knowledge"),
      topK: z.number().min(1).max(10).default(3),
    }))
    .mutation(async ({ input }) => {
      const collectionName = COLLECTIONS[input.collection];
      const queryVec = await generateEmbedding(input.question);

      // Retrieve relevant documents
      let contexts: { text: string; score: number }[] = [];
      const qdrantResult = await qdrantFetch(`/collections/${collectionName}/points/search`, {
        method: "POST",
        body: JSON.stringify({
          vector: queryVec,
          limit: input.topK,
          score_threshold: 0.2,
          with_payload: true,
        }),
      });

      if (qdrantResult?.result) {
        contexts = qdrantResult.result.map((r: any) => ({
          text: r.payload?.text ?? JSON.stringify(r.payload),
          score: r.score,
        }));
      } else {
        contexts = fallbackSearch(collectionName, queryVec, input.topK)
          .filter(r => r.score >= 0.2)
          .map(r => ({
            text: (r.payload?.text as string) ?? JSON.stringify(r.payload),
            score: r.score,
          }));
      }

      // Generate answer using LLM with retrieved context
      const contextText = contexts.map((c, i) => `[${i + 1}] (relevance: ${(c.score * 100).toFixed(0)}%) ${c.text}`).join("\n\n");

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a knowledgeable assistant for the 54Link Agency Banking Platform. Answer questions using ONLY the provided context. If the context doesn't contain enough information, say so. Be concise and accurate. Always cite which context number(s) you used.`,
          },
          {
            role: "user",
            content: `Context:\n${contextText}\n\nQuestion: ${input.question}`,
          },
        ],
      });

      return {
        answer: response.choices?.[0]?.message?.content ?? "Unable to generate answer",
        contexts: contexts.map(c => ({ text: c.text.slice(0, 200), score: Math.round(c.score * 100) })),
        model: "rag-pipeline",
      };
    }),

  // ── Index Transaction (for fraud pattern matching) ────────────────────────
  indexTransaction: protectedProcedure
    .input(z.object({
      transactionId: z.string(),
      type: z.string(),
      amount: z.number(),
      channel: z.string(),
      customer: z.string().optional(),
      agentCode: z.string().optional(),
      status: z.string(),
      fee: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const text = transactionToText(input);
      const vec = await generateEmbedding(text);

      const point: QdrantPoint = {
        id: input.transactionId,
        vector: vec,
        payload: { ...input, indexedAt: Date.now() },
      };

      // Try Qdrant
      const result = await qdrantFetch(`/collections/${COLLECTIONS.transactions}/points`, {
        method: "PUT",
        body: JSON.stringify({ points: [{ id: point.id, vector: point.vector, payload: point.payload }] }),
      });

      if (!result) {
        // Fallback: store in memory
        fallbackStore[COLLECTIONS.transactions].push(point);
        if (fallbackStore[COLLECTIONS.transactions].length > 10000) {
          fallbackStore[COLLECTIONS.transactions] = fallbackStore[COLLECTIONS.transactions].slice(-5000);
        }
      }

      return { indexed: true, collection: COLLECTIONS.transactions, source: result ? "qdrant" : "fallback" };
    }),

  // ── Find Similar Transactions (fraud detection) ───────────────────────────
  findSimilarTransactions: protectedProcedure
    .input(z.object({
      type: z.string(),
      amount: z.number(),
      channel: z.string(),
      customer: z.string().optional(),
      agentCode: z.string().optional(),
      limit: z.number().min(1).max(20).default(5),
    }))
    .query(async ({ input }) => {
      const text = transactionToText(input);
      const queryVec = await generateEmbedding(text);

      const qdrantResult = await qdrantFetch(`/collections/${COLLECTIONS.transactions}/points/search`, {
        method: "POST",
        body: JSON.stringify({
          vector: queryVec,
          limit: input.limit,
          score_threshold: 0.7,
          with_payload: true,
        }),
      });

      let results: any[];
      let source: string;

      if (qdrantResult?.result) {
        results = qdrantResult.result;
        source = "qdrant";
      } else {
        results = fallbackSearch(COLLECTIONS.transactions, queryVec, input.limit)
          .filter(r => r.score >= 0.7);
        source = "fallback";
      }

      // Compute anomaly score based on similarity distribution
      const scores = results.map(r => r.score);
      const avgScore = scores.length > 0 ? scores.reduce((s: any, v: any) => s + v, 0) / scores.length : 0;
      const anomalyScore = 1 - avgScore; // Higher = more anomalous (less similar to known patterns)

      return {
        similarTransactions: results.map(r => ({
          id: r.id ?? r.payload?.transactionId,
          score: Math.round(r.score * 1000) / 1000,
          type: r.payload?.type,
          amount: r.payload?.amount,
          channel: r.payload?.channel,
          status: r.payload?.status,
        })),
        anomalyScore: Math.round(anomalyScore * 100) / 100,
        riskLevel: anomalyScore > 0.8 ? "critical" : anomalyScore > 0.6 ? "high" : anomalyScore > 0.4 ? "medium" : "low",
        source,
      };
    }),

  // ── Index Agent Profile ───────────────────────────────────────────────────
  indexAgentProfile: protectedProcedure
    .input(z.object({
      agentCode: z.string(),
      name: z.string(),
      tier: z.string(),
      territory: z.string().optional(),
      totalVolume: z.number().optional(),
      transactionCount: z.number().optional(),
      avgTransactionSize: z.number().optional(),
      successRate: z.number().optional(),
      specialties: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const text = `Agent ${input.agentCode} ${input.name}: tier=${input.tier} ` +
        `territory=${input.territory ?? "unassigned"} volume=${input.totalVolume ?? 0} ` +
        `txCount=${input.transactionCount ?? 0} avgSize=${input.avgTransactionSize ?? 0} ` +
        `successRate=${input.successRate ?? 0}% specialties=${(input.specialties ?? []).join(",")}`;
      const vec = await generateEmbedding(text);

      const point: QdrantPoint = {
        id: input.agentCode,
        vector: vec,
        payload: { ...input, indexedAt: Date.now() },
      };

      const result = await qdrantFetch(`/collections/${COLLECTIONS.agents}/points`, {
        method: "PUT",
        body: JSON.stringify({ points: [{ id: point.id, vector: point.vector, payload: point.payload }] }),
      });

      if (!result) {
        const existing = fallbackStore[COLLECTIONS.agents].findIndex(p => p.id === input.agentCode);
        if (existing >= 0) fallbackStore[COLLECTIONS.agents][existing] = point;
        else fallbackStore[COLLECTIONS.agents].push(point);
      }

      return { indexed: true, agentCode: input.agentCode };
    }),

  // ── Find Similar Agents ───────────────────────────────────────────────────
  findSimilarAgents: protectedProcedure
    .input(z.object({
      agentCode: z.string(),
      limit: z.number().min(1).max(20).default(5),
    }))
    .query(async ({ input }) => {
      const text = `Agent ${input.agentCode}`;
      const queryVec = await generateEmbedding(text);

      const qdrantResult = await qdrantFetch(`/collections/${COLLECTIONS.agents}/points/search`, {
        method: "POST",
        body: JSON.stringify({
          vector: queryVec,
          limit: input.limit + 1, // +1 to exclude self
          with_payload: true,
        }),
      });

      let results: any[];
      if (qdrantResult?.result) {
        results = qdrantResult.result.filter((r: any) => r.id !== input.agentCode);
      } else {
        results = fallbackSearch(COLLECTIONS.agents, queryVec, input.limit + 1)
          .filter(r => r.id !== input.agentCode);
      }

      return {
        agentCode: input.agentCode,
        similarAgents: results.slice(0, input.limit).map(r => ({
          agentCode: r.id ?? r.payload?.agentCode,
          name: r.payload?.name,
          tier: r.payload?.tier,
          score: Math.round(r.score * 1000) / 1000,
          territory: r.payload?.territory,
        })),
      };
    }),

  // ── Analytics ─────────────────────────────────────────────────────────────
  analytics: protectedProcedure.query(async () => {
    const qdrantAlive = await qdrantFetch("/healthz").then(() => true).catch(() => false);
    return {
      mode: qdrantAlive ? "qdrant" : "fallback",
      collections: Object.fromEntries(
        Object.entries(COLLECTIONS).map(([key, name]) => [
          key,
          {
            name,
            pointCount: fallbackStore[name]?.length ?? 0,
            embeddingDim: EMBEDDING_DIM,
          },
        ])
      ),
      totalVectors: Object.values(fallbackStore).reduce((s: any, v: any) => s + v.length, 0),
      knowledgeDocsCount: KNOWLEDGE_DOCS.length,
      embeddingModel: "nomic-embed-text (Ollama) / hash-fallback",
    };
  }),
});
