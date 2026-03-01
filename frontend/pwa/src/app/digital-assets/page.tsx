"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Coins,
  ArrowUpDown,
  Shield,
  Globe,
  HardDrive,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Layers,
  Wallet,
  BarChart3,
  Clock,
  Link2,
  Database,
} from "lucide-react";
import { api } from "@/lib/api-client";

// ── Types ──────────────────────────────────────────────────────────────────

interface FractionalAsset {
  asset_id: string;
  token_id: string;
  symbol: string;
  name: string;
  total_fractions: number;
  available_fractions: number;
  fraction_price: number;
  total_value: number;
  holders: number;
  chain: string;
  contract_address: string;
  metadata_cid: string;
  warehouse_receipt_cid: string;
  status: string;
}

interface PriceLevel {
  price: number;
  quantity: number;
  orders: number;
}

interface OrderBookSnapshot {
  asset_id: string;
  bids: PriceLevel[];
  asks: PriceLevel[];
  spread: number;
}

interface FractionalTrade {
  trade_id: string;
  asset_id: string;
  buyer_id: string;
  seller_id: string;
  quantity: number;
  price: number;
  total_value: number;
  executed_at: string;
}

interface PortfolioHolding {
  asset_id: string;
  token_id: string;
  symbol: string;
  name: string;
  fractions_owned: number;
  acquisition_price: number;
  current_price: number;
  current_value: number;
  pnl: number;
  pnl_pct: number;
  chain: string;
  metadata_cid: string;
}

interface ChainInfo {
  name: string;
  status: string;
  block_height: number;
  gas_price: string;
  chain_id: number;
  contract: string;
  confirmations_required: number;
}

interface IpfsStatus {
  connected: boolean;
  api_url: string;
  gateway_url: string;
  pinned_objects: number;
  repo_size_bytes: number;
}

// ── Mock Data (fallback when blockchain service unavailable) ────────────

const MOCK_ASSETS: FractionalAsset[] = [
  {
    asset_id: "FA-GOLD-001", token_id: "TKN-GOLD-001", symbol: "GOLD",
    name: "Gold Bar 1kg - LBMA Certified", total_fractions: 10000,
    available_fractions: 6500, fraction_price: 7.85, total_value: 78500,
    holders: 2, chain: "polygon", contract_address: "0xNEXCOM_GOLD_TOKEN",
    metadata_cid: "QmGoldBar001MetadataHash", warehouse_receipt_cid: "QmGoldBar001ReceiptHash",
    status: "Active",
  },
  {
    asset_id: "FA-COFFEE-001", token_id: "TKN-COFFEE-001", symbol: "COFFEE",
    name: "Arabica Coffee 10MT - Kenya AA Grade", total_fractions: 5000,
    available_fractions: 3200, fraction_price: 9.04, total_value: 45200,
    holders: 2, chain: "polygon", contract_address: "0xNEXCOM_COFFEE_TOKEN",
    metadata_cid: "QmCoffee001MetadataHash", warehouse_receipt_cid: "QmCoffee001ReceiptHash",
    status: "Active",
  },
  {
    asset_id: "FA-MAIZE-001", token_id: "TKN-MAIZE-001", symbol: "MAIZE",
    name: "White Maize 50MT - Grade 1", total_fractions: 20000,
    available_fractions: 15000, fraction_price: 0.71, total_value: 14200,
    holders: 1, chain: "polygon", contract_address: "0xNEXCOM_MAIZE_TOKEN",
    metadata_cid: "QmMaize001MetadataHash", warehouse_receipt_cid: "QmMaize001ReceiptHash",
    status: "Active",
  },
  {
    asset_id: "FA-CRUDE-001", token_id: "TKN-CRUDE-001", symbol: "CRUDE_OIL",
    name: "Brent Crude 1000bbl - Bonny Light", total_fractions: 50000,
    available_fractions: 42000, fraction_price: 1.57, total_value: 78500,
    holders: 2, chain: "ethereum", contract_address: "0xNEXCOM_CRUDE_TOKEN",
    metadata_cid: "QmCrude001MetadataHash", warehouse_receipt_cid: "QmCrude001ReceiptHash",
    status: "Active",
  },
  {
    asset_id: "FA-CARBON-001", token_id: "TKN-CARBON-001", symbol: "CARBON",
    name: "EU ETS Carbon Credits 100t - Vintage 2026", total_fractions: 10000,
    available_fractions: 8500, fraction_price: 0.65, total_value: 6500,
    holders: 1, chain: "polygon", contract_address: "0xNEXCOM_CARBON_TOKEN",
    metadata_cid: "QmCarbon001MetadataHash", warehouse_receipt_cid: "QmCarbon001ReceiptHash",
    status: "Active",
  },
];

