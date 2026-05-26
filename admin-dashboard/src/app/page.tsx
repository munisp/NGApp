'use client';

import React, { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Layout } from '@/components/layout/Layout';
import { LoginPage } from '@/components/auth';
import { ROLE_DEFAULT_PAGES } from '@/components/layout/Sidebar';
import { useAuth } from '@/lib/auth';
import { Loader2 } from 'lucide-react';

// Dynamic imports — each component is a separate chunk
const NOCDashboard = dynamic(() => import('@/components/dashboard/NOCDashboard').then(m => ({ default: m.NOCDashboard })), { loading: () => <PageSpinner /> });
const SettlementConsole = dynamic(() => import('@/components/settlement/SettlementConsole').then(m => ({ default: m.SettlementConsole })), { loading: () => <PageSpinner /> });
const ParticipantPortal = dynamic(() => import('@/components/participants/ParticipantPortal').then(m => ({ default: m.ParticipantPortal })), { loading: () => <PageSpinner /> });
const FraudDashboard = dynamic(() => import('@/components/fraud/FraudDashboard').then(m => ({ default: m.FraudDashboard })), { loading: () => <PageSpinner /> });
const ReportsInterface = dynamic(() => import('@/components/reports/ReportsInterface').then(m => ({ default: m.ReportsInterface })), { loading: () => <PageSpinner /> });
const DeveloperPortal = dynamic(() => import('@/components/developer/DeveloperPortal').then(m => ({ default: m.DeveloperPortal })), { loading: () => <PageSpinner /> });
const OnboardingPortal = dynamic(() => import('@/components/onboarding').then(m => ({ default: m.OnboardingPortal })), { loading: () => <PageSpinner /> });
const ApplicantPortal = dynamic(() => import('@/components/onboarding').then(m => ({ default: m.ApplicantPortal })), { loading: () => <PageSpinner /> });
const BulkOnboarding = dynamic(() => import('@/components/onboarding').then(m => ({ default: m.BulkOnboarding })), { loading: () => <PageSpinner /> });
const IntegrationTestingPortal = dynamic(() => import('@/components/onboarding').then(m => ({ default: m.IntegrationTestingPortal })), { loading: () => <PageSpinner /> });
const SLADashboard = dynamic(() => import('@/components/onboarding').then(m => ({ default: m.SLADashboard })), { loading: () => <PageSpinner /> });
const TemplateCloning = dynamic(() => import('@/components/onboarding').then(m => ({ default: m.TemplateCloning })), { loading: () => <PageSpinner /> });
const ReviewerAssignmentRules = dynamic(() => import('@/components/onboarding').then(m => ({ default: m.ReviewerAssignmentRules })), { loading: () => <PageSpinner /> });
const KYCVerificationPortal = dynamic(() => import('@/components/kyc').then(m => ({ default: m.KYCVerificationPortal })), { loading: () => <PageSpinner /> });
const ApplicantKYCPortal = dynamic(() => import('@/components/kyc').then(m => ({ default: m.ApplicantKYCPortal })), { loading: () => <PageSpinner /> });
const KYBVerificationPortal = dynamic(() => import('@/components/kyb').then(m => ({ default: m.KYBVerificationPortal })), { loading: () => <PageSpinner /> });
const UserManagement = dynamic(() => import('@/components/users').then(m => ({ default: m.UserManagement })), { loading: () => <PageSpinner /> });
const JourneyDashboard = dynamic(() => import('@/components/journeys').then(m => ({ default: m.JourneyDashboard })), { loading: () => <PageSpinner /> });
const JourneyAnalytics = dynamic(() => import('@/components/journeys').then(m => ({ default: m.JourneyAnalytics })), { loading: () => <PageSpinner /> });
const ProvisioningAdmin = dynamic(() => import('@/components/provisioning/ProvisioningAdmin').then(m => ({ default: m.ProvisioningAdmin })), { loading: () => <PageSpinner /> });
const DisputesDashboard = dynamic(() => import('@/components/disputes/DisputesDashboard').then(m => ({ default: m.DisputesDashboard })), { loading: () => <PageSpinner /> });
const RecurringRemittances = dynamic(() => import('@/components/remittances/RecurringRemittances').then(m => ({ default: m.RecurringRemittances })), { loading: () => <PageSpinner /> });
const BatchTransfers = dynamic(() => import('@/components/batch/BatchTransfers').then(m => ({ default: m.BatchTransfers })), { loading: () => <PageSpinner /> });
const ComplianceReports = dynamic(() => import('@/components/compliance/ComplianceReports').then(m => ({ default: m.ComplianceReports })), { loading: () => <PageSpinner /> });
const SupportCenter = dynamic(() => import('@/components/support/SupportCenter').then(m => ({ default: m.SupportCenter })), { loading: () => <PageSpinner /> });
const SecurityDashboard = dynamic(() => import('@/components/security/SecurityDashboard').then(m => ({ default: m.SecurityDashboard })), { loading: () => <PageSpinner /> });
const FeeManagement = dynamic(() => import('@/components/fees/FeeManagement').then(m => ({ default: m.FeeManagement })), { loading: () => <PageSpinner /> });
const AuditLog = dynamic(() => import('@/components/audit/AuditLog').then(m => ({ default: m.AuditLog })), { loading: () => <PageSpinner /> });
const TransactionLimits = dynamic(() => import('@/components/limits/TransactionLimits').then(m => ({ default: m.TransactionLimits })), { loading: () => <PageSpinner /> });
const ReferralProgram = dynamic(() => import('@/components/referrals/ReferralProgram').then(m => ({ default: m.ReferralProgram })), { loading: () => <PageSpinner /> });
const WebhookConfig = dynamic(() => import('@/components/webhooks/WebhookConfig').then(m => ({ default: m.WebhookConfig })), { loading: () => <PageSpinner /> });
const MaintenanceDashboard = dynamic(() => import('@/components/maintenance-mode/MaintenanceDashboard').then(m => ({ default: m.MaintenanceDashboard })), { loading: () => <PageSpinner /> });
const RustServices = dynamic(() => import('@/components/infrastructure/RustServices').then(m => ({ default: m.RustServices })), { loading: () => <PageSpinner /> });
const OutboundRemittanceDashboard = dynamic(() => import('@/components/outbound/OutboundRemittanceDashboard'), { loading: () => <PageSpinner /> });
const GoServices = dynamic(() => import('@/components/infrastructure/GoServices').then(m => ({ default: m.GoServices })), { loading: () => <PageSpinner /> });
const MiddlewareDashboard = dynamic(() => import('@/components/infrastructure/MiddlewareDashboard').then(m => ({ default: m.MiddlewareDashboard })), { loading: () => <PageSpinner /> });
const DashboardHub = dynamic(() => import('@/components/hub/DashboardHub').then(m => ({ default: m.DashboardHub })), { loading: () => <PageSpinner /> });

function PageSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
    </div>
  );
}

export default function Home() {
  const { isAuthenticated, isLoading, user, hasRole } = useAuth();
  const [currentPage, setCurrentPage] = useState('hub');
  const [initialRedirectDone, setInitialRedirectDone] = useState(false);

  // Post-login redirect: set default page based on user's primary role
  useEffect(() => {
    if (isAuthenticated && user && !initialRedirectDone) {
      const defaultPage = user.roles
        .map((role) => ROLE_DEFAULT_PAGES[role])
        .find(Boolean) || 'hub';
      setCurrentPage(defaultPage);
      setInitialRedirectDone(true);
    }
  }, [isAuthenticated, user, initialRedirectDone]);

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-primary-500 animate-spin mx-auto" />
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage />;
  }

    const renderPage = () => {
      switch (currentPage) {
        case 'hub':
          return <DashboardHub onNavigate={setCurrentPage} />;
        case 'dashboard':
          return <NOCDashboard />;
        case 'journeys':
          return <JourneyDashboard />;
        case 'journey-analytics':
          return <JourneyAnalytics />;
        case 'transactions':
          return <NOCDashboard />;
        case 'disputes':
          return <DisputesDashboard />;
        case 'recurring-remittances':
          return <RecurringRemittances />;
        case 'batch-transfers':
          return <BatchTransfers />;
        case 'settlements':
          return <SettlementConsole />;
        case 'participants':
          return <ParticipantPortal />;
        case 'provisioning':
          return <ProvisioningAdmin />;
        case 'onboarding':
          return <OnboardingPortal />;
        case 'kyb':
          return <KYBVerificationPortal />;
        case 'kyc':
          return <KYCVerificationPortal />;
        case 'apply':
          return <ApplicantPortal />;
        case 'kyc-applicant':
          return <ApplicantKYCPortal />;
        case 'bulk-onboarding':
          return <BulkOnboarding />;
        case 'integration-testing':
          return <IntegrationTestingPortal />;
        case 'sla-dashboard':
          return <SLADashboard />;
        case 'template-cloning':
          return <TemplateCloning />;
        case 'reviewer-rules':
          return <ReviewerAssignmentRules />;
        case 'fraud':
          return <FraudDashboard />;
        case 'compliance-reports':
          return <ComplianceReports />;
        case 'security-dashboard':
          return <SecurityDashboard />;
        case 'transaction-limits':
          return <TransactionLimits />;
        case 'fee-management':
          return <FeeManagement />;
        case 'audit-log':
          return <AuditLog />;
        case 'users':
          return <UserManagement />;
        case 'support-center':
          return <SupportCenter />;
        case 'referrals':
          return <ReferralProgram />;
        case 'webhooks':
          return <WebhookConfig />;
        case 'maintenance':
          return <MaintenanceDashboard />;
        case 'reports':
          return <ReportsInterface />;
        case 'outbound-remittance':
          return <OutboundRemittanceDashboard />;
        case 'rust-services':
          return <RustServices />;
        case 'go-services':
          return <GoServices />;
        case 'middleware':
          return <MiddlewareDashboard />;
        case 'developer':
          return <DeveloperPortal />;
        case 'alerts':
          return <FraudDashboard />;
        case 'settings':
          return <SettingsPage />;
        default:
          return <NOCDashboard />;
      }
    };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </Layout>
  );
}

