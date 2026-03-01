"use client";

import AppShell from "@/components/layout/AppShell";
import { useIndices, useIndexValues } from "@/lib/api-hooks";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Globe2,
  Wheat,
  Gem,
  Flame,
  Leaf,
} from "lucide-react";

const INDEX_ICONS: Record<string, typeof BarChart3> = {
  "NXCI": Globe2,
  "NXCI-AGRI": Wheat,
  "NXCI-METAL": Gem,
  "NXCI-ENERGY": Flame,
  "NXCI-CARBON": Leaf,
};

const INDEX_COLORS: Record<string, { gradient: string; bg: string; text: string }> = {
  "NXCI": { gradient: "from-brand-500 to-emerald-400", bg: "bg-brand-500/10", text: "text-brand-400" },
  "NXCI-AGRI": { gradient: "from-green-500 to-lime-400", bg: "bg-green-500/10", text: "text-green-400" },
  "NXCI-METAL": { gradient: "from-amber-500 to-yellow-400", bg: "bg-amber-500/10", text: "text-amber-400" },
  "NXCI-ENERGY": { gradient: "from-blue-500 to-cyan-400", bg: "bg-blue-500/10", text: "text-blue-400" },
  "NXCI-CARBON": { gradient: "from-purple-500 to-violet-400", bg: "bg-purple-500/10", text: "text-purple-400" },
};

const TYPE_LABELS: Record<string, string> = {
  COMPOSITE: "Composite",
  SECTOR: "Sector",
  SINGLECOMMODITY: "Single Commodity",
};

