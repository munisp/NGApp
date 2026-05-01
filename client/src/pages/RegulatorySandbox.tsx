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
import { FlaskConical, Plus, Clock, CheckCircle, XCircle, Lightbulb } from "lucide-react";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400",
  approved: "bg-green-500/20 text-green-400",
  active: "bg-blue-500/20 text-blue-400",
  completed: "bg-slate-500/20 text-slate-400",
  rejected: "bg-red-500/20 text-red-400",
};

const EMPTY_FORM = {
  projectName: "",
  description: "",
  dataCategories: "",
  proposedDuration: 6,
  technicalApproach: "",
  benefitStatement: "",
};

export default function RegulatorySandbox() {
  const [showApply, setShowApply] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: applications, refetch } = trpc.phase12.regulatorySandbox.list.useQuery();

  const apply = trpc.phase12.regulatorySandbox.submitApplication.useMutation({
    onSuccess: () => { refetch(); setShowApply(false); setForm(EMPTY_FORM); toast.success("Application submitted"); },
    onError: (e: any) => toast.error(e.message),
  });
  const review = trpc.phase12.regulatorySandbox.review.useMutation({
    onSuccess: () => { refetch(); toast.success("Application reviewed"); },
  });

  const activeCount = applications?.filter(a => a.status === "active").length ?? 0;
  const pendingCount = applications?.filter(a => a.status === "pending").length ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-purple-400" /> Regulatory Sandbox
          </h1>
          <p className="text-slate-400 text-sm mt-1">NDPC Innovation Sandbox — Test novel data processing approaches with regulatory exemptions</p>
        </div>
        <Button onClick={() => setShowApply(true)} className="bg-purple-600 hover:bg-purple-700">
          <Plus className="w-4 h-4 mr-2" /> Apply for Sandbox
        </Button>
      </div>

      {/* Info */}
      <Card className="bg-purple-900/20 border-purple-700/40">
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-6 text-sm">
            <div>
              <p className="text-purple-300 font-medium mb-1">What is the Regulatory Sandbox?</p>
              <p className="text-slate-400">A controlled environment where organisations can test innovative data processing technologies with temporary exemptions from certain NDPA provisions, under NDPC supervision.</p>
            </div>
            <div>
              <p className="text-purple-300 font-medium mb-1">Eligibility</p>
              <p className="text-slate-400">Registered Nigerian entities with novel fintech, healthtech, or AI solutions that require temporary derogations from data minimisation or purpose limitation principles.</p>
            </div>
            <div>
              <p className="text-purple-300 font-medium mb-1">Duration & Conditions</p>
              <p className="text-slate-400">Up to 12 months. Monthly reporting to NDPC. Full NDPA compliance required after sandbox period. Participant data must be pseudonymised.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-blue-900/20 border-blue-700/40">
          <CardContent className="p-4">
            <p className="text-blue-400 text-xs">Active Sandboxes</p>
            <p className="text-2xl font-bold text-blue-300">{activeCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-900/20 border-yellow-700/40">
          <CardContent className="p-4">
            <p className="text-yellow-400 text-xs">Pending Review</p>
            <p className="text-2xl font-bold text-yellow-300">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <p className="text-slate-400 text-xs">Total Applications</p>
            <p className="text-2xl font-bold text-white">{applications?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-900/20 border-green-700/40">
          <CardContent className="p-4">
            <p className="text-green-400 text-xs">Completed</p>
            <p className="text-2xl font-bold text-green-300">
              {applications?.filter(a => a.status === "completed").length ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader><CardTitle className="text-white text-base">Sandbox Applications</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700">
                <TableHead className="text-slate-400">Project</TableHead>
                <TableHead className="text-slate-400">Organisation</TableHead>
                <TableHead className="text-slate-400">Duration</TableHead>
                <TableHead className="text-slate-400">Start Date</TableHead>
                <TableHead className="text-slate-400">End Date</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications?.map(a => (
                <TableRow key={a.id} className="border-slate-700">
                  <TableCell>
                    <p className="text-white font-medium text-sm">{a.project_name}</p>
                    <p className="text-slate-500 text-xs line-clamp-1">{a.description}</p>
                  </TableCell>
                  <TableCell className="text-slate-400 text-sm">{a.org_name ?? "—"}</TableCell>
                  <TableCell className="text-slate-400">{a.proposed_duration_months}m</TableCell>
                  <TableCell className="text-slate-400 text-xs">
                    {a.start_date ? new Date(a.start_date).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-slate-400 text-xs">
                    {a.end_date ? new Date(a.end_date).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell><Badge className={statusColors[a.status ?? "pending"]}>{a.status}</Badge></TableCell>
                  <TableCell>
                    {a.status === "pending" && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-green-400"
                          onClick={() => review.mutate({ id: a.id, status: 'approved', conditions: [] })}>
                          <CheckCircle className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-red-400"
                          onClick={() => review.mutate({ id: a.id, status: 'rejected', conditions: [] })}>
                          <XCircle className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showApply} onOpenChange={setShowApply}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
          <DialogHeader><DialogTitle>Apply for Regulatory Sandbox</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300 text-sm">Project Name</Label>
              <Input className="mt-1 bg-slate-700 border-slate-600 text-white" value={form.projectName}
                onChange={e => setForm(f => ({ ...f, projectName: e.target.value }))} />
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Description</Label>
              <Textarea className="mt-1 bg-slate-700 border-slate-600 text-white" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Data Categories (comma-separated)</Label>
              <Input className="mt-1 bg-slate-700 border-slate-600 text-white" value={form.dataCategories}
                placeholder="e.g. health_data, financial_data"
                onChange={e => setForm(f => ({ ...f, dataCategories: e.target.value }))} />
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Proposed Duration (months, max 12)</Label>
              <Input type="number" min={1} max={12} className="mt-1 bg-slate-700 border-slate-600 text-white"
                value={form.proposedDuration}
                onChange={e => setForm(f => ({ ...f, proposedDuration: parseInt(e.target.value) || 6 }))} />
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Benefit Statement</Label>
              <Textarea className="mt-1 bg-slate-700 border-slate-600 text-white" value={form.benefitStatement}
                placeholder="How will this benefit Nigerian citizens?"
                onChange={e => setForm(f => ({ ...f, benefitStatement: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-600 text-slate-300" onClick={() => setShowApply(false)}>Cancel</Button>
            <Button className="bg-purple-600 hover:bg-purple-700"
              disabled={!form.projectName || !form.description || apply.isPending}
              onClick={() => apply.mutate({
                projectTitle: form.projectName,
                projectDescription: form.description,
                innovationType: 'govtech' as const,
                dataTypesInvolved: form.dataCategories.split(",").map(s => s.trim()).filter(Boolean),
                proposedDuration: form.proposedDuration,
              })}>
              Submit Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
