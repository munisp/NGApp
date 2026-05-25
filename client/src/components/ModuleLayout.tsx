import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Globe, ArrowDownLeft, Banknote, Ship, CreditCard, Landmark, Code,
  PanelLeftClose, PanelLeft, ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  section?: string;
}

export interface ModuleConfig {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  accentColor: string;
  accentBg: string;
  accentHover: string;
}

const ALL_MODULES = [
  { label: 'Outbound Remittance', href: '/outbound-remittance', icon: Globe, color: 'text-blue-500' },
  { label: 'Inbound Remittance', href: '/inbound-remittance', icon: ArrowDownLeft, color: 'text-emerald-600' },
  { label: 'Domestic Payments', href: '/domestic-payments', icon: Banknote, color: 'text-blue-600' },
  { label: 'Trade Payments', href: '/trade-payments', icon: Ship, color: 'text-violet-600' },
  { label: 'Card Processing', href: '/card-processing', icon: CreditCard, color: 'text-red-600' },
  { label: 'Government Payments', href: '/government-payments', icon: Landmark, color: 'text-sky-700' },
  { label: 'Open Banking', href: '/open-banking', icon: Code, color: 'text-sky-500' },
];

interface ModuleLayoutProps {
  module: ModuleConfig;
  navItems: NavItem[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

export default function ModuleLayout({
  module,
  navItems,
  activeTab,
  onTabChange,
  children,
}: ModuleLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [location] = useLocation();

  const sections = new Map<string | undefined, NavItem[]>();
  navItems.forEach(item => {
    const key = item.section;
    if (!sections.has(key)) sections.set(key, []);
    sections.get(key)!.push(item);
  });

  const otherModules = ALL_MODULES.filter(m => m.href !== location);

  return (
    <div className="flex min-h-screen bg-background font-sans">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col flex-shrink-0 border-r border-border bg-muted/30 transition-all duration-200',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        {/* Module Header */}
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
          <module.icon className={cn('h-5 w-5 flex-shrink-0', module.accentColor)} />
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-bold truncate">{module.title}</div>
              <div className="text-[11px] text-muted-foreground truncate">{module.subtitle}</div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto p-1 rounded hover:bg-accent text-muted-foreground"
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {Array.from(sections.entries()).map(([section, items]) => (
            <React.Fragment key={section || 'main'}>
              {section && !collapsed && (
                <div className="px-3 pt-4 pb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {section.replace(/_/g, ' ')}
                  </span>
                </div>
              )}
              {section && collapsed && <div className="my-2 mx-2 border-t border-border" />}
              {items.map(item => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center gap-2.5 w-full rounded-md text-left text-[13px] font-medium transition-colors',
                      collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2',
                      isActive
                        ? cn(module.accentBg, 'text-white shadow-sm')
                        : 'text-foreground/80 hover:bg-accent hover:text-foreground'
                    )}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </nav>

        {/* Other Modules */}
        {!collapsed && (
          <div className="border-t border-border p-2 pb-3">
            <div className="px-3 py-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Other Modules
              </span>
            </div>
            {otherModules.map(m => (
              <Link key={m.href} href={m.href}>
                <a className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  m.color, 'hover:bg-accent'
                )}>
                  <m.icon className="h-3.5 w-3.5" />
                  {m.label}
                  <ChevronRight className="h-3 w-3 ml-auto opacity-40" />
                </a>
              </Link>
            ))}
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1280px] p-6 space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
}
