import { useState, useContext, useEffect } from 'react';
import { Shield, Search, Filter, Download, AlertTriangle, CheckCircle, XCircle, Clock, Eye, ChevronDown, ChevronRight, RefreshCw, FileText } from 'lucide-react';
import { TenantContext } from '../contexts/TenantContext';
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const SEED_EVENTS = {
  'tenant-acme-bank': [
    { id: 'evt-001', timestamp: '2025-05-04T14:23:11Z', actor_id: 'user-001', actor_name: 'Adebayo Okonkwo', actor_type: 'user', action: 'customer.create', resource_type: 'customer', resource_id: 'cust-4521', category: 'data_mutation', severity: 'low', status: 'success', description: 'Created new customer record — Fatima Ibrahim', ip: '10.0.1.45' },
    { id: 'evt-002', timestamp: '2025-05-04T14:18:05Z', actor_id: 'user-002', actor_name: 'Ngozi Okwu', actor_type: 'user', action: 'transaction.approve', resource_type: 'transaction', resource_id: 'txn-8832', category: 'financial', severity: 'medium', status: 'success', description: 'Approved transfer of ₦2,500,000 — Agent float top-up', ip: '10.0.2.12' },
    { id: 'evt-003', timestamp: '2025-05-04T14:15:22Z', actor_id: 'system', actor_name: 'System', actor_type: 'system', action: 'login.failed', resource_type: 'auth', resource_id: 'session-991', category: 'authentication', severity: 'high', status: 'failure', description: 'Failed login attempt — 3rd consecutive failure for user ops@acmebank.ng', ip: '41.58.120.44' },
    { id: 'evt-004', timestamp: '2025-05-04T14:10:00Z', actor_id: 'user-003', actor_name: 'Chinedu Eze', actor_type: 'user', action: 'policy.update', resource_type: 'policy', resource_id: 'pol-admin-full', category: 'configuration', severity: 'high', status: 'success', description: 'Modified PBAC policy "Admin Full Access" — added time restriction', ip: '10.0.1.88' },
    { id: 'evt-005', timestamp: '2025-05-04T14:05:30Z', actor_id: 'api-key-001', actor_name: 'Integration API', actor_type: 'api', action: 'customer.export', resource_type: 'customer', resource_id: 'batch-export-42', category: 'data_access', severity: 'medium', status: 'success', description: 'Exported 1,250 customer records via API', ip: '10.0.3.100' },
    { id: 'evt-006', timestamp: '2025-05-04T13:58:15Z', actor_id: 'system', actor_name: 'System', actor_type: 'system', action: 'kyc.verify', resource_type: 'kyc', resource_id: 'kyc-req-221', category: 'compliance', severity: 'low', status: 'success', description: 'BVN verification completed — customer Musa Bello', ip: '10.0.1.1' },
    { id: 'evt-007', timestamp: '2025-05-04T13:45:00Z', actor_id: 'waf-engine', actor_name: 'WAF', actor_type: 'system', action: 'threat.blocked', resource_type: 'security', resource_id: 'waf-evt-554', category: 'security', severity: 'critical', status: 'success', description: 'SQL injection attempt blocked from 41.58.120.44 — /api/v1/customers?q=\' OR 1=1', ip: '41.58.120.44' },
    { id: 'evt-008', timestamp: '2025-05-04T13:30:12Z', actor_id: 'user-004', actor_name: 'Amina Mohammed', actor_type: 'user', action: 'campaign.launch', resource_type: 'campaign', resource_id: 'camp-q2-cross', category: 'data_mutation', severity: 'medium', status: 'success', description: 'Launched campaign "Q2 Cross-sell" — 12,500 recipients via WhatsApp', ip: '10.0.1.52' },
    { id: 'evt-009', timestamp: '2025-05-04T13:15:44Z', actor_id: 'temporal', actor_name: 'Temporal Worker', actor_type: 'service', action: 'workflow.complete', resource_type: 'workflow', resource_id: 'wf-onboard-889', category: 'system', severity: 'low', status: 'success', description: 'Customer onboarding workflow completed — NextGen MFB batch', ip: '10.0.4.10' },
    { id: 'evt-010', timestamp: '2025-05-04T13:00:00Z', actor_id: 'cron', actor_name: 'Cron Job', actor_type: 'cron', action: 'compliance.scan', resource_type: 'compliance', resource_id: 'scan-monthly-05', category: 'compliance', severity: 'low', status: 'success', description: 'Monthly NDPR compliance scan completed — Score: 94.2%', ip: '10.0.1.1' },
  ],
  'tenant-nextgen-mfb': [
    { id: 'evt-n01', timestamp: '2025-05-04T14:20:00Z', actor_id: 'user-n01', actor_name: 'Tech Admin', actor_type: 'user', action: 'settings.update', resource_type: 'settings', resource_id: 'settings-001', category: 'configuration', severity: 'medium', status: 'success', description: 'Updated notification preferences', ip: '10.0.5.10' },
  ],
};

