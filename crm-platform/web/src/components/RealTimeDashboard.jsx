import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Wifi, WifiOff, Zap, Send, MessageSquare, Phone, Mail,
  Radio, Smartphone, TrendingUp, TrendingDown, Users, CheckCircle2,
  AlertTriangle, XCircle, ArrowUpRight, ArrowDownRight, Clock, Eye
} from 'lucide-react';
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const CHANNELS = [
  { id: 'sms', label: 'SMS', icon: Smartphone, color: 'blue' },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, color: 'green' },
  { id: 'telegram', label: 'Telegram', icon: Send, color: 'sky' },
  { id: 'voice', label: 'Voice', icon: Phone, color: 'purple' },
  { id: 'email', label: 'Email', icon: Mail, color: 'amber' },
];

function generateEvent(campaigns) {
  const types = ['sent', 'delivered', 'read', 'clicked', 'failed', 'opted_out'];
  const weights = [40, 30, 15, 8, 5, 2];
  let r = Math.random() * 100, idx = 0;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) { idx = i; break; } }
  const type = types[idx];
  const campaign = campaigns[Math.floor(Math.random() * campaigns.length)];
  const channel = CHANNELS[Math.floor(Math.random() * CHANNELS.length)];
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    campaignId: campaign.id,
    campaignName: campaign.name,
    channel: channel.id,
    channelLabel: channel.label,
    recipient: `+234${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
    timestamp: new Date(),
    latencyMs: Math.floor(Math.random() * 500 + 50),
  };
}

export default function RealTimeDashboard() {
  const { t } = useTranslation()
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState({
    totalSent: 21500, totalDelivered: 19430, totalClicked: 2867,
    totalFailed: 1445, totalOptedOut: 89,
    sentPerSecond: 0, deliveredPerSecond: 0,
    channelStats: {
      sms: { sent: 11200, delivered: 10400, rate: 92.9 },
      whatsapp: { sent: 8900, delivered: 8600, rate: 96.6 },
      telegram: { sent: 2100, delivered: 2050, rate: 97.6 },
      voice: { sent: 800, delivered: 720, rate: 90.0 },
      email: { sent: 5500, delivered: 4200, rate: 76.4 },
    }
  });
  const [throughputHistory, setThroughputHistory] = useState(Array(30).fill(0));
  const [isStreaming, setIsStreaming] = useState(false);
  const intervalRef = useRef(null);
  const sentCountRef = useRef(0);

  const campaigns = [
    { id: 'CMP-001', name: 'Agent → Savings Upsell' },
    { id: 'CMP-002', name: 'Remittance FX Cross-Sell' },
    { id: 'CMP-004', name: 'Dormant Reactivation' },
  ];

  const startStream = useCallback(() => {
    setIsStreaming(true);
    setConnected(true);
    sentCountRef.current = 0;
    intervalRef.current = setInterval(() => {
      const batchSize = Math.floor(Math.random() * 5) + 1;
      const newEvents = [];
      for (let i = 0; i < batchSize; i++) {
        newEvents.push(generateEvent(campaigns));
      }
      setEvents(prev => [...newEvents, ...prev].slice(0, 100));
      setStats(prev => {
        const updated = { ...prev };
        newEvents.forEach(evt => {
          if (evt.type === 'sent') { updated.totalSent++; sentCountRef.current++; }
          if (evt.type === 'delivered') updated.totalDelivered++;
          if (evt.type === 'clicked') updated.totalClicked++;
          if (evt.type === 'failed') updated.totalFailed++;
          if (evt.type === 'opted_out') updated.totalOptedOut++;
          const ch = updated.channelStats[evt.channel];
          if (ch) {
            if (evt.type === 'sent') ch.sent++;
            if (evt.type === 'delivered') { ch.delivered++; ch.rate = +(ch.delivered / ch.sent * 100).toFixed(1); }
          }
        });
        return updated;
      });
      setThroughputHistory(prev => [...prev.slice(1), batchSize]);
    }, 300);
  }, []);

  const stopStream = useCallback(() => {
    setIsStreaming(false);
    setConnected(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    startStream();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  useEffect(() => {
    const rateInterval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        sentPerSecond: Math.round(sentCountRef.current / 1),
      }));
      sentCountRef.current = 0;
    }, 1000);
    return () => clearInterval(rateInterval);
  }, []);

  const eventTypeConfig = {
    sent: { icon: Send, color: 'blue', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    delivered: { icon: CheckCircle2, color: 'green', bg: 'bg-green-100 dark:bg-green-900/30' },
    read: { icon: Eye, color: 'indigo', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
    clicked: { icon: ArrowUpRight, color: 'emerald', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    failed: { icon: XCircle, color: 'red', bg: 'bg-red-100 dark:bg-red-900/30' },
    opted_out: { icon: AlertTriangle, color: 'amber', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  };

  const maxThroughput = Math.max(...throughputHistory, 1);

  return (
    <div role="region" aria-label="RealTimeDashboard"  className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="w-7 h-7 text-indigo-600" />
            Real-Time Campaign Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">Live delivery events via WebSocket stream</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {connected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {connected ? 'Connected' : 'Disconnected'}
          </div>
          <button
            onClick={isStreaming ? stopStream : startStream}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isStreaming ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
          >
            {isStreaming ? 'Stop Stream' : 'Start Stream'}
          </button>
        </div>
      </div>

      {/* Live Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Sent', value: stats.totalSent.toLocaleString(), icon: Send, color: 'blue', delta: `${stats.sentPerSecond}/s` },
          { label: 'Delivered', value: stats.totalDelivered.toLocaleString(), icon: CheckCircle2, color: 'green', delta: `${((stats.totalDelivered / stats.totalSent) * 100).toFixed(1)}%` },
          { label: 'Clicked', value: stats.totalClicked.toLocaleString(), icon: ArrowUpRight, color: 'emerald', delta: `${((stats.totalClicked / stats.totalDelivered) * 100).toFixed(1)}%` },
          { label: 'Failed', value: stats.totalFailed.toLocaleString(), icon: XCircle, color: 'red', delta: `${((stats.totalFailed / stats.totalSent) * 100).toFixed(1)}%` },
          { label: 'Opted Out', value: stats.totalOptedOut.toLocaleString(), icon: AlertTriangle, color: 'amber', delta: 'cumulative' },
        ].map((m, i) => (
          <motion.div key={m.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            tabIndex="0" className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-${m.color}-100 dark:bg-${m.color}-900/30`}>
                <m.icon className={`w-5 h-5 text-${m.color}-600`} />
              </div>
              <div>
                <p className="text-xs text-gray-500">{m.label}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{m.value}</p>
                <p className="text-xs text-gray-400">{m.delta}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Throughput Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-indigo-600" /> Throughput (events/tick)
        </h3>
        <div className="flex items-end gap-1 h-20">
          {throughputHistory.map((v, i) => (
            <div key={i} className="flex-1 bg-indigo-200 dark:bg-indigo-900/50 rounded-t relative" style={{ height: `${(v / maxThroughput) * 100}%`, minHeight: '2px' }}>
              {i === throughputHistory.length - 1 && (
                <motion.div className="absolute inset-0 bg-indigo-500 rounded-t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Channel Health */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Channel Health</h3>
          <div className="space-y-3">
            {CHANNELS.map(ch => {
              const s = stats.channelStats[ch.id];
              return (
                <div key={ch.id} className="flex items-center gap-3">
                  <ch.icon className={`w-4 h-4 text-${ch.color}-600`} />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">{ch.label}</span>
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${s.rate > 90 ? 'bg-green-500' : s.rate > 80 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${s.rate}%` }} />
                  </div>
                  <span className={`text-sm font-bold ${s.rate > 90 ? 'text-green-600' : s.rate > 80 ? 'text-amber-600' : 'text-red-600'}`}>{s.rate}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Event Feed */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-green-500 animate-pulse" /> Live Event Feed
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            <AnimatePresence initial={false}>
              {events.slice(0, 15).map(evt => {
                const cfg = eventTypeConfig[evt.type];
                return (
                  <motion.div key={evt.id} initial={{ opacity: 0, x: -20, height: 0 }} animate={{ opacity: 1, x: 0, height: 'auto' }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-xs p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <div className={`p-1 rounded ${cfg.bg}`}>
                      <cfg.icon className={`w-3 h-3 text-${cfg.color}-600`} />
                    </div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">{evt.type}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-500 truncate flex-1">{evt.campaignName}</span>
                    <span className="text-gray-400">{evt.channelLabel}</span>
                    <span className="text-gray-400">{evt.latencyMs}ms</span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
