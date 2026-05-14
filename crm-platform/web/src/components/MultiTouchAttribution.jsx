import { useState } from 'react'
import { GitBranch, TrendingUp, DollarSign, Users, BarChart3, Mail, Globe, Phone, Megaphone, Calendar, ArrowRight } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const journeys = [
  { deal: 'Dangote — Trade Finance', value: '\u20A62.5B', outcome: 'won', touches: [
    { channel: 'Content', type: 'Blog post read', attribution: 15, date: 'Jan 12', icon: Globe },
    { channel: 'Email', type: 'Nurture campaign', attribution: 20, date: 'Jan 28', icon: Mail },
    { channel: 'Event', type: 'CFO met at summit', attribution: 35, date: 'Feb 8', icon: Calendar },
    { channel: 'Sales', type: 'Demo presentation', attribution: 20, date: 'Feb 15', icon: Phone },
    { channel: 'Referral', type: 'Board member intro', attribution: 10, date: 'Feb 22', icon: Users },
  ]},
  { deal: 'MTN — Payroll', value: '\u20A6890M', outcome: 'won', touches: [
    { channel: 'LinkedIn', type: 'Sponsored content', attribution: 25, date: 'Feb 1', icon: Globe },
    { channel: 'Website', type: 'Pricing page visit', attribution: 20, date: 'Feb 5', icon: Globe },
    { channel: 'Sales', type: 'Cold outreach', attribution: 30, date: 'Feb 10', icon: Phone },
    { channel: 'Webinar', type: 'Product demo webinar', attribution: 25, date: 'Feb 18', icon: Megaphone },
  ]},
  { deal: 'NNPC — Infrastructure', value: '\u20A61.8B', outcome: 'lost', touches: [
    { channel: 'Event', type: 'Conference booth', attribution: 40, date: 'Dec 5', icon: Calendar },
    { channel: 'Email', type: 'Follow-up sequence', attribution: 30, date: 'Dec 12', icon: Mail },
    { channel: 'Sales', type: 'Proposal sent', attribution: 30, date: 'Jan 8', icon: Phone },
  ]},
]

const channelSummary = [
  { channel: 'Events', revenue: '\u20A61.2B', attributed: 32, deals: 8, costPerLead: '\u20A6120K' },
  { channel: 'Sales Outreach', revenue: '\u20A6980M', attributed: 28, deals: 12, costPerLead: '\u20A645K' },
  { channel: 'Email Campaigns', revenue: '\u20A6720M', attributed: 18, deals: 15, costPerLead: '\u20A68K' },
  { channel: 'Content Marketing', revenue: '\u20A6450M', attributed: 12, deals: 22, costPerLead: '\u20A63K' },
  { channel: 'Paid Digital', revenue: '\u20A6380M', attributed: 10, deals: 18, costPerLead: '\u20A625K' },
]

export default function MultiTouchAttribution() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('multitouchattribution', () => apiClient.dashboard.metrics(), { fallback: journeys })
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('journeys')
  const [search, setSearch] = useState('')
  const [selectedJourney, setSelectedJourney] = useState(null)
  const [outcomeFilter, setOutcomeFilter] = useState('all')
  const filteredJourneys = journeys.filter(j => {
    const matchSearch = !search || j.deal.toLowerCase().includes(search.toLowerCase())
    const matchOutcome = outcomeFilter === 'all' || j.outcome === outcomeFilter
    return matchSearch && matchOutcome
  })

  return (
    <div role="region" aria-label="MultiTouchAttribution" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><GitBranch className="w-7 h-7 text-cyan-600" /> Multi-Touch Attribution</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Track revenue attribution across touchpoints</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Tracked Deals', v: journeys.length }, { l: 'Total Touches', v: journeys.reduce((s, j) => s + j.touches.length, 0) }, { l: 'Top Channel', v: 'Events' }, { l: 'Attributed Revenue', v: '\u20A63.7B' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="border-b border-gray-200 dark:border-gray-700"><div className="flex space-x-6">
        {[{ id: 'journeys', label: 'Customer Journeys' }, { id: 'channels', label: 'Channel Performance' }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`pb-3 text-sm font-medium border-b-2 ${activeTab === tab.id ? 'border-cyan-600 text-cyan-600' : 'border-transparent text-gray-500'}`}>{tab.label}</button>
        ))}
      </div></div>
      {activeTab === 'journeys' && (
        <div className="space-y-4">
          {journeys.map(j => (
            <div key={j.deal} className={`bg-white dark:bg-gray-800 rounded-xl border-l-4 ${j.outcome === 'won' ? 'border-l-emerald-500' : 'border-l-red-500'} border border-gray-200 dark:border-gray-700 p-4`}>
              <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900 dark:text-white">{j.deal}</h4><span className={`text-xs px-2 py-0.5 rounded ${j.outcome === 'won' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{j.outcome}</span></div><span className="font-medium text-gray-900 dark:text-white">{j.value}</span></div>
              <div className="flex items-center gap-1">
                {j.touches.map((touch, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <div className="flex flex-col items-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg min-w-[100px]">
                      <touch.icon className="w-4 h-4 text-gray-400 mb-1" />
                      <span className="text-xs font-medium text-gray-900 dark:text-white">{touch.channel}</span>
                      <span className="text-xs text-gray-400">{touch.type}</span>
                      <span className="text-xs font-bold text-cyan-600 mt-1">{touch.attribution}%</span>
                      <span className="text-xs text-gray-400">{touch.date}</span>
                    </div>
                    {i < j.touches.length - 1 && <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {activeTab === 'channels' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full"><thead className="bg-gray-50 dark:bg-gray-700"><tr>{['Channel', 'Revenue', 'Attribution %', 'Deals', 'Cost/Lead'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {channelSummary.map(c => (
              <tr key={c.channel} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{c.channel}</td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{c.revenue}</td>
                <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full"><div className="h-full bg-cyan-500 rounded-full" style={{ width: `${c.attributed * 3}%` }} /></div><span className="text-xs text-gray-500">{c.attributed}%</span></div></td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{c.deals}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{c.costPerLead}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
      )}
    </div>
  )
}
