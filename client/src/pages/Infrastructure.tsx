/**
 * Infrastructure.tsx — Middleware stack health dashboard with geographic map
 *
 * Shows real-time health status for all v12.0 middleware services:
 * Kafka, Redis, TigerBeetle, Temporal, Permify, RTDIP/Lakehouse,
 * OpenLEADR VTN, APISIX, Dapr, Keycloak, Fluvio, MinIO.
 *
 * The geographic map pins each service to its deployment region with
 * live health-status coloring (green/amber/red/grey).
 */
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapView } from "@/components/Map";
import {
  Activity,
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  Database,
  GitBranch,
  Globe,
  Key,
  Layers,
  MessageSquare,
  RefreshCw,
  Server,
  Shield,
  X,
  Zap,
} from "lucide-react";
import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ServiceCard {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  healthy: boolean | null;
  mode: string;
  details?: Record<string, string | number | boolean | null>;
  /** Geographic coordinates for the map pin */
  lat: number;
  lng: number;
  /** Deployment region label */
  region: string;
}

// ─── Status helpers ─────────────────────────────────────────────────────────────

function getStatusColor(service: ServiceCard): string {
  if (service.healthy === null) return "#f59e0b"; // amber – loading
  if (service.healthy === true) return "#10b981"; // emerald – online
  if (service.mode === "simulated") return "#3b82f6"; // blue – simulated
  if (service.mode === "disabled") return "#64748b"; // slate – disabled
  return "#f97316"; // orange – unavailable
}

function StatusBadge({ healthy, mode }: { healthy: boolean | null; mode: string }) {
  if (healthy === null)
    return (
      <Badge variant="outline" className="text-yellow-400 border-yellow-400/40 bg-yellow-400/10">
        <Clock className="w-3 h-3 mr-1" /> Loading
      </Badge>
    );
  if (healthy)
    return (
      <Badge variant="outline" className="text-emerald-400 border-emerald-400/40 bg-emerald-400/10">
        <CheckCircle2 className="w-3 h-3 mr-1" /> Online
      </Badge>
    );
  if (mode === "disabled")
    return (
      <Badge variant="outline" className="text-slate-400 border-slate-400/40 bg-slate-400/10">
        <Server className="w-3 h-3 mr-1" /> Disabled
      </Badge>
    );
  if (mode === "simulated")
    return (
      <Badge variant="outline" className="text-blue-400 border-blue-400/40 bg-blue-400/10">
        <Activity className="w-3 h-3 mr-1" /> Simulated
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-orange-400 border-orange-400/40 bg-orange-400/10">
      <AlertTriangle className="w-3 h-3 mr-1" /> Unavailable
    </Badge>
  );
}

// ─── Service tile ──────────────────────────────────────────────────────────────

