// ============================================================
// NEXCOM Exchange - Core Types
// ============================================================

export type OrderSide = "BUY" | "SELL";
export type OrderType = "MARKET" | "LIMIT" | "STOP" | "STOP_LIMIT" | "IOC" | "FOK";
export type OrderStatus = "PENDING" | "OPEN" | "PARTIAL" | "FILLED" | "CANCELLED" | "REJECTED";
export type KYCStatus = "NONE" | "PENDING" | "VERIFIED" | "REJECTED";
export type AccountTier = "farmer" | "retail_trader" | "institutional" | "cooperative";

export interface Commodity {
  id: string;
  symbol: string;
  name: string;
  category: "agricultural" | "precious_metals" | "energy" | "carbon_credits";
  unit: string;
  tickSize: number;
  lotSize: number;
  lastPrice: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  open24h: number;
}

export interface Order {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  status: OrderStatus;
  quantity: number;
  price: number;
  filledQuantity: number;
  averagePrice: number;
  createdAt: string;
  updatedAt: string;
}

export interface Trade {
  id: string;
  symbol: string;
  side: OrderSide;
  price: number;
  quantity: number;
  fee: number;
  timestamp: string;
  orderId: string;
  settlementStatus: "pending" | "settled" | "failed";
}

export interface Position {
  symbol: string;
  side: OrderSide;
  quantity: number;
  averageEntryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  realizedPnl: number;
  margin: number;
  liquidationPrice: number;
}

export interface OHLCVCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
  total: number;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  spreadPercent: number;
  lastUpdate: number;
}

export interface MarketTicker {
  symbol: string;
  lastPrice: number;
  bid: number;
  ask: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  timestamp: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  accountTier: AccountTier;
  kycStatus: KYCStatus;
  phone?: string;
  country?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: "trade" | "order" | "alert" | "system" | "kyc" | "margin";
  title: string;
  message: string;
  read: boolean;
  timestamp: string;
}

export interface PriceAlert {
  id: string;
  symbol: string;
  condition: "above" | "below";
  targetPrice: number;
  active: boolean;
  createdAt: string;
}

export interface PortfolioSummary {
  totalValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  availableBalance: number;
  marginUsed: number;
  marginAvailable: number;
  positions: Position[];
}
