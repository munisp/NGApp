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
      const outer = res?.data as Record<string, unknown> | undefined;
      const items = (Array.isArray(outer) ? outer : Array.isArray(outer?.data) ? outer.data : []) as Record<string, unknown>[];
      setMakers(items);
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
        const outer = res?.data as Record<string, unknown> | undefined;
        const inner = (outer?.data ?? outer) as Record<string, unknown> | null;
        setPerf(inner ?? null);
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
      if (res?.success) { setResult((Array.isArray(res.data) ? res.data[0] : res.data) as Record<string, unknown> ?? null); }
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
      const outer = res?.data as Record<string, unknown> | undefined;
      const items = (Array.isArray(outer) ? outer : Array.isArray(outer?.data) ? outer.data : []) as Record<string, unknown>[];
      setIndices(items);
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
      const outer = res?.data as Record<string, unknown> | undefined;
      const items = (Array.isArray(outer) ? outer : Array.isArray(outer?.data) ? outer.data : []) as Record<string, unknown>[];
      setValues(items);
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
      const outer = res?.data as Record<string, unknown> | undefined;
      const items = (Array.isArray(outer) ? outer : Array.isArray(outer?.data) ? outer.data : []) as Record<string, unknown>[];
      setActions(items);
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
      const outer = res?.data as Record<string, unknown> | undefined;
      const items = (Array.isArray(outer) ? outer : Array.isArray(outer?.data) ? outer.data : []) as Record<string, unknown>[];
      setBrokers(items);
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
      if (res?.success) { setResult((Array.isArray(res.data) ? res.data[0] : res.data) as Record<string, unknown> ?? null); }
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
        const outer = res?.data as Record<string, unknown> | undefined;
        setStatus((outer?.data ?? outer) as Record<string, unknown> ?? null);
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

// ============================================================
// Surveillance Hooks (NYSE-equivalent)
// ============================================================

const ME_URL = process.env.NEXT_PUBLIC_MATCHING_ENGINE_URL || "http://localhost:3001";

export function useSurveillanceAlerts() {
  const [alerts, setAlerts] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${ME_URL}/api/v1/surveillance/alerts`);
      const json = await res.json();
      setAlerts((json?.data ?? json?.alerts ?? []) as Record<string, unknown>[]);
    } catch {
      setAlerts([
        { id: "ALT-001", alert_type: "Spoofing", severity: "HIGH", account_id: "ACC-2847", symbol: "GOLD-FUT-2026M06", description: "Cancel ratio 94.2%, avg lifetime 120ms over 48 orders", resolved: false, timestamp: new Date().toISOString() },
        { id: "ALT-002", alert_type: "WashTrading", severity: "CRITICAL", account_id: "ACC-1093", symbol: "CRUDE_OIL-FUT-2026M07", description: "Rapid buy-sell at similar prices within 5000ms", resolved: false, timestamp: new Date(Date.now() - 300000).toISOString() },
        { id: "ALT-003", alert_type: "UnusualVolume", severity: "MEDIUM", account_id: "SYSTEM", symbol: "COFFEE-FUT-2026M09", description: "Unusual volume: 3200 contracts vs 450 average (7.1x)", resolved: true, timestamp: new Date(Date.now() - 900000).toISOString() },
        { id: "ALT-004", alert_type: "ExcessiveOrderRatio", severity: "HIGH", account_id: "ACC-5512", symbol: "", description: "Order-to-trade ratio: 82.3:1 (412 orders, 5 trades in 5min)", resolved: false, timestamp: new Date(Date.now() - 60000).toISOString() },
        { id: "ALT-005", alert_type: "ConcentrationRisk", severity: "HIGH", account_id: "ACC-3301", symbol: "MAIZE-FUT-2026M12", description: "Concentration risk: 14.2% of open interest (9,100 of 64,000 contracts)", resolved: false, timestamp: new Date(Date.now() - 1800000).toISOString() },
        { id: "ALT-006", alert_type: "CrossMarketManipulation", severity: "CRITICAL", account_id: "ACC-7788", symbol: "WHEAT-FUT-2026M06", description: "Suspected front-running: 3 orders on Buy side within 5s before large order", resolved: false, timestamp: new Date(Date.now() - 120000).toISOString() },
      ]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);
  return { alerts, loading, refetch: fetchAlerts };
}

export function useCircuitBreakerStatus() {
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${ME_URL}/api/v1/circuit-breaker/market-wide`);
        const json = await res.json();
        setStatus((json?.data ?? json) as Record<string, unknown>);
      } catch {
        setStatus({
          market_halted: false,
          current_level: "NONE",
          luld_bands_active: 12,
          volatility_interruptions_today: 0,
          sp500_reference: 5250.0,
          level1_threshold: -7.0,
          level2_threshold: -13.0,
          level3_threshold: -20.0,
        });
      } finally { setLoading(false); }
    })();
  }, []);

  return { status, loading };
}

