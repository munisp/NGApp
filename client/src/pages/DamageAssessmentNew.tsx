/**
 * DamageAssessmentNew.tsx — Mobile-First Damage Assessment Form
 *
 * Optimised for field use on a phone or tablet:
 * - Single-column, large touch targets
 * - GPS auto-fill for coordinates
 * - Camera capture → PaddleOCR + LLaVA auto-classification
 * - Offline-safe: form state persisted in localStorage
 */

import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, MapPin, Camera, Upload, Loader2, CheckCircle2, AlertTriangle, Brain, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const DAMAGE_LEVELS = [
  { value: "DESTROYED", label: "Destroyed", color: "bg-red-600", desc: "Total loss — no salvageable components" },
  { value: "SEVERELY_DAMAGED", label: "Severely Damaged", color: "bg-orange-500", desc: "Major structural damage, out of service" },
  { value: "MODERATELY_DAMAGED", label: "Moderately Damaged", color: "bg-amber-500", desc: "Significant damage, reduced capacity" },
  { value: "MINOR_DAMAGE", label: "Minor Damage", color: "bg-yellow-500", desc: "Superficial damage, operational with care" },
  { value: "INTACT", label: "Intact", color: "bg-emerald-500", desc: "No visible damage" },
];

const ASSET_TYPES = [
  { value: "WELLHEAD", label: "Wellhead" },
  { value: "PIPELINE", label: "Pipeline" },
  { value: "SEPARATOR", label: "Separator" },
  { value: "PUMP_STATION", label: "Pump Station" },
  { value: "STORAGE_TANK", label: "Storage Tank" },
  { value: "CONTROL_ROOM", label: "Control Room" },
  { value: "POWER_SUPPLY", label: "Power Supply" },
  { value: "ROAD_ACCESS", label: "Road / Access" },
  { value: "FLARE_SYSTEM", label: "Flare System" },
  { value: "COMPRESSOR", label: "Compressor" },
];

interface AIResult {
  severity?: string;
  asset_type?: string;
  description?: string;
  confidence?: number;
  ocr_text?: string;
}

