import { useState } from 'react'
import { Store, Download, Star, CheckCircle, Shield, Code, Users, Search, ExternalLink } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const plugins = [
  { id: 'PLG-001', name: 'Salesforce Sync', category: 'Integration', rating: 4.8, installs: 12400, status: 'installed', verified: true, desc: 'Bi-directional sync with Salesforce CRM', author: 'Cognition Labs', price: 'Free', version: '2.4.1', lastUpdated: '1 week ago', features: ['Contact sync', 'Deal sync', 'Activity logging', 'Custom field mapping'] },
  { id: 'PLG-002', name: 'WhatsApp Business', category: 'Communication', rating: 4.6, installs: 8900, status: 'installed', verified: true, desc: 'Send messages and templates via WhatsApp Business API', author: 'Meta Partners', price: '₦25K/mo', version: '3.1.0', lastUpdated: '3 days ago', features: ['Template messages', 'Rich media', 'Auto-responses', 'Analytics'] },
  { id: 'PLG-003', name: 'Payment Gateway', category: 'Finance', rating: 4.9, installs: 6200, status: 'available', verified: true, desc: 'Accept payments via Paystack, Flutterwave, and bank transfer', author: 'FinTech Connect', price: '₦15K/mo', version: '1.8.2', lastUpdated: '2 weeks ago', features: ['Multi-gateway', 'Auto-reconciliation', 'Invoice generation', 'Receipt emails'] },
  { id: 'PLG-004', name: 'AI Email Writer', category: 'AI', rating: 4.3, installs: 3400, status: 'available', verified: false, desc: 'AI-powered email composition with personalization', author: 'NLP Studio', price: 'Free', version: '0.9.1', lastUpdated: '5 days ago', features: ['Tone adjustment', 'Multi-language', 'Template library', 'A/B testing'] },
  { id: 'PLG-005', name: 'Document Signer', category: 'Productivity', rating: 4.7, installs: 5600, status: 'installed', verified: true, desc: 'E-signature and document workflow automation', author: 'SignFlow', price: '₦10K/mo', version: '2.0.4', lastUpdated: '1 month ago', features: ['E-signatures', 'Audit trail', 'Templates', 'Reminders'] },
  { id: 'PLG-006', name: 'Reporting Pro', category: 'Analytics', rating: 4.5, installs: 7800, status: 'available', verified: true, desc: 'Advanced reporting with custom dashboards and scheduled exports', author: 'DataViz', price: '₦20K/mo', version: '1.5.0', lastUpdated: '2 weeks ago', features: ['Custom dashboards', 'Scheduled reports', 'Data blending', 'White-label'] },
]

const categories = ['All', 'Integration', 'Communication', 'Finance', 'AI', 'Productivity', 'Analytics']

export default function PluginMarketplace() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('pluginmarketplace', () => apiClient.dashboard.metrics(), { fallback: plugins })
  const { tenant } = useTenant()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState(null)

  const filtered = plugins.filter(p => {
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.desc.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = category === 'All' || p.category === category
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter
    return matchesSearch && matchesCategory && matchesStatus
  })

  return (
    <div role="region" aria-label="PluginMarketplace" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Store className="w-7 h-7 text-emerald-600" /> Plugin Marketplace</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Extend {tenant?.name || 'Platform'} with plugins</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[{ l: 'Available Plugins', v: plugins.length }, { l: 'Installed', v: plugins.filter(p => p.status === 'installed').length, c: 'text-emerald-600' }, { l: 'Total Installs', v: plugins.reduce((s, p) => s + p.installs, 0).toLocaleString() }, { l: 'Avg Rating', v: (plugins.reduce((s, p) => s + p.rating, 0) / plugins.length).toFixed(1) + ' ★' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search plugins..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
        <div className="flex gap-1">{categories.map(c => (
          <button key={c} onClick={() => setCategory(c)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${category === c ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>{c}</button>
        ))}</div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"><option value="all">All</option><option value="installed">Installed</option><option value="available">Available</option></select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map(p => (
          <div key={p.id} onClick={() => setSelected(selected === p.id ? null : p.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md ${selected === p.id ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className="flex items-start justify-between mb-2">
              <div><div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900 dark:text-white">{p.name}</h4>{p.verified && <Shield className="w-4 h-4 text-emerald-500" />}{p.status === 'installed' && <CheckCircle className="w-4 h-4 text-emerald-500" />}</div><p className="text-xs text-gray-500 mt-0.5">{p.desc}</p></div>
              <div className="flex items-center gap-1 text-amber-500 text-sm"><Star className="w-3 h-3 fill-current" />{p.rating}</div>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400"><span>{p.author}</span><span>{p.installs.toLocaleString()} installs</span><span>{p.price}</span></div>
            {selected === p.id && (<div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap gap-1 mb-3">{p.features.map(f => <span key={f} className="text-xs px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">{f}</span>)}</div>
              <div className="flex items-center gap-3 text-xs text-gray-400 mb-2"><span>v{p.version}</span><span>Updated {p.lastUpdated}</span></div>
              <div className="flex gap-2">{p.status === 'installed' ? <button className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-700 dark:text-gray-300">Configure</button> : <button className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 flex items-center gap-1"><Download className="w-3 h-3" /> Install</button>}<button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Docs</button></div>
            </div>)}
          </div>
        ))}
      </div>
    </div>
  )
}
