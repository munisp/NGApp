import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign, TrendingUp, BarChart3, Target, ArrowUpRight,
  ArrowDownRight, Users, Megaphone, MessageSquare, Send,
  Phone, Mail, Smartphone, MapPin, Clock, CheckCircle2,
  Eye, Filter, Calendar, Zap
} from 'lucide-react';

const CAMPAIGN_ROI = [
  {
    id: 'CMP-001', name: 'Agent → Savings Account Upsell',
    spend: 340000, revenue: 12600000, roi: 3605.9,
    conversions: 354, conversionValue: 35600,
    channels: ['sms', 'whatsapp'],
    touchpoints: { first: 'sms', last: 'whatsapp' },
    timeToConvert: '3.2 days',
    attribution: { firstTouch: 42, lastTouch: 58, linear: 50 },
  },
  {
    id: 'CMP-002', name: 'Remittance FX Account Cross-Sell',
    spend: 280000, revenue: 9760000, roi: 3385.7,
    conversions: 178, conversionValue: 54830,
    channels: ['whatsapp', 'telegram'],
    touchpoints: { first: 'telegram', last: 'whatsapp' },
    timeToConvert: '5.1 days',
    attribution: { firstTouch: 35, lastTouch: 65, linear: 50 },
  },
  {
    id: 'CMP-003', name: 'Premium Insurance Upsell',
    spend: 420000, revenue: 4680000, roi: 1014.3,
    conversions: 92, conversionValue: 50870,
    channels: ['email', 'voice'],
    touchpoints: { first: 'email', last: 'voice' },
    timeToConvert: '8.4 days',
    attribution: { firstTouch: 55, lastTouch: 45, linear: 50 },
  },
  {
    id: 'CMP-004', name: 'Dormant Account Reactivation',
    spend: 180000, revenue: 2160000, roi: 1100.0,
    conversions: 210, conversionValue: 10290,
    channels: ['sms', 'whatsapp', 'voice'],
    touchpoints: { first: 'sms', last: 'voice' },
    timeToConvert: '12.5 days',
    attribution: { firstTouch: 30, lastTouch: 45, linear: 33 },
  },
  {
    id: 'CMP-005', name: 'Business Loan Pre-Qualification',
    spend: 560000, revenue: 29200000, roi: 5114.3,
    conversions: 68, conversionValue: 429410,
    channels: ['whatsapp', 'voice'],
    touchpoints: { first: 'whatsapp', last: 'voice' },
    timeToConvert: '15.8 days',
    attribution: { firstTouch: 40, lastTouch: 60, linear: 50 },
  },
];

const CHANNEL_ATTRIBUTION = [
  { channel: 'WhatsApp', icon: MessageSquare, color: 'green', revenue: 24800000, conversions: 520, spend: 480000, roi: 5066.7 },
  { channel: 'SMS', icon: Smartphone, color: 'blue', revenue: 12400000, conversions: 380, spend: 320000, roi: 3775.0 },
  { channel: 'Voice', icon: Phone, color: 'purple', revenue: 18200000, conversions: 210, spend: 620000, roi: 2835.5 },
  { channel: 'Telegram', icon: Send, color: 'sky', revenue: 8900000, conversions: 145, spend: 180000, roi: 4844.4 },
  { channel: 'Email', icon: Mail, color: 'amber', revenue: 5600000, conversions: 92, spend: 140000, roi: 3900.0 },
];

const PRODUCT_ATTRIBUTION = [
  { product: 'Savings Account', conversions: 354, revenue: 12600000, avgValue: 35600 },
  { product: 'Business Loan', conversions: 68, revenue: 29200000, avgValue: 429410 },
  { product: 'FX Account', conversions: 178, revenue: 9760000, avgValue: 54830 },
  { product: 'Insurance', conversions: 92, revenue: 4680000, avgValue: 50870 },
  { product: 'Fixed Deposit', conversions: 142, revenue: 8520000, avgValue: 60000 },
];

