/**
 * EquipmentViewer3D
 * ==================
 * Production-grade 3D viewer for O&G equipment using glTF 2.0 CAD models.
 *
 * Features:
 *   - Loads procedural glTF models (ESP pump, wellhead, manifold, FPSO, pipeline)
 *   - PBR metallic-roughness rendering via @react-three/fiber + drei
 *   - Real-time telemetry overlays (temperature, pressure, vibration heat-maps)
 *   - Orbit controls with auto-rotate
 *   - Model selection panel with equipment metadata
 *   - Anomaly highlighting (red emission on affected components)
 *   - Environment lighting (HDRI-style)
 *   - Suspense fallback with loading skeleton
 *   - USD export hint (USD pipeline described in comments)
 *
 * USD Pipeline (for future NVIDIA Omniverse integration):
 *   The glTF models can be converted to USD via:
 *     usdcat --out model.usda model.glb  (requires NVIDIA USD tools)
 *   Or via the Python `pxr` library for programmatic conversion.
 *   USD layers would allow real-time telemetry as USD attribute overrides.
 */

import { Suspense, useRef, useState, useEffect, useMemo } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  Html,
  useGLTF,
  PerspectiveCamera,
  ContactShadows,
  Grid,
  Bounds,
  useBounds,
} from "@react-three/drei";
import * as THREE from "three";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── CDN Model URLs ───────────────────────────────────────────────────────────

const MODEL_URLS: Record<string, string> = {
  esp_pump:  "https://d2xsxph8kpxj0f.cloudfront.net/310519663412555753/KDV4VuP2aAGuW7WLgvDFQk/esp_pump_f4d5f8b2.glb",
  wellhead:  "https://d2xsxph8kpxj0f.cloudfront.net/310519663412555753/KDV4VuP2aAGuW7WLgvDFQk/wellhead_53cf0c72.glb",
  manifold:  "https://d2xsxph8kpxj0f.cloudfront.net/310519663412555753/KDV4VuP2aAGuW7WLgvDFQk/manifold_5f3da552.glb",
  fpso_hull: "https://d2xsxph8kpxj0f.cloudfront.net/310519663412555753/KDV4VuP2aAGuW7WLgvDFQk/fpso_hull_6788480b.glb",
  pipeline:  "https://d2xsxph8kpxj0f.cloudfront.net/310519663412555753/KDV4VuP2aAGuW7WLgvDFQk/pipeline_4434769c.glb",
};

// ─── Equipment metadata ───────────────────────────────────────────────────────

interface EquipmentSpec {
  id:          string;
  label:       string;
  description: string;
  specs:       Record<string, string>;
  cameraPos:   [number, number, number];
  cameraTarget:[number, number, number];
}

