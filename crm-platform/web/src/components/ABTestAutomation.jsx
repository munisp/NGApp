import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FlaskConical, Play, Pause, CheckCircle2, XCircle, AlertCircle,
  TrendingUp, Users, Target, BarChart3, ArrowUpRight, ArrowDownRight,
  Clock, Plus, Eye, Trophy, Zap, RefreshCw
} from 'lucide-react';
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const TESTS = [
  {
    id: 'ABT-001', name: 'Savings Upsell — Message Tone',
    campaign: 'CMP-001', status: 'concluded', winner: 'B',
    startDate: '2026-04-28', endDate: '2026-05-02',
    autoPromoted: true, confidenceLevel: 97.8,
    variants: [
      { id: 'A', name: 'Formal', description: 'Professional banking tone', sent: 3400, delivered: 3230, clicked: 387, converted: 112, revenue: 5600000, conversionRate: 3.47 },
      { id: 'B', name: 'Friendly', description: 'Conversational warm tone', sent: 3400, delivered: 3220, clicked: 515, converted: 178, revenue: 8900000, conversionRate: 5.53 },
    ],
    metric: 'conversionRate',
    improvement: 59.4,
  },
  {
    id: 'ABT-002', name: 'FX Cross-Sell — Channel Preference',
    campaign: 'CMP-002', status: 'running', winner: null,
    startDate: '2026-05-01', endDate: null,
    autoPromoted: false, confidenceLevel: 88.2,
    variants: [
      { id: 'A', name: 'WhatsApp First', description: 'WhatsApp → SMS fallback', sent: 1450, delivered: 1392, clicked: 223, converted: 86, revenue: 4300000, conversionRate: 6.18 },
      { id: 'B', name: 'Telegram First', description: 'Telegram → WhatsApp fallback', sent: 1450, delivered: 1388, clicked: 195, converted: 71, revenue: 3550000, conversionRate: 5.11 },
    ],
    metric: 'conversionRate',
    improvement: null,
  },
  {
    id: 'ABT-003', name: 'Dormant Reactivation — Incentive Amount',
    campaign: 'CMP-004', status: 'running', winner: null,
    startDate: '2026-04-30', endDate: null,
    autoPromoted: false, confidenceLevel: 72.5,
    variants: [
      { id: 'A', name: '₦500 Bonus', description: 'Small incentive, lower cost', sent: 2200, delivered: 2090, clicked: 314, converted: 94, revenue: 2350000, conversionRate: 4.50 },
      { id: 'B', name: '₦2,000 Bonus', description: 'Large incentive, higher cost', sent: 2200, delivered: 2100, clicked: 462, converted: 168, revenue: 4200000, conversionRate: 8.00 },
      { id: 'C', name: 'Fee Waiver', description: '30-day zero-fee period', sent: 2200, delivered: 2080, clicked: 396, converted: 145, revenue: 3625000, conversionRate: 6.97 },
    ],
    metric: 'conversionRate',
    improvement: null,
  },
  {
    id: 'ABT-004', name: 'Insurance — Send Time Optimization',
    campaign: 'CMP-003', status: 'concluded', winner: 'B',
    startDate: '2026-04-25', endDate: '2026-04-30',
    autoPromoted: true, confidenceLevel: 95.2,
    variants: [
      { id: 'A', name: 'Morning (9AM)', description: 'Business hours start', sent: 1800, delivered: 1710, clicked: 205, converted: 54, revenue: 2700000, conversionRate: 3.16 },
      { id: 'B', name: 'Evening (7PM)', description: 'After work hours', sent: 1800, delivered: 1720, clicked: 310, converted: 92, revenue: 4600000, conversionRate: 5.35 },
    ],
    metric: 'conversionRate',
    improvement: 69.3,
  },
];

const STATUS_CONFIG = {
  running: { color: 'blue', label: 'Running', icon: Play },
  concluded: { color: 'green', label: 'Concluded', icon: CheckCircle2 },
  paused: { color: 'amber', label: 'Paused', icon: Pause },
  draft: { color: 'gray', label: 'Draft', icon: Clock },
};

