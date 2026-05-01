import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useDpcoOnboardingTour } from "@/hooks/useDpcoOnboardingTour";
import {
  Building2, Users, FileCheck, GraduationCap, FileText, ShieldCheck,
  TrendingUp, AlertTriangle, CheckCircle, Clock, ArrowRight, BarChart3,
  BookOpen, Scale, Briefcase, Search, Bell, Receipt
} from "lucide-react";

const QUICK_ACTIONS = [
  { label: "DPCO Registry", desc: "Browse all 328 licensed DPCOs", href: "/dpco/registry", icon: Building2, color: "text-cyan-400" },
  { label: "Client Portfolio", desc: "Manage your client engagements", href: "/dpco/clients", icon: Users, color: "text-blue-400" },
  { label: "Audit Workspace", desc: "Run end-to-end compliance audits", href: "/dpco/audit", icon: FileCheck, color: "text-emerald-400" },
  { label: "Verification Statements", desc: "Generate & sign DPCO statements", href: "/dpco/verification", icon: ShieldCheck, color: "text-purple-400" },
  { label: "Evidence Vault", desc: "Tamper-proof evidence storage", href: "/dpco/evidence", icon: FileText, color: "text-pink-400" },
  { label: "Billing & Earnings", desc: "Invoices, payments & revenue tracking", href: "/dpco/billing", icon: Receipt, color: "text-green-400" },
  { label: "Policy Hub", desc: "NDPA-compliant policy template library", href: "/dpco/policy", icon: BookOpen, color: "text-indigo-400" },
];

const MANDATE_ITEMS = [
  { ref: "NDPA §33", title: "Conduct Data Protection Audits", desc: "Annual and ad-hoc audits of Data Controllers and Processors", done: true },
  { ref: "NDPA §44", title: "File Compliance Audit Returns", desc: "Submit CAR to NDPC by 31 March each year", done: true },
  { ref: "NDPA §33(3)", title: "Issue Verification Statements", desc: "Accompany all NDPC filings with DPCO Verification Statement", done: true },
  { ref: "NDPR 4.1(4)", title: "Outsourced DPO Services", desc: "Provide DPO services to organisations without in-house DPO", done: true },
  { ref: "NDPA §32", title: "Staff Training & Certification", desc: "Deliver NDPA-compliant data protection training programs", done: true },
  { ref: "NDPA §40", title: "Breach Incident Support", desc: "Assist organisations in breach assessment and NDPC notification", done: true },
  { ref: "NDPA §43", title: "Policy & Contract Drafting", desc: "Draft DPAs, DSAs, privacy policies, BCRs, and SARs", done: true },
  { ref: "NDPA §38", title: "DPIA Facilitation", desc: "Conduct Data Protection Impact Assessments for high-risk processing", done: true },
  { ref: "NDPA §45", title: "Due Diligence Assessments", desc: "Pre-merger/acquisition data protection due diligence", done: true },
  { ref: "NDPA §33(5)", title: "NDPC Liaison", desc: "Interface with NDPC on behalf of client organisations", done: true },
];

