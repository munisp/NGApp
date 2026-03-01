"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { useI18nStore, LOCALE_NAMES, type Locale } from "@/lib/i18n";
import {
  Search,
  Bell,
  Globe,
  ChevronDown,
  CircleDot,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";

const NOTIF_ICONS: Record<string, typeof TrendingUp> = {
  trade: TrendingUp,
  alert: AlertTriangle,
  margin: ShieldCheck,
  system: CircleDot,
};

export default function TopBar() {
  const router = useRouter();
  const { user, notifications, unreadCount } = useUserStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { locale, setLocale, t } = useI18nStore();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/markets?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
    }
  };

  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center justify-between px-4 lg:px-6"
      style={{
        background: "linear-gradient(180deg, rgba(2, 6, 23, 0.9) 0%, rgba(2, 6, 23, 0.7) 100%)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
        backdropFilter: "blur(20px)",
      }}
      role="banner"
    >
      {/* Search */}
      <div className="flex items-center gap-3">
        <form onSubmit={handleSearch} className="relative group">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600 group-focus-within:text-brand-400 transition-colors" />
          <input
            type="text"
            placeholder="Search commodities, orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-72 rounded-xl pl-10 pr-12 text-sm text-white placeholder-gray-600 transition-all duration-200 focus:w-80"
            style={{
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgba(16, 185, 129, 0.3)";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(16, 185, 129, 0.08)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.06)";
              e.currentTarget.style.boxShadow = "none";
            }}
            aria-label="Search commodities and orders"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden rounded-md px-1.5 py-0.5 text-[10px] font-medium text-gray-600 sm:block"
            style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.06)" }}
          >
            /
          </kbd>
        </form>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-1.5">
        {/* Market Status */}
        <div className="hidden items-center gap-2 rounded-xl px-3 py-2 sm:flex"
          style={{ background: "rgba(16, 185, 129, 0.06)", border: "1px solid rgba(16, 185, 129, 0.1)" }}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
          </span>
          <span className="text-[11px] font-medium text-brand-400">{t("common.marketsOpen")}</span>
        </div>

        {/* Language Selector */}
        <div className="relative">
          <button
            onClick={() => { setShowLangMenu(!showLangMenu); setShowNotifications(false); }}
            className="flex items-center gap-1 rounded-xl px-2.5 py-2 text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] transition-all duration-200"
            aria-label="Change language"
            aria-expanded={showLangMenu}
          >
            <Globe className="h-4 w-4" />
            <span className="text-[11px] font-medium hidden sm:inline">{locale.toUpperCase()}</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          {showLangMenu && (
            <div className="absolute right-0 top-full mt-2 z-50 rounded-xl py-1.5 min-w-[160px] shadow-dropdown animate-fade-in"
              style={{ background: "rgba(15, 23, 42, 0.95)", border: "1px solid rgba(255, 255, 255, 0.08)", backdropFilter: "blur(20px)" }}
            >
              {(Object.entries(LOCALE_NAMES) as [Locale, string][]).map(([code, name]) => (
                <button
                  key={code}
                  onClick={() => { setLocale(code); setShowLangMenu(false); }}
                  className={cn(
                    "w-full flex items-center gap-2 text-left px-3.5 py-2 text-xs transition-colors rounded-lg mx-0",
                    locale === code
                      ? "text-brand-400 font-medium bg-brand-500/10"
                      : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                  )}
                >
                  {locale === code && <CheckCircle2 className="h-3.5 w-3.5" />}
                  <span className={locale !== code ? "ml-5" : ""}>{name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setShowNotifications(!showNotifications); setShowLangMenu(false); }}
            className="relative flex items-center justify-center rounded-xl w-10 h-10 text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] transition-all duration-200"
            aria-label={`Notifications, ${unreadCount} unread`}
            aria-expanded={showNotifications}
          >
            <Bell className="h-[18px] w-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full text-[9px] font-bold text-white px-1"
                style={{ background: "linear-gradient(135deg, #ef4444, #f87171)" }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-[360px] rounded-2xl shadow-dropdown animate-fade-in overflow-hidden"
              style={{ background: "rgba(15, 23, 42, 0.95)", border: "1px solid rgba(255, 255, 255, 0.08)", backdropFilter: "blur(20px)" }}
              role="dialog"
              aria-label="Notifications"
            >
              <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                <h3 className="text-sm font-semibold">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="badge-info text-[10px]">{unreadCount} new</span>
                )}
              </div>
              <div className="max-h-[380px] overflow-y-auto scrollbar-thin">
                {notifications.slice(0, 5).map((n) => {
                  const IconComp = NOTIF_ICONS[n.type] ?? CircleDot;
                  return (
                    <div
                      key={n.id}
                      className={cn(
                        "px-5 py-3.5 transition-colors cursor-pointer",
                        !n.read ? "bg-brand-500/[0.03]" : "hover:bg-white/[0.02]"
                      )}
                      style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.03)" }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          n.type === "trade" ? "bg-brand-500/10 text-brand-400" :
                          n.type === "alert" ? "bg-amber-500/10 text-amber-400" :
                          n.type === "margin" ? "bg-red-500/10 text-red-400" :
                          "bg-gray-500/10 text-gray-400"
                        )}>
                          <IconComp className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{n.title}</p>
                            {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />}
                          </div>
                          <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{n.message}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="px-5 py-3" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.04)" }}>
                <button
                  onClick={() => { setShowNotifications(false); router.push("/alerts"); }}
                  className="w-full text-center text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors"
                >
                  View all notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-1.5 h-6 w-px bg-white/[0.06]" />

        {/* User */}
        <button
          onClick={() => router.push("/account")}
          className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-white/[0.04] transition-all duration-200"
        >
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
            style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}
          >
            {user?.name?.charAt(0) ?? "?"}
            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-brand-500 border-2 border-surface-900" />
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-[13px] font-medium text-gray-200">{user?.name}</p>
            <p className="text-[10px] font-medium text-gray-600 uppercase tracking-wide">{user?.accountTier?.replace("_", " ")}</p>
          </div>
        </button>
      </div>
    </header>
  );
}
