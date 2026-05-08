import { useState } from 'react'
import { Users, TrendingUp, BarChart3, Calendar, Target, ArrowUpRight, Filter } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const cohorts = [
  { name: 'Jan 2026 Acquired', size: 1842, retention30: 92, retention90: 78, retention180: 65, avgLTV: '\u20A64.2M', topProduct: 'Business Account', source: 'Organic', color: 'bg-blue-500' },
  { name: 'Q4 2025 Enterprise', size: 12, retention30: 100, retention90: 100, retention180: 92, avgLTV: '\u20A6142M', topProduct: 'Treasury Suite', source: 'Sales', color: 'bg-emerald-500' },
  { name: 'Referred Customers', size: 3200, retention30: 95, retention90: 84, retention180: 72, avgLTV: '\u20A66.8M', topProduct: 'Trade Finance', source: 'Referral', color: 'bg-purple-500' },
  { name: 'Mobile-First Users', size: 18400, retention30: 88, retention90: 68, retention180: 52, avgLTV: '\u20A61.2M', topProduct: 'Mobile Banking', source: 'App Store', color: 'bg-amber-500' },
  { name: 'Campaign: Q1 Promo', size: 4800, retention30: 85, retention90: 62, retention180: 48, avgLTV: '\u20A60.8M', topProduct: 'Savings Account', source: 'Campaign', color: 'bg-rose-500' },
]

export default function CohortStudio() {
  const { tenant } = useTenant()
  const { t } = useTranslation()

  return (
    <div role="region" aria-label="CohortStudio" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Users className="w-7 h-7 text-indigo-600" /> Cohort Studio</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Analyze customer cohorts by acquisition, behavior, and value</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Total Cohorts', v: cohorts.length }, { l: 'Tracked Customers', v: cohorts.reduce((s, c) => s + c.size, 0).toLocaleString() }, { l: 'Avg 90d Retention', v: Math.round(cohorts.reduce((s, c) => s + c.retention90, 0) / cohorts.length) + '%' }, { l: 'Best Source', v: 'Referral' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full"><thead className="bg-gray-50 dark:bg-gray-700"><tr>{['Cohort', 'Size', '30-Day', '90-Day', '180-Day', 'Avg LTV', 'Top Product', 'Source'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {cohorts.map(c => (
            <tr key={c.name} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white"><div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${c.color}`} />{c.name}</div></td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{c.size.toLocaleString()}</td>
              {[c.retention30, c.retention90, c.retention180].map((r, i) => <td key={i} className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded ${r >= 80 ? 'bg-emerald-100 text-emerald-700' : r >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{r}%</span></td>)}
              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{c.avgLTV}</td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{c.topProduct}</td>
              <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{c.source}</span></td>
            </tr>
          ))}
        </tbody></table>
      </div>
    </div>
  )
}
