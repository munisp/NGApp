import { useState } from 'react'
import { Star, ThumbsUp, ThumbsDown, BarChart3, TrendingUp, TrendingDown, MessageSquare, Users, Clock, Target, AlertTriangle } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
const data = {
  nps: { score: 42, promoters: 52, passives: 28, detractors: 20, responses: 4280, trend: '+3' },
  csat: { score: 4.2, responses: 8940, trend: '+0.1' },
  ces: { score: 3.8, responses: 2140, trend: '-0.2' },
  recent: [
    { id: 1, customer: 'Chinedu Okafor', type: 'NPS', score: 9, comment: 'Fast resolution of my transfer issue. Sarah was very helpful!', date: '2 hours ago', segment: 'Commercial' },
    { id: 2, customer: 'Kano Textiles', type: 'CSAT', score: 2, comment: 'Third time calling about same issue. Nobody follows up.', date: '4 hours ago', segment: 'Enterprise' },
    { id: 3, customer: 'Ngozi Eze', type: 'NPS', score: 10, comment: 'Best banking experience. Your Victoria Island branch is excellent.', date: '1 day ago', segment: 'Commercial' },
    { id: 4, customer: 'Bala Mohammed', type: 'CES', score: 5, comment: 'Account opening process was too complicated. Too many documents.', date: '1 day ago', segment: 'Retail' },
    { id: 5, customer: 'Olumide Adeyemi', type: 'NPS', score: 4, comment: 'Fraud response was slow. Expected better from a premium bank.', date: '2 days ago', segment: 'Enterprise' },
  ],
  byProduct: [
    { product: 'Current Account', nps: 48, csat: 4.3 },
    { product: 'SME Loan', nps: 35, csat: 3.9 },
    { product: 'POS Terminal', nps: 52, csat: 4.4 },
    { product: 'Mobile Banking', nps: 56, csat: 4.5 },
    { product: 'Trade Finance', nps: 44, csat: 4.1 },
  ],
}
export default function FeedbackLoop() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('overview')
  return (
    <div role="region" aria-label="FeedbackLoop"  className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Star className="w-7 h-7 text-yellow-500" /> Customer Feedback Loop</h1><p className="text-gray-500 dark:text-gray-400 mt-1">NPS, CSAT, and CES tracking across all touchpoints</p></div>
      <div className="grid grid-cols-3 gap-4">
        <div tabIndex="0" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 text-center"><p className="text-xs text-gray-500 mb-1">NPS Score</p><p className="text-4xl font-bold text-blue-600">{data.nps.score}</p><p className="text-xs text-emerald-600 mt-1">{data.nps.trend} vs last month</p><div className="flex justify-center gap-4 mt-3 text-xs"><span className="text-emerald-600">{data.nps.promoters}% promoters</span><span className="text-gray-500">{data.nps.passives}% passive</span><span className="text-red-600">{data.nps.detractors}% detractors</span></div></div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 text-center"><p className="text-xs text-gray-500 mb-1">CSAT</p><p className="text-4xl font-bold text-emerald-600">{data.csat.score}/5</p><p className="text-xs text-emerald-600 mt-1">{data.csat.trend} vs last month</p><p className="text-xs text-gray-500 mt-2">{data.csat.responses.toLocaleString()} responses</p></div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 text-center"><p className="text-xs text-gray-500 mb-1">CES (Customer Effort)</p><p className="text-4xl font-bold text-amber-600">{data.ces.score}/5</p><p className="text-xs text-red-600 mt-1">{data.ces.trend} vs last month</p><p className="text-xs text-gray-500 mt-2">{data.ces.responses.toLocaleString()} responses</p></div>
      </div>
      <div className="border-b border-gray-200 dark:border-gray-700"><div className="flex space-x-6">{['overview', 'responses', 'by product'].map(t => (<button key={t} onClick={() => setActiveTab(t)} className={`pb-3 text-sm font-medium capitalize border-b-2 ${activeTab === t ? 'border-yellow-500 text-yellow-600' : 'border-transparent text-gray-500'}`}>{t}</button>))}</div></div>
      {activeTab === 'responses' && (<div className="space-y-3">{data.recent.map(r => (<div key={r.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><span className="font-medium text-gray-900 dark:text-white text-sm">{r.customer}</span><span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{r.segment}</span></div><div className="flex items-center gap-2"><span className="text-xs text-gray-500">{r.type}</span><span className={`text-sm font-bold ${r.score >= 8 ? 'text-emerald-600' : r.score >= 5 ? 'text-amber-600' : 'text-red-600'}`}>{r.score}{r.type === 'NPS' ? '/10' : '/5'}</span></div></div><p className="text-sm text-gray-600 dark:text-gray-400 italic">"{r.comment}"</p><p className="text-xs text-gray-500 mt-2">{r.date}</p></div>))}</div>)}
      {activeTab === 'by product' && (<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"><table className="w-full"><thead className="bg-gray-50 dark:bg-gray-700"><tr>{['Product', 'NPS', 'CSAT'].map(h => (<th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>))}</tr></thead><tbody className="divide-y divide-gray-200 dark:divide-gray-700">{data.byProduct.map(p => (<tr key={p.product}><td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{p.product}</td><td className="px-4 py-3"><span className={`text-sm font-bold ${p.nps >= 50 ? 'text-emerald-600' : p.nps >= 30 ? 'text-amber-600' : 'text-red-600'}`}>{p.nps}</span></td><td className="px-4 py-3 text-sm">{p.csat}/5</td></tr>))}</tbody></table></div>)}
      {activeTab === 'overview' && (<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"><h3 className="font-semibold mb-4">NPS Distribution</h3><div className="flex h-8 rounded-full overflow-hidden"><div className="bg-emerald-500 flex items-center justify-center text-white text-xs font-medium" style={{width: `${data.nps.promoters}%`}}>{data.nps.promoters}%</div><div className="bg-gray-300 flex items-center justify-center text-gray-700 text-xs font-medium" style={{width: `${data.nps.passives}%`}}>{data.nps.passives}%</div><div className="bg-red-500 flex items-center justify-center text-white text-xs font-medium" style={{width: `${data.nps.detractors}%`}}>{data.nps.detractors}%</div></div><div className="flex justify-between mt-2 text-xs text-gray-500"><span>Promoters (9-10)</span><span>Passives (7-8)</span><span>Detractors (0-6)</span></div></div>)}
    </div>
  )
}