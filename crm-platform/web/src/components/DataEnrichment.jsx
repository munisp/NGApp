import { useState } from 'react'
import { Sparkles, Search, RefreshCw, CheckCircle, Clock, AlertTriangle, Database } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge , ErrorState } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const enrichments = [
  { id: 'ENR-001', company: 'Dangote Industries', fieldsEnriched: 18, fieldsTotal: 22, completeness: 82, source: 'Clearbit + LinkedIn', lastUpdated: '2 hours ago', status: 'complete', revenue: '₦4.5T', employees: '30,000+', industry: 'Conglomerate', enrichedFields: ['Revenue', 'Employee Count', 'Funding', 'Tech Stack', 'Social Profiles', 'News'] },
  { id: 'ENR-002', company: 'MTN Nigeria', fieldsEnriched: 20, fieldsTotal: 22, completeness: 91, source: 'Clearbit + Crunchbase', lastUpdated: '1 day ago', status: 'complete', revenue: '₦2.1T', employees: '16,000', industry: 'Telecommunications', enrichedFields: ['Revenue', 'Employee Count', 'Subsidiaries', 'Tech Stack', 'Social Profiles', 'Competitors'] },
  { id: 'ENR-003', company: 'Kano Textiles', fieldsEnriched: 6, fieldsTotal: 22, completeness: 27, source: 'Manual + Web Scrape', lastUpdated: '30 days ago', status: 'partial', revenue: 'Unknown', employees: '~500', industry: 'Manufacturing', enrichedFields: ['Industry', 'Location', 'Contact Info'] },
  { id: 'ENR-004', company: 'Total Energies Nigeria', fieldsEnriched: 19, fieldsTotal: 22, completeness: 86, source: 'Clearbit + LinkedIn', lastUpdated: '3 days ago', status: 'complete', revenue: '₦1.8T', employees: '12,000', industry: 'Oil & Gas', enrichedFields: ['Revenue', 'Employee Count', 'Funding', 'Subsidiaries', 'Social Profiles', 'Partnerships'] },
  { id: 'ENR-005', company: 'Shoprite Nigeria', fieldsEnriched: 14, fieldsTotal: 22, completeness: 64, source: 'Clearbit', lastUpdated: '1 week ago', status: 'enriching', revenue: '₦180B', employees: '4,200', industry: 'Retail', enrichedFields: ['Revenue', 'Employee Count', 'Locations', 'Social Profiles'] },
]

export default function DataEnrichment() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('dataenrichment', () => apiClient.dashboard.metrics(), { fallback: enrichments })
  const { tenant } = useTenant()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [activeTab, setActiveTab] = useState('records')
  const [error, setError] = useState(null)

  const filtered = enrichments.filter(e => !search || e.company.toLowerCase().includes(search.toLowerCase()))

  if (error) return <ErrorState message={error} />

  return (
    <div role="region" aria-label="DataEnrichment" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Sparkles className="w-7 h-7 text-violet-600" /> Data Enrichment</h1><p className="text-gray-500 dark:text-gray-400 mt-1">AI-powered data enrichment for {tenant?.name || 'Platform'}</p></div>
        <div className="flex gap-2"><button className="px-3 py-2 bg-violet-600 text-white rounded-lg text-sm flex items-center gap-1 hover:bg-violet-700"><RefreshCw className="w-4 h-4" /> Enrich All</button><FallbackBadge /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[{ l: 'Records Enriched', v: enrichments.length }, { l: 'Avg Completeness', v: Math.round(enrichments.reduce((s, e) => s + e.completeness, 0) / enrichments.length) + '%', c: 'text-emerald-600' }, { l: 'Fields Added', v: enrichments.reduce((s, e) => s + e.fieldsEnriched, 0) }, { l: 'Sources Used', v: 4 }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['records', 'sources'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
        ))}
      </div>
      {activeTab === 'records' && (<div className="space-y-4">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search companies..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
        <div className="space-y-2">{filtered.length === 0 && <div className="text-center py-8 text-gray-500 dark:text-gray-400">No records found</div>}
          {filtered.map(e => (
          <div key={e.id} onClick={() => setSelected(selected === e.id ? null : e.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md ${selected === e.id ? 'border-violet-500 ring-1 ring-violet-500' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className="flex items-center justify-between">
              <div className="flex-1"><div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900 dark:text-white">{e.company}</h4><span className={`text-xs px-2 py-0.5 rounded ${e.status === 'complete' ? 'bg-emerald-100 text-emerald-700' : e.status === 'enriching' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{e.status}</span></div><div className="flex items-center gap-3 text-xs text-gray-500 mt-1"><span>{e.industry}</span><span>{e.employees} employees</span><span>Source: {e.source}</span></div></div>
              <div className="text-right"><div className={`text-lg font-bold ${e.completeness >= 80 ? 'text-emerald-600' : e.completeness >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{e.completeness}%</div><div className="text-xs text-gray-400">{e.fieldsEnriched}/{e.fieldsTotal} fields</div></div>
            </div>
            {selected === e.id && (<div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap gap-1 mb-3">{e.enrichedFields.map(f => <span key={f} className="text-xs px-2 py-0.5 rounded bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400">{f}</span>)}</div>
              <div className="flex gap-2"><button className="px-3 py-1.5 bg-violet-600 text-white rounded text-xs hover:bg-violet-700 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Re-Enrich</button><button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">View Profile</button></div>
            </div>)}
          </div>
        ))}</div>
      </div>)}
      {activeTab === 'sources' && (<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Data Sources</h3>
        {[{ name: 'Clearbit', status: 'Connected', records: 4, fields: 18 }, { name: 'LinkedIn Sales Nav', status: 'Connected', records: 3, fields: 12 }, { name: 'Crunchbase', status: 'Connected', records: 2, fields: 8 }, { name: 'Manual / Web Scrape', status: 'Active', records: 1, fields: 6 }].map(s => (
          <div key={s.name} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"><Database className="w-4 h-4 text-violet-500" /><span className="flex-1 text-sm text-gray-900 dark:text-white">{s.name}</span><span className="text-xs text-emerald-600">{s.status}</span><span className="text-xs text-gray-400">{s.records} records</span></div>
        ))}
      </div>)}
    </div>
  )
}
