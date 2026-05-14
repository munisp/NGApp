import { useState } from 'react'
import { MessageCircle, Star, ThumbsUp, ThumbsDown, Search, Filter, TrendingUp, BarChart3 } from 'lucide-react'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const feedback = [
  { id: 'FB-001', customer: 'Dangote Industries', type: 'NPS', score: 9, category: 'Product', comment: 'Trade finance module is excellent. Sarah has been very helpful.', date: '2 hours ago', status: 'addressed', respondent: 'CFO Office' },
  { id: 'FB-002', customer: 'MTN Nigeria', type: 'CSAT', score: 4, category: 'Support', comment: 'Response time needs improvement for enterprise tickets.', date: '1 day ago', status: 'open', respondent: 'HR Director' },
  { id: 'FB-003', customer: 'Kano Textiles', type: 'NPS', score: 2, category: 'Billing', comment: 'Billing issues still unresolved after 3 weeks. Very frustrated.', date: '3 days ago', status: 'escalated', respondent: 'Finance Manager' },
  { id: 'FB-004', customer: 'Total Energies', type: 'CSAT', score: 2, category: 'Reliability', comment: 'FX rate service outage cost us. Need guaranteed SLA.', date: '5 days ago', status: 'open', respondent: 'Treasury Head' },
  { id: 'FB-005', customer: 'Shoprite Nigeria', type: 'NPS', score: 7, category: 'Product', comment: 'POS integration getting better. Branch rollout going well.', date: '1 day ago', status: 'addressed', respondent: 'IT Manager' },
  { id: 'FB-006', customer: 'Lafarge Cement', type: 'CSAT', score: 5, category: 'Product', comment: 'Treasury features are what we need. Onboarding smooth.', date: '12 hours ago', status: 'addressed', respondent: 'CFO' },
]

const statusColors = { open: 'bg-amber-100 text-amber-700', escalated: 'bg-red-100 text-red-700', addressed: 'bg-emerald-100 text-emerald-700' }

export default function FeedbackLoop() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('feedbackloop', () => apiClient.dashboard.metrics(), { fallback: feedback })
  const [activeTab, setActiveTab] = useState('feedback')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedItem, setSelectedItem] = useState(null)

  const filtered = feedback.filter(f => {
    const matchesSearch = !search || f.customer.toLowerCase().includes(search.toLowerCase()) || f.comment.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || f.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const avgNPS = Math.round(feedback.filter(f => f.type === 'NPS').reduce((s, f) => s + f.score, 0) / feedback.filter(f => f.type === 'NPS').length * 10)
  const promoters = feedback.filter(f => f.type === 'NPS' && f.score >= 9).length
  const detractors = feedback.filter(f => f.type === 'NPS' && f.score <= 6).length

  return (
    <div role="region" aria-label="FeedbackLoop" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><MessageCircle className="w-7 h-7 text-rose-600" /> Feedback Loop</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Customer feedback collection and sentiment tracking</p></div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[{ l: 'NPS Score', v: avgNPS, c: avgNPS >= 50 ? 'text-emerald-600' : 'text-amber-600' }, { l: 'Promoters', v: promoters, c: 'text-emerald-600' }, { l: 'Detractors', v: detractors, c: 'text-red-600' }, { l: 'Open Items', v: feedback.filter(f => f.status === 'open').length, c: 'text-amber-600' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['feedback', 'trends', 'surveys'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
        ))}
      </div>

      {activeTab === 'feedback' && (<div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search feedback..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"><option value="all">All Status</option><option value="open">Open</option><option value="escalated">Escalated</option><option value="addressed">Addressed</option></select>
        </div>
        <div className="space-y-2">
          {filtered.map(f => (
            <div key={f.id} onClick={() => setSelectedItem(selectedItem === f.id ? null : f.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md ${selectedItem === f.id ? 'border-rose-500 ring-1 ring-rose-500' : 'border-gray-200 dark:border-gray-700'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${f.score >= 7 ? 'bg-emerald-100 text-emerald-700' : f.score >= 4 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{f.score}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900 dark:text-white">{f.customer}</h4><span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{f.type}</span><span className={`text-xs px-2 py-0.5 rounded ${statusColors[f.status]}`}>{f.status}</span></div>
                    <p className="text-sm text-gray-500 mt-0.5 italic">"{f.comment}"</p>
                  </div>
                </div>
                <div className="text-xs text-gray-400">{f.date}</div>
              </div>
              {selectedItem === f.id && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-4 text-xs">
                  <div><span className="text-gray-500">Category</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{f.category}</p></div>
                  <div><span className="text-gray-500">Respondent</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{f.respondent}</p></div>
                  <div className="flex gap-2 items-start">
                    <button className="px-3 py-1.5 bg-rose-600 text-white rounded text-xs hover:bg-rose-700">Respond</button>
                    <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Assign</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>)}

      {activeTab === 'trends' && (<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Feedback Trends</h3>
        {['Product', 'Support', 'Billing', 'Reliability'].map(cat => {
          const catFeedback = feedback.filter(f => f.category === cat)
          const avg = catFeedback.length > 0 ? Math.round(catFeedback.reduce((s, f) => s + f.score, 0) / catFeedback.length * 10) : 0
          return (
            <div key={cat} className="flex items-center gap-3"><span className="w-24 text-sm text-gray-600 dark:text-gray-400">{cat}</span><div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className={`h-full rounded-full ${avg >= 60 ? 'bg-emerald-500' : avg >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${avg}%` }} /></div><span className="w-12 text-right text-sm font-medium text-gray-900 dark:text-white">{avg}%</span></div>
          )
        })}
      </div>)}

      {activeTab === 'surveys' && (<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
        <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Survey Management</h3>
        <p className="text-sm text-gray-500">Create and manage NPS, CSAT, and CES surveys for customers.</p>
        <button className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-lg text-sm hover:bg-rose-700">Create Survey</button>
      </div>)}
    </div>
  )
}
