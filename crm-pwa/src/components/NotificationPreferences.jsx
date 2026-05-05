import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bell, Smartphone, MessageSquare, Send, Phone, Mail, Radio,
  Clock, Users, CheckCircle2, Settings, Globe, Shield,
  BarChart3, Filter, Save, RefreshCw
} from 'lucide-react';

const CHANNELS = [
  { id: 'sms', label: 'SMS', icon: Smartphone, color: 'blue', description: 'Text messages to mobile number' },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, color: 'green', description: 'Messages via WhatsApp Business' },
  { id: 'telegram', label: 'Telegram', icon: Send, color: 'sky', description: 'Messages via Telegram bot' },
  { id: 'voice', label: 'Voice Call', icon: Phone, color: 'purple', description: 'AI-powered voice calls' },
  { id: 'email', label: 'Email', icon: Mail, color: 'amber', description: 'Email notifications' },
  { id: 'ussd', label: 'USSD', icon: Radio, color: 'gray', description: 'USSD push notifications' },
];

const TOPICS = [
  { id: 'transaction', label: 'Transaction Alerts', description: 'Deposits, withdrawals, transfers', critical: true },
  { id: 'security', label: 'Security Notifications', description: 'Login alerts, password changes', critical: true },
  { id: 'product_offers', label: 'Product Offers', description: 'New products, promotions, upsells', critical: false },
  { id: 'account_updates', label: 'Account Updates', description: 'Balance updates, statement ready', critical: false },
  { id: 'campaigns', label: 'Marketing Campaigns', description: 'Promotional campaigns, seasonal offers', critical: false },
  { id: 'agent_updates', label: 'Agent Banking Updates', description: 'Agent locations, service availability', critical: false },
  { id: 'fx_alerts', label: 'FX Rate Alerts', description: 'Favorable rate notifications', critical: false },
  { id: 'remittance', label: 'Remittance Updates', description: 'Transfer status, recipient notifications', critical: false },
];

const TIME_SLOTS = [
  { id: 'morning', label: 'Morning (8AM-12PM)', hours: '08:00-12:00' },
  { id: 'afternoon', label: 'Afternoon (12PM-5PM)', hours: '12:00-17:00' },
  { id: 'evening', label: 'Evening (5PM-9PM)', hours: '17:00-21:00' },
  { id: 'anytime', label: 'Anytime', hours: '08:00-21:00' },
];

const CUSTOMER_SEGMENTS_PREFS = [
  { segment: 'Core Banking Customers', total: 48900, configured: 42100, configRate: 86.1 },
  { segment: 'Agent Banking Customers', total: 24300, configured: 18200, configRate: 74.9 },
  { segment: 'Remittance Customers', total: 19200, configured: 16800, configRate: 87.5 },
  { segment: 'Multi-Channel Customers', total: 28700, configured: 25400, configRate: 88.5 },
];

