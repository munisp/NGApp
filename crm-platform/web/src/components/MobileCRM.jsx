import { useState } from 'react'
import { Smartphone, Wifi, WifiOff, MapPin, Mic, Zap, Download, CheckCircle, Clock, RefreshCw, Camera, Navigation } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const features = [
  { name: 'Offline Mode', status: 'active', icon: WifiOff, color: 'text-emerald-500', metric: '3 pending syncs', desc: 'Work without internet — auto-syncs when reconnected', detail: 'Last synced 2 min ago. 3 records pending upload (2 visit logs, 1 deal update).' },
  { name: 'Location Check-in', status: 'active', icon: MapPin, color: 'text-blue-500', metric: '48 check-ins today', desc: 'GPS-verified client visit logging with photo capture', detail: '48 field visits logged today across 12 reps. Average 4 visits per rep.' },
  { name: 'Voice Notes', status: 'active', icon: Mic, color: 'text-purple-500', metric: '24 recordings', desc: 'Record meeting notes and auto-transcribe with AI', detail: '24 voice notes this week. Avg transcription accuracy: 94%. Longest: 12 min.' },
  { name: 'Quick Actions', status: 'active', icon: Zap, color: 'text-amber-500', metric: '312 actions/day', desc: 'One-tap deal updates, task creation, and follow-ups', detail: 'Most used: Update deal stage (42%), Create task (28%), Log call (18%), Add note (12%).' },
  { name: 'Offline Reports', status: 'beta', icon: Download, color: 'text-gray-500', metric: '18 downloads', desc: 'Download reports for offline viewing in the field', detail: 'Beta feature. 18 report downloads this month. Supported: PDF, Excel.' },
  { name: 'Camera Scan', status: 'active', icon: Camera, color: 'text-rose-500', metric: '89 scans', desc: 'Scan business cards and documents to auto-populate records', detail: '89 business card scans. 92% accuracy on contact extraction. Supports 8 languages.' },
]

export default function MobileCRM() {
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(null)

  return (
    <div role="region" aria-label="MobileCRM" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Smartphone className="w-7 h-7 text-sky-600" /> Mobile CRM</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Mobile experience for field sales and service teams</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Active Users', v: '142' }, { l: 'Synced Devices', v: '186' }, { l: 'Offline Records', v: '3' }, { l: 'Daily Actions', v: '312' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="space-y-2">
        {features.map(f => (
          <div key={f.name} onClick={() => setExpanded(expanded === f.name ? null : f.name)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md ${expanded === f.name ? 'border-sky-500 ring-1 ring-sky-500' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3"><f.icon className={`w-5 h-5 ${f.color}`} /><div><div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900 dark:text-white">{f.name}</h4>{f.status === 'beta' && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">beta</span>}</div><p className="text-sm text-gray-500">{f.desc}</p></div></div>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{f.metric}</span>
            </div>
            {expanded === f.name && <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700"><p className="text-sm text-gray-600 dark:text-gray-400">{f.detail}</p></div>}
          </div>
        ))}
      </div>
    </div>
  )
}
