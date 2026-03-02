"use client";

import { useState, useCallback } from "react";
import {
  UserCheck,
  Building2,
  Upload,
  Camera,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  FileText,
  Shield,
  Scan,
  Fingerprint,
  Eye,
  SmilePlus,
  ArrowUpDown,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { useKYCApplications, useKYBApplications, useStakeholderTypes, useOnboardingRequirements, useCreateKYC, useCreateKYB } from "@/lib/api-hooks";

/* ─── Status badge ────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    document_uploaded: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    ocr_processing: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    ocr_complete: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    liveness_pending: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    liveness_complete: "bg-teal-500/10 text-teal-400 border-teal-500/20",
    under_review: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    rejected: "bg-red-500/10 text-red-400 border-red-500/20",
    processing: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };
  const labels: Record<string, string> = {
    pending: "Pending",
    document_uploaded: "Document Uploaded",
    ocr_processing: "Processing OCR",
    ocr_complete: "OCR Complete",
    liveness_pending: "Liveness Pending",
    liveness_complete: "Liveness Complete",
    under_review: "Under Review",
    approved: "Approved",
    rejected: "Rejected",
    processing: "Processing",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${colors[status] ?? colors.pending}`}>
      {labels[status] ?? status}
    </span>
  );
}

/* ─── Risk badge ──────────────────────────────────────────────────────── */
function RiskBadge({ level }: { level: string }) {
  const c: Record<string, string> = {
    low: "bg-emerald-500/10 text-emerald-400",
    medium: "bg-yellow-500/10 text-yellow-400",
    high: "bg-orange-500/10 text-orange-400",
    critical: "bg-red-500/10 text-red-400",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${c[level] ?? c.low}`}>
      {level.toUpperCase()}
    </span>
  );
}

/* ─── Liveness challenge icon ─────────────────────────────────────────── */
function ChallengeIcon({ type }: { type: string }) {
  const icons: Record<string, typeof Eye> = {
    blink: Eye,
    turn_left: RotateCcw,
    turn_right: RotateCcw,
    smile: SmilePlus,
    nod: ArrowUpDown,
    raise_eyebrows: Fingerprint,
  };
  const Icon = icons[type] ?? Eye;
  return <Icon className="h-5 w-5" />;
}

/* ══════════════════════════════════════════════════════════════════════ */

type Tab = "kyc" | "kyb";
type KYCStep = "type" | "personal" | "document" | "liveness" | "status";
type KYBStep = "type" | "business" | "documents" | "screening" | "status";

export default function OnboardingPage() {
  const [activeTab, setActiveTab] = useState<Tab>("kyc");
  const [kycStep, setKycStep] = useState<KYCStep>("type");
  const [kybStep, setKybStep] = useState<KYBStep>("type");
  const [selectedType, setSelectedType] = useState<string>("");
  const [showNewForm, setShowNewForm] = useState(false);

  const { applications: kycApps, loading: kycLoading } = useKYCApplications();
  const { applications: kybApps, loading: kybLoading } = useKYBApplications();
  const { types, loading: typesLoading } = useStakeholderTypes();
  const { requirements } = useOnboardingRequirements(selectedType);
  const { createKYC, loading: creatingKYC } = useCreateKYC();
  const { createKYB, loading: creatingKYB } = useCreateKYB();

  /* KYC form state */
  const [kycForm, setKycForm] = useState({
    full_name: "",
    email: "",
    phone_number: "",
    date_of_birth: "",
    nationality: "Nigerian",
    address: "",
    bvn: "",
    nin: "",
  });

  /* KYB form state */
  const [kybForm, setKybForm] = useState({
    business_name: "",
    registration_number: "",
    tax_id: "",
    business_type: "Private Limited Company",
    incorporation_date: "",
    registered_address: "",
    business_address: "",
    industry: "",
    annual_revenue: "",
    employee_count: "",
    website: "",
  });

  /* ── Handlers ─────────────────────────────────────────────────────── */
  const handleSelectType = useCallback((typeId: string) => {
    setSelectedType(typeId);
    const needsKyb = types?.find((t: Record<string, unknown>) => t.id === typeId)?.kyb_required;
    if (needsKyb) {
      setActiveTab("kyb");
      setKybStep("business");
    } else {
      setActiveTab("kyc");
      setKycStep("personal");
    }
    setShowNewForm(true);
  }, [types]);

  const handleSubmitKYC = useCallback(async () => {
    await createKYC({
      account_id: `ACC-${Date.now()}`,
      stakeholder_type: selectedType || "retail_trader",
      ...kycForm,
    });
    setKycStep("document");
  }, [createKYC, kycForm, selectedType]);

  const handleSubmitKYB = useCallback(async () => {
    await createKYB({
      account_id: `ACC-BIZ-${Date.now()}`,
      stakeholder_type: selectedType || "broker_dealer",
      ...kybForm,
      employee_count: kybForm.employee_count ? parseInt(kybForm.employee_count) : undefined,
    });
    setKybStep("documents");
  }, [createKYB, kybForm, selectedType]);

  /* ── KYC Steps ────────────────────────────────────────────────────── */
  const kycSteps: { key: KYCStep; label: string; icon: typeof UserCheck }[] = [
    { key: "type", label: "Account Type", icon: UserCheck },
    { key: "personal", label: "Personal Info", icon: FileText },
    { key: "document", label: "Document Upload", icon: Upload },
    { key: "liveness", label: "Face Verification", icon: Camera },
    { key: "status", label: "Review Status", icon: Shield },
  ];

  const kybSteps: { key: KYBStep; label: string; icon: typeof Building2 }[] = [
    { key: "type", label: "Account Type", icon: Building2 },
    { key: "business", label: "Business Info", icon: FileText },
    { key: "documents", label: "Documents", icon: Upload },
    { key: "screening", label: "Screening", icon: Shield },
    { key: "status", label: "Review Status", icon: CheckCircle2 },
  ];

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Onboarding & Verification</h1>
        <p className="mt-1 text-sm text-gray-400">
          Complete your identity verification to start trading on NEXCOM Exchange
        </p>
      </div>

      {/* Tab selector */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => { setActiveTab("kyc"); setShowNewForm(false); }}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
            activeTab === "kyc"
              ? "bg-brand-500/20 text-brand-400 border border-brand-500/30"
              : "text-gray-400 hover:text-white border border-white/[0.06]"
          }`}
        >
          <UserCheck className="h-4 w-4" />
          Individual KYC
        </button>
        <button
          onClick={() => { setActiveTab("kyb"); setShowNewForm(false); }}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
            activeTab === "kyb"
              ? "bg-brand-500/20 text-brand-400 border border-brand-500/30"
              : "text-gray-400 hover:text-white border border-white/[0.06]"
          }`}
        >
          <Building2 className="h-4 w-4" />
          Business KYB
        </button>
        <button
          onClick={() => { setShowNewForm(true); setKycStep("type"); setKybStep("type"); }}
          className="ml-auto flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition-colors"
        >
          Start New Application
        </button>
      </div>

      {/* ── New Application Flow ──────────────────────────────────────── */}
      {showNewForm ? (
        <div className="space-y-6">
          {/* Step indicator */}
          <div className="flex items-center gap-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            {(activeTab === "kyc" ? kycSteps : kybSteps).map((step, idx) => {
              const currentIdx = activeTab === "kyc"
                ? kycSteps.findIndex((s) => s.key === kycStep)
                : kybSteps.findIndex((s) => s.key === kybStep);
              const isComplete = idx < currentIdx;
              const isCurrent = idx === currentIdx;
              const StepIcon = step.icon;
              return (
                <div key={step.key} className="flex items-center gap-1 flex-1">
                  <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                    isCurrent ? "bg-brand-500/20 text-brand-400" : isComplete ? "text-emerald-400" : "text-gray-600"
                  }`}>
                    {isComplete ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <StepIcon className="h-4 w-4" />}
                    <span className="hidden sm:inline">{step.label}</span>
                  </div>
                  {idx < (activeTab === "kyc" ? kycSteps : kybSteps).length - 1 && (
                    <ChevronRight className="h-4 w-4 text-gray-700 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Step: Choose type */}
          {((activeTab === "kyc" && kycStep === "type") || (activeTab === "kyb" && kybStep === "type")) && (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
              <h2 className="text-lg font-semibold text-white mb-1">Choose Your Account Type</h2>
              <p className="text-sm text-gray-400 mb-6">Select the account type that best describes your role on the exchange</p>
              {typesLoading ? (
                <div className="flex items-center gap-2 text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {(types ?? []).map((t: Record<string, unknown>) => (
                    <button
                      key={t.id as string}
                      onClick={() => handleSelectType(t.id as string)}
                      className={`group flex flex-col items-start gap-3 rounded-xl border p-5 text-left transition-all hover:border-brand-500/40 hover:bg-brand-500/5 ${
                        selectedType === t.id ? "border-brand-500/50 bg-brand-500/10" : "border-white/[0.06] bg-white/[0.01]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {t.kyb_required ? <Building2 className="h-5 w-5 text-purple-400" /> : <UserCheck className="h-5 w-5 text-brand-400" />}
                        <span className="text-sm font-semibold text-white">{t.name as string}</span>
                      </div>
                      <p className="text-xs text-gray-400 leading-relaxed">{t.description as string}</p>
                      <div className="flex items-center gap-2 mt-auto">
                        <span className="text-[10px] font-medium text-gray-500">{t.estimated_time as string}</span>
                        {Boolean(t.kyb_required) && (
                          <span className="text-[10px] font-medium text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">KYB Required</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step: Personal info (KYC) */}
          {activeTab === "kyc" && kycStep === "personal" && (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
              <h2 className="text-lg font-semibold text-white mb-1">Personal Information</h2>
              <p className="text-sm text-gray-400 mb-6">Please provide your personal details as they appear on your government-issued ID</p>

              {requirements && (
                <div className="mb-6 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                  <p className="text-xs font-medium text-blue-400 mb-2">Required for {selectedType.replace(/_/g, " ")}</p>
                  <div className="flex flex-wrap gap-2">
                    {(requirements.kyc_steps as string[] ?? []).map((step: string) => (
                      <span key={step} className="text-[10px] text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-full">{step.replace(/_/g, " ")}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    value={kycForm.full_name}
                    onChange={(e) => setKycForm({ ...kycForm, full_name: e.target.value })}
                    placeholder="Enter your full legal name"
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Email Address *</label>
                  <input
                    type="email"
                    value={kycForm.email}
                    onChange={(e) => setKycForm({ ...kycForm, email: e.target.value })}
                    placeholder="your@email.com"
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Phone Number *</label>
                  <input
                    type="tel"
                    value={kycForm.phone_number}
                    onChange={(e) => setKycForm({ ...kycForm, phone_number: e.target.value })}
                    placeholder="+234-XXX-XXX-XXXX"
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Date of Birth *</label>
                  <input
                    type="date"
                    value={kycForm.date_of_birth}
                    onChange={(e) => setKycForm({ ...kycForm, date_of_birth: e.target.value })}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Nationality</label>
                  <input
                    type="text"
                    value={kycForm.nationality}
                    onChange={(e) => setKycForm({ ...kycForm, nationality: e.target.value })}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Address *</label>
                  <input
                    type="text"
                    value={kycForm.address}
                    onChange={(e) => setKycForm({ ...kycForm, address: e.target.value })}
                    placeholder="Street address, city, state"
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">BVN (Bank Verification Number)</label>
                  <input
                    type="text"
                    value={kycForm.bvn}
                    onChange={(e) => setKycForm({ ...kycForm, bvn: e.target.value })}
                    placeholder="11-digit BVN"
                    maxLength={11}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">NIN (National Identification Number)</label>
                  <input
                    type="text"
                    value={kycForm.nin}
                    onChange={(e) => setKycForm({ ...kycForm, nin: e.target.value })}
                    placeholder="11-digit NIN"
                    maxLength={11}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-between">
                <button onClick={() => setKycStep("type")} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <button
                  onClick={handleSubmitKYC}
                  disabled={creatingKYC || !kycForm.full_name || !kycForm.email}
                  className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50 transition-colors"
                >
                  {creatingKYC ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                  Continue to Document Upload
                </button>
              </div>
            </div>
          )}

          {/* Step: Document upload (KYC) */}
          {activeTab === "kyc" && kycStep === "document" && (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
              <h2 className="text-lg font-semibold text-white mb-1">Identity Document Upload</h2>
              <p className="text-sm text-gray-400 mb-6">Upload a clear photo of your government-issued ID. We&apos;ll verify it using AI-powered OCR and document analysis.</p>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { type: "national_id", label: "National ID Card (NIN)", desc: "Nigerian National Identity Card with NIN" },
                  { type: "international_passport", label: "International Passport", desc: "Valid Nigerian or foreign passport" },
                  { type: "drivers_license", label: "Driver's License", desc: "Valid Nigerian driver's license" },
                  { type: "voters_card", label: "Voter's Card", desc: "Permanent Voter's Card (PVC)" },
                  { type: "nin_slip", label: "NIN Slip", desc: "Printed NIN registration slip" },
                  { type: "utility_bill", label: "Utility Bill", desc: "Recent utility bill for address verification" },
                ].map((doc) => (
                  <div key={doc.type} className="group rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 hover:border-brand-500/30 transition-all">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10">
                        <Scan className="h-5 w-5 text-brand-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{doc.label}</p>
                        <p className="text-[11px] text-gray-500">{doc.desc}</p>
                      </div>
                    </div>
                    <div className="flex h-24 items-center justify-center rounded-lg border-2 border-dashed border-white/[0.08] bg-white/[0.01] cursor-pointer hover:border-brand-500/30 transition-colors">
                      <div className="text-center">
                        <Upload className="mx-auto h-5 w-5 text-gray-500 mb-1" />
                        <p className="text-[11px] text-gray-500">Click or drag to upload</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-[10px] text-gray-600">
                      <Shield className="h-3 w-3" />
                      <span>PaddleOCR + VLM verification</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-start gap-3">
                  <Scan className="h-5 w-5 text-emerald-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-emerald-400">AI-Powered Verification</p>
                    <p className="text-xs text-emerald-400/70 mt-1">
                      Documents are verified using PaddleOCR for text extraction, Docling for structured parsing,
                      and VLM for authenticity analysis including tampering detection, security feature validation, and face matching.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-between">
                <button onClick={() => setKycStep("personal")} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <button
                  onClick={() => setKycStep("liveness")}
                  className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                  Continue to Face Verification
                </button>
              </div>
            </div>
          )}

          {/* Step: Liveness detection (KYC) */}
          {activeTab === "kyc" && kycStep === "liveness" && (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
              <h2 className="text-lg font-semibold text-white mb-1">Face Verification (Liveness Detection)</h2>
              <p className="text-sm text-gray-400 mb-6">
                Complete the face verification challenges to prove you are a real person. Our system uses 468-point face mesh analysis with anti-spoofing protection.
              </p>

              <div className="grid gap-6 lg:grid-cols-2">
                {/* Camera preview */}
                <div className="rounded-xl border border-white/[0.08] bg-black/30 p-4">
                  <div className="relative aspect-[4/3] rounded-lg bg-gray-900 flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-4 border-2 border-brand-500/40 rounded-[40%] animate-pulse" />
                    <div className="text-center z-10">
                      <Camera className="mx-auto h-12 w-12 text-brand-400 mb-3" />
                      <p className="text-sm font-medium text-white">Camera Preview</p>
                      <p className="text-xs text-gray-400 mt-1">Position your face within the frame</p>
                    </div>
                  </div>
                  <button className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-medium text-white hover:bg-brand-500 transition-colors">
                    <Camera className="h-4 w-4" />
                    Start Camera
                  </button>
                </div>

                {/* Challenges list */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-300">Verification Challenges</h3>
                  {[
                    { type: "blink", label: "Blink Detection", desc: "Blink your eyes naturally while looking at the camera" },
                    { type: "turn_left", label: "Turn Left", desc: "Slowly turn your head to the left" },
                    { type: "smile", label: "Smile Detection", desc: "Please smile naturally at the camera" },
                  ].map((challenge, i) => (
                    <div key={challenge.type} className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        i === 0 ? "bg-brand-500/20 text-brand-400" : "bg-white/[0.04] text-gray-500"
                      }`}>
                        <ChallengeIcon type={challenge.type} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">{challenge.label}</p>
                        <p className="text-[11px] text-gray-500">{challenge.desc}</p>
                      </div>
                      {i === 0 ? (
                        <span className="text-[11px] font-medium text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full">Current</span>
                      ) : (
                        <span className="text-[11px] text-gray-600">Waiting</span>
                      )}
                    </div>
                  ))}

                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <div className="flex items-start gap-3">
                      <Fingerprint className="h-5 w-5 text-amber-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-400">Anti-Spoofing Protection</p>
                        <p className="text-xs text-amber-400/70 mt-1">
                          Our system detects printed photos, screen replays, and masks using texture analysis,
                          depth estimation, and micro-movement detection with MediaPipe Face Mesh.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-between">
                <button onClick={() => setKycStep("document")} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <button
                  onClick={() => setKycStep("status")}
                  className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Submit for Review
                </button>
              </div>
            </div>
          )}

          {/* Step: Status (KYC) */}
          {activeTab === "kyc" && kycStep === "status" && (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-500/20 mb-4">
                <CheckCircle2 className="h-8 w-8 text-brand-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Application Submitted</h2>
              <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto">
                Your KYC application has been submitted for review. Our compliance team will verify your documents
                and you&apos;ll be notified once the review is complete.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-yellow-500/10 border border-yellow-500/20 px-4 py-2 text-sm font-medium text-yellow-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Under Review — Estimated time: 15-30 minutes
              </div>
              <div className="mt-6">
                <button onClick={() => { setShowNewForm(false); }} className="text-sm text-brand-400 hover:text-brand-300">
                  View All Applications
                </button>
              </div>
            </div>
          )}

          {/* Step: Business info (KYB) */}
          {activeTab === "kyb" && kybStep === "business" && (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
              <h2 className="text-lg font-semibold text-white mb-1">Business Information</h2>
              <p className="text-sm text-gray-400 mb-6">Provide your company details as registered with the Corporate Affairs Commission (CAC)</p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Business Name *</label>
                  <input type="text" value={kybForm.business_name} onChange={(e) => setKybForm({ ...kybForm, business_name: e.target.value })}
                    placeholder="Legal business name" className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">CAC Registration Number *</label>
                  <input type="text" value={kybForm.registration_number} onChange={(e) => setKybForm({ ...kybForm, registration_number: e.target.value })}
                    placeholder="RC-XXXXXXX or BN-XXXXXXX" className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Tax ID (TIN)</label>
                  <input type="text" value={kybForm.tax_id} onChange={(e) => setKybForm({ ...kybForm, tax_id: e.target.value })}
                    placeholder="TIN-XXXXXXXX" className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Business Type</label>
                  <select value={kybForm.business_type} onChange={(e) => setKybForm({ ...kybForm, business_type: e.target.value })}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none">
                    <option value="Private Limited Company">Private Limited Company</option>
                    <option value="Public Limited Company">Public Limited Company</option>
                    <option value="Foreign Subsidiary">Foreign Subsidiary</option>
                    <option value="Partnership">Partnership</option>
                    <option value="Sole Proprietorship">Sole Proprietorship</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Incorporation Date</label>
                  <input type="date" value={kybForm.incorporation_date} onChange={(e) => setKybForm({ ...kybForm, incorporation_date: e.target.value })}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Industry *</label>
                  <input type="text" value={kybForm.industry} onChange={(e) => setKybForm({ ...kybForm, industry: e.target.value })}
                    placeholder="e.g., Securities Trading" className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Registered Address *</label>
                  <input type="text" value={kybForm.registered_address} onChange={(e) => setKybForm({ ...kybForm, registered_address: e.target.value })}
                    placeholder="Full registered address" className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Annual Revenue (NGN)</label>
                  <input type="text" value={kybForm.annual_revenue} onChange={(e) => setKybForm({ ...kybForm, annual_revenue: e.target.value })}
                    placeholder="e.g., 500,000,000" className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Number of Employees</label>
                  <input type="number" value={kybForm.employee_count} onChange={(e) => setKybForm({ ...kybForm, employee_count: e.target.value })}
                    placeholder="e.g., 50" className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none" />
                </div>
              </div>

              <div className="mt-6 flex justify-between">
                <button onClick={() => setKybStep("type")} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <button
                  onClick={handleSubmitKYB}
                  disabled={creatingKYB || !kybForm.business_name || !kybForm.registration_number}
                  className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50 transition-colors"
                >
                  {creatingKYB ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                  Continue to Documents
                </button>
              </div>
            </div>
          )}

          {/* Step: Documents (KYB) */}
          {activeTab === "kyb" && kybStep === "documents" && (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
              <h2 className="text-lg font-semibold text-white mb-1">Corporate Document Upload</h2>
              <p className="text-sm text-gray-400 mb-6">Upload required business documents for verification</p>

              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { type: "cac_certificate", label: "CAC Certificate", desc: "Certificate of Incorporation from CAC" },
                  { type: "memorandum_of_association", label: "Memorandum of Association", desc: "Company MoA" },
                  { type: "board_resolution", label: "Board Resolution", desc: "Board resolution authorizing trading" },
                  { type: "tax_clearance", label: "Tax Clearance Certificate", desc: "Valid FIRS tax clearance" },
                  { type: "audited_financials", label: "Audited Financial Statements", desc: "Latest audited financials" },
                  { type: "shareholder_register", label: "Shareholder Register", desc: "Current register of shareholders" },
                ].map((doc) => (
                  <div key={doc.type} className="group rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 hover:border-brand-500/30 transition-all">
                    <div className="flex items-center gap-3 mb-3">
                      <FileText className="h-5 w-5 text-purple-400" />
                      <div>
                        <p className="text-sm font-medium text-white">{doc.label}</p>
                        <p className="text-[11px] text-gray-500">{doc.desc}</p>
                      </div>
                    </div>
                    <div className="flex h-16 items-center justify-center rounded-lg border-2 border-dashed border-white/[0.08] bg-white/[0.01] cursor-pointer hover:border-purple-500/30 transition-colors">
                      <div className="text-center">
                        <Upload className="mx-auto h-4 w-4 text-gray-500 mb-1" />
                        <p className="text-[10px] text-gray-500">Upload PDF, JPG, PNG</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-between">
                <button onClick={() => setKybStep("business")} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <button onClick={() => setKybStep("screening")} className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition-colors">
                  <ChevronRight className="h-4 w-4" /> Continue to Screening
                </button>
              </div>
            </div>
          )}

          {/* Step: Screening (KYB) */}
          {activeTab === "kyb" && kybStep === "screening" && (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
              <h2 className="text-lg font-semibold text-white mb-1">Compliance Screening</h2>
              <p className="text-sm text-gray-400 mb-6">Automated screening against AML, sanctions, PEP, and adverse media databases</p>

              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: "AML Screening", desc: "Anti-Money Laundering compliance check", icon: Shield, status: "passed" },
                  { label: "Sanctions Check", desc: "OFAC, EU, UN, EFCC sanctions lists", icon: AlertTriangle, status: "passed" },
                  { label: "PEP Screening", desc: "Politically Exposed Person check for directors", icon: UserCheck, status: "passed" },
                  { label: "Adverse Media", desc: "News and media screening for negative coverage", icon: FileText, status: "passed" },
                ].map((check) => (
                  <div key={check.label} className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                      <check.icon className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{check.label}</p>
                      <p className="text-[11px] text-gray-500">{check.desc}</p>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-between">
                <button onClick={() => setKybStep("documents")} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <button onClick={() => setKybStep("status")} className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition-colors">
                  <CheckCircle2 className="h-4 w-4" /> Submit for Review
                </button>
              </div>
            </div>
          )}

          {/* Step: Status (KYB) */}
          {activeTab === "kyb" && kybStep === "status" && (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/20 mb-4">
                <Building2 className="h-8 w-8 text-purple-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">KYB Application Submitted</h2>
              <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto">
                Your business verification application has been submitted. Our compliance team will review your
                documents and conduct due diligence. Director KYC verification may be required.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-purple-500/10 border border-purple-500/20 px-4 py-2 text-sm font-medium text-purple-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Under Review — Estimated time: 5-10 business days
              </div>
              <div className="mt-6">
                <button onClick={() => setShowNewForm(false)} className="text-sm text-brand-400 hover:text-brand-300">
                  View All Applications
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Applications List ────────────────────────────────────────── */
        <div className="space-y-6">
          {activeTab === "kyc" ? (
            <>
              <h2 className="text-lg font-semibold text-white">KYC Applications</h2>
              {kycLoading ? (
                <div className="flex items-center gap-2 text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
              ) : (kycApps ?? []).length === 0 ? (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
                  <UserCheck className="mx-auto h-12 w-12 text-gray-600 mb-3" />
                  <p className="text-gray-400">No KYC applications yet</p>
                  <button onClick={() => { setShowNewForm(true); setKycStep("type"); }} className="mt-4 text-sm text-brand-400 hover:text-brand-300">
                    Start your first application
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Applicant</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Risk</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(kycApps ?? []).map((app: Record<string, unknown>) => (
                        <tr key={app.id as string} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 text-xs font-mono text-gray-400">{app.id as string}</td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-white">{app.full_name as string}</p>
                            <p className="text-[11px] text-gray-500">{app.email as string}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400">{(app.stakeholder_type as string)?.replace(/_/g, " ")}</td>
                          <td className="px-4 py-3"><StatusBadge status={app.status as string} /></td>
                          <td className="px-4 py-3"><RiskBadge level={app.risk_level as string} /></td>
                          <td className="px-4 py-3 text-xs text-gray-500">{(app.created_at as string)?.slice(0, 10)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-white">KYB Applications</h2>
              {kybLoading ? (
                <div className="flex items-center gap-2 text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
              ) : (kybApps ?? []).length === 0 ? (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
                  <Building2 className="mx-auto h-12 w-12 text-gray-600 mb-3" />
                  <p className="text-gray-400">No KYB applications yet</p>
                  <button onClick={() => { setShowNewForm(true); setKybStep("type"); }} className="mt-4 text-sm text-brand-400 hover:text-brand-300">
                    Start your first application
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Business</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Risk</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">AML</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Sanctions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(kybApps ?? []).map((app: Record<string, unknown>) => (
                        <tr key={app.id as string} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 text-xs font-mono text-gray-400">{app.id as string}</td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-white">{app.business_name as string}</p>
                            <p className="text-[11px] text-gray-500">{app.registration_number as string}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400">{(app.stakeholder_type as string)?.replace(/_/g, " ")}</td>
                          <td className="px-4 py-3"><StatusBadge status={app.status as string} /></td>
                          <td className="px-4 py-3"><RiskBadge level={app.risk_level as string} /></td>
                          <td className="px-4 py-3">
                            {app.aml_screening ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-yellow-400" />}
                          </td>
                          <td className="px-4 py-3">
                            {app.sanctions_screening ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-yellow-400" />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
