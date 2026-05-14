import { useState } from 'react'
import { BarChart3, Search, AlertTriangle, DollarSign, TrendingUp, Shield } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge , ErrorState } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const leakagePoints = [
  { id: 'RA-001', category: 'CDR Mismatch', description: 'Call records not matching billing system', amount: '₦142.8M', severity: 'critical', status: 'investigating', affectedSubs: 12400, detectedDate: '2 days ago', assignee: 'Revenue Team' },
  { id: 'RA-002', category: 'Unbilled Usage', description: 'Data sessions not captured in mediation', amount: '₦89.4M', severity: 'high', status: 'resolved', affectedSubs: 8200, detectedDate: '5 days ago', assignee: 'Billing Ops' },
  { id: 'RA-003', category: 'Rate Plan Error', description: 'International roaming rates misconfigured', amount: '₦34.2M', severity: 'medium', status: 'in-progress', affectedSubs: 340, detectedDate: '1 day ago', assignee: 'Config Team' },
  { id: 'RA-004', category: 'Interconnect Dispute', description: 'Incoming traffic underreported by partner', amount: '₦215.6M', severity: 'critical', status: 'investigating', affectedSubs: 0, detectedDate: '3 days ago', assignee: 'Interconnect' },
  { id: 'RA-005', category: 'Fraud Detection', description: 'SIM box detected in Kano region', amount: '₦67.8M', severity: 'high', status: 'escalated', affectedSubs: 0, detectedDate: '12 hours ago', assignee: 'Fraud Team' },
]

const severityColors = { critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', high: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' }
const statusColors = { investigating: 'bg-purple-100 text-purple-700', resolved: 'bg-emerald-100 text-emerald-700', 'in-progress': 'bg-blue-100 text-blue-700', escalated: 'bg-red-100 text-red-700' }

export default function TelcoRevenueAssurance() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('telcorevenueassurance', () => apiClient.dashboard.metrics(), { fallback: leakagePoints })
  const { tenant } = useTenant()
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [expandedItem, setExpandedItem] = useState(null)
  const [activeTab, setActiveTab] = useState('leakages')
  const [error, setError] = useState(null)

  const filtered = leakagePoints.filter(l => {
    const matchesSearch = !search || l.category.toLowerCase().includes(search.toLowerCase()) || l.description.toLowerCase().includes(search.toLowerCase())
    const matchesSeverity = severityFilter === 'all' || l.severity === severityFilter
    return matchesSearch && matchesSeverity
  })

  const totalLeakage = '₦549.8M'

  if (error) return <ErrorState message={error} />

  return (
    <div role="region" aria-label="TelcoRevenueAssurance" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><BarChart3 className="w-7 h-7 text-orange-600" /> Revenue Assurance</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Detect and recover revenue leakage for {tenant?.name || 'telco'}</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[{ l: 'Total Leakage', v: totalLeakage, c: 'text-red-600' }, { l: 'Active Cases', v: leakagePoints.filter(l => l.status !== 'resolved').length, c: 'text-amber-600' }, { l: 'Recovered (MTD)', v: '₦89.4M', c: 'text-emerald-600' }, { l: 'Recovery Rate', v: '16.3%' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['leakages', 'trends', 'audit'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
        ))}
      </div>
      {activeTab === 'leakages' && (<div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leakage cases..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
          <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"><option value="all">All Severity</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option></select>
        </div>
        <div className="space-y-2">
          {filtered.length === 0 && <div className="text-center py-8 text-gray-500 dark:text-gray-400">No records found</div>}
          {filtered.map(l => (
            <div key={l.id} onClick={() => setExpandedItem(expandedItem === l.id ? null : l.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md ${expandedItem === l.id ? 'border-orange-500 ring-1 ring-orange-500' : 'border-gray-200 dark:border-gray-700'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${l.severity === 'critical' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}><AlertTriangle className={`w-5 h-5 ${l.severity === 'critical' ? 'text-red-600' : 'text-amber-600'}`} /></div>
                  <div><div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900 dark:text-white">{l.category}</h4><span className={`text-xs px-2 py-0.5 rounded ${severityColors[l.severity]}`}>{l.severity}</span><span className={`text-xs px-2 py-0.5 rounded ${statusColors[l.status]}`}>{l.status}</span></div><p className="text-xs text-gray-500 mt-0.5">{l.description}</p></div>
                </div>
                <div className="text-right"><p className="text-lg font-bold text-red-600">{l.amount}</p><p className="text-xs text-gray-400">{l.detectedDate}</p></div>
              </div>
              {expandedItem === l.id && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-4 text-xs">
                  <div><span className="text-gray-500">Affected Subscribers</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{l.affectedSubs > 0 ? l.affectedSubs.toLocaleString() : 'N/A'}</p></div>
                  <div><span className="text-gray-500">Assigned To</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{l.assignee}</p></div>
                  <div className="flex gap-2 items-start">
                    <button className="px-3 py-1.5 bg-orange-600 text-white rounded text-xs hover:bg-orange-700">Investigate</button>
                    <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Export Report</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>)}
      {activeTab === 'trends' && (<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Leakage Trends — Last 6 Months</h3>
        {[{ month: 'May 2026', amount: '₦549.8M', recovered: '₦89.4M', pct: 16 }, { month: 'Apr 2026', amount: '₦412.3M', recovered: '₦298.1M', pct: 72 }, { month: 'Mar 2026', amount: '₦387.9M', recovered: '₦342.5M', pct: 88 }, { month: 'Feb 2026', amount: '₦521.0M', recovered: '₦445.2M', pct: 85 }].map(m => (
          <div key={m.month} className="flex items-center gap-3"><span className="w-24 text-sm text-gray-600 dark:text-gray-400">{m.month}</span><div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className={`h-full rounded-full ${m.pct >= 70 ? 'bg-emerald-500' : m.pct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${m.pct}%` }} /></div><span className="w-32 text-right text-xs text-gray-500">{m.recovered} / {m.amount}</span></div>
        ))}
      </div>)}
      {activeTab === 'audit' && (<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center"><Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" /><h3 className="font-semibold text-gray-900 dark:text-white">Revenue Audit Trail</h3><p className="text-sm text-gray-500 mt-1">Connect billing mediation system for automated CDR reconciliation and real-time leakage detection.</p><button className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700">Configure Audit</button></div>)}
    </div>
  )
}
