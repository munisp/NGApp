import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const feedback = [
  { id: 'FB-001', source: 'NPS Survey', customer: 'Dangote Industries', score: 9, category: 'Product', comment: 'Trade finance platform has transformed our operations. The real-time FX rates are game-changing.', sentiment: 'positive', date: '2 days ago' },
  { id: 'FB-002', source: 'Support Ticket', customer: 'Kano Textiles', score: 3, category: 'Support', comment: 'Response time is unacceptable. Waited 5 days for a resolution on a billing issue.', sentiment: 'negative', date: '3 days ago' },
  { id: 'FB-003', source: 'In-App', customer: 'MTN Nigeria', score: 8, category: 'UX', comment: 'The new dashboard is intuitive. Would love to see mobile app improvements.', sentiment: 'positive', date: '1 day ago' },
  { id: 'FB-004', source: 'QBR', customer: 'Shoprite', score: 6, category: 'Feature', comment: 'Need better POS integration. Current process requires too many manual steps.', sentiment: 'neutral', date: '1 week ago' },
  { id: 'FB-005', source: 'NPS Survey', customer: 'Total Energies', score: 2, category: 'Reliability', comment: 'Two outages in the last month during peak trading hours. This is unacceptable for FX operations.', sentiment: 'negative', date: '5 days ago' },
]

export default function FeedbackLoop() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('feedbackloop', () => apiClient.dashboard.metrics(), { fallback: feedback })
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all' ? feedback : feedback.filter(f => f.sentiment === filter)
  const nps = Math.round((feedback.filter(f => f.score >= 9).length - feedback.filter(f => f.score <= 6).length) / feedback.length * 100)

  return (
    <div role="region" aria-label="FeedbackLoop" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><MessageCircle className="w-7 h-7 text-violet-600" /> Feedback Loop</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Customer feedback collection and sentiment analysis</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-5 gap-3">
        {[{ l: 'Total Feedback', v: feedback.length }, { l: 'NPS', v: nps > 0 ? `+${nps}` : nps }, { l: 'Positive', v: feedback.filter(f => f.sentiment === 'positive').length }, { l: 'Negative', v: feedback.filter(f => f.sentiment === 'negative').length }, { l: 'Avg Score', v: (feedback.reduce((s, f) => s + f.score, 0) / feedback.length).toFixed(1) }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="flex gap-1">
        {['all', 'positive', 'neutral', 'negative'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${filter === f ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{f}</button>
        ))}
      </div>
      <div className="space-y-2">
        {filtered.map(fb => (
          <div key={fb.id} className={`bg-white dark:bg-gray-800 rounded-xl border-l-4 ${fb.sentiment === 'positive' ? 'border-l-emerald-500' : fb.sentiment === 'negative' ? 'border-l-red-500' : 'border-l-amber-500'} border border-gray-200 dark:border-gray-700 p-4`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900 dark:text-white">{fb.customer}</h4><span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{fb.source}</span><span className="text-xs px-2 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">{fb.category}</span></div>
              <div className="flex items-center gap-1">{Array.from({ length: 10 }, (_, i) => <div key={i} className={`w-2 h-2 rounded-full ${i < fb.score ? (fb.score >= 9 ? 'bg-emerald-500' : fb.score >= 7 ? 'bg-amber-500' : 'bg-red-500') : 'bg-gray-200 dark:bg-gray-700'}`} />)}<span className="text-sm font-bold ml-1 text-gray-900 dark:text-white">{fb.score}</span></div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 italic">&ldquo;{fb.comment}&rdquo;</p>
            <span className="text-xs text-gray-400 mt-1 inline-block">{fb.date}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
