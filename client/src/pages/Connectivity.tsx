/**
 * Connectivity.tsx — Site Connectivity Health Panel
 * Design: Dark Amber — signal strength uses green/amber/red traffic-light coding
 * WT Petrotech Gap Closure: Solar-Powered Sites, Low-Bandwidth SCADA, Remote Connectivity
 */

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Activity, AlertTriangle, Battery, BatteryCharging, BatteryLow,
  CheckCircle2, Clock, Database, Radio, RefreshCw, Server,
  Signal, SignalHigh, SignalLow, SignalMedium, SignalZero, Sun,
  Wifi, WifiOff, Zap
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from "recharts";
type ConnectivityStatus = "ONLINE" | "DEGRADED" | "OFFLINE" | "BUFFERING" | "MAINTENANCE";
type ProtocolType = string;
type SiteConnectivity = Record<string, any>;
import { trpc } from "@/lib/trpc";

// ── Helpers ───────────────────────────────────────────────────────────────────

function signalIcon(quality: number) {
  if (quality >= 90) return <SignalHigh className="w-4 h-4 text-emerald-400" />;
  if (quality >= 70) return <SignalMedium className="w-4 h-4 text-amber-400" />;
  if (quality >= 30) return <SignalLow className="w-4 h-4 text-orange-400" />;
  return <SignalZero className="w-4 h-4 text-red-400" />;
}

