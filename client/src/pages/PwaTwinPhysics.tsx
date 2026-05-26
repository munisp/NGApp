/**
 * PwaTwinPhysics.tsx — PWA Digital Twin with Rust Physics Engine v49.0
 *
 * Production-ready features:
 *  1. Live SVG well schematic with formation layers
 *  2. Nodal Analysis (Vogel IPR + VLP) with multi-well comparison
 *  3. Decline Curve (Arps) with CSV export
 *  4. Turner Liquid Loading with remediation guidance
 *  5. Geomechanics 1D MEM with mud weight window visualization
 *  6. Sand Onset (Morita-Willson) with risk gauge
 *  7. PDF export for all 5 calculators
 *  8. Physics results history (last 10 runs per calculator in localStorage)
 *  9. Auto-run on slider change (debounced 500ms)
 * 10. Loading skeleton while computing
 * 11. Mobile-responsive layout
 * 12. Tooltip help text on each calculator parameter
 * 13. Units toggle (metric/imperial)
 * 14. ARIA labels on all interactive elements
 * 15. Well selector dropdown
 * 16. Error messages with retry
 * 17. Offline detection badge
 * 18. Operating point reference line on nodal chart
 * 19. Drawdown gauge bar on sand onset
 * 20. Velocity comparison bar chart on Turner
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useCollaboration, type CollabUser } from "@/hooks/useCollaboration";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Activity, TrendingDown, Wind, Mountain, AlertTriangle,
  Atom, Play, RefreshCw, Cpu, Download, FileText,
  History, Info, ChevronDown, ChevronUp, Layers, BarChart3,
  Wifi, WifiOff, Users, Circle,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, Legend, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, Cell, ReferenceLine,
} from "recharts";

// ─── App-wide constants ───────────────────────────────────────────────────────
const APP_VERSION = "v50.0";
const DEFAULT_WELL_ID = "WELL-001";
const HISTORY_KEY_PREFIX = "og-rmm-physics-history-";
const MAX_HISTORY = 10;
const DEBOUNCE_MS = 600;

const RISK_COLOR: Record<string, string> = {
  SAFE: "#22c55e", LOW: "#84cc16", MODERATE: "#f59e0b",
  HIGH: "#f97316", CRITICAL: "#ef4444", UNKNOWN: "#6b7280",
};
const LOADING_COLOR: Record<string, string> = {
  UNLOADED: "#22c55e", AT_RISK: "#f59e0b",
  LOADING: "#f97316", SEVERE_LOADING: "#ef4444", UNKNOWN: "#6b7280",
};
const WELL_OPTIONS = ["WELL-001","WELL-002","WELL-003","WELL-004","WELL-005","WELL-006"];

// ─── localStorage history ─────────────────────────────────────────────────────
function loadHistory(key: string): any[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY_PREFIX + key) ?? "[]"); }
  catch { return []; }
}
function saveHistory(key: string, result: any) {
  const h = loadHistory(key);
  h.unshift({ ...result, _ts: Date.now() });
  localStorage.setItem(HISTORY_KEY_PREFIX + key, JSON.stringify(h.slice(0, MAX_HISTORY)));
}

// ─── CSV export ───────────────────────────────────────────────────────────────
function downloadCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => r[h] ?? "").join(","))].join("\n");
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

// ─── PDF export ───────────────────────────────────────────────────────────────
function exportToPDF(title: string, bodyHtml: string) {
  const w = window.open("", "_blank");
  if (!w) { toast.error("Pop-up blocked — allow pop-ups to export PDF"); return; }
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
  <style>
    body{font-family:monospace;background:#0d1117;color:#e5e7eb;padding:24px}
    h1{color:#d97706;font-size:18px;border-bottom:1px solid #374151;padding-bottom:8px}
    h2{color:#9ca3af;font-size:14px;margin-top:16px}
    table{border-collapse:collapse;width:100%;margin-top:8px}
    th{background:#1f2937;color:#d97706;padding:6px 10px;text-align:left;font-size:12px}
    td{padding:5px 10px;font-size:12px;border-bottom:1px solid #1f2937}
    .footer{margin-top:24px;color:#6b7280;font-size:11px}
    @media print{body{background:white;color:black}th{background:#f3f4f6;color:#374151}}
  </style></head><body>
  <h1>OG-RMM ${APP_VERSION} — ${title}</h1>
  ${bodyHtml}
  <div class="footer">Generated: ${new Date().toISOString()} | OG-RMM Platform ${APP_VERSION}</div>
  <script>setTimeout(()=>window.print(),500)</script>
  </body></html>`);
  w.document.close();
}

// ─── Tooltip-wrapped slider ───────────────────────────────────────────────────
function ParamSlider({
  label, paramKey, value, min, max, step, unit, tooltip, onChange,
}: {
  label: string; paramKey: string; value: number; min: number; max: number;
  step: number; unit: string; tooltip: string; onChange: (k: string, v: number) => void;
}) {
  const displayVal = step < 0.01 ? value.toFixed(3) : step < 1 ? value.toFixed(2) : value.toFixed(0);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Label className="text-zinc-400 text-xs">{label}</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-zinc-600 cursor-help shrink-0" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs bg-zinc-800 border-zinc-700 text-zinc-200">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <span className="text-white text-xs font-mono shrink-0">{displayVal} {unit}</span>
      </div>
      <Slider
        min={min} max={max} step={step} value={[value]}
        onValueChange={([v]) => onChange(paramKey, v)}
        aria-label={label}
      />
    </div>
  );
}

// ─── History panel ────────────────────────────────────────────────────────────
function HistoryPanel({ histKey, label }: { histKey: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  useEffect(() => { if (open) setHistory(loadHistory(histKey)); }, [histKey, open]);
  const history0 = loadHistory(histKey);
  if (!history0.length) return null;
  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        aria-expanded={open}
      >
        <History className="w-3 h-3" />
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        Last {history0.length} {label} runs
      </button>
      {open && (
        <div className="mt-2 space-y-1 max-h-36 overflow-y-auto pr-1">
          {history.map((h, i) => (
            <div key={i} className="flex items-center justify-between text-xs bg-zinc-900 rounded px-2 py-1 border border-zinc-800">
              <span className="text-zinc-500 font-mono">{new Date(h._ts).toLocaleTimeString()}</span>
              <span className="text-zinc-300 font-mono truncate ml-2">
                {h.operating_point ? `Q=${h.operating_point.q?.toFixed(0)} bpd` :
                 h.eur_mbbl ? `EUR=${h.eur_mbbl?.toFixed(1)} Mbbl` :
                 h.loading_status ?? h.sand_risk ??
                 (h.fracture_gradient_ppg ? `FG=${h.fracture_gradient_ppg?.toFixed(2)} ppg` : "—")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function ResultSkeleton() {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardContent className="pt-4 space-y-3 animate-pulse">
        <div className="h-4 bg-zinc-800 rounded w-3/4" />
        <div className="h-4 bg-zinc-800 rounded w-1/2" />
        <div className="h-40 bg-zinc-800 rounded" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-16 bg-zinc-800 rounded" />
          <div className="h-16 bg-zinc-800 rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Well Schematic ───────────────────────────────────────────────────────────
function WellSchematic({
  nodalResult, turnerResult, sandResult, declineResult, geoResult,
  remoteCursors, onCursorMove,
}: {
  nodalResult: any; turnerResult: any; sandResult: any;
  declineResult: any; geoResult: any;
  remoteCursors?: Array<{ userId: string; userName: string; color: string; x: number; y: number }>;
  onCursorMove?: (x: number, y: number) => void;
}) {
  const svgContainerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onCursorMove || !svgContainerRef.current) return;
    const rect = svgContainerRef.current.getBoundingClientRect();
    // Normalize to 0-500 x 0-300 (SVG viewBox)
    const x = ((e.clientX - rect.left) / rect.width) * 500;
    const y = ((e.clientY - rect.top) / rect.height) * 300;
    onCursorMove(Math.round(x), Math.round(y));
  }, [onCursorMove]);
  const loadingStatus = turnerResult?.loading_status ?? "UNKNOWN";
  const sandRisk = sandResult?.sand_risk ?? "UNKNOWN";
  const op = nodalResult?.operating_point;
  const wellColor =
    (loadingStatus === "SEVERE_LOADING" || sandRisk === "CRITICAL") ? "#ef4444" :
    (loadingStatus === "LOADING" || sandRisk === "HIGH") ? "#f97316" :
    (loadingStatus === "AT_RISK" || sandRisk === "MODERATE") ? "#f59e0b" : "#22c55e";

  return (
    <div
      ref={svgContainerRef}
      className="relative w-full bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden"
      style={{ minHeight: 300 }}
      onMouseMove={handleMouseMove}
    >
      <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid-pwa49" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#6b7280" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-pwa49)" />
      </svg>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 500 300" xmlns="http://www.w3.org/2000/svg">
        {/* Formation layers */}
        <rect x="0" y="0" width="500" height="80" fill="#1a1a2e" opacity="0.7" />
        <rect x="0" y="80" width="500" height="70" fill="#16213e" opacity="0.6" />
        <rect x="0" y="150" width="500" height="70" fill="#0f3460" opacity="0.5" />
        <rect x="0" y="220" width="500" height="80" fill="#533483" opacity="0.4" />
        <text x="8" y="45" fill="#374151" fontSize="8" fontFamily="monospace">SURFACE CASING</text>
        <text x="8" y="120" fill="#374151" fontSize="8" fontFamily="monospace">INTERMEDIATE</text>
        <text x="8" y="190" fill="#374151" fontSize="8" fontFamily="monospace">PRODUCTION ZONE</text>
        <text x="8" y="265" fill="#6d28d9" fontSize="8" fontFamily="monospace">RESERVOIR</text>
        {/* Casing */}
        <rect x="220" y="5" width="60" height="285" rx="2" fill="none" stroke="#374151" strokeWidth="1.5" strokeDasharray="5 3" />
        {/* Tubing */}
        <rect x="232" y="5" width="36" height="260" rx="2" fill={wellColor + "18"} stroke={wellColor} strokeWidth="2" />
        {/* Wellhead */}
        <rect x="215" y="2" width="70" height="24" rx="4" fill="#1f2937" stroke="#6b7280" strokeWidth="1.5" />
        <text x="250" y="17" textAnchor="middle" fill="#9ca3af" fontSize="8" fontFamily="monospace">WELLHEAD</text>
        {/* Flow arrows */}
        {op && [50, 75, 100, 125, 150].map((y, i) => (
          <text key={i} x="250" y={y} textAnchor="middle" fill={wellColor} fontSize="12" opacity={0.5 + i * 0.1}>^</text>
        ))}
        {/* ESP */}
        <rect x="228" y="175" width="44" height="28" rx="3" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="1.5" />
        <text x="250" y="193" textAnchor="middle" fill="#60a5fa" fontSize="7" fontFamily="monospace">ESP</text>
        {/* Perforations */}
        {[235, 245, 255, 265, 275].map((y, i) => (
          <g key={i}>
            <line x1="232" y1={y} x2="218" y2={y} stroke="#f59e0b" strokeWidth="1.5" />
            <line x1="268" y1={y} x2="282" y2={y} stroke="#f59e0b" strokeWidth="1.5" />
            <circle cx="215" cy={y} r="2" fill="#f59e0b" />
            <circle cx="285" cy={y} r="2" fill="#f59e0b" />
          </g>
        ))}
        {/* Reservoir */}
        <rect x="195" y="228" width="110" height="60" rx="3" fill="#78350f22" stroke="#92400e" strokeWidth="1" strokeDasharray="3 2" />
        <text x="250" y="262" textAnchor="middle" fill="#d97706" fontSize="7" fontFamily="monospace">RESERVOIR</text>
        {/* Status panel */}
        <rect x="10" y="10" width="130" height="80" rx="5" fill="#111827" stroke="#374151" strokeWidth="1" opacity="0.95" />
        <text x="18" y="26" fill="#d97706" fontSize="8" fontFamily="monospace" fontWeight="bold">WELL STATUS</text>
        <circle cx="130" cy="20" r="5" fill={wellColor} />
        <text x="18" y="40" fill="#9ca3af" fontSize="7" fontFamily="monospace">Q: {op ? `${op.q?.toFixed(0)} bpd` : "—"}</text>
        <text x="18" y="52" fill="#9ca3af" fontSize="7" fontFamily="monospace">BHP: {op ? `${op.pwf?.toFixed(0)} psia` : "—"}</text>
        <text x="18" y="64" fill="#9ca3af" fontSize="7" fontFamily="monospace">Flow: {loadingStatus.replace(/_/g, " ")}</text>
        <text x="18" y="76" fill="#9ca3af" fontSize="7" fontFamily="monospace">Sand: {sandRisk}</text>
        <text x="18" y="88" fill="#4b5563" fontSize="6" fontFamily="monospace">OG-RMM {APP_VERSION}</text>
        {/* Decline panel */}
        {declineResult && (
          <>
            <rect x="360" y="10" width="130" height="55" rx="5" fill="#111827" stroke="#374151" strokeWidth="1" opacity="0.95" />
            <text x="368" y="26" fill="#d97706" fontSize="8" fontFamily="monospace" fontWeight="bold">DECLINE</text>
            <text x="368" y="40" fill="#9ca3af" fontSize="7" fontFamily="monospace">EUR: {declineResult.eur_mbbl?.toFixed(1)} Mbbl</text>
            <text x="368" y="52" fill="#9ca3af" fontSize="7" fontFamily="monospace">12mo: {declineResult.eur_12mo?.toFixed(1)} Mbbl</text>
          </>
        )}
        {/* Geo panel */}
        {geoResult && (
          <>
            <rect x="360" y="75" width="130" height="55" rx="5" fill="#111827" stroke="#374151" strokeWidth="1" opacity="0.95" />
            <text x="368" y="91" fill="#d97706" fontSize="8" fontFamily="monospace" fontWeight="bold">MUD WINDOW</text>
            <text x="368" y="105" fill="#9ca3af" fontSize="7" fontFamily="monospace">Lo: {geoResult.mw_lower_ppg?.toFixed(2)} ppg</text>
            <text x="368" y="117" fill="#9ca3af" fontSize="7" fontFamily="monospace">Hi: {geoResult.fracture_gradient_ppg?.toFixed(2)} ppg</text>
          </>
        )}
        {/* ── Remote cursor overlay ── */}
        {remoteCursors && remoteCursors.map(c => (
          <g key={c.userId}>
            {/* Cursor dot */}
            <circle cx={c.x} cy={c.y} r="5" fill={c.color} opacity="0.85" />
            {/* Cursor name label */}
            <rect x={c.x + 7} y={c.y - 9} width={c.userName.length * 5 + 6} height="12" rx="2" fill={c.color} opacity="0.9" />
            <text x={c.x + 10} y={c.y} fill="white" fontSize="7" fontFamily="monospace" fontWeight="bold">{c.userName.slice(0, 10)}</text>
          </g>
        ))}
      </svg>
      {/* Status badges */}
      <div className="absolute bottom-2 left-2 right-2 flex gap-2 flex-wrap">
        <Badge className="text-xs" style={{
          backgroundColor: (LOADING_COLOR[loadingStatus] ?? "#6b7280") + "22",
          color: LOADING_COLOR[loadingStatus] ?? "#9ca3af",
          border: `1px solid ${(LOADING_COLOR[loadingStatus] ?? "#6b7280")}44`,
        }}>
          Flow: {loadingStatus.replace(/_/g, " ")}
        </Badge>
        <Badge className="text-xs" style={{
          backgroundColor: (RISK_COLOR[sandRisk] ?? "#6b7280") + "22",
          color: RISK_COLOR[sandRisk] ?? "#9ca3af",
          border: `1px solid ${(RISK_COLOR[sandRisk] ?? "#6b7280")}44`,
        }}>
          Sand: {sandRisk}
        </Badge>
        {op && (
          <Badge className="text-xs bg-blue-950/40 text-blue-300 border-blue-700/40">
            {op.q?.toFixed(0)} bpd @ {op.pwf?.toFixed(0)} psia
          </Badge>
        )}
      </div>
    </div>
  );
}

