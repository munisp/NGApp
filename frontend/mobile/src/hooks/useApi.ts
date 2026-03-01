/**
 * NEXCOM Exchange - Mobile API Hooks
 * React hooks connecting all mobile screens to the Go Gateway backend.
 * Falls back to mock data when backend is unavailable.
 */
import { useState, useEffect, useCallback } from "react";
import apiClient from "../services/api-client";

// ─── Generic fetch hook ──────────────────────────────────────────────────────

function useApiQuery<T>(fetcher: () => Promise<{ success: boolean; data?: T; error?: string }>, fallback: T) {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher();
      if (res.success && res.data) {
        setData(res.data as T);
      } else {
        setError(res.error || "Request failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

// ─── Market hooks ────────────────────────────────────────────────────────────

const MOCK_MARKETS = [
  { symbol: "MAIZE", name: "Maize", category: "Agricultural", lastPrice: 285.5, change24h: 3.25, changePercent24h: 1.15, volume24h: 45200000, high24h: 287.0, low24h: 281.0 },
  { symbol: "GOLD", name: "Gold", category: "Metals", lastPrice: 2345.6, change24h: 12.4, changePercent24h: 0.53, volume24h: 89500000, high24h: 2360.0, low24h: 2330.0 },
  { symbol: "COFFEE", name: "Coffee", category: "Agricultural", lastPrice: 4520.0, change24h: 45.0, changePercent24h: 1.01, volume24h: 32100000, high24h: 4550.0, low24h: 4470.0 },
  { symbol: "CRUDE_OIL", name: "Crude Oil", category: "Energy", lastPrice: 78.42, change24h: 1.23, changePercent24h: 1.59, volume24h: 125000000, high24h: 79.5, low24h: 76.8 },
  { symbol: "CARBON", name: "Carbon Credits", category: "Carbon", lastPrice: 65.2, change24h: 0.85, changePercent24h: 1.32, volume24h: 8900000, high24h: 66.0, low24h: 64.0 },
  { symbol: "WHEAT", name: "Wheat", category: "Agricultural", lastPrice: 652.0, change24h: -4.7, changePercent24h: -0.72, volume24h: 28700000, high24h: 658.0, low24h: 648.0 },
  { symbol: "COCOA", name: "Cocoa", category: "Agricultural", lastPrice: 3280.0, change24h: -45.2, changePercent24h: -1.37, volume24h: 15400000, high24h: 3340.0, low24h: 3270.0 },
  { symbol: "SILVER", name: "Silver", category: "Metals", lastPrice: 27.85, change24h: 0.32, changePercent24h: 1.16, volume24h: 42300000, high24h: 28.2, low24h: 27.4 },
  { symbol: "NAT_GAS", name: "Natural Gas", category: "Energy", lastPrice: 2.89, change24h: 0.08, changePercent24h: 2.85, volume24h: 67800000, high24h: 2.95, low24h: 2.78 },
  { symbol: "TEA", name: "Tea", category: "Agricultural", lastPrice: 3.45, change24h: 0.05, changePercent24h: 1.47, volume24h: 5600000, high24h: 3.5, low24h: 3.38 },
];

export function useMarkets(category?: string, search?: string) {
  return useApiQuery(
    () => apiClient.getMarkets(category, search),
    { commodities: MOCK_MARKETS }
  );
}

export function useTicker(symbol: string) {
  const fallback = MOCK_MARKETS.find((m) => m.symbol === symbol) || MOCK_MARKETS[0];
  return useApiQuery(() => apiClient.getTicker(symbol), fallback);
}

export function useOrderBook(symbol: string) {
  return useApiQuery(() => apiClient.getOrderBook(symbol), { bids: [], asks: [], spread: 0 });
}

// ─── Order hooks ─────────────────────────────────────────────────────────────

const MOCK_ORDERS = [
  { id: "ord-001", symbol: "MAIZE", side: "BUY", type: "LIMIT", status: "OPEN", quantity: 100, price: 282.0, filledQuantity: 0, createdAt: new Date().toISOString() },
  { id: "ord-002", symbol: "GOLD", side: "SELL", type: "MARKET", status: "FILLED", quantity: 4, price: 2349.8, filledQuantity: 4, createdAt: new Date().toISOString() },
  { id: "ord-003", symbol: "COFFEE", side: "BUY", type: "LIMIT", status: "PARTIAL", quantity: 20, price: 4518.5, filledQuantity: 12, createdAt: new Date().toISOString() },
];

export function useOrders(status?: string) {
  return useApiQuery(() => apiClient.getOrders(status), { orders: MOCK_ORDERS });
}

export function useCreateOrder() {
  const [loading, setLoading] = useState(false);
  const submit = useCallback(async (order: { symbol: string; side: string; type: string; quantity: number; price?: number }) => {
    setLoading(true);
    try {
      const res = await apiClient.createOrder(order);
      return res;
    } finally {
      setLoading(false);
    }
  }, []);
  return { submit, loading };
}

export function useCancelOrder() {
  const [loading, setLoading] = useState(false);
  const cancel = useCallback(async (orderId: string) => {
    setLoading(true);
    try {
      return await apiClient.cancelOrder(orderId);
    } finally {
      setLoading(false);
    }
  }, []);
  return { cancel, loading };
}

// ─── Portfolio hooks ─────────────────────────────────────────────────────────

const MOCK_PORTFOLIO = {
  totalValue: 156420.5,
  availableBalance: 98540.2,
  marginUsed: 13550.96,
  unrealizedPnl: 2845.3,
  positions: [
    { id: "pos-001", symbol: "MAIZE", side: "LONG", quantity: 500, averageEntryPrice: 278.0, currentPrice: 285.5, unrealizedPnl: 3750, unrealizedPnlPercent: 2.7, margin: 13900 },
    { id: "pos-002", symbol: "GOLD", side: "SHORT", quantity: 4, averageEntryPrice: 2349.8, currentPrice: 2345.6, unrealizedPnl: 16.8, unrealizedPnlPercent: 0.18, margin: 9399.2 },
    { id: "pos-003", symbol: "COFFEE", side: "LONG", quantity: 20, averageEntryPrice: 4518.5, currentPrice: 4520.0, unrealizedPnl: 30.0, unrealizedPnlPercent: 0.03, margin: 9037 },
    { id: "pos-004", symbol: "CRUDE_OIL", side: "LONG", quantity: 200, averageEntryPrice: 76.5, currentPrice: 78.42, unrealizedPnl: 384.0, unrealizedPnlPercent: 2.51, margin: 1530 },
  ],
};

export function usePortfolio() {
  return useApiQuery(() => apiClient.getPortfolio(), MOCK_PORTFOLIO);
}

export function usePositions() {
  return useApiQuery(() => apiClient.getPositions(), { positions: MOCK_PORTFOLIO.positions });
}

// ─── Alert hooks ─────────────────────────────────────────────────────────────

const MOCK_ALERTS = [
  { id: "alt-001", symbol: "MAIZE", condition: "ABOVE", targetPrice: 285.0, active: true },
  { id: "alt-002", symbol: "GOLD", condition: "BELOW", targetPrice: 1950.0, active: true },
  { id: "alt-003", symbol: "COFFEE", condition: "ABOVE", targetPrice: 165.0, active: false },
  { id: "alt-004", symbol: "CRUDE_OIL", condition: "BELOW", targetPrice: 72.0, active: true },
];

export function useAlerts() {
  return useApiQuery(() => apiClient.getAlerts(), { alerts: MOCK_ALERTS });
}

// ─── Account hooks ───────────────────────────────────────────────────────────

const MOCK_PROFILE = {
  id: "usr-001",
  name: "Alex Trader",
  email: "trader@nexcom.exchange",
  phone: "+254712345678",
  country: "Kenya",
  accountTier: "retail_trader",
  kycStatus: "verified",
};

export function useProfile() {
  return useApiQuery(() => apiClient.getProfile(), MOCK_PROFILE);
}

// ─── Notifications hooks ─────────────────────────────────────────────────────

const MOCK_NOTIFICATIONS = [
  { id: "notif-001", type: "order_filled", title: "Order Filled", message: "Your BUY order for 100 MAIZE filled at $278.50", read: false, timestamp: new Date().toISOString() },
  { id: "notif-002", type: "price_alert", title: "Price Alert", message: "GOLD crossed above $2,050.00", read: false, timestamp: new Date().toISOString() },
  { id: "notif-003", type: "margin_warning", title: "Margin Warning", message: "COFFEE SHORT margin at 85%", read: false, timestamp: new Date().toISOString() },
];

export function useNotifications() {
  return useApiQuery(() => apiClient.getNotifications(), { notifications: MOCK_NOTIFICATIONS });
}

// ─── NGX Module hooks (Gap 5) ───────────────────────────────────────────

const MOCK_MARKET_MAKERS = [
  { id: "MM-001", name: "NEXCOM Primary Market Maker", status: "ACTIVE", clearing_member_id: "CM-001", assigned_symbols: ["MAIZE", "GOLD", "COFFEE", "CRUDE_OIL", "WHEAT", "COCOA", "SILVER", "CARBON"] },
  { id: "MM-002", name: "Pan-African Liquidity Provider", status: "ACTIVE", clearing_member_id: "CM-002", assigned_symbols: ["MAIZE", "COFFEE", "COCOA", "TEA"] },
];

export function useMarketMakers() {
  return useApiQuery(() => apiClient.getMarketMakers(), { market_makers: MOCK_MARKET_MAKERS });
}

const MOCK_INDICES = [
  { id: "NGX-ASI", name: "NGX All-Share Index", value: 98432.5, change_pct: 1.24, components: 8 },
  { id: "NGX-AGR", name: "NGX Agricultural Index", value: 4521.8, change_pct: 0.87, components: 4 },
  { id: "NGX-MET", name: "NGX Metals Index", value: 2345.6, change_pct: -0.32, components: 2 },
  { id: "NGX-ENE", name: "NGX Energy Index", value: 1890.3, change_pct: 1.56, components: 2 },
  { id: "NGX-ESG", name: "NGX ESG/Carbon Index", value: 765.2, change_pct: 2.1, components: 1 },
];

export function useIndices() {
  return useApiQuery(() => apiClient.getIndices(), { indices: MOCK_INDICES });
}

const MOCK_CORPORATE_ACTIONS = [
  { id: "CA-001", symbol: "MAIZE", action_type: "STOCK_SPLIT", status: "PENDING", effective_date: "2026-04-01", description: "2:1 contract split" },
  { id: "CA-002", symbol: "GOLD", action_type: "DIVIDEND", status: "PROCESSED", effective_date: "2026-03-15", description: "Quarterly storage fee adjustment" },
  { id: "CA-003", symbol: "COFFEE", action_type: "SYMBOL_CHANGE", status: "PENDING", effective_date: "2026-05-01", description: "Symbol change to ARABICA" },
];

export function useCorporateActions() {
  return useApiQuery(() => apiClient.getCorporateActions(), { corporate_actions: MOCK_CORPORATE_ACTIONS });
}

const MOCK_BROKERS = [
  { id: "BRK-001", name: "NEXCOM Direct Access", status: "CONNECTED", connected_clients: 245, order_routing: "DMA" },
  { id: "BRK-002", name: "Pan-African Securities", status: "CONNECTED", connected_clients: 189, order_routing: "SOR" },
  { id: "BRK-003", name: "East Africa Brokerage", status: "CONNECTED", connected_clients: 156, order_routing: "DMA" },
  { id: "BRK-004", name: "Lagos Securities Ltd", status: "CONNECTED", connected_clients: 98, order_routing: "ALGO" },
  { id: "BRK-005", name: "Nairobi Trading Corp", status: "DISCONNECTED", connected_clients: 0, order_routing: "DMA" },
];

export function useBrokers() {
  return useApiQuery(() => apiClient.getBrokers(), { brokers: MOCK_BROKERS });
}

// ─── Analytics hooks ─────────────────────────────────────────────────────────

export function useAnalyticsDashboard() {
  return useApiQuery(() => apiClient.getDashboard(), {
    marketCap: 2470000000,
    volume24h: 456000000,
    activePairs: 42,
    activeTraders: 12500,
  });
}

export function useAiInsights() {
  return useApiQuery(() => apiClient.getAiInsights(), {
    sentiment: { bullish: 62, bearish: 23, neutral: 15 },
    anomalies: [],
    recommendations: [],
  });
}
