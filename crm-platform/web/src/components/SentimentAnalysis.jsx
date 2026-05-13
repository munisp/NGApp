import { useState } from 'react'
import { Heart, TrendingUp, TrendingDown, Minus, Search, Filter, BarChart3, MessageSquare } from 'lucide-react'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const sentimentData = [
  { id: 'SENT-001', customer: 'Dangote Industries', channel: 'Email', score: 92, trend: 'up', recent: 'Very happy with the new trade finance product. Excellent service from Sarah.', date: '2 hours ago', tickets: 0, nps: 9 },
  { id: 'SENT-002', customer: 'MTN Nigeria', channel: 'Call', score: 78, trend: 'stable', recent: 'Payroll integration works well but needs faster settlement.', date: '1 day ago', tickets: 2, nps: 7 },
  { id: 'SENT-003', customer: 'Kano Textiles', channel: 'Support', score: 18, trend: 'down', recent: 'Billing issues unresolved for 3 weeks. Considering alternatives.', date: '45 min ago', tickets: 5, nps: 2 },
  { id: 'SENT-004', customer: 'Total Energies', channel: 'Survey', score: 35, trend: 'down', recent: 'FX rate outages cost us significantly. Need guaranteed uptime SLA.', date: '3 days ago', tickets: 3, nps: 3 },
  { id: 'SENT-005', customer: 'Shoprite Nigeria', channel: 'Email', score: 65, trend: 'up', recent: 'POS integration improving. Branch rollout progressing well.', date: '1 day ago', tickets: 1, nps: 6 },
  { id: 'SENT-006', customer: 'Lafarge Cement', channel: 'Call', score: 85, trend: 'up', recent: 'Treasury management features exactly what we needed.', date: '12 hours ago', tickets: 0, nps: 8 },
  { id: 'SENT-007', customer: 'Zenith Pharma', channel: 'Chat', score: 72, trend: 'stable', recent: 'Good product, onboarding could be smoother.', date: '2 days ago', tickets: 1, nps: 7 },
]

const channelBreakdown = [
  { channel: 'Email', positive: 68, neutral: 22, negative: 10, volume: 1240 },
  { channel: 'Calls', positive: 55, neutral: 30, negative: 15, volume: 890 },
  { channel: 'Support', positive: 32, neutral: 28, negative: 40, volume: 2100 },
  { channel: 'Survey', positive: 62, neutral: 25, negative: 13, volume: 450 },
  { channel: 'Chat', positive: 58, neutral: 30, negative: 12, volume: 3200 },
]

export default function SentimentAnalysis() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('sentimentanalysis', () => apiClient.dashboard.metrics(), { fallback: sentimentData })
  const [activeTab, setActiveTab] = useState('customers')
  const [search, setSearch] = useState('')
  const [trendFilter, setTrendFilter] = useState('all')
  const [selectedCustomer, setSelectedCustomer] = useState(null)

  const filtered = sentimentData.filter(s => {
    const matchesSearch = !search || s.customer.toLowerCase().includes(search.toLowerCase())
    const matchesTrend = trendFilter === 'all' || s.trend === trendFilter
    return matchesSearch && matchesTrend
  })

  const avgScore = Math.round(sentimentData.reduce((s, d) => s + d.score, 0) / sentimentData.length)
  const atRisk = sentimentData.filter(d => d.score < 40).length
  const promoters = sentimentData.filter(d => d.nps >= 9).length

  return (
    <div role="region" aria-label="SentimentAnalysis" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Heart className="w-7 h-7 text-pink-600" /> Sentiment Analysis</h1><p className="text-gray-500 dark:text-gray-400 mt-1">AI-powered customer sentiment tracking across all channels</p></div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Avg Sentiment', v: avgScore, c: avgScore >= 60 ? 'text-emerald-600' : 'text-red-600' }, { l: 'At-Risk Accounts', v: atRisk, c: 'text-red-600' }, { l: 'Promoters (NPS≥9)', v: promoters, c: 'text-emerald-600' }, { l: 'Active Signals', v: sentimentData.reduce((s, d) => s + d.tickets, 0) + ' tickets' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['customers', 'channels', 'alerts'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'customers' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
            <select value={trendFilter} onChange={e => setTrendFilter(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="all">All Trends</option><option value="up">Improving</option><option value="stable">Stable</option><option value="down">Declining</option>
            </select>
          </div>
          <div className="space-y-2">
            {filtered.map(s => (
              <div key={s.id} onClick={() => setSelectedCustomer(selectedCustomer === s.id ? null : s.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow ${selectedCustomer === s.id ? 'border-pink-500 ring-1 ring-pink-500' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${s.score >= 70 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : s.score >= 40 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{s.score}</div>
                    <div>
                      <div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900 dark:text-white">{s.customer}</h4>{s.trend === 'up' ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : s.trend === 'down' ? <TrendingDown className="w-4 h-4 text-red-500" /> : <Minus className="w-4 h-4 text-gray-400" />}<span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{s.channel}</span></div>
                      <p className="text-xs text-gray-500 mt-0.5 italic">"{s.recent}"</p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-400"><div>NPS: <span className={`font-bold ${s.nps >= 9 ? 'text-emerald-600' : s.nps >= 7 ? 'text-amber-600' : 'text-red-600'}`}>{s.nps}</span></div><div>{s.date}</div></div>
                </div>
                {selectedCustomer === s.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-4 text-xs">
                    <div><span className="text-gray-500">Open Tickets</span><p className="font-medium text-gray-900 dark:text-white text-lg">{s.tickets}</p></div>
                    <div><span className="text-gray-500">Trend</span><p className="font-medium text-gray-900 dark:text-white capitalize text-lg">{s.trend}</p></div>
                    <div className="flex gap-2 items-start">
                      <button className="px-3 py-1.5 bg-pink-600 text-white rounded text-xs hover:bg-pink-700">Engage Now</button>
                      <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">View History</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'channels' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Sentiment by Channel</h3>
          {channelBreakdown.map(ch => (
            <div key={ch.channel} className="space-y-1">
              <div className="flex items-center justify-between text-sm"><span className="text-gray-600 dark:text-gray-400">{ch.channel}</span><span className="text-xs text-gray-400">{ch.volume.toLocaleString()} interactions</span></div>
              <div className="flex h-6 rounded-full overflow-hidden">
                <div className="bg-emerald-500 flex items-center justify-center text-xs text-white font-medium" style={{ width: `${ch.positive}%` }}>{ch.positive}%</div>
                <div className="bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs text-gray-700 dark:text-gray-300 font-medium" style={{ width: `${ch.neutral}%` }}>{ch.neutral}%</div>
                <div className="bg-red-500 flex items-center justify-center text-xs text-white font-medium" style={{ width: `${ch.negative}%` }}>{ch.negative}%</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="space-y-2">
          {sentimentData.filter(s => s.score < 40 || s.trend === 'down').map(s => (
            <div key={s.id} className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-900/50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center"><TrendingDown className="w-5 h-5 text-red-600" /></div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">{s.customer}</h4>
                    <p className="text-xs text-gray-500">{s.recent}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-red-600">{s.score}</span>
                  <button className="px-3 py-1.5 bg-red-600 text-white rounded text-xs hover:bg-red-700">Intervene</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
