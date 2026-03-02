import { create } from "zustand";
import type {
  Commodity,
  Order,
  Position,
  Trade,
  Notification,
  OrderBook,
  MarketTicker,
  PortfolioSummary,
  PriceAlert,
  User,
  OrderBookLevel,
} from "@/types";

// ============================================================
// Market Data Store
// ============================================================

interface MarketState {
  tickers: Record<string, MarketTicker>;
  orderBooks: Record<string, OrderBook>;
  commodities: Commodity[];
  watchlist: string[];
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
  toggleWatchlist: (symbol: string) => void;
  updateTicker: (ticker: MarketTicker) => void;
  updateOrderBook: (symbol: string, book: OrderBook) => void;
  setCommodities: (commodities: Commodity[]) => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  tickers: {},
  orderBooks: {},
  commodities: getMockCommodities(),
  watchlist: ["MAIZE", "GOLD", "COFFEE", "CRUDE_OIL"],
  selectedSymbol: "MAIZE",
  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
  toggleWatchlist: (symbol) =>
    set((state) => ({
      watchlist: state.watchlist.includes(symbol)
        ? state.watchlist.filter((s) => s !== symbol)
        : [...state.watchlist, symbol],
    })),
  updateTicker: (ticker) =>
    set((state) => ({
      tickers: { ...state.tickers, [ticker.symbol]: ticker },
    })),
  updateOrderBook: (symbol, book) =>
    set((state) => ({
      orderBooks: { ...state.orderBooks, [symbol]: book },
    })),
  setCommodities: (commodities) => set({ commodities }),
}));

// ============================================================
// Trading Store
// ============================================================

interface TradingState {
  orders: Order[];
  trades: Trade[];
  positions: Position[];
  portfolio: PortfolioSummary;
  alerts: PriceAlert[];
  setOrders: (orders: Order[]) => void;
  setTrades: (trades: Trade[]) => void;
  setPositions: (positions: Position[]) => void;
  addOrder: (order: Order) => void;
}

export const useTradingStore = create<TradingState>((set) => ({
  orders: getMockOrders(),
  trades: getMockTrades(),
  positions: getMockPositions(),
  portfolio: getMockPortfolio(),
  alerts: [],
  setOrders: (orders) => set({ orders }),
  setTrades: (trades) => set({ trades }),
  setPositions: (positions) => set({ positions }),
  addOrder: (order) => set((state) => ({ orders: [order, ...state.orders] })),
}));

// ============================================================
// User Store
// ============================================================

interface UserState {
  user: User | null;
  notifications: Notification[];
  unreadCount: number;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setNotifications: (notifications: Notification[]) => void;
  markRead: (id: string) => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: getMockUser(),
  notifications: getMockNotifications(),
  unreadCount: 3,
  isAuthenticated: true,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setNotifications: (notifications) =>
    set({ notifications, unreadCount: notifications.filter((n) => !n.read).length }),
  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: state.unreadCount - 1,
    })),
}));

// ============================================================
// Mock Data
// ============================================================