export function useAuctionStatus() {
  const [auctions, setAuctions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${ME_URL}/api/v1/auctions/active`);
        const json = await res.json();
        setAuctions((json?.data ?? json?.auctions ?? []) as Record<string, unknown>[]);
      } catch {
        setAuctions([]);
      } finally { setLoading(false); }
    })();
  }, []);

  return { auctions, loading };
}

export function useMarketDataInfra() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${ME_URL}/api/v1/market-data/stats`);
        const json = await res.json();
        setStats((json?.data ?? json) as Record<string, unknown>);
      } catch {
        setStats({
          tape_entries: 0,
          nbbo_symbols: 12,
          vwap_calculations: 12,
          last_update: new Date().toISOString(),
        });
      } finally { setLoading(false); }
    })();
  }, []);

  return { stats, loading };
}

export function useInvestorProtection() {
  const [fund, setFund] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${ME_URL}/api/v1/investor-protection/status`);
        const json = await res.json();
        setFund((json?.data ?? json) as Record<string, unknown>);
      } catch {
        setFund({
          total_fund: 10000000.0,
          coverage_limit_per_account: 500000.0,
          total_disbursed: 0.0,
          total_contributions: 1,
          contributing_members: 1,
          claims: { total: 0, pending: 0, approved: 0, disbursed: 0 },
        });
      } finally { setLoading(false); }
    })();
  }, []);

  return { fund, loading };
}

// ============================================================
// Fee Engine & Revenue Hooks
// ============================================================

export function useFeeStatus() {
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${ME_URL}/api/v1/fees/status`);
      const json = await res.json();
      setStatus((json?.data ?? json) as Record<string, unknown>);
    } catch {
      setStatus({
        fee_schedules: 3,
        active_subscriptions: 6,
        active_memberships: 3,
        total_charges: 0,
        total_revenue: 0.0,
        total_rebates: 0.0,
        net_revenue: 0.0,
        api_tiers: 4,
        invoices_issued: 0,
      });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);
  return { status, loading, refetch };
}

export function useFeeSchedules() {
  const [schedules, setSchedules] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${ME_URL}/api/v1/fees/schedules`);
        const json = await res.json();
        setSchedules((json?.data ?? []) as Record<string, unknown>[]);
      } catch {
        setSchedules([
          {
            id: "FS-001", name: "Commodity Futures", description: "Fee schedule for commodity futures contracts",
            tiers: [
              { tier_name: "Retail", min_monthly_volume: 0, taker_fee_bps: 3.5, maker_fee_bps: -1.5, clearing_fee_bps: 1.0 },
              { tier_name: "Active Trader", min_monthly_volume: 1000, taker_fee_bps: 2.5, maker_fee_bps: -2.0, clearing_fee_bps: 0.8 },
              { tier_name: "Professional", min_monthly_volume: 10000, taker_fee_bps: 1.8, maker_fee_bps: -2.5, clearing_fee_bps: 0.6 },
              { tier_name: "Institutional", min_monthly_volume: 100000, taker_fee_bps: 1.2, maker_fee_bps: -3.0, clearing_fee_bps: 0.4 },
              { tier_name: "Market Maker", min_monthly_volume: 500000, taker_fee_bps: 0.8, maker_fee_bps: -3.5, clearing_fee_bps: 0.2 },
            ],
          },
          {
            id: "FS-002", name: "Commodity Options", description: "Fee schedule for commodity options contracts",
            tiers: [
              { tier_name: "Retail", min_monthly_volume: 0, taker_fee_bps: 5.0, maker_fee_bps: -1.0, clearing_fee_bps: 1.5 },
              { tier_name: "Professional", min_monthly_volume: 5000, taker_fee_bps: 3.0, maker_fee_bps: -2.0, clearing_fee_bps: 1.0 },
              { tier_name: "Market Maker", min_monthly_volume: 50000, taker_fee_bps: 1.5, maker_fee_bps: -3.0, clearing_fee_bps: 0.5 },
            ],
          },
          {
            id: "FS-003", name: "Digital Assets & Tokenized Commodities", description: "Fee schedule for tokenized commodity trading",
            tiers: [
              { tier_name: "Standard", min_monthly_volume: 0, taker_fee_bps: 10.0, maker_fee_bps: 5.0, clearing_fee_bps: 2.0 },
              { tier_name: "Premium", min_monthly_volume: 1000, taker_fee_bps: 7.0, maker_fee_bps: 3.0, clearing_fee_bps: 1.5 },
              { tier_name: "VIP", min_monthly_volume: 10000, taker_fee_bps: 5.0, maker_fee_bps: 1.0, clearing_fee_bps: 1.0 },
            ],
          },
        ]);
      } finally { setLoading(false); }
    })();
  }, []);

  return { schedules, loading };
}

export function useFeeApiTiers() {
  const [tiers, setTiers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${ME_URL}/api/v1/fees/api-tiers`);
        const json = await res.json();
        setTiers((json?.data ?? []) as Record<string, unknown>[]);
      } catch {
        setTiers([
          { name: "Free", requests_per_second: 5, monthly_fee: 0, features: ["Market data snapshots", "Basic order submission", "Account balance queries"] },
          { name: "Basic", requests_per_second: 50, monthly_fee: 100, features: ["All Free features", "WebSocket streaming", "Order history", "Position tracking"] },
          { name: "Professional", requests_per_second: 500, monthly_fee: 1000, features: ["All Basic features", "Level 2 market data", "Algorithmic trading support", "Priority order routing", "FIX protocol access"] },
          { name: "Enterprise", requests_per_second: 5000, monthly_fee: 10000, features: ["All Professional features", "Co-location access", "Dedicated support", "Custom integrations", "SLA guarantees", "Direct market access"] },
        ]);
      } finally { setLoading(false); }
    })();
  }, []);

  return { tiers, loading };
}

