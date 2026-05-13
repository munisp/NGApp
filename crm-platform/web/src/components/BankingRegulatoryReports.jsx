import { useState } from 'react'
import { FileSpreadsheet, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const items = [
  { id: 'REG-001', name: 'CBN Monthly Returns', authority: 'CBN', frequency: 'Monthly', dueDate: 'May 10, 2026', status: 'in-progress', lastSubmitted: 'Apr 10, 2026', format: 'XML' },
  { id: 'REG-002', name: 'NDIC Premium Assessment', authority: 'NDIC', frequency: 'Quarterly', dueDate: 'Jun 30, 2026', status: 'scheduled', lastSubmitted: 'Mar 31, 2026', format: 'PDF' },
  { id: 'REG-003', name: 'FIRS VAT Returns', authority: 'FIRS', frequency: 'Monthly', dueDate: 'May 21, 2026', status: 'in-progress', lastSubmitted: 'Apr 21, 2026', format: 'CSV' },
  { id: 'REG-004', name: 'CBN Anti-Money Laundering', authority: 'CBN', frequency: 'Quarterly', dueDate: 'Jun 30, 2026', status: 'scheduled', lastSubmitted: 'Mar 31, 2026', format: 'XML' },
  { id: 'REG-005', name: 'NDPR Data Privacy Report', authority: 'NITDA', frequency: 'Annual', dueDate: 'Dec 31, 2026', status: 'scheduled', lastSubmitted: 'Dec 31, 2025', format: 'PDF' }
]

export default function BankingRegulatoryReports() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('bankingregulatoryreports', () => apiClient.dashboard.metrics(), { fallback: items })
  const { tenant } = useTenant()
  const [activeTab, setActiveTab] = useState('schedule')
  const [search, setSearch] = useState('')
  const [expandedItem, setExpandedItem] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = items.filter(item => {
    const matchesSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.authority.toLowerCase().includes(search.toLowerCase()) || item.frequency.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div role="region" aria-label="BankingRegulatoryReports" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><FileSpreadsheet className="w-7 h-7 text-indigo-600" /> Regulatory Reports</h1><p className="text-gray-500 dark:text-gray-400 mt-1">CBN, NDIC, and FIRS regulatory reporting and compliance for {tenant?.name || 'platform'}</p></div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Reports Due', v: '3', c: 'text-amber-600' }, { l: 'Submitted (MTD)', v: '8', c: 'text-emerald-600' }, { l: 'Overdue', v: '0', c: 'text-emerald-600' }, { l: 'Compliance', v: '100%', c: 'text-emerald-600' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['schedule', 'submitted', 'templates'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {activeTab === 'schedule' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="all">All Status</option><option value="in-progress">in-progress</option><option value="scheduled">scheduled</option>
            </select>
          </div>
          <div className="space-y-2">
            {filtered.map(item => (
              <div key={item.id} onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow ${expandedItem === item.id ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{item.name}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded ${item.status === 'in-progress' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : item.status === 'scheduled' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{item.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{item.authority}</p>
                  </div>
                  <div className="text-right text-sm text-gray-600 dark:text-gray-400">{item.frequency}</div>
                </div>
                {expandedItem === item.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-4 text-xs">
                    <div><span className="text-gray-500">Duedate</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.dueDate}</p></div>
                    <div><span className="text-gray-500">Lastsubmitted</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.lastSubmitted}</p></div>
                    <div className="flex gap-2 items-start">
                      <button className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700">View Details</button>
                      <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Export</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'submitted' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <FileSpreadsheet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Submitted</h3>
          <p className="text-sm text-gray-500">Connect data source to view submitted analytics and reports.</p>
          <button className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">Configure</button>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <FileSpreadsheet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Templates</h3>
          <p className="text-sm text-gray-500">Configure templates settings and preferences.</p>
          <button className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">Setup</button>
        </div>
      )}
    </div>
  )
}
