/**
 * WarDamageAssessment.tsx — Post-Conflict O&G Infrastructure Triage (v21.0)
 *
 * Provides:
 * - Triage dashboard: KPI cards, classification breakdown, country map
 * - Assessment list with priority-colour coding
 * - New assessment intake form
 * - Detail drawer: AI triage summary, repair tickets, evidence log
 * - Repair priority queue (CRITICAL / HIGH first)
 */

import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { MapView } from "@/components/Map";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  AlertTriangle, ShieldAlert, Wrench, MapPin, TrendingDown,
  Plus, RefreshCw, Brain, CheckCircle2, Clock, XCircle,
  Flame, Zap, Wind, Building2, Pipette,
  Upload, FileText, DollarSign, Users, Camera, Download, UserCheck,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

// ── Constants ─────────────────────────────────────────────────────────────────

const CLASSIFICATION_COLORS: Record<string, string> = {
  DESTROYED: "#ef4444",
  SEVERELY_DAMAGED: "#f97316",
  MODERATELY_DAMAGED: "#eab308",
  MINOR_DAMAGE: "#3b82f6",
  INTACT: "#22c55e",
  UNKNOWN: "#6b7280",
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#3b82f6",
  DEFERRED: "#6b7280",
};

const ASSET_TYPES = [
  "WELLHEAD", "CHRISTMAS_TREE", "PIPELINE", "FLOWLINE", "SEPARATOR",
  "PUMP_STATION", "COMPRESSOR_STATION", "STORAGE_TANK", "CONTROL_ROOM",
  "POWER_SUPPLY", "ROAD_ACCESS", "MANIFOLD", "FLARE_STACK",
  "WATER_INJECTION", "FPSO", "OTHER",
];

const DAMAGE_CAUSES = [
  "DIRECT_STRIKE", "BLAST_OVERPRESSURE", "SHRAPNEL", "FIRE",
  "SABOTAGE", "LOOTING", "NEGLECT_DURING_CONFLICT", "SECONDARY_DAMAGE", "UNKNOWN",
];

const CLASSIFICATIONS = [
  "DESTROYED", "SEVERELY_DAMAGED", "MODERATELY_DAMAGED", "MINOR_DAMAGE", "INTACT", "UNKNOWN",
];

const REPAIR_STATUSES = [
  "PENDING_ASSESSMENT", "ASSESSED", "APPROVED", "MOBILIZING",
  "IN_PROGRESS", "COMPLETED", "DEFERRED", "CANCELLED",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function classificationBadge(c: string) {
  const color = CLASSIFICATION_COLORS[c] ?? "#6b7280";
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
      style={{ backgroundColor: color + "22", color, border: `1px solid ${color}55` }}
    >
      {c.replace(/_/g, " ")}
    </span>
  );
}

function priorityBadge(p: string) {
  const color = PRIORITY_COLORS[p] ?? "#6b7280";
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold"
      style={{ backgroundColor: color + "22", color, border: `1px solid ${color}55` }}
    >
      {p}
    </span>
  );
}

