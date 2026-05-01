/**
 * TigerBeetle HTTP Client
 * ─────────────────────────────────────────────────────────────────────────────
 * Wraps the TigerBeetle HTTP proxy (port 8240) that is spawned by the
 * tigerbeetle_ledger Go orchestration service.  All calls are fire-and-forget
 * safe — if the proxy is unreachable the function logs and returns null rather
 * than throwing, so callers never need try/catch.
 *
 * Double-entry semantics:
 *   - Every penalty creates two ledger entries: DEBIT (org liability) + CREDIT (NDSEP revenue)
 *   - Every settlement creates a CREDIT on the org account (reducing liability)
 *   - Every escrow hold creates a HOLD entry pending dispute resolution
 */

const TB_BASE = process.env.TIGERBEETLE_HTTP_URL ?? "http://localhost:8240";
const TB_TIMEOUT_MS = 5_000;

export type TbTransactionType = "penalty" | "fine" | "settlement" | "refund" | "escrow";

export interface TbTransaction {
  id?: string;
  orgId: string;
  penaltyId: string;
  amountUsd: number;
  currency?: string;
  type: TbTransactionType;
  description?: string;
  issuedBy?: string;
  timestamp?: string;
}

export interface TbTransactionResult {
  success: boolean;
  transactionId?: string;
  ledgerEntryId?: string;
  error?: string;
  degraded?: boolean;
}

export interface TbBalance {
  orgId: string;
  total_penalties_issued: number;
  total_penalties_paid: number;
  total_escrow_held: number;
  total_refunds: number;
  net_liability: number;
  currency: string;
  lastUpdated: string;
}

/**
 * Create a double-entry ledger transaction in TigerBeetle.
 * Gracefully degrades if the proxy is unreachable.
 */
export async function createTigerBeetleTransaction(tx: TbTransaction): Promise<TbTransactionResult> {
  try {
    const res = await fetch(`${TB_BASE}/transaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: tx.orgId,
        penalty_id: tx.penaltyId,
        amount_usd: tx.amountUsd,
        currency: tx.currency ?? "USD",
        type: tx.type,
        description: tx.description ?? `${tx.type} for org ${tx.orgId}`,
        issued_by: tx.issuedBy ?? "system",
        timestamp: tx.timestamp ?? new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(TB_TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[TigerBeetle] Transaction failed HTTP ${res.status}: ${body}`);
      return { success: false, error: `HTTP ${res.status}: ${body}`, degraded: true };
    }
    const data = await res.json();
    return { success: true, transactionId: data.transaction_id, ledgerEntryId: data.ledger_entry_id };
  } catch (err: any) {
    // Graceful degradation — TigerBeetle proxy not running in dev
    if (err?.name === "TimeoutError" || err?.code === "ECONNREFUSED" || err?.cause?.code === "ECONNREFUSED") {
      console.info("[TigerBeetle] Proxy unreachable — ledger entry skipped (graceful degradation)");
      return { success: false, error: "TigerBeetle proxy unreachable", degraded: true };
    }
    console.error("[TigerBeetle] Unexpected error:", err?.message ?? err);
    return { success: false, error: err?.message ?? "Unknown error", degraded: true };
  }
}

/**
 * Get the ledger balance for an organisation.
 */
export async function getTigerBeetleBalance(orgId: string): Promise<TbBalance | null> {
  try {
    const res = await fetch(`${TB_BASE}/balance/${encodeURIComponent(orgId)}`, {
      signal: AbortSignal.timeout(TB_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Health check — returns true if the TigerBeetle proxy is reachable.
 */
export async function isTigerBeetleHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${TB_BASE}/health`, { signal: AbortSignal.timeout(2_000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Smoke-test: create a zero-amount test transaction and verify it round-trips.
 */
export async function tigerBeetleSmokeTest(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  const result = await createTigerBeetleTransaction({
    orgId: "smoke-test",
    penaltyId: "smoke-test-0",
    amountUsd: 0,
    type: "penalty",
    description: "smoke test — safe to ignore",
    issuedBy: "system",
  });
  const latencyMs = Date.now() - start;
  if (result.degraded) {
    return { ok: false, latencyMs, error: result.error };
  }
  return { ok: result.success, latencyMs, error: result.error };
}
