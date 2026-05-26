import { useState } from 'react'
import { Inbox, Mail, MessageSquare, Phone, Send, Search, Filter, Star, Clock, CheckCircle, AlertCircle, User, Paperclip, Smile, MoreHorizontal } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const tenantInboxData = {
  'acme-bank': {
    stats: { total: 342, unread: 48, avgResponse: '4.2 min', satisfaction: 94.2 },
    conversations: [
      { id: 'conv-1', customer: 'Chinedu Okafor', channel: 'whatsapp', avatar: 'CO', status: 'open', priority: 'high', subject: 'Failed transfer to GTBank', preview: 'Good morning, I tried sending ₦500,000 to my GTBank account but it failed. The money was debited...', time: '2 min ago', unread: 3, sentiment: 'negative', accountValue: '₦12.4M' },
      { id: 'conv-2', customer: 'Amina Bello', channel: 'email', avatar: 'AB', status: 'open', priority: 'medium', subject: 'Loan application status', preview: 'Please I want to know the status of my SME loan application submitted on March 15th...', time: '8 min ago', unread: 1, sentiment: 'neutral', accountValue: '₦3.2M' },
      { id: 'conv-3', customer: 'Emeka Nwosu', channel: 'sms', avatar: 'EN', status: 'open', priority: 'low', subject: 'Balance inquiry', preview: 'Pls what is my current balance?', time: '15 min ago', unread: 1, sentiment: 'neutral', accountValue: '₦890K' },
      { id: 'conv-4', customer: 'Fatima Abdullahi', channel: 'telegram', avatar: 'FA', status: 'waiting', priority: 'medium', subject: 'Card replacement request', preview: 'My ATM card was swallowed by the machine at your Kano branch. I need a replacement urgently...', time: '32 min ago', unread: 0, sentiment: 'frustrated', accountValue: '₦5.1M' },
      { id: 'conv-5', customer: 'Olumide Adeyemi', channel: 'phone', avatar: 'OA', status: 'resolved', priority: 'high', subject: 'Unauthorized transaction dispute', preview: 'Call transcript: Customer reported ₦2.3M unauthorized debit. Fraud team engaged. Provisional credit issued.', time: '1 hour ago', unread: 0, sentiment: 'satisfied', accountValue: '₦45.8M' },
      { id: 'conv-6', customer: 'Ngozi Eze', channel: 'whatsapp', avatar: 'NE', status: 'open', priority: 'medium', subject: 'Account upgrade to corporate', preview: 'We want to upgrade our business account to corporate tier. What documents do we need?', time: '1 hour ago', unread: 2, sentiment: 'positive', accountValue: '₦22.3M' },
      { id: 'conv-7', customer: 'Bala Mohammed', channel: 'instagram', avatar: 'BM', status: 'open', priority: 'low', subject: 'Product inquiry', preview: 'Hi, I saw your ad about the savings account with 12% interest. Is this real?', time: '2 hours ago', unread: 1, sentiment: 'curious', accountValue: '₦120K' },
    ],
    messages: [
      { id: 'm1', sender: 'customer', text: 'Good morning, I tried sending ₦500,000 to my GTBank account but it failed. The money was debited from my account but the recipient hasn\'t received it.', time: '10:23 AM', channel: 'whatsapp' },
      { id: 'm2', sender: 'customer', text: 'The transaction reference is TRX-2024-0412-8834. Please help me resolve this urgently.', time: '10:24 AM', channel: 'whatsapp' },
      { id: 'm3', sender: 'agent', text: 'Good morning Chinedu. I\'m sorry about this experience. Let me look into this transaction immediately.', time: '10:26 AM', channel: 'whatsapp', agent: 'Sarah O.' },
      { id: 'm4', sender: 'system', text: 'AI Suggestion: NIP reversal initiated for TRX-2024-0412-8834. Typical resolution: 2-4 hours. Recommend confirming with customer and setting expectation.', time: '10:26 AM' },
      { id: 'm5', sender: 'customer', text: 'I need this money urgently, I have a payment to make by 12 noon. Can you expedite?', time: '10:28 AM', channel: 'whatsapp' },
    ],
    customerContext: {
      name: 'Chinedu Okafor', segment: 'Commercial', healthScore: 72, products: ['Current Account', 'SME Loan', 'POS Terminal'],
      recentActivity: ['₦500K transfer failed (today)', 'Loan repayment ₦45K (2 days ago)', 'POS transactions ₦1.2M (this week)'],
      openCases: 1, lifetime: '3 years', nps: 7,
    },
  },
  'nextgen-mfb': {
    stats: { total: 89, unread: 12, avgResponse: '8.5 min', satisfaction: 88.1 },
    conversations: [
      { id: 'conv-10', customer: 'Aisha Yusuf', channel: 'sms', avatar: 'AY', status: 'open', priority: 'medium', subject: 'Micro-loan repayment', preview: 'I want to pay my loan but the USSD code is not working', time: '5 min ago', unread: 1, sentiment: 'frustrated', accountValue: '₦85K' },
    ],
    messages: [],
    customerContext: null,
  },
}