function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">System Settings</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <h3 className="font-medium text-gray-900">Maintenance Mode</h3>
              <p className="text-sm text-gray-500">Enable to prevent new transactions</p>
            </div>
            <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200">
              <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-1" />
            </button>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <h3 className="font-medium text-gray-900">Auto-Settlement</h3>
              <p className="text-sm text-gray-500">Automatically settle windows at EOD</p>
            </div>
            <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary-600">
              <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6" />
            </button>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <h3 className="font-medium text-gray-900">Fraud Detection</h3>
              <p className="text-sm text-gray-500">ML-based fraud detection enabled</p>
            </div>
            <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary-600">
              <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6" />
            </button>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <h3 className="font-medium text-gray-900">Real-time Notifications</h3>
              <p className="text-sm text-gray-500">Push notifications for critical alerts</p>
            </div>
            <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary-600">
              <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6" />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">API Configuration</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Base URL</label>
            <input
              type="text"
              defaultValue="https://api.payment-switch.ng"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WebSocket URL</label>
            <input
              type="text"
              defaultValue="wss://ws.payment-switch.ng"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Request Timeout (ms)</label>
            <input
              type="number"
              defaultValue="30000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Notification Settings</h2>
        <div className="space-y-3">
          {[
            'Critical system alerts',
            'High-risk fraud alerts',
            'Settlement window closures',
            'Participant status changes',
            'Daily summary reports',
          ].map((item) => (
            <label key={item} className="flex items-center">
              <input
                type="checkbox"
                defaultChecked
                className="rounded border-gray-300 text-primary-600 mr-3"
              />
              <span className="text-sm text-gray-700">{item}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
