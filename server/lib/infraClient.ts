/**
 * Infrastructure Client — makes real HTTP calls to infrastructure services
 * with graceful fallback to seed data when services are unreachable.
 */
import { createChildLogger } from './logger';

const log = createChildLogger('infra-client');

const TIMEOUT_MS = parseInt(process.env.INFRA_TIMEOUT_MS ?? '3000', 10);
const MAX_RETRIES = parseInt(process.env.INFRA_MAX_RETRIES ?? '2', 10);
const RETRY_BASE_MS = 200;

interface FetchOpts {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  retries?: number;
}

async function infraFetch<T>(url: string, opts: FetchOpts = {}): Promise<T | null> {
  const retries = opts.retries ?? MAX_RETRIES;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: opts.method ?? 'GET',
        headers: { 'Content-Type': 'application/json', ...opts.headers },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.status === 503 || res.status === 429) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)));
          continue;
        }
      }
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      clearTimeout(timer);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)));
        continue;
      }
      return null;
    }
  }
  return null;
}

// ─── KAFKA ───────────────────────────────────────────────────────────────────
const KAFKA_REST_URL = process.env.KAFKA_REST_URL ?? 'http://kafka-rest:8082';
const SCHEMA_REGISTRY_URL = process.env.SCHEMA_REGISTRY_URL ?? 'http://schema-registry:8081';

export async function getKafkaLiveStatus() {
  const [brokers, subjects] = await Promise.all([
    infraFetch<any>(`${KAFKA_REST_URL}/brokers`),
    infraFetch<string[]>(`${SCHEMA_REGISTRY_URL}/subjects`),
  ]);
  if (!brokers && !subjects) return null;
  return {
    brokersOnline: brokers?.brokers?.length ?? 0,
    schemaSubjects: subjects?.length ?? 0,
    _source: 'LIVE_KAFKA',
  };
}

// ─── REDIS ───────────────────────────────────────────────────────────────────
const REDIS_EXPORTER_URL = process.env.REDIS_EXPORTER_URL ?? 'http://redis-exporter:9121';

export async function getRedisLiveStatus() {
  const info = await infraFetch<any>(`${REDIS_EXPORTER_URL}/metrics`);
  if (!info) return null;
  return { _source: 'LIVE_REDIS', raw: info };
}

// ─── POSTGRESQL ──────────────────────────────────────────────────────────────
const PGBOUNCER_URL = process.env.PGBOUNCER_EXPORTER_URL ?? 'http://pgbouncer-exporter:9127';
const PATRONI_URL = process.env.PATRONI_URL ?? 'http://patroni:8008';

export async function getPostgresLiveStatus() {
  const [patroni, pgbouncer] = await Promise.all([
    infraFetch<any>(`${PATRONI_URL}/cluster`),
    infraFetch<any>(`${PGBOUNCER_URL}/metrics`),
  ]);
  if (!patroni && !pgbouncer) return null;
  return {
    patroniCluster: patroni,
    pgbouncerMetrics: pgbouncer,
    _source: 'LIVE_POSTGRES',
  };
}

// ─── TIGERBEETLE ─────────────────────────────────────────────────────────────
const TB_HTTP_URL = process.env.TIGERBEETLE_HTTP_URL ?? 'http://tigerbeetle-gateway:3000';

export async function getTigerBeetleLiveStatus() {
  const status = await infraFetch<any>(`${TB_HTTP_URL}/status`);
  if (!status) return null;
  return { ...status, _source: 'LIVE_TIGERBEETLE' };
}

// ─── KEYCLOAK ────────────────────────────────────────────────────────────────
const KEYCLOAK_URL = process.env.KEYCLOAK_URL ?? 'http://keycloak:8080';
const KC_REALM = process.env.KEYCLOAK_REALM ?? 'payment-switch';

export async function getKeycloakLiveStatus() {
  const [health, realm] = await Promise.all([
    infraFetch<any>(`${KEYCLOAK_URL}/health/ready`),
    infraFetch<any>(`${KEYCLOAK_URL}/realms/${KC_REALM}/.well-known/openid-configuration`),
  ]);
  if (!health && !realm) return null;
  return {
    healthy: health?.status === 'UP',
    realm: realm?.issuer ? KC_REALM : null,
    endpoints: realm ? Object.keys(realm).filter(k => k.endsWith('_endpoint')).length : 0,
    _source: 'LIVE_KEYCLOAK',
  };
}

// ─── APISIX ──────────────────────────────────────────────────────────────────
const APISIX_ADMIN_URL = process.env.APISIX_ADMIN_URL ?? 'http://apisix:9180';
const APISIX_ADMIN_KEY = process.env.APISIX_ADMIN_KEY ?? '';