export default function DpcoPortal() {
  const [selectedDpcoId, setSelectedDpcoId] = useState<number | undefined>(undefined);
  const { user } = useAuth();
  const isDemo = user?.openId === "demo-dpco-user-001" || user?.openId === "demo-admin-user-001";
  useDpcoOnboardingTour(isDemo);

  const { data: stats, isLoading } = trpc.dpco.dashboardStats.useQuery(
    { dpcoOrgId: selectedDpcoId },
    { refetchInterval: 60000 }
  );

  const { data: dpcoList } = trpc.dpco.listOrganisations.useQuery({ status: "active", limit: 50 });

  const kpis = [
    { label: "Licensed DPCOs", value: stats?.totalDpcos ?? 0, sub: `${stats?.activeDpcos ?? 0} active`, icon: Building2, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
    { label: "Active Clients", value: stats?.activeClients ?? 0, sub: "current engagements", icon: Users, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
    { label: "Pending CARs", value: stats?.pendingCars ?? 0, sub: "audit returns outstanding", icon: FileCheck, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
    { label: "Training Sessions", value: stats?.trainingSessions ?? 0, sub: "total delivered", icon: GraduationCap, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
    { label: "Verification Stmts", value: stats?.verificationStatements ?? 0, sub: "statements issued", icon: ShieldCheck, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
    { label: "Policy Drafts", value: stats?.policyDrafts ?? 0, sub: "documents drafted", icon: FileText, color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/20" },
    { label: "Expiring Licences", value: stats?.expiringDpcos ?? 0, sub: "within 90 days", icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
    { label: "Expired Licences", value: stats?.expiredDpcos ?? 0, sub: "require renewal", icon: Clock, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  ];

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Header */}
      <div data-tour="dpco-header" className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-cyan-300 font-mono">DPCO Operations Portal</h1>
          <p className="text-slate-400 text-sm mt-1">
            One-stop platform for Data Protection Compliance Organisations &mdash; NDPA 2023 §33
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="bg-slate-800 border border-slate-600 text-slate-200 rounded-md px-3 py-2 text-sm"
            value={selectedDpcoId ?? ""}
            onChange={e => setSelectedDpcoId(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">All DPCOs (Platform-wide)</option>
            {(dpcoList?.rows ?? []).map((d: any) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Grid */}
      <div data-tour="dpco-kpi-cards" className="grid grid-cols-4 gap-4">
        {kpis.map(({ label, value, sub, icon: Icon, color, bg }) => (
          <div key={label} className={`border rounded-lg p-4 ${bg}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className={`text-3xl font-bold font-mono ${color}`}>{isLoading ? "—" : value}</div>
                <div className="text-slate-300 text-sm font-medium mt-1">{label}</div>
                <div className="text-slate-500 text-xs">{sub}</div>
              </div>
              <Icon className={`w-8 h-8 ${color} opacity-60`} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="col-span-2 space-y-3">
          <h2 className="text-slate-300 font-mono text-sm font-medium uppercase tracking-wider">Quick Actions</h2>
          <div data-tour="dpco-quick-actions" className="grid grid-cols-2 gap-3">
            {QUICK_ACTIONS.map(({ label, desc, href, icon: Icon, color }) => (
              <Link key={href} href={href}>
                <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 hover:border-slate-500 hover:bg-slate-700/50 transition-all cursor-pointer group">
                  <div className="flex items-start gap-3">
                    <Icon className={`w-6 h-6 ${color} mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-200 font-medium text-sm">{label}</div>
                      <div className="text-slate-500 text-xs mt-0.5">{desc}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* State breakdown */}
          {stats?.stateBreakdown && stats.stateBreakdown.length > 0 && (
            <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
              <h3 className="text-slate-300 font-mono text-xs font-medium uppercase tracking-wider mb-3">Active DPCOs by State</h3>
              <div className="space-y-2">
                {stats.stateBreakdown.slice(0, 6).map((s: any) => (
                  <div key={s.state} className="flex items-center gap-3">
                    <div className="text-slate-400 text-xs w-32 truncate">{s.state}</div>
                    <div className="flex-1 bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-cyan-500 h-2 rounded-full"
                        style={{ width: `${Math.min(100, (s.c / (stats?.activeDpcos || 1)) * 100)}%` }}
                      />
                    </div>
                    <div className="text-cyan-400 text-xs font-mono w-6 text-right">{s.c}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* DPCO Mandate Checklist */}
        <div className="space-y-3">
          <h2 className="text-slate-300 font-mono text-sm font-medium uppercase tracking-wider">DPCO Statutory Mandate</h2>
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 space-y-3">
            {MANDATE_ITEMS.map(({ ref, title, desc, done }) => (
              <div key={ref} className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-200 text-xs font-medium">{title}</span>
                    <Badge className="text-xs bg-slate-700/50 text-slate-400 border-slate-600 font-mono">{ref}</Badge>
                  </div>
                  <div className="text-slate-500 text-xs mt-0.5">{desc}</div>
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-slate-700 text-xs text-emerald-400 font-mono">
              ✓ All 10 statutory DPCO duties are supported on this platform
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