export function useFeeRevenue() {
  const [revenue, setRevenue] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${ME_URL}/api/v1/fees/revenue`);
      const json = await res.json();
      setRevenue((json?.data ?? json) as Record<string, unknown>);
    } catch {
      setRevenue({
        total_charges: 0,
        total_revenue: 0.0,
        total_rebates: 0.0,
        net_revenue: 0.0,
        monthly_recurring_revenue: 57833.33,
        annual_recurring_revenue: 175000.0,
        active_subscriptions: 6,
        active_memberships: 3,
        outstanding_invoices: 0,
        revenue_by_category: [],
        currency: "NGN",
      });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);
  return { revenue, loading, refetch };
}

export function useFeeMemberships() {
  const [memberships, setMemberships] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${ME_URL}/api/v1/fees/memberships`);
        const json = await res.json();
        setMemberships((json?.data ?? []) as Record<string, unknown>[]);
      } catch {
        setMemberships([
          { account_id: "NEXCOM-BROKER-001", membership_type: "BrokerDealerMembership", tier: "Full Service", annual_fee: 50000, status: "ACTIVE" },
          { account_id: "NEXCOM-MM-001", membership_type: "MarketMakerRegistration", tier: "Primary", annual_fee: 100000, status: "ACTIVE" },
          { account_id: "NEXCOM-SEAT-001", membership_type: "TradingSeatLicense", tier: "Standard", annual_fee: 25000, status: "ACTIVE" },
        ]);
      } finally { setLoading(false); }
    })();
  }, []);

  return { memberships, loading };
}

