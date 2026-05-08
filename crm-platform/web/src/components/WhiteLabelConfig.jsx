import { useState } from 'react'
import { Palette, Globe, Users, Eye, CheckCircle, Settings, Image, Type } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const resellers = [
  { id: 'WL-001', name: 'PayTech Partners', domain: 'crm.paytech.ng', primaryColor: '#2563EB', users: 1240, status: 'active', plan: 'Enterprise', mrr: '₦2.4M', features: ['Custom domain', 'Logo', 'Email templates', 'SSO'] },
  { id: 'WL-002', name: 'FinServ Solutions', domain: 'crm.finserv.com', primaryColor: '#059669', users: 890, status: 'active', plan: 'Professional', mrr: '₦1.8M', features: ['Custom domain', 'Logo', 'Email templates'] },
  { id: 'WL-003', name: 'AfriBank Group', domain: 'crm.afribank.ng', primaryColor: '#7C3AED', users: 2400, status: 'active', plan: 'Enterprise', mrr: '₦4.2M', features: ['Custom domain', 'Logo', 'Email templates', 'SSO', 'API access'] },
  { id: 'WL-004', name: 'MicroLend Africa', domain: 'crm.microlend.co', primaryColor: '#DC2626', users: 340, status: 'pending', plan: 'Starter', mrr: '₦0.6M', features: ['Logo', 'Email templates'] },
]

export default function WhiteLabelConfig() {
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [selected, setSelected] = useState(null)

  return (
    <div role="region" aria-label="WhiteLabelConfig" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Palette className="w-7 h-7 text-pink-600" /> White-Label Configuration</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Customize branding for resellers and partners</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Resellers', v: resellers.length }, { l: 'Active', v: resellers.filter(r => r.status === 'active').length }, { l: 'Total Users', v: resellers.reduce((s, r) => s + r.users, 0).toLocaleString() }, { l: 'Total MRR', v: '\u20A69.0M' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="space-y-2">
        {resellers.map(r => (
          <div key={r.id} onClick={() => setSelected(selected === r.id ? null : r.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md transition-all ${selected === r.id ? 'border-pink-500 ring-1 ring-pink-500' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: r.primaryColor }}><Type className="w-4 h-4 text-white" /></div>
                <div>
                  <div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900 dark:text-white">{r.name}</h4><span className={`text-xs px-1.5 py-0.5 rounded ${r.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span></div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5"><span><Globe className="w-3 h-3 inline mr-1" />{r.domain}</span><span>{r.users.toLocaleString()} users</span><span>{r.plan}</span><span>{r.mrr}/mo</span></div>
                </div>
              </div>
            </div>
            {selected === r.id && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <h5 className="text-xs font-medium text-gray-500 mb-2">Enabled Features</h5>
                <div className="flex flex-wrap gap-1">{r.features.map(f => <span key={f} className="text-xs px-2 py-0.5 rounded bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-400">{f}</span>)}</div>
                <div className="flex gap-2 mt-3">
                  <button className="px-3 py-1.5 bg-pink-600 text-white rounded text-xs hover:bg-pink-700 flex items-center gap-1"><Settings className="w-3 h-3" /> Configure</button>
                  <button className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1"><Eye className="w-3 h-3" /> Preview</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
