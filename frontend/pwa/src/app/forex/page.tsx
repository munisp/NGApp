"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BadgeDollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  RefreshCw,
  Clock,
  Shield,
  Layers,
  Calculator,
  Globe,
  X,
  ChevronRight,
  AlertTriangle,
  BarChart3,
  Wallet,
} from "lucide-react";
import { api } from "@/lib/api-client";

// ── Types ──────────────────────────────────────────────────────────────────

interface FXPair {
  id: string;
  symbol: string;
  baseCurrency: string;
  quoteCurrency: string;
  displayName: string;
  category: string;
  pipSize: number;
  pipValue: number;
  minLotSize: number;
  maxLotSize: number;
  lotStep: number;
  maxLeverage: number;
  marginRequired: number;
  swapLong: number;
  swapShort: number;
  swapTripleDay: string;
  spreadTypical: number;
  spreadMin: number;
  commissionPerLot: number;
  tradingHours: string;
  active: boolean;
  bid: number;
  ask: number;
  high24h: number;
  low24h: number;
  change24h: number;
  changePercent: number;
  volume24h: number;
  lastUpdate: number;
}

interface FXOrder {
  id: string;
  userId: string;
  pair: string;
  side: "BUY" | "SELL";
  type: string;
  status: string;
  lotSize: number;
  price: number;
  stopLoss: number;
  takeProfit: number;
  trailingStopPips: number;
  ocoStopPrice: number;
  ocoLimitPrice: number;
  leverage: number;
  marginUsed: number;
  filledPrice: number;
  commission: number;
  swapAccrued: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

interface FXPosition {
  id: string;
  userId: string;
  pair: string;
  side: "BUY" | "SELL";
  status: string;
  lotSize: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  trailingStopPips: number;
  leverage: number;
  marginUsed: number;
  unrealizedPnl: number;
  unrealizedPips: number;
  swapAccrued: number;
  commission: number;
  liquidationPrice: number;
  openedAt: string;
}

interface FXAccountSummary {
  balance: number;
  equity: number;
  marginUsed: number;
  freeMargin: number;
  marginLevel: number;
  unrealizedPnl: number;
  realizedPnlToday: number;
  openPositions: number;
  pendingOrders: number;
  leverageTier: string;
  currency: string;
}

interface SwapRate {
  pair: string;
  swapLong: number;
  swapShort: number;
  tripleDay: string;
}

interface CrossRate {
  pair: string;
  rate: number;
  derivedFrom: string;
}

interface MarginReq {
  pair: string;
  retail: number;
  professional: number;
  institutional: number;
  maxLeverage: number;
}

interface LiquidityProvider {
  id: string;
  name: string;
  type: string;
  tier: string;
  status: string;
  latencyMs: number;
  spreadMarkup: number;
  supportedPairs: number;
  monthlyVolume: string;
}

interface RegulatoryInfo {
  jurisdiction: string;
  regulator: string;
  maxRetailLeverage: number;
  requiredDisclosures: string[];
  kycLevel: string;
  reportingFrequency: string;
}

// ── Mock Data (fallback when gateway unavailable) ──────────────────────

const MOCK_PAIRS: FXPair[] = [
  { id: "fx-001", symbol: "EUR/USD", baseCurrency: "EUR", quoteCurrency: "USD", displayName: "Euro / US Dollar", category: "major", pipSize: 0.0001, pipValue: 10, minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, maxLeverage: 200, marginRequired: 0.5, swapLong: -0.56, swapShort: 0.23, swapTripleDay: "Wednesday", spreadTypical: 1.2, spreadMin: 0.6, commissionPerLot: 3.5, tradingHours: "Sun 22:00 - Fri 22:00 UTC", active: true, bid: 1.0853, ask: 1.0855, high24h: 1.0892, low24h: 1.0821, change24h: 0.0018, changePercent: 0.17, volume24h: 1850000, lastUpdate: Date.now() },
  { id: "fx-002", symbol: "GBP/USD", baseCurrency: "GBP", quoteCurrency: "USD", displayName: "British Pound / US Dollar", category: "major", pipSize: 0.0001, pipValue: 10, minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, maxLeverage: 200, marginRequired: 0.5, swapLong: -0.78, swapShort: 0.35, swapTripleDay: "Wednesday", spreadTypical: 1.5, spreadMin: 0.8, commissionPerLot: 3.5, tradingHours: "Sun 22:00 - Fri 22:00 UTC", active: true, bid: 1.2641, ask: 1.2644, high24h: 1.2698, low24h: 1.2605, change24h: 0.0024, changePercent: 0.19, volume24h: 1250000, lastUpdate: Date.now() },
  { id: "fx-003", symbol: "USD/JPY", baseCurrency: "USD", quoteCurrency: "JPY", displayName: "US Dollar / Japanese Yen", category: "major", pipSize: 0.01, pipValue: 6.67, minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, maxLeverage: 200, marginRequired: 0.5, swapLong: 1.25, swapShort: -1.89, swapTripleDay: "Wednesday", spreadTypical: 1.0, spreadMin: 0.5, commissionPerLot: 3.5, tradingHours: "Sun 22:00 - Fri 22:00 UTC", active: true, bid: 149.85, ask: 149.87, high24h: 150.42, low24h: 149.51, change24h: -0.23, changePercent: -0.15, volume24h: 1650000, lastUpdate: Date.now() },
  { id: "fx-011", symbol: "USD/NGN", baseCurrency: "USD", quoteCurrency: "NGN", displayName: "US Dollar / Nigerian Naira", category: "african", pipSize: 0.01, pipValue: 0.067, minLotSize: 0.01, maxLotSize: 50, lotStep: 0.01, maxLeverage: 50, marginRequired: 2.0, swapLong: -2.5, swapShort: -1.8, swapTripleDay: "Wednesday", spreadTypical: 150, spreadMin: 80, commissionPerLot: 5, tradingHours: "Mon 08:00 - Fri 16:00 WAT", active: true, bid: 1580.5, ask: 1582.0, high24h: 1590.0, low24h: 1575.0, change24h: 3.5, changePercent: 0.22, volume24h: 45000, lastUpdate: Date.now() },
  { id: "fx-012", symbol: "EUR/NGN", baseCurrency: "EUR", quoteCurrency: "NGN", displayName: "Euro / Nigerian Naira", category: "african", pipSize: 0.01, pipValue: 0.067, minLotSize: 0.01, maxLotSize: 50, lotStep: 0.01, maxLeverage: 50, marginRequired: 2.0, swapLong: -2.8, swapShort: -2.1, swapTripleDay: "Wednesday", spreadTypical: 200, spreadMin: 120, commissionPerLot: 5, tradingHours: "Mon 08:00 - Fri 16:00 WAT", active: true, bid: 1715.2, ask: 1717.2, high24h: 1725.0, low24h: 1710.0, change24h: 5.2, changePercent: 0.30, volume24h: 28000, lastUpdate: Date.now() },
  { id: "fx-013", symbol: "GBP/NGN", baseCurrency: "GBP", quoteCurrency: "NGN", displayName: "British Pound / Nigerian Naira", category: "african", pipSize: 0.01, pipValue: 0.067, minLotSize: 0.01, maxLotSize: 50, lotStep: 0.01, maxLeverage: 50, marginRequired: 2.0, swapLong: -3.0, swapShort: -2.3, swapTripleDay: "Wednesday", spreadTypical: 250, spreadMin: 150, commissionPerLot: 5, tradingHours: "Mon 08:00 - Fri 16:00 WAT", active: true, bid: 1998.5, ask: 2001.0, high24h: 2010.0, low24h: 1990.0, change24h: 4.0, changePercent: 0.20, volume24h: 22000, lastUpdate: Date.now() },
];

const MOCK_ACCOUNT: FXAccountSummary = {
  balance: 50000, equity: 51245.80, marginUsed: 4520.30, freeMargin: 46725.50,
  marginLevel: 1133.68, unrealizedPnl: 1245.80, realizedPnlToday: 385.20,
  openPositions: 3, pendingOrders: 2, leverageTier: "professional", currency: "USD",
};

const MOCK_POSITIONS: FXPosition[] = [
  { id: "fxp-001", userId: "USR-001", pair: "EUR/USD", side: "BUY", status: "OPEN", lotSize: 1.0, entryPrice: 1.0835, currentPrice: 1.0853, stopLoss: 1.0800, takeProfit: 1.0900, trailingStopPips: 0, leverage: 100, marginUsed: 1085.30, unrealizedPnl: 180.0, unrealizedPips: 18, swapAccrued: -1.12, commission: 3.50, liquidationPrice: 1.0735, openedAt: "2026-03-02T08:15:00Z" },
  { id: "fxp-002", userId: "USR-001", pair: "GBP/USD", side: "SELL", status: "OPEN", lotSize: 0.5, entryPrice: 1.2668, currentPrice: 1.2641, stopLoss: 1.2720, takeProfit: 1.2580, trailingStopPips: 15, leverage: 100, marginUsed: 633.40, unrealizedPnl: 135.0, unrealizedPips: 27, swapAccrued: 0.88, commission: 1.75, liquidationPrice: 1.2798, openedAt: "2026-03-01T14:22:00Z" },
  { id: "fxp-003", userId: "USR-001", pair: "USD/NGN", side: "BUY", status: "OPEN", lotSize: 2.0, entryPrice: 1575.0, currentPrice: 1580.5, stopLoss: 1560.0, takeProfit: 1610.0, trailingStopPips: 0, leverage: 50, marginUsed: 6300.0, unrealizedPnl: 73.33, unrealizedPips: 550, swapAccrued: -5.0, commission: 10.0, liquidationPrice: 1540.0, openedAt: "2026-02-28T10:00:00Z" },
];

const MOCK_ORDERS: FXOrder[] = [
  { id: "fxo-001", userId: "USR-001", pair: "USD/JPY", side: "BUY", type: "LIMIT", status: "PENDING", lotSize: 1.0, price: 149.20, stopLoss: 148.50, takeProfit: 150.50, trailingStopPips: 0, ocoStopPrice: 0, ocoLimitPrice: 0, leverage: 100, marginUsed: 0, filledPrice: 0, commission: 0, swapAccrued: 0, comment: "Buy the dip", createdAt: "2026-03-02T09:00:00Z", updatedAt: "2026-03-02T09:00:00Z" },
  { id: "fxo-002", userId: "USR-001", pair: "EUR/USD", side: "SELL", type: "OCO", status: "PENDING", lotSize: 0.5, price: 0, stopLoss: 0, takeProfit: 0, trailingStopPips: 0, ocoStopPrice: 1.0820, ocoLimitPrice: 1.0900, leverage: 100, marginUsed: 0, filledPrice: 0, commission: 0, swapAccrued: 0, comment: "OCO breakout play", createdAt: "2026-03-02T09:30:00Z", updatedAt: "2026-03-02T09:30:00Z" },
];

// ── Helpers ─────────────────────────────────────────────────────────────

function formatFXPrice(price: number, pipSize: number): string {
  const decimals = pipSize < 0.001 ? 5 : pipSize < 0.1 ? 3 : 2;
  return price.toFixed(decimals);
}

function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

const CATEGORY_LABELS: Record<string, string> = {
  all: "All Pairs",
  major: "Major",
  minor: "Minor",
  african: "African",
  exotic: "Exotic",
};

// ── Main Page ───────────────────────────────────────────────────────────

type TabType = "watchlist" | "positions" | "orders" | "account" | "swaps" | "cross-rates" | "margin" | "liquidity" | "regulatory" | "calculator";

export default function ForexTradingPage() {
  const [tab, setTab] = useState<TabType>("watchlist");
  const [pairs, setPairs] = useState<FXPair[]>(MOCK_PAIRS);
  const [positions, setPositions] = useState<FXPosition[]>(MOCK_POSITIONS);
  const [orders, setOrders] = useState<FXOrder[]>(MOCK_ORDERS);
  const [account, setAccount] = useState<FXAccountSummary>(MOCK_ACCOUNT);
  const [swapRates, setSwapRates] = useState<SwapRate[]>([]);
  const [crossRates, setCrossRates] = useState<CrossRate[]>([]);
  const [marginReqs, setMarginReqs] = useState<MarginReq[]>([]);
  const [liquidityProviders, setLiquidityProviders] = useState<LiquidityProvider[]>([]);
  const [regulatoryInfo, setRegulatoryInfo] = useState<RegulatoryInfo[]>([]);
  const [selectedPair, setSelectedPair] = useState<FXPair | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Order form
  const [orderSide, setOrderSide] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState("MARKET");
  const [orderLots, setOrderLots] = useState("0.10");
  const [orderPrice, setOrderPrice] = useState("");
  const [orderSL, setOrderSL] = useState("");
  const [orderTP, setOrderTP] = useState("");
  const [orderLeverage, setOrderLeverage] = useState("100");
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  // Pip calculator
  const [pipPair, setPipPair] = useState("EUR/USD");
  const [pipLots, setPipLots] = useState("1.0");
  const [pipCount, setPipCount] = useState("10");
  const [pipResult, setPipResult] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pairsRes, posRes, ordRes, acctRes, swapRes, crossRes, marginRes, liqRes, regRes] = await Promise.allSettled([
        api.forex.pairs(),
        api.forex.positions("OPEN"),
        api.forex.orders("PENDING"),
        api.forex.account(),
        api.forex.swapRates(),
        api.forex.crossRates(),
        api.forex.marginRequirements(),
        api.forex.liquidityProviders(),
        api.forex.regulatory(),
      ]);

