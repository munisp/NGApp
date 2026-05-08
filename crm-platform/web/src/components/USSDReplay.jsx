import { Terminal } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'

export default function USSDReplay() {
  const { tenant } = useTenant()
  const data = [('USSD-001', '*123#', 'Balance Check', 'completed', '0.8s', '09012345678', '2 min ago'), ('USSD-002', '*131*1#', 'Data Bundle', 'completed', '2.4s', '08098765432', '5 min ago'), ('USSD-003', '*556#', 'Transfer', 'failed', '4.2s', '07011223344', '12 min ago'), ('USSD-004', '*123*1#', 'Recharge', 'completed', '1.2s', '09055667788', '15 min ago'), ('USSD-005', '*131*2#', 'Roaming Pack', 'timeout', '30.0s', '08033445566', '22 min ago')]
  return (
    <div role="region" aria-label="USSDReplay" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Terminal className="w-7 h-7 text-gray-600" /> USSD Session Replay</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Replay and analyze USSD session flows</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Total Records', v: data.length }, { l: 'Active', v: data.filter(d => d[5] === 'Active' || d[5] === 'completed' || d[5] === 'submitted').length }, { l: 'Pending', v: data.filter(d => d[5] === 'pending' || d[5] === 'in_progress' || d[5] === 'open').length }, { l: 'Platform', v: tenant?.name || 'Telco' }].map(s => (
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
            <button className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">View</button>
          </div>
        ))}
      </div>
    </div>
  )
}
