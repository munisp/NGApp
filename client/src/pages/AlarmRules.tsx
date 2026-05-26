/**
 * AlarmRules.tsx — ISA-18.2 Alarm Rules Management
 * Design: Dark Amber — full CRUD for setpoint-based alarm rules per well
 * Data: Live tRPC with wells.alarmRules, wells.createAlarmRule, wells.updateAlarmRule, wells.deleteAlarmRule
 */

import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle, Bell, BellOff, Edit2, Plus, Shield, Trash2,
  ChevronDown, ChevronUp, Filter, RefreshCw, Info
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type AlarmRule = {
  id: number;
  ruleId: string;
  wellId: string;
  tag: string;
  sensorField: string;
  condition: string;
  threshold: number;
  deadBand: number | null;
  severity: number;
  description: string;
  unit: string | null;
  isa182Category: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type RuleFormData = {
  wellId: string;
  tag: string;
  sensorField: string;
  condition: string;
  threshold: number;
  deadBand: number;
  severity: number;
  description: string;
  unit: string;
  isa182Category: string;
  enabled: boolean;
};

const SENSOR_FIELDS = [
  { value: "tubingPressure", label: "Tubing Pressure" },
  { value: "casingPressure", label: "Casing Pressure" },
  { value: "flowRate", label: "Flow Rate" },
  { value: "wellheadTemp", label: "Wellhead Temperature" },
  { value: "espCurrent", label: "ESP Motor Current" },
  { value: "espFrequency", label: "ESP Frequency" },
  { value: "espVibration", label: "ESP Vibration" },
  { value: "motorTemp", label: "Motor Temperature" },
  { value: "pumpIntakePressure", label: "Pump Intake Pressure" },
  { value: "gasOilRatio", label: "Gas-Oil Ratio" },
  { value: "waterCut", label: "Water Cut" },
  { value: "chokePosition", label: "Choke Position" },
];

const CONDITIONS = [
  { value: "GT", label: "> Greater Than" },
  { value: "LT", label: "< Less Than" },
  { value: "GTE", label: "≥ Greater or Equal" },
  { value: "LTE", label: "≤ Less or Equal" },
  { value: "EQ", label: "= Equal To" },
  { value: "NEQ", label: "≠ Not Equal To" },
];

const ISA_CATEGORIES = [
  { value: "PROCESS", label: "Process" },
  { value: "EQUIPMENT", label: "Equipment" },
  { value: "SAFETY", label: "Safety" },
  { value: "ENVIRONMENTAL", label: "Environmental" },
  { value: "REGULATORY", label: "Regulatory" },
];

const SEVERITY_CONFIG: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: "Advisory", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30" },
  2: { label: "Warning", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
  3: { label: "High", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" },
  4: { label: "Critical", color: "text-red-400", bg: "bg-red-500/10 border-red-500/30" },
};

const DEFAULT_FORM: RuleFormData = {
  wellId: "",
  tag: "",
  sensorField: "tubingPressure",
  condition: "GT",
  threshold: 0,
  deadBand: 0,
  severity: 2,
  description: "",
  unit: "psi",
  isa182Category: "PROCESS",
  enabled: true,
};

// ─── Rule Form Dialog ─────────────────────────────────────────────────────────

function RuleFormDialog({
  open,
  onClose,
  editRule,
  wells,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editRule: AlarmRule | null;
  wells: { wellId: string; name?: string }[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState<RuleFormData>(() =>
    editRule
      ? {
          wellId: editRule.wellId,
          tag: editRule.tag,
          sensorField: editRule.sensorField,
          condition: editRule.condition,
          threshold: editRule.threshold,
          deadBand: editRule.deadBand ?? 0,
          severity: editRule.severity,
          description: editRule.description,
          unit: editRule.unit ?? "psi",
          isa182Category: editRule.isa182Category ?? "PROCESS",
          enabled: editRule.enabled,
        }
      : { ...DEFAULT_FORM }
  );

  const createMutation = trpc.wells.createAlarmRule.useMutation({
    onSuccess: () => { toast.success("Alarm rule created"); onSaved(); onClose(); },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });
  const updateMutation = trpc.wells.updateAlarmRule.useMutation({
    onSuccess: () => { toast.success("Alarm rule updated"); onSaved(); onClose(); },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const isLoading = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = () => {
    if (!form.wellId) { toast.error("Select a well"); return; }
    if (!form.tag) { toast.error("Tag is required"); return; }
    if (!form.description) { toast.error("Description is required"); return; }
    if (editRule) {
      updateMutation.mutate({ id: editRule.id, ...form });
    } else {
      createMutation.mutate({ ...form, condition: form.condition as "GT" | "LT" | "GTE" | "LTE" });
    }
  };

  const set = (key: keyof RuleFormData, val: unknown) =>
    setForm(f => ({ ...f, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-[Syne]">
            {editRule ? "Edit Alarm Rule" : "New Alarm Rule"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Well */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Well *</Label>
              <Select value={form.wellId} onValueChange={v => set("wellId", v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select well..." />
                </SelectTrigger>
                <SelectContent>
                  {wells.map(w => (
                    <SelectItem key={w.wellId} value={w.wellId} className="text-xs">
                      {w.name ?? w.wellId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tag *</Label>
              <Input
                className="h-8 text-xs font-mono"
                placeholder="e.g. THP-HIGH"
                value={form.tag}
                onChange={e => set("tag", e.target.value.toUpperCase())}
              />
            </div>
          </div>

          {/* Sensor + Condition */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Sensor Field *</Label>
              <Select value={form.sensorField} onValueChange={v => set("sensorField", v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SENSOR_FIELDS.map(s => (
                    <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Condition *</Label>
              <Select value={form.condition} onValueChange={v => set("condition", v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map(c => (
                    <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Threshold + Dead Band + Unit */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Threshold *</Label>
              <Input
                type="number"
                className="h-8 text-xs font-mono"
                value={form.threshold}
                onChange={e => set("threshold", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Dead Band</Label>
              <Input
                type="number"
                className="h-8 text-xs font-mono"
                value={form.deadBand}
                onChange={e => set("deadBand", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Unit</Label>
              <Input
                className="h-8 text-xs font-mono"
                placeholder="psi"
                value={form.unit}
                onChange={e => set("unit", e.target.value)}
              />
            </div>
          </div>

          {/* Severity + ISA Category */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Severity (1–4) *</Label>
              <Select value={String(form.severity)} onValueChange={v => set("severity", parseInt(v))}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map(s => (
                    <SelectItem key={s} value={String(s)} className="text-xs">
                      {s} — {SEVERITY_CONFIG[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">ISA-18.2 Category</Label>
              <Select value={form.isa182Category} onValueChange={v => set("isa182Category", v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ISA_CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Description *</Label>
            <Input
              className="h-8 text-xs"
              placeholder="e.g. Tubing head pressure exceeds safe operating limit"
              value={form.description}
              onChange={e => set("description", e.target.value)}
            />
          </div>

          {/* Enabled toggle */}
          <div className="flex items-center gap-3 pt-1">
            <Switch
              checked={form.enabled}
              onCheckedChange={v => set("enabled", v)}
            />
            <Label className="text-xs text-muted-foreground">
              {form.enabled ? "Rule enabled — will evaluate on telemetry ingestion" : "Rule disabled — will not trigger alarms"}
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? "Saving..." : editRule ? "Update Rule" : "Create Rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Rule Row ─────────────────────────────────────────────────────────────────

function RuleRow({
  rule,
  onEdit,
  onDelete,
  onToggle,
  isAdmin,
}: {
  rule: AlarmRule;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  isAdmin: boolean;
}) {
  const sev = SEVERITY_CONFIG[rule.severity] ?? SEVERITY_CONFIG[2];
  const condLabel = CONDITIONS.find(c => c.value === rule.condition)?.label ?? rule.condition;
  const sensorLabel = SENSOR_FIELDS.find(s => s.value === rule.sensorField)?.label ?? rule.sensorField;

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-3 border-b border-border/40 hover:bg-muted/20 transition-colors",
      !rule.enabled && "opacity-50"
    )}>
      {/* Severity badge */}
      <Badge className={cn("text-xs shrink-0 w-20 justify-center", sev.bg, sev.color)}>
        {sev.label}
      </Badge>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-foreground">{rule.tag}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">{rule.wellId}</span>
          {rule.isa182Category && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{rule.isa182Category}</Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 truncate">
          {sensorLabel} {condLabel.split(" ").slice(1).join(" ")} <strong className="text-foreground font-mono">{rule.threshold}{rule.unit ? ` ${rule.unit}` : ""}</strong>
          {(rule.deadBand ?? 0) > 0 && <span className="ml-1">(±{rule.deadBand} dead band)</span>}
          <span className="ml-2 text-muted-foreground/60">— {rule.description}</span>
        </div>
      </div>

      {/* Toggle + actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Switch
          checked={rule.enabled}
          onCheckedChange={onToggle}
          disabled={!isAdmin}
        />
        {isAdmin && (
          <>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300" onClick={onDelete}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AlarmRulesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();

  const [filterWell, setFilterWell] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterEnabled, setFilterEnabled] = useState<string>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editRule, setEditRule] = useState<AlarmRule | null>(null);
  const [sortField, setSortField] = useState<"severity" | "wellId" | "tag">("severity");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Data
  const { data: rulesData, isLoading } = trpc.wells.alarmRules.useQuery(
    filterWell !== "all" ? { wellId: filterWell } : {}
  );
  const { data: wellsData } = trpc.wells.list.useQuery({ limit: 100 });

  const deleteMutation = trpc.wells.deleteAlarmRule.useMutation({
    onSuccess: () => { toast.success("Rule deleted"); utils.wells.alarmRules.invalidate(); },
    onError: (err) => toast.error(`Delete failed: ${err.message}`),
  });
  const updateMutation = trpc.wells.updateAlarmRule.useMutation({
    onSuccess: () => utils.wells.alarmRules.invalidate(),
    onError: (err) => toast.error(`Update failed: ${err.message}`),
  });

  const rules = (rulesData ?? []) as AlarmRule[];
  const wells = (wellsData?.wells ?? []) as { wellId: string; name?: string }[];

  // Filter + sort
  const filtered = rules
    .filter(r => filterSeverity === "all" || String(r.severity) === filterSeverity)
    .filter(r => filterEnabled === "all" || (filterEnabled === "enabled" ? r.enabled : !r.enabled))
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortField === "severity") return (a.severity - b.severity) * dir;
      if (sortField === "wellId") return a.wellId.localeCompare(b.wellId) * dir;
      return a.tag.localeCompare(b.tag) * dir;
    });

  const handleDelete = (rule: AlarmRule) => {
    if (!confirm(`Delete rule "${rule.tag}"? This cannot be undone.`)) return;
    deleteMutation.mutate({ id: rule.id });
  };

  const handleToggle = (rule: AlarmRule) => {
    updateMutation.mutate({ id: rule.id, enabled: !rule.enabled });
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) =>
    sortField === field
      ? sortDir === "desc" ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
      : null;

  // Stats
  const stats = {
    total: rules.length,
    enabled: rules.filter(r => r.enabled).length,
    critical: rules.filter(r => r.severity === 4).length,
    byWell: new Set(rules.map(r => r.wellId)).size,
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-[Syne]">Alarm Rules</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            ISA-18.2 setpoint-based alarm rules · Automatic evaluation on telemetry ingestion
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isAdmin && (
            <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs">
              <Info className="w-3 h-3 mr-1" />
              Read-Only
            </Badge>
          )}
          {isAdmin && (
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white h-8 text-xs"
              onClick={() => { setEditRule(null); setShowDialog(true); }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              New Rule
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Rules", value: stats.total, icon: Bell, color: "text-amber-400" },
          { label: "Active Rules", value: stats.enabled, icon: Bell, color: "text-emerald-400" },
          { label: "Critical (Sev 4)", value: stats.critical, icon: AlertTriangle, color: "text-red-400" },
          { label: "Wells Covered", value: stats.byWell, icon: Shield, color: "text-blue-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="kpi-card">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={cn("w-3.5 h-3.5", color)} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <div className={cn("text-2xl font-mono font-bold tabular-nums", color)}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <Card className="border-border/40">
        <CardContent className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />

            <Select value={filterWell} onValueChange={setFilterWell}>
              <SelectTrigger className="h-7 text-xs w-40">
                <SelectValue placeholder="All Wells" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Wells</SelectItem>
                {wells.map(w => (
                  <SelectItem key={w.wellId} value={w.wellId} className="text-xs">
                    {w.name ?? w.wellId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="h-7 text-xs w-36">
                <SelectValue placeholder="All Severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Severities</SelectItem>
                {[1, 2, 3, 4].map(s => (
                  <SelectItem key={s} value={String(s)} className="text-xs">
                    {s} — {SEVERITY_CONFIG[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterEnabled} onValueChange={setFilterEnabled}>
              <SelectTrigger className="h-7 text-xs w-32">
                <SelectValue placeholder="All States" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All States</SelectItem>
                <SelectItem value="enabled" className="text-xs">Enabled Only</SelectItem>
                <SelectItem value="disabled" className="text-xs">Disabled Only</SelectItem>
              </SelectContent>
            </Select>

            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{filtered.length} rules</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => utils.wells.alarmRules.invalidate()}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rules Table */}
      <Card className="border-border/40">
        {/* Column headers */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border/40 bg-muted/20">
          <button
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-20 shrink-0"
            onClick={() => toggleSort("severity")}
          >
            Severity <SortIcon field="severity" />
          </button>
          <div className="flex-1">
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => toggleSort("tag")}
            >
              Tag / Well / Condition <SortIcon field="tag" />
            </button>
          </div>
          <span className="text-xs text-muted-foreground shrink-0 w-24 text-right">Enabled / Actions</span>
        </div>

        {isLoading ? (
          <div className="space-y-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
                <Skeleton className="h-5 w-20" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-3 w-72" />
                </div>
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BellOff className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No alarm rules found</p>
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3 text-xs"
                onClick={() => { setEditRule(null); setShowDialog(true); }}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Create First Rule
              </Button>
            )}
          </div>
        ) : (
          <div>
            {filtered.map(rule => (
              <RuleRow
                key={rule.id}
                rule={rule}
                isAdmin={isAdmin}
                onEdit={() => { setEditRule(rule); setShowDialog(true); }}
                onDelete={() => handleDelete(rule)}
                onToggle={() => handleToggle(rule)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* ISA-18.2 info banner */}
      <div className="flex items-start gap-3 bg-blue-500/5 border border-blue-500/20 rounded-lg px-4 py-3">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground space-y-0.5">
          <p><strong className="text-foreground">ISA-18.2 Alarm Management:</strong> Rules are evaluated automatically on every telemetry ingestion event. Dead-band hysteresis prevents alarm chatter. Severity 4 (Critical) alarms trigger owner push notifications after 5 minutes unacknowledged.</p>
          <p>Alarm rationalization: target &lt;1 alarm/10 min per operator per ISA-18.2 §5.4.</p>
        </div>
      </div>

      {/* Form Dialog */}
      {showDialog && (
        <RuleFormDialog
          open={showDialog}
          onClose={() => { setShowDialog(false); setEditRule(null); }}
          editRule={editRule}
          wells={wells}
          onSaved={() => utils.wells.alarmRules.invalidate()}
        />
      )}
    </div>
  );
}