export function useFeeSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${ME_URL}/api/v1/fees/subscriptions`);
        const json = await res.json();
        setSubscriptions((json?.data ?? []) as Record<string, unknown>[]);
      } catch {
        setSubscriptions([
          { service_name: "Market Data Level 1 (Top of Book)", amount_per_cycle: 500, billing_cycle: "MONTHLY", status: "ACTIVE" },
          { service_name: "Market Data Level 2 (Full Depth)", amount_per_cycle: 2000, billing_cycle: "MONTHLY", status: "ACTIVE" },
          { service_name: "Co-Location (Rack Space near Matching Engine)", amount_per_cycle: 10000, billing_cycle: "MONTHLY", status: "ACTIVE" },
          { service_name: "Premium Analytics Dashboard", amount_per_cycle: 5000, billing_cycle: "MONTHLY", status: "ACTIVE" },
          { service_name: "Surveillance-as-a-Service", amount_per_cycle: 15000, billing_cycle: "MONTHLY", status: "ACTIVE" },
          { service_name: "NXCI Index Licensing", amount_per_cycle: 25000, billing_cycle: "QUARTERLY", status: "ACTIVE" },
        ]);
      } finally { setLoading(false); }
    })();
  }, []);

  return { subscriptions, loading };
}

// ============================================================
// KYC/KYB Hooks (connects to KYC service on port 3002)
// ============================================================

const KYC_URL = process.env.NEXT_PUBLIC_KYC_URL || "http://localhost:3002";

export function useKYCApplications(status?: string) {
  const [applications, setApplications] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const qs = status ? `?status=${status}` : "";
        const res = await fetch(`${KYC_URL}/api/v1/kyc/applications${qs}`);
        const json = await res.json();
        setApplications((json?.data ?? []) as Record<string, unknown>[]);
      } catch {
        setApplications([
          { id: "kyc-001", account_id: "ACC-001", stakeholder_type: "retail_trader", status: "approved", full_name: "Adeyemi Oluwaseun", email: "adeyemi@example.com", phone_number: "+234-801-234-5678", nationality: "Nigerian", bvn: "22345678901", nin: "12345678901", risk_level: "low", risk_score: 0.1, risk_factors: [], created_at: "2025-05-01T00:00:00", updated_at: "2025-06-15T00:00:00", approved_at: "2025-06-15T00:00:00" },
          { id: "kyc-002", account_id: "ACC-002", stakeholder_type: "institutional_investor", status: "under_review", full_name: "Chukwuma Nnamdi", email: "chukwuma@capital.ng", phone_number: "+234-802-345-6789", nationality: "Nigerian", bvn: "33456789012", nin: "23456789012", risk_level: "medium", risk_score: 0.25, risk_factors: [], created_at: "2025-05-01T00:00:00", updated_at: "2025-06-15T00:00:00" },
          { id: "kyc-003", account_id: "ACC-003", stakeholder_type: "retail_trader", status: "liveness_complete", full_name: "Fatima Abubakar", email: "fatima@gmail.com", phone_number: "+234-803-456-7890", nationality: "Nigerian", nin: "34567890123", risk_level: "low", risk_score: 0.05, risk_factors: [], created_at: "2025-05-01T00:00:00", updated_at: "2025-06-15T00:00:00" },
          { id: "kyc-004", account_id: "ACC-004", stakeholder_type: "api_consumer", status: "document_uploaded", full_name: "Emeka Okafor", email: "emeka@fintech.ng", phone_number: "+234-804-567-8901", nationality: "Nigerian", risk_level: "low", risk_score: 0.08, risk_factors: [], created_at: "2025-05-01T00:00:00", updated_at: "2025-06-15T00:00:00" },
          { id: "kyc-005", account_id: "ACC-005", stakeholder_type: "retail_trader", status: "rejected", full_name: "Ibrahim Musa", email: "ibrahim@mail.com", phone_number: "+234-805-678-9012", nationality: "Nigerian", risk_level: "high", risk_score: 0.7, risk_factors: ["Document tampering detected", "Liveness check failed"], rejection_reason: "Failed document verification", created_at: "2025-05-01T00:00:00", updated_at: "2025-06-15T00:00:00" },
        ]);
      } finally { setLoading(false); }
    })();
  }, [status]);

  return { applications, loading };
}

export function useKYBApplications(status?: string) {
  const [applications, setApplications] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const qs = status ? `?status=${status}` : "";
        const res = await fetch(`${KYC_URL}/api/v1/kyb/applications${qs}`);
        const json = await res.json();
        setApplications((json?.data ?? []) as Record<string, unknown>[]);
      } catch {
        setApplications([
          { id: "kyb-001", account_id: "ACC-BRK-001", stakeholder_type: "broker_dealer", status: "approved", business_name: "Stanbic Securities Ltd", registration_number: "RC-1234567", industry: "Securities Trading", risk_level: "low", risk_score: 0.1, aml_screening: true, sanctions_screening: true, pep_screening: true, adverse_media: true, created_at: "2025-03-01T00:00:00", updated_at: "2025-04-10T00:00:00", approved_at: "2025-04-10T00:00:00" },
          { id: "kyb-002", account_id: "ACC-MM-001", stakeholder_type: "market_maker", status: "under_review", business_name: "Optiver Africa Trading", registration_number: "RC-2345678", industry: "Market Making", risk_level: "medium", risk_score: 0.3, aml_screening: true, sanctions_screening: true, pep_screening: true, adverse_media: true, created_at: "2025-03-01T00:00:00", updated_at: "2025-04-10T00:00:00" },
          { id: "kyb-003", account_id: "ACC-ISS-001", stakeholder_type: "digital_asset_issuer", status: "processing", business_name: "Dangote Commodities Digital", registration_number: "RC-3456789", industry: "Commodity Trading", risk_level: "low", risk_score: 0.05, aml_screening: false, sanctions_screening: false, pep_screening: false, adverse_media: false, created_at: "2025-03-01T00:00:00", updated_at: "2025-04-10T00:00:00" },
        ]);
      } finally { setLoading(false); }
    })();
  }, [status]);

  return { applications, loading };
}

export function useStakeholderTypes() {
  const [types, setTypes] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${KYC_URL}/api/v1/onboarding/stakeholder-types`);
        const json = await res.json();
        setTypes((json?.data ?? []) as Record<string, unknown>[]);
      } catch {
        setTypes([
          { id: "retail_trader", name: "Individual Trader", description: "Personal trading account for commodity futures, options, and digital assets", kyb_required: false, estimated_time: "15-30 minutes" },
          { id: "institutional_investor", name: "Institutional Investor", description: "Fund, pension, or investment company seeking market access", kyb_required: false, estimated_time: "1-2 business days" },
          { id: "broker_dealer", name: "Broker/Dealer", description: "Licensed broker providing market access to clients", kyb_required: true, estimated_time: "5-10 business days" },
          { id: "market_maker", name: "Market Maker", description: "Liquidity provider with continuous two-sided quotes", kyb_required: true, estimated_time: "5-10 business days" },
          { id: "digital_asset_issuer", name: "Asset Issuer", description: "Commodity owner tokenizing assets for fractional trading", kyb_required: true, estimated_time: "3-5 business days" },
          { id: "api_consumer", name: "API/Fintech Partner", description: "Developer or fintech integrating via NEXCOM API", kyb_required: false, estimated_time: "1-2 business days" },
          { id: "exchange_member", name: "Exchange Member", description: "Full trading seat holder with direct market access", kyb_required: true, estimated_time: "10-15 business days" },
        ]);
      } finally { setLoading(false); }
    })();
  }, []);

  return { types, loading };
}

