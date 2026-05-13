import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Megaphone, Plus, Play, Pause, Eye, BarChart3, Users, Send,
  MessageSquare, Phone, Mail, Radio, Filter, Calendar, Target,
  TrendingUp, ChevronRight, Clock, AlertCircle, CheckCircle2, X,
  Smartphone, Zap, Globe, ArrowUpRight
} from 'lucide-react';
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useApiData } from '@/hooks/useApiData'

const CHANNELS = [
  { id: 'sms', label: 'SMS', icon: Smartphone, color: 'blue' },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, color: 'green' },
  { id: 'telegram', label: 'Telegram', icon: Send, color: 'sky' },
  { id: 'voice', label: 'Voice', icon: Phone, color: 'purple' },
  { id: 'email', label: 'Email', icon: Mail, color: 'amber' },
  { id: 'ussd', label: 'USSD', icon: Radio, color: 'gray' },
];

const CAMPAIGN_TYPES = [
  { id: 'upsell', label: 'Upsell', color: 'emerald' },
  { id: 'cross_sell', label: 'Cross-Sell', color: 'blue' },
  { id: 'retention', label: 'Retention', color: 'amber' },
  { id: 'onboarding', label: 'Onboarding', color: 'purple' },
  { id: 'promotion', label: 'Promotion', color: 'rose' },
  { id: 'reactivation', label: 'Reactivation', color: 'gray' },
];

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-amber-100 text-amber-700',
  completed: 'bg-purple-100 text-purple-700',
  cancelled: 'bg-red-100 text-red-700',
};

// Simulated campaign data
const SAMPLE_CAMPAIGNS = [
  {
    id: 'CMP-001', name: 'Agent → Savings Account Upsell', type: 'upsell',
    status: 'active', channels: ['sms', 'whatsapp'], reach: 8420,
    sent: 6800, delivered: 6450, clicked: 892, failed: 180,
    budget: 500000, spent: 340000, startedAt: '2026-04-28T10:00:00Z',
    scheduledAt: null, segment: 'Agent Banking customers without savings',
    deliveryRate: 94.9, clickRate: 13.8, conversionRate: 4.2,
    revenueGenerated: 12600000
  },
  {
    id: 'CMP-002', name: 'Remittance FX Account Cross-Sell', type: 'cross_sell',
    status: 'active', channels: ['whatsapp', 'telegram'], reach: 3200,
    sent: 2900, delivered: 2780, clicked: 445, failed: 65,
    budget: 300000, spent: 174000, startedAt: '2026-04-30T09:00:00Z',
    scheduledAt: null, segment: 'Remittance customers with 3+ transfers',
    deliveryRate: 95.9, clickRate: 16.0, conversionRate: 6.1,
    revenueGenerated: 9760000
  },
  {
    id: 'CMP-003', name: 'Premium Loan Pre-Approval', type: 'upsell',
    status: 'scheduled', channels: ['sms', 'voice'], reach: 5100,
    sent: 0, delivered: 0, clicked: 0, failed: 0,
    budget: 750000, spent: 0, startedAt: null,
    scheduledAt: '2026-05-06T10:00:00Z', segment: 'Core Banking premium with balance > ₦1M',
    deliveryRate: 0, clickRate: 0, conversionRate: 0,
    revenueGenerated: 0
  },
  {
    id: 'CMP-004', name: 'Dormant Account Reactivation', type: 'reactivation',
    status: 'completed', channels: ['sms', 'email'], reach: 12000,
    sent: 11800, delivered: 10200, clicked: 1530, failed: 1200,
    budget: 200000, spent: 200000, startedAt: '2026-04-15T08:00:00Z',
    scheduledAt: null, segment: 'No transactions in 90+ days',
    deliveryRate: 86.4, clickRate: 15.0, conversionRate: 3.8,
    revenueGenerated: 6840000
  },
  {
    id: 'CMP-005', name: 'Micro-Insurance for Agent Customers', type: 'cross_sell',
    status: 'draft', channels: ['whatsapp'], reach: 0,
    sent: 0, delivered: 0, clicked: 0, failed: 0,
    budget: 150000, spent: 0, startedAt: null,
    scheduledAt: null, segment: 'Agent Banking customers, 18-45 age range',
    deliveryRate: 0, clickRate: 0, conversionRate: 0,
    revenueGenerated: 0
  },
];

