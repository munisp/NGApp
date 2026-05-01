import React from "react";
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Search, Plus, ExternalLink, AlertTriangle, CheckCircle, XCircle, Clock, Building2, RefreshCw , Trash2 } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  expired: "bg-red-500/20 text-red-300 border-red-500/30",
  suspended: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  revoked: "bg-red-700/20 text-red-400 border-red-700/30",
  pending: "bg-blue-500/20 text-blue-300 border-blue-500/30",
};

const TYPE_LABELS: Record<string, string> = {
  law_firm: "Law Firm",
  it_provider: "IT Provider",
  audit_firm: "Audit Firm",
  consultancy: "Consultancy",
  other: "Other",
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function DpcoRegistry() {
  // toast from sonner
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [state, setState] = useState("all");
  const [type, setType] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "", licenceNumber: "", licenceDate: "", licenceExpiresAt: "",
    status: "pending", organisationType: "consultancy", email: "", phone: "",
    website: "", state: "", address: "", ndpcReference: "", cacNumber: "",
  });

  const { data, isLoading, refetch } = trpc.dpco.listOrganisations.useQuery({
    search: search || undefined,
    status: status === "all" ? undefined : status,
    state: state === "all" ? undefined : state,
    type: type === "all" ? undefined : type,
    limit: 100,
  });

  const utils = trpc.useUtils();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const deleteMutation = trpc.dpco.deleteOrganisation.useMutation({
    onSuccess: () => { toast.success("DPCO organisation deleted"); setDeleteId(null); utils.dpco.listOrganisations.invalidate().catch(() => {}); },
    onError: (err: any) => toast.error(err.message || "Failed to delete"),
  });
  const upsert = trpc.dpco.upsertOrganisation.useMutation({
    onSuccess: () => { toast.success("DPCO saved"); setShowAdd(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  const nigerianStates = [
    "ABIA","ADAMAWA","AKWA IBOM","ANAMBRA","BAUCHI","BAYELSA","BENUE","BORNO","CROSS RIVER",
    "DELTA","EBONYI","EDO","EKITI","ENUGU","FCT","FEDERAL CAPITAL TERRITORY","GOMBE","IMO",
    "JIGAWA","KADUNA","KANO","KATSINA","KEBBI","KOGI","KWARA","LAGOS","NASARAWA","NIGER",
    "OGUN","ONDO","OSUN","OYO","PLATEAU","RIVERS","SOKOTO","TARABA","YOBE","ZAMFARA","ABUJA",
  ];

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-cyan-300 font-mono">DPCO Licence Registry</h1>
          <p className="text-slate-400 text-sm mt-1">
            Data Protection Compliance Organisations licensed under NDPA 2023 §33 &mdash; NDPC Repository
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="border-slate-600 text-slate-300">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white">
                <Plus className="w-4 h-4 mr-2" /> Register DPCO
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-cyan-300">Register New DPCO</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 mt-4">
                {[
                  { label: "Organisation Name *", key: "name", col: 2 },
                  { label: "Licence Number", key: "licenceNumber" },
                  { label: "NDPC Reference", key: "ndpcReference" },
                  { label: "Licence Date", key: "licenceDate", type: "date" },
                  { label: "Licence Expires", key: "licenceExpiresAt", type: "date" },
                  { label: "Email", key: "email", type: "email" },
                  { label: "Phone", key: "phone" },
                  { label: "Website", key: "website" },
                  { label: "CAC Number", key: "cacNumber" },
                  { label: "Address", key: "address", col: 2 },
                ].map(({ label, key, type: t, col }) => (
                  <div key={key} className={col === 2 ? "col-span-2" : ""}>
                    <Label className="text-slate-300 text-xs">{label}</Label>
                    <Input
                      type={t ?? "text"}
                      value={(form as any)[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      className="bg-slate-800 border-slate-600 text-slate-200 mt-1"
                    />
                  </div>
                ))}
                <div>
                  <Label className="text-slate-300 text-xs">Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-200 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {["active","pending","suspended","expired","revoked"].map(s => (
                        <SelectItem key={s} value={s} className="text-slate-200">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">Organisation Type</Label>
                  <Select value={form.organisationType} onValueChange={v => setForm(f => ({ ...f, organisationType: v }))}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-200 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {Object.entries(TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k} className="text-slate-200">{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">State</Label>
                  <Select value={form.state} onValueChange={v => setForm(f => ({ ...f, state: v }))}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-200 mt-1">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 max-h-48">
                      {nigerianStates.map(s => (
                        <SelectItem key={s} value={s} className="text-slate-200">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowAdd(false)} className="border-slate-600 text-slate-300">Cancel</Button>
                <Button
                  className="bg-cyan-600 hover:bg-cyan-700 text-white"
                  onClick={() => upsert.mutate(form as any)}
                  disabled={!form.name || upsert.isPending}
                >
                  {upsert.isPending ? "Saving..." : "Register DPCO"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Licensed", value: total, icon: Building2, color: "text-cyan-300" },
          { label: "Active", value: rows.filter((r: any) => r.status === "active").length, icon: CheckCircle, color: "text-emerald-400" },
          { label: "Expired", value: rows.filter((r: any) => r.status === "expired").length, icon: XCircle, color: "text-red-400" },
          { label: "Expiring <90d", value: rows.filter((r: any) => { const d = daysUntil(r.licence_expires_at); return d !== null && d >= 0 && d <= 90; }).length, icon: AlertTriangle, color: "text-yellow-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 flex items-center gap-3">
            <Icon className={`w-8 h-8 ${color}`} />
            <div>
              <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
              <div className="text-slate-400 text-xs">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by name, email, licence number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-slate-800 border-slate-600 text-slate-200"
          />
        </div>
        {[
          { label: "Status", value: status, onChange: setStatus, options: [["all","All Status"],["active","Active"],["expired","Expired"],["suspended","Suspended"],["pending","Pending"],["revoked","Revoked"]] },
          { label: "Type", value: type, onChange: setType, options: [["all","All Types"],...Object.entries(TYPE_LABELS)] },
          { label: "State", value: state, onChange: setState, options: [["all","All States"],["LAGOS","Lagos"],["FEDERAL CAPITAL TERRITORY","FCT"],["RIVERS","Rivers"],["OYO","Oyo"],["KANO","Kano"]] },
        ].map(({ label, value, onChange, options }) => (
          <Select key={label} value={value} onValueChange={onChange}>
            <SelectTrigger className="w-40 bg-slate-800 border-slate-600 text-slate-200">
              <SelectValue placeholder={label} />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {options.map(([v, l]) => (
                <SelectItem key={v} value={v} className="text-slate-200">{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>

      {/* Table */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/50">
                {["Licence No.", "Organisation", "Type", "State", "Email", "Licence Expires", "Clients", "Status", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-slate-400 font-mono text-xs font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-500">Loading DPCO registry...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-500">No DPCOs found matching filters</td></tr>
              ) : rows.map((dpco: any) => {
                const days = daysUntil(dpco.licence_expires_at);
                const expiring = days !== null && days >= 0 && days <= 90;
                return (
                  <tr key={dpco.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-cyan-400 text-xs">{dpco.licence_number ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="text-slate-200 font-medium text-xs">{dpco.name}</div>
                      {dpco.ndpc_reference && <div className="text-slate-500 text-xs">NDPC: {dpco.ndpc_reference}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{TYPE_LABELS[dpco.organisation_type] ?? dpco.organisation_type}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{dpco.state ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{dpco.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className={`text-xs ${expiring ? "text-yellow-400" : "text-slate-400"}`}>
                        {dpco.licence_expires_at ? new Date(dpco.licence_expires_at).toLocaleDateString() : "—"}
                      </div>
                      {expiring && <div className="text-yellow-500 text-xs flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{days}d left</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs font-mono">{dpco.active_clients ?? 0}</td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs border ${STATUS_COLORS[dpco.status] ?? "bg-slate-700 text-slate-300"}`}>
                        {dpco.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 flex items-center gap-2">
                      {dpco.website && (
                        <a href={dpco.website} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-cyan-400">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <Button size="sm" variant="outline" className="text-xs border-red-800 text-red-400 hover:bg-red-900/30 h-7 w-7 p-0" onClick={() => setDeleteId(dpco.id)}><Trash2 className="w-3 h-3" /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-700 text-slate-500 text-xs">
          Showing {rows.length} of {total} registered DPCOs &mdash; Source: NDPC DPCO Repository (services.ndpc.gov.ng)
        </div>
      </div>
    <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
      <AlertDialogContent className="bg-slate-900 border-slate-700 text-slate-200">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete DPCO Organisation</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-400">This will permanently delete this DPCO organisation from the registry. This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-slate-600 text-slate-300">Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })} disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </div>
  );
}
