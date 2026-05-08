import { useState } from 'react'
import { Store, Download, Star, CheckCircle, Shield, Code, Users, TrendingUp, Search, Filter, ExternalLink } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const plugins = [
  { id: 'PLG-001', name: 'Salesforce Connector', category: 'Integration', author: 'CRM Core', installs: 12400, rating: 4.8, status: 'installed', price: 'Free', description: 'Bi-directional sync with Salesforce CRM including contacts, deals, and activities', verified: true },
  { id: 'PLG-002', name: 'WhatsApp Business', category: 'Communication', author: 'MessageFlow', installs: 8900, rating: 4.7, status: 'installed', price: 'Free', description: 'Send and receive WhatsApp messages directly from the CRM with template management', verified: true },
  { id: 'PLG-003', name: 'Advanced Analytics', category: 'Analytics', author: 'DataViz Labs', installs: 5200, rating: 4.5, status: 'available', price: '$29/mo', description: 'Custom dashboards, cohort analysis, and predictive models with drag-and-drop builder', verified: true },
  { id: 'PLG-004', name: 'DocuSign eSign', category: 'Documents', author: 'DocuSign', installs: 3800, rating: 4.6, status: 'available', price: '$19/mo', description: 'Electronic signatures integrated directly into deal workflows', verified: true },
  { id: 'PLG-005', name: 'Stripe Payments', category: 'Payments', author: 'Stripe', installs: 7200, rating: 4.9, status: 'installed', price: 'Free', description: 'Accept and manage payments, invoicing, and subscription billing', verified: true },
  { id: 'PLG-006', name: 'Slack Notifications', category: 'Communication', author: 'Slack', installs: 9400, rating: 4.4, status: 'available', price: 'Free', description: 'Real-time CRM notifications in Slack channels with custom routing rules', verified: false },
  { id: 'PLG-007', name: 'HubSpot Migration', category: 'Integration', author: 'MigratePro', installs: 1200, rating: 4.2, status: 'available', price: '$49/mo', description: 'One-click migration from HubSpot including contacts, deals, emails, and workflows', verified: false },
  { id: 'PLG-008', name: 'AI Email Writer', category: 'AI', author: 'WriteSmart', installs: 4100, rating: 4.3, status: 'available', price: '$15/mo', description: 'AI-powered email drafting with personalization and A/B testing built-in', verified: true },
]

export default function PluginMarketplace() {
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')

  const filtered = plugins.filter(p => {
    if (activeTab === 'installed' && p.status !== 'installed') return false
    if (activeTab === 'available' && p.status !== 'available') return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.category.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div role="region" aria-label="PluginMarketplace" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Store className="w-7 h-7 text-violet-600" /> Plugin Marketplace</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Extend your CRM with verified plugins and integrations</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Total Plugins', v: plugins.length }, { l: 'Installed', v: plugins.filter(p => p.status === 'installed').length }, { l: 'Categories', v: [...new Set(plugins.map(p => p.category))].length }, { l: 'Verified', v: plugins.filter(p => p.verified).length }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search plugins..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
        <div className="flex gap-1">{[{ id: 'all', label: 'All' }, { id: 'installed', label: 'Installed' }, { id: 'available', label: 'Available' }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-3 py-2 rounded-lg text-sm ${activeTab === tab.id ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{tab.label}</button>
        ))}</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map(p => (
          <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900 dark:text-white">{p.name}</h4>{p.verified && <Shield className="w-4 h-4 text-blue-500" title="Verified" />}</div>
              <span className={`text-xs px-2 py-0.5 rounded ${p.status === 'installed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>{p.status}</span>
            </div>
            <p className="text-sm text-gray-500 mb-3">{p.description}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs text-gray-400"><span>{p.category}</span><span>{p.installs.toLocaleString()} installs</span><span>★ {p.rating}</span><span className="font-medium text-gray-600 dark:text-gray-300">{p.price}</span></div>
              <button className={`px-3 py-1.5 rounded text-xs font-medium ${p.status === 'installed' ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' : 'bg-violet-600 text-white hover:bg-violet-700'}`}>{p.status === 'installed' ? 'Manage' : 'Install'}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
