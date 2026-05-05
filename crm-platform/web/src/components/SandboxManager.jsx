import { useState } from 'react'
import {
  FlaskConical, Play, CheckCircle, XCircle, Clock, AlertTriangle, Server,
  RefreshCw, Zap, Shield, Terminal, FileText, ChevronRight
} from 'lucide-react'
import { useTenant } from '../contexts/TenantContext'

const SANDBOX_DATA = {
  'tenant-acme-bank': { customers: 500, agents: 200, txns: 5000, accounts: 1000, corridors: 8, status: 'active', expires: '2025-07-25' },
  'tenant-quickcash': { customers: 200, agents: 500, txns: 3000, accounts: 400, corridors: 8, status: 'active', expires: '2025-07-10' },
  'tenant-swiftremit': { customers: 300, agents: 0, txns: 4000, accounts: 600, corridors: 8, status: 'active', expires: '2025-08-01' },
  'tenant-nextgen-mfb': { customers: 50, agents: 20, txns: 200, accounts: 100, corridors: 8, status: 'active', expires: '2025-07-20' },
}

const TEST_SCENARIOS = [
  { id: 'ts-001', name: 'Customer CRUD', category: 'Core', desc: 'Create, read, update, delete customers', endpoint: '/v1/customers', required: true, status: 'passed', lastRun: '2 hours ago' },
  { id: 'ts-002', name: 'Authentication Flow', category: 'Security', desc: 'Obtain JWT, refresh, revoke', endpoint: '/auth/token', required: true, status: 'passed', lastRun: '2 hours ago' },
  { id: 'ts-003', name: 'Transaction Processing', category: 'Banking', desc: 'Create and verify transactions with idempotency', endpoint: '/v1/banking/transactions', required: true, status: 'passed', lastRun: '2 hours ago' },
  { id: 'ts-004', name: 'Agent Registration', category: 'Agent Banking', desc: 'Register agent, verify KYC, activate', endpoint: '/v1/agents', required: false, status: 'pending', lastRun: null },
  { id: 'ts-005', name: 'Remittance Transfer', category: 'Remittance', desc: 'Initiate transfer, check status, complete', endpoint: '/v1/remittance/transfers', required: false, status: 'pending', lastRun: null },
  { id: 'ts-006', name: 'Webhook Delivery', category: 'Integration', desc: 'Subscribe to events, verify HMAC signature', endpoint: '/v1/webhooks', required: true, status: 'failed', lastRun: '1 hour ago' },
  { id: 'ts-007', name: 'Rate Limit Handling', category: 'Resilience', desc: 'Handle 429 responses with backoff', endpoint: '/v1/customers', required: true, status: 'passed', lastRun: '2 hours ago' },
  { id: 'ts-008', name: 'Error Handling', category: 'Resilience', desc: 'Validate error response format', endpoint: '/v1/customers/invalid', required: true, status: 'passed', lastRun: '2 hours ago' },
  { id: 'ts-009', name: 'Idempotency Check', category: 'Core', desc: 'Same request twice, verify single creation', endpoint: '/v1/banking/transactions', required: true, status: 'passed', lastRun: '2 hours ago' },
  { id: 'ts-010', name: 'Pagination', category: 'Core', desc: 'List with page/limit, verify cursor navigation', endpoint: '/v1/customers?page=1&limit=10', required: true, status: 'passed', lastRun: '2 hours ago' },
  { id: 'ts-011', name: 'Concurrent Access', category: 'Performance', desc: '10 parallel requests, all succeed', endpoint: '/v1/customers', required: false, status: 'pending', lastRun: null },
  { id: 'ts-012', name: 'Data Isolation', category: 'Security', desc: 'Verify tenant A cannot access tenant B data', endpoint: '/v1/customers', required: true, status: 'passed', lastRun: '2 hours ago' },
]

