import { useState } from 'react'
import {
  Webhook, Plus, Trash2, RotateCw, Copy, CheckCircle, XCircle, Clock,
  AlertTriangle, Activity, Eye, Shield, Zap, RefreshCw
} from 'lucide-react'
import { useTenant } from '../contexts/TenantContext'

const EVENT_CATEGORIES = {
  Customer: ['customer.created', 'customer.updated', 'customer.deleted'],
  Transaction: ['transaction.completed', 'transaction.failed', 'transaction.reversed'],
  Agent: ['agent.activated', 'agent.deactivated'],
  Transfer: ['transfer.initiated', 'transfer.completed', 'transfer.failed'],
  Campaign: ['campaign.sent', 'campaign.delivered'],
  KYC: ['kyc.approved', 'kyc.rejected'],
  Quota: ['quota.warning', 'quota.exceeded'],
}

const SEED_SUBS = {
  'tenant-acme-bank': [
    { id: 'whk-001', url: 'https://acme-bank.ng/webhooks/crm', events: ['customer.created', 'customer.updated', 'transaction.completed', 'transaction.failed', 'kyc.approved', 'kyc.rejected'], status: 'active', created: '2025-02-15', deliveries: 4250, successRate: 99.2 },
    { id: 'whk-002', url: 'https://acme-bank.ng/webhooks/campaigns', events: ['campaign.sent', 'campaign.delivered'], status: 'active', created: '2025-03-01', deliveries: 1820, successRate: 98.7 },
  ],
  'tenant-quickcash': [
    { id: 'whk-003', url: 'https://api.quickcash.ng/webhook', events: ['agent.activated', 'agent.deactivated', 'transaction.completed'], status: 'active', created: '2025-02-20', deliveries: 2100, successRate: 97.5 },
  ],
  'tenant-swiftremit': [
    { id: 'whk-004', url: 'https://swiftremit.com/api/hooks', events: ['transfer.initiated', 'transfer.completed', 'transfer.failed', 'kyc.approved'], status: 'active', created: '2025-03-10', deliveries: 3800, successRate: 99.8 },
  ],
  'tenant-nextgen-mfb': [],
}

const SEED_DELIVERIES = [
  { id: 'dlv-001', event: 'customer.created', url: 'https://acme-bank.ng/webhooks/crm', status: 'delivered', statusCode: 200, time: '2 min ago', latency: 145 },
  { id: 'dlv-002', event: 'transaction.completed', url: 'https://acme-bank.ng/webhooks/crm', status: 'delivered', statusCode: 200, time: '5 min ago', latency: 89 },
  { id: 'dlv-003', event: 'campaign.delivered', url: 'https://acme-bank.ng/webhooks/campaigns', status: 'delivered', statusCode: 200, time: '12 min ago', latency: 210 },
  { id: 'dlv-004', event: 'transaction.failed', url: 'https://acme-bank.ng/webhooks/crm', status: 'failed', statusCode: 500, time: '25 min ago', latency: 3200 },
  { id: 'dlv-005', event: 'customer.updated', url: 'https://acme-bank.ng/webhooks/crm', status: 'delivered', statusCode: 200, time: '32 min ago', latency: 112 },
  { id: 'dlv-006', event: 'kyc.approved', url: 'https://acme-bank.ng/webhooks/crm', status: 'delivered', statusCode: 200, time: '1 hour ago', latency: 165 },
  { id: 'dlv-007', event: 'transfer.completed', url: 'https://swiftremit.com/api/hooks', status: 'delivered', statusCode: 200, time: '1 hour ago', latency: 198 },
  { id: 'dlv-008', event: 'agent.activated', url: 'https://api.quickcash.ng/webhook', status: 'retrying', statusCode: 408, time: '2 hours ago', latency: 5000 },
  { id: 'dlv-009', event: 'customer.created', url: 'https://acme-bank.ng/webhooks/crm', status: 'delivered', statusCode: 200, time: '3 hours ago', latency: 95 },
  { id: 'dlv-010', event: 'transfer.initiated', url: 'https://swiftremit.com/api/hooks', status: 'delivered', statusCode: 200, time: '4 hours ago', latency: 178 },
]

