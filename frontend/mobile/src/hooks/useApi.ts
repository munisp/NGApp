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

// ─── Blockchain / Digital Assets hooks ──────────────────────────────────────

const MOCK_FRACTIONAL_ASSETS = [
  { asset_id: "FA-GOLD-001", token_id: "TKN-GOLD-001", symbol: "GOLD", name: "Gold Bar 1kg - LBMA Certified", total_fractions: 10000, available_fractions: 6500, fraction_price: 7.85, total_value: 78500, holders: 2, chain: "polygon", contract_address: "0xNEXCOM_GOLD", metadata_cid: "QmGoldBar001", status: "Active" },
  { asset_id: "FA-COFFEE-001", token_id: "TKN-COFFEE-001", symbol: "COFFEE", name: "Arabica Coffee 10MT - Kenya AA", total_fractions: 5000, available_fractions: 3200, fraction_price: 9.04, total_value: 45200, holders: 2, chain: "polygon", contract_address: "0xNEXCOM_COFFEE", metadata_cid: "QmCoffee001", status: "Active" },
  { asset_id: "FA-MAIZE-001", token_id: "TKN-MAIZE-001", symbol: "MAIZE", name: "White Maize 50MT - Grade 1", total_fractions: 20000, available_fractions: 15000, fraction_price: 0.71, total_value: 14200, holders: 1, chain: "polygon", contract_address: "0xNEXCOM_MAIZE", metadata_cid: "QmMaize001", status: "Active" },
  { asset_id: "FA-CRUDE-001", token_id: "TKN-CRUDE-001", symbol: "CRUDE_OIL", name: "Brent Crude 1000bbl - Bonny Light", total_fractions: 50000, available_fractions: 42000, fraction_price: 1.57, total_value: 78500, holders: 2, chain: "ethereum", contract_address: "0xNEXCOM_CRUDE", metadata_cid: "QmCrude001", status: "Active" },
  { asset_id: "FA-CARBON-001", token_id: "TKN-CARBON-001", symbol: "CARBON", name: "EU ETS Carbon Credits 100t", total_fractions: 10000, available_fractions: 8500, fraction_price: 0.65, total_value: 6500, holders: 1, chain: "polygon", contract_address: "0xNEXCOM_CARBON", metadata_cid: "QmCarbon001", status: "Active" },
];

export function useFractionalAssets() {
  return useApiQuery(() => apiClient.getFractionalAssets(), { assets: MOCK_FRACTIONAL_ASSETS });
}

export function useFractionalOrderbook(assetId: string) {
  return useApiQuery(() => apiClient.getFractionalOrderbook(assetId), { bids: [], asks: [], spread: 0 });
}

export function useFractionalPortfolio(holderId: string) {
  return useApiQuery(() => apiClient.getFractionalPortfolio(holderId), { holdings: [], total_value: 0 });
}

export function useChainStatus() {
  return useApiQuery(() => apiClient.getChainStatus(), { chains: [] });
}

export function useIpfsStatus() {
  return useApiQuery(() => apiClient.getIpfsStatus(), { connected: false, api_url: "", gateway_url: "", pinned_objects: 0 });
}

// ─── Warehouse Receipts hooks ────────────────────────────────────────────────

const MOCK_WAREHOUSE_RECEIPTS = [
  { id: "WR-00001", depositor_name: "Adamu Bello", warehouse_name: "Kano Commodity Warehouse", warehouse_location: "Bompai Industrial Area, Kano", commodity: "Maize", commodity_category: "grains", quantity_tonnes: 12.5, quality_grade: "grade_a", total_value: 3500000, currency: "NGN", status: "active", tradeable: true, collateralized: false, deposit_date: "2025-09-15", expiry_date: "2026-03-15" },
  { id: "WR-00002", depositor_name: "Oluwaseun Adebayo", warehouse_name: "Iseyin Cocoa Store", warehouse_location: "Iseyin, Oyo State", commodity: "Cocoa Beans", commodity_category: "cash_crops", quantity_tonnes: 5.0, quality_grade: "premium", total_value: 22500000, currency: "NGN", status: "active", tradeable: true, collateralized: true, deposit_date: "2025-10-01", expiry_date: "2026-04-01" },
];

