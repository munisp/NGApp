/**
 * Real-time Telemetry Dashboard
 * Polls Go protocol-adapter /stats every 5 seconds and displays live IoT metrics.
 */
import { useEffect, useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity, AlertTriangle, CheckCircle, Clock, Cpu, Database,
  Radio, RefreshCw, Server, Wifi, WifiOff, Zap
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { format } from "date-fns";

interface ProtocolStats {
  points_ingested: number;
  points_flushed: number;
  buffer_depth: number;
  buffer_capacity: number;
  errors: number;
  last_flush_at: string;
  uptime_seconds: number;
  devices: Record<string, { last_seen: string; points: number; protocol: string; status: string }>;
}

interface HistoryPoint {
  ts: number;
  ingested: number;
  buffer: number;
  errors: number;
}

const PROTOCOL_COLORS: Record<string, string> = {
  MQTT: "#22d3ee",
  MODBUS: "#a78bfa",
  OPCUA: "#34d399",
  HART: "#fb923c",
  DNP3: "#f472b6",
  LORAWAN: "#facc15",
};

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export default function TelemetryDashboard() {
  const [stats, setStats] = useState<ProtocolStats | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // DB telemetry via tRPC
  const { data: wellsRaw } = trpc.wells.list.useQuery();
  const wellsData: any[] = Array.isArray(wellsRaw) ? wellsRaw : (wellsRaw as any)?.wells ?? [];
  const { data: alarmsResp } = trpc.alarms.list.useQuery({ limit: 10, state: 'UNACKNOWLEDGED' });
  const alarmsData = alarmsResp ?? [];
  const [selectedWellId, setSelectedWellId] = useState<string | null>(null);
  const { data: wellTelemetry } = trpc.telemetry.latest.useQuery(
    { wellId: selectedWellId! },
    { enabled: !!selectedWellId, refetchInterval: isPolling ? 5000 : false }
  );
  const { data: wellHistory = [] } = trpc.telemetry.history.useQuery(
    { wellId: selectedWellId!, hours: 6 },
    { enabled: !!selectedWellId, refetchInterval: isPolling ? 30000 : false }
  );

  const fetchStats = async () => {
    try {
      const res = await fetch("http://localhost:8090/stats", { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ProtocolStats = await res.json();
      setStats(data);
      setError(null);
      setLastUpdated(new Date());
      setHistory(prev => {
        const point: HistoryPoint = {
          ts: Date.now(),
          ingested: data.points_ingested,
          buffer: data.buffer_depth,
          errors: data.errors,
        };
        const next = [...prev, point];
        return next.slice(-60); // keep 5 min at 5s intervals
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Protocol adapter unreachable");
    }
  };

  useEffect(() => {
    fetchStats();
    if (isPolling) {
      intervalRef.current = setInterval(fetchStats, 5000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPolling]);

  const togglePolling = () => {
    setIsPolling(p => !p);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const bufferPct = stats ? Math.round((stats.buffer_depth / Math.max(stats.buffer_capacity, 1)) * 100) : 0;
  const devices = stats ? Object.entries(stats.devices) : [];
  const onlineDevices = devices.filter(([, d]) => d.status === "online").length;

  const protocolBreakdown = devices.reduce<Record<string, number>>((acc, [, d]) => {
    acc[d.protocol] = (acc[d.protocol] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Radio className="h-6 w-6 text-cyan-400" />
            Real-time Telemetry Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live IoT protocol adapter metrics — Go bridge (MQTT / Modbus / OPC-UA)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(lastUpdated, "HH:mm:ss")}
            </span>
          )}
          <Badge variant={isPolling ? "default" : "secondary"} className="gap-1">
            {isPolling ? <Activity className="h-3 w-3 animate-pulse" /> : <RefreshCw className="h-3 w-3" />}
            {isPolling ? "LIVE" : "PAUSED"}
          </Badge>
          <Button size="sm" variant="outline" onClick={togglePolling}>
            {isPolling ? "Pause" : "Resume"}
          </Button>
          <Button size="sm" variant="outline" onClick={fetchStats}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Protocol adapter offline: {error}. Showing last known data.
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Points Ingested</p>
                <p className="text-2xl font-bold text-cyan-400">
                  {stats ? stats.points_ingested.toLocaleString() : "—"}
                </p>
              </div>
              <Database className="h-8 w-8 text-cyan-400/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Buffer Depth</p>
                <p className="text-2xl font-bold text-purple-400">
                  {stats ? `${stats.buffer_depth}/${stats.buffer_capacity}` : "—"}
                </p>
                {stats && <Progress value={bufferPct} className="mt-1 h-1" />}
              </div>
              <Cpu className="h-8 w-8 text-purple-400/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Devices Online</p>
                <p className="text-2xl font-bold text-green-400">
                  {stats ? `${onlineDevices}/${devices.length}` : "—"}
                </p>
              </div>
              {onlineDevices === devices.length && devices.length > 0
                ? <Wifi className="h-8 w-8 text-green-400/30" />
                : <WifiOff className="h-8 w-8 text-red-400/30" />}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Adapter Uptime</p>
                <p className="text-2xl font-bold text-amber-400">
                  {stats ? formatUptime(stats.uptime_seconds) : "—"}
                </p>
              </div>
              <Server className="h-8 w-8 text-amber-400/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="timeseries">
        <TabsList>
          <TabsTrigger value="timeseries">Time Series</TabsTrigger>
          <TabsTrigger value="welltelemetry">Per-Well Telemetry</TabsTrigger>
          <TabsTrigger value="devices">Device Registry</TabsTrigger>
          <TabsTrigger value="protocols">Protocol Breakdown</TabsTrigger>
          <TabsTrigger value="alarms">Active Alarms</TabsTrigger>
        </TabsList>

        {/* Time Series Chart */}
        <TabsContent value="timeseries">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Ingestion Rate (5-second intervals)</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length < 2 ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                  Collecting data… (need at least 2 data points)
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="ingestedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="bufferGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="ts"
                      tickFormatter={v => format(new Date(v), "HH:mm:ss")}
                      stroke="#64748b"
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                    <Tooltip
                      labelFormatter={v => format(new Date(v as number), "HH:mm:ss")}
                      contentStyle={{ background: "#1e293b", border: "1px solid #334155" }}
                    />
                    <Area type="monotone" dataKey="ingested" stroke="#22d3ee" fill="url(#ingestedGrad)" name="Points Ingested" />
                    <Area type="monotone" dataKey="buffer" stroke="#a78bfa" fill="url(#bufferGrad)" name="Buffer Depth" />
                    <Line type="monotone" dataKey="errors" stroke="#f87171" dot={false} name="Errors" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Per-Well Telemetry */}
        <TabsContent value="welltelemetry">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <CardHeader><CardTitle className="text-sm font-medium">Select Well</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {(wellsData as any[]).map((w: any) => (
                    <button key={w.wellId}
                      onClick={() => setSelectedWellId(w.wellId)}
                      className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                        selectedWellId === w.wellId ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" : "hover:bg-muted/50 text-muted-foreground"
                      }`}>
                      <div className="font-medium text-foreground">{w.name}</div>
                      <div className="text-xs">{w.field} · {w.status}</div>
                    </button>
                  ))}
                  {(wellsData as any[]).length === 0 && <p className="text-sm text-muted-foreground">No wells found. Seed demo data first.</p>}
                </div>
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {selectedWellId ? `Live Readings — ${(wellsData as any[]).find((w: any) => w.wellId === selectedWellId)?.name ?? selectedWellId}` : "Select a well to view telemetry"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedWellId ? (
                  <div className="text-center py-12 text-muted-foreground text-sm"><Radio className="h-8 w-8 mx-auto mb-2 opacity-30" />Select a well from the list</div>
                ) : !wellTelemetry ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">No telemetry readings yet for this well.</div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        { label: "Tubing Pressure", value: wellTelemetry.tubingPressure, unit: "psi", color: "text-cyan-400" },
                        { label: "Casing Pressure", value: wellTelemetry.casingPressure, unit: "psi", color: "text-blue-400" },
                        { label: "Flow Rate",        value: wellTelemetry.flowRate,        unit: "bbl/d", color: "text-green-400" },
                        { label: "Water Cut",        value: wellTelemetry.waterCut,        unit: "%",     color: "text-amber-400" },
                        { label: "GOR",              value: wellTelemetry.gasOilRatio,     unit: "scf/bbl", color: "text-purple-400" },
                        { label: "ESP Motor Temp",   value: wellTelemetry.espMotorTemp,    unit: "°C",    color: "text-red-400" },
                      ].map(({ label, value, unit, color }) => (
                        <div key={label} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className={`text-xl font-bold font-mono ${color}`}>{value != null ? `${parseFloat(String(value)).toFixed(1)} ${unit}` : "—"}</p>
                        </div>
                      ))}
                    </div>
                    {wellHistory.length >= 2 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Tubing Pressure — Last 6h</p>
                        <ResponsiveContainer width="100%" height={160}>
                          <AreaChart data={[...wellHistory].reverse()}>
                            <defs>
                              <linearGradient id="tubingGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="recordedAt" tickFormatter={v => format(new Date(v), "HH:mm")} tick={{ fontSize: 9 }} stroke="#64748b" />
                            <YAxis tick={{ fontSize: 9 }} stroke="#64748b" />
                            <Tooltip labelFormatter={v => format(new Date(v), "HH:mm:ss")} contentStyle={{ background: "#1e293b", border: "1px solid #334155", fontSize: "10px" }} />
                            <Area type="monotone" dataKey="tubingPressure" stroke="#22d3ee" fill="url(#tubingGrad)" name="Tubing Pressure (psi)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">Last reading: {format(new Date(wellTelemetry.recordedAt), "PPpp")} · Protocol: {wellTelemetry.protocol} · Quality: {wellTelemetry.quality}%</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Device Registry */}
        <TabsContent value="devices">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Connected Devices ({devices.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {devices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No devices registered. Start the protocol adapter to see live devices.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-2 pr-4">Device ID</th>
                        <th className="text-left py-2 pr-4">Protocol</th>
                        <th className="text-left py-2 pr-4">Status</th>
                        <th className="text-right py-2 pr-4">Points</th>
                        <th className="text-right py-2">Last Seen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {devices.map(([id, d]) => (
                        <tr key={id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 pr-4 font-mono text-xs">{id}</td>
                          <td className="py-2 pr-4">
                            <Badge
                              variant="outline"
                              style={{ color: PROTOCOL_COLORS[d.protocol] ?? "#94a3b8", borderColor: PROTOCOL_COLORS[d.protocol] ?? "#94a3b8" }}
                            >
                              {d.protocol}
                            </Badge>
                          </td>
                          <td className="py-2 pr-4">
                            {d.status === "online"
                              ? <span className="flex items-center gap-1 text-green-400"><CheckCircle className="h-3 w-3" />Online</span>
                              : <span className="flex items-center gap-1 text-red-400"><WifiOff className="h-3 w-3" />Offline</span>}
                          </td>
                          <td className="py-2 pr-4 text-right font-mono">{d.points.toLocaleString()}</td>
                          <td className="py-2 text-right text-muted-foreground text-xs">
                            {d.last_seen ? format(new Date(d.last_seen), "HH:mm:ss") : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Protocol Breakdown */}
        <TabsContent value="protocols">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Protocol Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(protocolBreakdown).map(([proto, count]) => (
                    <div key={proto} className="flex items-center gap-3">
                      <span className="w-20 text-xs font-mono" style={{ color: PROTOCOL_COLORS[proto] ?? "#94a3b8" }}>
                        {proto}
                      </span>
                      <div className="flex-1">
                        <Progress
                          value={Math.round((count / Math.max(devices.length, 1)) * 100)}
                          className="h-2"
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                    </div>
                  ))}
                  {Object.keys(protocolBreakdown).length === 0 && (
                    <p className="text-sm text-muted-foreground">No protocol data available.</p>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Adapter Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  {[
                    { label: "Points Ingested", value: stats?.points_ingested.toLocaleString() ?? "—", icon: <Database className="h-4 w-4 text-cyan-400" /> },
                    { label: "Points Flushed", value: stats?.points_flushed.toLocaleString() ?? "—", icon: <Zap className="h-4 w-4 text-green-400" /> },
                    { label: "Buffer Fill", value: `${bufferPct}%`, icon: <Cpu className="h-4 w-4 text-purple-400" /> },
                    { label: "Error Count", value: stats?.errors.toString() ?? "—", icon: <AlertTriangle className="h-4 w-4 text-red-400" /> },
                    { label: "Last Flush", value: stats?.last_flush_at ? format(new Date(stats.last_flush_at), "HH:mm:ss") : "—", icon: <Clock className="h-4 w-4 text-amber-400" /> },
                    { label: "Uptime", value: stats ? formatUptime(stats.uptime_seconds) : "—", icon: <Server className="h-4 w-4 text-blue-400" /> },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between py-1 border-b border-border/50">
                      <span className="flex items-center gap-2 text-muted-foreground">{row.icon}{row.label}</span>
                      <span className="font-mono font-medium">{row.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Active Alarms */}
        <TabsContent value="alarms">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Active Alarms (last 10)</CardTitle>
            </CardHeader>
            <CardContent>
              {!alarmsData || alarmsData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-400" />
                  No active alarms
                </div>
              ) : (
                <div className="space-y-2">
                  {alarmsData.map((alarm: any) => (
                    <div key={alarm.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className={`h-4 w-4 ${alarm.severity === "CRITICAL" ? "text-red-400" : alarm.severity === "HIGH" ? "text-orange-400" : "text-yellow-400"}`} />
                        <div>
                          <p className="text-sm font-medium">{alarm.message ?? alarm.description ?? "Alarm"}</p>
                          <p className="text-xs text-muted-foreground">{alarm.wellId ?? alarm.well_id ?? "—"}</p>
                        </div>
                      </div>
                      <Badge variant={alarm.severity === "CRITICAL" ? "destructive" : "secondary"}>
                        {alarm.severity ?? "UNKNOWN"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Well Telemetry Summary */}
      {wellsData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Well Telemetry Summary ({wellsData.length} wells)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {wellsData.slice(0, 8).map((well: any) => (
                <div key={well.id ?? well.wellId} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <p className="text-xs font-medium text-foreground truncate">{well.name}</p>
                  <p className="text-xs text-muted-foreground">{well.status ?? "UNKNOWN"}</p>
                  <p className="text-sm font-bold text-cyan-400 mt-1">
                    {well.currentRateBpd != null ? `${well.currentRateBpd} bbl/d` : "—"}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
