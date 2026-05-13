import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch, Play, Pause, Plus, ArrowRight, Clock, MessageSquare,
  Phone, Mail, Send, Smartphone, CheckCircle2, XCircle, AlertCircle,
  Eye, Zap, Users, Target, Edit3, Trash2, Copy
} from 'lucide-react';
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const STEP_TYPES = [
  { id: 'sms', label: 'Send SMS', icon: Smartphone, color: 'blue' },
  { id: 'whatsapp', label: 'Send WhatsApp', icon: MessageSquare, color: 'green' },
  { id: 'telegram', label: 'Send Telegram', icon: Send, color: 'sky' },
  { id: 'voice', label: 'AI Voice Call', icon: Phone, color: 'purple' },
  { id: 'email', label: 'Send Email', icon: Mail, color: 'amber' },
  { id: 'wait', label: 'Wait / Delay', icon: Clock, color: 'gray' },
  { id: 'condition', label: 'If / Condition', icon: GitBranch, color: 'indigo' },
  { id: 'action', label: 'CRM Action', icon: Zap, color: 'emerald' },
];

const SAMPLE_JOURNEYS = [
  {
    id: 'JRN-001', name: 'Agent → Savings Account Onboarding',
    status: 'active', trigger: 'New agent banking customer registered',
    enrolled: 3420, completed: 1890, inProgress: 1230, failed: 300,
    conversionRate: 55.3, avgDuration: '4.2 days',
    steps: [
      { id: 1, type: 'whatsapp', label: 'Welcome message + savings info', delay: '0h', status: 'active' },
      { id: 2, type: 'wait', label: 'Wait 24 hours', delay: '24h', status: 'active' },
      { id: 3, type: 'condition', label: 'If WhatsApp opened?', delay: '0h', status: 'active',
        branches: { yes: 'Send detailed offer via WhatsApp', no: 'Fallback to SMS' } },
      { id: 4, type: 'sms', label: 'SMS: Limited-time savings bonus', delay: '0h', status: 'active' },
      { id: 5, type: 'wait', label: 'Wait 48 hours', delay: '48h', status: 'active' },
      { id: 6, type: 'voice', label: 'AI call in customer language', delay: '0h', status: 'active' },
      { id: 7, type: 'action', label: 'Update CRM: journey completed', delay: '0h', status: 'active' },
    ]
  },
  {
    id: 'JRN-002', name: 'Remittance → FX Account Cross-Sell',
    status: 'active', trigger: '3rd remittance transfer completed',
    enrolled: 1850, completed: 720, inProgress: 980, failed: 150,
    conversionRate: 38.9, avgDuration: '6.5 days',
    steps: [
      { id: 1, type: 'telegram', label: 'FX account benefits message', delay: '0h', status: 'active' },
      { id: 2, type: 'wait', label: 'Wait 48 hours', delay: '48h', status: 'active' },
      { id: 3, type: 'condition', label: 'Clicked FX link?', delay: '0h', status: 'active',
        branches: { yes: 'Schedule callback', no: 'Send reminder' } },
      { id: 4, type: 'whatsapp', label: 'Personalized rate comparison', delay: '24h', status: 'active' },
      { id: 5, type: 'voice', label: 'AI call: FX walkthrough', delay: '72h', status: 'active' },
    ]
  },
  {
    id: 'JRN-003', name: 'Dormant Account Reactivation',
    status: 'paused', trigger: 'No transactions for 90+ days',
    enrolled: 8200, completed: 2100, inProgress: 0, failed: 6100,
    conversionRate: 25.6, avgDuration: '10 days',
    steps: [
      { id: 1, type: 'sms', label: 'We miss you — zero fees for 30 days', delay: '0h', status: 'paused' },
      { id: 2, type: 'wait', label: 'Wait 3 days', delay: '72h', status: 'paused' },
      { id: 3, type: 'email', label: 'Account summary + reactivation link', delay: '0h', status: 'paused' },
      { id: 4, type: 'wait', label: 'Wait 7 days', delay: '168h', status: 'paused' },
      { id: 5, type: 'condition', label: 'Any activity?', delay: '0h', status: 'paused',
        branches: { yes: 'Send thank-you', no: 'Final attempt via voice' } },
      { id: 6, type: 'voice', label: 'Personal reactivation call', delay: '0h', status: 'paused' },
    ]
  },
  {
    id: 'JRN-004', name: 'Premium Insurance Cross-Sell',
    status: 'draft', trigger: 'Core banking balance > ₦1M for 30 days',
    enrolled: 0, completed: 0, inProgress: 0, failed: 0,
    conversionRate: 0, avgDuration: 'N/A',
    steps: [
      { id: 1, type: 'whatsapp', label: 'Exclusive insurance offer', delay: '0h', status: 'draft' },
      { id: 2, type: 'wait', label: 'Wait 72 hours', delay: '72h', status: 'draft' },
      { id: 3, type: 'voice', label: 'AI consultation call', delay: '0h', status: 'draft' },
    ]
  },
];

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-amber-100 text-amber-700',
  draft: 'bg-gray-100 text-gray-700',
  completed: 'bg-purple-100 text-purple-700',
};

