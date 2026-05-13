import { useState } from 'react'
import { Database, Activity, Link } from 'lucide-react'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const profiles = [
  { id: 'CDP-001', name: 'Dangote Industries', type: 'Enterprise', identities: 24, events: 12400, sources: ['CRM', 'Email', 'Web', 'Support', 'Billing'], segments: ['Enterprise', 'High-Value', 'Trade Finance'], ltv: '₦2.4B', health: 92, lastSeen: '2 hours ago' },
  { id: 'CDP-002', name: 'MTN Nigeria', type: 'Enterprise', identities: 18, events: 8900, sources: ['CRM', 'Email', 'Web', 'Support'], segments: ['Enterprise', 'Growth', 'Payroll'], ltv: '₦890M', health: 78, lastSeen: '1 day ago' },
  { id: 'CDP-003', name: 'Kano Textiles', type: 'SME', identities: 4, events: 1200, sources: ['CRM', 'Support'], segments: ['SME', 'At-Risk', 'Manufacturing'], ltv: '₦45.2M', health: 25, lastSeen: '45 days ago' },
  { id: 'CDP-004', name: 'Shoprite Nigeria', type: 'Corporate', identities: 12, events: 5600, sources: ['CRM', 'Email', 'Web', 'Support', 'POS'], segments: ['Corporate', 'Retail', 'Multi-Branch'], ltv: '₦180M', health: 65, lastSeen: '3 days ago' },
]

export default function CDPProfiles() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('cdpprofiles', () => apiClient.dashboard.metrics(), { fallback: profiles })
  const [selected, setSelected] = useState(null)

  return (
    <div role="region" aria-label="CDPProfiles" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Database className="w-7 h-7 text-cyan-600" /> Customer Data Platform</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Unified customer profiles with identity resolution</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Unified Profiles', v: profiles.length }, { l: 'Total Identities', v: profiles.reduce((s, p) => s + p.identities, 0) }, { l: 'Events Tracked', v: (profiles.reduce((s, p) => s + p.events, 0) / 1000).toFixed(1) + 'K' }, { l: 'Data Sources', v: 6 }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="space-y-2">
        {profiles.map(p => (
          <div key={p.id} onClick={() => setSelected(selected === p.id ? null : p.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md ${selected === p.id ? 'border-cyan-500 ring-1 ring-cyan-500' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900 dark:text-white">{p.name}</h4><span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{p.type}</span></div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1"><span><Link className="w-3 h-3 inline mr-0.5" />{p.identities} identities</span><span><Activity className="w-3 h-3 inline mr-0.5" />{p.events.toLocaleString()} events</span><span>LTV: {p.ltv}</span><span>Last seen: {p.lastSeen}</span></div>
              </div>
              <div className={`text-xl font-bold ${p.health >= 75 ? 'text-emerald-600' : p.health >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{p.health}</div>
            </div>
            {selected === p.id && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-4">
                <div><h5 className="text-xs font-medium text-gray-500 mb-1">Data Sources</h5><div className="flex gap-1">{p.sources.map(s => <span key={s} className="text-xs px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400">{s}</span>)}</div></div>
                <div><h5 className="text-xs font-medium text-gray-500 mb-1">Segments</h5><div className="flex gap-1">{p.segments.map(s => <span key={s} className="text-xs px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400">{s}</span>)}</div></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