function ServiceTile({
  service,
  selected,
  onSelect,
}: {
  service: ServiceCard;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      className={`bg-slate-900/60 border transition-all duration-200 cursor-pointer hover:bg-slate-900/80 ${
        selected
          ? "border-amber-500/60 ring-1 ring-amber-500/30"
          : service.healthy === true
          ? "border-emerald-500/20"
          : service.healthy === false && service.mode !== "disabled" && service.mode !== "simulated"
          ? "border-orange-500/20"
          : "border-slate-700/50"
      }`}
      onClick={() => {
        setExpanded((e) => !e);
        onSelect(service.id);
      }}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-800 text-amber-400">{service.icon}</div>
            <div>
              <CardTitle className="text-sm font-semibold text-slate-100">{service.name}</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">{service.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge healthy={service.healthy} mode={service.mode} />
            <ChevronRight
              className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? "rotate-90" : ""}`}
            />
          </div>
        </div>
      </CardHeader>

      {expanded && service.details && (
        <CardContent className="pt-0">
          <div className="mt-2 pt-2 border-t border-slate-700/50 grid grid-cols-2 gap-2">
            {Object.entries(service.details).map(([k, v]) => (
              <div key={k} className="text-xs">
                <span className="text-slate-500">{k}: </span>
                <span className="text-slate-300 font-mono">{String(v ?? "N/A")}</span>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Geographic map panel ──────────────────────────────────────────────────────

function InfrastructureMap({
  services,
  selectedId,
  onSelect,
}: {
  services: ServiceCard[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  const handleMapReady = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;

      // Apply dark map styles
      map.setOptions({
        styles: [
          { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
          { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#334155" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#0c1a2e" }] },
          { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
        ],
        streetViewControl: false,
        mapTypeControl: false,
      });

      // Clear old markers
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];

      // Fit bounds to all service locations
      const bounds = new google.maps.LatLngBounds();

      services.forEach((svc) => {
        const color = getStatusColor(svc);
        const isSelected = svc.id === selectedId;

        // Create SVG circle marker
        const svgIcon = {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: color,
          fillOpacity: 0.9,
          strokeColor: isSelected ? "#f59e0b" : "#ffffff",
          strokeWeight: isSelected ? 3 : 1.5,
          scale: isSelected ? 14 : 10,
        };

        const marker = new google.maps.Marker({
          position: { lat: svc.lat, lng: svc.lng },
          map,
          icon: svgIcon,
          title: svc.name,
          zIndex: isSelected ? 100 : 1,
        });

        // Info window
        const infoContent = `
          <div style="background:#1e293b;color:#f1f5f9;padding:10px 14px;border-radius:8px;font-family:sans-serif;min-width:180px">
            <div style="font-weight:600;font-size:13px;margin-bottom:4px">${svc.name}</div>
            <div style="font-size:11px;color:#94a3b8;margin-bottom:6px">${svc.region}</div>
            <div style="display:flex;align-items:center;gap:6px">
              <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block"></span>
              <span style="font-size:12px;color:${color}">${
                svc.healthy === true
                  ? "Online"
                  : svc.mode === "simulated"
                  ? "Simulated"
                  : svc.healthy === null
                  ? "Loading"
                  : "Unavailable"
              }</span>
            </div>
            <div style="font-size:11px;color:#64748b;margin-top:4px">${svc.description}</div>
          </div>
        `;

        const infoWindow = new google.maps.InfoWindow({ content: infoContent });

        marker.addListener("click", () => {
          onSelect(svc.id);
          infoWindow.open(map, marker);
        });

        markersRef.current.push(marker);
        bounds.extend({ lat: svc.lat, lng: svc.lng });
      });

      // Fit map to show all markers with padding
      map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, selectedId]
  );

  return (
    <div className="relative w-full h-[420px] rounded-xl overflow-hidden border border-slate-700/50">
        <MapView
        onMapReady={handleMapReady}
        initialCenter={{ lat: 30, lng: 30 }}
        initialZoom={2}
        className="w-full h-[420px]"
      />
      {/* Legend overlay */}
      <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-lg px-3 py-2 flex gap-4 text-xs">
        {[
          { color: "#10b981", label: "Online" },
          { color: "#3b82f6", label: "Simulated" },
          { color: "#f97316", label: "Unavailable" },
          { color: "#64748b", label: "Disabled" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span className="text-slate-300">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── OpenSTEF model accuracy chart ─────────────────────────────────────────────────────────────────

function OpenStefMetricsChart() {
  const metricsQ = trpc.openstef.getModelMetrics.useQuery(
    { tag: "FAC-001.DEMAND_KW", limit: 14 },
    { refetchInterval: 300000 }
  );
  const data = (metricsQ.data ?? []).slice().reverse();
  if (metricsQ.isLoading)
    return <div className="text-xs text-slate-500 py-4 text-center">Loading model metrics...</div>;
  if (data.length === 0)
    return <div className="text-xs text-slate-500 py-4 text-center">No model metrics yet — dispatch a forecast to populate</div>;
  return (
    <div className="mt-3">
      <p className="text-xs text-slate-400 mb-2 font-medium">Model Accuracy Trend (last 14 runs)</p>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="trainedAt"
            tickFormatter={(v: string) =>
              new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })
            }
            tick={{ fontSize: 9, fill: "#64748b" }}
          />
          <YAxis tick={{ fontSize: 9, fill: "#64748b" }} />
          <Tooltip
            contentStyle={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: 6,
              fontSize: 11,
            }}
            labelFormatter={(v: string) => new Date(v).toLocaleDateString()}
          />
          <Line type="monotone" dataKey="mae" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="MAE (kW)" />
          <Line type="monotone" dataKey="rmse" stroke="#60a5fa" strokeWidth={1.5} dot={false} name="RMSE (kW)" />
          <Line type="monotone" dataKey="mape" stroke="#34d399" strokeWidth={1.5} dot={false} name="MAPE (%)" />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-1">
        {[
          { key: "mae", label: "MAE kW", color: "#f59e0b" },
          { key: "rmse", label: "RMSE kW", color: "#60a5fa" },
          { key: "mape", label: "MAPE %", color: "#34d399" },
        ].map(({ key, label, color }) => {
          const latest = data[data.length - 1] as Record<string, unknown> | undefined;
          const val = latest?.[key];
          return (
            <div key={key} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-[10px] text-slate-400">
                {label}:{" "}
                <span className="text-slate-200 font-mono">
                  {val != null ? Number(val).toFixed(2) : "—"}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/// ─── FledgePower protocol toggle panel ───────────────────────────────────────

function FledgeProtocolPanel() {
  const protocolsQuery = trpc.fledge.protocols.useQuery(undefined, { refetchInterval: 15000 });
  const protocols = (protocolsQuery.data as { protocols?: Array<{ name: string; status: string; connections: number }> })?.protocols ?? [];

  return (
    <div className="mt-3">
      <p className="text-xs text-slate-400 mb-2 font-medium">Protocol Bridge Status</p>
      {protocolsQuery.isLoading ? (
        <p className="text-xs text-slate-500">Loading protocol status...</p>
      ) : (
        <div className="space-y-1.5">
          {protocols.map((p: { name: string; status: string; connections: number }) => (
            <div key={p.name} className="bg-slate-800/60 rounded px-2 py-1.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono text-slate-300">{p.name.toUpperCase()}</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                  p.status === "connected" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                }`}>
                  {p.status}
                </span>
              </div>
              <div className="text-[9px] text-slate-500">
                Connections: <span className="text-slate-300 font-mono">{p.connections}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Selected service detail panel ─────────────────────────────────────────────────────────────────
