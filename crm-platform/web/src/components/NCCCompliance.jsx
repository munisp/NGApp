import { Shield } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'

export default function NCCCompliance() {
  const { tenant } = useTenant()
  const data = [('NCC-001', 'QoS Quarterly Report', 'NCC', 'Quarterly', '2026-06-30', 'submitted', '100%'), ('NCC-002', 'Spectrum Utilization', 'NCC', 'Monthly', '2026-06-10', 'in_progress', '65%'), ('NCC-003', 'Type Approval Report', 'NCC', 'As needed', 'N/A', 'submitted', '100%'), ('NCC-004', 'Consumer Complaint Log', 'NCC', 'Monthly', '2026-06-05', 'overdue', '0%'), ('NCC-005', 'SIM Registration Audit', 'NCC/NIMC', 'Quarterly', '2026-06-30', 'not_started', '0%')]
  return (
    <div role="region" aria-label="NCCCompliance" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Shield className="w-7 h-7 text-red-600" /> NCC Compliance</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Nigerian Communications Commission regulatory compliance</p></div>
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