const EQUIPMENT_SPECS: EquipmentSpec[] = [
  {
    id: "esp_pump",
    label: "ESP Pump Assembly",
    description: "Electric Submersible Pump — motor, seal, and multi-stage centrifugal pump",
    specs: {
      "Motor Power":    "750 HP",
      "Pump Stages":    "120",
      "Rated Freq":     "60 Hz",
      "Max Temp":       "150°C",
      "Shaft Dia":      "3.38 in",
    },
    cameraPos:    [0.8, 3.0, 0.8],
    cameraTarget: [0, 2.0, 0],
  },
  {
    id: "wellhead",
    label: "Christmas Tree",
    description: "Wellhead assembly with BOP stack, master valve, and wing valves",
    specs: {
      "Pressure Rating": "10,000 PSI",
      "Bore Size":       "7-1/16 in",
      "Material":        "AISI 4130",
      "Temp Rating":     "-29°C to 121°C",
      "Standard":        "API 6A",
    },
    cameraPos:    [1.0, 1.5, 1.0],
    cameraTarget: [0, 0.9, 0],
  },
  {
    id: "manifold",
    label: "Subsea Manifold",
    description: "4-slot production manifold with choke valves and production header",
    specs: {
      "Design Pressure": "5,000 PSI",
      "Slots":           "4",
      "Header Dia":      "12 in",
      "Water Depth":     "1,500 m",
      "Standard":        "API 17D",
    },
    cameraPos:    [3.0, 2.5, 3.0],
    cameraTarget: [0, 0.8, 2.4],
  },
  {
    id: "fpso_hull",
    label: "FPSO Hull",
    description: "Floating Production Storage and Offloading vessel — simplified hull model",
    specs: {
      "Storage Cap":     "2.0 MMbbl",
      "Process Rate":    "150,000 BPD",
      "Length":          "285 m",
      "Displacement":    "250,000 DWT",
      "Mooring":         "Turret SPM",
    },
    cameraPos:    [8.0, 5.0, 8.0],
    cameraTarget: [0, 1.0, 0],
  },
  {
    id: "pipeline",
    label: "Subsea Pipeline",
    description: "Concrete-coated subsea pipeline segment with weld flanges",
    specs: {
      "OD":              "12 in",
      "Wall Thickness":  "0.75 in",
      "Coating":         "Concrete, 50mm",
      "Design Pressure": "3,000 PSI",
      "Standard":        "DNV-ST-F101",
    },
    cameraPos:    [2.0, 1.5, 4.0],
    cameraTarget: [0, 0, 2.4],
  },
];

// ─── Telemetry overlay types ──────────────────────────────────────────────────

interface TelemetryData {
  temperature_c: number;
  pressure_psi:  number;
  vibration_g:   number;
  anomaly:       boolean;
}

// ─── glTF Model Component ─────────────────────────────────────────────────────

function GLTFModel({
  url,
  telemetry,
  autoRotate,
}: {
  url: string;
  telemetry: TelemetryData;
  autoRotate: boolean;
}) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);
  const clonedScene = useMemo(() => scene.clone(), [scene]);

  // Apply telemetry-driven emission to materials
  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material;
        if (mat instanceof THREE.MeshStandardMaterial) {
          if (telemetry.anomaly) {
            // Red emission for anomaly
            mat.emissive = new THREE.Color(0.8, 0.0, 0.0);
            mat.emissiveIntensity = 0.4 + 0.3 * Math.sin(Date.now() * 0.003);
          } else if (telemetry.temperature_c > 100) {
            // Orange emission for high temperature
            mat.emissive = new THREE.Color(0.6, 0.2, 0.0);
            mat.emissiveIntensity = (telemetry.temperature_c - 100) / 200;
          } else {
            mat.emissive = new THREE.Color(0, 0, 0);
            mat.emissiveIntensity = 0;
          }
        }
      }
    });
  }, [clonedScene, telemetry]);

  useFrame((_, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3;
    }
    // Pulsing emission for anomaly
    if (telemetry.anomaly) {
      clonedScene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material;
          if (mat instanceof THREE.MeshStandardMaterial && mat.emissiveIntensity > 0) {
            mat.emissiveIntensity = 0.3 + 0.3 * Math.sin(Date.now() * 0.004);
          }
        }
      });
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
    </group>
  );
}

// ─── Telemetry Overlay ────────────────────────────────────────────────────────