export default function IndicesPage() {
  const { indices, loading: indicesLoading, refetch: refetchIndices } = useIndices();
  const { values, loading: valuesLoading, refetch: refetchValues } = useIndexValues();

  const getValueForIndex = (indexId: string) => {
    return values.find((v) => v.index_id === indexId);
  };

  const isLoading = indicesLoading || valuesLoading;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Commodity Indices</h1>
            <p className="mt-1 text-sm text-gray-500">
              {indices.length} indices tracking commodity market performance
            </p>
          </div>
          <button
            onClick={() => { refetchIndices(); refetchValues(); }}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-400 transition-all hover:text-white hover:bg-white/[0.04]"
            style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.04)" }}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {/* Composite Index Hero Card */}
        {!isLoading && indices.length > 0 && (() => {
          const composite = indices.find((i) => String(i.index_type) === "COMPOSITE");
          if (!composite) return null;
          const val = getValueForIndex(String(composite.id));
          const change = Number(val?.change ?? 0);
          const changePct = Number(val?.change_pct ?? 0);
          const isUp = change >= 0;
          const constituents = (composite.constituents as unknown[]) ?? [];

          return (
            <div
              className="relative overflow-hidden rounded-2xl p-6"
              style={{
                background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(15, 23, 42, 0.9))",
                border: "1px solid rgba(16, 185, 129, 0.15)",
              }}
            >
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-5" style={{ background: "radial-gradient(circle, #10b981, transparent)" }} />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10">
                    <Globe2 className="h-6 w-6 text-brand-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">{String(composite.name)}</h2>
                    <p className="text-[11px] text-gray-500">{String(composite.id)} | {constituents.length} constituents | {String(composite.methodology)}</p>
                  </div>
                </div>

                <div className="flex items-end gap-6">
                  <div>
                    <p className="text-4xl font-bold font-mono tracking-tight">{Number(val?.value ?? 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <div className={cn("flex items-center gap-1.5 mt-1 text-sm font-semibold", isUp ? "text-emerald-400" : "text-red-400")}>
                      {isUp ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      {isUp ? "+" : ""}{change.toFixed(2)} ({isUp ? "+" : ""}{changePct.toFixed(2)}%)
                    </div>
                  </div>

                  <div className="flex-1 grid grid-cols-4 gap-3 ml-6">
                    {[
                      { label: "Open", value: Number(val?.open ?? 1000) },
                      { label: "High", value: Number(val?.high ?? 1000) },
                      { label: "Low", value: Number(val?.low ?? 1000) },
                      { label: "Volume", value: Number(val?.volume ?? 0) },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl p-2.5" style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                        <p className="text-[9px] text-gray-600 uppercase">{item.label}</p>
                        <p className="text-sm font-bold font-mono">{item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Sector Indices Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {indices
              .filter((i) => String(i.index_type) !== "COMPOSITE")
              .map((index) => {
                const id = String(index.id);
                const val = getValueForIndex(id);
                const change = Number(val?.change ?? 0);
                const changePct = Number(val?.change_pct ?? 0);
                const isUp = change >= 0;
                const colors = INDEX_COLORS[id] ?? INDEX_COLORS["NXCI"];
                const Icon = INDEX_ICONS[id] ?? BarChart3;
                const constituents = (index.constituents as unknown[]) ?? [];

                return (
                  <div
                    key={id}
                    className="group relative rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5"
                    style={{
                      background: "linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.7))",
                      border: "1px solid rgba(255, 255, 255, 0.04)",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.04)"; }}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", colors.bg)}>
                        <Icon className={cn("h-5 w-5", colors.text)} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-[14px] font-bold">{String(index.name)}</h3>
                        <p className="text-[10px] text-gray-600">{id} | {TYPE_LABELS[String(index.index_type)] ?? String(index.index_type)}</p>
                      </div>
                    </div>

                    <p className="text-2xl font-bold font-mono tracking-tight mb-1">
                      {Number(val?.value ?? 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>

                    <div className={cn("flex items-center gap-1 text-xs font-semibold mb-4", isUp ? "text-emerald-400" : "text-red-400")}>
                      {isUp ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                      {isUp ? "+" : ""}{change.toFixed(2)} ({isUp ? "+" : ""}{changePct.toFixed(2)}%)
                    </div>

                    {/* Mini stat row */}
                    <div className="flex justify-between text-[10px]">
                      <div>
                        <span className="text-gray-600">Constituents</span>
                        <p className="font-mono font-semibold">{constituents.length}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-600">Methodology</span>
                        <p className="font-semibold">{String(index.methodology)}</p>
                      </div>
                    </div>

                    {/* Change bar */}
                    <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255, 255, 255, 0.04)" }}>
                      <div
                        className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700", colors.gradient)}
                        style={{ width: `${Math.min(100, Math.max(10, 50 + changePct * 10))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* Index Details Table */}
        {!isLoading && (
          <div className="card">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                <Layers className="h-4 w-4 text-blue-400" />
              </div>
              <h2 className="text-[15px] font-semibold">All Indices</h2>
              <span className="badge-neutral text-[10px]">{indices.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="table-header">Index</th>
                    <th className="table-header">Type</th>
                    <th className="table-header text-right">Value</th>
                    <th className="table-header text-right">Change</th>
                    <th className="table-header text-right">High</th>
                    <th className="table-header text-right">Low</th>
                    <th className="table-header text-right">Constituents</th>
                    <th className="table-header text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {indices.map((index) => {
                    const id = String(index.id);
                    const val = getValueForIndex(id);
                    const change = Number(val?.change ?? 0);
                    const changePct = Number(val?.change_pct ?? 0);
                    const isUp = change >= 0;
                    const constituents = (index.constituents as unknown[]) ?? [];

                    return (
                      <tr key={id} className="table-row">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-[13px]">{id}</p>
                            <p className="text-[11px] text-gray-600">{String(index.name)}</p>
                          </div>
                        </td>
                        <td className="py-3">
                          <span className="rounded-lg px-2 py-0.5 text-[10px] font-bold bg-white/[0.04]">
                            {TYPE_LABELS[String(index.index_type)] ?? String(index.index_type)}
                          </span>
                        </td>
                        <td className="py-3 text-right font-mono text-[13px] font-semibold">
                          {Number(val?.value ?? 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={cn("py-3 text-right font-mono text-[13px]", isUp ? "text-emerald-400" : "text-red-400")}>
                          {isUp ? "+" : ""}{changePct.toFixed(2)}%
                        </td>
                        <td className="py-3 text-right font-mono text-[13px] text-gray-400">
                          {Number(val?.high ?? 1000).toFixed(2)}
                        </td>
                        <td className="py-3 text-right font-mono text-[13px] text-gray-400">
                          {Number(val?.low ?? 1000).toFixed(2)}
                        </td>
                        <td className="py-3 text-right font-mono text-[13px]">{constituents.length}</td>
                        <td className="py-3 text-right">
                          <span className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {String(index.status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
