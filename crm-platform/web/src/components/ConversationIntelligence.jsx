import { useState } from 'react'
import { Mic, Phone, TrendingUp, TrendingDown, AlertTriangle, Clock, Users, BarChart3, MessageSquare, ThumbsUp, ThumbsDown, Play, Search, Filter, Star } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'

const tenantData = {
  'acme-bank': {
    stats: { totalCalls: 8420, avgDuration: '12.4 min', avgSentiment: 78, objections: 1240, actionItems: 3680, competitorMentions: 342 },
    calls: [
      { id: 'call-1', customer: 'Chinedu Okafor', agent: 'Sarah Okonkwo', duration: '18:42', sentiment: 85, outcome: 'positive', date: 'Today 10:23', topics: ['Transfer issue', 'NIP reversal'], actionItems: 2, channel: 'phone' },
      { id: 'call-2', customer: 'Kano Textiles Ltd', agent: 'Ahmed Musa', duration: '32:15', sentiment: 34, outcome: 'negative', date: 'Today 09:15', topics: ['Complaint escalation', 'Service quality'], actionItems: 4, channel: 'phone' },
      { id: 'call-3', customer: 'Ngozi Eze', agent: 'David Chen', duration: '8:55', sentiment: 92, outcome: 'positive', date: 'Yesterday', topics: ['Account upgrade', 'Corporate tier'], actionItems: 1, channel: 'video' },
      { id: 'call-4', customer: 'Olumide Adeyemi', agent: 'Fatima Ali', duration: '24:30', sentiment: 45, outcome: 'neutral', date: 'Yesterday', topics: ['Fraud dispute', 'Unauthorized transaction'], actionItems: 3, channel: 'phone' },
      { id: 'call-5', customer: 'Port Harcourt Shipping', agent: 'Sarah Okonkwo', duration: '15:20', sentiment: 71, outcome: 'positive', date: '2 days ago', topics: ['Contract renewal', 'Trade finance'], actionItems: 2, channel: 'phone' },
    ],
    insights: [
      { type: 'objection', text: '"Interest rates too high" mentioned in 23% of loan discussions', trend: 'up', count: 89 },
      { type: 'competitor', text: 'GTBank mentioned in 15% of commercial account calls', trend: 'up', count: 52 },
      { type: 'positive', text: '"Fast resolution" praised in 67% of support calls', trend: 'up', count: 2840 },
      { type: 'risk', text: '12 Enterprise accounts mentioned "switching banks" this month', trend: 'up', count: 12 },
      { type: 'opportunity', text: 'Insurance cross-sell opportunity detected in 340 conversations', trend: 'stable', count: 340 },
    ],
    moments: [
      { call: 'Kano Textiles Ltd', time: '14:22', type: 'frustration', text: '"This is the third time I\'m calling about the same issue. Nobody seems to care about our business."', severity: 'high' },
      { call: 'Olumide Adeyemi', time: '8:45', type: 'buying_intent', text: '"If you can match the rate Access Bank offered, we\'ll move all our accounts to you."', severity: 'high' },
      { call: 'Ngozi Eze', time: '5:30', type: 'delight', text: '"Your agent in Victoria Island was incredibly helpful. That\'s why we want to upgrade."', severity: 'low' },
    ],
  },
  'nextgen-mfb': {
    stats: { totalCalls: 1240, avgDuration: '6.8 min', avgSentiment: 72, objections: 320, actionItems: 890, competitorMentions: 45 },
    calls: [
      { id: 'call-10', customer: 'Aisha Yusuf', agent: 'Binta Hassan', duration: '5:20', sentiment: 65, outcome: 'neutral', date: 'Today', topics: ['USSD issues', 'Micro-loan'], actionItems: 1, channel: 'phone' },
    ],
    insights: [
      { type: 'objection', text: '"USSD not working" reported in 45% of support calls', trend: 'up', count: 156 },
    ],
    moments: [],
  },
}

export default function ConversationIntelligence() {
  const { tenantId } = useTenant()
  const [activeTab, setActiveTab] = useState('calls')
  const data = tenantData[tenantId] || tenantData['acme-bank']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Mic className="w-7 h-7 text-indigo-600" /> Conversation Intelligence
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">AI-powered analysis of {data.stats.totalCalls.toLocaleString()} customer interactions</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: 'Total Calls', value: data.stats.totalCalls.toLocaleString(), color: 'text-blue-600' },
          { label: 'Avg Duration', value: data.stats.avgDuration, color: 'text-gray-900 dark:text-white' },
          { label: 'Avg Sentiment', value: `${data.stats.avgSentiment}%`, color: data.stats.avgSentiment >= 70 ? 'text-emerald-600' : 'text-amber-600' },
          { label: 'Objections', value: data.stats.objections.toLocaleString(), color: 'text-red-600' },
          { label: 'Action Items', value: data.stats.actionItems.toLocaleString(), color: 'text-purple-600' },
          { label: 'Competitor Mentions', value: data.stats.competitorMentions, color: 'text-orange-600' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex space-x-6">
          {['calls', 'insights', 'moments'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium capitalize border-b-2 transition-colors ${activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>
              {tab === 'moments' ? 'Key Moments' : tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'calls' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                {['Customer', 'Agent', 'Duration', 'Sentiment', 'Topics', 'Actions', 'Date'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data.calls.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white text-sm">{c.customer}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{c.agent}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" />{c.duration}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-gray-200 dark:bg-gray-600 rounded-full">
                        <div className={`h-full rounded-full ${c.sentiment >= 70 ? 'bg-emerald-500' : c.sentiment >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${c.sentiment}%` }} />
                      </div>
                      <span className="text-xs font-medium">{c.sentiment}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.topics.map(t => <span key={t} className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{t}</span>)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-purple-600 font-medium">{c.actionItems}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{c.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="space-y-3">
          {data.insights.map((insight, i) => (
            <div key={i} className={`p-4 rounded-xl border ${insight.type === 'risk' ? 'bg-red-50 dark:bg-red-900/20 border-red-200' : insight.type === 'opportunity' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200' : insight.type === 'competitor' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200' : insight.type === 'positive' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200'}`}>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-900 dark:text-white">{insight.text}</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{insight.count}x</span>
                  {insight.trend === 'up' ? <TrendingUp className="w-4 h-4 text-red-500" /> : <BarChart3 className="w-4 h-4 text-gray-400" />}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'moments' && (
        <div className="space-y-4">
          {data.moments.map((m, i) => (
            <div key={i} className={`p-4 rounded-xl border-l-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${m.type === 'frustration' ? 'border-l-red-500' : m.type === 'buying_intent' ? 'border-l-emerald-500' : 'border-l-blue-500'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.type === 'frustration' ? 'bg-red-100 text-red-700' : m.type === 'buying_intent' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                  {m.type.replace('_', ' ')}
                </span>
                <span className="text-xs text-gray-500">{m.call} · {m.time}</span>
              </div>
              <blockquote className="text-sm text-gray-900 dark:text-white italic">"{m.text}"</blockquote>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
