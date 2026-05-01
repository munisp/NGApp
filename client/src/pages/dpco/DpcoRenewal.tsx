import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  RefreshCw, CheckCircle, AlertCircle, Clock, Calendar,
  FileText, ShieldCheck, Award, ExternalLink, ChevronRight
} from "lucide-react";

export default function DpcoRenewal() {
  const [indemnityUrl, setIndemnityUrl] = useState("");
  const [financialsUrl, setFinancialsUrl] = useState("");
  const [methodologyUrl, setMethodologyUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: myLicence } = trpc.accreditation.getMyLicence.useQuery();

  const renewMutation = trpc.accreditation.submitRenewal.useMutation({
    onSuccess: () => {
      toast.success("Renewal application submitted successfully");
      setSubmitted(true);
    },
    onError: (e) => toast.error(`Renewal failed: ${e.message}`),
  });

  const licence = myLicence as any;

  const daysUntilExpiry = licence?.licenceExpiresAt
    ? Math.ceil((new Date(licence.licenceExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const expiryStatus = daysUntilExpiry === null ? "unknown"
    : daysUntilExpiry < 0 ? "expired"
    : daysUntilExpiry <= 30 ? "critical"
    : daysUntilExpiry <= 90 ? "warning"
    : "ok";

  const handleSubmit = () => {
    renewMutation.mutate({
      indemnityInsuranceUrl: indemnityUrl || undefined,
      financialStatementsUrl: financialsUrl || undefined,
      auditMethodologyUrl: methodologyUrl || undefined,
      notes: notes || undefined,
    });
  };

  if (submitted) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 text-center">
          <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-emerald-400" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Renewal Application Submitted</h2>
          <p className="text-slate-400 text-sm">
            Your renewal application has been submitted to the NDPC. You will be notified of the outcome before your current licence expires.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-emerald-400" />
          Licence Renewal
        </h1>
        <p className="text-slate-400 text-sm mt-1">Renew your DPCO accreditation before it expires to maintain uninterrupted audit filing capability.</p>
      </div>

      {/* Current licence status */}
      {licence && (
        <div className={`border rounded-xl p-5 ${
          expiryStatus === "expired" ? "bg-red-500/10 border-red-500/30" :
          expiryStatus === "critical" ? "bg-red-500/10 border-red-500/30" :
          expiryStatus === "warning" ? "bg-amber-500/10 border-amber-500/30" :
          "bg-slate-900 border-slate-700"
        }`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Award className={`w-8 h-8 ${
                expiryStatus === "expired" || expiryStatus === "critical" ? "text-red-400" :
                expiryStatus === "warning" ? "text-amber-400" : "text-emerald-400"
              }`} />
              <div>
                <p className="text-sm font-medium text-white">Current Licence</p>
                <p className="text-lg font-mono font-bold text-emerald-400">{licence.licenceNumber}</p>
              </div>
            </div>
            <div className="text-right">
              <Badge className={`text-xs border ${
                expiryStatus === "expired" ? "bg-red-500/20 text-red-300 border-red-500/30" :
                expiryStatus === "critical" ? "bg-red-500/20 text-red-300 border-red-500/30" :
                expiryStatus === "warning" ? "bg-amber-500/20 text-amber-300 border-amber-500/30" :
                "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
              }`}>
                {expiryStatus === "expired" ? "Expired" :
                 expiryStatus === "critical" ? `Expires in ${daysUntilExpiry} days` :
                 expiryStatus === "warning" ? `Expires in ${daysUntilExpiry} days` :
                 "Active"}
              </Badge>
              <p className="text-xs text-slate-500 mt-1">
                {licence.licenceExpiresAt ? new Date(licence.licenceExpiresAt).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }) : "—"}
              </p>
            </div>
          </div>
          {(expiryStatus === "critical" || expiryStatus === "expired") && (
            <div className="mt-3 pt-3 border-t border-red-500/20 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-300">
                {expiryStatus === "expired"
                  ? "Your licence has expired. You cannot file new CARs until renewal is approved."
                  : "Your licence expires soon. Submit your renewal immediately to avoid disruption."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Renewal timeline */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
        <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" /> Renewal Timeline
        </h3>
        <div className="space-y-3">
          {[
            { label: "Submit renewal application", timing: "90 days before expiry", done: false, active: true },
            { label: "NDPC review (document verification)", timing: "Within 30 working days", done: false, active: false },
            { label: "Competency re-assessment (if required)", timing: "Scheduled by NDPC", done: false, active: false },
            { label: "New licence issued", timing: "Before current expiry", done: false, active: false },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                item.done ? "bg-emerald-500 border-emerald-500" :
                item.active ? "border-emerald-400 bg-emerald-500/10" :
                "border-slate-600 bg-slate-800"
              }`}>
                {item.done ? <CheckCircle className="w-3 h-3 text-white" /> :
                 item.active ? <ChevronRight className="w-3 h-3 text-emerald-400" /> : null}
              </div>
              <div className="flex-1">
                <span className={`text-sm ${item.active ? "text-white font-medium" : "text-slate-400"}`}>{item.label}</span>
              </div>
              <span className="text-xs text-slate-500">{item.timing}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Updated documents */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-400" /> Updated Documents
        </h3>
        <p className="text-xs text-slate-500">Provide updated versions of key documents. If unchanged from your original application, you may leave these blank.</p>
        {[
          { label: "Professional Indemnity Insurance", sublabel: "Current certificate (must be valid for the renewal period)", value: indemnityUrl, setter: setIndemnityUrl },
          { label: "Audited Financial Statements", sublabel: "Most recent year's audited accounts", value: financialsUrl, setter: setFinancialsUrl },
          { label: "Audit Methodology Update", sublabel: "If your methodology has changed since last accreditation", value: methodologyUrl, setter: setMethodologyUrl },
        ].map(doc => (
          <div key={doc.label}>
            <div className="flex items-start justify-between mb-1">
              <div>
                <Label className="text-slate-300 text-sm">{doc.label}</Label>
                <p className="text-xs text-slate-500">{doc.sublabel}</p>
              </div>
              {doc.value && (
                <a href={doc.value} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300 h-6 gap-1 text-xs">
                    <ExternalLink className="w-3 h-3" /> View
                  </Button>
                </a>
              )}
            </div>
            <Input value={doc.value} onChange={e => doc.setter(e.target.value)}
              placeholder="https://..."
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 text-sm" />
          </div>
        ))}
        <div>
          <Label className="text-slate-300 text-sm mb-1 block">Additional Notes</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Any changes to your organisation, key personnel, or audit scope since last accreditation..."
            className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 resize-none text-sm" rows={3} />
        </div>
      </div>

      {/* Fee */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">Renewal Fee</p>
          <p className="text-xs text-slate-500">NDPC annual renewal processing fee</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-white">₦75,000</p>
          <p className="text-xs text-slate-500">Payable on submission</p>
        </div>
      </div>

      <Button onClick={handleSubmit} disabled={renewMutation.isPending}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
        <RefreshCw className="w-4 h-4" />
        {renewMutation.isPending ? "Submitting..." : "Submit Renewal Application"}
      </Button>
    </div>
  );
}
