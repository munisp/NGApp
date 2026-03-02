"use client";

import { useState } from "react";
import {
  Shield,
  UserCheck,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  FileText,
  Scan,
  Fingerprint,
  TrendingUp,
  BarChart3,
  Loader2,
} from "lucide-react";
import { useKYCApplications, useKYBApplications, useKYCStats } from "@/lib/api-hooks";

/* ─── Status badge ─────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    document_uploaded: "bg-blue-500/10 text-blue-400 border-blue-500/20",
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
    document_uploaded: "Doc Uploaded",
    ocr_complete: "OCR Done",
    liveness_pending: "Liveness Pending",
    liveness_complete: "Liveness Done",
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

type Tab = "overview" | "kyc" | "kyb" | "pending";

export default function CompliancePage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [selectedApp, setSelectedApp] = useState<Record<string, unknown> | null>(null);

  const { applications: kycApps, loading: kycLoading } = useKYCApplications();
  const { applications: kybApps, loading: kybLoading } = useKYBApplications();
  const { stats, loading: statsLoading } = useKYCStats();

  const pendingKYC = (kycApps ?? []).filter((a: Record<string, unknown>) => a.status === "under_review" || a.status === "liveness_complete");
  const pendingKYB = (kybApps ?? []).filter((a: Record<string, unknown>) => a.status === "under_review" || a.status === "processing");

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Compliance Dashboard</h1>
        <p className="mt-1 text-sm text-gray-400">
          KYC/KYB application review, risk assessment, and compliance monitoring
        </p>
      </div>

      {/* Tab selector */}
      <div className="mb-6 flex gap-2 overflow-x-auto">
        {[
          { key: "overview" as Tab, label: "Overview", icon: BarChart3 },
          { key: "kyc" as Tab, label: "KYC Applications", icon: UserCheck },
          { key: "kyb" as Tab, label: "KYB Applications", icon: Building2 },
          { key: "pending" as Tab, label: `Pending Review (${pendingKYC.length + pendingKYB.length})`, icon: Clock },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? "bg-brand-500/20 text-brand-400 border border-brand-500/30"
                : "text-gray-400 hover:text-white border border-white/[0.06]"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ─────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Stats cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total KYC", value: stats?.total_kyc ?? (kycApps ?? []).length, icon: UserCheck, color: "brand" },
              { label: "Total KYB", value: stats?.total_kyb ?? (kybApps ?? []).length, icon: Building2, color: "purple" },
              { label: "Pending Review", value: stats?.pending_review ?? (pendingKYC.length + pendingKYB.length), icon: Clock, color: "amber" },
              { label: "Rejection Rate", value: `${stats?.rejection_rate ?? 20}%`, icon: AlertTriangle, color: "red" },
            ].map((stat) => {
              const colorMap: Record<string, string> = {
                brand: "bg-brand-500/10 text-brand-400",
                purple: "bg-purple-500/10 text-purple-400",
                amber: "bg-amber-500/10 text-amber-400",
                red: "bg-red-500/10 text-red-400",
              };
              return (
                <div key={stat.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colorMap[stat.color]}`}>
                      <stat.icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-medium text-gray-400">{stat.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {statsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : String(stat.value)}
                  </p>
                </div>
              );
            })}
          </div>

          {/* KYC by status breakdown */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h3 className="text-sm font-semibold text-white mb-4">KYC by Status</h3>
              <div className="space-y-3">
                {Object.entries((stats?.kyc_by_status as Record<string, number>) ?? {}).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <StatusBadge status={status} />
                    <span className="text-sm font-medium text-white">{count}</span>
                  </div>
                ))}
                {!stats?.kyc_by_status && (
                  <>
                    <div className="flex items-center justify-between"><StatusBadge status="approved" /><span className="text-sm font-medium text-white">1</span></div>
                    <div className="flex items-center justify-between"><StatusBadge status="under_review" /><span className="text-sm font-medium text-white">1</span></div>
                    <div className="flex items-center justify-between"><StatusBadge status="liveness_complete" /><span className="text-sm font-medium text-white">1</span></div>
                    <div className="flex items-center justify-between"><StatusBadge status="document_uploaded" /><span className="text-sm font-medium text-white">1</span></div>
                    <div className="flex items-center justify-between"><StatusBadge status="rejected" /><span className="text-sm font-medium text-white">1</span></div>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h3 className="text-sm font-semibold text-white mb-4">KYB by Status</h3>
              <div className="space-y-3">
                {Object.entries((stats?.kyb_by_status as Record<string, number>) ?? {}).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <StatusBadge status={status} />
                    <span className="text-sm font-medium text-white">{count}</span>
                  </div>
                ))}
                {!stats?.kyb_by_status && (
                  <>
                    <div className="flex items-center justify-between"><StatusBadge status="approved" /><span className="text-sm font-medium text-white">1</span></div>
                    <div className="flex items-center justify-between"><StatusBadge status="under_review" /><span className="text-sm font-medium text-white">1</span></div>
                    <div className="flex items-center justify-between"><StatusBadge status="processing" /><span className="text-sm font-medium text-white">1</span></div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Technology stack */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Verification Technology Stack</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { name: "PaddleOCR", desc: "Industrial-strength multilingual OCR (100+ languages)", icon: Scan, status: "Active" },
                { name: "Docling (IBM)", desc: "Structured document parsing for PDF/DOCX/images", icon: FileText, status: "Active" },
                { name: "VLM Verifier", desc: "Document authenticity, tampering & face detection", icon: Eye, status: "Active" },
                { name: "MediaPipe", desc: "468-point face mesh with anti-spoofing liveness", icon: Fingerprint, status: "Active" },
              ].map((tech) => (
                <div key={tech.name} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <tech.icon className="h-4 w-4 text-brand-400" />
                    <span className="text-sm font-medium text-white">{tech.name}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mb-2">{tech.desc}</p>
                  <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">{tech.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── KYC Applications Tab ─────────────────────────────────────── */}
      {activeTab === "kyc" && (
        <div className="space-y-4">
          {kycLoading ? (
            <div className="flex items-center gap-2 text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading KYC applications...</div>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">BVN</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">NIN</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Actions</th>
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
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono">{(app.bvn as string) || "—"}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono">{(app.nin as string) || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedApp(app)}
                            className="flex items-center gap-1 rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-gray-300 hover:bg-white/[0.08] transition-colors"
                          >
                            <Eye className="h-3 w-3" /> Review
                          </button>
                          {(app.status === "under_review" || app.status === "liveness_complete") && (
                            <>
                              <button className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                                <CheckCircle2 className="h-3 w-3" /> Approve
                              </button>
                              <button className="flex items-center gap-1 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-[11px] font-medium text-red-400 hover:bg-red-500/20 transition-colors">
                                <XCircle className="h-3 w-3" /> Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── KYB Applications Tab ─────────────────────────────────────── */}
      {activeTab === "kyb" && (
        <div className="space-y-4">
          {kybLoading ? (
            <div className="flex items-center gap-2 text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading KYB applications...</div>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">PEP</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Actions</th>
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
                      <td className="px-4 py-3">
                        {app.pep_screening ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-yellow-400" />}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedApp(app)}
                            className="flex items-center gap-1 rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-gray-300 hover:bg-white/[0.08] transition-colors"
                          >
                            <Eye className="h-3 w-3" /> Review
                          </button>
                          {(app.status === "under_review" || app.status === "processing") && (
                            <>
                              <button className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                                <CheckCircle2 className="h-3 w-3" /> Approve
                              </button>
                              <button className="flex items-center gap-1 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-[11px] font-medium text-red-400 hover:bg-red-500/20 transition-colors">
                                <XCircle className="h-3 w-3" /> Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Pending Review Tab ───────────────────────────────────────── */}
      {activeTab === "pending" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-400" />
              <span className="text-sm font-medium text-amber-400">
                {pendingKYC.length + pendingKYB.length} applications awaiting review
              </span>
            </div>
          </div>

          {pendingKYC.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">KYC Applications Pending Review</h3>
              <div className="space-y-3">
                {pendingKYC.map((app: Record<string, unknown>) => (
                  <div key={app.id as string} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/10">
                        <UserCheck className="h-5 w-5 text-brand-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{app.full_name as string}</p>
                        <p className="text-[11px] text-gray-500">{(app.stakeholder_type as string)?.replace(/_/g, " ")} | {app.email as string}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <RiskBadge level={app.risk_level as string} />
                      <StatusBadge status={app.status as string} />
                      <button className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                        <CheckCircle2 className="h-3 w-3" /> Approve
                      </button>
                      <button className="flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors">
                        <XCircle className="h-3 w-3" /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingKYB.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">KYB Applications Pending Review</h3>
              <div className="space-y-3">
                {pendingKYB.map((app: Record<string, unknown>) => (
                  <div key={app.id as string} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/10">
                        <Building2 className="h-5 w-5 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{app.business_name as string}</p>
                        <p className="text-[11px] text-gray-500">{app.registration_number as string} | {(app.stakeholder_type as string)?.replace(/_/g, " ")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <RiskBadge level={app.risk_level as string} />
                      <StatusBadge status={app.status as string} />
                      <div className="flex gap-1">
                        {app.aml_screening ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-yellow-400" />}
                        {app.sanctions_screening ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-yellow-400" />}
                      </div>
                      <button className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                        <CheckCircle2 className="h-3 w-3" /> Approve
                      </button>
                      <button className="flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors">
                        <XCircle className="h-3 w-3" /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingKYC.length === 0 && pendingKYB.length === 0 && (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400 mb-3" />
              <p className="text-white font-medium">All Caught Up</p>
              <p className="text-sm text-gray-400 mt-1">No applications pending review</p>
            </div>
          )}
        </div>
      )}

      {/* ── Detail panel ─────────────────────────────────────────────── */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedApp(null)}>
          <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-gray-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Application Details</h3>
              <button onClick={() => setSelectedApp(null)} className="text-gray-400 hover:text-white">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              {Object.entries(selectedApp).map(([key, value]) => {
                if (!value || key === "risk_factors" && (value as string[]).length === 0) return null;
                return (
                  <div key={key} className="flex justify-between">
                    <span className="text-xs text-gray-400">{key.replace(/_/g, " ")}</span>
                    <span className="text-xs text-white font-medium max-w-[60%] text-right break-words">
                      {Array.isArray(value) ? value.join(", ") : String(value)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 flex gap-3">
              <button className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors">
                <CheckCircle2 className="h-4 w-4" /> Approve
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-500 transition-colors">
                <XCircle className="h-4 w-4" /> Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
