import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CreditCard, Plus, DollarSign, AlertCircle, CheckCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400",
  paid: "bg-green-500/20 text-green-400",
  overdue: "bg-red-500/20 text-red-400",
  waived: "bg-slate-500/20 text-slate-400",
  appealing: "bg-blue-500/20 text-blue-400",
};

const EMPTY_FORM = {
  orgId: "",
  violationType: "data_breach",
  fineAmountNgn: 10000000,
  description: "",
  ndpcRef: "",
};

export default function FinePayments() {
  const [showIssue, setShowIssue] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: fines, refetch } = trpc.phase12.fines.listFines.useQuery({});
  const { data: stats } = trpc.phase12.fines.getStats.useQuery();
  const { data: orgs } = trpc.organizations.list.useQuery({ limit: 100 });

  const issueFine = trpc.phase12.fines.issueFine.useMutation({
    onSuccess: () => { refetch(); setShowIssue(false); setForm(EMPTY_FORM); toast.success("Fine issued"); },
    onError: (e: any) => toast.error(e.message),
  });
  const initiatePayment = trpc.phase12.fines.initiatePayment.useMutation({
    onSuccess: (data: any) => {
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank");
        toast.success("Redirecting to payment portal...");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });
  const waiveFine = trpc.phase12.fines.waiveFine.useMutation({
    onSuccess: () => { refetch(); toast.success("Fine waived"); },
  });

  const formatNGN = (amount: number) =>
    new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-emerald-400" /> NDPA Fine Payments
          </h1>
          <p className="text-slate-400 text-sm mt-1">Regulatory fines under NDPA Section 48 — Max ₦10M or 2% of annual turnover</p>
        </div>
        <Button onClick={() => setShowIssue(true)} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" /> Issue Fine
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <p className="text-slate-400 text-xs">Total Fines Issued</p>
            <p className="text-2xl font-bold text-white">{stats?.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-red-900/20 border-red-700/40">
          <CardContent className="p-4">
            <p className="text-red-400 text-xs">Total Outstanding</p>
            <p className="text-lg font-bold text-red-300">{formatNGN(stats?.totalOutstanding ?? 0)}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-900/20 border-green-700/40">
          <CardContent className="p-4">
            <p className="text-green-400 text-xs">Total Collected</p>
            <p className="text-lg font-bold text-green-300">{formatNGN(stats?.totalCollected ?? 0)}</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-900/20 border-yellow-700/40">
          <CardContent className="p-4">
            <p className="text-yellow-400 text-xs">Overdue</p>
            <p className="text-2xl font-bold text-yellow-300">{stats?.overdue ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Fines Table */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader><CardTitle className="text-white text-base">Fine Register</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700">
                <TableHead className="text-slate-400">Fine Ref</TableHead>
                <TableHead className="text-slate-400">Organisation</TableHead>
                <TableHead className="text-slate-400">Violation</TableHead>
                <TableHead className="text-slate-400">Amount</TableHead>
                <TableHead className="text-slate-400">NDPC Ref</TableHead>
                <TableHead className="text-slate-400">Due Date</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fines?.map((f: any) => (
                <TableRow key={f.id} className="border-slate-700">
                  <TableCell className="text-white font-mono text-xs">{f.fine_ref}</TableCell>
                  <TableCell className="text-slate-300 text-sm">{f.org_name ?? `Org #${f.org_id}`}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-slate-600 text-slate-400 capitalize text-xs">
                      {String(f.violation_type ?? "").replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-white font-medium">{formatNGN(f.fine_amount_ngn ?? 0)}</TableCell>
                  <TableCell className="text-slate-400 text-xs font-mono">{f.ndpc_ref ?? "—"}</TableCell>
                  <TableCell className="text-slate-400 text-xs">
                    {f.due_date ? new Date(f.due_date).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[f.payment_status ?? "pending"] ?? ""}>{f.payment_status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {f.payment_status === "pending" || f.payment_status === "overdue" ? (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-400"
                          title="Pay online"
                          onClick={() => initiatePayment.mutate({ fineId: f.id })}>
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      ) : null}
                      {f.payment_status === "pending" && (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-slate-400"
                          title="Waive fine"
                          onClick={() => waiveFine.mutate({ fineId: f.id, reason: "Regulatory discretion" })}>
                          <CheckCircle className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Issue Fine Dialog */}
      <Dialog open={showIssue} onOpenChange={setShowIssue}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
          <DialogHeader><DialogTitle>Issue NDPA Fine</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300 text-sm">Organisation</Label>
              <Select value={form.orgId} onValueChange={v => setForm(f => ({ ...f, orgId: v }))}>
                <SelectTrigger className="mt-1 bg-slate-700 border-slate-600 text-white"><SelectValue placeholder="Select organisation" /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {orgs?.map((o: any) => (
                    <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Violation Type</Label>
              <Select value={form.violationType} onValueChange={v => setForm(f => ({ ...f, violationType: v }))}>
                <SelectTrigger className="mt-1 bg-slate-700 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="data_breach">Data Breach (Section 40)</SelectItem>
                  <SelectItem value="unlawful_processing">Unlawful Processing (Section 25)</SelectItem>
                  <SelectItem value="cross_border_violation">Cross-Border Violation (Section 43)</SelectItem>
                  <SelectItem value="consent_violation">Consent Violation (Section 26)</SelectItem>
                  <SelectItem value="dpo_failure">DPO Failure (Section 32)</SelectItem>
                  <SelectItem value="dpia_failure">DPIA Failure (Section 30)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Fine Amount (₦)</Label>
              <Input type="number" className="mt-1 bg-slate-700 border-slate-600 text-white"
                value={form.fineAmountNgn}
                onChange={e => setForm(f => ({ ...f, fineAmountNgn: parseInt(e.target.value) || 0 }))} />
              <p className="text-slate-500 text-xs mt-1">Max: ₦10,000,000 or 2% of annual turnover</p>
            </div>
            <div>
              <Label className="text-slate-300 text-sm">NDPC Decision Reference</Label>
              <Input className="mt-1 bg-slate-700 border-slate-600 text-white font-mono" value={form.ndpcRef}
                placeholder="NDPC/DEC/2026/XXXX"
                onChange={e => setForm(f => ({ ...f, ndpcRef: e.target.value }))} />
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Description</Label>
              <Input className="mt-1 bg-slate-700 border-slate-600 text-white" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-600 text-slate-300" onClick={() => setShowIssue(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!form.orgId || !form.fineAmountNgn || issueFine.isPending}
              onClick={() => issueFine.mutate({
                orgId: parseInt(form.orgId),
                violationType: form.violationType as any,
                fineAmountNgn: form.fineAmountNgn,
                description: form.description,
                ndpcRef: form.ndpcRef || undefined,
              })}>
              Issue Fine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
