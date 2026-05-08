import { Code } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'

export default function CPaaSAPIExplorer() {
  const { tenant } = useTenant()
  const data = [('POST', '/v2/messages/send', 'Send SMS', '200 OK', '142ms', 'Most popular'), ('GET', '/v2/messages/{id}', 'Get message status', '200 OK', '45ms', 'High usage'), ('POST', '/v2/voice/calls', 'Initiate call', '201 Created', '890ms', 'Medium usage'), ('GET', '/v2/account/balance', 'Check balance', '200 OK', '28ms', 'Monitoring'), ('POST', '/v2/verify/start', 'Start 2FA', '200 OK', '234ms', 'Auth flow')]
  return (
    <div role="region" aria-label="APIExplorer" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Code className="w-7 h-7 text-blue-600" /> Interactive API Explorer</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Try API endpoints with live request/response</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Total', v: data.length }, { l: 'Active', v: data.length }, { l: 'Updated', v: 'Real-time' }, { l: 'Platform', v: tenant?.name || 'CPaaS' }].map(s => (
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
            <button className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Details</button>
          </div>
        ))}
      </div>
    </div>
  )
}
