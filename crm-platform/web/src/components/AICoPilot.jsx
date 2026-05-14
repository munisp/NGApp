import { useState } from 'react'
import { Brain, MessageSquare, Sparkles, Send, CheckCircle, AlertTriangle, TrendingUp, Lightbulb, Search, History, Settings } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const suggestions = [
  { id: 'SUG-001', text: 'Which enterprise accounts have declining health scores?', category: 'Analytics', icon: TrendingUp },
  { id: 'SUG-002', text: 'Draft a follow-up email for the Dangote Trade Finance deal', category: 'Sales', icon: MessageSquare },
  { id: 'SUG-003', text: 'What are the top 3 churn risk factors this month?', category: 'CS', icon: AlertTriangle },
  { id: 'SUG-004', text: 'Summarize pipeline changes from last week', category: 'RevOps', icon: Sparkles },
  { id: 'SUG-005', text: 'Generate a competitive analysis for the NNPC deal', category: 'Sales', icon: Lightbulb },
  { id: 'SUG-006', text: 'Show me revenue attribution by channel', category: 'Marketing', icon: TrendingUp },
]

const history = [
  { query: 'What is Dangote pipeline value?', response: '₦2.5B across 3 active deals. Largest: Trade Finance Expansion at ₦2.5B (89% probability, Closing stage).', time: '10 min ago' },
  { query: 'List at-risk accounts', response: 'Found 3 at-risk accounts: Kano Textiles (health: 25), Total Energies (health: 45), Shoprite (health: 65 declining).', time: '1 hour ago' },
  { query: 'Draft email for MTN renewal', response: 'Generated personalized renewal email with ROI metrics, product usage highlights, and proposed pricing for the next 12-month term.', time: '2 hours ago' },
]

export default function AICoPilot() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('aicopilot', () => apiClient.dashboard.metrics(), { fallback: suggestions })
  const { tenant } = useTenant()
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState('chat')
  const [search, setSearch] = useState('')
  const [chatHistory, setChatHistory] = useState(history)

  const filteredSuggestions = suggestions.filter(s => !search || s.text.toLowerCase().includes(search.toLowerCase()))

  const handleSend = () => {
    if (!query.trim()) return
    setChatHistory(prev => [{ query, response: 'Processing your request...', time: 'Just now' }, ...prev])
    setQuery('')
  }

  return (
    <div role="region" aria-label="AICoPilot" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Brain className="w-7 h-7 text-purple-600" /> AI Co-Pilot</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Intelligent assistant for {tenant?.name || 'Platform'}</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[{ l: 'Queries Today', v: '142' }, { l: 'Avg Response', v: '1.8s' }, { l: 'Accuracy', v: '94%', c: 'text-emerald-600' }, { l: 'Actions Taken', v: '28' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['chat', 'history', 'settings'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
        ))}
      </div>
      {activeTab === 'chat' && (<div className="space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-4"><input type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Ask anything about your CRM data..." className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /><button onClick={handleSend} className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"><Send className="w-4 h-4" /></button></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredSuggestions.slice(0, 6).map(s => (
              <button key={s.id} onClick={() => setQuery(s.text)} className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-gray-600 text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2"><s.icon className="w-3 h-3 mt-0.5 text-purple-500 shrink-0" />{s.text}</button>
            ))}
          </div>
        </div>
        {chatHistory.length > 0 && (<div className="space-y-3">
          {chatHistory.slice(0, 3).map((h, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-2"><MessageSquare className="w-4 h-4 text-purple-500" /><span className="text-sm font-medium text-gray-900 dark:text-white">{h.query}</span><span className="text-xs text-gray-400 ml-auto">{h.time}</span></div>
              <p className="text-sm text-gray-600 dark:text-gray-400 ml-6">{h.response}</p>
            </div>
          ))}
        </div>)}
      </div>)}
      {activeTab === 'history' && (<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <div className="flex items-center justify-between"><h3 className="font-semibold text-gray-900 dark:text-white">Query History</h3><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="pl-9 pr-4 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs" /></div></div>
        {chatHistory.map((h, i) => (<div key={i} className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"><History className="w-4 h-4 text-gray-400" /><span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{h.query}</span><span className="text-xs text-gray-400">{h.time}</span></div>))}
      </div>)}
      {activeTab === 'settings' && (<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Co-Pilot Settings</h3>
        {[{ label: 'Enable auto-suggestions', checked: true }, { label: 'Include pipeline data in responses', checked: true }, { label: 'Allow automated actions', checked: false }, { label: 'Use tenant-specific context', checked: true }].map(s => (
          <label key={s.label} className="flex items-center gap-3 cursor-pointer"><input type="checkbox" defaultChecked={s.checked} className="w-4 h-4 rounded border-gray-300 text-purple-600" /><span className="text-sm text-gray-700 dark:text-gray-300">{s.label}</span></label>
        ))}
      </div>)}
    </div>
  )
}