const MOCK_PORTFOLIO: PortfolioHolding[] = [
  { asset_id: "FA-GOLD-001", token_id: "TKN-GOLD-001", symbol: "GOLD", name: "Gold Bar 1kg", fractions_owned: 2000, acquisition_price: 7.50, current_price: 7.85, current_value: 15700, pnl: 700, pnl_pct: 4.67, chain: "polygon", metadata_cid: "QmGoldBar001MetadataHash" },
  { asset_id: "FA-COFFEE-001", token_id: "TKN-COFFEE-001", symbol: "COFFEE", name: "Arabica Coffee 10MT", fractions_owned: 800, acquisition_price: 9.00, current_price: 9.04, current_value: 7232, pnl: 32, pnl_pct: 0.44, chain: "polygon", metadata_cid: "QmCoffee001MetadataHash" },
  { asset_id: "FA-CARBON-001", token_id: "TKN-CARBON-001", symbol: "CARBON", name: "EU ETS Carbon Credits", fractions_owned: 1500, acquisition_price: 0.62, current_price: 0.65, current_value: 975, pnl: 45, pnl_pct: 4.84, chain: "polygon", metadata_cid: "QmCarbon001MetadataHash" },
];

const MOCK_CHAINS: ChainInfo[] = [
  { name: "ethereum", status: "connected", block_height: 18534221, gas_price: "25.3 gwei", chain_id: 1, contract: "CommodityToken (ERC-1155)", confirmations_required: 12 },
  { name: "polygon", status: "connected", block_height: 52891045, gas_price: "0.003 gwei", chain_id: 137, contract: "CommodityToken (ERC-1155)", confirmations_required: 32 },
  { name: "hyperledger", status: "connected", block_height: 1245678, gas_price: "N/A", chain_id: 0, contract: "nexcom-chaincode", confirmations_required: 1 },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const CHAIN_COLORS: Record<string, string> = {
  ethereum: "#627EEA",
  polygon: "#8247E5",
  hyperledger: "#2F3134",
};

const COMMODITY_ICONS: Record<string, string> = {
  GOLD: "Au",
  COFFEE: "Cf",
  MAIZE: "Mz",
  CRUDE_OIL: "Oil",
  CARBON: "CO2",
};

// ── Main Page ──────────────────────────────────────────────────────────────

type TabType = "marketplace" | "portfolio" | "orderbook" | "chains" | "ipfs";

export default function DigitalAssetsPage() {
  const [tab, setTab] = useState<TabType>("marketplace");
  const [assets, setAssets] = useState<FractionalAsset[]>(MOCK_ASSETS);
  const [portfolio, setPortfolio] = useState<PortfolioHolding[]>(MOCK_PORTFOLIO);
  const [chains, setChains] = useState<ChainInfo[]>(MOCK_CHAINS);
  const [ipfsStatus, setIpfsStatus] = useState<IpfsStatus | null>(null);
  const [trades, setTrades] = useState<FractionalTrade[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<FractionalAsset | null>(null);
  const [orderbook, setOrderbook] = useState<OrderBookSnapshot | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [copiedCid, setCopiedCid] = useState<string | null>(null);

  // Order form state
  const [orderSide, setOrderSide] = useState<"buy" | "sell">("buy");
  const [orderQty, setOrderQty] = useState("");
  const [orderPrice, setOrderPrice] = useState("");
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  // Fetch data from blockchain service (via gateway proxy)
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [assetsRes, chainsRes, tradesRes, ipfsRes] = await Promise.allSettled([
        api.blockchain.fractionalAssets(),
        api.blockchain.chainStatus(),
        api.blockchain.fractionalTrades(),
        api.blockchain.ipfsStatus(),
      ]);

      if (assetsRes.status === "fulfilled") {
        const d = assetsRes.value as Record<string, unknown>;
        const inner = (d && typeof d === "object" && "data" in d ? d.data : d) as Record<string, unknown>;
        if (inner && "assets" in inner) setAssets((inner.assets as FractionalAsset[]) || MOCK_ASSETS);
      }
      if (chainsRes.status === "fulfilled") {
        const d = chainsRes.value as Record<string, unknown>;
        const inner = (d && typeof d === "object" && "data" in d ? d.data : d) as Record<string, unknown>;
        if (inner && "chains" in inner) setChains((inner.chains as ChainInfo[]) || MOCK_CHAINS);
      }
      if (tradesRes.status === "fulfilled") {
        const d = tradesRes.value as Record<string, unknown>;
        const inner = (d && typeof d === "object" && "data" in d ? d.data : d) as Record<string, unknown>;
        if (inner && "trades" in inner) setTrades((inner.trades as FractionalTrade[]) || []);
      }
      if (ipfsRes.status === "fulfilled") {
        const d = ipfsRes.value as Record<string, unknown>;
        const inner = (d && typeof d === "object" && "data" in d ? d.data : d) as IpfsStatus;
        if (inner) setIpfsStatus(inner);
      }

      // Fetch portfolio for demo user
      try {
        const portfolioRes = await api.blockchain.fractionalPortfolio("USR-001");
        const pd = portfolioRes as Record<string, unknown>;
        const pInner = (pd && typeof pd === "object" && "data" in pd ? pd.data : pd) as Record<string, unknown>;
        if (pInner && "holdings" in pInner) setPortfolio((pInner.holdings as PortfolioHolding[]) || MOCK_PORTFOLIO);
      } catch {
        // Keep mock data
      }
    } catch {
      // Keep mock data on full failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch orderbook when asset selected
  useEffect(() => {
    if (!selectedAsset) return;
    (async () => {
      try {
        const res = await api.blockchain.fractionalOrderbook(selectedAsset.asset_id);
        const d = res as Record<string, unknown>;
        const inner = (d && typeof d === "object" && "data" in d ? d.data : d) as OrderBookSnapshot;
        if (inner) setOrderbook(inner);
      } catch {
        setOrderbook({ asset_id: selectedAsset.asset_id, bids: [], asks: [], spread: 0 });
      }
    })();
  }, [selectedAsset]);

  // Submit fractional order
  const handleSubmitOrder = async () => {
    if (!selectedAsset || !orderQty || !orderPrice) return;
    setOrderSubmitting(true);
    try {
      await api.blockchain.fractionalOrder({
        asset_id: selectedAsset.asset_id,
        trader_id: "USR-001",
        side: orderSide,
        quantity: parseInt(orderQty),
        price: parseFloat(orderPrice),
      });
      setOrderQty("");
      setOrderPrice("");
      // Refresh orderbook + trades
      fetchData();
      if (selectedAsset) {
        const res = await api.blockchain.fractionalOrderbook(selectedAsset.asset_id);
        const d = res as Record<string, unknown>;
        const inner = (d && typeof d === "object" && "data" in d ? d.data : d) as OrderBookSnapshot;
        if (inner) setOrderbook(inner);
      }
    } catch {
      // Silently handle
    } finally {
      setOrderSubmitting(false);
    }
  };

  const copyCid = (cid: string) => {
    navigator.clipboard.writeText(cid);
    setCopiedCid(cid);
    setTimeout(() => setCopiedCid(null), 2000);
  };

  const filteredAssets = assets.filter(a =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPortfolioValue = portfolio.reduce((sum, h) => sum + h.current_value, 0);
  const totalPnl = portfolio.reduce((sum, h) => sum + h.pnl, 0);

  const tabs: { id: TabType; label: string; icon: typeof Coins }[] = [
    { id: "marketplace", label: "Marketplace", icon: Coins },
    { id: "portfolio", label: "My Portfolio", icon: Wallet },
    { id: "orderbook", label: "Trade", icon: ArrowUpDown },
    { id: "chains", label: "Chains", icon: Globe },
    { id: "ipfs", label: "IPFS", icon: Database },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: "linear-gradient(135deg, #8B5CF6, #6366F1)" }}>
              <Coins className="h-5 w-5 text-white" />
            </div>
            Digital Assets
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Tokenized commodities with fractional ownership on ERC-1155 + IPFS metadata
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard label="Total Assets" value={String(assets.length)} icon={Layers} color="#8B5CF6" />
        <SummaryCard label="Portfolio Value" value={formatUSD(totalPortfolioValue)} icon={Wallet} color="#10B981" />
        <SummaryCard label="Total P&L" value={formatUSD(totalPnl)} icon={totalPnl >= 0 ? TrendingUp : TrendingDown} color={totalPnl >= 0 ? "#10B981" : "#EF4444"} />
        <SummaryCard label="Active Chains" value={String(chains.filter(c => c.status === "connected").length)} icon={Globe} color="#3B82F6" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === t.id
                ? "bg-white/10 text-white"
                : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "marketplace" && (
        <MarketplaceTab
          assets={filteredAssets}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSelectAsset={(a) => { setSelectedAsset(a); setTab("orderbook"); setOrderPrice(String(a.fraction_price)); }}
          copyCid={copyCid}
          copiedCid={copiedCid}
          loading={loading}
        />
      )}

      {tab === "portfolio" && (
        <PortfolioTab
          holdings={portfolio}
          totalValue={totalPortfolioValue}
          totalPnl={totalPnl}
          copyCid={copyCid}
          copiedCid={copiedCid}
        />
      )}

      {tab === "orderbook" && (
        <OrderbookTab
          assets={assets}
          selectedAsset={selectedAsset}
          setSelectedAsset={(a) => { setSelectedAsset(a); setOrderPrice(String(a.fraction_price)); }}
          orderbook={orderbook}
          trades={trades}
          orderSide={orderSide}
          setOrderSide={setOrderSide}
          orderQty={orderQty}
          setOrderQty={setOrderQty}
          orderPrice={orderPrice}
          setOrderPrice={setOrderPrice}
          orderSubmitting={orderSubmitting}
          handleSubmitOrder={handleSubmitOrder}
        />
      )}

      {tab === "chains" && <ChainsTab chains={chains} />}

      {tab === "ipfs" && <IpfsTab ipfsStatus={ipfsStatus} assets={assets} copyCid={copyCid} copiedCid={copiedCid} />}
    </div>
  );
}

