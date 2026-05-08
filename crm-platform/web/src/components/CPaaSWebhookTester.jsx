import { Webhook } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'

const rows = [
    { id: 'EVT-842712', cells: ['EVT-842712', 'message.delivered', 'https://api.acme.com/webhooks', '200 OK', 'Acknowledged', '142ms', '0', '12:34:22'] },
    { id: 'EVT-842713', cells: ['EVT-842713', 'message.failed', 'https://api.acme.com/webhooks', '200 OK', 'Acknowledged', '189ms', '0', '12:34:18'] },
    { id: 'EVT-842714', cells: ['EVT-842714', 'call.completed', 'https://hooks.dangote.com/cpaas', '500 Error', 'Retrying', 'timeout', '2', '12:34:15'] },
    { id: 'EVT-842715', cells: ['EVT-842715', 'verify.success', 'https://api.shoprite.ng/hook', '200 OK', 'Acknowledged', '98ms', '0', '12:34:12'] },
    { id: 'EVT-842716', cells: ['EVT-842716', 'number.ported', 'https://api.acme.com/webhooks', '404', 'Failed', '45ms', '3', '12:33:45'] },
]

const headers = ['Event ID', 'Type', 'Endpoint', 'Status', 'Response', 'Latency', 'Retries', 'Timestamp']

function statusColor(s) {
  switch (s) {
      case '200 OK': return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20'
      case '500 Error': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      case '404': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      default: return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20'
  }
}

export default function CPaaSWebhookTester() {
  const { tenant } = useTenant()
  return (
    <div role="region" aria-label="CPaaSWebhookTester" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Webhook className="w-7 h-7 text-orange-600" /> Webhook Tester
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Test and debug webhook event delivery for {tenant?.name || 'Platform'}</p>
        </div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Endpoints', v: '24' }, { l: 'Events Today', v: '142K' }, { l: 'Success Rate', v: '99.4%' }, { l: 'Avg Latency', v: '234ms' }].map(s => (
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
                  <td key={j} className={`px-4 py-3 text-sm ${j === 0 ? 'font-semibold text-gray-900 dark:text-white' : j === 3 ? statusColor(c) + ' font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                    {j === 3 ? <span className={`px-2 py-0.5 rounded-full text-xs ${statusColor(c)}`}>{c}</span> : c}
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
