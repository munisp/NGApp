"use client";

import { useState } from "react";
import { useUserStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { useI18nStore, LOCALE_NAMES, type Locale } from "@/lib/i18n";

export default function TopBar() {
  const { user, notifications, unreadCount } = useUserStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const { locale, setLocale, t } = useI18nStore();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-surface-700 bg-surface-800/80 px-4 backdrop-blur-xl" role="banner">
      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search commodities, orders..."
            className="h-9 w-64 rounded-lg bg-surface-900 border border-surface-700 pl-9 pr-3 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none"
            aria-label="Search commodities and orders"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden rounded bg-surface-700 px-1.5 py-0.5 text-[10px] text-gray-500 sm:block">
            /
          </kbd>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Market Status */}
        <div className="hidden items-center gap-2 rounded-lg bg-surface-700/50 px-3 py-1.5 sm:flex">
          <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
          <span className="text-xs text-gray-400">{t("common.marketsOpen")}</span>
        </div>

        {/* Language Selector */}
        <div className="relative">
          <button
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="rounded-lg p-2 text-gray-400 hover:bg-surface-700 hover:text-white transition-colors text-xs font-medium"
            aria-label="Change language"
            aria-expanded={showLangMenu}
          >
            {locale.toUpperCase()}
          </button>
          {showLangMenu && (
            <div className="absolute right-0 top-full mt-1 z-50 rounded-lg bg-surface-800 border border-surface-700 shadow-xl py-1 min-w-[140px]">
              {(Object.entries(LOCALE_NAMES) as [Locale, string][]).map(([code, name]) => (
                <button
                  key={code}
                  onClick={() => { setLocale(code); setShowLangMenu(false); }}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-xs hover:bg-surface-700 transition-colors",
                    locale === code ? "text-brand-400 font-medium" : "text-gray-400"
                  )}
                >
                  {name}
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
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative rounded-lg p-2 text-gray-400 hover:bg-surface-700 hover:text-white transition-colors"
            aria-label={`Notifications, ${unreadCount} unread`}
            aria-expanded={showNotifications}
          >
            <BellIcon className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white" aria-hidden="true">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-surface-700 bg-surface-800 shadow-2xl" role="dialog" aria-label="Notifications">
              <div className="flex items-center justify-between border-b border-surface-700 px-4 py-3">
                <h3 className="text-sm font-semibold">Notifications</h3>
                <span className="text-xs text-gray-500">{unreadCount} unread</span>
              </div>
              <div className="max-h-80 overflow-y-auto scrollbar-thin">
                {notifications.slice(0, 5).map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      "border-b border-surface-700 px-4 py-3 hover:bg-surface-700/50 transition-colors cursor-pointer",
                      !n.read && "bg-brand-600/5"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />}
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="mt-0.5 text-xs text-gray-400 line-clamp-2">{n.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-bold" aria-hidden="true">
            {user?.name?.charAt(0) ?? "?"}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="text-[10px] text-gray-500 uppercase">{user?.accountTier?.replace("_", " ")}</p>
          </div>
        </div>
      </div>
    </header>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}
