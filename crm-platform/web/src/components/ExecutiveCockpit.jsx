import { useState } from 'react'
import { Monitor, TrendingUp, TrendingDown, Users, DollarSign, BarChart3, Activity, Target, AlertTriangle, ArrowUpRight, ArrowDownRight, Globe, Briefcase } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const tenantCockpitData = {
  'acme-bank': {
    kpis: [
      { label: 'Total AUM', value: '₦892B', change: +8.2, trend: 'up' },
      { label: 'Active Customers', value: '43,242', change: +3.1, trend: 'up' },
      { label: 'Revenue YTD', value: '₦12.8B', change: +12.4, trend: 'up' },
      { label: 'NPS', value: '+42', change: -2, trend: 'down' },
      { label: 'Churn Rate', value: '2.1%', change: -0.3, trend: 'up' },
      { label: 'ARPU', value: '₦296K', change: +5.8, trend: 'up' },
    ],
    segments: [
      { name: 'Enterprise', customers: 48, revenue: '₦6.2B', growth: 15, health: 82 },
      { name: 'Corporate', customers: 312, revenue: '₦3.8B', growth: 11, health: 74 },
      { name: 'SME', customers: 4820, revenue: '₦2.1B', growth: 8, health: 68 },
      { name: 'Retail', customers: 38062, revenue: '₦0.7B', growth: 4, health: 71 },
    ],
    alerts: [
      { type: 'critical', message: 'Kano Textiles (₦45.2M) — health dropped 31 pts, escalated complaint unresolved 7 days', time: '2 hours ago' },
      { type: 'warning', message: '23 Enterprise accounts below score 50 — up from 18 last week', time: '4 hours ago' },
      { type: 'positive', message: 'Q1 revenue target exceeded by 8.2% (₦12.8B vs ₦11.8B target)', time: '1 day ago' },
      { type: 'info', message: 'Board meeting prep: Executive dashboard PDF auto-generated', time: '1 day ago' },
    ],
    pipeline: { totalValue: '₦5.1B', deals: 142, avgCycle: '45 days', forecast: '₦3.2B' },
    aiNarrative: 'Revenue growth of 12.4% YTD exceeds target by 8.2%. Enterprise segment is the primary driver at ₦6.2B, led by the Dangote Trade Finance expansion (₦2.5B, 89% probability). Key risk: 23 Enterprise accounts now below health score 50, up 28% from last week. Recommended action: Activate retention playbooks for top 5 at-risk accounts representing ₦180M in ARR. Pipeline coverage ratio is 1.6x (₦5.1B pipeline vs ₦3.2B forecast), slightly below the 2.0x benchmark.'
  },
}

export default function ExecutiveCockpit() {
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [showNarrative, setShowNarrative] = useState(true)
  const tenantSlug = tenant?.slug || 'acme-bank'
  const data = tenantCockpitData[tenantSlug] || tenantCockpitData['acme-bank']

  return (
    <div role="region" aria-label="ExecutiveCockpit" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Monitor className="w-7 h-7 text-gray-700 dark:text-gray-300" /> Executive Cockpit</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Real-time C-suite dashboard for {tenant?.name || 'platform'}</p></div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-6 gap-3">
        {data.kpis.map(kpi => (
          <div key={kpi.label} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs text-gray-500">{kpi.label}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{kpi.value}</p>
            <span className={`text-xs flex items-center gap-0.5 mt-1 ${kpi.trend === 'up' && kpi.change > 0 ? 'text-emerald-500' : kpi.trend === 'down' ? 'text-red-500' : 'text-emerald-500'}`}>
              {kpi.change > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{kpi.change > 0 ? '+' : ''}{kpi.change}%
            </span>
          </div>
        ))}
      </div>

      {showNarrative && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800 p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2"><Activity className="w-5 h-5 text-indigo-600 mt-0.5" /><div><h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-300">AI Narrative Summary</h3><p className="text-sm text-indigo-800 dark:text-indigo-200 mt-1 leading-relaxed">{data.aiNarrative}</p></div></div>
            <button onClick={() => setShowNarrative(false)} className="text-xs text-indigo-500 hover:text-indigo-700">Dismiss</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Segment Performance</h3>
          <table className="w-full">
            <thead><tr>{['Segment', 'Customers', 'Revenue', 'Growth', 'Health'].map(h => <th key={h} className="text-left text-xs font-medium text-gray-500 uppercase pb-2">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.segments.map(s => (
                <tr key={s.name} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="py-3 text-sm font-medium text-gray-900 dark:text-white">{s.name}</td>
                  <td className="py-3 text-sm text-gray-600 dark:text-gray-400">{s.customers.toLocaleString()}</td>
                  <td className="py-3 text-sm text-gray-600 dark:text-gray-400">{s.revenue}</td>
                  <td className="py-3"><span className="text-xs text-emerald-600 flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" />+{s.growth}%</span></td>
                  <td className="py-3"><div className="flex items-center gap-2"><div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full"><div className={`h-full rounded-full ${s.health >= 75 ? 'bg-emerald-500' : s.health >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${s.health}%` }} /></div><span className="text-xs text-gray-500">{s.health}</span></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Pipeline Summary</h3>
            <div className="space-y-2">
              {[{ l: 'Pipeline Value', v: data.pipeline.totalValue }, { l: 'Active Deals', v: data.pipeline.deals }, { l: 'Avg Cycle', v: data.pipeline.avgCycle }, { l: 'Forecast', v: data.pipeline.forecast }].map(p => (
                <div key={p.l} className="flex justify-between"><span className="text-sm text-gray-500">{p.l}</span><span className="text-sm font-medium text-gray-900 dark:text-white">{p.v}</span></div>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Alerts</h3>
            <div className="space-y-2">
              {data.alerts.map((a, i) => (
                <div key={i} className={`p-2 rounded-lg text-xs ${a.type === 'critical' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' : a.type === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' : a.type === 'positive' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'}`}>
                  {a.message}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
