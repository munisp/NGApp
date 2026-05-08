import { Code } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'

const rows = [
    { id: 'EP-001', cells: ['/v3/messages/send', 'POST', 'Send SMS/WhatsApp message', '42ms', '100/s', 'API Key', 'Active'] },
    { id: 'EP-002', cells: ['/v3/voice/call', 'POST', 'Initiate outbound voice call', '68ms', '50/s', 'API Key', 'Active'] },
    { id: 'EP-003', cells: ['/v3/verify/start', 'POST', 'Start 2FA verification', '35ms', '200/s', 'API Key', 'Active'] },
    { id: 'EP-004', cells: ['/v3/conversations', 'GET', 'List conversation threads', '28ms', '500/s', 'Bearer', 'Active'] },
    { id: 'EP-005', cells: ['/v3/webhooks', 'GET', 'List webhook subscriptions', '22ms', '100/s', 'Bearer', 'Beta'] },
]

const headers = ['Endpoint', 'Method', 'Description', 'Latency', 'Rate Limit', 'Auth', 'Status']

function statusColor(s) {
  switch (s) {
      case 'Active': return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20'
      case 'Beta': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      default: return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20'
  }
}

export default function APIExplorer() {
  const { tenant } = useTenant()
  return (
    <div role="region" aria-label="APIExplorer" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Code className="w-7 h-7 text-blue-600" /> API Explorer
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Interactive API testing and documentation for {tenant?.name || 'Platform'}</p>
        </div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Endpoints', v: '142' }, { l: 'Avg Latency', v: '48ms' }, { l: 'Uptime', v: '99.97%' }, { l: 'API Version', v: 'v3.2' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs text-gray-500">{s.l}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p>
          </div>
        ))}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>{headers.map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                {r.cells.map((c, j) => (
                  <td key={j} className={`px-4 py-3 text-sm ${j === 0 ? 'font-semibold text-gray-900 dark:text-white' : j === 6 ? statusColor(c) + ' font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                    {j === 6 ? <span className={`px-2 py-0.5 rounded-full text-xs ${statusColor(c)}`}>{c}</span> : c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
