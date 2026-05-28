/**
 * Wells Page — Full well fleet table with filtering, sorting, and CRUD
 * Data: Live tRPC with mock fallback
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, Bookmark, Plus, Search, MoreHorizontal, Pencil, Trash2, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useFilterPresets } from "@/hooks/useFilterPresets";
type WellStatus = "ACTIVE" | "SHUT_IN" | "DRILLING" | "WORKOVER" | "ABANDONED";

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "Active", cls: "status-badge-normal" },
  SHUT_IN: { label: "Shut-In", cls: "status-badge-offline" },
  DRILLING: { label: "Drilling", cls: "status-badge-drilling" },
  WORKOVER: { label: "Workover", cls: "status-badge-warning" },
  ABANDONED: { label: "Abandoned", cls: "status-badge-offline" },
};

function EspHealthBar({ health }: { health: number }) {
  const color = health >= 80 ? "bg-emerald-500" : health >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${health}%` }} />
      </div>
      <span className={cn("text-xs font-mono", health >= 80 ? "text-emerald-400" : health >= 60 ? "text-amber-400" : "text-red-400")}>
        {health}%
      </span>
    </div>
  );
}

// ─── Edit Well Dialog ────────────────────────────────────────────────────────

function EditWellDialog({ well, open, onClose, onUpdated }: { well: any; open: boolean; onClose: () => void; onUpdated: () => void }) {
  const [form, setForm] = useState({
    name: well?.well_name ?? "",
    field: well?.field_name ?? "",
    basin: well?.basin ?? "",
    country: well?._country ?? "Kuwait",
    operator: well?.operator ?? "",
    status: (well?.status ?? "ACTIVE") as "ACTIVE" | "SHUT_IN" | "DRILLING" | "WORKOVER" | "ABANDONED",
  });
  const updateMutation = trpc.wells.update.useMutation({
    onSuccess: () => { toast.success("Well updated"); onUpdated(); onClose(); },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader><DialogTitle className="font-[Syne]">Edit Well</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs text-muted-foreground">Well Name</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="mt-1 bg-background border-border/50 h-8 text-sm" /></div>
            <div><Label className="text-xs text-muted-foreground">Field</Label>
              <Input value={form.field} onChange={e => setForm(p => ({ ...p, field: e.target.value }))} className="mt-1 bg-background border-border/50 h-8 text-sm" /></div>
            <div><Label className="text-xs text-muted-foreground">Basin</Label>
              <Input value={form.basin} onChange={e => setForm(p => ({ ...p, basin: e.target.value }))} className="mt-1 bg-background border-border/50 h-8 text-sm" /></div>
            <div><Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as any }))}>
                <SelectTrigger className="mt-1 h-8 text-sm bg-background border-border/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["ACTIVE","SHUT_IN","DRILLING","WORKOVER","ABANDONED"].map(s => (
                    <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="h-8 text-sm">Cancel</Button>
          <Button onClick={() => updateMutation.mutate({ id: well._dbId, name: form.name, field: form.field, status: form.status })} disabled={updateMutation.isPending} className="h-8 text-sm bg-amber-600 hover:bg-amber-700 text-white">
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Well Dialog ───────────────────────────────────────────────────────

function CreateWellDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "", field: "", basin: "", country: "Kuwait", operator: "",
    wellType: "OIL" as const, status: "ACTIVE" as const,
    latitude: "", longitude: "", depth: "", apiNumber: "",
  });

  const createMutation = trpc.wells.create.useMutation({
    onSuccess: () => {
      toast.success("Well created successfully");
      onCreated();
      onClose();
      setForm({ name: "", field: "", basin: "", country: "Kuwait", operator: "", wellType: "OIL", status: "ACTIVE", latitude: "", longitude: "", depth: "", apiNumber: "" });
    },
    onError: (err) => toast.error(`Failed to create well: ${err.message}`),
  });

  const handleSubmit = () => {
    if (!form.name || !form.field) {
      toast.error("Name and field are required");
      return;
    }
    createMutation.mutate({
      name: form.name,
      field: form.field,
      basin: form.basin || undefined,
      country: form.country,
      operator: form.operator || undefined,
      wellType: form.wellType,
      status: form.status,
      latitude: form.latitude ? parseFloat(form.latitude) : undefined,
      longitude: form.longitude ? parseFloat(form.longitude) : undefined,
      depth: form.depth ? parseFloat(form.depth) : undefined,
      apiNumber: form.apiNumber || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-[Syne]">Register New Well</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">Well Name *</Label>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. KW-001A" className="mt-1 bg-background border-border/50 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Field *</Label>
            <Input value={form.field} onChange={e => setForm(p => ({ ...p, field: e.target.value }))}
              placeholder="e.g. Greater Burgan" className="mt-1 bg-background border-border/50 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Basin</Label>
            <Input value={form.basin} onChange={e => setForm(p => ({ ...p, basin: e.target.value }))}
              placeholder="e.g. Kuwait Basin" className="mt-1 bg-background border-border/50 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Country</Label>
            <Select value={form.country} onValueChange={v => setForm(p => ({ ...p, country: v }))}>
              <SelectTrigger className="mt-1 h-8 text-sm bg-background border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Kuwait", "UAE", "Saudi Arabia", "Oman", "Qatar", "Bahrain"].map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Operator</Label>
            <Input value={form.operator} onChange={e => setForm(p => ({ ...p, operator: e.target.value }))}
              placeholder="e.g. KOC" className="mt-1 bg-background border-border/50 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Well Type</Label>
            <Select value={form.wellType} onValueChange={v => setForm(p => ({ ...p, wellType: v as any }))}>
              <SelectTrigger className="mt-1 h-8 text-sm bg-background border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["OIL","GAS","WATER_INJECTION","DISPOSAL","OBSERVATION"].map(t => (
                  <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as any }))}>
              <SelectTrigger className="mt-1 h-8 text-sm bg-background border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["ACTIVE","SHUT_IN","DRILLING","WORKOVER","ABANDONED"].map(s => (
                  <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Latitude</Label>
            <Input value={form.latitude} onChange={e => setForm(p => ({ ...p, latitude: e.target.value }))}
              type="number" placeholder="29.3759" className="mt-1 bg-background border-border/50 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Longitude</Label>
            <Input value={form.longitude} onChange={e => setForm(p => ({ ...p, longitude: e.target.value }))}
              type="number" placeholder="47.9774" className="mt-1 bg-background border-border/50 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Depth (m)</Label>
            <Input value={form.depth} onChange={e => setForm(p => ({ ...p, depth: e.target.value }))}
              type="number" placeholder="3200" className="mt-1 bg-background border-border/50 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">API Number</Label>
            <Input value={form.apiNumber} onChange={e => setForm(p => ({ ...p, apiNumber: e.target.value }))}
              placeholder="42-001-20130" className="mt-1 bg-background border-border/50 h-8 text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="h-8 text-sm">Cancel</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}
            className="h-8 text-sm bg-amber-600 hover:bg-amber-700 text-white">
            {createMutation.isPending ? "Creating..." : "Create Well"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Inline Status Select ────────────────────────────────────────────────────

function InlineStatusSelect({ wellId, currentStatus, onUpdated }: { wellId: number; currentStatus: string; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const updateMutation = trpc.wells.update.useMutation({
    onSuccess: () => { toast.success("Status updated"); onUpdated(); },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });
  const cfg = STATUS_CONFIG[currentStatus] ?? STATUS_CONFIG.SHUT_IN;
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${cfg.cls}`}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? "Saving..." : cfg.label}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-36">
        {Object.entries(STATUS_CONFIG).map(([key, val]) => (
          <DropdownMenuItem
            key={key}
            className={`text-xs gap-2 ${key === currentStatus ? "font-semibold" : ""}`}
            onClick={() => {
              if (key !== currentStatus) {
                updateMutation.mutate({ id: wellId, status: key as any });
              }
              setOpen(false);
            }}
          >
            <span className={`w-2 h-2 rounded-full ${key === "ACTIVE" ? "bg-emerald-500" : key === "WORKOVER" ? "bg-amber-500" : key === "DRILLING" ? "bg-blue-500" : "bg-slate-500"}`} />
            {val.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Wells Page ───────────────────────────────────────────────────────────────

export default function WellsPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [basinFilter, setBasinFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  const [showCreate, setShowCreate] = useState(false);
  const [editWell, setEditWell] = useState<any>(null);
  const [deleteWellId, setDeleteWellId] = useState<number | null>(null);
  const [presetName, setPresetName] = useState("");
  const [showSavePreset, setShowSavePreset] = useState(false);
  const { presets, savePreset, deletePreset } = useFilterPresets<{ search: string; statusFilter: string; basinFilter: string; sortBy: string }>("wells");

  const utils = trpc.useUtils();
  const deleteMutation = trpc.wells.delete.useMutation({
    onSuccess: () => { toast.success("Well deleted"); utils.wells.list.invalidate(); setDeleteWellId(null); },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });
  const { data: wellsData, isLoading } = trpc.wells.list.useQuery({ limit: 200 });

  const allWells = (wellsData?.wells ?? []).map((w: any) => ({
    well_id: w.wellId,
    well_name: w.name,
    api_number: w.apiNumber ?? "—",
    basin: w.basin ?? "—",
    field_name: w.field,
    status: w.status as WellStatus,
    oil_bpd: 0,
    gas_mcfd: 0,
    water_bpd: 0,
    uptime_pct: 0,
    esp_installed: false,
    esp_health: undefined,
    _dbId: w.id,
    _country: w.country,
  }));

  const basins = useMemo(() => ["all", ...Array.from(new Set(allWells.map((w: any) => w.basin ?? w.field_name)))], [allWells]);

  const filtered = useMemo(() => {
    return allWells
      .filter((w: any) => {
        const name = w.well_name ?? "";
        const field = w.field_name ?? "";
        const api = w.api_number ?? "";
        if (search && !name.toLowerCase().includes(search.toLowerCase()) &&
            !field.toLowerCase().includes(search.toLowerCase()) &&
            !api.includes(search)) return false;
        if (statusFilter !== "all" && w.status !== statusFilter) return false;
        if (basinFilter !== "all" && (w.basin ?? w.field_name) !== basinFilter) return false;
        return true;
      })
      .sort((a: any, b: any) => {
        if (sortBy === "oil_bpd") return (b.oil_bpd ?? 0) - (a.oil_bpd ?? 0);
        if (sortBy === "uptime") return (b.uptime_pct ?? 0) - (a.uptime_pct ?? 0);
        if (sortBy === "name") return (a.well_name ?? "").localeCompare(b.well_name ?? "");
        return 0;
      });
  }, [allWells, search, statusFilter, basinFilter, sortBy]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-[Syne]">{t('wells.title')}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {filtered.length} wells shown
            {allWells.length > 0 ? " · Live database" : " · Demo data"}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm"
          className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 h-8">
          <Plus className="w-3.5 h-3.5" />
          New Well
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search wells, fields, API..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-8 text-sm bg-card border-border/50"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-8 text-sm bg-card border-border/50">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="SHUT_IN">Shut-In</SelectItem>
            <SelectItem value="DRILLING">Drilling</SelectItem>
            <SelectItem value="WORKOVER">Workover</SelectItem>
            <SelectItem value="ABANDONED">Abandoned</SelectItem>
          </SelectContent>
        </Select>
        <Select value={basinFilter} onValueChange={setBasinFilter}>
          <SelectTrigger className="w-40 h-8 text-sm bg-card border-border/50">
            <SelectValue placeholder="Basin" />
          </SelectTrigger>
          <SelectContent>
            {basins.map((b: string) => <SelectItem key={b} value={b}>{b === "all" ? "All Basins" : b}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-36 h-8 text-sm bg-card border-border/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="oil_bpd">Sort: Oil Rate</SelectItem>
            <SelectItem value="uptime">Sort: Uptime</SelectItem>
            <SelectItem value="name">Sort: Name</SelectItem>
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
                    onClick={() => { setSearch(p.filters.search); setStatusFilter(p.filters.statusFilter); setBasinFilter(p.filters.basinFilter); setSortBy(p.filters.sortBy); toast.success(`Loaded: ${p.name}`); }}>
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
            <Input placeholder="e.g. Active Permian Wells" value={presetName} onChange={e => setPresetName(e.target.value)} className="h-8 text-sm" />
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowSavePreset(false)}>Cancel</Button>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => {
              if (!presetName.trim()) { toast.error("Enter a name"); return; }
              savePreset(presetName.trim(), { search, statusFilter, basinFilter, sortBy });
              toast.success(`Preset "${presetName.trim()}" saved`);
              setPresetName(""); setShowSavePreset(false);
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
        </div>
      ) : (
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Well</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Basin / Field</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Oil BPD</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Gas Mcfd</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Water BPD</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Uptime</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">ESP Health</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((well: any, i: number) => {
                  const cfg = STATUS_CONFIG[well.status] ?? STATUS_CONFIG.SHUT_IN;
                  const wellId = well.well_id ?? well.wellId;
                  return (
                    <tr
                      key={wellId}
                      className={cn(
                        "border-b border-border/30 hover:bg-amber-950/10 transition-colors",
                        i % 2 === 0 ? "bg-card" : "bg-card/50"
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{well.well_name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{well.api_number}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-foreground">{well.basin}</div>
                        <div className="text-[10px] text-muted-foreground">{well.field_name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <InlineStatusSelect
                          wellId={well._dbId}
                          currentStatus={well.status}
                          onUpdated={() => utils.wells.list.invalidate()}
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-amber-400">
                        {(well.oil_bpd ?? 0) > 0 ? (well.oil_bpd).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-blue-400">
                        {(well.gas_mcfd ?? 0) > 0 ? (well.gas_mcfd).toFixed(1) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                        {(well.water_bpd ?? 0) > 0 ? (well.water_bpd).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(well.uptime_pct ?? 0) > 0 ? (
                          <span className={cn("font-mono text-xs", well.uptime_pct >= 95 ? "text-emerald-400" : well.uptime_pct >= 80 ? "text-amber-400" : "text-red-400")}>
                            {well.uptime_pct}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {well.esp_installed && well.esp_health !== undefined ? (
                          <EspHealthBar health={well.esp_health} />
                        ) : (
                          <span className="text-xs text-muted-foreground">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Link href={`/wells/${wellId}`}>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-amber-400">
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={() => setEditWell(well)} className="gap-2 text-xs">
                                <Pencil className="w-3.5 h-3.5" /> Edit Well
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setDeleteWellId(well._dbId)} className="gap-2 text-xs text-red-400 focus:text-red-400">
                                <Trash2 className="w-3.5 h-3.5" /> Delete Well
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      No wells match the current filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CreateWellDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => utils.wells.list.invalidate()}
      />
      {editWell && (
        <EditWellDialog
          well={editWell}
          open={!!editWell}
          onClose={() => setEditWell(null)}
          onUpdated={() => utils.wells.list.invalidate()}
        />
      )}
      <AlertDialog open={deleteWellId !== null} onOpenChange={() => setDeleteWellId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Well</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the well and all associated data. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteWellId !== null && deleteMutation.mutate({ id: deleteWellId })} className="bg-red-600 hover:bg-red-700 text-white">
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