export default function DamageAssessmentNew() {
  const [, navigate] = useLocation();

  // Form state
  const [assetName, setAssetName] = useState("");
  const [assetType, setAssetType] = useState("");
  const [fieldName, setFieldName] = useState("");
  const [country, setCountry] = useState("Iraq");
  const [classification, setClassification] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [productionLoss, setProductionLoss] = useState("");
  const [hseRisk, setHseRisk] = useState(false);
  const [envRisk, setEnvRisk] = useState(false);
  const [accessSafe, setAccessSafe] = useState(true);
  const [notes, setNotes] = useState("");
  const [assessorName, setAssessorName] = useState("");

  // Image / AI state
  const [capturedImage, setCapturedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [step, setStep] = useState<"capture" | "details" | "review">("capture");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const createAssessment = trpc.damageAssessment.create.useMutation({
    onSuccess: (data) => {
      toast.success("Assessment submitted successfully");
      utils.damageAssessment.list.invalidate();
      navigate("/damage-assessment");
    },
    onError: (e) => toast.error(`Submission failed: ${e.message}`),
  });

  // GPS auto-fill
  const handleGPS = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported on this device");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setGpsLoading(false);
        toast.success("GPS coordinates captured");
      },
      (err) => {
        setGpsLoading(false);
        toast.error(`GPS error: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Image capture handler
  const handleImageCapture = useCallback(async (file: File) => {
    setCapturedImage(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
    setAiResult(null);

    // Run AI classification via ML service
    setAiLoading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/damage/analyze-image", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (response.ok) {
        const result = await response.json();
        setAiResult(result);

        // Auto-fill form from AI results
        if (result.severity && !classification) setClassification(result.severity);
        if (result.asset_type && !assetType) setAssetType(result.asset_type);
        if (result.description && !notes) setNotes(result.description);

        toast.success("AI analysis complete — form auto-filled");
      } else {
        toast.warning("AI analysis unavailable — please fill form manually");
      }
    } catch {
      toast.warning("AI service offline — please fill form manually");
    } finally {
      setAiLoading(false);
    }
  }, [classification, assetType, notes]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageCapture(file);
  };

  const handleSubmit = () => {
    if (!assetName || !assetType || !classification || !fieldName) {
      toast.error("Please fill in all required fields");
      return;
    }
    createAssessment.mutate({
      assetName,
      assetType,
      fieldName,
      country,
      classification,
      coordinates: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : undefined,
      productionLossBpd: productionLoss ? parseFloat(productionLoss) : 0,
      hseRisk,
      environmentalRisk: envRisk,
      accessSafe,
      description: notes,
      assessedBy: assessorName || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/50 px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => navigate("/damage-assessment")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-foreground">New Damage Assessment</h1>
          <p className="text-[10px] text-muted-foreground">Field Triage Form</p>
        </div>
        {/* Step indicator */}
        <div className="flex gap-1">
          {(["capture", "details", "review"] as const).map((s, i) => (
            <div key={s} className={cn(
              "w-2 h-2 rounded-full transition-colors",
              step === s ? "bg-primary" : i < ["capture", "details", "review"].indexOf(step) ? "bg-primary/40" : "bg-muted"
            )} />
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 md:px-0 pb-24">

        {/* ── STEP 1: Capture ── */}
        {step === "capture" && (
          <div className="space-y-6 pt-6">
            <div className="text-center space-y-1">
              <h2 className="text-base font-semibold">Capture Evidence</h2>
              <p className="text-xs text-muted-foreground">Take a photo or upload an image. AI will auto-classify the damage.</p>
            </div>

            {/* Image preview */}
            {imagePreview ? (
              <div className="relative rounded-xl overflow-hidden border border-border/50">
                <img src={imagePreview} alt="Captured" className="w-full h-56 object-cover" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 h-8 w-8 p-0 bg-black/50 hover:bg-black/70 text-white"
                  onClick={() => { setCapturedImage(null); setImagePreview(null); setAiResult(null); }}
                >
                  <X className="w-4 h-4" />
                </Button>
                {aiLoading && (
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                    <p className="text-white text-xs font-medium">AI analysing damage…</p>
                    <p className="text-white/60 text-[10px]">PaddleOCR + LLaVA VLM</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="border-2 border-dashed border-border/50 rounded-xl p-8 text-center space-y-4">
                <Camera className="w-12 h-12 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">No image captured</p>
              </div>
            )}

            {/* AI Result Badge */}
            {aiResult && !aiLoading && (
              <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-400">AI Analysis Complete</span>
                  {aiResult.confidence && (
                    <span className="ml-auto text-[10px] text-emerald-400/70">{Math.round(aiResult.confidence * 100)}% confidence</span>
                  )}
                </div>
                {aiResult.severity && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-20">Severity:</span>
                    <span className="text-xs font-medium text-foreground">{aiResult.severity.replace(/_/g, " ")}</span>
                  </div>
                )}
                {aiResult.asset_type && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-20">Asset type:</span>
                    <span className="text-xs font-medium text-foreground">{aiResult.asset_type.replace(/_/g, " ")}</span>
                  </div>
                )}
                {aiResult.description && (
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{aiResult.description}</p>
                )}
                {aiResult.ocr_text && (
                  <div className="bg-muted/20 rounded p-2">
                    <p className="text-[9px] text-muted-foreground font-mono">{aiResult.ocr_text.slice(0, 120)}{aiResult.ocr_text.length > 120 ? "…" : ""}</p>
                  </div>
                )}
              </div>
            )}

            {/* Capture buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-14 flex-col gap-1 text-xs"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="w-5 h-5" />
                Take Photo
              </Button>
              <Button
                variant="outline"
                className="h-14 flex-col gap-1 text-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-5 h-5" />
                Upload Image
              </Button>
            </div>

            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

            <Button className="w-full h-12 text-sm" onClick={() => setStep("details")}>
              Continue to Details →
            </Button>
          </div>
        )}

        {/* ── STEP 2: Details ── */}
        {step === "details" && (
          <div className="space-y-5 pt-6">
            <div className="text-center space-y-1">
              <h2 className="text-base font-semibold">Asset Details</h2>
              <p className="text-xs text-muted-foreground">Fill in the damage assessment details. Required fields are marked *.</p>
            </div>

            {/* Asset Name */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Asset Name *</Label>
              <Input
                className="h-12 text-sm"
                placeholder="e.g. Well W-14 Wellhead, Pipeline Segment 7A"
                value={assetName}
                onChange={e => setAssetName(e.target.value)}
              />
            </div>

            {/* Asset Type */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Asset Type *</Label>
              <Select value={assetType} onValueChange={setAssetType}>
                <SelectTrigger className="h-12 text-sm">
                  <SelectValue placeholder="Select asset type…" />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_TYPES.map(a => (
                    <SelectItem key={a.value} value={a.value} className="text-sm py-3">{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Field Name */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Field / Facility Name *</Label>
              <Input
                className="h-12 text-sm"
                placeholder="e.g. Rumaila North, Kirkuk Field"
                value={fieldName}
                onChange={e => setFieldName(e.target.value)}
              />
            </div>

            {/* Country */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="h-12 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Iraq", "Kuwait", "Saudi Arabia", "UAE", "Oman", "Qatar", "Libya", "Syria", "Yemen", "Lebanon"].map(c => (
                    <SelectItem key={c} value={c} className="text-sm py-3">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Damage Classification */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Damage Classification *</Label>
              <div className="grid grid-cols-1 gap-2">
                {DAMAGE_LEVELS.map(d => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setClassification(d.value)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                      classification === d.value
                        ? "border-primary bg-primary/10"
                        : "border-border/40 hover:border-border/80"
                    )}
                  >
                    <div className={cn("w-3 h-3 rounded-full flex-shrink-0", d.color)} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{d.label}</p>
                      <p className="text-[11px] text-muted-foreground">{d.desc}</p>
                    </div>
                    {classification === d.value && (
                      <CheckCircle2 className="w-4 h-4 text-primary ml-auto flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* GPS Coordinates */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">GPS Coordinates</Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={handleGPS}
                  disabled={gpsLoading}
                >
                  {gpsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
                  {gpsLoading ? "Getting GPS…" : "Auto-fill GPS"}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input className="h-12 text-sm font-mono" placeholder="Latitude" value={lat} onChange={e => setLat(e.target.value)} />
                <Input className="h-12 text-sm font-mono" placeholder="Longitude" value={lng} onChange={e => setLng(e.target.value)} />
              </div>
            </div>

            {/* Production Loss */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Estimated Production Loss (bbl/d)</Label>
              <Input
                className="h-12 text-sm"
                type="number"
                placeholder="0"
                value={productionLoss}
                onChange={e => setProductionLoss(e.target.value)}
              />
            </div>

            {/* Risk flags */}
            <div className="space-y-3 bg-muted/20 rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Risk Flags</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">HSE Risk</p>
                  <p className="text-xs text-muted-foreground">Immediate health, safety or environmental hazard</p>
                </div>
                <Switch checked={hseRisk} onCheckedChange={setHseRisk} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Environmental Risk</p>
                  <p className="text-xs text-muted-foreground">Spill, contamination, or ecological threat</p>
                </div>
                <Switch checked={envRisk} onCheckedChange={setEnvRisk} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Site Access Safe</p>
                  <p className="text-xs text-muted-foreground">Repair crews can safely access this location</p>
                </div>
                <Switch checked={accessSafe} onCheckedChange={setAccessSafe} />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Field Notes</Label>
              <Textarea
                className="text-sm min-h-[100px] resize-none"
                placeholder="Describe the damage, visible hazards, access conditions, or any other relevant observations…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            {/* Assessor Name */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Assessor Name</Label>
              <Input
                className="h-12 text-sm"
                placeholder="Your name"
                value={assessorName}
                onChange={e => setAssessorName(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-12" onClick={() => setStep("capture")}>
                ← Back
              </Button>
              <Button className="flex-1 h-12 text-sm" onClick={() => setStep("review")}>
                Review →
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Review & Submit ── */}
        {step === "review" && (
          <div className="space-y-5 pt-6">
            <div className="text-center space-y-1">
              <h2 className="text-base font-semibold">Review & Submit</h2>
              <p className="text-xs text-muted-foreground">Confirm the details before submitting the assessment.</p>
            </div>

            {/* Summary card */}
            <div className="bg-muted/20 rounded-xl border border-border/40 divide-y divide-border/30">
              {[
                { label: "Asset", value: assetName || "—" },
                { label: "Type", value: assetType.replace(/_/g, " ") || "—" },
                { label: "Field", value: fieldName || "—" },
                { label: "Country", value: country },
                { label: "Classification", value: classification.replace(/_/g, " ") || "—" },
                { label: "Coordinates", value: lat && lng ? `${lat}, ${lng}` : "Not set" },
                { label: "Production Loss", value: productionLoss ? `${productionLoss} bbl/d` : "0 bbl/d" },
                { label: "HSE Risk", value: hseRisk ? "Yes ⚠️" : "No" },
                { label: "Env Risk", value: envRisk ? "Yes ⚠️" : "No" },
                { label: "Site Access", value: accessSafe ? "Safe ✓" : "Unsafe ⚠️" },
                { label: "Assessor", value: assessorName || "Anonymous" },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between px-4 py-3">
                  <span className="text-xs text-muted-foreground">{row.label}</span>
                  <span className="text-xs font-medium text-foreground text-right max-w-[60%]">{row.value}</span>
                </div>
              ))}
            </div>

            {/* Image thumbnail */}
            {imagePreview && (
              <div className="rounded-xl overflow-hidden border border-border/50">
                <img src={imagePreview} alt="Evidence" className="w-full h-32 object-cover" />
                <div className="px-3 py-2 bg-muted/20 flex items-center gap-2">
                  <Camera className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Evidence photo attached</span>
                  {aiResult && <span className="text-[10px] text-emerald-400 ml-auto">AI classified ✓</span>}
                </div>
              </div>
            )}

            {/* Validation warnings */}
            {(!assetName || !assetType || !classification || !fieldName) && (
              <div className="flex items-start gap-2 bg-amber-950/30 border border-amber-800/40 rounded-xl p-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">
                  Missing required fields: {[!assetName && "Asset Name", !assetType && "Asset Type", !classification && "Classification", !fieldName && "Field Name"].filter(Boolean).join(", ")}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-12" onClick={() => setStep("details")}>
                ← Edit
              </Button>
              <Button
                className="flex-1 h-12 text-sm font-semibold"
                onClick={handleSubmit}
                disabled={!assetName || !assetType || !classification || !fieldName || createAssessment.isPending}
              >
                {createAssessment.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting…</>
                ) : (
                  "Submit Assessment"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
