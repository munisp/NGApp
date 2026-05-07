import { useState } from 'react'
import { PenTool, Sparkles, Send, Copy, RotateCw, Globe, Users, Sliders, Mail, MessageSquare, FileText, Clock, CheckCircle, TrendingUp } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const templates = [
  { id: 'follow-up', name: 'Follow-Up Email', desc: 'After meeting or call', icon: Mail },
  { id: 'proposal', name: 'Proposal Draft', desc: 'Product/service proposal', icon: FileText },
  { id: 'renewal', name: 'Renewal Outreach', desc: 'Contract renewal reminder', icon: RotateCw },
  { id: 'cross-sell', name: 'Cross-Sell Offer', desc: 'Product recommendation', icon: TrendingUp },
  { id: 'onboarding', name: 'Onboarding Welcome', desc: 'New customer welcome', icon: Users },
  { id: 'winback', name: 'Win-Back Campaign', desc: 'Re-engage dormant accounts', icon: Sparkles },
]

const tones = ['Professional', 'Friendly', 'Urgent', 'Casual', 'Formal']
const languages = ['English', 'Hausa', 'Yoruba', 'Igbo', 'French']

const sampleDrafts = {
  'follow-up': {
    subject: 'Re: Trade Finance Facility Discussion — Next Steps',
    body: `Dear Mr. Okafor,

Thank you for the productive meeting yesterday regarding the trade finance facility for Dangote Group. I wanted to follow up on the key points we discussed:

1. **Facility Amount**: ₦2.5B revolving credit facility with quarterly reviews
2. **Interest Rate**: 15.5% p.a. (negotiable based on volume commitments)
3. **Collateral**: Warehouse receipts covering 120% of drawn amount
4. **Timeline**: Final documentation by end of this week

As discussed, I've attached the term sheet for your review. Our trade finance team has also prepared a comparison showing how our rates benchmark against the market.

Could we schedule a brief call on Thursday to address any questions from your CFO? I have slots available at 10 AM or 2 PM.

Looking forward to finalizing this partnership.

Best regards,
Sarah Okonkwo
Head of Commercial Banking, Acme Bank`,
  },
  'cross-sell': {
    subject: 'Exclusive: POS Terminal Fleet Offer for Shoprite Nigeria',
    body: `Dear Shoprite Finance Team,

Based on your transaction volumes over the past quarter (₦1.2B monthly), I'd like to share an exclusive POS terminal offer that could reduce your payment processing costs by up to 18%.

**Smart POS Fleet Package:**
- 500 Android POS terminals (Nexgo N86)
- Transaction fee: 0.35% (vs market avg 0.5%)
- Same-day settlement guarantee
- Free terminal insurance for 12 months
- Dedicated support hotline

Our data shows your peak transaction periods are 10 AM-2 PM on weekdays. Our terminals handle 3x the throughput of standard devices, reducing queue times significantly.

Shall I arrange a demo at your Victoria Island HQ next week?`,
  },
}

const recentDrafts = [
  { id: 1, recipient: 'Chinedu Okafor', subject: 'Trade Finance Follow-Up', status: 'sent', time: '2 hours ago', opens: 3 },
  { id: 2, recipient: 'MTN Nigeria', subject: 'Revised Pricing Proposal', status: 'draft', time: '4 hours ago', opens: 0 },
  { id: 3, recipient: 'Flour Mills', subject: 'Technical Demo Invitation', status: 'sent', time: 'Yesterday', opens: 5 },
  { id: 4, recipient: 'Ngozi Eze', subject: 'Corporate Account Benefits', status: 'sent', time: 'Yesterday', opens: 2 },
  { id: 5, recipient: 'Port Harcourt Shipping', subject: 'Contract Renewal Reminder', status: 'scheduled', time: 'Tomorrow 9 AM', opens: 0 },
]

