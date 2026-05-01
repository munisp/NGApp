import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Shield, Search, FileText, Clock, CheckCircle2, AlertCircle, ChevronRight } from "lucide-react";

const REQUEST_TYPES = [
  { value: "access", label: "Access — Request a copy of your personal data" },
  { value: "rectification", label: "Rectification — Correct inaccurate personal data" },
  { value: "erasure", label: "Erasure — Request deletion of your personal data" },
  { value: "portability", label: "Portability — Receive your data in a portable format" },
  { value: "restriction", label: "Restriction — Limit how your data is processed" },
  { value: "objection", label: "Objection — Object to processing of your data" },
  { value: "automated_decision", label: "Automated Decision — Challenge automated decisions" },
];

const STATUS_COLORS: Record<string, string> = {
  submitted: "text-blue-400 bg-blue-900/30",
  acknowledged: "text-yellow-400 bg-yellow-900/30",
  in_progress: "text-purple-400 bg-purple-900/30",
  overdue: "text-red-400 bg-red-900/30",
  resolved: "text-green-400 bg-green-900/30",
  closed: "text-gray-400 bg-gray-800",
};

export default function DsarPublicPortal() {
  const [mode, setMode] = useState<"home" | "submit" | "track" | "success">("home");
  const [form, setForm] = useState({
    requestType: "", citizenName: "", citizenEmail: "", citizenNin: "",
    organizationId: "", description: "", supportingDocUrl: "",
  });
  const [trackForm, setTrackForm] = useState({ referenceNumber: "", citizenEmail: "" });
  const [submitResult, setSubmitResult] = useState<any>(null);
  const [trackResult, setTrackResult] = useState<any>(null);

  const { data: orgs = [] } = trpc.organizations.list.useQuery({ limit: 500 });

  const submitMutation = trpc.dsar.publicSubmit.useMutation({
    onSuccess: (data) => {
      setSubmitResult(data);
      setMode("success");
    },
    onError: (err) => toast.error(err.message),
  });

  const trackQuery = trpc.dsar.publicTrack.useQuery(
    { referenceNumber: trackForm.referenceNumber, citizenEmail: trackForm.citizenEmail },
    { enabled: false, retry: false }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.requestType || !form.citizenName || !form.citizenEmail || !form.description) {
      toast.error("Please fill in all required fields.");
      return;
    }
    submitMutation.mutate({
      requestType: form.requestType as any,
      citizenName: form.citizenName,
      citizenEmail: form.citizenEmail,
      citizenNin: form.citizenNin || undefined,
      organizationId: form.organizationId ? Number(form.organizationId) : undefined,
      description: form.description,
      supportingDocUrl: form.supportingDocUrl || undefined,
    });
  };

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackForm.referenceNumber || !trackForm.citizenEmail) {
      toast.error("Please enter your reference number and email.");
      return;
    }
    const result = await trackQuery.refetch();
    if (result.data) setTrackResult(result.data);
    else if (result.error) toast.error("No request found with those details.");
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <Shield className="w-7 h-7 text-green-400" />
          <div>
            <div className="font-bold text-white text-lg leading-tight">NDSEP Citizen Rights Portal</div>
            <div className="text-xs text-gray-400">National Data Sovereignty Enforcement Platform — NDPA 2023</div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {mode === "home" && (
          <div>
            <div className="text-center mb-10">
              <h1 className="text-3xl font-bold text-white mb-3">Exercise Your Data Rights</h1>
              <p className="text-gray-400 max-w-xl mx-auto">
                Under the Nigeria Data Protection Act 2023, you have the right to access, correct, delete, and port your personal data. Submit a request below — organisations must respond within <strong className="text-white">30 days</strong>.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
              <button
                onClick={() => setMode("submit")}
                className="bg-gray-900 border border-gray-700 hover:border-green-500 rounded-xl p-6 text-left transition-all group"
              >
                <FileText className="w-8 h-8 text-green-400 mb-3" />
                <div className="font-semibold text-white text-lg mb-1">Submit a New Request</div>
                <div className="text-gray-400 text-sm mb-4">File a Data Subject Access Request (DSAR) against any registered organisation.</div>
                <div className="flex items-center text-green-400 text-sm font-medium group-hover:gap-2 transition-all">
                  Get started <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </button>
              <button
                onClick={() => setMode("track")}
                className="bg-gray-900 border border-gray-700 hover:border-blue-500 rounded-xl p-6 text-left transition-all group"
              >
                <Search className="w-8 h-8 text-blue-400 mb-3" />
                <div className="font-semibold text-white text-lg mb-1">Track Existing Request</div>
                <div className="text-gray-400 text-sm mb-4">Check the status of a previously submitted request using your reference number.</div>
                <div className="flex items-center text-blue-400 text-sm font-medium group-hover:gap-2 transition-all">
                  Track now <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </button>
            </div>
            {/* Rights summary */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="font-semibold text-white mb-4">Your Rights Under NDPA 2023</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {REQUEST_TYPES.map((rt) => (
                  <div key={rt.value} className="flex items-start gap-2 text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span>{rt.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {mode === "submit" && (
          <div>
            <button onClick={() => setMode("home")} className="text-gray-400 hover:text-white text-sm mb-6 flex items-center gap-1">
              ← Back
            </button>
            <h2 className="text-2xl font-bold text-white mb-6">Submit a Data Rights Request</h2>
            <form onSubmit={handleSubmit} className="space-y-5 bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div>
                <Label className="text-gray-300 mb-1.5 block">Request Type <span className="text-red-400">*</span></Label>
                <Select value={form.requestType} onValueChange={(v) => setForm(p => ({ ...p, requestType: v }))}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Select your request type..." />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {REQUEST_TYPES.map((rt) => (
                      <SelectItem key={rt.value} value={rt.value} className="text-gray-200 focus:bg-gray-700">{rt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300 mb-1.5 block">Full Name <span className="text-red-400">*</span></Label>
                  <Input value={form.citizenName} onChange={e => setForm(p => ({ ...p, citizenName: e.target.value }))} className="bg-gray-800 border-gray-700 text-white" placeholder="Your full legal name" />
                </div>
                <div>
                  <Label className="text-gray-300 mb-1.5 block">Email Address <span className="text-red-400">*</span></Label>
                  <Input type="email" value={form.citizenEmail} onChange={e => setForm(p => ({ ...p, citizenEmail: e.target.value }))} className="bg-gray-800 border-gray-700 text-white" placeholder="your@email.com" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300 mb-1.5 block">NIN (optional)</Label>
                  <Input value={form.citizenNin} onChange={e => setForm(p => ({ ...p, citizenNin: e.target.value }))} className="bg-gray-800 border-gray-700 text-white" placeholder="National Identification Number" />
                </div>
                <div>
                  <Label className="text-gray-300 mb-1.5 block">Organisation (optional)</Label>
                  <Select value={form.organizationId} onValueChange={(v) => setForm(p => ({ ...p, organizationId: v }))}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue placeholder="Select organisation..." />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700 max-h-60 overflow-y-auto">
                      {(orgs as any[]).map((o: any) => (
                        <SelectItem key={o.id} value={String(o.id)} className="text-gray-200 focus:bg-gray-700">{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-gray-300 mb-1.5 block">Description of Request <span className="text-red-400">*</span></Label>
                <Textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="bg-gray-800 border-gray-700 text-white min-h-[120px]"
                  placeholder="Describe what data you are requesting, what you want corrected, or why you want your data deleted..."
                />
              </div>
              <div>
                <Label className="text-gray-300 mb-1.5 block">Supporting Document URL (optional)</Label>
                <Input value={form.supportingDocUrl} onChange={e => setForm(p => ({ ...p, supportingDocUrl: e.target.value }))} className="bg-gray-800 border-gray-700 text-white" placeholder="https://..." />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" disabled={submitMutation.isPending} className="bg-green-600 hover:bg-green-700 text-white">
                  {submitMutation.isPending ? "Submitting..." : "Submit Request"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setMode("home")} className="border-gray-600 text-gray-300">
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {mode === "success" && submitResult && (
          <div className="text-center py-10">
            <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Request Submitted Successfully</h2>
            <p className="text-gray-400 mb-6">Your data rights request has been registered. Save your reference number to track progress.</p>
            <div className="bg-gray-900 border border-green-700 rounded-xl p-6 max-w-md mx-auto mb-6">
              <div className="text-sm text-gray-400 mb-1">Reference Number</div>
              <div className="text-2xl font-mono font-bold text-green-400">{submitResult.referenceNumber}</div>
              <div className="text-sm text-gray-400 mt-3">Response Deadline</div>
              <div className="text-white font-medium">{new Date(submitResult.responseDeadline).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}</div>
            </div>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => { setMode("track"); setTrackForm({ referenceNumber: submitResult.referenceNumber, citizenEmail: form.citizenEmail }); }} className="bg-blue-600 hover:bg-blue-700">
                Track My Request
              </Button>
              <Button variant="outline" onClick={() => { setMode("home"); setForm({ requestType: "", citizenName: "", citizenEmail: "", citizenNin: "", organizationId: "", description: "", supportingDocUrl: "" }); }} className="border-gray-600 text-gray-300">
                Submit Another
              </Button>
            </div>
          </div>
        )}

        {mode === "track" && (
          <div>
            <button onClick={() => setMode("home")} className="text-gray-400 hover:text-white text-sm mb-6 flex items-center gap-1">
              ← Back
            </button>
            <h2 className="text-2xl font-bold text-white mb-6">Track Your Request</h2>
            <form onSubmit={handleTrack} className="space-y-4 bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
              <div>
                <Label className="text-gray-300 mb-1.5 block">Reference Number</Label>
                <Input value={trackForm.referenceNumber} onChange={e => setTrackForm(p => ({ ...p, referenceNumber: e.target.value }))} className="bg-gray-800 border-gray-700 text-white font-mono" placeholder="NDSEP-CR-000001" />
              </div>
              <div>
                <Label className="text-gray-300 mb-1.5 block">Email Address</Label>
                <Input type="email" value={trackForm.citizenEmail} onChange={e => setTrackForm(p => ({ ...p, citizenEmail: e.target.value }))} className="bg-gray-800 border-gray-700 text-white" placeholder="your@email.com" />
              </div>
              <Button type="submit" disabled={trackQuery.isFetching} className="bg-blue-600 hover:bg-blue-700 text-white">
                {trackQuery.isFetching ? "Searching..." : "Track Request"}
              </Button>
            </form>
            {trackResult && (
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Reference</div>
                    <div className="font-mono font-bold text-white text-lg">{trackResult.reference_number}</div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[trackResult.status] ?? "text-gray-400 bg-gray-800"}`}>
                    {trackResult.status.replace("_", " ").toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    <div className="text-gray-400 mb-0.5">Request Type</div>
                    <div className="text-white capitalize">{trackResult.request_type.replace("_", " ")}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 mb-0.5">Submitted</div>
                    <div className="text-white">{new Date(trackResult.submitted_at).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 mb-0.5">Response Deadline</div>
                    <div className={`font-medium ${new Date(trackResult.response_deadline) < new Date() && trackResult.status !== "resolved" ? "text-red-400" : "text-white"}`}>
                      {trackResult.response_deadline ? new Date(trackResult.response_deadline).toLocaleDateString() : "—"}
                      {new Date(trackResult.response_deadline) < new Date() && trackResult.status !== "resolved" && (
                        <span className="ml-2 text-xs text-red-400 flex items-center gap-1 inline-flex"><AlertCircle className="w-3 h-3" /> OVERDUE</span>
                      )}
                    </div>
                  </div>
                  {trackResult.completed_at && (
                    <div>
                      <div className="text-gray-400 mb-0.5">Completed</div>
                      <div className="text-green-400">{new Date(trackResult.completed_at).toLocaleDateString()}</div>
                    </div>
                  )}
                </div>
                {trackResult.response_notes && (
                  <div className="border-t border-gray-700 pt-4">
                    <div className="text-gray-400 text-xs mb-1">Organisation Response</div>
                    <div className="text-gray-200 text-sm">{trackResult.response_notes}</div>
                  </div>
                )}
                <div className="mt-4 pt-4 border-t border-gray-800 flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5" />
                  If your request is overdue, you may escalate to NITDA at <a href="mailto:dpo@nitda.gov.ng" className="text-blue-400 hover:underline ml-1">dpo@nitda.gov.ng</a>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