// ──// ─── ML Failure Prediction Panel ───────────────────────────────────────────────────
function MLFailurePrediction({ wellId }: { wellId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [physicsHistory, setPhysicsHistory] = useState<Record<string, any[]>>({});

  // Load physics history from localStorage
  useEffect(() => {
    const keys = ["nodal", "decline", "turner", "geo", "sand"];
    const hist: Record<string, any[]> = {};
    keys.forEach(k => {
      try { hist[k] = JSON.parse(localStorage.getItem(`og-rmm-physics-history-${k}`) ?? "[]"); }
      catch { hist[k] = []; }
    });
    setPhysicsHistory(hist);
  }, [wellId]);

  const totalRuns = Object.values(physicsHistory).reduce((s, v) => s + v.length, 0);

  const predictMut = trpc.collaboration.predictFailure.useMutation();

  const runPrediction = useCallback(() => {
    // Flatten all history entries into the format the router expects
    const allEntries: Array<{ tab: string; timestamp: number; params: Record<string, number | string>; result: Record<string, unknown> }> = [];
    Object.entries(physicsHistory).forEach(([tab, entries]) => {
      entries.slice(0, 5).forEach((e: any) => {
        allEntries.push({
          tab,
          timestamp: e._ts ?? Date.now(),
          params: {},
          result: e,
        });
      });
    });
    predictMut.mutate({ wellId, history: allEntries });
  }, [wellId, physicsHistory, predictMut]);

  const result = predictMut.data;
  const RISK_BG: Record<string, string> = {
    LOW: "bg-green-950/40 border-green-700/40 text-green-400",
    MEDIUM: "bg-amber-950/40 border-amber-700/40 text-amber-400",
    HIGH: "bg-orange-950/40 border-orange-700/40 text-orange-400",
    CRITICAL: "bg-red-950/40 border-red-700/40 text-red-400",
    UNKNOWN: "bg-zinc-800 border-zinc-700 text-zinc-400",
  };

  return (
    <Card className="bg-zinc-900/60 border-zinc-800">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-purple-950/40 rounded border border-purple-700/40">
              <Activity className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-sm text-zinc-200">ML Failure Prediction</CardTitle>
              <p className="text-xs text-zinc-500">{totalRuns} physics runs analyzed · {wellId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {result && (
              <Badge className={`text-xs border ${RISK_BG[result.riskLevel] ?? "bg-zinc-800 text-zinc-400"}`}>
                {result.riskLevel} RISK ({result.riskScore})
              </Badge>
            )}
            <Button
              size="sm" variant="outline"
              className="h-7 text-xs border-purple-700/50 text-purple-300 hover:bg-purple-950/30"
              onClick={runPrediction}
              disabled={predictMut.isPending || totalRuns === 0}
            >
              {predictMut.isPending ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <Play className="w-3 h-3 mr-1" />}
              {totalRuns === 0 ? "Run physics first" : "Predict Failures"}
            </Button>
            <button onClick={() => setExpanded(e => !e)} className="text-zinc-500 hover:text-zinc-300">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </CardHeader>
      {expanded && result && (
        <CardContent className="px-4 pb-4 space-y-3">
          {/* Primary concern */}
          <div className="p-2 bg-zinc-950 rounded border border-zinc-800">
            <div className="text-xs font-medium text-zinc-300 mb-0.5">Primary Concern</div>
            <div className="text-xs text-zinc-400">{result.primaryConcern}</div>
          </div>
          {/* Findings */}
          <div className="space-y-2">
            {result.findings.map((fm, i) => (
              <div key={i} className="flex items-start gap-3 p-2 bg-zinc-950 rounded-lg border border-zinc-800">
                <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                  fm.severity === 'CRITICAL' ? 'bg-red-500' : fm.severity === 'HIGH' ? 'bg-orange-500' : fm.severity === 'MEDIUM' ? 'bg-amber-500' : 'bg-green-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-200">{fm.category}</span>
                    <Badge className="text-[10px] h-4 px-1 bg-zinc-800 text-zinc-400 border-zinc-700">{fm.severity}</Badge>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{fm.description}</p>
                  <p className="text-xs text-amber-400 mt-1">→ {fm.recommendation}</p>
                </div>
              </div>
            ))}
          </div>
          {/* Predicted failure modes */}
          {result.predictedFailureModes.length > 0 && (
            <div>
              <div className="text-xs font-medium text-zinc-400 mb-1">Predicted Failure Modes</div>
              <div className="flex flex-wrap gap-1">
                {result.predictedFailureModes.map((m, i) => (
                  <Badge key={i} className="text-[10px] bg-zinc-800 text-zinc-300 border-zinc-700">{m}</Badge>
                ))}
              </div>
            </div>
          )}
          {/* Maintenance window */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">Recommended maintenance window</span>
            <span className="text-amber-400 font-mono">{result.maintenanceWindow}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">Confidence</span>
            <span className="text-zinc-400 font-mono">{result.confidence}%</span>
          </div>
        </CardContent>
      )}
      {expanded && !result && !predictMut.isPending && (
        <CardContent className="px-4 pb-4">
          <div className="text-xs text-zinc-600 text-center py-4">
            {totalRuns === 0
              ? "Run at least one physics calculation to enable ML prediction"
              : "Click \"Predict Failures\" to analyze your physics history with the ML model"}
          </div>
        </CardContent>
      )}
      {expanded && predictMut.isPending && (
        <CardContent className="px-4 pb-4">
          <div className="flex items-center gap-2 text-xs text-zinc-400 py-4 justify-center">
            <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
            Analyzing physics history with ML model...
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────
// ─── Collaboration Panel ──────────────────────────────────────────────────────
function CollaborationPanel({ roomId }: { roomId: string }) {
  const { connectionState, users } = useCollaboration(roomId, "Guest");
  const [open, setOpen] = useState(false);
  const connected = connectionState === "connected";
  const peers = users.filter(u => !u.userId.startsWith("self"));
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
        aria-label="Collaboration panel"
      >
        <Users className="w-3 h-3" />
        <span>{users.length + 1} online</span>
        <Circle className={`w-2 h-2 ${connected ? 'text-green-400 fill-green-400' : 'text-zinc-600 fill-zinc-600'}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 w-56 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-3">
          <div className="text-xs font-semibold text-zinc-300 mb-2 flex items-center gap-1">
            <Users className="w-3 h-3" /> Live Collaborators
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-zinc-300">
              <div className="w-5 h-5 rounded-full bg-amber-600 flex items-center justify-center text-[9px] font-bold">YOU</div>
              <span>You (this session)</span>
            </div>
            {peers.map((p: CollabUser) => (
              <div key={p.userId} className="flex items-center gap-2 text-xs text-zinc-400">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: p.color }}>
                  {(p.userName ?? 'U').slice(0, 2).toUpperCase()}
                </div>
                <span>{p.userName ?? 'Unknown'}</span>
              </div>
            ))}
            {peers.length === 0 && (
              <div className="text-xs text-zinc-600 italic">No other users in this session</div>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-800 text-[10px] text-zinc-600">
            Room: {roomId} · {connected ? 'Connected' : connectionState}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PwaTwinPhysics() {
  const [wellId, setWellId] = useState(DEFAULT_WELL_ID);
  const [wellId2, setWellId2] = useState("WELL-002");
  const [compareMode, setCompareMode] = useState(false);
  const [useMetric, setUseMetric] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Global results (shared with well schematic)
  const [nodalResult, setNodalResult] = useState<any>(null);
  const [nodalResult2, setNodalResult2] = useState<any>(null);
  const [declineResult, setDeclineResult] = useState<any>(null);
  const [turnerResult, setTurnerResult] = useState<any>(null);
  const [geoResult, setGeoResult] = useState<any>(null);
  const [sandResult, setSandResult] = useState<any>(null);

  // Online/offline detection
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  // Real-time collaboration (cursor sync + presence)
  const { users: collabUsers, sendCursorMove } = useCollaboration(`pwa-twin-${wellId}`, "Guest");
  // Build remote cursors array from users who have cursor positions
  const remoteCursors = collabUsers
    .filter((u: CollabUser) => u.cursor)
    .map((u: CollabUser) => ({ userId: u.userId, userName: u.userName, color: u.color, x: u.cursor!.x, y: u.cursor!.y }));

  // ── Nodal params (matches router schema exactly) ──
  const [nodalP, setNodalP] = useState({
    reservoirPressure: 3500, qMax: 2000, skinFactor: 0,
    espFrequencyHz: 60, wellheadPressure: 200, tvdFt: 8500,
    fluidGradient: 0.433, waterCut: 0.2, gorScfPerBbl: 500, points: 60,
  });
  const [nodalP2, setNodalP2] = useState({
    reservoirPressure: 3200, qMax: 1800, skinFactor: 2,
    espFrequencyHz: 55, wellheadPressure: 180, tvdFt: 9200,
    fluidGradient: 0.433, waterCut: 0.35, gorScfPerBbl: 600, points: 60,
  });

  // ── Decline params (matches router schema exactly) ──
  const [declineP, setDeclineP] = useState({
    qi: 1200, di: 0.008, b: 0.5, months: 60,
  });

  // ── Turner params (matches router schema exactly) ──
  const [turnerP, setTurnerP] = useState({
    tubingIdIn: 2.441, wellheadPressurePsia: 800, wellheadTempF: 120,
    gasRateMscfd: 1200, gasSpecificGravity: 0.65,
    surfaceTensionDynesCm: 60, liquidDensityLbFt3: 67,
  });

  // ── Geo params (matches router schema exactly) ──
  const [geoP, setGeoP] = useState({
    tvdFt: 8500, avgBulkDensityGcc: 2.35, porePressurePpg: 9.0,
    lotPressurePpg: 14.5, ucsPsi: 3000, frictionAngleDeg: 30,
    biotCoefficient: 0.8, poissonRatio: 0.25,
    inclinationDeg: 0, azimuthDeg: 0, currentMudWeightPpg: 10.5,
  });

  // ── Sand params (matches router schema exactly) ──
  const [sandP, setSandP] = useState({
    tvdFt: 8500, reservoirPressurePsia: 3500, bhfpPsia: 2800,
    ucsPsi: 2500, frictionAngleDeg: 30, biotCoefficient: 0.8,
    poissonRatio: 0.25, bulkDensityGcc: 2.3,
    perforationLengthFt: 20, perforationDiameterIn: 0.5,
    waterCut: 0, currentRateBpd: 800,
    completionType: "CASED_PERFORATED" as "OPEN_HOLE"|"CASED_PERFORATED"|"GRAVEL_PACK"|"FRAC_PACK"|"EXPANDABLE_SAND_SCREEN"|"STANDALONE_SCREEN",
  });

  // ── Debounce refs ──
  const t1 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t2 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t3 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t4 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t5 = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Mutations ──
  const nodalMut = trpc.physicsEngine.nodal.useMutation({
    onSuccess: (d: any) => { setNodalResult(d); saveHistory("nodal", d); toast.success("Nodal analysis complete"); },
    onError: (e: any) => toast.error("Nodal: " + e.message),
  });
  const nodalMut2 = trpc.physicsEngine.nodal.useMutation({
    onSuccess: (d: any) => setNodalResult2(d),
    onError: (e: any) => toast.error("Well 2 nodal: " + e.message),
  });
  const declineMut = trpc.physicsEngine.decline.useMutation({
    onSuccess: (d: any) => { setDeclineResult(d); saveHistory("decline", d); toast.success("Decline computed"); },
    onError: (e: any) => toast.error("Decline: " + e.message),
  });
  const turnerMut = trpc.physicsEngine.turnerLoading.useMutation({
    onSuccess: (d: any) => { setTurnerResult(d); saveHistory("turner", d); toast.success("Turner complete"); },
    onError: (e: any) => toast.error("Turner: " + e.message),
  });
  const geoMut = trpc.physicsEngine.geomechanics.useMutation({
    onSuccess: (d: any) => { setGeoResult(d); saveHistory("geo", d); toast.success("Geomechanics complete"); },
    onError: (e: any) => toast.error("Geomechanics: " + e.message),
  });
  const sandMut = trpc.physicsEngine.sandOnset.useMutation({
    onSuccess: (d: any) => { setSandResult(d); saveHistory("sand", d); toast.success("Sand onset complete"); },
    onError: (e: any) => toast.error("Sand onset: " + e.message),
  });

  // ── Auto-run helpers ──
  const runNodal = useCallback((p = nodalP, p2 = nodalP2, cm = compareMode) => {
    if (t1.current) clearTimeout(t1.current);
    t1.current = setTimeout(() => {
      nodalMut.mutate({ ...p, wellId });
      if (cm) nodalMut2.mutate({ ...p2, wellId: wellId2 });
    }, DEBOUNCE_MS);
  }, [nodalP, nodalP2, wellId, wellId2, compareMode]);

  const runDecline = useCallback((p = declineP) => {
    if (t2.current) clearTimeout(t2.current);
    t2.current = setTimeout(() => declineMut.mutate({ ...p, wellId }), DEBOUNCE_MS);
  }, [declineP, wellId]);

  const runTurner = useCallback((p = turnerP) => {
    if (t3.current) clearTimeout(t3.current);
    t3.current = setTimeout(() => turnerMut.mutate({ ...p, wellId }), DEBOUNCE_MS);
  }, [turnerP, wellId]);

  const runGeo = useCallback((p = geoP) => {
    if (t4.current) clearTimeout(t4.current);
    t4.current = setTimeout(() => geoMut.mutate({ ...p, wellId }), DEBOUNCE_MS);
  }, [geoP, wellId]);

  const runSand = useCallback((p = sandP) => {
    if (t5.current) clearTimeout(t5.current);
    t5.current = setTimeout(() => sandMut.mutate({ ...p, wellId }), DEBOUNCE_MS);
  }, [sandP, wellId]);

  // ── Param updaters ──
  const upNodal = (k: string, v: number) => { const n = { ...nodalP, [k]: v }; setNodalP(n); runNodal(n); };
  const upNodal2 = (k: string, v: number) => { const n = { ...nodalP2, [k]: v }; setNodalP2(n); runNodal(nodalP, n); };
  const upDecline = (k: string, v: number) => { const n = { ...declineP, [k]: v }; setDeclineP(n); runDecline(n); };
  const upTurner = (k: string, v: number) => { const n = { ...turnerP, [k]: v }; setTurnerP(n); runTurner(n); };
  const upGeo = (k: string, v: number) => { const n = { ...geoP, [k]: v }; setGeoP(n); runGeo(n); };
  const upSand = (k: string, v: number) => { const n = { ...sandP, [k]: v }; setSandP(n); runSand(n); };

  // ── Chart data ──
  const iprData = nodalResult?.ipr_curve?.map((p: any) => ({ q: p.q, ipr: p.pwf })) ?? [];
  const vlpData = nodalResult?.vlp_curve?.map((p: any) => ({ q: p.q, vlp: p.pwf })) ?? [];
  const iprData2 = nodalResult2?.ipr_curve?.map((p: any) => ({ q: p.q, ipr2: p.pwf })) ?? [];
  const vlpData2 = nodalResult2?.vlp_curve?.map((p: any) => ({ q: p.q, vlp2: p.pwf })) ?? [];
  const nodalChartData = iprData.map((p: any, i: number) => ({
    ...p, vlp: vlpData[i]?.vlp, ipr2: iprData2[i]?.ipr2, vlp2: vlpData2[i]?.vlp2,
  }));

  const declineData = declineResult?.points?.map((p: any) => ({
    month: p.month,
    rate: useMetric ? +(p.rate_bpd * 0.158987).toFixed(2) : p.rate_bpd,
    cum: useMetric ? +(p.cumulative_mbbl * 158.987).toFixed(1) : p.cumulative_mbbl,
  })) ?? [];

  const turnerBarData = turnerResult ? [
    { name: "Turner Crit", value: turnerResult.critical_rate_turner_mscfd, fill: "#ef4444" },
    { name: "Coleman Crit", value: turnerResult.critical_rate_coleman_mscfd, fill: "#f97316" },
    { name: "Current Rate", value: turnerP.gasRateMscfd, fill: "#60a5fa" },
  ] : [];

  const geoBarData = geoResult ? [
    { name: "Pore Press", value: geoResult.pore_pressure_gradient_ppg, fill: "#3b82f6" },
    { name: "Min MW", value: geoResult.mw_lower_ppg, fill: "#22c55e" },
    { name: "Frac Grad", value: geoResult.fracture_gradient_ppg, fill: "#f97316" },
    { name: "Overburden", value: geoResult.overburden_gradient_ppg, fill: "#a855f7" },
  ] : [];

  // ── PDF exports ──
  const pdfNodal = () => {
    if (!nodalResult) { toast.error("Run analysis first"); return; }
    const op = nodalResult.operating_point;
    exportToPDF("Nodal Analysis", `
      <h2>Well: ${wellId}</h2>
      <table><tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Operating Rate</td><td>${op?.q?.toFixed(1)} bpd</td></tr>
        <tr><td>Operating BHP</td><td>${op?.pwf?.toFixed(1)} psia</td></tr>
        <tr><td>Efficiency</td><td>${(nodalResult.efficiency*100)?.toFixed(1)}%</td></tr>
        <tr><td>Delta Q</td><td>${nodalResult.delta_q_bpd?.toFixed(1)} bpd</td></tr>
        <tr><td>Reservoir Pressure</td><td>${nodalP.reservoirPressure} psia</td></tr>
        <tr><td>Wellhead Pressure</td><td>${nodalP.wellheadPressure} psia</td></tr>
        <tr><td>TVD</td><td>${nodalP.tvdFt} ft</td></tr>
        <tr><td>Water Cut</td><td>${(nodalP.waterCut*100).toFixed(0)}%</td></tr>
        <tr><td>GOR</td><td>${nodalP.gorScfPerBbl} scf/bbl</td></tr>
        <tr><td>Skin Factor</td><td>${nodalP.skinFactor}</td></tr>
        <tr><td>ESP Frequency</td><td>${nodalP.espFrequencyHz} Hz</td></tr>
      </table>`);
  };
  const pdfDecline = () => {
    if (!declineResult) { toast.error("Run analysis first"); return; }
    exportToPDF("Decline Curve", `
      <h2>Well: ${wellId}</h2>
      <table><tr><th>Metric</th><th>Value</th></tr>
        <tr><td>EUR (Total)</td><td>${declineResult.eur_mbbl?.toFixed(2)} Mbbl</td></tr>
        <tr><td>EUR (12 months)</td><td>${declineResult.eur_12mo?.toFixed(2)} Mbbl</td></tr>
        <tr><td>Initial Rate (qi)</td><td>${declineP.qi} bpd</td></tr>
        <tr><td>Decline Rate (Di)</td><td>${(declineP.di * 100).toFixed(2)}%/month</td></tr>
        <tr><td>b-Factor</td><td>${declineP.b}</td></tr>
        <tr><td>Forecast Period</td><td>${declineP.months} months</td></tr>
      </table>`);
  };
  const pdfTurner = () => {
    if (!turnerResult) { toast.error("Run analysis first"); return; }
    exportToPDF("Turner Loading", `
      <h2>Well: ${wellId}</h2>
      <table><tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Loading Status</td><td>${turnerResult.loading_status}</td></tr>
        <tr><td>Turner Critical V</td><td>${turnerResult.critical_velocity_turner_fps?.toFixed(2)} fps</td></tr>
        <tr><td>Coleman Critical V</td><td>${turnerResult.critical_velocity_coleman_fps?.toFixed(2)} fps</td></tr>
        <tr><td>Actual Velocity</td><td>${turnerResult.actual_velocity_fps?.toFixed(2)} fps</td></tr>
        <tr><td>Velocity Ratio</td><td>${turnerResult.velocity_ratio?.toFixed(3)}</td></tr>
        <tr><td>Critical Rate (Turner)</td><td>${turnerResult.critical_rate_turner_mscfd?.toFixed(1)} Mscf/d</td></tr>
        <tr><td>Remediation</td><td>${turnerResult.remediation ?? "None"}</td></tr>
      </table>`);
  };
  const pdfGeo = () => {
    if (!geoResult) { toast.error("Run analysis first"); return; }
    exportToPDF("Geomechanics 1D MEM", `
      <h2>Well: ${wellId} — TVD ${geoP.tvdFt} ft</h2>
      <table><tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Overburden Gradient</td><td>${geoResult.overburden_gradient_ppg?.toFixed(3)} ppg</td></tr>
        <tr><td>Pore Pressure Gradient</td><td>${geoResult.pore_pressure_gradient_ppg?.toFixed(3)} ppg</td></tr>
        <tr><td>Fracture Gradient</td><td>${geoResult.fracture_gradient_ppg?.toFixed(3)} ppg</td></tr>
        <tr><td>Min Mud Weight</td><td>${geoResult.mw_lower_ppg?.toFixed(3)} ppg</td></tr>
        <tr><td>SHmin</td><td>${geoResult.shmin_psi?.toFixed(0)} psi</td></tr>
        <tr><td>SHmax</td><td>${geoResult.shmax_psi?.toFixed(0)} psi</td></tr>
      </table>`);
  };
  const pdfSand = () => {
    if (!sandResult) { toast.error("Run analysis first"); return; }
    exportToPDF("Sand Onset", `
      <h2>Well: ${wellId}</h2>
      <table><tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Sand Risk</td><td>${sandResult.sand_risk}</td></tr>
        <tr><td>Sanding Index</td><td>${sandResult.sanding_index?.toFixed(4)}</td></tr>
        <tr><td>Critical Drawdown</td><td>${sandResult.critical_drawdown_psi?.toFixed(1)} psi</td></tr>
        <tr><td>Current Drawdown</td><td>${sandResult.current_drawdown_psi?.toFixed(1)} psi</td></tr>
        <tr><td>Recommendations</td><td>${Array.isArray(sandResult.recommendations) ? sandResult.recommendations.join("; ") : (sandResult.recommendations ?? "None")}</td></tr>
      </table>`);
  };

  const anyPending = nodalMut.isPending || declineMut.isPending || turnerMut.isPending || geoMut.isPending || sandMut.isPending;

  // ── Nodal slider definitions ──
  const nodalSliders = [
    { paramKey: "reservoirPressure", label: "Reservoir Pressure", min: 500, max: 8000, step: 50, unit: "psia", tooltip: "Static reservoir pressure. Higher Pr increases AOF and operating rate." },
    { paramKey: "qMax", label: "AOF / q_max", min: 100, max: 10000, step: 50, unit: "bpd", tooltip: "Absolute Open Flow potential. Maximum rate if BHFP = 0." },
    { paramKey: "skinFactor", label: "Skin Factor", min: -5, max: 30, step: 0.5, unit: "", tooltip: "Negative = stimulated (fracture), positive = damaged." },
    { paramKey: "espFrequencyHz", label: "ESP Frequency", min: 30, max: 70, step: 1, unit: "Hz", tooltip: "ESP motor frequency. Higher Hz = more lift head." },
    { paramKey: "wellheadPressure", label: "Wellhead Pressure", min: 50, max: 2000, step: 25, unit: "psia", tooltip: "Tubing head pressure. Lower THP reduces backpressure." },
    { paramKey: "tvdFt", label: "TVD", min: 2000, max: 20000, step: 100, unit: "ft", tooltip: "True vertical depth to mid-perforation." },
    { paramKey: "fluidGradient", label: "Fluid Gradient", min: 0.25, max: 0.55, step: 0.005, unit: "psi/ft", tooltip: "Produced fluid gradient. Pure water = 0.433, oil = 0.35-0.40." },
    { paramKey: "waterCut", label: "Water Cut", min: 0, max: 0.99, step: 0.01, unit: "frac", tooltip: "Fraction of produced water. High water cut increases VLP backpressure." },
    { paramKey: "gorScfPerBbl", label: "GOR", min: 0, max: 5000, step: 50, unit: "scf/bbl", tooltip: "Gas-oil ratio. Affects fluid density and lift efficiency." },
  ];
  const nodalSliders2 = [
    { paramKey: "reservoirPressure", label: "Reservoir Pressure", min: 500, max: 8000, step: 50, unit: "psia", tooltip: "Reservoir pressure for well 2." },
    { paramKey: "qMax", label: "AOF / q_max", min: 100, max: 10000, step: 50, unit: "bpd", tooltip: "AOF for well 2." },
    { paramKey: "skinFactor", label: "Skin Factor", min: -5, max: 30, step: 0.5, unit: "", tooltip: "Skin for well 2." },
    { paramKey: "espFrequencyHz", label: "ESP Frequency", min: 30, max: 70, step: 1, unit: "Hz", tooltip: "ESP frequency for well 2." },
    { paramKey: "wellheadPressure", label: "Wellhead Pressure", min: 50, max: 2000, step: 25, unit: "psia", tooltip: "THP for well 2." },
    { paramKey: "tvdFt", label: "TVD", min: 2000, max: 20000, step: 100, unit: "ft", tooltip: "TVD for well 2." },
    { paramKey: "waterCut", label: "Water Cut", min: 0, max: 0.99, step: 0.01, unit: "frac", tooltip: "Water cut for well 2." },
    { paramKey: "gorScfPerBbl", label: "GOR", min: 0, max: 5000, step: 50, unit: "scf/bbl", tooltip: "GOR for well 2." },
  ];

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-950/40 rounded-lg border border-amber-800/40">
            <Atom className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2 flex-wrap">
              PWA Digital Twin
              <Badge variant="outline" className="text-amber-400 border-amber-700 text-xs">{APP_VERSION}</Badge>
              {anyPending && <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />}
            </h1>
            <p className="text-zinc-500 text-xs">Rust physics engine · 5 calculators · Offline capable (SW v3.0)</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge className={isOnline ? "bg-green-950/40 text-green-400 border-green-700/40" : "bg-red-950/40 text-red-400 border-red-700/40"}>
            {isOnline ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
            {isOnline ? "Online" : "Offline"}
          </Badge>
          <CollaborationPanel roomId={`pwa-twin-${wellId}`} />
          <Select value={wellId} onValueChange={setWellId}>
            <SelectTrigger className="w-28 bg-zinc-900 border-zinc-700 text-white text-xs h-8" aria-label="Select well">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              {WELL_OPTIONS.map(w => <SelectItem key={w} value={w} className="text-white text-xs">{w}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Label className="text-zinc-400 text-xs">Imperial</Label>
            <Switch checked={useMetric} onCheckedChange={setUseMetric} aria-label="Toggle metric units" />
            <Label className="text-zinc-400 text-xs">Metric</Label>
          </div>
        </div>
      </div>

      {/* ── Well Schematic ── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-300">Live Well Schematic — Digital Twin</h2>
          <Badge className="text-xs bg-zinc-800 text-zinc-400 border-zinc-700">Updates with each analysis</Badge>
        </div>
        <WellSchematic
          nodalResult={nodalResult} turnerResult={turnerResult}
          sandResult={sandResult} declineResult={declineResult} geoResult={geoResult}
          remoteCursors={remoteCursors}
          onCursorMove={sendCursorMove}
        />
      </div>

      {/* ── ML Failure Prediction Panel ── */}
      <MLFailurePrediction wellId={wellId} />

      {/* ── Physics Calculators ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-300">Physics Calculators</h2>
        </div>
        <Tabs defaultValue="nodal">
          <TabsList className="bg-zinc-900 border border-zinc-800 flex-wrap h-auto gap-1 p-1 mb-4">
            {[
              { value: "nodal", icon: <Activity className="w-3 h-3 mr-1" />, label: "Nodal Analysis", color: "data-[state=active]:bg-blue-900/50 data-[state=active]:text-blue-300" },
              { value: "decline", icon: <TrendingDown className="w-3 h-3 mr-1" />, label: "Decline Curve", color: "data-[state=active]:bg-amber-900/50 data-[state=active]:text-amber-300" },
              { value: "turner", icon: <Wind className="w-3 h-3 mr-1" />, label: "Turner Loading", color: "data-[state=active]:bg-cyan-900/50 data-[state=active]:text-cyan-300" },
              { value: "geo", icon: <Mountain className="w-3 h-3 mr-1" />, label: "Geomechanics", color: "data-[state=active]:bg-stone-700/50 data-[state=active]:text-stone-300" },
              { value: "sand", icon: <AlertTriangle className="w-3 h-3 mr-1" />, label: "Sand Onset", color: "data-[state=active]:bg-yellow-900/50 data-[state=active]:text-yellow-300" },
            ].map(t => (
              <TabsTrigger key={t.value} value={t.value} className={`text-zinc-400 text-xs ${t.color}`}>
                {t.icon}{t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ════ NODAL ════ */}
          <TabsContent value="nodal">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-white text-sm flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-400" /> Nodal Analysis (IPR/VLP)
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Label className="text-zinc-500 text-xs">Compare 2 wells</Label>
                      <Switch checked={compareMode} onCheckedChange={setCompareMode} aria-label="Compare two wells" />
                    </div>
                  </div>
                  <p className="text-zinc-500 text-xs">Vogel IPR + VLP intersection → ESP operating point</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className={`grid gap-4 ${compareMode ? "grid-cols-2" : "grid-cols-1"}`}>
                    <div className="space-y-3">
                      {compareMode && <p className="text-blue-400 text-xs font-semibold">{wellId}</p>}
                      {nodalSliders.map(s => (
                        <ParamSlider key={s.paramKey} {...s}
                          value={nodalP[s.paramKey as keyof typeof nodalP] as number}
                          onChange={upNodal} />
                      ))}
                    </div>
                    {compareMode && (
                      <div className="space-y-3 border-l border-zinc-800 pl-3">
                        <div className="flex items-center gap-2">
                          <p className="text-cyan-400 text-xs font-semibold">Compare:</p>
                          <Select value={wellId2} onValueChange={setWellId2}>
                            <SelectTrigger className="w-24 bg-zinc-800 border-zinc-700 text-white text-xs h-6">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-700">
                              {WELL_OPTIONS.map(w => <SelectItem key={w} value={w} className="text-white text-xs">{w}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        {nodalSliders2.map(s => (
                          <ParamSlider key={s.paramKey} {...s}
                            value={nodalP2[s.paramKey as keyof typeof nodalP2] as number}
                            onChange={upNodal2} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button className="flex-1 bg-blue-700 hover:bg-blue-600 text-white text-xs"
                      onClick={() => { nodalMut.mutate({ ...nodalP, wellId }); if (compareMode) nodalMut2.mutate({ ...nodalP2, wellId: wellId2 }); }}
                      disabled={nodalMut.isPending}>
                      {nodalMut.isPending ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Computing...</> : <><Play className="w-3 h-3 mr-1" />Run Nodal</>}
                    </Button>
                    <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs" onClick={pdfNodal} disabled={!nodalResult}>
                      <FileText className="w-3 h-3 mr-1" /> PDF
                    </Button>
                  </div>
                  <HistoryPanel histKey="nodal" label="nodal" />
                </CardContent>
              </Card>

              <div className="space-y-4">
                {nodalMut.isPending && <ResultSkeleton />}
                {nodalResult && !nodalMut.isPending && (
                  <>
                    <Card className="bg-zinc-900 border-zinc-800">
                      <CardHeader className="pb-2"><CardTitle className="text-white text-sm">Operating Point</CardTitle></CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: "Operating Rate", value: useMetric ? `${(nodalResult.operating_point?.q * 0.158987).toFixed(2)} m³/d` : `${nodalResult.operating_point?.q?.toFixed(1)} bpd`, color: "text-blue-400" },
                            { label: "Operating BHP", value: useMetric ? `${(nodalResult.operating_point?.pwf * 0.0689476).toFixed(2)} bar` : `${nodalResult.operating_point?.pwf?.toFixed(1)} psia`, color: "text-amber-400" },
                            { label: "Efficiency", value: `${(nodalResult.efficiency * 100)?.toFixed(1)}%`, color: "text-green-400" },
                            { label: "Delta Q", value: `${nodalResult.delta_q_bpd?.toFixed(1)} bpd`, color: "text-purple-400" },
                          ].map(({ label, value, color }) => (
                            <div key={label} className="bg-zinc-950 rounded-lg p-3 border border-zinc-800">
                              <p className="text-zinc-500 text-xs">{label}</p>
                              <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
                            </div>
                          ))}
                        </div>
                        {compareMode && nodalResult2?.operating_point && (
                          <div className="mt-3 p-3 bg-cyan-950/20 border border-cyan-800/30 rounded-lg">
                            <p className="text-cyan-400 text-xs font-semibold mb-1">{wellId2} Comparison</p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <span className="text-zinc-400">Rate: <span className="text-cyan-300 font-mono">{nodalResult2.operating_point.q?.toFixed(1)} bpd</span></span>
                              <span className="text-zinc-400">BHP: <span className="text-cyan-300 font-mono">{nodalResult2.operating_point.pwf?.toFixed(1)} psia</span></span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    <Card className="bg-zinc-900 border-zinc-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-white text-sm">IPR / VLP Curves {compareMode && nodalResult2 ? "(Dual Well)" : ""}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div style={{ height: 260 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={nodalChartData} margin={{ top: 5, right: 10, bottom: 20, left: 10 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="q" stroke="#71717a" tick={{ fontSize: 10 }} label={{ value: "Rate (bpd)", position: "insideBottom", offset: -10, fill: "#71717a", fontSize: 10 }} />
                              <YAxis stroke="#71717a" tick={{ fontSize: 10 }} label={{ value: "BHP (psia)", angle: -90, position: "insideLeft", fill: "#71717a", fontSize: 10 }} />
                              <RechartTooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 11 }} />
                              <Legend wrapperStyle={{ fontSize: 10 }} />
                              <Line type="monotone" dataKey="ipr" stroke="#f59e0b" strokeWidth={2} dot={false} name={`IPR ${wellId}`} />
                              <Line type="monotone" dataKey="vlp" stroke="#3b82f6" strokeWidth={2} dot={false} name={`VLP ${wellId}`} />
                              {compareMode && nodalResult2 && <>
                                <Line type="monotone" dataKey="ipr2" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="5 5" name={`IPR ${wellId2}`} />
                                <Line type="monotone" dataKey="vlp2" stroke="#3b82f6" strokeWidth={2} dot={false} strokeDasharray="5 5" name={`VLP ${wellId2}`} />
                              </>}
                              {nodalResult.operating_point && (
                                <ReferenceLine x={nodalResult.operating_point.q} stroke="#22c55e" strokeDasharray="4 2"
                                  label={{ value: "OP", fill: "#22c55e", fontSize: 10 }} />
                              )}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
                {!nodalResult && !nodalMut.isPending && (
                  <div className="h-40 flex items-center justify-center text-zinc-500 text-sm border border-zinc-800 rounded-xl">
                    Adjust sliders or click Run Nodal to see results
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ════ DECLINE ════ */}
          <TabsContent value="decline">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-amber-400" /> Decline Curve Analysis (Arps)
                  </CardTitle>
                  <p className="text-zinc-500 text-xs">Exponential / Hyperbolic / Harmonic with EUR forecasting</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { paramKey: "qi", label: "Initial Rate (qi)", min: 100, max: 10000, step: 50, unit: "bpd", tooltip: "Initial production rate at time zero." },
                    { paramKey: "di", label: "Decline Rate (Di)", min: 0.001, max: 0.05, step: 0.001, unit: "/mo", tooltip: "Monthly decline rate fraction. 0.008 ≈ 10%/yr." },
                    { paramKey: "b", label: "b-Factor", min: 0, max: 1, step: 0.05, unit: "", tooltip: "Arps b-factor. 0=exponential, 0.5=hyperbolic, 1=harmonic." },
                    { paramKey: "months", label: "Forecast Period", min: 12, max: 360, step: 12, unit: "mo", tooltip: "Duration of the production forecast in months." },
                  ].map(s => (
                    <ParamSlider key={s.paramKey} {...s}
                      value={declineP[s.paramKey as keyof typeof declineP] as number}
                      onChange={upDecline} />
                  ))}
                  <div className="flex gap-2">
                    <Button className="flex-1 bg-amber-700 hover:bg-amber-600 text-white text-xs"
                      onClick={() => declineMut.mutate({ ...declineP, wellId })} disabled={declineMut.isPending}>
                      {declineMut.isPending ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Computing...</> : <><Play className="w-3 h-3 mr-1" />Run Decline</>}
                    </Button>
                    <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs" onClick={pdfDecline} disabled={!declineResult}>
                      <FileText className="w-3 h-3 mr-1" /> PDF
                    </Button>
                    <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs"
                      onClick={() => declineResult?.points && downloadCSV(`decline-${wellId}-${Date.now()}.csv`, declineResult.points)}
                      disabled={!declineResult}>
                      <Download className="w-3 h-3 mr-1" /> CSV
                    </Button>
                  </div>
                  <HistoryPanel histKey="decline" label="decline" />
                </CardContent>
              </Card>

              <div className="space-y-4">
                {declineMut.isPending && <ResultSkeleton />}
                {declineResult && !declineMut.isPending && (
                  <>
                    <Card className="bg-zinc-900 border-zinc-800">
                      <CardHeader className="pb-2"><CardTitle className="text-white text-sm">EUR Summary</CardTitle></CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-zinc-950 rounded-lg p-3 border border-zinc-800">
                            <p className="text-zinc-500 text-xs">EUR (Total)</p>
                            <p className="text-2xl font-bold font-mono text-amber-400">{declineResult.eur_mbbl?.toFixed(1)}</p>
                            <p className="text-zinc-500 text-xs">{useMetric ? "Mm³" : "Mbbl"}</p>
                          </div>
                          <div className="bg-zinc-950 rounded-lg p-3 border border-zinc-800">
                            <p className="text-zinc-500 text-xs">EUR (12 months)</p>
                            <p className="text-2xl font-bold font-mono text-blue-400">{declineResult.eur_12mo?.toFixed(1)}</p>
                            <p className="text-zinc-500 text-xs">{useMetric ? "Mm³" : "Mbbl"}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-zinc-900 border-zinc-800">
                      <CardHeader className="pb-2"><CardTitle className="text-white text-sm">Production Forecast</CardTitle></CardHeader>
                      <CardContent>
                        <div style={{ height: 240 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={declineData} margin={{ top: 5, right: 10, bottom: 20, left: 10 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="month" stroke="#71717a" tick={{ fontSize: 10 }} label={{ value: "Month", position: "insideBottom", offset: -10, fill: "#71717a", fontSize: 10 }} />
                              <YAxis stroke="#71717a" tick={{ fontSize: 10 }} />
                              <RechartTooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 11 }} />
                              <Legend wrapperStyle={{ fontSize: 10 }} />
                              <Area type="monotone" dataKey="rate" stroke="#f59e0b" fill="#f59e0b22" strokeWidth={2} name={useMetric ? "Rate (m³/d)" : "Rate (bpd)"} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
                {!declineResult && !declineMut.isPending && (
                  <div className="h-40 flex items-center justify-center text-zinc-500 text-sm border border-zinc-800 rounded-xl">
                    Adjust sliders or click Run Decline to see results
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ════ TURNER ════ */}
          <TabsContent value="turner">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Wind className="w-4 h-4 text-cyan-400" /> Turner Liquid Loading
                  </CardTitle>
                  <p className="text-zinc-500 text-xs">Turner (1969) + Coleman (1991) critical velocity models</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { paramKey: "tubingIdIn", label: "Tubing ID", min: 1.0, max: 5.0, step: 0.1, unit: "in", tooltip: "Inner diameter of production tubing. Larger ID requires higher gas rate to unload." },
                    { paramKey: "wellheadPressurePsia", label: "Wellhead Pressure", min: 100, max: 3000, step: 25, unit: "psia", tooltip: "Wellhead flowing pressure. Higher THP increases critical velocity." },
                    { paramKey: "wellheadTempF", label: "Wellhead Temperature", min: 60, max: 250, step: 5, unit: "°F", tooltip: "Wellhead flowing temperature. Affects gas density." },
                    { paramKey: "gasRateMscfd", label: "Gas Rate", min: 100, max: 20000, step: 100, unit: "Mscf/d", tooltip: "Current gas production rate. Compare against Turner/Coleman critical rates." },
                    { paramKey: "gasSpecificGravity", label: "Gas Specific Gravity", min: 0.55, max: 0.95, step: 0.01, unit: "", tooltip: "Gas SG relative to air. 0.65 = typical natural gas." },
                    { paramKey: "surfaceTensionDynesCm", label: "Surface Tension", min: 10, max: 80, step: 1, unit: "dyn/cm", tooltip: "Liquid-gas surface tension. Higher tension = larger droplets = higher critical velocity." },
                    { paramKey: "liquidDensityLbFt3", label: "Liquid Density", min: 30, max: 80, step: 1, unit: "lb/ft³", tooltip: "Liquid density. Water ≈ 62.4 lb/ft³, condensate ≈ 45-55 lb/ft³." },
                  ].map(s => (
                    <ParamSlider key={s.paramKey} {...s}
                      value={turnerP[s.paramKey as keyof typeof turnerP] as number}
                      onChange={upTurner} />
                  ))}
                  <div className="flex gap-2">
                    <Button className="flex-1 bg-cyan-700 hover:bg-cyan-600 text-white text-xs"
                      onClick={() => turnerMut.mutate({ ...turnerP, wellId })} disabled={turnerMut.isPending}>
                      {turnerMut.isPending ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Computing...</> : <><Play className="w-3 h-3 mr-1" />Run Turner</>}
                    </Button>
                    <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs" onClick={pdfTurner} disabled={!turnerResult}>
                      <FileText className="w-3 h-3 mr-1" /> PDF
                    </Button>
                  </div>
                  <HistoryPanel histKey="turner" label="turner" />
                </CardContent>
              </Card>

              <div className="space-y-4">
                {turnerMut.isPending && <ResultSkeleton />}
                {turnerResult && !turnerMut.isPending && (
                  <>
                    <Card className="bg-zinc-900 border-zinc-800">
                      <CardHeader className="pb-2"><CardTitle className="text-white text-sm">Loading Assessment</CardTitle></CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-3 mb-4 flex-wrap">
                          <div className="w-4 h-4 rounded-full shrink-0" style={{ background: LOADING_COLOR[turnerResult.loading_status] ?? "#6b7280" }} />
                          <span className="text-white font-bold text-lg">{turnerResult.loading_status?.replace(/_/g, " ")}</span>
                          <Badge style={{
                            background: (LOADING_COLOR[turnerResult.loading_status] ?? "#6b7280") + "33",
                            color: LOADING_COLOR[turnerResult.loading_status] ?? "#9ca3af",
                            border: `1px solid ${(LOADING_COLOR[turnerResult.loading_status] ?? "#6b7280")}44`,
                          }}>
                            Ratio: {turnerResult.velocity_ratio?.toFixed(3)}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: "Turner Critical V", value: `${turnerResult.critical_velocity_turner_fps?.toFixed(2)} fps`, color: "text-red-400" },
                            { label: "Coleman Critical V", value: `${turnerResult.critical_velocity_coleman_fps?.toFixed(2)} fps`, color: "text-orange-400" },
                            { label: "Actual Velocity", value: `${turnerResult.actual_velocity_fps?.toFixed(2)} fps`, color: "text-blue-400" },
                            { label: "Critical Rate (Turner)", value: `${turnerResult.critical_rate_turner_mscfd?.toFixed(1)} Mscf/d`, color: "text-red-400" },
                          ].map(({ label, value, color }) => (
                            <div key={label} className="bg-zinc-950 rounded-lg p-3 border border-zinc-800">
                              <p className="text-zinc-500 text-xs">{label}</p>
                              <p className={`text-sm font-bold font-mono ${color}`}>{value}</p>
                            </div>
                          ))}
                        </div>
                        {turnerResult.remediation && (
                          <div className="mt-3 p-3 bg-amber-950/20 border border-amber-800/30 rounded-lg">
                            <p className="text-amber-400 text-xs font-semibold mb-1">Remediation Recommendation</p>
                            <p className="text-zinc-300 text-xs">{turnerResult.remediation}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    <Card className="bg-zinc-900 border-zinc-800">
                      <CardHeader className="pb-2"><CardTitle className="text-white text-sm">Rate Comparison</CardTitle></CardHeader>
                      <CardContent>
                        <div style={{ height: 200 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={turnerBarData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 9 }} />
                              <YAxis stroke="#71717a" tick={{ fontSize: 10 }} label={{ value: "Mscf/d", angle: -90, position: "insideLeft", fill: "#71717a", fontSize: 10 }} />
                              <RechartTooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 11 }} />
                              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {turnerBarData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
                {!turnerResult && !turnerMut.isPending && (
                  <div className="h-40 flex items-center justify-center text-zinc-500 text-sm border border-zinc-800 rounded-xl">
                    Adjust sliders or click Run Turner to see results
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ════ GEOMECHANICS ════ */}
          <TabsContent value="geo">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Mountain className="w-4 h-4 text-stone-400" /> Geomechanics 1D MEM
                  </CardTitle>
                  <p className="text-zinc-500 text-xs">Mechanical Earth Model — mud weight window, stress analysis</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { paramKey: "tvdFt", label: "True Vertical Depth", min: 1000, max: 25000, step: 100, unit: "ft", tooltip: "Depth of analysis point. All gradients calculated at this depth." },
                    { paramKey: "avgBulkDensityGcc", label: "Avg Bulk Density", min: 1.8, max: 3.0, step: 0.05, unit: "g/cc", tooltip: "Average formation bulk density. Used to compute overburden stress." },
                    { paramKey: "porePressurePpg", label: "Pore Pressure", min: 7.0, max: 20.0, step: 0.1, unit: "ppg", tooltip: "Formation pore pressure in ppg EMW. Normal = 8.6 ppg." },
                    { paramKey: "lotPressurePpg", label: "LOT Pressure", min: 8.0, max: 22.0, step: 0.1, unit: "ppg", tooltip: "Leak-off test pressure in ppg EMW. Sets fracture gradient upper bound." },
                    { paramKey: "ucsPsi", label: "UCS", min: 500, max: 20000, step: 100, unit: "psi", tooltip: "Unconfined Compressive Strength. Higher UCS = more stable wellbore." },
                    { paramKey: "frictionAngleDeg", label: "Friction Angle", min: 15, max: 50, step: 1, unit: "°", tooltip: "Internal friction angle. Higher angle = more shear strength." },
                    { paramKey: "biotCoefficient", label: "Biot Coefficient", min: 0.3, max: 1.0, step: 0.01, unit: "", tooltip: "Biot poroelastic coefficient. 1.0 for unconsolidated sands." },
                    { paramKey: "poissonRatio", label: "Poisson's Ratio", min: 0.1, max: 0.45, step: 0.01, unit: "", tooltip: "Rock Poisson's ratio. Affects horizontal stress. Typical 0.2-0.35." },
                    { paramKey: "currentMudWeightPpg", label: "Current Mud Weight", min: 7.0, max: 22.0, step: 0.1, unit: "ppg", tooltip: "Current drilling mud weight. Must be within the mud window." },
                  ].map(s => (
                    <ParamSlider key={s.paramKey} {...s}
                      value={geoP[s.paramKey as keyof typeof geoP] as number}
                      onChange={upGeo} />
                  ))}
                  <div className="flex gap-2">
                    <Button className="flex-1 bg-stone-700 hover:bg-stone-600 text-white text-xs"
                      onClick={() => geoMut.mutate({ ...geoP, wellId })} disabled={geoMut.isPending}>
                      {geoMut.isPending ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Computing...</> : <><Play className="w-3 h-3 mr-1" />Run 1D MEM</>}
                    </Button>
                    <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs" onClick={pdfGeo} disabled={!geoResult}>
                      <FileText className="w-3 h-3 mr-1" /> PDF
                    </Button>
                  </div>
                  <HistoryPanel histKey="geo" label="geomechanics" />
                </CardContent>
              </Card>

              <div className="space-y-4">
                {geoMut.isPending && <ResultSkeleton />}
                {geoResult && !geoMut.isPending && (
                  <>
                    <Card className="bg-zinc-900 border-zinc-800">
                      <CardHeader className="pb-2"><CardTitle className="text-white text-sm">Mud Weight Window</CardTitle></CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: "Overburden Gradient", value: `${geoResult.overburden_gradient_ppg?.toFixed(3)} ppg`, color: "text-purple-400" },
                            { label: "Pore Pressure Gradient", value: `${geoResult.pore_pressure_gradient_ppg?.toFixed(3)} ppg`, color: "text-blue-400" },
                            { label: "Fracture Gradient", value: `${geoResult.fracture_gradient_ppg?.toFixed(3)} ppg`, color: "text-orange-400" },
                            { label: "Min Mud Weight", value: `${geoResult.mw_lower_ppg?.toFixed(3)} ppg`, color: "text-green-400" },
                            { label: "SHmin", value: `${geoResult.shmin_psi?.toFixed(0)} psi`, color: "text-cyan-400" },
                            { label: "SHmax", value: `${geoResult.shmax_psi?.toFixed(0)} psi`, color: "text-red-400" },
                          ].map(({ label, value, color }) => (
                            <div key={label} className="bg-zinc-950 rounded-lg p-3 border border-zinc-800">
                              <p className="text-zinc-500 text-xs">{label}</p>
                              <p className={`text-sm font-bold font-mono ${color}`}>{value}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-zinc-900 border-zinc-800">
                      <CardHeader className="pb-2"><CardTitle className="text-white text-sm">Gradient Profile</CardTitle></CardHeader>
                      <CardContent>
                        <div style={{ height: 200 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={geoBarData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 9 }} />
                              <YAxis stroke="#71717a" tick={{ fontSize: 10 }} domain={[6, 20]} label={{ value: "ppg", angle: -90, position: "insideLeft", fill: "#71717a", fontSize: 10 }} />
                              <RechartTooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 11 }} />
                              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {geoBarData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
                {!geoResult && !geoMut.isPending && (
                  <div className="h-40 flex items-center justify-center text-zinc-500 text-sm border border-zinc-800 rounded-xl">
                    Adjust sliders or click Run 1D MEM to see results
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ════ SAND ONSET ════ */}
          <TabsContent value="sand">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" /> Sand Onset (Morita-Willson)
                  </CardTitle>
                  <p className="text-zinc-500 text-xs">Critical drawdown pressure and sanding risk assessment</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-zinc-400 text-xs">Completion Type</Label>
                    <Select value={sandP.completionType} onValueChange={(v: any) => { const n = { ...sandP, completionType: v }; setSandP(n); runSand(n); }}>
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white text-xs h-8"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-700">
                        {[["OPEN_HOLE","Open Hole"],["CASED_PERFORATED","Cased & Perforated"],["GRAVEL_PACK","Gravel Pack"],["FRAC_PACK","Frac Pack"],["EXPANDABLE_SAND_SCREEN","Expandable Sand Screen"],["STANDALONE_SCREEN","Standalone Screen"]].map(([v,l]) => (
                          <SelectItem key={v} value={v} className="text-white text-xs">{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {[
                    { paramKey: "tvdFt", label: "True Vertical Depth", min: 1000, max: 20000, step: 100, unit: "ft", tooltip: "Depth of the sand-prone interval." },
                    { paramKey: "reservoirPressurePsia", label: "Reservoir Pressure", min: 500, max: 8000, step: 50, unit: "psia", tooltip: "Static reservoir pressure at the sand-prone interval." },
                    { paramKey: "bhfpPsia", label: "BHFP", min: 200, max: 7000, step: 50, unit: "psia", tooltip: "Bottomhole flowing pressure. Drawdown = Pr - BHFP." },
                    { paramKey: "ucsPsi", label: "UCS", min: 200, max: 10000, step: 100, unit: "psi", tooltip: "Unconfined Compressive Strength. Lower UCS = higher sanding risk." },
                    { paramKey: "frictionAngleDeg", label: "Friction Angle", min: 15, max: 50, step: 1, unit: "°", tooltip: "Internal friction angle." },
                    { paramKey: "biotCoefficient", label: "Biot Coefficient", min: 0.3, max: 1.0, step: 0.01, unit: "", tooltip: "Biot poroelastic coefficient." },
                    { paramKey: "poissonRatio", label: "Poisson's Ratio", min: 0.1, max: 0.45, step: 0.01, unit: "", tooltip: "Rock Poisson's ratio." },
                    { paramKey: "bulkDensityGcc", label: "Bulk Density", min: 1.8, max: 3.0, step: 0.05, unit: "g/cc", tooltip: "Formation bulk density." },
                    { paramKey: "perforationLengthFt", label: "Perforation Length", min: 1, max: 60, step: 1, unit: "ft", tooltip: "Length of perforation tunnel." },
                    { paramKey: "perforationDiameterIn", label: "Perforation Diameter", min: 0.2, max: 1.5, step: 0.05, unit: "in", tooltip: "Diameter of perforation tunnel." },
                    { paramKey: "waterCut", label: "Water Cut", min: 0, max: 1, step: 0.01, unit: "frac", tooltip: "Fraction of water. High water cut weakens formation." },
                    { paramKey: "currentRateBpd", label: "Current Rate", min: 100, max: 10000, step: 50, unit: "bpd", tooltip: "Current production rate. Higher rate = higher drawdown." },
                  ].map(s => (
                    <ParamSlider key={s.paramKey} {...s}
                      value={sandP[s.paramKey as keyof typeof sandP] as number}
                      onChange={upSand} />
                  ))}
                  <div className="flex gap-2">
                    <Button className="flex-1 bg-yellow-700 hover:bg-yellow-600 text-white text-xs"
                      onClick={() => sandMut.mutate({ ...sandP, wellId })} disabled={sandMut.isPending}>
                      {sandMut.isPending ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Computing...</> : <><Play className="w-3 h-3 mr-1" />Run Sand Onset</>}
                    </Button>
                    <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs" onClick={pdfSand} disabled={!sandResult}>
                      <FileText className="w-3 h-3 mr-1" /> PDF
                    </Button>
                  </div>
                  <HistoryPanel histKey="sand" label="sand onset" />
                </CardContent>
              </Card>

              <div className="space-y-4">
                {sandMut.isPending && <ResultSkeleton />}
                {sandResult && !sandMut.isPending && (
                  <>
                    <Card className="bg-zinc-900 border-zinc-800">
                      <CardHeader className="pb-2"><CardTitle className="text-white text-sm">Sand Risk Assessment</CardTitle></CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-3 mb-4 flex-wrap">
                          <div className="w-5 h-5 rounded-full shrink-0" style={{ background: RISK_COLOR[sandResult.sand_risk] ?? "#6b7280" }} />
                          <span className="text-white font-bold text-xl">{sandResult.sand_risk}</span>
                          <Badge style={{
                            background: (RISK_COLOR[sandResult.sand_risk] ?? "#6b7280") + "33",
                            color: RISK_COLOR[sandResult.sand_risk] ?? "#9ca3af",
                            border: `1px solid ${(RISK_COLOR[sandResult.sand_risk] ?? "#6b7280")}44`,
                          }}>
                            Index: {sandResult.sanding_index?.toFixed(4)}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: "Critical Drawdown", value: `${sandResult.critical_drawdown_psi?.toFixed(1)} psi`, color: "text-orange-400" },
                            { label: "Current Drawdown", value: `${sandResult.current_drawdown_psi?.toFixed(1)} psi`, color: "text-blue-400" },
                            { label: "Sanding Index", value: sandResult.sanding_index?.toFixed(4), color: "text-amber-400" },
                            {
                              label: "Safety Margin",
                              value: sandResult.critical_drawdown_psi > 0
                                ? `${((sandResult.critical_drawdown_psi - sandResult.current_drawdown_psi) / sandResult.critical_drawdown_psi * 100)?.toFixed(1)}%`
                                : "n/a",
                              color: sandResult.current_drawdown_psi < sandResult.critical_drawdown_psi ? "text-green-400" : "text-red-400",
                            },
                          ].map(({ label, value, color }) => (
                            <div key={label} className="bg-zinc-950 rounded-lg p-3 border border-zinc-800">
                              <p className="text-zinc-500 text-xs">{label}</p>
                              <p className={`text-sm font-bold font-mono ${color}`}>{value}</p>
                            </div>
                          ))}
                        </div>
                        {sandResult.recommendations && (
                          <div className="mt-3 p-3 bg-yellow-950/20 border border-yellow-800/30 rounded-lg">
                            <p className="text-yellow-400 text-xs font-semibold mb-1">Recommendations</p>
                            <p className="text-zinc-300 text-xs">
                              {Array.isArray(sandResult.recommendations) ? sandResult.recommendations.join(" · ") : sandResult.recommendations}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    {/* Drawdown gauge */}
                    <Card className="bg-zinc-900 border-zinc-800">
                      <CardHeader className="pb-2"><CardTitle className="text-white text-sm">Drawdown vs Critical</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <div className="flex justify-between text-xs text-zinc-400 mb-1">
                            <span>Current Drawdown</span>
                            <span className="font-mono">{sandResult.current_drawdown_psi?.toFixed(0)} psi</span>
                          </div>
                          <div className="w-full bg-zinc-800 rounded-full h-3">
                            <div className="h-3 rounded-full transition-all duration-700"
                              style={{
                                width: `${Math.min(100, sandResult.critical_drawdown_psi > 0 ? sandResult.current_drawdown_psi / sandResult.critical_drawdown_psi * 100 : 0)}%`,
                                background: RISK_COLOR[sandResult.sand_risk] ?? "#6b7280",
                              }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs text-zinc-400 mb-1">
                            <span>Critical Drawdown (100%)</span>
                            <span className="font-mono">{sandResult.critical_drawdown_psi?.toFixed(0)} psi</span>
                          </div>
                          <div className="w-full bg-zinc-800 rounded-full h-3">
                            <div className="h-3 rounded-full bg-green-600 w-full" />
                          </div>
                        </div>
                        <p className="text-zinc-500 text-xs text-center">
                          {sandResult.current_drawdown_psi < sandResult.critical_drawdown_psi
                            ? `✓ Safe — ${((1 - sandResult.current_drawdown_psi / sandResult.critical_drawdown_psi) * 100).toFixed(1)}% below critical`
                            : `⚠ At risk — ${((sandResult.current_drawdown_psi / sandResult.critical_drawdown_psi - 1) * 100).toFixed(1)}% above critical`}
                        </p>
                      </CardContent>
                    </Card>
                  </>
                )}
                {!sandResult && !sandMut.isPending && (
                  <div className="h-40 flex items-center justify-center text-zinc-500 text-sm border border-zinc-800 rounded-xl">
                    Adjust sliders or click Run Sand Onset to see results
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between text-xs text-zinc-600 border-t border-zinc-800 pt-3 flex-wrap gap-2">
        <span>OG-RMM Platform {APP_VERSION} · Rust Physics Engine · Offline Capable (SW v3.0)</span>
        <span className="flex items-center gap-1">
          <Cpu className="w-3 h-3" /> Powered by Rust + tRPC
        </span>
      </div>
    </div>
  );
}
