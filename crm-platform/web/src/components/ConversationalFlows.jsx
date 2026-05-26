import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Send, Phone, Plus, Play, Pause, Eye, Edit3,
  CheckCircle2, XCircle, Clock, Users, ArrowRight, Smartphone,
  Globe, Bot, MessageCircle, Layers, Zap, BarChart3
} from 'lucide-react';
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const SAMPLE_FLOWS = [
  {
    id: 'FLW-001', name: 'Savings Account Self-Service Opening',
    channel: 'whatsapp', status: 'active',
    sessions: 2840, completions: 1920, dropoffs: 520,
    completionRate: 67.6, avgDuration: '3.2 min',
    description: 'Full account opening via WhatsApp interactive messages',
    steps: [
      { type: 'bot', message: 'Welcome! Would you like to open a savings account with us?', buttons: ['Yes, let\'s start', 'Tell me more', 'Not now'] },
      { type: 'user', message: 'Yes, let\'s start' },
      { type: 'bot', message: 'Great! What type of savings account suits you?', buttons: ['Regular Savings (4.5% APY)', 'Premium Savings (6.2% APY)', 'Fixed Deposit (8% APY)'] },
      { type: 'user', message: 'Premium Savings (6.2% APY)' },
      { type: 'bot', message: 'Excellent choice! I\'ll need a few details. What is your full name?' },
      { type: 'user', message: 'Olumide Adeyemi' },
      { type: 'bot', message: 'Thanks Olumide! Please share your BVN for verification.' },
      { type: 'user', message: '22012345678' },
      { type: 'system', message: 'BVN verified via NIBSS ✓ — Identity confirmed' },
      { type: 'bot', message: 'Your Premium Savings Account is ready! Account: 0012345678. Fund it now via transfer or visit any agent.' },
    ]
  },
  {
    id: 'FLW-002', name: 'Loan Eligibility Check',
    channel: 'telegram', status: 'active',
    sessions: 1560, completions: 980, dropoffs: 380,
    completionRate: 62.8, avgDuration: '2.8 min',
    description: 'Instant loan pre-qualification via Telegram bot',
    steps: [
      { type: 'bot', message: 'Hi! Check your loan eligibility in under 3 minutes. Ready?', buttons: ['Check now', 'Learn about rates'] },
      { type: 'user', message: 'Check now' },
      { type: 'bot', message: 'What type of loan are you interested in?', buttons: ['Personal Loan', 'Business Loan', 'Mortgage', 'Auto Loan'] },
      { type: 'user', message: 'Personal Loan' },
      { type: 'bot', message: 'What amount do you need?', buttons: ['₦100K-500K', '₦500K-2M', '₦2M-5M', '₦5M+'] },
      { type: 'user', message: '₦500K-2M' },
      { type: 'system', message: 'Checking credit score and transaction history...' },
      { type: 'bot', message: 'You\'re pre-approved for up to ₦1.5M at 14.5% APR! Would you like to proceed with the application?', buttons: ['Apply now', 'Schedule callback', 'Not interested'] },
    ]
  },
  {
    id: 'FLW-003', name: 'FX Rate Alert & Transfer',
    channel: 'whatsapp', status: 'active',
    sessions: 890, completions: 420, dropoffs: 270,
    completionRate: 47.2, avgDuration: '1.5 min',
    description: 'Triggered when favorable FX rate detected for customer corridor',
    steps: [
      { type: 'bot', message: '🔔 Rate Alert: USD→NGN just hit ₦1,520 — 2.3% better than your last transfer! Send now?', buttons: ['Send money now', 'Set alert for ₦1,550', 'Dismiss'] },
      { type: 'user', message: 'Send money now' },
      { type: 'bot', message: 'How much would you like to send? Your usual amount is $500.', buttons: ['$500', '$1,000', 'Custom amount'] },
      { type: 'user', message: '$500' },
      { type: 'bot', message: 'Recipient: Amina Ibrahim (Lagos, GTBank ****4567). Confirm?', buttons: ['Confirm & send', 'Change recipient'] },
      { type: 'user', message: 'Confirm & send' },
      { type: 'system', message: 'Transfer initiated — $500 → ₦760,000 at ₦1,520. Fee: $4.99' },
      { type: 'bot', message: 'Transfer complete! Amina will receive ₦760,000 in 2-4 hours. Reference: TXN-892341' },
    ]
  },
  {
    id: 'FLW-004', name: 'Insurance Product Inquiry',
    channel: 'telegram', status: 'draft',
    sessions: 0, completions: 0, dropoffs: 0,
    completionRate: 0, avgDuration: 'N/A',
    description: 'Conversational insurance product discovery and enrollment',
    steps: [
      { type: 'bot', message: 'Protect what matters! What type of insurance are you looking for?', buttons: ['Health', 'Life', 'Auto', 'Property', 'Not sure'] },
      { type: 'user', message: 'Not sure' },
      { type: 'bot', message: 'Let me help! Tell me about yourself — do you have dependents?', buttons: ['Yes, family', 'No', 'Just started'] },
    ]
  },
];

const CHANNEL_CONFIG = {
  whatsapp: { icon: MessageSquare, color: 'green', label: 'WhatsApp' },
  telegram: { icon: Send, color: 'sky', label: 'Telegram' },
  sms: { icon: Smartphone, color: 'blue', label: 'SMS' },
};

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-amber-100 text-amber-700',
  draft: 'bg-gray-100 text-gray-700',
};

