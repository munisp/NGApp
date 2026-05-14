import { useState } from 'react'
import { CreditCard, Search, Filter, Plus, RefreshCw, Smartphone, Wifi } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const sims = [
  { id: 'SIM-001', iccid: '8923410012345678', msisdn: '09012345678', status: 'Active', type: 'eSIM', customer: 'Dangote Corp', activated: '2026-01-15', network: '5G SA', dataUsed: '24.8 GB', plan: 'Enterprise Pro', monthlyRevenue: '₦45,000', lastActivity: '2 min ago' },
  { id: 'SIM-002', iccid: '8923410087654321', msisdn: '08098765432', status: 'Active', type: 'Physical', customer: 'MTN Enterprise', activated: '2025-11-20', network: '5G NSA', dataUsed: '48.2 GB', plan: 'Business Unlimited', monthlyRevenue: '₦85,000', lastActivity: '5 min ago' },
  { id: 'SIM-003', iccid: '8923410011223344', msisdn: '07011223344', status: 'Suspended', type: 'Physical', customer: 'Kano Textiles', activated: '2024-06-10', network: '4G', dataUsed: '0.2 GB', plan: 'Basic', monthlyRevenue: '₦0', lastActivity: '45 days ago' },
  { id: 'SIM-004', iccid: '8923410055667788', msisdn: '09055667788', status: 'Pre-Active', type: 'eSIM', customer: 'New Subscriber', activated: '2026-05-01', network: '4G', dataUsed: '0 GB', plan: 'Starter Pack', monthlyRevenue: '₦0', lastActivity: 'Never' },
  { id: 'SIM-005', iccid: '8923410033445566', msisdn: '08033445566', status: 'Deactivated', type: 'Physical', customer: 'Former Sub', activated: '2023-08-15', network: '3G', dataUsed: '0 GB', plan: 'Expired', monthlyRevenue: '₦0', lastActivity: '2024-12-01' },
  { id: 'SIM-006', iccid: '8923410099887766', msisdn: '08199887766', status: 'Active', type: 'eSIM', customer: 'Shoprite NG', activated: '2025-09-05', network: '4G', dataUsed: '12.4 GB', plan: 'Retail IoT', monthlyRevenue: '₦28,000', lastActivity: '1 hour ago' },
]

const statusColors = { Active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', Suspended: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', 'Pre-Active': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', Deactivated: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' }

