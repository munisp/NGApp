'use client';

import React, { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { NOCDashboard } from '@/components/dashboard/NOCDashboard';
import { SettlementConsole } from '@/components/settlement/SettlementConsole';
import { ParticipantPortal } from '@/components/participants/ParticipantPortal';
import { FraudDashboard } from '@/components/fraud/FraudDashboard';
import { ReportsInterface } from '@/components/reports/ReportsInterface';
import { DeveloperPortal } from '@/components/developer/DeveloperPortal';
import { 
  OnboardingPortal, 
  ApplicantPortal, 
  BulkOnboarding, 
  IntegrationTestingPortal, 
  SLADashboard, 
  TemplateCloning, 
  ReviewerAssignmentRules 
} from '@/components/onboarding';
import { KYCVerificationPortal, ApplicantKYCPortal } from '@/components/kyc';
import { KYBVerificationPortal } from '@/components/kyb';
import { LoginPage } from '@/components/auth';
import { UserManagement } from '@/components/users';
import { JourneyDashboard, JourneyAnalytics } from '@/components/journeys';
import { ProvisioningAdmin } from '@/components/provisioning/ProvisioningAdmin';
import { DisputesDashboard } from '@/components/disputes/DisputesDashboard';
import { RecurringRemittances } from '@/components/remittances/RecurringRemittances';
import { BatchTransfers } from '@/components/batch/BatchTransfers';
import { ComplianceReports } from '@/components/compliance/ComplianceReports';
import { SupportCenter } from '@/components/support/SupportCenter';
import { SecurityDashboard } from '@/components/security/SecurityDashboard';
import { FeeManagement } from '@/components/fees/FeeManagement';
import { AuditLog } from '@/components/audit/AuditLog';
import { TransactionLimits } from '@/components/limits/TransactionLimits';
import { ReferralProgram } from '@/components/referrals/ReferralProgram';
import { WebhookConfig } from '@/components/webhooks/WebhookConfig';
import { MaintenanceDashboard } from '@/components/maintenance-mode/MaintenanceDashboard';
import { RustServices } from '@/components/infrastructure/RustServices';
import { GoServices } from '@/components/infrastructure/GoServices';
import { MiddlewareDashboard } from '@/components/infrastructure/MiddlewareDashboard';
import { useAuth } from '@/lib/auth';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

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
