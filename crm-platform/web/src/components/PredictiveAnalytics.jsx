import { useState } from 'react'
import { Brain, TrendingUp, TrendingDown, Target, Users, DollarSign, AlertTriangle, BarChart3, Activity, Clock, Percent, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { FallbackBadge } from '@/components/ui/DataStates'

const tenantPredictions = {
  'acme-bank': {
    stats: { modelsActive: 4, predictionsToday: 1842, accuracy: 87, revenueImpact: '₦3.2B' },
    winProbability: [
      { deal: 'Dangote — Trade Finance', value: '₦2.5B', probability: 89, change: +4, factors: [{ f: 'CEO engagement', impact: +18 }, { f: 'Budget confirmed', impact: +15 }, { f: 'Competitor weak', impact: +12 }, { f: 'Long sales cycle', impact: -8 }] },
      { deal: 'MTN — Payroll', value: '₦890M', probability: 72, change: +2, factors: [{ f: 'CFO champion', impact: +14 }, { f: 'POC success', impact: +11 }, { f: 'Price sensitivity', impact: -9 }, { f: 'Internal politics', impact: -5 }] },
      { deal: 'Shoprite — POS Fleet', value: '₦180M', probability: 55, change: -3, factors: [{ f: 'Volume discount ask', impact: +8 }, { f: 'Competitor bid', impact: -12 }, { f: 'Decision delay', impact: -6 }] },
      { deal: 'Zenith Pharma — Suite', value: '₦340M', probability: 35, change: +8, factors: [{ f: 'Inbound interest', impact: +10 }, { f: 'Early stage', impact: -8 }] },
      { deal: 'Total Energies — FX', value: '₦1.2B', probability: 25, change: 0, factors: [{ f: 'Referral source', impact: +6 }, { f: 'No contact yet', impact: -12 }] },
    ],
    churnPredictions: [
      { customer: 'Kano Textiles', probability: 82, segment: 'SME', value: '₦45.2M', signals: ['45-day inactivity', '3 open tickets', 'NPS 18'], trend: 'rising' },
      { customer: 'Lagos Fresh Markets', probability: 76, segment: 'SME', value: '₦8.7M', signals: ['Missed payment', 'Usage -60%'], trend: 'rising' },
      { customer: 'Abuja Motors', probability: 58, segment: 'Corporate', value: '₦22.1M', signals: ['Plan downgrade', 'Reduced logins'], trend: 'stable' },
      { customer: 'Ibadan AgriTech', probability: 45, segment: 'SME', value: '₦5.3M', signals: ['Feature drop'], trend: 'rising' },
      { customer: 'Port Harcourt Shipping', probability: 42, segment: 'Enterprise', value: '₦67.8M', signals: ['Renewal due', 'Low engagement'], trend: 'declining' },
    ],
    ltvForecast: [
      { segment: 'Enterprise', current: '₦142M', predicted: '₦168M', growth: 18, customers: 48 },
      { segment: 'Corporate', current: '₦45M', predicted: '₦52M', growth: 16, customers: 312 },
      { segment: 'SME', current: '₦8.2M', predicted: '₦9.1M', growth: 11, customers: 4820 },
      { segment: 'Retail', current: '₦1.8M', predicted: '₦2.0M', growth: 8, customers: 38062 },
    ],
    modelPerformance: [
      { model: 'Win Probability', accuracy: 89, f1Score: 0.87, lastTrained: '2 days ago', samples: 12400 },
      { model: 'Churn Prediction', accuracy: 84, f1Score: 0.81, lastTrained: '1 day ago', samples: 43242 },
      { model: 'LTV Forecast', accuracy: 91, f1Score: 0.88, lastTrained: '3 days ago', samples: 43242 },
      { model: 'Next Best Action', accuracy: 78, f1Score: 0.74, lastTrained: '4 hours ago', samples: 8600 },
    ],
  },
}

const PredictiveAnalytics = () => {
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('win')

  const tenantSlug = tenant?.slug || 'acme-bank'
  const data = tenantPredictions[tenantSlug] || tenantPredictions['acme-bank']

  return (
    <div role="region" aria-label="PredictiveAnalytics" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Brain className="w-7 h-7 text-violet-600" /> Predictive Analytics</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">ML-powered forecasting for {tenant?.name || 'platform'}</p>
        </div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { l: 'Models Active', v: data.stats.modelsActive, icon: Brain },
          { l: 'Predictions Today', v: data.stats.predictionsToday.toLocaleString(), icon: Activity },
          { l: 'Avg Accuracy', v: `${data.stats.accuracy}%`, icon: Target },
          { l: 'Revenue Impact', v: data.stats.revenueImpact, icon: DollarSign },
        ].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-center gap-1.5 mb-1"><s.icon className="w-3.5 h-3.5 text-gray-400" /><p className="text-xs text-gray-500">{s.l}</p></div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex space-x-6">
          {[{ id: 'win', label: 'Win Probability', icon: Target }, { id: 'churn', label: 'Churn Prediction', icon: AlertTriangle }, { id: 'ltv', label: 'LTV Forecast', icon: DollarSign }, { id: 'models', label: 'Model Performance', icon: BarChart3 }].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`pb-3 text-sm font-medium border-b-2 flex items-center gap-2 ${activeTab === tab.id ? 'border-violet-600 text-violet-600' : 'border-transparent text-gray-500'}`}>
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'win' && (
        <div className="space-y-3">
          {data.winProbability.map(d => (
            <div key={d.deal} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">{d.deal}</h4>
                  <span className="text-sm text-gray-500">{d.value}</span>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${d.probability >= 70 ? 'text-emerald-600' : d.probability >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{d.probability}%</p>
                  <span className={`text-xs flex items-center gap-0.5 justify-end ${d.change > 0 ? 'text-emerald-500' : d.change < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                    {d.change > 0 ? <ArrowUpRight className="w-3 h-3" /> : d.change < 0 ? <ArrowDownRight className="w-3 h-3" /> : null}{d.change > 0 ? '+' : ''}{d.change}%
                  </span>
                </div>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full mb-3"><div className={`h-full rounded-full ${d.probability >= 70 ? 'bg-emerald-500' : d.probability >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${d.probability}%` }} /></div>
              <div className="flex flex-wrap gap-2">
                {d.factors.map(f => (
                  <span key={f.f} className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${f.impact > 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
                    {f.impact > 0 ? '+' : ''}{f.impact} {f.f}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'churn' && (
        <div className="space-y-2">
          {data.churnPredictions.map(c => (
            <div key={c.customer} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-gray-900 dark:text-white">{c.customer}</h4>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{c.segment}</span>
                  <span className="text-xs text-gray-400">{c.value}</span>
                </div>
                <div className="flex gap-1.5 mt-1.5">
                  {c.signals.map(s => <span key={s} className="text-xs px-2 py-0.5 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">{s}</span>)}
                </div>
              </div>
              <div className="text-right ml-4">
                <p className={`text-2xl font-bold ${c.probability >= 70 ? 'text-red-600' : c.probability >= 40 ? 'text-amber-600' : 'text-emerald-600'}`}>{c.probability}%</p>
                <span className={`text-xs ${c.trend === 'rising' ? 'text-red-500' : c.trend === 'declining' ? 'text-emerald-500' : 'text-gray-400'}`}>
                  {c.trend === 'rising' ? '↑ Rising' : c.trend === 'declining' ? '↓ Declining' : '→ Stable'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'ltv' && (
        <div className="space-y-3">
          {data.ltvForecast.map(seg => (
            <div key={seg.segment} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">{seg.segment}</h4>
                  <span className="text-xs text-gray-400">{seg.customers.toLocaleString()} customers</span>
                </div>
                <span className="text-sm font-semibold text-emerald-600 flex items-center gap-1"><TrendingUp className="w-4 h-4" />+{seg.growth}%</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-xs text-gray-500">Current Avg LTV</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{seg.current}</p>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                  <p className="text-xs text-emerald-600">Predicted (12mo)</p>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{seg.predicted}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'models' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.modelPerformance.map(m => (
            <div key={m.model} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white">{m.model}</h4>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div><p className="text-xs text-gray-400">Accuracy</p><p className="text-lg font-bold text-gray-900 dark:text-white">{m.accuracy}%</p></div>
                <div><p className="text-xs text-gray-400">F1 Score</p><p className="text-lg font-bold text-gray-900 dark:text-white">{m.f1Score}</p></div>
                <div><p className="text-xs text-gray-400">Last Trained</p><p className="text-sm text-gray-600 dark:text-gray-400">{m.lastTrained}</p></div>
                <div><p className="text-xs text-gray-400">Training Samples</p><p className="text-sm text-gray-600 dark:text-gray-400">{m.samples.toLocaleString()}</p></div>
              </div>
              <div className="mt-3 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full"><div className="h-full bg-violet-500 rounded-full" style={{ width: `${m.accuracy}%` }} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PredictiveAnalytics