function getMockCommodities(): Commodity[] {
  return [
    { id: "1", symbol: "MAIZE", name: "Maize (Corn)", category: "agricultural", unit: "MT", tickSize: 0.25, lotSize: 10, lastPrice: 285.50, change24h: 3.25, changePercent24h: 1.15, volume24h: 45230, high24h: 287.00, low24h: 281.00, open24h: 282.25 },
    { id: "2", symbol: "WHEAT", name: "Wheat", category: "agricultural", unit: "MT", tickSize: 0.25, lotSize: 10, lastPrice: 342.75, change24h: -2.50, changePercent24h: -0.72, volume24h: 32100, high24h: 346.00, low24h: 340.50, open24h: 345.25 },
    { id: "3", symbol: "COFFEE", name: "Coffee Arabica", category: "agricultural", unit: "MT", tickSize: 0.05, lotSize: 5, lastPrice: 4520.00, change24h: 45.00, changePercent24h: 1.01, volume24h: 18900, high24h: 4535.00, low24h: 4470.00, open24h: 4475.00 },
    { id: "4", symbol: "COCOA", name: "Cocoa", category: "agricultural", unit: "MT", tickSize: 0.50, lotSize: 10, lastPrice: 3890.00, change24h: -15.00, changePercent24h: -0.38, volume24h: 12400, high24h: 3920.00, low24h: 3875.00, open24h: 3905.00 },
    { id: "5", symbol: "SOYBEAN", name: "Soybeans", category: "agricultural", unit: "MT", tickSize: 0.25, lotSize: 10, lastPrice: 465.50, change24h: 5.75, changePercent24h: 1.25, volume24h: 28700, high24h: 468.00, low24h: 458.00, open24h: 459.75 },
    { id: "6", symbol: "GOLD", name: "Gold", category: "precious_metals", unit: "OZ", tickSize: 0.10, lotSize: 1, lastPrice: 2345.60, change24h: 12.40, changePercent24h: 0.53, volume24h: 89200, high24h: 2352.00, low24h: 2330.00, open24h: 2333.20 },
    { id: "7", symbol: "SILVER", name: "Silver", category: "precious_metals", unit: "OZ", tickSize: 0.01, lotSize: 50, lastPrice: 28.45, change24h: -0.32, changePercent24h: -1.11, volume24h: 54300, high24h: 29.10, low24h: 28.20, open24h: 28.77 },
    { id: "8", symbol: "CRUDE_OIL", name: "Crude Oil (WTI)", category: "energy", unit: "BBL", tickSize: 0.01, lotSize: 100, lastPrice: 78.42, change24h: 1.23, changePercent24h: 1.59, volume24h: 125800, high24h: 79.10, low24h: 76.80, open24h: 77.19 },
    { id: "9", symbol: "NAT_GAS", name: "Natural Gas", category: "energy", unit: "MMBTU", tickSize: 0.001, lotSize: 1000, lastPrice: 2.845, change24h: -0.065, changePercent24h: -2.23, volume24h: 67400, high24h: 2.930, low24h: 2.820, open24h: 2.910 },
    { id: "10", symbol: "CARBON", name: "Carbon Credits (EU ETS)", category: "carbon_credits", unit: "TCO2", tickSize: 0.01, lotSize: 100, lastPrice: 65.20, change24h: 0.85, changePercent24h: 1.32, volume24h: 15600, high24h: 65.80, low24h: 64.10, open24h: 64.35 },
  ];
}

function getMockOrders(): Order[] {
  return [
    { id: "ord-001", symbol: "MAIZE", side: "BUY", type: "LIMIT", status: "OPEN", quantity: 50, price: 284.00, filledQuantity: 0, averagePrice: 0, createdAt: "2026-02-26T10:15:00Z", updatedAt: "2026-02-26T10:15:00Z" },
    { id: "ord-002", symbol: "GOLD", side: "SELL", type: "LIMIT", status: "PARTIAL", quantity: 10, price: 2350.00, filledQuantity: 6, averagePrice: 2349.80, createdAt: "2026-02-26T09:45:00Z", updatedAt: "2026-02-26T10:30:00Z" },
    { id: "ord-003", symbol: "COFFEE", side: "BUY", type: "MARKET", status: "FILLED", quantity: 20, price: 0, filledQuantity: 20, averagePrice: 4518.50, createdAt: "2026-02-26T08:20:00Z", updatedAt: "2026-02-26T08:20:01Z" },
    { id: "ord-004", symbol: "CRUDE_OIL", side: "BUY", type: "STOP_LIMIT", status: "PENDING", quantity: 100, price: 80.00, filledQuantity: 0, averagePrice: 0, createdAt: "2026-02-26T07:00:00Z", updatedAt: "2026-02-26T07:00:00Z" },
  ];
}

function getMockTrades(): Trade[] {
  return [
    { id: "trd-001", symbol: "COFFEE", side: "BUY", price: 4518.50, quantity: 20, fee: 9.04, timestamp: "2026-02-26T08:20:01Z", orderId: "ord-003", settlementStatus: "settled" },
    { id: "trd-002", symbol: "GOLD", side: "SELL", price: 2349.80, quantity: 6, fee: 14.10, timestamp: "2026-02-26T10:30:00Z", orderId: "ord-002", settlementStatus: "pending" },
    { id: "trd-003", symbol: "MAIZE", side: "BUY", price: 282.00, quantity: 100, fee: 2.82, timestamp: "2026-02-25T14:10:00Z", orderId: "ord-100", settlementStatus: "settled" },
    { id: "trd-004", symbol: "WHEAT", side: "SELL", price: 345.00, quantity: 30, fee: 5.18, timestamp: "2026-02-25T11:45:00Z", orderId: "ord-099", settlementStatus: "settled" },
  ];
}