export default function JourneyOrchestrator() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('journeyorchestrator', () => apiClient.dashboard.metrics(), { fallback: STEP_TYPES })
  const { t } = useTranslation()
  const [journeys] = useState(SAMPLE_JOURNEYS);
  const [selectedJourney, setSelectedJourney] = useState(null);
  const [activeTab, setActiveTab] = useState('journeys');

  const totalEnrolled = journeys.reduce((s, j) => s + j.enrolled, 0);
  const totalCompleted = journeys.reduce((s, j) => s + j.completed, 0);
  const totalInProgress = journeys.reduce((s, j) => s + j.inProgress, 0);

  return (
    <div role="region" aria-label="JourneyOrchestrator"  className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <GitBranch className="w-7 h-7 text-indigo-600" />
            Journey Orchestrator
          </h1>
          <p className="text-sm text-gray-500 mt-1">Multi-step customer journeys powered by Temporal workflows</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          <Plus className="w-4 h-4" /> New Journey
        </button>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Journeys', value: journeys.filter(j => j.status === 'active').length.toString(), icon: Play, color: 'green' },
          { label: 'Total Enrolled', value: totalEnrolled.toLocaleString(), icon: Users, color: 'blue' },
          { label: 'In Progress', value: totalInProgress.toLocaleString(), icon: Clock, color: 'amber' },
          { label: 'Completed', value: totalCompleted.toLocaleString(), icon: CheckCircle2, color: 'purple' },
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
        {['journeys', 'templates', 'analytics'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'journeys' && (
          <motion.div key="journeys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {journeys.map((journey, i) => (
              <motion.div key={journey.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedJourney(selectedJourney?.id === journey.id ? null : journey)}
                className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-indigo-300 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{journey.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[journey.status]}`}>{journey.status}</span>
                    </div>
                    <p className="text-xs text-gray-500">Trigger: {journey.trigger}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-gray-500">{journey.steps.length} steps</span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500">{journey.enrolled.toLocaleString()} enrolled</span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500">Avg: {journey.avgDuration}</span>
                    </div>
                  </div>
                  {journey.enrolled > 0 && (
                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <p className="text-xs text-gray-500">Conversion</p>
                        <p className="text-sm font-bold text-green-600">{journey.conversionRate}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">In Progress</p>
                        <p className="text-sm font-bold text-blue-600">{journey.inProgress.toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Expanded: Journey Steps Visualization */}
                <AnimatePresence>
                  {selectedJourney?.id === journey.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="flex items-center gap-2 overflow-x-auto pb-2">
                        {journey.steps.map((step, si) => {
                          const stepType = STEP_TYPES.find(t => t.id === step.type);
                          return (
                            <div key={step.id} className="flex items-center gap-2 flex-shrink-0">
                              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${step.type === 'condition' ? 'border-indigo-300 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700'}`}>
                                {stepType && <stepType.icon className={`w-4 h-4 text-${stepType.color}-600`} />}
                                <div>
                                  <p className="text-xs font-medium text-gray-900 dark:text-white">{step.label}</p>
                                  {step.branches && (
                                    <div className="flex gap-2 mt-1">
                                      <span className="text-[10px] text-green-600">Yes: {step.branches.yes}</span>
                                      <span className="text-[10px] text-red-600">No: {step.branches.no}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              {si < journey.steps.length - 1 && (
                                <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button className="flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                          <Edit3 className="w-3 h-3" /> Edit
                        </button>
                        <button className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300">
                          <Copy className="w-3 h-3" /> Duplicate
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </motion.div>
        )}

        {activeTab === 'templates' && (
          <motion.div key="templates" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: 'Welcome Series', steps: 5, channels: ['whatsapp', 'sms', 'email'], desc: 'New customer onboarding with channel escalation' },
              { name: 'Cross-Sell Sequence', steps: 4, channels: ['whatsapp', 'voice'], desc: 'Product recommendation with AI follow-up call' },
              { name: 'Win-Back Campaign', steps: 6, channels: ['sms', 'email', 'voice'], desc: 'Re-engage dormant customers with incentives' },
              { name: 'Birthday Offer', steps: 3, channels: ['whatsapp', 'sms'], desc: 'Automated birthday greeting with special offer' },
              { name: 'Payment Reminder', steps: 3, channels: ['sms', 'whatsapp'], desc: 'Escalating payment reminders before due date' },
              { name: 'Feedback Collection', steps: 4, channels: ['whatsapp', 'email'], desc: 'Post-service NPS survey with follow-up' },
            ].map((t, i) => (
              <motion.div key={t.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 hover:border-indigo-300 transition-colors cursor-pointer">
                <h3 className="font-semibold text-gray-900 dark:text-white">{t.name}</h3>
                <p className="text-xs text-gray-500 mt-1">{t.desc}</p>
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-xs text-gray-500">{t.steps} steps</span>
                  <div className="flex gap-1">
                    {t.channels.map(ch => {
                      const st = STEP_TYPES.find(s => s.id === ch);
                      return st ? <st.icon key={ch} className={`w-3.5 h-3.5 text-${st.color}-600`} /> : null;
                    })}
                  </div>
                </div>
                <button className="mt-3 text-xs text-indigo-600 font-medium hover:text-indigo-700">Use template →</button>
              </motion.div>
            ))}
          </motion.div>
        )}

        {activeTab === 'analytics' && (
          <motion.div key="analytics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Journey Performance</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 text-gray-500 font-medium">Journey</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Enrolled</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Completed</th>
                    <th className="text-right py-2 text-gray-500 font-medium">In Progress</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Failed</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Conversion</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Avg Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {journeys.filter(j => j.enrolled > 0).map(j => (
                    <tr key={j.id} className="border-b border-gray-100 dark:border-gray-700/50">
                      <td className="py-3 font-medium text-gray-900 dark:text-white">{j.name}</td>
                      <td className="py-3 text-right">{j.enrolled.toLocaleString()}</td>
                      <td className="py-3 text-right text-green-600">{j.completed.toLocaleString()}</td>
                      <td className="py-3 text-right text-blue-600">{j.inProgress.toLocaleString()}</td>
                      <td className="py-3 text-right text-red-600">{j.failed.toLocaleString()}</td>
                      <td className="py-3 text-right font-bold text-green-600">{j.conversionRate}%</td>
                      <td className="py-3 text-right text-gray-500">{j.avgDuration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
