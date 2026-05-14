import { useState } from 'react'
import { BarChart3, Code, Eye, Copy, Check, ExternalLink, Palette, Settings, Layout, RefreshCw, Users, Globe, Lock, Activity } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { FallbackBadge , ErrorState } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const dashboards = [
  { id: 'emb-001', name: 'Customer Overview', type: 'KPI Dashboard', embedCount: 48, views: 12400, avgSession: '4.2 min', status: 'active', theme: 'light', widgets: ['Revenue Chart', 'Customer Count', 'NPS Score', 'Health Distribution'], audiences: ['Enterprise Clients', 'Partners'] },
  { id: 'emb-002', name: 'Usage Analytics', type: 'Product Metrics', embedCount: 23, views: 8900, avgSession: '3.8 min', status: 'active', theme: 'dark', widgets: ['API Calls', 'Active Users', 'Feature Adoption', 'Error Rates'], audiences: ['Developers', 'Product Managers'] },
  { id: 'emb-003', name: 'Financial Summary', type: 'Executive Report', embedCount: 12, views: 3200, avgSession: '6.1 min', status: 'active', theme: 'branded', widgets: ['Revenue Trend', 'P&L Summary', 'Budget vs Actual', 'Forecast'], audiences: ['C-Suite', 'Board Members'] },
  { id: 'emb-004', name: 'Support Metrics', type: 'Operational', embedCount: 35, views: 15200, avgSession: '2.4 min', status: 'draft', theme: 'light', widgets: ['Ticket Volume', 'Resolution Time', 'CSAT Score', 'SLA Compliance'], audiences: ['Support Team', 'Managers'] },
]

const EmbeddedAnalytics = () => {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('embeddedanalytics', () => apiClient.dashboard.metrics(), { fallback: dashboards })
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('dashboards')
  const [selectedDashboard, setSelectedDashboard] = useState(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(null)

  const copyEmbed = (id) => {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const embedCode = (d) => `<iframe src="https://${tenant?.slug || 'app'}.crm.io/embed/${d.id}" width="100%" height="600" frameborder="0" allow="fullscreen" />`

  if (error) return <ErrorState message={error} />

  return (
    <div role="region" aria-label="EmbeddedAnalytics" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><BarChart3 className="w-7 h-7 text-teal-600" /> Embedded Analytics</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Customer-facing dashboards they embed in their own sites</p>
        </div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { l: 'Active Dashboards', v: dashboards.filter(d => d.status === 'active').length, icon: Layout },
          { l: 'Total Embeds', v: dashboards.reduce((s, d) => s + d.embedCount, 0), icon: Code },
          { l: 'Total Views', v: (dashboards.reduce((s, d) => s + d.views, 0) / 1000).toFixed(1) + 'K', icon: Eye },
          { l: 'Avg Session', v: '4.1 min', icon: Activity },
        ].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-center gap-1.5 mb-1"><s.icon className="w-3.5 h-3.5 text-gray-400" /><p className="text-xs text-gray-500">{s.l}</p></div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex space-x-6">
          {[{ id: 'dashboards', label: 'Dashboards', icon: Layout }, { id: 'embed', label: 'Embed Code', icon: Code }, { id: 'settings', label: 'Settings', icon: Settings }].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`pb-3 text-sm font-medium border-b-2 flex items-center gap-2 ${activeTab === tab.id ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500'}`}>
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'dashboards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {dashboards.map(d => (
            <div key={d.id} onClick={() => setSelectedDashboard(selectedDashboard?.id === d.id ? null : d)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${selectedDashboard?.id === d.id ? 'border-teal-500 ring-1 ring-teal-500' : 'border-gray-200 dark:border-gray-700'}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">{d.name}</h4>
                  <span className="text-xs text-gray-500">{d.type}</span>
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded ${d.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{d.status}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="text-xs text-gray-400">Embeds</p><p className="text-sm font-bold text-gray-900 dark:text-white">{d.embedCount}</p></div>
                <div><p className="text-xs text-gray-400">Views</p><p className="text-sm font-bold text-gray-900 dark:text-white">{d.views.toLocaleString()}</p></div>
                <div><p className="text-xs text-gray-400">Avg Session</p><p className="text-sm font-bold text-gray-900 dark:text-white">{d.avgSession}</p></div>
              </div>
              {selectedDashboard?.id === d.id && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                  <div>
                    <h5 className="text-xs font-medium text-gray-500 mb-1">Widgets</h5>
                    <div className="flex flex-wrap gap-1">{d.widgets.map(w => <span key={w} className="text-xs px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400">{w}</span>)}</div>
                  </div>
                  <div>
                    <h5 className="text-xs font-medium text-gray-500 mb-1">Audiences</h5>
                    <div className="flex flex-wrap gap-1">{d.audiences.map(a => <span key={a} className="text-xs px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">{a}</span>)}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 bg-teal-600 text-white rounded text-xs hover:bg-teal-700 flex items-center gap-1"><Eye className="w-3 h-3" /> Preview</button>
                    <button onClick={(e) => { e.stopPropagation(); copyEmbed(d.id) }} className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1">{copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}{copied ? 'Copied!' : 'Copy Embed'}</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'embed' && (
        <div className="space-y-4">
          {dashboards.filter(d => d.status === 'active').map(d => (
            <div key={d.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900 dark:text-white">{d.name}</h4>
                <button onClick={() => copyEmbed(d.id)} className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1">{copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}{copied ? 'Copied!' : 'Copy'}</button>
              </div>
              <pre className="bg-gray-900 text-green-400 p-3 rounded-lg text-xs overflow-x-auto"><code>{embedCode(d)}</code></pre>
              <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Palette className="w-3 h-3" />Theme: {d.theme}</span>
                <span className="flex items-center gap-1"><Lock className="w-3 h-3" />Auth: Token-based</span>
                <span className="flex items-center gap-1"><Globe className="w-3 h-3" />CORS: Configured</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Palette className="w-5 h-5" /> Theming</h3>
            <div className="space-y-3">
              {['Primary Color', 'Background', 'Font Family', 'Border Radius'].map(setting => (
                <div key={setting} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{setting}</span>
                  <span className="text-sm text-gray-900 dark:text-white">Default</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Lock className="w-5 h-5" /> Security</h3>
            <div className="space-y-3">
              {[{ s: 'Authentication', v: 'JWT Token' }, { s: 'Allowed Domains', v: '*.client.com' }, { s: 'Rate Limiting', v: '100 req/min' }, { s: 'Data Filtering', v: 'Tenant-scoped' }].map(item => (
                <div key={item.s} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{item.s}</span>
                  <span className="text-sm text-gray-900 dark:text-white">{item.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EmbeddedAnalytics
