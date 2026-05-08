import { useState } from 'react'
import { Brain, MessageSquare, Sparkles, Send, ArrowRight, CheckCircle, AlertTriangle, TrendingUp, Users, Clock, Zap, Lightbulb } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const suggestions = [
  { type: 'deal', title: 'Schedule QBR with Dangote', confidence: 94, reason: 'No executive contact in 30 days, \u20A62.5B deal at risk', icon: TrendingUp, color: 'border-emerald-500' },
  { type: 'email', title: 'Follow up with MTN CFO', confidence: 88, reason: 'CFO opened proposal 3 times but hasn\'t responded', icon: MessageSquare, color: 'border-blue-500' },
  { type: 'risk', title: 'Kano Textiles escalation overdue', confidence: 92, reason: 'Complaint open 7 days, SLA breach imminent', icon: AlertTriangle, color: 'border-red-500' },
  { type: 'data', title: 'Update Shoprite contact info', confidence: 76, reason: 'Procurement lead changed per LinkedIn', icon: Users, color: 'border-amber-500' },
]

const conversations = [
  { q: 'What\'s the pipeline value for Q2?', a: 'The Q2 pipeline stands at \u20A65.1B across 142 active deals. Enterprise segment contributes 62% (\u20A63.16B). Win probability-weighted forecast is \u20A63.2B.' },
  { q: 'Who are our top at-risk customers?', a: '5 accounts flagged: Kano Textiles (health: 25), Lagos Fresh Markets (22), Abuja Motors (28), Port Harcourt Shipping (31), Ibadan AgriTech (33). Combined ARR at risk: \u20A6148.1M.' },
  { q: 'Compare Sarah vs Ahmed Q1 performance', a: 'Sarah: \u20A61.38B closed (115% quota), 18 deals, 38-day avg cycle. Ahmed: \u20A60.92B (92% quota), 14 deals, 42-day cycle. Sarah excels in Enterprise; Ahmed in mid-market.' },
]

export default function AICoPilot() {
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('suggestions')
  const [query, setQuery] = useState('')

  return (
    <div role="region" aria-label="AICoPilot" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Brain className="w-7 h-7 text-purple-600" /> AI Co-Pilot</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Contextual AI assistant for {tenant?.name || 'your CRM'}</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Suggestions', v: suggestions.length }, { l: 'Conversations', v: conversations.length }, { l: 'Avg Confidence', v: Math.round(suggestions.reduce((s, sg) => s + sg.confidence, 0) / suggestions.length) + '%' }, { l: 'Time Saved', v: '2.4 hrs/day' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="border-b border-gray-200 dark:border-gray-700"><div className="flex space-x-6">
        {[{ id: 'suggestions', label: 'Suggestions' }, { id: 'chat', label: 'Chat' }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`pb-3 text-sm font-medium border-b-2 ${activeTab === tab.id ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500'}`}>{tab.label}</button>
        ))}
      </div></div>
      {activeTab === 'suggestions' && (
        <div className="space-y-2">
          {suggestions.map((s, i) => (
            <div key={i} className={`bg-white dark:bg-gray-800 rounded-xl border-l-4 ${s.color} border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between`}>
              <div className="flex items-start gap-3">
                <s.icon className="w-5 h-5 text-gray-400 mt-0.5" />
                <div><h4 className="font-semibold text-gray-900 dark:text-white">{s.title}</h4><p className="text-sm text-gray-500 mt-0.5">{s.reason}</p></div>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <span className="text-sm font-medium text-gray-900 dark:text-white">{s.confidence}%</span>
                <button className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 flex items-center gap-1"><Zap className="w-3 h-3" /> Act</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {activeTab === 'chat' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
            {conversations.map((c, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-end"><div className="bg-purple-100 dark:bg-purple-900/30 rounded-lg px-3 py-2 max-w-md"><p className="text-sm text-purple-900 dark:text-purple-200">{c.q}</p></div></div>
                <div className="flex justify-start"><div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 max-w-lg"><p className="text-sm text-gray-900 dark:text-white">{c.a}</p></div></div>
              </div>
            ))}
          </div>
          <div className="flex gap-2"><input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Ask the AI Co-Pilot anything..." className="flex-1 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /><button className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 flex items-center gap-1"><Send className="w-4 h-4" /></button></div>
        </div>
      )}
    </div>
  )
}
