'use client';

import React from 'react';
import {
  LayoutDashboard,
  Shield,
  Wallet,
  Building2,
  UserCheck,
  Fingerprint,
  FileText,
  Code,
  Globe,
  Activity,
  Gavel,
  Gift,
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
  color: string;
  requiredRoles: string[];
}

// Stakeholder profiles with their quick actions
const stakeholderProfiles: {
  role: string;
  title: string;
  subtitle: string;
  color: string;
  quickActions: string[];
}[] = [
  {
    role: ROLES.SUPER_ADMIN,
    title: 'Super Administrator',
    subtitle: 'Full platform access — all modules, all settings',
    color: 'bg-purple-500',
    quickActions: ['dashboard', 'participants', 'settlements', 'fraud', 'users', 'security-dashboard', 'middleware'],
  },
  {
    role: 'cbn',
    title: 'CBN Regulator',
    subtitle: 'Regulatory oversight — compliance, reporting, audit trails',
    color: 'bg-red-600',
    quickActions: ['dashboard', 'compliance-reports', 'audit-log', 'transaction-limits', 'fraud', 'settlements'],
  },
  {
    role: ROLES.NOC_OPERATOR,
    title: 'NOC Operator',
    subtitle: 'Network operations — monitoring, incidents, kill switches',
    color: 'bg-blue-600',
    quickActions: ['dashboard', 'alerts', 'transactions', 'settlements', 'middleware', 'maintenance'],
  },
  {
    role: ROLES.SETTLEMENT_OFFICER,
    title: 'Settlement Officer',
    subtitle: 'Settlement management — batches, reconciliation, disputes',
    color: 'bg-green-600',
    quickActions: ['settlements', 'transactions', 'disputes', 'batch-transfers', 'recurring-remittances', 'fee-management'],
  },
  {
    role: ROLES.COMPLIANCE_OFFICER,
    title: 'Compliance Officer',
    subtitle: 'Risk & compliance — fraud monitoring, sanctions, reporting',
    color: 'bg-amber-600',
    quickActions: ['compliance-reports', 'fraud', 'audit-log', 'kyb', 'kyc', 'transaction-limits'],
  },
  {
    role: ROLES.FRAUD_ANALYST,
    title: 'Fraud Analyst',
    subtitle: 'Fraud detection — alerts, risk scoring, transaction monitoring',
    color: 'bg-red-500',
    quickActions: ['fraud', 'transactions', 'alerts', 'compliance-reports'],
  },
  {
    role: ROLES.KYC_REVIEWER,
    title: 'KYC Reviewer',
    subtitle: 'Identity verification — KYC applications, document review',
    color: 'bg-teal-600',
    quickActions: ['kyc', 'onboarding', 'reviewer-rules'],
  },
  {
    role: ROLES.KYB_REVIEWER,
    title: 'KYB Reviewer',
    subtitle: 'Business verification — KYB applications, corporate documents',
    color: 'bg-indigo-600',
    quickActions: ['kyb', 'onboarding', 'reviewer-rules'],
  },
  {
    role: ROLES.DEVELOPER,
    title: 'Developer / Integrator',
    subtitle: 'API access — developer portal, webhooks, integration testing',
    color: 'bg-gray-700',
    quickActions: ['developer', 'webhooks', 'integration-testing', 'go-services', 'rust-services', 'middleware'],
  },
  {
    role: ROLES.PARTICIPANT_ADMIN,
    title: 'Participant Admin',
    subtitle: 'Participant management — onboarding, provisioning, SLA tracking',
    color: 'bg-cyan-600',
    quickActions: ['onboarding', 'participants', 'provisioning', 'sla-dashboard', 'integration-testing', 'reports'],
  },
  {
    role: ROLES.AUDITOR,
    title: 'Auditor',
    subtitle: 'Audit & review — logs, compliance reports, journey analytics',
    color: 'bg-orange-600',
    quickActions: ['audit-log', 'compliance-reports', 'journey-analytics', 'reports'],
  },
  {
    role: 'merchant',
    title: 'Merchant',
    subtitle: 'Merchant services — fees, transactions, support',
    color: 'bg-emerald-600',
    quickActions: ['transactions', 'fee-management', 'support-center', 'apply'],
  },
  {
    role: 'participant',
    title: 'Participant (Bank/PSP/Fintech)',
    subtitle: 'Participant services — onboarding, integration, remittances',
    color: 'bg-sky-600',
    quickActions: ['apply', 'onboarding', 'integration-testing', 'transactions', 'disputes', 'outbound-remittance'],
  },
];

