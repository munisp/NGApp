"use client";

/**
 * API Hooks - Connect PWA frontend to Go Gateway backend.
 * Each hook fetches from the API, updates Zustand stores, and falls back to mock data
 * when the backend is unavailable (development without gateway running).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api-client";
import { useMarketStore, useTradingStore, useUserStore } from "./store";
import type {
  Commodity,
  Order,
  Trade,
  Position,
  PortfolioSummary,
  PriceAlert,
  Notification,
  OrderBook,
  User,
} from "@/types";

// ============================================================
// Generic fetch hook with loading/error state
// ============================================================

interface APIResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

function useAPIFetch<T>(
  fetcher: () => Promise<APIResponse<T>>,
  deps: unknown[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher();
      if (mountedRef.current) {
        if (res && res.success !== undefined) {
          setData(res.data);
        } else {
          // Direct data response
          setData(res as unknown as T);
        }
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : "API request failed";
        setError(message);
        console.warn("[API] Fetch failed, using store data:", message);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  return { data, loading, error, refetch };
}

// ============================================================
// Market Data Hooks
// ============================================================

export function useMarkets() {
  const { setCommodities, commodities } = useMarketStore();

  const { data, loading, error, refetch } = useAPIFetch<{ commodities: Commodity[] }>(
    () => api.markets.list() as unknown as Promise<APIResponse<{ commodities: Commodity[] }>>,
    []
  );

  useEffect(() => {
    if (data?.commodities) {
      setCommodities(data.commodities);
    }
  }, [data, setCommodities]);

  return {
    commodities: data?.commodities ?? commodities,
    loading,
    error,
    refetch,
  };
}

export function useMarketSearch(query: string) {
  const [results, setResults] = useState<Commodity[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query || query.length < 1) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.markets.search(query) as unknown as APIResponse<{ commodities: Commodity[] }>;
        setResults(res?.data?.commodities ?? []);
      } catch {
        // Fallback to client-side filter
        const { commodities } = useMarketStore.getState();
        const q = query.toLowerCase();
        setResults(
          commodities.filter(
            (c) =>
              c.symbol.toLowerCase().includes(q) ||
              c.name.toLowerCase().includes(q) ||
              c.category.toLowerCase().includes(q)
          )
        );
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return { results, loading };
}

export function useOrderBook(symbol: string) {
  const { data, loading, error, refetch } = useAPIFetch<OrderBook>(
    () => api.markets.orderbook(symbol) as Promise<APIResponse<OrderBook>>,
    [symbol]
  );

  return { orderBook: data, loading, error, refetch };
}

export function useCandles(symbol: string, interval: string = "1h") {
  const { data, loading, error } = useAPIFetch<{ candles: unknown[] }>(
    () => api.markets.candles(symbol, interval) as Promise<APIResponse<{ candles: unknown[] }>>,
    [symbol, interval]
  );

  return { candles: data?.candles ?? [], loading, error };
}

// ============================================================
// Orders Hooks
// ============================================================

export function useOrders(status?: string) {
  const { orders: storeOrders, setOrders } = useTradingStore();

  const { data, loading, error, refetch } = useAPIFetch<{ orders: Order[] }>(
    () => api.orders.list(status) as Promise<APIResponse<{ orders: Order[] }>>,
    [status]
  );

  useEffect(() => {
    if (data?.orders) {
      setOrders(data.orders);
    }
  }, [data, setOrders]);

  return {
    orders: data?.orders ?? storeOrders,
    loading,
    error,
    refetch,
  };
}

export function useCreateOrder() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addOrder } = useTradingStore();

  const createOrder = useCallback(
    async (order: {
      symbol: string;
      side: string;
      type: string;
      quantity: number;
      price?: number;
      stopPrice?: number;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.orders.create(order) as unknown as APIResponse<Order>;
        const created = res?.data ?? res;
        addOrder(created as Order);
        return created;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to create order";
        setError(message);
        // Fallback: create local order
        const localOrder: Order = {
          id: `ord-local-${Date.now()}`,
          symbol: order.symbol,
          side: order.side as "BUY" | "SELL",
          type: order.type as "MARKET" | "LIMIT" | "STOP" | "STOP_LIMIT",
          status: "OPEN",
          quantity: order.quantity,
          price: order.price ?? 0,
          filledQuantity: 0,
          averagePrice: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        addOrder(localOrder);
        return localOrder;
      } finally {
        setLoading(false);
      }
    },
    [addOrder]
  );

  return { createOrder, loading, error };
}

export function useCancelOrder() {
  const [loading, setLoading] = useState(false);

  const cancelOrder = useCallback(async (orderId: string) => {
    setLoading(true);
    try {
      await api.orders.cancel(orderId);
      // Refetch orders to update store
      const { setOrders } = useTradingStore.getState();
      try {
        const res = await api.orders.list() as unknown as APIResponse<{ orders: Order[] }>;
        if (res?.data?.orders) setOrders(res.data.orders);
      } catch {
        // Update local store
        const { orders } = useTradingStore.getState();
        setOrders(
          orders.map((o) =>
            o.id === orderId ? { ...o, status: "CANCELLED" as const } : o
          )
        );
      }
      return true;
    } catch {
      // Fallback: cancel locally
      const { orders, setOrders } = useTradingStore.getState();
      setOrders(
        orders.map((o) =>
          o.id === orderId ? { ...o, status: "CANCELLED" as const } : o
        )
      );
      return true;
    } finally {
      setLoading(false);
    }
  }, []);

  return { cancelOrder, loading };
}

// ============================================================
// Trades Hook
// ============================================================

export function useTrades(symbol?: string) {
  const { trades: storeTrades, setTrades } = useTradingStore();

  const { data, loading, error, refetch } = useAPIFetch<{ trades: Trade[] }>(
    () =>
      api.trades.list(symbol ? { symbol } : undefined) as Promise<
        APIResponse<{ trades: Trade[] }>
      >,
    [symbol]
  );

  useEffect(() => {
    if (data?.trades) {
      setTrades(data.trades);
    }
  }, [data, setTrades]);

  return {
    trades: data?.trades ?? storeTrades,
    loading,
    error,
    refetch,
  };
}

// ============================================================
// Portfolio Hooks
// ============================================================

export function usePortfolio() {
  const { portfolio, positions: storePositions, setPositions } = useTradingStore();

  const { data, loading, error, refetch } = useAPIFetch<PortfolioSummary>(
    () => api.portfolio.summary() as Promise<APIResponse<PortfolioSummary>>,
    []
  );

  useEffect(() => {
    if (data?.positions) {
      setPositions(data.positions);
    }
  }, [data, setPositions]);

  return {
    portfolio: data ?? portfolio,
    positions: data?.positions ?? storePositions,
    loading,
    error,
    refetch,
  };
}

export function useClosePosition() {
  const [loading, setLoading] = useState(false);

  const closePosition = useCallback(async (positionId: string) => {
    setLoading(true);
    try {
      await (api as unknown as { portfolio: { closePosition: (id: string) => Promise<unknown> } }).portfolio.closePosition?.(positionId) ??
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/portfolio/positions/${positionId}`, { method: "DELETE" });
      // Update local store
      const { positions, setPositions } = useTradingStore.getState();
      setPositions(positions.filter((p) => p.symbol !== positionId && p.symbol + "-pos" !== positionId));
      return true;
    } catch {
      // Fallback: remove locally
      const { positions, setPositions } = useTradingStore.getState();
      setPositions(positions.filter((p) => p.symbol !== positionId));
      return true;
    } finally {
      setLoading(false);
    }
  }, []);

  return { closePosition, loading };
}

// ============================================================
// Alerts Hooks
// ============================================================

export function useAlerts() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.alerts.list() as unknown as APIResponse<{ alerts: PriceAlert[] }>;
      setAlerts(res?.data?.alerts ?? []);
    } catch {
      // Keep current state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const createAlert = useCallback(
    async (alert: { symbol: string; condition: string; targetPrice: number }) => {
      try {
        const res = await api.alerts.create(alert) as unknown as APIResponse<PriceAlert>;
        const created = res?.data ?? res;
        setAlerts((prev) => [created as PriceAlert, ...prev]);
        return created;
      } catch {
        // Create locally
        const local = {
          id: `alt-local-${Date.now()}`,
          symbol: alert.symbol,
          condition: alert.condition as "above" | "below",
          targetPrice: alert.targetPrice,
          active: true,
          createdAt: new Date().toISOString(),
        } as PriceAlert;
        setAlerts((prev) => [local, ...prev]);
        return local;
      }
    },
    []
  );

  const updateAlert = useCallback(async (alertId: string, data: { active?: boolean }) => {
    try {
      await api.alerts.update(alertId, data);
    } catch {
      // Update locally
    }
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === alertId ? { ...a, ...data } : a
      )
    );
  }, []);

  const deleteAlert = useCallback(async (alertId: string) => {
    try {
      await api.alerts.delete(alertId);
    } catch {
      // Delete locally
    }
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }, []);

  return { alerts, loading, createAlert, updateAlert, deleteAlert, refetch: fetchAlerts };
}

// ============================================================
// Account Hooks
// ============================================================

export function useProfile() {
  const { user, setUser } = useUserStore();

  const { data, loading, error, refetch } = useAPIFetch<User>(
    () => api.account.profile() as Promise<APIResponse<User>>,
    []
  );

  useEffect(() => {
    if (data) {
      setUser(data);
    }
  }, [data, setUser]);

  return { user: data ?? user, loading, error, refetch };
}

export function useUpdateProfile() {
  const [loading, setLoading] = useState(false);

  const updateProfile = useCallback(async (data: Record<string, unknown>) => {
    setLoading(true);
    try {
      const res = await api.account.updateProfile(data) as unknown as APIResponse<User>;
      const { setUser } = useUserStore.getState();
      if (res?.data) setUser(res.data);
      return res?.data;
    } catch {
      // Update locally
      const { user, setUser } = useUserStore.getState();
      if (user) setUser({ ...user, ...data } as User);
      return user;
    } finally {
      setLoading(false);
    }
  }, []);

  return { updateProfile, loading };
}

export function usePreferences() {
  const [preferences, setPreferences] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.account.preferences() as unknown as APIResponse<Record<string, unknown>>;
        setPreferences(res?.data ?? null);
      } catch {
        // Use defaults
        setPreferences({
          orderFilled: true,
          priceAlerts: true,
          marginWarnings: true,
          emailNotifications: true,
          pushNotifications: true,
          defaultCurrency: "USD",
          timeZone: "Africa/Nairobi",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updatePreferences = useCallback(async (data: Record<string, unknown>) => {
    try {
      const res = await api.account.updatePreferences(data) as unknown as APIResponse<Record<string, unknown>>;
      setPreferences(res?.data ?? { ...preferences, ...data });
    } catch {
      setPreferences((prev) => ({ ...prev, ...data }));
    }
  }, [preferences]);

  return { preferences, loading, updatePreferences };
}

export function useSessions() {
  const [sessions, setSessions] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.account.sessions() as unknown as APIResponse<{ sessions: Array<Record<string, unknown>> }>;
        setSessions(res?.data?.sessions ?? []);
      } catch {
        setSessions([
          { id: "sess-001", device: "Chrome / macOS", location: "Nairobi, Kenya", ip: "196.201.214.100", active: true, lastSeen: new Date().toISOString() },
        ]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const revokeSession = useCallback(async (sessionId: string) => {
    try {
      await api.account.revokeSession(sessionId);
    } catch {
      // Remove locally
    }
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  }, []);

  return { sessions, loading, revokeSession };
}

// ============================================================
// Notifications Hook
// ============================================================

export function useNotifications() {
  const { notifications: storeNotifications, setNotifications, markRead } = useUserStore();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/notifications`
        );
        if (res.ok) {
          const json = await res.json();
          if (json?.data?.notifications) {
            setNotifications(json.data.notifications);
          }
        }
      } catch {
        // Keep store data
      }
    })();
  }, [setNotifications]);

  const markNotificationRead = useCallback(
    async (id: string) => {
      markRead(id);
      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/notifications/${id}/read`,
          { method: "PATCH" }
        );
      } catch {
        // Already updated locally
      }
    },
    [markRead]
  );

  return { notifications: storeNotifications, markNotificationRead };
}

// ============================================================
// Auth Hooks
// ============================================================

export function useAuth() {
  const { setUser } = useUserStore();

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const res = await api.auth.login({ email, password }) as unknown as APIResponse<{
          accessToken: string;
          refreshToken: string;
        }>;
        if (res?.data?.accessToken) {
          localStorage.setItem("nexcom_access_token", res.data.accessToken);
          localStorage.setItem("nexcom_refresh_token", res.data.refreshToken);
        }
        // Fetch user profile
        try {
          const profile = await api.account.profile() as unknown as APIResponse<User>;
          if (profile?.data) setUser(profile.data);
        } catch {
          // Set minimal user
          setUser({
            id: "usr-001",
            email,
            name: email.split("@")[0],
            accountTier: "retail_trader",
            kycStatus: "VERIFIED",
            createdAt: new Date().toISOString(),
          } as User);
        }
        return true;
      } catch {
        // Demo login fallback
        localStorage.setItem("nexcom_access_token", "demo-token");
        setUser({
          id: "usr-001",
          email: "trader@nexcom.exchange",
          name: "Alex Trader",
          accountTier: "retail_trader",
          kycStatus: "VERIFIED",
          createdAt: new Date().toISOString(),
        } as User);
        return true;
      }
    },
    [setUser]
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // Continue logout
    }
    localStorage.removeItem("nexcom_access_token");
    localStorage.removeItem("nexcom_refresh_token");
    setUser(null);
  }, [setUser]);

  return { login, logout };
}

// ============================================================
// Analytics Hooks
// ============================================================

export function useAnalyticsDashboard() {
  return useAPIFetch(
    () => api.analytics.dashboard() as Promise<APIResponse<Record<string, unknown>>>,
    []
  );
}

export function usePnLReport(period: string) {
  return useAPIFetch(
    () => api.analytics.pnlReport(period) as Promise<APIResponse<Record<string, unknown>>>,
    [period]
  );
}

export function useGeospatial(commodity: string) {
  return useAPIFetch(
    () => api.analytics.geospatial(commodity) as Promise<APIResponse<Record<string, unknown>>>,
    [commodity]
  );
}

export function useAIInsights() {
  return useAPIFetch(
    () => api.analytics.aiInsights() as Promise<APIResponse<Record<string, unknown>>>,
    []
  );
}

export function usePriceForecast(symbol: string) {
  return useAPIFetch(
    () => api.analytics.priceForecast(symbol) as Promise<APIResponse<Record<string, unknown>>>,
    [symbol]
  );
}

// ============================================================
// Matching Engine Hooks - Market Makers, Indices, Corporate Actions, Brokers
// ============================================================

export function useMarketMakers() {
  const [makers, setMakers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMakers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.marketMakers.list();
      setMakers(res?.data ?? []);
    } catch {
      setMakers([
        { id: "MM-001", name: "NEXCOM Primary Market Maker", status: "ACTIVE", clearing_member_id: "CM-001", assigned_symbols: ["GOLD","SILVER","CRUDE_OIL","COFFEE","COCOA","MAIZE","WHEAT","SOYBEAN"], obligations: { max_spread_bps: 50, min_quote_size: 10000000, min_presence_pct: 85 }, performance: { avg_spread_bps: 12.5, presence_pct: 98.2, violations: 0, compliant: true } },
        { id: "MM-002", name: "Pan-African Liquidity Provider", status: "ACTIVE", clearing_member_id: "CM-002", assigned_symbols: ["MAIZE","WHEAT","COFFEE","COCOA"], obligations: { max_spread_bps: 50, min_quote_size: 5000000, min_presence_pct: 85 }, performance: { avg_spread_bps: 18.3, presence_pct: 94.7, violations: 1, compliant: true } },
      ]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMakers(); }, [fetchMakers]);
  return { makers, loading, refetch: fetchMakers };
}

export function useMarketMakerPerformance(id: string) {
  const [perf, setPerf] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const res = await api.marketMakers.performance(id);
        setPerf(res?.data ?? null);
      } catch {
        setPerf({ compliant: true, avg_spread_bps: 12.5, presence_pct: 98.2, violations: 0 });
      } finally { setLoading(false); }
    })();
  }, [id]);

  return { perf, loading };
}

export function useSubmitQuote() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitQuote = useCallback(async (quote: { market_maker_id: string; symbol: string; bid_price: number; bid_quantity: number; ask_price: number; ask_quantity: number }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.marketMakers.submitQuote(quote);
      if (res?.success) { setResult(res.data); }
      else { setError(res?.error ?? "Quote rejected"); }
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to submit quote";
      setError(msg);
      return null;
    } finally { setLoading(false); }
  }, []);

  return { submitQuote, loading, result, error };
}

export function useIndices() {
  const [indices, setIndices] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIndices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.indices.list();
      setIndices(res?.data ?? []);
    } catch {
      setIndices([
        { id: "NXCI", name: "NEXCOM All-Commodities Index", index_type: "COMPOSITE", base_value: 1000, constituents: Array(10).fill(null), methodology: "MARKETCAPWEIGHTED", status: "ACTIVE" },
        { id: "NXCI-AGRI", name: "NEXCOM Agricultural Index", index_type: "SECTOR", base_value: 1000, constituents: Array(5).fill(null), methodology: "MARKETCAPWEIGHTED", status: "ACTIVE" },
        { id: "NXCI-METAL", name: "NEXCOM Metals Index", index_type: "SECTOR", base_value: 1000, constituents: Array(2).fill(null), methodology: "MARKETCAPWEIGHTED", status: "ACTIVE" },
        { id: "NXCI-ENERGY", name: "NEXCOM Energy Index", index_type: "SECTOR", base_value: 1000, constituents: Array(2).fill(null), methodology: "MARKETCAPWEIGHTED", status: "ACTIVE" },
        { id: "NXCI-CARBON", name: "NEXCOM Carbon Index", index_type: "SINGLECOMMODITY", base_value: 1000, constituents: Array(1).fill(null), methodology: "EQUALWEIGHTED", status: "ACTIVE" },
      ]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchIndices(); }, [fetchIndices]);
  return { indices, loading, refetch: fetchIndices };
}

export function useIndexValues() {
  const [values, setValues] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchValues = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.indices.values();
      setValues(res?.data ?? []);
    } catch {
      setValues([
        { index_id: "NXCI", value: 1000, change: 0, change_pct: 0, high: 1000, low: 1000, open: 1000, volume: 0, turnover: 0 },
        { index_id: "NXCI-AGRI", value: 1000, change: 0, change_pct: 0, high: 1000, low: 1000, open: 1000, volume: 0, turnover: 0 },
        { index_id: "NXCI-METAL", value: 1000, change: 0, change_pct: 0, high: 1000, low: 1000, open: 1000, volume: 0, turnover: 0 },
        { index_id: "NXCI-ENERGY", value: 1000, change: 0, change_pct: 0, high: 1000, low: 1000, open: 1000, volume: 0, turnover: 0 },
        { index_id: "NXCI-CARBON", value: 1000, change: 0, change_pct: 0, high: 1000, low: 1000, open: 1000, volume: 0, turnover: 0 },
      ]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchValues(); }, [fetchValues]);
  return { values, loading, refetch: fetchValues };
}

export function useCorporateActions() {
  const [actions, setActions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.corporateActions.list();
      setActions(res?.data ?? []);
    } catch {
      setActions([
        { id: "ca-001", action_type: "ROLLOVER", symbol: "MAIZE-FUT-2026M03", description: "March 2026 Maize futures rollover to June 2026", status: "ANNOUNCED", parameters: { type: "Rollover", from_contract: "MAIZE-FUT-2026M03", to_contract: "MAIZE-FUT-2026M06", price_adjustment: 0 }, affected_positions: [], effective_date: "2026-03-15T00:00:00Z" },
        { id: "ca-002", action_type: "MARGINADJUSTMENT", symbol: "CRUDE_OIL", description: "Crude Oil initial margin increase due to elevated volatility", status: "ANNOUNCED", parameters: { type: "MarginAdjustment", old_initial_margin_pct: 8, new_initial_margin_pct: 10, old_maintenance_margin_pct: 6, new_maintenance_margin_pct: 7.5 }, affected_positions: [], effective_date: "2026-03-10T00:00:00Z" },
        { id: "ca-003", action_type: "CASHDIVIDEND", symbol: "CARBON", description: "Carbon credit retirement dividend — $0.50 per contract", status: "ANNOUNCED", parameters: { type: "CashDividend", amount_per_contract: 0.50, currency: "USD", total_payout: 40000 }, affected_positions: [], effective_date: "2026-03-20T00:00:00Z" },
      ]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchActions(); }, [fetchActions]);
  return { actions, loading, refetch: fetchActions };
}

export function useProcessCorporateAction() {
  const [loading, setLoading] = useState(false);

  const processAction = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await api.corporateActions.process(id);
      return res;
    } catch {
      return null;
    } finally { setLoading(false); }
  }, []);

  return { processAction, loading };
}

export function useBrokers() {
  const [brokers, setBrokers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBrokers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.brokers.list();
      setBrokers(res?.data ?? []);
    } catch {
      setBrokers([
        { id: "BRK-001", name: "NEXCOM Securities Ltd", license_number: "CMA-NGX-2026-001", broker_type: "FULLSERVICE", status: "ACTIVE", connectivity: { protocol: "FIX50", connected: true, latency_us: 120, messages_sent: 45892 }, clients: [{ client_id: "CLI-001", name: "Nairobi Grain Traders" }, { client_id: "CLI-002", name: "East Africa Coffee Co" }] },
        { id: "BRK-002", name: "Pan-African Capital Markets", license_number: "CMA-NGX-2026-002", broker_type: "FULLSERVICE", status: "ACTIVE", connectivity: { protocol: "FIX50", connected: true, latency_us: 245, messages_sent: 23456 }, clients: [{ client_id: "CLI-004", name: "Accra Gold Dealers" }] },
        { id: "BRK-003", name: "AlgoTrade Africa", license_number: "CMA-NGX-2026-003", broker_type: "ALGOTRADER", status: "ACTIVE", connectivity: { protocol: "BINARY", connected: true, latency_us: 45, messages_sent: 1234567 }, clients: [{ client_id: "CLI-006", name: "AlgoTrade Prop Desk" }] },
        { id: "BRK-004", name: "Mobile Money Trading", license_number: "CMA-NGX-2026-004", broker_type: "INTRODUCING", status: "ACTIVE", connectivity: { protocol: "RESTAPI", connected: true, latency_us: 850, messages_sent: 8765 }, clients: [{ client_id: "CLI-007", name: "Smallholder Coop" }] },
        { id: "BRK-005", name: "Global Futures Corp", license_number: "CMA-NGX-2026-005", broker_type: "EXECUTIONONLY", status: "PENDINGAPPROVAL", connectivity: { protocol: "FIX50", connected: false, latency_us: null, messages_sent: 0 }, clients: [] },
      ]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBrokers(); }, [fetchBrokers]);
  return { brokers, loading, refetch: fetchBrokers };
}

export function useRouteOrder() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const routeOrder = useCallback(async (route: { broker_id: string; client_account: string; symbol: string; side: string; quantity: number }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.brokers.routeOrder(route);
      if (res?.success) { setResult(res.data); }
      else { setError(res?.error ?? "Route failed"); }
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to route order";
      setError(msg);
      return null;
    } finally { setLoading(false); }
  }, []);

  return { routeOrder, loading, result, error };
}

export function useExchangeStatus() {
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.exchangeStatus.get();
        setStatus(res?.data ?? null);
      } catch {
        setStatus({ market_makers: 2, indices: 5, brokers: 5, connected_brokers: 4, corporate_actions: 3, fix_protocol: "FIXT.1.1 / FIX.5.0SP2" });
      } finally { setLoading(false); }
    })();
  }, []);

  return { status, loading };
}

// ============================================================
// Middleware Status Hook
// ============================================================

export function useMiddlewareStatus() {
  return useAPIFetch(
    () =>
      fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/middleware/status`
      ).then((r) => r.json()) as Promise<APIResponse<Record<string, unknown>>>,
    []
  );
}
