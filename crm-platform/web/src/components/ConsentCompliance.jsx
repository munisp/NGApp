import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Lock, Users, CheckCircle2, XCircle, AlertTriangle,
  FileText, Eye, Clock, TrendingUp, TrendingDown, Search,
  Download, Filter, BarChart3, Bell, Globe, Smartphone,
  MessageSquare, Send, Phone, Mail
} from 'lucide-react';
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const CHANNEL_CONSENT = [
  { channel: 'SMS', icon: Smartphone, optedIn: 38200, optedOut: 4800, pending: 2100, total: 45100, rate: 84.7 },
  { channel: 'WhatsApp', icon: MessageSquare, optedIn: 42100, optedOut: 3200, pending: 1800, total: 47100, rate: 89.4 },
  { channel: 'Telegram', icon: Send, optedIn: 18400, optedOut: 6500, pending: 3200, total: 28100, rate: 65.5 },
  { channel: 'Voice', icon: Phone, optedIn: 22800, optedOut: 12400, pending: 4900, total: 40100, rate: 56.9 },
  { channel: 'Email', icon: Mail, optedIn: 35600, optedOut: 8900, pending: 2600, total: 47100, rate: 75.6 },
];

const COMPLIANCE_CHECKS = [
  { id: 1, name: 'NDPR Data Processing Notice', status: 'compliant', lastChecked: '2 hours ago', severity: 'critical' },
  { id: 2, name: 'Consent Collection at Registration', status: 'compliant', lastChecked: '2 hours ago', severity: 'critical' },
  { id: 3, name: 'Opt-Out Mechanism in Every Message', status: 'compliant', lastChecked: '1 hour ago', severity: 'critical' },
  { id: 4, name: 'Data Retention Policy (36 months)', status: 'compliant', lastChecked: '6 hours ago', severity: 'high' },
  { id: 5, name: 'Cross-Border Transfer Safeguards', status: 'warning', lastChecked: '12 hours ago', severity: 'high' },
  { id: 6, name: 'Minor Customer Data Protection', status: 'compliant', lastChecked: '1 day ago', severity: 'critical' },
  { id: 7, name: 'Marketing Frequency Limits', status: 'compliant', lastChecked: '3 hours ago', severity: 'medium' },
  { id: 8, name: 'Consent Audit Trail Completeness', status: 'compliant', lastChecked: '4 hours ago', severity: 'high' },
  { id: 9, name: 'Right to Erasure Implementation', status: 'warning', lastChecked: '2 days ago', severity: 'high' },
  { id: 10, name: 'Data Breach Notification SLA (72h)', status: 'compliant', lastChecked: '1 day ago', severity: 'critical' },
];

const RECENT_EVENTS = [
  { type: 'opt_out', customer: 'Amina Bello', channel: 'Voice', timestamp: '10 min ago', method: 'IVR keypress' },
  { type: 'opt_in', customer: 'Chidi Okonkwo', channel: 'WhatsApp', timestamp: '25 min ago', method: 'Registration form' },
  { type: 'erasure', customer: 'Fatima Musa', channel: 'All', timestamp: '1 hour ago', method: 'Written request' },
  { type: 'opt_out', customer: 'Emeka Eze', channel: 'SMS', timestamp: '2 hours ago', method: 'STOP keyword' },
  { type: 'consent_update', customer: 'Aisha Abdullahi', channel: 'Email', timestamp: '3 hours ago', method: 'Preference center' },
  { type: 'opt_in', customer: 'Olumide Adeyemi', channel: 'Telegram', timestamp: '4 hours ago', method: 'Bot command' },
  { type: 'opt_out', customer: 'Ngozi Ike', channel: 'Email', timestamp: '5 hours ago', method: 'Unsubscribe link' },
];

const SUPPRESSION_LISTS = [
  { name: 'Global Opt-Out', count: 35800, lastUpdated: '5 min ago', auto: true },
  { name: 'Complaint Escalation', count: 234, lastUpdated: '1 hour ago', auto: true },
  { name: 'Legal Hold', count: 12, lastUpdated: '3 days ago', auto: false },
  { name: 'Frequency Cap Exceeded', count: 1890, lastUpdated: '30 min ago', auto: true },
  { name: 'Bounce/Invalid Numbers', count: 4560, lastUpdated: '2 hours ago', auto: true },
];

