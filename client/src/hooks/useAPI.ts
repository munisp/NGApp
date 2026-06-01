/**
 * OG RMM Platform — useAPI hooks
 * Wraps API client calls with loading/error state and auto-refresh.
 * Falls back to mock data when API_BASE is not configured.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { wsHub, type WSMessage, type WSMessageType } from "@/lib/api-client";
import {
  WELLS, ALARMS, getFleetKPIs, getProductionData,
  getAlarmStats, getFinancialSummary, getLedgerEntries,
  getSettlements, getESPPredictions, getAnomalyData,
  getModelMetrics, getWorkoverJobs,
} from "@/lib/mock-data";

const USE_MOCK = !import.meta.env.VITE_API_BASE_URL;

// ── Generic fetch hook ────────────────────────────────────────────────────────

export function useQuery<T>(
  fetcher: () => Promise<T>,
  mockData: T,
  deps: any[] = [],
  refreshMs?: number
) {
  const [data, setData] = useState<T>(mockData);
  const [loading, setLoading] = useState(!USE_MOCK);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    if (USE_MOCK) { setData(mockData); return; }
    try {
      setLoading(true);
      const result = await fetcher();
      setData(result);
      setError(null);
    } catch (e: any) {
      setError(e.message);
      // Fall back to mock on error
      setData(mockData);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    fetch();
    if (refreshMs) {
      timerRef.current = setInterval(fetch, refreshMs);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetch, refreshMs]);

  return { data, loading, error, refetch: fetch };
}

// ── WebSocket subscription hook ───────────────────────────────────────────────

export function useWSEvent(type: WSMessageType, handler: (msg: WSMessage) => void) {
  useEffect(() => {
    if (USE_MOCK) return;
    wsHub.connect();
    const unsub = wsHub.on(type, handler);
    return () => { unsub(); };
  }, [type, handler]);
}

// ── Fleet KPIs ────────────────────────────────────────────────────────────────

export function useFleetKPIs() {
  return useQuery(
    async () => {
      const { AnalyticsAPI } = await import("@/lib/api-client");
      return AnalyticsAPI.getFleetKPIs().then(r => r.kpis);
    },
    getFleetKPIs(),
    [],
    30_000
  );
}

// ── Wells list ────────────────────────────────────────────────────────────────

export function useWells(params?: { status?: string; basin?: string }) {
  return useQuery(
    async () => {
      const { WellAPI } = await import("@/lib/api-client");
      return WellAPI.listWells(params).then(r => r.wells);
    },
    WELLS,
    [params?.status, params?.basin],
    60_000
  );
}

// ── Single well ───────────────────────────────────────────────────────────────

export function useWell(wellId: string) {
  return useQuery(
    async () => {
      const { WellAPI } = await import("@/lib/api-client");
      return WellAPI.getWell(wellId).then(r => r.well);
    },
    WELLS.find(w => w.well_id === wellId) ?? WELLS[0],
    [wellId],
    30_000
  );
}

// ── Alarms ────────────────────────────────────────────────────────────────────

export function useAlarms(params?: { state?: string; severity?: number }) {
  return useQuery(
    async () => {
      const { AlarmAPI } = await import("@/lib/api-client");
      return AlarmAPI.listAlarms(params).then(r => r.alarms);
    },
    ALARMS,
    [params?.state, params?.severity],
    15_000
  );
}

// ── Production data ───────────────────────────────────────────────────────────

export function useProduction(wellId: string, days = 60) {
  return useQuery(
    async () => {
      const { AnalyticsAPI } = await import("@/lib/api-client");
      return AnalyticsAPI.getProductionSummary(wellId, days).then(r => r.data);
    },
    getProductionData(wellId, days),
    [wellId, days],
    300_000
  );
}

// ── Financial summary ─────────────────────────────────────────────────────────

export function useFinancials() {
  return useQuery(
    async () => {
      const { FinancialAPI } = await import("@/lib/api-client");
      return FinancialAPI.getSummary();
    },
    { summary: getFinancialSummary() },
    [],
    60_000
  );
}

export function useLedger(params?: { limit?: number; type?: string }) {
  return useQuery(
    async () => {
      const { FinancialAPI } = await import("@/lib/api-client");
      return FinancialAPI.getLedgerEntries(params).then(r => r.entries);
    },
    getLedgerEntries(),
    [params?.type],
    60_000
  );
}

export function useSettlements() {
  return useQuery(
    async () => {
      const { FinancialAPI } = await import("@/lib/api-client");
      return FinancialAPI.getSettlements().then(r => r.settlements);
    },
    getSettlements(),
    [],
    120_000
  );
}

// ── ML / ESP ──────────────────────────────────────────────────────────────────

export function useESPPredictions(wellId?: string) {
  return useQuery(
    async () => {
      const { MLAPI } = await import("@/lib/api-client");
      return MLAPI.getESPPredictions(wellId).then(r => r.predictions);
    },
    getESPPredictions(),
    [wellId],
    120_000
  );
}

export function useESPForecast(wellId: string) {
  return useQuery(
    async () => {
      const { MLAPI } = await import("@/lib/api-client");
      return MLAPI.getESPForecast(wellId);
    },
    generateESPForecastMock(wellId),
    [wellId],
    300_000
  );
}

export function useAnomalies(wellId?: string) {
  return useQuery(
    async () => {
      const { MLAPI } = await import("@/lib/api-client");
      return MLAPI.getAnomalies(wellId).then(r => r.anomalies);
    },
    getAnomalyData(),
    [wellId],
    60_000
  );
}

export function useModelMetrics() {
  return useQuery(
    async () => {
      const { MLAPI } = await import("@/lib/api-client");
      return MLAPI.getModelMetrics().then(r => r.metrics);
    },
    getModelMetrics(),
    [],
    3_600_000
  );
}

// ── Workovers ─────────────────────────────────────────────────────────────────

export function useWorkovers(params?: { status?: string; well_id?: string }) {
  return useQuery(
    async () => {
      const { WorkoverAPI } = await import("@/lib/api-client");
      return WorkoverAPI.listJobs(params).then(r => r.jobs);
    },
    getWorkoverJobs(),
    [params?.status, params?.well_id],
    30_000
  );
}

// ── Mock helpers ──────────────────────────────────────────────────────────────

function generateESPForecastMock(wellId: string) {
  const well = WELLS.find(w => w.well_id === wellId) ?? WELLS[0];
  const baseHealth = well.esp_health ?? 85;
  const failureProb = well.esp_failure_prob_7d ?? 0.1;
  const today = new Date();

  const forecast = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() + i + 1);
    const decay = failureProb > 0.5 ? 3.5 : 0.8;
    const predicted = Math.max(10, baseHealth - decay * (i + 1) + (Math.random() - 0.5) * 2);
    return {
      day: i + 1,
      date: date.toISOString().split("T")[0],
      predicted_health: Math.round(predicted * 10) / 10,
      lower: Math.round((predicted - 4) * 10) / 10,
      upper: Math.round((predicted + 4) * 10) / 10,
      vibration_forecast: parseFloat((2.0 + failureProb * i * 0.4 + Math.random() * 0.2).toFixed(2)),
      current_forecast: parseFloat((40 + failureProb * i * 1.5 + Math.random() * 0.5).toFixed(1)),
    };
  });

  const action =
    failureProb > 0.7 ? "IMMEDIATE_INSPECTION" :
    failureProb > 0.4 ? "SCHEDULE_WORKOVER" :
    failureProb > 0.2 ? "INCREASE_MONITORING" : "CONTINUE_NORMAL_OPERATIONS";

  return {
    well_id: wellId,
    current_health: baseHealth,
    forecast,
    failure_probability_7d: failureProb,
    failure_probability_30d: Math.min(0.99, failureProb * 2.8),
    recommended_action: action,
  };
}
