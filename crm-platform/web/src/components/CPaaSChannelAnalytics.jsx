import { BarChart3 } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'

export default function CPaaSChannelAnalytics() {
  const { tenant } = useTenant()
  const data = [('SMS', '48.2M sent', '47.8M delivered', '99.2%', '2.1s avg', '$0.004/msg'), ('WhatsApp', '12.4M sent', '12.3M delivered', '99.1%', '1.8s avg', '$0.008/msg'), ('Voice', '2.1M calls', '1.9M connected', '90.5%', '12.4s avg', '$0.02/min'), ('Email', '8.9M sent', '8.4M delivered', '94.4%', '4.2s avg', '$0.001/msg'), ('Push', '24.8M sent', '22.1M delivered', '89.1%', '0.8s avg', '$0.0005/msg')]
  return (
    <div role="region" aria-label="ChannelAnalytics" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><BarChart3 className="w-7 h-7 text-indigo-600" /> Channel Analytics</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Cross-channel messaging performance analytics</p></div>
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
