/**
 * SubseaField3D.tsx — Three.js 3D Subsea Field Visualization
 * Design: Dark Amber — deep ocean environment, amber/teal accents
 * Uses React Three Fiber + Drei for declarative Three.js
 */

import { useRef, useState, useMemo, Suspense } from "react";
import { Canvas, useFrame, ThreeElements } from "@react-three/fiber";
import { OrbitControls, Text, Line, Html, Environment } from "@react-three/drei";
import * as THREE from "three";
type SubseaTree = Record<string, any>;
// Default trees for visualization when no live data available
const DEFAULT_TREES: SubseaTree[] = [
  { tree_id: "ST-001", tree_tag: "ST-001", status: "ACTIVE", tubing_pressure_psi: 1450, annulus_pressure_psi: 820, tree_temp_f: 142, choke_position_pct: 75, water_depth_m: 120 },
  { tree_id: "ST-002", tree_tag: "ST-002", status: "ACTIVE", tubing_pressure_psi: 1380, annulus_pressure_psi: 790, tree_temp_f: 138, choke_position_pct: 80, water_depth_m: 135 },
  { tree_id: "ST-003", tree_tag: "ST-003", status: "SHUT_IN", tubing_pressure_psi: 0, annulus_pressure_psi: 0, tree_temp_f: 68, choke_position_pct: 0, water_depth_m: 110 },
  { tree_id: "ST-004", tree_tag: "ST-004", status: "ACTIVE", tubing_pressure_psi: 1520, annulus_pressure_psi: 850, tree_temp_f: 148, choke_position_pct: 70, water_depth_m: 145 },
];

// ── Color palette ─────────────────────────────────────────────────────────────
const COLORS = {
  seabed: new THREE.Color("#1a2744"),
  seabedGrid: new THREE.Color("#1e3a5f"),
  water: new THREE.Color("#0a1628"),
  fpso: new THREE.Color("#d97706"),
  fpsoHull: new THREE.Color("#92400e"),
  tree_active: new THREE.Color("#10b981"),
  tree_inactive: new THREE.Color("#6b7280"),
  tree_alarm: new THREE.Color("#ef4444"),
  flowline: new THREE.Color("#0ea5e9"),
  umbilical: new THREE.Color("#f59e0b"),
  manifold: new THREE.Color("#8b5cf6"),
  riser: new THREE.Color("#38bdf8"),
  label_bg: new THREE.Color("#111827"),
};

