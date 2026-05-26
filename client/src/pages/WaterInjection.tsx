import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Droplets, Target, RefreshCw, Plus, TrendingUp, TrendingDown } from "lucide-react";

const defaultForm = { wellId: "", targetBwpd: 0, maxPressurePsi: 3000, targetVoidageReplacement: 1.0 };

export default function WaterInjectionPage() {
  const [form, setForm] = useState(defaultForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const { data: injectionWells = [], isLoading } = trpc.waterInjection.injectionWells.useQuery();
  const { data: efficiency } = trpc.waterInjection.patternEfficiency.useQuery(
    { field: selectedField! }, { enabled: !!selectedField }
  );

  const setTargetMutation = trpc.waterInjection.setInjectionTarget.useMutation({
    onSuccess: () => {
      toast.success("Injection target updated.");
      utils.waterInjection.injectionWells.invalidate();
      setDialogOpen(false);
      setForm(defaultForm);
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const totalActual = (injectionWells as any[]).reduce((s, w) => s + Number(w.actual_bwpd || 0), 0);
  const totalTarget = (injectionWells as any[]).reduce((s, w) => s + Number(w.target_bwpd || 0), 0);
  const fields = Array.from(new Set((injectionWells as any[]).map((w: any) => w.field).filter(Boolean)));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Droplets className="w-6 h-6 text-blue-400" /> Water Injection Optimization
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Monitor injection wells, pattern efficiency, and voidage replacement ratio
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => utils.waterInjection.injectionWells.invalidate()}>
            <RefreshCw className="w-4 h-4 mr-2" />Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Set Target</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Set Injection Target</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Well ID</Label>
                  <Input value={form.wellId} onChange={e => setForm(f => ({ ...f, wellId: e.target.value }))} placeholder="INJ-001" />
                </div>
                <div>
                  <Label>Target Rate (bwpd)</Label>
                  <Input type="number" min={0} value={form.targetBwpd} onChange={e => setForm(f => ({ ...f, targetBwpd: +e.target.value }))} />
                </div>
                <div>
                  <Label>Max Pressure (psi)</Label>
                  <Input type="number" min={0} value={form.maxPressurePsi} onChange={e => setForm(f => ({ ...f, maxPressurePsi: +e.target.value }))} />
                </div>
                <div>
                  <Label>Target VRR (0.8–1.2)</Label>
                  <Input type="number" min={0} max={2} step={0.05} value={form.targetVoidageReplacement} onChange={e => setForm(f => ({ ...f, targetVoidageReplacement: +e.target.value }))} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => {
                      if (!form.wellId) { toast.error("Well ID required"); return; }
                      setTargetMutation.mutate(form);
                    }}
                    disabled={setTargetMutation.isPending}
                  >Save</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Total Injection</div>
          <div className="text-2xl font-bold text-blue-400">{totalActual.toLocaleString()} bwpd</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Target Rate</div>
          <div className="text-2xl font-bold">{totalTarget.toLocaleString()} bwpd</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Active Injectors</div>
          <div className="text-2xl font-bold">
            {(injectionWells as any[]).filter((w: any) => w.status === "INJECTING").length} / {injectionWells.length}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border font-semibold">Injection Wells</div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : injectionWells.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No injection wells found.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Well</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actual (bwpd)</TableHead>
                <TableHead>Target (bwpd)</TableHead>
                <TableHead>Pressure (psi)</TableHead>
                <TableHead>VRR</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(injectionWells as any[]).map((w: any) => {
                const vrr = Number(w.voidage_replacement_ratio || 0);
                const ok = vrr >= 0.9 && vrr <= 1.1;
                return (
                  <TableRow key={w.well_id}>
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell>
                      <Badge variant={w.status === "INJECTING" ? "default" : "secondary"}>{w.status}</Badge>
                    </TableCell>
                    <TableCell>{Number(w.actual_bwpd).toLocaleString()}</TableCell>
                    <TableCell>{Number(w.target_bwpd).toLocaleString()}</TableCell>
                    <TableCell>{Number(w.injection_pressure_psi).toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {ok ? <TrendingUp className="w-3 h-3 text-green-500" /> : <TrendingDown className="w-3 h-3 text-red-500" />}
                        <span className={ok ? "text-green-500" : "text-red-500"}>{vrr.toFixed(2)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setForm({ ...defaultForm, wellId: w.well_id }); setDialogOpen(true); }}>
                          <Target className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedField(selectedField === w.field ? null : w.field)}>
                          {selectedField === w.field ? "▲" : "▼"}
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

      {fields.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground self-center">Field efficiency:</span>
          {fields.map(f => (
            <Button key={f} variant={selectedField === f ? "default" : "outline"} size="sm" onClick={() => setSelectedField(selectedField === f ? null : f)}>{f}</Button>
          ))}
        </div>
      )}
      {selectedField && efficiency && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="font-semibold mb-3">Pattern Efficiency — {selectedField}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(
              [
                ["Sweep Efficiency", `${(Number((efficiency as any).sweep_efficiency || 0) * 100).toFixed(1)}%`],
                ["Water Cut", `${(Number((efficiency as any).water_cut || 0) * 100).toFixed(1)}%`],
                ["Pattern VRR", Number((efficiency as any).pattern_vrr || 0).toFixed(2)],
                ["Injectivity Index", `${Number((efficiency as any).injectivity_index || 0).toFixed(1)} bwpd/psi`],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label}>
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="text-lg font-bold">{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
