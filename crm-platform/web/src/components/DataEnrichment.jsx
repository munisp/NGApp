import { useState } from 'react'
import { Database, RefreshCw, CheckCircle, Pause, Activity, Globe, Clock, TrendingUp, AlertTriangle } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const sources = [
  { id: 'DS-001', name: 'LinkedIn Company Data', status: 'active', records: 28400, matchRate: 94, lastSync: '2 hours ago', fields: ['Company size', 'Industry', 'HQ location', 'Revenue estimate'], costPerRecord: '$0.02' },
  { id: 'DS-002', name: 'Clearbit', status: 'active', records: 15200, matchRate: 87, lastSync: '4 hours ago', fields: ['Tech stack', 'Funding', 'Employee count', 'Social profiles'], costPerRecord: '$0.05' },
  { id: 'DS-003', name: 'Credit Bureau (CRC)', status: 'active', records: 43242, matchRate: 98, lastSync: '1 day ago', fields: ['Credit score', 'Default history', 'Outstanding loans'], costPerRecord: '\u20A650' },
  { id: 'DS-004', name: 'NCC Registry', status: 'paused', records: 8900, matchRate: 82, lastSync: '1 week ago', fields: ['License status', 'Compliance', 'Spectrum allocation'], costPerRecord: '\u20A6100' },
  { id: 'DS-005', name: 'CAC (Company Registry)', status: 'active', records: 34800, matchRate: 91, lastSync: '6 hours ago', fields: ['Registration date', 'Directors', 'Share capital', 'Status'], costPerRecord: '\u20A630' },
]

export default function DataEnrichment() {
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [selected, setSelected] = useState(null)

  return (
    <div role="region" aria-label="DataEnrichment" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Database className="w-7 h-7 text-amber-600" /> Data Enrichment</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Automatically enrich records with external data sources</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Data Sources', v: sources.length }, { l: 'Records Enriched', v: sources.reduce((s, d) => s + d.records, 0).toLocaleString() }, { l: 'Avg Match Rate', v: Math.round(sources.reduce((s, d) => s + d.matchRate, 0) / sources.length) + '%' }, { l: 'Active Sources', v: sources.filter(s => s.status === 'active').length }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="space-y-2">
        {sources.map(src => (
          <div key={src.id} onClick={() => setSelected(selected === src.id ? null : src.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md ${selected === src.id ? 'border-amber-500 ring-1 ring-amber-500' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${src.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">{src.name}</h4>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5"><span>{src.records.toLocaleString()} records</span><span>Match: {src.matchRate}%</span><span>Last sync: {src.lastSync}</span><span>{src.costPerRecord}/record</span></div>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded ${src.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{src.status}</span>
            </div>
            {selected === src.id && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <h5 className="text-xs font-medium text-gray-500 mb-2">Enriched Fields</h5>
                <div className="flex flex-wrap gap-1">{src.fields.map(f => <span key={f} className="text-xs px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">{f}</span>)}</div>
                <div className="flex gap-2 mt-3">
                  <button className="px-3 py-1.5 bg-amber-600 text-white rounded text-xs hover:bg-amber-700 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Sync Now</button>
                  <button className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Configure</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
