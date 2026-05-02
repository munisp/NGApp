import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

const pageTitles: Record<string, string> = {
  dashboard: 'NOC Operations Dashboard',
  journeys: 'User Journeys',
  'journey-analytics': 'Journey Analytics',
  transactions: 'Transaction Monitor',
  disputes: 'Transaction Disputes',
  'recurring-remittances': 'Recurring Remittances',
  'batch-transfers': 'Batch Transfers',
  settlements: 'Settlement Console',
  participants: 'Participant Management',
  provisioning: 'Provisioning Admin',
  onboarding: 'Onboarding Management',
  kyb: 'KYB Verification',
  kyc: 'KYC Verification',
  apply: 'Apply for Access',
  'kyc-applicant': 'KYC Portal',
  'bulk-onboarding': 'Bulk Onboarding',
  'integration-testing': 'Integration Testing',
  'sla-dashboard': 'SLA Tracking',
  'template-cloning': 'Template Cloning',
  'reviewer-rules': 'Reviewer Rules',
  fraud: 'Fraud & Risk Management',
  'compliance-reports': 'Compliance Reports',
  'security-dashboard': 'Security & PBAC',
  'transaction-limits': 'Transaction Limits',
  'fee-management': 'Fee Management',
  'audit-log': 'Audit Log',
  users: 'User Management',
  'support-center': 'Support Center',
  referrals: 'Referral Program',
  webhooks: 'Webhook Configuration',
  maintenance: 'Maintenance Mode',
  reports: 'Regulatory Reports',
  'rust-services': 'Rust Services',
  'go-services': 'Go Services',
  middleware: 'Middleware Dashboard',
  developer: 'Developer Portal',
  alerts: 'Alert Management',
  settings: 'System Settings',
};

export function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={(page) => {
          onNavigate(page);
          setMobileMenuOpen(false);
        }}
        collapsed={sidebarCollapsed}
      />

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main content */}
      <div
        className={cn(
          'transition-all duration-300',
          sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
        )}
      >
        <Header
          title={pageTitles[currentPage] || 'Dashboard'}
          onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          notifications={5}
        />

        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