export default function NotificationPreferences() {
  const [activeTab, setActiveTab] = useState('overview');
  const [preferences, setPreferences] = useState(() => {
    const prefs = {};
    TOPICS.forEach(topic => {
      prefs[topic.id] = {};
      CHANNELS.forEach(ch => {
        prefs[topic.id][ch.id] = topic.critical ? true : Math.random() > 0.3;
      });
    });
    return prefs;
  });
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('anytime');
  const [frequencyLimit, setFrequencyLimit] = useState(5);
  const [language, setLanguage] = useState('en');

  const togglePref = (topicId, channelId) => {
    const topic = TOPICS.find(t => t.id === topicId);
    if (topic?.critical) return;
    setPreferences(prev => ({
      ...prev,
      [topicId]: {
        ...prev[topicId],
        [channelId]: !prev[topicId][channelId],
      }
    }));
  };

  const totalConfigured = CUSTOMER_SEGMENTS_PREFS.reduce((s, seg) => s + seg.configured, 0);
  const totalCustomers = CUSTOMER_SEGMENTS_PREFS.reduce((s, seg) => s + seg.total, 0);

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Bell className="w-7 h-7 text-amber-600" />
            Notification Preferences Center
          </h1>
          <p className="text-sm text-gray-500 mt-1">Self-service channel preferences, quiet hours & frequency limits</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
          <Save className="w-4 h-4" /> Save Preferences
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Customers Configured', value: `${(totalConfigured / 1000).toFixed(1)}K`, icon: Users, color: 'green' },
          { label: 'Configuration Rate', value: `${(totalConfigured / totalCustomers * 100).toFixed(1)}%`, icon: CheckCircle2, color: 'blue' },
          { label: 'Avg Channels/Customer', value: '3.2', icon: Smartphone, color: 'purple' },
          { label: 'Opt-Out Rate (30d)', value: '2.1%', icon: Shield, color: 'amber' },
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

      {/* Tabs */}
      <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm border border-gray-200 dark:border-gray-700 w-fit">
        {['overview', 'matrix', 'settings', 'segments'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-amber-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Channel Adoption</h3>
            <div className="space-y-4">
              {CHANNELS.map(ch => {
                const adopted = Math.floor(totalConfigured * (0.5 + Math.random() * 0.4));
                const rate = (adopted / totalConfigured * 100).toFixed(1);
                return (
                  <div key={ch.id} className="flex items-center gap-3">
                    <ch.icon className={`w-4 h-4 text-${ch.color}-600`} />
                    <span className="text-sm text-gray-700 dark:text-gray-300 w-20">{ch.label}</span>
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full bg-${ch.color}-500`} style={{ width: `${rate}%` }} />
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white w-12 text-right">{rate}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Preferred Time Slots</h3>
            <div className="space-y-3">
              {[
                { slot: 'Morning (8AM-12PM)', pct: 28.5, customers: 29100 },
                { slot: 'Afternoon (12PM-5PM)', pct: 22.3, customers: 22800 },
                { slot: 'Evening (5PM-9PM)', pct: 35.1, customers: 35900 },
                { slot: 'Anytime', pct: 14.1, customers: 14400 },
              ].map(t => (
                <div key={t.slot} className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 w-40">{t.slot}</span>
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${t.pct * 2.85}%` }} />
                  </div>
                  <span className="text-sm font-bold text-gray-900 dark:text-white w-12 text-right">{t.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'matrix' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 overflow-x-auto">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Topic × Channel Preference Matrix</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 text-gray-500 font-medium w-48">Topic</th>
                {CHANNELS.map(ch => (
                  <th key={ch.id} className="text-center py-2 w-20">
                    <div className="flex flex-col items-center gap-1">
                      <ch.icon className={`w-4 h-4 text-${ch.color}-600`} />
                      <span className="text-xs text-gray-500">{ch.label}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TOPICS.map(topic => (
                <tr key={topic.id} className="border-b border-gray-100 dark:border-gray-700/50">
                  <td className="py-3">
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white text-sm">{topic.label}</span>
                      {topic.critical && <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded">Required</span>}
                      <p className="text-xs text-gray-500">{topic.description}</p>
                    </div>
                  </td>
                  {CHANNELS.map(ch => (
                    <td key={ch.id} className="text-center py-3">
                      <button
                        onClick={() => togglePref(topic.id, ch.id)}
                        disabled={topic.critical}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          preferences[topic.id]?.[ch.id]
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 hover:bg-green-200'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-400 hover:bg-gray-200'
                        } ${topic.critical ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                      >
                        {preferences[topic.id]?.[ch.id] ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border-2 border-gray-300" />}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Communication Settings</h3>
            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Preferred Time Window</label>
                <div className="flex gap-2 mt-2">
                  {TIME_SLOTS.map(slot => (
                    <button key={slot.id} onClick={() => setSelectedTimeSlot(slot.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedTimeSlot === slot.id ? 'bg-amber-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                      {slot.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Daily Message Limit</label>
                <div className="flex gap-2 mt-2">
                  {[3, 5, 10, 'Unlimited'].map(v => (
                    <button key={v} onClick={() => setFrequencyLimit(v)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${frequencyLimit === v ? 'bg-amber-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                      {v === 'Unlimited' ? v : `${v}/day`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Preferred Language</label>
                <div className="flex gap-2 mt-2">
                  {[
                    { id: 'en', label: 'English' }, { id: 'ha', label: 'Hausa' },
                    { id: 'yo', label: 'Yoruba' }, { id: 'ig', label: 'Igbo' },
                    { id: 'pcm', label: 'Pidgin' },
                  ].map(lang => (
                    <button key={lang.id} onClick={() => setLanguage(lang.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${language === lang.id ? 'bg-amber-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'segments' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Segment Preference Configuration</h3>
          <div className="space-y-3">
            {CUSTOMER_SEGMENTS_PREFS.map(seg => (
              <div key={seg.segment} className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white text-sm">{seg.segment}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 max-w-48 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${seg.configRate}%` }} />
                    </div>
                    <span className="text-xs text-gray-500">{seg.configRate}% configured</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Configured</p>
                    <p className="font-bold text-green-600">{seg.configured.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="font-bold">{seg.total.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