export function useOnboardingRequirements(stakeholderType: string) {
  const [requirements, setRequirements] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!stakeholderType) return;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`${KYC_URL}/api/v1/onboarding/requirements/${stakeholderType}`);
        const json = await res.json();
        setRequirements((json?.data ?? null) as Record<string, unknown>);
      } catch {
        setRequirements({
          stakeholder_type: stakeholderType,
          needs_kyb: ["broker_dealer", "market_maker", "digital_asset_issuer", "exchange_member"].includes(stakeholderType),
          kyc_steps: ["government_id", "proof_of_address", "selfie_liveness"],
          kyb_documents: [],
          estimated_time: "15-30 minutes",
          fees: { kyc_fee: 5000, currency: "NGN" },
        });
      } finally { setLoading(false); }
    })();
  }, [stakeholderType]);

  return { requirements, loading };
}

export function useKYCStats() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${KYC_URL}/api/v1/kyc/stats`);
        const json = await res.json();
        setStats((json?.data ?? null) as Record<string, unknown>);
      } catch {
        setStats({
          total_kyc: 5,
          total_kyb: 3,
          kyc_by_status: { approved: 1, under_review: 1, liveness_complete: 1, document_uploaded: 1, rejected: 1 },
          kyb_by_status: { approved: 1, under_review: 1, processing: 1 },
          kyc_by_stakeholder: { retail_trader: 3, institutional_investor: 1, api_consumer: 1 },
          pending_review: 2,
          rejection_rate: 20.0,
          avg_processing_time: "2.5 hours",
        });
      } finally { setLoading(false); }
    })();
  }, []);

  return { stats, loading };
}

export function useCreateKYC() {
  const [loading, setLoading] = useState(false);

  const createKYC = useCallback(async (data: Record<string, unknown>) => {
    setLoading(true);
    try {
      const res = await fetch(`${KYC_URL}/api/v1/kyc/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      return json?.data;
    } catch {
      return { id: `kyc-local-${Date.now()}`, status: "pending", ...data };
    } finally { setLoading(false); }
  }, []);

  return { createKYC, loading };
}

export function useCreateKYB() {
  const [loading, setLoading] = useState(false);

  const createKYB = useCallback(async (data: Record<string, unknown>) => {
    setLoading(true);
    try {
      const res = await fetch(`${KYC_URL}/api/v1/kyb/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      return json?.data;
    } catch {
      return { id: `kyb-local-${Date.now()}`, status: "pending", ...data };
    } finally { setLoading(false); }
  }, []);

  return { createKYB, loading };
}
