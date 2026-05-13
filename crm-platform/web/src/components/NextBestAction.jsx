import { Lightbulb, Zap } from 'lucide-react'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const actions = [
  { id: 'NBA-001', customer: 'Dangote Industries', action: 'Schedule Executive Business Review', type: 'retention', impact: '₦2.5B ARR', confidence: 94, reason: 'No exec meeting in 45 days. Health trending down. Contract renewal in 60 days.', urgency: 'high' },
  { id: 'NBA-002', customer: 'MTN Nigeria', action: 'Propose Treasury Module Upsell', type: 'expansion', impact: '₦180M ARR', confidence: 87, reason: 'CFO mentioned cash management challenges in last QBR. Treasury adoption 0%.', urgency: 'medium' },
  { id: 'NBA-003', customer: 'Kano Textiles', action: 'Trigger Win-Back Campaign', type: 'retention', impact: '₦45.2M ARR', confidence: 82, reason: 'Health at 25. No login 45 days. 3 open support tickets unresolved.', urgency: 'critical' },
  { id: 'NBA-004', customer: 'Shoprite Nigeria', action: 'Send Case Study: Multi-Branch POS', type: 'nurture', impact: '₦180M deal', confidence: 72, reason: 'Competitor is pitching. Client evaluating alternatives. Need to reinforce value.', urgency: 'high' },
  { id: 'NBA-005', customer: 'Total Energies', action: 'Assign Senior CSM', type: 'retention', impact: '₦1.2B ARR', confidence: 68, reason: 'NPS dropped to 2. Two outages impacted FX operations. Risk of churn.', urgency: 'critical' },
]

const urgencyColor = { critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', low: 'bg-gray-100 text-gray-600' }
const typeColor = { retention: 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400', expansion: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400', nurture: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' }

export default function NextBestAction() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('nextbestaction', () => apiClient.dashboard.metrics(), { fallback: actions })

  return (
    <div role="region" aria-label="NextBestAction" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Lightbulb className="w-7 h-7 text-amber-600" /> Next Best Action</h1><p className="text-gray-500 dark:text-gray-400 mt-1">AI-recommended actions ranked by impact and urgency</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Recommendations', v: actions.length }, { l: 'Critical', v: actions.filter(a => a.urgency === 'critical').length }, { l: 'Revenue at Risk', v: '₦3.77B' }, { l: 'Avg Confidence', v: Math.round(actions.reduce((s, a) => s + a.confidence, 0) / actions.length) + '%' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="space-y-2">
        {actions.map(a => (
          <div key={a.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900 dark:text-white">{a.action}</h4><span className={`text-xs px-2 py-0.5 rounded ${urgencyColor[a.urgency]}`}>{a.urgency}</span><span className={`text-xs px-2 py-0.5 rounded ${typeColor[a.type]}`}>{a.type}</span></div>
                <p className="text-sm text-gray-500 mt-1"><span className="font-medium">{a.customer}</span> · {a.reason}</p>
              </div>
              <div className="text-right ml-4">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{a.impact}</p>
                <p className="text-xs text-gray-400">{a.confidence}% confidence</p>
                <button className="mt-2 px-3 py-1.5 bg-amber-600 text-white rounded text-xs hover:bg-amber-700 flex items-center gap-1"><Zap className="w-3 h-3" /> Execute</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
