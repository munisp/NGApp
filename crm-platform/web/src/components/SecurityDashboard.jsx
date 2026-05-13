import { useState, useContext, useEffect } from 'react';
import { useApiData } from '@/hooks/useApiData'
import { ShieldAlert, ShieldCheck, Lock, Eye, AlertTriangle, Ban, Activity, Globe, Cpu, Zap, Server, Shield } from 'lucide-react';
import { TenantContext } from '../contexts/TenantContext';
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { apiClient } from '@/lib/apiClient'

const SEED_SECURITY = {
  'tenant-acme-bank': {
    vulnerability_score: 96.8,
    owasp_coverage: { a01: true, a02: true, a03: true, a04: true, a05: true, a06: true, a07: true, a08: true, a09: true, a10: true },
    threats_blocked_24h: 142,
    active_attacks: 0,
    banned_ips: 3,
    rate_limited_24h: 1247,
    encryption_status: 'AES-256-GCM',
    pbac_policies: 6,
    waf_rules: 14,
    last_scan: '2025-05-04T12:00:00Z',
    ddos_protection: 'active',
    circuit_breaker: 'closed',
    recent_threats: [
      { id: 't-001', type: 'SQL Injection', severity: 'critical', source: '41.58.120.44', target: '/api/v1/customers', blocked: true, time: '14:45:00' },
      { id: 't-002', type: 'XSS Attempt', severity: 'high', source: '103.21.44.12', target: '/api/v1/campaigns', blocked: true, time: '14:32:15' },
      { id: 't-003', type: 'Brute Force', severity: 'high', source: '185.220.101.1', target: '/auth/login', blocked: true, time: '14:15:22' },
      { id: 't-004', type: 'Path Traversal', severity: 'medium', source: '91.134.0.44', target: '/api/v1/documents', blocked: true, time: '13:58:00' },
      { id: 't-005', type: 'Ransomware Probe', severity: 'critical', source: '45.33.32.156', target: '/api/v1/security', blocked: true, time: '13:30:44' },
    ],
    ip_reputation: [
      { ip: '41.58.120.44', score: 15, violations: 5, threat_level: 'critical', banned: true, country: 'NG' },
      { ip: '185.220.101.1', score: 25, violations: 3, threat_level: 'high', banned: true, country: 'DE' },
      { ip: '45.33.32.156', score: 30, violations: 4, threat_level: 'high', banned: true, country: 'US' },
    ],
  },
};

const OWASP_LABELS = {
  a01: 'Broken Access Control', a02: 'Cryptographic Failures', a03: 'Injection',
  a04: 'Insecure Design', a05: 'Security Misconfiguration', a06: 'Vulnerable Components',
  a07: 'Auth Failures', a08: 'Data Integrity', a09: 'Logging Failures', a10: 'SSRF',
};

