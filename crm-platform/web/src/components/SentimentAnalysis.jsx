import { Smile } from 'lucide-react'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const sentimentData = [
  { channel: 'Email', positive: 68, neutral: 22, negative: 10, volume: 12400, trend: 'up' },
  { channel: 'Chat', positive: 72, neutral: 18, negative: 10, volume: 8900, trend: 'up' },
  { channel: 'Phone', positive: 58, neutral: 24, negative: 18, volume: 3200, trend: 'down' },
  { channel: 'Social', positive: 45, neutral: 30, negative: 25, volume: 2100, trend: 'down' },
  { channel: 'Support Tickets', positive: 32, neutral: 28, negative: 40, volume: 4800, trend: 'stable' },
]

const recentMentions = [
  { customer: 'Dangote Industries', channel: 'Email', sentiment: 'positive', score: 0.92, excerpt: '"The new trade finance feature has been exceptional..."', time: '1 hour ago' },
  { customer: 'Kano Textiles', channel: 'Support', sentiment: 'negative', score: 0.18, excerpt: '"Extremely frustrated with the billing errors this month..."', time: '3 hours ago' },
  { customer: 'MTN Nigeria', channel: 'Chat', sentiment: 'positive', score: 0.85, excerpt: '"Dashboard improvements are great, much more intuitive..."', time: '4 hours ago' },
  { customer: 'Total Energies', channel: 'Social', sentiment: 'negative', score: 0.12, excerpt: '"Two outages during peak FX trading — completely unacceptable..."', time: '1 day ago' },
]

export default function SentimentAnalysis() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('sentimentanalysis', () => apiClient.dashboard.metrics(), { fallback: sentimentData })
  return (
    <div role="region" aria-label="SentimentAnalysis" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Smile className="w-7 h-7 text-emerald-600" /> Sentiment Analysis</h1><p className="text-gray-500 dark:text-gray-400 mt-1">AI-powered sentiment tracking across all channels</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Overall Sentiment', v: '62% Positive' }, { l: 'Interactions', v: sentimentData.reduce((s, d) => s + d.volume, 0).toLocaleString() }, { l: 'Channels', v: sentimentData.length }, { l: 'Trend', v: '↑ Improving' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Channel Breakdown</h3>
        <div className="space-y-3">
          {sentimentData.map(ch => (
            <div key={ch.channel}>
              <div className="flex items-center justify-between mb-1"><span className="text-sm font-medium text-gray-900 dark:text-white">{ch.channel}</span><span className="text-xs text-gray-400">{ch.volume.toLocaleString()} interactions</span></div>
              <div className="flex h-4 rounded-full overflow-hidden">
                <div className="bg-emerald-500" style={{ width: `${ch.positive}%` }} />
                <div className="bg-amber-400" style={{ width: `${ch.neutral}%` }} />
                <div className="bg-red-500" style={{ width: `${ch.negative}%` }} />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span className="text-emerald-600">{ch.positive}% positive</span><span className="text-amber-600">{ch.neutral}% neutral</span><span className="text-red-600">{ch.negative}% negative</span></div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold text-gray-900 dark:text-white">Recent Mentions</h3>
        {recentMentions.map((m, i) => (
          <div key={i} className={`bg-white dark:bg-gray-800 rounded-xl border-l-4 ${m.sentiment === 'positive' ? 'border-l-emerald-500' : 'border-l-red-500'} border border-gray-200 dark:border-gray-700 p-3`}>
            <div className="flex items-center gap-2 mb-1"><span className="text-sm font-medium text-gray-900 dark:text-white">{m.customer}</span><span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500">{m.channel}</span><span className="text-xs text-gray-400">{m.time}</span></div>
            <p className="text-sm text-gray-600 dark:text-gray-400 italic">{m.excerpt}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
