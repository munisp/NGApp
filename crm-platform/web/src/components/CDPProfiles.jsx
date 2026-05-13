import { useState } from 'react'
import { Database, Activity, Link, Search, Filter, Users, TrendingUp, Eye } from 'lucide-react'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const profiles = [
  { id: 'CDP-001', name: 'Dangote Industries', type: 'Enterprise', identities: 24, events: 12400, sources: ['CRM', 'Email', 'Web', 'Support', 'Billing'], segments: ['Enterprise', 'High-Value', 'Trade Finance'], ltv: '₦2.4B', health: 92, lastSeen: '2 hours ago', contacts: 8, engagement: 'Very High', churnRisk: 2, nextAction: 'QBR scheduled May 15' },
  { id: 'CDP-002', name: 'MTN Nigeria', type: 'Enterprise', identities: 18, events: 8900, sources: ['CRM', 'Email', 'Web', 'Support'], segments: ['Enterprise', 'Growth', 'Payroll'], ltv: '₦890M', health: 78, lastSeen: '1 day ago', contacts: 6, engagement: 'High', churnRisk: 8, nextAction: 'Contract renewal in 45 days' },
  { id: 'CDP-003', name: 'Kano Textiles', type: 'SME', identities: 4, events: 1200, sources: ['CRM', 'Support'], segments: ['SME', 'At-Risk', 'Manufacturing'], ltv: '₦45.2M', health: 25, lastSeen: '45 days ago', contacts: 2, engagement: 'Low', churnRisk: 85, nextAction: 'Escalation: Billing dispute unresolved' },
  { id: 'CDP-004', name: 'Shoprite Nigeria', type: 'Corporate', identities: 12, events: 5600, sources: ['CRM', 'Email', 'Web', 'Support', 'POS'], segments: ['Corporate', 'Retail', 'Multi-Branch'], ltv: '₦180M', health: 65, lastSeen: '3 days ago', contacts: 4, engagement: 'Medium', churnRisk: 18, nextAction: 'POS integration pilot review' },
  { id: 'CDP-005', name: 'Total Energies', type: 'Enterprise', identities: 15, events: 7800, sources: ['CRM', 'Email', 'Web', 'Support', 'Trading'], segments: ['Enterprise', 'FX Heavy', 'Commodity'], ltv: '₦1.2B', health: 45, lastSeen: '5 days ago', contacts: 5, engagement: 'Declining', churnRisk: 42, nextAction: 'Retention offer — competitor threat' },
  { id: 'CDP-006', name: 'Lafarge Cement', type: 'Corporate', identities: 8, events: 3200, sources: ['CRM', 'Email', 'Web'], segments: ['Corporate', 'Treasury', 'Manufacturing'], ltv: '₦450M', health: 82, lastSeen: '12 hours ago', contacts: 3, engagement: 'High', churnRisk: 5, nextAction: 'Treasury module upsell' },
]

const segments = [
  { name: 'Enterprise', count: 142, revenue: '₦8.2B', health: 78, growth: '+12%' },
  { name: 'Corporate', count: 389, revenue: '₦4.1B', health: 68, growth: '+8%' },
  { name: 'SME', count: 2847, revenue: '₦1.8B', health: 55, growth: '+22%' },
  { name: 'At-Risk', count: 248, revenue: '₦920M', health: 28, growth: '-15%' },
]

