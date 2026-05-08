import { Clock, Mail, Phone, AlertTriangle, DollarSign, Calendar, MessageSquare, CreditCard, FileText, Star } from 'lucide-react'
import { FallbackBadge } from '@/components/ui/DataStates'

const timeline = [
  { date: 'May 4, 2026', events: [
    { time: '14:32', type: 'email', icon: Mail, desc: 'Sarah Okonkwo sent proposal to Dangote CFO', detail: 'Trade Finance Expansion — ₦2.5B', color: 'text-blue-500' },
    { time: '11:15', type: 'call', icon: Phone, desc: 'Discovery call with MTN HR Director', detail: 'Duration: 45 min — Discussed payroll automation needs', color: 'text-emerald-500' },
    { time: '09:00', type: 'alert', icon: AlertTriangle, desc: 'Health alert: Kano Textiles dropped to 25', detail: 'Win-Back Campaign auto-triggered', color: 'text-red-500' },
  ]},
  { date: 'May 3, 2026', events: [
    { time: '16:45', type: 'deal', icon: DollarSign, desc: 'Lafarge Cement deal closed — Won', detail: '₦450M — 28 day cycle — Beat Access Bank', color: 'text-emerald-500' },
    { time: '14:20', type: 'meeting', icon: Calendar, desc: 'QBR with Port Harcourt Shipping', detail: 'Attendees: CEO, CFO, CSM — Renewal discussed', color: 'text-purple-500' },
    { time: '10:30', type: 'ticket', icon: MessageSquare, desc: 'Support ticket escalated: Kano Textiles', detail: 'Billing discrepancy — Priority: Critical', color: 'text-red-500' },
  ]},
  { date: 'May 2, 2026', events: [
    { time: '15:00', type: 'payment', icon: CreditCard, desc: 'Invoice paid: Dangote Industries', detail: '₦142M — Q1 Trade Finance fees', color: 'text-emerald-500' },
    { time: '11:45', type: 'doc', icon: FileText, desc: 'NDA signed: Zenith Pharma', detail: 'Cleared for detailed product demo', color: 'text-blue-500' },
    { time: '09:15', type: 'nps', icon: Star, desc: 'NPS response: Total Energies — Score 2', detail: 'Detractor — FX outage complaints', color: 'text-red-500' },
  ]},
]

export default function CustomerTimeline() {
  return (
    <div role="region" aria-label="CustomerTimeline" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Clock className="w-7 h-7 text-indigo-600" /> Customer Timeline</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Unified activity timeline across all touchpoints</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Events (7d)', v: timeline.reduce((s, d) => s + d.events.length, 0) }, { l: 'Channels', v: 8 }, { l: 'Active Customers', v: '43,242' }, { l: 'Last Event', v: '2 min ago' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="space-y-6">
        {timeline.map(day => (
          <div key={day.date}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{day.date}</h3>
            <div className="space-y-1 ml-2">
              {day.events.map((event, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex flex-col items-center"><event.icon className={`w-4 h-4 ${event.color} mt-0.5`} />{i < day.events.length - 1 && <div className="w-0.5 h-8 bg-gray-200 dark:bg-gray-700" />}</div>
                  <div className="pb-3">
                    <div className="flex items-center gap-2"><span className="text-xs text-gray-400">{event.time}</span><span className="text-sm font-medium text-gray-900 dark:text-white">{event.desc}</span></div>
                    <p className="text-xs text-gray-500">{event.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
