import { useState } from 'react';
import { useApiData } from '@/hooks/useApiData'
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, TrendingDown, Users, Shield, Zap, ArrowUpRight,
  Phone, MessageSquare, Send, Mail, Smartphone, Clock, Target,
  CheckCircle2, XCircle, Filter, Eye, BarChart3, RefreshCw
} from 'lucide-react';
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const RISK_SEGMENTS = [
  { id: 'critical', label: 'Critical Risk', color: 'red', customers: 842, churnProb: '85-100%', icon: XCircle },
  { id: 'high', label: 'High Risk', color: 'orange', customers: 2156, churnProb: '60-84%', icon: AlertTriangle },
  { id: 'medium', label: 'Medium Risk', color: 'amber', customers: 5430, churnProb: '30-59%', icon: Clock },
  { id: 'low', label: 'Low Risk', color: 'green', customers: 42890, churnProb: '0-29%', icon: Shield },
];

const AT_RISK_CUSTOMERS = [
  {
    id: 'CST-5821', name: 'Olumide Adeyemi', segment: 'critical',
    churnScore: 0.94, lastTransaction: '67 days ago',
    balanceTrend: -42, source: 'Core Banking',
    signals: ['No transactions 67 days', 'Balance declined 42%', 'Stopped opening messages'],
    predictedChurnDate: '2026-05-12',
    recommendedAction: 'AI voice call in Yoruba',
    lifetimeValue: 847000,
    retentionCampaign: null,
  },
  {
    id: 'CST-3294', name: 'Amina Ibrahim', segment: 'critical',
    churnScore: 0.91, lastTransaction: '54 days ago',
    balanceTrend: -65, source: 'Agent Banking',
    signals: ['Withdrew 65% of balance', 'Agent reported complaint', 'Missed scheduled deposit'],
    predictedChurnDate: '2026-05-08',
    recommendedAction: 'SMS + WhatsApp retention offer',
    lifetimeValue: 523000,
    retentionCampaign: 'CMP-004',
  },
  {
    id: 'CST-7102', name: 'Chukwuma Okafor', segment: 'high',
    churnScore: 0.78, lastTransaction: '34 days ago',
    balanceTrend: -28, source: 'Remittance',
    signals: ['Switched to competitor corridor', 'Reduced transfer frequency 60%'],
    predictedChurnDate: '2026-05-25',
    recommendedAction: 'Reduced FX fee offer via Telegram',
    lifetimeValue: 1250000,
    retentionCampaign: null,
  },
  {
    id: 'CST-1456', name: 'Fatima Bello', segment: 'high',
    churnScore: 0.72, lastTransaction: '28 days ago',
    balanceTrend: -15, source: 'Core Banking',
    signals: ['Decreased login frequency 70%', 'Removed standing order'],
    predictedChurnDate: '2026-06-01',
    recommendedAction: 'Personalized email + callback',
    lifetimeValue: 680000,
    retentionCampaign: null,
  },
  {
    id: 'CST-9830', name: 'Ibrahim Musa', segment: 'medium',
    churnScore: 0.52, lastTransaction: '15 days ago',
    balanceTrend: -8, source: 'Agent Banking',
    signals: ['Reduced deposit frequency', 'No product engagement 30 days'],
    predictedChurnDate: '2026-06-20',
    recommendedAction: 'Cross-sell savings product via SMS',
    lifetimeValue: 340000,
    retentionCampaign: null,
  },
];

const MODEL_FEATURES = [
  { name: 'Transaction Frequency', weight: 0.22, importance: 'High' },
  { name: 'Balance Trend (30d)', weight: 0.18, importance: 'High' },
  { name: 'Login Frequency', weight: 0.15, importance: 'Medium' },
  { name: 'Channel Engagement', weight: 0.12, importance: 'Medium' },
  { name: 'Product Holdings', weight: 0.10, importance: 'Medium' },
  { name: 'Customer Tenure', weight: 0.08, importance: 'Low' },
  { name: 'Support Tickets', weight: 0.08, importance: 'Low' },
  { name: 'Agent Interactions', weight: 0.07, importance: 'Low' },
];