export default function ABTestAutomation() {
  const { t } = useTranslation()
  const [tests] = useState(TESTS);
  const [selectedTest, setSelectedTest] = useState(null);
  const [activeTab, setActiveTab] = useState('tests');
  const [autoPromoteThreshold, setAutoPromoteThreshold] = useState(95);

  const totalTests = tests.length;
  const concluded = tests.filter(t => t.status === 'concluded').length;
  const avgImprovement = tests.filter(t => t.improvement).reduce((s, t) => s + t.improvement, 0) / concluded;

  return (
    <div role="region" aria-label="ABTestAutomation"  className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FlaskConical className="w-7 h-7 text-violet-600" />
            A/B Test Automation
          </h1>
          <p className="text-sm text-gray-500 mt-1">Automated split testing with statistical significance and auto-promotion</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">
            <Plus className="w-4 h-4" /> New Test
          </button>
        </div>
      </div>

      {/* Config Bar */}
      <div tabIndex="0" className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-violet-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Auto-Promote Threshold:</span>
          </div>
          <div className="flex gap-1">
            {[90, 95, 99].map(v => (
              <button key={v} onClick={() => setAutoPromoteThreshold(v)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${autoPromoteThreshold === v ? 'bg-violet-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                {v}%
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500">Auto-pause underperformers at 10% significance</span>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Tests', value: totalTests.toString(), icon: FlaskConical, color: 'violet' },
          { label: 'Running', value: tests.filter(t => t.status === 'running').length.toString(), icon: Play, color: 'blue' },
          { label: 'Concluded', value: concluded.toString(), icon: Trophy, color: 'green' },
          { label: 'Avg Improvement', value: `${avgImprovement.toFixed(1)}%`, icon: TrendingUp, color: 'emerald' },
        ].map((m, i) => (
          <motion.div key={m.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
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

      {/* Tests List */}
      <div className="space-y-3">
        {tests.map((test, i) => {
          const stCfg = STATUS_CONFIG[test.status];
          const leading = [...test.variants].sort((a, b) => b.conversionRate - a.conversionRate)[0];
          return (
            <motion.div key={test.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedTest(selectedTest?.id === test.id ? null : test)}
              className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-violet-300 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{test.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${stCfg.color}-100 text-${stCfg.color}-700`}>
                      {stCfg.label}
                    </span>
                    {test.autoPromoted && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Auto-promoted
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>Campaign: {test.campaign}</span>
                    <span>•</span>
                    <span>{test.variants.length} variants</span>
                    <span>•</span>
                    <span>Since {test.startDate}</span>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-right">
                  <div>
                    <p className="text-xs text-gray-500">Confidence</p>
                    <p className={`text-sm font-bold ${test.confidenceLevel >= autoPromoteThreshold ? 'text-green-600' : test.confidenceLevel >= 80 ? 'text-amber-600' : 'text-gray-600'}`}>
                      {test.confidenceLevel}%
                    </p>
                  </div>
                  {test.winner && (
                    <div>
                      <p className="text-xs text-gray-500">Winner</p>
                      <p className="text-sm font-bold text-violet-600 flex items-center gap-1">
                        <Trophy className="w-3 h-3" /> Variant {test.winner}
                      </p>
                    </div>
                  )}
                  {!test.winner && (
                    <div>
                      <p className="text-xs text-gray-500">Leading</p>
                      <p className="text-sm font-bold text-blue-600">Variant {leading.id}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded: Variant Comparison */}
              <AnimatePresence>
                {selectedTest?.id === test.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="grid gap-3">
                      {test.variants.map(v => {
                        const isWinner = test.winner === v.id;
                        const isLeading = !test.winner && v.id === leading.id;
                        return (
                          <div key={v.id} className={`p-4 rounded-lg border ${isWinner ? 'border-green-300 bg-green-50 dark:bg-green-900/10' : isLeading ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/10' : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-900 dark:text-white">Variant {v.id}: {v.name}</span>
                                {isWinner && <Trophy className="w-4 h-4 text-green-600" />}
                                {isLeading && <ArrowUpRight className="w-4 h-4 text-blue-600" />}
                              </div>
                              <span className="text-xs text-gray-500">{v.description}</span>
                            </div>
                            <div className="grid grid-cols-6 gap-4 text-sm">
                              <div>
                                <p className="text-xs text-gray-500">Sent</p>
                                <p className="font-medium">{v.sent.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Delivered</p>
                                <p className="font-medium">{v.delivered.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Clicked</p>
                                <p className="font-medium text-blue-600">{v.clicked}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Converted</p>
                                <p className="font-medium text-green-600">{v.converted}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Conv. Rate</p>
                                <p className={`font-bold ${isWinner || isLeading ? 'text-green-600' : ''}`}>{v.conversionRate.toFixed(2)}%</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Revenue</p>
                                <p className="font-medium">₦{(v.revenue / 1000000).toFixed(1)}M</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Confidence Progress */}
                    <div className="mt-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-700 dark:text-gray-300">Statistical Significance</span>
                        <span className={`text-sm font-bold ${test.confidenceLevel >= autoPromoteThreshold ? 'text-green-600' : 'text-amber-600'}`}>
                          {test.confidenceLevel}% confidence
                        </span>
                      </div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${test.confidenceLevel >= autoPromoteThreshold ? 'bg-green-500' : test.confidenceLevel >= 80 ? 'bg-amber-500' : 'bg-gray-400'}`}
                          style={{ width: `${test.confidenceLevel}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>0%</span>
                        <span className="text-violet-600 font-medium">↑ Auto-promote at {autoPromoteThreshold}%</span>
                        <span>100%</span>
                      </div>
                    </div>

                    {test.improvement && (
                      <div className="mt-3 text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                        <p className="text-sm text-green-700 dark:text-green-400">
                          <TrendingUp className="w-4 h-4 inline mr-1" />
                          Variant {test.winner} outperformed by <strong>{test.improvement}%</strong> — auto-promoted to 100% traffic
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
