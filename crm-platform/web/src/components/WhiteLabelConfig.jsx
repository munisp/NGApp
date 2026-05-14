import { useState } from 'react'
import { Palette, Globe, Eye, CheckCircle, Settings, Image, Type, Save } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge , ErrorState } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const config = {
  branding: { primaryColor: '#0F766E', secondaryColor: '#6366F1', logoUrl: '/logo.svg', favicon: '/favicon.ico', appName: 'NexGen CRM' },
  theme: { mode: 'auto', font: 'Inter', borderRadius: 'rounded-lg', density: 'comfortable' },
  domain: { customDomain: 'crm.acmebank.com', sslStatus: 'active', emailDomain: 'notifications@acmebank.com' },
  features: [
    { name: 'Customer Portal', enabled: true },
    { name: 'API Documentation', enabled: true },
    { name: 'In-App Chat', enabled: false },
    { name: 'Custom Reports', enabled: true },
    { name: 'Mobile App Branding', enabled: false },
    { name: 'SSO Configuration', enabled: true },
  ]
}

export default function WhiteLabelConfig() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('whitelabelconfig', () => apiClient.dashboard.metrics(), { fallback: config })
  const { tenant } = useTenant()
  const [activeTab, setActiveTab] = useState('branding')
  const [previewMode, setPreviewMode] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedFeature, setSelectedFeature] = useState(null)
  const [error, setError] = useState(null)

  if (error) return <ErrorState message={error} />

  return (
    <div role="region" aria-label="WhiteLabelConfig" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Palette className="w-7 h-7 text-pink-600" /> White Label Configuration</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Customize branding for {tenant?.name || 'Platform'}</p></div>
        <div className="flex gap-2"><button onClick={() => setPreviewMode(!previewMode)} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm flex items-center gap-1 text-gray-700 dark:text-gray-300"><Eye className="w-4 h-4" /> {previewMode ? 'Edit' : 'Preview'}</button><button className="px-3 py-2 bg-pink-600 text-white rounded-lg text-sm flex items-center gap-1 hover:bg-pink-700"><Save className="w-4 h-4" /> Save</button><FallbackBadge /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[{ l: 'Custom Domain', v: config.domain.customDomain, c: 'text-emerald-600' }, { l: 'SSL Status', v: config.domain.sslStatus === 'active' ? 'Active' : 'Pending', c: 'text-emerald-600' }, { l: 'Features Enabled', v: config.features.filter(f => f.enabled).length + '/' + config.features.length }, { l: 'Theme', v: config.theme.mode }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['branding', 'theme', 'domain', 'features'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
        ))}
      </div>
      {activeTab === 'branding' && (<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Brand Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="text-xs text-gray-500 block mb-1">App Name</label><input type="text" defaultValue={config.branding.appName} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" /></div>
          <div><label className="text-xs text-gray-500 block mb-1">Logo URL</label><input type="text" defaultValue={config.branding.logoUrl} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" /></div>
          <div><label className="text-xs text-gray-500 block mb-1">Primary Color</label><div className="flex gap-2"><input type="color" defaultValue={config.branding.primaryColor} className="w-10 h-10 rounded border-0 cursor-pointer" /><input type="text" defaultValue={config.branding.primaryColor} className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" /></div></div>
          <div><label className="text-xs text-gray-500 block mb-1">Secondary Color</label><div className="flex gap-2"><input type="color" defaultValue={config.branding.secondaryColor} className="w-10 h-10 rounded border-0 cursor-pointer" /><input type="text" defaultValue={config.branding.secondaryColor} className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" /></div></div>
        </div>
      </div>)}
      {activeTab === 'theme' && (<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Theme Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="text-xs text-gray-500 block mb-1">Theme Mode</label><select defaultValue={config.theme.mode} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"><option>auto</option><option>light</option><option>dark</option></select></div>
          <div><label className="text-xs text-gray-500 block mb-1">Font</label><select defaultValue={config.theme.font} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"><option>Inter</option><option>Roboto</option><option>Open Sans</option><option>Lato</option></select></div>
          <div><label className="text-xs text-gray-500 block mb-1">Border Radius</label><select defaultValue={config.theme.borderRadius} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"><option>rounded-none</option><option>rounded-sm</option><option>rounded-lg</option><option>rounded-xl</option></select></div>
          <div><label className="text-xs text-gray-500 block mb-1">Density</label><select defaultValue={config.theme.density} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"><option>compact</option><option>comfortable</option><option>spacious</option></select></div>
        </div>
      </div>)}
      {activeTab === 'domain' && (<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Domain Settings</h3>
        <div className="space-y-4">
          <div><label className="text-xs text-gray-500 block mb-1">Custom Domain</label><div className="flex gap-2"><input type="text" defaultValue={config.domain.customDomain} className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" /><span className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-xs flex items-center gap-1"><CheckCircle className="w-3 h-3" /> SSL Active</span></div></div>
          <div><label className="text-xs text-gray-500 block mb-1">Email Sender Domain</label><input type="text" defaultValue={config.domain.emailDomain} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" /></div>
        </div>
      </div>)}
      {activeTab === 'features' && (<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Feature Toggles</h3>
        {config.features.map(f => (
          <label key={f.name} className="flex items-center justify-between cursor-pointer p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <span className="text-sm text-gray-700 dark:text-gray-300">{f.name}</span>
            <input type="checkbox" defaultChecked={f.enabled} className="w-4 h-4 rounded border-gray-300 text-pink-600" />
          </label>
        ))}
      </div>)}
    </div>
  )
}