export default function ConsentCompliance() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('consentcompliance', () => apiClient.dashboard.metrics(), { fallback: CHANNEL_CONSENT })
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('overview');

  const totalOptedIn = CHANNEL_CONSENT.reduce((s, c) => s + c.optedIn, 0);
  const totalOptedOut = CHANNEL_CONSENT.reduce((s, c) => s + c.optedOut, 0);
  const compliantChecks = COMPLIANCE_CHECKS.filter(c => c.status === 'compliant').length;
  const complianceScore = Math.round((compliantChecks / COMPLIANCE_CHECKS.length) * 100);

  return (
    <div role="region" aria-label="ConsentCompliance"  className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-7 h-7 text-emerald-600" />
            Consent & Compliance Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">NDPR compliance, consent management & suppression lists</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
            <Download className="w-4 h-4" /> Export Audit Report
          </button>
        </div>
      </div>

      {/* Compliance Score */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Compliance Score', value: `${complianceScore}%`, icon: Shield, color: complianceScore >= 90 ? 'green' : 'amber' },
          { label: 'Total Opted-In', value: `${(totalOptedIn / 1000).toFixed(1)}K`, icon: CheckCircle2, color: 'green' },
          { label: 'Total Opted-Out', value: `${(totalOptedOut / 1000).toFixed(1)}K`, icon: XCircle, color: 'red' },
          { label: 'Checks Passing', value: `${compliantChecks}/${COMPLIANCE_CHECKS.length}`, icon: Lock, color: 'blue' },
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
        {['overview', 'consent', 'checks', 'suppression', 'audit'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-emerald-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Channel Consent Rates */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Channel Consent Rates</h3>
              <div className="space-y-4">
                {CHANNEL_CONSENT.map(c => (
                  <div key={c.channel} className="flex items-center gap-3">
                    <c.icon className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300 w-20">{c.channel}</span>
                    <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${c.rate}%` }} />
                    </div>
                    <span className={`text-sm font-bold w-14 text-right ${c.rate >= 80 ? 'text-green-600' : c.rate >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{c.rate}%</span>
                    <span className="text-xs text-gray-400 w-16 text-right">{(c.optedIn / 1000).toFixed(1)}K in</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Consent Events */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Consent Events</h3>
              <div className="space-y-2">
                {RECENT_EVENTS.map((evt, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-sm">
                    <div className={`p-1 rounded ${evt.type === 'opt_in' ? 'bg-green-100' : evt.type === 'opt_out' ? 'bg-red-100' : evt.type === 'erasure' ? 'bg-amber-100' : 'bg-blue-100'}`}>
                      {evt.type === 'opt_in' ? <CheckCircle2 className="w-3 h-3 text-green-600" /> :
                       evt.type === 'opt_out' ? <XCircle className="w-3 h-3 text-red-600" /> :
                       evt.type === 'erasure' ? <AlertTriangle className="w-3 h-3 text-amber-600" /> :
                       <Bell className="w-3 h-3 text-blue-600" />}
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">{evt.customer}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-500">{evt.type.replace('_', ' ')}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-500">{evt.channel}</span>
                    <span className="ml-auto text-xs text-gray-400">{evt.timestamp}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'consent' && (
          <motion.div key="consent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Channel Consent Breakdown</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 text-gray-500 font-medium">Channel</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Opted In</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Opted Out</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Pending</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Total</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Consent Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {CHANNEL_CONSENT.map(c => (
                    <tr key={c.channel} className="border-b border-gray-100 dark:border-gray-700/50">
                      <td className="py-3 font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        <c.icon className="w-4 h-4 text-gray-500" /> {c.channel}
                      </td>
                      <td className="py-3 text-right text-green-600">{c.optedIn.toLocaleString()}</td>
                      <td className="py-3 text-right text-red-600">{c.optedOut.toLocaleString()}</td>
                      <td className="py-3 text-right text-amber-600">{c.pending.toLocaleString()}</td>
                      <td className="py-3 text-right">{c.total.toLocaleString()}</td>
                      <td className="py-3 text-right font-bold text-green-600">{c.rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'checks' && (
          <motion.div key="checks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">NDPR Compliance Checks</h3>
              <div className="space-y-2">
                {COMPLIANCE_CHECKS.map(check => (
                  <div key={check.id} className={`flex items-center justify-between p-4 rounded-lg ${check.status === 'compliant' ? 'bg-green-50 dark:bg-green-900/10' : 'bg-amber-50 dark:bg-amber-900/10'}`}>
                    <div className="flex items-center gap-3">
                      {check.status === 'compliant' ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <AlertTriangle className="w-5 h-5 text-amber-600" />}
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white text-sm">{check.name}</p>
                        <p className="text-xs text-gray-500">Last checked: {check.lastChecked}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${check.severity === 'critical' ? 'bg-red-100 text-red-700' : check.severity === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                        {check.severity}
                      </span>
                      <span className={`text-sm font-medium ${check.status === 'compliant' ? 'text-green-600' : 'text-amber-600'}`}>
                        {check.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'suppression' && (
          <motion.div key="suppression" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Suppression Lists</h3>
              <div className="space-y-3">
                {SUPPRESSION_LISTS.map(list => (
                  <div key={list.name} className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <div className="flex items-center gap-3">
                      <Lock className="w-4 h-4 text-gray-500" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white text-sm">{list.name}</p>
                        <p className="text-xs text-gray-500">Updated: {list.lastUpdated}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{list.count.toLocaleString()}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${list.auto ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                        {list.auto ? 'Auto-managed' : 'Manual'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'audit' && (
          <motion.div key="audit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Consent Audit Trail</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 text-gray-500 font-medium">Customer</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Action</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Channel</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Method</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {RECENT_EVENTS.map((evt, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50">
                      <td className="py-3 font-medium text-gray-900 dark:text-white">{evt.customer}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${evt.type === 'opt_in' ? 'bg-green-100 text-green-700' : evt.type === 'opt_out' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {evt.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 text-gray-600 dark:text-gray-400">{evt.channel}</td>
                      <td className="py-3 text-gray-600 dark:text-gray-400">{evt.method}</td>
                      <td className="py-3 text-right text-gray-500">{evt.timestamp}</td>
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
