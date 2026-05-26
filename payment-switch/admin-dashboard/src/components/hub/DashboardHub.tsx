'use client';

import React from 'react';
import {
  LayoutDashboard,
  Shield,
  Wallet,
  Building2,
  UserCheck,
  FileText,
  Code,
  Globe,
  Activity,
  Gavel,
  AlertTriangle,
  ScrollText,
  Gauge,
  DollarSign,
  Server,
  Database,
  Zap,
  Cpu,
  HeadphonesIcon,
  ArrowRight,
  Users,
  ClipboardList,
  Gift,
  ExternalLink,
  CheckCircle,
  MinusCircle,
} from 'lucide-react';
import { useAuth, ROLES } from '@/lib/auth';

interface DashboardHubProps {
  onNavigate: (page: string) => void;
}

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  accentColor: string;
  requiredRoles: string[];
}

const stakeholderProfiles: {
  role: string;
  title: string;
  subtitle: string;
  accent: string;
  bgGradient: string;
  quickActions: string[];
}[] = [
  {
    role: ROLES.SUPER_ADMIN,
    title: 'Super Administrator',
    subtitle: 'Full platform access — all modules, all settings',
    accent: 'text-indigo-600',
    bgGradient: 'from-indigo-600 to-blue-600',
    quickActions: ['dashboard', 'participants', 'settlements', 'fraud', 'users', 'security-dashboard', 'middleware'],
  },
  {
    role: 'cbn',
    title: 'CBN Regulator',
    subtitle: 'Regulatory oversight — compliance, reporting, audit trails',
    accent: 'text-red-600',
    bgGradient: 'from-red-600 to-rose-600',
    quickActions: ['dashboard', 'compliance-reports', 'audit-log', 'transaction-limits', 'fraud', 'settlements'],
  },
  {
    role: ROLES.NOC_OPERATOR,
    title: 'NOC Operator',
    subtitle: 'Network operations — monitoring, incidents, kill switches',
    accent: 'text-blue-600',
    bgGradient: 'from-blue-600 to-cyan-600',
    quickActions: ['dashboard', 'alerts', 'transactions', 'settlements', 'middleware', 'maintenance'],
  },
  {
    role: ROLES.SETTLEMENT_OFFICER,
    title: 'Settlement Officer',
    subtitle: 'Settlement management — batches, reconciliation, disputes',
    accent: 'text-emerald-600',
    bgGradient: 'from-emerald-600 to-teal-600',
    quickActions: ['settlements', 'transactions', 'disputes', 'batch-transfers', 'recurring-remittances', 'fee-management'],
  },
  {
    role: ROLES.COMPLIANCE_OFFICER,
    title: 'Compliance Officer',
    subtitle: 'Risk & compliance — fraud monitoring, sanctions, reporting',
    accent: 'text-amber-600',
    bgGradient: 'from-amber-600 to-orange-600',
    quickActions: ['compliance-reports', 'fraud', 'audit-log', 'kyb', 'kyc', 'transaction-limits'],
  },
  {
    role: ROLES.FRAUD_ANALYST,
    title: 'Fraud Analyst',
    subtitle: 'Fraud detection — alerts, risk scoring, transaction monitoring',
    accent: 'text-rose-600',
    bgGradient: 'from-rose-600 to-red-600',
    quickActions: ['fraud', 'transactions', 'alerts', 'compliance-reports'],
  },
  {
    role: ROLES.KYC_REVIEWER,
    title: 'KYC Reviewer',
    subtitle: 'Identity verification — KYC applications, document review',
    accent: 'text-teal-600',
    bgGradient: 'from-teal-600 to-emerald-600',
    quickActions: ['kyc', 'onboarding', 'reviewer-rules'],
  },
  {
    role: ROLES.KYB_REVIEWER,
    title: 'KYB Reviewer',
    subtitle: 'Business verification — KYB applications, corporate documents',
    accent: 'text-violet-600',
    bgGradient: 'from-violet-600 to-purple-600',
    quickActions: ['kyb', 'onboarding', 'reviewer-rules'],
  },
  {
    role: ROLES.DEVELOPER,
    title: 'Developer / Integrator',
    subtitle: 'API access — developer portal, webhooks, integration testing',
    accent: 'text-gray-700',
    bgGradient: 'from-gray-700 to-gray-600',
    quickActions: ['developer', 'webhooks', 'integration-testing', 'go-services', 'rust-services', 'middleware'],
  },
  {
    role: ROLES.PARTICIPANT_ADMIN,
    title: 'Participant Admin',
    subtitle: 'Participant management — onboarding, provisioning, SLA tracking',
    accent: 'text-cyan-600',
    bgGradient: 'from-cyan-600 to-blue-600',
    quickActions: ['onboarding', 'participants', 'provisioning', 'sla-dashboard', 'integration-testing', 'reports'],
  },
  {
    role: ROLES.AUDITOR,
    title: 'Auditor',
    subtitle: 'Audit & review — logs, compliance reports, journey analytics',
    accent: 'text-orange-600',
    bgGradient: 'from-orange-600 to-amber-600',
    quickActions: ['audit-log', 'compliance-reports', 'journey-analytics', 'reports'],
  },
  {
    role: 'merchant',
    title: 'Merchant',
    subtitle: 'Merchant services — fees, transactions, support',
    accent: 'text-emerald-600',
    bgGradient: 'from-emerald-600 to-green-600',
    quickActions: ['transactions', 'fee-management', 'support-center', 'apply'],
  },
  {
    role: 'participant',
    title: 'Participant (Bank/PSP/Fintech)',
    subtitle: 'Participant services — onboarding, integration, remittances',
    accent: 'text-sky-600',
    bgGradient: 'from-sky-600 to-blue-600',
    quickActions: ['apply', 'onboarding', 'integration-testing', 'transactions', 'disputes', 'outbound-remittance'],
  },
];

