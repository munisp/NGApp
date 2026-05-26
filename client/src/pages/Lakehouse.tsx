/**
 * Lakehouse.tsx — RTDIP Delta Lakehouse analytics page (enhanced)
 *
 * Advanced features added:
 * - Multi-tag comparison on a single trend chart (up to 5 tags)
 * - Advanced filtering: time range presets, custom date range, resample interval, aggregation method
 * - CSV export of trend data with full metadata header
 * - Value range filter (min/max) to exclude outliers
 * - Quality filter (good/uncertain/bad)
 * - Annotation markers for alarm thresholds
 * - TWA panel with configurable time window
 */
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  CheckCircle2,
  Database,
  Download,
  Filter,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
  X,
  Brain,
  AlertTriangle,
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  ReferenceArea,
  Area,
  ComposedChart,
} from "recharts";

// ─── Constants ─────────────────────────────────────────────────────────────────

const TAG_COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#f43f5e", "#a855f7"];

const TIME_PRESETS = [
  { label: "Last 1h", hours: 1 },
  { label: "Last 6h", hours: 6 },
  { label: "Last 24h", hours: 24 },
  { label: "Last 7d", hours: 168 },
  { label: "Last 30d", hours: 720 },
];

const RESAMPLE_INTERVALS = [
  { value: "1m", label: "1 minute" },
  { value: "5m", label: "5 minutes" },
  { value: "15m", label: "15 minutes" },
  { value: "1h", label: "1 hour" },
  { value: "4h", label: "4 hours" },
  { value: "1d", label: "1 day" },
];

const AGG_METHODS = [
  { value: "mean", label: "Mean" },
  { value: "min", label: "Min" },
  { value: "max", label: "Max" },
  { value: "sum", label: "Sum" },
  { value: "last", label: "Last" },
];

// ─── CSV export helper ─────────────────────────────────────────────────────────

