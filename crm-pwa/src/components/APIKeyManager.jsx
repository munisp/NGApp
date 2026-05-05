import { useState } from 'react'
import {
  Key, Plus, Trash2, RotateCw, Copy, Eye, EyeOff, Shield, Clock,
  CheckCircle, XCircle, AlertTriangle, Activity, Server, Smartphone
} from 'lucide-react'
import { useTenant } from '../contexts/TenantContext'

const PERMISSIONS = [
  'customers:read', 'customers:write', 'transactions:read', 'transactions:write',
  'agents:read', 'agents:write', 'transfers:read', 'transfers:write',
  'corridors:read', 'campaigns:read', 'campaigns:write', 'analytics:read',
  'webhooks:read', 'webhooks:write', 'kyc:read', 'kyc:write', 'sanctions:read',
]

const SEED_KEYS = {
  'tenant-acme-bank': [
    { id: 'key-001', name: 'Production API Key', env: 'production', status: 'active', permissions: ['customers:read', 'customers:write', 'transactions:read', 'transactions:write', 'analytics:read'], rateLimit: 1000, keyMasked: 'prod_a1b2c3d4...f5e6', createdBy: 'adebayo@acmebank.ng', createdAt: '2025-01-05', lastUsed: '2 hours ago', calls24h: 8420, calls7d: 52100 },
    { id: 'key-002', name: 'Sandbox Testing Key', env: 'sandbox', status: 'active', permissions: ['customers:read', 'customers:write', 'transactions:read', 'transactions:write', 'agents:read', 'agents:write'], rateLimit: 500, keyMasked: 'sbx_d4e5f6a7...b8c9', createdBy: 'adebayo@acmebank.ng', createdAt: '2025-03-15', lastUsed: '30 min ago', calls24h: 1250, calls7d: 8900 },
    { id: 'key-003', name: 'Analytics Read-Only', env: 'production', status: 'active', permissions: ['analytics:read', 'customers:read'], rateLimit: 200, keyMasked: 'prod_f7e8d9c0...a1b2', createdBy: 'data-team@acmebank.ng', createdAt: '2025-04-01', lastUsed: '5 hours ago', calls24h: 340, calls7d: 2100 },
    { id: 'key-009', name: 'Deprecated Key', env: 'production', status: 'revoked', permissions: ['customers:read'], rateLimit: 100, keyMasked: 'prod_old123...x456', createdBy: 'former-dev@acmebank.ng', createdAt: '2024-10-15', lastUsed: null, calls24h: 0, calls7d: 0 },
  ],
  'tenant-quickcash': [
    { id: 'key-004', name: 'Agent Operations Key', env: 'production', status: 'active', permissions: ['agents:read', 'agents:write', 'transactions:read', 'transactions:write'], rateLimit: 500, keyMasked: 'prod_qc123...d456', createdBy: 'halima@quickcash.ng', createdAt: '2025-02-05', lastUsed: '2 hours ago', calls24h: 3100, calls7d: 21500 },
    { id: 'key-005', name: 'Mobile App Key', env: 'production', status: 'active', permissions: ['customers:read', 'agents:read', 'transactions:read'], rateLimit: 300, keyMasked: 'prod_qcm56...e789', createdBy: 'dev@quickcash.ng', createdAt: '2025-02-10', lastUsed: '30 min ago', calls24h: 2800, calls7d: 19200 },
  ],
  'tenant-swiftremit': [
    { id: 'key-006', name: 'Remittance Integration Key', env: 'production', status: 'active', permissions: ['transfers:read', 'transfers:write', 'corridors:read', 'customers:read'], rateLimit: 2000, keyMasked: 'prod_sr123...f456', createdBy: 'chidinma@swiftremit.com', createdAt: '2025-03-01', lastUsed: '2 hours ago', calls24h: 5100, calls7d: 34800 },
    { id: 'key-007', name: 'Compliance Key', env: 'production', status: 'active', permissions: ['kyc:read', 'sanctions:read', 'transfers:read'], rateLimit: 100, keyMasked: 'prod_src78...a901', createdBy: 'compliance@swiftremit.com', createdAt: '2025-03-05', lastUsed: '5 hours ago', calls24h: 180, calls7d: 1250 },
  ],
  'tenant-nextgen-mfb': [
    { id: 'key-008', name: 'Trial Key', env: 'sandbox', status: 'active', permissions: ['customers:read', 'customers:write'], rateLimit: 100, keyMasked: 'sbx_ng123...b456', createdBy: 'musa@nextgenmfb.ng', createdAt: '2025-04-27', lastUsed: null, calls24h: 0, calls7d: 12 },
  ],
}