// All available quick actions with metadata
const allQuickActions: Record<string, QuickAction> = {
  dashboard: { id: 'dashboard', label: 'NOC Dashboard', description: 'Real-time network operations center', icon: <LayoutDashboard className="h-6 w-6" />, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.NOC_OPERATOR, 'cbn', 'admin'] },
  settlements: { id: 'settlements', label: 'Settlements', description: 'Settlement batches & reconciliation', icon: <Wallet className="h-6 w-6" />, color: 'bg-green-500/10 text-green-400 border-green-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.SETTLEMENT_OFFICER, 'cbn', 'admin'] },
  fraud: { id: 'fraud', label: 'Fraud & Risk', description: 'Fraud detection & risk scoring', icon: <Shield className="h-6 w-6" />, color: 'bg-red-500/10 text-red-400 border-red-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.FRAUD_ANALYST, ROLES.COMPLIANCE_OFFICER, 'cbn', 'admin'] },
  participants: { id: 'participants', label: 'Participants', description: 'Banks, PSPs, fintechs on the network', icon: <Building2 className="h-6 w-6" />, color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.PARTICIPANT_ADMIN, 'cbn', 'admin'] },
  transactions: { id: 'transactions', label: 'Transactions', description: 'Real-time transaction monitoring', icon: <Activity className="h-6 w-6" />, color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.NOC_OPERATOR, ROLES.SETTLEMENT_OFFICER, 'admin', 'merchant', 'participant'] },
  'compliance-reports': { id: 'compliance-reports', label: 'Compliance Reports', description: 'Regulatory & compliance reporting', icon: <FileText className="h-6 w-6" />, color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.COMPLIANCE_OFFICER, ROLES.AUDITOR, 'cbn', 'admin'] },
  'audit-log': { id: 'audit-log', label: 'Audit Log', description: 'Complete platform audit trail', icon: <ScrollText className="h-6 w-6" />, color: 'bg-orange-500/10 text-orange-400 border-orange-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.AUDITOR, ROLES.COMPLIANCE_OFFICER, 'cbn', 'admin'] },
  kyb: { id: 'kyb', label: 'KYB Verification', description: 'Business verification portal', icon: <Building2 className="h-6 w-6" />, color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.KYB_REVIEWER, ROLES.COMPLIANCE_OFFICER, 'admin'] },
  kyc: { id: 'kyc', label: 'KYC Verification', description: 'Identity verification portal', icon: <UserCheck className="h-6 w-6" />, color: 'bg-teal-500/10 text-teal-400 border-teal-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.KYC_REVIEWER, ROLES.COMPLIANCE_OFFICER, 'admin'] },
  onboarding: { id: 'onboarding', label: 'Onboarding', description: 'Participant onboarding pipeline', icon: <ClipboardList className="h-6 w-6" />, color: 'bg-sky-500/10 text-sky-400 border-sky-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.PARTICIPANT_ADMIN, 'admin', 'participant'] },
  developer: { id: 'developer', label: 'Developer Portal', description: 'API docs, SDKs, sandbox', icon: <Code className="h-6 w-6" />, color: 'bg-gray-500/10 text-gray-400 border-gray-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.DEVELOPER, 'admin', 'participant'] },
  webhooks: { id: 'webhooks', label: 'Webhook Config', description: 'Configure event webhooks', icon: <Globe className="h-6 w-6" />, color: 'bg-violet-500/10 text-violet-400 border-violet-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.DEVELOPER, 'admin', 'participant'] },
  alerts: { id: 'alerts', label: 'Alerts', description: 'System alerts & notifications', icon: <AlertTriangle className="h-6 w-6" />, color: 'bg-red-500/10 text-red-400 border-red-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.NOC_OPERATOR, ROLES.FRAUD_ANALYST, 'cbn', 'admin'] },
  'security-dashboard': { id: 'security-dashboard', label: 'Security & PBAC', description: 'Security posture & access control', icon: <Shield className="h-6 w-6" />, color: 'bg-red-500/10 text-red-400 border-red-500/20', requiredRoles: [ROLES.SUPER_ADMIN, 'cbn', 'admin'] },
  users: { id: 'users', label: 'User Management', description: 'Manage platform users & roles', icon: <Users className="h-6 w-6" />, color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', requiredRoles: [ROLES.SUPER_ADMIN, 'admin'] },
  middleware: { id: 'middleware', label: 'Middleware', description: 'Kafka, Redis, TigerBeetle status', icon: <Database className="h-6 w-6" />, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.NOC_OPERATOR, ROLES.DEVELOPER, 'admin'] },
  'go-services': { id: 'go-services', label: 'Go Services', description: 'Go microservice health', icon: <Zap className="h-6 w-6" />, color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.NOC_OPERATOR, ROLES.DEVELOPER, 'admin'] },
  'rust-services': { id: 'rust-services', label: 'Rust Services', description: 'Rust microservice health', icon: <Cpu className="h-6 w-6" />, color: 'bg-orange-500/10 text-orange-400 border-orange-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.NOC_OPERATOR, ROLES.DEVELOPER, 'admin'] },
  maintenance: { id: 'maintenance', label: 'Maintenance Mode', description: 'System maintenance controls', icon: <Server className="h-6 w-6" />, color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.NOC_OPERATOR, 'admin'] },
  disputes: { id: 'disputes', label: 'Disputes', description: 'Dispute resolution center', icon: <Gavel className="h-6 w-6" />, color: 'bg-pink-500/10 text-pink-400 border-pink-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.SETTLEMENT_OFFICER, 'admin', 'participant'] },
  'batch-transfers': { id: 'batch-transfers', label: 'Batch Transfers', description: 'Batch payment processing', icon: <Activity className="h-6 w-6" />, color: 'bg-green-500/10 text-green-400 border-green-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.SETTLEMENT_OFFICER, 'admin', 'participant'] },
  'recurring-remittances': { id: 'recurring-remittances', label: 'Recurring Remittances', description: 'Scheduled remittance management', icon: <Activity className="h-6 w-6" />, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.SETTLEMENT_OFFICER, 'admin', 'participant'] },
  'fee-management': { id: 'fee-management', label: 'Fee Management', description: 'Fee structures & billing', icon: <DollarSign className="h-6 w-6" />, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.SETTLEMENT_OFFICER, 'admin', 'merchant'] },
  'transaction-limits': { id: 'transaction-limits', label: 'Transaction Limits', description: 'Configure transaction limits', icon: <Gauge className="h-6 w-6" />, color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.COMPLIANCE_OFFICER, 'cbn', 'admin'] },
  'support-center': { id: 'support-center', label: 'Support Center', description: 'Help desk & ticket system', icon: <HeadphonesIcon className="h-6 w-6" />, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', requiredRoles: [] },
  apply: { id: 'apply', label: 'Apply', description: 'Submit a new application', icon: <ClipboardList className="h-6 w-6" />, color: 'bg-green-500/10 text-green-400 border-green-500/20', requiredRoles: [] },
  'integration-testing': { id: 'integration-testing', label: 'Integration Testing', description: 'Test API integrations', icon: <Code className="h-6 w-6" />, color: 'bg-gray-500/10 text-gray-400 border-gray-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.DEVELOPER, ROLES.PARTICIPANT_ADMIN, 'admin', 'participant'] },
  'outbound-remittance': { id: 'outbound-remittance', label: 'Outbound Remittance', description: 'Cross-border transfers', icon: <Globe className="h-6 w-6" />, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.NOC_OPERATOR, ROLES.SETTLEMENT_OFFICER, 'admin', 'participant'] },
  provisioning: { id: 'provisioning', label: 'Provisioning Admin', description: 'Provision new participants', icon: <Server className="h-6 w-6" />, color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.PARTICIPANT_ADMIN, 'admin'] },
  'sla-dashboard': { id: 'sla-dashboard', label: 'SLA Tracking', description: 'SLA monitoring & compliance', icon: <Gauge className="h-6 w-6" />, color: 'bg-teal-500/10 text-teal-400 border-teal-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.PARTICIPANT_ADMIN, 'cbn', 'admin'] },
  'reviewer-rules': { id: 'reviewer-rules', label: 'Reviewer Rules', description: 'Configure reviewer assignment', icon: <Users className="h-6 w-6" />, color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.KYB_REVIEWER, ROLES.KYC_REVIEWER, 'admin'] },
  reports: { id: 'reports', label: 'Reports', description: 'Platform-wide reports', icon: <FileText className="h-6 w-6" />, color: 'bg-gray-500/10 text-gray-400 border-gray-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.NOC_OPERATOR, ROLES.COMPLIANCE_OFFICER, ROLES.AUDITOR, 'cbn', 'admin'] },
  'journey-analytics': { id: 'journey-analytics', label: 'Journey Analytics', description: 'User journey analytics', icon: <Activity className="h-6 w-6" />, color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.NOC_OPERATOR, ROLES.AUDITOR, 'admin'] },
  'template-cloning': { id: 'template-cloning', label: 'Template Cloning', description: 'Clone onboarding templates', icon: <ClipboardList className="h-6 w-6" />, color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.PARTICIPANT_ADMIN, 'admin'] },
  referrals: { id: 'referrals', label: 'Referral Program', description: 'Manage referral programs', icon: <Gift className="h-6 w-6" />, color: 'bg-pink-500/10 text-pink-400 border-pink-500/20', requiredRoles: [ROLES.SUPER_ADMIN, ROLES.PARTICIPANT_ADMIN, 'admin', 'participant', 'merchant'] },
};

// Module access matrix — which 7 payment modules each role can access
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

export function DashboardHub({ onNavigate }: DashboardHubProps) {
  const { user, hasRole } = useAuth();

  // Find the best matching stakeholder profile
  const activeProfile = stakeholderProfiles.find((p) => hasRole(p.role)) || stakeholderProfiles[0];

  // Get module access for current user
  const moduleAccess = Object.entries(moduleAccessMatrix).find(([role]) => hasRole(role));
  const accessibleModules = moduleAccess ? moduleAccess[1] : { modules: ['Domestic'], description: 'Default access' };

  // Get filtered quick actions
  const quickActions = activeProfile.quickActions
    .map((id) => allQuickActions[id])
    .filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className={`${activeProfile.color} rounded-2xl p-6 text-white`}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Welcome, {user?.name || 'User'}</h1>
            <p className="text-white/80 mt-1">{activeProfile.title}</p>
            <p className="text-white/60 text-sm mt-1">{activeProfile.subtitle}</p>
          </div>
          <div className="text-right">
            <p className="text-white/60 text-xs">Logged in as</p>
            <p className="text-white/80 text-sm font-medium">{user?.email || 'admin@payment-switch.com'}</p>
            <div className="mt-2 flex flex-wrap gap-1 justify-end">
              {user?.roles?.slice(0, 3).map((role) => (
                <span key={role} className="px-2 py-0.5 bg-white/20 rounded text-xs">
                  {role.replace(/_/g, ' ')}
                </span>
              ))}
              {(user?.roles?.length || 0) > 3 && (
                <span className="px-2 py-0.5 bg-white/20 rounded text-xs">
                  +{(user?.roles?.length || 0) - 3} more
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions grid */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.id}
              onClick={() => onNavigate(action.id)}
              className={`${action.color} border rounded-xl p-4 text-left hover:scale-[1.02] transition-transform`}
            >
              <div className="flex items-start justify-between">
                {action.icon}
                <ArrowRight className="h-4 w-4 opacity-50" />
              </div>
              <h3 className="font-semibold mt-3">{action.label}</h3>
              <p className="text-sm opacity-70 mt-1">{action.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Payment Module Access */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Payment Module Access</h2>
        <p className="text-sm text-gray-400 mb-3">{accessibleModules.description}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {accessibleModules.modules.map((mod) => {
            const moduleRoutes: Record<string, string> = {
              'Domestic': '/domestic-payments',
              'Outbound Remittance': '/outbound-remittance',
              'Inbound Remittance': '/inbound-remittance',
              'Trade Payments': '/trade-payments',
              'Card Processing': '/card-processing',
              'Government Payments': '/government-payments',
              'Open Banking': '/open-banking',
            };
            const moduleColors: Record<string, string> = {
              'Domestic': 'border-blue-500/30 bg-blue-500/5',
              'Outbound Remittance': 'border-green-500/30 bg-green-500/5',
              'Inbound Remittance': 'border-teal-500/30 bg-teal-500/5',
              'Trade Payments': 'border-amber-500/30 bg-amber-500/5',
              'Card Processing': 'border-purple-500/30 bg-purple-500/5',
              'Government Payments': 'border-red-500/30 bg-red-500/5',
              'Open Banking': 'border-cyan-500/30 bg-cyan-500/5',
            };
            return (
              <a
                key={mod}
                href={`http://localhost:3007${moduleRoutes[mod] || '/'}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`${moduleColors[mod] || 'border-gray-500/30 bg-gray-500/5'} border rounded-xl p-4 text-left hover:scale-[1.02] transition-transform block`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white">{mod}</h3>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </div>
                <p className="text-xs text-gray-400 mt-1">{moduleRoutes[mod]}</p>
              </a>
            );
          })}
        </div>
      </div>

      {/* Role Matrix Info */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Stakeholder Role Matrix</h2>
        <p className="text-sm text-gray-400 mb-4">
          Each stakeholder type sees a tailored sidebar and dashboard. The table below shows which roles have access to which sections.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="py-2 px-3">Role</th>
                <th className="py-2 px-3">Operations</th>
                <th className="py-2 px-3">Participants</th>
                <th className="py-2 px-3">Risk</th>
                <th className="py-2 px-3">Platform</th>
                <th className="py-2 px-3">Infrastructure</th>
                <th className="py-2 px-3">Payment Modules</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              {[
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
              ].map((row) => (
                <tr key={row.role} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                  <td className="py-2 px-3 font-medium">{row.role}</td>
                  <td className="py-2 px-3">{row.ops ? <span className="text-green-400">Yes</span> : <span className="text-gray-500">—</span>}</td>
                  <td className="py-2 px-3">{row.part ? <span className="text-green-400">Yes</span> : <span className="text-gray-500">—</span>}</td>
                  <td className="py-2 px-3">{row.risk ? <span className="text-green-400">Yes</span> : <span className="text-gray-500">—</span>}</td>
                  <td className="py-2 px-3">{row.plat ? <span className="text-green-400">Yes</span> : <span className="text-gray-500">—</span>}</td>
                  <td className="py-2 px-3">{row.infra ? <span className="text-green-400">Yes</span> : <span className="text-gray-500">—</span>}</td>
                  <td className="py-2 px-3">{row.mods}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
