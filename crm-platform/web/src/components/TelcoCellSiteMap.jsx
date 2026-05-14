import { useState } from 'react'
import { MapPin, AlertTriangle, CheckCircle, WifiOff, Search, Filter, RefreshCw, Signal, Wifi } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const tenantSiteData = {
  'aerotel': { totalSites: 847, operational: 812, degraded: 28, down: 7 },
  'netwave': { totalSites: 342, operational: 328, degraded: 11, down: 3 },
}

const sites = [
  { id: 'SITE-001', name: 'Lagos Island Tower', region: 'Lagos', type: '5G', status: 'operational', uptime: 99.98, subscribers: 12400, traffic: '2.4 TB/day', lastMaint: '15 days ago', power: 'Grid + Battery', alerts: 0, backhaul: 'Fiber 10Gbps' },
  { id: 'SITE-002', name: 'Abuja Central Hub', region: 'FCT', type: '4G/5G', status: 'operational', uptime: 99.95, subscribers: 8900, traffic: '1.8 TB/day', lastMaint: '22 days ago', power: 'Grid + Solar', alerts: 0, backhaul: 'Fiber 10Gbps' },
  { id: 'SITE-003', name: 'Kano Industrial', region: 'Kano', type: '4G', status: 'degraded', uptime: 98.2, subscribers: 6200, traffic: '0.9 TB/day', lastMaint: '45 days ago', power: 'Generator', alerts: 2, backhaul: 'Microwave 1Gbps' },
  { id: 'SITE-004', name: 'Port Harcourt South', region: 'Rivers', type: '4G', status: 'operational', uptime: 99.91, subscribers: 5400, traffic: '1.2 TB/day', lastMaint: '8 days ago', power: 'Grid + Battery', alerts: 0, backhaul: 'Fiber 5Gbps' },
  { id: 'SITE-005', name: 'Ibadan University', region: 'Oyo', type: '4G', status: 'down', uptime: 0, subscribers: 0, traffic: '0', lastMaint: '2 days ago', power: 'No Power', alerts: 5, backhaul: 'Offline' },
  { id: 'SITE-006', name: 'Enugu Tech Park', region: 'Enugu', type: '5G', status: 'operational', uptime: 99.88, subscribers: 3800, traffic: '0.8 TB/day', lastMaint: '12 days ago', power: 'Grid + Solar', alerts: 0, backhaul: 'Fiber 10Gbps' },
  { id: 'SITE-007', name: 'Benin Market Area', region: 'Edo', type: '4G', status: 'degraded', uptime: 97.5, subscribers: 4100, traffic: '0.6 TB/day', lastMaint: '38 days ago', power: 'Generator', alerts: 1, backhaul: 'Microwave 500Mbps' },
]

export default function TelcoCellSiteMap() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('telcocellsitemap', () => apiClient.dashboard.metrics(), { fallback: tenantSiteData })
  const { tenant } = useTenant()
  const tenantSlug = tenant?.slug || 'aerotel'
  const stats = tenantSiteData[tenantSlug] || tenantSiteData['aerotel']
  const [activeTab, setActiveTab] = useState('sites')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [expandedSite, setExpandedSite] = useState(null)

  const filtered = sites.filter(s => {
    const matchesSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.region.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter
    const matchesType = typeFilter === 'all' || s.type.includes(typeFilter)
    return matchesSearch && matchesStatus && matchesType
  })

  return (
    <div role="region" aria-label="CellSiteMap" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><MapPin className="w-7 h-7 text-blue-600" /> Cell Site Map</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Network tower monitoring for {tenant?.name || 'telco'}</p></div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[{ l: 'Total Sites', v: stats.totalSites }, { l: 'Operational', v: stats.operational, c: 'text-emerald-600' }, { l: 'Degraded', v: stats.degraded, c: 'text-amber-600' }, { l: 'Down', v: stats.down, c: 'text-red-600' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['sites', 'alerts', 'coverage'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'sites' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sites or regions..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="all">All Status</option><option value="operational">Operational</option><option value="degraded">Degraded</option><option value="down">Down</option>
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="all">All Types</option><option value="5G">5G</option><option value="4G">4G</option>
            </select>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="overflow-x-auto"><table className="min-w-full w-full"><thead className="bg-gray-50 dark:bg-gray-700"><tr>{['Site', 'Region', 'Type', 'Status', 'Uptime', 'Subscribers', 'Traffic', 'Alerts'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filtered.map(s => (
                <>
                  <tr key={s.id} onClick={() => setExpandedSite(expandedSite === s.id ? null : s.id)} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                    <td className="px-4 py-3"><div className="text-sm font-medium text-gray-900 dark:text-white">{s.name}</div><div className="text-xs text-gray-400">{s.id}</div></td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{s.region}</td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{s.type}</span></td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 w-fit ${s.status === 'operational' ? 'bg-emerald-100 text-emerald-700' : s.status === 'degraded' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{s.status === 'operational' ? <CheckCircle className="w-3 h-3" /> : s.status === 'degraded' ? <AlertTriangle className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}{s.status}</span></td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{s.uptime}%</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{s.subscribers.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{s.traffic}</td>
                    <td className="px-4 py-3">{s.alerts > 0 ? <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">{s.alerts}</span> : <span className="text-xs text-gray-400">—</span>}</td>
                  </tr>
                  {expandedSite === s.id && (
                    <tr key={`${s.id}-detail`}><td colSpan={8} className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                        <div><span className="text-gray-500">Power Source</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{s.power}</p></div>
                        <div><span className="text-gray-500">Backhaul</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{s.backhaul}</p></div>
                        <div><span className="text-gray-500">Last Maintenance</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{s.lastMaint}</p></div>
                        <div className="flex gap-2 items-start">
                          <button className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">Dispatch Team</button>
                          <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">View Logs</button>
                        </div>
                      </div>
                    </td></tr>
                  )}
                </>
              ))}
            </tbody></table></div>
          </div>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="space-y-2">
          {sites.filter(s => s.alerts > 0 || s.status !== 'operational').map(s => (
            <div key={s.id} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 ${s.status === 'down' ? 'border-red-300 dark:border-red-900/50' : 'border-amber-300 dark:border-amber-900/50'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${s.status === 'down' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>{s.status === 'down' ? <WifiOff className="w-5 h-5 text-red-600" /> : <AlertTriangle className="w-5 h-5 text-amber-600" />}</div>
                  <div><h4 className="font-semibold text-gray-900 dark:text-white">{s.name} — {s.region}</h4><p className="text-xs text-gray-500">Status: {s.status} | {s.alerts} active alert(s) | Power: {s.power}</p></div>
                </div>
                <button className={`px-3 py-1.5 text-white rounded text-xs ${s.status === 'down' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}>Escalate</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'coverage' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Coverage by Region</h3>
          <div className="space-y-3">
            {[...new Set(sites.map(s => s.region))].map(region => {
              const regionSites = sites.filter(s => s.region === region)
              const operational = regionSites.filter(s => s.status === 'operational').length
              return (
                <div key={region} className="flex items-center gap-3">
                  <span className="w-24 text-sm text-gray-600 dark:text-gray-400">{region}</span>
                  <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full flex items-center pl-2 text-xs text-white font-medium" style={{ width: `${(operational / regionSites.length) * 100}%` }}>{operational}/{regionSites.length} sites</div>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{regionSites.reduce((s, site) => s + site.subscribers, 0).toLocaleString()} subs</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
