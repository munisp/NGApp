import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, RefreshCw, Plus, CheckCircle, XCircle, Clock } from "lucide-react";

const TEST_TYPES = ["PRODUCTION", "PRESSURE_BUILDUP", "INJECTIVITY", "FALLOFF", "INTERFERENCE", "TRACER"] as const;
const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "secondary",
  IN_PROGRESS: "default",
  COMPLETED: "outline",
  CANCELLED: "destructive",
};

interface ScheduleForm {
  wellId: string;
  testType: typeof TEST_TYPES[number];
  scheduledAt: string;
  durationHours: number;
  assignedTo: string;
  notes: string;
}

const defaultForm: ScheduleForm = {
  wellId: "",
  testType: "PRODUCTION",
  scheduledAt: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
  durationHours: 24,
  assignedTo: "",
  notes: "",
};

export default function WellTestsPage() {
  const [form, setForm] = useState<ScheduleForm>(defaultForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const utils = trpc.useUtils();

  const { data: tests = [], isLoading } = trpc.wellTests.list.useQuery({
    status: filterStatus !== "all" ? filterStatus as any : undefined,
    limit: 100,
  });

  const scheduleMutation = trpc.wellTests.schedule.useMutation({
    onSuccess: () => {
      toast.success("Well test scheduled.");
      utils.wellTests.list.invalidate();
      setDialogOpen(false);
      setForm(defaultForm);
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const updateResultMutation = trpc.wellTests.updateResult.useMutation({
    onSuccess: () => { toast.success("Test status updated."); utils.wellTests.list.invalidate(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const deleteMutation = trpc.wellTests.delete.useMutation({
    onSuccess: () => { toast.success("Test deleted."); utils.wellTests.list.invalidate(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const statusCounts = {
    SCHEDULED: (tests as any[]).filter((t: any) => t.status === "SCHEDULED").length,
    IN_PROGRESS: (tests as any[]).filter((t: any) => t.status === "IN_PROGRESS").length,
    COMPLETED: (tests as any[]).filter((t: any) => t.status === "COMPLETED").length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-purple-400" /> Well Test Scheduling
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Schedule, track, and record production, injection, and pressure transient tests
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => utils.wellTests.list.invalidate()}>
            <RefreshCw className="w-4 h-4 mr-2" />Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Schedule Test</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Schedule Well Test</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Well ID</Label>
                  <Input value={form.wellId} onChange={e => setForm(f => ({ ...f, wellId: e.target.value }))} placeholder="WELL-001" />
                </div>
                <div>
                  <Label>Test Type</Label>
                  <Select value={form.testType} onValueChange={v => setForm(f => ({ ...f, testType: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TEST_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Scheduled At</Label>
                  <Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
                </div>
                <div>
                  <Label>Duration (hours)</Label>
                  <Input type="number" min={1} max={720} value={form.durationHours} onChange={e => setForm(f => ({ ...f, durationHours: +e.target.value }))} />
                </div>
                <div>
                  <Label>Assigned To</Label>
                  <Input value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} placeholder="Engineer name" />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => {
                      if (!form.wellId) { toast.error("Well ID required"); return; }
                      scheduleMutation.mutate({ wellId: form.wellId, testType: form.testType, scheduledAt: new Date(form.scheduledAt).toISOString(), durationHours: form.durationHours, assignedTo: form.assignedTo || undefined, notes: form.notes || undefined });
                    }}
                    disabled={scheduleMutation.isPending}
                  >Schedule</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Scheduled", count: statusCounts.SCHEDULED, icon: <Clock className="w-4 h-4 text-yellow-400" />, color: "text-yellow-400" },
          { label: "In Progress", count: statusCounts.IN_PROGRESS, icon: <FlaskConical className="w-4 h-4 text-blue-400" />, color: "text-blue-400" },
          { label: "Completed", count: statusCounts.COMPLETED, icon: <CheckCircle className="w-4 h-4 text-green-400" />, color: "text-green-400" },
        ].map(kpi => (
          <div key={kpi.label} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">{kpi.icon}{kpi.label}</div>
            <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.count}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {["all", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map(s => (
          <Button
            key={s}
            variant={filterStatus === s ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterStatus(s)}
          >
            {s === "all" ? "All" : s.replace("_", " ")}
          </Button>
        ))}
      </div>

      {/* Tests Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border font-semibold">Well Tests</div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : (tests as any[]).length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No well tests found.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Well</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(tests as any[]).map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.well_id}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{t.test_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={(STATUS_COLORS[t.status] as any) || "secondary"}>{t.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.scheduled_at ? new Date(t.scheduled_at).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell>{t.duration_hours}h</TableCell>
                  <TableCell>{t.assigned_to || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {t.status === "SCHEDULED" && (
                        <Button variant="ghost" size="sm" onClick={() => updateResultMutation.mutate({ testId: t.test_id, status: "COMPLETED" })} title="Mark complete">
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        </Button>
                      )}
                      {["SCHEDULED", "IN_PROGRESS"].includes(t.status) && (
                        <Button variant="ghost" size="sm" onClick={() => updateResultMutation.mutate({ testId: t.test_id, status: "CANCELLED" })} title="Cancel">
                          <XCircle className="w-3 h-3 text-red-500" />
                        </Button>
                      )}
                      {["COMPLETED", "CANCELLED"].includes(t.status) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm("Delete this test record?")) deleteMutation.mutate({ testId: t.test_id });
                          }}
                          title="Delete"
                        >
                          <XCircle className="w-3 h-3 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
