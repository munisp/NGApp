import React, { useState, useEffect } from 'react';
import {
  Server,
  Database,
  Shield,
  Network,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Eye,
  Settings,
  AlertTriangle,
  Layers,
  Key,
  Globe,
  Wallet,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { MetricCard, MetricGrid } from '../dashboard/MetricCard';
import { formatDateTime, cn } from '@/lib/utils';
import { createLogger } from '@/lib/logger';
const log = createLogger('ProvisioningAdmin');

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://app-kjesixal.fly.dev';

interface ProvisioningStep {
  name: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  resource_id?: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

interface ProvisionedResources {
  keycloak_client_id?: string;
  keycloak_client_secret?: string;
  apisix_route_id?: string;
  apisix_upstream_id?: string;
  tigerbeetle_account_id?: string;
  kyb_case_id?: string;
  kyc_case_ids?: string[];
  mojaloop_participant_id?: string;
}

interface ProvisioningSaga {
  id: string;
  case_id: string;
  environment: 'sandbox' | 'production';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
  steps: ProvisioningStep[];
  started_at: string;
  completed_at?: string;
  provisioned_resources: ProvisionedResources;
  organization_name?: string;
}

interface IntegrationHealth {
  keycloak: { status: 'healthy' | 'unhealthy' | 'unknown'; url?: string; message?: string };
  apisix: { status: 'healthy' | 'unhealthy' | 'unknown'; url?: string; message?: string };
  tigerbeetle: { status: 'healthy' | 'unhealthy' | 'unknown'; url?: string; message?: string };
  mojaloop: { status: 'healthy' | 'unhealthy' | 'unknown' | 'not_configured'; url?: string; message?: string };
  integration_mode?: 'simulated' | 'real';
  integration_mode_message?: string;
}

const stepIcons: Record<string, React.ReactNode> = {
  keycloak_client: <Key className="h-4 w-4" />,
  keycloak_users: <Shield className="h-4 w-4" />,
  apisix_upstream: <Server className="h-4 w-4" />,
  apisix_route: <Network className="h-4 w-4" />,
  tigerbeetle_account: <Wallet className="h-4 w-4" />,
  trigger_kyb: <Database className="h-4 w-4" />,
  trigger_kyc: <Shield className="h-4 w-4" />,
  smoke_test: <CheckCircle className="h-4 w-4" />,
  mojaloop_register: <Globe className="h-4 w-4" />,
};

const stepLabels: Record<string, string> = {
  keycloak_client: 'Keycloak Client',
  keycloak_users: 'Keycloak Users',
  apisix_upstream: 'APISIX Upstream',
  apisix_route: 'APISIX Route',
  tigerbeetle_account: 'TigerBeetle Account',
  trigger_kyb: 'KYB Verification',
  trigger_kyc: 'KYC Verification',
  smoke_test: 'Smoke Test',
  mojaloop_register: 'Mojaloop Registration',
};

export function ProvisioningAdmin() {
  const [sagas, setSagas] = useState<ProvisioningSaga[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSaga, setSelectedSaga] = useState<ProvisioningSaga | null>(null);
  const [integrationHealth, setIntegrationHealth] = useState<IntegrationHealth>({
    keycloak: { status: 'unknown' },
    apisix: { status: 'unknown' },
    tigerbeetle: { status: 'unknown' },
    mojaloop: { status: 'not_configured' },
  });
  const [refreshing, setRefreshing] = useState(false);

  const fetchSagas = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/provisioning/sagas`);
      if (response.ok) {
        const data = await response.json();
        setSagas(data.sagas || []);
      }
    } catch (error) {
      log.error('Error fetching provisioning sagas:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkIntegrationHealth = async () => {
    setRefreshing(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/provisioning/health`);
      if (response.ok) {
        const data = await response.json();
        setIntegrationHealth(data);
      }
    } catch (error) {
      log.error('Error checking integration health:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSagas();
    checkIntegrationHealth();
  }, []);

  const completedCount = sagas.filter(s => s.status === 'COMPLETED').length;
  const failedCount = sagas.filter(s => s.status === 'FAILED').length;
  const sandboxCount = sagas.filter(s => s.environment === 'sandbox').length;
  const productionCount = sagas.filter(s => s.environment === 'production').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'FAILED': return 'bg-red-100 text-red-800';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
      case 'ROLLED_BACK': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'unhealthy': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'not_configured': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default: return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Integration Mode Banner */}
      <div className={cn(
        "rounded-lg border p-4 mb-6",
        integrationHealth.integration_mode === 'real' 
          ? "bg-green-50 border-green-200" 
          : "bg-amber-50 border-amber-200"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {integrationHealth.integration_mode === 'real' ? (
              <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600 mr-3" />
            )}
            <div>
              <h3 className={cn(
                "font-semibold",
                integrationHealth.integration_mode === 'real' ? "text-green-800" : "text-amber-800"
              )}>
                {integrationHealth.integration_mode === 'real' ? 'Real Integration Mode' : 'Simulated Mode'}
              </h3>
              <p className={cn(
                "text-sm",
                integrationHealth.integration_mode === 'real' ? "text-green-600" : "text-amber-600"
              )}>
                {integrationHealth.integration_mode_message || (
                  integrationHealth.integration_mode === 'real' 
                    ? 'API calls are made to actual services'
                    : 'No actual API calls to external services - for demo purposes only'
                )}
              </p>
            </div>
          </div>
          <Badge variant={integrationHealth.integration_mode === 'real' ? 'success' : 'warning'}>
            {integrationHealth.integration_mode?.toUpperCase() || 'SIMULATED'}
          </Badge>
        </div>
      </div>

      {/* Integration Health Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Layers className="h-5 w-5 mr-2" />
              Integration Health
            </CardTitle>
            <Button
              variant="secondary"
              size="sm"
              onClick={checkIntegrationHealth}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <IntegrationCard
              name="Keycloak"
              icon={<Key className="h-6 w-6" />}
              health={integrationHealth.keycloak}
              description="Identity & Access Management"
            />
            <IntegrationCard
              name="APISIX"
              icon={<Network className="h-6 w-6" />}
              health={integrationHealth.apisix}
              description="API Gateway & Routing"
            />
            <IntegrationCard
              name="TigerBeetle"
              icon={<Wallet className="h-6 w-6" />}
              health={integrationHealth.tigerbeetle}
              description="Financial Ledger"
            />
            <IntegrationCard
              name="Mojaloop"
              icon={<Globe className="h-6 w-6" />}
              health={integrationHealth.mojaloop}
              description="Interoperability Layer"
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary Metrics */}
      <MetricGrid columns={4}>
        <MetricCard
          title="Total Provisioned"
          value={sagas.length}
          icon={<Server className="h-5 w-5" />}
        />
        <MetricCard
          title="Completed"
          value={completedCount}
          icon={<CheckCircle className="h-5 w-5" />}
          trend={completedCount > 0 ? 'up' : 'neutral'}
        />
        <MetricCard
          title="Sandbox Environments"
          value={sandboxCount}
          icon={<Database className="h-5 w-5" />}
        />
        <MetricCard
          title="Production Environments"
          value={productionCount}
          icon={<Shield className="h-5 w-5" />}
        />
      </MetricGrid>

      {/* Provisioning Sagas Table */}
      <Card>
        <CardHeader>
          <CardTitle>Provisioned Participants</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : sagas.length === 0 ? (
            <div className="text-center py-12">
              <Server className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Provisioned Participants</h3>
              <p className="text-gray-500">
                Participants will appear here after they are provisioned through the Onboarding portal.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Saga ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Case ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Environment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Resources
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Provisioned At
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sagas.map((saga) => (
                    <tr key={saga.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono text-gray-900">{saga.id}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{saga.case_id}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={saga.environment === 'production' ? 'success' : 'info'}>
                          {saga.environment.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={cn('px-2 py-1 text-xs font-medium rounded-full', getStatusColor(saga.status))}>
                          {saga.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-1">
                          {saga.provisioned_resources.keycloak_client_id && (
                            <span title="Keycloak Client" className="p-1 bg-blue-100 rounded">
                              <Key className="h-3 w-3 text-blue-600" />
                            </span>
                          )}
                          {saga.provisioned_resources.apisix_route_id && (
                            <span title="APISIX Route" className="p-1 bg-green-100 rounded">
                              <Network className="h-3 w-3 text-green-600" />
                            </span>
                          )}
                          {saga.provisioned_resources.tigerbeetle_account_id && (
                            <span title="TigerBeetle Account" className="p-1 bg-purple-100 rounded">
                              <Wallet className="h-3 w-3 text-purple-600" />
                            </span>
                          )}
                          {saga.provisioned_resources.mojaloop_participant_id && (
                            <span title="Mojaloop Participant" className="p-1 bg-orange-100 rounded">
                              <Globe className="h-3 w-3 text-orange-600" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {saga.completed_at ? formatDateTime(saga.completed_at) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedSaga(saga)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saga Details Modal */}
      <Modal
        isOpen={!!selectedSaga}
        onClose={() => setSelectedSaga(null)}
        title="Provisioning Details"
        size="lg"
      >
        {selectedSaga && (
          <div className="space-y-6">
            {/* Saga Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Saga ID</label>
                <p className="text-sm font-mono">{selectedSaga.id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Case ID</label>
                <p className="text-sm">{selectedSaga.case_id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Environment</label>
                <Badge variant={selectedSaga.environment === 'production' ? 'success' : 'info'}>
                  {selectedSaga.environment.toUpperCase()}
                </Badge>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <span className={cn('px-2 py-1 text-xs font-medium rounded-full', getStatusColor(selectedSaga.status))}>
                  {selectedSaga.status}
                </span>
              </div>
            </div>

            {/* Provisioning Steps */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Provisioning Steps</h4>
              <div className="space-y-2">
                {selectedSaga.steps.map((step, index) => (
                  <div
                    key={index}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border',
                      step.status === 'COMPLETED' ? 'bg-green-50 border-green-200' :
                      step.status === 'FAILED' ? 'bg-red-50 border-red-200' :
                      step.status === 'IN_PROGRESS' ? 'bg-blue-50 border-blue-200' :
                      'bg-gray-50 border-gray-200'
                    )}
                  >
                    <div className="flex items-center">
                      <span className="mr-3">
                        {stepIcons[step.name] || <Settings className="h-4 w-4" />}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{stepLabels[step.name] || step.name}</p>
                        {step.resource_id && (
                          <p className="text-xs text-gray-500 font-mono">{step.resource_id}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center">
                      {step.status === 'COMPLETED' && <CheckCircle className="h-5 w-5 text-green-500" />}
                      {step.status === 'FAILED' && <XCircle className="h-5 w-5 text-red-500" />}
                      {step.status === 'IN_PROGRESS' && <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />}
                      {step.status === 'PENDING' && <Clock className="h-5 w-5 text-gray-400" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Provisioned Resources */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Provisioned Resources</h4>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                {selectedSaga.provisioned_resources.keycloak_client_id && (
                  <ResourceRow
                    icon={<Key className="h-4 w-4 text-blue-600" />}
                    label="Keycloak Client ID"
                    value={selectedSaga.provisioned_resources.keycloak_client_id}
                  />
                )}
                {selectedSaga.provisioned_resources.apisix_route_id && (
                  <ResourceRow
                    icon={<Network className="h-4 w-4 text-green-600" />}
                    label="APISIX Route ID"
                    value={selectedSaga.provisioned_resources.apisix_route_id}
                  />
                )}
                {selectedSaga.provisioned_resources.apisix_upstream_id && (
                  <ResourceRow
                    icon={<Server className="h-4 w-4 text-green-600" />}
                    label="APISIX Upstream ID"
                    value={selectedSaga.provisioned_resources.apisix_upstream_id}
                  />
                )}
                {selectedSaga.provisioned_resources.tigerbeetle_account_id && (
                  <ResourceRow
                    icon={<Wallet className="h-4 w-4 text-purple-600" />}
                    label="TigerBeetle Account ID"
                    value={selectedSaga.provisioned_resources.tigerbeetle_account_id}
                  />
                )}
                {selectedSaga.provisioned_resources.kyb_case_id && (
                  <ResourceRow
                    icon={<Database className="h-4 w-4 text-indigo-600" />}
                    label="KYB Case ID"
                    value={selectedSaga.provisioned_resources.kyb_case_id}
                  />
                )}
                {selectedSaga.provisioned_resources.mojaloop_participant_id && (
                  <ResourceRow
                    icon={<Globe className="h-4 w-4 text-orange-600" />}
                    label="Mojaloop Participant ID"
                    value={selectedSaga.provisioned_resources.mojaloop_participant_id}
                  />
                )}
              </div>
            </div>

            {/* Timestamps */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-gray-500">Started At</label>
                <p>{formatDateTime(selectedSaga.started_at)}</p>
              </div>
              {selectedSaga.completed_at && (
                <div>
                  <label className="text-gray-500">Completed At</label>
                  <p>{formatDateTime(selectedSaga.completed_at)}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

interface IntegrationCardProps {
  name: string;
  icon: React.ReactNode;
  health: { status: string; url?: string; message?: string };
  description: string;
}

function IntegrationCard({ name, icon, health, description }: IntegrationCardProps) {
  const getStatusBg = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-50 border-green-200';
      case 'unhealthy': return 'bg-red-50 border-red-200';
      case 'not_configured': return 'bg-yellow-50 border-yellow-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'healthy': return 'Connected';
      case 'unhealthy': return 'Disconnected';
      case 'not_configured': return 'Not Configured';
      default: return 'Unknown';
    }
  };

  return (
    <div className={cn('p-4 rounded-lg border', getStatusBg(health.status))}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <span className="text-gray-600">{icon}</span>
          <span className="ml-2 font-medium text-gray-900">{name}</span>
        </div>
        {health.status === 'healthy' && <CheckCircle className="h-5 w-5 text-green-500" />}
        {health.status === 'unhealthy' && <XCircle className="h-5 w-5 text-red-500" />}
        {health.status === 'not_configured' && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
        {health.status === 'unknown' && <Clock className="h-5 w-5 text-gray-400" />}
      </div>
      <p className="text-xs text-gray-500 mb-1">{description}</p>
      <p className={cn(
        'text-xs font-medium',
        health.status === 'healthy' ? 'text-green-600' :
        health.status === 'unhealthy' ? 'text-red-600' :
        health.status === 'not_configured' ? 'text-yellow-600' :
        'text-gray-500'
      )}>
        {getStatusText(health.status)}
      </p>
      {health.url && (
        <p className="text-xs text-gray-400 font-mono truncate mt-1">{health.url}</p>
      )}
    </div>
  );
}

interface ResourceRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function ResourceRow({ icon, label, value }: ResourceRowProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        {icon}
        <span className="ml-2 text-sm text-gray-600">{label}</span>
      </div>
      <span className="text-sm font-mono text-gray-900">{value}</span>
    </div>
  );
}
