/**
 * Overview Page — Main operational dashboard
 * Design: Dark Amber — KPI cards, production chart, alarm feed, well status grid
 * Data: Live tRPC with mock fallback when DB is empty
 */

import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useOverviewStream } from "@/hooks/useTelemetryStream";
import {
  Activity, AlertTriangle, ArrowUpRight, BarChart3,
  Droplets, Flame, Gauge, TrendingDown, TrendingUp, Zap,
  type LucideIcon
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
// Types only - no mock data
type Alarm = Record<string, any>;
type Well = Record<string, any>;

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, unit, icon: Icon, trend, trendValue, color = "amber", subtitle
}: {
  label: string; value: string | number; unit?: string; icon: LucideIcon;
  trend?: "up" | "down" | "neutral"; trendValue?: string; color?: string; subtitle?: string;
}) {
  const colorMap: Record<string, string> = {
    amber: "text-amber-400 bg-amber-950/40 border-amber-700/30",
    green: "text-emerald-400 bg-emerald-950/40 border-emerald-700/30",
    red: "text-red-400 bg-red-950/40 border-red-700/30",
    blue: "text-blue-400 bg-blue-950/40 border-blue-700/30",
  };

  return (
    <div className="kpi-card group">
      <div className="flex items-start justify-between mb-3">
        <div className={cn("p-2 rounded-md border", colorMap[color] ?? "")}>
          <Icon className="w-4 h-4" />
        </div>
        {trend && trendValue && (
          <div className={cn(
            "flex items-center gap-1 text-xs font-mono",
            trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-muted-foreground"
          )}>
            {trend === "up" ? <TrendingUp className="w-3 h-3" /> : trend === "down" ? <TrendingDown className="w-3 h-3" /> : null}
            {trendValue}
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="sensor-value text-foreground">{typeof value === "number" ? value.toLocaleString() : value}</span>
        {unit && <span className="sensor-unit">{unit}</span>}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
      {subtitle && <div className="text-[10px] text-muted-foreground/60 mt-0.5 font-mono">{subtitle}</div>}
    </div>
  );
}

// ─── Alarm Row ────────────────────────────────────────────────────────────────

function AlarmRow({ alarm }: { alarm: Alarm }) {
  const severityConfig = {
    1: { label: "CRITICAL", cls: "alarm-critical", badge: "status-badge-critical" },
    2: { label: "HIGH", cls: "alarm-warning", badge: "status-badge-warning" },
    3: { label: "MEDIUM", cls: "alarm-info", badge: "status-badge-normal" },
    4: { label: "LOW", cls: "", badge: "status-badge-offline" },
  };
  const cfg = severityConfig[alarm.severity as keyof typeof severityConfig] ?? severityConfig[3];
  const age = Math.round((Date.now() - new Date(alarm.created_at).getTime()) / 60000);

  return (
    <div className={cn("flex items-start gap-3 p-3 rounded-md", cfg.cls)}>
      <AlertTriangle className={cn("w-4 h-4 mt-0.5 shrink-0", alarm.severity === 1 ? "text-red-400" : alarm.severity === 2 ? "text-amber-400" : "text-blue-400")} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cfg.badge}>{cfg.label}</span>
          <span className="text-xs font-medium text-foreground">{alarm.well_name}</span>
          <span className="text-[10px] text-muted-foreground font-mono">{age}m ago</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{alarm.message}</p>
      </div>
      {alarm.state === "UNACKNOWLEDGED" && (
        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse mt-1.5 shrink-0" />
      )}
    </div>
  );
}

// ─── DB Alarm Row (for live data) ─────────────────────────────────────────────

function DbAlarmRow({ alarm }: { alarm: any }) {
  const severityMap: Record<number, { label: string; cls: string; badge: string }> = {
    4: { label: "CRITICAL", cls: "alarm-critical", badge: "status-badge-critical" },
    3: { label: "HIGH", cls: "alarm-warning", badge: "status-badge-warning" },
    2: { label: "MEDIUM", cls: "alarm-info", badge: "status-badge-normal" },
    1: { label: "LOW", cls: "", badge: "status-badge-offline" },
  };
  const cfg = severityMap[alarm.severity] ?? severityMap[2];
  const age = Math.round((Date.now() - new Date(alarm.createdAt).getTime()) / 60000);

  return (
    <div className={cn("flex items-start gap-3 p-3 rounded-md", cfg.cls)}>
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cfg.badge}>{cfg.label}</span>
          <span className="text-xs font-medium text-foreground">{alarm.wellId}</span>
          <span className="text-[10px] text-muted-foreground font-mono">{age}m ago</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{alarm.description}</p>
      </div>
      {alarm.state === "UNACKNOWLEDGED" && (
        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse mt-1.5 shrink-0" />
      )}
    </div>
  );
}