export default function ChurnPrevention() {
  const { t } = useTranslation()
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const filteredCustomers = selectedSegment
    ? AT_RISK_CUSTOMERS.filter(c => c.segment === selectedSegment)
    : AT_RISK_CUSTOMERS;

  const totalAtRisk = RISK_SEGMENTS.reduce((s, r) => s + r.customers, 0);
  const criticalValue = AT_RISK_CUSTOMERS.filter(c => c.segment === 'critical').reduce((s, c) => s + c.lifetimeValue, 0);

  return (
    <div role="region" aria-label="ChurnPrevention"  className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-7 h-7 text-red-600" />
            Churn Prevention Engine
          </h1>
          <p className="text-sm text-gray-500 mt-1">ML-powered predictive churn detection with auto-triggered retention campaigns</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
            <Zap className="w-4 h-4" /> Auto-Trigger Campaigns
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
            <RefreshCw className="w-4 h-4" /> Retrain Model
          </button>
        </div>
      </div>

      {/* Risk Segments */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {RISK_SEGMENTS.map((seg, i) => (
          <motion.div key={seg.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            onClick={() => setSelectedSegment(selectedSegment === seg.id ? null : seg.id)}
            className={`bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border cursor-pointer transition-colors ${selectedSegment === seg.id ? `border-${seg.color}-400 ring-2 ring-${seg.color}-200` : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
            <div className="flex items-center gap-2 mb-2">
              <seg.icon className={`w-5 h-5 text-${seg.color}-600`} />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{seg.label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{seg.customers.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">Churn probability: {seg.churnProb}</p>
            <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
              <div className={`h-full rounded-full bg-${seg.color}-500`} style={{ width: `${(seg.customers / totalAtRisk) * 100}%` }} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm border border-gray-200 dark:border-gray-700 w-fit">
        {['overview', 'at-risk', 'model', 'campaigns'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-red-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {tab.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div tabIndex="0" className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Churn Prediction Summary</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Model Accuracy</span>
                  <span className="font-bold text-green-600">94.2%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Last Retrained</span>
                  <span className="text-gray-700 dark:text-gray-300">2 hours ago</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Customers Analyzed</span>
                  <span className="font-bold text-gray-900 dark:text-white">51,318</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Critical Risk Revenue</span>
                  <span className="font-bold text-red-600">₦{(criticalValue / 1000000).toFixed(1)}M</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Campaigns Auto-Triggered</span>
                  <span className="font-bold text-indigo-600">12 this week</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Retention Rate (post-intervention)</span>
                  <span className="font-bold text-green-600">68.4%</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Retention Campaign Impact</h3>
              <div className="space-y-3">
                {[
                  { label: 'AI Voice Call', saved: 234, rate: 72, channel: Phone },
                  { label: 'WhatsApp Offer', saved: 567, rate: 65, channel: MessageSquare },
                  { label: 'SMS Incentive', saved: 389, rate: 58, channel: Smartphone },
                  { label: 'Telegram Message', saved: 145, rate: 61, channel: Send },
                  { label: 'Email Campaign', saved: 210, rate: 45, channel: Mail },
                ].map(c => (
                  <div key={c.label} className="flex items-center gap-3">
                    <c.channel className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300 w-32">{c.label}</span>
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${c.rate}%` }} />
                    </div>
                    <span className="text-sm font-bold text-green-600">{c.rate}%</span>
                    <span className="text-xs text-gray-500">{c.saved} saved</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'at-risk' && (
          <motion.div key="at-risk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {filteredCustomers.map((customer, i) => (
              <motion.div key={customer.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedCustomer(selectedCustomer?.id === customer.id ? null : customer)}
                className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-red-300 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${customer.churnScore > 0.8 ? 'bg-red-100' : customer.churnScore > 0.6 ? 'bg-orange-100' : 'bg-amber-100'}`}>
                        <span className={`text-sm font-bold ${customer.churnScore > 0.8 ? 'text-red-700' : customer.churnScore > 0.6 ? 'text-orange-700' : 'text-amber-700'}`}>
                          {Math.round(customer.churnScore * 100)}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{customer.name}</h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{customer.id}</span>
                          <span>•</span>
                          <span>{customer.source}</span>
                          <span>•</span>
                          <span>Last: {customer.lastTransaction}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="text-xs text-gray-500">Balance Trend</p>
                      <p className="text-sm font-bold text-red-600 flex items-center gap-1 justify-end">
                        <TrendingDown className="w-3 h-3" /> {customer.balanceTrend}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">LTV</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">₦{(customer.lifetimeValue / 1000).toFixed(0)}K</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Predicted Churn</p>
                      <p className="text-sm font-bold text-red-600">{customer.predictedChurnDate}</p>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {selectedCustomer?.id === customer.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Risk Signals</h4>
                          <ul className="space-y-1">
                            {customer.signals.map((s, si) => (
                              <li key={si} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                <AlertTriangle className="w-3 h-3 text-red-500" /> {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Recommended Action</h4>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{customer.recommendedAction}</p>
                          <div className="flex gap-2 mt-3">
                            <button className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700">
                              Trigger Campaign Now
                            </button>
                            <button className="px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300">
                              Add to Journey
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </motion.div>
        )}

        {activeTab === 'model' && (
          <motion.div key="model" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Feature Importance</h3>
              <div className="space-y-3">
                {MODEL_FEATURES.map(f => (
                  <div key={f.name} className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 dark:text-gray-300 w-44">{f.name}</span>
                    <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${f.importance === 'High' ? 'bg-red-500' : f.importance === 'Medium' ? 'bg-amber-500' : 'bg-green-500'}`}
                        style={{ width: `${f.weight * 100 / 0.22 * 100}%` }} />
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white w-12 text-right">{(f.weight * 100).toFixed(0)}%</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${f.importance === 'High' ? 'bg-red-100 text-red-700' : f.importance === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                      {f.importance}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Precision', value: '91.8%', desc: 'True positive rate' },
                { label: 'Recall', value: '89.5%', desc: 'Churners caught' },
                { label: 'F1 Score', value: '90.6%', desc: 'Harmonic mean' },
              ].map(m => (
                <div key={m.label} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
                  <p className="text-sm text-gray-500">{m.label}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{m.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{m.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'campaigns' && (
          <motion.div key="campaigns" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Auto-Triggered Retention Campaigns</h3>
              <div className="space-y-3">
                {[
                  { name: 'Critical Risk — Immediate Outreach', triggered: 84, saved: 57, roi: '₦12.4M', channels: ['voice', 'whatsapp'] },
                  { name: 'High Risk — Multi-Channel Sequence', triggered: 216, saved: 141, roi: '₦28.7M', channels: ['sms', 'whatsapp', 'email'] },
                  { name: 'Medium Risk — Soft Engagement', triggered: 543, saved: 315, roi: '₦18.2M', channels: ['sms', 'email'] },
                  { name: 'Win-Back — 90-Day Dormant', triggered: 820, saved: 210, roi: '₦8.9M', channels: ['sms', 'whatsapp', 'voice'] },
                ].map(c => (
                  <div key={c.name} className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{c.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {c.channels.map(ch => (
                          <span key={ch} className="text-[10px] px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-gray-600 dark:text-gray-300">{ch}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Triggered</p>
                        <p className="font-bold">{c.triggered}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Saved</p>
                        <p className="font-bold text-green-600">{c.saved}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Revenue Saved</p>
                        <p className="font-bold text-indigo-600">{c.roi}</p>
                      </div>
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