      const extract = (res: PromiseSettledResult<Record<string, unknown>>, key: string) => {
        if (res.status !== "fulfilled") return null;
        const d = res.value;
        const inner = d && typeof d === "object" && "data" in d ? d.data as Record<string, unknown> : d;
        return inner && typeof inner === "object" && key in inner ? (inner as Record<string, unknown>)[key] : null;
      };

      const p = extract(pairsRes, "pairs"); if (p) setPairs(p as FXPair[]);
      const pos = extract(posRes, "positions"); if (pos) setPositions(pos as FXPosition[]);
      const ord = extract(ordRes, "orders"); if (ord) setOrders(ord as FXOrder[]);
      if (acctRes.status === "fulfilled") {
        const d = acctRes.value;
        const inner = d && typeof d === "object" && "data" in d ? d.data : d;
        if (inner && typeof inner === "object" && "balance" in (inner as Record<string, unknown>)) setAccount(inner as unknown as FXAccountSummary);
      }
      const sw = extract(swapRes, "swapRates"); if (sw) setSwapRates(sw as SwapRate[]);
      const cr = extract(crossRes, "crossRates"); if (cr) setCrossRates(cr as CrossRate[]);
      const mr = extract(marginRes, "requirements"); if (mr) setMarginReqs(mr as MarginReq[]);
      const lp = extract(liqRes, "providers"); if (lp) setLiquidityProviders(lp as LiquidityProvider[]);
      const rg = extract(regRes, "jurisdictions"); if (rg) setRegulatoryInfo(rg as RegulatoryInfo[]);
    } catch {
      // Keep mock data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateOrder = async () => {
    if (!selectedPair) return;
    setOrderSubmitting(true);
    try {
      await api.forex.createOrder({
        pair: selectedPair.symbol,
        side: orderSide,
        type: orderType,
        lotSize: parseFloat(orderLots),
        price: orderPrice ? parseFloat(orderPrice) : undefined,
        stopLoss: orderSL ? parseFloat(orderSL) : undefined,
        takeProfit: orderTP ? parseFloat(orderTP) : undefined,
        leverage: parseInt(orderLeverage),
      });
      fetchData();
    } catch {
      // silent
    } finally {
      setOrderSubmitting(false);
    }
  };

  const handleClosePosition = async (id: string) => {
    try {
      await api.forex.closePosition(id);
      fetchData();
    } catch {
      // silent
    }
  };

  const handleCancelOrder = async (id: string) => {
    try {
      await api.forex.cancelOrder(id);
      fetchData();
    } catch {
      // silent
    }
  };

  const handlePipCalc = async () => {
    try {
      const res = await api.forex.pipCalculator({ pair: pipPair, lotSize: parseFloat(pipLots), pips: parseFloat(pipCount) });
      const d = res as Record<string, unknown>;
      const inner = d && typeof d === "object" && "data" in d ? d.data as Record<string, unknown> : d;
      if (inner && "value" in inner) setPipResult(inner.value as number);
      else setPipResult(parseFloat(pipLots) * parseFloat(pipCount) * 10);
    } catch {
      setPipResult(parseFloat(pipLots) * parseFloat(pipCount) * 10);
    }
  };

  const filteredPairs = pairs.filter(p => {
    const matchCategory = categoryFilter === "all" || p.category === categoryFilter;
    const matchSearch = !searchQuery || p.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || p.displayName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const totalUnrealizedPnl = positions.reduce((s, p) => s + p.unrealizedPnl, 0);

  const tabs: { id: TabType; label: string; icon: typeof BadgeDollarSign }[] = [
    { id: "watchlist", label: "Watchlist", icon: TrendingUp },
    { id: "positions", label: "Positions", icon: Layers },
    { id: "orders", label: "Orders", icon: Clock },
    { id: "account", label: "Account", icon: Wallet },
    { id: "swaps", label: "Swap Rates", icon: ArrowUpRight },
    { id: "cross-rates", label: "Cross Rates", icon: Globe },
    { id: "margin", label: "Margin", icon: Shield },
    { id: "liquidity", label: "Liquidity", icon: BarChart3 },
    { id: "regulatory", label: "Regulatory", icon: AlertTriangle },
    { id: "calculator", label: "Pip Calc", icon: Calculator },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: "linear-gradient(135deg, #3B82F6, #1D4ED8)" }}>
              <BadgeDollarSign className="h-5 w-5 text-white" />
            </div>
            Forex Trading
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Trade 20+ currency pairs with up to 200:1 leverage
          </p>
        </div>
        <button onClick={fetchData}
          className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 transition-colors">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Account Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <SummaryCard label="Balance" value={formatUSD(account.balance)} color="#3B82F6" />
        <SummaryCard label="Equity" value={formatUSD(account.equity)} color="#10B981" />
        <SummaryCard label="Free Margin" value={formatUSD(account.freeMargin)} color="#8B5CF6" />
        <SummaryCard label="Margin Level" value={`${account.marginLevel.toFixed(1)}%`} color={account.marginLevel > 200 ? "#10B981" : account.marginLevel > 100 ? "#F59E0B" : "#EF4444"} />
        <SummaryCard label="Unrealized P&L" value={formatUSD(totalUnrealizedPnl)} color={totalUnrealizedPnl >= 0 ? "#10B981" : "#EF4444"} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all whitespace-nowrap ${
              tab === t.id ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]"
            }`}>
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
            {t.id === "positions" && positions.length > 0 && (
              <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}>{positions.length}</span>
            )}
            {t.id === "orders" && orders.length > 0 && (
              <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa" }}>{orders.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Main Content */}
        <div className="space-y-4">
          {tab === "watchlist" && (
            <WatchlistTab
              pairs={filteredPairs}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedPair={selectedPair}
              onSelectPair={setSelectedPair}
            />
          )}
          {tab === "positions" && (
            <PositionsTab positions={positions} onClose={handleClosePosition} />
          )}
          {tab === "orders" && (
            <OrdersTab orders={orders} onCancel={handleCancelOrder} />
          )}
          {tab === "account" && (
            <AccountTab account={account} />
          )}
          {tab === "swaps" && (
            <SwapRatesTab rates={swapRates.length > 0 ? swapRates : pairs.map(p => ({ pair: p.symbol, swapLong: p.swapLong, swapShort: p.swapShort, tripleDay: p.swapTripleDay }))} />
          )}
          {tab === "cross-rates" && (
            <CrossRatesTab rates={crossRates} />
          )}
          {tab === "margin" && (
            <MarginTab requirements={marginReqs} />
          )}
          {tab === "liquidity" && (
            <LiquidityTab providers={liquidityProviders} />
          )}
          {tab === "regulatory" && (
            <RegulatoryTab info={regulatoryInfo} />
          )}
          {tab === "calculator" && (
            <PipCalculatorTab
              pipPair={pipPair} setPipPair={setPipPair}
              pipLots={pipLots} setPipLots={setPipLots}
              pipCount={pipCount} setPipCount={setPipCount}
              pipResult={pipResult}
              onCalculate={handlePipCalc}
              pairs={pairs}
            />
          )}
        </div>

        {/* Order Entry Panel (always visible) */}
        <div className="space-y-4">
          <div className="rounded-xl border border-white/[0.06] p-4" style={{ background: "rgba(15, 23, 42, 0.6)" }}>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <BadgeDollarSign className="h-4 w-4 text-blue-400" />
              Quick Trade
            </h3>

            {selectedPair ? (
              <div className="space-y-3">
                {/* Selected Pair */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">{selectedPair.symbol}</span>
                  <button onClick={() => setSelectedPair(null)} className="text-gray-500 hover:text-gray-300">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg p-2 text-center" style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.15)" }}>
                    <div className="text-[10px] text-gray-500">BID</div>
                    <div className="text-sm font-bold font-mono text-emerald-400">{formatFXPrice(selectedPair.bid, selectedPair.pipSize)}</div>
                  </div>
                  <div className="rounded-lg p-2 text-center" style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.15)" }}>
                    <div className="text-[10px] text-gray-500">ASK</div>
                    <div className="text-sm font-bold font-mono text-red-400">{formatFXPrice(selectedPair.ask, selectedPair.pipSize)}</div>
                  </div>
                </div>

                <div className="text-center text-[10px] text-gray-500">
                  Spread: {((selectedPair.ask - selectedPair.bid) / selectedPair.pipSize).toFixed(1)} pips
                </div>

                {/* Buy / Sell toggle */}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setOrderSide("BUY")}
                    className={`rounded-lg py-2 text-xs font-bold transition-all ${orderSide === "BUY" ? "bg-emerald-500 text-white" : "bg-white/5 text-gray-500 hover:text-gray-300"}`}>
                    BUY
                  </button>
                  <button onClick={() => setOrderSide("SELL")}
                    className={`rounded-lg py-2 text-xs font-bold transition-all ${orderSide === "SELL" ? "bg-red-500 text-white" : "bg-white/5 text-gray-500 hover:text-gray-300"}`}>
                    SELL
                  </button>
                </div>

                {/* Order Type */}
                <select value={orderType} onChange={e => setOrderType(e.target.value)}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white appearance-none focus:outline-none focus:border-blue-500">
                  <option value="MARKET">Market</option>
                  <option value="LIMIT">Limit</option>
                  <option value="STOP">Stop</option>
                  <option value="STOP_LIMIT">Stop Limit</option>
                  <option value="OCO">OCO</option>
                  <option value="TRAILING_STOP">Trailing Stop</option>
                </select>

                {/* Lot Size */}
                <div>
                  <label className="text-[10px] text-gray-500">Lot Size</label>
                  <input type="number" value={orderLots} onChange={e => setOrderLots(e.target.value)}
                    step={selectedPair.lotStep} min={selectedPair.minLotSize} max={selectedPair.maxLotSize}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500" />
                </div>

                {/* Price (for limit/stop) */}
                {orderType !== "MARKET" && (
                  <div>
                    <label className="text-[10px] text-gray-500">Price</label>
                    <input type="number" value={orderPrice} onChange={e => setOrderPrice(e.target.value)}
                      placeholder={formatFXPrice(selectedPair.bid, selectedPair.pipSize)}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500" />
                  </div>
                )}

                {/* SL / TP */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500">Stop Loss</label>
                    <input type="number" value={orderSL} onChange={e => setOrderSL(e.target.value)}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Take Profit</label>
                    <input type="number" value={orderTP} onChange={e => setOrderTP(e.target.value)}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500" />
                  </div>
                </div>

                {/* Leverage */}
                <div>
                  <label className="text-[10px] text-gray-500">Leverage</label>
                  <select value={orderLeverage} onChange={e => setOrderLeverage(e.target.value)}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white appearance-none focus:outline-none focus:border-blue-500">
                    <option value="50">1:50</option>
                    <option value="100">1:100</option>
                    <option value="200">1:200</option>
                  </select>
                </div>

                {/* Margin estimate */}
                <div className="rounded-lg p-2 text-center" style={{ background: "rgba(255, 255, 255, 0.02)" }}>
                  <span className="text-[10px] text-gray-500">Est. Margin: </span>
                  <span className="text-xs font-mono text-white">
                    {formatUSD((parseFloat(orderLots) * 100000 * selectedPair.bid) / parseInt(orderLeverage))}
                  </span>
                </div>

                {/* Submit */}
                <button onClick={handleCreateOrder} disabled={orderSubmitting}
                  className={`w-full rounded-lg py-2.5 text-sm font-bold transition-all ${
                    orderSide === "BUY"
                      ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                      : "bg-red-500 hover:bg-red-600 text-white"
                  } disabled:opacity-50`}>
                  {orderSubmitting ? "Placing..." : `${orderSide} ${selectedPair.symbol}`}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-gray-600">
                <BadgeDollarSign className="h-8 w-8 mb-3 opacity-30" />
                <p className="text-sm font-medium">Select a currency pair</p>
                <p className="text-xs mt-1">Click any pair from the watchlist to trade</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Summary Card ────────────────────────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] p-4" style={{ background: "rgba(15, 23, 42, 0.5)" }}>
      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-lg font-bold font-mono" style={{ color }}>{value}</p>
    </div>
  );
}

// ── Watchlist Tab ───────────────────────────────────────────────────────

function WatchlistTab({ pairs, categoryFilter, setCategoryFilter, searchQuery, setSearchQuery, selectedPair, onSelectPair }: {
  pairs: FXPair[];
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  selectedPair: FXPair | null;
  onSelectPair: (p: FXPair) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search pairs..."
            className="w-full rounded-lg bg-white/5 border border-white/10 pl-10 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" />
        </div>
        <div className="flex gap-1">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <button key={key} onClick={() => setCategoryFilter(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                categoryFilter === key ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-white/5 text-gray-500 hover:text-gray-300 border border-transparent"
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Pair Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pairs.map(pair => (
          <button key={pair.id} onClick={() => onSelectPair(pair)}
            className={`rounded-xl border p-4 text-left transition-all hover:bg-white/[0.04] ${
              selectedPair?.id === pair.id ? "border-blue-500/50 bg-blue-500/5" : "border-white/[0.06]"
            }`}
            style={{ background: selectedPair?.id === pair.id ? "rgba(59, 130, 246, 0.05)" : "rgba(15, 23, 42, 0.4)" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{pair.symbol}</span>
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                  pair.category === "major" ? "bg-blue-500/10 text-blue-400" :
                  pair.category === "african" ? "bg-emerald-500/10 text-emerald-400" :
                  pair.category === "minor" ? "bg-purple-500/10 text-purple-400" :
                  "bg-amber-500/10 text-amber-400"
                }`}>
                  {pair.category}
                </span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-gray-600" />
            </div>
            <div className="text-[11px] text-gray-500 mb-2">{pair.displayName}</div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <div className="text-[9px] text-gray-600">BID</div>
                  <div className="text-xs font-mono font-semibold text-emerald-400">{formatFXPrice(pair.bid, pair.pipSize)}</div>
                </div>
                <div>
                  <div className="text-[9px] text-gray-600">ASK</div>
                  <div className="text-xs font-mono font-semibold text-red-400">{formatFXPrice(pair.ask, pair.pipSize)}</div>
                </div>
              </div>
              <div className="text-right">
                <div className={`flex items-center gap-1 text-xs font-bold ${pair.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {pair.changePercent >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {formatPercent(pair.changePercent)}
                </div>
                <div className="text-[9px] text-gray-600">Vol: {formatNumber(pair.volume24h)}</div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-3 text-[9px] text-gray-600">
              <span>Spread: {pair.spreadTypical} pips</span>
              <span>Leverage: 1:{pair.maxLeverage}</span>
              <span>Swap L: {pair.swapLong}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Positions Tab ───────────────────────────────────────────────────────

function PositionsTab({ positions, onClose }: { positions: FXPosition[]; onClose: (id: string) => void }) {
  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-600">
        <Layers className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm font-medium">No open positions</p>
        <p className="text-xs mt-1">Select a pair and place a trade to open a position</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="pb-3 text-[10px] font-semibold text-gray-500 uppercase">Pair</th>
            <th className="pb-3 text-[10px] font-semibold text-gray-500 uppercase">Side</th>
            <th className="pb-3 text-[10px] font-semibold text-gray-500 uppercase text-right">Lots</th>
            <th className="pb-3 text-[10px] font-semibold text-gray-500 uppercase text-right">Entry</th>
            <th className="pb-3 text-[10px] font-semibold text-gray-500 uppercase text-right">Current</th>
            <th className="pb-3 text-[10px] font-semibold text-gray-500 uppercase text-right">Pips</th>
            <th className="pb-3 text-[10px] font-semibold text-gray-500 uppercase text-right">P&L</th>
            <th className="pb-3 text-[10px] font-semibold text-gray-500 uppercase text-right">Swap</th>
            <th className="pb-3 text-[10px] font-semibold text-gray-500 uppercase text-right">SL / TP</th>
            <th className="pb-3 text-[10px] font-semibold text-gray-500 uppercase text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {positions.map(p => (
            <tr key={p.id} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
              <td className="py-3 font-semibold text-white text-[13px]">{p.pair}</td>
              <td className="py-3">
                <span className={`text-[11px] font-bold ${p.side === "BUY" ? "text-emerald-400" : "text-red-400"}`}>{p.side}</span>
              </td>
              <td className="py-3 text-right font-mono text-[13px] text-gray-300">{p.lotSize.toFixed(2)}</td>
              <td className="py-3 text-right font-mono text-[13px] text-gray-400">{p.entryPrice}</td>
              <td className="py-3 text-right font-mono text-[13px] text-white">{p.currentPrice}</td>
              <td className="py-3 text-right">
                <span className={`font-mono text-[13px] font-semibold ${p.unrealizedPips >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {p.unrealizedPips >= 0 ? "+" : ""}{p.unrealizedPips}
                </span>
              </td>
              <td className="py-3 text-right">
                <span className={`font-mono text-[13px] font-semibold ${p.unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {formatUSD(p.unrealizedPnl)}
                </span>
              </td>
              <td className="py-3 text-right font-mono text-[11px] text-gray-500">{p.swapAccrued.toFixed(2)}</td>
              <td className="py-3 text-right text-[11px] text-gray-500">
                {p.stopLoss > 0 ? p.stopLoss : "---"} / {p.takeProfit > 0 ? p.takeProfit : "---"}
              </td>
              <td className="py-3 text-right">
                <button onClick={() => onClose(p.id)}
                  className="rounded-lg px-2 py-1 text-[10px] font-semibold text-red-400 hover:bg-red-500/10 transition-colors">
                  Close
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Orders Tab ──────────────────────────────────────────────────────────

function OrdersTab({ orders, onCancel }: { orders: FXOrder[]; onCancel: (id: string) => void }) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-600">
        <Clock className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm font-medium">No pending orders</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="pb-3 text-[10px] font-semibold text-gray-500 uppercase">Pair</th>
            <th className="pb-3 text-[10px] font-semibold text-gray-500 uppercase">Side</th>
            <th className="pb-3 text-[10px] font-semibold text-gray-500 uppercase">Type</th>
            <th className="pb-3 text-[10px] font-semibold text-gray-500 uppercase text-right">Lots</th>
            <th className="pb-3 text-[10px] font-semibold text-gray-500 uppercase text-right">Price</th>
            <th className="pb-3 text-[10px] font-semibold text-gray-500 uppercase text-right">SL / TP</th>
            <th className="pb-3 text-[10px] font-semibold text-gray-500 uppercase">Leverage</th>
            <th className="pb-3 text-[10px] font-semibold text-gray-500 uppercase">Comment</th>
            <th className="pb-3 text-[10px] font-semibold text-gray-500 uppercase text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
              <td className="py-3 font-semibold text-white text-[13px]">{o.pair}</td>
              <td className="py-3">
                <span className={`text-[11px] font-bold ${o.side === "BUY" ? "text-emerald-400" : "text-red-400"}`}>{o.side}</span>
              </td>
              <td className="py-3 text-[13px] text-gray-400">{o.type}</td>
              <td className="py-3 text-right font-mono text-[13px] text-gray-300">{o.lotSize.toFixed(2)}</td>
              <td className="py-3 text-right font-mono text-[13px] text-white">
                {o.type === "OCO" ? `${o.ocoStopPrice} / ${o.ocoLimitPrice}` : o.price || "MARKET"}
              </td>
              <td className="py-3 text-right text-[11px] text-gray-500">
                {o.stopLoss > 0 ? o.stopLoss : "---"} / {o.takeProfit > 0 ? o.takeProfit : "---"}
              </td>
              <td className="py-3 text-[13px] text-gray-400">1:{o.leverage}</td>
              <td className="py-3 text-[11px] text-gray-500 max-w-[120px] truncate">{o.comment || "---"}</td>
              <td className="py-3 text-right">
                <button onClick={() => onCancel(o.id)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-red-400 hover:bg-red-500/10 transition-colors">
                  <X className="h-3 w-3" /> Cancel
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Account Tab ─────────────────────────────────────────────────────────

function AccountTab({ account }: { account: FXAccountSummary }) {
  const rows = [
    { label: "Balance", value: formatUSD(account.balance), color: "text-white" },
    { label: "Equity", value: formatUSD(account.equity), color: "text-emerald-400" },
    { label: "Margin Used", value: formatUSD(account.marginUsed), color: "text-amber-400" },
    { label: "Free Margin", value: formatUSD(account.freeMargin), color: "text-blue-400" },
    { label: "Margin Level", value: `${account.marginLevel.toFixed(2)}%`, color: account.marginLevel > 200 ? "text-emerald-400" : "text-red-400" },
    { label: "Unrealized P&L", value: formatUSD(account.unrealizedPnl), color: account.unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400" },
    { label: "Realized P&L Today", value: formatUSD(account.realizedPnlToday), color: account.realizedPnlToday >= 0 ? "text-emerald-400" : "text-red-400" },
    { label: "Open Positions", value: String(account.openPositions), color: "text-white" },
    { label: "Pending Orders", value: String(account.pendingOrders), color: "text-white" },
    { label: "Leverage Tier", value: account.leverageTier.charAt(0).toUpperCase() + account.leverageTier.slice(1), color: "text-purple-400" },
    { label: "Account Currency", value: account.currency, color: "text-white" },
  ];

  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden" style={{ background: "rgba(15, 23, 42, 0.4)" }}>
      {rows.map((row, i) => (
        <div key={row.label} className={`flex items-center justify-between px-5 py-3.5 ${i > 0 ? "border-t border-white/[0.04]" : ""}`}>
          <span className="text-sm text-gray-400">{row.label}</span>
          <span className={`text-sm font-bold font-mono ${row.color}`}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Swap Rates Tab ──────────────────────────────────────────────────────

function SwapRatesTab({ rates }: { rates: SwapRate[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="pb-3 text-[10px] font-semibold text-gray-500 uppercase">Pair</th>
            <th className="pb-3 text-[10px] font-semibold text-gray-500 uppercase text-right">Swap Long</th>
            <th className="pb-3 text-[10px] font-semibold text-gray-500 uppercase text-right">Swap Short</th>
            <th className="pb-3 text-[10px] font-semibold text-gray-500 uppercase text-right">Triple Day</th>
          </tr>
        </thead>
        <tbody>
          {rates.map(r => (
            <tr key={r.pair} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
              <td className="py-3 font-semibold text-white">{r.pair}</td>
              <td className="py-3 text-right font-mono">
                <span className={r.swapLong >= 0 ? "text-emerald-400" : "text-red-400"}>{r.swapLong.toFixed(2)}</span>
              </td>
              <td className="py-3 text-right font-mono">
                <span className={r.swapShort >= 0 ? "text-emerald-400" : "text-red-400"}>{r.swapShort.toFixed(2)}</span>
              </td>
              <td className="py-3 text-right text-gray-400">{r.tripleDay}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Cross Rates Tab ─────────────────────────────────────────────────────

function CrossRatesTab({ rates }: { rates: CrossRate[] }) {
  if (rates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-600">
        <Globe className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm font-medium">Cross rates will appear when connected to gateway</p>
        <p className="text-xs mt-1">Cross rates are auto-calculated from major pair prices</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rates.map(r => (
        <div key={r.pair} className="rounded-xl border border-white/[0.06] p-4" style={{ background: "rgba(15, 23, 42, 0.4)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-white">{r.pair}</span>
            <Globe className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <div className="text-lg font-bold font-mono text-blue-400">{r.rate.toFixed(4)}</div>
          <div className="text-[10px] text-gray-500 mt-1">Derived from: {r.derivedFrom}</div>
        </div>
      ))}
    </div>
  );
}

// ── Margin Tab ──────────────────────────────────────────────────────────

function MarginTab({ requirements }: { requirements: MarginReq[] }) {
  if (requirements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-600">
        <Shield className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm font-medium">Margin requirements will appear when connected to gateway</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="pb-3 text-[10px] font-semibold text-gray-500 uppercase">Pair</th>
            <th className="pb-3 text-[10px] font-semibold text-gray-500 uppercase text-right">Retail</th>
            <th className="pb-3 text-[10px] font-semibold text-gray-500 uppercase text-right">Professional</th>
            <th className="pb-3 text-[10px] font-semibold text-gray-500 uppercase text-right">Institutional</th>
            <th className="pb-3 text-[10px] font-semibold text-gray-500 uppercase text-right">Max Leverage</th>
          </tr>
        </thead>
        <tbody>
          {requirements.map(m => (
            <tr key={m.pair} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
              <td className="py-3 font-semibold text-white">{m.pair}</td>
              <td className="py-3 text-right font-mono text-amber-400">{m.retail.toFixed(1)}%</td>
              <td className="py-3 text-right font-mono text-blue-400">{m.professional.toFixed(2)}%</td>
              <td className="py-3 text-right font-mono text-purple-400">{m.institutional.toFixed(2)}%</td>
              <td className="py-3 text-right font-mono text-white">1:{m.maxLeverage}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Liquidity Tab ───────────────────────────────────────────────────────

function LiquidityTab({ providers }: { providers: LiquidityProvider[] }) {
  if (providers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-600">
        <BarChart3 className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm font-medium">Liquidity providers will appear when connected to gateway</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {providers.map(p => (
        <div key={p.id} className="rounded-xl border border-white/[0.06] p-4" style={{ background: "rgba(15, 23, 42, 0.4)" }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-bold text-white">{p.name}</div>
              <div className="text-[10px] text-gray-500">{p.type} - {p.tier}</div>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              p.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
            }`}>{p.status}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-[11px]">
            <div><span className="text-gray-500">Latency:</span> <span className="text-white font-mono">{p.latencyMs}ms</span></div>
            <div><span className="text-gray-500">Markup:</span> <span className="text-white font-mono">{p.spreadMarkup} pips</span></div>
            <div><span className="text-gray-500">Pairs:</span> <span className="text-white">{p.supportedPairs}</span></div>
            <div><span className="text-gray-500">Volume:</span> <span className="text-white">{p.monthlyVolume}</span></div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Regulatory Tab ──────────────────────────────────────────────────────

function RegulatoryTab({ info }: { info: RegulatoryInfo[] }) {
  if (info.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-600">
        <AlertTriangle className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm font-medium">Regulatory info will appear when connected to gateway</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {info.map(r => (
        <div key={r.jurisdiction} className="rounded-xl border border-white/[0.06] p-4" style={{ background: "rgba(15, 23, 42, 0.4)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-bold text-white">{r.jurisdiction}</span>
          </div>
          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between"><span className="text-gray-500">Regulator</span><span className="text-white">{r.regulator}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Max Retail Leverage</span><span className="text-white font-mono">1:{r.maxRetailLeverage}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">KYC Level</span><span className="text-white">{r.kycLevel}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Reporting</span><span className="text-white">{r.reportingFrequency}</span></div>
            <div>
              <span className="text-gray-500">Required Disclosures:</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {r.requiredDisclosures.map(d => (
                  <span key={d} className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-gray-400">{d}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Pip Calculator Tab ──────────────────────────────────────────────────

function PipCalculatorTab({ pipPair, setPipPair, pipLots, setPipLots, pipCount, setPipCount, pipResult, onCalculate, pairs }: {
  pipPair: string; setPipPair: (v: string) => void;
  pipLots: string; setPipLots: (v: string) => void;
  pipCount: string; setPipCount: (v: string) => void;
  pipResult: number | null;
  onCalculate: () => void;
  pairs: FXPair[];
}) {
  return (
    <div className="max-w-md">
      <div className="rounded-xl border border-white/[0.06] p-5" style={{ background: "rgba(15, 23, 42, 0.4)" }}>
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Calculator className="h-4 w-4 text-blue-400" />
          Pip Value Calculator
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-gray-500">Currency Pair</label>
            <select value={pipPair} onChange={e => setPipPair(e.target.value)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white appearance-none focus:outline-none focus:border-blue-500">
              {pairs.map(p => <option key={p.symbol} value={p.symbol}>{p.symbol}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-500">Lot Size</label>
            <input type="number" value={pipLots} onChange={e => setPipLots(e.target.value)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500">Number of Pips</label>
            <input type="number" value={pipCount} onChange={e => setPipCount(e.target.value)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500" />
          </div>
          <button onClick={onCalculate}
            className="w-full rounded-lg bg-blue-500 hover:bg-blue-600 py-2.5 text-sm font-bold text-white transition-colors">
            Calculate
          </button>
          {pipResult !== null && (
            <div className="rounded-lg p-4 text-center" style={{ background: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.2)" }}>
              <div className="text-[10px] text-gray-500 mb-1">Pip Value</div>
              <div className="text-2xl font-bold font-mono text-blue-400">{formatUSD(pipResult)}</div>
              <div className="text-[10px] text-gray-500 mt-1">{pipLots} lots x {pipCount} pips on {pipPair}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
