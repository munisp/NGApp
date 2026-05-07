import { useState } from 'react'
import { Zap, ArrowRight, Phone, Mail, MessageSquare, Users, DollarSign, Clock, TrendingUp, AlertTriangle, CheckCircle, Star, Target } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
const actions = [
  { id: 1, customer: 'Chinedu Okafor', action: 'Offer overdraft facility', confidence: 92, reason: 'Cash flow pattern shows monthly shortfall days 22-28. ₦2M overdraft would cover gap.', value: '₦180K/yr revenue', type: 'cross-sell', urgency: 'high', channel: 'WhatsApp' },
  { id: 2, customer: 'Kano Textiles Ltd', action: 'Schedule executive sponsor call', confidence: 85, reason: 'Health score dropped 31pts. NPS detractor. Escalated complaint unresolved 7 days.', value: '₦45.2M at risk', type: 'retention', urgency: 'critical', channel: 'Phone' },
  { id: 3, customer: 'Ngozi Eze', action: 'Send corporate account benefits guide', confidence: 78, reason: 'Requested upgrade to corporate tier. High engagement. Send Yoruba-language materials.', value: '₦8.5M potential', type: 'upsell', urgency: 'medium', channel: 'Email' },
  { id: 4, customer: 'Port Harcourt Shipping', action: 'Initiate contract renewal discussion', confidence: 88, reason: 'Contract expires in 45 days. No renewal engagement yet. 3-year customer.', value: '₦67.8M renewal', type: 'retention', urgency: 'high', channel: 'Phone' },
  { id: 5, customer: 'Bala Mohammed', action: 'Send savings account activation SMS', confidence: 65, reason: 'Account dormant 30 days since opening. Initial deposit not yet made.', value: '₦5K activation', type: 'activation', urgency: 'medium', channel: 'SMS' },
  { id: 6, customer: 'Flour Mills of Nigeria', action: 'Present supply chain finance product', confidence: 82, reason: 'Recent ₦45M loan disbursement. Active procurement patterns suggest SCF opportunity.', value: '₦120M facility', type: 'cross-sell', urgency: 'medium', channel: 'Meeting' },
  { id: 7, customer: 'Adamu Trading Co.', action: 'Reactivation call — Hausa language', confidence: 71, reason: 'No login in 45 days. 3 open support tickets. Preferred language: Hausa.', value: '₦12.4M at risk', type: 'retention', urgency: 'high', channel: 'Phone' },
]
const stats = { totalActions: 1842, completed: 1240, conversionRate: '34.2%', revenueGenerated: '₦2.8B' }
const typeColors = { 'cross-sell': 'bg-emerald-100 text-emerald-700', retention: 'bg-red-100 text-red-700', upsell: 'bg-blue-100 text-blue-700', activation: 'bg-purple-100 text-purple-700' }
const urgencyColors = { critical: 'bg-red-600 text-white', high: 'bg-orange-100 text-orange-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-gray-100 text-gray-700' }
export default function NextBestAction() {
  const { t } = useTranslation()
  const [filter, setFilter] = useState('all')
  const filtered = filter === 'all' ? actions : actions.filter(a => a.type === filter)
  return (
    <div role="region" aria-label="NextBestAction"  className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Zap className="w-7 h-7 text-amber-500" /> Predictive Next-Best-Action Engine</h1><p className="text-gray-500 dark:text-gray-400 mt-1">AI-recommended actions for maximum customer impact</p></div>
      <div className="grid grid-cols-4 gap-3">{[{ l: 'Actions Generated', v: stats.totalActions.toLocaleString() }, { l: 'Completed', v: stats.completed.toLocaleString() }, { l: 'Conversion', v: stats.conversionRate }, { l: 'Revenue Impact', v: stats.revenueGenerated }].map(s => (<div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>))}</div>
      <div className="flex gap-2">{['all', 'cross-sell', 'retention', 'upsell', 'activation'].map(f => (<button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs rounded-full capitalize ${filter === f ? 'bg-amber-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600'}`}>{f}</button>))}</div>
      <div className="space-y-3">{filtered.map(a => (
        <div key={a.id} tabIndex="0" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-start justify-between mb-2">
            <div><h4 className="font-medium text-gray-900 dark:text-white">{a.action}</h4><p className="text-xs text-gray-500 mt-0.5">{a.customer} · via {a.channel}</p></div>
            <div className="flex items-center gap-2"><span className={`text-xs px-2 py-0.5 rounded-full ${urgencyColors[a.urgency]}`}>{a.urgency}</span><span className={`text-xs px-2 py-0.5 rounded-full ${typeColors[a.type]}`}>{a.type}</span></div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{a.reason}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-gray-500"><span className="flex items-center gap-1"><Target className="w-3 h-3" />{a.confidence}% confidence</span><span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{a.value}</span></div>
            <div className="flex gap-2"><button className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg">Dismiss</button><button className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 flex items-center gap-1"><ArrowRight className="w-3 h-3" />Execute</button></div>
          </div>
        </div>
      ))}</div>
    </div>
  )
}
