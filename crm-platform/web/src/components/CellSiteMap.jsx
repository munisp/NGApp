import { MapPin, AlertTriangle, CheckCircle, WifiOff } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const tenantSiteData = {
  'aerotel': { totalSites: 847, operational: 812, degraded: 28, down: 7 },
  'netwave': { totalSites: 342, operational: 328, degraded: 11, down: 3 },
}

const sites = [
  { id: 'SITE-001', name: 'Lagos Island Tower', region: 'Lagos', type: '5G', status: 'operational', uptime: 99.98, subscribers: 12400, traffic: '2.4 TB/day', lastMaint: '15 days ago' },
  { id: 'SITE-002', name: 'Abuja Central Hub', region: 'FCT', type: '4G/5G', status: 'operational', uptime: 99.95, subscribers: 8900, traffic: '1.8 TB/day', lastMaint: '22 days ago' },
  { id: 'SITE-003', name: 'Kano Industrial', region: 'Kano', type: '4G', status: 'degraded', uptime: 98.2, subscribers: 6200, traffic: '0.9 TB/day', lastMaint: '45 days ago' },
  { id: 'SITE-004', name: 'Port Harcourt South', region: 'Rivers', type: '4G', status: 'operational', uptime: 99.91, subscribers: 5400, traffic: '1.2 TB/day', lastMaint: '8 days ago' },
  { id: 'SITE-005', name: 'Ibadan University', region: 'Oyo', type: '4G', status: 'down', uptime: 0, subscribers: 0, traffic: '0', lastMaint: '2 days ago' },
]

export default function CellSiteMap() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('cellsitemap', () => apiClient.dashboard.metrics(), { fallback: tenantSiteData })
  const { tenant } = useTenant()
  const tenantSlug = tenant?.slug || 'aerotel'
  const stats = tenantSiteData[tenantSlug] || tenantSiteData['aerotel']
  return (
    <div role="region" aria-label="CellSiteMap" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><MapPin className="w-7 h-7 text-blue-600" /> Cell Site Map</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Network tower monitoring for {tenant?.name || 'telco'}</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Total Sites', v: stats.totalSites }, { l: 'Operational', v: stats.operational, c: 'text-emerald-600' }, { l: 'Degraded', v: stats.degraded, c: 'text-amber-600' }, { l: 'Down', v: stats.down, c: 'text-red-600' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full"><thead className="bg-gray-50 dark:bg-gray-700"><tr>{['Site', 'Region', 'Type', 'Status', 'Uptime', 'Subscribers', 'Traffic', 'Last Maint'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {sites.map(s => (
            <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3"><div className="text-sm font-medium text-gray-900 dark:text-white">{s.name}</div><div className="text-xs text-gray-400">{s.id}</div></td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{s.region}</td>
              <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{s.type}</span></td>
              <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 w-fit ${s.status === 'operational' ? 'bg-emerald-100 text-emerald-700' : s.status === 'degraded' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{s.status === 'operational' ? <CheckCircle className="w-3 h-3" /> : s.status === 'degraded' ? <AlertTriangle className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}{s.status}</span></td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{s.uptime}%</td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{s.subscribers.toLocaleString()}</td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{s.traffic}</td>
              <td className="px-4 py-3 text-xs text-gray-400">{s.lastMaint}</td>
            </tr>
          ))}
        </tbody></table>
      </div>
    </div>
  )
}
