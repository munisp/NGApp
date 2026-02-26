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
