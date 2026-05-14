import { useState } from 'react'
import { BookOpen, Search, Plus, Tag, Clock, ThumbsUp, Eye } from 'lucide-react'
import { FallbackBadge , ErrorState } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const articles = [
  { id: 'KB-001', title: 'How to Set Up Trade Finance Module', category: 'Banking', status: 'published', views: 4200, helpful: 89, author: 'Sarah Okonkwo', updated: '2 days ago', tags: ['trade-finance', 'setup', 'banking'], excerpt: 'Step-by-step guide to configuring trade finance workflows including LC issuance, document collection, and settlement.' },
  { id: 'KB-002', title: 'API Authentication Best Practices', category: 'Developer', status: 'published', views: 3800, helpful: 92, author: 'Dev Team', updated: '1 week ago', tags: ['api', 'security', 'authentication'], excerpt: 'OAuth 2.0 implementation guide, API key management, and rate limiting configuration.' },
  { id: 'KB-003', title: 'Troubleshooting SIM Activation Failures', category: 'Telco', status: 'published', views: 2100, helpful: 76, author: 'Chidi Obi', updated: '3 days ago', tags: ['sim', 'troubleshooting', 'telco'], excerpt: 'Common causes of SIM activation failures and resolution steps for eSIM and physical SIMs.' },
  { id: 'KB-004', title: 'Commodity Trading Desk User Guide', category: 'Commodity', status: 'published', views: 890, helpful: 84, author: 'Ahmed Musa', updated: '5 days ago', tags: ['trading', 'commodity', 'guide'], excerpt: 'Complete guide to the trading desk including order entry, position management, and P&L tracking.' },
  { id: 'KB-005', title: 'Multi-Tenant Configuration', category: 'Admin', status: 'draft', views: 0, helpful: 0, author: 'Admin Team', updated: 'Today', tags: ['admin', 'multi-tenant', 'setup'], excerpt: 'How to configure tenant-specific settings, product gating, and vertical customization.' },
  { id: 'KB-006', title: 'FX Rate Alert Configuration', category: 'Banking', status: 'published', views: 1450, helpful: 88, author: 'Fatima Ibrahim', updated: '1 day ago', tags: ['fx', 'alerts', 'banking'], excerpt: 'Set up automated FX rate alerts, CBN compliance thresholds, and notification preferences.' },
]

const categories = ['All', 'Banking', 'Telco', 'Commodity', 'Developer', 'Admin']

export default function KnowledgeBase() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('knowledgebase', () => apiClient.dashboard.metrics(), { fallback: articles })
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showCreateArticle, setShowCreateArticle] = useState(false)
  const [formData, setFormData] = useState({})
  const [error, setError] = useState(null)

  const filtered = articles.filter(a => {
    const matchesSearch = !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.tags.some(t => t.includes(search.toLowerCase()))
    const matchesCategory = category === 'All' || a.category === category
    return matchesSearch && matchesCategory
  })

  const handleCreateArticle = (e) => {
    e.preventDefault()
    const newArticle = { id: 'article-' + Date.now(), ...formData, createdAt: new Date().toISOString(), status: 'active' }
    setFormData({})
    setShowCreateArticle(false)
  }

  if (error) return <ErrorState message={error} />

  return (
    <div role="region" aria-label="KnowledgeBase" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><BookOpen className="w-7 h-7 text-violet-600" /> Knowledge Base</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Internal knowledge articles and documentation</p></div>
        <div className="flex gap-2"><button onClick={() => setShowCreateForm(!showCreateForm)} className="px-3 py-2 bg-violet-600 text-white rounded-lg text-sm flex items-center gap-1 hover:bg-violet-700"><Plus className="w-4 h-4" /> New Article</button><FallbackBadge /></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[{ l: 'Total Articles', v: articles.length }, { l: 'Published', v: articles.filter(a => a.status === 'published').length, c: 'text-emerald-600' }, { l: 'Total Views', v: articles.reduce((s, a) => s + a.views, 0).toLocaleString() }, { l: 'Avg Helpful', v: Math.round(articles.filter(a => a.helpful > 0).reduce((s, a) => s + a.helpful, 0) / articles.filter(a => a.helpful > 0).length) + '%', c: 'text-emerald-600' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>

      {showCreateForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-violet-200 dark:border-violet-900/50 p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">Create New Article</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">Title</label><input type="text" placeholder="Article title" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Category</label><select className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">{categories.filter(c => c !== 'All').map(c => `<option>${c}</option>`).join('')}<option>Banking</option><option>Telco</option><option>Commodity</option><option>Developer</option><option>Admin</option></select></div>
          </div>
          <div><label className="text-xs text-gray-500 block mb-1">Content</label><textarea rows={4} placeholder="Write article content..." className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" /></div>
          <div className="flex gap-2"><button className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700">Publish</button><button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300">Save Draft</button><button onClick={() => setShowCreateForm(false)} className="px-4 py-2 text-sm text-gray-500">Cancel</button></div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search articles, tags..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
        <div className="flex gap-1">{categories.map(c => (
          <button key={c} onClick={() => setCategory(c)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${category === c ? 'bg-violet-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}>{c}</button>
        ))}</div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && <div className="text-center py-8 text-gray-500 dark:text-gray-400">No records found</div>}
          {filtered.map(a => (
          <div key={a.id} onClick={() => setSelectedArticle(selectedArticle === a.id ? null : a.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md ${selectedArticle === a.id ? 'border-violet-500 ring-1 ring-violet-500' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900 dark:text-white">{a.title}</h4><span className={`text-xs px-2 py-0.5 rounded ${a.status === 'published' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>{a.status}</span><span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{a.category}</span></div>
                <p className="text-xs text-gray-500 mt-0.5">{a.excerpt}</p>
              </div>
              <div className="text-right text-xs text-gray-400 ml-4"><div className="flex items-center gap-1"><Eye className="w-3 h-3" />{a.views.toLocaleString()}</div><div className="flex items-center gap-1 mt-0.5"><ThumbsUp className="w-3 h-3" />{a.helpful}%</div></div>
            </div>
            {selectedArticle === a.id && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-4 text-xs text-gray-500 mb-2"><span>By {a.author}</span><span><Clock className="w-3 h-3 inline mr-0.5" />Updated {a.updated}</span></div>
                <div className="flex gap-1 mb-3">{a.tags.map(t => <span key={t} className="text-xs px-2 py-0.5 rounded bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400"><Tag className="w-3 h-3 inline mr-0.5" />{t}</span>)}</div>
                <div className="flex gap-2"><button className="px-3 py-1.5 bg-violet-600 text-white rounded text-xs hover:bg-violet-700">Read Full Article</button><button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Edit</button><button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Share</button></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
