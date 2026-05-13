import { useState } from 'react'
import { Clock, Mail, Phone, AlertTriangle, DollarSign, Calendar, MessageSquare, CreditCard, FileText, Star, Filter, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const eventTypes = ['all', 'email', 'call', 'alert', 'deal', 'meeting', 'ticket', 'payment', 'doc', 'nps']
const iconMap = { email: Mail, call: Phone, alert: AlertTriangle, deal: DollarSign, meeting: Calendar, ticket: MessageSquare, payment: CreditCard, doc: FileText, nps: Star }
const colorMap = { email: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20', call: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20', alert: 'text-red-500 bg-red-50 dark:bg-red-900/20', deal: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20', meeting: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20', ticket: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20', payment: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-900/20', doc: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20', nps: 'text-pink-500 bg-pink-50 dark:bg-pink-900/20' }

const timeline = [
  { date: 'May 4, 2026', events: [
    { time: '14:32', type: 'email', desc: 'Sarah Okonkwo sent proposal to Dangote CFO', detail: 'Trade Finance Expansion — ₦2.5B', customer: 'Dangote Industries', impact: 'high' },
    { time: '11:15', type: 'call', desc: 'Discovery call with MTN HR Director', detail: 'Duration: 45 min — Discussed payroll automation needs', customer: 'MTN Nigeria', impact: 'medium' },
    { time: '09:00', type: 'alert', desc: 'Health alert: Kano Textiles dropped to 25', detail: 'Win-Back Campaign auto-triggered', customer: 'Kano Textiles', impact: 'critical' },
    { time: '08:45', type: 'payment', desc: 'Subscription renewal processed', detail: 'Shoprite Nigeria — ₦18.5M quarterly payment', customer: 'Shoprite Nigeria', impact: 'low' },
  ]},
  { date: 'May 3, 2026', events: [
    { time: '16:45', type: 'deal', desc: 'Lafarge Cement deal closed — Won', detail: '₦450M — 28 day cycle — Beat Access Bank', customer: 'Lafarge Cement', impact: 'high' },
    { time: '14:20', type: 'meeting', desc: 'QBR with Port Harcourt Shipping', detail: 'Attendees: CEO, CFO, CSM — Renewal discussed', customer: 'PH Shipping', impact: 'medium' },
    { time: '10:30', type: 'ticket', desc: 'Support ticket escalated: Kano Textiles', detail: 'Billing discrepancy — Priority: Critical', customer: 'Kano Textiles', impact: 'critical' },
    { time: '09:15', type: 'doc', desc: 'Contract amendment drafted', detail: 'Zenith Pharma — Extended payment terms', customer: 'Zenith Pharma', impact: 'medium' },
  ]},
  { date: 'May 2, 2026', events: [
    { time: '15:00', type: 'payment', desc: 'Invoice paid: Dangote Industries', detail: '₦142M — Q1 Trade Finance fees', customer: 'Dangote Industries', impact: 'high' },
    { time: '11:45', type: 'doc', desc: 'NDA signed: Zenith Pharma', detail: 'Cleared for detailed product demo', customer: 'Zenith Pharma', impact: 'medium' },
    { time: '09:15', type: 'nps', desc: 'NPS response: Total Energies — Score 2', detail: 'Detractor — FX outage complaints', customer: 'Total Energies', impact: 'critical' },
    { time: '08:00', type: 'call', desc: 'Follow-up with Shoprite regional manager', detail: 'Duration: 22 min — POS integration timeline', customer: 'Shoprite Nigeria', impact: 'low' },
  ]},
  { date: 'May 1, 2026', events: [
    { time: '17:30', type: 'email', desc: 'Quarterly report sent to C-suite', detail: 'Revenue up 12% QoQ — 4 new enterprise clients', customer: 'Internal', impact: 'low' },
    { time: '13:00', type: 'meeting', desc: 'Pipeline review with sales team', detail: '₦9.1B pipeline — 28 qualified opportunities', customer: 'Internal', impact: 'medium' },
    { time: '10:00', type: 'alert', desc: 'Churn risk: Total Energies', detail: 'Competitor pricing detected — Retention offer drafted', customer: 'Total Energies', impact: 'critical' },
  ]},
]

export default function CustomerTimeline() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('customertimeline', () => apiClient.dashboard.metrics(), { fallback: timeline })
  const [activeFilter, setActiveFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [expandedEvents, setExpandedEvents] = useState(new Set())
  const [impactFilter, setImpactFilter] = useState('all')

  const toggleExpand = (key) => {
    setExpandedEvents(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const filteredTimeline = timeline.map(day => ({
    ...day,
    events: day.events.filter(e => {
      const matchesType = activeFilter === 'all' || e.type === activeFilter
      const matchesSearch = !search || e.desc.toLowerCase().includes(search.toLowerCase()) || e.customer.toLowerCase().includes(search.toLowerCase()) || e.detail.toLowerCase().includes(search.toLowerCase())
      const matchesImpact = impactFilter === 'all' || e.impact === impactFilter
      return matchesType && matchesSearch && matchesImpact
    })
  })).filter(day => day.events.length > 0)

  const totalEvents = timeline.reduce((s, d) => s + d.events.length, 0)
  const criticalCount = timeline.reduce((s, d) => s + d.events.filter(e => e.impact === 'critical').length, 0)
  const todayCount = timeline[0]?.events.length || 0

  return (
    <div role="region" aria-label="CustomerTimeline" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Clock className="w-7 h-7 text-indigo-600" /> Customer Timeline</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Unified activity timeline across all touchpoints</p></div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Total Events (7d)', v: totalEvents }, { l: 'Today', v: todayCount }, { l: 'Critical Alerts', v: criticalCount, c: 'text-red-600' }, { l: 'Unique Customers', v: [...new Set(timeline.flatMap(d => d.events.map(e => e.customer)))].length }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search events, customers, details..." className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
          <select value={impactFilter} onChange={e => setImpactFilter(e.target.value)} className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white">
            <option value="all">All Impact</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div className="flex gap-1 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400 mt-1 mr-1" />
          {eventTypes.map(type => (
            <button key={type} onClick={() => setActiveFilter(type)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeFilter === type ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
              {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {filteredTimeline.length === 0 && (
          <div className="text-center py-12 text-gray-500">No events match your filters</div>
        )}
        {filteredTimeline.map(day => (
          <div key={day.date}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />{day.date}
              <span className="text-xs font-normal text-gray-400">({day.events.length} events)</span>
            </h3>
            <div className="space-y-1 ml-2">
              {day.events.map((event, i) => {
                const key = `${day.date}-${i}`
                const Icon = iconMap[event.type] || Clock
                const colors = colorMap[event.type] || 'text-gray-500 bg-gray-50 dark:bg-gray-700'
                const isExpanded = expandedEvents.has(key)
                return (
                  <div key={key} className="flex items-start gap-3 group">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colors.split(' ').slice(1).join(' ')}`}>
                        <Icon className={`w-4 h-4 ${colors.split(' ')[0]}`} />
                      </div>
                      {i < day.events.length - 1 && <div className="w-0.5 flex-1 min-h-[16px] bg-gray-200 dark:bg-gray-700" />}
                    </div>
                    <div className="flex-1 pb-3">
                      <button onClick={() => toggleExpand(key)} className="w-full text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 font-mono">{event.time}</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{event.desc}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${event.impact === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : event.impact === 'high' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>{event.impact}</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100" />}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{event.detail}</p>
                      </button>
                      {isExpanded && (
                        <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-xs space-y-1">
                          <div className="flex justify-between"><span className="text-gray-500">Customer</span><span className="text-gray-900 dark:text-white font-medium">{event.customer}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="capitalize text-gray-900 dark:text-white">{event.type}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Impact</span><span className={`font-medium ${event.impact === 'critical' ? 'text-red-600' : event.impact === 'high' ? 'text-amber-600' : 'text-gray-600'}`}>{event.impact}</span></div>
                          <div className="flex gap-2 mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                            <button className="px-2 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700">View Details</button>
                            <button className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600">Add Note</button>
                            <button className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600">Create Task</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
