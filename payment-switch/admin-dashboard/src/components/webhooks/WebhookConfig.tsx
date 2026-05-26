import React from 'react';
import { Webhook, Plus, Edit, Trash2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

const webhooks = [
  { id: 'WH-001', url: 'https://api.firstbank.ng/webhooks/ps', events: ['payment.success', 'payment.failed', 'settlement.complete'], status: 'active', lastDelivery: '2026-05-02 16:44', successRate: 99.8 },
  { id: 'WH-002', url: 'https://hooks.gtbank.com/payment-switch', events: ['payment.success', 'dispute.created'], status: 'active', lastDelivery: '2026-05-02 16:42', successRate: 98.5 },
  { id: 'WH-003', url: 'https://zenith-api.com/webhooks/receive', events: ['payment.success', 'payment.failed', 'refund.processed'], status: 'degraded', lastDelivery: '2026-05-02 16:30', successRate: 85.2 },
  { id: 'WH-004', url: 'https://uba-integration.ng/callback', events: ['settlement.complete', 'batch.processed'], status: 'active', lastDelivery: '2026-05-02 16:40', successRate: 99.1 },
  { id: 'WH-005', url: 'https://failing-endpoint.test/hook', events: ['payment.success'], status: 'failed', lastDelivery: '2026-05-01 08:00', successRate: 12.5 },
];

const statusColors: Record<string, string> = { active: 'bg-green-100 text-green-800', degraded: 'bg-yellow-100 text-yellow-800', failed: 'bg-red-100 text-red-800', disabled: 'bg-gray-100 text-gray-800' };

export function WebhookConfig() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Webhook className="h-6 w-6" /> Webhook Configuration</h2><p className="text-sm text-gray-500 mt-1">Manage webhook endpoints and delivery with Go high-performance dispatcher</p></div>
        <button className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"><Plus className="h-4 w-4" /> Add Endpoint</button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-4"><div className="text-2xl font-bold text-green-600">{webhooks.filter(w => w.status === 'active').length}</div><div className="text-sm text-gray-500">Active Endpoints</div></div>
        <div className="bg-white rounded-lg border p-4"><div className="text-2xl font-bold text-yellow-600">{webhooks.filter(w => w.status === 'degraded').length}</div><div className="text-sm text-gray-500">Degraded</div></div>
        <div className="bg-white rounded-lg border p-4"><div className="text-2xl font-bold text-red-600">{webhooks.filter(w => w.status === 'failed').length}</div><div className="text-sm text-gray-500">Failed</div></div>
      </div>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b"><tr><th className="text-left px-4 py-3 font-medium text-gray-600">Endpoint</th><th className="text-left px-4 py-3 font-medium text-gray-600">Events</th><th className="text-left px-4 py-3 font-medium text-gray-600">Status</th><th className="text-left px-4 py-3 font-medium text-gray-600">Success Rate</th><th className="text-left px-4 py-3 font-medium text-gray-600">Last Delivery</th><th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th></tr></thead>
          <tbody className="divide-y">
            {webhooks.map(w => (
              <tr key={w.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs max-w-xs truncate">{w.url}</td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{w.events.slice(0, 2).map(e => <span key={e} className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">{e}</span>)}{w.events.length > 2 && <span className="text-xs text-gray-400">+{w.events.length - 2}</span>}</div></td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[w.status]}`}>{w.status}</span></td>
                <td className="px-4 py-3"><span className={w.successRate > 95 ? 'text-green-600' : w.successRate > 80 ? 'text-yellow-600' : 'text-red-600'}>{w.successRate}%</span></td>
                <td className="px-4 py-3 text-xs">{w.lastDelivery}</td>
                <td className="px-4 py-3"><div className="flex gap-1"><button className="p-1 hover:bg-gray-100 rounded"><RefreshCw className="h-4 w-4 text-gray-500" /></button><button className="p-1 hover:bg-gray-100 rounded"><Edit className="h-4 w-4 text-gray-500" /></button><button className="p-1 hover:bg-gray-100 rounded"><Trash2 className="h-4 w-4 text-red-500" /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
