/**
 * Map Page — Geospatial field map with Google Maps, well markers, device overlay, and cluster overlays
 */

import { useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Layers, MapPin, Cpu, Wifi, WifiOff } from "lucide-react";
import { MapView } from "@/components/Map";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

const STATUS_COLORS: Record<WellStatus, string> = {
  ACTIVE: "#10B981",
  SHUT_IN: "#6B7280",
  DRILLING: "#3B82F6",
  WORKOVER: "#F59E0B",
  ABANDONED: "#4B5563",
};

const STATUS_LABELS: Record<WellStatus, string> = {
  ACTIVE: "Active",
  SHUT_IN: "Shut-In",
  DRILLING: "Drilling",
  WORKOVER: "Workover",
  ABANDONED: "Abandoned",
};

// Heartbeat staleness colours for device markers
function getHeartbeatColor(lastSeenAt: string | null, status: string): string {
  if (status === "online") {
    if (!lastSeenAt) return "#6B7280";
    const ageMs = Date.now() - new Date(lastSeenAt).getTime();
    if (ageMs < 5 * 60 * 1000) return "#10B981";   // < 5 min — green
    if (ageMs < 30 * 60 * 1000) return "#F59E0B";  // < 30 min — amber
    return "#EF4444";                                // > 30 min — red
  }
  const map: Record<string, string> = {
    offline: "#EF4444",
    maintenance: "#F59E0B",
    provisioning: "#6B7280",
    error: "#EF4444",
    decommissioned: "#374151",
  };
  return map[status] ?? "#6B7280";
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const ageMs = Date.now() - new Date(iso).getTime();
  if (ageMs < 60_000) return `${Math.floor(ageMs / 1000)}s ago`;
  if (ageMs < 3_600_000) return `${Math.floor(ageMs / 60_000)}m ago`;
  if (ageMs < 86_400_000) return `${Math.floor(ageMs / 3_600_000)}h ago`;
  return `${Math.floor(ageMs / 86_400_000)}d ago`;
}

type WellStatus = "ACTIVE" | "SHUT_IN" | "DRILLING" | "WORKOVER" | "ABANDONED";
type Well = { well_id: string; well_name: string; api_number: string; status: WellStatus; latitude: number; longitude: number; field_name: string; oil_bpd: number; gas_mcfd: number; water_bpd: number; uptime_pct: number; well_type?: string; esp_installed?: boolean; esp_health?: number; basin?: string; };

type DeviceMapItem = {
  deviceId: string;
  name: string;
  deviceType: string;
  status: string;
  lastSeenAt: string | null;
  firmwareVersion: string | null;
  wellId: string | null;
  wellName: string | null;
  latitude: number;
  longitude: number;
};