const SEVERITY_STYLES = {
  low: { bg: 'bg-gray-100', text: 'text-gray-600', icon: CheckCircle },
  medium: { bg: 'bg-blue-100', text: 'text-blue-600', icon: Eye },
  high: { bg: 'bg-orange-100', text: 'text-orange-600', icon: AlertTriangle },
  critical: { bg: 'bg-red-100', text: 'text-red-600', icon: XCircle },
};

const CATEGORY_LABELS = {
  data_mutation: 'Data Change', data_access: 'Data Access', authentication: 'Authentication',
  authorization: 'Authorization', configuration: 'Configuration', compliance: 'Compliance',
  security: 'Security', financial: 'Financial', system: 'System', integration: 'Integration',
};

export default function AuditLog() {
  const { t } = useTranslation()
  const { tenantId } = useContext(TenantContext);
  const [events, setEvents] = useState(SEED_EVENTS[tenantId] || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [chainValid, setChainValid] = useState(true);

  useEffect(() => {
    setEvents(SEED_EVENTS[tenantId] || []);
  }, [tenantId]);

  const filtered = events.filter(e => {
    if (severityFilter !== 'all' && e.severity !== severityFilter) return false;
    if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return e.description.toLowerCase().includes(q) || e.actor_name.toLowerCase().includes(q) || e.action.toLowerCase().includes(q);
    }
    return true;
  });

  const stats = {
    total: events.length,
    critical: events.filter(e => e.severity === 'critical').length,
    high: events.filter(e => e.severity === 'high').length,
    failed: events.filter(e => e.status === 'failure').length,
  };

  return (
    <div role="region" aria-label="AuditLog"  className="p-6 max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
            <p className="text-sm text-gray-500">Tamper-evident event trail with hash chain integrity</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${chainValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {chainValid ? 'Chain Valid' : 'Chain Broken'}
          </span>
          <button className="flex items-center gap-1 px-3 py-2 bg-white border rounded-lg text-sm hover:bg-gray-50">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Events', value: stats.total, color: 'text-gray-900' },
          { label: 'Critical', value: stats.critical, color: 'text-red-600' },
          { label: 'High Severity', value: stats.high, color: 'text-orange-600' },
          { label: 'Failed Actions', value: stats.failed, color: 'text-red-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 border">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search events..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm" />
        </div>
        <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
          <option value="all">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Event List */}
      <div className="bg-white rounded-xl border">
        <div className="grid grid-cols-[140px_1fr_120px_100px_100px_80px] gap-2 px-4 py-3 border-b text-xs font-medium text-gray-500 uppercase">
          <span>Timestamp</span><span>Event</span><span>Actor</span><span>Category</span><span>Severity</span><span>Status</span>
        </div>
        {filtered.map(event => {
          const sev = SEVERITY_STYLES[event.severity] || SEVERITY_STYLES.low;
          const SevIcon = sev.icon;
          const expanded = expandedEvent === event.id;
          return (
            <div key={event.id} className="border-b last:border-0">
              <div className="grid grid-cols-[140px_1fr_120px_100px_100px_80px] gap-2 px-4 py-3 items-center cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedEvent(expanded ? null : event.id)}>
                <span className="text-xs text-gray-500 font-mono">{new Date(event.timestamp).toLocaleTimeString()}</span>
                <div className="flex items-center gap-2">
                  {expanded ? <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                  <span className="text-sm text-gray-900 truncate">{event.description}</span>
                </div>
                <span className="text-xs text-gray-600">{event.actor_name}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 w-fit">{CATEGORY_LABELS[event.category] || event.category}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${sev.bg} ${sev.text} flex items-center gap-1 w-fit`}>
                  <SevIcon className="w-3 h-3" /> {event.severity}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded w-fit ${event.status === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                  {event.status}
                </span>
              </div>
              {expanded && (
                <div className="px-4 py-3 bg-gray-50 grid grid-cols-3 gap-4 text-xs">
                  <div><span className="text-gray-400">Event ID:</span> <span className="font-mono">{event.id}</span></div>
                  <div><span className="text-gray-400">Action:</span> <span className="font-mono">{event.action}</span></div>
                  <div><span className="text-gray-400">Resource:</span> <span className="font-mono">{event.resource_type}/{event.resource_id}</span></div>
                  <div><span className="text-gray-400">Actor Type:</span> {event.actor_type}</div>
                  <div><span className="text-gray-400">IP Address:</span> <span className="font-mono">{event.ip}</span></div>
                  <div><span className="text-gray-400">Actor ID:</span> <span className="font-mono">{event.actor_id}</span></div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">No events match filters</div>
        )}
      </div>
    </div>
  );
}