// ── Seabed grid ───────────────────────────────────────────────────────────────
function SeabedGrid() {
  const gridRef = useRef<THREE.GridHelper>(null);
  return (
    <group position={[0, -8, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial
          color={COLORS.seabed}
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>
      <gridHelper args={[60, 30, COLORS.seabedGrid, COLORS.seabedGrid]} />
      {/* Seabed texture bumps */}
      {Array.from({ length: 20 }).map((_, i) => (
        <mesh
          key={i}
          position={[
            (Math.sin(i * 2.3) * 25),
            -7.85,
            (Math.cos(i * 1.7) * 25),
          ]}
          rotation={[-Math.PI / 2, 0, Math.random() * Math.PI]}
        >
          <coneGeometry args={[0.3 + Math.random() * 0.4, 0.3, 6]} />
          <meshStandardMaterial color={COLORS.seabed} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

// ── Water volume (semi-transparent) ──────────────────────────────────────────
function WaterVolume() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (meshRef.current) {
      (meshRef.current.material as THREE.MeshStandardMaterial).opacity =
        0.12 + Math.sin(clock.getElapsedTime() * 0.5) * 0.02;
    }
  });
  return (
    <mesh ref={meshRef} position={[0, 2, 0]}>
      <boxGeometry args={[60, 20, 60]} />
      <meshStandardMaterial
        color={COLORS.water}
        transparent
        opacity={0.12}
        side={THREE.BackSide}
      />
    </mesh>
  );
}

// ── FPSO vessel at surface ────────────────────────────────────────────────────
function FPSOVessel() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.position.y = 12 + Math.sin(clock.getElapsedTime() * 0.4) * 0.15;
      groupRef.current.rotation.z = Math.sin(clock.getElapsedTime() * 0.3) * 0.02;
    }
  });

  return (
    <group ref={groupRef} position={[0, 12, 0]}>
      {/* Hull */}
      <mesh castShadow>
        <boxGeometry args={[14, 2.5, 4]} />
        <meshStandardMaterial color={COLORS.fpsoHull} roughness={0.6} metalness={0.4} />
      </mesh>
      {/* Superstructure */}
      <mesh position={[-3, 2, 0]} castShadow>
        <boxGeometry args={[5, 2, 3.5]} />
        <meshStandardMaterial color={COLORS.fpso} roughness={0.5} metalness={0.5} />
      </mesh>
      {/* Flare boom */}
      <mesh position={[5, 3.5, 0]} rotation={[0, 0, Math.PI / 8]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 5, 8]} />
        <meshStandardMaterial color="#d1d5db" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Flare flame */}
      <pointLight position={[7.5, 5.5, 0]} color="#ff6600" intensity={3} distance={8} />
      <mesh position={[7.5, 5.5, 0]}>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshStandardMaterial color="#ff6600" emissive="#ff3300" emissiveIntensity={2} />
      </mesh>
      {/* Label */}
      <Html position={[0, 3.5, 0]} center distanceFactor={20}>
        <div className="bg-amber-900/90 border border-amber-500/50 rounded px-2 py-1 text-[10px] font-mono text-amber-300 whitespace-nowrap pointer-events-none">
          FPSO PIONEER — 48,320 BPD
        </div>
      </Html>
    </group>
  );
}

// ── Riser (FPSO to seabed) ────────────────────────────────────────────────────
function Riser({ x, z, color }: { x: number; z: number; color: THREE.Color }) {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const sway = Math.sin(t * Math.PI) * 0.8;
      pts.push(new THREE.Vector3(x + sway * 0.3, 12 - t * 20, z + sway * 0.2));
    }
    return pts;
  }, [x, z]);

  return (
    <Line
      points={points}
      color={color}
      lineWidth={1.5}
      transparent
      opacity={0.7}
    />
  );
}

// ── Subsea manifold ───────────────────────────────────────────────────────────
function SubseaManifoldMesh({ position }: { position: [number, number, number] }) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (meshRef.current) {
      (meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        0.3 + Math.sin(clock.getElapsedTime() * 2) * 0.1;
    }
  });
  return (
    <group position={position}>
      <mesh ref={meshRef} castShadow>
        <boxGeometry args={[3, 0.8, 2]} />
        <meshStandardMaterial
          color={COLORS.manifold}
          emissive={COLORS.manifold}
          emissiveIntensity={0.3}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>
      {/* Manifold legs */}
      {[[-1.2, -0.6, -0.7], [1.2, -0.6, -0.7], [-1.2, -0.6, 0.7], [1.2, -0.6, 0.7]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]}>
          <cylinderGeometry args={[0.08, 0.08, 0.5, 6]} />
          <meshStandardMaterial color="#4b5563" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
      <Html position={[0, 1.2, 0]} center distanceFactor={20}>
        <div className="bg-purple-900/90 border border-purple-500/50 rounded px-1.5 py-0.5 text-[9px] font-mono text-purple-300 whitespace-nowrap pointer-events-none">
          MANIFOLD-A
        </div>
      </Html>
    </group>
  );
}

// ── Subsea tree ───────────────────────────────────────────────────────────────
interface SubseaTreeMeshProps {
  tree: SubseaTree;
  position: [number, number, number];
  onClick: (tree: SubseaTree) => void;
  selected: boolean;
}