export default function TelcoSIMLifecycle() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('telcosimlifecycle', () => apiClient.dashboard.metrics(), { fallback: sims })
  const { tenant } = useTenant()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [expandedSim, setExpandedSim] = useState(null)
  const [activeTab, setActiveTab] = useState('inventory')

  const filtered = sims.filter(s => {
    const matchesSearch = !search || s.customer.toLowerCase().includes(search.toLowerCase()) || s.msisdn.includes(search) || s.iccid.includes(search)
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter
    const matchesType = typeFilter === 'all' || s.type === typeFilter
    return matchesSearch && matchesStatus && matchesType
  })

  return (
    <div role="region" aria-label="TelcoSIMLifecycle" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><CreditCard className="w-7 h-7 text-teal-600" /> SIM Lifecycle Management</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Track SIM provisioning, activation, and deactivation for {tenant?.name || 'telco'}</p></div>
        <div className="flex gap-2"><button className="px-3 py-2 bg-teal-600 text-white rounded-lg text-sm flex items-center gap-1 hover:bg-teal-700"><Plus className="w-4 h-4" /> Provision SIM</button><FallbackBadge /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[{ l: 'Total SIMs', v: '142,847' }, { l: 'Active', v: sims.filter(s => s.status === 'Active').length.toLocaleString() + ' (sample)', c: 'text-emerald-600' }, { l: 'Suspended', v: sims.filter(s => s.status === 'Suspended').length, c: 'text-amber-600' }, { l: 'eSIM Ratio', v: Math.round(sims.filter(s => s.type === 'eSIM').length / sims.length * 100) + '%' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['inventory', 'provisioning', 'analytics'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
        ))}
      </div>
      {activeTab === 'inventory' && (<div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ICCID, MSISDN, customer..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"><option value="all">All Status</option><option value="Active">Active</option><option value="Suspended">Suspended</option><option value="Pre-Active">Pre-Active</option><option value="Deactivated">Deactivated</option></select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"><option value="all">All Types</option><option value="eSIM">eSIM</option><option value="Physical">Physical</option></select>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto"><table className="min-w-full w-full"><thead className="bg-gray-50 dark:bg-gray-700"><tr>{['MSISDN', 'Status', 'Type', 'Customer', 'Network', 'Data Used', 'Revenue/mo'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.map(s => (<>
              <tr key={s.id} onClick={() => setExpandedSim(expandedSim === s.id ? null : s.id)} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                <td className="px-4 py-3"><div className="text-sm font-medium text-gray-900 dark:text-white">{s.msisdn}</div><div className="text-xs text-gray-400 font-mono">{s.iccid}</div></td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded ${statusColors[s.status] || 'bg-gray-100 text-gray-600'}`}>{s.status}</span></td>
                <td className="px-4 py-3"><span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">{s.type === 'eSIM' ? <Smartphone className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}{s.type}</span></td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{s.customer}</td>
                <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{s.network}</span></td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{s.dataUsed}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{s.monthlyRevenue}</td>
              </tr>
              {expandedSim === s.id && (<tr key={`${s.id}-x`}><td colSpan={7} className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div><span className="text-gray-500">Plan</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{s.plan}</p></div>
                  <div><span className="text-gray-500">Activated</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{s.activated}</p></div>
                  <div><span className="text-gray-500">Last Activity</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{s.lastActivity}</p></div>
                  <div className="flex gap-2 items-start">
                    {s.status === 'Active' && <button className="px-3 py-1.5 bg-amber-600 text-white rounded text-xs hover:bg-amber-700">Suspend</button>}
                    {s.status === 'Suspended' && <button className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700">Reactivate</button>}
                    {s.status === 'Pre-Active' && <button className="px-3 py-1.5 bg-teal-600 text-white rounded text-xs hover:bg-teal-700">Activate</button>}
                    <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">View History</button>
                  </div>
                </div>
              </td></tr>)}
            </>))}
          </tbody></table></div>
        </div>
      </div>)}
      {activeTab === 'provisioning' && (<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Bulk SIM Provisioning</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="text-xs text-gray-500 block mb-1">SIM Type</label><select className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"><option>eSIM</option><option>Physical</option></select></div>
          <div><label className="text-xs text-gray-500 block mb-1">Quantity</label><input type="number" defaultValue={100} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" /></div>
          <div><label className="text-xs text-gray-500 block mb-1">Network Type</label><select className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"><option>5G SA</option><option>5G NSA</option><option>4G</option><option>3G</option></select></div>
          <div><label className="text-xs text-gray-500 block mb-1">Default Plan</label><select className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"><option>Enterprise Pro</option><option>Business Unlimited</option><option>Starter Pack</option><option>IoT</option></select></div>
        </div>
        <button className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700">Start Provisioning</button>
      </div>)}
      {activeTab === 'analytics' && (<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">SIM Analytics</h3>
        {[{ label: 'eSIM Adoption', current: 34, target: 50 }, { label: 'Active Rate', current: 90, target: 95 }, { label: '5G Migration', current: 28, target: 60 }].map(m => (
          <div key={m.label} className="space-y-1">
            <div className="flex justify-between text-sm"><span className="text-gray-600 dark:text-gray-400">{m.label}</span><span className="text-gray-900 dark:text-white font-medium">{m.current}% / {m.target}% target</span></div>
            <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className={`h-full rounded-full ${m.current >= m.target ? 'bg-emerald-500' : 'bg-teal-500'}`} style={{ width: `${m.current}%` }} /></div>
          </div>
        ))}
      </div>)}
    </div>
  )
}
