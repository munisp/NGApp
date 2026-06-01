/**
 * DigitalTwinV42.tsx — Enhanced 3D Digital Twin Platform v45.0
 * - Live Three.js 3D well model with animated ESP, fluid particles, perforations
 * - Real-time telemetry bindings (5s polling)
 * - Rust Physics Engine nodal analysis (IPR/VLP curves)
 * - Unreal Engine Pixel Streaming FPSO session management
 * - Manual override sliders for demo/testing
 */
import { useRef, useState, useEffect, Suspense, lazy } from "react";
const EquipmentViewer3D = lazy(() => import("@/components/EquipmentViewer3D").then(m => ({ default: m.EquipmentViewer3D })));
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Environment } from "@react-three/drei";
import * as THREE from "three";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Box, Monitor, Cpu, RefreshCw, Plus, Play, Square, Wifi,
  Gauge, Thermometer, Droplets, Zap, Activity, BarChart3, Loader2,
  AlertTriangle, CheckCircle2, Settings2, Package
} from "lucide-react";
import {
  LineChart, Line as ReLine, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

// ─── Three.js color constants ─────────────────────────────────────────────────
const COL = {
  casing: "#374151",
  tubing: "#1d4ed8",
  esp: "#d97706",
  espActive: "#f59e0b",
  choke: "#dc2626",
  chokeOpen: "#16a34a",
  fluid: "#0ea5e9",
  ground: "#1a2e1a",
  reservoir: "#7c2d12",
};

// ─── ESP Motor (animated impeller) ───────────────────────────────────────────
function EspMotor({ active, frequency }: { active: boolean; frequency: number }) {
  const impellerRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (impellerRef.current && active) {
      impellerRef.current.rotation.y += delta * (frequency / 60) * Math.PI * 4;
    }
  });
  return (
    <group position={[0, -6, 0]}>
      {/* Motor body */}
      <mesh castShadow>
        <cylinderGeometry args={[0.18, 0.18, 2.5, 16]} />
        <meshStandardMaterial color={active ? COL.espActive : COL.esp} metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Rotating impeller ring */}
      <mesh ref={impellerRef} position={[0, 1.4, 0]}>
        <torusGeometry args={[0.14, 0.04, 8, 16]} />
        <meshStandardMaterial
          color={COL.espActive} metalness={0.9} roughness={0.1}
          emissive={active ? COL.espActive : "#000000"}
          emissiveIntensity={active ? 0.3 : 0}
        />
      </mesh>
      {/* Pump stages */}
      {[-0.8, -0.3, 0.2, 0.7].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <cylinderGeometry args={[0.21, 0.21, 0.15, 16]} />
          <meshStandardMaterial color="#1e3a5f" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}
      {/* Power cable */}
      <mesh position={[0.22, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 2.5, 8]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
    </group>
  );
}

// ─── Fluid particle system ────────────────────────────────────────────────────
function FluidParticles({ active, flowRate }: { active: boolean; flowRate: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const pos = useRef(new Float32Array(60 * 3));
  const vel = useRef(new Float32Array(60));
  useEffect(() => {
    for (let i = 0; i < 60; i++) {
      pos.current[i * 3] = (Math.random() - 0.5) * 0.12;
      pos.current[i * 3 + 1] = Math.random() * 14 - 10;
      pos.current[i * 3 + 2] = (Math.random() - 0.5) * 0.12;
      vel.current[i] = 0.02 + Math.random() * 0.04;
    }
  }, []);
  useFrame(() => {
    if (!pointsRef.current || !active) return;
    const speed = (flowRate / 1000) * 0.15;
    for (let i = 0; i < 60; i++) {
      pos.current[i * 3 + 1] += vel.current[i] * speed;
      if (pos.current[i * 3 + 1] > 4) pos.current[i * 3 + 1] = -10;
    }
    (pointsRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });
  if (!active) return null;
  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos.current, 3]} />
      </bufferGeometry>
      <pointsMaterial color={COL.fluid} size={0.06} transparent opacity={0.7} />
    </points>
  );
}

// ─── Well telemetry type ──────────────────────────────────────────────────────
interface WellTel {
  tubingPressure: number; casingPressure: number; flowRate: number; waterCut: number;
  espFrequency: number; espCurrent: number; wellheadTemp: number; chokePosition: number; bhp: number;
}

