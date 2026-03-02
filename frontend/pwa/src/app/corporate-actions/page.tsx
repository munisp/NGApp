"use client";

import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { useCorporateActions, useProcessCorporateAction } from "@/lib/api-hooks";
import { cn, formatDateTime } from "@/lib/utils";
import {
  FileText,
  RefreshCw,
  ArrowRightLeft,
  DollarSign,
  ShieldAlert,
  Scissors,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Filter,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Layers,
  Zap,
} from "lucide-react";

const ACTION_TYPE_CONFIG: Record<string, { icon: typeof FileText; color: string; bg: string; label: string }> = {
  ROLLOVER: { icon: ArrowRightLeft, color: "text-blue-400", bg: "bg-blue-500/10", label: "Contract Rollover" },
  MARGINADJUSTMENT: { icon: ShieldAlert, color: "text-amber-400", bg: "bg-amber-500/10", label: "Margin Adjustment" },
  CASHDIVIDEND: { icon: DollarSign, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Cash Dividend" },
  SPLIT: { icon: Scissors, color: "text-purple-400", bg: "bg-purple-500/10", label: "Contract Split" },
  REVERSESPLIT: { icon: Scissors, color: "text-pink-400", bg: "bg-pink-500/10", label: "Reverse Split" },
  RIGHTSISSUE: { icon: FileText, color: "text-cyan-400", bg: "bg-cyan-500/10", label: "Rights Issue" },
  CONTRACTMODIFICATION: { icon: FileText, color: "text-indigo-400", bg: "bg-indigo-500/10", label: "Contract Modification" },
  SYMBOLCHANGE: { icon: ArrowRightLeft, color: "text-orange-400", bg: "bg-orange-500/10", label: "Symbol Change" },
  POSITIONTRANSFER: { icon: ArrowRightLeft, color: "text-teal-400", bg: "bg-teal-500/10", label: "Position Transfer" },
  EXCHANGEFORPHYSICAL: { icon: Layers, color: "text-rose-400", bg: "bg-rose-500/10", label: "Exchange for Physical" },
};

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  ANNOUNCED: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-500" },
  PENDING: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-500" },
  PROCESSING: { bg: "bg-purple-500/10", text: "text-purple-400", dot: "bg-purple-500" },
  COMPLETED: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-500" },
  CANCELLED: { bg: "bg-gray-500/10", text: "text-gray-400", dot: "bg-gray-500" },
};

type FilterType = "all" | "ROLLOVER" | "MARGINADJUSTMENT" | "CASHDIVIDEND";

