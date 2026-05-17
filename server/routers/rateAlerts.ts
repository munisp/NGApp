// @ts-nocheck
/**
 * Sprint 8: Rate Alert Subscriptions Router
 *
 * Features:
 *   - CRUD for rate alerts (create, list, update, delete, toggle)
 *   - Rate alert checker cron job (polls FX rates, compares thresholds)
 *   - Multi-channel notification dispatch (email + push + in-app)
 *   - Alert history with triggered timestamps
 *   - Quick-create from MultiCurrency chart
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { sendEmail, buildRateAlertEmail } from "../lib/emailService";
import { enqueueEmail, buildAlertEmail } from "../lib/emailQueue";

// ── Types ────────────────────────────────────────────────────────────────────

interface RateAlertRecord {
  id: number;
  agentId: number;
  agentName?: string;
  agentEmail?: string;
  baseCurrency: string;
  targetCurrency: string;
  targetRate: number;
  direction: "above" | "below";
  status: "active" | "paused" | "triggered" | "expired";
  currentRate: number | null;
  triggeredAt: Date | null;
  notifiedVia: string[];
  expiresAt: Date | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── In-Memory Store (DB-backed in production) ────────────────────────────────

let nextId = 1;
const alertsStore = new Map<number, RateAlertRecord>();

// Seed some demo alerts
function seedDemoAlerts() {
  if (alertsStore.size > 0) return;
  const demos: Partial<RateAlertRecord>[] = [
    { agentId: 1, agentName: "Adebayo Okafor", baseCurrency: "USD", targetCurrency: "NGN", targetRate: 1600, direction: "above", note: "Sell USD when rate is high" },
    { agentId: 1, agentName: "Adebayo Okafor", baseCurrency: "EUR", targetCurrency: "NGN", targetRate: 1700, direction: "below", note: "Buy EUR when cheap" },
    { agentId: 1, agentName: "Adebayo Okafor", baseCurrency: "GBP", targetCurrency: "NGN", targetRate: 2000, direction: "above", note: "GBP target" },
    { agentId: 2, agentName: "Fatima Ibrahim", baseCurrency: "USD", targetCurrency: "KES", targetRate: 130, direction: "below", note: "KES strengthening" },
    { agentId: 2, agentName: "Fatima Ibrahim", baseCurrency: "USD", targetCurrency: "GHS", targetRate: 16, direction: "above", note: "GHS weakening alert" },
  ];

  for (const d of demos) {
    const id = nextId++;
    alertsStore.set(id, {
      id,
      agentId: d.agentId!,
      agentName: d.agentName,
      agentEmail: `agent${d.agentId}@54link.io`,
      baseCurrency: d.baseCurrency!,
      targetCurrency: d.targetCurrency!,
      targetRate: d.targetRate!,
      direction: d.direction as "above" | "below",
      status: "active",
      currentRate: null,
      triggeredAt: null,
      notifiedVia: [],
      expiresAt: null,
      note: d.note ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

seedDemoAlerts();

// ── FX Rate Fetcher (reuses Frankfurter API) ─────────────────────────────────

let cachedRates: Record<string, number> = {};
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60_000; // 5 minutes

async function fetchLatestRates(base: string = "USD"): Promise<Record<string, number>> {
  const now = Date.now();
  if (now - cacheTimestamp < CACHE_TTL_MS && Object.keys(cachedRates).length > 0) {
    return cachedRates;
  }

  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${base}`);
    if (!res.ok) throw new Error(`Frankfurter API ${res.status}`);
    const data = (await res.json()) as { rates: Record<string, number> };
    cachedRates = { [base]: 1, ...data.rates };
    cacheTimestamp = now;
    return cachedRates;
  } catch (err) {
    console.warn(`[RateAlerts] Failed to fetch rates: ${(err as Error).message}`);
    return cachedRates; // return stale cache
  }
}

function getRate(rates: Record<string, number>, base: string, target: string): number | null {
  if (base === target) return 1;
  // Direct rate
  if (rates[target] && rates[base]) {
    return rates[target] / rates[base];
  }
  return null;
}

// ── Alert Checker ────────────────────────────────────────────────────────────

let checkerInterval: ReturnType<typeof setInterval> | null = null;
let lastCheckAt: Date | null = null;
let checksRun = 0;
let alertsTriggered = 0;

async function checkAlerts(): Promise<{ checked: number; triggered: number }> {
  const rates = await fetchLatestRates("USD");
  let checked = 0;
  let triggered = 0;

  for (const [, alert] of alertsStore) {
    if (alert.status !== "active") continue;

    // Check expiry
    if (alert.expiresAt && alert.expiresAt.getTime() < Date.now()) {
      alert.status = "expired";
      alert.updatedAt = new Date();
      continue;
    }

    const currentRate = getRate(rates, alert.baseCurrency, alert.targetCurrency);
    if (currentRate === null) continue;

    alert.currentRate = currentRate;
    checked++;

    const shouldTrigger =
      (alert.direction === "above" && currentRate >= alert.targetRate) ||
      (alert.direction === "below" && currentRate <= alert.targetRate);

    if (shouldTrigger) {
      alert.status = "triggered";
      alert.triggeredAt = new Date();
      alert.updatedAt = new Date();
      triggered++;

      // Dispatch notifications
      await dispatchAlertNotification(alert, currentRate);
    }
  }

  lastCheckAt = new Date();
  checksRun++;
  alertsTriggered += triggered;

  if (triggered > 0) {
    console.log(`[RateAlerts] Check complete: ${checked} checked, ${triggered} triggered`);
  }

  return { checked, triggered };
}

async function dispatchAlertNotification(alert: RateAlertRecord, currentRate: number): Promise<void> {
  const channels: string[] = [];

  // Email notification
  if (alert.agentEmail) {
    try {
      const emailMsg = buildRateAlertEmail({
        agentName: alert.agentName ?? "Agent",
        baseCurrency: alert.baseCurrency,
        targetCurrency: alert.targetCurrency,
        targetRate: alert.targetRate,
        currentRate,
        direction: alert.direction,
        triggeredAt: new Date(),
      });
      emailMsg.to = alert.agentEmail;
      await sendEmail(emailMsg);
      channels.push("email");
    } catch (err) {
      console.warn(`[RateAlerts] Email notification failed: ${(err as Error).message}`);
    }
  }

  // In-app notification (via existing enqueueEmail for logging)
  try {
    const pair = `${alert.baseCurrency}/${alert.targetCurrency}`;
    const dirLabel = alert.direction === "above" ? "risen above" : "fallen below";
    enqueueEmail({
      to: alert.agentEmail ?? "system@54link.io",
      subject: `Rate Alert: ${pair} has ${dirLabel} ${alert.targetRate}`,
      html: `<p>${pair} rate has ${dirLabel} your target of ${alert.targetRate}. Current: ${currentRate.toFixed(4)}</p>`,
    });
    channels.push("in_app");
  } catch {
    // Non-critical
  }

  // Push notification stub (would use web-push in production)
  channels.push("push_stub");

  alert.notifiedVia = channels;
}

// Start checker on module load (every 5 minutes)
function startChecker() {
  if (checkerInterval) return;
  checkerInterval = setInterval(() => {
    checkAlerts().catch((err) => console.error("[RateAlerts] Checker error:", err));
  }, 5 * 60_000);
  // Run immediately on start
  checkAlerts().catch((err) => console.error("[RateAlerts] Initial check error:", err));
  console.log("[RateAlerts] Checker started (5-min interval)");
}

startChecker();

// ── Router ───────────────────────────────────────────────────────────────────

export const rateAlertsRouter = router({
  // Create a new rate alert
  create: protectedProcedure
    .input(
      z.object({
        agentId: z.number(),
        agentName: z.string().optional(),
        agentEmail: z.string().email().optional(),
        baseCurrency: z.string().length(3),
        targetCurrency: z.string().length(3),
        targetRate: z.number().positive(),
        direction: z.enum(["above", "below"]),
        expiresAt: z.string().datetime().optional(),
        note: z.string().max(256).optional(),
      })
    )
    .mutation(({ input }) => {
      const id = nextId++;
      const alert: RateAlertRecord = {
        id,
        agentId: input.agentId,
        agentName: input.agentName,
        agentEmail: input.agentEmail,
        baseCurrency: input.baseCurrency.toUpperCase(),
        targetCurrency: input.targetCurrency.toUpperCase(),
        targetRate: input.targetRate,
        direction: input.direction,
        status: "active",
        currentRate: null,
        triggeredAt: null,
        notifiedVia: [],
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        note: input.note ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      alertsStore.set(id, alert);
      return alert;
    }),

  // List alerts for an agent
  list: protectedProcedure
    .input(
      z.object({
        agentId: z.number().optional(),
        status: z.enum(["active", "paused", "triggered", "expired", "all"]).default("all"),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(5).max(50).default(20),
      })
    )
    .query(({ input }) => {
      let alerts = Array.from(alertsStore.values());
      if (input.agentId) alerts = alerts.filter((a: any) => a.agentId === input.agentId);
      if (input.status !== "all") alerts = alerts.filter((a: any) => a.status === input.status);

      alerts.sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());

      const total = alerts.length;
      const start = (input.page - 1) * input.pageSize;
      const items = alerts.slice(start, start + input.pageSize);

      return { items, total, page: input.page, pageSize: input.pageSize, totalPages: Math.ceil(total / input.pageSize) };
    }),

  // Get a single alert
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => {
      const alert = alertsStore.get(input.id);
      if (!alert) throw new Error("Rate alert not found");
      return alert;
    }),

  // Update an alert
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        targetRate: z.number().positive().optional(),
        direction: z.enum(["above", "below"]).optional(),
        note: z.string().max(256).optional(),
        expiresAt: z.string().datetime().nullable().optional(),
      })
    )
    .mutation(({ input }) => {
      const alert = alertsStore.get(input.id);
      if (!alert) throw new Error("Rate alert not found");

      if (input.targetRate !== undefined) alert.targetRate = input.targetRate;
      if (input.direction !== undefined) alert.direction = input.direction;
      if (input.note !== undefined) alert.note = input.note;
      if (input.expiresAt !== undefined) alert.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
      alert.updatedAt = new Date();

      return alert;
    }),

  // Toggle alert status (active ↔ paused)
  toggle: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => {
      const alert = alertsStore.get(input.id);
      if (!alert) throw new Error("Rate alert not found");

      if (alert.status === "active") alert.status = "paused";
      else if (alert.status === "paused") alert.status = "active";
      else throw new Error(`Cannot toggle alert in ${alert.status} status`);

      alert.updatedAt = new Date();
      return alert;
    }),

  // Re-arm a triggered alert (reset to active)
  rearm: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => {
      const alert = alertsStore.get(input.id);
      if (!alert) throw new Error("Rate alert not found");
      if (alert.status !== "triggered") throw new Error("Only triggered alerts can be re-armed");

      alert.status = "active";
      alert.triggeredAt = null;
      alert.notifiedVia = [];
      alert.currentRate = null;
      alert.updatedAt = new Date();
      return alert;
    }),

  // Delete an alert
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => {
      const existed = alertsStore.delete(input.id);
      return { success: existed, id: input.id };
    }),

  // Run checker manually (admin)
  runCheck: protectedProcedure.mutation(async () => {
    const result = await checkAlerts();
    return { ...result, lastCheckAt: lastCheckAt, checksRun, totalTriggered: alertsTriggered };
  }),

  // Get checker status
  getCheckerStatus: protectedProcedure.query(() => {
    return {
      running: !!checkerInterval,
      lastCheckAt,
      checksRun,
      totalTriggered: alertsTriggered,
      totalAlerts: alertsStore.size,
    };
  }),

  // Get alert stats summary
  getStats: protectedProcedure
    .input(z.object({ agentId: z.number().optional() }))
    .query(({ input }) => {
      if (input.agentId) alerts = alerts.filter((a: any) => a.agentId === input.agentId);

      return {
        total: alerts.length,
        active: alerts.filter((a: any) => a.status === "active").length,
        paused: alerts.filter((a: any) => a.status === "paused").length,
        triggered: alerts.filter((a: any) => a.status === "triggered").length,
        expired: alerts.filter((a: any) => a.status === "expired").length,
        topPairs: getTopPairs(alerts),
      };
    }),

  // Quick-create from chart (simplified input)
  quickCreate: protectedProcedure
    .input(
      z.object({
        agentId: z.number(),
        baseCurrency: z.string().length(3),
        targetCurrency: z.string().length(3),
        currentRate: z.number().positive(),
        percentThreshold: z.number().min(0.1).max(50).default(2),
        direction: z.enum(["above", "below"]),
      })
    )
    .mutation(({ input }) => {
      const multiplier = input.direction === "above" ? 1 + input.percentThreshold / 100 : 1 - input.percentThreshold / 100;
      const targetRate = input.currentRate * multiplier;

      const id = nextId++;
      const alert: RateAlertRecord = {
        id,
        agentId: input.agentId,
        baseCurrency: input.baseCurrency.toUpperCase(),
        targetCurrency: input.targetCurrency.toUpperCase(),
        targetRate: parseFloat(targetRate.toFixed(4)),
        direction: input.direction,
        status: "active",
        currentRate: input.currentRate,
        triggeredAt: null,
        notifiedVia: [],
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000), // 30 days
        note: `Auto-created: ${input.percentThreshold}% ${input.direction} ${input.currentRate.toFixed(4)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      alertsStore.set(id, alert);
      return alert;
    }),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function getTopPairs(alerts: RateAlertRecord[]): Array<{ pair: string; count: number }> {
  const pairCounts = new Map<string, number>();
  for (const a of alerts) {
    const pair = `${a.baseCurrency}/${a.targetCurrency}`;
    pairCounts.set(pair, (pairCounts.get(pair) ?? 0) + 1);
  }
  return Array.from(pairCounts.entries())
    .map(([pair, count]) => ({ pair, count }))
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 5);
}
