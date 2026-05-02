import React from 'react';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Shield,
  FileText,
  Code,
  Settings,
  Bell,
  LogOut,
  ChevronDown,
  Activity,
  AlertTriangle,
  Wallet,
  Building2,
  UserPlus,
  ClipboardList,
  UserCheck,
  Fingerprint,
  Upload,
  TestTube,
  Clock,
  Copy,
  UserCog,
  Globe,
  Route,
  BarChart3,
  Server,
  Gavel,
  RefreshCw,
  Layers,
  HeadphonesIcon,
  DollarSign,
  ScrollText,
  Wrench,
  Gauge,
  Gift,
  Webhook,
  Zap,
  Database,
  Cpu,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  collapsed?: boolean;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  section?: string;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  // Operations
  {
    id: 'dashboard',
    label: 'NOC Dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    section: 'Operations',
  },
  {
    id: 'journeys',
    label: 'User Journeys',
    icon: <Route className="h-5 w-5" />,
  },
  {
    id: 'journey-analytics',
    label: 'Journey Analytics',
    icon: <BarChart3 className="h-5 w-5" />,
  },
  {
    id: 'transactions',
    label: 'Transactions',
    icon: <Activity className="h-5 w-5" />,
  },
  {
    id: 'disputes',
    label: 'Disputes',
    icon: <Gavel className="h-5 w-5" />,
    badge: 3,
  },
  {
    id: 'recurring-remittances',
    label: 'Recurring Remittances',
    icon: <RefreshCw className="h-5 w-5" />,
  },
  {
    id: 'batch-transfers',
    label: 'Batch Transfers',
    icon: <Layers className="h-5 w-5" />,
  },
  {
    id: 'settlements',
    label: 'Settlements',
    icon: <Wallet className="h-5 w-5" />,
    badge: 3,
  },
  // Participants & Onboarding
  {
    id: 'participants',
    label: 'Participants',
    icon: <Building2 className="h-5 w-5" />,
    section: 'Participants',
  },
  {
    id: 'provisioning',
    label: 'Provisioning Admin',
    icon: <Server className="h-5 w-5" />,
  },
  {
    id: 'onboarding',
    label: 'Onboarding',
    icon: <ClipboardList className="h-5 w-5" />,
    badge: 5,
  },
  {
    id: 'kyb',
    label: 'KYB Verification',
    icon: <Building2 className="h-5 w-5" />,
    badge: 3,
  },
  {
    id: 'kyc',
    label: 'KYC Verification',
    icon: <UserCheck className="h-5 w-5" />,
    badge: 4,
  },
  {
    id: 'apply',
    label: 'Apply',
    icon: <UserPlus className="h-5 w-5" />,
  },
  {
    id: 'kyc-applicant',
    label: 'KYC Portal',
    icon: <Fingerprint className="h-5 w-5" />,
  },
  {
    id: 'bulk-onboarding',
    label: 'Bulk Onboarding',
    icon: <Upload className="h-5 w-5" />,
  },
  {
    id: 'integration-testing',
    label: 'Integration Testing',
    icon: <TestTube className="h-5 w-5" />,
  },
  {
    id: 'sla-dashboard',
    label: 'SLA Tracking',
    icon: <Clock className="h-5 w-5" />,
    badge: 3,
  },
  {
    id: 'template-cloning',
    label: 'Template Cloning',
    icon: <Copy className="h-5 w-5" />,
  },
  {
    id: 'reviewer-rules',
    label: 'Reviewer Rules',
    icon: <UserCog className="h-5 w-5" />,
  },
  // Risk & Compliance
  {
    id: 'fraud',
    label: 'Fraud & Risk',
    icon: <Shield className="h-5 w-5" />,
    badge: 12,
    section: 'Risk & Compliance',
  },
  {
    id: 'compliance-reports',
    label: 'Compliance Reports',
    icon: <FileText className="h-5 w-5" />,
  },
  {
    id: 'security-dashboard',
    label: 'Security & PBAC',
    icon: <Shield className="h-5 w-5" />,
  },
  {
    id: 'transaction-limits',
    label: 'Transaction Limits',
    icon: <Gauge className="h-5 w-5" />,
  },
  {
    id: 'fee-management',
    label: 'Fee Management',
    icon: <DollarSign className="h-5 w-5" />,
  },
  {
    id: 'audit-log',
    label: 'Audit Log',
    icon: <ScrollText className="h-5 w-5" />,
  },
  // Platform Services
  {
    id: 'users',
    label: 'User Management',
    icon: <Users className="h-5 w-5" />,
    section: 'Platform',
  },
  {
    id: 'support-center',
    label: 'Support Center',
    icon: <HeadphonesIcon className="h-5 w-5" />,
    badge: 7,
  },
  {
    id: 'referrals',
    label: 'Referral Program',
    icon: <Gift className="h-5 w-5" />,
  },
  {
    id: 'webhooks',
    label: 'Webhook Config',
    icon: <Webhook className="h-5 w-5" />,
  },
  {
    id: 'maintenance',
    label: 'Maintenance Mode',
    icon: <Wrench className="h-5 w-5" />,
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: <FileText className="h-5 w-5" />,
  },
  // Outbound Remittance
  {
    id: 'outbound-remittance',
    label: 'Outbound Remittance',
    icon: <Globe className="h-5 w-5" />,
    section: 'Cross-Border',
  },
  // Infrastructure
  {
    id: 'rust-services',
    label: 'Rust Services',
    icon: <Cpu className="h-5 w-5" />,
    section: 'Infrastructure',
  },
  {
    id: 'go-services',
    label: 'Go Services',
    icon: <Zap className="h-5 w-5" />,
  },
  {
    id: 'middleware',
    label: 'Middleware',
    icon: <Database className="h-5 w-5" />,
  },
  {
    id: 'developer',
    label: 'Developer Portal',
    icon: <Code className="h-5 w-5" />,
  },
  {
    id: 'alerts',
    label: 'Alerts',
    icon: <AlertTriangle className="h-5 w-5" />,
    badge: 5,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings className="h-5 w-5" />,
  },
];

export function Sidebar({ currentPage, onNavigate, collapsed = false }: SidebarProps) {
  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-gray-900 text-white transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-b border-gray-800">
        {collapsed ? (
          <span className="text-xl font-bold text-primary-400">PS</span>
        ) : (
          <span className="text-xl font-bold">
            <span className="text-primary-400">Payment</span>
            <span className="text-white">Switch</span>
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="mt-2 px-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 140px)' }}>
        <ul className="space-y-0.5 pb-4">
          {navItems.map((item) => (
            <li key={item.id}>
              {item.section && !collapsed && (
                <div className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  {item.section}
                </div>
              )}
              {item.section && collapsed && (
                <div className="my-2 mx-2 border-t border-gray-700" />
              )}
              <button
                onClick={() => onNavigate(item.id)}
                className={cn(
                  'flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  currentPage === item.id
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                )}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && (
                  <>
                    <span className="ml-3 flex-1 text-left truncate">{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="ml-2 flex-shrink-0 rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* User section */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-gray-800 p-4">
        {!collapsed && (
          <div className="flex items-center">
            <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center">
              <span className="text-sm font-medium">AD</span>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-white">Admin User</p>
              <p className="text-xs text-gray-400">admin@payment-switch.com</p>
            </div>
            <button className="text-gray-400 hover:text-white">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