export function useWarehouseReceipts() {
  return useApiQuery(() => apiClient.getWarehouseReceipts(), { receipts: MOCK_WAREHOUSE_RECEIPTS });
}

// ─── Produce Inventory hooks ─────────────────────────────────────────────────

const MOCK_PRODUCE = [
  { id: "PRD-00001", producer_name: "Adamu Bello", commodity: "Maize", commodity_category: "grains", variety: "SAMMAZ-15", estimated_quantity_tonnes: 8.0, quality_grade: "grade_a", farm_location: "Kura LGA, Kano State", farm_size_hectares: 3.5, planting_date: "2025-06-15", expected_harvest_date: "2025-10-15", asking_price_per_tonne: 280000, status: "harvested", listed_on_exchange: true },
  { id: "PRD-00002", producer_name: "Oluwaseun Adebayo", commodity: "Cocoa Beans", commodity_category: "cash_crops", variety: "Amelonado", estimated_quantity_tonnes: 5.0, quality_grade: "premium", farm_location: "Iseyin, Oyo State", farm_size_hectares: 120.0, planting_date: "2025-03-01", expected_harvest_date: "2025-09-30", asking_price_per_tonne: 4500000, status: "harvested", listed_on_exchange: true },
  { id: "PRD-00003", producer_name: "Hauwa Yakubu", commodity: "Sorghum", commodity_category: "grains", variety: "SAMSORG-17", estimated_quantity_tonnes: 2.0, quality_grade: "grade_b", farm_location: "Giwa LGA, Kaduna State", farm_size_hectares: 1.2, planting_date: "2025-06-20", expected_harvest_date: "2025-11-01", asking_price_per_tonne: 220000, status: "growing", listed_on_exchange: false },
];

export function useProduceInventory() {
  return useApiQuery(() => apiClient.getProduceInventory(), { inventory: MOCK_PRODUCE });
}

// ─── Onboarding / Stakeholder Types hooks ────────────────────────────────────

const MOCK_STAKEHOLDER_TYPES = [
  { id: "retail_trader", name: "Individual Trader", category: "trading_finance", description: "Personal trading account for commodity futures, options, and digital assets", kyb_required: false, estimated_time: "15-30 minutes" },
  { id: "broker_dealer", name: "Broker/Dealer", category: "trading_finance", description: "Licensed broker providing market access to clients", kyb_required: true, estimated_time: "5-10 business days" },
  { id: "smallholder_farmer", name: "Smallholder Farmer", category: "agriculture", description: "Small-scale farmer — simplified onboarding", kyb_required: false, estimated_time: "5-10 minutes", simplified_kyc: true },
  { id: "farmer_cooperative", name: "Farmer Cooperative", category: "agriculture", description: "Registered cooperative society aggregating produce", kyb_required: true, estimated_time: "3-5 business days" },
  { id: "mining_company", name: "Mining Company", category: "mining_metals", description: "Licensed mining company with mineral extraction operations", kyb_required: true, estimated_time: "10-15 business days" },
  { id: "oil_producer", name: "Oil Producer", category: "energy", description: "Upstream oil production company", kyb_required: true, estimated_time: "10-15 business days" },
  { id: "warehouse_operator", name: "Warehouse Operator", category: "infrastructure", description: "Licensed commodity storage facility", kyb_required: true, estimated_time: "5-10 business days" },
  { id: "trade_finance_bank", name: "Trade Finance Bank", category: "commodity_finance", description: "Bank providing trade finance and letters of credit", kyb_required: true, estimated_time: "10-15 business days" },
];

export function useStakeholderTypes() {
  return useApiQuery(() => apiClient.getStakeholderTypes(), { types: MOCK_STAKEHOLDER_TYPES });
}

// ─── KYC/KYB Compliance hooks ────────────────────────────────────────────────