function triageScoreBar(score: number) {
  const color = score >= 75 ? "#ef4444" : score >= 55 ? "#f97316" : score >= 35 ? "#eab308" : "#22c55e";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-mono font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

function formatCurrency(v: number | null | undefined) {
  if (!v) return "—";
  return "$" + (v >= 1_000_000
    ? (v / 1_000_000).toFixed(1) + "M"
    : v >= 1_000 ? (v / 1_000).toFixed(0) + "K" : v.toFixed(0));
}

// ── New Assessment Form ───────────────────────────────────────────────────────

function NewAssessmentForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({
    assetType: "WELLHEAD",
    assetName: "",
    assetTag: "",
    fieldName: "",
    country: "Iraq",
    classification: "UNKNOWN",
    cause: "UNKNOWN",
    incidentDate: "",
    assessedBy: "",
    productionLossBpd: 0,
    productionLossGasMmscfd: 0,
    estimatedDowntimeDays: 0,
    estimatedRepairCostUsd: 0,
    description: "",
    hseRisk: false,
    environmentalRisk: false,
    accessSafe: false,
  });

  const createMutation = trpc.damageAssessment.create.useMutation({
    onSuccess: () => {
      toast.success("Assessment created and triage score computed");
      onSuccess();
    },
    onError: (e) => toast.error("Failed to create assessment: " + e.message),
  });

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Asset Type *</Label>
          <Select value={form.assetType} onValueChange={v => set("assetType", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ASSET_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Asset Name *</Label>
          <Input value={form.assetName} onChange={e => set("assetName", e.target.value)} placeholder="e.g. Well RUM-14 Wellhead" />
        </div>
        <div>
          <Label>Field Name</Label>
          <Input value={form.fieldName} onChange={e => set("fieldName", e.target.value)} placeholder="e.g. Rumaila North" />
        </div>
        <div>
          <Label>Country</Label>
          <Select value={form.country} onValueChange={v => set("country", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["Iraq", "Syria", "Yemen", "Libya", "Iran", "Saudi Arabia", "Kuwait", "UAE", "Other"].map(c =>
                <SelectItem key={c} value={c}>{c}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Damage Classification *</Label>
          <Select value={form.classification} onValueChange={v => set("classification", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CLASSIFICATIONS.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Damage Cause</Label>
          <Select value={form.cause} onValueChange={v => set("cause", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DAMAGE_CAUSES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Production Loss (BPD)</Label>
          <Input type="number" min={0} value={form.productionLossBpd}
            onChange={e => set("productionLossBpd", Number(e.target.value))} />
        </div>
        <div>
          <Label>Gas Loss (MMscfd)</Label>
          <Input type="number" min={0} step={0.1} value={form.productionLossGasMmscfd}
            onChange={e => set("productionLossGasMmscfd", Number(e.target.value))} />
        </div>
        <div>
          <Label>Est. Downtime (days)</Label>
          <Input type="number" min={0} value={form.estimatedDowntimeDays}
            onChange={e => set("estimatedDowntimeDays", Number(e.target.value))} />
        </div>
        <div>
          <Label>Est. Repair Cost (USD)</Label>
          <Input type="number" min={0} value={form.estimatedRepairCostUsd}
            onChange={e => set("estimatedRepairCostUsd", Number(e.target.value))} />
        </div>
        <div>
          <Label>Incident Date</Label>
          <Input type="date" value={form.incidentDate} onChange={e => set("incidentDate", e.target.value)} />
        </div>
        <div>
          <Label>Assessed By</Label>
          <Input value={form.assessedBy} onChange={e => set("assessedBy", e.target.value)} placeholder="Engineer name" />
        </div>
      </div>

      <div>
        <Label>Description</Label>
        <Textarea
          value={form.description}
          onChange={e => set("description", e.target.value)}
          placeholder="Describe the damage in detail — visible signs, extent, immediate risks..."
          rows={3}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { key: "hseRisk", label: "HSE Risk", icon: <AlertTriangle className="w-4 h-4 text-red-500" /> },
          { key: "environmentalRisk", label: "Environmental Risk", icon: <Wind className="w-4 h-4 text-orange-500" /> },
          { key: "accessSafe", label: "Site Access Safe", icon: <CheckCircle2 className="w-4 h-4 text-green-500" /> },
        ].map(({ key, label, icon }) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer p-2 rounded border border-border hover:bg-muted/50">
            <input
              type="checkbox"
              checked={form[key as keyof typeof form] as boolean}
              onChange={e => set(key, e.target.checked)}
              className="w-4 h-4"
            />
            {icon}
            <span className="text-sm">{label}</span>
          </label>
        ))}
      </div>

      <Button
        className="w-full"
        disabled={!form.assetName || createMutation.isPending}
        onClick={() => createMutation.mutate({
          ...form,
          incidentDate: form.incidentDate || undefined,
          assessedBy: form.assessedBy || undefined,
          assetTag: form.assetTag || undefined,
          fieldName: form.fieldName || undefined,
          description: form.description || undefined,
        })}
      >
        {createMutation.isPending ? "Creating..." : "Create Assessment & Compute Triage Score"}
      </Button>
    </div>
  );
}

// ── Assessment Detail Sheet ───────────────────────────────────────────────────

function AssessmentDetailSheet({
  assessmentId,
  open,
  onClose,
}: {
  assessmentId: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.damageAssessment.getById.useQuery(
    { id: assessmentId! },
    { enabled: !!assessmentId }
  );

  const aiMutation = trpc.damageAssessment.generateAISummary.useMutation({
    onSuccess: () => {
      toast.success("AI triage analysis complete");
      utils.damageAssessment.getById.invalidate({ id: assessmentId! });
      utils.damageAssessment.list.invalidate();
    },
    onError: (e) => toast.error("AI analysis failed: " + e.message),
  });

  const updateMutation = trpc.damageAssessment.update.useMutation({
    onSuccess: () => {
      toast.success("Assessment updated");
      utils.damageAssessment.getById.invalidate({ id: assessmentId! });
      utils.damageAssessment.list.invalidate();
    },
  });

  const ticketMutation = trpc.damageAssessment.createRepairTicket.useMutation({
    onSuccess: () => {
      toast.success("Repair ticket created");
      utils.damageAssessment.getById.invalidate({ id: assessmentId! });
    },
  });

  const [newTicketTitle, setNewTicketTitle] = useState("");
  const [newTicketScope, setNewTicketScope] = useState("");

  if (!open) return null;

  const a = data?.assessment as Record<string, unknown> | undefined;
  const tickets = (data?.tickets ?? []) as Record<string, unknown>[];
  const aiRecs = a?.ai_recommendations
    ? (typeof a.ai_recommendations === "string" ? JSON.parse(a.ai_recommendations) : a.ai_recommendations) as { priority: string; action: string; rationale: string; timeframe: string }[]
    : [];

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-orange-500" />
            {isLoading ? "Loading..." : (a?.asset_name as string ?? "Assessment Detail")}
          </SheetTitle>
        </SheetHeader>

        {isLoading && <div className="py-8 text-center text-muted-foreground">Loading assessment...</div>}

        {a && (
          <Tabs defaultValue="overview" className="mt-4">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="ai">AI Triage</TabsTrigger>
              <TabsTrigger value="tickets">Tickets</TabsTrigger>
              <TabsTrigger value="images">Images</TabsTrigger>
              <TabsTrigger value="cost">Cost</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Assessment ID</span><div className="font-mono font-bold">{a.assessment_id as string}</div></div>
                <div><span className="text-muted-foreground">Asset Type</span><div>{(a.asset_type as string).replace(/_/g, " ")}</div></div>
                <div><span className="text-muted-foreground">Field</span><div>{(a.field_name as string) ?? "—"}, {a.country as string}</div></div>
                <div><span className="text-muted-foreground">Classification</span><div>{classificationBadge(a.classification as string)}</div></div>
                <div><span className="text-muted-foreground">Cause</span><div>{(a.cause as string ?? "Unknown").replace(/_/g, " ")}</div></div>
                <div><span className="text-muted-foreground">Triage Score</span><div>{triageScoreBar(Number(a.triage_score) ?? 0)}</div></div>
                <div><span className="text-muted-foreground">Priority</span><div>{priorityBadge(a.repair_priority as string)}</div></div>
                <div><span className="text-muted-foreground">Repair Status</span><div>
                  <Select
                    value={a.repair_status as string}
                    onValueChange={v => updateMutation.mutate({ id: assessmentId!, repairStatus: v })}
                  >
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REPAIR_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div></div>
                <div><span className="text-muted-foreground">Production Loss</span><div className="font-semibold text-red-500">{Number(a.production_loss_bpd ?? 0).toLocaleString()} BPD</div></div>
                <div><span className="text-muted-foreground">Est. Repair Cost</span><div className="font-semibold">{formatCurrency(a.estimated_repair_cost_usd as number)}</div></div>
                <div><span className="text-muted-foreground">Downtime</span><div>{a.estimated_downtime_days ? `${a.estimated_downtime_days} days` : "—"}</div></div>
                <div><span className="text-muted-foreground">Assessed By</span><div>{(a.assessed_by as string) ?? "—"}</div></div>
              </div>

              <div className="flex gap-3 text-sm">
                {(a.hse_risk as boolean) && <span className="flex items-center gap-1 text-red-500"><AlertTriangle className="w-3 h-3" /> HSE Risk</span>}
                {(a.environmental_risk as boolean) && <span className="flex items-center gap-1 text-orange-500"><Wind className="w-3 h-3" /> Env Risk</span>}
                {!(a.access_safe as boolean) && <span className="flex items-center gap-1 text-yellow-500"><XCircle className="w-3 h-3" /> Access Unsafe</span>}
                {(a.access_safe as boolean) && <span className="flex items-center gap-1 text-green-500"><CheckCircle2 className="w-3 h-3" /> Access Safe</span>}
              </div>

              {!!a.description && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Description</div>
                  <div className="text-sm bg-muted/40 rounded p-3 leading-relaxed">{String(a.description)}</div>
                </div>
              )}
            </TabsContent>

            {/* AI Triage Tab */}
            <TabsContent value="ai" className="space-y-4 mt-4">
              <Button
                className="w-full"
                variant="outline"
                onClick={() => aiMutation.mutate({ id: assessmentId! })}
                disabled={aiMutation.isPending}
              >
                <Brain className="w-4 h-4 mr-2" />
                {aiMutation.isPending ? "Analysing with AI..." : "Generate AI Triage Analysis"}
              </Button>

              {!!a.ai_summary && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1 font-semibold">Executive Summary</div>
                  <div className="text-sm bg-muted/40 rounded p-3 leading-relaxed border-l-4 border-orange-500">{String(a.ai_summary)}</div>
                </div>
              )}

              {aiRecs.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-2 font-semibold">Recommendations</div>
                  <div className="space-y-2">
                    {aiRecs.map((rec, i) => (
                      <div key={i} className="rounded border p-3 text-sm space-y-1">
                        <div className="flex items-center gap-2">
                          {priorityBadge(rec.priority)}
                          <span className="font-semibold">{rec.action}</span>
                        </div>
                        <div className="text-muted-foreground text-xs">{rec.rationale}</div>
                        <div className="flex items-center gap-1 text-xs text-blue-500">
                          <Clock className="w-3 h-3" /> {rec.timeframe}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!a.ai_summary && !aiMutation.isPending && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Click "Generate AI Triage Analysis" to get LLM-powered recommendations for this assessment.
                </div>
              )}
            </TabsContent>

            {/* Repair Tickets Tab */}
            <TabsContent value="tickets" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Input
                  placeholder="New repair ticket title..."
                  value={newTicketTitle}
                  onChange={e => setNewTicketTitle(e.target.value)}
                />
                <Textarea
                  placeholder="Work scope (optional)..."
                  value={newTicketScope}
                  onChange={e => setNewTicketScope(e.target.value)}
                  rows={2}
                />
                <Button
                  size="sm"
                  disabled={!newTicketTitle || ticketMutation.isPending}
                  onClick={() => {
                    ticketMutation.mutate({
                      assessmentId: assessmentId!,
                      title: newTicketTitle,
                      scope: newTicketScope || undefined,
                    });
                    setNewTicketTitle("");
                    setNewTicketScope("");
                  }}
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Repair Ticket
                </Button>
              </div>

              {tickets.length === 0 && (
                <div className="text-center py-4 text-muted-foreground text-sm">No repair tickets yet.</div>
              )}

              {tickets.map(t => (
                <div key={t.id as number} className="rounded border p-3 text-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{t.title as string}</span>
                    {priorityBadge(t.priority as string)}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">{t.ticket_id as string}</div>
                  {!!t.scope && <div className="text-xs text-muted-foreground">{String(t.scope)}</div>}
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-muted">{(t.status as string).replace(/_/g, " ")}</span>
                    {!!t.estimated_cost_usd && <span className="text-xs">{formatCurrency(t.estimated_cost_usd as number)}</span>}
                  </div>
                </div>
              ))}
            </TabsContent>
            {/* Images Tab */}
            <TabsContent value="images" className="space-y-4 mt-4">
              <ImageUploadTab assessmentId={assessmentId!} />
            </TabsContent>

            {/* Cost Estimator Tab */}
            <TabsContent value="cost" className="space-y-4 mt-4">
              <CostEstimatorTab
                assetType={(a.asset_type as string) ?? "WELLHEAD"}
                damageSeverity={(a.damage_classification as string) ?? (a.classification as string) ?? "UNKNOWN"}
                country={(a.country as string) ?? "Iraq"}
              />
              <ContractorMatchTab assessmentId={assessmentId!} />
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Image Upload Tab ──────────────────────────────────────────────────────────

function ImageUploadTab({ assessmentId }: { assessmentId: number }) {
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<Record<string, unknown>[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadImages = async () => {
    setLoadingImages(true);
    try {
      const resp = await fetch(`/api/damage/images/${assessmentId}`, { credentials: "include" });
      if (resp.ok) {
        const data = await resp.json() as { images: Record<string, unknown>[] };
        setImages(data.images ?? []);
      }
    } finally {
      setLoadingImages(false);
    }
  };

  useState(() => { loadImages(); });

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("assessmentId", String(assessmentId));
      const resp = await fetch("/api/damage/upload-image", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!resp.ok) throw new Error(await resp.text());
      const result = await resp.json() as { aiSeverity: string; aiConfidence: number; aiSummary: string; vlmModel: string; ocrText: string };
      toast.success(`Image uploaded — VLM classified as ${result.aiSeverity} (${Math.round(result.aiConfidence * 100)}% confidence)`);
      if (result.ocrText) toast.info(`OCR extracted: ${result.ocrText.slice(0, 80)}...`);
      loadImages();
    } catch (err) {
      toast.error("Upload failed: " + String(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold flex items-center gap-2">
          <Camera className="w-4 h-4 text-blue-500" />
          Damage Images — PaddleOCR + LLaVA VLM Analysis
        </div>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Analysing...</> : <><Upload className="w-3 h-3 mr-1" /> Upload Image</>}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/tiff"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Upload satellite or drone imagery. PaddleOCR extracts text (labels, GPS overlays, serial numbers).
        Ollama LLaVA VLM classifies damage severity and asset type automatically.
      </p>
      {loadingImages && <div className="text-sm text-muted-foreground text-center py-4">Loading images...</div>}
      {!loadingImages && images.length === 0 && (
        <div
          className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <Camera className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <div className="text-sm text-muted-foreground">Drop satellite/drone images here or click to upload</div>
          <div className="text-xs text-muted-foreground mt-1">JPEG, PNG, WebP, TIFF — max 20MB</div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {images.map(img => (
          <div key={img.id as number} className="rounded-lg border border-border overflow-hidden">
            <img src={img.s3_url as string} alt={img.filename as string} className="w-full h-32 object-cover" />
            <div className="p-2 space-y-1">
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: (CLASSIFICATION_COLORS[img.ai_severity as string] ?? "#6b7280") + "22",
                    color: CLASSIFICATION_COLORS[img.ai_severity as string] ?? "#6b7280",
                  }}
                >
                  {(img.ai_severity as string) ?? "UNKNOWN"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {img.ai_confidence ? `${Math.round(Number(img.ai_confidence) * 100)}%` : "—"}
                </span>
              </div>
              {(img.ai_summary as string) && (
                <div className="text-xs text-muted-foreground line-clamp-2">{img.ai_summary as string}</div>
              )}
              {(img.ocr_text as string) && (
                <div className="text-xs font-mono bg-muted rounded px-1 py-0.5 truncate">
                  OCR: {img.ocr_text as string}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Cost Estimator Tab ────────────────────────────────────────────────────────

function CostEstimatorTab({ assetType, damageSeverity, country }: { assetType: string; damageSeverity: string; country: string }) {
  const [estimate, setEstimate] = useState<Record<string, unknown> | null>(null);
  const costMutation = trpc.damageAssessment.estimateRepairCost.useMutation({
    onSuccess: (data) => {
      setEstimate(data as Record<string, unknown>);
      toast.success("Cost estimate generated");
    },
    onError: (e) => toast.error("Cost estimation failed: " + e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-500" />
          Repair Cost Estimate — Ollama LLM Analysis
        </div>
        <Button
          size="sm"
          onClick={() => costMutation.mutate({ assetType, damageSeverity, country })}
          disabled={costMutation.isPending || damageSeverity === "UNKNOWN"}
        >
          {costMutation.isPending ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Estimating...</> : "Generate Estimate"}
        </Button>
      </div>
      <div className="text-xs text-muted-foreground">
        Asset: <span className="font-mono">{assetType.replace(/_/g, " ")}</span> |
        Severity: <span className="font-mono">{damageSeverity.replace(/_/g, " ")}</span> |
        Country: <span className="font-mono">{country}</span>
      </div>
      {estimate && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              { label: "Labour Days", value: `${estimate.labor_days} days` },
              { label: "Labour Cost", value: formatCurrency(estimate.labor_cost_usd as number) },
              { label: "Materials", value: formatCurrency(estimate.material_cost_usd as number) },
              { label: "Mobilisation", value: formatCurrency(estimate.mobilization_cost_usd as number) },
              { label: "Contingency", value: `${estimate.contingency_pct}%` },
              { label: "Total Cost", value: formatCurrency(estimate.total_cost_usd as number) },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between p-2 rounded bg-muted/50">
                <span className="text-muted-foreground text-xs">{label}</span>
                <span className="font-semibold text-xs">{value}</span>
              </div>
            ))}
          </div>
          <div className="p-3 rounded border border-border bg-muted/20 text-xs text-muted-foreground">
            <span className="font-semibold">Basis: </span>{estimate.basis_of_estimate as string}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Confidence:</span>
            <Badge variant={estimate.confidence === "HIGH" ? "default" : estimate.confidence === "MEDIUM" ? "secondary" : "outline"}>
              {estimate.confidence as string}
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Contractor Match Tab ──────────────────────────────────────────────────────

function ContractorMatchTab({ assessmentId }: { assessmentId: number }) {
  const { data, isLoading } = trpc.damageAssessment.matchContractors.useQuery({ assessmentId });
  const contractors = (data?.contractors ?? []) as Record<string, unknown>[];

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold flex items-center gap-2">
        <Users className="w-4 h-4 text-blue-500" />
        Matched Contractors ({contractors.length})
      </div>
      {isLoading && <div className="text-sm text-muted-foreground">Finding contractors...</div>}
      {!isLoading && contractors.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-4">No contractors found for this region.</div>
      )}
      <div className="space-y-2">
        {contractors.slice(0, 5).map(c => (
          <div key={c.id as number} className="p-3 rounded border border-border text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">{c.company_name as string}</span>
              <Badge variant="outline">{(c.specialization as string).replace(/_/g, " ")}</Badge>
            </div>
            <div className="flex gap-4 text-muted-foreground">
              <span><MapPin className="w-3 h-3 inline mr-0.5" />{(c.hq_country as string)}</span>
              <span><Clock className="w-3 h-3 inline mr-0.5" />ETA: {String(c.mobilization_days_min)}–{String(c.mobilization_days_max)} days</span>
              <span><DollarSign className="w-3 h-3 inline mr-0.5" />{formatCurrency(c.day_rate_usd as number)}/day</span>
            </div>
            {(c.contact_email as string) && (
              <div className="text-muted-foreground">✉ {c.contact_email as string}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── OCHA Export Button ────────────────────────────────────────────────────────

function OCHAExportButton({ fieldName, country }: { fieldName: string; country: string }) {
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const ochaMutation = trpc.damageAssessment.generateOCHAReport.useMutation({
    onSuccess: (data) => {
      setReport(data as Record<string, unknown>);
      setShowDialog(true);
    },
    onError: (e) => toast.error("OCHA report failed: " + e.message),
  });

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => ochaMutation.mutate({ fieldName, country })}
        disabled={ochaMutation.isPending || !fieldName}
      >
        {ochaMutation.isPending
          ? <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Generating...</>
          : <><FileText className="w-4 h-4 mr-1" /> OCHA Sitrep</>}
      </Button>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              UN/OCHA Situation Report — {fieldName}, {country}
            </DialogTitle>
          </DialogHeader>
          {report && (() => {
            const sitrep = report.sitrep as Record<string, unknown>;
            return (
              <div className="space-y-4 text-sm">
                <div className="flex items-center gap-3 p-3 rounded bg-blue-500/10 border border-blue-500/20">
                  <div className="font-mono text-xs">{sitrep.sitrep_number as string}</div>
                  <Badge variant="outline">{sitrep.classification as string}</Badge>
                  <span className="text-muted-foreground text-xs ml-auto">Model: {report.model as string}</span>
                </div>
                {Boolean(sitrep.situation_overview) && (
                  <div>
                    <div className="font-semibold mb-1">Situation Overview</div>
                    <div className="text-muted-foreground leading-relaxed">{String(sitrep.situation_overview)}</div>
                  </div>
                )}
                {Boolean(sitrep.humanitarian_impact) && (
                  <div>
                    <div className="font-semibold mb-1">Humanitarian Impact</div>
                    <div className="text-muted-foreground">{String(sitrep.humanitarian_impact)}</div>
                  </div>
                )}
                {Boolean(sitrep.response_actions) && (
                  <div>
                    <div className="font-semibold mb-1">Response Actions</div>
                    <div className="text-muted-foreground">{String(sitrep.response_actions)}</div>
                  </div>
                )}
                {Boolean(sitrep.funding_requirements) && (
                  <div>
                    <div className="font-semibold mb-1">Funding Requirements</div>
                    <div className="text-muted-foreground">{String(sitrep.funding_requirements)}</div>
                  </div>
                )}
                {Array.isArray(sitrep.next_steps) && (
                  <div>
                    <div className="font-semibold mb-1">Next Steps</div>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      {(sitrep.next_steps as string[]).map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={() => {
                    const text = JSON.stringify(report, null, 2);
                    const blob = new Blob([text], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `OCHA-SITREP-${fieldName.replace(/\s+/g, "-")}-${report.reportDate}.json`;
                    a.click();
                  }}>
                    <Download className="w-3 h-3 mr-1" /> Download JSON
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Damage Heat-Map Panel ────────────────────────────────────────────────────

function DamageHeatMapPanel({
  assessments,
  onSelectId,
}: {
  assessments: Record<string, unknown>[];
  onSelectId: (id: number) => void;
}) {
  const mapRef = useRef<google.maps.Map | null>(null);

  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;

    // Centre on Middle East
    map.setCenter({ lat: 30.5, lng: 45.0 });
    map.setZoom(5);

    // Add colour-coded markers for each assessment
    assessments.forEach((a) => {
      const lat = Number(a.latitude);
      const lng = Number(a.longitude);
      if (!lat || !lng) return;

      const cls = (a.classification as string) || "UNKNOWN";
      const color = CLASSIFICATION_COLORS[cls] ?? "#6b7280";

      const marker = new google.maps.Marker({
        position: { lat, lng },
        map,
        title: `${a.asset_name as string} — ${cls.replace(/_/g, " ")}`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: color,
          fillOpacity: 0.85,
          strokeColor: "#ffffff",
          strokeWeight: 1.5,
        },
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="font-family:sans-serif;padding:8px;min-width:180px">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px">${a.asset_name as string}</div>
            <div style="font-size:11px;color:#666;margin-bottom:2px">${(a.asset_type as string).replace(/_/g, " ")}</div>
            <div style="font-size:11px;color:#666;margin-bottom:6px">${a.field_name as string ?? ""}, ${a.country as string}</div>
            <span style="background:${color};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${cls.replace(/_/g, " ")}</span>
            ${Number(a.production_loss_bpd) > 0 ? `<div style="margin-top:6px;font-size:11px;color:#dc2626">Loss: ${Number(a.production_loss_bpd).toLocaleString()} BPD</div>` : ""}
          </div>
        `,
      });

      marker.addListener("click", () => {
        infoWindow.open(map, marker);
        onSelectId(a.id as number);
      });
    });

    // Add heatmap layer if HeatmapLayer is available
    if (google.maps.visualization?.HeatmapLayer) {
      const heatmapData = assessments
        .filter(a => Number(a.latitude) && Number(a.longitude))
        .map(a => ({
          location: new google.maps.LatLng(Number(a.latitude), Number(a.longitude)),
          weight: ({ DESTROYED: 5, SEVERELY_DAMAGED: 4, MODERATELY_DAMAGED: 3, MINOR_DAMAGE: 2, INTACT: 1 } as Record<string, number>)[(a.classification as string)] ?? 1,
        }));

      const HeatmapLayer = google.maps.visualization.HeatmapLayer as unknown as new (opts: Record<string, unknown>) => unknown;
      new HeatmapLayer({
        data: heatmapData,
        map,
        radius: 40,
        opacity: 0.6,
      });
    }
  }, [assessments, onSelectId]);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <MapPin className="w-4 h-4 text-red-500" /> Damage Heat-Map
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {assessments.filter(a => Number(a.latitude) && Number(a.longitude)).length} assets plotted
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[500px] rounded-b-lg overflow-hidden">
          {assessments.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              No assessments to display. Load demo data first.
            </div>
          ) : (
            <MapView onMapReady={handleMapReady} />
          )}
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 p-3 border-t border-border/50">
          {Object.entries(CLASSIFICATION_COLORS).filter(([k]) => k !== "UNKNOWN").map(([cls, color]) => (
            <div key={cls} className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded-full border border-white/20" style={{ background: color }} />
              <span className="text-muted-foreground">{cls.replace(/_/g, " ")}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Repair Gantt Chart ───────────────────────────────────────────────────────

function RepairGanttChart({ assessments }: { assessments: Record<string, unknown>[] }) {
  const today = new Date();
  const todayMs = today.getTime();

  // Build Gantt rows from assessments that have estimated downtime
  const rows = assessments
    .filter(a => Number(a.estimated_downtime_days) > 0)
    .map(a => {
      const startDate = a.incident_date
        ? new Date(a.incident_date as string)
        : new Date(todayMs - Math.abs(Math.sin((a.id as number ?? 1) * 2.3)) * 30 * 86400_000);
      const durationDays = Number(a.estimated_downtime_days) || 30;
      const endDate = new Date(startDate.getTime() + durationDays * 86400_000);
      const status = (a.repair_status as string) || "PENDING_ASSESSMENT";
      const pct = status === "COMPLETED" ? 100
        : status === "IN_PROGRESS" ? Math.min(90, Math.round((todayMs - startDate.getTime()) / (endDate.getTime() - startDate.getTime()) * 100))
        : status === "MOBILIZING" ? 15
        : status === "APPROVED" ? 5
        : 0;
      return {
        id: a.id as number,
        label: (a.asset_name as string) || "Unknown",
        country: (a.country as string) || "",
        priority: (a.repair_priority as string) || "MEDIUM",
        classification: (a.classification as string) || "UNKNOWN",
        status,
        startDate,
        endDate,
        durationDays,
        pct,
      };
    })
    .sort((a, b) => {
      const pOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, DEFERRED: 4 };
      return (pOrder[a.priority] ?? 5) - (pOrder[b.priority] ?? 5);
    })
    .slice(0, 30); // max 30 rows

  if (rows.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          No repair timeline data. Load demo data or add assessments with estimated downtime.
        </CardContent>
      </Card>
    );
  }

  // Determine chart window: 30 days before earliest start to 30 days after latest end
  const minMs = Math.min(...rows.map(r => r.startDate.getTime())) - 7 * 86400_000;
  const maxMs = Math.max(...rows.map(r => r.endDate.getTime())) + 7 * 86400_000;
  const totalMs = maxMs - minMs;

  const pctX = (ms: number) => Math.max(0, Math.min(100, ((ms - minMs) / totalMs) * 100));

  const statusColor: Record<string, string> = {
    COMPLETED: "#22c55e",
    IN_PROGRESS: "#3b82f6",
    MOBILIZING: "#a855f7",
    APPROVED: "#eab308",
    ASSESSED: "#f97316",
    PENDING_ASSESSMENT: "#6b7280",
    DEFERRED: "#374151",
    CANCELLED: "#ef4444",
  };

  // Generate month tick marks
  const ticks: { label: string; pct: number }[] = [];
  const d = new Date(minMs);
  d.setDate(1);
  while (d.getTime() < maxMs) {
    ticks.push({
      label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      pct: pctX(d.getTime()),
    });
    d.setMonth(d.getMonth() + 1);
  }

  const todayPct = pctX(todayMs);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-500" /> Repair Timeline — {rows.length} assets
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            Sorted by priority · Estimated completion dates
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Month axis */}
          <div className="relative h-6 mb-1 ml-48">
            {ticks.map(t => (
              <div
                key={t.label}
                className="absolute text-[10px] text-muted-foreground font-mono"
                style={{ left: `${t.pct}%`, transform: "translateX(-50%)" }}
              >
                {t.label}
              </div>
            ))}
          </div>
          {/* Rows */}
          <div className="space-y-1.5">
            {rows.map(row => {
              const barLeft = pctX(row.startDate.getTime());
              const barWidth = Math.max(1, pctX(row.endDate.getTime()) - barLeft);
              const color = statusColor[row.status] ?? "#6b7280";
              const priorityColor = PRIORITY_COLORS[row.priority] ?? "#6b7280";
              return (
                <div key={row.id} className="flex items-center gap-2">
                  {/* Label */}
                  <div className="w-48 shrink-0 flex items-center gap-1.5 pr-2">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: priorityColor }} />
                    <div className="truncate text-xs font-medium" title={row.label}>{row.label}</div>
                  </div>
                  {/* Bar track */}
                  <div className="flex-1 relative h-6 bg-muted/30 rounded overflow-hidden">
                    {/* Today line */}
                    {todayPct > 0 && todayPct < 100 && (
                      <div
                        className="absolute top-0 bottom-0 w-px bg-amber-500/70 z-10"
                        style={{ left: `${todayPct}%` }}
                      />
                    )}
                    {/* Bar background */}
                    <div
                      className="absolute top-1 bottom-1 rounded"
                      style={{
                        left: `${barLeft}%`,
                        width: `${barWidth}%`,
                        background: color + "33",
                        border: `1px solid ${color}66`,
                      }}
                    />
                    {/* Progress fill */}
                    <div
                      className="absolute top-1 bottom-1 rounded"
                      style={{
                        left: `${barLeft}%`,
                        width: `${barWidth * row.pct / 100}%`,
                        background: color + "88",
                      }}
                    />
                    {/* Label inside bar */}
                    <div
                      className="absolute top-0 bottom-0 flex items-center px-1.5"
                      style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
                    >
                      <span className="text-[9px] font-mono truncate" style={{ color }}>
                        {row.status.replace(/_/g, " ")} · {row.pct}%
                      </span>
                    </div>
                  </div>
                  {/* Duration + Assign */}
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="w-10 text-right text-[10px] text-muted-foreground font-mono">
                      {row.durationDays}d
                    </div>
                    <ContractorAssignDialog
                      assessmentId={row.id}
                      ticketId={row.id}
                      onAssigned={() => {}}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-border/50">
            {Object.entries(statusColor).map(([s, c]) => (
              <div key={s} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />
                {s.replace(/_/g, " ")}
              </div>
            ))}
            <div className="flex items-center gap-1 text-[10px] text-amber-500 ml-auto">
              <div className="w-px h-3 bg-amber-500" /> Today
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/// ── Contractor Assign Dialog ─────────────────────────────────────────────────
function ContractorAssignDialog({ assessmentId, ticketId, onAssigned }: { assessmentId: number; ticketId: number; onAssigned: () => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data } = trpc.damageAssessment.listContractors.useQuery(
    { specialization: undefined, country: undefined },
    { enabled: open }
  );
  const assignMutation = trpc.damageAssessment.assignContractor.useMutation({
    onSuccess: () => {
      toast.success("Contractor assigned successfully");
      setOpen(false);
      onAssigned();
    },
    onError: (e) => toast.error("Assignment failed: " + e.message),
  });
  const contractors = (data?.contractors ?? []).filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.company?.toLowerCase().includes(search.toLowerCase()) ||
    c.country?.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
          <UserCheck className="w-3 h-3" /> Assign
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-blue-500" /> Assign Contractor
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Search by name, company, country…" value={search} onChange={e => setSearch(e.target.value)} />
          <div className="max-h-64 overflow-y-auto space-y-2">
            {contractors.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No available contractors found</p>
            )}
            {contractors.map((c: Record<string, unknown>) => (
              <div
                key={c.id as number}
                onClick={() => setSelectedId(c.id as number)}
                className={`p-3 rounded border cursor-pointer transition-colors ${
                  selectedId === c.id ? "border-blue-500 bg-blue-950/30" : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{c.name as string}</p>
                    <p className="text-xs text-muted-foreground">{c.company as string} · {c.country as string}</p>
                    <p className="text-xs text-muted-foreground">{c.specialization as string}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono text-amber-400">${(c.day_rate_usd as number)?.toLocaleString()}/day</p>
                    <p className="text-xs text-muted-foreground">Mob: ${(c.mobilization_cost_usd as number)?.toLocaleString()}</p>
                    <Badge variant="outline" className="text-[10px] mt-1">{c.available ? "Available" : "Busy"}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Button
            className="w-full"
            disabled={!selectedId || assignMutation.isPending}
            onClick={() => selectedId && assignMutation.mutate({ ticketId, contractorId: selectedId })}
          >
            {assignMutation.isPending ? "Assigning…" : "Confirm Assignment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function WarDamageAssessment() {
  const { isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();

  const [filterClassification, setFilterClassification] = useState<string>("");
  const [filterCountry, setFilterCountry] = useState<string>("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } =
    trpc.damageAssessment.getDashboardSummary.useQuery();

  const { data: assessments, isLoading: listLoading, refetch: refetchList } =
    trpc.damageAssessment.list.useQuery({
      classification: filterClassification || undefined,
      country: filterCountry || undefined,
      priority: filterPriority || undefined,
    });

  const seedMutation = trpc.damageAssessment.seedDemoData.useMutation({
    onSuccess: (r) => {
      toast.success(r.message);
      utils.damageAssessment.list.invalidate();
      utils.damageAssessment.getDashboardSummary.invalidate();
    },
    onError: (e) => toast.error("Seed failed: " + e.message),
  });

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <ShieldAlert className="w-12 h-12 text-orange-500" />
        <p className="text-muted-foreground">Please log in to access the Damage Assessment module.</p>
        <Button onClick={() => window.location.href = getLoginUrl()}>Log In</Button>
      </div>
    );
  }

  const totals = summary?.totals as Record<string, unknown> | undefined;
  const byClass = summary?.byClassification ?? [];
  const byCountry = summary?.byCountry ?? [];
  const critical = summary?.recentCritical ?? [];
  const list = (assessments ?? []) as Record<string, unknown>[];

  const pieData = byClass.map(b => ({
    name: b.classification.replace(/_/g, " "),
    value: b.count,
    color: CLASSIFICATION_COLORS[b.classification] ?? "#6b7280",
  }));

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <ShieldAlert className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Damage Assessment</h1>
            <p className="text-sm text-muted-foreground">Post-conflict O&G infrastructure triage — Middle East operations</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { refetchSummary(); refetchList(); }}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
          <OCHAExportButton fieldName={filterCountry ? `${filterCountry} Operations` : "All Fields"} country={filterCountry || "Iraq"} />
          {list.length === 0 && (
            <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
              {seedMutation.isPending ? "Seeding..." : "Load Demo Data"}
            </Button>
          )}
          <Button size="sm" onClick={() => navigate("/damage-assessment/new")}>
            <Plus className="w-4 h-4 mr-1" /> New Assessment
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[
          {
            label: "Total Assessments",
            value: summaryLoading ? "—" : String(totals?.total_assessments ?? 0),
            icon: <Building2 className="w-5 h-5 text-blue-500" />,
            color: "blue",
          },
          {
            label: "Critical Priority",
            value: summaryLoading ? "—" : String(totals?.critical_count ?? 0),
            icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
            color: "red",
          },
          {
            label: "HSE Risk Sites",
            value: summaryLoading ? "—" : String(totals?.hse_risk_count ?? 0),
            icon: <Flame className="w-5 h-5 text-orange-500" />,
            color: "orange",
          },
          {
            label: "Production Loss",
            value: summaryLoading ? "—" : `${Number(totals?.total_production_loss_bpd ?? 0).toLocaleString()} BPD`,
            icon: <TrendingDown className="w-5 h-5 text-yellow-500" />,
            color: "yellow",
          },
          {
            label: "Total Repair Cost",
            value: summaryLoading ? "—" : formatCurrency(totals?.total_repair_cost_usd as number),
            icon: <Wrench className="w-5 h-5 text-purple-500" />,
            color: "purple",
          },
          {
            label: "Completed Repairs",
            value: summaryLoading ? "—" : String(totals?.completed_count ?? 0),
            icon: <CheckCircle2 className="w-5 h-5 text-green-500" />,
            color: "green",
          },
        ].map(({ label, value, icon }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                {icon}
              </div>
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Classification Pie */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Damage Classification</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, value }) => `${value}`}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Legend iconSize={10} formatter={(v) => <span className="text-xs">{v}</span>} />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Country Bar */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Assessments by Country</CardTitle>
          </CardHeader>
          <CardContent>
            {byCountry.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={byCountry} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="country" tick={{ fontSize: 10 }} width={70} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#f97316" radius={2} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Critical Queue */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-red-500" /> Critical Priority Queue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-48 overflow-y-auto">
            {critical.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">No critical items</div>}
            {(critical as Record<string, unknown>[]).map(item => (
              <div
                key={item.assessment_id as string}
                className="flex items-center justify-between text-xs cursor-pointer hover:bg-muted/50 rounded p-1"
                onClick={() => setSelectedId(item.id as number)}
              >
                <div>
                  <div className="font-semibold truncate max-w-[150px]">{item.asset_name as string}</div>
                  <div className="text-muted-foreground">{item.field_name as string}, {item.country as string}</div>
                </div>
                <div className="text-right">
                  {classificationBadge(item.classification as string)}
                  <div className="mt-1">{triageScoreBar(Number(item.triage_score) ?? 0)}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="w-4 h-4" /> Filters:
        </div>
        <Select value={filterClassification || "all"} onValueChange={v => setFilterClassification(v === "all" ? "" : v)}>
          <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="All Classifications" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classifications</SelectItem>
            {CLASSIFICATIONS.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCountry || "all"} onValueChange={v => setFilterCountry(v === "all" ? "" : v)}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="All Countries" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Countries</SelectItem>
            {["Iraq", "Syria", "Yemen", "Libya", "Iran", "Saudi Arabia", "Kuwait", "UAE"].map(c =>
              <SelectItem key={c} value={c}>{c}</SelectItem>
            )}
          </SelectContent>
        </Select>
        <Select value={filterPriority || "all"} onValueChange={v => setFilterPriority(v === "all" ? "" : v)}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="All Priorities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {["CRITICAL", "HIGH", "MEDIUM", "LOW", "DEFERRED"].map(p =>
              <SelectItem key={p} value={p}>{p}</SelectItem>
            )}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{list.length} assessments</span>
      </div>

      {/* View Toggle: Table | Map | Gantt */}
      <Tabs defaultValue="table" className="space-y-4">
        <TabsList className="h-8">
          <TabsTrigger value="table" className="text-xs">Table View</TabsTrigger>
          <TabsTrigger value="map" className="text-xs">Heat-Map View</TabsTrigger>
          <TabsTrigger value="gantt" className="text-xs">Gantt Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="map">
          <DamageHeatMapPanel assessments={list} onSelectId={setSelectedId} />
        </TabsContent>

        <TabsContent value="gantt">
          <RepairGanttChart assessments={list} />
        </TabsContent>

        <TabsContent value="table">
      {/* Assessment Table */}
      <Card className="border-border/50">
        <CardContent className="p-0">
          {listLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading assessments...</div>
          ) : list.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <ShieldAlert className="w-10 h-10 text-muted-foreground mx-auto" />
              <div className="text-muted-foreground text-sm">No damage assessments found.</div>
              <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                {seedMutation.isPending ? "Loading..." : "Load Demo Data (10 Middle East scenarios)"}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="text-left p-3 font-semibold text-xs text-muted-foreground">ID</th>
                    <th className="text-left p-3 font-semibold text-xs text-muted-foreground">Asset</th>
                    <th className="text-left p-3 font-semibold text-xs text-muted-foreground">Field / Country</th>
                    <th className="text-left p-3 font-semibold text-xs text-muted-foreground">Classification</th>
                    <th className="text-left p-3 font-semibold text-xs text-muted-foreground">Triage Score</th>
                    <th className="text-left p-3 font-semibold text-xs text-muted-foreground">Priority</th>
                    <th className="text-left p-3 font-semibold text-xs text-muted-foreground">Prod. Loss (BPD)</th>
                    <th className="text-left p-3 font-semibold text-xs text-muted-foreground">Repair Cost</th>
                    <th className="text-left p-3 font-semibold text-xs text-muted-foreground">Status</th>
                    <th className="text-left p-3 font-semibold text-xs text-muted-foreground">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(row => (
                    <tr
                      key={row.id as number}
                      className="border-b border-border/30 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => setSelectedId(row.id as number)}
                    >
                      <td className="p-3 font-mono text-xs text-muted-foreground">{row.assessment_id as string}</td>
                      <td className="p-3">
                        <div className="font-semibold truncate max-w-[180px]">{row.asset_name as string}</div>
                        <div className="text-xs text-muted-foreground">{(row.asset_type as string).replace(/_/g, " ")}</div>
                      </td>
                      <td className="p-3 text-xs">
                        <div>{(row.field_name as string) ?? "—"}</div>
                        <div className="text-muted-foreground">{row.country as string}</div>
                      </td>
                      <td className="p-3">{classificationBadge(row.classification as string)}</td>
                      <td className="p-3 w-28">{triageScoreBar(Number(row.triage_score) ?? 0)}</td>
                      <td className="p-3">{priorityBadge(row.repair_priority as string)}</td>
                      <td className="p-3 text-right font-mono">
                        {Number(row.production_loss_bpd) > 0
                          ? <span className="text-red-500 font-semibold">{Number(row.production_loss_bpd).toLocaleString()}</span>
                          : <span className="text-muted-foreground">—</span>
                        }
                      </td>
                      <td className="p-3 text-xs">{formatCurrency(row.estimated_repair_cost_usd as number)}</td>
                      <td className="p-3">
                        <span className="text-xs px-2 py-0.5 rounded bg-muted">
                          {(row.repair_status as string).replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          {(row.hse_risk as boolean) && <AlertTriangle className="w-3 h-3 text-red-500" />}
                          {(row.environmental_risk as boolean) && <Wind className="w-3 h-3 text-orange-500" />}
                          {!(row.access_safe as boolean) && <XCircle className="w-3 h-3 text-yellow-500" />}
                          {(row.ai_summary as string) && <Brain className="w-3 h-3 text-purple-500" />}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Sheet */}
      <AssessmentDetailSheet
        assessmentId={selectedId}
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