function SubseaTreeMesh({ tree, position, onClick, selected }: SubseaTreeMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const treeColor = tree.status === "ACTIVE"
    ? COLORS.tree_active
    : tree.status === "SHUT_IN"
    ? COLORS.tree_inactive
    : COLORS.tree_alarm;

  useFrame(({ clock }) => {
    if (groupRef.current && (tree.status === "WORKOVER" || tree.status === "DRILLING")) {
      const pulse = Math.sin(clock.getElapsedTime() * 4) * 0.5 + 0.5;
      (groupRef.current.children[0] as THREE.Mesh).scale.setScalar(1 + pulse * 0.1);
    }
    if (groupRef.current && selected) {
      groupRef.current.rotation.y += 0.01;
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={() => onClick(tree)}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Tree body */}
      <mesh castShadow>
        <boxGeometry args={[0.8, 1.8, 0.8]} />
        <meshStandardMaterial
          color={hovered || selected ? treeColor.clone().multiplyScalar(1.5) : treeColor}
          emissive={treeColor}
          emissiveIntensity={hovered || selected ? 0.8 : 0.3}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>
      {/* Christmas tree cap */}
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.4, 0.5, 8]} />
        <meshStandardMaterial color={treeColor} metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Tree base plate */}
      <mesh position={[0, -1.1, 0]}>
        <boxGeometry args={[1.4, 0.2, 1.4]} />
        <meshStandardMaterial color="#374151" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Status light */}
      <pointLight
        position={[0, 1.5, 0]}
        color={treeColor}
        intensity={tree.status === "ACTIVE" ? 2 : 0.5}
        distance={4}
      />
      {/* Label on hover or selected */}
      {(hovered || selected) && (
        <Html position={[0, 2.5, 0]} center distanceFactor={15}>
          <div className="bg-gray-900/95 border border-amber-500/50 rounded p-2 text-[9px] font-mono whitespace-nowrap pointer-events-none min-w-[140px]">
            <div className="text-amber-400 font-bold mb-1">{tree.tree_tag}</div>
            <div className="text-gray-300">Tubing: <span className="text-amber-300">{tree.tubing_pressure_psi.toLocaleString()} PSI</span></div>
            <div className="text-gray-300">Annulus: <span className="text-blue-300">{tree.annulus_pressure_psi.toLocaleString()} PSI</span></div>
            <div className="text-gray-300">Temp: <span className="text-orange-300">{tree.tree_temp_f}°F</span></div>
            <div className="text-gray-300">Choke: <span className="text-green-300">{tree.choke_position_pct}%</span></div>
            <div className={`mt-1 font-bold ${tree.status === "ACTIVE" ? "text-emerald-400" : tree.status === "WORKOVER" || tree.status === "DRILLING" ? "text-amber-400" : "text-gray-400"}`}>
              ● {tree.status}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ── Flowline between tree and manifold ───────────────────────────────────────
function Flowline({
  from,
  to,
  active,
}: {
  from: [number, number, number];
  to: [number, number, number];
  active: boolean;
}) {
  const points = useMemo(() => {
    const mid: [number, number, number] = [
      (from[0] + to[0]) / 2,
      from[1] - 0.3,
      (from[2] + to[2]) / 2,
    ];
    return [
      new THREE.Vector3(...from),
      new THREE.Vector3(...mid),
      new THREE.Vector3(...to),
    ];
  }, [from, to]);

  return (
    <Line
      points={points}
      color={active ? COLORS.flowline : "#374151"}
      lineWidth={active ? 2.5 : 1}
      transparent
      opacity={active ? 0.85 : 0.4}
    />
  );
}

// ── Umbilical ─────────────────────────────────────────────────────────────────
function UmbilicalLine({
  from,
  to,
}: {
  from: [number, number, number];
  to: [number, number, number];
}) {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const sway = Math.sin(t * Math.PI * 2) * 0.5;
      pts.push(
        new THREE.Vector3(
          from[0] + (to[0] - from[0]) * t + sway * 0.3,
          from[1] + (to[1] - from[1]) * t,
          from[2] + (to[2] - from[2]) * t + sway * 0.2,
        )
      );
    }
    return pts;
  }, [from, to]);

  return (
    <Line
      points={points}
      color={COLORS.umbilical}
      lineWidth={1}
      transparent
      opacity={0.5}
      dashed
      dashScale={2}
    />
  );
}