function statusConfig(status: ConnectivityStatus) {
  switch (status) {
    case "ONLINE":
      return { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", label: "Online", dot: "bg-emerald-400" };
    case "DEGRADED":
      return { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", label: "Degraded", dot: "bg-amber-400" };
    case "OFFLINE":
      return { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", label: "Offline", dot: "bg-red-400" };
    case "BUFFERING":
      return { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", label: "Buffering", dot: "bg-blue-400" };
    case "MAINTENANCE":
      return { color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30", label: "Maintenance", dot: "bg-purple-400" };
  }
}

function powerModeIcon(mode: string) {
  switch (mode) {
    case "SOLAR": return <Sun className="w-3.5 h-3.5 text-amber-400" />;
    case "BATTERY": return <Battery className="w-3.5 h-3.5 text-blue-400" />;
    case "GENERATOR": return <Zap className="w-3.5 h-3.5 text-orange-400" />;
    default: return <Zap className="w-3.5 h-3.5 text-emerald-400" />;
  }
}

function protocolBadge(p: ProtocolType) {
  const colors: Record<string, string> = {
    MQTT: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    MODBUS_TCP: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    MODBUS_RTU: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    OPC_UA: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    DNP3: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    HART: "bg-pink-500/10 text-pink-400 border-pink-500/30",
  };
  return (
    <span key={p} className={`text-[9px] font-mono px-1.5 py-0.5 rounded border font-bold ${colors[p] ?? "bg-muted text-muted-foreground border-border"}`}>
      {p}
    </span>
  );
}

function formatUptime(seconds: number) {
  if (seconds === 0) return "Offline";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function timeSince(isoStr: string) {
  const diff = Date.now() - new Date(isoStr).getTime();
  if (diff < 10000) return "Just now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// ── Site Card ─────────────────────────────────────────────────────────────────

function SiteCard({ site }: { site: SiteConnectivity }) {
  const cfg = statusConfig(site.status);
  const isSolar = site.site_power_mode === "SOLAR" || site.site_power_mode === "BATTERY";

  return (
    <Card className={`bg-card border transition-all ${cfg.border} ${site.status === "OFFLINE" ? "opacity-70" : ""}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-bold font-[Syne] text-foreground">{site.well_name}</div>
            <div className="text-xs font-mono text-muted-foreground">{site.api_number}</div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${cfg.dot} ${site.status === "ONLINE" ? "animate-pulse" : ""}`} />
            <Badge className={`${cfg.bg} ${cfg.color} ${cfg.border} text-[10px]`}>{cfg.label}</Badge>
          </div>
        </div>

        {/* Signal quality */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {signalIcon(site.link_quality_pct)}
              <span>Link Quality</span>
            </div>
            <span className={`text-xs font-mono font-bold ${cfg.color}`}>{site.link_quality_pct}%</span>
          </div>
          <Progress value={site.link_quality_pct} className="h-1.5" />
        </div>

        {/* Buffer depth */}
        {site.buffer_depth > 0 && (
          <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 rounded px-2 py-1.5">
            <Database className="w-3 h-3" />
            <span className="font-mono font-bold">{site.buffer_depth.toLocaleString()}</span>
            <span className="text-amber-300/70">buffered readings pending upload</span>
          </div>
        )}

        {/* Solar / power section */}
        {isSolar && (
          <div className="grid grid-cols-2 gap-2 bg-muted/20 rounded p-2">
            <div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                <Sun className="w-3 h-3 text-amber-400" />
                <span>Solar Voltage</span>
              </div>
              <div className="text-sm font-mono text-amber-400 font-bold">
                {site.solar_voltage_v != null ? Number(site.solar_voltage_v).toFixed(1) : "—"}V
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                <BatteryCharging className="w-3 h-3 text-blue-400" />
                <span>Battery SoC</span>
              </div>
              <div className={`text-sm font-mono font-bold ${(site.battery_soc_pct ?? 0) < 30 ? "text-red-400" : "text-blue-400"}`}>
                {site.battery_soc_pct != null ? Number(site.battery_soc_pct).toFixed(0) : "—"}%
              </div>
            </div>
            {site.compressor_running !== undefined && (
              <div className="col-span-2">
                <div className="flex items-center gap-1.5 text-[10px]">
                  <div className={`w-1.5 h-1.5 rounded-full ${site.compressor_running ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground"}`} />
                  <span className="text-muted-foreground">Air Compressor:</span>
                  <span className={site.compressor_running ? "text-emerald-400" : "text-muted-foreground"}>
                    {site.compressor_running ? "Running" : "Stopped"}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Protocols */}
        <div className="flex flex-wrap gap-1">
          {(site.protocols_active as string[]).map((p: string) => protocolBadge(p))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border">
          <div className="flex items-center gap-1">
            {powerModeIcon(site.site_power_mode)}
            <span>{site.site_power_mode}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{timeSince(site.last_seen_at)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Server className="w-3 h-3" />
            <span>v{site.agent_version}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Fleet Map (SVG) ───────────────────────────────────────────────────────────

function ConnectivityMap({ sites }: { sites: SiteConnectivity[] }) {
  // Normalize lat/lon to SVG space (rough US map)
  function toSVG(lat: number, lon: number) {
    const x = ((lon - (-125)) / ((-65) - (-125))) * 720 + 40;
    const y = ((lat - 24) / (50 - 24)) * -220 + 270;
    return { x, y };
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-[Syne] flex items-center gap-2">
          <Radio className="w-4 h-4 text-amber-400" />
          Fleet Connectivity Map
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <svg viewBox="0 0 800 300" className="w-full" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            <rect width="800" height="300" fill="#0d1117" rx="8" />
            {/* Grid lines */}
            {[0, 1, 2, 3, 4].map(i => (
              <line key={`h${i}`} x1="40" y1={50 + i * 55} x2="760" y2={50 + i * 55} stroke="rgba(255,255,255,0.03)" />
            ))}
            {[0, 1, 2, 3, 4, 5, 6].map(i => (
              <line key={`v${i}`} x1={40 + i * 120} y1="50" x2={40 + i * 120} y2="270" stroke="rgba(255,255,255,0.03)" />
            ))}

            {/* Sites */}
            {sites.map(site => {
              const { x, y } = toSVG(Number(site.latitude ?? 0), Number(site.longitude ?? 0));
              const cfg = statusConfig(site.status);
              const dotColor = site.status === "ONLINE" ? "#10b981" : site.status === "DEGRADED" ? "#f59e0b" : "#ef4444";
              const ringColor = site.status === "ONLINE" ? "rgba(16,185,129,0.2)" : site.status === "DEGRADED" ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)";

              return (
                <g key={site.well_id ?? (site as any).wellId ?? (site as any).id}>
                  {/* Signal ring */}
                  <circle cx={x} cy={y} r={site.status === "ONLINE" ? 14 : 10} fill={ringColor} />
                  {/* Dot */}
                  <circle cx={x} cy={y} r={5} fill={dotColor} />
                  {/* Label */}
                  <text x={x + 8} y={y - 6} fill="#9ca3af" fontSize="8" fontWeight="600">
                    {(site.well_name ?? (site as any).wellName ?? "").split(" ").slice(-1)[0]}
                  </text>
                  {/* Quality */}
                  <text x={x + 8} y={y + 5} fill={dotColor} fontSize="7">
                    {site.link_quality_pct}%
                  </text>
                  {/* Solar icon */}
                  {site.site_power_mode === "SOLAR" && (
                    <text x={x - 4} y={y - 10} fill="#d97706" fontSize="8">☀</text>
                  )}
                </g>
              );
            })}

            {/* Legend */}
            <g transform="translate(620, 20)">
              <circle cx="6" cy="6" r="4" fill="#10b981" />
              <text x="14" y="10" fill="#9ca3af" fontSize="8">Online</text>
              <circle cx="6" cy="22" r="4" fill="#f59e0b" />
              <text x="14" y="26" fill="#9ca3af" fontSize="8">Degraded</text>
              <circle cx="6" cy="38" r="4" fill="#ef4444" />
              <text x="14" y="42" fill="#9ca3af" fontSize="8">Offline</text>
              <text x="0" y="58" fill="#d97706" fontSize="8">☀ Solar</text>
            </g>
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ConnectivityPage() {
  const { data: liveConnectivity } = trpc.connectivity.list.useQuery();
  const allSites: SiteConnectivity[] = ((liveConnectivity as any[]) ?? []).map((s: any) => ({
    site_id: s.siteId ?? s.id,
    site_name: s.siteName ?? s.name ?? s.siteId,
    site_type: s.siteType ?? "WELL_SITE",
    status: s.status as ConnectivityStatus,
    // Map schema field linkQualityPct → signal_quality used by SiteCard
    signal_quality: Number(s.linkQualityPct ?? s.signalQuality ?? 80),
    link_quality_pct: Number(s.linkQualityPct ?? s.signalQuality ?? 80),
    latency_ms: Number(s.latencyMs ?? 50),
    bandwidth_kbps: Number(s.bandwidthKbps ?? 1024),
    // Map schema field protocol (single) → protocols_active (array)
    protocols_active: s.protocolsActive ?? (s.protocol ? [s.protocol] : ["MQTT"]),
    // Map schema field lastSeenAt → last_seen_at / last_heartbeat
    last_seen_at: s.lastSeenAt ?? s.lastHeartbeat ?? new Date().toISOString(),
    last_heartbeat: s.lastSeenAt ?? s.lastHeartbeat ?? new Date().toISOString(),
    // Map schema field bufferDepth → buffer_depth
    buffer_depth: Number(s.bufferDepth ?? s.bufferFillPct ?? 0),
    buffer_fill_pct: Number(s.bufferDepth ?? s.bufferFillPct ?? 0),
    // Map schema field isSolarPowered → site_power_mode
    site_power_mode: s.isSolarPowered ? "SOLAR" : (s.sitePowerMode ?? "GRID"),
    battery_pct: Number(s.batteryPct ?? 100),
    battery_soc_pct: Number(s.batteryPct ?? 100),
    // Map schema field solarVolts → solar_voltage_v
    solar_voltage_v: s.solarVolts ?? null,
    solar_output_w: s.solarVolts ? Number(s.solarVolts) * 10 : 0,
    // Map schema field edgeAgentVersion → agent_version
    edge_agent_version: s.edgeAgentVersion ?? "1.0.0",
    agent_version: s.edgeAgentVersion ?? "1.0.0",
    data_gap_minutes: Number(s.dataGapMinutes ?? 0),
    // Extras from schema
    compressor_status: s.compressorStatus,
    well_id: s.wellId,
    well_name: s.siteName ?? s.siteId,
  }));

  const [filter, setFilter] = useState<string>("ALL");
  const onlineCount = allSites.filter(s => s.status === "ONLINE").length;
  const degradedCount = allSites.filter(s => s.status === "DEGRADED").length;
  const offlineCount = allSites.filter(s => s.status === "OFFLINE").length;
  const avgLinkQuality = allSites.length > 0 ? Math.round(allSites.reduce((acc, s) => acc + (s.signal_quality ?? 0), 0) / allSites.length) : 0;

  const filtered = filter === "ALL"
    ? allSites
    : filter === "SOLAR"
    ? allSites.filter(s => s.site_power_mode === "SOLAR" || s.site_power_mode === "BATTERY")
    : allSites.filter(s => s.status === filter);

  // Pie chart data
  const pieData = [
    { name: "Online", value: onlineCount, color: "#10b981" },
    { name: "Degraded", value: degradedCount, color: "#f59e0b" },
    { name: "Offline", value: offlineCount, color: "#ef4444" },
  ];

  // Protocol usage
  const protocolCounts: Record<string, number> = {};
  allSites.forEach(s => {
    (s.protocols_active as string[]).forEach((p: string) => {
      protocolCounts[p] = (protocolCounts[p] ?? 0) + 1;
    });
  });
  const protocolData = Object.entries(protocolCounts).map(([name, count]) => ({ name, count }));

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-[Syne] text-foreground">
            Site Connectivity
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Remote site health · Communication status · Solar & battery monitoring · Data sync
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => toast.success("Connectivity refresh triggered for all sites")}
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Refresh All
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Sites", value: allSites.length, color: "text-foreground", icon: Server },
          { label: "Online", value: onlineCount, color: "text-emerald-400", icon: Wifi },
          { label: "Degraded", value: degradedCount, color: "text-amber-400", icon: SignalLow },
          { label: "Offline", value: offlineCount, color: "text-red-400", icon: WifiOff },
        ].map(({ label, value, color, icon: Icon }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`w-5 h-5 ${color}`} />
              <div>
                <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Status pie */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-[Syne]">Fleet Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} fillOpacity={0.85} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", fontSize: "11px" }}
                />
                <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Protocol usage */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-[Syne]">Protocol Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={protocolData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#6b7280" }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: "#9ca3af" }} width={72} />
                <Tooltip
                  contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", fontSize: "11px" }}
                />
                <Bar dataKey="count" fill="#d97706" fillOpacity={0.8} radius={[0, 3, 3, 0]} name="Sites" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Solar sites summary */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-[Syne] flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-400" />
              Solar Sites
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {allSites.filter((s: any) => s.site_power_mode === "SOLAR" || s.site_power_mode === "BATTERY").map((s: any) => (
              <div key={s.well_id ?? s.wellId ?? s.id} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{s.well_name ?? s.wellId ?? s.id}</span>
                  <span className="font-mono text-amber-400">{Number(s.solar_voltage_v ?? s.solarVoltageV ?? 0).toFixed(1)}V</span>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={s.battery_soc_pct ?? s.batteryPct ?? 0} className="h-1.5 flex-1" />
                  <span className={`text-[10px] font-mono ${(s.battery_soc_pct ?? s.batteryPct ?? 100) < 30 ? "text-red-400" : "text-blue-400"}`}>
                    {Number(s.battery_soc_pct ?? s.batteryPct ?? 0).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
            <div className="text-xs text-muted-foreground pt-1 border-t border-border">
              {allSites.filter((s: any) => s.site_power_mode === "SOLAR" || s.site_power_mode === "BATTERY").length} of {allSites.length} sites on solar/battery
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Map */}
      <ConnectivityMap sites={allSites} />

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "ALL", label: "All Sites" },
          { key: "ONLINE", label: "Online" },
          { key: "DEGRADED", label: "Degraded" },
          { key: "OFFLINE", label: "Offline" },
          { key: "SOLAR", label: "Solar/Battery" },
        ].map(({ key, label }) => (
          <Button
            key={key}
            variant={filter === key ? "default" : "outline"}
            size="sm"
            className={filter === key ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
            onClick={() => setFilter(key)}
          >
            {label}
          </Button>
        ))}
        <div className="ml-auto text-xs text-muted-foreground self-center">
          Avg link quality: <span className="font-mono text-amber-400">{avgLinkQuality}%</span>
        </div>
      </div>

      {/* Site cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(site => (
          <SiteCard key={site.well_id ?? (site as any).wellId ?? (site as any).id} site={site} />
        ))}
      </div>

      {/* Protocol reference table */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-[Syne]">Equipment Communication Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">System Type</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">Primary Protocol</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">Fallback</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["PLC-Based Wellhead", "OPC_UA", "MODBUS_TCP", "Allen-Bradley, Siemens, Schneider PLCs"],
                  ["Conventional Pneumatic", "MODBUS_RTU", "MQTT", "Smart transmitters via RS-485"],
                  ["Electro-Hydraulic Wellhead", "OPC_UA", "MODBUS_TCP", "High-pressure EH systems"],
                  ["Solar Modular Wellhead", "MQTT", "MODBUS_RTU", "Low-power IoT protocol preferred"],
                  ["SCADA Outstation", "DNP3", "MODBUS_TCP", "Legacy RTU outstations"],
                  ["FPSO HPU", "MODBUS_TCP", "OPC_UA", "Hydraulic power unit controllers"],
                  ["Subsea Tree", "MODBUS_TCP", "—", "Via umbilical to topside MCS"],
                  ["Emergency Shutdown", "MODBUS_TCP", "DNP3", "ESD panel I/O modules"],
                  ["Solar Air Compressor", "MQTT", "MODBUS_RTU", "Solar-powered compressor control"],
                ].map(([sys, primary, fallback, notes]) => (
                  <tr key={sys} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-2 font-medium text-foreground">{sys}</td>
                    <td className="py-2">{protocolBadge(primary as ProtocolType)}</td>
                    <td className="py-2">{fallback !== "—" ? protocolBadge(fallback as ProtocolType) : <span className="text-muted-foreground">—</span>}</td>
                    <td className="py-2 text-muted-foreground">{notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
