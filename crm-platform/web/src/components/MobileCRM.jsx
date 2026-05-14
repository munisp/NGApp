import { useState } from 'react'
import { Smartphone, Wifi, WifiOff, MapPin, Mic, Zap, Download, Camera, Search, BarChart3 } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const features = [
  { id: 'MOB-001', name: 'Offline Mode', status: 'active', icon: WifiOff, color: 'text-emerald-500', metric: '3 pending syncs', desc: 'Work without internet — auto-syncs when reconnected', detail: 'Last synced 2 min ago. 3 records pending upload (2 visit logs, 1 deal update).', usage: 85, users: 120 },
  { id: 'MOB-002', name: 'Location Check-in', status: 'active', icon: MapPin, color: 'text-blue-500', metric: '48 check-ins today', desc: 'GPS-verified client visit logging with photo capture', detail: '48 field visits logged today across 12 reps. Average 4 visits per rep.', usage: 92, users: 142 },
  { id: 'MOB-003', name: 'Voice Notes', status: 'active', icon: Mic, color: 'text-purple-500', metric: '24 recordings', desc: 'Record meeting notes and auto-transcribe with AI', detail: '24 voice notes this week. Avg transcription accuracy: 94%. Longest: 12 min.', usage: 68, users: 89 },
  { id: 'MOB-004', name: 'Quick Actions', status: 'active', icon: Zap, color: 'text-amber-500', metric: '312 actions/day', desc: 'One-tap deal updates, task creation, and follow-ups', detail: 'Most used: Update deal stage (42%), Create task (28%), Log call (18%), Add note (12%).', usage: 96, users: 138 },
  { id: 'MOB-005', name: 'Offline Reports', status: 'beta', icon: Download, color: 'text-gray-500', metric: '18 downloads', desc: 'Download reports for offline viewing in the field', detail: 'Beta feature. 18 report downloads this month. Supported: PDF, Excel.', usage: 22, users: 28 },
  { id: 'MOB-006', name: 'Camera Scan', status: 'active', icon: Camera, color: 'text-rose-500', metric: '89 scans', desc: 'Scan business cards and documents to auto-populate records', detail: '89 business card scans. 92% accuracy on contact extraction. Supports 8 languages.', usage: 74, users: 95 },
]

export default function MobileCRM() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('mobilecrm', () => apiClient.dashboard.metrics(), { fallback: features })
  const { tenant } = useTenant()
  const [expanded, setExpanded] = useState(null)
  const [activeTab, setActiveTab] = useState('features')
  const [search, setSearch] = useState('')

  const filtered = features.filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div role="region" aria-label="MobileCRM" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Smartphone className="w-7 h-7 text-sky-600" /> Mobile CRM</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Mobile experience for {tenant?.name || 'Platform'} field teams</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[{ l: 'Active Users', v: '142' }, { l: 'Synced Devices', v: '186' }, { l: 'Offline Records', v: '3' }, { l: 'Daily Actions', v: '312' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['features', 'analytics', 'settings'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
        ))}
      </div>
      {activeTab === 'features' && (<div className="space-y-4">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search features..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
        <div className="space-y-2">{filtered.map(f => (
          <div key={f.id} onClick={() => setExpanded(expanded === f.id ? null : f.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md ${expanded === f.id ? 'border-sky-500 ring-1 ring-sky-500' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3"><f.icon className={`w-5 h-5 ${f.color}`} /><div><div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900 dark:text-white">{f.name}</h4>{f.status === 'beta' && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">beta</span>}</div><p className="text-sm text-gray-500">{f.desc}</p></div></div>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{f.metric}</span>
            </div>
            {expanded === f.id && (<div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{f.detail}</p>
              <div className="flex items-center gap-4 text-xs"><span className="text-gray-500">Adoption: {f.usage}%</span><span className="text-gray-500">{f.users} users</span></div>
              <div className="flex gap-2 mt-2"><button className="px-3 py-1.5 bg-sky-600 text-white rounded text-xs hover:bg-sky-700">Configure</button><button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">View Logs</button></div>
            </div>)}
          </div>
        ))}</div>
      </div>)}
      {activeTab === 'analytics' && (<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Feature Adoption</h3>
        {features.map(f => (<div key={f.id} className="flex items-center gap-3"><span className="w-32 text-sm text-gray-600 dark:text-gray-400">{f.name}</span><div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className={`h-full rounded-full bg-sky-500`} style={{ width: `${f.usage}%` }} /></div><span className="w-12 text-right text-sm font-medium text-gray-900 dark:text-white">{f.usage}%</span></div>))}
      </div>)}
      {activeTab === 'settings' && (<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Mobile Settings</h3>
        {[{ label: 'Enable offline mode', checked: true }, { label: 'Auto-sync on WiFi only', checked: false }, { label: 'Location tracking for check-ins', checked: true }, { label: 'Push notifications', checked: true }, { label: 'Biometric authentication', checked: true }].map(s => (
          <label key={s.label} className="flex items-center gap-3 cursor-pointer"><input type="checkbox" defaultChecked={s.checked} className="w-4 h-4 rounded border-gray-300 text-sky-600" /><span className="text-sm text-gray-700 dark:text-gray-300">{s.label}</span></label>
        ))}
      </div>)}
    </div>
  )
}
