/**
 * Alarms Page — Full alarm management with acknowledge/suppress actions
 * Data: Live tRPC with mock fallback
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Bell, BellOff, Bookmark, Check, Plus, Trash2, X, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useRole } from "@/hooks/usePermission";
import { useFilterPresets } from "@/hooks/useFilterPresets";
const SEVERITY_CONFIG: Record<number, { label: string; cls: string; rowCls: string }> = {
  4: { label: "CRITICAL", cls: "status-badge-critical", rowCls: "border-l-4 border-l-red-500 bg-red-950/10" },
  3: { label: "HIGH", cls: "status-badge-warning", rowCls: "border-l-4 border-l-amber-500 bg-amber-950/10" },
  2: { label: "MEDIUM", cls: "status-badge-normal", rowCls: "border-l-4 border-l-blue-500 bg-blue-950/10" },
  1: { label: "LOW", cls: "status-badge-offline", rowCls: "" },
};


function timeAgo(iso: string | Date) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Create Alarm Dialog ──────────────────────────────────────────────────────

function CreateAlarmDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    wellId: "", tag: "", description: "", severity: "2",
    value: "", setpoint: "", unit: "", isa182Category: "",
  });

  const createMutation = trpc.wells.ingestTelemetry.useMutation({
    onSuccess: () => {
      toast.success("Alarm created");
      onCreated();
      onClose();
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  // We use a direct DB insert via a dedicated alarm create procedure
  // For now show a toast that alarm creation requires a well ID
  const handleSubmit = () => {
    if (!form.wellId || !form.tag || !form.description) {
      toast.error("Well ID, tag, and description are required");
      return;
    }
    toast.info("Alarm injection requires telemetry data — use the Ingest Telemetry API for automated alarm creation");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-[Syne]">Create Manual Alarm</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs text-muted-foreground">Well ID</Label>
            <Input value={form.wellId} onChange={e => setForm(p => ({ ...p, wellId: e.target.value }))}
              placeholder="e.g. W-KW001A" className="mt-1 bg-background border-border/50 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Tag</Label>
            <Input value={form.tag} onChange={e => setForm(p => ({ ...p, tag: e.target.value }))}
              placeholder="e.g. THP_HIGH" className="mt-1 bg-background border-border/50 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Tubing head pressure exceeded setpoint" className="mt-1 bg-background border-border/50 h-8 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Severity</Label>
              <Select value={form.severity} onValueChange={v => setForm(p => ({ ...p, severity: v }))}>
                <SelectTrigger className="mt-1 h-8 text-sm bg-background border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">Critical</SelectItem>
                  <SelectItem value="3">High</SelectItem>
                  <SelectItem value="2">Medium</SelectItem>
                  <SelectItem value="1">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Unit</Label>
              <Input value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
                placeholder="psi" className="mt-1 bg-background border-border/50 h-8 text-sm" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="h-8 text-sm">Cancel</Button>
          <Button onClick={handleSubmit} className="h-8 text-sm bg-amber-600 hover:bg-amber-700 text-white">
            Create Alarm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Alarms Page ──────────────────────────────────────────────────────────────

export default function AlarmsPage() {
  const { t } = useTranslation();
  const { isOperator } = useRole();
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("active");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [presetName, setPresetName] = useState("");
  const [showSavePreset, setShowSavePreset] = useState(false);
  const { presets, savePreset, deletePreset } = useFilterPresets<{ search: string; stateFilter: string; severityFilter: string }>("alarms");

  const utils = trpc.useUtils();
  // Use dedicated alarms router (previously orphaned, now wired)
  const { data: dbAlarms, isLoading } = trpc.alarms.list.useQuery({ limit: 200 });
  const { data: alarmStats } = trpc.alarms.stats.useQuery();

  const bulkAckMutation = trpc.alarms.bulkAcknowledge.useMutation({
    onSuccess: (r) => { toast.success(`Acknowledged ${r.count} alarms`); setSelectedIds(new Set()); utils.alarms.list.invalidate(); utils.alarms.stats.invalidate(); },
    onError: (err) => toast.error(`Bulk acknowledge failed: ${err.message}`),
  });
  const bulkClearMutation = trpc.alarms.bulkClear.useMutation({
    onSuccess: (r) => { toast.success(`Cleared ${r.count} alarms`); setSelectedIds(new Set()); utils.alarms.list.invalidate(); utils.alarms.stats.invalidate(); },
    onError: (err) => toast.error(`Bulk clear failed: ${err.message}`),
  });
  const bulkSuppressMutation = trpc.alarms.bulkSuppress.useMutation({
    onSuccess: (r) => { toast.info(`Suppressed ${r.count} alarms for 4 hours`); setSelectedIds(new Set()); utils.alarms.list.invalidate(); utils.alarms.stats.invalidate(); },
    onError: (err) => toast.error(`Bulk suppress failed: ${err.message}`),
  });

  const ackMutation = trpc.alarms.acknowledge.useMutation({
    onSuccess: () => { toast.success("Alarm acknowledged"); utils.alarms.list.invalidate(); utils.alarms.stats.invalidate(); },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });
  const suppressMutation = trpc.alarms.suppress.useMutation({
    onSuccess: () => { toast.info("Alarm suppressed"); utils.alarms.list.invalidate(); utils.alarms.stats.invalidate(); },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });
  const clearMutation = trpc.alarms.clear.useMutation({
    onSuccess: () => { toast.success("Alarm cleared"); utils.alarms.list.invalidate(); utils.alarms.stats.invalidate(); },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  // Normalize alarms to a common shape
  type NormalizedAlarm = {
    id: string | number;
    wellId: string;
    tag: string;
    description: string;
    severity: number; // 4=critical, 1=low (DB scale)
    state: string;
    value?: number;
    unit?: string;
    setpoint?: number;
    createdAt: string | Date;
    acknowledgedBy?: string;
    acknowledgedAt?: string | Date;
    _dbId?: string;
  };

  const allAlarms: NormalizedAlarm[] = (dbAlarms ?? []).map((a: any) => ({
    id: a.alarmId,
    wellId: a.wellId,
    tag: a.tag,
    description: a.description,
    severity: a.severity,
    state: a.state,
    value: a.value,
    unit: a.unit,
    setpoint: a.setpoint,
    createdAt: a.createdAt,
    acknowledgedBy: a.acknowledgedBy,
    acknowledgedAt: a.acknowledgedAt,
    _dbId: a.alarmId ?? String(a.id),
  }));

  const filtered = allAlarms.filter(a => {
    if (severityFilter !== "all" && a.severity !== parseInt(severityFilter)) return false;
    if (stateFilter === "active" && !["UNACKNOWLEDGED", "ACKNOWLEDGED"].includes(a.state)) return false;
    if (stateFilter === "cleared" && a.state !== "CLEARED") return false;
    if (search) {
      const q = search.toLowerCase();
      if (!a.tag.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q) && !a.wellId.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const unackCount = allAlarms.filter(a => a.state === "UNACKNOWLEDGED").length;
  const criticalCount = allAlarms.filter(a => a.severity >= 4 && a.state === "UNACKNOWLEDGED").length;

  const acknowledgeAll = () => {
    const unacked = allAlarms.filter(a => a.state === "UNACKNOWLEDGED" && a._dbId);
    Promise.all(unacked.map(a => ackMutation.mutateAsync({ alarmId: a._dbId! })))
      .then(() => toast.success(`Acknowledged ${unacked.length} alarms`));
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold font-[Syne] flex items-center gap-2">
            <AlertTriangle className={cn("w-5 h-5", criticalCount > 0 ? "text-red-400 animate-pulse" : "text-amber-400")} />
            {t('alarms.title')}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
            {unackCount} unacknowledged · {criticalCount} critical
{allAlarms.length > 0 ? " · Live database" : " · No alarms"}
          </p>
        </div>
        <div className="flex gap-2">
          {unackCount > 0 && (
            <Button size="sm" variant="outline" onClick={acknowledgeAll} disabled={!isOperator}
              className="text-xs border-amber-700/40 text-amber-400 hover:bg-amber-950/30 disabled:opacity-40">
              <Check className="w-3.5 h-3.5 mr-1.5" />
              Acknowledge All ({unackCount})
            </Button>
          )}
          <Button size="sm" onClick={() => setShowCreate(true)}
            className="text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            New Alarm
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Critical", count: allAlarms.filter(a => a.severity >= 4 && ["UNACKNOWLEDGED","ACKNOWLEDGED"].includes(a.state)).length, color: "text-red-400 bg-red-950/30 border-red-800/30" },
          { label: "High", count: allAlarms.filter(a => a.severity === 3 && ["UNACKNOWLEDGED","ACKNOWLEDGED"].includes(a.state)).length, color: "text-amber-400 bg-amber-950/30 border-amber-700/30" },
          { label: "Medium", count: allAlarms.filter(a => a.severity === 2 && ["UNACKNOWLEDGED","ACKNOWLEDGED"].includes(a.state)).length, color: "text-blue-400 bg-blue-950/30 border-blue-800/30" },
          { label: "Cleared", count: allAlarms.filter(a => a.state === "CLEARED").length, color: "text-muted-foreground bg-muted/30 border-border/30" },
        ].map(({ label, count, color }) => (
          <div key={label} className={cn("rounded-lg border p-3 text-center", color)}>
            <div className="text-2xl font-mono font-bold">{count}</div>
            <div className="text-xs mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Bulk action toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-950/20 border border-amber-700/30">
          <span className="text-xs text-amber-400 font-medium">{selectedIds.size} selected</span>
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-700/40 text-emerald-400 hover:bg-emerald-950/30"
              onClick={() => bulkAckMutation.mutate({ alarmIds: Array.from(selectedIds) })} disabled={!isOperator || bulkAckMutation.isPending}>
              <Check className="w-3 h-3 mr-1" /> Acknowledge
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs border-blue-700/40 text-blue-400 hover:bg-blue-950/30"
              onClick={() => bulkSuppressMutation.mutate({ alarmIds: Array.from(selectedIds), hours: 4 })} disabled={!isOperator || bulkSuppressMutation.isPending}>
              <BellOff className="w-3 h-3 mr-1" /> Suppress 4h
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs border-muted-foreground/40 text-muted-foreground hover:bg-muted/30"
              onClick={() => bulkClearMutation.mutate({ alarmIds: Array.from(selectedIds) })} disabled={!isOperator || bulkClearMutation.isPending}>
              <X className="w-3 h-3 mr-1" /> Clear
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by tag, description, or well ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-8 text-sm bg-card border-border/50"
          />
        </div>
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-36 h-8 text-sm bg-card border-border/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active Alarms</SelectItem>
            <SelectItem value="cleared">Cleared</SelectItem>
            <SelectItem value="all">All Alarms</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-36 h-8 text-sm bg-card border-border/50">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="4">Critical</SelectItem>
            <SelectItem value="3">High</SelectItem>
            <SelectItem value="2">Medium</SelectItem>
            <SelectItem value="1">Low</SelectItem>
          </SelectContent>
        </Select>
        {/* Saved filter presets */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-border/50">
              <Bookmark className="w-3.5 h-3.5" />
              Presets {presets.length > 0 && <span className="bg-amber-500/20 text-amber-400 text-[9px] px-1 rounded">{presets.length}</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {presets.length > 0 ? (
              <>
                {presets.map(p => (
                  <DropdownMenuItem key={p.id} className="flex items-center justify-between group"
                    onClick={() => { setSearch(p.filters.search); setStateFilter(p.filters.stateFilter); setSeverityFilter(p.filters.severityFilter); toast.success(`Loaded: ${p.name}`); }}>
                    <span className="text-xs truncate">{p.name}</span>
                    <Trash2 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 ml-2 shrink-0"
                      onClick={e => { e.stopPropagation(); deletePreset(p.id); toast.info(`Deleted: ${p.name}`); }} />
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            ) : (
              <div className="text-xs text-muted-foreground px-2 py-1.5">No saved presets</div>
            )}
            <DropdownMenuItem onClick={() => setShowSavePreset(true)} className="text-xs text-amber-400">
              <Bookmark className="w-3 h-3 mr-1.5" /> Save current filters...
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* Save preset dialog */}
      <Dialog open={showSavePreset} onOpenChange={setShowSavePreset}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Save Filter Preset</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs">Preset name</Label>
            <Input placeholder="e.g. Critical Unacknowledged" value={presetName} onChange={e => setPresetName(e.target.value)} className="h-8 text-sm" />
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowSavePreset(false)}>Cancel</Button>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => {
              if (!presetName.trim()) { toast.error("Enter a name"); return; }
              savePreset(presetName.trim(), { search, stateFilter, severityFilter });
              toast.success(`Preset "${presetName.trim()}" saved`);
              setPresetName(""); setShowSavePreset(false);
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alarm list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Bell className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No alarms matching current filters</p>
            </div>
          ) : filtered.map(alarm => {
            const cfg = SEVERITY_CONFIG[alarm.severity] ?? SEVERITY_CONFIG[2];
            const alarmKey = String(alarm._dbId ?? alarm.id);
            const isSelected = selectedIds.has(alarmKey);
            return (
              <div key={alarmKey} className={cn("rounded-lg border p-4 transition-all cursor-pointer",
                isSelected ? "border-amber-500/50 bg-amber-950/10" : "border-border/30",
                cfg.rowCls
              )} onClick={() => {
                const next = new Set(selectedIds);
                if (isSelected) next.delete(alarmKey); else next.add(alarmKey);
                setSelectedIds(next);
              }}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={isSelected} readOnly
                    className="mt-1 w-3.5 h-3.5 rounded accent-amber-500 shrink-0 cursor-pointer" />
                  <AlertTriangle className={cn("w-4 h-4 mt-0.5 shrink-0",
                    alarm.severity >= 4 ? "text-red-400" : alarm.severity === 3 ? "text-amber-400" : "text-blue-400"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={cfg.cls}>{cfg.label}</span>
                      <span className="text-sm font-semibold text-foreground">{alarm.wellId}</span>
                      <span className="text-xs font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                        {alarm.tag.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono ml-auto">{timeAgo(alarm.createdAt)}</span>
                    </div>
                    <p className="text-sm text-foreground/90">{alarm.description}</p>
                    {alarm.value !== undefined && (
                      <div className="flex items-center gap-3 mt-1.5 text-xs font-mono">
                        <span className="text-muted-foreground">Value: <span className="text-amber-400 font-bold">{alarm.value} {alarm.unit}</span></span>
                        {alarm.setpoint && <span className="text-muted-foreground">Setpoint: {alarm.setpoint} {alarm.unit}</span>}
                      </div>
                    )}
                    {alarm.acknowledgedBy && (
                      <div className="text-[10px] text-muted-foreground mt-1">
                        Acknowledged by {alarm.acknowledgedBy}
                        {alarm.acknowledgedAt && ` · ${timeAgo(alarm.acknowledgedAt)}`}
                      </div>
                    )}
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {alarm._dbId && alarm.state === "UNACKNOWLEDGED" && (
                      <>
                        <button
                          onClick={() => ackMutation.mutate({ alarmId: alarm._dbId! })}
                          disabled={ackMutation.isPending}
                          className="p-1.5 rounded border border-emerald-700/40 text-emerald-400 hover:bg-emerald-950/30 transition-colors"
                          title="Acknowledge"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => suppressMutation.mutate({ alarmId: alarm._dbId!, hours: 1 })}
                          disabled={suppressMutation.isPending}
                          className="p-1.5 rounded border border-border/50 text-muted-foreground hover:bg-muted/30 transition-colors"
                          title="Suppress for 1 hour"
                        >
                          <BellOff className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    {alarm._dbId && alarm.state === "ACKNOWLEDGED" && (
                      <button
                        onClick={() => clearMutation.mutate({ alarmId: alarm._dbId! })}
                        disabled={clearMutation.isPending}
                        className="p-1.5 rounded border border-blue-700/40 text-blue-400 hover:bg-blue-950/30 transition-colors"
                        title="Clear Alarm"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <div className={cn(
                      "text-[10px] font-mono px-2 py-1 rounded border",
                      alarm.state === "UNACKNOWLEDGED" ? "text-red-400 border-red-800/40 bg-red-950/20" :
                      alarm.state === "ACKNOWLEDGED" ? "text-amber-400 border-amber-700/40 bg-amber-950/20" :
                      alarm.state === "CLEARED" ? "text-emerald-400 border-emerald-800/40 bg-emerald-950/20" :
                      "text-muted-foreground border-border/40"
                    )}>
                      {alarm.state === "UNACKNOWLEDGED" ? "Unacknowledged" : alarm.state === "ACKNOWLEDGED" ? "Acknowledged" : alarm.state === "CLEARED" ? "Cleared" : alarm.state}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateAlarmDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { utils.alarms.list.invalidate(); utils.alarms.stats.invalidate(); }}
      />
    </div>
  );
}
