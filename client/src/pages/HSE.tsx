import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataClassificationBadge } from "@/components/DataClassificationBadge";
import {
  ShieldCheck, AlertTriangle, CheckCircle, Clock, FileText,
  Flame, Zap, Wind, Droplets, HardHat, Activity,
  TrendingDown, ClipboardList, BarChart3, Plus, RefreshCw
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ─── ISO 45001 Compliance clauses (static reference data) ────────────────────
const ISO_45001_CLAUSES = [
  { clause: "4.1", title: "Understanding the organization", status: "compliant", score: 95 },
  { clause: "4.2", title: "Understanding needs of workers", status: "compliant", score: 90 },
  { clause: "5.1", title: "Leadership and commitment", status: "compliant", score: 88 },
  { clause: "5.3", title: "Organizational roles", status: "compliant", score: 92 },
  { clause: "6.1", title: "Actions to address risks", status: "compliant", score: 85 },
  { clause: "7.2", title: "Competence", status: "compliant", score: 91 },
  { clause: "8.1", title: "Operational planning and control", status: "compliant", score: 87 },
  { clause: "8.1.2", title: "Hazard elimination hierarchy", status: "compliant", score: 89 },
  { clause: "9.1", title: "Monitoring and measurement", status: "partial", score: 78 },
  { clause: "10.2", title: "Incident investigation", status: "compliant", score: 93 },
];

// ─── Hazard Register (static operational reference) ───────────────────────────
const HAZARDS = [
  { id: "HAZ-001", description: "H2S gas exposure at wellhead during sampling", category: "chemical" as const, risk: "critical" as const, location: "Permian Basin #47", controls: ["H2S monitor mandatory", "SCBA available on site", "Buddy system required"], iso45001Clause: "8.1.2", status: "mitigated" as const },
  { id: "HAZ-002", description: "High-pressure wellhead valve operation", category: "pressure" as const, risk: "high" as const, location: "Eagle Ford #12", controls: ["Pressure bleed-down procedure", "PPE face shield required", "Isolation permit required"], iso45001Clause: "8.1.3", status: "open" as const },
  { id: "HAZ-003", description: "Confined space entry to separator vessel", category: "confined" as const, risk: "high" as const, location: "Midland Basin #3", controls: ["Confined space permit required", "Atmospheric testing", "Standby person mandatory"], iso45001Clause: "8.1.4", status: "mitigated" as const },
  { id: "HAZ-004", description: "Electrical hazard at MCC panel during maintenance", category: "electrical" as const, risk: "high" as const, location: "Bakken #8", controls: ["LOTO procedure mandatory", "Electrical permit required", "Qualified electrician only"], iso45001Clause: "8.1.3", status: "open" as const },
  { id: "HAZ-005", description: "Fire risk from gas flaring operations", category: "fire" as const, risk: "medium" as const, location: "All Sites", controls: ["Exclusion zone 50m", "Fire extinguisher on site", "Hot work permit required within 30m"], iso45001Clause: "8.1.2", status: "mitigated" as const },
];

const RISK_COLORS: Record<string, string> = {
  critical: "border-red-600 text-red-400 bg-red-900/20",
  high: "border-orange-600 text-orange-400 bg-orange-900/20",
  medium: "border-amber-600 text-amber-400 bg-amber-900/20",
  low: "border-emerald-600 text-emerald-400 bg-emerald-900/20",
};

const INCIDENT_TYPE_COLORS: Record<string, string> = {
  NEAR_MISS: "border-amber-600 text-amber-400",
  FIRST_AID: "border-blue-600 text-blue-400",
  RECORDABLE: "border-orange-600 text-orange-400",
  LTI: "border-red-600 text-red-400",
  FATALITY: "border-red-800 text-red-300",
  SPILL: "border-purple-600 text-purple-400",
  FIRE: "border-rose-600 text-rose-400",
  EXPLOSION: "border-red-700 text-red-300",
  RELEASE: "border-yellow-600 text-yellow-400",
};

const CATEGORY_ICONS: Record<string, React.FC<{ className?: string }>> = {
  fire: Flame, electrical: Zap, pressure: Activity,
  chemical: Wind, mechanical: HardHat, confined: Droplets,
};

// ─── Create Incident Dialog ────────────────────────────────────────────────────
function CreateIncidentDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    incidentType: "NEAR_MISS" as const,
    severity: "LOW" as const,
    title: "",
    description: "",
    location: "",
    reportedBy: "",
    occurredAt: new Date().toISOString().slice(0, 10),
    lostTimeDays: 0,
  });
  const createMutation = trpc.hse.create.useMutation({
    onSuccess: () => {
      toast.success("Incident reported", { description: `${form.incidentType}: ${form.title}` });
      onSuccess();
      onClose();
      setForm({ incidentType: "NEAR_MISS", severity: "LOW", title: "", description: "", location: "", reportedBy: "", occurredAt: new Date().toISOString().slice(0, 10), lostTimeDays: 0 });
    },
    onError: (err) => toast.error("Failed to report incident", { description: err.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-amber-400">Report HSE Incident</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Incident Type</label>
              <Select value={form.incidentType} onValueChange={(v: any) => setForm(f => ({ ...f, incidentType: v }))}>
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white text-sm h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  {["NEAR_MISS","FIRST_AID","RECORDABLE","LTI","FATALITY","SPILL","FIRE","EXPLOSION","RELEASE"].map(t => (
                    <SelectItem key={t} value={t} className="text-white text-sm">{t.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Severity</label>
              <Select value={form.severity} onValueChange={(v: any) => setForm(f => ({ ...f, severity: v }))}>
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white text-sm h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  {["LOW","MEDIUM","HIGH","CRITICAL"].map(s => (
                    <SelectItem key={s} value={s} className="text-white text-sm">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Title *</label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="bg-gray-800 border-gray-600 text-white text-sm h-8" placeholder="Brief description of incident" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Location</label>
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                className="bg-gray-800 border-gray-600 text-white text-sm h-8" placeholder="Site / facility" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Reported By</label>
              <Input value={form.reportedBy} onChange={e => setForm(f => ({ ...f, reportedBy: e.target.value }))}
                className="bg-gray-800 border-gray-600 text-white text-sm h-8" placeholder="Name" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Date of Incident</label>
              <Input type="date" value={form.occurredAt} onChange={e => setForm(f => ({ ...f, occurredAt: e.target.value }))}
                className="bg-gray-800 border-gray-600 text-white text-sm h-8" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Lost Time Days</label>
              <Input type="number" min={0} value={form.lostTimeDays}
                onChange={e => setForm(f => ({ ...f, lostTimeDays: parseInt(e.target.value) || 0 }))}
                className="bg-gray-800 border-gray-600 text-white text-sm h-8" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-gray-600 text-gray-300 text-sm">Cancel</Button>
          <Button
            onClick={() => createMutation.mutate({ ...form, occurredAt: new Date(form.occurredAt).toISOString() })}
            disabled={!form.title || createMutation.isPending}
            className="bg-amber-600 hover:bg-amber-700 text-white text-sm"
          >
            {createMutation.isPending ? "Reporting..." : "Report Incident"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HSEPage() {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === "ar";
  const [activeTab, setActiveTab] = useState("overview");
  const [showCreate, setShowCreate] = useState(false);

  const utils = trpc.useUtils();
  const { data: incidents = [], isLoading: incidentsLoading } = trpc.hse.list.useQuery({ limit: 100 });
  const { data: stats } = trpc.hse.stats.useQuery();

  const seedMutation = trpc.hse.seedDemo.useMutation({
    onSuccess: (res) => {
      if (res.seeded) {
        toast.success("Demo data loaded", { description: `${res.count} incidents seeded` });
        utils.hse.list.invalidate();
        utils.hse.stats.invalidate();
      } else {
        toast.info("Database already has incident data");
      }
    },
    onError: (err) => toast.error("Seed failed", { description: err.message }),
  });

  const totalIncidents = incidents.length;
  const openIncidents = incidents.filter(i => !i.closedAt).length;
  const totalLostDays = incidents.reduce((s, i) => s + (i.lostTimeDays ?? 0), 0);
  const criticalHazards = HAZARDS.filter(h => h.risk === "critical").length;
  const openHazards = HAZARDS.filter(h => h.status === "open").length;
  const avgISOScore = Math.round(ISO_45001_CLAUSES.reduce((s, c) => s + c.score, 0) / ISO_45001_CLAUSES.length);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <ShieldCheck className="w-6 h-6 text-amber-400" />
            <h1 className={`text-2xl font-bold text-white ${isArabic ? "font-arabic" : "font-display"}`}>
              {isArabic ? "الصحة والسلامة والبيئة — ISO 45001" : "Health, Safety & Environment — ISO 45001"}
            </h1>
            <DataClassificationBadge classification="confidential" size="sm" />
          </div>
          <p className={`text-gray-400 text-sm ${isArabic ? "font-arabic" : ""}`}>
            {isArabic
              ? "إدارة المخاطر وسجل الحوادث وامتثال ISO 45001 — الكويت والإمارات"
              : "Hazard register, incident management, and ISO 45001 compliance — Kuwait & UAE"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {incidents.length === 0 && !incidentsLoading && (
            <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending} className="border-gray-600 text-gray-300 text-xs">
              <RefreshCw className={`w-3 h-3 mr-1 ${seedMutation.isPending ? "animate-spin" : ""}`} />
              Load Demo Data
            </Button>
          )}
          <Button size="sm" onClick={() => setShowCreate(true)} className="bg-amber-600 hover:bg-amber-700 text-white text-sm">
            <Plus className="w-4 h-4 mr-2" />
            {isArabic ? "تقرير حادثة" : "Report Incident"}
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { icon: ShieldCheck, label: isArabic ? "نقاط ISO 45001" : "ISO 45001 Score", value: `${avgISOScore}%`, color: "text-emerald-400" },
          { icon: AlertTriangle, label: isArabic ? "المخاطر الحرجة" : "Critical Hazards", value: criticalHazards, color: "text-red-400" },
          { icon: Clock, label: isArabic ? "مخاطر مفتوحة" : "Open Hazards", value: openHazards, color: "text-amber-400" },
          { icon: ClipboardList, label: isArabic ? "حوادث مفتوحة" : "Open Incidents", value: openIncidents, color: "text-orange-400" },
          { icon: TrendingDown, label: isArabic ? "أيام عمل ضائعة" : "Lost Time Days (YTD)", value: totalLostDays, color: totalLostDays > 0 ? "text-red-400" : "text-emerald-400" },
        ].map(({ icon: Icon, label, value, color }) => (
          <Card key={label} className="bg-gray-900/60 border-gray-700/50">
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`w-8 h-8 ${color}`} />
              <div>
                <div className="text-2xl font-bold text-white font-mono">{value}</div>
                <div className={`text-xs text-gray-400 ${isArabic ? "font-arabic" : ""}`}>{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-800/50 border border-gray-700">
          {[
            { value: "overview", label: isArabic ? "نظرة عامة" : "Overview" },
            { value: "hazards", label: isArabic ? "سجل المخاطر" : "Hazard Register" },
            { value: "incidents", label: isArabic ? "الحوادث" : `Incidents (${totalIncidents})` },
            { value: "iso45001", label: "ISO 45001" },
          ].map(({ value, label }) => (
            <TabsTrigger key={value} value={value}
              className={`data-[state=active]:bg-amber-600 data-[state=active]:text-white text-gray-400 ${isArabic ? "font-arabic" : ""}`}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gray-900/60 border-gray-700/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-amber-400" />
                  {isArabic ? "ملخص الحوادث" : "Incident Summary (Live DB)"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {incidentsLoading ? (
                  <div className="text-gray-500 text-sm">Loading from database...</div>
                ) : totalIncidents === 0 ? (
                  <div className="text-center py-6 text-gray-500 text-sm">
                    No incidents recorded yet.
                    <br />
                    <button onClick={() => seedMutation.mutate()} className="mt-2 text-amber-400 underline text-xs">
                      Load demo data
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[
                      { label: "Near Miss", type: "NEAR_MISS", color: "bg-amber-500" },
                      { label: "First Aid", type: "FIRST_AID", color: "bg-blue-500" },
                      { label: "Recordable", type: "RECORDABLE", color: "bg-orange-500" },
                      { label: "Lost Time Injury", type: "LTI", color: "bg-red-500" },
                      { label: "Spill / Release", type: "SPILL", color: "bg-purple-500" },
                    ].map(({ label, type, color }) => {
                      const count = incidents.filter(i => i.incidentType === type).length;
                      const pct = totalIncidents > 0 ? Math.round((count / totalIncidents) * 100) : 0;
                      return (
                        <div key={type}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-400">{label}</span>
                            <span className="text-gray-300 font-mono">{count}</span>
                          </div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gray-900/60 border-gray-700/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  {isArabic ? "ملخص سجل المخاطر" : "Hazard Register Summary"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {["critical","high","medium","low"].map(risk => {
                    const count = HAZARDS.filter(h => h.risk === risk).length;
                    return (
                      <div key={risk} className="flex items-center justify-between">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium uppercase ${RISK_COLORS[risk]}`}>{risk}</span>
                        <span className="text-gray-300 font-mono text-sm">{count} hazard{count !== 1 ? "s" : ""}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-3 border-t border-gray-700">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Open hazards requiring action:</span>
                    <span className="text-amber-400 font-bold">{openHazards}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Hazards Tab */}
        <TabsContent value="hazards" className="mt-4">
          <div className="space-y-3">
            {HAZARDS.map((hazard) => {
              const Icon = CATEGORY_ICONS[hazard.category] ?? Activity;
              return (
                <Card key={hazard.id} className="bg-gray-900/60 border-gray-700/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="p-2 rounded-lg bg-gray-800/80 mt-0.5">
                          <Icon className="w-4 h-4 text-amber-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs text-gray-500 font-mono">{hazard.id}</span>
                            <span className="text-xs text-gray-500">ISO 45001 §{hazard.iso45001Clause}</span>
                          </div>
                          <p className="text-sm text-white mb-1">{hazard.description}</p>
                          <p className="text-xs text-gray-500 mb-2">{hazard.location}</p>
                          <div className="flex flex-wrap gap-1">
                            {hazard.controls.map((c, i) => (
                              <span key={i} className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{c}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium uppercase ${RISK_COLORS[hazard.risk]}`}>
                          {hazard.risk}
                        </span>
                        <Badge variant="outline" className={`text-xs ${
                          hazard.status === ("closed" as string) ? "border-emerald-600 text-emerald-400"
                          : hazard.status === "mitigated" ? "border-blue-600 text-blue-400"
                          : "border-amber-600 text-amber-400"
                        }`}>
                          {hazard.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Incidents Tab — Live from DB */}
        <TabsContent value="incidents" className="mt-4">
          {incidentsLoading ? (
            <div className="text-gray-500 text-sm p-4">Loading incidents from database...</div>
          ) : incidents.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No incidents recorded yet.</p>
              <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending} className="mt-3 border-gray-600 text-gray-300 text-xs">
                Load Demo Data
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {incidents.map((incident) => {
                const typeColor = INCIDENT_TYPE_COLORS[incident.incidentType] ?? "border-gray-600 text-gray-400";
                const isOpen = !incident.closedAt;
                return (
                  <Card key={incident.id} className="bg-gray-900/60 border-gray-700/50">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="text-xs text-gray-500 font-mono">{incident.incidentId}</span>
                            <Badge variant="outline" className={`text-xs ${typeColor}`}>
                              {incident.incidentType.replace(/_/g, " ")}
                            </Badge>
                            <Badge variant="outline" className={`text-xs ${
                              incident.severity === "CRITICAL" ? "border-red-600 text-red-400"
                              : incident.severity === "HIGH" ? "border-orange-600 text-orange-400"
                              : incident.severity === "MEDIUM" ? "border-amber-600 text-amber-400"
                              : "border-gray-600 text-gray-400"
                            }`}>
                              {incident.severity}
                            </Badge>
                            <span className="text-xs text-gray-500 font-mono">
                              {new Date(incident.occurredAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-white mb-1">{incident.title}</p>
                          {incident.location && <p className="text-xs text-gray-500 mb-2">{incident.location}</p>}
                          {incident.rootCause && (
                            <div className="text-xs text-gray-400">
                              <span className="text-gray-500">Root Cause: </span>{incident.rootCause}
                            </div>
                          )}
                          {(incident.lostTimeDays ?? 0) > 0 && (
                            <div className="text-xs text-red-400 mt-1">
                              Lost Time: {incident.lostTimeDays} day{incident.lostTimeDays !== 1 ? "s" : ""}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className={`text-xs shrink-0 ${isOpen ? "border-amber-600 text-amber-400" : "border-emerald-600 text-emerald-400"}`}>
                          {isOpen ? "Open" : "Closed"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ISO 45001 Tab */}
        <TabsContent value="iso45001" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {ISO_45001_CLAUSES.map(({ clause, title, status, score }) => (
              <Card key={clause} className="bg-gray-900/60 border-gray-700/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {status === "compliant"
                        ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                        : <Clock className="w-4 h-4 text-amber-400" />}
                      <span className="text-xs text-amber-400 font-mono">§{clause}</span>
                      <span className="text-sm text-white">{title}</span>
                    </div>
                    <span className={`text-sm font-bold font-mono ${score >= 85 ? "text-emerald-400" : "text-amber-400"}`}>
                      {score}%
                    </span>
                  </div>
                  <Progress value={score} className="h-1.5" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-4 p-4 rounded-lg bg-emerald-900/10 border border-emerald-700/30">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-400 font-medium">
                Overall ISO 45001:2018 Compliance Score: {avgISOScore}%
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Based on internal assessment. External TÜV SÜD audit scheduled Q3 2026.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <CreateIncidentDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => {
          utils.hse.list.invalidate();
          utils.hse.stats.invalidate();
        }}
      />
    </div>
  );
}