const APIKeyManager = () => {
  const { tenant, tenantId } = useTenant()
  const [keys, setKeys] = useState(SEED_KEYS[tenantId] || [])
  const [showCreate, setShowCreate] = useState(false)
  const [selectedKey, setSelectedKey] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [newKey, setNewKey] = useState({ name: '', env: 'production', permissions: [], rateLimit: 500 })

  const activeKeys = keys.filter(k => k.status === 'active')
  const totalCalls24h = keys.reduce((sum, k) => sum + k.calls24h, 0)
  const totalCalls7d = keys.reduce((sum, k) => sum + k.calls7d, 0)

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleRevoke = (id) => {
    setKeys(prev => prev.map(k => k.id === id ? { ...k, status: 'revoked' } : k))
  }

  const handleCreate = () => {
    const key = {
      id: `key-${Date.now()}`,
      ...newKey,
      status: 'active',
      keyMasked: `${newKey.env === 'sandbox' ? 'sbx' : 'prod'}_${Math.random().toString(36).slice(2, 10)}...${Math.random().toString(36).slice(2, 6)}`,
      createdBy: 'admin@' + tenant.slug + '.ng',
      createdAt: new Date().toISOString().split('T')[0],
      lastUsed: null,
      calls24h: 0,
      calls7d: 0,
    }
    setKeys(prev => [...prev, key])
    setShowCreate(false)
    setNewKey({ name: '', env: 'production', permissions: [], rateLimit: 500 })
  }

  const togglePermission = (perm) => {
    setNewKey(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm]
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
            <Key className="w-7 h-7 text-amber-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">API Key Management</h1>
            <p className="text-gray-500 dark:text-gray-400">Self-service API key provisioning for {tenant?.name}</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center space-x-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition">
          <Plus className="w-4 h-4" />
          <span>Create Key</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Keys', value: activeKeys.length, icon: Key, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
          { label: 'Total Keys', value: keys.length, icon: Shield, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Calls (24h)', value: totalCalls24h.toLocaleString(), icon: Activity, color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
          { label: 'Calls (7d)', value: totalCalls7d.toLocaleString(), icon: Clock, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' },
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

      {/* Keys Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Key</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Environment</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Permissions</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate Limit</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Used</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {keys.map(key => (
              <tr key={key.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-sm">{key.name}</p>
                    <p className="text-xs text-gray-400">{key.createdBy}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center space-x-2">
                    <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono">{key.keyMasked}</code>
                    <button onClick={() => handleCopy(key.keyMasked, key.id)} className="text-gray-400 hover:text-gray-600">
                      {copiedId === key.id ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${key.env === 'production' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                    {key.env === 'production' ? <Server className="w-3 h-3 mr-1" /> : <Smartphone className="w-3 h-3 mr-1" />}
                    {key.env}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {key.permissions.slice(0, 3).map(p => (
                      <span key={p} className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{p}</span>
                    ))}
                    {key.permissions.length > 3 && (
                      <span className="text-xs text-gray-400">+{key.permissions.length - 3}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">{key.rateLimit}/s</td>
                <td className="px-4 py-3 text-sm text-gray-500">{key.lastUsed || 'Never'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${key.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {key.status === 'active' ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                    {key.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {key.status === 'active' && (
                    <div className="flex items-center space-x-2">
                      <button onClick={() => setSelectedKey(key)} className="text-blue-600 hover:text-blue-800" title="View details">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleRevoke(key.id)} className="text-red-600 hover:text-red-800" title="Revoke">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Key Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Create API Key</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Key Name</label>
                <input type="text" value={newKey.name} onChange={e => setNewKey(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" placeholder="e.g., Production API Key" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Environment</label>
                <select value={newKey.env} onChange={e => setNewKey(prev => ({ ...prev, env: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                  <option value="production">Production</option>
                  <option value="sandbox">Sandbox</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Rate Limit (req/sec)</label>
                <input type="number" value={newKey.rateLimit} onChange={e => setNewKey(prev => ({ ...prev, rateLimit: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Permissions</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {PERMISSIONS.map(perm => (
                    <label key={perm} className="flex items-center space-x-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={newKey.permissions.includes(perm)} onChange={() => togglePermission(perm)}
                        className="rounded border-gray-300" />
                      <span className="font-mono text-xs">{perm}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                <button onClick={handleCreate} disabled={!newKey.name || newKey.permissions.length === 0}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">
                  Create Key
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Key Details Modal */}
      {selectedKey && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">{selectedKey.name}</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Environment</span><span className="font-medium">{selectedKey.env}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Rate Limit</span><span className="font-medium">{selectedKey.rateLimit} req/sec</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Created</span><span className="font-medium">{selectedKey.createdAt}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Created By</span><span className="font-medium">{selectedKey.createdBy}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Calls (24h)</span><span className="font-medium">{selectedKey.calls24h.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Calls (7d)</span><span className="font-medium">{selectedKey.calls7d.toLocaleString()}</span></div>
              <div>
                <span className="text-gray-500 block mb-1">Permissions</span>
                <div className="flex flex-wrap gap-1">
                  {selectedKey.permissions.map(p => (
                    <span key={p} className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded font-mono">{p}</span>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={() => setSelectedKey(null)} className="mt-4 w-full py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default APIKeyManager
