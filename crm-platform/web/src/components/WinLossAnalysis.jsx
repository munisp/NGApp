import { useState } from 'react'
import { Target, TrendingUp, TrendingDown, BarChart3, Users, Clock, CheckCircle, XCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const deals = [
  { deal: 'Dangote Trade Finance', outcome: 'won', value: '\u20A62.5B', cycle: '38 days', competitors: ['GTBank', 'Zenith'], factors: [{ f: 'CEO relationship', impact: '+' }, { f: 'Competitive pricing', impact: '+' }, { f: 'Fast POC delivery', impact: '+' }] },
  { deal: 'NNPC Infrastructure', outcome: 'lost', value: '\u20A61.8B', cycle: '92 days', competitors: ['First Bank'], factors: [{ f: 'Price too high', impact: '-' }, { f: 'Slow response time', impact: '-' }, { f: 'Missing compliance cert', impact: '-' }] },
  { deal: 'Lafarge Cement', outcome: 'won', value: '\u20A6450M', cycle: '28 days', competitors: ['Access Bank'], factors: [{ f: 'Industry expertise', impact: '+' }, { f: 'Referral from Dangote', impact: '+' }, { f: 'Flexible terms', impact: '+' }] },
  { deal: 'Coca-Cola Nigeria', outcome: 'lost', value: '\u20A6890M', cycle: '120 days', competitors: ['Stanbic', 'UBA'], factors: [{ f: 'No executive sponsor', impact: '-' }, { f: 'Feature gap in FX', impact: '-' }, { f: 'Bundled competitor pricing', impact: '-' }] },
  { deal: 'MTN Payroll', outcome: 'won', value: '\u20A6890M', cycle: '42 days', competitors: ['Zenith'], factors: [{ f: 'CFO champion', impact: '+' }, { f: 'POC success', impact: '+' }] },
]

export default function WinLossAnalysis() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('winlossanalysis', () => apiClient.dashboard.metrics(), { fallback: deals })
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all' ? deals : deals.filter(d => d.outcome === filter)
  const wins = deals.filter(d => d.outcome === 'won')
  const losses = deals.filter(d => d.outcome === 'lost')

  return (
    <div role="region" aria-label="WinLossAnalysis" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Target className="w-7 h-7 text-rose-600" /> Win/Loss Analysis</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Analyze deal outcomes to improve win rates</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-5 gap-3">
        {[{ l: 'Total Deals', v: deals.length }, { l: 'Won', v: wins.length }, { l: 'Lost', v: losses.length }, { l: 'Win Rate', v: Math.round(wins.length / deals.length * 100) + '%' }, { l: 'Avg Cycle', v: Math.round(deals.reduce((s, d) => s + parseInt(d.cycle), 0) / deals.length) + 'd' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="flex gap-1">
        {['all', 'won', 'lost'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${filter === f ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{f}</button>
        ))}
      </div>
      <div className="space-y-2">
        {filtered.map(d => (
          <div key={d.deal} className={`bg-white dark:bg-gray-800 rounded-xl border-l-4 ${d.outcome === 'won' ? 'border-l-emerald-500' : 'border-l-red-500'} border border-gray-200 dark:border-gray-700 p-4`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900 dark:text-white">{d.deal}</h4><span className={`text-xs px-2 py-0.5 rounded ${d.outcome === 'won' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{d.outcome}</span></div>
              <div className="flex items-center gap-3 text-sm"><span className="font-medium text-gray-900 dark:text-white">{d.value}</span><span className="text-gray-400">{d.cycle}</span></div>
            </div>
            <div className="flex items-center gap-3 mb-2"><span className="text-xs text-gray-400">Competitors:</span>{d.competitors.map(c => <span key={c} className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{c}</span>)}</div>
            <div className="flex flex-wrap gap-1">{d.factors.map(f => <span key={f.f} className={`text-xs px-2 py-0.5 rounded ${f.impact === '+' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>{f.impact === '+' ? '\u2713' : '\u2717'} {f.f}</span>)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