export default function ConversationalFlows() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('conversationalflows', () => apiClient.dashboard.metrics(), { fallback: SAMPLE_FLOWS })
  const { t } = useTranslation()
  const [flows] = useState(SAMPLE_FLOWS);
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [activeTab, setActiveTab] = useState('flows');
  const [previewFlow, setPreviewFlow] = useState(null);

  const totalSessions = flows.reduce((s, f) => s + f.sessions, 0);
  const totalCompletions = flows.reduce((s, f) => s + f.completions, 0);

  return (
    <div role="region" aria-label="ConversationalFlows"  className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Bot className="w-7 h-7 text-green-600" />
            Conversational Flows
          </h1>
          <p className="text-sm text-gray-500 mt-1">Interactive WhatsApp & Telegram self-service journeys</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
          <Plus className="w-4 h-4" /> New Flow
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Flows', value: flows.filter(f => f.status === 'active').length.toString(), icon: Play, color: 'green' },
          { label: 'Total Sessions', value: totalSessions.toLocaleString(), icon: Users, color: 'blue' },
          { label: 'Completions', value: totalCompletions.toLocaleString(), icon: CheckCircle2, color: 'emerald' },
          { label: 'Avg Completion Rate', value: `${(totalCompletions / totalSessions * 100).toFixed(1)}%`, icon: BarChart3, color: 'indigo' },
        ].map((m, i) => (
          <motion.div key={m.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            tabIndex="0" className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-${m.color}-100 dark:bg-${m.color}-900/30`}>
                <m.icon className={`w-5 h-5 text-${m.color}-600`} />
              </div>
              <div>
                <p className="text-xs text-gray-500">{m.label}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{m.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm border border-gray-200 dark:border-gray-700 w-fit">
        {['flows', 'preview', 'analytics'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-green-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'flows' && (
          <motion.div key="flows" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {flows.map((flow, i) => {
              const chCfg = CHANNEL_CONFIG[flow.channel];
              return (
                <motion.div key={flow.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  onClick={() => { setSelectedFlow(selectedFlow?.id === flow.id ? null : flow); setPreviewFlow(flow); }}
                  className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-green-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {chCfg && <chCfg.icon className={`w-4 h-4 text-${chCfg.color}-600`} />}
                        <h3 className="font-semibold text-gray-900 dark:text-white">{flow.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[flow.status]}`}>{flow.status}</span>
                      </div>
                      <p className="text-xs text-gray-500">{flow.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span>{flow.steps.length} steps</span>
                        <span>•</span>
                        <span>{flow.sessions.toLocaleString()} sessions</span>
                        <span>•</span>
                        <span>Avg: {flow.avgDuration}</span>
                      </div>
                    </div>
                    {flow.sessions > 0 && (
                      <div className="flex items-center gap-6 text-right">
                        <div>
                          <p className="text-xs text-gray-500">Completion</p>
                          <p className="text-sm font-bold text-green-600">{flow.completionRate}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Drop-offs</p>
                          <p className="text-sm font-bold text-red-600">{flow.dropoffs}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {activeTab === 'preview' && (
          <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Chat Header */}
              <div className="bg-green-600 text-white px-4 py-3 flex items-center gap-3">
                <Bot className="w-6 h-6" />
                <div>
                  <p className="font-semibold text-sm">{previewFlow?.name || 'Select a flow to preview'}</p>
                  <p className="text-xs text-green-100">{previewFlow ? `${CHANNEL_CONFIG[previewFlow.channel]?.label} Bot` : ''}</p>
                </div>
              </div>
              {/* Chat Messages */}
              <div className="p-4 space-y-3 max-h-96 overflow-y-auto bg-gray-50 dark:bg-gray-900">
                {(previewFlow?.steps || []).map((step, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.15 }}
                    className={`flex ${step.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                      step.type === 'user' ? 'bg-green-500 text-white' :
                      step.type === 'system' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 text-xs italic' :
                      'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-gray-700'
                    }`}>
                      <p>{step.message}</p>
                      {step.buttons && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {step.buttons.map((btn, bi) => (
                            <span key={bi} className="inline-block px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 rounded-lg border border-green-200 dark:border-green-800">
                              {btn}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'analytics' && (
          <motion.div key="analytics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Flow Performance</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 text-gray-500 font-medium">Flow</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Channel</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Sessions</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Completions</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Drop-offs</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Completion %</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Avg Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {flows.filter(f => f.sessions > 0).map(f => {
                    const chCfg = CHANNEL_CONFIG[f.channel];
                    return (
                      <tr key={f.id} className="border-b border-gray-100 dark:border-gray-700/50">
                        <td className="py-3 font-medium text-gray-900 dark:text-white">{f.name}</td>
                        <td className="py-3">
                          <span className={`flex items-center gap-1 text-${chCfg.color}-600`}>
                            <chCfg.icon className="w-3.5 h-3.5" /> {chCfg.label}
                          </span>
                        </td>
                        <td className="py-3 text-right">{f.sessions.toLocaleString()}</td>
                        <td className="py-3 text-right text-green-600">{f.completions.toLocaleString()}</td>
                        <td className="py-3 text-right text-red-600">{f.dropoffs}</td>
                        <td className="py-3 text-right font-bold text-green-600">{f.completionRate}%</td>
                        <td className="py-3 text-right text-gray-500">{f.avgDuration}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Drop-off Analysis</h3>
              <div className="space-y-3">
                {[
                  { step: 'BVN Verification', dropoff: 18.2, reason: 'Users don\'t have BVN handy' },
                  { step: 'Amount Selection', dropoff: 12.5, reason: 'Comparing with competitors' },
                  { step: 'Confirmation', dropoff: 8.3, reason: 'Changed mind at final step' },
                  { step: 'Identity Check', dropoff: 6.1, reason: 'Failed verification' },
                ].map(d => (
                  <div key={d.step} className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{d.step}</p>
                      <p className="text-xs text-gray-500">{d.reason}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600">{d.dropoff}%</p>
                      <p className="text-xs text-gray-500">drop-off</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