export default function MapPage() {
  const [selectedWell, setSelectedWell] = useState<Well | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<DeviceMapItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<WellStatus | "ALL">("ALL");
  const [showDevices, setShowDevices] = useState(false);

  // Live tRPC data
  const { data: wellsData } = trpc.wells.list.useQuery({ limit: 500 });
  const hasLiveWells = (wellsData?.wells?.length ?? 0) > 0;

  // Device map data — only fetched when layer is enabled
  const { data: deviceMapData } = trpc.deviceManagement.listForMap.useQuery(undefined, {
    refetchInterval: 30_000,
    enabled: showDevices,
  });
  const deviceMarkers: DeviceMapItem[] = (deviceMapData ?? []) as DeviceMapItem[];

  const allWells = (wellsData?.wells ?? []).map((w: any) => ({
    well_id: w.wellId,
    well_name: w.name,
    api_number: w.apiNumber ?? w.wellId,
    status: w.status as WellStatus,
    latitude: parseFloat(w.latitude ?? "29.7"),
    longitude: parseFloat(w.longitude ?? "-95.3"),
    field_name: w.field ?? "Unknown Field",
    oil_bpd: 0, gas_mcfd: 0, water_bpd: 0, uptime_pct: 0,
  } as Well));

  const filteredWells = allWells.filter(w => statusFilter === "ALL" || w.status === statusFilter);

  const handleMapReady = useCallback((map: google.maps.Map) => {
    const markers: google.maps.Marker[] = [];
    const infoWindow = new google.maps.InfoWindow();

    // ── Well markers ──────────────────────────────────────────────────────────
    filteredWells.forEach(well => {
      const color = STATUS_COLORS[well.status];

      const marker = new google.maps.Marker({
        position: { lat: well.latitude, lng: well.longitude },
        map,
        title: well.well_name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: well.status === "ACTIVE" ? 10 : 7,
          fillColor: color,
          fillOpacity: 0.9,
          strokeColor: "#0D1117",
          strokeWeight: 2,
        },
        zIndex: 10,
      });

      marker.addListener("click", () => {
        setSelectedWell(well);
        setSelectedDevice(null);
        const content = `
          <div style="background:#1C2333;border:1px solid #374151;border-radius:8px;padding:12px;min-width:200px;font-family:'DM Sans',sans-serif;color:#F9FAFB;">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px;color:#F9FAFB;">${well.well_name}</div>
            <div style="font-size:11px;color:#9CA3AF;font-family:'JetBrains Mono',monospace;margin-bottom:8px;">${well.api_number}</div>
            <div style="display:flex;gap:8px;margin-bottom:6px;">
              <span style="background:${color}20;color:${color};border:1px solid ${color}40;border-radius:4px;padding:2px 6px;font-size:10px;font-family:'JetBrains Mono',monospace;">${well.status.replace("_"," ")}</span>
              <span style="background:#1F2937;color:#9CA3AF;border-radius:4px;padding:2px 6px;font-size:10px;">${well.well_type}</span>
            </div>
            ${well.status === "ACTIVE" ? `
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;">
                <div><span style="color:#9CA3AF;">Oil:</span> <span style="color:#D97706;font-family:'JetBrains Mono',monospace;font-weight:700;">${well.oil_bpd.toLocaleString()} BPD</span></div>
                <div><span style="color:#9CA3AF;">Gas:</span> <span style="color:#3B82F6;font-family:'JetBrains Mono',monospace;">${well.gas_mcfd} Mcfd</span></div>
                <div><span style="color:#9CA3AF;">Water:</span> <span style="color:#06B6D4;font-family:'JetBrains Mono',monospace;">${well.water_bpd} BPD</span></div>
                <div><span style="color:#9CA3AF;">Uptime:</span> <span style="color:#10B981;font-family:'JetBrains Mono',monospace;">${well.uptime_pct}%</span></div>
              </div>
            ` : ""}
            ${well.esp_installed && well.esp_health !== undefined ? `
              <div style="margin-top:6px;font-size:11px;">
                <span style="color:#9CA3AF;">ESP Health:</span>
                <span style="color:${well.esp_health >= 80 ? "#10B981" : well.esp_health >= 60 ? "#F59E0B" : "#EF4444"};font-family:'JetBrains Mono',monospace;font-weight:700;margin-left:4px;">${well.esp_health}%</span>
              </div>
            ` : ""}
            <div style="margin-top:8px;font-size:10px;color:#9CA3AF;">${well.field_name} · ${well.basin}</div>
          </div>
        `;
        infoWindow.setContent(content);
        infoWindow.open(map, marker);
      });

      markers.push(marker);
    });

    // ── Device markers (offset slightly from well position to avoid overlap) ──
    if (showDevices && deviceMarkers.length > 0) {
      deviceMarkers.forEach((device, i) => {
        const color = getHeartbeatColor(device.lastSeenAt, device.status);
        // Offset devices slightly so they don't sit exactly on the well marker
        const offsetLat = device.latitude + 0.015 * Math.sin((i * 137.5 * Math.PI) / 180);
        const offsetLng = device.longitude + 0.015 * Math.cos((i * 137.5 * Math.PI) / 180);

        const deviceMarker = new google.maps.Marker({
          position: { lat: offsetLat, lng: offsetLng },
          map,
          title: device.name,
          icon: {
            path: "M -6,-6 L 6,-6 L 6,6 L -6,6 Z", // square for devices vs circle for wells
            scale: 1.2,
            fillColor: color,
            fillOpacity: 0.85,
            strokeColor: "#0D1117",
            strokeWeight: 1.5,
          },
          zIndex: 20,
        });

        deviceMarker.addListener("click", () => {
          setSelectedDevice(device);
          setSelectedWell(null);
          const ageLabel = formatRelativeTime(device.lastSeenAt);
          const content = `
            <div style="background:#1C2333;border:1px solid #374151;border-radius:8px;padding:12px;min-width:200px;font-family:'DM Sans',sans-serif;color:#F9FAFB;">
              <div style="font-weight:700;font-size:13px;margin-bottom:2px;color:#F9FAFB;">${device.name}</div>
              <div style="font-size:10px;color:#9CA3AF;font-family:'JetBrains Mono',monospace;margin-bottom:8px;">${device.deviceId}</div>
              <div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
                <span style="background:${color}20;color:${color};border:1px solid ${color}40;border-radius:4px;padding:2px 6px;font-size:10px;font-family:'JetBrains Mono',monospace;">${device.status.toUpperCase()}</span>
                <span style="background:#1F2937;color:#9CA3AF;border-radius:4px;padding:2px 6px;font-size:10px;">${device.deviceType}</span>
              </div>
              <div style="font-size:11px;color:#9CA3AF;">Last seen: <span style="color:#F9FAFB;">${ageLabel}</span></div>
              ${device.firmwareVersion ? `<div style="font-size:11px;color:#9CA3AF;margin-top:2px;">FW: <span style="color:#F9FAFB;font-family:'JetBrains Mono',monospace;">${device.firmwareVersion}</span></div>` : ""}
              ${device.wellName ? `<div style="margin-top:6px;font-size:10px;color:#9CA3AF;">Well: ${device.wellName}</div>` : ""}
            </div>
          `;
          infoWindow.setContent(content);
          infoWindow.open(map, deviceMarker);
        });

        markers.push(deviceMarker);
      });
    }

    // Fit bounds to all wells
    if (filteredWells.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      filteredWells.forEach(w => bounds.extend({ lat: w.latitude, lng: w.longitude }));
      map.fitBounds(bounds, 80);
    }
  }, [filteredWells, showDevices, deviceMarkers]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 md:px-6 py-3 border-b border-border/50 bg-card/50 backdrop-blur-sm flex items-center justify-between gap-3 shrink-0 flex-wrap">
        <div>
          <h1 className="text-base font-bold font-[Syne]">Field Map</h1>
          <p className="text-[10px] text-muted-foreground font-mono">
            {filteredWells.length} wells
            {showDevices && deviceMarkers.length > 0 && ` · ${deviceMarkers.length} devices`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status filter */}
          {(["ALL", "ACTIVE", "SHUT_IN", "DRILLING", "WORKOVER"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono border transition-all",
                statusFilter === s
                  ? "bg-amber-950/40 border-amber-700/50 text-amber-400"
                  : "border-border/40 text-muted-foreground hover:border-amber-700/30 hover:text-foreground"
              )}
            >
              {s !== "ALL" && (
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLORS[s as WellStatus] }} />
              )}
              {s === "ALL" ? "All" : STATUS_LABELS[s as WellStatus]}
            </button>
          ))}

          {/* Device layer toggle */}
          <button
            onClick={() => setShowDevices(v => !v)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono border transition-all",
              showDevices
                ? "bg-cyan-950/40 border-cyan-700/50 text-cyan-400"
                : "border-border/40 text-muted-foreground hover:border-cyan-700/30 hover:text-foreground"
            )}
          >
            <Cpu className="w-3 h-3" />
            Devices
            {showDevices && deviceMarkers.length > 0 && (
              <span className="bg-cyan-900/50 text-cyan-300 rounded px-1 text-[9px]">{deviceMarkers.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* Map + sidebar */}
      <div className="flex flex-1 min-h-0">
        {/* Map */}
        <div className="flex-1 relative">
          <MapView
            key={`${statusFilter}-${showDevices}-${deviceMarkers.length}`}
            onMapReady={handleMapReady}
            initialCenter={{ lat: 37.5, lng: -100 }}
            initialZoom={4}
            className="w-full h-full"
          />

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm border border-border/50 rounded-lg p-3 space-y-1.5">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Layers className="w-3 h-3" />
              Legend
            </div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5" /> Wells
            </div>
            {Object.entries(STATUS_LABELS).map(([status, label]) => (
              <div key={status} className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLORS[status as WellStatus] }} />
                {label}
              </div>
            ))}
            {showDevices && (
              <>
                <div className="text-[9px] text-muted-foreground uppercase tracking-wide mt-2 mb-1 flex items-center gap-1">
                  <Cpu className="w-2.5 h-2.5" /> Devices (heartbeat)
                </div>
                {[
                  { color: "#10B981", label: "< 5 min" },
                  { color: "#F59E0B", label: "5–30 min" },
                  { color: "#EF4444", label: "> 30 min / offline" },
                  { color: "#6B7280", label: "Provisioning" },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                    {label}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Selected well panel */}
        {selectedWell && !selectedDevice && (
          <div className="w-64 border-l border-border/50 bg-card overflow-y-auto p-4 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold font-[Syne]">{selectedWell.well_name}</h3>
              <button onClick={() => setSelectedWell(null)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">API</span>
                <span className="font-mono text-[10px]">{selectedWell.api_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Basin</span>
                <span>{selectedWell.basin}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Field</span>
                <span className="text-right max-w-[120px]">{selectedWell.field_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Depth</span>
                <span className="font-mono">{(selectedWell as any).total_depth_ft?.toLocaleString() ?? "—"} ft</span>
              </div>
            </div>

            {selectedWell.status === "ACTIVE" && (
              <div className="space-y-2 pt-2 border-t border-border/50">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Production</div>
                {[
                  { label: "Oil", value: `${selectedWell.oil_bpd.toLocaleString()} BPD`, color: "text-amber-400" },
                  { label: "Gas", value: `${selectedWell.gas_mcfd} Mcfd`, color: "text-blue-400" },
                  { label: "Water", value: `${selectedWell.water_bpd} BPD`, color: "text-cyan-400" },
                  { label: "Uptime", value: `${selectedWell.uptime_pct}%`, color: "text-emerald-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={cn("font-mono font-bold", color)}>{value}</span>
                  </div>
                ))}
              </div>
            )}

            {selectedWell.esp_installed && selectedWell.esp_health !== undefined && (
              <div className="pt-2 border-t border-border/50">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">ESP Health</div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", selectedWell.esp_health >= 80 ? "bg-emerald-500" : selectedWell.esp_health >= 60 ? "bg-amber-500" : "bg-red-500")}
                    style={{ width: `${selectedWell.esp_health}%` }}
                  />
                </div>
                <div className={cn("text-sm font-mono font-bold mt-1", selectedWell.esp_health >= 80 ? "text-emerald-400" : selectedWell.esp_health >= 60 ? "text-amber-400" : "text-red-400")}>
                  {selectedWell.esp_health}%
                </div>
              </div>
            )}

            <Link href={`/wells/${selectedWell.well_id}`}>
              <div className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 cursor-pointer pt-2 border-t border-border/50">
                <ArrowUpRight className="w-3.5 h-3.5" />
                Open Well Detail
              </div>
            </Link>
          </div>
        )}

        {/* Selected device panel */}
        {selectedDevice && !selectedWell && (
          <div className="w-64 border-l border-border/50 bg-card overflow-y-auto p-4 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold font-[Syne] truncate max-w-[140px]">{selectedDevice.name}</h3>
              </div>
              <button onClick={() => setSelectedDevice(null)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
            </div>

            {/* Status badge */}
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: getHeartbeatColor(selectedDevice.lastSeenAt, selectedDevice.status) }} />
              <span className="text-xs font-mono" style={{ color: getHeartbeatColor(selectedDevice.lastSeenAt, selectedDevice.status) }}>
                {selectedDevice.status.toUpperCase()}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Device ID</span>
                <span className="font-mono text-[10px] truncate max-w-[110px]">{selectedDevice.deviceId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-mono text-[10px]">{selectedDevice.deviceType}</span>
              </div>
              {selectedDevice.firmwareVersion && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Firmware</span>
                  <span className="font-mono text-[10px]">{selectedDevice.firmwareVersion}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Seen</span>
                <span className={cn("font-mono text-[10px]", (() => {
                  const color = getHeartbeatColor(selectedDevice.lastSeenAt, selectedDevice.status);
                  if (color === "#10B981") return "text-emerald-400";
                  if (color === "#F59E0B") return "text-amber-400";
                  return "text-red-400";
                })())}>
                  {formatRelativeTime(selectedDevice.lastSeenAt)}
                </span>
              </div>
              {selectedDevice.wellName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Well</span>
                  <span className="text-right max-w-[120px]">{selectedDevice.wellName}</span>
                </div>
              )}
            </div>

            {/* Heartbeat indicator */}
            <div className="pt-2 border-t border-border/50">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Heartbeat Status</div>
              {selectedDevice.status === "online" ? (
                <div className="flex items-center gap-2 text-xs text-emerald-400">
                  <Wifi className="w-3.5 h-3.5" />
                  Device is reporting
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-red-400">
                  <WifiOff className="w-3.5 h-3.5" />
                  No heartbeat
                </div>
              )}
            </div>

            <Link href="/device-management">
              <div className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer pt-2 border-t border-border/50">
                <ArrowUpRight className="w-3.5 h-3.5" />
                Open Device Management
              </div>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