const MOCK_KYC_APPS = [
  { id: "kyc-001", full_name: "Aisha Mohammed", email: "aisha@nexcom.ng", stakeholder_type: "institutional_investor", status: "approved", risk_level: "low" },
  { id: "kyc-002", full_name: "Chukwuemeka Obi", email: "emeka@trading.ng", stakeholder_type: "retail_trader", status: "under_review", risk_level: "medium" },
  { id: "kyc-003", full_name: "Fatima Abubakar", email: "fatima@gmail.com", stakeholder_type: "retail_trader", status: "liveness_complete", risk_level: "low" },
];

const MOCK_KYB_APPS = [
  { id: "kyb-001", business_name: "Stanbic Securities Ltd", registration_number: "RC-1234567", stakeholder_type: "broker_dealer", status: "approved", industry: "Securities Trading", risk_level: "low" },
  { id: "kyb-002", business_name: "Optiver Africa Trading", registration_number: "RC-2345678", stakeholder_type: "market_maker", status: "under_review", industry: "Market Making", risk_level: "medium" },
];

const MOCK_KYC_STATS = {
  total_kyc: 5, total_kyb: 3, pending_review: 2, rejection_rate: 20.0, avg_processing_time: "2.5 hours",
  kyc_by_status: { approved: 1, under_review: 1, liveness_complete: 1, document_uploaded: 1, rejected: 1 },
};

export function useKYCApplications() {
  return useApiQuery(() => apiClient.getKYCApplications(), { applications: MOCK_KYC_APPS });
}

export function useKYBApplications() {
  return useApiQuery(() => apiClient.getKYBApplications(), { applications: MOCK_KYB_APPS });
}

export function useKYCStats() {
  return useApiQuery(() => apiClient.getKYCStats(), { stats: MOCK_KYC_STATS });
}

// ─── Fee / Revenue hooks ─────────────────────────────────────────────────────

const MOCK_FEE_STATUS = {
  revenue_streams: [
    { stream: "trading_commissions", label: "Trading Commissions", daily_revenue: 2450000, monthly_revenue: 73500000, transactions: 12500, avg_fee_bps: 5 },
    { stream: "clearing_fees", label: "Clearing & Settlement", daily_revenue: 850000, monthly_revenue: 25500000, transactions: 8200, avg_fee_bps: 3 },
    { stream: "market_data_fees", label: "Market Data", daily_revenue: 420000, monthly_revenue: 12600000, transactions: 340, avg_fee_bps: 0 },
    { stream: "listing_fees", label: "Listing Fees", daily_revenue: 180000, monthly_revenue: 5400000, transactions: 12, avg_fee_bps: 0 },
    { stream: "membership_fees", label: "Membership", daily_revenue: 95000, monthly_revenue: 2850000, transactions: 45, avg_fee_bps: 0 },
    { stream: "technology_fees", label: "Technology & API", daily_revenue: 310000, monthly_revenue: 9300000, transactions: 890, avg_fee_bps: 2 },
  ],
};

export function useFeeStatus() {
  return useApiQuery(() => apiClient.getFeeStatus(), MOCK_FEE_STATUS);
}

// ─── Surveillance hooks ──────────────────────────────────────────────────────

const MOCK_SURVEILLANCE = [
  { id: "SRV-001", alert_type: "unusual_volume", severity: "high", symbol: "MAIZE", description: "Trading volume 3x above 30-day average", timestamp: "2026-03-01T14:30:00Z", status: "open" },
  { id: "SRV-002", alert_type: "spoofing", severity: "critical", symbol: "GOLD", description: "Large orders placed and cancelled within 500ms", timestamp: "2026-03-01T13:15:00Z", status: "open" },
  { id: "SRV-003", alert_type: "wash_trading", severity: "medium", symbol: "COFFEE", description: "Possible wash trading between related accounts", timestamp: "2026-03-01T11:45:00Z", status: "investigating" },
];

export function useSurveillanceAlerts() {
  return useApiQuery(() => apiClient.getSurveillanceAlerts(), { alerts: MOCK_SURVEILLANCE });
}
