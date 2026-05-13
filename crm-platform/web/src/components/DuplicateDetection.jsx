import { useState } from 'react'
import { Copy, Search, CheckCircle, AlertTriangle, Merge, Trash2, Eye, Filter } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const duplicates = [
  { id: 'DUP-001', primary: 'Dangote Industries Ltd', duplicate: 'Dangote Industries', confidence: 98, type: 'Company', fields: ['Name', 'Email', 'Phone', 'Address'], status: 'pending', records: 3, source: 'AI Match', impact: 'High — affects 24 linked contacts' },
  { id: 'DUP-002', primary: 'Sarah Okonkwo', duplicate: 'Sarah O. Okonkwo', confidence: 95, type: 'Contact', fields: ['Name', 'Email'], status: 'pending', records: 2, source: 'Email Match', impact: 'Medium — duplicate activity history' },
  { id: 'DUP-003', primary: 'MTN Nigeria Plc', duplicate: 'MTN (Nigeria)', confidence: 92, type: 'Company', fields: ['Name', 'Industry'], status: 'reviewing', records: 2, source: 'AI Match', impact: 'High — separate deal pipelines' },
  { id: 'DUP-004', primary: 'Shoprite Holdings', duplicate: 'Shoprite Nigeria Ltd', confidence: 78, type: 'Company', fields: ['Name'], status: 'pending', records: 2, source: 'Fuzzy Match', impact: 'Low — may be separate entities' },
  { id: 'DUP-005', primary: 'ahmed.musa@totalenergies.com', duplicate: 'a.musa@totalenergies.ng', confidence: 85, type: 'Contact', fields: ['Email', 'Company'], status: 'merged', records: 2, source: 'Email Match', impact: 'Resolved — merged successfully' },
]

const statusColors = { pending: 'bg-amber-100 text-amber-700', reviewing: 'bg-blue-100 text-blue-700', merged: 'bg-emerald-100 text-emerald-700', dismissed: 'bg-gray-100 text-gray-600' }

export default function DuplicateDetection() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('duplicatedetection', () => apiClient.dashboard.metrics(), { fallback: duplicates })
  const { tenant } = useTenant()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState(null)

  const filtered = duplicates.filter(d => {
    const matchesSearch = !search || d.primary.toLowerCase().includes(search.toLowerCase()) || d.duplicate.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div role="region" aria-label="DuplicateDetection" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Copy className="w-7 h-7 text-orange-600" /> Duplicate Detection</h1><p className="text-gray-500 dark:text-gray-400 mt-1">AI-powered duplicate record detection for {tenant?.name || 'Platform'}</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Duplicates Found', v: duplicates.length }, { l: 'Pending Review', v: duplicates.filter(d => d.status === 'pending').length, c: 'text-amber-600' }, { l: 'Auto-Merged', v: duplicates.filter(d => d.status === 'merged').length, c: 'text-emerald-600' }, { l: 'Avg Confidence', v: Math.round(duplicates.reduce((s, d) => s + d.confidence, 0) / duplicates.length) + '%' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search records..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"><option value="all">All Status</option><option value="pending">Pending</option><option value="reviewing">Reviewing</option><option value="merged">Merged</option></select>
      </div>
      <div className="space-y-2">{filtered.map(d => (
        <div key={d.id} onClick={() => setSelected(selected === d.id ? null : d.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md ${selected === d.id ? 'border-orange-500 ring-1 ring-orange-500' : 'border-gray-200 dark:border-gray-700'}`}>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900 dark:text-white">{d.primary}</h4><span className="text-gray-400">≈</span><span className="text-gray-600 dark:text-gray-400">{d.duplicate}</span><span className={`text-xs px-2 py-0.5 rounded ${statusColors[d.status]}`}>{d.status}</span></div>
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-1"><span>{d.type}</span><span>{d.source}</span><span>Matching: {d.fields.join(', ')}</span></div>
            </div>
            <div className="text-right"><div className={`text-lg font-bold ${d.confidence >= 90 ? 'text-emerald-600' : d.confidence >= 80 ? 'text-amber-600' : 'text-gray-600'}`}>{d.confidence}%</div><div className="text-xs text-gray-400">confidence</div></div>
          </div>
          {selected === d.id && (<div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 mb-3">{d.impact}</p>
            {d.status !== 'merged' && <div className="flex gap-2">
              <button className="px-3 py-1.5 bg-orange-600 text-white rounded text-xs hover:bg-orange-700 flex items-center gap-1"><Merge className="w-3 h-3" /> Merge</button>
              <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1"><Eye className="w-3 h-3" /> Compare</button>
              <button className="px-3 py-1.5 text-gray-500 text-xs">Dismiss</button>
            </div>}
          </div>)}
        </div>
      ))}</div>
    </div>
  )
}
