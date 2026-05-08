import { Shield } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'

export default function CounterpartyRisk() {
  const { tenant } = useTenant()
  const data = [('CP-001', 'Shell Trading', 'AA+', '$2.4B', '0.02%', '$480K', 'Low'), ('CP-002', 'Vitol Group', 'A', '$1.8B', '0.08%', '$1.44M', 'Medium'), ('CP-003', 'Glencore', 'A-', '$3.2B', '0.12%', '$3.84M', 'Medium'), ('CP-004', 'Trafigura', 'BBB+', '$890M', '0.25%', '$2.23M', 'High'), ('CP-005', 'Local Trader X', 'BB', '$120M', '1.80%', '$2.16M', 'Critical')]
  return (
    <div role="region" aria-label="CounterpartyRisk" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Shield className="w-7 h-7 text-orange-600" /> Counterparty Credit Risk</h1><p className="text-gray-500 dark:text-gray-400 mt-1">MCMC-powered counterparty risk assessment</p></div>
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