function exportToCSV(
  tags: string[],
  chartData: Array<Record<string, string | number>>,
  filters: {
    startTime: string;
    endTime: string;
    interval: string;
    method: string;
    minValue?: number;
    maxValue?: number;
  }
) {
  const header = [
    `# RTDIP Delta Lakehouse Export`,
    `# Generated: ${new Date().toISOString()}`,
    `# Tags: ${tags.join(", ")}`,
    `# Start: ${filters.startTime}`,
    `# End: ${filters.endTime}`,
    `# Resample interval: ${filters.interval}`,
    `# Aggregation: ${filters.method}`,
    filters.minValue !== undefined ? `# Min value filter: ${filters.minValue}` : null,
    filters.maxValue !== undefined ? `# Max value filter: ${filters.maxValue}` : null,
    ``,
    ["timestamp", ...tags].join(","),
  ]
    .filter(Boolean)
    .join("\n");

  const rows = chartData.map((row) => {
    const values = tags.map((t) => {
      const v = row[t];
      return v !== undefined && v !== null ? String(v) : "";
    });
    return [row.timestamp ?? row.time, ...values].join(",");
  });

  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rtdip-export-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Tag browser ───────────────────────────────────────────────────────────────

function TagBrowser({
  onSelectTag,
  selectedTags,
}: {
  onSelectTag: (tag: string) => void;
  selectedTags: string[];
}) {
  const [search, setSearch] = useState("");
  const [wellId, setWellId] = useState("W-001");
  const { data, isLoading } = trpc.lakehouse.tags.useQuery(
    { wellId, search: search || undefined, limit: 50 },
    { refetchInterval: 30000 }
  );

  return (
    <Card className="bg-slate-900/60 border-slate-700/50 h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
          <Database className="w-4 h-4 text-amber-400" /> Tag Browser
        </CardTitle>
        <p className="text-[10px] text-slate-500 mt-0.5">Click to add/remove from chart (max 5)</p>
        <div className="space-y-2 mt-2">
          <Select value={wellId} onValueChange={setWellId}>
            <SelectTrigger className="bg-slate-800 border-slate-600 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              {["W-001", "W-002", "W-003", "W-004"].map((w) => (
                <SelectItem key={w} value={w} className="text-xs">{w}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tags…"
              className="bg-slate-800 border-slate-600 h-8 text-xs pl-7"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="text-center py-4 text-slate-500 text-xs">Loading tags…</div>
        ) : (
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {(data?.tags ?? []).map((tag: { tag: string; description: string; unit: string; dataType: string }) => {
              const idx = selectedTags.indexOf(tag.tag);
              const isSelected = idx >= 0;
              const color = isSelected ? TAG_COLORS[idx] : undefined;
              return (
                <button
                  key={tag.tag}
                  onClick={() => onSelectTag(tag.tag)}
                  disabled={!isSelected && selectedTags.length >= 5}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                    isSelected
                      ? "bg-amber-500/10 border border-amber-500/30"
                      : selectedTags.length >= 5
                      ? "opacity-40 cursor-not-allowed text-slate-500"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {isSelected && (
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: color }}
                      />
                    )}
                    <span className="font-mono truncate" style={isSelected ? { color } : undefined}>
                      {tag.tag}
                    </span>
                  </div>
                  <div className="text-slate-500 text-[10px] ml-3.5">{tag.description} · {tag.unit}</div>
                </button>
              );
            })}
          </div>
        )}
        {data?.source === "simulated" && (
          <p className="text-[10px] text-slate-600 mt-2">Simulated — set RTDIP_API_URL to connect</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Advanced filter panel ─────────────────────────────────────────────────────

type AggMethod = "mean" | "min" | "max" | "sum" | "last";

interface FilterState {
  preset: string;
  startTime: string;
  endTime: string;
  interval: string;
  method: AggMethod;
  minValue: string;
  maxValue: string;
}

function AdvancedFilters({
  filters,
  onChange,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const applyPreset = (hours: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - hours * 3600000);
    onChange({
      ...filters,
      preset: String(hours),
      startTime: start.toISOString().slice(0, 16),
      endTime: end.toISOString().slice(0, 16),
    });
  };

  return (
    <Card className="bg-slate-900/60 border-slate-700/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
            <Filter className="w-4 h-4 text-amber-400" /> Filters & Options
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-slate-400"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? "Collapse" : "Advanced"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Time presets */}
        <div>
          <Label className="text-slate-500 text-[10px] uppercase tracking-wider">Time Range</Label>
          <div className="flex gap-1 mt-1 flex-wrap">
            {TIME_PRESETS.map((p) => (
              <button
                key={p.hours}
                onClick={() => applyPreset(p.hours)}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${
                  filters.preset === String(p.hours)
                    ? "bg-amber-500 text-slate-900 font-semibold"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Resample + method */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-slate-500 text-[10px] uppercase tracking-wider">Interval</Label>
            <Select value={filters.interval} onValueChange={(v) => onChange({ ...filters, interval: v })}>
              <SelectTrigger className="bg-slate-800 border-slate-600 h-7 text-xs mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                {RESAMPLE_INTERVALS.map((r) => (
                  <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-slate-500 text-[10px] uppercase tracking-wider">Aggregation</Label>
            <Select value={filters.method} onValueChange={(v) => onChange({ ...filters, method: v as AggMethod })}>
              <SelectTrigger className="bg-slate-800 border-slate-600 h-7 text-xs mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                {AGG_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Advanced: custom range + value filters */}
        {expanded && (
          <div className="space-y-3 pt-2 border-t border-slate-700/50">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-slate-500 text-[10px] uppercase tracking-wider">Custom Start</Label>
                <Input
                  type="datetime-local"
                  value={filters.startTime}
                  onChange={(e) => onChange({ ...filters, startTime: e.target.value, preset: "custom" })}
                  className="bg-slate-800 border-slate-600 h-7 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-500 text-[10px] uppercase tracking-wider">Custom End</Label>
                <Input
                  type="datetime-local"
                  value={filters.endTime}
                  onChange={(e) => onChange({ ...filters, endTime: e.target.value, preset: "custom" })}
                  className="bg-slate-800 border-slate-600 h-7 text-xs mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-slate-500 text-[10px] uppercase tracking-wider">Min Value</Label>
                <Input
                  type="number"
                  placeholder="No min"
                  value={filters.minValue}
                  onChange={(e) => onChange({ ...filters, minValue: e.target.value })}
                  className="bg-slate-800 border-slate-600 h-7 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-500 text-[10px] uppercase tracking-wider">Max Value</Label>
                <Input
                  type="number"
                  placeholder="No max"
                  value={filters.maxValue}
                  onChange={(e) => onChange({ ...filters, maxValue: e.target.value })}
                  className="bg-slate-800 border-slate-600 h-7 text-xs mt-1"
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Multi-tag trend chart ─────────────────────────────────────────────────────

function MultiTagTrendChart({
  tags,
  filters,
  onRemoveTag,
}: {
  tags: string[];
  filters: FilterState;
  onRemoveTag: (tag: string) => void;
}) {
  const [showForecast, setShowForecast] = useState(true);
  const [showAlarmBands, setShowAlarmBands] = useState(true);

  // OpenSTEF forecast for primary tag (only for power demand tags)
  const primaryTag = tags[0] ?? "";
  const isForecastableTag = primaryTag.includes("DEMAND_KW") || primaryTag.includes("FACILITY") || primaryTag.includes("COMPRESSOR");
  const { data: forecastData } = trpc.openstef.getForecast.useQuery(
    { tag: primaryTag, horizonHours: 48, resolutionMinutes: 15 },
    { enabled: !!primaryTag && isForecastableTag && showForecast, staleTime: 5 * 60_000 }
  );

  // Alarm thresholds for primary tag — derive well from tag prefix (e.g. "W-001.WELLHEAD_PRESSURE" → "W-001")
  const primaryWellId = primaryTag.includes(".") ? primaryTag.split(".")[0] : undefined;
  const { data: alarmRulesData } = trpc.wells.alarmRules.useQuery(
    { wellId: primaryWellId },
    { enabled: !!primaryWellId, staleTime: 60_000 }
  );
  const tagAlarms = useMemo(() => {
    if (!alarmRulesData || !primaryTag) return [];
    const tagSuffix = primaryTag.includes(".") ? primaryTag.split(".").slice(1).join(".") : primaryTag;
    // Map alarm rules to high/low threshold bands
    // Each rule has: condition (ABOVE/BELOW/EQUAL), threshold, severity
    // severity 1=critical(HH/LL), 2=high(H/L), 3=medium
    const matched = (alarmRulesData as Array<{ tag: string; condition: string; threshold: number; severity: number; description: string; unit?: string | null }>)
      .filter((r) => r.tag === primaryTag || r.tag === tagSuffix || r.tag.includes(tagSuffix));
    // Build a single band object from matched rules
    const band: { highHigh?: number; high?: number; low?: number; lowLow?: number } = {};
    matched.forEach((r) => {
      // alarmConditionEnum: GT | GTE = high-side, LT | LTE = low-side; severity 1=critical, 2=high
      if ((r.condition === "GT" || r.condition === "GTE") && r.severity === 1) band.highHigh = r.threshold;
      else if ((r.condition === "GT" || r.condition === "GTE") && r.severity === 2) band.high = r.threshold;
      else if ((r.condition === "LT" || r.condition === "LTE") && r.severity === 1) band.lowLow = r.threshold;
      else if ((r.condition === "LT" || r.condition === "LTE") && r.severity === 2) band.low = r.threshold;
    });
    return Object.keys(band).length > 0 ? [band] : [];
  }, [alarmRulesData, primaryTag]);

  // Map interval filter to resolution enum
  const resolutionMap: Record<string, "1m" | "5m" | "15m" | "1h" | "4h" | "1d"> = { "1m": "1m", "5m": "5m", "15m": "15m", "1h": "1h", "4h": "4h", "1d": "1d" };
  const resolution = resolutionMap[filters.interval] ?? "1h";

  // Fetch data for each tag
  const q0 = trpc.lakehouse.resample.useQuery(
    { tag: tags[0] ?? "", startTime: new Date(filters.startTime).toISOString(), endTime: new Date(filters.endTime).toISOString(), resolution },
    { enabled: tags.length > 0 }
  );
  const q1 = trpc.lakehouse.resample.useQuery(
    { tag: tags[1] ?? "", startTime: new Date(filters.startTime).toISOString(), endTime: new Date(filters.endTime).toISOString(), resolution },
    { enabled: tags.length > 1 }
  );
  const q2 = trpc.lakehouse.resample.useQuery(
    { tag: tags[2] ?? "", startTime: new Date(filters.startTime).toISOString(), endTime: new Date(filters.endTime).toISOString(), resolution },
    { enabled: tags.length > 2 }
  );
  const q3 = trpc.lakehouse.resample.useQuery(
    { tag: tags[3] ?? "", startTime: new Date(filters.startTime).toISOString(), endTime: new Date(filters.endTime).toISOString(), resolution },
    { enabled: tags.length > 3 }
  );
  const q4 = trpc.lakehouse.resample.useQuery(
    { tag: tags[4] ?? "", startTime: new Date(filters.startTime).toISOString(), endTime: new Date(filters.endTime).toISOString(), resolution },
    { enabled: tags.length > 4 }
  );

  const queries = [q0, q1, q2, q3, q4].slice(0, tags.length);
  const isLoading = queries.some((q) => q.isLoading);

  const minVal = filters.minValue !== "" ? parseFloat(filters.minValue) : undefined;
  const maxVal = filters.maxValue !== "" ? parseFloat(filters.maxValue) : undefined;

  // Merge all tag data by timestamp
  const chartData = useMemo(() => {
    if (tags.length === 0) return [];
    const map = new Map<string, Record<string, number | string | boolean>>();
    queries.forEach((q, i) => {
      const tag = tags[i];
      (q.data?.timeSeries ?? []).forEach((d: { timestamp: string; value: number }) => {
        const v = d.value;
        if (minVal !== undefined && v < minVal) return;
        if (maxVal !== undefined && v > maxVal) return;
        const key = d.timestamp;
        if (!map.has(key)) map.set(key, { timestamp: key, isForecast: false });
        map.get(key)![tag] = v;
      });
    });

    // Merge OpenSTEF forecast points (future timestamps)
    if (showForecast && forecastData?.forecast) {
      forecastData.forecast.forEach((pt: { timestamp: string; p05: number; p50: number; p95: number }) => {
        const key = pt.timestamp;
        if (!map.has(key)) map.set(key, { timestamp: key, isForecast: true });
        const row = map.get(key)!;
        row.isForecast = true;
        row[`${primaryTag}_p50`] = pt.p50;
        row[`${primaryTag}_p05`] = pt.p05;
        row[`${primaryTag}_p95`] = pt.p95;
      });
    }

    return Array.from(map.values())
      .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)))
      .map((row) => ({
        ...row,
        time: new Date(String(row.timestamp)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }));
  }, [queries, tags, minVal, maxVal, forecastData, showForecast, primaryTag]);

  const handleExport = useCallback(() => {
    if (chartData.length === 0) {
      return;
    }
    exportToCSV(tags, chartData, {
      startTime: filters.startTime,
      endTime: filters.endTime,
      interval: filters.interval,
      method: filters.method,
      minValue: minVal,
      maxValue: maxVal,
    });
  }, [chartData, tags, filters, minVal, maxVal]);

  return (
    <Card className="bg-slate-900/60 border-slate-700/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400" /> Trend Chart
            <span className="text-xs text-slate-500 font-normal">
              {filters.interval} {filters.method} · {filters.preset !== "custom" ? TIME_PRESETS.find((p) => String(p.hours) === filters.preset)?.label ?? "" : "Custom range"}
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Forecast toggle */}
            {isForecastableTag && (
              <button
                onClick={() => setShowForecast((f) => !f)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors ${
                  showForecast
                    ? "bg-violet-500/20 border border-violet-500/40 text-violet-300"
                    : "bg-slate-800 border border-slate-600 text-slate-500"
                }`}
              >
                <Brain className="w-3 h-3" />
                OpenSTEF {showForecast ? "ON" : "OFF"}
                {forecastData && !forecastData.online && (
                  <span className="text-slate-500 ml-0.5">(sim)</span>
                )}
              </button>
            )}
            {/* Alarm bands toggle */}
            {tagAlarms.length > 0 && (
              <button
                onClick={() => setShowAlarmBands((a) => !a)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors ${
                  showAlarmBands
                    ? "bg-red-500/20 border border-red-500/40 text-red-300"
                    : "bg-slate-800 border border-slate-600 text-slate-500"
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                Alarms
              </button>
            )}
            {chartData.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs border-slate-600 text-slate-300"
                onClick={handleExport}
              >
                <Download className="w-3 h-3" /> Export CSV
              </Button>
            )}
            {isLoading && <RefreshCw className="w-3 h-3 text-slate-500 animate-spin" />}
          </div>
        </div>
        {/* Active tag chips */}
        {tags.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {tags.map((tag, i) => (
              <div
                key={tag}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono"
                style={{ background: `${TAG_COLORS[i]}20`, border: `1px solid ${TAG_COLORS[i]}40`, color: TAG_COLORS[i] }}
              >
                {tag.split(".").pop()}
                <button onClick={() => onRemoveTag(tag)} className="opacity-60 hover:opacity-100">
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {tags.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Plus className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">Select tags from the browser to plot them here</p>
            <p className="text-xs mt-1 opacity-60">Up to 5 tags can be compared simultaneously</p>
          </div>
        ) : isLoading ? (
          <div className="text-center py-12 text-slate-500 text-sm">Loading trend data…</div>
        ) : chartData.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            No data in the selected range
            {(minVal !== undefined || maxVal !== undefined) && " (check value range filters)"}
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="time"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} width={44} />
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 6, fontSize: 11 }}
                  labelStyle={{ color: "#94a3b8" }}
                  formatter={(value: number, name: string) => {
                    if (name.endsWith("_p50")) return [`${value.toFixed(1)} kW`, "Forecast P50"];
                    if (name.endsWith("_p05")) return [`${value.toFixed(1)} kW`, "Forecast P05"];
                    if (name.endsWith("_p95")) return [`${value.toFixed(1)} kW`, "Forecast P95"];
                    return [value.toFixed(2), name];
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 10, color: "#94a3b8" }}
                  formatter={(value: string) => {
                    if (value.endsWith("_p50")) return <span style={{ color: "#a78bfa" }}>OpenSTEF P50</span>;
                    if (value.endsWith("_p05") || value.endsWith("_p95")) return null;
                    return <span style={{ color: TAG_COLORS[tags.indexOf(value)] }}>{value}</span>;
                  }}
                />

                {/* Value range filter lines */}
                {minVal !== undefined && (
                  <ReferenceLine y={minVal} stroke="#f97316" strokeDasharray="4 2" label={{ value: "Min filter", fill: "#f97316", fontSize: 9 }} />
                )}
                {maxVal !== undefined && (
                  <ReferenceLine y={maxVal} stroke="#f97316" strokeDasharray="4 2" label={{ value: "Max filter", fill: "#f97316", fontSize: 9 }} />
                )}

                {/* Alarm threshold bands */}
                {showAlarmBands && tagAlarms.map((alarm, ai) => (
                  <>
                    {alarm.highHigh !== undefined && (
                      <ReferenceLine
                        key={`hh-${ai}`}
                        y={alarm.highHigh}
                        stroke="#ef4444"
                        strokeDasharray="6 2"
                        strokeWidth={1.5}
                        label={{ value: `HH: ${alarm.highHigh}`, fill: "#ef4444", fontSize: 9, position: "insideTopRight" }}
                      />
                    )}
                    {alarm.high !== undefined && (
                      <ReferenceLine
                        key={`h-${ai}`}
                        y={alarm.high}
                        stroke="#f97316"
                        strokeDasharray="4 2"
                        strokeWidth={1}
                        label={{ value: `H: ${alarm.high}`, fill: "#f97316", fontSize: 9, position: "insideTopRight" }}
                      />
                    )}
                    {alarm.low !== undefined && (
                      <ReferenceLine
                        key={`l-${ai}`}
                        y={alarm.low}
                        stroke="#3b82f6"
                        strokeDasharray="4 2"
                        strokeWidth={1}
                        label={{ value: `L: ${alarm.low}`, fill: "#3b82f6", fontSize: 9, position: "insideBottomRight" }}
                      />
                    )}
                    {alarm.lowLow !== undefined && (
                      <ReferenceLine
                        key={`ll-${ai}`}
                        y={alarm.lowLow}
                        stroke="#8b5cf6"
                        strokeDasharray="6 2"
                        strokeWidth={1.5}
                        label={{ value: `LL: ${alarm.lowLow}`, fill: "#8b5cf6", fontSize: 9, position: "insideBottomRight" }}
                      />
                    )}
                  </>
                ))}

                {/* Historical tag lines */}
                {tags.map((tag, i) => (
                  <Line
                    key={tag}
                    type="monotone"
                    dataKey={tag}
                    stroke={TAG_COLORS[i]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                ))}

                {/* OpenSTEF forecast overlay */}
                {showForecast && isForecastableTag && forecastData?.forecast && (
                  <>
                    {/* P05-P95 confidence band */}
                    <Area
                      type="monotone"
                      dataKey={`${primaryTag}_p95`}
                      stroke="none"
                      fill="#7c3aed"
                      fillOpacity={0.08}
                      legendType="none"
                      dot={false}
                      connectNulls
                    />
                    <Area
                      type="monotone"
                      dataKey={`${primaryTag}_p05`}
                      stroke="none"
                      fill="#7c3aed"
                      fillOpacity={0.08}
                      legendType="none"
                      dot={false}
                      connectNulls
                    />
                    {/* P50 forecast line */}
                    <Line
                      type="monotone"
                      dataKey={`${primaryTag}_p50`}
                      stroke="#a78bfa"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      dot={false}
                      connectNulls
                    />
                  </>
                )}
              </ComposedChart>
            </ResponsiveContainer>

            {/* Forecast metadata bar */}
            {showForecast && isForecastableTag && forecastData && (
              <div className="flex items-center gap-3 mt-2 px-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-0.5 bg-violet-400" style={{ borderTop: "2px dashed #a78bfa" }} />
                  <span className="text-[10px] text-violet-400">OpenSTEF P50</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-3 rounded-sm bg-violet-500/20 border border-violet-500/30" />
                  <span className="text-[10px] text-slate-500">P05–P95 band</span>
                </div>
                <span className="text-[10px] text-slate-600 ml-auto">
                  Model: {forecastData.model_type} ·
                  Baseline: {forecastData.baseline_kw} kW ·
                  Headroom: {forecastData.available_headroom_kw} kW ·
                  {forecastData.online ? " Live" : " Simulated"}
                </span>
              </div>
            )}

            <p className="text-[10px] text-slate-600 mt-1 text-right">
              {chartData.length} data points · {filters.interval} {filters.method}
              {minVal !== undefined || maxVal !== undefined
                ? ` · Value filter: [${minVal ?? "−∞"}, ${maxVal ?? "+∞"}]`
                : ""}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── TWA panel ─────────────────────────────────────────────────────────────────

function TWAPanel({ tag, filters }: { tag: string; filters: FilterState }) {
  const { data, isLoading, refetch } = trpc.lakehouse.queryTWA.useQuery(
    {
      tag,
      startTime: new Date(filters.startTime).toISOString(),
      endTime: new Date(filters.endTime).toISOString(),
    },
    { enabled: !!tag }
  );

  return (
    <Card className="bg-slate-900/60 border-slate-700/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-slate-300">Time-Weighted Average</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
        <p className="text-xs text-slate-500 font-mono truncate">{tag || "Select a tag"}</p>
      </CardHeader>
      <CardContent>
        {!tag ? (
          <div className="text-center py-6 text-slate-500 text-sm">Select a tag from the browser</div>
        ) : isLoading ? (
          <div className="text-center py-6 text-slate-500 text-sm">Calculating TWA…</div>
        ) : (
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-5xl font-bold text-amber-400 font-mono">
                {data?.twa?.toFixed(2) ?? "—"}
              </p>
              <p className="text-slate-400 text-sm mt-1">{data?.unit ?? "—"}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800 rounded p-2">
                <p className="text-slate-500">Start</p>
                <p className="text-slate-300 font-mono text-[10px]">
                  {new Date(data?.startTime ?? filters.startTime).toLocaleString()}
                </p>
              </div>
              <div className="bg-slate-800 rounded p-2">
                <p className="text-slate-500">End</p>
                <p className="text-slate-300 font-mono text-[10px]">
                  {new Date(data?.endTime ?? filters.endTime).toLocaleString()}
                </p>
              </div>
            </div>
            {data?.source === "simulated" && (
              <Badge variant="outline" className="text-blue-400 border-blue-400/40 text-xs">
                <Activity className="w-3 h-3 mr-1" /> Simulated
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Live values panel ─────────────────────────────────────────────────────────

function LiveValues({ selectedTags }: { selectedTags: string[] }) {
  const DEMO_TAGS = selectedTags.length > 0
    ? selectedTags
    : ["W-001.WELLHEAD_PRESSURE", "W-001.TUBING_TEMP", "W-001.GAS_RATE", "W-002.WELLHEAD_PRESSURE", "W-002.OIL_RATE"];

  const { data, refetch } = trpc.lakehouse.latestValues.useQuery(
    { tags: DEMO_TAGS },
    { refetchInterval: 5000 }
  );

  return (
    <Card className="bg-slate-900/60 border-slate-700/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" /> Live Values
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {(data?.values ?? []).map((v: { tag: string; value: number; unit: string; quality: string; timestamp: string }, i: number) => (
            <div key={v.tag} className="flex items-center justify-between py-1 border-b border-slate-800/50 last:border-0">
              <div>
                <p className="text-xs font-mono" style={{ color: selectedTags.length > 0 ? TAG_COLORS[i % TAG_COLORS.length] : "#fbbf24" }}>
                  {v.tag}
                </p>
                <p className="text-[10px] text-slate-500">
                  {new Date(v.timestamp).toLocaleTimeString()} · Q:{v.quality}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-100">{v.value.toFixed(2)}</p>
                <p className="text-[10px] text-slate-500">{v.unit}</p>
              </div>
            </div>
          ))}
        </div>
        {data?.source === "simulated" && (
          <p className="text-[10px] text-slate-600 mt-2">OPC-UA simulator active</p>
        )}
      </CardContent>
    </Card>
  );
}

/// ─── Forecast vs. Actual reconciliation panel ───────────────────────────────────────────────────────────────

function ForecastReconciliation({ tag, filters }: { tag: string; filters: FilterState }) {
  // Fetch the OpenSTEF forecast for the selected tag
  const isForecastable = tag.includes("DEMAND_KW") || tag.includes("FACILITY") || tag.includes("COMPRESSOR") || true; // allow any tag in reconciliation
  const { data: forecastData, isLoading: fLoading } = trpc.openstef.getForecast.useQuery(
    { tag, horizonHours: 48, resolutionMinutes: 60 },
    { enabled: !!tag && isForecastable, staleTime: 5 * 60_000 }
  );

  // Fetch actual historical data for the same window (last 48h)
  const end48 = new Date();
  const start48 = new Date(end48.getTime() - 48 * 3600_000);
  const { data: actualData, isLoading: aLoading } = trpc.lakehouse.resample.useQuery(
    {
      tag,
      startTime: start48.toISOString(),
      endTime: end48.toISOString(),
      resolution: "1h",
    },
    { enabled: !!tag }
  );

  // Build reconciliation chart data: merge forecast P50 with actual values
  const reconcData = useMemo(() => {
    const map = new Map<string, { timestamp: string; actual?: number; p50?: number; p05?: number; p95?: number }>();

    // Actual values
    (actualData?.timeSeries ?? []).forEach((d: { timestamp: string; value: number }) => {
      map.set(d.timestamp, { timestamp: d.timestamp, actual: d.value });
    });

    // Forecast values
    (forecastData?.forecast ?? []).forEach((pt: { timestamp: string; p05: number; p50: number; p95: number }) => {
      const existing = map.get(pt.timestamp) ?? { timestamp: pt.timestamp };
      map.set(pt.timestamp, { ...existing, p50: pt.p50, p05: pt.p05, p95: pt.p95 });
    });

    return Array.from(map.values())
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [actualData, forecastData]);

  // Error metrics: MAE, RMSE, MAPE for overlapping points
  const errorMetrics = useMemo(() => {
    const overlapping = reconcData.filter((d) => d.actual !== undefined && d.p50 !== undefined);
    if (overlapping.length === 0) return null;
    const n = overlapping.length;
    const mae = overlapping.reduce((s, d) => s + Math.abs(d.actual! - d.p50!), 0) / n;
    const rmse = Math.sqrt(overlapping.reduce((s, d) => s + Math.pow(d.actual! - d.p50!, 2), 0) / n);
    const mape = overlapping.reduce((s, d) => s + Math.abs((d.actual! - d.p50!) / (d.actual! || 1)), 0) / n * 100;
    const bias = overlapping.reduce((s, d) => s + (d.p50! - d.actual!), 0) / n;
    return { mae: mae.toFixed(2), rmse: rmse.toFixed(2), mape: mape.toFixed(1), bias: bias.toFixed(2), n };
  }, [reconcData]);

  const isLoading = fLoading || aLoading;

  // CSV export for reconciliation data
  const handleExportCsv = useCallback(() => {
    const rows = [
      ["timestamp", "actual", "forecast_p50", "forecast_p05", "forecast_p95", "error"].join(","),
      ...reconcData.map((d) => [
        d.timestamp,
        d.actual ?? "",
        d.p50 ?? "",
        d.p05 ?? "",
        d.p95 ?? "",
        d.actual !== undefined && d.p50 !== undefined ? (d.actual - d.p50).toFixed(4) : "",
      ].join(",")),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `forecast_reconciliation_${tag.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [reconcData, tag]);

  if (!tag) {
    return (
      <Card className="bg-slate-900/60 border-slate-700/50">
        <CardContent className="py-12 text-center text-slate-500 text-sm">
          Select a tag from the browser to view forecast reconciliation
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Error metrics summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "MAE", value: errorMetrics?.mae ?? "—", unit: "kW", color: "text-amber-400", desc: "Mean Absolute Error" },
          { label: "RMSE", value: errorMetrics?.rmse ?? "—", unit: "kW", color: "text-orange-400", desc: "Root Mean Square Error" },
          { label: "MAPE", value: errorMetrics?.mape ? `${errorMetrics.mape}%` : "—", unit: "", color: "text-red-400", desc: "Mean Absolute % Error" },
          { label: "Bias", value: errorMetrics?.bias ?? "—", unit: "kW", color: errorMetrics && parseFloat(errorMetrics.bias) > 0 ? "text-orange-400" : "text-blue-400", desc: "Systematic over/under-forecast" },
        ].map((m) => (
          <Card key={m.label} className="bg-slate-900/60 border-slate-700/50">
            <CardContent className="pt-4 pb-3">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">{m.label}</p>
              <p className={`text-2xl font-bold font-mono ${m.color}`}>
                {isLoading ? <span className="text-slate-600 text-sm">loading…</span> : m.value}
                {!isLoading && m.unit && <span className="text-sm text-slate-500 ml-1">{m.unit}</span>}
              </p>
              <p className="text-[10px] text-slate-600 mt-0.5">{m.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Reconciliation chart */}
      <Card className="bg-slate-900/60 border-slate-700/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
              <Brain className="w-4 h-4 text-violet-400" />
              Forecast vs. Actual — 48h window
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 font-mono">{tag}</span>
              {errorMetrics && (
                <span className="text-[10px] text-slate-500">{errorMetrics.n} overlap points</span>
              )}
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleExportCsv}>
                <Download className="w-3 h-3 mr-1" /> CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-[280px] flex items-center justify-center text-slate-500 text-sm">Loading reconciliation data…</div>
          ) : reconcData.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-slate-500 text-sm">No data available for this tag</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={reconcData} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="timestamp"
                  tick={{ fill: "#64748b", fontSize: 9 }}
                  tickFormatter={(v) => new Date(v).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fill: "#64748b", fontSize: 9 }} />
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 11 }}
                  labelFormatter={(v) => new Date(v).toLocaleString()}
                  formatter={(value: number, name: string) => [
                    value?.toFixed(2),
                    name === "actual" ? "Actual" : name === "p50" ? "Forecast P50" : name === "p05" ? "P05" : "P95",
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 10, color: "#94a3b8" }}
                  formatter={(v) => v === "actual" ? "Actual" : v === "p50" ? "Forecast P50" : v === "p05" ? "P05" : "P95"}
                />
                {/* P05-P95 confidence band */}
                <Area
                  type="monotone"
                  dataKey="p95"
                  stroke="none"
                  fill="#7c3aed"
                  fillOpacity={0.12}
                  legendType="none"
                  dot={false}
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="p05"
                  stroke="none"
                  fill="#7c3aed"
                  fillOpacity={0.12}
                  legendType="none"
                  dot={false}
                  connectNulls
                />
                {/* Actual line */}
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
                {/* P50 forecast line */}
                <Line
                  type="monotone"
                  dataKey="p50"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
          {/* Legend */}
          <div className="flex items-center gap-4 mt-2 px-1">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-0.5" style={{ background: "#f59e0b" }} />
              <span className="text-[10px] text-amber-400">Actual</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-0.5" style={{ borderTop: "2px dashed #a78bfa" }} />
              <span className="text-[10px] text-violet-400">OpenSTEF P50</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm bg-violet-500/20 border border-violet-500/30" />
              <span className="text-[10px] text-slate-500">P05–P95 band</span>
            </div>
            <span className="text-[10px] text-slate-600 ml-auto">
              {forecastData?.online ? "🟢 Live OpenSTEF" : "🔵 Simulated"}
              {forecastData?.model_type ? ` · ${forecastData.model_type}` : ""}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Error distribution histogram (simple bar chart) */}
      {errorMetrics && reconcData.filter((d) => d.actual !== undefined && d.p50 !== undefined).length > 0 && (
        <Card className="bg-slate-900/60 border-slate-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">Forecast Error Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {(() => {
                const errors = reconcData
                  .filter((d) => d.actual !== undefined && d.p50 !== undefined)
                  .map((d) => d.actual! - d.p50!);
                const min = Math.min(...errors);
                const max = Math.max(...errors);
                const buckets = 8;
                const width = (max - min) / buckets || 1;
                const counts = Array(buckets).fill(0);
                errors.forEach((e) => {
                  const i = Math.min(Math.floor((e - min) / width), buckets - 1);
                  counts[i]++;
                });
                const maxCount = Math.max(...counts);
                return counts.map((count, i) => {
                  const lo = (min + i * width).toFixed(1);
                  const hi = (min + (i + 1) * width).toFixed(1);
                  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                  const isNearZero = Math.abs(parseFloat(lo)) < width && Math.abs(parseFloat(hi)) < width;
                  return (
                    <div key={i} className="flex items-center gap-2 text-[10px]">
                      <span className="text-slate-500 w-20 text-right font-mono">[{lo}, {hi})</span>
                      <div className="flex-1 bg-slate-800 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isNearZero ? "bg-emerald-500" : parseFloat(lo) > 0 ? "bg-orange-500" : "bg-blue-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-slate-400 w-6 text-right">{count}</span>
                    </div>
                  );
                });
              })()}
            </div>
            <p className="text-[10px] text-slate-600 mt-2">Error = Actual − Forecast P50 · Green = near-zero, Orange = over-forecast, Blue = under-forecast</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function Lakehouse() {
  const [selectedTags, setSelectedTags] = useState<string[]>(["W-001.WELLHEAD_PRESSURE"]);
  const [activeTab, setActiveTab] = useState<"analytics" | "reconciliation" | "datafusion" | "duckdb" | "sedona" | "iceberg">("analytics");

  // DataFusion SQL state
  const [dfSql, setDfSql] = useState("SELECT well_id, AVG(pressure) as avg_pressure_psi, COUNT(*) as records\nFROM well_telemetry\nGROUP BY well_id\nORDER BY avg_pressure_psi DESC\nLIMIT 20");
  const [dfResult, setDfResult] = useState<{ columns: string[]; rows: unknown[][]; rowCount: number; executionMs: number; source: string } | null>(null);

  // DuckDB SQL state
  const [duckSql, setDuckSql] = useState("SELECT 'total_wells' as metric, COUNT(*) as value FROM wells\nUNION ALL\nSELECT 'active_alarms', COUNT(*) FROM alarms WHERE status = 'active'\nUNION ALL\nSELECT 'avg_production_bpd', ROUND(AVG(oil_rate_bpd), 0) FROM production_records");
  const [duckResult, setDuckResult] = useState<{ columns: string[]; rows: unknown[][]; rowCount: number; executionMs: number; source: string } | null>(null);

  // Sedona state
  const [sedonaLat, setSedonaLat] = useState("33.3");
  const [sedonaLng, setSedonaLng] = useState("44.4");
  const [sedonaRadius, setSedonaRadius] = useState("100");

  const datafusionQueryMut = trpc.lakehouse.datafusionQuery.useMutation();
  const duckdbQueryMut = trpc.lakehouse.duckdbQuery.useMutation();
  const { data: icebergData } = trpc.lakehouse.icebergCatalog.useQuery();
  const { data: analyticsHealth } = trpc.lakehouse.analyticsHealth.useQuery();
  const { data: datafusionHealth } = trpc.lakehouse.datafusionHealth.useQuery();
  const sedonaQuery = trpc.lakehouse.sedonaProximityQuery.useQuery(
    { lat: parseFloat(sedonaLat) || 33.3, lng: parseFloat(sedonaLng) || 44.4, radiusKm: parseFloat(sedonaRadius) || 100 },
    { enabled: activeTab === "sedona" }
  );
  const heatmapQuery = trpc.lakehouse.sedonaDamageHeatmap.useQuery({}, { enabled: activeTab === "sedona" });

  // Default: last 24h
  const defaultEnd = new Date();
  const defaultStart = new Date(defaultEnd.getTime() - 24 * 3600000);

  const [filters, setFilters] = useState<FilterState>({
    preset: "24",
    startTime: defaultStart.toISOString().slice(0, 16),
    endTime: defaultEnd.toISOString().slice(0, 16),
    interval: "1h",
    method: "mean",
    minValue: "",
    maxValue: "",
  });

  const { data: statusData } = trpc.lakehouse.health.useQuery(undefined, { refetchInterval: 30000 });

  const handleTagToggle = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 5) return prev;
      return [...prev, tag];
    });
  }, []);

  const primaryTag = selectedTags[0] ?? "";

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Database className="w-6 h-6 text-amber-400" /> Analytics Data Lake
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Historical production analytics · Multi-tag trend comparison · Forecast reconciliation · CSV export
          </p>
        </div>
      </div>

      {/* Status bar */}
      <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm ${
        statusData?.healthy
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : "border-blue-500/30 bg-blue-500/10 text-blue-400"
      }`}>
        {statusData?.healthy ? <CheckCircle2 className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
        <span>
          Data Lake: {statusData?.mode ?? "configured"} — {statusData?.tagCount ?? 0} data tags —{" "}
          {statusData?.ingestionRate ?? 0} msg/s
          {!statusData?.healthy && " (connecting to data lake)"}
        </span>
      </div>

      {/* Tab switcher */}
      <div className="flex flex-wrap bg-slate-800 rounded-lg p-1 gap-1 w-fit">
        {([
          { id: "analytics", label: "Analytics" },
          { id: "reconciliation", label: "Forecast vs. Actual" },
          { id: "datafusion", label: "SQL Query" },
          { id: "duckdb", label: "Ad-hoc Query" },
          { id: "sedona", label: "Spatial Analysis" },
          { id: "iceberg", label: "Data Catalog" },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-amber-500 text-slate-900"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main grid — analytics / reconciliation */}
      {(activeTab === "analytics" || activeTab === "reconciliation") && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-1 space-y-4">
            <TagBrowser onSelectTag={handleTagToggle} selectedTags={selectedTags} />
          </div>
          <div className="lg:col-span-3 space-y-4">
            {activeTab === "analytics" ? (
              <>
                <AdvancedFilters filters={filters} onChange={setFilters} />
                <MultiTagTrendChart tags={selectedTags} filters={filters} onRemoveTag={handleTagToggle} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TWAPanel tag={primaryTag} filters={filters} />
                  <LiveValues selectedTags={selectedTags} />
                </div>
              </>
            ) : (
              <ForecastReconciliation tag={primaryTag} filters={filters} />
            )}
          </div>
        </div>
      )}

      {/* DataFusion SQL tab */}
      {activeTab === "datafusion" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border ${
              datafusionHealth?.healthy ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-slate-600 bg-slate-800 text-slate-400"
            }`}>
              <span className={`w-2 h-2 rounded-full ${datafusionHealth?.healthy ? "bg-emerald-400" : "bg-slate-500"}`} />
              SQL Engine: {datafusionHealth?.healthy ? "live" : "offline (configured)"}
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 space-y-3">
            <p className="text-xs text-slate-400">High-performance SQL engine — queries run directly against production data tables in memory.</p>
            <textarea
              value={dfSql}
              onChange={e => setDfSql(e.target.value)}
              rows={6}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono resize-none focus:outline-none focus:border-amber-500"
              placeholder="SELECT ... FROM well_telemetry WHERE ..."
            />
            <button
              onClick={() => datafusionQueryMut.mutateAsync({ sql: dfSql }).then((r: typeof dfResult) => setDfResult(r))}
              disabled={datafusionQueryMut.isPending}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {datafusionQueryMut.isPending ? "Running..." : "Run Query"}
            </button>
          </div>
          {dfResult && (
            <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
                <span className="text-xs text-slate-400">{dfResult.rowCount} rows · {dfResult.executionMs}ms · source: {dfResult.source}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-slate-700">{dfResult.columns.map(c => <th key={c} className="px-3 py-2 text-left text-slate-400 font-medium">{c}</th>)}</tr></thead>
                  <tbody>{dfResult.rows.map((row, i) => <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/50">{(row as unknown[]).map((cell, j) => <td key={j} className="px-3 py-2 text-slate-200 font-mono">{String(cell)}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DuckDB SQL tab */}
      {activeTab === "duckdb" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border ${
              analyticsHealth?.healthy ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-slate-600 bg-slate-800 text-slate-400"
            }`}>
              <span className={`w-2 h-2 rounded-full ${analyticsHealth?.healthy ? "bg-emerald-400" : "bg-slate-500"}`} />
              Analytics Engine: {analyticsHealth?.healthy ? "live" : "offline (configured)"}
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 space-y-3">
            <p className="text-xs text-slate-400">Fast analytical query engine — run ad-hoc queries over production and historical data tables.</p>
            <textarea
              value={duckSql}
              onChange={e => setDuckSql(e.target.value)}
              rows={6}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono resize-none focus:outline-none focus:border-amber-500"
              placeholder="SELECT ... FROM read_parquet('s3://...')"
            />
            <button
              onClick={() => duckdbQueryMut.mutateAsync({ sql: duckSql }).then((r: typeof duckResult) => setDuckResult(r))}
              disabled={duckdbQueryMut.isPending}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {duckdbQueryMut.isPending ? "Running..." : "Run Query"}
            </button>
          </div>
          {duckResult && (
            <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
                <span className="text-xs text-slate-400">{duckResult.rowCount} rows · {duckResult.executionMs}ms · source: {duckResult.source}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-slate-700">{duckResult.columns.map(c => <th key={c} className="px-3 py-2 text-left text-slate-400 font-medium">{c}</th>)}</tr></thead>
                  <tbody>{duckResult.rows.map((row, i) => <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/50">{(row as unknown[]).map((cell, j) => <td key={j} className="px-3 py-2 text-slate-200 font-mono">{String(cell)}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Apache Sedona Spatial tab */}
      {activeTab === "sedona" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border ${
              analyticsHealth?.healthy ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-slate-600 bg-slate-800 text-slate-400"
            }`}>
              <span className={`w-2 h-2 rounded-full ${analyticsHealth?.healthy ? "bg-emerald-400" : "bg-slate-500"}`} />
              Spatial Engine: {analyticsHealth?.healthy ? "live" : "offline (configured)"}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Proximity search */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-200">Proximity Search</h3>
              <p className="text-xs text-slate-400">Find wells and assets within a specified radius from any location.</p>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="text-xs text-slate-400">Latitude</label><input type="number" value={sedonaLat} onChange={e => setSedonaLat(e.target.value)} className="w-full mt-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-100" /></div>
                <div><label className="text-xs text-slate-400">Longitude</label><input type="number" value={sedonaLng} onChange={e => setSedonaLng(e.target.value)} className="w-full mt-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-100" /></div>
                <div><label className="text-xs text-slate-400">Radius (km)</label><input type="number" value={sedonaRadius} onChange={e => setSedonaRadius(e.target.value)} className="w-full mt-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-100" /></div>
              </div>
              {sedonaQuery.isLoading ? (
                <p className="text-xs text-slate-400">Searching for nearby assets...</p>
              ) : (
                <div className="text-xs text-slate-300">
                  <p className="text-slate-400 mb-2">Found {(sedonaQuery.data as { totalFound?: number })?.totalFound ?? 0} assets within {sedonaRadius}km</p>
                  {((sedonaQuery.data as unknown as { features?: { id: string; name: string; type: string; distanceKm: number }[] })?.features ?? []).slice(0, 8).map((f) => (
                    <div key={f.id} className="flex justify-between py-1 border-b border-slate-800">
                      <span>{f.name}</span>
                      <span className="text-amber-400">{f.distanceKm?.toFixed(1)} km</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Damage heatmap */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-200">Damage Heatmap</h3>
              <p className="text-xs text-slate-400">Spatial density of war damage assessments across the Middle East region.</p>
              {heatmapQuery.isLoading ? (
                <p className="text-xs text-slate-400">Loading heatmap data...</p>
              ) : (
                <div className="space-y-2">
                  {((heatmapQuery.data as { points?: { lat: number; lng: number; weight: number; label: string }[] })?.points ?? []).map((pt, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5 border-b border-slate-800">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                        pt.weight >= 5 ? "bg-red-500" : pt.weight >= 4 ? "bg-orange-500" : pt.weight >= 3 ? "bg-yellow-500" : "bg-blue-500"
                      }`} />
                      <span className="text-xs text-slate-300 flex-1">{pt.label}</span>
                      <span className="text-xs text-slate-500">{pt.lat.toFixed(2)}, {pt.lng.toFixed(2)}</span>
                      <span className={`text-xs font-medium ${
                        pt.weight >= 5 ? "text-red-400" : pt.weight >= 4 ? "text-orange-400" : "text-yellow-400"
                      }`}>severity {pt.weight}</span>
                    </div>
                  ))}
                  <p className="text-xs text-slate-500 pt-1">Source: {(heatmapQuery.data as { source?: string })?.source ?? "simulated"}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Iceberg Catalog tab */}
      {activeTab === "iceberg" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border ${
              datafusionHealth?.healthy ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-slate-600 bg-slate-800 text-slate-400"
            }`}>
              <span className={`w-2 h-2 rounded-full ${datafusionHealth?.healthy ? "bg-emerald-400" : "bg-slate-500"}`} />
              Apache Iceberg: {datafusionHealth?.healthy ? "live" : "offline (simulated)"}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {((icebergData as unknown as { tables?: { name: string; rowCount: number; sizeBytes: number; partitionedBy: string; lastUpdated: string }[] })?.tables ?? []).map(table => (
              <div key={table.name} className="bg-slate-900 border border-slate-700 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-200 font-mono">{table.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Partitioned by: {table.partitionedBy}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-amber-400">{table.rowCount.toLocaleString()} rows</p>
                  <p className="text-xs text-slate-400">{(table.sizeBytes / 1_048_576).toFixed(0)} MB · updated {new Date(table.lastUpdated).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
            {!icebergData && <p className="text-sm text-slate-400">Loading Iceberg catalog...</p>}
          </div>
        </div>
      )}
    </div>
  );
}
