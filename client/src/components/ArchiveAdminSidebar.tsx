// Design philosophy: extracted 54Bank admin portal as canonical base.
// This sidebar follows the recovered archive information architecture first,
// including its top-level banking modules and agriculture subtree, while keeping
// the active project only as an enhancement layer around the canonical navigation.

import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Activity,
  Bell,
  Building2,
  CreditCard,
  FileBarChart,
  Calculator,
  Coins,
  FileText,
  Flag,
  Heart,
  LayoutDashboard,
  Link2,
  LogOut,
  MapPin,
  Menu,
  PiggyBank,
  Plus,
  Satellite,
  Settings,
  Shield,
  Tractor,
  TrendingUp,
  Users,
  Wheat,
  AlertTriangle,
  BarChart3,
  Handshake,
  X,
  Clock,
  Layers,
  UserPlus,
  BookOpen,
  Radio,
  GitBranch,
  Globe,
  Search,
  Database,
  Zap,
  Key,
  ArrowRightLeft,
  Landmark,
  Receipt,
  Send,
  AlertCircle,
  GitCompare,
  BellRing,
  Moon,
  Percent,
  Gauge,
  Lock,
  MessageSquare,
  ArrowLeftRight,
  Banknote,
  Package,
  PieChart,
  Mail,
  ShieldAlert,
  Download,
  Brain,
  Wallet,
  FileSearch,
  FolderOpen,
  Smartphone,
  Scale,
  Star,
  Sigma,
  ShieldCheck,
  QrCode,
  FileWarning,
  Fingerprint,
  Box,
  Building,
  Archive,
  FolderLock,
  ListChecks,
  ScrollText,
  PlayCircle,
} from "lucide-react";

const menuItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/control-center", label: "Control Center", icon: LayoutDashboard },
  { path: "/operations", label: "Operations Center", icon: Activity },
  { path: "/banks", label: "Banks", icon: Building2 },
  { path: "/teller", label: "Teller Ops", icon: Building2 },
  { path: "/trade-finance", label: "Trade Finance", icon: FileText },
  { path: "/disputes", label: "Disputes", icon: AlertTriangle },
  { path: "/ledger-sync", label: "Ledger Sync", icon: Link2 },
  { path: "/erpnext-sync", label: "ERPNext Sync", icon: FileBarChart },
  { path: "/identity-channels", label: "Identity & Channels", icon: Settings },
  { path: "/islamic-banking", label: "Islamic Banking", icon: CreditCard },
  { path: "/usage-analytics", label: "Usage Analytics", icon: BarChart3 },
  { path: "/alerts", label: "Alerts", icon: Bell },
  { path: "/features", label: "Features", icon: Flag },
  { path: "/billing", label: "Billing", icon: CreditCard },
  { path: "/admin/billing-engine", label: "Billing Engine", icon: Coins },
  { path: "/pricing-model", label: "Pricing Model", icon: Calculator },
  { path: "/monitoring", label: "Monitoring", icon: Activity },
  { path: "/group-lending", label: "Group Lending", icon: Users },
  { path: "/agent-banking", label: "Agent Banking", icon: MapPin },
  { path: "/regulatory-reporting", label: "CBN Reports", icon: FileText },
  { path: "/admin/onboarding", label: "Partner Onboarding", icon: Handshake },
  { path: "/alert-settings", label: "Alert Settings", icon: Settings },
  { path: "/alert-rules", label: "Alert Rules", icon: Flag },
  { path: "/agriculture", label: "Agriculture", icon: Wheat },
  { path: "/agricultural-insurance", label: "Agri Insurance", icon: Wheat },
  { path: "/agriculture/farmers", label: "Farmers", icon: Users },
  { path: "/agriculture/loans", label: "Agri Loans", icon: Tractor },
  { path: "/agriculture/risk", label: "Risk Alerts", icon: AlertTriangle },
  { path: "/agriculture/agtech", label: "AgTech", icon: Satellite },
  { path: "/agriculture/value-chain", label: "Value Chain", icon: Link2 },
  { path: "/agriculture/regulatory", label: "Agri Compliance", icon: FileText },
  { path: "/agriculture/analytics", label: "Agri Analytics", icon: FileBarChart },
  { path: "/payments-hub", label: "Payments Hub", icon: CreditCard },
  { path: "/savings-products", label: "Savings Products", icon: PiggyBank },
  { path: "/card-management", label: "Card Management", icon: CreditCard },
  { path: "/treasury", label: "Treasury & Liquidity", icon: TrendingUp },
  { path: "/customer-engagement", label: "Customer Engagement", icon: Heart },
  { path: "/fraud-detection", label: "Fraud Detection", icon: Shield },
  { path: "/mortgage", label: "Mortgage Servicing", icon: Building2 },
  { path: "/education-loans", label: "Education Loans", icon: FileText },
  { path: "/esusu", label: "Esusu Groups", icon: Users },
  { path: "/virtual-accounts", label: "Virtual Accounts", icon: Coins },
  { path: "/notification-center", label: "Notifications", icon: Bell },
  { path: "/account-opening", label: "Account Opening", icon: UserPlus },
  { path: "/standing-orders", label: "Standing Orders", icon: Clock },
  { path: "/beneficiary-management", label: "Beneficiaries", icon: Users },
  { path: "/loan-calculator", label: "Loan Calculator", icon: Calculator },
  { path: "/batch-processing", label: "Batch Processing", icon: Layers },
  { path: "/fx-rates", label: "FX & Rates", icon: TrendingUp },
  { path: "/branch-operations", label: "Branch Ops", icon: Building2 },
  { path: "/ledger", label: "Ledger", icon: BookOpen },
  { path: "/event-bus", label: "Event Bus", icon: Radio },
  { path: "/workflow-engine", label: "Workflows", icon: GitBranch },
  { path: "/mojaloop", label: "Mojaloop", icon: Globe },
  { path: "/opensearch", label: "OpenSearch", icon: Search },
  { path: "/lakehouse", label: "Lakehouse", icon: Database },
  { path: "/fluvio-streams", label: "Streams", icon: Zap },
  { path: "/dapr", label: "Dapr Mesh", icon: Layers },
  { path: "/permify", label: "Authorization", icon: Shield },
  { path: "/keycloak", label: "Identity", icon: Key },
  { path: "/interest-rates", label: "Interest Rates", icon: TrendingUp },
  { path: "/cheque-clearing", label: "Cheque Clearing", icon: FileText },
  { path: "/customer-360", label: "Customer 360", icon: Users },
  { path: "/nibss-direct-debit", label: "NIBSS Direct Debit", icon: CreditCard },
  { path: "/diaspora-banking", label: "Diaspora Banking", icon: Globe },
  { path: "/kyc-aml", label: "KYC/AML Screening", icon: Shield },
  { path: "/loan-origination", label: "Loan Origination", icon: FileBarChart },
  { path: "/account-statements", label: "Account Statements", icon: FileText },
  { path: "/bulk-payments", label: "Bulk Payments", icon: Layers },
  { path: "/card-management-v2", label: "Card Mgmt", icon: CreditCard },
  { path: "/savings-products", label: "Savings Products", icon: PiggyBank },
  { path: "/treasury-liquidity", label: "Treasury & Liquidity", icon: TrendingUp },
  { path: "/agent-banking-v2", label: "Agent Banking", icon: MapPin },
  { path: "/chart-of-accounts", label: "Chart of Accounts", icon: BookOpen },
  { path: "/journal-entries", label: "Journal Entries", icon: FileText },
  { path: "/reporting", label: "Reports", icon: FileBarChart },
  { path: "/payment-transactions", label: "Payment Txns", icon: ArrowRightLeft },
  { path: "/loan-products", label: "Loan Products", icon: Landmark },
  { path: "/loan-accounts", label: "Loan Accounts", icon: Receipt },
  { path: "/analytics", label: "Analytics", icon: BarChart3 },
  { path: "/etl-pipelines", label: "ETL Pipelines", icon: Database },
  { path: "/fraud-rules", label: "Fraud Rules", icon: Shield },
  { path: "/fraud-alerts", label: "Fraud Alerts", icon: AlertTriangle },
  { path: "/webhook-subscriptions", label: "Webhooks", icon: Radio },
  { path: "/webhook-deliveries", label: "Webhook Deliveries", icon: Zap },
  { path: "/audit-trail", label: "Audit Trail", icon: FileText },
  { path: "/compliance-checks", label: "Compliance", icon: Shield },
  { path: "/regulatory-calendar", label: "Reg Calendar", icon: Clock },
  { path: "/customer-onboarding", label: "Onboarding", icon: UserPlus },
  { path: "/fx-dealing-room", label: "FX Dealing Room", icon: TrendingUp },
  { path: "/fx-positions", label: "FX Positions", icon: Coins },
  { path: "/doc-collections", label: "Doc Collections", icon: FileText },
  { path: "/treasury-investments", label: "Treasury", icon: Landmark },
  { path: "/swift-messages", label: "SWIFT Center", icon: Send },
  { path: "/credit-risk", label: "Credit Risk", icon: AlertCircle },
  { path: "/reconciliation", label: "Reconciliation", icon: GitCompare },
  { path: "/fee-schedules", label: "Fee Schedules", icon: Receipt },
  { path: "/notification-preferences", label: "Notif Preferences", icon: BellRing },
  { path: "/dormancy", label: "Dormancy", icon: Moon },
  { path: "/interest-accrual", label: "Interest Accrual", icon: Percent },
  { path: "/limit-management", label: "Limits", icon: Gauge },
  { path: "/gl-accounts", label: "General Ledger", icon: BookOpen },
  { path: "/collateral", label: "Collateral", icon: Lock },
  { path: "/complaints", label: "Complaints", icon: MessageSquare },
  { path: "/interbank-settlement", label: "Settlement", icon: ArrowLeftRight },
  { path: "/staff-management", label: "Staff", icon: Users },
  { path: "/channel-management", label: "Channels", icon: Radio },
  { path: "/fixed-deposits", label: "Fixed Deposits", icon: Landmark },
  { path: "/standing-instructions", label: "Standing Instructions", icon: Clock },
  { path: "/cash-management", label: "Cash & Liquidity", icon: Banknote },
  { path: "/correspondent-banking", label: "Correspondents", icon: Globe },
  { path: "/product-catalog", label: "Product Catalog", icon: Package },
  { path: "/customer-segments", label: "Segments", icon: PieChart },
  { path: "/messaging-gateway", label: "Messaging Gateway", icon: Mail },
  { path: "/risk-scoring", label: "Risk Scoring", icon: ShieldAlert },
  { path: "/regulatory-reporting", label: "Regulatory Reports", icon: FileText },
  { path: "/atm-management", label: "ATM Management", icon: CreditCard },
  { path: "/data-export", label: "Data Export", icon: Download },
  { path: "/customer-insights", label: "Customer Insights", icon: Brain },
  { path: "/salary-processing", label: "Salary Processing", icon: Wallet },
  { path: "/credit-bureau", label: "Credit Bureau", icon: FileSearch },
  { path: "/document-management", label: "Documents", icon: FolderOpen },
  { path: "/pos-terminals", label: "POS Terminals", icon: Smartphone },
  { path: "/collateral-valuation", label: "Collateral Valuation", icon: Scale },
  { path: "/customer-feedback", label: "Feedback & NPS", icon: Star },
  { path: "/money-market", label: "Money Market", icon: Banknote },
  { path: "/securities-trading", label: "Securities Trading", icon: TrendingUp },
  { path: "/supply-chain-finance", label: "Supply Chain Finance", icon: Link2 },
  { path: "/cash-pooling", label: "Cash Pooling", icon: Layers },
  { path: "/bank-guarantees", label: "Bank Guarantees", icon: ShieldCheck },
  { path: "/otc-derivatives", label: "OTC Derivatives", icon: Sigma },
  { path: "/iso20022-hub", label: "ISO 20022 Hub", icon: FileText },
  { path: "/basel-engine", label: "Basel III/IV Engine", icon: Scale },
  { path: "/ifrs9-engine", label: "IFRS 9 Engine", icon: Calculator },
  { path: "/open-banking", label: "Open Banking", icon: Globe },
  { path: "/interbank-lending", label: "Interbank Lending", icon: ArrowLeftRight },
  { path: "/portfolio-mgmt", label: "Portfolio Mgmt", icon: PieChart },
  { path: "/wealth-mgmt", label: "Wealth Mgmt", icon: Landmark },
  { path: "/custody-service", label: "Custody Services", icon: Lock },
  { path: "/factoring", label: "Factoring", icon: Receipt },
  { path: "/syndicated-loans", label: "Syndicated Loans", icon: Users },
  { path: "/project-finance", label: "Project Finance", icon: Building2 },
  { path: "/leasing", label: "Leasing", icon: Package },
  { path: "/contingent-liabilities", label: "Contingent Liabilities", icon: AlertTriangle },
  { path: "/etd-trading", label: "ETD Trading", icon: TrendingUp },
  { path: "/payment-investigation", label: "Payment Investigation", icon: Search },
  { path: "/stress-testing", label: "Stress Testing", icon: Gauge },
  { path: "/api-marketplace", label: "API Marketplace", icon: Globe },
  { path: "/chatbot", label: "AI Chatbot", icon: MessageSquare },
  { path: "/signature-verification", label: "Signature Verification", icon: FileSearch },
  { path: "/remittance", label: "Remittance", icon: Send },
  { path: "/microfinance", label: "Microfinance", icon: Heart },
  { path: "/utility-payments", label: "Utility Payments", icon: Zap },
  { path: "/multi-entity", label: "Multi-Entity", icon: GitBranch },
  { path: "/trust-estate", label: "Trust & Estate", icon: ScrollText },
  { path: "/escrow", label: "Escrow", icon: Shield },
  { path: "/qr-payments", label: "QR Payments", icon: QrCode },
  { path: "/fatca-crs", label: "FATCA/CRS", icon: FileWarning },
  { path: "/biometric-auth", label: "Biometric Auth", icon: Fingerprint },
  { path: "/safe-deposit", label: "Safe Deposit Box", icon: Box },
  { path: "/fixed-assets", label: "Fixed Assets", icon: Building },
  { path: "/expense-mgmt", label: "Expense Mgmt", icon: Wallet },
  { path: "/inventory", label: "Inventory", icon: Archive },
  { path: "/insurance", label: "Bancassurance", icon: ShieldCheck },
  { path: "/pension", label: "Pension", icon: Landmark },
  { path: "/locker", label: "Digital Locker", icon: FolderLock },
  { path: "/standing-charges", label: "Standing Charges", icon: ListChecks },
  { path: "/sukuk-management", label: "Sukuk Bonds", icon: Landmark },
  { path: "/takaful-management", label: "Takaful Insurance", icon: Heart },
  { path: "/wakala-investments", label: "Wakala Investments", icon: TrendingUp },
  { path: "/agent-performance", label: "Agent Performance", icon: Users },
  { path: "/watchlist-screening", label: "Watchlist Screening", icon: AlertTriangle },
  { path: "/sar-reports", label: "SAR Reports", icon: FileText },
  { path: "/pep-database", label: "PEP Database", icon: Shield },
  { path: "/card-tokens", label: "Card Tokens", icon: Smartphone },
  { path: "/card-fraud-rules", label: "Card Fraud Rules", icon: ShieldAlert },
  { path: "/statement-history", label: "Statement History", icon: FileBarChart },
  { path: "/workflow-definitions", label: "Workflows", icon: GitBranch },
  { path: "/workflow-instances", label: "Workflow Instances", icon: PlayCircle },
  { path: "/my-transactions", label: "My Transactions", icon: Receipt },
  { path: "/service-health", label: "Service Health", icon: Activity },
] as const;