const RECOMMENDATIONS = [
  {
    type: 'upsell', segment: 'Agent Banking', reach: 8420,
    convRate: 8, revenue: 10104000,
    channels: ['sms', 'whatsapp'],
    message: 'Target agent banking customers without formal savings accounts. High conversion potential with SMS + WhatsApp combo.',
  },
  {
    type: 'cross_sell', segment: 'Remittance', reach: 3200,
    convRate: 12, revenue: 7680000,
    channels: ['whatsapp', 'telegram'],
    message: 'Remittance customers sending 3+ transfers/month are ideal for FX account cross-sell. WhatsApp template messages yield highest CTR.',
  },
  {
    type: 'retention', segment: 'Dormant', reach: 12000,
    convRate: 4, revenue: 7200000,
    channels: ['sms', 'email'],
    message: '12,000 accounts inactive 90+ days. SMS reactivation with incentive offer (zero fees for 30 days) shows 3.8% historical conversion.',
  },
];

const AB_TEST_RESULTS = {
  campaignId: 'CMP-001',
  variantA: { name: 'Direct Offer', sent: 3400, clicked: 410, rate: 12.1 },
  variantB: { name: 'Story-Based', sent: 3400, clicked: 482, rate: 14.2 },
  winner: 'B', confidence: 96.2, significant: true,
  recommendation: 'Variant B (Story-Based) outperforms by 2.1pp. Scale to full audience.'
};

