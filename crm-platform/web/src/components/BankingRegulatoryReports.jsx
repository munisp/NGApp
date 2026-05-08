import { FileText, Download, Send } from 'lucide-react'
import { FallbackBadge } from '@/components/ui/DataStates'

const reports = [
  { id: 'REG-001', name: 'CBN Prudential Returns', regulator: 'CBN', frequency: 'Monthly', dueDate: '2026-06-10', status: 'submitted', lastSubmitted: '2026-05-08', compliance: 100 },
  { id: 'REG-002', name: 'NDIC Returns', regulator: 'NDIC', frequency: 'Quarterly', dueDate: '2026-06-30', status: 'in_progress', lastSubmitted: '2026-03-28', compliance: 72 },
  { id: 'REG-003', name: 'AML/CFT Report', regulator: 'NFIU', frequency: 'Monthly', dueDate: '2026-06-05', status: 'overdue', lastSubmitted: '2026-04-03', compliance: 0 },
  { id: 'REG-004', name: 'NDPR Data Protection', regulator: 'NITDA', frequency: 'Annually', dueDate: '2026-12-31', status: 'not_started', lastSubmitted: '2025-12-18', compliance: 0 },
  { id: 'REG-005', name: 'Capital Adequacy (CAR)', regulator: 'CBN', frequency: 'Quarterly', dueDate: '2026-06-30', status: 'in_progress', lastSubmitted: '2026-03-29', compliance: 45 },
  { id: 'REG-006', name: 'Suspicious Transaction Report', regulator: 'NFIU', frequency: 'As needed', dueDate: 'N/A', status: 'submitted', lastSubmitted: '2026-05-02', compliance: 100 },
]

export default function BankingRegulatoryReports() {
  return (
    <div role="region" aria-label="RegulatoryReports" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><FileText className="w-7 h-7 text-red-600" /> Regulatory Reports</h1><p className="text-gray-500 dark:text-gray-400 mt-1">CBN, NDIC, NFIU, and NITDA compliance reporting</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Total Reports', v: reports.length }, { l: 'Submitted', v: reports.filter(r => r.status === 'submitted').length }, { l: 'Overdue', v: reports.filter(r => r.status === 'overdue').length }, { l: 'Compliance', v: Math.round(reports.filter(r => r.status === 'submitted').length / reports.length * 100) + '%' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="space-y-2">
        {reports.map(r => (
          <div key={r.id} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 ${r.status === 'overdue' ? 'border-red-300 dark:border-red-800' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900 dark:text-white">{r.name}</h4><span className={`text-xs px-2 py-0.5 rounded ${r.status === 'submitted' ? 'bg-emerald-100 text-emerald-700' : r.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : r.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{r.status.replace('_', ' ')}</span></div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1"><span>Regulator: {r.regulator}</span><span>{r.frequency}</span><span>Due: {r.dueDate}</span><span>Last: {r.lastSubmitted}</span></div>
                {r.status === 'in_progress' && <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full w-48"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${r.compliance}%` }} /></div>}
              </div>
              <div className="flex gap-2">
                {r.status === 'submitted' && <button className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1"><Download className="w-3 h-3" /> Download</button>}
                {(r.status === 'in_progress' || r.status === 'overdue') && <button className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 flex items-center gap-1"><Send className="w-3 h-3" /> Complete</button>}
                {r.status === 'not_started' && <button className="px-3 py-1.5 bg-gray-600 text-white rounded text-xs hover:bg-gray-700">Start</button>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