function ServiceDetailPanel({
  service,
  onClose,
}: {
  service: ServiceCard;
  onClose: () => void;
}) {
  return (
    <Card className="bg-slate-900/80 border-amber-500/30 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-800 text-amber-400">{service.icon}</div>
            <div>
              <CardTitle className="text-sm font-semibold text-slate-100">{service.name}</CardTitle>
              <p className="text-xs text-slate-400">{service.region}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge healthy={service.healthy} mode={service.mode} />
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-slate-400 mb-3">{service.description}</p>
        {service.details && (
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(service.details).map(([k, v]) => (
              <div key={k} className="bg-slate-800/60 rounded px-2 py-1.5">
                <p className="text-xs text-slate-500">{k}</p>
                <p className="text-xs text-slate-200 font-mono mt-0.5 truncate">{String(v ?? "N/A")}</p>
              </div>
            ))}
          </div>
        )}
        {service.id === "openstef" && <OpenStefMetricsChart />}
        {service.id === "fledge" && <FledgeProtocolPanel />}
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <Globe className="w-3 h-3" />
          <span>
            {service.lat.toFixed(4)}, {service.lng.toFixed(4)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Fluvio status panel card ─────────────────────────────────────────────────

interface FluvioData {
  dualPublishEnabled: boolean;
  endpoint: string;
  reachable: boolean;
  mode: string;
  topics: Array<{ name: string; description: string; producers: string[] }>;
  stats: {
    messagesRouted: number;
    topicCount: number;
    producerCount: number;
    consumerCount: number;
    lagMs: number;
  };
}

function FluvioPanelCard({
  fluvio,
  loading,
  onToggle,
  toggling,
}: {
  fluvio: FluvioData | undefined;
  loading: boolean;
  onToggle: (enabled: boolean) => void;
  toggling: boolean;
}) {
  if (loading) {
    return (
      <Card className="bg-slate-900/60 border-slate-700/50">
        <CardContent className="pt-4">
          <p className="text-xs text-slate-500 text-center py-4">Loading Fluvio status...</p>
        </CardContent>
      </Card>
    );
  }

  const isActive = fluvio?.dualPublishEnabled ?? false;

  return (
    <Card className="bg-slate-900/60 border-slate-700/50">
      <CardContent className="pt-4 pb-4">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-800 text-amber-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">Edge Streaming Service</p>
              <p className="text-xs text-slate-400">
                Endpoint: <span className="font-mono text-amber-300">{fluvio?.endpoint ?? "fluvio-sc:9003"}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Live health indicator */}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isActive ? "bg-emerald-400 animate-pulse" : "bg-slate-600"
                }`}
              />
              <span className={`text-xs font-medium ${isActive ? "text-emerald-400" : "text-slate-500"}`}>
                {isActive ? "LIVE" : "INACTIVE"}
              </span>
            </div>
            {/* Dual-publish toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Dual-Publish</span>
              <button
                onClick={() => onToggle(!isActive)}
                disabled={toggling}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  isActive ? "bg-amber-500" : "bg-slate-700"
                } ${toggling ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    isActive ? "translate-x-4" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: "Topics", value: fluvio?.stats?.topicCount ?? 6 },
            { label: "Producers", value: fluvio?.stats?.producerCount ?? 6 },
            { label: "Consumers", value: fluvio?.stats?.consumerCount ?? 3 },
            { label: "Lag (ms)", value: fluvio?.stats?.lagMs ?? 0 },
          ].map((stat) => (
            <div key={stat.label} className="bg-slate-800/60 rounded-lg px-3 py-2">
              <p className="text-xs text-slate-500">{stat.label}</p>
              <p className="text-lg font-bold text-slate-100 font-mono">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Messages routed */}
        <div className="bg-slate-800/40 rounded-lg px-3 py-2 mb-4 flex items-center justify-between">
          <span className="text-xs text-slate-400">Total Messages Routed</span>
          <span className="text-sm font-bold text-amber-300 font-mono">
            {(fluvio?.stats?.messagesRouted ?? 0).toLocaleString()}
          </span>
        </div>

        {/* Topics table */}
        <p className="text-xs text-slate-500 font-medium mb-2">Topics</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left text-slate-400 font-medium pb-1.5">Topic</th>
                <th className="text-left text-slate-400 font-medium pb-1.5">Description</th>
                <th className="text-left text-slate-400 font-medium pb-1.5">Producers</th>
              </tr>
            </thead>
            <tbody>
              {(fluvio?.topics ?? []).map((t) => (
                <tr key={t.name} className="border-b border-slate-800/50 last:border-0">
                  <td className="py-1.5 font-mono text-amber-300 pr-3">{t.name}</td>
                  <td className="py-1.5 text-slate-400 pr-3">{t.description}</td>
                  <td className="py-1.5 text-slate-400">{t.producers.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mode note */}
        {!isActive && (
          <p className="text-xs text-slate-500 mt-3 italic">
            Redundant publish is disabled. Enable to route field data to both primary and edge streaming simultaneously.
            Set <span className="font-mono text-slate-400">FLUVIO_DUAL_PUBLISH=true</span> to persist across restarts.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function Infrastructure() {
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"map" | "grid">("map");

  const workerStatus = trpc.streaming.getWorkerStatus.useQuery(undefined, { refetchInterval: 10000 });
  const kafkaStats = trpc.streaming.getKafkaStats.useQuery(undefined, { refetchInterval: 10000 });
  const fluvioStatusQuery = trpc.streaming.getFluvioStatus.useQuery(undefined, { refetchInterval: 15000 });
  const toggleFluvioDualPublish = trpc.streaming.toggleFluvioDualPublish.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      fluvioStatusQuery.refetch();
    },
    onError: () => toast.error("Failed to toggle Fluvio dual-publish"),
  });
  const cacheStats = trpc.cache.getStats.useQuery(undefined, { refetchInterval: 10000 });
  const lakehouseStatus = trpc.lakehouse.health.useQuery(undefined, { refetchInterval: 30000 });
  const drStatus = trpc.demandResponse.getStatus.useQuery(undefined, { refetchInterval: 30000 });
  const authzStatus = trpc.authz.check.useQuery({ entityType: "system", entityId: "platform", permission: "view" }, { refetchInterval: 30000 });
  const openStefStatus = trpc.openstef.modelStatus.useQuery(undefined, { refetchInterval: 60000 });
  const fledgeHealth = trpc.fledge.health.useQuery(undefined, { refetchInterval: 30000 });
  const fledgeStats = trpc.fledge.stats.useQuery(undefined, { refetchInterval: 30000 });
  const mlServiceHealth = trpc.digitalTwinExt.mlServiceHealth.useQuery(undefined, { refetchInterval: 30000 });

  const worker = workerStatus.data as Record<string, unknown> | undefined;
  const kafka = kafkaStats.data;
  const fluvio = fluvioStatusQuery.data;
  const cache = cacheStats.data;
  const lakehouse = lakehouseStatus.data;
  const dr = drStatus.data;
  const authz = authzStatus.data;
  const openstef = openStefStatus.data;

  // Service definitions with geographic coordinates (deployment regions)
  const services: ServiceCard[] = [
    {
      id: "kafka",
      name: "Real-Time Data Stream",
      description: "High-speed sensor data and alarm event processing pipeline",
      icon: <MessageSquare className="w-4 h-4" />,
      category: "Streaming",
      healthy: kafka?.mode === "kafka",
      mode: kafka?.mode ?? "simulated",
      lat: 24.7136, lng: 46.6753, // Riyadh, Saudi Arabia (primary data center)
      region: "Riyadh DC-1 (SAU)",
      details: {
        "Messages processed": kafka?.messagesProcessed ?? 0,
        "Errors": kafka?.errors ?? 0,
        "Mode": kafka?.mode ?? "simulated",
        "Last message": kafka?.lastMessage ?? "N/A",
      },
    },
    {
      id: "fluvio",
      name: "Edge Streaming",
      description: "High-throughput field data streaming — redundant publish for real-time operations",
      icon: <Zap className="w-4 h-4" />,
      category: "Streaming",
      healthy: fluvio?.reachable === true,
      mode: fluvio?.mode ?? "disabled",
      lat: 29.3759, lng: 47.9774, // Kuwait City (field edge node)
      region: "Kuwait City Edge (KWT)",
      details: {
        "Dual-Publish": fluvio?.dualPublishEnabled ? "ACTIVE" : "DISABLED",
        "Endpoint": fluvio?.endpoint ?? "fluvio-sc:9003",
        "Topics": fluvio?.stats?.topicCount ?? 6,
        "Messages Routed": (fluvio?.stats?.messagesRouted ?? 0).toLocaleString(),
        "Producers": fluvio?.stats?.producerCount ?? 6,
        "Lag (ms)": fluvio?.stats?.lagMs ?? 0,
      },
    },
    {
      id: "redis",
      name: "Data Cache",
      description: "High-speed cache for real-time telemetry and user sessions",
      icon: <Database className="w-4 h-4" />,
      category: "Cache",
      healthy: cache?.connected === true,
      mode: cache?.connected ? "redis" : "simulated",
      lat: 25.2048, lng: 55.2708, // Dubai (UAE cloud region)
      region: "Dubai Cloud (UAE)",
      details: {
        "Connected": String(cache?.connected ?? false),
        "DB Size": cache?.dbSize ?? 0,
        "Hit Rate": `${cache?.hitRate ?? 0}%`,
        "Memory MB": cache?.memoryUsedMb ?? 0,
      },
    },
    {
      id: "tigerbeetle",
      name: "Financial Ledger",
      description: "Double-entry ledger for production volume accounting",
      icon: <Layers className="w-4 h-4" />,
      category: "Ledger",
      healthy: (worker?.services as Record<string, unknown>)?.tigerbeetle === true,
      mode: "simulated",
      lat: 24.4539, lng: 54.3773, // Abu Dhabi (ADNOC region)
      region: "Abu Dhabi DC (UAE)",
      details: {
        "Ledgers": "Production, Allocation, Royalty",
        "Accounts": "Per-well + per-field",
        "Commodity codes": "Oil (bbl), Gas (mscf), Water (bbl)",
        "Mode": "simulated",
      },
    },
    {
      id: "temporal",
      name: "Workflow Engine",
      description: "Durable workflow automation — permits, firmware updates, regulatory",
      icon: <GitBranch className="w-4 h-4" />,
      category: "Workflow",
      healthy: (worker?.services as Record<string, unknown>)?.temporal === true,
      mode: "simulated",
      lat: 51.5074, lng: -0.1278, // London (EU workflow cluster)
      region: "London EU-West (GBR)",
      details: {
        "Workflows": "PTW, OTA, Regulatory",
        "Namespace": "og-rmm",
        "Worker": "Go SDK",
        "Mode": "simulated",
      },
    },
    {
      id: "permify",
      name: "Access Control",
      description: "Fine-grained role and attribute-based access control",
      icon: <Shield className="w-4 h-4" />,
      category: "Security",
      healthy: authz?.allowed === true,
      mode: authz?.source ?? "permify",
      lat: 41.0082, lng: 28.9784, // Istanbul (Permify origin)
      region: "Istanbul EU-East (TUR)",
      details: {
        "Schema": "og-rmm-v1",
        "Mode": authz?.source ?? "permify",
        "Entities": "user, well, field, permit",
        "Relations": "owner, operator, viewer",
      },
    },
    {
      id: "keycloak",
      name: "Identity Management",
      description: "Enterprise identity & access management — SSO federation",
      icon: <Key className="w-4 h-4" />,
      category: "Security",
      healthy: false,
      mode: "simulated",
      lat: 48.8566, lng: 2.3522, // Paris (EU identity cluster)
      region: "Paris EU-Central (FRA)",
      details: {
        "Realm": "og-rmm",
        "Clients": "og-rmm-web, og-rmm-api",
        "Protocols": "OpenID Connect, SAML 2.0",
        "MFA": "TOTP, WebAuthn",
      },
    },
    {
      id: "rtdip",
      name: "Analytics Data Lake",
      description: "Historical time-series analytics and production data lake",
      icon: <Database className="w-4 h-4" />,
      category: "Analytics",
      healthy: lakehouse?.healthy === true,
      mode: (lakehouse?.mode as string) ?? "simulated",
      lat: 51.5074, lng: -0.1278, // London (LF Energy / RTDIP origin)
      region: "London EU-West (GBR)",
      details: {
        "Ingestion rate": `${lakehouse?.ingestionRate ?? 0} msg/s`,
        "Tag count": lakehouse?.tagCount ?? 0,
        "Delta path": (lakehouse?.deltaTablePath as string) ?? "N/A",
        "Spark mode": "simulated",
      },
    },
    {
      id: "openleadr",
      name: "Demand Response",
      description: "Grid demand coordination and energy load management for GCC utilities",
      icon: <Activity className="w-4 h-4" />,
      category: "Energy",
      healthy: dr?.healthy === true,
      mode: dr?.mode ?? "simulated",
      lat: 26.2235, lng: 50.5876, // Manama, Bahrain (GCC grid operator)
      region: "Manama GCC Grid (BHR)",
      details: {
        "Version": dr?.version ?? "OpenLEADR-rs",
        "Mode": dr?.mode ?? "simulated",
        "Programs": "GCC Peak, Emergency Load Shed",
        "VENs": "3 registered",
      },
    },
    {
      id: "apisix",
      name: "API Gateway",
      description: "Secure API access management — rate limiting, authentication, routing",
      icon: <Globe className="w-4 h-4" />,
      category: "Gateway",
      healthy: false,
      mode: "simulated",
      lat: 22.3193, lng: 114.1694, // Hong Kong (APISIX origin / APAC edge)
      region: "Hong Kong APAC (HKG)",
      details: {
        "Routes": "/api/trpc, /rtdip, /v1",
        "Plugins": "jwt-auth, rate-limit, prometheus",
        "Upstream": "Node.js :3000, Python :8000, Go :8090",
        "Mode": "simulated",
      },
    },
    {
      id: "dapr",
      name: "Service Integration",
      description: "Distributed service connectivity — messaging and inter-service communication",
      icon: <Server className="w-4 h-4" />,
      category: "Runtime",
      healthy: false,
      mode: "simulated",
      lat: 47.6062, lng: -122.3321, // Seattle (Microsoft/Dapr origin)
      region: "Seattle US-West (USA)",
      details: {
        "Components": "kafka-pubsub, redis-statestore",
        "Sidecar": "dapr-sidecar:3500",
        "Observability": "Zipkin, Prometheus",
        "Mode": "simulated",
      },
    },
    {
      id: "minio",
      name: "File Storage",
      description: "Cloud object storage for analytics tables, reports, and data exports",
      icon: <Database className="w-4 h-4" />,
      category: "Storage",
      healthy: false,
      mode: "simulated",
      lat: 37.3382, lng: -121.8863, // San Jose (MinIO HQ)
      region: "San Jose US-West (USA)",
      details: {
        "Bucket": "og-rmm-lakehouse",
        "Path": "s3a://og-rmm-lakehouse/pcdm",
        "Format": "Delta Lake (Parquet)",
        "Mode": "simulated",
      },
    },
    {
      id: "openstef",
      name: "Production Forecaster",
      description: "48-hour probabilistic production and load forecasting",
      icon: <Activity className="w-4 h-4" />,
      category: "Analytics",
      healthy: (openStefStatus.data as { online?: boolean } | undefined)?.online === true,
      mode: (openStefStatus.data as { online?: boolean } | undefined)?.online ? "openstef" : "simulated",
      lat: 52.3676, lng: 4.9041, // Amsterdam (Alliander / OpenSTEF origin)
      region: "Amsterdam EU-West (NLD)",
      details: {
        "Models trained": (openstef as { model_count?: number } | undefined)?.model_count ?? 0,
        "Model dir": (openstef as { model_dir?: string } | undefined)?.model_dir ?? "/tmp/openstef_models",
        "Horizon": "48h ahead (15min resolution)",
        "Algorithms": "XGBoost quantile, LightGBM, ProLoaF",
        "Features": "Lag T-1h/24h/7d, weather, calendar, GOR",
        "DR integration": "VTN baseline & headroom engine",
      },
    },
    {
      id: "fledge",
      name: "Field Protocol Bridge",
      description: "Field device protocol bridge — RTU, relay, and flow computer integration",
      icon: <Zap className="w-4 h-4" />,
      category: "Field Protocols",
      healthy: (fledgeHealth.data as { online?: boolean } | undefined)?.online === true,
      mode: (fledgeHealth.data as { online?: boolean } | undefined)?.online ? "online" : "simulated",
      lat: 51.5074, lng: -0.1278, // London (LF Energy / Alliander UK)
      region: "London EU-West (GBR)",
      details: {
        "Protocols": "IEC 60870-5-104, DNP3 (IEEE 1815), Modbus TCP",
        "Tags bridged": "24 (9 IEC104, 7 DNP3, 8 Modbus)",
        "RTDIP forwards": (fledgeHealth.data as { rtdip_url?: string } | undefined)?.rtdip_url ?? "http://localhost:8000",
        "Mode": (fledgeHealth.data as { mode?: string } | undefined)?.mode ?? "simulated",
        "Uptime": `${(fledgeHealth.data as { uptime_seconds?: number } | undefined)?.uptime_seconds ?? 0}s`,
      },
    },
    // ── v20.0 AI / ML services ───────────────────────────────────────────────────────────────────
    {
      id: "ollama",
      name: "AI Recommendation Engine",
      description: "Local AI engine for well optimization and operational recommendations",
      icon: <Brain className="w-4 h-4" />,
      category: "AI / ML",
      healthy: mlServiceHealth.data?.available === true && mlServiceHealth.data?.ollama?.available === true,
      mode: mlServiceHealth.data?.available ? "online" : "offline",
      lat: 29.3759, lng: 47.9774, // Kuwait City (co-located with ML service)
      region: "Kuwait City Edge (KWT)",
      details: {
        "Status": mlServiceHealth.data?.available ? "online" : "offline",
        "Model": mlServiceHealth.data?.ollama?.model ?? "llama3.2",
        "Ollama available": String(mlServiceHealth.data?.ollama?.available ?? false),
        "Capabilities": mlServiceHealth.data?.capabilities ? Object.keys(mlServiceHealth.data.capabilities).join(", ") : "N/A",
        "Port": "11434",
      },
    },
    {
      id: "ml-service",
      name: "AI Analytics Service",
      description: "AI analytics service for anomaly detection, decline analysis, and optimization",
      icon: <Cpu className="w-4 h-4" />,
      category: "AI / ML",
      healthy: mlServiceHealth.data?.available === true,
      mode: mlServiceHealth.data?.available ? "online" : "offline",
      lat: 29.3759, lng: 47.9774, // Kuwait City
      region: "Kuwait City Edge (KWT)",
      details: {
        "Status": mlServiceHealth.data?.available ? "online" : "offline",
        "Port": "4003",
        "Anomaly detection": mlServiceHealth.data?.capabilities?.anomaly_detection ?? "N/A",
        "Decline calibration": mlServiceHealth.data?.capabilities?.decline_calibration ?? "N/A",
        "Recommendations": mlServiceHealth.data?.capabilities?.recommendations ?? "N/A",
      },
    },
  ];
  const categories = Array.from(new Set(services.map((s) => s.category)));;
  const onlineCount = services.filter((s) => s.healthy === true).length;
  const simulatedCount = services.filter((s) => s.mode === "simulated" && !s.healthy).length;
  const selectedService = services.find((s) => s.id === selectedServiceId) ?? null;

  const handleRefresh = () => {
    workerStatus.refetch();
    kafkaStats.refetch();
    fluvioStatusQuery.refetch();
    cacheStats.refetch();
    lakehouseStatus.refetch();
    drStatus.refetch();
    authzStatus.refetch();
    openStefStatus.refetch();
    fledgeHealth.refetch();
    fledgeStats.refetch();
    mlServiceHealth.refetch();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">System Infrastructure</h1>
          <p className="text-slate-400 text-sm mt-1">
            Platform services — {onlineCount} online, {simulatedCount} configured, auto-refresh 10s
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Tab switcher */}
          <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
            {(["map", "grid"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-amber-500 text-slate-900"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab === "map" ? "🗺 Map View" : "⊞ Grid View"}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>
      </div>

      {/* Summary KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Services", value: services.length, color: "text-slate-300" },
          { label: "Online", value: onlineCount, color: "text-emerald-400" },
          { label: "Simulated", value: simulatedCount, color: "text-blue-400" },
          {
            label: "Unavailable",
            value: services.filter((s) => !s.healthy && s.mode !== "simulated" && s.mode !== "disabled").length,
            color: "text-orange-400",
          },
        ].map((stat) => (
          <Card key={stat.label} className="bg-slate-900/60 border-slate-700/50">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-slate-400">{stat.label}</p>
              <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Map view */}
      {activeTab === "map" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Geographic Deployment Map
            </h2>
            <p className="text-xs text-slate-500 mb-3">
              Each pin represents a middleware service at its deployment region. Click a pin or a service card to
              highlight it. Colors reflect live health status.
            </p>
            <InfrastructureMap
              services={services}
              selectedId={selectedServiceId}
              onSelect={(id) => setSelectedServiceId((prev) => (prev === id ? null : id))}
            />
          </div>

          {/* Selected service detail */}
          {selectedService && (
            <ServiceDetailPanel
              service={selectedService}
              onClose={() => setSelectedServiceId(null)}
            />
          )}

          {/* Service cards below map */}
          {categories.map((cat) => (
            <div key={cat}>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{cat}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {services
                  .filter((s) => s.category === cat)
                  .map((s) => (
                    <ServiceTile
                      key={s.id}
                      service={s}
                      selected={selectedServiceId === s.id}
                      onSelect={(id) => setSelectedServiceId((prev) => (prev === id ? null : id))}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grid view */}
      {activeTab === "grid" && (
        <div className="space-y-6">
          {categories.map((cat) => (
            <div key={cat}>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{cat}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {services
                  .filter((s) => s.category === cat)
                  .map((s) => (
                    <ServiceTile
                      key={s.id}
                      service={s}
                      selected={selectedServiceId === s.id}
                      onSelect={(id) => setSelectedServiceId((prev) => (prev === id ? null : id))}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fluvio status panel */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Edge Streaming — Redundant Publish Status</h2>
        <FluvioPanelCard
          fluvio={fluvio}
          loading={fluvioStatusQuery.isLoading}
          onToggle={(enabled) => toggleFluvioDualPublish.mutate({ enabled })}
          toggling={toggleFluvioDualPublish.isPending}
        />
      </div>

      {/* Kafka topics table */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Event Streaming Topics</h2>
        <KafkaTopicsPanel />
      </div>
    </div>
  );
}

// ─── Kafka topics panel ────────────────────────────────────────────────────────

function KafkaTopicsPanel() {
  const { data } = trpc.streaming.getTopics.useQuery(undefined, { refetchInterval: 30000 });

  return (
    <Card className="bg-slate-900/60 border-slate-700/50">
      <CardContent className="pt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left text-xs text-slate-400 font-medium pb-2">Topic</th>
                <th className="text-left text-xs text-slate-400 font-medium pb-2">Partitions</th>
                <th className="text-left text-xs text-slate-400 font-medium pb-2">Retention</th>
                <th className="text-left text-xs text-slate-400 font-medium pb-2">Description</th>
              </tr>
            </thead>
            <tbody>
              {(data?.topics ?? []).map((t) => (
                <tr key={t.name} className="border-b border-slate-800/50 last:border-0">
                  <td className="py-2 font-mono text-xs text-amber-300">{t.name}</td>
                  <td className="py-2 text-slate-300">{t.partitions}</td>
                  <td className="py-2 text-slate-300">{t.retention}</td>
                  <td className="py-2 text-slate-400 text-xs">{t.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
