"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ArrowUpDown,
  TrendingUp,
  Wallet,
  ClipboardList,
  Bell,
  BarChart3,
  User,
  Zap,
  Users,
  LineChart,
  FileText,
  Building2,
  Coins,
  Shield,
  DollarSign,
  UserCheck,
  Fingerprint,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/trade", label: "Trade", icon: ArrowUpDown },
  { href: "/markets", label: "Markets", icon: TrendingUp },
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
  { href: "/orders", label: "Orders", icon: ClipboardList },
  { href: "/market-makers", label: "Market Makers", icon: Users },
  { href: "/indices", label: "Indices", icon: LineChart },
  { href: "/corporate-actions", label: "Corp Actions", icon: FileText },
  { href: "/brokers", label: "Brokers", icon: Building2 },
  { href: "/digital-assets", label: "Digital Assets", icon: Coins },
  { href: "/onboarding", label: "KYC / KYB", icon: UserCheck },
  { href: "/compliance", label: "Compliance", icon: Fingerprint },
  { href: "/revenue", label: "Revenue", icon: DollarSign },
  { href: "/surveillance", label: "Surveillance", icon: Shield },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/account", label: "Account", icon: User },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[68px] flex-col border-r border-white/[0.06] lg:w-60"
      style={{
        background: "linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(2, 6, 23, 0.98) 100%)",
        backdropFilter: "blur(20px)",
      }}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-4 lg:px-5">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-white"
          style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}
        >
          <Zap className="h-4.5 w-4.5" strokeWidth={2.5} />
          <div className="absolute inset-0 rounded-xl" style={{ boxShadow: "0 0 20px rgba(16, 185, 129, 0.3)" }} />
        </div>
        <div className="hidden lg:block">
          <span className="text-sm font-bold tracking-tight text-white">NEXCOM</span>
          <span className="ml-1 text-[10px] font-medium text-brand-400">Exchange</span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-white/[0.04]" />

      {/* Navigation */}
      <nav className="mt-3 flex flex-1 flex-col gap-0.5 px-2.5 overflow-y-auto scrollbar-none">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
                isActive
                  ? "text-white"
                  : "text-gray-500 hover:text-gray-200"
              )}
            >
              {/* Active indicator bar */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-brand-500" />
              )}

              {/* Active background glow */}
              {isActive && (
                <div className="absolute inset-0 rounded-xl"
                  style={{
                    background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.04))",
                    border: "1px solid rgba(16, 185, 129, 0.1)",
                  }}
                />
              )}

              {/* Hover background */}
              {!isActive && (
                <div className="absolute inset-0 rounded-xl bg-white/0 group-hover:bg-white/[0.04] transition-colors duration-200" />
              )}

              <div className={cn(
                "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-200",
                isActive
                  ? "text-brand-400"
                  : "text-gray-500 group-hover:text-gray-300"
              )}>
                <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2 : 1.5} />
              </div>

              <span className="relative z-10 hidden lg:block">{item.label}</span>

              {/* Active dot for collapsed sidebar */}
              {isActive && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-brand-400 lg:hidden" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="mx-3 border-t border-white/[0.04]" />
      <div className="flex items-center gap-2.5 px-4 py-4 lg:px-5">
        <div className="relative">
          <span className="flex h-2 w-2 rounded-full bg-brand-500">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-40" />
          </span>
        </div>
        <div className="hidden lg:block">
          <p className="text-[11px] font-medium text-gray-400">System Online</p>
          <p className="text-[10px] text-gray-600">Latency: 5ms</p>
        </div>
      </div>
    </aside>
  );
}