function TelemetryOverlay({ telemetry }: { telemetry: TelemetryData }) {
  const tempColor = telemetry.temperature_c > 120 ? "#ef4444"
    : telemetry.temperature_c > 90 ? "#f59e0b" : "#10b981";
  const presColor = telemetry.pressure_psi > 4000 ? "#ef4444"
    : telemetry.pressure_psi > 3000 ? "#f59e0b" : "#10b981";
  const vibColor  = telemetry.vibration_g > 2.0 ? "#ef4444"
    : telemetry.vibration_g > 1.0 ? "#f59e0b" : "#10b981";

  return (
    <Html position={[2.5, 2.0, 0]} distanceFactor={8}>
      <div className="bg-gray-900/90 border border-gray-700 rounded-lg p-3 text-xs w-44 backdrop-blur-sm">
        <div className="text-gray-400 font-semibold mb-2 uppercase tracking-wider">Live Telemetry</div>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Temp</span>
            <span style={{ color: tempColor }} className="font-mono font-bold">
              {telemetry.temperature_c.toFixed(1)}°C
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Pressure</span>
            <span style={{ color: presColor }} className="font-mono font-bold">
              {telemetry.pressure_psi.toFixed(0)} PSI
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Vibration</span>
            <span style={{ color: vibColor }} className="font-mono font-bold">
              {telemetry.vibration_g.toFixed(2)} g
            </span>
          </div>
          {telemetry.anomaly && (
            <div className="mt-2 bg-red-900/50 border border-red-500 rounded px-2 py-1 text-red-300 font-semibold text-center">
              ⚠ ANOMALY DETECTED
            </div>
          )}
        </div>
      </div>
    </Html>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function ModelLoadingFallback() {
  return (
    <Html center>
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-blue-400 text-sm font-mono">Loading glTF model...</div>
      </div>
    </Html>
  );
}

// ─── Scene ────────────────────────────────────────────────────────────────────

function Scene({
  modelId,
  telemetry,
  autoRotate,
  cameraPos,
  cameraTarget,
}: {
  modelId: string;
  telemetry: TelemetryData;
  autoRotate: boolean;
  cameraPos: [number, number, number];
  cameraTarget: [number, number, number];
}) {
  const url = MODEL_URLS[modelId] || MODEL_URLS.esp_pump;

  return (
    <>
      <PerspectiveCamera makeDefault position={cameraPos} fov={45} />
      <OrbitControls
        target={cameraTarget}
        enableDamping
        dampingFactor={0.05}
        minDistance={0.5}
        maxDistance={30}
      />

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-5, 5, -5]} intensity={0.4} color="#4488ff" />
      <pointLight position={[0, 5, 0]} intensity={0.5} color="#ffffff" />

      {/* Environment */}
      <Environment preset="warehouse" />

      {/* Ground grid */}
      <Grid
        args={[20, 20]}
        position={[0, -0.01, 0]}
        cellColor="#1e3a5f"
        sectionColor="#0ea5e9"
        cellSize={0.5}
        sectionSize={2}
        fadeDistance={15}
        infiniteGrid
      />

      {/* Contact shadow */}
      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.4}
        scale={10}
        blur={2}
        far={4}
      />

      {/* glTF Model */}
      <Suspense fallback={<ModelLoadingFallback />}>
        <GLTFModel url={url} telemetry={telemetry} autoRotate={autoRotate} />
        <TelemetryOverlay telemetry={telemetry} />
      </Suspense>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface EquipmentViewer3DProps {
  initialModelId?: string;
  telemetry?: Partial<TelemetryData>;
  height?: string;
  showControls?: boolean;
}

export function EquipmentViewer3D({
  initialModelId = "esp_pump",
  telemetry: externalTelemetry,
  height = "500px",
  showControls = true,
}: EquipmentViewer3DProps) {
  const [selectedModel, setSelectedModel] = useState(initialModelId);
  const [autoRotate, setAutoRotate] = useState(true);
  const [simulatedTelemetry, setSimulatedTelemetry] = useState<TelemetryData>({
    temperature_c: 85.0,
    pressure_psi:  2800.0,
    vibration_g:   0.4,
    anomaly:       false,
  });

  // Merge external telemetry with simulated
  const telemetry: TelemetryData = {
    ...simulatedTelemetry,
    ...externalTelemetry,
  };

  // Simulate live telemetry updates
  useEffect(() => {
    const interval = setInterval(() => {
      setSimulatedTelemetry(prev => ({
        temperature_c: Math.max(20, prev.temperature_c + (Math.random() - 0.5) * 2),
        pressure_psi:  Math.max(100, prev.pressure_psi  + (Math.random() - 0.5) * 50),
        vibration_g:   Math.max(0,   prev.vibration_g   + (Math.random() - 0.5) * 0.1),
        anomaly:       prev.anomaly,
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const spec = EQUIPMENT_SPECS.find(s => s.id === selectedModel) || EQUIPMENT_SPECS[0];

  return (
    <div className="flex flex-col gap-4">
      {showControls && (
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-52 bg-gray-900 border-gray-700">
              <SelectValue placeholder="Select equipment" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              {EQUIPMENT_SPECS.map(s => (
                <SelectItem key={s.id} value={s.id} className="text-gray-200">
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRotate(v => !v)}
            className="border-gray-600 text-gray-300"
          >
            {autoRotate ? "⏸ Stop Rotation" : "▶ Auto Rotate"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSimulatedTelemetry(prev => ({ ...prev, anomaly: !prev.anomaly }))}
            className={`border-gray-600 ${telemetry.anomaly ? "text-red-400 border-red-600" : "text-gray-300"}`}
          >
            {telemetry.anomaly ? "✓ Clear Anomaly" : "⚠ Simulate Anomaly"}
          </Button>

          <Badge variant="outline" className="border-blue-600 text-blue-400 font-mono text-xs">
            glTF 2.0 · PBR
          </Badge>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* 3D Canvas */}
        <div
          className="lg:col-span-3 rounded-xl overflow-hidden border border-gray-700 bg-gray-950"
          style={{ height }}
        >
          <Canvas
            shadows
            gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
            dpr={[1, 2]}
          >
            <Scene
              modelId={selectedModel}
              telemetry={telemetry}
              autoRotate={autoRotate}
              cameraPos={spec.cameraPos}
              cameraTarget={spec.cameraTarget}
            />
          </Canvas>
        </div>

        {/* Equipment Info Panel */}
        <div className="flex flex-col gap-3">
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-200">{spec.label}</CardTitle>
              <p className="text-xs text-gray-400">{spec.description}</p>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {Object.entries(spec.specs).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-gray-500">{k}</span>
                  <span className="text-gray-300 font-mono">{v}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-200">Live Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">Temperature</span>
                  <span className={`font-mono ${telemetry.temperature_c > 120 ? "text-red-400" : "text-green-400"}`}>
                    {telemetry.temperature_c.toFixed(1)}°C
                  </span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${telemetry.temperature_c > 120 ? "bg-red-500" : "bg-green-500"}`}
                    style={{ width: `${Math.min(100, telemetry.temperature_c / 1.5)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">Pressure</span>
                  <span className={`font-mono ${telemetry.pressure_psi > 4000 ? "text-red-400" : "text-blue-400"}`}>
                    {telemetry.pressure_psi.toFixed(0)} PSI
                  </span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${telemetry.pressure_psi > 4000 ? "bg-red-500" : "bg-blue-500"}`}
                    style={{ width: `${Math.min(100, telemetry.pressure_psi / 50)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">Vibration</span>
                  <span className={`font-mono ${telemetry.vibration_g > 2.0 ? "text-red-400" : "text-yellow-400"}`}>
                    {telemetry.vibration_g.toFixed(2)} g
                  </span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${telemetry.vibration_g > 2.0 ? "bg-red-500" : "bg-yellow-500"}`}
                    style={{ width: `${Math.min(100, telemetry.vibration_g * 25)}%` }}
                  />
                </div>
              </div>

              <div className={`mt-2 text-center text-xs font-semibold py-1.5 rounded ${
                telemetry.anomaly
                  ? "bg-red-900/50 text-red-300 border border-red-700"
                  : "bg-green-900/30 text-green-400 border border-green-800"
              }`}>
                {telemetry.anomaly ? "⚠ ANOMALY" : "✓ NOMINAL"}
              </div>
            </CardContent>
          </Card>

          <div className="text-xs text-gray-600 text-center">
            glTF 2.0 · PBR Materials · Monte Carlo PINN
          </div>
        </div>
      </div>
    </div>
  );
}

// Preload all models for instant switching
Object.values(MODEL_URLS).forEach(url => useGLTF.preload(url));

export default EquipmentViewer3D;
