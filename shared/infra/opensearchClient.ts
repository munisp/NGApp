/**
 * shared/infra/opensearchClient.ts — OpenSearch client for OG-RMM.
 *
 * Provides log aggregation, full-text search over telemetry/alarms/audit,
 * and index lifecycle management. Falls back gracefully when OpenSearch
 * is unavailable.
 */

import { ServiceClient } from "./serviceClient";

const OPENSEARCH_URL = process.env.OPENSEARCH_URL ?? "http://opensearch:9200";
const OPENSEARCH_USER = process.env.OPENSEARCH_USER ?? "admin";
const OPENSEARCH_PASS = process.env.OPENSEARCH_PASSWORD ?? "";
const OPENSEARCH_ENABLED = process.env.OPENSEARCH_ENABLED !== "false";

export interface OpenSearchDocument {
  "@timestamp": string;
  [key: string]: unknown;
}

export interface SearchResult<T> {
  hits: Array<{ _id: string; _source: T }>;
  total: number;
  took: number;
}

const authHeader = OPENSEARCH_PASS
  ? { Authorization: `Basic ${Buffer.from(`${OPENSEARCH_USER}:${OPENSEARCH_PASS}`).toString("base64")}` }
  : {};

const client = new ServiceClient({
  baseURL: OPENSEARCH_URL,
  serviceName: "opensearch",
  timeoutMs: 10_000,
  headers: authHeader,
  retry: { maxRetries: 2, baseDelayMs: 500 },
  circuitBreaker: { failureThreshold: 3, resetTimeoutMs: 60_000 },
});

export async function indexDocument(index: string, doc: OpenSearchDocument, id?: string): Promise<void> {
  if (!OPENSEARCH_ENABLED) return;
  const path = id ? `/${index}/_doc/${id}` : `/${index}/_doc`;
  const method = id ? "put" : "post";
  await client[method](path, doc);
}

export async function bulkIndex(index: string, docs: OpenSearchDocument[]): Promise<void> {
  if (!OPENSEARCH_ENABLED || docs.length === 0) return;
  const lines: string[] = [];
  for (const doc of docs) {
    lines.push(JSON.stringify({ index: { _index: index } }));
    lines.push(JSON.stringify(doc));
  }
  const body = lines.join("\n") + "\n";
  await fetch(`${OPENSEARCH_URL}/_bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/x-ndjson", ...authHeader },
    body,
    signal: AbortSignal.timeout(15_000),
  });
}

export async function search<T>(
  index: string,
  query: Record<string, unknown>,
  size = 50,
  from = 0,
): Promise<SearchResult<T>> {
  if (!OPENSEARCH_ENABLED) {
    return { hits: [], total: 0, took: 0 };
  }
  try {
    const result = await client.post<{
      hits: { total: { value: number }; hits: Array<{ _id: string; _source: T }> };
      took: number;
    }>(`/${index}/_search`, { query, size, from });
    return {
      hits: result.hits.hits,
      total: result.hits.total.value,
      took: result.took,
    };
  } catch {
    return { hits: [], total: 0, took: 0 };
  }
}

export async function searchLogs(
  index: string,
  queryText: string,
  timeRange?: { gte: string; lte: string },
  size = 100,
): Promise<SearchResult<Record<string, unknown>>> {
  const must: Record<string, unknown>[] = [];
  if (queryText) {
    must.push({ query_string: { query: queryText } });
  }
  if (timeRange) {
    must.push({ range: { "@timestamp": timeRange } });
  }
  return search(index, { bool: { must } }, size);
}

export async function getClusterHealth(): Promise<{
  status: string;
  numberOfNodes: number;
  activePrimaryShards: number;
}> {
  if (!OPENSEARCH_ENABLED) {
    return { status: "simulated", numberOfNodes: 0, activePrimaryShards: 0 };
  }
  try {
    const health = await client.get<{
      status: string;
      number_of_nodes: number;
      active_primary_shards: number;
    }>("/_cluster/health");
    return {
      status: health.status,
      numberOfNodes: health.number_of_nodes,
      activePrimaryShards: health.active_primary_shards,
    };
  } catch {
    return { status: "unreachable", numberOfNodes: 0, activePrimaryShards: 0 };
  }
}

export async function ensureIndexTemplate(
  name: string,
  template: Record<string, unknown>,
): Promise<void> {
  if (!OPENSEARCH_ENABLED) return;
  try {
    await client.put(`/_index_template/${name}`, template);
  } catch {
    console.warn(`[opensearch] Failed to create index template '${name}'`);
  }
}

export { client as opensearchClient };
