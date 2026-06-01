import { useTranslation } from 'react-i18next';
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useRole } from "@/hooks/usePermission";
import { SignaturePad } from "@/components/SignaturePad";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Flame,
  Lock,
  Plus,
  Shield,
  ShieldAlert,
  User,
  Wind,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PermitType = "HOT_WORK" | "CONFINED_SPACE" | "ELECTRICAL" | "COLD_WORK" | "EXCAVATION" | "WORKING_AT_HEIGHT" | "RADIATION";
type PermitStatus = "DRAFT" | "PENDING" | "APPROVED" | "ACTIVE" | "EXPIRED" | "CLOSED" | "CANCELLED";
type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

// ─── Config maps ──────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<PermitType, { label: string; icon: LucideIcon; color: string }> = {
  HOT_WORK:             { label: "Hot Work",             icon: Flame,       color: "text-red-400" },
  CONFINED_SPACE:       { label: "Confined Space",       icon: Wind,        color: "text-orange-400" },
  ELECTRICAL:           { label: "Electrical Isolation", icon: Zap,         color: "text-yellow-400" },
  COLD_WORK:            { label: "Cold Work",            icon: Shield,      color: "text-blue-400" },
  EXCAVATION:           { label: "Excavation",           icon: AlertTriangle, color: "text-amber-400" },
  WORKING_AT_HEIGHT:    { label: "Working at Height",    icon: AlertTriangle, color: "text-purple-400" },
  RADIATION:            { label: "Radiation",            icon: ShieldAlert, color: "text-pink-400" },
};

const STATUS_CONFIG: Record<PermitStatus, { label: string; color: string; bg: string }> = {
  DRAFT:            { label: "Draft",            color: "text-gray-400",   bg: "bg-gray-400/10" },
  PENDING:          { label: "Pending Approval", color: "text-yellow-400", bg: "bg-yellow-400/10" },
  APPROVED:         { label: "Approved",         color: "text-blue-400",   bg: "bg-blue-400/10" },
  ACTIVE:           { label: "Active",           color: "text-green-400",  bg: "bg-green-400/10" },
  EXPIRED:          { label: "Expired",          color: "text-orange-400", bg: "bg-orange-400/10" },
  CLOSED:           { label: "Closed",           color: "text-gray-500",   bg: "bg-gray-500/10" },
  CANCELLED:        { label: "Cancelled",        color: "text-red-400",    bg: "bg-red-400/10" },
};