export default function SmartComposer() {
  const { t } = useTranslation()
  const [selectedTemplate, setSelectedTemplate] = useState('follow-up')
  const [tone, setTone] = useState('Professional')
  const [language, setLanguage] = useState('English')
  const [activeTab, setActiveTab] = useState('compose')
  const [isGenerating, setIsGenerating] = useState(false)
  const draft = sampleDrafts[selectedTemplate] || sampleDrafts['follow-up']

  const handleGenerate = () => {
    setIsGenerating(true)
    setTimeout(() => setIsGenerating(false), 1500)
  }

  return (
    <div role="region" aria-label="SmartComposer"  className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <PenTool className="w-7 h-7 text-violet-600" /> Smart Email & Message Composer
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">AI-powered personalized communications using CRM context</p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Emails Sent', value: '1,284', color: 'text-blue-600' },
          { label: 'Avg Open Rate', value: '68.4%', color: 'text-emerald-600' },
          { label: 'Avg Reply Rate', value: '23.1%', color: 'text-purple-600' },
          { label: 'AI Drafts Used', value: '892', color: 'text-violet-600' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex space-x-6">
          {['compose', 'recent', 'templates'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium capitalize border-b-2 ${activeTab === tab ? 'border-violet-600 text-violet-600' : 'border-transparent text-gray-500'}`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls */}
          <div className="space-y-4">
            <div tabIndex="0" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-600" /> AI Settings</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Template</label>
                  <select value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)}
                    className="w-full text-sm rounded-lg border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 p-2">
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Tone</label>
                  <div className="flex flex-wrap gap-1">
                    {tones.map(t => (
                      <button key={t} onClick={() => setTone(t)}
                        className={`px-2 py-1 text-xs rounded-full ${tone === t ? 'bg-violet-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1"><Globe className="w-3 h-3" /> Language</label>
                  <div className="flex flex-wrap gap-1">
                    {languages.map(l => (
                      <button key={l} onClick={() => setLanguage(l)}
                        className={`px-2 py-1 text-xs rounded-full ${language === l ? 'bg-violet-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={handleGenerate}
                className="w-full mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 flex items-center justify-center gap-2 text-sm">
                <Sparkles className="w-4 h-4" />{isGenerating ? 'Generating...' : 'Generate Draft'}
              </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">CRM Context</h3>
              <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
                <p><strong>Customer:</strong> Chinedu Okafor (Dangote Group)</p>
                <p><strong>Segment:</strong> Enterprise · ₦2.5B pipeline</p>
                <p><strong>Last Contact:</strong> Meeting yesterday</p>
                <p><strong>Health Score:</strong> 72/100</p>
                <p><strong>Products:</strong> Trade Finance, Treasury</p>
                <p><strong>Open Deals:</strong> 1 (Closing stage, 92% probability)</p>
              </div>
            </div>
          </div>

          {/* Editor */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="mb-4">
              <label className="text-xs text-gray-500 mb-1 block">Subject</label>
              <input defaultValue={draft.subject} className="w-full text-sm font-medium p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Body</label>
              <textarea defaultValue={draft.body} rows={18}
                className="w-full text-sm p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700 font-mono leading-relaxed" />
            </div>
            <div className="flex items-center justify-between mt-4">
              <div className="flex gap-2">
                <button className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</button>
                <button className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1"><RotateCw className="w-3 h-3" /> Regenerate</button>
              </div>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"><Send className="w-4 h-4" /> Send</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'recent' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                {['Recipient', 'Subject', 'Status', 'Time', 'Opens'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {recentDrafts.map(d => (
                <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{d.recipient}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{d.subject}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${d.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : d.status === 'draft' ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-700'}`}>{d.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{d.time}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{d.opens > 0 ? `${d.opens}x` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {templates.map(t => (
            <button key={t.id} onClick={() => { setSelectedTemplate(t.id); setActiveTab('compose') }}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-left hover:border-violet-300 transition-colors">
              <t.icon className="w-8 h-8 text-violet-600 mb-2" />
              <h4 className="font-medium text-gray-900 dark:text-white">{t.name}</h4>
              <p className="text-xs text-gray-500 mt-1">{t.desc}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