export default function CampaignManager() {
  const { t } = useTranslation()
  const [campaigns, setCampaigns] = useState(SAMPLE_CAMPAIGNS);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [activeTab, setActiveTab] = useState('campaigns');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showCreate, setShowCreate] = useState(false);

  const filteredCampaigns = filterStatus === 'all'
    ? campaigns
    : campaigns.filter(c => c.status === filterStatus);

  const totalSent = campaigns.reduce((s, c) => s + c.sent, 0);
  const totalDelivered = campaigns.reduce((s, c) => s + c.delivered, 0);
  const totalClicked = campaigns.reduce((s, c) => s + c.clicked, 0);
  const totalRevenue = campaigns.reduce((s, c) => s + c.revenueGenerated, 0);

  return (
    <div role="region" aria-label="CampaignManager"  className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Megaphone className="w-7 h-7 text-indigo-600" />
            Campaign Manager
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Outbound campaigns across SMS, WhatsApp, Telegram, Voice & Email
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Campaign
        </button>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Campaigns', value: campaigns.length.toString(), icon: Megaphone, color: 'indigo' },
          { label: 'Messages Sent', value: totalSent >= 1000 ? `${(totalSent / 1000).toFixed(1)}K` : totalSent.toString(), icon: Send, color: 'blue' },
          { label: 'Click Rate', value: totalDelivered > 0 ? `${(totalClicked / totalDelivered * 100).toFixed(1)}%` : '0%', icon: Target, color: 'green' },
          { label: 'Revenue Generated', value: `₦${(totalRevenue / 1000000).toFixed(1)}M`, icon: TrendingUp, color: 'emerald' },
        ].map((metric, i) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            tabIndex="0" className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-${metric.color}-100 dark:bg-${metric.color}-900/30`}>
                <metric.icon className={`w-5 h-5 text-${metric.color}-600`} />
              </div>
              <div>
                <p className="text-xs text-gray-500">{metric.label}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{metric.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm border border-gray-200 dark:border-gray-700 w-fit">
        {['campaigns', 'analytics', 'recommendations', 'ab-tests'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'campaigns' && (
          <motion.div key="campaigns" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Status Filter */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {['all', 'draft', 'scheduled', 'active', 'paused', 'completed'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    filterStatus === status
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                  {status !== 'all' && (
                    <span className="ml-1">
                      ({campaigns.filter(c => c.status === status).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Campaign List */}
            <div className="space-y-3">
              {filteredCampaigns.map((campaign, i) => (
                <motion.div
                  key={campaign.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => setSelectedCampaign(campaign)}
                  className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-indigo-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{campaign.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[campaign.status]}`}>
                          {campaign.status}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${CAMPAIGN_TYPES.find(t => t.id === campaign.type)?.color || 'gray'}-100 text-${CAMPAIGN_TYPES.find(t => t.id === campaign.type)?.color || 'gray'}-700`}>
                          {campaign.type.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{campaign.segment}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex gap-1">
                          {campaign.channels.map(ch => {
                            const channel = CHANNELS.find(c => c.id === ch);
                            return channel ? (
                              <span key={ch} className="p-1 bg-gray-100 dark:bg-gray-700 rounded" title={channel.label}>
                                <channel.icon className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                              </span>
                            ) : null;
                          })}
                        </div>
                        {campaign.reach > 0 && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Users className="w-3 h-3" /> {campaign.reach.toLocaleString()} recipients
                          </span>
                        )}
                        {campaign.scheduledAt && (
                          <span className="text-xs text-blue-600 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {new Date(campaign.scheduledAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right side stats */}
                    {campaign.sent > 0 && (
                      <div className="flex items-center gap-6 text-right">
                        <div>
                          <p className="text-xs text-gray-500">Delivery</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{campaign.deliveryRate}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">CTR</p>
                          <p className="text-sm font-bold text-green-600">{campaign.clickRate}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Revenue</p>
                          <p className="text-sm font-bold text-emerald-600">₦{(campaign.revenueGenerated / 1000000).toFixed(1)}M</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Progress bar for active campaigns */}
                  {campaign.status === 'active' && campaign.reach > 0 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{campaign.sent.toLocaleString()} / {campaign.reach.toLocaleString()} sent</span>
                        <span>{Math.round(campaign.sent / campaign.reach * 100)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full transition-all"
                          style={{ width: `${Math.round(campaign.sent / campaign.reach * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'analytics' && (
          <motion.div key="analytics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            {/* Channel Performance */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Channel Performance</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 text-gray-500 font-medium">Channel</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Sent</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Delivered</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Delivery %</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Clicked</th>
                      <th className="text-right py-2 text-gray-500 font-medium">CTR</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Cost/Click</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { channel: 'SMS', sent: 11200, delivered: 10400, clicked: 1250, cost: 85 },
                      { channel: 'WhatsApp', sent: 8900, delivered: 8600, clicked: 1580, cost: 45 },
                      { channel: 'Telegram', sent: 2100, delivered: 2050, clicked: 410, cost: 22 },
                      { channel: 'Voice', sent: 800, delivered: 720, clicked: 180, cost: 350 },
                      { channel: 'Email', sent: 5500, delivered: 4200, clicked: 630, cost: 15 },
                    ].map(row => (
                      <tr key={row.channel} className="border-b border-gray-100 dark:border-gray-700/50">
                        <td className="py-3 font-medium text-gray-900 dark:text-white">{row.channel}</td>
                        <td className="py-3 text-right text-gray-700 dark:text-gray-300">{row.sent.toLocaleString()}</td>
                        <td className="py-3 text-right text-gray-700 dark:text-gray-300">{row.delivered.toLocaleString()}</td>
                        <td className="py-3 text-right">
                          <span className={`font-medium ${row.delivered / row.sent > 0.9 ? 'text-green-600' : 'text-amber-600'}`}>
                            {(row.delivered / row.sent * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 text-right text-gray-700 dark:text-gray-300">{row.clicked.toLocaleString()}</td>
                        <td className="py-3 text-right font-medium text-blue-600">
                          {(row.clicked / row.delivered * 100).toFixed(1)}%
                        </td>
                        <td className="py-3 text-right text-gray-700 dark:text-gray-300">₦{row.cost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Conversion Funnel */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Conversion Funnel (All Campaigns)</h3>
              <div className="space-y-3">
                {[
                  { stage: 'Targeted', count: 28720, pct: 100 },
                  { stage: 'Sent', count: 21500, pct: 74.9 },
                  { stage: 'Delivered', count: 19430, pct: 67.7 },
                  { stage: 'Read/Opened', count: 12800, pct: 44.6 },
                  { stage: 'Clicked', count: 4050, pct: 14.1 },
                  { stage: 'Converted', count: 1215, pct: 4.2 },
                ].map((stage, i) => (
                  <div key={stage.stage} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 dark:text-gray-400 w-24">{stage.stage}</span>
                    <div className="flex-1 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden relative">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${stage.pct}%` }}
                        transition={{ delay: i * 0.1, duration: 0.5 }}
                        className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-end pr-2"
                      >
                        <span className="text-xs font-medium text-white">{stage.count.toLocaleString()}</span>
                      </motion.div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white w-14 text-right">{stage.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'recommendations' && (
          <motion.div key="recommendations" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" /> AI-Powered Campaign Recommendations
              </h3>
              <p className="text-sm text-gray-500 mb-4">Based on customer segments, historical performance, and cross-sell predictions</p>
            </div>

            {RECOMMENDATIONS.map((rec, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        rec.type === 'upsell' ? 'bg-emerald-100 text-emerald-700' :
                        rec.type === 'cross_sell' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {rec.type.replace('_', ' ')}
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {rec.segment} Segment
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{rec.message}</p>
                    <div className="flex items-center gap-4 mt-3">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Users className="w-3 h-3" /> {rec.reach.toLocaleString()} reach
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Target className="w-3 h-3" /> {rec.convRate}% est. conversion
                      </span>
                      <span className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
                        <TrendingUp className="w-3 h-3" /> ₦{(rec.revenue / 1000000).toFixed(1)}M est. revenue
                      </span>
                    </div>
                    <div className="flex gap-1 mt-2">
                      {rec.channels.map(ch => {
                        const channel = CHANNELS.find(c => c.id === ch);
                        return channel ? (
                          <span key={ch} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                            <channel.icon className="w-3 h-3" /> {channel.label}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                  <button className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors">
                    Create <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {activeTab === 'ab-tests' && (
          <motion.div key="ab-tests" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">A/B Test Results — {AB_TEST_RESULTS.campaignId}</h3>

              <div className="grid grid-cols-2 gap-6">
                {/* Variant A */}
                <div className={`p-4 rounded-lg border-2 ${AB_TEST_RESULTS.winner === 'A' ? 'border-green-400 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900 dark:text-white">Variant A: {AB_TEST_RESULTS.variantA.name}</h4>
                    {AB_TEST_RESULTS.winner === 'A' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-xs text-gray-500">Sent</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{AB_TEST_RESULTS.variantA.sent.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Clicked</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{AB_TEST_RESULTS.variantA.clicked.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">CTR</p>
                      <p className="text-lg font-bold text-blue-600">{AB_TEST_RESULTS.variantA.rate}%</p>
                    </div>
                  </div>
                </div>

                {/* Variant B */}
                <div className={`p-4 rounded-lg border-2 ${AB_TEST_RESULTS.winner === 'B' ? 'border-green-400 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900 dark:text-white">Variant B: {AB_TEST_RESULTS.variantB.name}</h4>
                    {AB_TEST_RESULTS.winner === 'B' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-xs text-gray-500">Sent</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{AB_TEST_RESULTS.variantB.sent.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Clicked</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{AB_TEST_RESULTS.variantB.clicked.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">CTR</p>
                      <p className="text-lg font-bold text-blue-600">{AB_TEST_RESULTS.variantB.rate}%</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Statistical Analysis */}
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Statistical Analysis</span>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Confidence: <strong className={AB_TEST_RESULTS.significant ? 'text-green-600' : 'text-amber-600'}>{AB_TEST_RESULTS.confidence}%</strong>
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    Significant: {AB_TEST_RESULTS.significant
                      ? <span className="text-green-600 font-medium">Yes (p&lt;0.05)</span>
                      : <span className="text-amber-600 font-medium">Not yet</span>
                    }
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                  {AB_TEST_RESULTS.recommendation}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Campaign Detail Panel */}
      <AnimatePresence>
        {selectedCampaign && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex justify-end"
            onClick={() => setSelectedCampaign(null)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="w-full max-w-lg bg-white dark:bg-gray-800 shadow-xl overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">{selectedCampaign.name}</h2>
                  <button onClick={() => setSelectedCampaign(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selectedCampaign.status]}`}>
                    {selectedCampaign.status}
                  </span>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                    {selectedCampaign.type.replace('_', ' ')}
                  </span>
                  {selectedCampaign.channels.map(ch => (
                    <span key={ch} className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {ch}
                    </span>
                  ))}
                </div>

                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>Segment:</strong> {selectedCampaign.segment}
                </div>

                {/* Performance Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Reach', value: selectedCampaign.reach.toLocaleString() },
                    { label: 'Sent', value: selectedCampaign.sent.toLocaleString() },
                    { label: 'Delivered', value: selectedCampaign.delivered.toLocaleString() },
                    { label: 'Clicked', value: selectedCampaign.clicked.toLocaleString() },
                    { label: 'Failed', value: selectedCampaign.failed.toLocaleString() },
                    { label: 'Delivery Rate', value: `${selectedCampaign.deliveryRate}%` },
                    { label: 'Click Rate', value: `${selectedCampaign.clickRate}%` },
                    { label: 'Conversion', value: `${selectedCampaign.conversionRate}%` },
                  ].map(item => (
                    <div key={item.label} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <p className="text-xs text-gray-500">{item.label}</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{item.value}</p>
                    </div>
                  ))}
                </div>

                {/* Budget */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-500">Budget</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      ₦{(selectedCampaign.spent / 1000).toFixed(0)}K / ₦{(selectedCampaign.budget / 1000).toFixed(0)}K
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${selectedCampaign.budget > 0 ? Math.round(selectedCampaign.spent / selectedCampaign.budget * 100) : 0}%` }}
                    />
                  </div>
                  {selectedCampaign.revenueGenerated > 0 && (
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-gray-500">Revenue</span>
                      <span className="font-bold text-emerald-600">₦{(selectedCampaign.revenueGenerated / 1000000).toFixed(1)}M</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {selectedCampaign.status === 'draft' && (
                    <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                      <Play className="w-4 h-4" /> Launch
                    </button>
                  )}
                  {selectedCampaign.status === 'active' && (
                    <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700">
                      <Pause className="w-4 h-4" /> Pause
                    </button>
                  )}
                  {selectedCampaign.status === 'scheduled' && (
                    <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                      <Play className="w-4 h-4" /> Launch Now
                    </button>
                  )}
                  <button className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                    <Eye className="w-4 h-4" /> Preview
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
