/**
 * FPSO.tsx — FPSO/HPU Asset Overview & Subsea Tree Visualization
 * Design: Dark Amber — charcoal bg, amber accents, deep-sea blue for subsea elements
 * WT Petrotech Gap Closure: FPSO/HPU, Subsea Trees, Umbilicals
 */

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Activity, AlertTriangle, Anchor, ArrowDown, ArrowUp,
  Droplets, Gauge, Layers, Settings, Ship, Thermometer,
  Waves, Wind, Zap
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";
type FPSOVessel = any;
type HPUUnit = any;
type SubseaTree = any;
import { trpc } from "@/lib/trpc";
import SubseaField3D from "@/components/subsea/SubseaField3D";

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(status: string) {
  switch (status) {
    case "ACTIVE": return "text-emerald-400";
    case "SHUT_IN": return "text-amber-400";
    case "WORKOVER": return "text-orange-400";
    default: return "text-red-400";
  }
}

function statusBadge(status: string) {
  switch (status) {
    case "ACTIVE": return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Active</Badge>;
    case "SHUT_IN": return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Shut-In</Badge>;
    default: return <Badge variant="destructive">{status}</Badge>;
  }
}

// Simulated 24h production trend
const productionTrend = Array.from({ length: 24 }, (_, i) => ({
  hour: `${String(i).padStart(2, "0")}:00`,
  oil: 128400 + Math.sin(i * 0.4) * 3000 + Math.cos(i * 0.7) * 500,
  gas: 154.2 + Math.sin(i * 0.3) * 5 + Math.cos(i * 0.9) * 1,
}));

// ── FPSO Card ─────────────────────────────────────────────────────────────────