// ── Particle system (bubbles / sediment) ─────────────────────────────────────
function UnderwaterParticles() {
  const count = 80;
  const meshRef = useRef<THREE.Points>(null);

  const { positions } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 1] = Math.random() * 20 - 8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    return { positions };
  }, []);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const pos = meshRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        pos[i * 3 + 1] += 0.01;
        if (pos[i * 3 + 1] > 14) pos[i * 3 + 1] = -8;
      }
      meshRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#38bdf8"
        size={0.08}
        transparent
        opacity={0.4}
        sizeAttenuation
      />
    </points>
  );
}

// ── Scene ─────────────────────────────────────────────────────────────────────

// Tree positions in 3D space (spread around manifold)
const TREE_POSITIONS: [number, number, number][] = [
  [-8, -7, -6],
  [-4, -7, -8],
  [2, -7, -9],
  [7, -7, -5],
  [9, -7, 2],
  [5, -7, 7],
];

const MANIFOLD_POS: [number, number, number] = [0, -7.5, 0];

function SubseaScene({ onSelectTree, trees }: { onSelectTree: (tree: SubseaTree | null) => void; trees: SubseaTree[] }) {
  const MOCK_SUBSEA_TREES = trees;
  const [selectedTree, setSelectedTree] = useState<SubseaTree | null>(null);

  function handleTreeClick(tree: SubseaTree) {
    const next = selectedTree?.tree_id === tree.tree_id ? null : tree;
    setSelectedTree(next);
    onSelectTree(next);
  }

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} color="#1a3a5c" />
      <directionalLight position={[10, 20, 10]} intensity={0.8} color="#60a5fa" castShadow />
      <pointLight position={[0, 15, 0]} intensity={1.5} color="#dbeafe" distance={40} />
      <pointLight position={[-15, -5, -15]} intensity={0.5} color="#1e40af" distance={30} />

      {/* Environment */}
      <fog attach="fog" args={["#0a1628", 20, 70]} />

      {/* Scene elements */}
      <SeabedGrid />
      <WaterVolume />
      <FPSOVessel />
      <UnderwaterParticles />

      {/* Manifold */}
      <SubseaManifoldMesh position={MANIFOLD_POS} />

      {/* Risers from FPSO to manifold area */}
      <Riser x={-1} z={0} color={COLORS.riser} />
      <Riser x={1} z={0.5} color={COLORS.umbilical} />

      {/* Subsea trees */}
      {MOCK_SUBSEA_TREES.map((tree, i) => {
        const pos = TREE_POSITIONS[i % TREE_POSITIONS.length];
        return (
          <SubseaTreeMesh
            key={tree.tree_id}
            tree={tree}
            position={pos}
            onClick={handleTreeClick}
            selected={selectedTree?.tree_id === tree.tree_id}
          />
        );
      })}

      {/* Flowlines: tree → manifold */}
      {MOCK_SUBSEA_TREES.map((tree, i) => {
        const pos = TREE_POSITIONS[i % TREE_POSITIONS.length];
        return (
          <Flowline
            key={`fl-${tree.tree_id}`}
            from={[pos[0], pos[1] - 0.9, pos[2]]}
            to={[MANIFOLD_POS[0], MANIFOLD_POS[1], MANIFOLD_POS[2]]}
            active={tree.status === "ACTIVE"}
          />
        );
      })}

      {/* Umbilicals: tree → FPSO (via riser) */}
      {MOCK_SUBSEA_TREES.map((tree, i) => {
        const pos = TREE_POSITIONS[i % TREE_POSITIONS.length];
        return (
          <UmbilicalLine
            key={`umb-${tree.tree_id}`}
            from={[pos[0], pos[1] + 1, pos[2]]}
            to={[0, 12, 0]}
          />
        );
      })}

      {/* Depth markers */}
      {[-2, -4, -6, -8].map((y, i) => (
        <Html key={y} position={[-28, y, -28]} center distanceFactor={25}>
          <div className="text-[8px] font-mono text-blue-400/60 whitespace-nowrap pointer-events-none">
            {(i + 1) * 250}m
          </div>
        </Html>
      ))}

      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        minDistance={5}
        maxDistance={60}
        maxPolarAngle={Math.PI * 0.85}
      />
    </>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