export async function getApisixLiveStatus() {
  const headers: Record<string, string> = {};
  if (APISIX_ADMIN_KEY) headers['X-API-KEY'] = APISIX_ADMIN_KEY;
  const [routes, upstreams] = await Promise.all([
    infraFetch<any>(`${APISIX_ADMIN_URL}/apisix/admin/routes`, { headers }),
    infraFetch<any>(`${APISIX_ADMIN_URL}/apisix/admin/upstreams`, { headers }),
  ]);
  if (!routes && !upstreams) return null;
  return {
    routeCount: routes?.list?.length ?? routes?.total ?? 0,
    upstreamCount: upstreams?.list?.length ?? upstreams?.total ?? 0,
    _source: 'LIVE_APISIX',
  };
}

// ─── PERMIFY ─────────────────────────────────────────────────────────────────
const PERMIFY_URL = process.env.PERMIFY_URL ?? 'http://permify:3476';

export async function getPermifyLiveStatus() {
  const health = await infraFetch<any>(`${PERMIFY_URL}/healthz`);
  if (!health) return null;
  return { healthy: true, _source: 'LIVE_PERMIFY' };
}

// ─── OPENAPPSEC ──────────────────────────────────────────────────────────────
const OPENAPPSEC_URL = process.env.OPENAPPSEC_URL ?? 'http://openappsec:8080';

export async function getOpenAppSecLiveStatus() {
  const status = await infraFetch<any>(`${OPENAPPSEC_URL}/api/v1/status`);
  if (!status) return null;
  return { ...status, _source: 'LIVE_OPENAPPSEC' };
}

// ─── OPENSEARCH ──────────────────────────────────────────────────────────────
const OPENSEARCH_URL = process.env.OPENSEARCH_URL ?? 'http://opensearch:9200';

export async function getOpenSearchLiveStatus() {
  const [cluster, indices] = await Promise.all([
    infraFetch<any>(`${OPENSEARCH_URL}/_cluster/health`),
    infraFetch<any>(`${OPENSEARCH_URL}/_cat/indices?format=json`),
  ]);
  if (!cluster && !indices) return null;
  return {
    clusterName: cluster?.cluster_name,
    status: cluster?.status,
    nodeCount: cluster?.number_of_nodes ?? 0,
    indexCount: Array.isArray(indices) ? indices.length : 0,
    totalDocs: Array.isArray(indices) ? indices.reduce((s: number, i: any) => s + parseInt(i['docs.count'] || '0'), 0) : 0,
    _source: 'LIVE_OPENSEARCH',
  };
}

// ─── FLUVIO ──────────────────────────────────────────────────────────────────
const FLUVIO_URL = process.env.FLUVIO_URL ?? 'http://fluvio:9003';

export async function getFluvioLiveStatus() {
  const status = await infraFetch<any>(`${FLUVIO_URL}/api/v1/status`);
  if (!status) return null;
  return { ...status, _source: 'LIVE_FLUVIO' };
}

// ─── DAPR ────────────────────────────────────────────────────────────────────
const DAPR_HTTP_PORT = process.env.DAPR_HTTP_PORT ?? '3500';

export async function getDaprLiveStatus() {
  const [health, metadata] = await Promise.all([
    infraFetch<any>(`http://localhost:${DAPR_HTTP_PORT}/v1.0/healthz`),
    infraFetch<any>(`http://localhost:${DAPR_HTTP_PORT}/v1.0/metadata`),
  ]);
  if (!health && !metadata) return null;
  return {
    healthy: !!health,
    appId: metadata?.id,
    activeComponents: metadata?.components?.length ?? 0,
    subscriptions: metadata?.subscriptions?.length ?? 0,
    _source: 'LIVE_DAPR',
  };
}

// ─── MOJALOOP ────────────────────────────────────────────────────────────────
const MOJALOOP_URL = process.env.MOJALOOP_URL ?? 'http://central-ledger:3001';

export async function getMojaloopLiveStatus() {
  const health = await infraFetch<any>(`${MOJALOOP_URL}/health`);
  if (!health) return null;
  return { ...health, _source: 'LIVE_MOJALOOP' };
}

// ─── GENERIC HELPER ──────────────────────────────────────────────────────────
/**
 * Try to get live status from a service; if it fails, return seed data.
 */
export async function withLiveFallback<T>(
  liveFn: () => Promise<T | null>,
  seedData: T,
): Promise<T & { _source?: string }> {
  try {
    const live = await liveFn();
    if (live) return live as T & { _source?: string };
  } catch (e) {
    log.debug('Live service unavailable, using seed data');
  }
  return { ...seedData, _source: 'SEED_DATA' } as T & { _source?: string };
}