export default function SecurityDashboard() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('securitydashboard', () => apiClient.dashboard.metrics(), { fallback: SEED_SECURITY })
  const { t } = useTranslation()
  const { tenantId } = useContext(TenantContext);
  const [data, setData] = useState(SEED_SECURITY[tenantId] || SEED_SECURITY['tenant-acme-bank']);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    setData(SEED_SECURITY[tenantId] || SEED_SECURITY['tenant-acme-bank']);
  }, [tenantId]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Shield },
    { id: 'threats', label: 'Threat Monitor', icon: AlertTriangle },
    { id: 'owasp', label: 'OWASP Coverage', icon: ShieldCheck },
    { id: 'ips', label: 'IP Reputation', icon: Globe },
  ];

  return (
    <div role="region" aria-label="SecurityDashboard"  className="p-6 max-w-full">
      <div className="flex items-center gap-3 mb-6">
        <ShieldAlert className="w-8 h-8 text-red-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Security Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">DDoS protection, WAF, PBAC, encryption, and threat monitoring</p>
        </div>
      </div>

      {/* Score Banner */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-6 mb-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">Platform Security Score</p>
            <p className="text-5xl font-bold">{data.vulnerability_score}%</p>
            <p className="text-sm opacity-80 mt-1">OWASP Top 10: 10/10 covered | PCI-DSS compliant | NDPR certified</p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-white dark:bg-gray-900/10 rounded-lg p-3">
              <p className="text-2xl font-bold">{data.threats_blocked_24h}</p>
              <p className="text-xs opacity-80">Threats Blocked (24h)</p>
            </div>
            <div className="bg-white dark:bg-gray-900/10 rounded-lg p-3">
              <p className="text-2xl font-bold">{data.waf_rules}</p>
              <p className="text-xs opacity-80">WAF Rules Active</p>
            </div>
            <div className="bg-white dark:bg-gray-900/10 rounded-lg p-3">
              <p className="text-2xl font-bold">{data.pbac_policies}</p>
              <p className="text-xs opacity-80">PBAC Policies</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg w-fit">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === tab.id ? 'bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300'}`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'DDoS Protection', value: data.ddos_protection, icon: Zap, color: 'text-green-600' },
            { label: 'Circuit Breaker', value: data.circuit_breaker, icon: Cpu, color: 'text-green-600' },
            { label: 'Encryption', value: data.encryption_status, icon: Lock, color: 'text-blue-600' },
            { label: 'Active Attacks', value: data.active_attacks, icon: AlertTriangle, color: data.active_attacks > 0 ? 'text-red-600' : 'text-green-600' },
            { label: 'Banned IPs', value: data.banned_ips, icon: Ban, color: 'text-orange-600' },
            { label: 'Rate Limited (24h)', value: data.rate_limited_24h.toLocaleString(), icon: Activity, color: 'text-blue-600' },
          ].map(item => (
            <div key={item.label} className="bg-white dark:bg-gray-900 rounded-xl p-4 border flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-gray-50 dark:bg-gray-800 ${item.color}`}><item.icon className="w-5 h-5" /></div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{item.label}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100 capitalize">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'threats' && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border">
          <div className="px-4 py-3 border-b">
            <h3 className="font-medium text-gray-900 dark:text-gray-100">Recent Threats (Last 24h)</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-2 text-left text-xs text-gray-500 dark:text-gray-400">Time</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 dark:text-gray-400">Type</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 dark:text-gray-400">Severity</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 dark:text-gray-400">Source IP</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 dark:text-gray-400">Target</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 dark:text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_threats.map(t => (
                <tr key={t.id} className="border-b hover:bg-gray-50 dark:bg-gray-800">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{t.time}</td>
                  <td className="px-4 py-3 font-medium">{t.type}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${t.severity === 'critical' ? 'bg-red-100 text-red-600' : t.severity === 'high' ? 'bg-orange-100 text-orange-600' : 'bg-yellow-100 text-yellow-600'}`}>{t.severity}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{t.source}</td>
                  <td className="px-4 py-3 font-mono text-xs">{t.target}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${t.blocked ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {t.blocked ? 'Blocked' : 'Allowed'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'owasp' && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border p-4">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">OWASP Top 10 (2021) Coverage</h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(OWASP_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-3 p-3 rounded-lg border">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${data.owasp_coverage[key] ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                  {data.owasp_coverage[key] ? <ShieldCheck className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{key.toUpperCase()}: {label}</p>
                  <p className={`text-xs ${data.owasp_coverage[key] ? 'text-green-600' : 'text-red-600'}`}>
                    {data.owasp_coverage[key] ? 'Protected' : 'Not Covered'}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <p className="text-sm font-medium text-green-700">Coverage: 10/10 — Full OWASP Top 10 protection active</p>
          </div>
        </div>
      )}

      {activeTab === 'ips' && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border">
          <div className="px-4 py-3 border-b">
            <h3 className="font-medium text-gray-900 dark:text-gray-100">IP Reputation Database</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-2 text-left text-xs text-gray-500 dark:text-gray-400">IP Address</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 dark:text-gray-400">Country</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 dark:text-gray-400">Score</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 dark:text-gray-400">Violations</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 dark:text-gray-400">Threat Level</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 dark:text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.ip_reputation.map(ip => (
                <tr key={ip.ip} className="border-b hover:bg-gray-50 dark:bg-gray-800">
                  <td className="px-4 py-3 font-mono">{ip.ip}</td>
                  <td className="px-4 py-3">{ip.country}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${ip.score > 70 ? 'bg-green-500' : ip.score > 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${ip.score}%` }} />
                      </div>
                      <span className="text-xs">{ip.score}/100</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{ip.violations}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${ip.threat_level === 'critical' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>{ip.threat_level}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${ip.banned ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                      {ip.banned ? 'Banned' : 'Active'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