function FPSOCard({ vessel, onSelect }: { vessel: FPSOVessel; onSelect: (v: FPSOVessel) => void }) {
  return (
    <Card
      className="bg-card border-border hover:border-amber-600/40 transition-all cursor-pointer group"
      onClick={() => onSelect(vessel)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Ship className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold font-[Syne] text-foreground group-hover:text-amber-400 transition-colors">
                {vessel.vessel_name}
              </CardTitle>
              <div className="text-xs text-muted-foreground font-mono">{vessel.imo_number}</div>
            </div>
          </div>
          {statusBadge(vessel.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Production KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="text-lg font-bold font-mono text-amber-400">
              {(Number(vessel.current_production_bpd ?? (vessel as any).currentProductionBpd ?? 0) / 1000).toFixed(1)}k
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">BPD Oil</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold font-mono text-blue-400">
              {Number(vessel.current_gas_mmscfd ?? (vessel as any).currentGasMmscfd ?? 0).toFixed(1)}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">MMSCFD</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold font-mono text-emerald-400">
              {vessel.storage_utilization_pct ?? (vessel as any).storageUtilizationPct ?? 0}%
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Storage</div>
          </div>
        </div>

        {/* Storage utilization bar */}
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Storage Utilization</span>
            <span className="font-mono">{(Number(vessel.oil_storage_bbl ?? (vessel as any).oilStorageBbl ?? 0) * Number(vessel.storage_utilization_pct ?? (vessel as any).storageUtilizationPct ?? 0) / 100 / 1000).toFixed(0)}k / {(Number(vessel.oil_storage_bbl ?? (vessel as any).oilStorageBbl ?? 0) / 1000).toFixed(0)}k BBL</span>
          </div>
          <Progress value={vessel.storage_utilization_pct ?? (vessel as any).storageUtilizationPct ?? 0} className="h-1.5" />
        </div>

        {/* Asset counts */}
        <div className="flex gap-4 pt-1 border-t border-border">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>{vessel.subsea_tree_count} Trees</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Gauge className="w-3.5 h-3.5 text-amber-400" />
            <span>{vessel.hpu_count} HPUs</span>
          </div>
          {vessel.active_alarms > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-red-400 ml-auto">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{vessel.active_alarms} Alarms</span>
            </div>
          )}
        </div>

        {/* Location */}
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Anchor className="w-3 h-3" />
          <span>{Number(vessel.latitude ?? 0).toFixed(2)}°N, {Math.abs(Number(vessel.longitude ?? 0)).toFixed(2)}°W — {vessel.water_depth_m ?? (vessel as any).waterDepthM ?? 0}m WD</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── HPU Panel ─────────────────────────────────────────────────────────────────

function HPUPanel({ hpu }: { hpu: HPUUnit }) {
  const pressureUtilization = (hpu.system_pressure_psi / hpu.rated_pressure_psi) * 100;
  const flowUtilization = (hpu.flow_rate_lpm / hpu.rated_flow_lpm) * 100;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-amber-400" />
            <div>
              <div className="text-sm font-bold font-[Syne]">{hpu.hpu_tag}</div>
              <div className="text-xs text-muted-foreground">{hpu.hpu_name}</div>
            </div>
          </div>
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
            {hpu.pump1_running && hpu.pump2_running ? "Dual Pump" : hpu.pump1_running ? "Pump 1" : "Standby"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Pressure */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">System Pressure</span>
            <span className="font-mono text-amber-400">{hpu.system_pressure_psi.toLocaleString()} PSI</span>
          </div>
          <Progress value={pressureUtilization} className="h-1.5" />
          <div className="text-[10px] text-muted-foreground mt-0.5">Rated: {hpu.rated_pressure_psi.toLocaleString()} PSI</div>
        </div>

        {/* Flow rate */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Flow Rate</span>
            <span className="font-mono text-blue-400">{hpu.flow_rate_lpm} L/min</span>
          </div>
          <Progress value={flowUtilization} className="h-1.5" />
        </div>

        {/* Grid of readings */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Accumulator</div>
            <div className="text-sm font-mono text-foreground">{hpu.accumulator_pressure_psi.toLocaleString()} PSI</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Reservoir</div>
            <div className="text-sm font-mono text-foreground">{hpu.reservoir_level_pct}%</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Fluid Temp</div>
            <div className={`text-sm font-mono ${hpu.fluid_temp_c > 55 ? "text-red-400" : "text-foreground"}`}>
              {hpu.fluid_temp_c}°C
            </div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Alarms</div>
            <div className={`text-sm font-mono ${hpu.low_level_alarm || hpu.high_temp_alarm ? "text-red-400" : "text-emerald-400"}`}>
              {hpu.low_level_alarm || hpu.high_temp_alarm ? "ACTIVE" : "CLEAR"}
            </div>
          </div>
        </div>

        {/* Pump status */}
        <div className="flex gap-2">
          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border ${hpu.pump1_running ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-muted border-border text-muted-foreground"}`}>
            <Zap className="w-3 h-3" />
            <span>Pump 1</span>
          </div>
          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border ${hpu.pump2_running ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-muted border-border text-muted-foreground"}`}>
            <Zap className="w-3 h-3" />
            <span>Pump 2</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Subsea Tree Card ──────────────────────────────────────────────────────────

function SubseaTreeCard({ tree }: { tree: SubseaTree }) {
  return (
    <Card className={`bg-card border-border ${tree.status === "SHUT_IN" ? "border-amber-600/30" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-blue-900/40 border border-blue-500/20 flex items-center justify-center">
              <Waves className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <div className="text-sm font-bold font-mono">{tree.tree_tag}</div>
              <div className="text-xs text-muted-foreground">{tree.water_depth_m}m WD · {tree.tree_type}</div>
            </div>
          </div>
          {statusBadge(tree.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Pressure readings */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/30 rounded p-2">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Tubing Pressure</div>
            <div className="text-sm font-mono text-amber-400 font-bold">{tree.tubing_pressure_psi.toLocaleString()} PSI</div>
          </div>
          <div className="bg-muted/30 rounded p-2">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Annulus Pressure</div>
            <div className="text-sm font-mono text-blue-400 font-bold">{tree.annulus_pressure_psi.toLocaleString()} PSI</div>
          </div>
          <div className="bg-muted/30 rounded p-2">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Tree Temp</div>
            <div className="text-sm font-mono text-foreground">{tree.tree_temp_f}°F</div>
          </div>
          <div className="bg-muted/30 rounded p-2">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Choke Position</div>
            <div className={`text-sm font-mono font-bold ${tree.choke_position_pct > 0 ? "text-emerald-400" : "text-muted-foreground"}`}>
              {tree.choke_position_pct}%
            </div>
          </div>
        </div>

        {/* Valve status row */}
        <div className="flex gap-1.5 flex-wrap">
          {[
            { label: "MV", open: tree.master_valve_open },
            { label: "WV", open: tree.wing_valve_open },
            { label: "SV", open: tree.swab_valve_open },
          ].map(({ label, open }) => (
            <div
              key={label}
              className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${
                open
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-red-500/10 border-red-500/30 text-red-400"
              }`}
            >
              {label}: {open ? "OPEN" : "CLOSED"}
            </div>
          ))}
        </div>

        {/* Umbilical hydraulic pressure */}
        <div className="text-xs text-muted-foreground flex items-center justify-between border-t border-border pt-2">
          <span>Umbilical Hyd. Pressure</span>
          <span className="font-mono text-foreground">{tree.umbilical_hydraulic_pressure_psi.toLocaleString()} PSI</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Subsea Schematic (SVG) ────────────────────────────────────────────────────

function SubseaSchematic({ trees, vessel }: { trees: SubseaTree[]; vessel: FPSOVessel }) {
  return (
    <Card className="bg-card border-border col-span-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-[Syne] flex items-center gap-2">
          <Waves className="w-4 h-4 text-blue-400" />
          Subsea Architecture — {vessel.vessel_name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative w-full overflow-x-auto">
          <svg viewBox="0 0 900 340" className="w-full min-w-[600px]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {/* Sea surface */}
            <defs>
              <linearGradient id="seaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0c1a2e" />
                <stop offset="100%" stopColor="#0a1628" />
              </linearGradient>
              <linearGradient id="umbilicalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d97706" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
              <pattern id="seaPattern" x="0" y="0" width="40" height="8" patternUnits="userSpaceOnUse">
                <path d="M0 4 Q10 0 20 4 Q30 8 40 4" stroke="#1e3a5f" strokeWidth="0.5" fill="none" opacity="0.4" />
              </pattern>
            </defs>

            {/* Sky / surface zone */}
            <rect x="0" y="0" width="900" height="60" fill="#0d1117" />
            {/* Sea surface line */}
            <rect x="0" y="55" width="900" height="8" fill="url(#seaPattern)" />
            <text x="10" y="40" fill="#6b7280" fontSize="9" fontWeight="600" letterSpacing="2">SEA SURFACE</text>

            {/* FPSO vessel */}
            <rect x="340" y="5" width="220" height="45" rx="4" fill="#1a2744" stroke="#1d4ed8" strokeWidth="1.5" />
            <rect x="380" y="8" width="140" height="20" rx="2" fill="#0f1c38" />
            <text x="450" y="22" fill="#60a5fa" fontSize="9" fontWeight="700" textAnchor="middle" letterSpacing="1">FPSO</text>
            <text x="450" y="38" fill="#9ca3af" fontSize="7" textAnchor="middle">{vessel.vessel_name.substring(0, 20)}</text>

            {/* Water column */}
            <rect x="0" y="63" width="900" height="277" fill="url(#seaGrad)" opacity="0.7" />
            <text x="10" y="85" fill="#374151" fontSize="8" letterSpacing="1">WATER COLUMN — {vessel.water_depth_m}m</text>

            {/* Seabed */}
            <rect x="0" y="310" width="900" height="30" fill="#1a1208" />
            <text x="10" y="325" fill="#6b7280" fontSize="8" letterSpacing="2">SEABED</text>

            {/* Manifold */}
            <rect x="380" y="270" width="140" height="35" rx="3" fill="#1a2744" stroke="#1d4ed8" strokeWidth="1.5" />
            <text x="450" y="286" fill="#60a5fa" fontSize="8" fontWeight="700" textAnchor="middle">MANIFOLD</text>
            <text x="450" y="298" fill="#9ca3af" fontSize="7" textAnchor="middle">SM-A01</text>

            {/* Riser from FPSO to manifold */}
            <line x1="450" y1="50" x2="450" y2="270" stroke="#d97706" strokeWidth="2" strokeDasharray="6,3" opacity="0.6" />
            <text x="458" y="160" fill="#d97706" fontSize="7" opacity="0.8">RISER</text>

            {/* Trees */}
            {trees.slice(0, 3).map((tree, i) => {
              const x = 130 + i * 220;
              const y = 230;
              const isOpen = tree.master_valve_open && tree.wing_valve_open;
              const color = isOpen ? "#10b981" : tree.status === "SHUT_IN" ? "#f59e0b" : "#ef4444";

              return (
                <g key={tree.tree_id}>
                  {/* Umbilical from FPSO */}
                  <line
                    x1={x + 25}
                    y1="50"
                    x2={x + 25}
                    y2={y}
                    stroke="#d97706"
                    strokeWidth="1.5"
                    strokeDasharray="4,3"
                    opacity="0.5"
                  />
                  {/* Flowline to manifold */}
                  <line
                    x1={x + 25}
                    y1={y + 40}
                    x2="380"
                    y2="287"
                    stroke="#1d4ed8"
                    strokeWidth="1.5"
                    opacity="0.5"
                  />

                  {/* Tree body */}
                  <rect x={x} y={y} width="50" height="40" rx="3" fill="#1a2744" stroke={color} strokeWidth="1.5" />
                  <text x={x + 25} y={y + 14} fill={color} fontSize="8" fontWeight="700" textAnchor="middle">{tree.tree_tag}</text>
                  <text x={x + 25} y={y + 25} fill="#9ca3af" fontSize="6.5" textAnchor="middle">{tree.water_depth_m}m</text>
                  <text x={x + 25} y={y + 35} fill={color} fontSize="6" textAnchor="middle" fontWeight="600">
                    {isOpen ? "FLOWING" : "SHUT-IN"}
                  </text>

                  {/* Wellbore */}
                  <line x1={x + 25} y1={y + 40} x2={x + 25} y2="310" stroke="#374151" strokeWidth="2" />

                  {/* Pressure label */}
                  <text x={x + 30} y={y - 8} fill="#d97706" fontSize="7" opacity="0.8">
                    {tree.tubing_pressure_psi.toLocaleString()} PSI
                  </text>
                </g>
              );
            })}

            {/* Legend */}
            <g transform="translate(720, 80)">
              <text x="0" y="0" fill="#6b7280" fontSize="7" fontWeight="600" letterSpacing="1">LEGEND</text>
              <line x1="0" y1="10" x2="20" y2="10" stroke="#d97706" strokeWidth="1.5" strokeDasharray="4,2" />
              <text x="24" y="14" fill="#9ca3af" fontSize="7">Umbilical</text>
              <line x1="0" y1="24" x2="20" y2="24" stroke="#1d4ed8" strokeWidth="1.5" />
              <text x="24" y="28" fill="#9ca3af" fontSize="7">Flowline</text>
              <rect x="0" y="36" width="12" height="8" rx="1" fill="#1a2744" stroke="#10b981" strokeWidth="1" />
              <text x="16" y="44" fill="#9ca3af" fontSize="7">Flowing</text>
              <rect x="0" y="50" width="12" height="8" rx="1" fill="#1a2744" stroke="#f59e0b" strokeWidth="1" />
              <text x="16" y="58" fill="#9ca3af" fontSize="7">Shut-In</text>
            </g>
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FPSOPage() {
  const { data: liveVessels } = trpc.fpso.vessels.useQuery();
  const { data: liveHpus } = trpc.fpso.hpuUnits.useQuery({});
  const { data: liveTrees } = trpc.fpso.subseaTrees.useQuery({});

  const allVessels: any[] = (liveVessels as any[]) ?? [];
  const allHpus: any[] = (liveHpus as any[]) ?? [];
  const allTrees: any[] = (liveTrees as any[]) ?? [];

  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const selectedVessel: FPSOVessel = (allVessels.find((v: any) =>
    (v.vessel_id ?? v.vesselId) === selectedVesselId
  ) ?? allVessels[0] ?? {}) as FPSOVessel;

  const vesselHPUs = allHpus.filter((h: any) => h.vessel_id === (selectedVessel as any).vessel_id || h.vesselId === (selectedVessel as any).vessel_id);
  const vesselTrees = allTrees.filter((t: any) => t.vessel_id === (selectedVessel as any).vessel_id || t.vesselId === (selectedVessel as any).vessel_id);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-[Syne] text-foreground">
            FPSO & Offshore Assets
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Offshore production systems · Subsea equipment · Umbilical monitoring · Manifold control
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="live-indicator" />
          <span className="text-xs text-muted-foreground">Live telemetry</span>
        </div>
      </div>

      {/* Fleet KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Production", value: `${((allVessels.reduce((s: number, v: any) => s + (v.current_production_bpd ?? v.currentProductionBpd ?? 0), 0)) / 1000).toFixed(1)}k`, unit: "BPD", icon: Droplets, color: "text-amber-400" },
          { label: "Gas Production", value: `${allVessels.reduce((s: number, v: any) => s + (v.current_gas_mmscfd ?? v.currentGasMmscfd ?? 0), 0).toFixed(1)}`, unit: "MMSCFD", icon: Wind, color: "text-blue-400" },
          { label: "FPSO Vessels", value: allVessels.length.toString(), unit: "Online", icon: Ship, color: "text-emerald-400" },
          { label: "Subsea Trees", value: allTrees.length.toString(), unit: "Installed", icon: Waves, color: "text-cyan-400" },
        ].map(({ label, value, unit, icon: Icon, color }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div>
                  <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
                  <div className="text-[10px] text-muted-foreground">{unit}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* FPSO selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {allVessels.map((v: any) => (
          <FPSOCard
            key={v.vessel_id ?? v.vesselId}
            vessel={v as FPSOVessel}
            onSelect={(vessel) => setSelectedVesselId((vessel as any).vessel_id ?? (vessel as any).vesselId)}
          />
        ))}
      </div>

      {/* Selected vessel detail */}
      <div className="border border-amber-600/20 rounded-xl p-1 bg-amber-600/5">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-amber-600/20">
          <Ship className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-bold font-[Syne] text-amber-400">{selectedVessel.vessel_name}</span>
          <span className="text-xs text-muted-foreground ml-2">— Detailed View</span>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="p-4">
          <TabsList className="bg-muted/50 mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="hpu">HPU Units ({vesselHPUs.length})</TabsTrigger>
            <TabsTrigger value="subsea">Subsea Trees ({vesselTrees.length})</TabsTrigger>
            <TabsTrigger value="3d">3D Field View</TabsTrigger>
            <TabsTrigger value="schematic">Schematic</TabsTrigger>
          </TabsList>

          {/* Overview tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 24h production chart */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-[Syne]">24-Hour Production</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={productionTrend}>
                      <defs>
                        <linearGradient id="oilGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#d97706" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#6b7280" }} interval={5} />
                      <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
                      <Tooltip
                        contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "11px" }}
                        labelStyle={{ color: "#9ca3af" }}
                      />
                      <Area type="monotone" dataKey="oil" stroke="#d97706" strokeWidth={2} fill="url(#oilGrad)" name="Oil (BPD)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Vessel specs */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-[Syne]">Vessel Specifications</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      ["IMO Number", selectedVessel.imo_number],
                      ["Vessel Type", selectedVessel.vessel_type],
                      ["Mooring Type", selectedVessel.mooring_type],
                      ["Water Depth", `${selectedVessel.water_depth_m}m`],
                      ["Oil Storage", `${(selectedVessel.oil_storage_bbl / 1_000_000).toFixed(1)}M BBL`],
                      ["Processing Capacity", `${(selectedVessel.processing_capacity_bpd / 1000).toFixed(0)}k BPD`],
                      ["Gas Processing", `${selectedVessel.gas_processing_mmscfd} MMSCFD`],
                      ["Operator", selectedVessel.operator],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="font-mono text-foreground">{v}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* HPU tab */}
          <TabsContent value="hpu">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vesselHPUs.length > 0 ? (
                vesselHPUs.map(hpu => <HPUPanel key={hpu.hpu_id} hpu={hpu} />)
              ) : (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  No HPU units registered for this vessel
                </div>
              )}
            </div>
          </TabsContent>

          {/* Subsea trees tab */}
          <TabsContent value="subsea">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vesselTrees.length > 0 ? (
                vesselTrees.map(tree => <SubseaTreeCard key={tree.tree_id} tree={tree} />)
              ) : (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  No subsea trees registered for this vessel
                </div>
              )}
            </div>
          </TabsContent>

          {/* 3D Field View tab */}
          <TabsContent value="3d">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Interactive 3D subsea field — {vesselTrees.length} trees · 1 manifold · {vesselHPUs.length} HPU units</span>
              </div>
              <SubseaField3D height={560} trees={vesselTrees} />
            </div>
          </TabsContent>

          {/* Schematic tab */}
          <TabsContent value="schematic">
            <div className="grid grid-cols-1 gap-4">
              <SubseaSchematic trees={vesselTrees} vessel={selectedVessel} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