const SandboxManager = () => {
  const { tenant, tenantId } = useTenant()
  const sandbox = SANDBOX_DATA[tenantId] || SANDBOX_DATA['tenant-nextgen-mfb']
  const [tab, setTab] = useState('environment')
  const [scenarios, setScenarios] = useState(TEST_SCENARIOS)

  const passed = scenarios.filter(s => s.status === 'passed').length
  const failed = scenarios.filter(s => s.status === 'failed').length
  const pending = scenarios.filter(s => s.status === 'pending').length
  const requiredPassed = scenarios.filter(s => s.required && s.status === 'passed').length
  const requiredTotal = scenarios.filter(s => s.required).length
  const certificationReady = requiredPassed === requiredTotal

  const handleRunScenario = (id) => {
    setScenarios(prev => prev.map(s => s.id === id ? { ...s, status: 'running' } : s))
    setTimeout(() => {
      setScenarios(prev => prev.map(s => s.id === id ? { ...s, status: Math.random() > 0.15 ? 'passed' : 'failed', lastRun: 'just now' } : s))
    }, 1500)
  }

  const handleRunAll = () => {
    const pendingIds = scenarios.filter(s => s.status === 'pending').map(s => s.id)
    pendingIds.forEach((id, i) => {
      setTimeout(() => handleRunScenario(id), i * 800)
    })
  }

  const tabs = ['environment', 'certification', 'sessions']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
            <FlaskConical className="w-7 h-7 text-orange-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Sandbox Environment</h1>
            <p className="text-gray-500 dark:text-gray-400">Testing, certification & sandbox management for {tenant?.name}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Tests Passed', value: `${passed}/${scenarios.length}`, icon: CheckCircle, color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
          { label: 'Tests Failed', value: failed, icon: XCircle, color: 'text-red-600 bg-red-50 dark:bg-red-900/20' },
          { label: 'Certification', value: certificationReady ? 'Ready' : `${requiredPassed}/${requiredTotal}`, icon: Shield, color: certificationReady ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
          { label: 'Sandbox Expires', value: sandbox.expires, icon: Clock, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' },
        ].map((stat, i) => (
          <div key={i} className={`p-4 rounded-xl border ${stat.color}`}>
            <div className="flex items-center space-x-3">
              <stat.icon className="w-5 h-5" />
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm opacity-70">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition ${tab === t ? 'bg-white dark:bg-gray-600 shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'environment' && (
        <div className="space-y-4">
          {/* Sandbox Config */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-6">
            <h3 className="font-semibold mb-4 flex items-center space-x-2">
              <Server className="w-5 h-5 text-orange-600" />
              <span>Sandbox Configuration</span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Base URL', value: 'sandbox.banking-crm.example.com/v1' },
                { label: 'API Key Prefix', value: 'sbx_' },
                { label: 'Rate Limit', value: '50% of production' },
                { label: 'Max Test Txns', value: '10,000' },
              ].map((item, i) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{item.label}</p>
                  <p className="font-medium text-sm mt-1 font-mono">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Test Data */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-6">
            <h3 className="font-semibold mb-4 flex items-center space-x-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span>Provisioned Test Data</span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Customers', value: sandbox.customers },
                { label: 'Agents', value: sandbox.agents },
                { label: 'Transactions', value: sandbox.txns.toLocaleString() },
                { label: 'Accounts', value: sandbox.accounts },
                { label: 'Corridors', value: sandbox.corridors },
              ].map((item, i) => (
                <div key={i} className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{item.value}</p>
                  <p className="text-xs text-gray-500">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Environment Comparison */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-6">
            <h3 className="font-semibold mb-4">Environment Comparison</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Feature</th>
                  <th className="text-center py-2">Sandbox</th>
                  <th className="text-center py-2">Production</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  ['Data Isolation', 'Fully isolated', 'Fully isolated'],
                  ['Rate Limits', '50% of prod', 'Full limits'],
                  ['API Key Prefix', 'sbx_', 'prod_'],
                  ['Real Transactions', 'Test only', 'Live'],
                  ['Webhook Delivery', 'Enabled', 'Enabled'],
                  ['External APIs', 'Mocked responses', 'Live connections'],
                  ['Data Retention', '90 days', 'Per policy'],
                ].map(([feature, sandbox, prod], i) => (
                  <tr key={i}>
                    <td className="py-2 font-medium">{feature}</td>
                    <td className="py-2 text-center text-blue-600">{sandbox}</td>
                    <td className="py-2 text-center text-green-600">{prod}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'certification' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Certification Test Suite</h3>
              <p className="text-sm text-gray-500">Pass all required tests to move to production</p>
            </div>
            <button onClick={handleRunAll} className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">
              <Play className="w-4 h-4" />
              <span>Run Pending Tests</span>
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Test</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Endpoint</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Required</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Last Run</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {scenarios.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-sm">{s.name}</p>
                        <p className="text-xs text-gray-400">{s.desc}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{s.category}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.endpoint}</td>
                    <td className="px-4 py-3 text-center">
                      {s.required ? <Shield className="w-4 h-4 text-amber-500 mx-auto" /> : <span className="text-xs text-gray-400">Optional</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {s.status === 'passed' && <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />}
                      {s.status === 'failed' && <XCircle className="w-5 h-5 text-red-500 mx-auto" />}
                      {s.status === 'pending' && <Clock className="w-5 h-5 text-gray-400 mx-auto" />}
                      {s.status === 'running' && <RefreshCw className="w-5 h-5 text-blue-500 mx-auto animate-spin" />}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500">{s.lastRun || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      {(s.status === 'pending' || s.status === 'failed') && (
                        <button onClick={() => handleRunScenario(s.id)} className="text-orange-600 hover:text-orange-800">
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'sessions' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-6">
          <h3 className="font-semibold mb-4">Sandbox Sessions</h3>
          <p className="text-sm text-gray-500 mb-4">
            Create a sandbox session to get temporary API credentials for testing. Sessions expire after 24 hours.
          </p>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
            <h4 className="text-sm font-medium mb-2">Quick Start:</h4>
            <pre className="text-xs font-mono bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto">{`# 1. Get sandbox credentials
curl -X POST https://sandbox.banking-crm.example.com/v1/sessions \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "X-Tenant-ID: ${tenantId}"

# Response: { "api_key": "sbx_...", "endpoint": "https://sandbox...", "expires_at": "..." }

# 2. Use sandbox API key for all test requests
curl https://sandbox.banking-crm.example.com/v1/customers \\
  -H "X-API-Key: sbx_YOUR_SANDBOX_KEY" \\
  -H "X-Tenant-ID: ${tenantId}"`}</pre>
          </div>
          <div className="space-y-2">
            {[
              { id: 'sess-a1b2', status: 'active', created: '2 hours ago', requests: 1248, expires: 'in 22 hours' },
              { id: 'sess-c3d4', status: 'expired', created: '2 days ago', requests: 4200, expires: 'expired' },
            ].map(sess => (
              <div key={sess.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Terminal className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-mono">{sess.id}</p>
                    <p className="text-xs text-gray-500">Created {sess.created} | {sess.requests.toLocaleString()} requests</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-xs text-gray-400">{sess.expires}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${sess.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                    {sess.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default SandboxManager