interface SubseaField3DProps {
  height?: number;
  trees?: SubseaTree[];
}
export default function SubseaField3D({ height = 520, trees }: SubseaField3DProps) {
  const MOCK_SUBSEA_TREES = (trees && trees.length > 0) ? trees : DEFAULT_TREES;
  const [selectedTree, setSelectedTree] = useState<SubseaTree | null>(null);;

  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-border bg-[#0a1628]" style={{ height }}>
      {/* Controls hint */}
      <div className="absolute top-3 left-3 z-10 bg-black/60 rounded px-2 py-1 text-[9px] font-mono text-blue-400/80 pointer-events-none">
        Drag to orbit · Scroll to zoom · Click tree to inspect
      </div>

      {/* Legend */}
      <div className="absolute top-3 right-3 z-10 bg-black/70 border border-white/10 rounded p-2 space-y-1">
        {[
          { color: "#10b981", label: "Active tree" },
          { color: "#ef4444", label: "Alarm" },
          { color: "#6b7280", label: "Shut-in" },
          { color: "#0ea5e9", label: "Flowline" },
          { color: "#f59e0b", label: "Umbilical" },
          { color: "#8b5cf6", label: "Manifold" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-[9px] font-mono text-gray-400">{label}</span>
          </div>
        ))}
      </div>

      {/* Selected tree info panel */}
      {selectedTree && (
        <div className="absolute bottom-3 left-3 z-10 bg-gray-900/95 border border-amber-500/40 rounded-lg p-3 min-w-[200px]">
          <div className="text-xs font-bold font-[Syne] text-amber-400 mb-2">{selectedTree.tree_tag}</div>
          <div className="space-y-1 text-[10px] font-mono">
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Type</span>
              <span className="text-gray-200">{selectedTree.tree_type}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Water Depth</span>
              <span className="text-blue-300">{selectedTree.water_depth_m}m</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Tubing P</span>
              <span className="text-amber-300">{selectedTree.tubing_pressure_psi.toLocaleString()} PSI</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Annulus P</span>
              <span className="text-amber-300">{selectedTree.annulus_pressure_psi.toLocaleString()} PSI</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Temperature</span>
              <span className="text-orange-300">{selectedTree.tree_temp_f}°F</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Choke</span>
              <span className="text-green-300">{selectedTree.choke_position_pct}%</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Master Valve</span>
              <span className={selectedTree.master_valve_open ? "text-emerald-400" : "text-red-400"}>
                {selectedTree.master_valve_open ? "OPEN" : "CLOSED"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Wing Valve</span>
              <span className={selectedTree.wing_valve_open ? "text-emerald-400" : "text-red-400"}>
                {selectedTree.wing_valve_open ? "OPEN" : "CLOSED"}
              </span>
            </div>
          </div>
          <button
            className="mt-2 text-[9px] text-gray-500 hover:text-gray-300"
            onClick={() => setSelectedTree(null)}
          >
            ✕ Dismiss
          </button>
        </div>
      )}

      {/* Three.js Canvas */}
      <Canvas
        shadows
        camera={{ position: [20, 15, 25], fov: 50, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: "#0a1628" }}
      >
        <Suspense fallback={null}>
          <SubseaScene onSelectTree={setSelectedTree} trees={MOCK_SUBSEA_TREES} />
        </Suspense>
      </Canvas>
    </div>
  );
}
