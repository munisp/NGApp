/**
 * DemandResponse.tsx — OpenADR 3.1 Demand Response Management
 * v12.2: Database-backed via demandResponse tRPC router.
 * Tabs: Programs | Events (Gantt) | VEN Registry
 */
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity, AlertTriangle, CheckCircle2, Globe, Plus, RefreshCw, Server, Trash2, Zap,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

// ─── Types matching the DB schema ─────────────────────────────────────────────

interface DRProgram {
  id: number;
  programId: string;
  name: string;
  programType: string;
  country: string;
  principalProgram: boolean;
  bindingEvents: boolean;
  localPrice: boolean;
  timezone: string;
  status: "ACTIVE" | "INACTIVE" | "DRAFT";
  description: string | null;
  intervalPeriod: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface DREvent {
  id: number;
  eventId: string;
  programId: string;
  eventName: string;
  status: "SCHEDULED" | "ACTIVE" | "CANCELLED" | "COMPLETED";
  priority: number;
  startTime: Date;
  endTime: Date;
  signalType: "SIMPLE" | "PRICE" | "LOAD" | "EMERGENCY";
  payloadValue: number;
  payloadUnit: string;
  targets: string | null;
  intervalPeriod: string;
  reportRequired: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface DVEN {
  id: number;
  venId: string;
  venName: string;
  programId: string;
  facilityId: string | null;
  resourceType: string | null;
  maxLoadKw: number | null;
  currentLoadKw: number | null;
  availableKw: number | null;
  status: string;
  capabilities: string | null;
  lastHeartbeat: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const GCC_COUNTRIES = [
  { code: "SA", name: "Saudi Arabia" }, { code: "AE", name: "UAE" },
  { code: "KW", name: "Kuwait" }, { code: "QA", name: "Qatar" },
  { code: "OM", name: "Oman" }, { code: "BH", name: "Bahrain" },
  { code: "IQ", name: "Iraq" }, { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" }, { code: "NO", name: "Norway" },
];

const TZ_OPTIONS = [
  { value: "Asia/Riyadh", label: "Asia/Riyadh (UTC+3)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (UTC+4)" },
  { value: "Asia/Kuwait", label: "Asia/Kuwait (UTC+3)" },
  { value: "Asia/Qatar", label: "Asia/Qatar (UTC+3)" },
  { value: "Asia/Muscat", label: "Asia/Muscat (UTC+4)" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "America/Chicago", label: "America/Chicago" },
];

const SIGNAL_COLORS: Record<string, string> = {
  SIMPLE: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  PRICE: "bg-green-500/20 text-green-300 border-green-500/30",
  LOAD: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  EMERGENCY: "bg-red-500/20 text-red-300 border-red-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-500/20 text-green-300 border-green-500/30",
  SCHEDULED: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  CANCELLED: "bg-red-500/20 text-red-300 border-red-500/30",
  COMPLETED: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  DRAFT: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  INACTIVE: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

// ─── Gantt timeline ─────────────────────────────────────────────────────────────

function GanttTimeline({ events }: { events: DREvent[] }) {
  const now = Date.now();
  const windowStart = now - 2 * 3600000;
  const windowMs = 26 * 3600000;

  const rows = useMemo(
    () =>
      events
        .filter((e) => e.status !== "CANCELLED" && e.status !== "COMPLETED")
        .map((e) => {
          const start = new Date(e.startTime).getTime();
          const end = new Date(e.endTime).getTime();
          const left = Math.max(0, ((start - windowStart) / windowMs) * 100);
          const right = Math.min(100, ((end - windowStart) / windowMs) * 100);
          return { evt: e, left, width: Math.max(1, right - left) };
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events]
  );

  const hours = Array.from({ length: 27 }, (_, i) => ({
    label: new Date(windowStart + i * 3600000).getHours() + ":00",
    pct: (i / 26) * 100,
  }));

  return (
    <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-4">
      <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
        <Activity className="w-4 h-4 text-amber-400" /> Event Timeline (-2h to +24h)
      </h3>
      <div className="relative h-5 mb-1">
        {hours
          .filter((_, i) => i % 4 === 0)
          .map((h) => (
            <span
              key={h.label + h.pct}
              className="absolute text-[10px] text-slate-500 -translate-x-1/2"
              style={{ left: h.pct + "%" }}
            >
              {h.label}
            </span>
          ))}
      </div>
      <div className="relative">
        <div
          className="absolute top-0 bottom-0 w-px bg-amber-400/60 z-10"
          style={{ left: ((now - windowStart) / windowMs) * 100 + "%" }}
        />
        {rows.length === 0 ? (
          <div className="h-12 flex items-center justify-center text-slate-500 text-sm">
            No active or scheduled events
          </div>
        ) : (
          <div className="space-y-1.5">
            {rows.map(({ evt, left, width }) => (
              <div key={evt.eventId} className="relative h-7">
                <div className="absolute inset-y-0 w-full bg-slate-800/40 rounded" />
                <div
                  className={
                    "absolute inset-y-1 rounded flex items-center px-2 overflow-hidden " +
                    (evt.status === "ACTIVE"
                      ? "bg-amber-500/30 border border-amber-500/50"
                      : "bg-blue-500/20 border border-blue-500/40")
                  }
                  style={{ left: left + "%", width: width + "%" }}
                  title={evt.eventName + " - " + evt.signalType + " " + evt.payloadValue + evt.payloadUnit}
                >
                  <span className="text-[10px] text-white truncate">{evt.eventName}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create Program Dialog ──────────────────────────────────────────────────────

function CreateProgramDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    programType: "DEMAND_RESPONSE",
    country: "SA",
    timezone: "Asia/Riyadh",
    principalProgram: false,
    bindingEvents: true,
    localPrice: false,
    description: "",
    intervalPeriod: "PT1H",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE" | "DRAFT",
  });

  const createProgram = trpc.demandResponse.createProgram.useMutation({
    onSuccess: () => {
      toast.success("Program created");
      onCreated();
      onClose();
    },
    onError: (e) => toast.error("Failed: " + e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-amber-400">Create DR Program</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Program Name *</Label>
            <Input
              className="bg-slate-800 border-slate-600 text-slate-100"
              placeholder="e.g. GCC Peak Tariff Curtailment"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Country</Label>
              <Select value={form.country} onValueChange={(v) => setForm((f) => ({ ...f, country: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {GCC_COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code} className="text-slate-100">
                      {c.code} - {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Timezone</Label>
              <Select value={form.timezone} onValueChange={(v) => setForm((f) => ({ ...f, timezone: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {TZ_OPTIONS.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value} className="text-slate-100 text-xs">
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Program Type</Label>
              <Select value={form.programType} onValueChange={(v) => setForm((f) => ({ ...f, programType: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {["DEMAND_RESPONSE", "LOAD_FLEXIBILITY", "EMERGENCY_CURTAILMENT", "PRICE_RESPONSE"].map((t) => (
                    <SelectItem key={t} value={t} className="text-slate-100 text-xs">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v as "ACTIVE" | "INACTIVE" | "DRAFT" }))}
              >
                <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {(["ACTIVE", "INACTIVE", "DRAFT"] as const).map((s) => (
                    <SelectItem key={s} value={s} className="text-slate-100 text-xs">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Description</Label>
            <Input
              className="bg-slate-800 border-slate-600 text-slate-100"
              placeholder="e.g. Summer peak demand reduction"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.bindingEvents}
                onCheckedChange={(v) => setForm((f) => ({ ...f, bindingEvents: v }))}
              />
              <Label className="text-slate-300 text-xs">Binding Events</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.localPrice}
                onCheckedChange={(v) => setForm((f) => ({ ...f, localPrice: v }))}
              />
              <Label className="text-slate-300 text-xs">Local Price</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.principalProgram}
                onCheckedChange={(v) => setForm((f) => ({ ...f, principalProgram: v }))}
              />
              <Label className="text-slate-300 text-xs">Principal</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-slate-600">
            Cancel
          </Button>
          <Button
            className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
            disabled={!form.name || createProgram.isPending}
            onClick={() => createProgram.mutate(form)}
          >
            {createProgram.isPending ? "Creating..." : "Create Program"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Event Dialog ────────────────────────────────────────────────────────

function CreateEventDialog({
  open,
  onClose,
  onCreated,
  programs,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  programs: DRProgram[];
}) {
  const now = new Date();
  now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);

  const [form, setForm] = useState({
    programId: programs[0]?.programId ?? "",
    eventName: "",
    priority: 0,
    startTime: now.toISOString().slice(0, 16),
    endTime: new Date(now.getTime() + 3600000).toISOString().slice(0, 16),
    signalType: "LOAD" as "SIMPLE" | "PRICE" | "LOAD" | "EMERGENCY",
    payloadValue: 250,
    payloadUnit: "kW",
    intervalPeriod: "PT1H",
    reportRequired: false,
    targetType: "FACILITY",
    targetValues: "",
  });

  const createEvent = trpc.demandResponse.createEvent.useMutation({
    onSuccess: () => {
      toast.success("Event created");
      onCreated();
      onClose();
    },
    onError: (e) => toast.error("Failed: " + e.message),
  });

  const targets = form.targetValues
    ? [{ type: form.targetType, values: form.targetValues.split(",").map((s) => s.trim()).filter(Boolean) }]
    : undefined;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-amber-400">Create DR Event</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Program *</Label>
            <Select value={form.programId} onValueChange={(v) => setForm((f) => ({ ...f, programId: v }))}>
              <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                <SelectValue placeholder="Select program..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {programs.map((p) => (
                  <SelectItem key={p.programId} value={p.programId} className="text-slate-100 text-xs">
                    {p.name} ({p.country})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Event Name *</Label>
            <Input
              className="bg-slate-800 border-slate-600 text-slate-100"
              placeholder="e.g. Peak Curtailment 14:00"
              value={form.eventName}
              onChange={(e) => setForm((f) => ({ ...f, eventName: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Start Time *</Label>
              <Input
                type="datetime-local"
                className="bg-slate-800 border-slate-600 text-slate-100"
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">End Time *</Label>
              <Input
                type="datetime-local"
                className="bg-slate-800 border-slate-600 text-slate-100"
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Signal Type</Label>
              <Select
                value={form.signalType}
                onValueChange={(v) => setForm((f) => ({ ...f, signalType: v as typeof form.signalType }))}
              >
                <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {(["SIMPLE", "PRICE", "LOAD", "EMERGENCY"] as const).map((s) => (
                    <SelectItem key={s} value={s} className="text-slate-100 text-xs">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Payload Value</Label>
              <Input
                type="number"
                className="bg-slate-800 border-slate-600 text-slate-100"
                value={form.payloadValue}
                onChange={(e) => setForm((f) => ({ ...f, payloadValue: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Unit</Label>
              <Select value={form.payloadUnit} onValueChange={(v) => setForm((f) => ({ ...f, payloadUnit: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {["kW", "MW", "ratio", "USD/kWh", "%"].map((u) => (
                    <SelectItem key={u} value={u} className="text-slate-100 text-xs">
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Target Type</Label>
              <Select value={form.targetType} onValueChange={(v) => setForm((f) => ({ ...f, targetType: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {["FACILITY", "RESOURCE_TYPE", "VEN_ID", "GROUP", "ALL"].map((t) => (
                    <SelectItem key={t} value={t} className="text-slate-100 text-xs">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Target Values (comma-sep)</Label>
              <Input
                className="bg-slate-800 border-slate-600 text-slate-100"
                placeholder="FAC-001, FAC-002"
                value={form.targetValues}
                onChange={(e) => setForm((f) => ({ ...f, targetValues: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Priority (0=highest)</Label>
              <Input
                type="number"
                min={0}
                max={9}
                className="bg-slate-800 border-slate-600 text-slate-100"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="flex items-end pb-1 gap-2">
              <Switch
                checked={form.reportRequired}
                onCheckedChange={(v) => setForm((f) => ({ ...f, reportRequired: v }))}
              />
              <Label className="text-slate-300 text-xs">Report Required</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-slate-600">
            Cancel
          </Button>
          <Button
            className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
            disabled={!form.programId || !form.eventName || createEvent.isPending}
            onClick={() =>
              createEvent.mutate({
                programId: form.programId,
                eventName: form.eventName,
                priority: form.priority,
                startTime: new Date(form.startTime).toISOString(),
                endTime: new Date(form.endTime).toISOString(),
                signalType: form.signalType,
                payloadValue: form.payloadValue,
                payloadUnit: form.payloadUnit,
                intervalPeriod: form.intervalPeriod,
                reportRequired: form.reportRequired,
                targets,
              })
            }
          >
            {createEvent.isPending ? "Creating..." : "Create Event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Programs tab ───────────────────────────────────────────────────────────────

function ProgramsTab({ programs, onRefresh }: { programs: DRProgram[]; onRefresh: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const deleteProgram = trpc.demandResponse.deleteProgram.useMutation({
    onSuccess: () => {
      toast.success("Program deleted");
      onRefresh();
    },
    onError: (e) => toast.error("Failed: " + e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {programs.length} program{programs.length !== 1 ? "s" : ""}
        </p>
        <Button
          size="sm"
          className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold h-8"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> New Program
        </Button>
      </div>
      <div className="grid gap-3">
        {programs.map((prog) => (
          <Card key={prog.programId} className="bg-slate-900/60 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-slate-100">{prog.name}</h3>
                    <Badge variant="outline" className={STATUS_COLORS[prog.status] ?? ""}>
                      {prog.status}
                    </Badge>
                    <Badge variant="outline" className="border-slate-600 text-slate-400 text-[10px]">
                      {prog.programType}
                    </Badge>
                    {prog.principalProgram && (
                      <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[10px]">
                        Principal
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{prog.description ?? "No description"}</p>
                  <div className="flex gap-4 mt-2 text-[10px] text-slate-500">
                    <span>
                      <Globe className="w-3 h-3 inline mr-0.5" />
                      {prog.country} - {prog.timezone}
                    </span>
                    <span>{prog.bindingEvents ? "Binding" : "Non-binding"}</span>
                    <span>{prog.localPrice ? "Local Price" : "Grid Price"}</span>
                    <span>Interval: {prog.intervalPeriod}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-slate-500 hover:text-red-400"
                  onClick={() => deleteProgram.mutate({ programId: prog.programId })}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {programs.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Globe className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No programs yet. Create your first DR program.</p>
          </div>
        )}
      </div>
      <CreateProgramDialog open={showCreate} onClose={() => setShowCreate(false)} onCreated={onRefresh} />
    </div>
  );
}

// ─── Events tab ─────────────────────────────────────────────────────────────────

function EventsTab({
  events,
  programs,
  onRefresh,
}: {
  events: DREvent[];
  programs: DRProgram[];
  onRefresh: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const cancelEvent = trpc.demandResponse.cancelEvent.useMutation({
    onSuccess: () => {
      toast.success("Event cancelled");
      onRefresh();
    },
    onError: (e) => toast.error("Failed: " + e.message),
  });

  const filtered = statusFilter === "ALL" ? events : events.filter((e) => e.status === statusFilter);
  const programMap = Object.fromEntries(programs.map((p) => [p.programId, p.name]));

  return (
    <div className="space-y-4">
      <GanttTimeline events={events} />
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {["ALL", "SCHEDULED", "ACTIVE", "COMPLETED", "CANCELLED"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={
                "px-2 py-0.5 rounded text-xs transition-colors " +
                (statusFilter === s
                  ? "bg-amber-500 text-slate-900 font-semibold"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200")
              }
            >
              {s}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold h-8"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> New Event
        </Button>
      </div>
      <div className="space-y-2">
        {filtered.map((evt) => (
          <Card key={evt.eventId} className="bg-slate-900/60 border-slate-700/50">
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-100">{evt.eventName}</span>
                    <Badge variant="outline" className={STATUS_COLORS[evt.status] ?? ""}>
                      {evt.status}
                    </Badge>
                    <Badge variant="outline" className={SIGNAL_COLORS[evt.signalType] ?? ""}>
                      {evt.signalType}
                    </Badge>
                    <span className="text-xs text-amber-400 font-mono">
                      {evt.payloadValue} {evt.payloadUnit}
                    </span>
                  </div>
                  <div className="flex gap-4 mt-1 text-[10px] text-slate-500">
                    <span>Program: {programMap[evt.programId] ?? evt.programId}</span>
                    <span>Start: {new Date(evt.startTime).toLocaleString()}</span>
                    <span>End: {new Date(evt.endTime).toLocaleString()}</span>
                    <span>Priority: {evt.priority}</span>
                    {evt.reportRequired && <span className="text-blue-400">Report Required</span>}
                  </div>
                </div>
                {(evt.status === "SCHEDULED" || evt.status === "ACTIVE") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-red-400 hover:text-red-300 shrink-0"
                    onClick={() => cancelEvent.mutate({ eventId: evt.eventId })}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No events found.</p>
          </div>
        )}
      </div>
      <CreateEventDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={onRefresh}
        programs={programs}
      />
    </div>
  );
}

// ─── VEN Registry tab ──────────────────────────────────────────────────────────

function VenRegistryTab({ vens, programs }: { vens: DVEN[]; programs: DRProgram[] }) {
  const programMap = Object.fromEntries(programs.map((p) => [p.programId, p.name]));
  const CAPS = ["LOAD_SHED", "LOAD_SHIFT", "BASELINE_REPORTING", "REAL_TIME_REPORTING"];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-700">
            {["VEN ID", "Name", "Program", "Resource", "Max kW", "Avail kW", "Status", "Capabilities", "Heartbeat"].map(
              (h) => (
                <th key={h} className="text-left py-2 px-3 text-slate-500 font-medium whitespace-nowrap">
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {vens.map((ven) => {
            const caps: string[] = ven.capabilities ? JSON.parse(ven.capabilities) : [];
            const age = ven.lastHeartbeat
              ? Math.round((Date.now() - new Date(ven.lastHeartbeat).getTime()) / 1000)
              : null;
            return (
              <tr key={ven.venId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="py-2 px-3 font-mono text-amber-400">{ven.venId}</td>
                <td className="py-2 px-3 text-slate-200">{ven.venName}</td>
                <td className="py-2 px-3 text-slate-400">{programMap[ven.programId] ?? ven.programId}</td>
                <td className="py-2 px-3 text-slate-400">{ven.resourceType ?? "-"}</td>
                <td className="py-2 px-3 text-slate-300">{ven.maxLoadKw ?? "-"}</td>
                <td className="py-2 px-3 text-green-400 font-semibold">{ven.availableKw ?? "-"}</td>
                <td className="py-2 px-3">
                  <Badge
                    variant="outline"
                    className={
                      ven.status === "REGISTERED"
                        ? "bg-green-500/10 text-green-400 border-green-500/30 text-[10px]"
                        : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30 text-[10px]"
                    }
                  >
                    {ven.status}
                  </Badge>
                </td>
                <td className="py-2 px-3">
                  <div className="flex gap-1 flex-wrap">
                    {CAPS.map((cap) => (
                      <span
                        key={cap}
                        className={
                          "text-[9px] px-1 py-0.5 rounded border " +
                          (caps.includes(cap)
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                            : "bg-slate-800 text-slate-600 border-slate-700")
                        }
                      >
                        {cap.replace("_", " ")}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-2 px-3 text-slate-500">
                  {age !== null ? (
                    age < 60 ? (
                      <span className="text-green-400">{age}s ago</span>
                    ) : (
                      Math.round(age / 60) + "m ago"
                    )
                  ) : (
                    <span className="text-slate-600">Never</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {vens.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Server className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No VENs registered.</p>
        </div>
      )}
    </div>
  );
}

// ─── Audit Log Tab ─────────────────────────────────────────────────────────────

interface AuditEntry {
  id: number;
  eventId: string;
  programId: string | null;
  venId: string;
  tag: string;
  setpointKw: number | null;
  baselineKw: number | null;
  actualKw?: number | null;
  deviationKw?: number | null;
  curtailmentKw?: number | null;
  opcuaStatus: string;
  dispatchedAt: string | Date;
  confirmedAt?: string | Date | null;
  regulatoryRef: string | null;
  notes: string | null;
  createdAt?: string | Date;
}

function AuditLogTab({ entries, loading }: { entries: AuditEntry[]; loading: boolean }) {
  const handleExportCsv = () => {
    const headers = ["Event ID", "Program ID", "VEN ID", "Tag", "Setpoint kW", "Baseline kW", "OPC-UA Status", "Dispatched At", "Confirmed At", "Regulatory Ref", "Notes"];
    const rows = entries.map((e) => [
      e.eventId, e.programId ?? "", e.venId, e.tag,
      e.setpointKw ?? "", e.baselineKw ?? "",
      e.opcuaStatus,
      new Date(e.dispatchedAt).toISOString(),
      e.confirmedAt ? new Date(e.confirmedAt).toISOString() : "",
      e.regulatoryRef ?? "", e.notes ?? "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `dr-audit-log-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">DR Event Audit Log</h2>
          <p className="text-xs text-slate-500">Per-VEN setpoint dispatch records — FERC Order 2222 / OpenADR 3.1 compliance</p>
        </div>
        <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 h-8" onClick={handleExportCsv}>
          Export CSV
        </Button>
      </div>
      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Loading audit log...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No dispatch records yet. Dispatch a DR event to generate audit entries.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-700/50">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-800/60 text-slate-400 border-b border-slate-700">
                {["Event ID", "VEN ID", "Tag", "Setpoint", "Baseline", "OPC-UA", "Dispatched", "Regulatory Ref", "Notes"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                  <td className="px-3 py-2 font-mono text-amber-300">{e.eventId}</td>
                  <td className="px-3 py-2 text-slate-300">{e.venId}</td>
                  <td className="px-3 py-2 font-mono text-slate-400 text-[10px]">{e.tag}</td>
                  <td className="px-3 py-2 text-right text-slate-200">{e.setpointKw != null ? e.setpointKw + " kW" : "-"}</td>
                  <td className="px-3 py-2 text-right text-slate-400">{e.baselineKw != null ? e.baselineKw + " kW" : "-"}</td>
                  <td className="px-3 py-2">
                    <Badge className={e.opcuaStatus === "SENT" ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-red-500/20 text-red-300 border-red-500/30"} variant="outline">
                      {e.opcuaStatus}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{new Date(e.dispatchedAt).toLocaleString()}</td>
                  <td className="px-3 py-2 text-slate-500 text-[10px]">{e.regulatoryRef ?? "-"}</td>
                  <td className="px-3 py-2 text-slate-500 max-w-[200px] truncate">{e.notes ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function DemandResponse() {
  const [activeTab, setActiveTab] = useState<"programs" | "events" | "vens" | "audit">("programs");

  const programsQ = trpc.demandResponse.getPrograms.useQuery(undefined, { refetchInterval: 30000 });
  const eventsQ = trpc.demandResponse.getEvents.useQuery({}, { refetchInterval: 10000 });
  const vensQ = trpc.demandResponse.getVens.useQuery(undefined, { refetchInterval: 30000 });
  const statusQ = trpc.demandResponse.getStatus.useQuery(undefined, { refetchInterval: 30000 });
  const summaryQ = trpc.demandResponse.getSummary.useQuery(undefined, { refetchInterval: 30000 });

  const programs = (programsQ.data?.programs ?? []) as DRProgram[];
  const events = (eventsQ.data?.events ?? []) as DREvent[];
  const vens = (vensQ.data?.vens ?? []) as DVEN[];
  const status = statusQ.data;
  const summary = summaryQ.data;

  const auditLogQ = trpc.demandResponse.getAuditLog.useQuery({ limit: 50 }, { refetchInterval: 30000 });
  const [reportGenerating, setReportGenerating] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const pdfReportMutation = trpc.demandResponse.generateComplianceReportPDF.useMutation({
    onSuccess: (data) => {
      const byteChars = atob(data.pdfBase64);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArr], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
      setPdfGenerating(false);
    },
    onError: () => setPdfGenerating(false),
  });
  const handleGeneratePDF = () => {
    setPdfGenerating(true);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const end = now.toISOString();
    pdfReportMutation.mutate({ startDate: start, endDate: end });
  };
  const complianceReportMutation = trpc.demandResponse.generateComplianceReport.useMutation({
    onSuccess: (data) => {
      if (data.format === "csv" && data.csv) {
        const blob = new Blob([data.csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `dr-compliance-report-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `dr-compliance-report-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
      setReportGenerating(false);
    },
    onError: () => setReportGenerating(false),
  });

  const handleGenerateReport = (format: "json" | "csv") => {
    setReportGenerating(true);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const end = now.toISOString();
    complianceReportMutation.mutate({ startDate: start, endDate: end, format });
  };

  const handleRefresh = () => {
    programsQ.refetch();
    eventsQ.refetch();
    vensQ.refetch();
    statusQ.refetch();
    summaryQ.refetch();
    auditLogQ.refetch();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-400" /> Demand Response
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Grid demand management · Energy optimization · Load balancing · Grid integration
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={
              "flex items-center gap-1.5 text-xs px-2 py-1 rounded border " +
              (status?.healthy
                ? "bg-green-500/10 text-green-400 border-green-500/30"
                : status?.mode === "disabled"
                ? "bg-slate-800 text-slate-500 border-slate-700"
                : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30")
            }
          >
            {status?.healthy ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
            VTN {status?.mode ?? "checking..."}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-slate-200 h-8"
            onClick={handleRefresh}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Active Programs",
            value: summary?.activePrograms ?? "-",
            sub: "of " + (summary?.totalPrograms ?? 0) + " total",
            color: "text-green-400",
          },
          {
            label: "Active Events",
            value: events.filter((e) => e.status === "ACTIVE").length,
            sub: events.filter((e) => e.status === "SCHEDULED").length + " scheduled",
            color: "text-amber-400",
          },
          {
            label: "Registered VENs",
            value: summary?.registeredVens ?? "-",
            sub: (summary?.pendingVens ?? 0) + " pending",
            color: "text-blue-400",
          },
          {
            label: "Available Capacity",
            value: summary?.totalAvailableKw ? summary.totalAvailableKw + " kW" : "-",
            sub: "curtailable load",
            color: "text-purple-400",
          },
        ].map((card) => (
          <Card key={card.label} className="bg-slate-900/60 border-slate-700/50">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">{card.label}</p>
              <p className={"text-2xl font-bold mt-1 " + card.color}>{card.value}</p>
              <p className="text-[10px] text-slate-600 mt-0.5">{card.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger
            value="programs"
            className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900"
          >
            Programs ({programs.length})
          </TabsTrigger>
          <TabsTrigger
            value="events"
            className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900"
          >
            Events ({events.length})
          </TabsTrigger>
          <TabsTrigger
            value="vens"
            className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900"
          >
            VEN Registry ({vens.length})
          </TabsTrigger>
          <TabsTrigger
            value="audit"
            className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900"
          >
            Audit Log ({(auditLogQ.data?.entries ?? []).length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="programs" className="mt-4">
          <ProgramsTab programs={programs} onRefresh={handleRefresh} />
        </TabsContent>
        <TabsContent value="events" className="mt-4">
          <EventsTab events={events} programs={programs} onRefresh={handleRefresh} />
        </TabsContent>
        <TabsContent value="vens" className="mt-4">
          <VenRegistryTab vens={vens} programs={programs} />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <div className="flex items-center justify-end gap-2 mb-3">
            <span className="text-xs text-slate-500 mr-auto">Regulatory compliance report — FERC Order 2222 / OpenADR 3.1 / IEC 62746-10-3</span>
            <Button
              size="sm"
              variant="outline"
              className="border-slate-600 text-slate-300 h-8 text-xs"
              disabled={reportGenerating}
              onClick={() => handleGenerateReport("csv")}
            >
              {reportGenerating ? "Generating..." : "Download CSV Report"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-600 text-amber-300 h-8 text-xs"
              disabled={reportGenerating}
              onClick={() => handleGenerateReport("json")}
            >
              {reportGenerating ? "Generating..." : "Download JSON Report"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-red-600 text-red-300 h-8 text-xs"
              disabled={pdfGenerating}
              onClick={handleGeneratePDF}
            >
              {pdfGenerating ? "Generating PDF..." : "Download PDF Report"}
            </Button>
          </div>
          <AuditLogTab entries={(auditLogQ.data?.entries ?? []) as AuditEntry[]} loading={auditLogQ.isLoading} />
        </TabsContent>
      </Tabs>

      {(programsQ.data?.source === "simulated" || eventsQ.data?.source === "simulated") && (
        <p className="text-[10px] text-slate-600 text-center">
          Showing simulated data - connect OpenLEADR VTN or add programs to the database to see live data
        </p>
      )}
    </div>
  );
}
