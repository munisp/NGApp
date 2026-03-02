"use client";

import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { useMarketMakers, useSubmitQuote } from "@/lib/api-hooks";
import { cn } from "@/lib/utils";
import {
  Users,
  ShieldCheck,
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Send,
  ChevronDown,
  ChevronUp,
  Zap,
  Target,
  Clock,
  BarChart3,
} from "lucide-react";

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  ACTIVE: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-500" },
  SUSPENDED: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-500" },
  INACTIVE: { bg: "bg-gray-500/10", text: "text-gray-400", dot: "bg-gray-500" },
};

export default function MarketMakersPage() {
  const { makers, loading } = useMarketMakers();
  const { submitQuote, loading: submitting, result: quoteResult, error: quoteError } = useSubmitQuote();
  const [expandedMaker, setExpandedMaker] = useState<string | null>(null);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteForm, setQuoteForm] = useState({
    market_maker_id: "MM-001",
    symbol: "GOLD",
    bid_price: 2340,
    bid_quantity: 10,
    ask_price: 2341,
    ask_quantity: 10,
  });

  const handleSubmitQuote = async () => {
    await submitQuote(quoteForm);
  };

  const totalSymbols = makers.reduce((sum, m) => sum + ((m.assigned_symbols as string[])?.length ?? 0), 0);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Market Makers</h1>
            <p className="mt-1 text-sm text-gray-500">
              {makers.length} registered market makers providing liquidity across {totalSymbols} symbols
            </p>
          </div>
          <button
            onClick={() => setShowQuoteForm(!showQuoteForm)}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-brand-400 transition-all hover:bg-brand-500/10"
            style={{ background: "rgba(16, 185, 129, 0.06)", border: "1px solid rgba(16, 185, 129, 0.15)" }}
          >
            <Send className="h-4 w-4" />
            Submit Quote
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { icon: Users, label: "Active Makers", value: String(makers.filter(m => m.status === "ACTIVE").length), color: "brand" },
            { icon: Target, label: "Total Symbols", value: String(totalSymbols), color: "blue" },
            { icon: ShieldCheck, label: "Max Spread", value: "50 bps", color: "purple" },
            { icon: Clock, label: "Min Presence", value: "85%", color: "amber" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="card !p-4">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg",
                    stat.color === "brand" ? "bg-brand-500/10" : stat.color === "blue" ? "bg-blue-500/10" : stat.color === "purple" ? "bg-purple-500/10" : "bg-amber-500/10"
                  )}>
                    <Icon className={cn(
                      "h-4 w-4",
                      stat.color === "brand" ? "text-brand-400" : stat.color === "blue" ? "text-blue-400" : stat.color === "purple" ? "text-purple-400" : "text-amber-400"
                    )} />
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{stat.label}</p>
                </div>
                <p className="text-xl font-bold font-mono">{stat.value}</p>
              </div>
            );
          })}
        </div>

        {/* Quote Submission Form */}
        {showQuoteForm && (
          <div className="card">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10">
                <Send className="h-4 w-4 text-brand-400" />
              </div>
              <h2 className="text-[15px] font-semibold">Submit Two-Sided Quote</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Market Maker</label>
                <select
                  value={quoteForm.market_maker_id}
                  onChange={(e) => setQuoteForm({ ...quoteForm, market_maker_id: e.target.value })}
                  className="input-field !rounded-xl w-full"
                >
                  {makers.map((m) => (
                    <option key={String(m.id)} value={String(m.id)}>{String(m.name)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Symbol</label>
                <select
                  value={quoteForm.symbol}
                  onChange={(e) => setQuoteForm({ ...quoteForm, symbol: e.target.value })}
                  className="input-field !rounded-xl w-full"
                >
                  {["GOLD", "SILVER", "CRUDE_OIL", "COFFEE", "COCOA", "MAIZE", "WHEAT", "SOYBEAN"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Bid Price</label>
                <input type="number" value={quoteForm.bid_price} onChange={(e) => setQuoteForm({ ...quoteForm, bid_price: Number(e.target.value) })} className="input-field !rounded-xl w-full" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Bid Qty</label>
                <input type="number" value={quoteForm.bid_quantity} onChange={(e) => setQuoteForm({ ...quoteForm, bid_quantity: Number(e.target.value) })} className="input-field !rounded-xl w-full" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Ask Price</label>
                <input type="number" value={quoteForm.ask_price} onChange={(e) => setQuoteForm({ ...quoteForm, ask_price: Number(e.target.value) })} className="input-field !rounded-xl w-full" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Ask Qty</label>
                <input type="number" value={quoteForm.ask_quantity} onChange={(e) => setQuoteForm({ ...quoteForm, ask_quantity: Number(e.target.value) })} className="input-field !rounded-xl w-full" />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleSubmitQuote}
                disabled={submitting}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}
              >
                <Send className="h-4 w-4" />
                {submitting ? "Submitting..." : "Submit Quote"}
              </button>
              {quoteResult && (
                <div className="flex items-center gap-2 text-sm text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> Quote accepted
                </div>
              )}
              {quoteError && (
                <div className="flex items-center gap-2 text-sm text-red-400">
                  <XCircle className="h-4 w-4" /> {quoteError}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Market Maker Cards */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-4">
            {makers.map((maker) => {
              const status = STATUS_STYLES[String(maker.status)] ?? STATUS_STYLES.INACTIVE;
              const isExpanded = expandedMaker === String(maker.id);
              const symbols = (maker.assigned_symbols as string[]) ?? [];
              const obligations = maker.obligations as Record<string, number> | undefined;
              const performance = maker.performance as Record<string, unknown> | undefined;

              return (
                <div
                  key={String(maker.id)}
                  className="card !p-0 overflow-hidden"
                >
                  {/* Header Row */}
                  <button
                    onClick={() => setExpandedMaker(isExpanded ? null : String(maker.id))}
                    className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10">
                        <Users className="h-5 w-5 text-brand-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-[15px] font-bold">{String(maker.name)}</h3>
                          <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-[10px] font-bold", status.bg, status.text)}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                            {String(maker.status)}
                          </span>
                        </div>
                        <p className="text-[12px] text-gray-500 mt-0.5">
                          {String(maker.id)} | Clearing: {String(maker.clearing_member_id)} | {symbols.length} symbols
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      {performance && (
                        <div className="hidden md:flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-[10px] text-gray-600">Spread</p>
                            <p className="text-sm font-mono font-semibold">{Number(performance.avg_spread_bps).toFixed(1)} bps</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-gray-600">Presence</p>
                            <p className="text-sm font-mono font-semibold">{Number(performance.presence_pct).toFixed(1)}%</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-gray-600">Compliant</p>
                            {performance.compliant ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-400 ml-auto" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-400 ml-auto" />
                            )}
                          </div>
                        </div>
                      )}
                      {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-600" /> : <ChevronDown className="h-5 w-5 text-gray-600" />}
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-white/[0.04] p-5 space-y-5">
                      {/* Assigned Symbols */}
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Assigned Symbols</p>
                        <div className="flex flex-wrap gap-2">
                          {symbols.map((s) => (
                            <span key={s} className="rounded-lg px-3 py-1.5 text-[12px] font-semibold" style={{ background: "rgba(16, 185, 129, 0.06)", border: "1px solid rgba(16, 185, 129, 0.12)", color: "rgb(52, 211, 153)" }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Obligations & Performance */}
                      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        {obligations && (
                          <>
                            <div className="rounded-xl p-3" style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                              <p className="text-[10px] text-gray-600 mb-1">Max Spread</p>
                              <p className="text-lg font-bold font-mono">{obligations.max_spread_bps} <span className="text-xs text-gray-500">bps</span></p>
                            </div>
                            <div className="rounded-xl p-3" style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                              <p className="text-[10px] text-gray-600 mb-1">Min Quote Size</p>
                              <p className="text-lg font-bold font-mono">{(obligations.min_quote_size / 1e6).toFixed(0)}M</p>
                            </div>
                            <div className="rounded-xl p-3" style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                              <p className="text-[10px] text-gray-600 mb-1">Min Presence</p>
                              <p className="text-lg font-bold font-mono">{obligations.min_presence_pct}%</p>
                            </div>
                          </>
                        )}
                        {performance && (
                          <div className="rounded-xl p-3" style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                            <p className="text-[10px] text-gray-600 mb-1">Violations</p>
                            <p className={cn("text-lg font-bold font-mono", Number(performance.violations) > 0 ? "text-amber-400" : "text-emerald-400")}>
                              {Number(performance.violations)}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Performance Bar */}
                      {performance && (
                        <div>
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-gray-400">Market Presence</span>
                            <span className="font-mono font-semibold">{Number(performance.presence_pct).toFixed(1)}%</span>
                          </div>
                          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${Math.min(100, Number(performance.presence_pct))}%`,
                                background: Number(performance.presence_pct) >= 85
                                  ? "linear-gradient(90deg, #059669, #10b981)"
                                  : "linear-gradient(90deg, #f59e0b, #fbbf24)",
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
