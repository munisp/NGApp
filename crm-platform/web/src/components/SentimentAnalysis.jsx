import { useState } from 'react'
import { Smile, Frown, Meh, TrendingUp, TrendingDown, BarChart3, MessageSquare, Phone, Mail, AlertTriangle, ThumbsUp, ThumbsDown } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
const tenantData = {
  'acme-bank': {
    overall: { positive: 62.4, neutral: 24.1, negative: 13.5, trend: '+2.3%' },
    channels: [
      { name: 'WhatsApp', positive: 68, neutral: 22, negative: 10, volume: 4200 },
      { name: 'Phone', positive: 55, neutral: 28, negative: 17, volume: 2800 },
      { name: 'Email', positive: 64, neutral: 25, negative: 11, volume: 3100 },
      { name: 'SMS', positive: 72, neutral: 20, negative: 8, volume: 1500 },
      { name: 'Social', positive: 48, neutral: 22, negative: 30, volume: 890 },
    ],
    alerts: [
      { customer: 'Kano Textiles Ltd', sentiment: -0.78, channel: 'Phone', text: 'Extreme frustration detected — third escalation this month', time: '2 hours ago' },
      { customer: 'Abuja Motors', sentiment: -0.65, channel: 'Email', text: 'Negative sentiment trend over 3 consecutive interactions', time: '4 hours ago' },
      { customer: 'Lagos Fresh Markets', sentiment: -0.52, channel: 'WhatsApp', text: 'Customer expressed intent to close account', time: '6 hours ago' },
    ],
    topics: [
      { topic: 'Transfer Speed', sentiment: 78, mentions: 2340 },
      { topic: 'Customer Service', sentiment: 65, mentions: 1890 },
      { topic: 'Mobile App', sentiment: 72, mentions: 1560 },
      { topic: 'Interest Rates', sentiment: 42, mentions: 1200 },
      { topic: 'Branch Experience', sentiment: 58, mentions: 980 },
      { topic: 'Loan Process', sentiment: 45, mentions: 870 },
      { topic: 'ATM Availability', sentiment: 35, mentions: 650 },
    ],
  },
  'nextgen-mfb': {
    overall: { positive: 58.2, neutral: 26.8, negative: 15.0, trend: '-1.2%' },
    channels: [{ name: 'SMS', positive: 60, neutral: 25, negative: 15, volume: 420 }, { name: 'Phone', positive: 55, neutral: 28, negative: 17, volume: 380 }],
    alerts: [{ customer: 'Micro Savings Coop', sentiment: -0.55, channel: 'SMS', text: 'USSD frustration — multiple failed attempts', time: '1 hour ago' }],
    topics: [{ topic: 'USSD Service', sentiment: 38, mentions: 340 }, { topic: 'Loan Disbursement', sentiment: 62, mentions: 280 }],
  },
}
export default function SentimentAnalysis() {
  const { tenant } = useTenant()
  const [activeTab, setActiveTab] = useState('overview')
  const data = tenantData[tenant?.slug] || tenantData['acme-bank']
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Smile className="w-7 h-7 text-yellow-500" /> Sentiment & Emotion AI</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Real-time customer sentiment across all channels</p></div>
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 text-center"><Smile className="w-8 h-8 text-emerald-500 mx-auto mb-1" /><p className="text-2xl font-bold text-emerald-600">{data.overall.positive}%</p><p className="text-xs text-gray-500">Positive</p></div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-center"><Meh className="w-8 h-8 text-gray-400 mx-auto mb-1" /><p className="text-2xl font-bold text-gray-600">{data.overall.neutral}%</p><p className="text-xs text-gray-500">Neutral</p></div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center"><Frown className="w-8 h-8 text-red-500 mx-auto mb-1" /><p className="text-2xl font-bold text-red-600">{data.overall.negative}%</p><p className="text-xs text-gray-500">Negative</p></div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center"><TrendingUp className="w-8 h-8 text-blue-500 mx-auto mb-1" /><p className="text-2xl font-bold text-blue-600">{data.overall.trend}</p><p className="text-xs text-gray-500">30-Day Trend</p></div>
      </div>
      <div className="border-b border-gray-200 dark:border-gray-700"><div className="flex space-x-6">{['overview', 'alerts', 'topics'].map(t => (<button key={t} onClick={() => setActiveTab(t)} className={`pb-3 text-sm font-medium capitalize border-b-2 ${activeTab === t ? 'border-yellow-500 text-yellow-600' : 'border-transparent text-gray-500'}`}>{t === 'overview' ? 'By Channel' : t}</button>))}</div></div>
      {activeTab === 'overview' && (<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"><table className="w-full"><thead className="bg-gray-50 dark:bg-gray-700"><tr>{['Channel', 'Volume', 'Positive', 'Neutral', 'Negative', 'Distribution'].map(h => (<th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>))}</tr></thead><tbody className="divide-y divide-gray-200 dark:divide-gray-700">{data.channels.map(ch => (<tr key={ch.name}><td className="px-4 py-3 font-medium text-sm text-gray-900 dark:text-white">{ch.name}</td><td className="px-4 py-3 text-sm text-gray-600">{ch.volume.toLocaleString()}</td><td className="px-4 py-3 text-sm text-emerald-600 font-medium">{ch.positive}%</td><td className="px-4 py-3 text-sm text-gray-500">{ch.neutral}%</td><td className="px-4 py-3 text-sm text-red-600 font-medium">{ch.negative}%</td><td className="px-4 py-3"><div className="flex h-4 rounded-full overflow-hidden w-32"><div className="bg-emerald-500" style={{width: `${ch.positive}%`}} /><div className="bg-gray-300" style={{width: `${ch.neutral}%`}} /><div className="bg-red-500" style={{width: `${ch.negative}%`}} /></div></td></tr>))}</tbody></table></div>)}
      {activeTab === 'alerts' && (<div className="space-y-3">{data.alerts.map((a, i) => (<div key={i} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4"><div className="flex items-center justify-between"><div><h4 className="font-medium text-gray-900 dark:text-white text-sm">{a.customer}</h4><p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{a.text}</p></div><div className="text-right"><span className="text-lg font-bold text-red-600">{a.sentiment}</span><p className="text-xs text-gray-500">{a.channel} · {a.time}</p></div></div></div>))}</div>)}
      {activeTab === 'topics' && (<div className="space-y-3">{data.topics.map(t => (<div key={t.topic} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-4"><div className="flex-1"><h4 className="font-medium text-gray-900 dark:text-white text-sm">{t.topic}</h4><p className="text-xs text-gray-500">{t.mentions.toLocaleString()} mentions</p></div><div className="w-32 h-3 bg-gray-100 dark:bg-gray-700 rounded-full"><div className={`h-full rounded-full ${t.sentiment >= 60 ? 'bg-emerald-500' : t.sentiment >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{width: `${t.sentiment}%`}} /></div><span className={`text-lg font-bold ${t.sentiment >= 60 ? 'text-emerald-600' : t.sentiment >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{t.sentiment}</span></div>))}</div>)}
    </div>
  )
}
