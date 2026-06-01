/**
 * ProductionTargets.tsx — Production Target Tracking
 *
 * Full CRUD: set daily production targets per well, track actuals vs targets,
 * view variance analysis, and receive alerts when targets are at risk.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Target, TrendingUp, TrendingDown, AlertTriangle, RefreshCw, History, Trash2 } from "lucide-react";

interface SetTargetForm {
  wellId: string;
  targetDate: string;
  oilTargetBpd: number;
  gasTargetMmscfd: number;
  waterInjectionBwpd: number;
  notes: string;
}

const today = new Date().toISOString().split("T")[0];

const defaultForm: SetTargetForm = {
  wellId: "",
  targetDate: today,
  oilTargetBpd: 0,
  gasTargetMmscfd: 0,
  waterInjectionBwpd: 0,
  notes: "",
};

export default function ProductionTargetsPage() {
  const [form, setForm] = useState<SetTargetForm>(defaultForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyWellId, setHistoryWellId] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const { data: summary, isLoading } = trpc.productionTargets.summary.useQuery();

  const { data: history = [] } = trpc.productionTargets.history.useQuery(
    { wellId: historyWellId!, days: 30 },
    { enabled: !!historyWellId }
  );

  const setTargetMutation = trpc.productionTargets.setTarget.useMutation({
    onSuccess: () => {
      toast.success("Production target updated successfully.");
      utils.productionTargets.summary.invalidate();
      setDialogOpen(false);
      setForm(defaultForm);
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const deleteMutation = trpc.productionTargets.deleteTarget.useMutation({
    onSuccess: () => {
      toast.success("Target deleted.");
      utils.productionTargets.summary.invalidate();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  function openSetTarget(wellId: string) {
    setForm({ ...defaultForm, wellId });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.wellId) {
      toast.error("Please select a well.");
      return;
    }
    setTargetMutation.mutate(form);
  }

  function getVarianceBadge(actual: number, target: number) {
    if (target === 0) return <Badge variant="secondary">No target</Badge>;
    const pct = ((actual - target) / target) * 100;
    if (pct >= 0) return <Badge className="bg-green-600 text-white">+{pct.toFixed(1)}%</Badge>;
    if (pct >= -10) return <Badge className="bg-yellow-500 text-white">{pct.toFixed(1)}%</Badge>;
    return <Badge variant="destructive">{pct.toFixed(1)}%</Badge>;
  }

  const wells = summary?.wells ?? [];
  const atRisk = wells.filter((w: { actual_oil_bpd: number; oil_target_bpd: number }) =>
    w.oil_target_bpd > 0 && w.actual_oil_bpd < w.oil_target_bpd * 0.9
  ).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" />
            Production Targets
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Set and track daily oil, gas, and water injection targets per well
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => utils.productionTargets.summary.invalidate()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setForm(defaultForm); setDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Set Target
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Set Production Target</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Well ID</Label>
                  <Input
                    value={form.wellId}
                    onChange={e => setForm(f => ({ ...f, wellId: e.target.value }))}
                    placeholder="e.g. WELL-001"
                  />
                </div>
                <div>
                  <Label>Target Date</Label>
                  <Input
                    type="date"
                    value={form.targetDate}
                    onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Oil (bpd)</Label>
                    <Input type="number" min={0} value={form.oilTargetBpd} onChange={e => setForm(f => ({ ...f, oilTargetBpd: +e.target.value }))} />
                  </div>
                  <div>
                    <Label>Gas (MMscfd)</Label>
                    <Input type="number" min={0} step={0.1} value={form.gasTargetMmscfd} onChange={e => setForm(f => ({ ...f, gasTargetMmscfd: +e.target.value }))} />
                  </div>
                  <div>
                    <Label>Water Inj. (bwpd)</Label>
                    <Input type="number" min={0} value={form.waterInjectionBwpd} onChange={e => setForm(f => ({ ...f, waterInjectionBwpd: +e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSubmit} disabled={setTargetMutation.isPending}>
                    Save Target
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Total Oil Target</div>
          <div className="text-2xl font-bold text-foreground">
            {(summary?.totalOilTarget ?? 0).toLocaleString()} bpd
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Total Oil Actual</div>
          <div className="text-2xl font-bold text-foreground">
            {(summary?.totalOilActual ?? 0).toLocaleString()} bpd
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Overall Variance</div>
          <div className={`text-2xl font-bold ${(summary?.variance ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
            {(summary?.variance ?? 0) >= 0 ? "+" : ""}{summary?.variance ?? 0}%
          </div>
          {summary && summary.totalOilTarget > 0 && (
            <Progress
              value={Math.min(100, (summary.totalOilActual / summary.totalOilTarget) * 100)}
              className="mt-2 h-2"
            />
          )}
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">At-Risk Wells</div>
          <div className={`text-2xl font-bold ${atRisk > 0 ? "text-red-500" : "text-green-500"}`}>
            {atRisk}
          </div>
          {atRisk > 0 && (
            <div className="flex items-center gap-1 mt-1 text-xs text-red-400">
              <AlertTriangle className="w-3 h-3" /> Below 90% attainment
            </div>
          )}
        </div>
      </div>

      {/* Wells Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-foreground">Today's Production vs Targets</h2>
          <span className="text-xs text-muted-foreground">{today}</span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : wells.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No active wells found. Targets are set per well per day.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Well</TableHead>
                <TableHead>Field</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Oil Actual (bpd)</TableHead>
                <TableHead>Oil Target (bpd)</TableHead>
                <TableHead>Variance</TableHead>
                <TableHead>Gas Actual</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wells.map((w: {
                well_id: string;
                name: string;
                field: string;
                status: string;
                actual_oil_bpd: number;
                oil_target_bpd: number;
                actual_gas_mmscfd: number;
                gas_target_mmscfd: number;
              }) => {
                const attainment = w.oil_target_bpd > 0
                  ? (w.actual_oil_bpd / w.oil_target_bpd) * 100
                  : 0;
                return (
                  <TableRow key={w.well_id}>
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell>{w.field}</TableCell>
                    <TableCell>
                      <Badge variant={w.status === "active" ? "default" : "secondary"} className="capitalize">
                        {w.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{Number(w.actual_oil_bpd).toLocaleString()}</TableCell>
                    <TableCell>{Number(w.oil_target_bpd).toLocaleString()}</TableCell>
                    <TableCell>{getVarianceBadge(w.actual_oil_bpd, w.oil_target_bpd)}</TableCell>
                    <TableCell>{Number(w.actual_gas_mmscfd).toFixed(2)} MMscfd</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openSetTarget(w.well_id)}>
                          <Target className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setHistoryWellId(historyWellId === w.well_id ? null : w.well_id)}
                        >
                          <History className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => deleteMutation.mutate({ wellId: w.well_id, targetDate: today })}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* History Panel */}
      {historyWellId && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-foreground">
              30-Day Variance History — {historyWellId}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setHistoryWellId(null)}>✕</Button>
          </div>
          {history.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">No historical targets found for this well.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Target (bpd)</TableHead>
                  <TableHead>Actual (bpd)</TableHead>
                  <TableHead>Variance (bpd)</TableHead>
                  <TableHead>Variance %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h: {
                  target_date: string;
                  oil_target_bpd: number;
                  actual_oil_bpd: number;
                  variance_bpd: number;
                  variance_pct: number;
                }) => (
                  <TableRow key={h.target_date}>
                    <TableCell>{h.target_date}</TableCell>
                    <TableCell>{Number(h.oil_target_bpd).toLocaleString()}</TableCell>
                    <TableCell>{Number(h.actual_oil_bpd).toLocaleString()}</TableCell>
                    <TableCell className={Number(h.variance_bpd) >= 0 ? "text-green-500" : "text-red-500"}>
                      {Number(h.variance_bpd) >= 0 ? "+" : ""}{Number(h.variance_bpd).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {Number(h.variance_pct) >= 0
                          ? <TrendingUp className="w-3 h-3 text-green-500" />
                          : <TrendingDown className="w-3 h-3 text-red-500" />
                        }
                        {Number(h.variance_pct) >= 0 ? "+" : ""}{Number(h.variance_pct).toFixed(1)}%
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}
