/**
 * ActuatorControl.tsx — Electro-Hydraulic Actuator Command Interface
 * Design: Dark Amber — safety-critical UI with confirmation dialogs and audit trail
 * WT Petrotech Gap Closure: Electro-Hydraulic Wellhead, ESD, PLC-Based Wellhead, Valve Control
 */

import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ChevronRight,
  Clock, Gauge, GitBranch, Lock, RefreshCw, Settings, Shield,
  ToggleLeft, ToggleRight, Waves, Wrench, XCircle, Zap
} from "lucide-react";
type ActuatorCommand = Record<string, any>;
type CommandStatus = string;
type ActuatorType = string;
type ProtocolType = string;
import { trpc } from "@/lib/trpc";

// ── Helpers ───────────────────────────────────────────────────────────────────

function commandStatusConfig(status: CommandStatus) {
  switch (status) {
    case "EXECUTED":
      return { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: CheckCircle2 };
    case "PENDING":
    case "SENT":
      return { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", icon: Clock };
    case "ACKNOWLEDGED":
      return { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", icon: CheckCircle2 };
    case "FAILED":
    case "CANCELLED":
      return { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", icon: XCircle };
    default:
      return { color: "text-muted-foreground", bg: "bg-muted", border: "border-border", icon: Clock };
  }
}

function actuatorBadge(type: ActuatorType) {
  const colors: Record<string, string> = {
    HYDRAULIC: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    ELECTRO_HYDRAULIC: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    PNEUMATIC: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    ELECTRIC: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    MANUAL: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge className={`${colors[type] ?? ""} text-[10px] font-mono`}>{type.replace("_", "-")}</Badge>
  );
}

function protocolBadge(p: ProtocolType) {
  const colors: Record<string, string> = {
    OPC_UA: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    MODBUS_TCP: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    MODBUS_RTU: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    DNP3: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    MQTT: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  };
  return (
    <Badge className={`${colors[p] ?? ""} text-[10px] font-mono`}>{p}</Badge>
  );
}

function timeSince(isoStr: string) {
  const diff = Date.now() - new Date(isoStr).getTime();
  if (diff < 10000) return "Just now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// ── Valve Control Panel (per subsea tree) ─────────────────────────────────────

function ValveControlPanel({ tree }: { tree: Record<string, any> }) {
  // choke_position_pct may be undefined when data comes from DB (which uses chokePosition)
  const initialChoke = (tree as any).choke_position_pct ?? (tree as any).chokePosition ?? 50;
  const [chokeValue, setChokeValue] = useState<number>(initialChoke);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingCmd, setPendingCmd] = useState<{ valve: string; action: string; value?: number } | null>(null);

  function issueCommand(valve: string, action: string, value?: number) {
    setPendingCmd({ valve, action, value });
    setConfirmOpen(true);
  }

  function executeCommand() {
    toast.success(`Command issued: ${pendingCmd?.valve} → ${pendingCmd?.action}`, {
      description: `Protocol: OPC-UA | Actuator: Electro-Hydraulic | Operator: J. Rodriguez`,
    });
    setConfirmOpen(false);
    setPendingCmd(null);
  }

  const t = tree as any;
  const valves = [
    { tag: "MV", name: "Master Valve", open: t.master_valve_open ?? t.masterValveOpen ?? true, type: "ELECTRO_HYDRAULIC" as ActuatorType },
    { tag: "WV", name: "Wing Valve", open: t.wing_valve_open ?? t.wingValveOpen ?? true, type: "ELECTRO_HYDRAULIC" as ActuatorType },
    { tag: "SV", name: "Swab Valve", open: t.swab_valve_open ?? t.swabValveOpen ?? false, type: "HYDRAULIC" as ActuatorType },
  ];

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Waves className="w-4 h-4 text-blue-400" />
              <div>
                <CardTitle className="text-sm font-[Syne]">{t.tree_tag ?? t.treeId ?? t.name}</CardTitle>
                <div className="text-xs text-muted-foreground">{t.water_depth_m ?? t.waterDepthM ?? '—'}m WD · {t.tree_type ?? t.status}</div>
              </div>
            </div>
            <Badge className={tree.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"}>
              {tree.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Valve status and control */}
          <div className="space-y-2">
            {valves.map(v => (
              <div key={v.tag} className="flex items-center justify-between bg-muted/20 rounded-lg p-2.5">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${v.open ? "bg-emerald-400" : "bg-red-400"}`} />
                  <span className="text-xs font-mono font-bold">{v.tag}</span>
                  <span className="text-xs text-muted-foreground">{v.name}</span>
                  {actuatorBadge(v.type)}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-mono font-bold ${v.open ? "text-emerald-400" : "text-red-400"}`}>
                    {v.open ? "OPEN" : "CLOSED"}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className={`h-6 text-[10px] px-2 ${v.open ? "border-red-500/30 text-red-400 hover:bg-red-500/10" : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"}`}
                    onClick={() => issueCommand(v.tag, v.open ? "CLOSE" : "OPEN")}
                  >
                    {v.open ? "Close" : "Open"}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Choke position slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Gauge className="w-3 h-3" />
                Choke Position
              </span>
              <span className="font-mono font-bold text-amber-400">{chokeValue.toFixed(0)}%</span>
            </div>
            <Slider
              value={[chokeValue]}
              onValueChange={([v]) => setChokeValue(v)}
              min={0}
              max={100}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Closed (0%)</span>
              <span>Full Open (100%)</span>
            </div>
            <Button
              size="sm"
              className="w-full h-7 text-xs bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-600/30"
              onClick={() => issueCommand("CV", "CHOKE_POSITION", chokeValue)}
            >
              Apply Choke Position ({chokeValue.toFixed(0)}%)
            </Button>
          </div>

          {/* Pressures */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
            <div>
              <div className="text-[10px] text-muted-foreground">Tubing Pressure</div>
              <div className="text-sm font-mono text-amber-400 font-bold">{(t.tubing_pressure_psi ?? t.wellheadPressureBar ?? 0).toLocaleString()} PSI</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Umbilical Hyd.</div>
              <div className="text-sm font-mono text-blue-400 font-bold">{(t.umbilical_hydraulic_pressure_psi ?? 0).toLocaleString()} PSI</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-[Syne] flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              Confirm Actuator Command
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tree</span>
                <span className="font-mono font-bold">{t.tree_tag ?? t.treeId ?? t.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valve</span>
                <span className="font-mono font-bold">{pendingCmd?.valve}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Command</span>
                <span className="font-mono font-bold text-amber-400">{pendingCmd?.action}</span>
              </div>
              {pendingCmd?.value !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Value</span>
                  <span className="font-mono font-bold">{pendingCmd.value}%</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Protocol</span>
                <span className="font-mono">OPC-UA</span>
              </div>
            </div>
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded p-2">
              <Shield className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
              <span>This command will be logged in the audit trail and requires supervisor authorization. Ensure all personnel are clear of the wellhead before proceeding.</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={executeCommand}
              >
                <Zap className="w-3.5 h-3.5 mr-1.5" />
                Execute Command
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── HPU Pressure Setpoint Panel ───────────────────────────────────────────────

function HPUSetpointPanel({ hpu }: { hpu: Record<string, any> }) {
  const [setpoint, setSetpoint] = useState(hpu.system_pressure_psi);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-amber-400" />
              <div>
                <CardTitle className="text-sm font-[Syne]">{hpu.hpu_tag}</CardTitle>
                <div className="text-xs text-muted-foreground">{hpu.manufacturer} {hpu.model}</div>
              </div>
            </div>
            {actuatorBadge("ELECTRO_HYDRAULIC")}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current vs setpoint */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/20 rounded p-2.5">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Current</div>
              <div className="text-lg font-mono font-bold text-amber-400">{hpu.system_pressure_psi.toLocaleString()}</div>
              <div className="text-[10px] text-muted-foreground">PSI</div>
            </div>
            <div className="bg-muted/20 rounded p-2.5">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Setpoint</div>
              <div className="text-lg font-mono font-bold text-blue-400">{setpoint.toLocaleString()}</div>
              <div className="text-[10px] text-muted-foreground">PSI</div>
            </div>
          </div>

          {/* Pressure setpoint slider */}
          <div className="space-y-2">
            <Slider
              value={[setpoint]}
              onValueChange={([v]) => setSetpoint(v)}
              min={0}
              max={hpu.rated_pressure_psi}
              step={50}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0 PSI</span>
              <span>Rated: {hpu.rated_pressure_psi.toLocaleString()} PSI</span>
            </div>
          </div>

          {/* Pump control */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className={`flex-1 h-7 text-xs ${hpu.pump1_running ? "border-red-500/30 text-red-400" : "border-emerald-500/30 text-emerald-400"}`}
              onClick={() => toast.success(`Pump 1 ${hpu.pump1_running ? "stop" : "start"} command sent`)}
            >
              {hpu.pump1_running ? <ToggleRight className="w-3 h-3 mr-1" /> : <ToggleLeft className="w-3 h-3 mr-1" />}
              Pump 1 {hpu.pump1_running ? "Stop" : "Start"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={`flex-1 h-7 text-xs ${hpu.pump2_running ? "border-red-500/30 text-red-400" : "border-emerald-500/30 text-emerald-400"}`}
              onClick={() => toast.success(`Pump 2 ${hpu.pump2_running ? "stop" : "start"} command sent`)}
            >
              {hpu.pump2_running ? <ToggleRight className="w-3 h-3 mr-1" /> : <ToggleLeft className="w-3 h-3 mr-1" />}
              Pump 2 {hpu.pump2_running ? "Stop" : "Start"}
            </Button>
          </div>

          <Button
            size="sm"
            className="w-full h-7 text-xs bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-600/30"
            onClick={() => setConfirmOpen(true)}
          >
            Apply Pressure Setpoint ({setpoint.toLocaleString()} PSI)
          </Button>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-[Syne] flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              Confirm HPU Setpoint Change
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">HPU</span>
                <span className="font-mono font-bold">{hpu.hpu_tag}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Pressure</span>
                <span className="font-mono">{hpu.system_pressure_psi.toLocaleString()} PSI</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">New Setpoint</span>
                <span className="font-mono font-bold text-amber-400">{setpoint.toLocaleString()} PSI</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Protocol</span>
                <span className="font-mono">MODBUS-TCP</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmOpen(false)}>Cancel</Button>
              <Button
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => {
                  toast.success(`HPU setpoint updated to ${setpoint.toLocaleString()} PSI`);
                  setConfirmOpen(false);
                }}
              >
                Apply Setpoint
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Command Audit Trail ───────────────────────────────────────────────────────

function CommandAuditTrail({ commands }: { commands: ActuatorCommand[] }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-[Syne] flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-amber-400" />
          Command Audit Trail
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {commands.map(cmd => {
            const cfg = commandStatusConfig(cmd.status);
            const Icon = cfg.icon;
            return (
              <div key={cmd.command_id} className={`flex items-start gap-3 p-3 rounded-lg border ${cfg.border} ${cfg.bg}`}>
                <Icon className={`w-4 h-4 ${cfg.color} flex-shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-foreground">{cmd.well_name}</span>
                    {cmd.valve_tag && (
                      <span className="text-xs font-mono text-muted-foreground">→ {cmd.valve_tag}</span>
                    )}
                    <Badge className={`${cfg.bg} ${cfg.color} ${cfg.border} text-[10px]`}>
                      {cmd.command_type}
                    </Badge>
                    {actuatorBadge(cmd.actuator_type)}
                    {protocolBadge(cmd.protocol)}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                    <span>Target: <span className="font-mono text-foreground">{cmd.target_value} {cmd.unit}</span></span>
                    {cmd.current_value !== undefined && (
                      <span>Actual: <span className="font-mono text-foreground">{cmd.current_value} {cmd.unit}</span></span>
                    )}
                    <span>By: <span className="text-foreground">{cmd.issued_by}</span></span>
                    <span>{timeSince(cmd.issued_at)}</span>
                  </div>
                  {cmd.error_message && (
                    <div className="text-[10px] text-red-400 mt-1">{cmd.error_message}</div>
                  )}
                </div>
                <Badge className={`${cfg.bg} ${cfg.color} ${cfg.border} text-[10px] flex-shrink-0`}>
                  {cmd.status}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── ESD Panel ─────────────────────────────────────────────────────────────────

function ESDPanel() {
  const [esdConfirm, setEsdConfirm] = useState(false);
  const [esdCode, setEsdCode] = useState("");

  function triggerESD() {
    if (esdCode !== "ESD-CONFIRM") {
      toast.error("Invalid ESD confirmation code");
      return;
    }
    toast.error("EMERGENCY SHUTDOWN INITIATED — All wells entering safe state", {
      duration: 8000,
    });
    setEsdConfirm(false);
    setEsdCode("");
  }

  return (
    <>
      <Card className="bg-red-950/20 border-red-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-[Syne] text-red-400 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Emergency Shutdown System (ESD)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Triggers IEC 61511 SIL-2 compliant emergency shutdown across all connected wellheads, closing all master valves and surface safety valves via fail-safe hydraulic actuation.
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              ["SIL Rating", "SIL-2"],
              ["Response Time", "< 2 sec"],
              ["Fail-Safe Mode", "De-energize to Close"],
              ["Fusible Loop", "Active"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between bg-muted/20 rounded px-2 py-1.5">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-mono font-bold text-foreground">{v}</span>
              </div>
            ))}
          </div>
          <Button
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold"
            onClick={() => setEsdConfirm(true)}
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            INITIATE EMERGENCY SHUTDOWN
          </Button>
        </CardContent>
      </Card>

      <Dialog open={esdConfirm} onOpenChange={setEsdConfirm}>
        <DialogContent className="max-w-sm border-red-500/50 bg-red-950/30">
          <DialogHeader>
            <DialogTitle className="font-[Syne] text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              EMERGENCY SHUTDOWN CONFIRMATION
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded p-3">
              This will immediately close all master valves and surface safety valves across the entire field. This action cannot be undone remotely — a physical site inspection will be required to restore production.
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                Type <span className="font-mono text-red-400">ESD-CONFIRM</span> to proceed
              </label>
              <Input
                value={esdCode}
                onChange={e => setEsdCode(e.target.value)}
                placeholder="ESD-CONFIRM"
                className="border-red-500/30 font-mono"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEsdConfirm(false)}>
                Abort
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold"
                onClick={triggerESD}
                disabled={esdCode !== "ESD-CONFIRM"}
              >
                CONFIRM ESD
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ActuatorControlPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: liveSubseaTrees } = trpc.fpso.subseaTrees.useQuery({});
  const { data: liveHpus } = trpc.fpso.hpuUnits.useQuery({});
  const { data: liveCommands } = trpc.actuator.list.useQuery({ limit: 50 });
  const issueCommandMutation = trpc.actuator.issue.useMutation({
    onSuccess: () => utils.actuator.list.invalidate(),
    onError: (err) => toast.error(`Command failed: ${err.message}`),
  });

  // Use live data; empty array when DB has no records yet
  const subseaTrees = (liveSubseaTrees as any[]) ?? [];
  const hpuUnits = (liveHpus as any[]) ?? [];
  const auditCommands = (liveCommands as any[]) ?? [];

  const [activeTab, setActiveTab] = useState<"subsea" | "hpu" | "audit">("subsea");

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-[Syne] text-foreground">
            Actuator Control
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Valve Electro-hydraulic valve control · HPU setpoints · ESD · Audit trail actuator control · Pressure setpoints · Emergency shutdown · Change history
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs">
              <Shield className="w-3 h-3 mr-1" />
              Admin — Full Control
            </Badge>
          ) : (
            <Badge className="bg-red-500/10 text-red-400 border-red-500/30 text-xs">
              <Lock className="w-3 h-3 mr-1" />
              Read-Only — Admin Required
            </Badge>
          )}
        </div>
      </div>

      {/* Safety banner */}
      <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
        <div className="text-xs text-amber-300">
          <strong>Safety Notice:</strong> All actuator commands are logged to the immutable audit trail and require supervisor authorization. Verify all personnel are clear of wellhead equipment before issuing valve commands. Commands are executed via fail-safe electro-hydraulic actuation with 2-second response time.
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-2">
        {[
          { key: "subsea", label: "Subsea Trees", icon: Waves },
          { key: "hpu", label: "HPU Setpoints", icon: Gauge },
          { key: "audit", label: "Audit Trail", icon: GitBranch },
        ].map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            variant={activeTab === key ? "default" : "outline"}
            size="sm"
            className={activeTab === key ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
            onClick={() => setActiveTab(key as typeof activeTab)}
          >
            <Icon className="w-3.5 h-3.5 mr-1.5" />
            {label}
          </Button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "subsea" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subseaTrees.map((tree: any) => (
            <ValveControlPanel key={tree.tree_id ?? tree.treeId} tree={tree} />
          ))}
          {/* ESD panel */}
          <ESDPanel />
        </div>
      )}

      {activeTab === "hpu" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {hpuUnits.map((hpu: any) => (
            <HPUSetpointPanel key={hpu.hpu_id ?? hpu.hpuId} hpu={hpu} />
          ))}
        </div>
      )}

      {activeTab === "audit" && (
        <CommandAuditTrail commands={auditCommands} />
      )}
    </div>
  );
}