export default function CDPProfiles() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('cdpprofiles', () => apiClient.dashboard.metrics(), { fallback: profiles })
  const [selected, setSelected] = useState(null)
  const [activeTab, setActiveTab] = useState('profiles')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState('health')

  const filtered = profiles.filter(p => {
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
    const matchesType = typeFilter === 'all' || p.type === typeFilter
    return matchesSearch && matchesType
  }).sort((a, b) => {
    if (sortBy === 'health') return b.health - a.health
    if (sortBy === 'risk') return b.churnRisk - a.churnRisk
    return b.events - a.events
  })

  return (
    <div role="region" aria-label="CDPProfiles" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Database className="w-7 h-7 text-cyan-600" /> Customer Data Platform</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Unified customer profiles with identity resolution</p></div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Unified Profiles', v: profiles.length }, { l: 'Total Identities', v: profiles.reduce((s, p) => s + p.identities, 0) }, { l: 'Events Tracked', v: (profiles.reduce((s, p) => s + p.events, 0) / 1000).toFixed(1) + 'K' }, { l: 'At-Risk', v: profiles.filter(p => p.churnRisk > 40).length, c: 'text-red-600' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['profiles', 'segments', 'sources'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
        ))}
      </div>

      {activeTab === 'profiles' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"><option value="all">All Types</option><option value="Enterprise">Enterprise</option><option value="Corporate">Corporate</option><option value="SME">SME</option></select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"><option value="health">Sort: Health</option><option value="risk">Sort: Risk</option><option value="events">Sort: Activity</option></select>
          </div>
          <div className="space-y-2">
            {filtered.map(p => (
              <div key={p.id} onClick={() => setSelected(selected === p.id ? null : p.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md ${selected === p.id ? 'border-cyan-500 ring-1 ring-cyan-500' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900 dark:text-white">{p.name}</h4><span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{p.type}</span>{p.churnRisk > 40 && <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">At Risk</span>}</div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1"><span><Link className="w-3 h-3 inline mr-0.5" />{p.identities} identities</span><span><Activity className="w-3 h-3 inline mr-0.5" />{p.events.toLocaleString()} events</span><span>LTV: {p.ltv}</span><span>{p.engagement} engagement</span></div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className={`text-xl font-bold ${p.health >= 75 ? 'text-emerald-600' : p.health >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{p.health}</div>
                      <div className="text-xs text-gray-400">Health Score</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${p.churnRisk <= 10 ? 'text-emerald-600' : p.churnRisk <= 30 ? 'text-amber-600' : 'text-red-600'}`}>{p.churnRisk}%</div>
                      <div className="text-xs text-gray-400">Churn Risk</div>
                    </div>
                  </div>
                </div>
                {selected === p.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div><h5 className="text-xs font-medium text-gray-500 mb-1">Data Sources ({p.sources.length})</h5><div className="flex gap-1 flex-wrap">{p.sources.map(s => <span key={s} className="text-xs px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400">{s}</span>)}</div></div>
                      <div><h5 className="text-xs font-medium text-gray-500 mb-1">Segments ({p.segments.length})</h5><div className="flex gap-1 flex-wrap">{p.segments.map(s => <span key={s} className="text-xs px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400">{s}</span>)}</div></div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div><span className="text-gray-500">Contacts</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{p.contacts} stakeholders</p></div>
                      <div><span className="text-gray-500">Last Seen</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{p.lastSeen}</p></div>
                      <div><span className="text-gray-500">Next Action</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{p.nextAction}</p></div>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 bg-cyan-600 text-white rounded text-xs hover:bg-cyan-700">View Full Profile</button>
                      <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Export Data</button>
                      <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Create Task</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'segments' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Customer Segments</h3>
          {segments.map(seg => (
            <div key={seg.name} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="w-32"><span className="font-medium text-gray-900 dark:text-white">{seg.name}</span><p className="text-xs text-gray-500">{seg.count} accounts</p></div>
              <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden"><div className={`h-full rounded-full ${seg.health >= 60 ? 'bg-emerald-500' : seg.health >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${seg.health}%` }} /></div>
              <div className="w-20 text-right text-sm font-medium text-gray-900 dark:text-white">{seg.revenue}</div>
              <span className={`text-xs font-medium ${seg.growth.startsWith('+') ? 'text-emerald-600' : 'text-red-600'}`}>{seg.growth}</span>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'sources' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Data Sources</h3>
          {['CRM', 'Email', 'Web', 'Support', 'Billing', 'POS', 'Trading'].map(source => {
            const count = profiles.filter(p => p.sources.includes(source)).length
            return (
              <div key={source} className="flex items-center gap-3">
                <span className="w-24 text-sm text-gray-600 dark:text-gray-400">{source}</span>
                <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-cyan-500 rounded-full flex items-center pl-2 text-xs text-white font-medium" style={{ width: `${(count / profiles.length) * 100}%` }}>{count} profiles</div></div>
                <span className="text-xs text-emerald-600">Connected</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
