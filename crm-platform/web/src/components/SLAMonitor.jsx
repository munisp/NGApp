import { useState, useContext, useEffect } from 'react';
import { useApiData } from '@/hooks/useApiData'
import { Timer, AlertTriangle, CheckCircle, TrendingUp, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { TenantContext } from '../contexts/TenantContext';
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const SLA_DATA = {
  'tenant-acme-bank': {
    overall: 97.2,
    categories: [
      { name: 'KYC Review', target_hours: 24, avg_hours: 18.4, compliance: 96.5, total: 245, breached: 9, trend: 'up' },
      { name: 'Transaction Approval', target_hours: 4, avg_hours: 2.1, compliance: 99.2, total: 1842, breached: 15, trend: 'up' },
      { name: 'Dispute Resolution', target_hours: 48, avg_hours: 32.6, compliance: 94.1, total: 87, breached: 5, trend: 'down' },
      { name: 'Agent Onboarding', target_hours: 72, avg_hours: 48.3, compliance: 98.0, total: 156, breached: 3, trend: 'up' },
      { name: 'Compliance Filing', target_hours: 72, avg_hours: 54.2, compliance: 95.8, total: 24, breached: 1, trend: 'stable' },
      { name: 'Campaign Review', target_hours: 24, avg_hours: 16.1, compliance: 100.0, total: 42, breached: 0, trend: 'up' },
      { name: 'Security Incident', target_hours: 2, avg_hours: 0.8, compliance: 100.0, total: 18, breached: 0, trend: 'up' },
      { name: 'Customer Escalation', target_hours: 4, avg_hours: 3.2, compliance: 92.0, total: 125, breached: 10, trend: 'down' },
    ],
    recent_breaches: [
      { id: 'b-001', task: 'KYC review for customer C-8821', type: 'KYC Review', target: '24h', actual: '28h', assignee: 'Compliance Officer', date: '2025-05-03' },
      { id: 'b-002', task: 'Dispute TXN-4521 resolution', type: 'Dispute Resolution', target: '48h', actual: '56h', assignee: 'Dispute Handler', date: '2025-05-02' },
      { id: 'b-003', task: 'Escalation — Agent cash-out failure', type: 'Customer Escalation', target: '4h', actual: '6.5h', assignee: 'Support Lead', date: '2025-05-02' },
    ],
  },
};

export default function SLAMonitor() {
  const { t } = useTranslation()
  const { tenantId } = useContext(TenantContext);
  const [data, setData] = useState(SLA_DATA[tenantId] || SLA_DATA['tenant-acme-bank']);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => { setData(SLA_DATA[tenantId] || SLA_DATA['tenant-acme-bank']); }, [tenantId]);

  const totalTasks = data.categories.reduce((s, c) => s + c.total, 0);
  const totalBreached = data.categories.reduce((s, c) => s + c.breached, 0);

  return (
    <div role="region" aria-label="SLAMonitor"  className="p-6 max-w-full">
      <div className="flex items-center gap-3 mb-6">
        <Timer className="w-8 h-8 text-orange-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SLA Monitor</h1>
          <p className="text-sm text-gray-500">Service Level Agreement tracking across all operational categories</p>
        </div>
      </div>

      {/* Score Banner */}
      <div className={`rounded-xl p-6 mb-6 text-white ${data.overall >= 95 ? 'bg-gradient-to-r from-green-600 to-emerald-600' : data.overall >= 85 ? 'bg-gradient-to-r from-yellow-600 to-orange-600' : 'bg-gradient-to-r from-red-600 to-rose-600'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">Overall SLA Compliance</p>
            <p className="text-5xl font-bold">{data.overall}%</p>
            <p className="text-sm opacity-80 mt-1">{totalTasks.toLocaleString()} tasks tracked | {totalBreached} breaches this period</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{totalTasks.toLocaleString()}</p>
              <p className="text-xs opacity-80">Total Tasks</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{totalBreached}</p>
              <p className="text-xs opacity-80">SLA Breaches</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{data.categories.length}</p>
              <p className="text-xs opacity-80">SLA Categories</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {['dashboard', 'breaches'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition capitalize ${activeTab === tab ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && (
        <div className="bg-white rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Category</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Target</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Avg Time</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Compliance</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Tasks</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Breached</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Trend</th>
              </tr>
            </thead>
            <tbody>
              {data.categories.map(cat => (
                <tr key={cat.name} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{cat.name}</td>
                  <td className="px-4 py-3 text-gray-500">{cat.target_hours}h</td>
                  <td className="px-4 py-3">
                    <span className={cat.avg_hours > cat.target_hours ? 'text-red-600 font-medium' : 'text-green-600'}>{cat.avg_hours}h</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${cat.compliance >= 95 ? 'bg-green-500' : cat.compliance >= 85 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${cat.compliance}%` }} />
                      </div>
                      <span className="text-xs">{cat.compliance}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{cat.total}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${cat.breached > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{cat.breached}</span>
                  </td>
                  <td className="px-4 py-3">
                    {cat.trend === 'up' ? <ArrowUpRight className="w-4 h-4 text-green-500" /> :
                     cat.trend === 'down' ? <ArrowDownRight className="w-4 h-4 text-red-500" /> :
                     <span className="text-gray-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'breaches' && (
        <div className="bg-white rounded-xl border">
          <div className="px-4 py-3 border-b"><h3 className="font-medium text-gray-900">Recent SLA Breaches</h3></div>
          {data.recent_breaches.map(breach => (
            <div key={breach.id} className="flex items-center justify-between px-4 py-3 border-b last:border-0 hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{breach.task}</p>
                  <p className="text-xs text-gray-500">{breach.type} | Assigned to {breach.assignee} | {breach.date}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-red-600 font-medium">{breach.actual} <span className="text-gray-400">/ {breach.target}</span></p>
                <p className="text-xs text-gray-400">Exceeded by {parseFloat(breach.actual) - parseFloat(breach.target)}h</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