// ─── Well Status Mini Card ────────────────────────────────────────────────────

function WellMiniCard({ well }: { well: Well }) {
  const statusConfig = {
    ACTIVE: { badge: "status-badge-normal", dot: "bg-emerald-500" },
    SHUT_IN: { badge: "status-badge-offline", dot: "bg-zinc-500" },
    DRILLING: { badge: "status-badge-drilling", dot: "bg-blue-500" },
    WORKOVER: { badge: "status-badge-warning", dot: "bg-amber-500" },
    ABANDONED: { badge: "status-badge-offline", dot: "bg-zinc-600" },
  };
  const cfg = statusConfig[well.status as keyof typeof statusConfig] ?? statusConfig.SHUT_IN;

  return (
    <Link href={`/wells/${well.well_id}`}>
      <div className="p-3 rounded-md border border-border/50 bg-card hover:border-amber-700/40 hover:bg-amber-950/10 transition-all duration-150 cursor-pointer group">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
            <span className="text-xs font-medium text-foreground truncate max-w-[120px]">{well.well_name}</span>
          </div>
          <ArrowUpRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        {well.status === "ACTIVE" ? (
          <div className="grid grid-cols-2 gap-1">
            <div>
              <div className="text-[10px] text-muted-foreground">Oil</div>
              <div className="text-xs font-mono font-bold text-amber-400">{well.oil_bpd.toLocaleString()} <span className="text-[9px] text-muted-foreground">BPD</span></div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Uptime</div>
              <div className="text-xs font-mono font-bold text-emerald-400">{well.uptime_pct}%</div>
            </div>
          </div>
        ) : (
          <div className={cn("text-[10px] font-mono", cfg.badge, "mt-1")}>{well.status.replace("_", " ")}</div>
        )}
      </div>
    </Link>
  );
}

// ─── DB Well Mini Card ────────────────────────────────────────────────────────

