import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileSearch, Plus, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const riskColors: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400",
  high: "bg-orange-500/20 text-orange-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  low: "bg-green-500/20 text-green-400",
};

const statusColors: Record<string, string> = {
  draft: "bg-slate-500/20 text-slate-400",
  in_progress: "bg-blue-500/20 text-blue-400",
  review: "bg-yellow-500/20 text-yellow-400",
  approved: "bg-green-500/20 text-green-400",
  rejected: "bg-red-500/20 text-red-400",
};

const EMPTY_FORM = {
  title: "",
  processingActivity: "",
  dataCategories: "",
  processingPurpose: "",
  riskLevel: "medium",
};

export default function PrivacyImpactAssessment() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: pias, refetch } = trpc.phase12.pia.list.useQuery({});

  const create = trpc.phase12.pia.create.useMutation({
    onSuccess: () => { refetch(); setShowCreate(false); setForm(EMPTY_FORM); toast.success("PIA created"); },
    onError: (e: any) => toast.error(e.message),
  });
  const approve = trpc.phase12.pia.approve.useMutation({
    onSuccess: () => { refetch(); toast.success("PIA approved"); },
  });

  const totalCount = pias?.length ?? 0;
  const highRiskCount = pias?.filter((p: any) => p.risk_level === "high" || p.risk_level === "critical").length ?? 0;
  const pendingCount = pias?.filter((p: any) => p.status === "review" || p.status === "in_progress").length ?? 0;
  const approvedCount = pias?.filter((p: any) => p.status === "approved").length ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileSearch className="w-6 h-6 text-amber-400" /> Privacy Impact Assessments
          </h1>
          <p className="text-slate-400 text-sm mt-1">DPIA/PIA under NDPA Section 30 — Mandatory for high-risk processing activities</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-amber-600 hover:bg-amber-700">
          <Plus className="w-4 h-4 mr-2" /> New PIA
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <p className="text-slate-400 text-xs">Total PIAs</p>
            <p className="text-2xl font-bold text-white">{totalCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-red-900/20 border-red-700/40">
          <CardContent className="p-4">
            <p className="text-red-400 text-xs">High/Critical Risk</p>
            <p className="text-2xl font-bold text-red-300">{highRiskCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-900/20 border-yellow-700/40">
          <CardContent className="p-4">
            <p className="text-yellow-400 text-xs">Pending Review</p>
            <p className="text-2xl font-bold text-yellow-300">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-900/20 border-green-700/40">
          <CardContent className="p-4">
            <p className="text-green-400 text-xs">Approved</p>
            <p className="text-2xl font-bold text-green-300">{approvedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* PIAs Table */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader><CardTitle className="text-white text-base">PIA Registry</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700">
                <TableHead className="text-slate-400">Reference</TableHead>
                <TableHead className="text-slate-400">Title</TableHead>
                <TableHead className="text-slate-400">Organisation</TableHead>
                <TableHead className="text-slate-400">Processing Purpose</TableHead>
                <TableHead className="text-slate-400">Risk Level</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pias?.map((p: any) => (
                <TableRow key={p.id} className="border-slate-700">
                  <TableCell className="text-white font-mono text-xs">{p.pia_ref}</TableCell>
                  <TableCell className="text-slate-300 text-sm max-w-[200px]">
                    <p className="truncate">{p.project_name}</p>
                  </TableCell>
                  <TableCell className="text-slate-400 text-sm">{p.org_name ?? "—"}</TableCell>
                  <TableCell className="text-slate-400 text-sm max-w-[150px]">
                    <p className="truncate">{p.processing_purpose}</p>
                  </TableCell>
                  <TableCell>
                    <Badge className={riskColors[p.risk_level ?? "medium"] ?? ""}>{p.risk_level}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[p.status ?? "draft"] ?? ""}>{String(p.status ?? "").replace(/_/g, " ")}</Badge>
                  </TableCell>
                  <TableCell>
                    {(p.status === "review" || p.status === "in_progress") && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-green-400"
                        onClick={() => approve.mutate({ id: p.id, status: "approved" as const })}>
                        <CheckCircle className="w-3 h-3" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
          <DialogHeader><DialogTitle>New Privacy Impact Assessment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300 text-sm">PIA Title</Label>
              <Input className="mt-1 bg-slate-700 border-slate-600 text-white" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Processing Activity</Label>
              <Input className="mt-1 bg-slate-700 border-slate-600 text-white" value={form.processingActivity}
                placeholder="e.g. Customer credit scoring using ML"
                onChange={e => setForm(f => ({ ...f, processingActivity: e.target.value }))} />
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Data Categories</Label>
              <Input className="mt-1 bg-slate-700 border-slate-600 text-white" value={form.dataCategories}
                placeholder="e.g. financial_data, biometric_data"
                onChange={e => setForm(f => ({ ...f, dataCategories: e.target.value }))} />
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Processing Purpose</Label>
              <Textarea className="mt-1 bg-slate-700 border-slate-600 text-white" value={form.processingPurpose}
                onChange={e => setForm(f => ({ ...f, processingPurpose: e.target.value }))} />
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Initial Risk Level</Label>
              <Select value={form.riskLevel} onValueChange={v => setForm(f => ({ ...f, riskLevel: v }))}>
                <SelectTrigger className="mt-1 bg-slate-700 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-600 text-slate-300" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button className="bg-amber-600 hover:bg-amber-700"
              disabled={!form.title || !form.processingActivity || create.isPending}
              onClick={() => create.mutate({
                projectName: form.title,
                processingPurpose: form.processingPurpose || form.processingActivity,
              })}>
              Create PIA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
