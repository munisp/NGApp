/**
 * Admin DPCO Registrations Queue
 * ================================
 * Platform owner reviews pending DPCO applications, approves or rejects them.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  RefreshCw,
  Search,
  Shield,
} from "lucide-react";

type StatusFilter = "pending" | "active" | "suspended" | "revoked" | "all";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  active: "bg-green-500/20 text-green-300 border-green-500/40",
  suspended: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  revoked: "bg-red-500/20 text-red-300 border-red-500/40",
};

export default function AdminRegistrations() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [search, setSearch] = useState("");
  const [selectedOrg, setSelectedOrg] = useState<any | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [approveForm, setApproveForm] = useState({ licenceNumber: "", licenceDate: "", licenceExpiresAt: "" });
  const [rejectReason, setRejectReason] = useState("");

  const utils = trpc.useUtils();

  const { data, isLoading, refetch } = trpc.dpco.listPendingRegistrations.useQuery({
    status: statusFilter,
    limit: 100,
    offset: 0,
  });

  const approveMutation = trpc.dpco.approveRegistration.useMutation({
    onSuccess: (res) => {
      toast.success(`Approved — Licence ${res.licenceNumber} issued`);
      setApproveOpen(false);
      setSelectedOrg(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const rejectMutation = trpc.dpco.rejectRegistration.useMutation({
    onSuccess: () => {
      toast.success("Application rejected");
      setRejectOpen(false);
      setSelectedOrg(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const rows = (data?.rows ?? []).filter((r: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.name?.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q) ||
      r.cac_number?.toLowerCase().includes(q) ||
      r.licence_number?.toLowerCase().includes(q)
    );
  });

  const pendingCount = (data?.rows ?? []).filter((r: any) => r.status === "pending").length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-cyan-400" />
            DPCO Registration Queue
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Review and process DPCO accreditation applications
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1">
              {pendingCount} Pending
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            className="border-slate-600 text-slate-300"
            onClick={() => refetch()}
          >
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, CAC..."
            className="pl-9 bg-slate-800/60 border-slate-600 text-white"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-40 bg-slate-800/60 border-slate-600 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-600">
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="revoked">Rejected</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-[#0d1220] border border-slate-700/50 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/40">
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Organisation</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Contact</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">State</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">CAC</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Submitted</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-500">Loading applications...</td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-500">
                  No {statusFilter === "all" ? "" : statusFilter} applications found
                </td>
              </tr>
            )}
            {rows.map((org: any) => (
              <tr key={org.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{org.name}</div>
                  <div className="text-xs text-slate-500 font-mono">{org.licence_number}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-slate-300">
                    <Mail className="w-3 h-3 text-slate-500" />
                    <span className="text-xs">{org.email}</span>
                  </div>
                  {org.phone && (
                    <div className="flex items-center gap-1 text-slate-400 mt-0.5">
                      <Phone className="w-3 h-3 text-slate-500" />
                      <span className="text-xs">{org.phone}</span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-slate-300 text-xs">
                    <MapPin className="w-3 h-3 text-slate-500" />
                    {org.state ?? "—"}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs font-mono text-slate-400">{org.cac_number ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge
                    className={`text-xs border ${STATUS_COLORS[org.status] ?? "bg-slate-700 text-slate-300"}`}
                  >
                    {org.status === "pending" && <Clock className="w-3 h-3 mr-1" />}
                    {org.status === "active" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                    {org.status === "revoked" && <XCircle className="w-3 h-3 mr-1" />}
                    {org.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {org.created_at ? new Date(org.created_at).toLocaleDateString("en-NG") : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 hover:text-white h-7 px-2 text-xs"
                      onClick={() => setSelectedOrg(org)}
                    >
                      <FileText className="w-3.5 h-3.5 mr-1" /> View
                    </Button>
                    {org.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          className="bg-green-600/80 hover:bg-green-600 text-white h-7 px-2 text-xs"
                          onClick={() => {
                            setSelectedOrg(org);
                            setApproveOpen(true);
                          }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500/40 text-red-400 hover:bg-red-500/10 h-7 px-2 text-xs"
                          onClick={() => {
                            setSelectedOrg(org);
                            setRejectOpen(true);
                          }}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && (
          <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-500">
            Showing {rows.length} of {data.total} records
          </div>
        )}
      </div>

      {/* View Detail Dialog */}
      {selectedOrg && !approveOpen && !rejectOpen && (
        <Dialog open={!!selectedOrg} onOpenChange={() => setSelectedOrg(null)}>
          <DialogContent className="bg-[#0d1220] border-slate-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-cyan-300 flex items-center gap-2">
                <Building2 className="w-5 h-5" /> {selectedOrg.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              {[
                ["Licence Ref", selectedOrg.licence_number],
                ["Type", selectedOrg.organisation_type],
                ["Email", selectedOrg.email],
                ["Phone", selectedOrg.phone],
                ["State", selectedOrg.state],
                ["Address", selectedOrg.address],
                ["CAC Number", selectedOrg.cac_number],
                ["NDPC Reference", selectedOrg.ndpc_reference ?? "—"],
                ["Staff Count", selectedOrg.staff_count ?? "—"],
                ["Services", Array.isArray(selectedOrg.services)
                  ? selectedOrg.services.join(", ")
                  : (typeof selectedOrg.services === "string"
                    ? JSON.parse(selectedOrg.services).join(", ")
                    : "—")],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <span className="text-slate-500 w-32 shrink-0">{k}:</span>
                  <span className="text-slate-200">{v}</span>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="ghost" className="text-slate-400" onClick={() => setSelectedOrg(null)}>
                Close
              </Button>
              {selectedOrg.status === "pending" && (
                <>
                  <Button
                    className="bg-green-600/80 hover:bg-green-600 text-white"
                    onClick={() => { setApproveOpen(true); }}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="border-red-500/40 text-red-400"
                    onClick={() => { setRejectOpen(true); }}
                  >
                    Reject
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Approve Dialog */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="bg-[#0d1220] border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-green-300 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> Approve Registration
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-slate-400">
              Approving <span className="text-white font-medium">{selectedOrg?.name}</span>.
              A formal licence number will be issued.
            </p>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Licence Number (auto-generated if blank)</Label>
              <Input
                value={approveForm.licenceNumber}
                onChange={(e) => setApproveForm((f) => ({ ...f, licenceNumber: e.target.value }))}
                placeholder="e.g. NDPC-DPCO-2026-00123"
                className="bg-slate-800/60 border-slate-600 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300">Issue Date</Label>
                <Input
                  type="date"
                  value={approveForm.licenceDate}
                  onChange={(e) => setApproveForm((f) => ({ ...f, licenceDate: e.target.value }))}
                  className="bg-slate-800/60 border-slate-600 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">Expiry Date</Label>
                <Input
                  type="date"
                  value={approveForm.licenceExpiresAt}
                  onChange={(e) => setApproveForm((f) => ({ ...f, licenceExpiresAt: e.target.value }))}
                  className="bg-slate-800/60 border-slate-600 text-white"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="text-slate-400" onClick={() => setApproveOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-500 text-white"
              disabled={approveMutation.isPending}
              onClick={() => {
                if (!selectedOrg) return;
                approveMutation.mutate({
                  id: selectedOrg.id,
                  licenceNumber: approveForm.licenceNumber || undefined,
                  licenceDate: approveForm.licenceDate || undefined,
                  licenceExpiresAt: approveForm.licenceExpiresAt || undefined,
                });
              }}
            >
              {approveMutation.isPending ? "Approving..." : "Confirm Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="bg-[#0d1220] border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-300 flex items-center gap-2">
              <XCircle className="w-5 h-5" /> Reject Application
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-slate-400">
              Rejecting <span className="text-white font-medium">{selectedOrg?.name}</span>.
              Please provide a reason.
            </p>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Reason for Rejection *</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Insufficient documentation, CAC number unverifiable..."
                rows={3}
                className="bg-slate-800/60 border-slate-600 text-white resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="text-slate-400" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              className="border-red-500/40 text-red-400 hover:bg-red-500/10"
              disabled={rejectMutation.isPending || rejectReason.trim().length < 10}
              onClick={() => {
                if (!selectedOrg) return;
                rejectMutation.mutate({ id: selectedOrg.id, reason: rejectReason });
              }}
            >
              {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
