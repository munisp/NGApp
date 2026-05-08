import { Search } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'

export default function CPaaSMessageInspector() {
  const { tenant } = useTenant()
  const data = [('MSG-001', 'SMS', '09012345678', 'delivered', '142ms', 'PayStack', '2 min ago'), ('MSG-002', 'WhatsApp', '08098765432', 'read', '890ms', 'Flutterwave', '5 min ago'), ('MSG-003', 'SMS', '07011223344', 'failed', 'timeout', 'Mono', '8 min ago'), ('MSG-004', 'Voice', '09055667788', 'connected', '1.2s', 'Stitch', '12 min ago'), ('MSG-005', 'SMS', '08033445566', 'queued', 'pending', 'Okra', '15 min ago')]
  return (
    <div role="region" aria-label="MessageInspector" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Search className="w-7 h-7 text-purple-600" /> Message Inspector</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Real-time message flow debugging and inspection</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Total', v: data.length }, { l: 'Active', v: data.length }, { l: 'Updated', v: 'Real-time' }, { l: 'Platform', v: tenant?.name || 'CPaaS' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
        {data.map((row, i) => (
          <div key={i} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <div>
              <div className="flex items-center gap-2"><span className="text-xs text-gray-400 font-mono">{row[0]}</span><h4 className="text-sm font-semibold text-gray-900 dark:text-white">{row[1]}</h4></div>
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">{row.slice(2).map((cell, j) => <span key={j}>{String(cell)}</span>)}</div>
            </div>
            <button className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Details</button>
          </div>
        ))}
      </div>
    </div>
  )
}
