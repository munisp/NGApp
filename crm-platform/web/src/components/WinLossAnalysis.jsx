import { useState } from 'react'
import { Target, BarChart3, Users, TrendingUp, Clock, Search, Filter, CheckCircle, AlertTriangle, Settings, ArrowRight } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
const tabs = ['Overview', 'Details', 'Settings']
const items = [
  { id: 1, name: 'Item Alpha', status: 'active', value: 'High', updated: '2 hours ago' },
  { id: 2, name: 'Item Beta', status: 'active', value: 'Medium', updated: '4 hours ago' },
  { id: 3, name: 'Item Gamma', status: 'pending', value: 'High', updated: '1 day ago' },
  { id: 4, name: 'Item Delta', status: 'active', value: 'Low', updated: '2 days ago' },
  { id: 5, name: 'Item Epsilon', status: 'inactive', value: 'Medium', updated: '3 days ago' },
]
export default function WinLossAnalysis() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('Overview')
  return (
    <div role="region" aria-label="WinLossAnalysis"  className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Target className="w-7 h-7 text-white p-1 rounded-lg bg-orange-600" /> Post-deal analysis with AI-categorized reasons</h1></div>
      <div className="grid grid-cols-4 gap-3">{[{ l: "Deals Analyzed", v: "342" }, { l: "Win Rate", v: "34.2%" }, { l: "Top Loss Reason", v: "Pricing" }, { l: "Avg Cycle", v: "34 days" }, ].flat().map(s => (<div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>))}</div>
      <div className="border-b border-gray-200 dark:border-gray-700"><div className="flex space-x-6">{tabs.map(t => (<button key={t} onClick={() => setActiveTab(t)} className={`pb-3 text-sm font-medium border-b-2 ${activeTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>{t}</button>))}</div></div>
      {activeTab === 'Overview' && (<div tabIndex="0" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"><table className="w-full"><thead className="bg-gray-50 dark:bg-gray-700"><tr>{['Name', 'Status', 'Value', 'Updated', 'Action'].map(h => (<th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>))}</tr></thead><tbody className="divide-y divide-gray-200 dark:divide-gray-700">{items.map(item => (<tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50"><td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{item.name}</td><td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${item.status === 'active' ? 'bg-emerald-100 text-emerald-700' : item.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{item.status}</span></td><td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{item.value}</td><td className="px-4 py-3 text-xs text-gray-500">{item.updated}</td><td className="px-4 py-3"><button className="text-xs text-blue-600 hover:text-blue-700">View</button></td></tr>))}</tbody></table></div>)}
      {activeTab === 'Details' && (<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"><h3 className="font-semibold text-gray-900 dark:text-white mb-4">Detailed Analytics</h3><p className="text-sm text-gray-600 dark:text-gray-400">Comprehensive analytics and detailed breakdowns for this module. Configure settings and view historical trends.</p></div>)}
      {activeTab === 'Settings' && (<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"><h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Settings className="w-5 h-5" /> Configuration</h3><p className="text-sm text-gray-600 dark:text-gray-400">Manage settings, integrations, and automation rules for this module.</p></div>)}
    </div>
  )
}