export default function CorporateActionsPage() {
  const { actions, loading, refetch } = useCorporateActions();
  const { processAction, loading: processing } = useProcessCorporateAction();
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");

  const filtered = actions.filter((a) => filter === "all" || a.action_type === filter);

  const handleProcess = async (id: string) => {
    await processAction(id);
    refetch();
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Corporate Actions</h1>
            <p className="mt-1 text-sm text-gray-500">
              {actions.length} actions | {actions.filter(a => a.status === "ANNOUNCED" || a.status === "PENDING").length} pending
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-400 transition-all hover:text-white hover:bg-white/[0.04]"
            style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.04)" }}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { icon: FileText, label: "Total Actions", value: String(actions.length), color: "brand" },
            { icon: Clock, label: "Pending", value: String(actions.filter(a => a.status === "ANNOUNCED" || a.status === "PENDING").length), color: "amber" },
            { icon: CheckCircle2, label: "Completed", value: String(actions.filter(a => a.status === "COMPLETED").length), color: "emerald" },
            { icon: Zap, label: "Action Types", value: String(new Set(actions.map(a => a.action_type)).size), color: "purple" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="card !p-4">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg",
                    stat.color === "brand" ? "bg-brand-500/10" : stat.color === "amber" ? "bg-amber-500/10" : stat.color === "emerald" ? "bg-emerald-500/10" : "bg-purple-500/10"
                  )}>
                    <Icon className={cn(
                      "h-4 w-4",
                      stat.color === "brand" ? "text-brand-400" : stat.color === "amber" ? "text-amber-400" : stat.color === "emerald" ? "text-emerald-400" : "text-purple-400"
                    )} />
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{stat.label}</p>
                </div>
                <p className="text-xl font-bold font-mono">{stat.value}</p>
              </div>
            );
          })}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1.5">
          {[
            { value: "all" as FilterType, label: "All Actions" },
            { value: "ROLLOVER" as FilterType, label: "Rollovers" },
            { value: "MARGINADJUSTMENT" as FilterType, label: "Margin Adj." },
            { value: "CASHDIVIDEND" as FilterType, label: "Dividends" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-medium transition-all",
                filter === tab.value
                  ? "bg-brand-500/10 text-brand-400 ring-1 ring-brand-500/20"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Actions List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((action) => {
              const id = String(action.id);
              const typeStr = String(action.action_type);
              const statusStr = String(action.status);
              const config = ACTION_TYPE_CONFIG[typeStr] ?? ACTION_TYPE_CONFIG.ROLLOVER;
              const statusStyle = STATUS_STYLES[statusStr] ?? STATUS_STYLES.ANNOUNCED;
              const isExpanded = expandedAction === id;
              const Icon = config.icon;
              const params = action.parameters as Record<string, unknown> | undefined;

              return (
                <div
                  key={id}
                  className="card !p-0 overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedAction(isExpanded ? null : id)}
                    className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", config.bg)}>
                        <Icon className={cn("h-5 w-5", config.color)} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-[14px] font-bold">{config.label}</h3>
                          <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10px] font-bold", statusStyle.bg, statusStyle.text)}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", statusStyle.dot)} />
                            {statusStr}
                          </span>
                        </div>
                        <p className="text-[12px] text-gray-500 mt-0.5">{String(action.symbol)} — {String(action.description)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="hidden md:flex items-center gap-2 text-[11px] text-gray-500">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {action.effective_date ? formatDateTime(String(action.effective_date)) : "TBD"}
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-600" /> : <ChevronDown className="h-4 w-4 text-gray-600" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-white/[0.04] p-4 space-y-4">
                      {/* Parameters */}
                      {params && (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Parameters</p>
                          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                            {Object.entries(params)
                              .filter(([k]) => k !== "type")
                              .map(([key, val]) => (
                                <div key={key} className="rounded-xl p-3" style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                                  <p className="text-[10px] text-gray-600 mb-0.5">{key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</p>
                                  <p className="text-sm font-bold font-mono">{typeof val === "number" ? val.toLocaleString() : String(val)}</p>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Timeline */}
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Timeline</p>
                        <div className="flex items-center gap-3">
                          {[
                            { label: "Announced", date: action.announcement_date },
                            { label: "Ex-Date", date: action.ex_date },
                            { label: "Record Date", date: action.record_date },
                            { label: "Effective", date: action.effective_date },
                          ].map((step, i) => (
                            <div key={step.label} className="flex items-center gap-3">
                              {i > 0 && <div className="h-px w-6 bg-white/[0.06]" />}
                              <div className="text-center">
                                <div className={cn(
                                  "mx-auto h-3 w-3 rounded-full mb-1",
                                  step.date ? "bg-brand-500" : "bg-gray-700"
                                )} />
                                <p className="text-[9px] text-gray-500">{step.label}</p>
                                <p className="text-[10px] font-mono">
                                  {step.date ? formatDateTime(String(step.date)).split(",")[0] : "—"}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Process Button */}
                      {(statusStr === "ANNOUNCED" || statusStr === "PENDING") && (
                        <button
                          onClick={() => handleProcess(id)}
                          disabled={processing}
                          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all disabled:opacity-50"
                          style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}
                        >
                          <Play className="h-4 w-4" />
                          {processing ? "Processing..." : "Process Action"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                <FileText className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">No corporate actions found</p>
                <p className="text-xs mt-1">Try adjusting your filter</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