function getMockPositions(): Position[] {
  return [
    { symbol: "MAIZE", side: "BUY", quantity: 100, averageEntryPrice: 282.00, currentPrice: 285.50, unrealizedPnl: 350.00, unrealizedPnlPercent: 1.24, realizedPnl: 120.00, margin: 2820.00, liquidationPrice: 254.00 },
    { symbol: "GOLD", side: "SELL", quantity: 4, averageEntryPrice: 2349.80, currentPrice: 2345.60, unrealizedPnl: 16.80, unrealizedPnlPercent: 0.18, realizedPnl: 0, margin: 469.96, liquidationPrice: 2584.78 },
    { symbol: "COFFEE", side: "BUY", quantity: 20, averageEntryPrice: 4518.50, currentPrice: 4520.00, unrealizedPnl: 30.00, unrealizedPnlPercent: 0.03, realizedPnl: 0, margin: 9037.00, liquidationPrice: 4066.65 },
    { symbol: "CRUDE_OIL", side: "BUY", quantity: 200, averageEntryPrice: 76.50, currentPrice: 78.42, unrealizedPnl: 384.00, unrealizedPnlPercent: 2.51, realizedPnl: 225.00, margin: 1224.00, liquidationPrice: 68.85 },
  ];
}

function getMockPortfolio(): PortfolioSummary {
  return {
    totalValue: 156420.50,
    totalPnl: 2845.30,
    totalPnlPercent: 1.85,
    availableBalance: 98540.20,
    marginUsed: 13550.96,
    marginAvailable: 84989.24,
    positions: getMockPositions(),
  };
}

function getMockUser(): User {
  return {
    id: "usr-001",
    email: "trader@nexcom.exchange",
    name: "Alex Trader",
    accountTier: "retail_trader",
    kycStatus: "VERIFIED",
    phone: "+254700123456",
    country: "KE",
    createdAt: "2025-06-15T08:00:00Z",
  };
}

function getMockNotifications(): Notification[] {
  return [
    { id: "n-1", type: "trade", title: "Order Filled", message: "Your BUY order for 20 COFFEE at 4,518.50 has been filled", read: false, timestamp: "2026-02-26T08:20:01Z" },
    { id: "n-2", type: "alert", title: "Price Alert", message: "CRUDE_OIL has crossed above 78.00", read: false, timestamp: "2026-02-26T07:30:00Z" },
    { id: "n-3", type: "margin", title: "Margin Warning", message: "Your margin utilization is at 75%. Consider reducing positions.", read: false, timestamp: "2026-02-26T06:00:00Z" },
    { id: "n-4", type: "system", title: "Maintenance Window", message: "Scheduled maintenance on Feb 28 from 02:00-04:00 UTC", read: true, timestamp: "2026-02-25T12:00:00Z" },
    { id: "n-5", type: "kyc", title: "KYC Verified", message: "Your identity verification is complete. Full trading access enabled.", read: true, timestamp: "2026-02-20T09:00:00Z" },
  ];
}

export function getMockOrderBook(symbol: string): OrderBook {
  const commodity = getMockCommodities().find((c) => c.symbol === symbol);
  const basePrice = commodity?.lastPrice ?? 100;
  const bids: OrderBookLevel[] = [];
  const asks: OrderBookLevel[] = [];
  let bidTotal = 0;
  let askTotal = 0;

  for (let i = 0; i < 15; i++) {
    const bidQty = Math.floor(Math.random() * 500) + 50;
    bidTotal += bidQty;
    bids.push({
      price: Number((basePrice - (i + 1) * basePrice * 0.001).toFixed(2)),
      quantity: bidQty,
      total: bidTotal,
    });
    const askQty = Math.floor(Math.random() * 500) + 50;
    askTotal += askQty;
    asks.push({
      price: Number((basePrice + (i + 1) * basePrice * 0.001).toFixed(2)),
      quantity: askQty,
      total: askTotal,
    });
  }

  return {
    symbol,
    bids,
    asks,
    spread: Number((asks[0].price - bids[0].price).toFixed(2)),
    spreadPercent: Number((((asks[0].price - bids[0].price) / basePrice) * 100).toFixed(3)),
    lastUpdate: Date.now(),
  };
}