export default function RevenueAttribution() {
  const [activeTab, setActiveTab] = useState('overview');
  const [attributionModel, setAttributionModel] = useState('lastTouch');

  const totalRevenue = CAMPAIGN_ROI.reduce((s, c) => s + c.revenue, 0);
  const totalSpend = CAMPAIGN_ROI.reduce((s, c) => s + c.spend, 0);
  const totalConversions = CAMPAIGN_ROI.reduce((s, c) => s + c.conversions, 0);
  const overallROI = ((totalRevenue - totalSpend) / totalSpend * 100).toFixed(0);

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-7 h-7 text-emerald-600" />
            Revenue Attribution & ROI
          </h1>
          <p className="text-sm text-gray-500 mt-1">Campaign-to-conversion tracking with multi-touch attribution</p>
        </div>
        <div className="flex gap-2">
          {['firstTouch', 'lastTouch', 'linear'].map(model => (
            <button key={model} onClick={() => setAttributionModel(model)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${attributionModel === model ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'}`}>
              {model === 'firstTouch' ? 'First Touch' : model === 'lastTouch' ? 'Last Touch' : 'Linear'}
            </button>
          ))}
        </div>
      </div>

      {/* Top-Level Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Revenue', value: `₦${(totalRevenue / 1000000).toFixed(1)}M`, icon: DollarSign, color: 'emerald' },
          { label: 'Total Spend', value: `₦${(totalSpend / 1000000).toFixed(1)}M`, icon: Megaphone, color: 'blue' },
          { label: 'Overall ROI', value: `${overallROI}%`, icon: TrendingUp, color: 'green' },
          { label: 'Conversions', value: totalConversions.toLocaleString(), icon: CheckCircle2, color: 'purple' },
          { label: 'Avg Conv. Value', value: `₦${(totalRevenue / totalConversions / 1000).toFixed(0)}K`, icon: Target, color: 'amber' },
        ].map((m, i) => (
          <motion.div key={m.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
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

      {/* Tabs */}
      <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm border border-gray-200 dark:border-gray-700 w-fit">
        {['overview', 'campaigns', 'channels', 'products'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-emerald-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue by Campaign */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Revenue by Campaign</h3>
              <div className="space-y-3">
                {[...CAMPAIGN_ROI].sort((a, b) => b.revenue - a.revenue).map(c => (
                  <div key={c.id} className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 dark:text-gray-300 w-48 truncate">{c.name}</span>
                    <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(c.revenue / totalRevenue) * 100}%` }} />
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white w-20 text-right">₦{(c.revenue / 1000000).toFixed(1)}M</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ROI Leaderboard */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">ROI Leaderboard</h3>
              <div className="space-y-3">
                {[...CAMPAIGN_ROI].sort((a, b) => b.roi - a.roi).map((c, i) => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-400 text-amber-900' : i === 1 ? 'bg-gray-300 text-gray-700' : i === 2 ? 'bg-orange-300 text-orange-800' : 'bg-gray-100 text-gray-600'}`}>
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{c.name}</span>
                    </div>
                    <span className="text-sm font-bold text-emerald-600">{c.roi.toFixed(0)}% ROI</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'campaigns' && (
          <motion.div key="campaigns" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Campaign Attribution Detail</h3>
              <div className="space-y-4">
                {CAMPAIGN_ROI.map(c => (
                  <div key={c.id} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{c.name}</h4>
                      <span className="text-sm font-bold text-emerald-600">{c.roi.toFixed(0)}% ROI</span>
                    </div>
                    <div className="grid grid-cols-5 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Spend</p>
                        <p className="font-medium">₦{(c.spend / 1000).toFixed(0)}K</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Revenue</p>
                        <p className="font-bold text-emerald-600">₦{(c.revenue / 1000000).toFixed(1)}M</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Conversions</p>
                        <p className="font-medium">{c.conversions}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Avg Value</p>
                        <p className="font-medium">₦{(c.conversionValue / 1000).toFixed(0)}K</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Time to Convert</p>
                        <p className="font-medium">{c.timeToConvert}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-xs">
                      <span className="text-gray-500">Touch path:</span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">{c.touchpoints.first}</span>
                      <ArrowUpRight className="w-3 h-3 text-gray-400" />
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">{c.touchpoints.last}</span>
                      <span className="ml-4 text-gray-500">
                        {attributionModel === 'firstTouch' ? `${c.attribution.firstTouch}% first touch` :
                         attributionModel === 'lastTouch' ? `${c.attribution.lastTouch}% last touch` :
                         `${c.attribution.linear}% each (linear)`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'channels' && (
          <motion.div key="channels" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Channel Revenue Attribution</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 text-gray-500 font-medium">Channel</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Revenue</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Conversions</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Spend</th>
                    <th className="text-right py-2 text-gray-500 font-medium">ROI</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Revenue Share</th>
                  </tr>
                </thead>
                <tbody>
                  {CHANNEL_ATTRIBUTION.map(c => {
                    const totalChRevenue = CHANNEL_ATTRIBUTION.reduce((s, ch) => s + ch.revenue, 0);
                    return (
                      <tr key={c.channel} className="border-b border-gray-100 dark:border-gray-700/50">
                        <td className="py-3 font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          <c.icon className={`w-4 h-4 text-${c.color}-600`} /> {c.channel}
                        </td>
                        <td className="py-3 text-right font-bold text-emerald-600">₦{(c.revenue / 1000000).toFixed(1)}M</td>
                        <td className="py-3 text-right">{c.conversions}</td>
                        <td className="py-3 text-right">₦{(c.spend / 1000).toFixed(0)}K</td>
                        <td className="py-3 text-right font-bold text-green-600">{c.roi.toFixed(0)}%</td>
                        <td className="py-3 text-right">{((c.revenue / totalChRevenue) * 100).toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'products' && (
          <motion.div key="products" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Product Revenue Attribution</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 text-gray-500 font-medium">Product</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Conversions</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Total Revenue</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Avg Conversion Value</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Revenue Share</th>
                  </tr>
                </thead>
                <tbody>
                  {PRODUCT_ATTRIBUTION.sort((a, b) => b.revenue - a.revenue).map(p => {
                    const totalProdRevenue = PRODUCT_ATTRIBUTION.reduce((s, pr) => s + pr.revenue, 0);
                    return (
                      <tr key={p.product} className="border-b border-gray-100 dark:border-gray-700/50">
                        <td className="py-3 font-medium text-gray-900 dark:text-white">{p.product}</td>
                        <td className="py-3 text-right">{p.conversions}</td>
                        <td className="py-3 text-right font-bold text-emerald-600">₦{(p.revenue / 1000000).toFixed(1)}M</td>
                        <td className="py-3 text-right">₦{(p.avgValue / 1000).toFixed(0)}K</td>
                        <td className="py-3 text-right">{((p.revenue / totalProdRevenue) * 100).toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
