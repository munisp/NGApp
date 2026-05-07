import { useState } from 'react'
import { Clock, Mail, Phone, MessageSquare, DollarSign, FileText, Shield, AlertTriangle, CheckCircle, Users, Search, Filter, Activity, CreditCard, Building2 } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
const events = [
  { id: 1, type: 'transaction', icon: DollarSign, color: 'bg-emerald-500', title: 'Transfer Completed', desc: '₦500,000 sent to GTBank (TRX-0412-8834)', customer: 'Chinedu Okafor', time: '10:23 AM Today', system: 'Core Banking' },
  { id: 2, type: 'support', icon: MessageSquare, color: 'bg-blue-500', title: 'WhatsApp Message Received', desc: 'Customer reported failed transfer — auto-ticket created', customer: 'Chinedu Okafor', time: '10:25 AM Today', system: 'CRM' },
  { id: 3, type: 'crm', icon: Users, color: 'bg-purple-500', title: 'Health Score Updated', desc: 'Score dropped from 78 to 72 due to open support ticket', customer: 'Chinedu Okafor', time: '10:26 AM Today', system: 'Health Engine' },
  { id: 4, type: 'email', icon: Mail, color: 'bg-indigo-500', title: 'Campaign Email Opened', desc: 'Q2 Trade Finance Promo — opened 3x, clicked pricing link', customer: 'Kano Textiles Ltd', time: '9:45 AM Today', system: 'Campaigns' },
  { id: 5, type: 'call', icon: Phone, color: 'bg-orange-500', title: 'Escalation Call — 32 min', desc: 'Customer complained about service quality. Sentiment: Negative (34%)', customer: 'Kano Textiles Ltd', time: '9:15 AM Today', system: 'Conversation Intel' },
  { id: 6, type: 'compliance', icon: Shield, color: 'bg-red-500', title: 'AML Alert Triggered', desc: 'Unusual transaction pattern detected — ₦15M in 24hrs across 8 accounts', customer: 'Phantom LLC', time: '8:30 AM Today', system: 'Compliance' },
  { id: 7, type: 'banking', icon: CreditCard, color: 'bg-teal-500', title: 'Loan Disbursement', desc: 'SME Working Capital Loan ₦45M disbursed at 16.5% p.a.', customer: 'Flour Mills of Nigeria', time: 'Yesterday 4:15 PM', system: 'Core Banking' },
  { id: 8, type: 'deal', icon: Building2, color: 'bg-violet-500', title: 'Deal Stage Changed', desc: 'Trade Finance Facility moved from Negotiation → Closing (92% probability)', customer: 'Dangote Group', time: 'Yesterday 2:30 PM', system: 'Pipeline' },
  { id: 9, type: 'marketing', icon: Activity, color: 'bg-pink-500', title: 'Journey Step Completed', desc: 'Onboarding Day-7 check-in call completed. Customer satisfied.', customer: 'Ngozi Eze', time: 'Yesterday 11:00 AM', system: 'Journey Orchestrator' },
  { id: 10, type: 'agent', icon: Users, color: 'bg-amber-500', title: 'Agent Visit Logged', desc: 'Field visit to Kano branch. 12 new registrations. GPS verified.', customer: 'Agent: Musa Ibrahim', time: '2 days ago', system: 'Agent Banking' },
]
const typeFilters = ['All', 'Transaction', 'Support', 'CRM', 'Email', 'Call', 'Compliance', 'Banking', 'Deal', 'Marketing', 'Agent']
export default function CustomerTimeline() {
  const { t } = useTranslation()
  const [filterType, setFilterType] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const filtered = events.filter(e => (filterType === 'All' || e.type === filterType.toLowerCase()) && (searchQuery === '' || e.title.toLowerCase().includes(searchQuery.toLowerCase()) || e.customer.toLowerCase().includes(searchQuery.toLowerCase())))
  return (
    <div role="region" aria-label="CustomerTimeline"  className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Clock className="w-7 h-7 text-indigo-600" /> Unified Customer Timeline</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Every interaction across every system in one chronological feed</p>
      </div>
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700" placeholder="Search events or customers..." />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {typeFilters.map(f => (
            <button key={f} onClick={() => setFilterType(f)} className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${filterType === f ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>{f}</button>
          ))}
        </div>
      </div>
      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
        <div className="space-y-4">
          {filtered.map(event => (
            <div key={event.id} className="relative flex items-start gap-4 pl-2">
              <div className={`w-10 h-10 rounded-full ${event.color} flex items-center justify-center text-white z-10 shrink-0`}><event.icon className="w-5 h-5" /></div>
              <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-medium text-gray-900 dark:text-white text-sm">{event.title}</h4>
                  <span className="text-xs text-gray-500">{event.time}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{event.desc}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-blue-600 font-medium">{event.customer}</span>
                  <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full text-gray-500">{event.system}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
