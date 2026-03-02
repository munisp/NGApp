"use client";

import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { useMarketStore } from "@/lib/store";
import { useMarkets } from "@/lib/api-hooks";
import { formatPrice, formatPercent, formatVolume, getPriceColorClass, getCategoryIcon, cn } from "@/lib/utils";
import Link from "next/link";
import {
  Search,
  Star,
  ArrowUpRight,
  ArrowDownRight,
  Wheat,
  Gem,
  Flame,
  Leaf,
  LayoutGrid,
  SearchX,
} from "lucide-react";

type Category = "all" | "agricultural" | "precious_metals" | "energy" | "carbon_credits";
type SortField = "symbol" | "lastPrice" | "changePercent24h" | "volume24h";

const CATEGORY_ICONS = {
  all: LayoutGrid,
  agricultural: Wheat,
  precious_metals: Gem,
  energy: Flame,
  carbon_credits: Leaf,
};

export default function MarketsPage() {
  const { commodities } = useMarkets();
  const { watchlist, toggleWatchlist } = useMarketStore();
  const [category, setCategory] = useState<Category>("all");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("volume24h");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);

  const filtered = commodities
    .filter((c) => category === "all" || c.category === category)
    .filter((c) =>
      c.symbol.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase())
    )
    .filter((c) => !showWatchlistOnly || watchlist.includes(c.symbol))
    .sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === "string") return sortDir === "asc" ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  const categories: { value: Category; label: string }[] = [
    { value: "all", label: "All Markets" },
    { value: "agricultural", label: "Agricultural" },
    { value: "precious_metals", label: "Precious Metals" },
    { value: "energy", label: "Energy" },
    { value: "carbon_credits", label: "Carbon Credits" },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Markets</h1>
            <p className="mt-1 text-sm text-gray-500">{filtered.length} commodities available</p>
          </div>
          <button
            onClick={() => setShowWatchlistOnly(!showWatchlistOnly)}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
              showWatchlistOnly
                ? "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20"
                : "text-gray-500 hover:text-gray-300"
            )}
            style={!showWatchlistOnly ? { background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.04)" } : {}}
          >
            <Star className={cn("h-4 w-4", showWatchlistOnly && "fill-amber-400")} />
            Watchlist ({watchlist.length})
          </button>
        </div>

        {/* Category Filter + Search */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.value];
              return (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-medium transition-all",
                    category === cat.value
                      ? "bg-brand-500/10 text-brand-400 ring-1 ring-brand-500/20"
                      : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
            <input
              type="text"
              placeholder="Search markets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10 !rounded-xl"
            />
          </div>
        </div>

        {/* Market Cards Grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((c) => {
            const isWatched = watchlist.includes(c.symbol);
            const isUp = c.changePercent24h >= 0;
            return (
              <div
                key={c.symbol}
                className="group relative rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  background: "linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.7))",
                  border: "1px solid rgba(255, 255, 255, 0.04)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.04)"; }}
              >
                {/* Watchlist star */}
                <button
                  onClick={() => toggleWatchlist(c.symbol)}
                  className="absolute right-3.5 top-3.5 z-10 text-gray-700 hover:text-amber-400 transition-colors"
                >
                  <Star className={cn("h-4 w-4", isWatched && "fill-amber-400 text-amber-400")} />
                </button>

                <Link href={`/trade?symbol=${c.symbol}`} className="block">
                  <div className="flex items-center gap-3 mb-3.5">
                    <span className="text-2xl">{getCategoryIcon(c.category)}</span>
                    <div>
                      <p className="text-[15px] font-bold">{c.symbol}</p>
                      <p className="text-[11px] text-gray-600">{c.name}</p>
                    </div>
                  </div>

                  <div className="flex items-end justify-between mb-3">
                    <div>
                      <p className="text-xl font-bold font-mono tracking-tight">{formatPrice(c.lastPrice)}</p>
                      <div className={cn(
                        "mt-1 flex items-center gap-1 text-xs font-semibold",
                        isUp ? "text-emerald-400" : "text-red-400"
                      )}>
                        {isUp ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                        {isUp ? "+" : ""}{formatPrice(c.change24h)} ({formatPercent(c.changePercent24h)})
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-600">Vol</p>
                      <p className="text-[11px] font-mono text-gray-400">{formatVolume(c.volume24h)}</p>
                    </div>
                  </div>

                  {/* Mini price bar */}
                  <div className="flex items-center gap-2 text-[10px] text-gray-600">
                    <span className="font-mono">{formatPrice(c.low24h)}</span>
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255, 255, 255, 0.04)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, Math.max(5, ((c.lastPrice - c.low24h) / (c.high24h - c.low24h || 1)) * 100))}%`,
                          background: isUp
                            ? "linear-gradient(90deg, #059669, #10b981)"
                            : "linear-gradient(90deg, #dc2626, #ef4444)",
                        }}
                      />
                    </div>
                    <span className="font-mono">{formatPrice(c.high24h)}</span>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-600">
            <SearchX className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No commodities found</p>
            <p className="text-xs mt-1">Try adjusting your filters or search query</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
