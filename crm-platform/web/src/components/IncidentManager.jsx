import { useState, useContext, useEffect } from 'react';
import { useApiData } from '@/hooks/useApiData'
import { AlertOctagon, Plus, Search, Clock, CheckCircle, ArrowUp, AlertTriangle, Users, Shield } from 'lucide-react';
import { TenantContext } from '../contexts/TenantContext';
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { apiClient } from '@/lib/apiClient'

const SEED_INCIDENTS = {
  'tenant-acme-bank': [
    { id: 'inc-001', title: 'SQL Injection attempt from external IP', severity: 'critical', status: 'resolved', category: 'security', reported_by: 'WAF Engine', assigned_to: 'Security Team', created: '2025-05-04T13:30:00Z', resolved: '2025-05-04T13:32:00Z', resolution: 'IP banned automatically by WAF rules', impact: 'No data breach — attack was blocked' },
    { id: 'inc-002', title: 'Agent mobile app login failures — Lagos zone', severity: 'high', status: 'investigating', category: 'system', reported_by: 'Monitoring Alert', assigned_to: 'DevOps Team', created: '2025-05-04T12:15:00Z', impact: '~50 agents unable to login for 15 minutes' },
    { id: 'inc-003', title: 'Delayed remittance settlement — USD/NGN corridor', severity: 'medium', status: 'open', category: 'financial', reported_by: 'SwiftRemit Ops', assigned_to: 'Treasury Team', created: '2025-05-04T10:00:00Z', impact: '12 remittances pending settlement >2h' },
    { id: 'inc-004', title: 'Compliance scan flagged expired DPO certificate', severity: 'medium', status: 'resolved', category: 'compliance', reported_by: 'Compliance Bot', assigned_to: 'DPO', created: '2025-05-03T09:00:00Z', resolved: '2025-05-03T14:00:00Z', resolution: 'Certificate renewed and uploaded', impact: 'Regulatory risk — resolved same day' },
    { id: 'inc-005', title: 'Brute force attack detected on admin portal', severity: 'critical', status: 'resolved', category: 'security', reported_by: 'DDoS Protection', assigned_to: 'Security Team', created: '2025-05-02T22:15:00Z', resolved: '2025-05-02T22:17:00Z', resolution: 'Source IPs banned, MFA enforced', impact: 'No breach — 142 attempts blocked' },
  ],
};

const SEVERITY_COLORS = { critical: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700', medium: 'bg-yellow-100 text-yellow-700', low: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' };
const STATUS_COLORS = { open: 'bg-blue-100 text-blue-700', investigating: 'bg-purple-100 text-purple-700', resolved: 'bg-green-100 text-green-700', closed: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' };

export default function IncidentManager() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('incidentmanager', () => apiClient.dashboard.metrics(), { fallback: SEED_INCIDENTS })
  const { t } = useTranslation()
  const { tenantId } = useContext(TenantContext);
  const [incidents, setIncidents] = useState(SEED_INCIDENTS[tenantId] || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);

  useEffect(() => { setIncidents(SEED_INCIDENTS[tenantId] || []); }, [tenantId]);

  const filtered = incidents.filter(i => {
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    if (searchQuery) return i.title.toLowerCase().includes(searchQuery.toLowerCase());
    return true;
  });

  const stats = {
    total: incidents.length,
    open: incidents.filter(i => i.status === 'open' || i.status === 'investigating').length,
    critical: incidents.filter(i => i.severity === 'critical').length,
    resolved: incidents.filter(i => i.status === 'resolved').length,
  };

  return (
    <div role="region" aria-label="IncidentManager"  className="p-6 max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <AlertOctagon className="w-8 h-8 text-red-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Incident Management</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Security incidents, outages, compliance alerts, and escalations</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
          <Plus className="w-4 h-4" /> Report Incident
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Incidents', value: stats.total, icon: AlertOctagon, color: 'text-gray-900 dark:text-gray-100' },
          { label: 'Active', value: stats.open, icon: AlertTriangle, color: 'text-orange-600' },
          { label: 'Critical', value: stats.critical, icon: Shield, color: 'text-red-600' },
          { label: 'Resolved', value: stats.resolved, icon: CheckCircle, color: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-900 rounded-xl p-4 border flex items-center gap-3">
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"><s.icon className={`w-5 h-5 ${s.color}`} /></div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border p-4 mb-6">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Report New Incident</h3>
          <div className="grid grid-cols-3 gap-3">
            <input type="text" placeholder="Incident title" className="px-3 py-2 border rounded-lg text-sm col-span-2" />
            <select className="px-3 py-2 border rounded-lg text-sm">
              <option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
            </select>
            <select className="px-3 py-2 border rounded-lg text-sm">
              <option value="security">Security</option><option value="system">System</option><option value="financial">Financial</option><option value="compliance">Compliance</option>
            </select>
            <input type="text" placeholder="Assign to..." className="px-3 py-2 border rounded-lg text-sm" />
            <button className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm">Create</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search incidents..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm" />
        </div>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
          {['all', 'open', 'investigating', 'resolved'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded text-xs font-medium capitalize ${statusFilter === s ? 'bg-white dark:bg-gray-900 shadow' : 'text-gray-500 dark:text-gray-400'}`}>{s}</button>
          ))}
        </div>
      </div>

      {/* Incident List */}
      <div className="space-y-2">
        {filtered.map(incident => (
          <div key={incident.id} className="bg-white dark:bg-gray-900 rounded-xl border p-4 hover:shadow-sm transition cursor-pointer"
            onClick={() => setSelectedIncident(selectedIncident === incident.id ? null : incident.id)}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded ${SEVERITY_COLORS[incident.severity]}`}>{incident.severity}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[incident.status]}`}>{incident.status}</span>
                  <span className="text-xs text-gray-400">{incident.category}</span>
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{incident.title}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Reported by {incident.reported_by} | Assigned to {incident.assigned_to} | {new Date(incident.created).toLocaleString()}
                </p>
              </div>
            </div>
            {selectedIncident === incident.id && (
              <div className="mt-3 pt-3 border-t space-y-2 text-sm">
                <div><span className="text-gray-400">Impact:</span> <span className="text-gray-700 dark:text-gray-300">{incident.impact}</span></div>
                {incident.resolution && <div><span className="text-gray-400">Resolution:</span> <span className="text-gray-700 dark:text-gray-300">{incident.resolution}</span></div>}
                {incident.resolved && <div><span className="text-gray-400">Resolved:</span> <span className="text-gray-700 dark:text-gray-300">{new Date(incident.resolved).toLocaleString()}</span></div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
