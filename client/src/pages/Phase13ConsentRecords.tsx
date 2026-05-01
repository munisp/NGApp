import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ShieldCheck, Plus, Search, XCircle } from "lucide-react";

type LegalBasis = "consent" | "contract" | "legal_obligation" | "vital_interests" | "public_task" | "legitimate_interests";

export default function Phase13ConsentRecords() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [legalBasisFilter, setLegalBasisFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    data_subject_id: "", data_subject_email: "",
    org_id: "", purpose: "", legal_basis: "consent" as LegalBasis,
  });

  const utils = trpc.useUtils();
  const { data: result, isLoading } = trpc.phase13.consentRecords.list.useQuery({
    search: search || undefined,
    status: statusFilter || undefined,
    legal_basis: legalBasisFilter || undefined,
  });
  const { data: stats } = trpc.phase13.consentRecords.getStats.useQuery();
  const create = trpc.phase13.consentRecords.create.useMutation({
    onSuccess: () => {
      utils.phase13.consentRecords.list.invalidate();
      utils.phase13.consentRecords.getStats.invalidate();
      setOpen(false);
      toast.success("Consent record created");
      setForm({ data_subject_id: "", data_subject_email: "", org_id: "", purpose: "", legal_basis: "consent" });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const withdraw = trpc.phase13.consentRecords.withdraw.useMutation({
    onSuccess: () => {
      utils.phase13.consentRecords.list.invalidate();
      utils.phase13.consentRecords.getStats.invalidate();
      toast.success("Consent withdrawn");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const records = (result as any)?.records ?? (Array.isArray(result) ? result : []);
  const statsData = stats as any;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-green-600" />
              Consent Records
            </h1>
            <p className="text-muted-foreground mt-1">NDPA-compliant data subject consent management</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Consent</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Record New Consent</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <Input placeholder="Data Subject ID (e.g. NIN/BVN)" value={form.data_subject_id} onChange={e => setForm(f => ({ ...f, data_subject_id: e.target.value }))} />
                <Input type="email" placeholder="Email Address (optional)" value={form.data_subject_email} onChange={e => setForm(f => ({ ...f, data_subject_email: e.target.value }))} />
                <Input placeholder="Purpose of Processing" value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} />
                <Select value={form.legal_basis} onValueChange={v => setForm(f => ({ ...f, legal_basis: v as LegalBasis }))}>
                  <SelectTrigger><SelectValue placeholder="Legal Basis" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consent">Explicit Consent</SelectItem>
                    <SelectItem value="contract">Contract Performance</SelectItem>
                    <SelectItem value="legal_obligation">Legal Obligation</SelectItem>
                    <SelectItem value="vital_interests">Vital Interests</SelectItem>
                    <SelectItem value="public_task">Public Task</SelectItem>
                    <SelectItem value="legitimate_interests">Legitimate Interests</SelectItem>
                  </SelectContent>
                </Select>
                <Button className="w-full"
                  onClick={() => create.mutate({
                    data_subject_id: form.data_subject_id,
                    data_subject_email: form.data_subject_email || undefined,
                    purpose: form.purpose,
                    legal_basis: form.legal_basis,
                    org_id: form.org_id ? Number(form.org_id) : undefined,
                  })}
                  disabled={create.isPending || !form.data_subject_id || !form.purpose}>
                  {create.isPending ? "Saving..." : "Record Consent"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Total Records", value: statsData?.total ?? "—", color: "text-blue-600" },
            { label: "Active Consents", value: statsData?.active ?? "—", color: "text-green-600" },
            { label: "Withdrawn", value: statsData?.withdrawn ?? "—", color: "text-red-600" },
            { label: "With Third Party", value: statsData?.with_third_party ?? "—", color: "text-orange-600" },
          ].map((card) => (
            <Card key={card.label}>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by email or purpose..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All Statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="withdrawn">Withdrawn</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
          <Select value={legalBasisFilter} onValueChange={setLegalBasisFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All Legal Bases" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              <SelectItem value="consent">Consent</SelectItem>
              <SelectItem value="contract">Contract</SelectItem>
              <SelectItem value="legal_obligation">Legal Obligation</SelectItem>
              <SelectItem value="legitimate_interests">Legitimate Interests</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader><CardTitle>Consent Records ({records.length})</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading consent records...</div>
            ) : records.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No consent records found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Subject ID</th>
                      <th className="text-left py-2 px-3">Email</th>
                      <th className="text-left py-2 px-3">Purpose</th>
                      <th className="text-left py-2 px-3">Legal Basis</th>
                      <th className="text-left py-2 px-3">Status</th>
                      <th className="text-left py-2 px-3">Third Party</th>
                      <th className="text-left py-2 px-3">Created</th>
                      <th className="text-left py-2 px-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r: any) => (
                      <tr key={r.id} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-3 font-mono text-xs">{r.data_subject_id}</td>
                        <td className="py-2 px-3 text-muted-foreground">{r.data_subject_email ?? "—"}</td>
                        <td className="py-2 px-3 max-w-[150px] truncate">{r.purpose}</td>
                        <td className="py-2 px-3">{r.legal_basis?.replace(/_/g, " ")}</td>
                        <td className="py-2 px-3">
                          <Badge variant={r.status === "active" ? "default" : r.status === "withdrawn" ? "destructive" : "secondary"}>
                            {r.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-3">{r.third_party_sharing ? "Yes" : "No"}</td>
                        <td className="py-2 px-3 text-muted-foreground">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</td>
                        <td className="py-2 px-3">
                          {r.status === "active" && (
                            <Button size="sm" variant="ghost" title="Withdraw Consent" onClick={() => withdraw.mutate({ id: r.id })}>
                              <XCircle className="h-3 w-3 text-red-600" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
