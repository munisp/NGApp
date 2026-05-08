import { DollarSign } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'

export default function RevenueAssurance() {
  const { tenant } = useTenant()
  const data = [('RA-001', 'Unbilled data sessions', '₦42.8M', '1,842 sessions', 'CDR mismatch', 95, 'open'), ('RA-002', 'Roaming charge errors', '₦8.4M', '342 events', 'Rate table outdated', 88, 'investigating'), ('RA-003', 'SMS delivery unreconciled', '₦2.1M', '12,400 msgs', 'Gateway timeout', 72, 'resolved'), ('RA-004', 'VAS billing failure', '₦15.6M', '4,200 subs', 'Partner API down', 91, 'open'), ('RA-005', 'Interconnect undercharge', '₦28.2M', '8,900 mins', 'Rate mismatch', 96, 'escalated')]
  return (
    <div role="region" aria-label="RevenueAssurance" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><DollarSign className="w-7 h-7 text-emerald-600" /> Revenue Assurance</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Detect revenue leakage and billing anomalies</p></div>
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
