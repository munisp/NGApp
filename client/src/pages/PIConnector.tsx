/**
 * PIConnector.tsx — Aveva PI System Web API Integration Page
 *
 * Provides a full UI for:
 *   - Configuring and testing the PI Web API connection
 *   - Browsing the PI Asset Framework (AF) element hierarchy
 *   - Searching and previewing PI tags with live values
 *   - Viewing historical data charts for selected tags
 *
 * When PI_WEBAPI_URL is not configured, the page shows simulated
 * data with a clear "SIMULATION MODE" banner.
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Database, Search, RefreshCw, CheckCircle2, XCircle, Info,
  ChevronRight, ChevronDown, Tag, Activity, Clock, Layers,
  BarChart3, Wifi, WifiOff,
} from "lucide-react";

// ─── TAG ROW ──────────────────────────────────────────────────────────────────

function TagRow({
  tag,
  isSelected,
  onSelect,
}: {
  tag: { webId: string; name: string; descriptor: string; engineeringUnits: string; pointType: string };
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { data: value } = trpc.piConnector.tagValue.useQuery(
    { webId: tag.webId },
    { refetchInterval: 10000, enabled: isSelected }
  );

  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-all border text-xs",
        isSelected
          ? "border-amber-700/60 bg-amber-950/20"
          : "border-transparent hover:border-border/50 hover:bg-muted/20"
      )}
    >
      <Tag className="w-3 h-3 text-amber-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-mono font-semibold truncate">{tag.name}</div>
        <div className="text-muted-foreground truncate">{tag.descriptor}</div>
      </div>
      <div className="text-right shrink-0">
        {isSelected && value ? (
          <span className={cn(
            "font-mono font-bold",
            value.good ? "text-emerald-400" : "text-red-400"
          )}>
            {typeof value.value === "number"
              ? value.value.toFixed(2)
              : String(value.value ?? "—")}
            {tag.engineeringUnits && (
              <span className="text-muted-foreground ml-1 text-[10px]">{tag.engineeringUnits}</span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground font-mono">{tag.pointType}</span>
        )}
      </div>
    </div>
  );
}

// ─── HISTORY CHART ────────────────────────────────────────────────────────────

function TagHistoryChart({ webId, tagName, units }: { webId: string; tagName: string; units: string }) {
  const [timeRange, setTimeRange] = useState("*-8h");

  const { data: history, isFetching } = trpc.piConnector.historicalData.useQuery(
    { webId, tagName, startTime: timeRange, endTime: "*", maxCount: 500 },
    {}
  );

  const chartData = useMemo(() => {
    if (!history?.values) return [];
    return history.values
      .filter(v => v.good && typeof v.value === "number")
      .map(v => ({
        time: new Date(v.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        value: typeof v.value === "number" ? Number(v.value.toFixed(3)) : null,
      }));
  }, [history]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono font-semibold text-amber-400 truncate">{tagName}</div>
        <div className="flex gap-1">
          {[["*-1h", "1H"], ["*-8h", "8H"], ["*-24h", "24H"], ["*-7d", "7D"]].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setTimeRange(val)}
              className={cn(
                "text-[10px] px-2 py-0.5 rounded border font-mono transition-all",
                timeRange === val
                  ? "border-amber-700/60 bg-amber-950/30 text-amber-400"
                  : "border-border/50 text-muted-foreground hover:border-amber-800/30"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isFetching && <div className="text-xs text-muted-foreground animate-pulse">Loading historian data…</div>}

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#6b7280" }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} />
            <Tooltip
              contentStyle={{ background: "#0d1117", border: "1px solid #374151", fontSize: 11 }}
              formatter={(v: number) => [`${v.toFixed(3)} ${units}`, tagName]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#f59e0b"
              strokeWidth={1.5}
              dot={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[180px] flex items-center justify-center text-muted-foreground text-xs">
          No data for selected range
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-muted-foreground">Points</div>
          <div className="font-mono font-semibold">{history?.count ?? 0}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Min</div>
          <div className="font-mono font-semibold text-blue-400">
            {chartData.length > 0
              ? Math.min(...chartData.map(d => d.value ?? Infinity)).toFixed(2)
              : "—"} {units}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Max</div>
          <div className="font-mono font-semibold text-amber-400">
            {chartData.length > 0
              ? Math.max(...chartData.map(d => d.value ?? -Infinity)).toFixed(2)
              : "—"} {units}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AF ELEMENT TREE ─────────────────────────────────────────────────────────

function AFElementTree() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { data: elements, isLoading } = trpc.piConnector.browseElements.useQuery(undefined);

  if (isLoading) return <div className="text-xs text-muted-foreground animate-pulse p-3">Loading AF hierarchy…</div>;
  if (!elements?.length) return <div className="text-xs text-muted-foreground p-3">No AF elements found</div>;

  return (
    <div className="space-y-0.5">
      {elements.map(el => (
        <div key={el.webId}>
          <div
            className="flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer hover:bg-muted/20 transition-all"
            onClick={() => {
              const next = new Set(expanded);
              if (next.has(el.webId)) next.delete(el.webId);
              else next.add(el.webId);
              setExpanded(next);
            }}
          >
            {el.hasChildren ? (
              expanded.has(el.webId)
                ? <ChevronDown className="w-3 h-3 text-amber-400 shrink-0" />
                : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
            ) : (
              <div className="w-3 h-3 shrink-0" />
            )}
            <Layers className="w-3 h-3 text-blue-400 shrink-0" />
            <span className="font-mono">{el.name}</span>
            {el.templateName && (
              <span className="text-[10px] text-muted-foreground/60">{el.templateName}</span>
            )}
          </div>
          {expanded.has(el.webId) && (
            <div className="ml-5 border-l border-border/30 pl-2 space-y-0.5">
              {el.hasChildren && (
                <div className="text-[10px] text-muted-foreground/50 px-2 py-1 italic">
                  {el.attributes.length > 0 ? `${el.attributes.length} attributes` : "Expand to load children"}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function PIConnector() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<{
    webId: string; name: string; engineeringUnits: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<"tags" | "af">("tags");

  const { data: health, refetch: refetchHealth } = trpc.piConnector.health.useQuery(
    undefined,
    { refetchInterval: 60000 }
  );
  // Fast cached connection status — polls every 30s (no network call to PI server)
  const { data: connStatus } = trpc.piConnector.connectionStatus.useQuery(
    undefined,
    { refetchInterval: 30000 }
  );

  const { data: tags, isFetching: tagsLoading } = trpc.piConnector.searchTags.useQuery(
    { query: debouncedQuery, maxCount: 100 },
    { enabled: activeTab === "tags" }
  );

  // Debounce search
  const handleSearch = (val: string) => {
    setSearchQuery(val);
    clearTimeout((window as unknown as { _piSearchTimer?: ReturnType<typeof setTimeout> })._piSearchTimer);
    (window as unknown as { _piSearchTimer?: ReturnType<typeof setTimeout> })._piSearchTimer = setTimeout(
      () => setDebouncedQuery(val),
      400
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold font-[Syne] flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-400" />
            Aveva PI System Connector
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            PI Web API adapter — historian-grade tag browsing, live values, and recorded data
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Live connection status badge — updates every 30s */}
          {connStatus && (
            <div className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono font-semibold",
              connStatus.status === "connected"
                ? "border-emerald-700/50 bg-emerald-950/20 text-emerald-400"
                : connStatus.status === "disconnected"
                  ? "border-red-700/50 bg-red-950/20 text-red-400"
                  : "border-blue-700/50 bg-blue-950/20 text-blue-400"
            )}>
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                connStatus.status === "connected" ? "bg-emerald-400 animate-pulse" :
                connStatus.status === "disconnected" ? "bg-red-400" : "bg-blue-400"
              )} />
              {connStatus.status === "connected"
                ? `Connected · ${connStatus.serverVersion ?? ""}`
                : connStatus.status === "disconnected"
                  ? "Disconnected"
                  : "Simulation Mode"}

            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchHealth()}
            className="text-xs"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Connection status */}
      {health && (
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono",
          health.connected
            ? "border-emerald-800/50 bg-emerald-950/20 text-emerald-400"
            : health.configured
              ? "border-red-800/50 bg-red-950/20 text-red-400"
              : "border-blue-800/50 bg-blue-950/20 text-blue-400"
        )}>
          {health.connected ? (
            <Wifi className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>
            {health.connected
              ? `Connected to ${health.serverName} (${health.serverVersion}) at ${health.url}`
              : health.configured
                ? `Cannot reach PI Web API at ${health.url} — check credentials and network`
                : "SIMULATION MODE — Set PI_WEBAPI_URL, PI_WEBAPI_USER, and PI_WEBAPI_PASS to connect to a live PI server"}
          </span>
        </div>
      )}

      {/* Config hint when not configured */}
      {health && !health.configured && (
        <Card className="bg-card border-amber-800/30">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="text-xs space-y-2">
              <div className="font-semibold text-amber-400 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                Required Secrets to Connect a Live PI Server
              </div>
              <div className="grid md:grid-cols-3 gap-3 text-muted-foreground font-mono">
                <div>
                  <div className="text-white mb-0.5">PI_WEBAPI_URL</div>
                  <div>https://piserver.company.com/piwebapi</div>
                </div>
                <div>
                  <div className="text-white mb-0.5">PI_WEBAPI_USER</div>
                  <div>Domain\ServiceAccount</div>
                </div>
                <div>
                  <div className="text-white mb-0.5">PI_WEBAPI_PASS</div>
                  <div>Service account password</div>
                </div>
              </div>
              <div className="text-muted-foreground/70">
                Add these in Settings → Secrets. Set PI_WEBAPI_VERIFY_SSL=false for self-signed certificates.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main content */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Left: Tag browser */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3 pt-4 px-4">
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setActiveTab("tags")}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-md border transition-all font-mono",
                  activeTab === "tags"
                    ? "border-amber-700/60 bg-amber-950/30 text-amber-400"
                    : "border-border/50 text-muted-foreground"
                )}
              >
                <Tag className="w-3 h-3 inline mr-1" />
                Tag Search
              </button>
              <button
                onClick={() => setActiveTab("af")}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-md border transition-all font-mono",
                  activeTab === "af"
                    ? "border-amber-700/60 bg-amber-950/30 text-amber-400"
                    : "border-border/50 text-muted-foreground"
                )}
              >
                <Layers className="w-3 h-3 inline mr-1" />
                AF Hierarchy
              </button>
            </div>
            {activeTab === "tags" && (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search tags (e.g. PB-047, PRESSURE, ESP)…"
                  value={searchQuery}
                  onChange={e => handleSearch(e.target.value)}
                  className="pl-8 text-xs h-8"
                />
              </div>
            )}
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {activeTab === "tags" ? (
              <div className="space-y-0.5 max-h-[420px] overflow-y-auto">
                {tagsLoading && (
                  <div className="text-xs text-muted-foreground animate-pulse p-2">Searching tags…</div>
                )}
                {!tagsLoading && tags?.length === 0 && (
                  <div className="text-xs text-muted-foreground p-2">No tags found for "{debouncedQuery}"</div>
                )}
                {tags?.map(tag => (
                  <TagRow
                    key={tag.webId}
                    tag={tag}
                    isSelected={selectedTag?.webId === tag.webId}
                    onSelect={() => setSelectedTag(
                      selectedTag?.webId === tag.webId ? null : {
                        webId: tag.webId,
                        name: tag.name,
                        engineeringUnits: tag.engineeringUnits,
                      }
                    )}
                  />
                ))}
              </div>
            ) : (
              <div className="max-h-[420px] overflow-y-auto">
                <AFElementTree />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Tag detail / history chart */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-[Syne] flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-400" />
              {selectedTag ? "Tag Historical Data" : "Tag Detail"}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {selectedTag ? (
              <TagHistoryChart
                webId={selectedTag.webId}
                tagName={selectedTag.name}
                units={selectedTag.engineeringUnits}
              />
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground gap-3">
                <Tag className="w-8 h-8 opacity-20" />
                <div className="text-sm">Select a tag to view historian data</div>
                <div className="text-xs opacity-60">Click any tag in the browser to load its recorded values</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Tags Available", value: tags?.length ?? 0, icon: Tag, color: "text-amber-400" },
          { label: "Server Status", value: health?.connected ? "Online" : "Offline", icon: health?.connected ? Wifi : WifiOff, color: health?.connected ? "text-emerald-400" : "text-red-400" },
          { label: "Mode", value: health?.mode === "live" ? "Live" : "Simulation", icon: Activity, color: health?.mode === "live" ? "text-emerald-400" : "text-blue-400" },
          { label: "Protocol", value: "PI Web API v2", icon: Clock, color: "text-muted-foreground" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-card border-border/50">
            <CardContent className="pt-3 pb-3 px-4">
              <div className="flex items-center gap-2">
                <Icon className={cn("w-4 h-4 shrink-0", color)} />
                <div>
                  <div className="text-[10px] text-muted-foreground">{label}</div>
                  <div className={cn("text-sm font-mono font-semibold", color)}>{value}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