const RISK_CONFIG: Record<RiskLevel, { color: string; bg: string }> = {
  LOW:      { color: "text-green-400",  bg: "bg-green-400/10" },
  MEDIUM:   { color: "text-yellow-400", bg: "bg-yellow-400/10" },
  HIGH:     { color: "text-orange-400", bg: "bg-orange-400/10" },
  CRITICAL: { color: "text-red-400",    bg: "bg-red-400/10" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function PermitCard({ permit, onSelect }: { permit: any; onSelect: (p: any) => void }) {
  const typeConf = TYPE_CONFIG[permit.type as PermitType];
  const statusConf = STATUS_CONFIG[permit.status as PermitStatus];
  const riskConf = RISK_CONFIG[permit.riskLevel as RiskLevel];
  const Icon = typeConf.icon;

  return (
    <div
      className="bg-gray-900 border border-gray-700 rounded-lg p-4 hover:border-amber-500/50 cursor-pointer transition-all"
      onClick={() => onSelect(permit)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`mt-0.5 ${typeConf.color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-gray-500">{permit.permitNumber}</span>
              {permit.sisImpacted && (
                <Badge className="bg-red-900/50 text-red-300 border-red-700 text-[10px]">SIS IMPACTED</Badge>
              )}
            </div>
            <p className="text-sm font-medium text-gray-100 mt-1 truncate">{permit.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">{permit.wellName} — {permit.location}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusConf.bg} ${statusConf.color}`}>
            {statusConf.label}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${riskConf.bg} ${riskConf.color}`}>
            {permit.riskLevel}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><User className="w-3 h-3" />{permit.requestedBy}</span>
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(permit.requestedAt).toLocaleDateString()}</span>
        {permit.isolations.length > 0 && (
          <span className="flex items-center gap-1"><Lock className="w-3 h-3" />{permit.isolations.length} isolations</span>
        )}
      </div>
    </div>
  );
}

function PermitDetail({ permit, onClose }: { permit: any; onClose: () => void }) {
  const [comment, setComment] = useState("");
  const [sigPad, setSigPad] = useState<{ open: boolean; role: "issuer" | "approver" } | null>(null);
  const utils = trpc.useUtils();
  const { isOperator, isAdmin } = useRole();

  const saveSignatureMutation = trpc.permitToWork.saveSignature.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.role === "issuer" ? "Issuer" : "Approver"} signature saved.`);
      utils.permitToWork.list.invalidate();
      setSigPad(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const approveMutation = trpc.permitToWork.approve.useMutation({
    onSuccess: () => { toast.success("Permit approved"); utils.permitToWork.list.invalidate(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const retrainMutation = trpc.openstef.triggerRetrain.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`OpenSTEF retrain complete — MAE: ${data.mae?.toFixed(1)} kW`);
      } else {
        toast.info("OpenSTEF retrain queued (service starting up)");
      }
    },
    onError: () => toast.info("OpenSTEF retrain will run on next service start"),
  });
  const closeMutation = trpc.permitToWork.close.useMutation({
    onSuccess: () => {
      toast.success("Permit closed");
      utils.permitToWork.list.invalidate();
      // Automatically trigger OpenSTEF model retrain for the well's power tag
      // so the DR baseline reflects the post-maintenance operating envelope.
      if (permit.wellId) {
        retrainMutation.mutate({
          tag: `WELL_${permit.wellId}_POWER_KW`,
          reason: "ptw_closed",
          ptwId: permit.id,
          workType: permit.type,
        });
      }
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const commentMutation = trpc.permitToWork.addComment.useMutation({
    onSuccess: () => { toast.success("Comment added"); setComment(""); utils.permitToWork.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const typeConf = TYPE_CONFIG[permit.type as PermitType];
  const statusConf = STATUS_CONFIG[permit.status as PermitStatus];
  const Icon = typeConf.icon;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-gray-800 ${typeConf.color}`}><Icon className="w-5 h-5" /></div>
          <div>
            <p className="font-mono text-xs text-gray-500">{permit.permitNumber}</p>
            <h3 className="text-base font-semibold text-gray-100">{permit.title}</h3>
          </div>
        </div>
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusConf.bg} ${statusConf.color}`}>
          {statusConf.label}
        </span>
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        {[
          { label: "Well", value: permit.wellName },
          { label: "Location", value: permit.location },
          { label: "Risk Level", value: permit.riskLevel },
          { label: "Requested By", value: permit.requestedBy },
          { label: "Valid From", value: permit.validFrom ? new Date(permit.validFrom).toLocaleString() : "—" },
          { label: "Valid Until", value: permit.validUntil ? new Date(permit.validUntil).toLocaleString() : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-900 rounded-lg p-3 border border-gray-700">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-gray-200 font-medium">{value}</p>
          </div>
        ))}
      </div>

      {/* Description */}
      <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
        <p className="text-xs text-gray-500 mb-1">Description</p>
        <p className="text-sm text-gray-300">{permit.description}</p>
      </div>

      {/* Isolations */}
      {permit.isolations.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Isolations ({permit.isolations.length})</p>
          <div className="space-y-2">
            {permit.isolations.map((iso: any) => (
              <div key={iso.id} className="flex items-center justify-between bg-gray-900 rounded-lg p-3 border border-gray-700">
                <div>
                  <span className="font-mono text-xs text-amber-400">{iso.tag}</span>
                  <p className="text-sm text-gray-300">{iso.description}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-0.5 rounded font-mono ${iso.position.includes("LOCKED") ? "bg-red-900/40 text-red-300" : "bg-green-900/40 text-green-300"}`}>
                    {iso.position.replace("_", " ")}
                  </span>
                  {iso.isolatedBy && <p className="text-xs text-gray-500 mt-1">{iso.isolatedBy}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hazards & Precautions */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Hazards</p>
          <div className="space-y-1">
            {permit.hazards.map((h: string) => (
              <div key={h} className="flex items-center gap-2 text-xs text-red-300">
                <AlertTriangle className="w-3 h-3 shrink-0" />{h}
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Precautions</p>
          <div className="space-y-1">
            {permit.precautions.map((p: string) => (
              <div key={p} className="flex items-center gap-2 text-xs text-green-300">
                <CheckCircle className="w-3 h-3 shrink-0" />{p}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gas test */}
      {permit.gasTestRequired && (
        <div className={`rounded-lg p-3 border ${permit.gasTestResult ? "bg-green-900/20 border-green-700" : "bg-yellow-900/20 border-yellow-700"}`}>
          <p className="text-xs font-medium mb-1 ${permit.gasTestResult ? 'text-green-400' : 'text-yellow-400'}">
            Gas Test {permit.gasTestResult ? "✓ Completed" : "⚠ Required"}
          </p>
          {permit.gasTestResult && (
            <p className="text-sm text-gray-300">{permit.gasTestResult} — by {permit.gasTestedBy}</p>
          )}
        </div>
      )}

      {/* SIS / MOC refs */}
      {(permit.sisImpacted || permit.mocRef) && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-3">
          <p className="text-xs text-red-400 font-medium mb-1">Safety System Impact</p>
          {permit.sifBypassRef && <p className="text-xs text-gray-300">SIF Bypass: <span className="font-mono text-red-300">{permit.sifBypassRef}</span></p>}
          {permit.mocRef && <p className="text-xs text-gray-300 mt-0.5">MOC Ref: <span className="font-mono text-amber-300">{permit.mocRef}</span></p>}
        </div>
      )}

      {/* Comments */}
      {permit.comments.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Activity Log</p>
          <div className="space-y-2">
            {permit.comments.map((c: any) => (
              <div key={c.id} className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-300">{c.author}</span>
                  <span className="text-xs text-gray-500">{new Date(c.timestamp).toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-400">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signatures */}
      <div className="border-t border-gray-700 pt-4">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Digital Signatures</p>
        <div className="grid grid-cols-2 gap-3">
          {[{ role: "issuer" as const, label: "Permit Issuer" }, { role: "approver" as const, label: "Approving Authority" }].map(({ role, label }) => {
            const sigUrl = role === "issuer" ? (permit as any).issuerSignatureUrl : (permit as any).approverSignatureUrl;
            const sigBy = role === "issuer" ? (permit as any).issuerSignedBy : (permit as any).approverSignedBy;
            return (
              <div key={role} className="bg-gray-900 border border-gray-700 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">{label}</p>
                {sigUrl ? (
                  <div className="space-y-1">
                    <img src={sigUrl} alt={`${label} signature`} className="w-full h-12 object-contain bg-white rounded" />
                    <p className="text-[10px] text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" />{sigBy}</p>
                  </div>
                ) : (
                  <button
                    onClick={() => setSigPad({ open: true, role })}
                    className="w-full h-12 border border-dashed border-gray-600 rounded flex items-center justify-center text-xs text-gray-500 hover:border-amber-500/50 hover:text-amber-400 transition-colors"
                  >
                    + Sign
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {sigPad && (
        <SignaturePad
          open={sigPad.open}
          onClose={() => setSigPad(null)}
          role={sigPad.role}
          permitNumber={permit.permitNumber}
          onSigned={(url, name) => saveSignatureMutation.mutate({ id: permit.id, role: sigPad.role, signatureUrl: url, signedBy: name })}
          isLoading={saveSignatureMutation.isPending}
        />
      )}

      {/* Actions */}
      {["PENDING", "ACTIVE", "APPROVED"].includes(permit.status) && (
        <div className="border-t border-gray-700 pt-4 space-y-3">
          <div className="flex gap-2">
            {permit.status === "PENDING" && (
              <Button
                size="sm"
                className="bg-green-700 hover:bg-green-600 text-white"
                onClick={() => approveMutation.mutate({ id: permit.id, approvedBy: "J. Rodriguez", comment: "Approved via dashboard." })}
                disabled={approveMutation.isPending || !isOperator}
              >
                <CheckCircle className="w-4 h-4 mr-1" />Approve Permit
              </Button>
            )}
            {["ACTIVE", "APPROVED"].includes(permit.status) && (
              <Button
                size="sm"
                variant="outline"
                className="border-red-700 text-red-400 hover:bg-red-900/30"
                onClick={() => closeMutation.mutate({ id: permit.id, closedBy: "J. Rodriguez", comment: "Closed via dashboard." })}
                disabled={closeMutation.isPending}
              >
                Close Permit
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Textarea
              placeholder="Add a comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="bg-gray-900 border-gray-700 text-gray-200 text-sm resize-none h-16"
            />
            <Button
              size="sm"
              variant="outline"
              className="border-amber-600 text-amber-400 hover:bg-amber-900/30 self-end"
              onClick={() => comment.trim() && commentMutation.mutate({ id: permit.id, author: "J. Rodriguez", text: comment })}
              disabled={!comment.trim() || commentMutation.isPending}
            >
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── New Permit Dialog ────────────────────────────────────────────────────────

function NewPermitDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    type: "HOT_WORK" as PermitType,
    title: "",
    wellId: "well-01",
    wellName: "Permian Basin #01",
    location: "",
    description: "",
    riskLevel: "MEDIUM" as RiskLevel,
    requestedBy: "J. Rodriguez",
    hazards: [] as string[],
    precautions: [] as string[],
    gasTestRequired: false,
    sisImpacted: false,
  });
  const [hazardInput, setHazardInput] = useState("");
  const [precautionInput, setPrecautionInput] = useState("");

  const createMutation = trpc.permitToWork.create.useMutation({
    onSuccess: () => {
      toast.success("Permit created and submitted for approval");
      setOpen(false);
      onCreated();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-amber-600 hover:bg-amber-500 text-white">
          <Plus className="w-4 h-4 mr-2" />New Permit
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gray-900 border-gray-700 text-gray-100 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-100">Create Permit to Work</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-400 text-xs">Permit Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as PermitType })}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-200 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-gray-200">{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Risk Level</Label>
              <Select value={form.riskLevel} onValueChange={(v) => setForm({ ...form, riskLevel: v as RiskLevel })}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-200 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((r) => (
                    <SelectItem key={r} value={r} className="text-gray-200">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-gray-400 text-xs">Permit Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="bg-gray-800 border-gray-700 text-gray-200 mt-1" placeholder="Brief description of work..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-400 text-xs">Well Name</Label>
              <Input value={form.wellName} onChange={(e) => setForm({ ...form, wellName: e.target.value })}
                className="bg-gray-800 border-gray-700 text-gray-200 mt-1" />
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Location</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="bg-gray-800 border-gray-700 text-gray-200 mt-1" placeholder="Platform, zone, equipment tag..." />
            </div>
          </div>

          <div>
            <Label className="text-gray-400 text-xs">Description of Work</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="bg-gray-800 border-gray-700 text-gray-200 mt-1 resize-none h-20" />
          </div>

          <div>
            <Label className="text-gray-400 text-xs">Hazards</Label>
            <div className="flex gap-2 mt-1">
              <Input value={hazardInput} onChange={(e) => setHazardInput(e.target.value)}
                className="bg-gray-800 border-gray-700 text-gray-200" placeholder="Add hazard..." />
              <Button size="sm" variant="outline" className="border-gray-600 text-gray-300"
                onClick={() => { if (hazardInput.trim()) { setForm({ ...form, hazards: [...form.hazards, hazardInput.trim()] }); setHazardInput(""); } }}>
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {form.hazards.map((h) => (
                <Badge key={h} className="bg-red-900/40 text-red-300 border-red-700 cursor-pointer"
                  onClick={() => setForm({ ...form, hazards: form.hazards.filter((x) => x !== h) })}>
                  {h} ×
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-gray-400 text-xs">Precautions</Label>
            <div className="flex gap-2 mt-1">
              <Input value={precautionInput} onChange={(e) => setPrecautionInput(e.target.value)}
                className="bg-gray-800 border-gray-700 text-gray-200" placeholder="Add precaution..." />
              <Button size="sm" variant="outline" className="border-gray-600 text-gray-300"
                onClick={() => { if (precautionInput.trim()) { setForm({ ...form, precautions: [...form.precautions, precautionInput.trim()] }); setPrecautionInput(""); } }}>
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {form.precautions.map((p) => (
                <Badge key={p} className="bg-green-900/40 text-green-300 border-green-700 cursor-pointer"
                  onClick={() => setForm({ ...form, precautions: form.precautions.filter((x) => x !== p) })}>
                  {p} ×
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.gasTestRequired} onChange={(e) => setForm({ ...form, gasTestRequired: e.target.checked })}
                className="rounded" />
              <span className="text-sm text-gray-300">Gas Test Required</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.sisImpacted} onChange={(e) => setForm({ ...form, sisImpacted: e.target.checked })}
                className="rounded" />
              <span className="text-sm text-gray-300">SIS Impacted</span>
            </label>
          </div>

          <Button
            className="w-full bg-amber-600 hover:bg-amber-500 text-white"
            onClick={() => createMutation.mutate(form)}
            disabled={!form.title || !form.location || !form.description || createMutation.isPending}
          >
            {createMutation.isPending ? "Submitting…" : "Submit for Approval"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PermitToWorkPage() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedPermit, setSelectedPermit] = useState<any>(null);
  const utils = trpc.useUtils();

  const { data: stats } = trpc.permitToWork.stats.useQuery();
  const { data: permits, isLoading } = trpc.permitToWork.list.useQuery({
    status: statusFilter as any,
  });

  const statCards = [
    { label: "Active Permits", value: stats?.active ?? 0, color: "text-green-400", icon: CheckCircle },
    { label: "Pending Approval", value: stats?.pendingApproval ?? 0, color: "text-yellow-400", icon: Clock },
    { label: "High/Critical Risk", value: stats?.highRisk ?? 0, color: "text-red-400", icon: AlertTriangle },
    { label: "SIS Impacted", value: stats?.sisImpacted ?? 0, color: "text-orange-400", icon: ShieldAlert },
  ];

  return (
    <div className="p-6 space-y-6 bg-gray-950 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100" style={{ fontFamily: "Syne, sans-serif" }}>
            {t('ptw.title')}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Hot work, confined space, electrical isolation, and safety-critical work authorizations
          </p>
        </div>
        <NewPermitDialog onCreated={() => utils.permitToWork.list.invalidate()} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, color, icon: Icon }) => (
          <Card key={label} className="bg-gray-900 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className={`text-3xl font-bold font-mono mt-1 ${color}`}>{value}</p>
                </div>
                <Icon className={`w-8 h-8 opacity-30 ${color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Permit list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {["ALL", "ACTIVE", "PENDING", "APPROVED", "CLOSED"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-3 py-1.5 rounded-full transition-all ${
                  statusFilter === s
                    ? "bg-amber-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {s === "ALL" ? "All" : STATUS_CONFIG[s as PermitStatus]?.label ?? s}
                {s !== "ALL" && stats && (
                  <span className="ml-1 opacity-70">
                    ({s === "ACTIVE" ? stats.active : s === "PENDING" ? stats.pendingApproval : s === "APPROVED" ? stats.approved : stats.closed})
                  </span>
                )}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-gray-900 border border-gray-700 rounded-lg p-4 animate-pulse h-24" />
              ))}
            </div>
          ) : (permits ?? []).length === 0 ? (
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 text-center">
              <FileText className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No permits found for this filter.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(permits ?? []).map((p) => (
                <PermitCard key={p.id} permit={p} onSelect={setSelectedPermit} />
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-1">
          {selectedPermit ? (
            <Card className="bg-gray-900 border-gray-700 sticky top-6">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm text-gray-300">Permit Detail</CardTitle>
                <button onClick={() => setSelectedPermit(null)} className="text-gray-500 hover:text-gray-300 text-xs">✕ Close</button>
              </CardHeader>
              <CardContent className="overflow-y-auto max-h-[calc(100vh-200px)]">
                <PermitDetail permit={selectedPermit} onClose={() => setSelectedPermit(null)} />
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-gray-900 border-gray-700">
              <CardContent className="p-8 text-center">
                <FileText className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Select a permit to view details, approve, or close it.</p>
              </CardContent>
            </Card>
          )}

          {/* Type breakdown */}
          {stats && (
            <Card className="bg-gray-900 border-gray-700 mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-gray-400 uppercase tracking-wider">Permits by Type</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(TYPE_CONFIG).map(([type, conf]) => {
                  const count = stats.byType[type as PermitType] ?? 0;
                  const Icon = conf.icon;
                  return (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-3.5 h-3.5 ${conf.color}`} />
                        <span className="text-xs text-gray-400">{conf.label}</span>
                      </div>
                      <span className="text-xs font-mono text-gray-300">{count}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
