import { FileText } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'

export default function CFTCReporting() {
  const { tenant } = useTenant()
  const data = [('RPT-001', 'CFTC Large Trader', 'CFTC', 'Weekly', '2026-05-09', 'submitted', '100%'), ('RPT-002', 'EMIR Trade Report', 'ESMA', 'T+1', '2026-05-04', 'submitted', '100%'), ('RPT-003', 'Position Limits', 'CFTC', 'Daily', '2026-05-04', 'overdue', '0%'), ('RPT-004', 'Dodd-Frank Swap', 'CFTC', 'Real-time', 'Continuous', 'active', '99.8%'), ('RPT-005', 'MiFID II Best Execution', 'ESMA', 'Quarterly', '2026-06-30', 'in_progress', '45%')]
  return (
    <div role="region" aria-label="CFTCReporting" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><FileText className="w-7 h-7 text-red-600" /> CFTC/EMIR Reporting</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Commodity Futures Trading Commission and EMIR trade reporting</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Total Records', v: data.length }, { l: 'Active', v: data.length }, { l: 'Updated', v: 'Just now' }, { l: 'Platform', v: tenant?.name || 'Platform' }].map(s => (
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