// ─── 3D Well Model ────────────────────────────────────────────────────────────
function WellModel({ tel, alarm }: { tel: WellTel; alarm: "normal" | "warning" | "critical" }) {
  const alarmLightRef = useRef<THREE.PointLight>(null);
  const espActive = tel.espFrequency > 0;
  const chokeOpen = tel.chokePosition > 5;
  const alarmColor = alarm === "critical" ? "#ef4444" : alarm === "warning" ? "#f59e0b" : "#22c55e";

  useFrame(({ clock }) => {
    if (alarmLightRef.current && alarm !== "normal") {
      alarmLightRef.current.intensity = 0.8 + Math.sin(clock.elapsedTime * 4) * 0.5;
    }
  });

  return (
    <group>
      {/* Ground plane */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color={COL.ground} roughness={0.9} />
      </mesh>
      <gridHelper args={[8, 16, "#1f2937", "#1f2937"]} position={[0, 0.01, 0]} />

      {/* Formation layers */}
      {[
        { y: -2, color: "#1c1917", label: "Overburden Shale", depth: "0–2000 ft" },
        { y: -5, color: "#292524", label: "Limestone", depth: "2000–5000 ft" },
        { y: -8.5, color: "#7c2d12", label: "Reservoir Sandstone", depth: "5000–8500 ft" },
      ].map(({ y, color, label, depth }) => (
        <group key={label}>
          <mesh position={[0, y, 0]}>
            <cylinderGeometry args={[3.5, 3.5, 1.5, 32, 1, true]} />
            <meshStandardMaterial color={color} side={THREE.BackSide} transparent opacity={0.4} />
          </mesh>
          <Html position={[3.8, y, 0]} center>
            <div style={{ fontSize: 9, color: "#71717a", whiteSpace: "nowrap", fontFamily: "monospace", background: "rgba(0,0,0,0.6)", padding: "1px 4px", borderRadius: 3 }}>
              {label}<br /><span style={{ color: "#52525b" }}>{depth}</span>
            </div>
          </Html>
        </group>
      ))}

      {/* Conductor casing */}
      <mesh position={[0, -1.5, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 3, 16, 1, true]} />
        <meshStandardMaterial color="#4b5563" metalness={0.8} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* Surface casing */}
      <mesh position={[0, -4, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 8, 16, 1, true]} />
        <meshStandardMaterial color={COL.casing} metalness={0.75} roughness={0.35} side={THREE.DoubleSide} />
      </mesh>
      {/* Production casing */}
      <mesh position={[0, -7, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 10, 16, 1, true]} />
        <meshStandardMaterial color="#1e3a5f" metalness={0.7} roughness={0.4} side={THREE.DoubleSide} />
      </mesh>
      {/* Tubing string */}
      <mesh position={[0, -5, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 14, 12, 1, true]} />
        <meshStandardMaterial color={COL.tubing} metalness={0.8} roughness={0.2} side={THREE.DoubleSide} />
      </mesh>
      {/* Cement annulus */}
      <mesh position={[0, -5, 0]}>
        <cylinderGeometry args={[0.38, 0.38, 8, 16, 1, true]} />
        <meshStandardMaterial color="#6b7280" transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>

      {/* ESP Motor */}
      <EspMotor active={espActive} frequency={tel.espFrequency} />

      {/* Fluid particles */}
      <FluidParticles active={chokeOpen && espActive} flowRate={tel.flowRate} />

      {/* Perforations */}
      {[-8.2, -8.5, -8.8, -9.1, -9.4].map((y, i) => (
        <group key={i}>
          {[0, 1, 2, 3].map(j => {
            const a = (j / 4) * Math.PI * 2;
            return (
              <mesh key={j} position={[Math.cos(a) * 0.35, y, Math.sin(a) * 0.35]}>
                <sphereGeometry args={[0.03, 6, 6]} />
                <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.5} />
              </mesh>
            );
          })}
        </group>
      ))}

      {/* Wellhead assembly */}
      <group position={[0, 0.3, 0]}>
        {/* Casing head */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.6, 0.65, 0.4, 16]} />
          <meshStandardMaterial color="#374151" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Tubing head */}
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.45, 0.5, 0.4, 16]} />
          <meshStandardMaterial color="#374151" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Christmas tree body */}
        <mesh position={[0, 1.0, 0]}>
          <boxGeometry args={[0.5, 0.6, 0.5]} />
          <meshStandardMaterial color="#1f2937" metalness={0.85} roughness={0.25} />
        </mesh>
        {/* Wing valves */}
        {[-1, 1].map(side => (
          <group key={side} position={[side * 0.55, 0.9, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.06, 0.06, 0.4, 8]} />
              <meshStandardMaterial color="#4b5563" metalness={0.8} />
            </mesh>
            <mesh position={[side * 0.2, 0, 0]}>
              <sphereGeometry args={[0.1, 8, 8]} />
              <meshStandardMaterial
                color={chokeOpen ? "#16a34a" : "#dc2626"}
                emissive={chokeOpen ? "#16a34a" : "#dc2626"}
                emissiveIntensity={0.3}
              />
            </mesh>
          </group>
        ))}
        {/* Master valve */}
        <mesh position={[0, 1.4, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.35, 8]} />
          <meshStandardMaterial
            color={chokeOpen ? COL.chokeOpen : COL.choke}
            emissive={chokeOpen ? COL.chokeOpen : COL.choke}
            emissiveIntensity={0.2}
          />
        </mesh>
        {/* Flow outlet */}
        <mesh position={[0.6, 1.0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 0.6, 8]} />
          <meshStandardMaterial color="#1d4ed8" metalness={0.7} />
        </mesh>
      </group>

      {/* Pressure gauge labels */}
      {[
        { pos: [0.7, 0.5, 0] as [number,number,number], val: `${Math.round(tel.tubingPressure)} psi`, color: "#3b82f6", tag: "THP" },
        { pos: [-0.7, 0.5, 0] as [number,number,number], val: `${Math.round(tel.casingPressure)} psi`, color: "#8b5cf6", tag: "CHP" },
      ].map(({ pos, val, color, tag }) => (
        <group key={tag} position={pos}>
          <mesh>
            <cylinderGeometry args={[0.12, 0.12, 0.06, 12]} />
            <meshStandardMaterial color="#1f2937" metalness={0.9} />
          </mesh>
          <Html center>
            <div style={{ fontSize: 8, fontFamily: "monospace", textAlign: "center", color }}>
              <div style={{ fontWeight: "bold" }}>{tag}</div>
              <div>{val}</div>
            </div>
          </Html>
        </group>
      ))}

      {/* Alarm beacon */}
      {alarm !== "normal" && (
        <>
          <pointLight ref={alarmLightRef} position={[0, 2.5, 0]} color={alarmColor} intensity={1.2} distance={5} />
          <mesh position={[0, 2.5, 0]}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshStandardMaterial color={alarmColor} emissive={alarmColor} emissiveIntensity={1} />
          </mesh>
        </>
      )}

      {/* Live telemetry HUD */}
      <Html position={[2.2, 1.5, 0]} center>
        <div style={{
          background: "rgba(0,0,0,0.85)", border: "1px solid #3f3f46",
          borderRadius: 8, padding: "10px 12px", width: 160, fontSize: 11, fontFamily: "monospace"
        }}>
          <div style={{ color: "#f59e0b", fontWeight: "bold", fontSize: 10, borderBottom: "1px solid #3f3f46", paddingBottom: 4, marginBottom: 6 }}>
            LIVE TELEMETRY
          </div>
          {[
            ["THP", `${Math.round(tel.tubingPressure)} psi`, "#93c5fd"],
            ["CHP", `${Math.round(tel.casingPressure)} psi`, "#c4b5fd"],
            ["WHT", `${Math.round(tel.wellheadTemp)}°F`, "#fdba74"],
            ["Flow", `${Math.round(tel.flowRate)} BPD`, "#67e8f9"],
            ["ESP Hz", tel.espFrequency.toFixed(1), tel.espFrequency > 0 ? "#86efac" : "#f87171"],
            ["Choke", `${Math.round(tel.chokePosition)}%`, "#fde047"],
            ["BHP", `${Math.round(tel.bhp)} psi`, "#6ee7b7"],
            ["WC", `${(tel.waterCut * 100).toFixed(1)}%`, "#7dd3fc"],
          ].map(([k, v, c]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ color: "#71717a" }}>{k}</span>
              <span style={{ color: c }}>{v}</span>
            </div>
          ))}
        </div>
      </Html>

      {/* Depth ruler */}
      <Html position={[-2.5, -4, 0]} center>
        <div style={{ fontSize: 8, fontFamily: "monospace", color: "#52525b" }}>
          {["0 ft","1000 ft","2000 ft","3000 ft","4000 ft","5000 ft","6000 ft","7000 ft","8000 ft","9000 ft"].map(d => (
            <div key={d} style={{ marginBottom: 10 }}>{d}</div>
          ))}
        </div>
      </Html>

      {/* Scene lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
      <pointLight position={[0, -8.5, 0]} color={COL.reservoir} intensity={0.8} distance={4} />
    </group>
  );
}

// ─── Default telemetry ────────────────────────────────────────────────────────
const DEFAULT_TEL: WellTel = {
  tubingPressure: 1450, casingPressure: 820, flowRate: 850, waterCut: 0.18,
  espFrequency: 52.5, espCurrent: 42.3, wellheadTemp: 142, chokePosition: 75, bhp: 3200,
};

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DigitalTwinV42Page() {
  const [selectedWellId, setSelectedWellId] = useState("WELL-001");
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [manualTel, setManualTel] = useState(DEFAULT_TEL);
  const [useManual, setUseManual] = useState(false);

  const { data: models, isLoading: modelsLoading, refetch: refetchModels } = trpc.digitalTwinV42.listModels.useQuery();
  const { data: sessions } = trpc.digitalTwinV42.listFpsoSessions.useQuery();
  const { data: liveTelemetry, refetch: refetchTelemetry } = trpc.telemetry.latest.useQuery(
    { wellId: selectedWellId }, { refetchInterval: 5_000 }
  );
  const { data: telemetryHistory } = trpc.telemetry.history.useQuery(
    { wellId: selectedWellId, hours: 6 }, { refetchInterval: 30_000 }
  );
  const { data: bindings } = trpc.digitalTwinV42.getSensorBindings.useQuery(
    { modelId: selectedModelId! }, { enabled: selectedModelId !== null }
  );
  const nodalMutation = trpc.physicsEngine.nodal.useMutation();
  const seedMutation = trpc.digitalTwinV42.seedDefaultModels.useMutation({
    onSuccess: (data: { seeded: number }) => { toast.success(`${data.seeded} models created`); refetchModels(); },
  });
  const startSessionMutation = trpc.digitalTwinV42.startFpsoSession.useMutation({
    onSuccess: (data: { id: number }) => { toast.success("FPSO session started"); setActiveSessionId(data.id); },
  });
  const endSessionMutation = trpc.digitalTwinV42.endFpsoSession.useMutation({
    onSuccess: () => { toast.success("Session ended"); setActiveSessionId(null); },
  });

  const tel: WellTel = useManual ? manualTel : {
    tubingPressure: (liveTelemetry as any)?.tubingPressure ?? DEFAULT_TEL.tubingPressure,
    casingPressure: (liveTelemetry as any)?.casingPressure ?? DEFAULT_TEL.casingPressure,
    flowRate: (liveTelemetry as any)?.flowRate ?? DEFAULT_TEL.flowRate,
    waterCut: (liveTelemetry as any)?.waterCut ?? DEFAULT_TEL.waterCut,
    espFrequency: (liveTelemetry as any)?.espFrequency ?? DEFAULT_TEL.espFrequency,
    espCurrent: (liveTelemetry as any)?.espCurrent ?? DEFAULT_TEL.espCurrent,
    wellheadTemp: (liveTelemetry as any)?.wellheadTemp ?? DEFAULT_TEL.wellheadTemp,
    chokePosition: (liveTelemetry as any)?.chokePosition ?? DEFAULT_TEL.chokePosition,
    bhp: (liveTelemetry as any)?.bhp ?? DEFAULT_TEL.bhp,
  };

  const alarm: "normal" | "warning" | "critical" =
    tel.tubingPressure > 2500 || tel.espCurrent > 80 ? "critical" :
    tel.tubingPressure > 2000 || tel.waterCut > 0.5 ? "warning" : "normal";

  useEffect(() => {
    nodalMutation.mutate({
      wellId: selectedWellId,
      reservoirPressure: tel.bhp,
      qMax: 5000,
      skinFactor: 0,
      espFrequencyHz: tel.espFrequency,
      wellheadPressure: tel.tubingPressure,
      tvdFt: 8500,
      fluidGradient: 0.433,
      waterCut: tel.waterCut,
      gorScfPerBbl: 500,
      points: 60,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWellId]);

  const historyData = ((telemetryHistory as any[]) ?? []).slice(-60).map((r: any) => ({
    t: new Date(r.recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    thp: r.tubingPressure ?? 0,
    flow: r.flowRate ?? 0,
  }));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Box className="w-7 h-7 text-blue-400" />
            3D Digital Twin Platform
            <Badge variant="outline" className="text-xs ml-1">v45.0</Badge>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Live Three.js Well Model · Real-Time Telemetry · Rust Physics Engine · Unreal FPSO Streaming
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { refetchModels(); refetchTelemetry(); }}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
            {seedMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
            Seed Models
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { icon: Gauge, label: "THP", value: `${Math.round(tel.tubingPressure)} psi`, color: "text-blue-400" },
          { icon: Thermometer, label: "WHT", value: `${Math.round(tel.wellheadTemp)}°F`, color: "text-orange-400" },
          { icon: Droplets, label: "Flow", value: `${Math.round(tel.flowRate)} BPD`, color: "text-cyan-400" },
          { icon: Zap, label: "ESP", value: `${tel.espFrequency.toFixed(1)} Hz`, color: tel.espFrequency > 0 ? "text-green-400" : "text-red-400" },
          { icon: Activity, label: "BHP", value: `${Math.round(tel.bhp)} psi`, color: "text-emerald-400" },
        ].map(({ icon: Icon, label, value, color }) => (
          <Card key={label} className="bg-card/50">
            <CardContent className="p-3 flex items-center gap-3">
              <Icon className={`w-5 h-5 ${color}`} />
              <div>
                <div className="text-muted-foreground text-xs">{label}</div>
                <div className={`font-bold text-sm ${color}`}>{value}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="3d-viewer">
        <TabsList className="bg-muted/30 border border-border/50">
          <TabsTrigger value="3d-viewer"><Box className="w-3.5 h-3.5 mr-1" />3D Well Viewer</TabsTrigger>
          <TabsTrigger value="models"><Monitor className="w-3.5 h-3.5 mr-1" />Model Registry</TabsTrigger>
          <TabsTrigger value="physics"><Cpu className="w-3.5 h-3.5 mr-1" />Physics Engine</TabsTrigger>
          <TabsTrigger value="history"><BarChart3 className="w-3.5 h-3.5 mr-1" />Telemetry History</TabsTrigger>
          <TabsTrigger value="fpso"><Wifi className="w-3.5 h-3.5 mr-1" />FPSO Streaming</TabsTrigger>
          <TabsTrigger value="coupled"><Cpu className="w-3.5 h-3.5 mr-1" />Coupled Solver</TabsTrigger>
          <TabsTrigger value="pinn"><BarChart3 className="w-3.5 h-3.5 mr-1" />PINN Surrogate</TabsTrigger>
          <TabsTrigger value="equipment3d"><Package className="w-3.5 h-3.5 mr-1" />Equipment 3D</TabsTrigger>
        </TabsList>

        {/* ── 3D Viewer ─────────────────────────────────────────────────────── */}
        <TabsContent value="3d-viewer">
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* Controls panel */}
            <Card className="xl:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-amber-400" /> Well Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Active Well</Label>
                  <Select value={selectedWellId} onValueChange={setSelectedWellId}>
                    <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["WELL-001","WELL-002","WELL-003","WELL-004","WELL-005"].map(w => (
                        <SelectItem key={w} value={w} className="text-xs">{w}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="manual" checked={useManual} onChange={e => setUseManual(e.target.checked)} className="rounded" />
                  <Label htmlFor="manual" className="text-xs text-muted-foreground cursor-pointer">Manual Override</Label>
                </div>
                {useManual && (
                  <div className="space-y-3">
                    {[
                      { key: "tubingPressure", label: "THP (psi)", min: 100, max: 3500, step: 50 },
                      { key: "flowRate", label: "Flow (BPD)", min: 0, max: 5000, step: 50 },
                      { key: "espFrequency", label: "ESP Hz", min: 0, max: 70, step: 0.5 },
                      { key: "chokePosition", label: "Choke (%)", min: 0, max: 100, step: 1 },
                      { key: "wellheadTemp", label: "WHT (°F)", min: 60, max: 300, step: 5 },
                    ].map(({ key, label, min, max, step }) => (
                      <div key={key}>
                        <div className="flex justify-between">
                          <Label className="text-xs text-muted-foreground">{label}</Label>
                          <span className="text-xs font-mono">{manualTel[key as keyof WellTel]}</span>
                        </div>
                        <Slider min={min} max={max} step={step}
                          value={[manualTel[key as keyof WellTel] as number]}
                          onValueChange={([v]) => setManualTel(p => ({ ...p, [key]: v }))}
                          className="mt-1"
                        />
                      </div>
                    ))}
                  </div>
                )}
                <div className={`flex items-center gap-2 p-2 rounded-md text-xs font-medium border ${
                  alarm === "critical" ? "bg-red-950/30 border-red-700 text-red-400" :
                  alarm === "warning" ? "bg-amber-950/30 border-amber-700 text-amber-400" :
                  "bg-green-950/30 border-green-700 text-green-400"
                }`}>
                  {alarm === "normal" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  {alarm === "critical" ? "CRITICAL ALARM" : alarm === "warning" ? "WARNING" : "NORMAL OPERATION"}
                </div>
                <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border/30">
                  <div className="font-medium text-foreground/70 mb-1">Navigation</div>
                  <div>Left drag — rotate</div>
                  <div>Right drag — pan</div>
                  <div>Scroll — zoom</div>
                </div>
              </CardContent>
            </Card>

            {/* Three.js canvas */}
            <Card className="xl:col-span-3 overflow-hidden">
              <CardHeader className="pb-2 border-b border-border/30">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{selectedWellId} — Live 3D Model</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-xs text-muted-foreground">{liveTelemetry ? "Live data" : "Demo data"}</span>
                    {alarm !== "normal" && (
                      <Badge className={`text-xs ${alarm === "critical" ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-amber-500/20 text-amber-400 border-amber-500/30"}`}>
                        {alarm.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div style={{ height: 560 }}>
                  <Canvas
                    camera={{ position: [5, 3, 8], fov: 50 }}
                    shadows
                    gl={{ antialias: true }}
                    style={{ background: "linear-gradient(to bottom, #0a0f1a, #111827)" }}
                  >
                    <Suspense fallback={null}>
                      <WellModel tel={tel} alarm={alarm} />
                      <OrbitControls enablePan enableZoom enableRotate minDistance={3} maxDistance={25} target={[0, -2, 0]} />
                      <Environment preset="night" />
                    </Suspense>
                  </Canvas>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Model Registry ─────────────────────────────────────────────────── */}
        <TabsContent value="models">
          <div className="space-y-4">
            {modelsLoading ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading models…
              </div>
            ) : !models || models.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center">
                  <Box className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm mb-4">No digital twin models registered yet.</p>
                  <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                    {seedMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    Seed Default Models
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {models.map((model) => (
                  <Card key={model.modelId}
                    className={`cursor-pointer transition-all hover:border-amber-500/50 ${selectedModelId === model.modelId ? "border-amber-500 bg-amber-950/10" : ""}`}
                    onClick={() => setSelectedModelId(model.modelId)}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{model.name}</CardTitle>
                        <Badge variant="outline" className="text-xs capitalize">{model.assetType}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex justify-between"><span>Model ID</span><span className="font-mono text-foreground">{model.modelId}</span></div>
                      {model.wellId && <div className="flex justify-between"><span>Well</span><span className="font-mono text-foreground">{model.wellId}</span></div>}
                      {model.facilityId && <div className="flex justify-between"><span>Facility</span><span className="font-mono text-foreground">{model.facilityId}</span></div>}
                      <div className="flex justify-between"><span>Status</span>
                        <span className={model.isActive ? "text-green-400" : "text-red-400"}>{model.isActive ? "Active" : "Inactive"}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {selectedModelId && bindings && Object.keys(bindings).length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Sensor Bindings</CardTitle></CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted/20 p-3 rounded overflow-auto max-h-40">{JSON.stringify(bindings, null, 2)}</pre>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── Physics Engine ─────────────────────────────────────────────────── */}
        <TabsContent value="physics">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Cpu className="w-4 h-4 text-amber-400" /> Rust Physics Engine — Nodal Analysis ({selectedWellId})
              </CardTitle>
              <p className="text-xs text-muted-foreground">Real-time IPR/VLP nodal analysis from Rust service at :4001 using live telemetry</p>
            </CardHeader>
            <CardContent>
              {nodalMutation.isPending ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Computing nodal analysis…
                </div>
              ) : nodalMutation.data ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "Operating Rate", value: `${Math.round((nodalMutation.data as any).operating_rate_bpd ?? (nodalMutation.data as any).operating_rate ?? 0)} BPD`, color: "text-blue-400" },
                      { label: "Operating BHP", value: `${Math.round((nodalMutation.data as any).operating_bhp_psia ?? (nodalMutation.data as any).operating_bhp ?? 0)} psia`, color: "text-purple-400" },
                      { label: "AOF", value: `${Math.round((nodalMutation.data as any).aof_bpd ?? (nodalMutation.data as any).aof ?? 0)} BPD`, color: "text-green-400" },
                      { label: "Lift Efficiency", value: `${(((nodalMutation.data as any).lift_efficiency ?? 0) * 100).toFixed(1)}%`, color: "text-amber-400" },
                    ].map(({ label, value, color }) => (
                      <Card key={label} className="bg-muted/20">
                        <CardContent className="p-3 text-center">
                          <div className="text-muted-foreground text-xs mb-1">{label}</div>
                          <div className={`font-bold ${color}`}>{value}</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {(nodalMutation.data as any).ipr_curve && (nodalMutation.data as any).vlp_curve && (
                    <Card className="bg-muted/20">
                      <CardHeader className="pb-2"><CardTitle className="text-xs">IPR / VLP Nodal Curves</CardTitle></CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={240}>
                          <LineChart margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                            <XAxis dataKey="rate" type="number" domain={[0, "auto"]} stroke="#71717a" tick={{ fontSize: 10 }}
                              label={{ value: "Rate (BPD)", position: "insideBottom", offset: -10, fill: "#71717a", fontSize: 11 }} />
                            <YAxis stroke="#71717a" tick={{ fontSize: 10 }}
                              label={{ value: "BHP (psia)", angle: -90, position: "insideLeft", fill: "#71717a", fontSize: 11 }} />
                            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 6 }}
                              formatter={(v: any) => [`${Math.round(v)} psia`]} />
                            <ReLine
                              data={(nodalMutation.data as any).ipr_curve.map((p: any) => ({ rate: p.rate_bpd, bhp: p.bhp_psia }))}
                              dataKey="bhp" stroke="#3b82f6" strokeWidth={2} dot={false} name="IPR" />
                            <ReLine
                              data={(nodalMutation.data as any).vlp_curve.map((p: any) => ({ rate: p.rate_bpd, bhp: p.bhp_psia }))}
                              dataKey="bhp" stroke="#f59e0b" strokeWidth={2} dot={false} name="VLP" strokeDasharray="5 5" />
                          </LineChart>
                        </ResponsiveContainer>
                        <div className="flex gap-4 justify-center mt-2 text-xs">
                          <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-blue-400" /> IPR (Inflow)</span>
                          <span className="flex items-center gap-1"><span className="inline-block w-4 border-t-2 border-dashed border-amber-400" /> VLP (Outflow)</span>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  <Button size="sm" variant="outline" onClick={() => nodalMutation.mutate({
                    wellId: selectedWellId, reservoirPressure: tel.bhp, qMax: 5000,
                    skinFactor: 0, espFrequencyHz: tel.espFrequency, wellheadPressure: tel.tubingPressure,
                    tvdFt: 8500, fluidGradient: 0.433, waterCut: tel.waterCut, gorScfPerBbl: 500, points: 60,
                  })} disabled={nodalMutation.isPending}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Recompute
                  </Button>
                </div>
              ) : (
                <div className="text-muted-foreground text-sm">Select a well to compute nodal analysis.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Telemetry History ──────────────────────────────────────────────── */}
        <TabsContent value="history">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">6-Hour Telemetry History — {selectedWellId}</CardTitle></CardHeader>
            <CardContent>
              {historyData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  No history data. Seed demo data first.
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">Tubing Head Pressure (psi)</div>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={historyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="t" stroke="#71717a" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                        <YAxis stroke="#71717a" tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 6 }} />
                        <ReLine dataKey="thp" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="THP" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">Flow Rate (BPD)</div>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={historyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="t" stroke="#71717a" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                        <YAxis stroke="#71717a" tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 6 }} />
                        <ReLine dataKey="flow" stroke="#06b6d4" strokeWidth={1.5} dot={false} name="Flow" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── FPSO Streaming ─────────────────────────────────────────────────── */}
        <TabsContent value="fpso">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-blue-400" /> Unreal Engine Pixel Streaming
                </CardTitle>
                <p className="text-xs text-muted-foreground">GPU-accelerated UE5 FPSO digital twin streamed via WebRTC</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/20 rounded-lg p-4 border border-border/30 grid grid-cols-2 gap-3 text-xs">
                  {[
                    ["Render Engine", "Unreal Engine 5.3"],
                    ["Streaming", "WebRTC / Pixel Stream"],
                    ["Resolution", "1920×1080 @ 60fps"],
                    ["Latency", "<80ms (LAN)"],
                    ["GPU", "NVIDIA A100 (Cloud)"],
                    ["Model Detail", "LOD 0 — Full fidelity"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div className="text-muted-foreground">{k}</div>
                      <div className="font-medium text-foreground">{v}</div>
                    </div>
                  ))}
                </div>
                {!activeSessionId ? (
                  <Button className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => startSessionMutation.mutate({ fpsoId: "FPSO-001" })}
                    disabled={startSessionMutation.isPending}>
                    {startSessionMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                    Start FPSO Session
                  </Button>
                ) : (
                  <Button variant="destructive"
                    onClick={() => {
                      const s = (sessions as any[])?.find(s => s.id === activeSessionId);
                      if (s) endSessionMutation.mutate({ sessionId: s.sessionId });
                    }} disabled={endSessionMutation.isPending}>
                    <Square className="w-4 h-4 mr-2" /> End Session
                  </Button>
                )}
                {activeSessionId && (
                  <div className="bg-green-950/20 border border-green-700/30 rounded-lg p-3 text-xs text-green-400">
                    Session Active — WebRTC stream would open in production
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Session History</CardTitle></CardHeader>
              <CardContent>
                {!sessions || (sessions as any[]).length === 0 ? (
                  <div className="text-muted-foreground text-sm text-center py-8">No sessions yet</div>
                ) : (
                  <div className="space-y-2">
                    {(sessions as any[]).slice(0, 8).map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0 text-xs">
                        <div>
                          <div className="font-mono text-foreground">{s.sessionId}</div>
                          <div className="text-muted-foreground">{s.fpsoId} · {new Date(s.startedAt).toLocaleString()}</div>
                        </div>
                        <Badge variant="outline" className={`text-xs ${s.status === "ready" || s.status === "active" ? "text-green-400 border-green-500/30" : "text-muted-foreground"}`}>
                          {s.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        {/* ── Coupled Multi-Physics Solver ──────────────────────────────────── */}
        <TabsContent value="coupled">
          <CoupledSolverPanel wellId={selectedWellId} telemetry={tel} />
        </TabsContent>

        {/* ── PINN Surrogate ───────────────────────────────────────────────────────────── */}
        <TabsContent value="pinn">
          <PINNPanel wellId={selectedWellId} telemetry={tel} />
        </TabsContent>
        {/* ── Equipment 3D Viewer (glTF/PBR) ──────────────────────────────────────────── */}
        <TabsContent value="equipment3d">
          <Card className="bg-card/60 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-cyan-400" />
                Equipment 3D Viewer — glTF/PBR Models
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div className="flex items-center justify-center h-64 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mr-2" />Loading 3D viewer...</div>}>
                <EquipmentViewer3D
                  initialModelId="esp_pump"
                  telemetry={tel ? {
                    temperature_c: ((tel.wellheadTemp ?? 85) - 32) * 5 / 9,
                    pressure_psi: tel.tubingPressure ?? 2800,
                    vibration_g: 0.4,
                    anomaly: tel.tubingPressure > 4500 || tel.espCurrent > 120,
                  } : undefined}
                />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Coupled Solver Panel ──────────────────────────────────────────────────────────────

function CoupledSolverPanel({ wellId, telemetry }: { wellId: string; telemetry: any }) {
  const coupledMutation = trpc.physicsEngine.coupled.useMutation();

  const runCoupled = () => {
    coupledMutation.mutate({
      wellId,
      reservoirPressure:   telemetry.bhp ?? 3500,
      qMax:                5000,
      skinFactor:          0,
      espFrequencyHz:      telemetry.espFrequency ?? 0,
      wellheadPressure:    telemetry.tubingPressure ?? 200,
      tvdFt:               8500,
      fluidGradient:       0.433,
      waterCut:            telemetry.waterCut ?? 0.25,
      gorScfPerBbl:        500,
      avgBulkDensityGcc:   2.35,
      ucsPsi:              3000,
      frictionAngleDeg:    30,
      biotCoefficient:     0.8,
      poissonRatio:        0.25,
      currentMudWeightPpg: 10.5,
      completionType:      "CASED_PERFORATED",
      perforationLengthFt: 20,
      perforationDiameterIn: 0.5,
      declineRateDi:       0.08,
      bFactor:             0.5,
    });
  };

  const data = coupledMutation.data as any;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Cpu className="w-4 h-4 text-amber-400" /> Coupled Multi-Physics Solver v54.0 — {wellId}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Nodal analysis + 1D MEM geomechanics + sand onset critical drawdown solved in a single coupled pass.
            State is shared between modules to eliminate double-counting.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={runCoupled} disabled={coupledMutation.isPending} className="bg-amber-600 hover:bg-amber-700">
            {coupledMutation.isPending
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Solving…</>
              : <><RefreshCw className="w-4 h-4 mr-2" /> Run Coupled Solve</>
            }
          </Button>

          {data && (
            <div className="space-y-4">
              <div>
                <div className="text-xs font-semibold text-amber-400 mb-2 uppercase tracking-wider">Nodal Analysis</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Operating Rate", value: `${Math.round(data.nodal?.operating_rate_bpd ?? 0)} BPD`, color: "text-blue-400" },
                    { label: "Operating BHP", value: `${Math.round(data.nodal?.operating_bhp_psia ?? 0)} psia`, color: "text-purple-400" },
                    { label: "AOF", value: `${Math.round(data.nodal?.aof_bpd ?? 0)} BPD`, color: "text-green-400" },
                    { label: "Lift Efficiency", value: `${((data.nodal?.lift_efficiency ?? 0) * 100).toFixed(1)}%`, color: "text-amber-400" },
                  ].map(({ label, value, color }) => (
                    <Card key={label} className="bg-muted/20"><CardContent className="p-3 text-center">
                      <div className="text-muted-foreground text-xs mb-1">{label}</div>
                      <div className={`font-bold ${color}`}>{value}</div>
                    </CardContent></Card>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-purple-400 mb-2 uppercase tracking-wider">Geomechanics (1D MEM)</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Fracture Gradient", value: `${(data.geomechanics?.fracture_gradient_ppg ?? 0).toFixed(2)} ppg`, color: "text-red-400" },
                    { label: "Pore Pressure", value: `${(data.geomechanics?.pore_pressure_ppg ?? 0).toFixed(2)} ppg`, color: "text-cyan-400" },
                    { label: "Min Horiz Stress", value: `${Math.round(data.geomechanics?.min_horizontal_stress_psi ?? 0)} psi`, color: "text-orange-400" },
                    { label: "Stability", value: data.geomechanics?.wellbore_stability ?? "N/A", color: "text-green-400" },
                  ].map(({ label, value, color }) => (
                    <Card key={label} className="bg-muted/20"><CardContent className="p-3 text-center">
                      <div className="text-muted-foreground text-xs mb-1">{label}</div>
                      <div className={`font-bold text-sm ${color}`}>{value}</div>
                    </CardContent></Card>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-yellow-400 mb-2 uppercase tracking-wider">Sand Onset (Critical Drawdown)</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Critical Drawdown", value: `${Math.round(data.sand_onset?.critical_drawdown_psi ?? 0)} psi`, color: "text-yellow-400" },
                    { label: "Current Drawdown", value: `${Math.round(data.sand_onset?.current_drawdown_psi ?? 0)} psi`, color: "text-orange-400" },
                    { label: "Safety Margin", value: `${Math.round(data.sand_onset?.safety_margin_psi ?? 0)} psi`, color: "text-green-400" },
                    { label: "Sand Risk", value: data.sand_onset?.sand_risk ?? "N/A", color: data.sand_onset?.sand_risk === "LOW" ? "text-green-400" : data.sand_onset?.sand_risk === "MEDIUM" ? "text-yellow-400" : "text-red-400" },
                  ].map(({ label, value, color }) => (
                    <Card key={label} className="bg-muted/20"><CardContent className="p-3 text-center">
                      <div className="text-muted-foreground text-xs mb-1">{label}</div>
                      <div className={`font-bold text-sm ${color}`}>{value}</div>
                    </CardContent></Card>
                  ))}
                </div>
              </div>
              {data.eur_mbbl && (
                <div className="bg-muted/20 rounded-lg p-3 border border-border/30">
                  <div className="text-xs font-semibold text-green-400 mb-1">EUR (Estimated Ultimate Recovery)</div>
                  <div className="text-2xl font-bold text-green-400">{data.eur_mbbl.toFixed(0)} MBbl</div>
                  <div className="text-xs text-muted-foreground">Arps hyperbolic decline over 240 months</div>
                </div>
              )}

              {/* IPR / VLP Nodal Chart */}
              {data.nodal?.ipr_curve && data.nodal?.vlp_curve && (
                <div>
                  <div className="text-xs font-semibold text-blue-400 mb-2 uppercase tracking-wider">IPR / VLP Nodal Curves (Coupled Solve)</div>
                  <Card className="bg-muted/20">
                    <CardContent className="p-3">
                      <ResponsiveContainer width="100%" height={220}>
                        <ComposedChart margin={{ top: 8, right: 16, left: 0, bottom: 16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.3)" />
                          <XAxis type="number" dataKey="rate"
                            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                            label={{ value: "Rate (bpd)", position: "insideBottom", offset: -8, fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                          />
                          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                            label={{ value: "BHP (psia)", angle: -90, position: "insideLeft", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                          />
                          <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: 11 }}
                            formatter={(v: number) => [`${v.toFixed(0)} psia`, ""]}
                          />
                          <Line data={data.nodal.ipr_curve.map((p: any) => ({ rate: p.rate_bpd, bhp: p.bhp_psia }))}
                            type="monotone" dataKey="bhp" stroke="#3b82f6" strokeWidth={2} dot={false} name="IPR (Inflow)" />
                          <Line data={data.nodal.vlp_curve.map((p: any) => ({ rate: p.rate_bpd, bhp: p.bhp_psia }))}
                            type="monotone" dataKey="bhp" stroke="#f59e0b" strokeWidth={2} dot={false}
                            strokeDasharray="5 5" name="VLP (Outflow)" />
                          {data.nodal.operating_point && (
                            <ReferenceLine x={data.nodal.operating_point.rate_bpd} stroke="#10b981" strokeDasharray="3 3"
                              label={{ value: `OP: ${Math.round(data.nodal.operating_point.rate_bpd)} bpd`, fill: "#10b981", fontSize: 10 }}
                            />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                      <div className="flex gap-4 mt-1 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-blue-400" /> IPR (Inflow)</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-4 border-t-2 border-dashed border-amber-400" /> VLP (Outflow)</span>
                        {data.nodal.operating_point && <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-emerald-400" /> Operating Point</span>}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
          {!data && !coupledMutation.isPending && (
            <div className="text-muted-foreground text-sm py-4 text-center">Click “Run Coupled Solve” to execute the multi-physics solver.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── PINN Surrogate Panel ────────────────────────────────────────────────────────────────

function PINNPanel({ wellId, telemetry }: { wellId: string; telemetry: any }) {
  const pinnPredict = trpc.pinn.predict.useMutation();
  const pinnTrain   = trpc.pinn.train.useMutation();
  const pinnStatus  = trpc.pinn.status.useQuery();

  const runPredict = () => {
    pinnPredict.mutate({
      wellId,
      reservoirPressure:   telemetry.bhp ?? 3500,
      qMax:                5000,
      skinFactor:          0,
      espFrequencyHz:      telemetry.espFrequency ?? 0,
      wellheadPressure:    telemetry.tubingPressure ?? 200,
      tvdFt:               8500,
      fluidGradient:       0.433,
      waterCut:            telemetry.waterCut ?? 0.3,
      gorScfPerBbl:        500,
      avgBulkDensityGcc:   2.4,
      lotPressurePpg:      14.5,
      currentMudWeightPpg: 10.5,
      ucsPsi:              3000,
      frictionAngleDeg:    30,
      biotCoefficient:     0.8,
      declineRateDi:       0.08,
      bFactor:             0.5,
      mcSamples:           50,
    });
  };

  const pred = pinnPredict.data as any;
  const OUTPUT_LABELS: Record<string, { label: string; unit: string; color: string }> = {
    q_bpd:               { label: "Flow Rate",         unit: "BPD",  color: "text-blue-400" },
    pwf_psi:             { label: "Flowing BHP",       unit: "psia", color: "text-purple-400" },
    drawdown_psi:        { label: "Drawdown",          unit: "psi",  color: "text-orange-400" },
    sanding_index:       { label: "Sanding Index",     unit: "",     color: "text-yellow-400" },
    risk_score:          { label: "Risk Score",        unit: "/100", color: "text-red-400" },
    fracture_gradient_ppg: { label: "Frac Gradient",  unit: "ppg",  color: "text-cyan-400" },
    eur_mbbl:            { label: "EUR",               unit: "MBbl", color: "text-green-400" },
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" /> PINN Surrogate — Monte Carlo Uncertainty Quantification
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Physics-Informed Neural Network with MC Dropout. Returns mean + 95% CI for 7 key outputs.
            {pinnStatus.data && (
              <span className={`ml-2 font-medium ${
                (pinnStatus.data as any).trained ? "text-green-400" : "text-amber-400"
              }`}>
                Model: {(pinnStatus.data as any).trained
                  ? `Trained (v${(pinnStatus.data as any).model_version})`
                  : "Physics Fallback (untrained)"}
              </span>
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button onClick={runPredict} disabled={pinnPredict.isPending} className="bg-blue-600 hover:bg-blue-700">
              {pinnPredict.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Predicting…</>
                : <><RefreshCw className="w-4 h-4 mr-2" /> Run PINN Predict</>
              }
            </Button>
            <Button variant="outline"
              onClick={() => pinnTrain.mutate({ nSamples: 300, nEpochs: 150, lr: 0.001, physicsWeight: 0.1 })}
              disabled={pinnTrain.isPending}
              className="border-amber-600 text-amber-400">
              {pinnTrain.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Training…</>
                : "Train PINN"
              }
            </Button>
          </div>
          {pred && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(OUTPUT_LABELS).map(([key, { label, unit, color }]) => {
                const out = pred[key];
                if (!out) return null;
                const cv = out.cv_pct ?? 0;
                return (
                  <Card key={key} className="bg-muted/20">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-xs text-muted-foreground">{label}</div>
                          <div className={`text-lg font-bold ${color}`}>
                            {typeof out.mean === "number"
                              ? out.mean.toFixed(key === "sanding_index" ? 3 : 1)
                              : out.mean} {unit}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            95% CI: [{typeof out.lower === "number" ? out.lower.toFixed(1) : out.lower}, 
                            {typeof out.upper === "number" ? out.upper.toFixed(1) : out.upper}]
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">CV</div>
                          <div className={`text-sm font-mono ${
                            cv > 20 ? "text-red-400" : cv > 10 ? "text-yellow-400" : "text-green-400"
                          }`}>{cv.toFixed(1)}%</div>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${
                          cv > 20 ? "bg-red-500" : cv > 10 ? "bg-yellow-500" : "bg-green-500"
                        }`} style={{ width: `${Math.min(100, cv * 3)}%` }} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          {!pred && !pinnPredict.isPending && (
            <div className="text-muted-foreground text-sm py-4 text-center">
              Click “Run PINN Predict” to get uncertainty-quantified predictions.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
