import { useState } from 'react'
import { Shield, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const items = [
  { id: 'NCC-001', name: 'QoS Call Drop Rate', status: 'compliant', detail: 'Call drop rate 0.8% — NCC limit 2%', metric: '0.8%', threshold: '< 2%', lastCheck: '2 hours ago' },
  { id: 'NCC-002', name: 'Data Service Availability', status: 'warning', detail: '99.2% — approaching NCC minimum 99.5%', metric: '99.2%', threshold: '> 99.5%', lastCheck: '1 hour ago' },
  { id: 'NCC-003', name: 'Number Portability SLA', status: 'violation', detail: 'Avg 72 hours — NCC requires 48 hours', metric: '72 hrs', threshold: '< 48 hrs', lastCheck: '3 days ago' },
  { id: 'NCC-004', name: 'Consumer Complaint Resolution', status: 'compliant', detail: '85% resolved within 14 days', metric: '85%', threshold: '> 80%', lastCheck: '1 day ago' },
  { id: 'NCC-005', name: 'Infrastructure Sharing Report', status: 'compliant', detail: 'Filed on schedule — Q1 2026', metric: 'Filed', threshold: 'Quarterly', lastCheck: 'Apr 15' }
]

export default function TelcoNCCCompliance() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('telconcccompliance', () => apiClient.dashboard.metrics(), { fallback: items })
  const { tenant } = useTenant()
  const [activeTab, setActiveTab] = useState('violations')
  const [search, setSearch] = useState('')
  const [expandedItem, setExpandedItem] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = items.filter(item => {
    const matchesSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.status.toLowerCase().includes(search.toLowerCase()) || item.detail.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div role="region" aria-label="TelcoNCCCompliance" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Shield className="w-7 h-7 text-purple-600" /> NCC Compliance</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Nigerian Communications Commission regulatory compliance for {tenant?.name || 'platform'}</p></div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Compliance Score', v: '94.2%', c: 'text-emerald-600' }, { l: 'Open Violations', v: '3', c: 'text-red-600' }, { l: 'Pending Audits', v: '2', c: 'text-amber-600' }, { l: 'Last NCC Inspection', v: '12 days ago' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['violations', 'filings', 'audit-log'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {activeTab === 'violations' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="all">All Status</option><option value="compliant">compliant</option><option value="warning">warning</option><option value="violation">violation</option>
            </select>
          </div>
          <div className="space-y-2">
            {filtered.map(item => (
              <div key={item.id} onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow ${expandedItem === item.id ? 'border-purple-500 ring-1 ring-purple-500' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{item.name}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded ${item.status === 'compliant' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : item.status === 'warning' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{item.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{item.status}</p>
                  </div>
                  <div className="text-right text-sm text-gray-600 dark:text-gray-400">{item.detail}</div>
                </div>
                {expandedItem === item.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-4 text-xs">
                    <div><span className="text-gray-500">Threshold</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.threshold}</p></div>
                    <div><span className="text-gray-500">Lastcheck</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.lastCheck}</p></div>
                    <div className="flex gap-2 items-start">
                      <button className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs hover:bg-purple-700">View Details</button>
                      <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Export</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'filings' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Filings</h3>
          <p className="text-sm text-gray-500">Connect data source to view filings analytics and reports.</p>
          <button className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">Configure</button>
        </div>
      )}

      {activeTab === 'audit-log' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Audit Log</h3>
          <p className="text-sm text-gray-500">Configure audit log settings and preferences.</p>
          <button className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">Setup</button>
        </div>
      )}
    </div>
  )
}
