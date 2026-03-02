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
  lastPrice: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
}

export interface Position {
  symbol: string;
  side: OrderSide;
  quantity: number;
  averageEntryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  margin: number;
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
  createdAt: string;
}

export interface Trade {
  id: string;
  symbol: string;
  side: OrderSide;
  price: number;
  quantity: number;
  fee: number;
  timestamp: string;
  settlementStatus: "pending" | "settled" | "failed";
}

export type RootStackParamList = {
  MainTabs: undefined;
  TradeDetail: { symbol: string };
  OrderConfirm: { symbol: string; side: OrderSide; type: OrderType; price: number; quantity: number };
  CommodityDetail: { symbol: string };
  Notifications: undefined;
  Settings: undefined;
  KYC: undefined;
  MarketMakers: undefined;
  Indices: undefined;
  CorporateActions: undefined;
  Brokers: undefined;
  DigitalAssets: undefined;
  WarehouseReceipts: undefined;
  ProduceRegistration: undefined;
  Onboarding: undefined;
  Compliance: undefined;
  Revenue: undefined;
  Surveillance: undefined;
  Alerts: undefined;
  Analytics: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Markets: undefined;
  Trade: undefined;
  Portfolio: undefined;
  Account: undefined;
};