const channelIcons = { whatsapp: MessageSquare, email: Mail, sms: Phone, telegram: Send, phone: Phone, instagram: Star }
const channelColors = { whatsapp: 'text-green-600 bg-green-100', email: 'text-blue-600 bg-blue-100', sms: 'text-purple-600 bg-purple-100', telegram: 'text-sky-600 bg-sky-100', phone: 'text-orange-600 bg-orange-100', instagram: 'text-pink-600 bg-pink-100' }
const priorityColors = { high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-gray-100 text-gray-700' }

export default function OmnichannelInbox() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('omnichannelinbox', () => apiClient.dashboard.metrics(), { fallback: tenantInboxData })
  const { t } = useTranslation()
  const { tenant } = useTenant()
  const [selectedConv, setSelectedConv] = useState('conv-1')
  const [filterChannel, setFilterChannel] = useState('all')
  const [messageInput, setMessageInput] = useState('')
  const data = tenantInboxData[tenant?.slug] || tenantInboxData['acme-bank']

  const filteredConvs = data.conversations.filter(c => filterChannel === 'all' || c.channel === filterChannel)
  const channels = ['all', ...new Set(data.conversations.map(c => c.channel))]

  return (
    <div role="region" aria-label="OmnichannelInbox"  className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Inbox className="w-7 h-7 text-blue-600" /> Omnichannel Inbox
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{data.stats.total} conversations across all channels</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Unread', value: data.stats.unread, color: 'text-red-600' },
          { label: 'Avg Response', value: data.stats.avgResponse, color: 'text-blue-600' },
          { label: 'CSAT', value: `${data.stats.satisfaction}%`, color: 'text-emerald-600' },
          { label: 'Total Open', value: data.stats.total, color: 'text-gray-900 dark:text-white' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Main Layout */}
      <div className="flex gap-4 h-[calc(100vh-280px)] min-h-[500px]">
        {/* Conversation List */}
        <div className="w-96 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-2 mb-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 rounded-lg border-0" placeholder="Search conversations..." />
              </div>
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {channels.map(ch => (
                <button key={ch} onClick={() => setFilterChannel(ch)}
                  className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${filterChannel === ch ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                  {ch === 'all' ? 'All' : ch.charAt(0).toUpperCase() + ch.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredConvs.map(conv => {
              const ChannelIcon = channelIcons[conv.channel] || MessageSquare
              return (
                <div key={conv.id} onClick={() => setSelectedConv(conv.id)}
                  className={`p-3 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 ${selectedConv === conv.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold shrink-0">{conv.avatar}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{conv.customer}</span>
                        <span className="text-xs text-gray-500 shrink-0">{conv.time}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`inline-flex items-center p-0.5 rounded ${channelColors[conv.channel]}`}>
                          <ChannelIcon className="w-3 h-3" />
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${priorityColors[conv.priority]}`}>{conv.priority}</span>
                        {conv.unread > 0 && <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full">{conv.unread}</span>}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">{conv.preview}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col">
          {data.messages.length > 0 ? (
            <>
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{data.conversations[0]?.customer}</h3>
                  <p className="text-xs text-gray-500">{data.conversations[0]?.subject}</p>
                </div>
                <div className="flex gap-2">
                  <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><Star className="w-4 h-4" /></button>
                  <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><MoreHorizontal className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {data.messages.map(m => (
                  <div key={m.id} className={`flex ${m.sender === 'customer' ? 'justify-start' : m.sender === 'system' ? 'justify-center' : 'justify-end'}`}>
                    {m.sender === 'system' ? (
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-4 py-2 max-w-md">
                        <p className="text-xs text-amber-800 dark:text-amber-300"><Bot className="w-3 h-3 inline mr-1" />{m.text}</p>
                      </div>
                    ) : (
                      <div className={`max-w-md rounded-2xl px-4 py-2.5 ${m.sender === 'customer' ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' : 'bg-blue-600 text-white'}`}>
                        <p className="text-sm">{m.text}</p>
                        <p className={`text-xs mt-1 ${m.sender === 'customer' ? 'text-gray-500' : 'text-blue-200'}`}>{m.time} {m.agent && `· ${m.agent}`}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><Paperclip className="w-4 h-4" /></button>
                  <input value={messageInput} onChange={e => setMessageInput(e.target.value)}
                    className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-full text-sm border-0" placeholder="Type a message..." />
                  <button className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700"><Send className="w-4 h-4" /></button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">Select a conversation</div>
          )}
        </div>

        {/* Customer Context Panel */}
        {data.customerContext && (
          <div className="w-72 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4 overflow-y-auto">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xl font-bold mx-auto">CO</div>
              <h3 className="font-semibold text-gray-900 dark:text-white mt-2">{data.customerContext.name}</h3>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{data.customerContext.segment}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-lg font-bold text-blue-600">{data.customerContext.healthScore}</p>
                <p className="text-xs text-gray-500">Health</p>
              </div>
              <div className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-lg font-bold text-amber-600">{data.customerContext.nps}</p>
                <p className="text-xs text-gray-500">NPS</p>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Products</h4>
              <div className="flex flex-wrap gap-1">
                {data.customerContext.products.map(p => (
                  <span key={p} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">{p}</span>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Recent Activity</h4>
              <ul className="space-y-1">
                {data.customerContext.recentActivity.map((a, i) => (
                  <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1.5">
                    <Clock className="w-3 h-3 mt-0.5 shrink-0" />{a}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex gap-2 text-center">
              <div className="flex-1 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-sm font-bold">{data.customerContext.openCases}</p>
                <p className="text-xs text-gray-500">Cases</p>
              </div>
              <div className="flex-1 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-sm font-bold">{data.customerContext.lifetime}</p>
                <p className="text-xs text-gray-500">Tenure</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Bot(props) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
}
