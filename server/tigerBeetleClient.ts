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
 *
 * Requires the Go worker to be running. Throws on failure.
 */

const WORKER_URL = process.env.GO_WORKER_URL ?? "http://localhost:8090";

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

export const LEDGER_CODES = {
  OIL_BBL: 1,
  GAS_MSCF: 2,
  WATER_BBL: 3,
  CONDENSATE_BBL: 4,
} as const;

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

export async function ensureAccount(
  accountId: string,
  ledger: number = LEDGER_IDS.PRODUCTION,
  code: number = LEDGER_CODES.OIL_BBL
): Promise<void> {
  const res = await workerFetch("/ledger/account", {
    method: "POST",
    body: JSON.stringify({ id: accountId, ledger, code }),
  });
  if (!res.ok && res.status !== 409) {
    throw new Error(`TigerBeetle ensureAccount failed: HTTP ${res.status}`);
  }
}

// ─── Balance queries ───────────────────────────────────────────────────────────

export async function getAccountBalance(accountId: string): Promise<AccountBalance> {
  const res = await workerFetch(`/ledger/balance/${encodeURIComponent(accountId)}`);
  if (!res.ok) {
    throw new Error(`TigerBeetle getAccountBalance failed: HTTP ${res.status}`);
  }
  return await res.json() as AccountBalance;
}

export async function getTransfers(accountId: string, limit = 50): Promise<LedgerTransfer[]> {
  const res = await workerFetch(`/ledger/transfers/${encodeURIComponent(accountId)}?limit=${limit}`);
  if (!res.ok) {
    throw new Error(`TigerBeetle getTransfers failed: HTTP ${res.status}`);
  }
  const data = await res.json() as { transfers: LedgerTransfer[] };
  return data.transfers ?? [];
}

// ─── Transfer operations ───────────────────────────────────────────────────────

export async function recordTransfer(transfer: LedgerTransfer): Promise<void> {
  const res = await workerFetch("/ledger/transfer", {
    method: "POST",
    body: JSON.stringify(transfer),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`TigerBeetle transfer failed: ${err}`);
  }
}
