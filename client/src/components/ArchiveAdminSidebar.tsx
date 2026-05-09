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