const WebhookManager = () => {
  const { tenant, tenantId } = useTenant()
  const [subs, setSubs] = useState(SEED_SUBS[tenantId] || [])
  const [tab, setTab] = useState('subscriptions')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedEvents, setSelectedEvents] = useState([])
  const [newUrl, setNewUrl] = useState('')
  const [showSignature, setShowSignature] = useState(false)
  const [copiedId, setCopiedId] = useState(null)

  const totalDeliveries = subs.reduce((sum, s) => sum + s.deliveries, 0)
  const avgSuccess = subs.length > 0 ? subs.reduce((sum, s) => sum + s.successRate, 0) / subs.length : 0

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const toggleEvent = (event) => {
    setSelectedEvents(prev => prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event])
  }

  const handleCreate = () => {
    const sub = {
      id: `whk-${Date.now()}`,
      url: newUrl,
      events: selectedEvents,
      status: 'active',
      created: new Date().toISOString().split('T')[0],
      deliveries: 0,
      successRate: 100,
    }
    setSubs(prev => [...prev, sub])
    setShowCreate(false)
    setNewUrl('')
    setSelectedEvents([])
  }

  const handleRevoke = (id) => {
    setSubs(prev => prev.map(s => s.id === id ? { ...s, status: 'revoked' } : s))
  }

  const tabs = ['subscriptions', 'deliveries', 'signature']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-teal-100 dark:bg-teal-900/30 rounded-xl">
            <Webhook className="w-7 h-7 text-teal-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Webhook Management</h1>
            <p className="text-gray-500 dark:text-gray-400">Event subscriptions & delivery monitoring for {tenant?.name}</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition">
          <Plus className="w-4 h-4" />
          <span>Add Endpoint</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Subscriptions', value: subs.filter(s => s.status === 'active').length, icon: Webhook, color: 'text-teal-600 bg-teal-50 dark:bg-teal-900/20' },
          { label: 'Total Deliveries', value: totalDeliveries.toLocaleString(), icon: Zap, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Success Rate', value: `${avgSuccess.toFixed(1)}%`, icon: CheckCircle, color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
          { label: 'Event Types', value: Object.values(EVENT_CATEGORIES).flat().length, icon: Activity, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' },
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
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition ${tab === t ? 'bg-white dark:bg-gray-600 shadow text-teal-600' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'subscriptions' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border overflow-hidden">
          {subs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Webhook className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No webhook subscriptions</p>
              <p className="text-sm">Add an endpoint to receive real-time event notifications</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Endpoint URL</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Events</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Deliveries</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Success Rate</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {subs.map(sub => (
                  <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-4 py-3">
                      <div>
                        <code className="text-sm font-mono">{sub.url}</code>
                        <p className="text-xs text-gray-400 mt-0.5">Created {sub.created}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {sub.events.slice(0, 3).map(e => (
                          <span key={e} className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{e}</span>
                        ))}
                        {sub.events.length > 3 && <span className="text-xs text-gray-400">+{sub.events.length - 3}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-sm">{sub.deliveries.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-medium ${sub.successRate >= 99 ? 'text-green-600' : sub.successRate >= 95 ? 'text-amber-600' : 'text-red-600'}`}>
                        {sub.successRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${sub.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {sub.status === 'active' ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {sub.status === 'active' && (
                        <button onClick={() => handleRevoke(sub.id)} className="text-red-600 hover:text-red-800" title="Revoke">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'deliveries' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Endpoint</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">HTTP</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Latency</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {SEED_DELIVERIES.map(d => (
                <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="px-4 py-3">
                    <span className="text-sm font-mono bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{d.event}</span>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-500">{d.url}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      d.status === 'delivered' ? 'bg-green-100 text-green-700' :
                      d.status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {d.status === 'delivered' ? <CheckCircle className="w-3 h-3 mr-1" /> :
                       d.status === 'failed' ? <XCircle className="w-3 h-3 mr-1" /> :
                       <RefreshCw className="w-3 h-3 mr-1 animate-spin" />}
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-medium ${d.statusCode === 200 ? 'text-green-600' : 'text-red-600'}`}>
                      {d.statusCode || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm">{d.latency}ms</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-500">{d.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'signature' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center space-x-2">
              <Shield className="w-5 h-5 text-teal-600" />
              <span>HMAC-SHA256 Webhook Signature Verification</span>
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Every webhook delivery includes an <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs">X-Webhook-Signature</code> header containing an HMAC-SHA256 signature. Verify this signature to ensure the payload was sent by our platform and hasn't been tampered with.
            </p>
            <div className="space-y-3">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-2">Headers sent with each delivery:</h4>
                <div className="space-y-1 font-mono text-xs">
                  <p><span className="text-blue-600">X-Webhook-ID:</span> evt-unique-event-id</p>
                  <p><span className="text-blue-600">X-Webhook-Timestamp:</span> 1714857600</p>
                  <p><span className="text-blue-600">X-Webhook-Signature:</span> sha256=a1b2c3d4e5f6...</p>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-2">Verification algorithm:</h4>
                <pre className="text-xs font-mono bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto">{`# 1. Extract the signature from the header
signature = headers["X-Webhook-Signature"]

# 2. Compute expected signature
expected = "sha256=" + HMAC-SHA256(
    key = your_webhook_secret,
    message = raw_request_body
)

# 3. Compare using constant-time comparison
valid = hmac.compare_digest(signature, expected)`}</pre>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800 dark:text-amber-400">Security best practices:</p>
                    <ul className="mt-1 space-y-0.5 text-amber-700 dark:text-amber-300 list-disc list-inside">
                      <li>Always verify signatures before processing webhooks</li>
                      <li>Use constant-time string comparison to prevent timing attacks</li>
                      <li>Respond with 200 within 5 seconds, process async</li>
                      <li>Implement idempotency — you may receive the same event twice</li>
                      <li>Rotate your webhook secret periodically</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Event Types Reference */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-6">
            <h3 className="text-lg font-semibold mb-3">Available Event Types ({Object.values(EVENT_CATEGORIES).flat().length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(EVENT_CATEGORIES).map(([category, events]) => (
                <div key={category} className="border rounded-lg p-3">
                  <h4 className="font-medium text-sm mb-2">{category}</h4>
                  <div className="space-y-1">
                    {events.map(e => (
                      <div key={e} className="flex items-center space-x-2">
                        <Zap className="w-3 h-3 text-gray-400" />
                        <code className="text-xs font-mono">{e}</code>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create Subscription Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Add Webhook Endpoint</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Endpoint URL</label>
                <input type="url" value={newUrl} onChange={e => setNewUrl(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" placeholder="https://your-app.com/webhooks" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Events to subscribe to</label>
                {Object.entries(EVENT_CATEGORIES).map(([category, events]) => (
                  <div key={category} className="mb-3">
                    <p className="text-xs font-medium text-gray-500 mb-1">{category}</p>
                    <div className="grid grid-cols-2 gap-1">
                      {events.map(e => (
                        <label key={e} className="flex items-center space-x-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={selectedEvents.includes(e)} onChange={() => toggleEvent(e)} className="rounded border-gray-300" />
                          <code className="text-xs">{e.split('.')[1]}</code>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                <button onClick={handleCreate} disabled={!newUrl || selectedEvents.length === 0}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
                  Create Subscription
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WebhookManager
