import { useState } from 'react'
import { BookOpen, Search, Star, Clock, Eye } from 'lucide-react'
import { FallbackBadge } from '@/components/ui/DataStates'

const articles = [
  { id: 'KB-001', title: 'Getting Started with Trade Finance', category: 'Product', views: 4200, rating: 4.8, lastUpdated: '2 days ago', author: 'Product Team', tags: ['trade-finance', 'onboarding'] },
  { id: 'KB-002', title: 'How to Set Up Recurring Payments', category: 'How-To', views: 3800, rating: 4.6, lastUpdated: '1 week ago', author: 'Support Team', tags: ['payments', 'recurring'] },
  { id: 'KB-003', title: 'Understanding Credit Risk Scores', category: 'Education', views: 2900, rating: 4.5, lastUpdated: '3 days ago', author: 'Risk Team', tags: ['risk', 'scoring', 'MCMC'] },
  { id: 'KB-004', title: 'API Integration Best Practices', category: 'Developer', views: 5100, rating: 4.9, lastUpdated: '1 day ago', author: 'Engineering', tags: ['api', 'integration', 'developer'] },
  { id: 'KB-005', title: 'Compliance Requirements (CBN/NDIC)', category: 'Regulatory', views: 1800, rating: 4.3, lastUpdated: '5 days ago', author: 'Compliance Team', tags: ['compliance', 'CBN', 'regulatory'] },
  { id: 'KB-006', title: 'Troubleshooting NIP Payment Failures', category: 'Troubleshooting', views: 6200, rating: 4.7, lastUpdated: '4 hours ago', author: 'Support Team', tags: ['NIP', 'payments', 'troubleshooting'] },
]

export default function KnowledgeBase() {
  const [search, setSearch] = useState('')

  const filtered = search ? articles.filter(a => a.title.toLowerCase().includes(search.toLowerCase()) || a.tags.some(t => t.includes(search.toLowerCase()))) : articles

  return (
    <div role="region" aria-label="KnowledgeBase" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><BookOpen className="w-7 h-7 text-emerald-600" /> Knowledge Base</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Self-service articles, guides, and documentation</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Articles', v: articles.length }, { l: 'Total Views', v: articles.reduce((s, a) => s + a.views, 0).toLocaleString() }, { l: 'Avg Rating', v: (articles.reduce((s, a) => s + a.rating, 0) / articles.length).toFixed(1) }, { l: 'Categories', v: [...new Set(articles.map(a => a.category))].length }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search knowledge base..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
      <div className="space-y-2">
        {filtered.map(article => (
          <div key={article.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md cursor-pointer">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900 dark:text-white">{article.title}</h4><span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{article.category}</span></div>
              <span className="text-xs text-gray-400 flex items-center gap-1"><Star className="w-3 h-3 text-amber-400" />{article.rating}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500"><span><Eye className="w-3 h-3 inline mr-0.5" />{article.views.toLocaleString()} views</span><span><Clock className="w-3 h-3 inline mr-0.5" />{article.lastUpdated}</span><span>By {article.author}</span></div>
            <div className="flex gap-1 mt-2">{article.tags.map(tag => <span key={tag} className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{tag}</span>)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
