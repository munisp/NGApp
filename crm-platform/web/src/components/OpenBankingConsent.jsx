import { Shield } from 'lucide-react'
import { FallbackBadge } from '@/components/ui/DataStates'

const consents = [
  { id: 'CON-001', customer: 'Dangote Industries', tpp: 'PayStack', scope: ['Account Balance', 'Transactions'], status: 'active', granted: '2026-01-15', expires: '2026-07-15', accessCount: 1842 },
  { id: 'CON-002', customer: 'MTN Nigeria', tpp: 'Flutterwave', scope: ['Account Balance', 'Transactions', 'Standing Orders'], status: 'active', granted: '2026-02-01', expires: '2026-08-01', accessCount: 942 },
  { id: 'CON-003', customer: 'Kano Textiles', tpp: 'Mono', scope: ['Account Balance'], status: 'revoked', granted: '2025-11-20', expires: '2026-05-20', accessCount: 124 },
  { id: 'CON-004', customer: 'Shoprite Nigeria', tpp: 'Stitch', scope: ['Account Balance', 'Payments'], status: 'active', granted: '2026-03-10', expires: '2026-09-10', accessCount: 568 },
  { id: 'CON-005', customer: 'Total Energies', tpp: 'Okra', scope: ['Account Balance', 'Transactions', 'Identity'], status: 'expired', granted: '2025-08-01', expires: '2026-02-01', accessCount: 2400 },
]

export default function OpenBankingConsent() {
  return (
    <div role="region" aria-label="OpenBankingConsent" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Shield className="w-7 h-7 text-indigo-600" /> Open Banking Consent Manager</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Manage third-party provider access consents</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Total Consents', v: consents.length }, { l: 'Active', v: consents.filter(c => c.status === 'active').length }, { l: 'TPPs Connected', v: [...new Set(consents.map(c => c.tpp))].length }, { l: 'API Calls (30d)', v: consents.reduce((s, c) => s + c.accessCount, 0).toLocaleString() }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="space-y-2">
        {consents.map(c => (
          <div key={c.id} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 ${c.status === 'active' ? 'border-gray-200 dark:border-gray-700' : 'border-gray-200 dark:border-gray-700 opacity-60'}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900 dark:text-white">{c.customer}</h4><span className="text-xs text-gray-400">via</span><span className="text-sm font-medium text-indigo-600">{c.tpp}</span><span className={`text-xs px-2 py-0.5 rounded ${c.status === 'active' ? 'bg-emerald-100 text-emerald-700' : c.status === 'revoked' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{c.status}</span></div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1"><span>Granted: {c.granted}</span><span>Expires: {c.expires}</span><span>{c.accessCount.toLocaleString()} API calls</span></div>
                <div className="flex gap-1 mt-1.5">{c.scope.map(s => <span key={s} className="text-xs px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400">{s}</span>)}</div>
              </div>
              {c.status === 'active' && <button className="px-3 py-1.5 border border-red-200 text-red-600 rounded text-xs hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20">Revoke</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
