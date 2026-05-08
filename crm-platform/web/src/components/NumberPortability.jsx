import { ArrowLeftRight } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'

export default function NumberPortability() {
  const { tenant } = useTenant()
  const data = [('MNP-001', '09012345678', 'Port-In', 'MTN → AeroTel', 'pending', '2 hours ago'), ('MNP-002', '08098765432', 'Port-In', 'Glo → AeroTel', 'completed', '1 day ago'), ('MNP-003', '07011223344', 'Port-Out', 'AeroTel → 9Mobile', 'rejected', '3 days ago'), ('MNP-004', '09055667788', 'Port-In', 'Airtel → AeroTel', 'in_progress', '4 hours ago'), ('MNP-005', '08033445566', 'Port-Out', 'AeroTel → MTN', 'completed', '1 week ago')]
  return (
    <div role="region" aria-label="NumberPortability" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><ArrowLeftRight className="w-7 h-7 text-purple-600" /> Number Portability</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Mobile Number Portability (MNP) request management</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Total Records', v: data.length }, { l: 'Active', v: data.filter(d => d[3] === 'Active' || d[3] === 'completed' || d[3] === 'submitted').length }, { l: 'Pending', v: data.filter(d => d[3] === 'pending' || d[3] === 'in_progress' || d[3] === 'open').length }, { l: 'Platform', v: tenant?.name || 'Telco' }].map(s => (
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
