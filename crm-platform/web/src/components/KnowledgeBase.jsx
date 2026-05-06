import { useState } from 'react'
import { BookOpen, Search, FileText, MessageSquare, ThumbsUp, ThumbsDown, Eye, Clock, TrendingUp, Tag, HelpCircle } from 'lucide-react'
const categories = [
  { name: 'Account Management', articles: 45, views: 12400 },
  { name: 'Transfers & Payments', articles: 38, views: 18900 },
  { name: 'Loans & Credit', articles: 32, views: 8700 },
  { name: 'Cards & POS', articles: 28, views: 6200 },
  { name: 'Mobile & Digital Banking', articles: 24, views: 15600 },
  { name: 'Business Banking', articles: 19, views: 4800 },
]
const articles = [
  { id: 1, title: 'How to reverse a failed NIP transfer', category: 'Transfers & Payments', views: 3420, helpful: 94, updated: '2 days ago', tags: ['NIP', 'reversal', 'transfer'] },
  { id: 2, title: 'Opening a corporate account — requirements', category: 'Account Management', views: 2180, helpful: 89, updated: '1 week ago', tags: ['corporate', 'KYC', 'documents'] },
  { id: 3, title: 'Understanding your SME loan terms', category: 'Loans & Credit', views: 1890, helpful: 92, updated: '3 days ago', tags: ['SME', 'loan', 'interest'] },
  { id: 4, title: 'POS terminal troubleshooting guide', category: 'Cards & POS', views: 4200, helpful: 87, updated: '1 day ago', tags: ['POS', 'troubleshoot', 'terminal'] },
  { id: 5, title: 'Setting up mobile banking alerts', category: 'Mobile & Digital Banking', views: 2800, helpful: 96, updated: '5 days ago', tags: ['mobile', 'alerts', 'notifications'] },
  { id: 6, title: 'Trade finance facility application process', category: 'Business Banking', views: 980, helpful: 91, updated: '1 week ago', tags: ['trade finance', 'LC', 'facility'] },
]
export default function KnowledgeBase() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('articles')
  const filtered = searchQuery ? articles.filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.tags.some(t => t.includes(searchQuery.toLowerCase()))) : articles
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><BookOpen className="w-7 h-7 text-green-600" /> Knowledge Base & Self-Service</h1><p className="text-gray-500 dark:text-gray-400 mt-1">186 articles across 6 categories · 67,600 total views</p></div>
      <div className="grid grid-cols-4 gap-3">{[{ l: 'Articles', v: '186' }, { l: 'Monthly Views', v: '67,600' }, { l: 'Avg Helpful', v: '91.5%' }, { l: 'Deflection Rate', v: '42%' }].map(s => (<div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>))}</div>
      <div className="relative max-w-xl"><Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" /><input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-3 text-sm bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700" placeholder="Search articles, tags, or topics..." /></div>
      <div className="border-b border-gray-200 dark:border-gray-700"><div className="flex space-x-6">{['articles', 'categories'].map(t => (<button key={t} onClick={() => setActiveTab(t)} className={`pb-3 text-sm font-medium capitalize border-b-2 ${activeTab === t ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500'}`}>{t}</button>))}</div></div>
      {activeTab === 'articles' && (<div className="space-y-3">{filtered.map(a => (<div key={a.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:border-green-300 transition-colors cursor-pointer"><div className="flex items-start justify-between"><div><h4 className="font-medium text-gray-900 dark:text-white text-sm">{a.title}</h4><p className="text-xs text-gray-500 mt-1">{a.category} · Updated {a.updated}</p><div className="flex gap-1 mt-2">{a.tags.map(t => (<span key={t} className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{t}</span>))}</div></div><div className="text-right"><div className="flex items-center gap-1 text-xs text-gray-500"><Eye className="w-3 h-3" />{a.views.toLocaleString()}</div><div className="flex items-center gap-1 text-xs text-emerald-600 mt-1"><ThumbsUp className="w-3 h-3" />{a.helpful}%</div></div></div></div>))}</div>)}
      {activeTab === 'categories' && (<div className="grid grid-cols-2 md:grid-cols-3 gap-4">{categories.map(c => (<div key={c.name} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"><BookOpen className="w-6 h-6 text-green-600 mb-2" /><h4 className="font-medium text-gray-900 dark:text-white text-sm">{c.name}</h4><p className="text-xs text-gray-500 mt-1">{c.articles} articles · {c.views.toLocaleString()} views</p></div>))}</div>)}
    </div>
  )
}