export default function ArchiveAdminSidebar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navigationItems = (
    <div className="space-y-1">
      {menuItems.map((item) => {
        const Icon = item.icon;
        const active = location === item.path;
        return (
          <Link
            key={item.path}
            href={item.path}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors ${
              active ? "bg-blue-50 font-medium text-blue-700" : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Icon size={18} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-blue-600">54Bank</h1>
            <p className="truncate text-xs text-slate-500">Super Admin Console</p>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-xs text-slate-500">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          Archive and routed banking workspaces unified
        </div>
        {mobileOpen ? (
          <div className="mt-3 max-h-[70vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-4 py-4">
              <Link
                href="/admin/onboarding"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(37,99,235,0.18)]"
              >
                <Plus size={18} />
                Review Partners
              </Link>
            </div>
            <nav className="px-4 py-4">{navigationItems}</nav>
            <div className="border-t border-slate-200 px-4 py-4">
              <div className="flex items-center gap-3 rounded-xl px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                  SA
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">Super Admin</p>
                  <p className="truncate text-xs text-slate-500">admin@54bank.com</p>
                </div>
              </div>
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="mt-2 flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50"
              >
                <LogOut size={18} />
                Logout
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      <aside className="hidden min-h-screen w-72 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="border-b border-slate-200 px-6 py-6">
          <h1 className="text-2xl font-bold text-blue-600">54Bank</h1>
          <p className="mt-1 text-xs text-slate-500">Super Admin Console</p>
          <div className="mt-5 flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            Archive and routed banking workspaces unified
          </div>
        </div>

        <div className="border-b border-slate-200 px-4 py-4">
          <Link
            href="/admin/onboarding"
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(37,99,235,0.18)]"
          >
            <Plus size={18} />
            Review Partners
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-4">{navigationItems}</nav>

        <div className="border-t border-slate-200 px-4 py-4">
          <div className="flex items-center gap-3 rounded-xl px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
              SA
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">Super Admin</p>
              <p className="truncate text-xs text-slate-500">admin@54bank.com</p>
            </div>
          </div>
          <Link href="/login" className="mt-2 flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50">
            <LogOut size={18} />
            Logout
          </Link>
        </div>
      </aside>
    </>
  );
}
