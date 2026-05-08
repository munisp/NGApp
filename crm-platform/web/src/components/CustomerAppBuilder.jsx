import { useState } from 'react'
import { Layout, Plus, Eye, Settings, Code, CheckCircle, Clock, Globe, Users, Layers } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const apps = [
  { id: 'APP-001', name: 'Client Portal', status: 'published', views: 12400, components: 18, lastUpdated: '2 days ago', pages: 8, users: 3200, description: 'Self-service portal for clients to view accounts, statements, and raise requests' },
  { id: 'APP-002', name: 'Partner Dashboard', status: 'published', views: 3200, components: 12, lastUpdated: '1 week ago', pages: 5, users: 890, description: 'Revenue tracking and lead management for channel partners' },
  { id: 'APP-003', name: 'Self-Service Hub', status: 'draft', views: 0, components: 8, lastUpdated: '4 hours ago', pages: 4, users: 0, description: 'Customer self-service for FAQs, ticket creation, and knowledge base' },
  { id: 'APP-004', name: 'Investor Relations', status: 'published', views: 890, components: 6, lastUpdated: '3 days ago', pages: 3, users: 120, description: 'Portfolio performance and regulatory compliance reports' },
]

const componentLibrary = [
  { name: 'Data Table', category: 'Display', uses: 24 },
  { name: 'Chart Widget', category: 'Analytics', uses: 18 },
  { name: 'Form Builder', category: 'Input', uses: 12 },
  { name: 'KPI Card', category: 'Display', uses: 32 },
  { name: 'File Upload', category: 'Input', uses: 8 },
  { name: 'Timeline', category: 'Display', uses: 6 },
]

export default function CustomerAppBuilder() {
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [selected, setSelected] = useState(null)
  const [activeTab, setActiveTab] = useState('apps')

  return (
    <div role="region" aria-label="CustomerAppBuilder" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Layout className="w-7 h-7 text-rose-600" /> Customer App Builder</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Build custom customer-facing apps with drag-and-drop</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Published Apps', v: apps.filter(a => a.status === 'published').length }, { l: 'Total Views', v: apps.reduce((s, a) => s + a.views, 0).toLocaleString() }, { l: 'Total Users', v: apps.reduce((s, a) => s + a.users, 0).toLocaleString() }, { l: 'Components', v: componentLibrary.length }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="border-b border-gray-200 dark:border-gray-700"><div className="flex space-x-6">
        {[{ id: 'apps', label: 'My Apps' }, { id: 'components', label: 'Component Library' }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`pb-3 text-sm font-medium border-b-2 ${activeTab === tab.id ? 'border-rose-600 text-rose-600' : 'border-transparent text-gray-500'}`}>{tab.label}</button>
        ))}
      </div></div>
      {activeTab === 'apps' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {apps.map(app => (
            <div key={app.id} onClick={() => setSelected(selected === app.id ? null : app.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md ${selected === app.id ? 'border-rose-500 ring-1 ring-rose-500' : 'border-gray-200 dark:border-gray-700'}`}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900 dark:text-white">{app.name}</h4>
                <span className={`text-xs px-2 py-0.5 rounded ${app.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{app.status}</span>
              </div>
              <p className="text-sm text-gray-500 mb-3">{app.description}</p>
              <div className="flex items-center gap-3 text-xs text-gray-400"><span>{app.pages} pages</span><span>{app.components} components</span><span>{app.views.toLocaleString()} views</span><span>{app.users.toLocaleString()} users</span></div>
              {selected === app.id && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex gap-2">
                  <button className="px-3 py-1.5 bg-rose-600 text-white rounded text-xs hover:bg-rose-700 flex items-center gap-1"><Settings className="w-3 h-3" /> Edit</button>
                  <button className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1"><Eye className="w-3 h-3" /> Preview</button>
                  <button className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1"><Code className="w-3 h-3" /> Embed</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {activeTab === 'components' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {componentLibrary.map(c => (
            <div key={c.name} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md cursor-pointer">
              <div className="flex items-center gap-2 mb-1"><Layers className="w-4 h-4 text-rose-500" /><h4 className="font-semibold text-gray-900 dark:text-white text-sm">{c.name}</h4></div>
              <div className="flex items-center gap-2 text-xs text-gray-400"><span>{c.category}</span><span>Used {c.uses}x</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
