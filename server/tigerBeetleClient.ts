/**
 * server/tigerBeetleClient.ts — TigerBeetle ledger client for OG-RMM Platform
 *
 * Communicates with the Go middleware worker's internal HTTP API to perform
 * double-entry ledger operations for production volume accounting.
 *
 * Account model:
 *   - One account per well (production credits when oil/gas is produced)
 *   - One account per field (allocation debits)
 *   - Volumes stored as integer units × 1000 (millibbl or mscf)
 */

const WORKER_URL = process.env.GO_WORKER_URL ?? "http://localhost:8090";
const WORKER_ENABLED = process.env.GO_WORKER_ENABLED !== "false";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AccountBalance {
  accountId: string;
  debits: number;
  credits: number;
  balance: number;
}

export interface LedgerTransfer {
  id: string;
  debitAccountId: string;
  creditAccountId: string;
  amount: number;
  ledger: number;
  code: number;
  timestamp?: string;
}

// Ledger codes for different commodity types
export const LEDGER_CODES = {
  OIL_BBL: 1,
  GAS_MSCF: 2,
  WATER_BBL: 3,
  CONDENSATE_BBL: 4,
} as const;

// Ledger IDs
export const LEDGER_IDS = {
  PRODUCTION: 1,
  ALLOCATION: 2,
  ROYALTY: 3,
} as const;

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function workerFetch(path: string, options?: RequestInit): Promise<Response> {
  const url = `${WORKER_URL}/v1${path}`;
  return fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    signal: AbortSignal.timeout(5000),
  });
}

// ─── Account management ────────────────────────────────────────────────────────

/**
 * Ensure a TigerBeetle account exists for the given well or field.
 * Idempotent — safe to call multiple times.
 */
export async function ensureAccount(
  accountId: string,
  ledger: number = LEDGER_IDS.PRODUCTION,
  code: number = LEDGER_CODES.OIL_BBL
): Promise<void> {
  if (!WORKER_ENABLED) return;
  try {
    await workerFetch("/ledger/account", {
      method: "POST",
      body: JSON.stringify({ id: accountId, ledger, code }),
    });
  } catch {
    // Non-critical — account may already exist
  }
}

// ─── Balance queries ───────────────────────────────────────────────────────────

/**
 * Get the current production balance for a well or field account.
 * Returns simulated data when the Go worker is unavailable.
 */
export async function getAccountBalance(accountId: string): Promise<AccountBalance> {
  if (!WORKER_ENABLED) {
    return simulatedBalance(accountId);
  }
  try {
    const res = await workerFetch(`/ledger/balance/${encodeURIComponent(accountId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as AccountBalance;
  } catch {
    return simulatedBalance(accountId);
  }
}

/**
 * Get transfer history for an account.
 */
export async function getTransfers(accountId: string, limit = 50): Promise<LedgerTransfer[]> {
  if (!WORKER_ENABLED) {
    return simulatedTransfers(accountId, limit);
  }
  try {
    const res = await workerFetch(`/ledger/transfers/${encodeURIComponent(accountId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { transfers: LedgerTransfer[] };
    return data.transfers ?? [];
  } catch {
    return simulatedTransfers(accountId, limit);
  }
}

// ─── Transfer operations ───────────────────────────────────────────────────────

/**
 * Record a production allocation transfer.
 * debitAccountId: field account (allocation debited)
 * creditAccountId: well account (production credited)
 * amount: volume × 1000 (e.g. 1500 = 1.5 bbl)
 */
export async function recordTransfer(transfer: LedgerTransfer): Promise<void> {
  if (!WORKER_ENABLED) {
    console.log("[ledger:sim] Transfer:", transfer);
    return;
  }
  try {
    const res = await workerFetch("/ledger/transfer", {
      method: "POST",
      body: JSON.stringify(transfer),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Ledger transfer failed: ${err}`);
    }
  } catch (err) {
    console.error("[ledger] Transfer error:", err);
    throw err;
  }
}

// ─── Simulation helpers ────────────────────────────────────────────────────────

function simulatedBalance(accountId: string): AccountBalance {
  const seed = accountId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const credits = (seed % 50000) + 20000;
  const debits = (seed % 30000) + 10000;
  return {
    accountId,
    credits,
    debits,
    balance: credits - debits,
  };
}

function simulatedTransfers(accountId: string, limit: number): LedgerTransfer[] {
  const now = Date.now();
  return Array.from({ length: Math.min(limit, 10) }, (_, i) => ({
    id: `sim-${accountId}-${i}`,
    debitAccountId: `FIELD-${accountId.slice(-3)}`,
    creditAccountId: accountId,
    amount: Math.floor(Math.random() * 5000) + 1000,
    ledger: LEDGER_IDS.PRODUCTION,
    code: LEDGER_CODES.OIL_BBL,
    timestamp: new Date(now - i * 3600000).toISOString(),
  }));
}

// ─── Exported helpers for testing ───────────────────────────────────────────

export async function getLedgerForWell(wellId: string): Promise<{
  wellId: string;
  oilBbl: number;
  gasMscf: number;
  waterBbl: number;
  source: string;
}> {
  try {
    const res = await workerFetch(`/ledger/well/${encodeURIComponent(wellId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { oilBbl: number; gasMscf: number; waterBbl: number };
    return { wellId, ...data, source: "tigerbeetle" };
  } catch {
    const oilSeed = wellId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return {
      wellId,
      oilBbl: (oilSeed % 50000) + 10000,
      gasMscf: (oilSeed % 30000) + 5000,
      waterBbl: (oilSeed % 20000) + 2000,
      source: "simulated",
    };
  }
}
