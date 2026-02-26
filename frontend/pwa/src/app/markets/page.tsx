"use client";

import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { useMarketStore } from "@/lib/store";
import { useMarkets } from "@/lib/api-hooks";
import { formatPrice, formatPercent, formatVolume, getPriceColorClass, getCategoryIcon, cn } from "@/lib/utils";
import Link from "next/link";

type Category = "all" | "agricultural" | "precious_metals" | "energy" | "carbon_credits";
type SortField = "symbol" | "lastPrice" | "changePercent24h" | "volume24h";

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

  const categories: { value: Category; label: string; icon: string }[] = [
    { value: "all", label: "All Markets", icon: "📊" },
    { value: "agricultural", label: "Agricultural", icon: "🌾" },
    { value: "precious_metals", label: "Precious Metals", icon: "🥇" },
    { value: "energy", label: "Energy", icon: "⚡" },
    { value: "carbon_credits", label: "Carbon Credits", icon: "🌿" },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Markets</h1>
            <p className="text-sm text-gray-400">{filtered.length} commodities available</p>
          </div>
          <button
            onClick={() => setShowWatchlistOnly(!showWatchlistOnly)}
            className={cn(
              "rounded-lg px-3 py-2 text-sm transition-colors",
              showWatchlistOnly ? "bg-brand-600 text-white" : "bg-surface-700 text-gray-400"
            )}
          >
            Watchlist ({watchlist.length})
          </button>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors",
                category === cat.value
                  ? "bg-brand-600/20 text-brand-400 border border-brand-600/50"
                  : "bg-surface-800 text-gray-400 border border-surface-700 hover:border-surface-200/30"
              )}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search by symbol or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field max-w-md"
        />

        {/* Market Cards Grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((c) => {
            const isWatched = watchlist.includes(c.symbol);
            return (
              <div
                key={c.symbol}
                className="card group relative hover:border-surface-200/30 transition-all"
              >
                {/* Watchlist star */}
                <button
                  onClick={() => toggleWatchlist(c.symbol)}
                  className="absolute right-3 top-3 text-gray-600 hover:text-yellow-400 transition-colors"
                >
                  {isWatched ? (
                    <svg className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                  )}
                </button>

                <Link href={`/trade?symbol=${c.symbol}`} className="block">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{getCategoryIcon(c.category)}</span>
                    <div>
                      <p className="font-bold">{c.symbol}</p>
                      <p className="text-xs text-gray-500">{c.name}</p>
                    </div>
                  </div>

                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xl font-bold font-mono">{formatPrice(c.lastPrice)}</p>
                      <p className={`text-sm font-medium ${getPriceColorClass(c.changePercent24h)}`}>
                        {c.change24h >= 0 ? "+" : ""}{formatPrice(c.change24h)} ({formatPercent(c.changePercent24h)})
                      </p>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <p>Vol: {formatVolume(c.volume24h)}</p>
                      <p>{c.unit}</p>
                    </div>
                  </div>

                  {/* Mini price bar */}
                  <div className="mt-3 flex items-center gap-2 text-[10px] text-gray-500">
                    <span>{formatPrice(c.low24h)}</span>
                    <div className="flex-1 h-1 rounded-full bg-surface-700 relative overflow-hidden">
                      <div
                        className={cn(
                          "absolute h-full rounded-full",
                          c.changePercent24h >= 0 ? "bg-up" : "bg-down"
                        )}
                        style={{
                          left: "0%",
                          width: `${Math.min(100, Math.max(5, ((c.lastPrice - c.low24h) / (c.high24h - c.low24h || 1)) * 100))}%`,
                        }}
                      />
                    </div>
                    <span>{formatPrice(c.high24h)}</span>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">No commodities found</p>
            <p className="text-sm mt-1">Try adjusting your filters or search query</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