const allQuickActions: Record<string, QuickAction> = {
  dashboard: { id: 'dashboard', label: 'NOC Dashboard', description: 'Real-time network operations center', icon: <LayoutDashboard className="h-5 w-5" />, accentColor: 'text-blue-600 bg-blue-50', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.NOC_OPERATOR, 'cbn', 'admin'] },
  settlements: { id: 'settlements', label: 'Settlements', description: 'Settlement batches & reconciliation', icon: <Wallet className="h-5 w-5" />, accentColor: 'text-emerald-600 bg-emerald-50', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.SETTLEMENT_OFFICER, 'cbn', 'admin'] },
  fraud: { id: 'fraud', label: 'Fraud & Risk', description: 'Fraud detection & risk scoring', icon: <Shield className="h-5 w-5" />, accentColor: 'text-rose-600 bg-rose-50', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.FRAUD_ANALYST, ROLES.COMPLIANCE_OFFICER, 'cbn', 'admin'] },
  participants: { id: 'participants', label: 'Participants', description: 'Banks, PSPs, fintechs on the network', icon: <Building2 className="h-5 w-5" />, accentColor: 'text-violet-600 bg-violet-50', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.PARTICIPANT_ADMIN, 'cbn', 'admin'] },
  transactions: { id: 'transactions', label: 'Transactions', description: 'Real-time transaction monitoring', icon: <Activity className="h-5 w-5" />, accentColor: 'text-cyan-600 bg-cyan-50', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.NOC_OPERATOR, ROLES.SETTLEMENT_OFFICER, 'admin', 'merchant', 'participant'] },
  'compliance-reports': { id: 'compliance-reports', label: 'Compliance Reports', description: 'Regulatory & compliance reporting', icon: <FileText className="h-5 w-5" />, accentColor: 'text-amber-600 bg-amber-50', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.COMPLIANCE_OFFICER, ROLES.AUDITOR, 'cbn', 'admin'] },
  'audit-log': { id: 'audit-log', label: 'Audit Log', description: 'Complete platform audit trail', icon: <ScrollText className="h-5 w-5" />, accentColor: 'text-orange-600 bg-orange-50', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.AUDITOR, ROLES.COMPLIANCE_OFFICER, 'cbn', 'admin'] },
  kyb: { id: 'kyb', label: 'KYB Verification', description: 'Business verification portal', icon: <Building2 className="h-5 w-5" />, accentColor: 'text-indigo-600 bg-indigo-50', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.KYB_REVIEWER, ROLES.COMPLIANCE_OFFICER, 'admin'] },
  kyc: { id: 'kyc', label: 'KYC Verification', description: 'Identity verification portal', icon: <UserCheck className="h-5 w-5" />, accentColor: 'text-teal-600 bg-teal-50', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.KYC_REVIEWER, ROLES.COMPLIANCE_OFFICER, 'admin'] },
  onboarding: { id: 'onboarding', label: 'Onboarding', description: 'Participant onboarding pipeline', icon: <ClipboardList className="h-5 w-5" />, accentColor: 'text-sky-600 bg-sky-50', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.PARTICIPANT_ADMIN, 'admin', 'participant'] },
  developer: { id: 'developer', label: 'Developer Portal', description: 'API docs, SDKs, sandbox', icon: <Code className="h-5 w-5" />, accentColor: 'text-gray-600 bg-gray-100', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.DEVELOPER, 'admin', 'participant'] },
  webhooks: { id: 'webhooks', label: 'Webhook Config', description: 'Configure event webhooks', icon: <Globe className="h-5 w-5" />, accentColor: 'text-purple-600 bg-purple-50', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.DEVELOPER, 'admin', 'participant'] },
  alerts: { id: 'alerts', label: 'Alerts', description: 'System alerts & notifications', icon: <AlertTriangle className="h-5 w-5" />, accentColor: 'text-red-600 bg-red-50', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.NOC_OPERATOR, ROLES.FRAUD_ANALYST, 'cbn', 'admin'] },
  'security-dashboard': { id: 'security-dashboard', label: 'Security & PBAC', description: 'Security posture & access control', icon: <Shield className="h-5 w-5" />, accentColor: 'text-red-600 bg-red-50', requiredRoles: [ROLES.SUPER_ADMIN, 'cbn', 'admin'] },
  users: { id: 'users', label: 'User Management', description: 'Manage platform users & roles', icon: <Users className="h-5 w-5" />, accentColor: 'text-violet-600 bg-violet-50', requiredRoles: [ROLES.SUPER_ADMIN, 'admin'] },
  middleware: { id: 'middleware', label: 'Middleware', description: 'Kafka, Redis, TigerBeetle status', icon: <Database className="h-5 w-5" />, accentColor: 'text-blue-600 bg-blue-50', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.NOC_OPERATOR, ROLES.DEVELOPER, 'admin'] },
  'go-services': { id: 'go-services', label: 'Go Services', description: 'Go microservice health', icon: <Zap className="h-5 w-5" />, accentColor: 'text-cyan-600 bg-cyan-50', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.NOC_OPERATOR, ROLES.DEVELOPER, 'admin'] },
  'rust-services': { id: 'rust-services', label: 'Rust Services', description: 'Rust microservice health', icon: <Cpu className="h-5 w-5" />, accentColor: 'text-orange-600 bg-orange-50', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.NOC_OPERATOR, ROLES.DEVELOPER, 'admin'] },
  maintenance: { id: 'maintenance', label: 'Maintenance Mode', description: 'System maintenance controls', icon: <Server className="h-5 w-5" />, accentColor: 'text-yellow-600 bg-yellow-50', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.NOC_OPERATOR, 'admin'] },
  disputes: { id: 'disputes', label: 'Disputes', description: 'Dispute resolution center', icon: <Gavel className="h-5 w-5" />, accentColor: 'text-pink-600 bg-pink-50', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.SETTLEMENT_OFFICER, 'admin', 'participant'] },
  'batch-transfers': { id: 'batch-transfers', label: 'Batch Transfers', description: 'Batch payment processing', icon: <Activity className="h-5 w-5" />, accentColor: 'text-emerald-600 bg-emerald-50', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.SETTLEMENT_OFFICER, 'admin', 'participant'] },
  'recurring-remittances': { id: 'recurring-remittances', label: 'Recurring Remittances', description: 'Scheduled remittance management', icon: <Activity className="h-5 w-5" />, accentColor: 'text-blue-600 bg-blue-50', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.SETTLEMENT_OFFICER, 'admin', 'participant'] },
  'fee-management': { id: 'fee-management', label: 'Fee Management', description: 'Fee structures & billing', icon: <DollarSign className="h-5 w-5" />, accentColor: 'text-emerald-600 bg-emerald-50', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.SETTLEMENT_OFFICER, 'admin', 'merchant'] },
  'transaction-limits': { id: 'transaction-limits', label: 'Transaction Limits', description: 'Configure transaction limits', icon: <Gauge className="h-5 w-5" />, accentColor: 'text-amber-600 bg-amber-50', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.COMPLIANCE_OFFICER, 'cbn', 'admin'] },
  'support-center': { id: 'support-center', label: 'Support Center', description: 'Help desk & ticket system', icon: <HeadphonesIcon className="h-5 w-5" />, accentColor: 'text-blue-600 bg-blue-50', requiredRoles: [] },
  apply: { id: 'apply', label: 'Apply', description: 'Submit a new application', icon: <ClipboardList className="h-5 w-5" />, accentColor: 'text-emerald-600 bg-emerald-50', requiredRoles: [] },
  'integration-testing': { id: 'integration-testing', label: 'Integration Testing', description: 'Test API integrations', icon: <Code className="h-5 w-5" />, accentColor: 'text-gray-600 bg-gray-100', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.DEVELOPER, ROLES.PARTICIPANT_ADMIN, 'admin', 'participant'] },
  'outbound-remittance': { id: 'outbound-remittance', label: 'Outbound Remittance', description: 'Cross-border transfers', icon: <Globe className="h-5 w-5" />, accentColor: 'text-blue-600 bg-blue-50', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.NOC_OPERATOR, ROLES.SETTLEMENT_OFFICER, 'admin', 'participant'] },
  provisioning: { id: 'provisioning', label: 'Provisioning Admin', description: 'Provision new participants', icon: <Server className="h-5 w-5" />, accentColor: 'text-violet-600 bg-violet-50', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.PARTICIPANT_ADMIN, 'admin'] },
  'sla-dashboard': { id: 'sla-dashboard', label: 'SLA Tracking', description: 'SLA monitoring & compliance', icon: <Gauge className="h-5 w-5" />, accentColor: 'text-teal-600 bg-teal-50', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.PARTICIPANT_ADMIN, 'cbn', 'admin'] },
  'reviewer-rules': { id: 'reviewer-rules', label: 'Reviewer Rules', description: 'Configure reviewer assignment', icon: <Users className="h-5 w-5" />, accentColor: 'text-indigo-600 bg-indigo-50', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.KYB_REVIEWER, ROLES.KYC_REVIEWER, 'admin'] },
  reports: { id: 'reports', label: 'Reports', description: 'Platform-wide reports', icon: <FileText className="h-5 w-5" />, accentColor: 'text-gray-600 bg-gray-100', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.NOC_OPERATOR, ROLES.COMPLIANCE_OFFICER, ROLES.AUDITOR, 'cbn', 'admin'] },
  'journey-analytics': { id: 'journey-analytics', label: 'Journey Analytics', description: 'User journey analytics', icon: <Activity className="h-5 w-5" />, accentColor: 'text-cyan-600 bg-cyan-50', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.NOC_OPERATOR, ROLES.AUDITOR, 'admin'] },
  'template-cloning': { id: 'template-cloning', label: 'Template Cloning', description: 'Clone onboarding templates', icon: <ClipboardList className="h-5 w-5" />, accentColor: 'text-purple-600 bg-purple-50', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.PARTICIPANT_ADMIN, 'admin'] },
  referrals: { id: 'referrals', label: 'Referral Program', description: 'Manage referral programs', icon: <Gift className="h-5 w-5" />, accentColor: 'text-pink-600 bg-pink-50', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.PARTICIPANT_ADMIN, 'admin', 'participant', 'merchant'] },
};