// ── Summary Card ───────────────────────────────────────────────────────────

function SummaryCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: typeof Coins; color: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${color}20` }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
      </div>
      <p className="mt-2 text-xl font-bold text-white">{value}</p>
    </div>
  );
}

// ── Marketplace Tab ────────────────────────────────────────────────────────

function MarketplaceTab({
  assets, searchQuery, setSearchQuery, onSelectAsset, copyCid, copiedCid, loading,
}: {
  assets: FractionalAsset[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSelectAsset: (a: FractionalAsset) => void;
  copyCid: (cid: string) => void;
  copiedCid: string | null;
  loading: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tokenized commodities..."
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-violet-500/50 focus:outline-none"
          />
        </div>
        <button className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-400 hover:bg-white/5">
          <Filter className="h-4 w-4" /> Filter
        </button>
      </div>

      {/* Asset Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-6 w-6 animate-spin text-violet-400" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {assets.map(asset => (
            <AssetCard key={asset.asset_id} asset={asset} onSelect={onSelectAsset} copyCid={copyCid} copiedCid={copiedCid} />
          ))}
        </div>
      )}
    </div>
  );
}

function AssetCard({
  asset, onSelect, copyCid, copiedCid,
}: {
  asset: FractionalAsset;
  onSelect: (a: FractionalAsset) => void;
  copyCid: (cid: string) => void;
  copiedCid: string | null;
}) {
  const pctAvailable = ((asset.available_fractions / asset.total_fractions) * 100).toFixed(1);
  const chainColor = CHAIN_COLORS[asset.chain] || "#6B7280";
  const icon = COMMODITY_ICONS[asset.symbol] || asset.symbol.slice(0, 2);

  return (
    <div className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-violet-500/20 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl text-xs font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${chainColor}80, ${chainColor}40)` }}>
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{asset.symbol}</h3>
            <p className="text-xs text-gray-500 max-w-[180px] truncate">{asset.name}</p>
          </div>
        </div>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ background: `${chainColor}20`, color: chainColor }}>
          {asset.chain}
        </span>
      </div>

      {/* Price & Stats */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <span className="text-[10px] font-medium text-gray-500">Price / Fraction</span>
          <p className="text-lg font-bold text-white">{formatUSD(asset.fraction_price)}</p>
        </div>
        <div>
          <span className="text-[10px] font-medium text-gray-500">Total Value</span>
          <p className="text-lg font-bold text-white">{formatUSD(asset.total_value)}</p>
        </div>
      </div>

      {/* Fractions Progress */}
      <div className="mt-3">
        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
          <span>{formatNumber(asset.available_fractions)} available</span>
          <span>{pctAvailable}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5">
          <div className="h-full rounded-full" style={{ width: `${pctAvailable}%`, background: chainColor }} />
        </div>
        <p className="mt-1 text-[10px] text-gray-600">{formatNumber(asset.total_fractions)} total fractions | {asset.holders} holders</p>
      </div>

      {/* IPFS CID */}
      <div className="mt-3 flex items-center gap-2">
        <HardDrive className="h-3 w-3 text-gray-600" />
        <span className="text-[10px] text-gray-500 font-mono truncate flex-1">{asset.metadata_cid}</span>
        <button onClick={() => copyCid(asset.metadata_cid)} className="text-gray-500 hover:text-white">
          {copiedCid === asset.metadata_cid ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onSelect(asset)}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-white transition-all"
          style={{ background: `linear-gradient(135deg, ${chainColor}80, ${chainColor}60)` }}
        >
          <ArrowUpDown className="h-3 w-3" /> Trade Fractions
        </button>
        <button className="flex items-center justify-center rounded-lg border border-white/10 px-3 py-2 text-gray-400 hover:bg-white/5">
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Portfolio Tab ──────────────────────────────────────────────────────────

function PortfolioTab({
  holdings, totalValue, totalPnl, copyCid, copiedCid,
}: {
  holdings: PortfolioHolding[];
  totalValue: number;
  totalPnl: number;
  copyCid: (cid: string) => void;
  copiedCid: string | null;
}) {
  return (
    <div className="space-y-4">
      {/* Portfolio Summary */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
        <div className="grid grid-cols-3 gap-6">
          <div>
            <span className="text-xs text-gray-500">Total Portfolio Value</span>
            <p className="text-2xl font-bold text-white">{formatUSD(totalValue)}</p>
          </div>
          <div>
            <span className="text-xs text-gray-500">Unrealized P&L</span>
            <p className={`text-2xl font-bold ${totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
              {totalPnl >= 0 ? "+" : ""}{formatUSD(totalPnl)}
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-500">Holdings</span>
            <p className="text-2xl font-bold text-white">{holdings.length}</p>
          </div>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-500">Asset</th>
              <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-500">Fractions</th>
              <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-500">Avg Cost</th>
              <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-500">Current</th>
              <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-500">Value</th>
              <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-500">P&L</th>
              <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-500">IPFS</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map(h => {
              const chainColor = CHAIN_COLORS[h.chain] || "#6B7280";
              return (
                <tr key={h.asset_id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ background: `${chainColor}40` }}>
                        {COMMODITY_ICONS[h.symbol] || h.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{h.symbol}</p>
                        <p className="text-[10px] text-gray-500">{h.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-white">{formatNumber(h.fractions_owned)}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-400">{formatUSD(h.acquisition_price)}</td>
                  <td className="px-4 py-3 text-right text-sm text-white">{formatUSD(h.current_price)}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-white">{formatUSD(h.current_value)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm font-medium ${h.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {h.pnl >= 0 ? "+" : ""}{formatUSD(h.pnl)}
                    </span>
                    <p className={`text-[10px] ${h.pnl >= 0 ? "text-green-400/60" : "text-red-400/60"}`}>
                      {h.pnl_pct >= 0 ? "+" : ""}{h.pnl_pct.toFixed(2)}%
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => copyCid(h.metadata_cid)} className="text-gray-500 hover:text-white">
                      {copiedCid === h.metadata_cid ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Orderbook / Trade Tab ──────────────────────────────────────────────────

function OrderbookTab({
  assets, selectedAsset, setSelectedAsset, orderbook, trades,
  orderSide, setOrderSide, orderQty, setOrderQty, orderPrice, setOrderPrice,
  orderSubmitting, handleSubmitOrder,
}: {
  assets: FractionalAsset[];
  selectedAsset: FractionalAsset | null;
  setSelectedAsset: (a: FractionalAsset) => void;
  orderbook: OrderBookSnapshot | null;
  trades: FractionalTrade[];
  orderSide: "buy" | "sell";
  setOrderSide: (s: "buy" | "sell") => void;
  orderQty: string;
  setOrderQty: (v: string) => void;
  orderPrice: string;
  setOrderPrice: (v: string) => void;
  orderSubmitting: boolean;
  handleSubmitOrder: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Asset Selector + Orderbook */}
      <div className="lg:col-span-2 space-y-4">
        {/* Asset selector */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {assets.map(a => (
            <button
              key={a.asset_id}
              onClick={() => setSelectedAsset(a)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                selectedAsset?.asset_id === a.asset_id
                  ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                  : "bg-white/[0.04] text-gray-400 border border-white/[0.06] hover:bg-white/[0.08]"
              }`}
            >
              <span className="font-bold">{a.symbol}</span>
              <span>{formatUSD(a.fraction_price)}</span>
            </button>
          ))}
        </div>

        {/* Orderbook */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-violet-400" />
            Fractional Orderbook
            {selectedAsset && <span className="text-gray-500">| {selectedAsset.symbol}</span>}
          </h3>

          {!selectedAsset ? (
            <p className="text-center text-sm text-gray-500 py-8">Select an asset to view orderbook</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {/* Bids */}
              <div>
                <div className="flex justify-between text-[10px] font-medium text-gray-500 mb-2 px-2">
                  <span>Price</span>
                  <span>Qty</span>
                </div>
                {(orderbook?.bids?.length ?? 0) > 0 ? orderbook?.bids.map((level, i) => (
                  <div key={i} className="relative flex justify-between px-2 py-1 text-xs">
                    <div className="absolute inset-y-0 right-0 bg-green-500/10 rounded-r"
                      style={{ width: `${Math.min((level.quantity / 500) * 100, 100)}%` }} />
                    <span className="relative text-green-400">{formatUSD(level.price)}</span>
                    <span className="relative text-gray-300">{formatNumber(level.quantity)}</span>
                  </div>
                )) : (
                  <p className="text-center text-[10px] text-gray-600 py-4">No bids</p>
                )}
              </div>

              {/* Asks */}
              <div>
                <div className="flex justify-between text-[10px] font-medium text-gray-500 mb-2 px-2">
                  <span>Price</span>
                  <span>Qty</span>
                </div>
                {(orderbook?.asks?.length ?? 0) > 0 ? orderbook?.asks.map((level, i) => (
                  <div key={i} className="relative flex justify-between px-2 py-1 text-xs">
                    <div className="absolute inset-y-0 left-0 bg-red-500/10 rounded-l"
                      style={{ width: `${Math.min((level.quantity / 500) * 100, 100)}%` }} />
                    <span className="relative text-red-400">{formatUSD(level.price)}</span>
                    <span className="relative text-gray-300">{formatNumber(level.quantity)}</span>
                  </div>
                )) : (
                  <p className="text-center text-[10px] text-gray-600 py-4">No asks</p>
                )}
              </div>
            </div>
          )}

          {orderbook && (orderbook.bids.length > 0 || orderbook.asks.length > 0) && (
            <div className="mt-3 text-center text-xs text-gray-500">
              Spread: {formatUSD(orderbook.spread)}
            </div>
          )}
        </div>

        {/* Recent Trades */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-violet-400" /> Recent Trades
          </h3>
          {trades.length > 0 ? (
            <div className="space-y-1">
              {trades.slice(0, 10).map(t => (
                <div key={t.trade_id} className="flex justify-between text-xs py-1 border-b border-white/[0.03]">
                  <span className="text-gray-400">{t.asset_id}</span>
                  <span className="text-white">{formatNumber(t.quantity)} @ {formatUSD(t.price)}</span>
                  <span className="text-gray-500">{formatUSD(t.total_value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-gray-500 py-4">No trades yet. Submit an order to start trading.</p>
          )}
        </div>
      </div>

      {/* Order Entry */}
      <div className="space-y-4">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-violet-400" /> Place Order
          </h3>

          {/* Side Toggle */}
          <div className="flex gap-1 rounded-lg bg-white/[0.04] p-1 mb-4">
            <button
              onClick={() => setOrderSide("buy")}
              className={`flex-1 rounded-md py-2 text-xs font-medium transition-all ${
                orderSide === "buy" ? "bg-green-500/20 text-green-400" : "text-gray-500"
              }`}
            >
              Buy
            </button>
            <button
              onClick={() => setOrderSide("sell")}
              className={`flex-1 rounded-md py-2 text-xs font-medium transition-all ${
                orderSide === "sell" ? "bg-red-500/20 text-red-400" : "text-gray-500"
              }`}
            >
              Sell
            </button>
          </div>

          {/* Selected Asset */}
          {selectedAsset ? (
            <div className="rounded-lg bg-white/[0.04] p-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: `${CHAIN_COLORS[selectedAsset.chain] || "#6B7280"}40` }}>
                  {COMMODITY_ICONS[selectedAsset.symbol] || selectedAsset.symbol.slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{selectedAsset.symbol}</p>
                  <p className="text-[10px] text-gray-500">{truncateAddress(selectedAsset.contract_address)}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-xs text-gray-500 mb-4">Select an asset from the tabs above</p>
          )}

          {/* Quantity */}
          <div className="mb-3">
            <label className="text-[10px] font-medium text-gray-500 mb-1 block">Quantity (fractions)</label>
            <input
              type="number"
              value={orderQty}
              onChange={(e) => setOrderQty(e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-violet-500/50 focus:outline-none"
            />
          </div>

          {/* Price */}
          <div className="mb-4">
            <label className="text-[10px] font-medium text-gray-500 mb-1 block">Price per fraction (USD)</label>
            <input
              type="number"
              step="0.01"
              value={orderPrice}
              onChange={(e) => setOrderPrice(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-violet-500/50 focus:outline-none"
            />
          </div>

          {/* Total */}
          {orderQty && orderPrice && (
            <div className="mb-4 rounded-lg bg-white/[0.04] p-3">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Total</span>
                <span className="font-medium text-white">{formatUSD(parseFloat(orderQty) * parseFloat(orderPrice))}</span>
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmitOrder}
            disabled={!selectedAsset || !orderQty || !orderPrice || orderSubmitting}
            className={`w-full rounded-lg py-3 text-sm font-medium transition-all disabled:opacity-40 ${
              orderSide === "buy"
                ? "bg-green-500/80 text-white hover:bg-green-500"
                : "bg-red-500/80 text-white hover:bg-red-500"
            }`}
          >
            {orderSubmitting ? "Submitting..." : `${orderSide === "buy" ? "Buy" : "Sell"} Fractions`}
          </button>
        </div>

        {/* Settlement Info */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-violet-400" /> Settlement
          </h3>
          <div className="space-y-2 text-[10px]">
            <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="text-white">T+0 Atomic DvP</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Contract</span><span className="text-white">SettlementEscrow</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Standard</span><span className="text-white">ERC-1155</span></div>
            <div className="flex justify-between"><span className="text-gray-500">KYC Required</span><span className="text-green-400">Yes</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Chains Tab ─────────────────────────────────────────────────────────────

function ChainsTab({ chains }: { chains: ChainInfo[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {chains.map(chain => {
        const color = CHAIN_COLORS[chain.name] || "#6B7280";
        return (
          <div key={chain.name} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: `${color}30` }}>
                  <Globe className="h-5 w-5" style={{ color }} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white capitalize">{chain.name}</h3>
                  <p className="text-[10px] text-gray-500">Chain ID: {chain.chain_id}</p>
                </div>
              </div>
              <span className={`flex h-2 w-2 rounded-full ${chain.status === "connected" ? "bg-green-400" : "bg-red-400"}`}>
                <span className={`absolute inline-flex h-2 w-2 animate-ping rounded-full opacity-40 ${chain.status === "connected" ? "bg-green-400" : "bg-red-400"}`} />
              </span>
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between"><span className="text-gray-500">Block Height</span><span className="text-white font-mono">{formatNumber(chain.block_height)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Gas Price</span><span className="text-white">{chain.gas_price}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Contract</span><span className="text-white text-[10px]">{chain.contract}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Confirmations</span><span className="text-white">{chain.confirmations_required}</span></div>
            </div>
          </div>
        );
      })}

      {/* Bridge Info */}
      <div className="md:col-span-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Link2 className="h-4 w-4 text-violet-400" /> Cross-Chain Bridge
        </h3>
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div className="rounded-lg bg-white/[0.04] p-3">
            <span className="text-gray-500">Ethereum &rarr; Polygon</span>
            <p className="mt-1 text-sm font-medium text-green-400">Active</p>
            <p className="text-[10px] text-gray-500">Lock-and-Mint</p>
          </div>
          <div className="rounded-lg bg-white/[0.04] p-3">
            <span className="text-gray-500">Polygon &rarr; Ethereum</span>
            <p className="mt-1 text-sm font-medium text-green-400">Active</p>
            <p className="text-[10px] text-gray-500">Burn-and-Release</p>
          </div>
          <div className="rounded-lg bg-white/[0.04] p-3">
            <span className="text-gray-500">Hyperledger &rarr; Polygon</span>
            <p className="mt-1 text-sm font-medium text-yellow-400">Bridge Only</p>
            <p className="text-[10px] text-gray-500">Relay Proof</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── IPFS Tab ───────────────────────────────────────────────────────────────

function IpfsTab({
  ipfsStatus, assets, copyCid, copiedCid,
}: {
  ipfsStatus: IpfsStatus | null;
  assets: FractionalAsset[];
  copyCid: (cid: string) => void;
  copiedCid: string | null;
}) {
  return (
    <div className="space-y-4">
      {/* IPFS Status */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Database className="h-4 w-4 text-violet-400" /> IPFS Node Status
        </h3>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div>
            <span className="text-[10px] text-gray-500">Connection</span>
            <p className={`text-sm font-medium ${ipfsStatus?.connected ? "text-green-400" : "text-yellow-400"}`}>
              {ipfsStatus?.connected ? "Connected" : "Fallback Mode"}
            </p>
          </div>
          <div>
            <span className="text-[10px] text-gray-500">API URL</span>
            <p className="text-sm text-white font-mono truncate">{ipfsStatus?.api_url || "http://localhost:5001"}</p>
          </div>
          <div>
            <span className="text-[10px] text-gray-500">Gateway URL</span>
            <p className="text-sm text-white font-mono truncate">{ipfsStatus?.gateway_url || "http://localhost:8081"}</p>
          </div>
          <div>
            <span className="text-[10px] text-gray-500">Pinned Objects</span>
            <p className="text-sm text-white">{ipfsStatus?.pinned_objects || 0}</p>
          </div>
        </div>
      </div>

      {/* IPFS Content Registry */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-violet-400" /> Content Registry
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          All commodity metadata, warehouse receipts, and quality certificates stored on IPFS for immutable, decentralized access.
        </p>
        <div className="space-y-2">
          {assets.map(a => (
            <div key={a.asset_id} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2.5">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-white">{a.symbol}</span>
                <span className="text-[10px] text-gray-500">{a.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-500">Metadata:</span>
                  <code className="text-[10px] text-violet-300 font-mono">{a.metadata_cid.slice(0, 16)}...</code>
                  <button onClick={() => copyCid(a.metadata_cid)} className="text-gray-500 hover:text-white">
                    {copiedCid === a.metadata_cid ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-500">Receipt:</span>
                  <code className="text-[10px] text-violet-300 font-mono">{a.warehouse_receipt_cid.slice(0, 16)}...</code>
                  <button onClick={() => copyCid(a.warehouse_receipt_cid)} className="text-gray-500 hover:text-white">
                    {copiedCid === a.warehouse_receipt_cid ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How IPFS Works */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h3 className="text-sm font-semibold text-white mb-3">How IPFS Integration Works</h3>
        <div className="grid gap-3 md:grid-cols-3 text-xs">
          <div className="rounded-lg bg-white/[0.04] p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-6 w-6 rounded-full bg-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-400">1</div>
              <span className="font-medium text-white">Tokenize</span>
            </div>
            <p className="text-gray-500">When a commodity is tokenized, metadata (warehouse receipt, quality grade, origin) is pinned to IPFS.</p>
          </div>
          <div className="rounded-lg bg-white/[0.04] p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-6 w-6 rounded-full bg-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-400">2</div>
              <span className="font-medium text-white">CID Reference</span>
            </div>
            <p className="text-gray-500">The IPFS Content Identifier (CID) is stored on-chain as the token URI, linking the token to its metadata.</p>
          </div>
          <div className="rounded-lg bg-white/[0.04] p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-6 w-6 rounded-full bg-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-400">3</div>
              <span className="font-medium text-white">Immutable Audit</span>
            </div>
            <p className="text-gray-500">Settlement records, transfers, and fractionalization events are also pinned to IPFS for immutable audit trails.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
