import { TrendingUp, ArrowRight } from 'lucide-react'
import { FallbackBadge } from '@/components/ui/DataStates'

const stages = [
  { name: 'Qualification', deals: 28, value: '₦1.8B', avgDays: 12, convRate: 68 },
  { name: 'Discovery', deals: 22, value: '₦2.1B', avgDays: 18, convRate: 72 },
  { name: 'Proposal', deals: 15, value: '₦1.6B', avgDays: 14, convRate: 65 },
  { name: 'Negotiation', deals: 8, value: '₦2.4B', avgDays: 22, convRate: 78 },
  { name: 'Closing', deals: 4, value: '₦1.2B', avgDays: 8, convRate: 89 },
]

const topDeals = [
  { name: 'Dangote — Trade Finance', value: '₦2.5B', stage: 'Closing', probability: 89, owner: 'Sarah Okonkwo', daysInStage: 3 },
  { name: 'Total Energies — FX', value: '₦1.2B', stage: 'Discovery', probability: 25, owner: 'Ahmed Musa', daysInStage: 28 },
  { name: 'MTN — Payroll', value: '₦890M', stage: 'Proposal', probability: 72, owner: 'Chidi Obi', daysInStage: 8 },
  { name: 'Lafarge — Treasury', value: '₦450M', stage: 'Negotiation', probability: 68, owner: 'Fatima Ibrahim', daysInStage: 5 },
]

export default function RevOpsPipeline() {
  return (
    <div role="region" aria-label="RevOpsPipeline" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><TrendingUp className="w-7 h-7 text-emerald-600" /> Revenue Operations Pipeline</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Cross-vertical revenue pipeline with forecasting</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-5 gap-3">
        {[{ l: 'Pipeline Value', v: '₦9.1B' }, { l: 'Deals', v: stages.reduce((s, st) => s + st.deals, 0) }, { l: 'Weighted', v: '₦3.2B' }, { l: 'Avg Cycle', v: '45 days' }, { l: 'Win Rate', v: '32%' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Pipeline Stages</h3>
        <div className="flex items-center gap-1">
          {stages.map((stage, i) => (
            <div key={stage.name} className="flex items-center gap-1 flex-1">
              <div className="flex-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
                <p className="text-xs text-gray-500">{stage.name}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{stage.deals}</p>
                <p className="text-xs text-gray-400">{stage.value}</p>
                <p className="text-xs text-emerald-600">{stage.convRate}% conv</p>
              </div>
              {i < stages.length - 1 && <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700"><h3 className="font-semibold text-gray-900 dark:text-white">Top Deals</h3></div>
        <table className="w-full"><thead className="bg-gray-50 dark:bg-gray-700"><tr>{['Deal', 'Value', 'Stage', 'Probability', 'Owner', 'Days in Stage'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {topDeals.map(d => (
            <tr key={d.name} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{d.name}</td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{d.value}</td>
              <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{d.stage}</span></td>
              <td className="px-4 py-3"><span className={`text-xs font-medium ${d.probability >= 70 ? 'text-emerald-600' : d.probability >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{d.probability}%</span></td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{d.owner}</td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{d.daysInStage}d</td>
            </tr>
          ))}
        </tbody></table>
      </div>
    </div>
  )
}
