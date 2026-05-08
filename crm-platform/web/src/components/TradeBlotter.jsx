import { BarChart3 } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'

export default function TradeBlotter() {
  const { tenant } = useTenant()
  const data = [('TRD-4821', 'Buy', 'Brent Crude', '50,000 bbl', '$82.40', '$4.12M', 'filled', 'Shell Trading'), ('TRD-4822', 'Sell', 'WTI Crude', '20,000 bbl', '$78.60', '$1.57M', 'filled', 'Vitol'), ('TRD-4823', 'Buy', 'Natural Gas', '200,000 MMBtu', '$2.84', '$568K', 'partial', 'Glencore'), ('TRD-4824', 'Buy', 'Gold', '100 oz', '$2,340', '$234K', 'pending', 'Direct'), ('TRD-4825', 'Sell', 'Cocoa', '50 MT', '$8,420', '$421K', 'cancelled', 'Trafigura')]
  return (
    <div role="region" aria-label="TradeBlotter" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><BarChart3 className="w-7 h-7 text-indigo-600" /> Trade Blotter</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Real-time trade capture and management</p></div>
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