const moduleAccessMatrix: Record<string, { modules: string[]; description: string }> = {
  [ROLES.SUPER_ADMIN]: { modules: ['Domestic', 'Outbound Remittance', 'Inbound Remittance', 'Trade Payments', 'Card Processing', 'Government Payments', 'Open Banking'], description: 'All 7 payment modules' },
  'admin': { modules: ['Domestic', 'Outbound Remittance', 'Inbound Remittance', 'Trade Payments', 'Card Processing', 'Government Payments', 'Open Banking'], description: 'All 7 payment modules' },
  'cbn': { modules: ['Domestic', 'Outbound Remittance', 'Inbound Remittance', 'Trade Payments', 'Government Payments'], description: 'Regulatory-relevant modules' },
  [ROLES.NOC_OPERATOR]: { modules: ['Domestic', 'Outbound Remittance', 'Inbound Remittance', 'Trade Payments', 'Card Processing', 'Government Payments', 'Open Banking'], description: 'All modules (monitoring)' },
  [ROLES.SETTLEMENT_OFFICER]: { modules: ['Domestic', 'Outbound Remittance', 'Inbound Remittance', 'Card Processing'], description: 'Settlement-relevant modules' },
  [ROLES.COMPLIANCE_OFFICER]: { modules: ['Domestic', 'Outbound Remittance', 'Inbound Remittance', 'Trade Payments'], description: 'Compliance-critical modules' },
  [ROLES.FRAUD_ANALYST]: { modules: ['Domestic', 'Card Processing'], description: 'High-fraud-risk modules' },
  [ROLES.DEVELOPER]: { modules: ['Domestic', 'Open Banking', 'Card Processing'], description: 'Developer-focused modules' },
  'merchant': { modules: ['Domestic', 'Card Processing'], description: 'Merchant payment modules' },
  'participant': { modules: ['Domestic', 'Outbound Remittance', 'Inbound Remittance', 'Open Banking'], description: 'Participant-accessible modules' },
};