function DbWellMiniCard({ well }: { well: any }) {
  const statusConfig: Record<string, { dot: string }> = {
    ACTIVE: { dot: "bg-emerald-500" },
    SHUT_IN: { dot: "bg-zinc-500" },
    DRILLING: { dot: "bg-blue-500" },
    WORKOVER: { dot: "bg-amber-500" },
    ABANDONED: { dot: "bg-zinc-600" },
  };
  const cfg = statusConfig[well.status] ?? { dot: "bg-zinc-500" };

  return (
    <Link href={`/wells/${well.wellId}`}>
      <div className="p-3 rounded-md border border-border/50 bg-card hover:border-amber-700/40 hover:bg-amber-950/10 transition-all duration-150 cursor-pointer group">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
            <span className="text-xs font-medium text-foreground truncate max-w-[120px]">{well.name}</span>
          </div>
          <ArrowUpRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="text-[10px] text-muted-foreground font-mono">{well.status.replace("_", " ")} · {well.field}</div>
      </div>
    </Link>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 shadow-xl">
      <div className="text-xs text-muted-foreground mb-1 font-mono">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground capitalize">{p.name}:</span>
          <span className="font-mono font-bold text-foreground">{p.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Overview Page ────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const { t } = useTranslation();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // SSE real-time stream for live indicator
  const { connected: sseConnected } = useOverviewStream();

  // Live tRPC queries
  const { data: wellStats, isLoading: wellsLoading } = trpc.wells.stats.useQuery();
  const { data: alarmStats } = trpc.wells.alarmStats.useQuery();
  const { data: activeAlarmsDb } = trpc.wells.activeAlarms.useQuery({ limit: 4 });
  const { data: productionTrend } = trpc.wells.productionTrend.useQuery({ days: 14 });
  const { data: financialSummary } = trpc.financials.summary.useQuery();
  const { data: wellsData } = trpc.wells.list.useQuery({ limit: 6 });
  const { data: prodSummary } = trpc.production.summary.useQuery();
  // Shift handover active banner
  const utils = trpc.useUtils();
  const { data: activeHandover } = trpc.shiftHandover.getActive.useQuery(undefined, { refetchInterval: 60_000 });
  const signOffMutation = trpc.shiftHandover.signOff.useMutation({ onSuccess: () => utils.shiftHandover.getActive.invalidate() });
  const [handoverDismissed, setHandoverDismissed] = useState(false);

  // Determine if DB has data (use live data if available, else fall back to mock)
  const hasWells = (wellStats?.total ?? 0) > 0;
  const hasAlarms = (alarmStats?.active ?? 0) > 0 || (activeAlarmsDb?.length ?? 0) > 0;
  const hasProduction = (productionTrend?.length ?? 0) > 0;

  // Chart data: live only
  const chartData = hasProduction ? productionTrend! : [];

  // KPI values: live data only
  const totalWells = wellStats?.total ?? 0;
  const activeWells = wellStats?.active ?? 0;
  const activeAlarmsCount = alarmStats?.active ?? 0;
  const criticalAlarms = alarmStats?.critical ?? 0;
  const totalOilBpd = prodSummary?.totalOil ? Math.round(Number(prodSummary.totalOil)) : 0;
  const totalGasMmscfd = prodSummary?.totalGas ? Number(prodSummary.totalGas).toFixed(1) : "0.0";
  const revenueToday = financialSummary?.revenue
    ? `$${(Number(financialSummary.revenue) / 1_000_000).toFixed(2)}M`
    : "$0.00M";
  // Well status breakdown
  const byStatus = wellStats?.byStatus ?? {};

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* ── Shift Handover Active Banner ──────────────────────────────── */}
      {activeHandover && !handoverDismissed && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <div>
              <span className="text-sm font-semibold text-amber-300">Shift Handover In Progress</span>
              <span className="text-xs text-muted-foreground ml-2">
                Outgoing: <span className="text-foreground font-medium">{activeHandover.outgoingOperator}</span>
                {activeHandover.incomingOperator && (
                  <> &rarr; Incoming: <span className="text-foreground font-medium">{activeHandover.incomingOperator}</span></>
                )}
                {(activeHandover.criticalAlarms ?? 0) > 0 && (
                  <span className="ml-2 text-red-400 font-semibold">{activeHandover.criticalAlarms} critical alarm{activeHandover.criticalAlarms! > 1 ? 's' : ''}</span>
                )}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => signOffMutation.mutate({ id: activeHandover.id })}
              disabled={signOffMutation.isPending}
              className="text-xs px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-black font-semibold transition-colors disabled:opacity-50"
            >
              Sign Off
            </button>
            <button onClick={() => setHandoverDismissed(true)} className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1">
              Dismiss
            </button>
          </div>
        </div>
      )}
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-[Syne] text-foreground">{t('overview.title')}</h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
            {currentTime.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            {" · "}
            <span className="text-amber-400">{currentTime.toLocaleTimeString("en-US", { hour12: false })}</span>
            {" UTC"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("live-indicator", !sseConnected && "bg-gray-500 shadow-none")} />
          <span className="text-xs text-muted-foreground font-mono">{sseConnected ? "LIVE" : "CONNECTING"}</span>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────── */}
      {wellsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          <KpiCard label={t('overview.activeWells')} value={activeWells} icon={Gauge} color="green"
            trend="up" trendValue="+3 this week" subtitle={`of ${totalWells} total`} />
          <KpiCard label={t('overview.oilProduction')} value={totalOilBpd} unit="BPD" icon={Droplets} color="amber"
            trend="up" trendValue="+2.1%" />
          <KpiCard label={t('overview.gasProduction')} value={totalGasMmscfd} unit="MMscfd" icon={Flame} color="blue"
            trend="neutral" trendValue="±0.3%" />
          <KpiCard label={t('overview.fleetUptime')} value={(wellStats as any)?.avgUptime ? `${(wellStats as any).avgUptime.toFixed(1)}%` : "—"} icon={Activity} color="green"
            trend="up" trendValue="+0.2%" />
          <KpiCard label={t('overview.activeAlarms')} value={activeAlarmsCount} icon={AlertTriangle} color="red"
            trend="down" trendValue="-2 today" subtitle={`${criticalAlarms} critical`} />
          <KpiCard label={t('overview.revenueToday')} value={revenueToday}
            icon={Zap} color="amber" trend="up" trendValue="+4.2%" />
        </div>
      )}

      {/* ── Charts row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Production chart */}
        <Card className="lg:col-span-2 bg-card border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold font-[Syne]">14-Day Production</CardTitle>
              <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />Oil (BBL)</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Gas (×10 MCF)</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="oilGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D97706" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#D97706" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gasGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6B7280", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#6B7280", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="oil" stroke="#D97706" strokeWidth={2} fill="url(#oilGrad)" dot={false} />
                <Area type="monotone" dataKey="gas" stroke="#3B82F6" strokeWidth={1.5} fill="url(#gasGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Well status summary */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold font-[Syne]">Well Status</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2.5">
            {[
              { label: "Active", key: "ACTIVE", color: "bg-emerald-500" },
              { label: "Shut-In", key: "SHUT_IN", color: "bg-zinc-500" },
              { label: "Drilling", key: "DRILLING", color: "bg-blue-500" },
              { label: "Workover", key: "WORKOVER", color: "bg-amber-500" },
            ].map(({ label, key, color }) => {
              const count = byStatus[key] ?? 0;
              const pct = totalWells > 0 ? count / totalWells : 0;
              return (
                <div key={label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", color)} />
                      <span className="text-muted-foreground">{label}</span>
                    </div>
                    <span className="font-mono font-bold text-foreground">{count}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-700", color)}
                      style={{ width: `${pct * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="pt-2 border-t border-border/50">
              <div className="text-xs text-muted-foreground">MTBF</div>
              <div className="text-2xl font-bold font-mono text-amber-400">{(wellStats as any)?.mtbfDays ?? "—"} <span className="text-xs text-muted-foreground font-normal">days</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Bottom row: Alarms + Wells ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active alarms */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold font-[Syne] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                Active Alarms
              </CardTitle>
              <Link href="/alarms">
                <span className="text-xs text-amber-400 hover:text-amber-300 transition-colors cursor-pointer">View all →</span>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {(activeAlarmsDb && activeAlarmsDb.length > 0)
              ? activeAlarmsDb.map((alarm: any) => <DbAlarmRow key={alarm.id} alarm={alarm} />)
              : null
            }
            {activeAlarmsCount === 0 && !hasAlarms && (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No active alarms
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top wells */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold font-[Syne]">Well Fleet</CardTitle>
              <Link href="/wells">
                <span className="text-xs text-amber-400 hover:text-amber-300 transition-colors cursor-pointer">View all →</span>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-2">
              {(wellsData?.wells && wellsData.wells.length > 0)
                ? wellsData.wells.slice(0, 6).map((well: any) => <DbWellMiniCard key={well.id} well={well} />)
                : <div className="col-span-2 text-sm text-muted-foreground text-center py-4">No wells yet. Add wells to get started.</div>
              }
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
