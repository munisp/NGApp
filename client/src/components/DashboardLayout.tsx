import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  Activity, BarChart3, Bell, Bot, CheckCircle2, Cpu, GitBranch, HardDrive, LayoutDashboard, LogOut, Network, PanelLeft,
  Scale, Search, Shield, Wallet, Waves, Database, Building2, Users, Globe, CheckSquare, Radio, Menu, ClipboardCheck, Layers, Trophy, BadgeCheck, BookOpen, FileText, ClipboardList,
  FileCode2, BrainCircuit, PackageCheck, FolderTree, UserRound, GitMerge, ArrowLeftRight, Wrench, Gavel, Settings, Zap,
  HandMetal, AlertTriangle, UserCheck, ClipboardType, ScrollText, Timer, FileBarChart, Landmark, FileKey, Cookie, Fingerprint, Baby, GraduationCap, Download, Gauge, FileLock2, ShieldCheck,
  BarChart2, UserPlus, Vault, Award, ClipboardSignature, Receipt, TrendingUp, CreditCard, RefreshCw,
  MessageSquare, Wand2, TrendingUp as TrendUp, Webhook, SearchCode, FileCheck2, Code2,
  Banknote, ScanFace, ShieldAlert, AlertOctagon, FileSpreadsheet, Building, FileWarning, Shuffle,
  Heart, Zap as ZapIcon, HeartPulse, FlaskConical, AlertCircle, Clock, UserCog, MonitorDot,
  Calculator, CalendarDays, HeartHandshake, Mail, Brain,
  Workflow, Share2, FileSearch, Eye, Microscope,
  MapPin, ArrowRightLeft
} from "lucide-react";
import { useRbac, getRoleBadgeColor, getRoleLabel } from "@/hooks/useRbac";
import { CSSProperties, useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { CriticalEventBanner } from './CriticalEventBanner';
import { FloatingChatBubble } from './FloatingChatBubble';
import { OnboardingBanner } from './OnboardingBanner';
import { Button } from "./ui/button";
import { LanguageSelector } from "./LanguageSelector";
import ThemeToggle from "@/components/ThemeToggle";
import { WhatsNewModal } from "@/components/WhatsNewModal";
import GlobalSearchWidget from "@/components/GlobalSearch";

const menuItems = [
  { icon: LayoutDashboard, label: "Gov Dashboard", path: "/", layer: "L6" },
  { icon: Search, label: "Discovery Engine", path: "/discovery", layer: "L1" },
  { icon: Database, label: "Data Catalog", path: "/catalog", layer: "L2" },
  { icon: Scale, label: "Compliance Engine", path: "/compliance", layer: "L3" },
  { icon: Shield, label: "SIEM & Audit", path: "/siem", layer: "L4" },
  { icon: Network, label: "Network DPI", path: "/network", layer: "L5" },
  { icon: Wallet, label: "Financial Enforcement", path: "/financial", layer: "FIN" },
  { icon: Gavel, label: "Enforcement Cases", path: "/enforcement-cases", layer: "ENF" },
  { icon: Waves, label: "Streaming Events", path: "/streaming", layer: "STR" },
  { icon: Zap, label: "Event Bus Monitor", path: "/event-bus", layer: "EVT" },
  { icon: Database, label: "Ledger Explorer", path: "/ledger", layer: "TB" },
  { icon: Bot, label: "AI Advisor", path: "/ai-assistant", layer: "AI" },
  { icon: Building2, label: "Organizations", path: "/organizations", layer: "ORG" },
  { icon: Users, label: "Role Management", path: "/roles", layer: "IAM" },
  { icon: Cpu, label: "Worker Processes", path: "/workers", layer: "SYS" },
  { icon: GitBranch, label: "BGP Routes", path: "/bgp", layer: "L1" },
  { icon: Activity, label: "Temporal Workflows", path: "/temporal", layer: "WF" },
  { icon: BarChart3, label: "Prometheus Metrics", path: "/metrics", layer: "OBS" },
  { icon: HardDrive, label: "Arkime PCAP", path: "/pcap", layer: "L5" },
  { icon: Globe, label: "Org Portal", path: "/portal", layer: "PRT" },
  { icon: ClipboardCheck, label: "Portal Review", path: "/portal-review", layer: "REV" },
  { icon: HandMetal, label: "Consent Mgmt", path: "/consent", layer: "CPL" },
  { icon: AlertTriangle, label: "Breach Notification", path: "/breach-notification", layer: "CPL" },
  { icon: UserCheck, label: "DPO Registry", path: "/dpo-registry", layer: "CPL" },
  { icon: ShieldCheck, label: "DPO Workbench", path: "/dpo-dashboard", layer: "CPL" },
  { icon: ClipboardType, label: "DPIA", path: "/dpia", layer: "CPL" },
  { icon: ScrollText, label: "ROPA Records", path: "/ropa", layer: "CPL" },
  { icon: Timer, label: "Retention Policies", path: "/retention", layer: "CPL" },
  { icon: FileBarChart, label: "DPO Reports", path: "/dpo-reports", layer: "CPL" },
  { icon: Landmark, label: "Audit Returns", path: "/car", layer: "CPL" },
  { icon: Globe, label: "Adequacy Registry", path: "/adequacy", layer: "CPL" },
  { icon: FileKey, label: "Privacy Notices", path: "/privacy-notices", layer: "CPL" },
  { icon: Cookie, label: "Cookie Consent", path: "/cookie-consent", layer: "CPL" },
  { icon: Fingerprint, label: "Automated Decisions", path: "/automated-decisions", layer: "CPL" },
  { icon: Baby, label: "Parental Consent", path: "/parental-consent", layer: "CPL" },
  { icon: GraduationCap, label: "Staff Training", path: "/staff-training", layer: "CPL" },
  { icon: ArrowLeftRight, label: "Transfer Instruments", path: "/transfer-instruments", layer: "CPL" },
  { icon: Download, label: "Data Export", path: "/data-export", layer: "CPL" },
  { icon: FileLock2, label: "Data Processing Agrmts", path: "/dpa", layer: "CPL" },
  { icon: Gauge, label: "DCPMI Thresholds", path: "/dcpmi", layer: "CPL" },
  { icon: CheckSquare, label: "Transfer Approvals", path: "/transfers", layer: "GOV" },
  { icon: Radio, label: "Continuous Monitoring", path: "/monitoring", layer: "MON" },
  { icon: Layers, label: "Orchestration Layer", path: "/orchestration", layer: "ORC" },
  { icon: Trophy, label: "Compliance Leaderboard", path: "/leaderboard", layer: "LDR" },
  { icon: BadgeCheck, label: "Verify Certificate", path: "/verify", layer: "VRF" },
  { icon: BookOpen, label: "API Documentation", path: "/api-docs", layer: "API" },
  { icon: FileText, label: "Regulatory Reports", path: "/reports", layer: "RPT" },
  { icon: Search, label: "Status Tracker", path: "/status", layer: "STS" },
  { icon: ClipboardList, label: "Audit Log", path: "/audit-log", layer: "LOG" },
  { icon: FileCode2, label: "Policy Templates", path: "/policy-templates", layer: "POL" },
  { icon: BrainCircuit, label: "AI Governance", path: "/ai-governance", layer: "AIG" },
  { icon: PackageCheck, label: "Evidence Packages", path: "/evidence", layer: "EVD" },
  { icon: FolderTree, label: "Sector Management", path: "/sectors", layer: "SEC" },
  { icon: UserRound, label: "Citizen Rights", path: "/citizen-rights", layer: "CIT" },
  { icon: GitMerge, label: "GitOps Config", path: "/gitops", layer: "GIT" },
  { icon: ArrowLeftRight, label: "Data Flow Map", path: "/data-flows", layer: "FLW" },
  { icon: Globe, label: "TIA Assessments", path: "/tia", layer: "TIA" },
  { icon: Wrench, label: "Remediation", path: "/remediation", layer: "REM" },
  { icon: Network, label: "Asset Graph", path: "/asset-graph", layer: "GRF" },
  { icon: Layers, label: "Framework Dashboard", path: "/frameworks", layer: "FWK" },
  { icon: Building2, label: "My Organization", path: "/my-org", layer: "ORG" },
  { icon: Settings, label: "Notification Settings", path: "/settings/notifications", layer: "CFG" },
  { icon: Bell, label: "Alerting Settings", path: "/settings/alerting", layer: "ALT" },
  { icon: ShieldCheck, label: "Cert Rotation", path: "/settings/cert-rotation", layer: "SEC" },
  { icon: BarChart3, label: "Sector Benchmark", path: "/sector-benchmark", layer: "BMK" },
  { icon: Activity, label: "Sector Compliance", path: "/sector-compliance", layer: "SCM" },
  // ── DPCO Stakeholder Portal ──────────────────────────────────────────────────
  { icon: Award,              label: "DPCO Portal",        path: "/dpco",             layer: "DPCO" },
  { icon: ClipboardSignature, label: "DPCO Registry",      path: "/dpco/registry",    layer: "DPCO" },
  { icon: Users,              label: "DPCO Clients",       path: "/dpco/clients",     layer: "DPCO" },
  { icon: ShieldCheck,        label: "Verification Stmts", path: "/dpco/verification", layer: "DPCO" },
  { icon: ClipboardCheck,     label: "Audit Workspace",    path: "/dpco/audit",       layer: "DPCO" },
  { icon: BarChart2,          label: "DPCO Scorecard",     path: "/dpco/scorecard",   layer: "DPCO" },
  { icon: UserPlus,           label: "DPCO Onboarding",    path: "/dpco/onboard",    layer: "DPCO" },
  { icon: Vault,              label: "Evidence Vault",     path: "/dpco/evidence",   layer: "DPCO" },
  { icon: Receipt,            label: "Billing & Earnings", path: "/dpco/billing",    layer: "DPCO" },
  { icon: CreditCard,         label: "Subscription Plan",  path: "/dpco/subscription", layer: "DPCO" },
  { icon: RefreshCw,           label: "Licence Renewal",    path: "/dpco/renewal",    layer: "DPCO" },
  { icon: BrainCircuit,        label: "AI Audit Tools",     path: "/dpco/ai-tools",   layer: "DPCO" },
  { icon: TrendingUp,         label: "Platform Revenue",   path: "/admin/revenue",   layer: "ADMIN" },
  { icon: ClipboardList,       label: "DPCO Registrations", path: "/admin/registrations", layer: "ADMIN" },
  { icon: ShieldCheck,         label: "DPCO Accreditation", path: "/admin/accreditation", layer: "ADMIN" },
  { icon: Settings,            label: "Platform Settings",  path: "/admin/settings",  layer: "ADMIN" },
  // ── Enhancement Features ─────────────────────────────────────────────────────
  { icon: MessageSquare,  label: "DSAR Portal",          path: "/dsar",               layer: "ENH" },
  { icon: Wand2,          label: "DPIA Wizard",           path: "/dpia-wizard",        layer: "ENH" },
  { icon: BrainCircuit,   label: "AI Gov. Scoring",       path: "/ai-governance-scoring", layer: "ENH" },
  { icon: TrendUp,        label: "Sector Benchmarking",   path: "/sector-benchmarking", layer: "ENH" },
  { icon: Webhook,        label: "Webhook Management",    path: "/webhooks",           layer: "ENH" },
  { icon: SearchCode,     label: "Global Search",         path: "/search",             layer: "ENH" },
  { icon: FileCheck2,     label: "CAR Automation",        path: "/car-automation",     layer: "ENH" },
  { icon: Code2,          label: "Developer Portal",      path: "/developer",          layer: "ENH" },
  // ── Banking & Financial Services ─────────────────────────────────────────────
  { icon: Banknote,        label: "Banking Overview",      path: "/banking",              layer: "BNK" },
  { icon: ScanFace,        label: "KYC Management",        path: "/banking/kyc",          layer: "BNK" },
  { icon: ShieldAlert,     label: "AML Cases",             path: "/banking/aml",          layer: "BNK" },
  { icon: AlertOctagon,    label: "Watchlist Screening",   path: "/banking/watchlist",    layer: "BNK" },
  { icon: Shuffle,         label: "Payments Monitor",      path: "/banking/payments",     layer: "BNK" },
  { icon: Globe,           label: "SWIFT Transactions",    path: "/banking/swift",        layer: "BNK" },
  { icon: FileWarning,     label: "Fraud Alerts",          path: "/banking/fraud",        layer: "BNK" },
  { icon: FileSpreadsheet, label: "CBN Reports",           path: "/banking/cbn-reports",  layer: "BNK" },
  { icon: Building,        label: "Correspondent Banks",   path: "/banking/correspondents", layer: "BNK" },
  // ── Sector Modules ────────────────────────────────────────────────────────────
  { icon: Radio,           label: "Telecom (NCC)",         path: "/telecom",              layer: "SCT" },
  { icon: Heart,           label: "Healthcare (NHIA)",     path: "/healthcare",           layer: "SCT" },
  { icon: ZapIcon,         label: "Energy (NERC/NUPRC)",   path: "/energy",               layer: "SCT" },
  { icon: Shield,          label: "Insurance (NAICOM)",    path: "/insurance",            layer: "SCT" },
  { icon: CreditCard,      label: "Fintech (CBN)",         path: "/fintech",              layer: "SCT" },
  // ── Operations & Admin ────────────────────────────────────────────────────────
  { icon: AlertCircle,     label: "Cross-Sector Alerts",   path: "/cross-sector-alerts",  layer: "OPS" },
  { icon: Clock,           label: "SLA Timers",            path: "/sla-timers",           layer: "OPS" },
  { icon: UserCog,         label: "User Management",       path: "/admin/users",          layer: "OPS" },
  { icon: MonitorDot,      label: "System Health",         path: "/admin/system-health",  layer: "OPS" },
  // ── New Production Features ───────────────────────────────────────────────────
  { icon: AlertTriangle,   label: "Breach Incidents",       path: "/breach-incidents",     layer: "BRH" },
  { icon: Clock,           label: "Article 40 Tracker",     path: "/article-40-tracker",   layer: "BRH" },
  { icon: UserCheck,       label: "DPO Appointments",       path: "/dpo-appointment-registry", layer: "BRH" },
  { icon: Globe,           label: "Public Registry",        path: "/public-registry",      layer: "BRH" },
  { icon: Calculator,      label: "Penalty Calculator",     path: "/penalty-calculator",   layer: "ENF" },
  { icon: Shield,          label: "Risk Scorecard",         path: "/risk-scorecard",       layer: "ENF" },
  { icon: BarChart2,       label: "Advanced Analytics",     path: "/advanced-analytics",   layer: "ANA" },
  { icon: Bell,            label: "Notifications",          path: "/notifications",        layer: "ANA" },
  { icon: CalendarDays,    label: "Compliance Calendar",    path: "/compliance-calendar",  layer: "ANA" },
  // ── Phase 3 — Production Features ─────────────────────────────────────────────
  { icon: Vault,           label: "Document Vault",         path: "/document-vault",       layer: "PROD" },
  { icon: FileKey,         label: "API Keys",               path: "/api-keys",             layer: "PROD" },
  { icon: Webhook,         label: "Webhook Delivery",       path: "/webhook-delivery",     layer: "PROD" },
  { icon: Shuffle,         label: "Cross-Sector Sharing",   path: "/cross-sector-sharing", layer: "PROD" },
  { icon: Timer,           label: "Retention Enforcement",  path: "/retention-enforcement",layer: "PROD" },
  { icon: BadgeCheck,      label: "Cert Verification",      path: "/cert-verification",    layer: "PROD" },
  { icon: Gavel,           label: "Enforcement Timeline",   path: "/enforcement-timeline", layer: "PROD" },
  { icon: BrainCircuit,    label: "AI Risk Engine",         path: "/ai-risk-engine",       layer: "PROD" },
  { icon: RefreshCw,       label: "Compliance Rescoring",   path: "/compliance-rescoring", layer: "PROD" },
  { icon: MessageSquare,   label: "SMS Alerts",             path: "/sms-alerts",           layer: "PROD" },
  { icon: FileText,        label: "PDF Export Center",      path: "/pdf-export",           layer: "PROD" },
  // ── Phase 5 — Customisable Dashboard, Chat Support, User Guide ────────────────────────────
  { icon: LayoutDashboard, label: "My Dashboard",           path: "/my-dashboard",         layer: "PROD" },
  { icon: MessageSquare,   label: "Support Chat",           path: "/support-chat",         layer: "PROD" },
  { icon: BookOpen,        label: "User Guide & Tutorials", path: "/user-guide",           layer: "PROD" },
  { icon: CheckCircle2,    label: "Onboarding Checklist",   path: "/onboarding-checklist", layer: "PROD" },
  { icon: Mail,            label: "Email Digest Settings",  path: "/email-digest",         layer: "PROD" },
  { icon: TrendUp,         label: "Compliance Trends",      path: "/trends",               layer: "PROD" },
  { icon: Wand2,           label: "Changelog Admin",        path: "/admin/changelog",      layer: "OPS" },
  // ── Phase 9 — Security Audit, Multi-Org Trends, DSAR Lifecycle, NIP, Platform Stats ────────────────
  { icon: ShieldAlert,     label: "Security Audit",         path: "/security-audit",       layer: "OPS" },
  { icon: BarChart3,       label: "Multi-Org Trend Compare",path: "/trend-compare",        layer: "ANA" },
  { icon: UserCheck,       label: "DSAR Lifecycle",         path: "/dsar-lifecycle",       layer: "BRH" },
  { icon: Download,        label: "Audit Export",           path: "/audit-export",         layer: "OPS" },
  { icon: Banknote,        label: "NIP Reconciliation",     path: "/nip-reconciliation",   layer: "OPS" },
  { icon: Activity,        label: "Platform Stats",         path: "/platform-stats",       layer: "OPS" },
  // ── Phase 10 — AI/ML Intelligence Hub ────────────────────────────────────────────
  { icon: BrainCircuit,    label: "AI/ML Hub",               path: "/ai/hub",               layer: "AI" },
  { icon: Layers,          label: "Model Registry",          path: "/ai/model-registry",    layer: "AI" },
  { icon: ShieldAlert,     label: "ART Robustness",          path: "/ai/art-dashboard",     layer: "AI" },
  { icon: HardDrive,       label: "Feature Store",           path: "/ai/feature-store",     layer: "AI" },
  { icon: Network,          label: "Knowledge Graph",         path: "/ai/knowledge-graph",   layer: "AI" },
  { icon: Brain,            label: "RAG Advisor",             path: "/ai/rag-advisor",       layer: "AI" },
  // ── Phase 12 — Advanced Governance & Compliance ──────────────────────────────
  { icon: Workflow,          label: "Data Pipeline",           path: "/data-pipeline",        layer: "P12" },
  { icon: GitBranch,         label: "Data Lineage",            path: "/data-lineage",         layer: "P12" },
  { icon: Globe,             label: "Regulatory Intel",        path: "/regulatory-intelligence", layer: "P12" },
  { icon: AlertTriangle,     label: "Incident Response",       path: "/incident-response",    layer: "P12" },
  { icon: Microscope,        label: "Compliance Gap",          path: "/compliance-gap",       layer: "P12" },
  { icon: ShieldAlert,       label: "Vendor Risk",             path: "/vendor-risk",          layer: "P12" },
  { icon: Eye,               label: "Whistleblower",           path: "/whistleblower",        layer: "P12" },
  { icon: Landmark,          label: "Reg Sandbox",             path: "/regulatory-sandbox",   layer: "P12" },
  { icon: Brain,             label: "AI Ethics Board",         path: "/ai-ethics",            layer: "P12" },
  { icon: Fingerprint,       label: "National ID Verify",      path: "/national-id",          layer: "P12" },
  { icon: Share2,            label: "Cross-Agency Sharing",    path: "/cross-agency",         layer: "P12" },
  { icon: FileSearch,        label: "PIA Assessments",         path: "/pia",                  layer: "P12" },
  { icon: Banknote,          label: "NDPA Fines",              path: "/ndpa-fines",           layer: "P12" },
  // ── Phase 13 — Consent, DPO, Notifications, Penalty, Public Registry, Risk, Residency, Rate Limit, Bulk DSAR, Whistleblower, Cross-Border, Reporting ──
  { icon: ShieldCheck,        label: "Consent Records",         path: "/consent-records",      layer: "P13" },
  { icon: UserCheck,          label: "DPO Registry (P13)",      path: "/dpo-registry",         layer: "P13" },
  { icon: Bell,               label: "Notification Center",     path: "/notification-center",  layer: "P13" },
  { icon: Calculator,         label: "Penalty Calc (P13)",      path: "/penalty-calculator",   layer: "P13" },
  { icon: BarChart2,           label: "Penalty Dashboard",       path: "/penalty-dashboard",    layer: "P13" },
  { icon: Globe,              label: "Public Registry (P13)",   path: "/public-registry",      layer: "P13" },
  { icon: ShieldAlert,        label: "Risk Scorecard (P13)",    path: "/risk-scorecard",       layer: "P13" },
  { icon: MapPin,             label: "Data Residency",          path: "/data-residency",       layer: "P13" },
  { icon: Activity,           label: "Rate Limit Dashboard",    path: "/rate-limit-dashboard", layer: "P13" },
  { icon: Users,              label: "Bulk DSAR",               path: "/bulk-dsar",            layer: "P13" },
  { icon: Eye,                label: "Whistleblower Cases",     path: "/whistleblower-cases",  layer: "P13" },
  { icon: ArrowRightLeft,     label: "Cross-Border Monitor",    path: "/cross-border-monitor", layer: "P13" },
  { icon: FileBarChart,       label: "Regulatory Reporting",    path: "/regulatory-reporting", layer: "P13" },
  // ── Phase 25 — Middleware Health & Accreditation Workflow ───────────────────────────────────────
  { icon: HeartPulse,          label: "Middleware Health",        path: "/health-dashboard",     layer: "P25" },
  { icon: Workflow,            label: "Accreditation Workflow",   path: "/accreditation-workflow", layer: "P25" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

function RoleBadgeFooter({ user }: { user: any }) {
  const rbac = useRbac();
  return (
    <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
      <p className="text-sm font-medium truncate leading-none">
        {user?.name || "-"}
      </p>
      <div className="flex items-center gap-1.5 mt-1.5">
        <span
          className="mono text-[9px] font-semibold px-1.5 py-0.5 rounded-sm"
          style={{
            background: getRoleBadgeColor(rbac.role) + "20",
            color: getRoleBadgeColor(rbac.role),
            border: `1px solid ${getRoleBadgeColor(rbac.role)}40`,
          }}
        >
          {getRoleLabel(rbac.role)}
        </span>
      </div>
    </div>
  );
}

function NotificationsHeader({ isMobile, activeMenuLabel }: { isMobile: boolean; activeMenuLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"platform" | "security">("platform");
  const [acknowledging, setAcknowledging] = useState<Set<number>>(new Set());
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();

  // SIEM security alerts
  const { data: alertsData, refetch: refetchAlerts } = trpc.siem.alerts.useQuery(
    { limit: 20, resolved: false },
    { refetchInterval: 30000 }
  );
  const alerts = (alertsData as any[]) ?? [];

  // Platform in-app notifications
  const { data: notifData, refetch: refetchNotifs } = trpc.notifications.list.useQuery(
    { limit: 20, onlyUnread: false },
    { refetchInterval: 30000 }
  );
  const { data: unreadCountData } = trpc.notifications.unreadCount.useQuery(
    undefined,
    { refetchInterval: 30000 }
  );
  const notifs = (notifData as any[]) ?? [];
  const platformUnread = (unreadCountData as any)?.count ?? 0;
  const totalBadge = alerts.length + platformUnread;

  const resolveMutation = trpc.siem.resolveAlert.useMutation({
    onSuccess: () => { refetchAlerts(); utils.siem.alerts.invalidate(); },
  });
  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => { refetchNotifs(); utils.notifications.list.invalidate(); utils.notifications.unreadCount.invalidate(); },
  });
  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => { refetchNotifs(); utils.notifications.list.invalidate(); utils.notifications.unreadCount.invalidate(); },
  });

  const handleAcknowledge = useCallback((e: React.MouseEvent, alertId: number) => {
    e.stopPropagation();
    e.preventDefault();
    setAcknowledging(prev => new Set(prev).add(alertId));
    resolveMutation.mutate({ alertId }, {
      onSettled: () => setAcknowledging(prev => { const s = new Set(prev); s.delete(alertId); return s; }),
    });
  }, [resolveMutation]);

  const severityStyle = (sev: string) =>
    sev === "critical" ? "bg-red-500/20 text-red-400" :
    sev === "warning"  ? "bg-orange-500/20 text-orange-400" :
    sev === "info"     ? "bg-blue-500/20 text-blue-400" :
                         "bg-slate-500/20 text-slate-400";

  return (
    <div className="flex border-b h-14 items-center justify-between bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
      <div className="flex items-center gap-2 shrink-0">
        {isMobile && <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />}
        <span className="tracking-tight text-foreground font-medium hidden sm:block">
          {activeMenuLabel ?? "NDSEP"}
        </span>
      </div>
      {/* ─── Global Search — Ctrl+K ────────────────────────────────────────── */}
      <div className="flex-1 max-w-sm mx-4 hidden md:block">
        <GlobalSearchWidget />
      </div>
      <div className="flex items-center gap-1">
        <LanguageSelector />
        <ThemeToggle size="sm" />
        <div className="relative">
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <button
              className="relative h-9 w-9 flex items-center justify-center rounded-lg hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4 text-muted-foreground" />
              {totalBadge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-0.5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold">
                  {totalBadge > 99 ? "99+" : totalBadge}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-96 p-0">
            {/* Tab bar */}
            <div className="flex border-b">
              <button
                className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${
                  activeTab === "platform" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("platform")}
              >
                Platform {platformUnread > 0 && <span className="ml-1 bg-primary/20 text-primary text-[9px] px-1 rounded">{platformUnread}</span>}
              </button>
              <button
                className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${
                  activeTab === "security" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("security")}
              >
                Security {alerts.length > 0 && <span className="ml-1 bg-destructive/20 text-destructive text-[9px] px-1 rounded">{alerts.length}</span>}
              </button>
            </div>

            {/* Platform notifications tab */}
            {activeTab === "platform" && (
              <div className="max-h-80 overflow-y-auto">
                <div className="px-3 py-1.5 border-b flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground">{notifs.length} notifications</p>
                  {platformUnread > 0 && (
                    <button
                      className="text-[10px] text-primary hover:underline"
                      onClick={(e) => { e.stopPropagation(); markAllReadMutation.mutate(); }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                {notifs.length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-muted-foreground">No notifications</div>
                ) : (
                  notifs.slice(0, 15).map((n: any) => (
                    <div
                      key={n.id}
                      className={`flex items-start gap-2 px-3 py-2 border-b border-border/30 last:border-0 cursor-pointer hover:bg-accent/50 ${
                        !n.read_at ? "bg-primary/5" : ""
                      }`}
                      onClick={() => {
                        if (!n.read_at) markReadMutation.mutate({ id: n.id });
                        if (n.action_url) { setOpen(false); setLocation(n.action_url); }
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {!n.read_at && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                          <span className={`text-[9px] font-bold px-1 py-0.5 rounded uppercase shrink-0 ${severityStyle(n.severity)}`}>
                            {n.severity ?? "info"}
                          </span>
                          <span className="text-xs font-medium truncate">{n.title}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground line-clamp-2">{n.message}</p>
                        <span className="text-[9px] text-muted-foreground/60 mt-0.5 block">
                          {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Security alerts tab */}
            {activeTab === "security" && (
              <div className="max-h-80 overflow-y-auto">
                <div className="px-3 py-1.5 border-b flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground">{alerts.length} unresolved</p>
                  {alerts.length > 0 && (
                    <button
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={(e) => { e.stopPropagation(); alerts.slice(0, 10).forEach((a: any) => resolveMutation.mutate({ alertId: a.id })); }}
                    >
                      Dismiss all
                    </button>
                  )}
                </div>
                {alerts.length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-muted-foreground">No unresolved alerts</div>
                ) : (
                  alerts.slice(0, 10).map((alert: any) => (
                    <div
                      key={alert.id}
                      className="flex items-start gap-2 px-3 py-2 hover:bg-accent/50 cursor-pointer border-b border-border/30 last:border-0"
                      onClick={() => { setOpen(false); setLocation("/siem"); }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-bold px-1 py-0.5 rounded uppercase shrink-0 ${
                            alert.severity === "critical" ? "bg-red-500/20 text-red-400" :
                            alert.severity === "high" ? "bg-orange-500/20 text-orange-400" :
                            alert.severity === "medium" ? "bg-yellow-500/20 text-yellow-400" :
                            "bg-blue-500/20 text-blue-400"
                          }`}>
                            {alert.severity}
                          </span>
                          <span className="text-xs font-medium truncate">{alert.title}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground truncate block mt-0.5">{alert.source}</span>
                      </div>
                      <button
                        className="shrink-0 h-6 w-6 flex items-center justify-center rounded hover:bg-emerald-500/20 text-muted-foreground hover:text-emerald-400 transition-colors"
                        title="Acknowledge alert"
                        disabled={acknowledging.has(alert.id)}
                        onClick={(e) => handleAcknowledge(e, alert.id)}
                      >
                        {acknowledging.has(alert.id) ? <span className="text-[8px]">...</span> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  ))
                )}
                {alerts.length > 10 && (
                  <div
                    className="text-xs text-center text-primary cursor-pointer px-3 py-2 hover:bg-accent/50"
                    onClick={() => { setOpen(false); setLocation("/siem"); }}
                  >
                    View all {alerts.length} alerts
                  </div>
                )}
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          {/* NDSEP Branding */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">NDSEP</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-center text-white">
              Sign in to continue
            </h1>
            <p className="text-sm text-slate-400 text-center max-w-sm">
              Access to this dashboard requires authentication. Sign in with your Manus account or preview the DPCO portal in demo mode.
            </p>
          </div>
          <div className="flex flex-col gap-3 w-full">
            <Button
              onClick={() => { window.location.href = getLoginUrl(); }}
              size="lg"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg"
            >
              Sign in with Manus
            </Button>
            <div className="relative flex items-center gap-2">
              <div className="flex-1 h-px bg-slate-700" />
              <span className="text-xs text-slate-500">or</span>
              <div className="flex-1 h-px bg-slate-700" />
            </div>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                const returnTo = window.location.pathname + window.location.search;
                window.location.href = `/api/demo-login?returnTo=${encodeURIComponent(returnTo)}`;
              }}
              className="w-full border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Preview as Demo DPCO
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                window.location.href = `/api/demo-login?role=admin`;
              }}
              className="w-full border-violet-700 text-violet-300 hover:bg-violet-950 hover:text-violet-100"
            >
              Preview as NDPC Admin
            </Button>
            <p className="text-xs text-slate-500 text-center">
              Demo mode uses sample accounts — no real credentials required. DPCO: DataGuard Ltd · Admin: NDPC Staff.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

// Layer group definitions for the sidebar filter
const LAYER_GROUPS: Array<{ key: string; label: string; layers: string[]; color: string }> = [
  { key: "CORE", label: "Core", layers: ["L6","L1","L2","L3","L4","L5"], color: "#6366f1" },
  { key: "ENF",  label: "Enf",  layers: ["FIN","ENF"],                    color: "#ef4444" },
  { key: "OPS",  label: "Ops",  layers: ["STR","EVT","TB","WF","OBS","SYS"], color: "#f59e0b" },
  { key: "AI",   label: "AI",   layers: ["AI","AIG"],                     color: "#8b5cf6" },
  { key: "ORG",  label: "Org",  layers: ["ORG","IAM","PRT","REV","CIT"], color: "#10b981" },
  { key: "CPL",  label: "CPL",  layers: ["CPL"],                          color: "#0ea5e9" },
  { key: "DPCO", label: "DPCO", layers: ["DPCO"],                         color: "#7c3aed" },
  { key: "ADMIN",label: "Admin",layers: ["ADMIN"],                        color: "#dc2626" },
  { key: "BNK",  label: "Bank", layers: ["BNK"],                          color: "#0284c7" },
  { key: "SCT",  label: "Sect", layers: ["SCT"],                          color: "#16a34a" },
  { key: "ENH",  label: "Enh",  layers: ["ENH"],                          color: "#d97706" },
  { key: "XOPS", label: "XOps", layers: ["OPS"],                          color: "#db2777" },
  { key: "GOV",  label: "Gov",  layers: ["GOV","MON","ORC","LDR","VRF","API","RPT","STS","LOG","POL","EVD","SEC","GIT","FLW","TIA","REM","GRF","FWK","CFG","ALT","BMK"], color: "#64748b" },
  { key: "BRH",  label: "Breach",layers: ["BRH"],                          color: "#dc2626" },
  { key: "ANA",  label: "Analytics",layers: ["ANA"],                      color: "#0891b2" },
  { key: "PROD", label: "Prod",  layers: ["PROD"],                         color: "#7c3aed" },
  { key: "P12",  label: "Phase12",layers: ["P12"],                          color: "#0d9488" },
];

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [activeLayerGroup, setActiveLayerGroup] = useState<string | null>(null);
  const filteredMenuItems = activeLayerGroup
    ? menuItems.filter(item => {
        const grp = LAYER_GROUPS.find(g => g.key === activeLayerGroup);
        return grp ? grp.layers.includes((item as any).layer) : true;
      })
    : menuItems;
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();
  const { data: openCasesData } = trpc.enforcementCases.openCount.useQuery(undefined, {
    refetchInterval: 60_000,
    enabled: !!user,
  });
  const openCaseCount = openCasesData?.count ?? 0;

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm tracking-tight truncate text-foreground">NDSEP</span>
                    <span className="mono text-[9px] text-muted-foreground tracking-widest uppercase truncate">Data Sovereignty Platform</span>
                  </div>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            {/* Layer filter bar — hidden when sidebar is collapsed */}
            {!isCollapsed && (
              <div className="px-2 pt-2 pb-1 flex flex-wrap gap-1 group-data-[collapsible=icon]:hidden">
                <button
                  onClick={() => setActiveLayerGroup(null)}
                  className={`mono text-[9px] font-semibold px-1.5 py-0.5 rounded transition-colors ${
                    activeLayerGroup === null
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  ALL
                </button>
                {LAYER_GROUPS.map(grp => (
                  <button
                    key={grp.key}
                    onClick={() => setActiveLayerGroup(prev => prev === grp.key ? null : grp.key)}
                    className={`mono text-[9px] font-semibold px-1.5 py-0.5 rounded transition-colors`}
                    style={{
                      background: activeLayerGroup === grp.key ? grp.color : undefined,
                      color: activeLayerGroup === grp.key ? "#fff" : grp.color,
                      border: `1px solid ${grp.color}60`,
                    }}
                  >
                    {grp.label}
                  </button>
                ))}
              </div>
            )}
            <SidebarMenu className="px-2 py-1">
              {filteredMenuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-9 transition-all font-normal`}
                      data-tour={
                        item.path === "/dpco/billing" ? "dpco-nav-billing" :
                        item.path === "/dpco/audit" ? "dpco-nav-audit" :
                        item.path === "/dpco/subscription" ? "dpco-nav-subscription" :
                        undefined
                      }
                    >
                      <item.icon
                        className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : ""}`}
                      />
                      <span className="flex-1 truncate text-sm">{item.label}</span>
                      {item.path === "/enforcement-cases" && openCaseCount > 0 ? (
                        <span className="mono text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white group-data-[collapsible=icon]:hidden">{openCaseCount}</span>
                      ) : (
                        <span className="mono text-[9px] font-semibold tracking-widest px-1 py-0.5 rounded bg-primary/10 text-primary/70 group-data-[collapsible=icon]:hidden">{(item as any).layer}</span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <RoleBadgeFooter user={user} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="flex flex-col h-screen overflow-hidden">
        <NotificationsHeader isMobile={isMobile} activeMenuLabel={activeMenuItem?.label} />
        {user?.openId === "demo-dpco-user-001" && <DemoModeBanner role="dpco" />}
        {user?.openId === "demo-admin-user-001" && <DemoModeBanner role="admin" />}
        <CriticalEventBanner />
        <OnboardingBanner />
        <FloatingChatBubble />
        <WhatsNewModal />
        <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
      </SidebarInset>
    </>
  );
}