const moduleRoutes: Record<string, string> = {
  'Domestic': '/domestic-payments',
  'Outbound Remittance': '/outbound-remittance',
  'Inbound Remittance': '/inbound-remittance',
  'Trade Payments': '/trade-payments',
  'Card Processing': '/card-processing',
  'Government Payments': '/government-payments',
  'Open Banking': '/open-banking',
};

const moduleIcons: Record<string, string> = {
  'Domestic': 'NGN',
  'Outbound Remittance': 'OUT',
  'Inbound Remittance': 'IN',
  'Trade Payments': 'TRD',
  'Card Processing': 'CRD',
  'Government Payments': 'GOV',
  'Open Banking': 'API',
};

export function DashboardHub({ onNavigate }: DashboardHubProps) {
  const { user, hasRole } = useAuth();

  const activeProfile = stakeholderProfiles.find((p) => hasRole(p.role)) || stakeholderProfiles[0];
  const moduleAccess = Object.entries(moduleAccessMatrix).find(([role]) => hasRole(role));
  const accessibleModules = moduleAccess ? moduleAccess[1] : { modules: ['Domestic'], description: 'Default access' };
  const quickActions = activeProfile.quickActions
    .map((id) => allQuickActions[id])
    .filter(Boolean);

  const roleMatrix = [
    { role: 'Super Admin', ops: true, part: true, risk: true, plat: true, infra: true, mods: '7/7' },
    { role: 'CBN Regulator', ops: true, part: true, risk: true, plat: false, infra: false, mods: '5/7' },
    { role: 'NOC Operator', ops: true, part: true, risk: false, plat: true, infra: true, mods: '7/7' },
    { role: 'Settlement Officer', ops: true, part: false, risk: false, plat: false, infra: false, mods: '4/7' },
    { role: 'Compliance Officer', ops: false, part: true, risk: true, plat: false, infra: false, mods: '4/7' },
    { role: 'Fraud Analyst', ops: true, part: false, risk: true, plat: false, infra: false, mods: '2/7' },
    { role: 'KYC/KYB Reviewer', ops: false, part: true, risk: false, plat: false, infra: false, mods: '0/7' },
    { role: 'Developer', ops: false, part: true, risk: false, plat: true, infra: true, mods: '3/7' },
    { role: 'Merchant', ops: true, part: false, risk: false, plat: true, infra: false, mods: '2/7' },
    { role: 'Participant', ops: true, part: true, risk: false, plat: true, infra: false, mods: '4/7' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className={`bg-gradient-to-r ${activeProfile.bgGradient} rounded-xl p-6 shadow-lg`}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Welcome back, {user?.name || 'User'}
            </h1>
            <p className="text-white/90 text-sm font-medium mt-1">{activeProfile.title}</p>
            <p className="text-white/70 text-sm mt-0.5">{activeProfile.subtitle}</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-white/60 text-xs uppercase tracking-wider">Signed in as</p>
            <p className="text-white/90 text-sm font-medium mt-0.5">{user?.email || 'admin@payment-switch.com'}</p>
            <div className="mt-2 flex flex-wrap gap-1.5 justify-end">
              {user?.roles?.slice(0, 3).map((role) => (
                <span key={role} className="px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded-full text-xs text-white font-medium">
                  {role.replace(/_/g, ' ')}
                </span>
              ))}
              {(user?.roles?.length || 0) > 3 && (
                <span className="px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded-full text-xs text-white font-medium">
                  +{(user?.roles?.length || 0) - 3} more
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.id}
              onClick={() => onNavigate(action.id)}
              className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-gray-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className={`${action.accentColor} w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0`}>
                  {action.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{action.label}</h3>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{action.description}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Payment Modules */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Payment Modules</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {accessibleModules.description} — {accessibleModules.modules.length} of 7 accessible
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {accessibleModules.modules.map((mod) => (
            <a
              key={mod}
              href={`http://localhost:3007${moduleRoutes[mod] || '/'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 hover:shadow-md transition-all group block"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {moduleIcons[mod] || '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{mod}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{moduleRoutes[mod]}</p>
                </div>
                <ExternalLink className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Stakeholder Role Matrix */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Stakeholder Access Matrix</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Each stakeholder type sees a tailored sidebar and dashboard view
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="text-center py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Operations</th>
                <th className="text-center py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Participants</th>
                <th className="text-center py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Risk</th>
                <th className="text-center py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Platform</th>
                <th className="text-center py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Infrastructure</th>
                <th className="text-center py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Modules</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {roleMatrix.map((row) => (
                <tr key={row.role} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">{row.role}</td>
                  <td className="py-3 px-3 text-center">{row.ops ? <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" /> : <MinusCircle className="h-4 w-4 text-gray-300 mx-auto" />}</td>
                  <td className="py-3 px-3 text-center">{row.part ? <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" /> : <MinusCircle className="h-4 w-4 text-gray-300 mx-auto" />}</td>
                  <td className="py-3 px-3 text-center">{row.risk ? <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" /> : <MinusCircle className="h-4 w-4 text-gray-300 mx-auto" />}</td>
                  <td className="py-3 px-3 text-center">{row.plat ? <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" /> : <MinusCircle className="h-4 w-4 text-gray-300 mx-auto" />}</td>
                  <td className="py-3 px-3 text-center">{row.infra ? <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" /> : <MinusCircle className="h-4 w-4 text-gray-300 mx-auto" />}</td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {row.mods}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
