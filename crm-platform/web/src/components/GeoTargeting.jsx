import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Target, Users, Plus, Play, Eye, Filter, Layers,
  ArrowUpRight, CheckCircle2, TrendingUp, Globe, Crosshair,
  Zap, BarChart3, Send, MessageSquare, Smartphone
} from 'lucide-react';
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const REGIONS = [
  {
    id: 'lagos', name: 'Lagos', lat: 6.5244, lng: 3.3792,
    customers: 28450, agents: 342, campaigns: 8,
    conversionRate: 18.2, revenue: 42800000,
    subRegions: [
      { name: 'Lagos Island', customers: 8200, avgBalance: 850000 },
      { name: 'Victoria Island', customers: 5600, avgBalance: 2100000 },
      { name: 'Ikeja', customers: 6100, avgBalance: 420000 },
      { name: 'Lekki', customers: 4800, avgBalance: 1500000 },
      { name: 'Surulere', customers: 3750, avgBalance: 280000 },
    ]
  },
  {
    id: 'abuja', name: 'Abuja (FCT)', lat: 9.0579, lng: 7.4951,
    customers: 15200, agents: 189, campaigns: 5,
    conversionRate: 15.6, revenue: 28400000,
    subRegions: [
      { name: 'Wuse', customers: 4200, avgBalance: 920000 },
      { name: 'Garki', customers: 3800, avgBalance: 780000 },
      { name: 'Maitama', customers: 2100, avgBalance: 3200000 },
      { name: 'Gwarinpa', customers: 3100, avgBalance: 540000 },
      { name: 'Kubwa', customers: 2000, avgBalance: 210000 },
    ]
  },
  {
    id: 'kano', name: 'Kano', lat: 12.0022, lng: 8.5920,
    customers: 12800, agents: 256, campaigns: 4,
    conversionRate: 12.3, revenue: 18900000,
    subRegions: [
      { name: 'Fagge', customers: 3200, avgBalance: 180000 },
      { name: 'Nasarawa', customers: 2800, avgBalance: 250000 },
      { name: 'Sabon Gari', customers: 4100, avgBalance: 150000 },
      { name: 'Tarauni', customers: 2700, avgBalance: 200000 },
    ]
  },
  {
    id: 'ph', name: 'Port Harcourt', lat: 4.8156, lng: 7.0498,
    customers: 9400, agents: 134, campaigns: 3,
    conversionRate: 14.8, revenue: 15200000,
    subRegions: [
      { name: 'GRA', customers: 2800, avgBalance: 1100000 },
      { name: 'D/Line', customers: 2200, avgBalance: 450000 },
      { name: 'Rumuomasi', customers: 2100, avgBalance: 320000 },
      { name: 'Trans Amadi', customers: 2300, avgBalance: 580000 },
    ]
  },
  {
    id: 'ibadan', name: 'Ibadan', lat: 7.3776, lng: 3.9470,
    customers: 8600, agents: 167, campaigns: 3,
    conversionRate: 11.2, revenue: 12100000,
    subRegions: [
      { name: 'Bodija', customers: 2400, avgBalance: 380000 },
      { name: 'Ring Road', customers: 2100, avgBalance: 520000 },
      { name: 'Challenge', customers: 2200, avgBalance: 190000 },
      { name: 'Mokola', customers: 1900, avgBalance: 250000 },
    ]
  },
  {
    id: 'enugu', name: 'Enugu', lat: 6.4584, lng: 7.5464,
    customers: 6200, agents: 98, campaigns: 2,
    conversionRate: 13.1, revenue: 9800000,
    subRegions: [
      { name: 'Independence Layout', customers: 1800, avgBalance: 620000 },
      { name: 'New Haven', customers: 1500, avgBalance: 340000 },
      { name: 'Trans-Ekulu', customers: 1600, avgBalance: 410000 },
      { name: 'Ogui', customers: 1300, avgBalance: 220000 },
    ]
  },
];

const HEAT_COLORS = ['bg-green-200', 'bg-green-300', 'bg-yellow-300', 'bg-orange-300', 'bg-red-300', 'bg-red-400'];

export default function GeoTargeting() {
  const { t } = useTranslation()
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [activeTab, setActiveTab] = useState('map');
  const [selectedMetric, setSelectedMetric] = useState('customers');

  const totalCustomers = REGIONS.reduce((s, r) => s + r.customers, 0);
  const totalAgents = REGIONS.reduce((s, r) => s + r.agents, 0);
  const totalRevenue = REGIONS.reduce((s, r) => s + r.revenue, 0);
  const maxCustomers = Math.max(...REGIONS.map(r => r.customers));

  return (
    <div role="region" aria-label="GeoTargeting"  className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-7 h-7 text-rose-600" />
            Geographic Campaign Targeting
          </h1>
          <p className="text-sm text-gray-500 mt-1">Region-based audience targeting with performance heat maps</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors">
          <Plus className="w-4 h-4" /> Create Geo Campaign
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Regions', value: REGIONS.length.toString(), icon: Globe, color: 'blue' },
          { label: 'Total Customers', value: `${(totalCustomers / 1000).toFixed(1)}K`, icon: Users, color: 'green' },
          { label: 'Total Agents', value: totalAgents.toLocaleString(), icon: MapPin, color: 'amber' },
          { label: 'Campaign Revenue', value: `₦${(totalRevenue / 1000000).toFixed(1)}M`, icon: TrendingUp, color: 'emerald' },
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
        {['map', 'regions', 'campaigns'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-rose-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'map' && (
          <motion.div key="map" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            {/* Metric Selector */}
            <div className="flex gap-2">
              {['customers', 'conversionRate', 'revenue', 'agents'].map(metric => (
                <button key={metric} onClick={() => setSelectedMetric(metric)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedMetric === metric ? 'bg-rose-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'}`}>
                  {metric === 'conversionRate' ? 'Conversion' : metric.charAt(0).toUpperCase() + metric.slice(1)}
                </button>
              ))}
            </div>

            {/* Map Grid (Visual representation) */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Nigeria — Regional Heat Map</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {REGIONS.map((region, i) => {
                  const intensity = selectedMetric === 'customers' ? region.customers / maxCustomers :
                    selectedMetric === 'conversionRate' ? region.conversionRate / 20 :
                    selectedMetric === 'revenue' ? region.revenue / 42800000 :
                    region.agents / 342;
                  const heatIdx = Math.min(Math.floor(intensity * HEAT_COLORS.length), HEAT_COLORS.length - 1);
                  return (
                    <motion.div key={region.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                      onClick={() => setSelectedRegion(selectedRegion?.id === region.id ? null : region)}
                      className={`relative rounded-xl p-5 cursor-pointer transition-all ${HEAT_COLORS[heatIdx]} dark:bg-opacity-30 ${selectedRegion?.id === region.id ? 'ring-2 ring-rose-500 scale-105' : 'hover:scale-102'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-4 h-4 text-gray-700" />
                        <h4 className="font-bold text-gray-900">{region.name}</h4>
                      </div>
                      <div className="space-y-1 text-xs text-gray-700">
                        <p>{region.customers.toLocaleString()} customers</p>
                        <p>{region.agents} agents</p>
                        <p>{region.conversionRate}% conversion</p>
                        <p>₦{(region.revenue / 1000000).toFixed(1)}M revenue</p>
                      </div>
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/80 flex items-center justify-center">
                        <span className="text-[10px] font-bold">{region.campaigns}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 mt-4 text-xs text-gray-500">
                <span>Low</span>
                {HEAT_COLORS.map((c, i) => (
                  <div key={i} className={`w-6 h-3 rounded ${c}`} />
                ))}
                <span>High</span>
              </div>
            </div>

            {/* Selected Region Detail */}
            <AnimatePresence>
              {selectedRegion && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{selectedRegion.name} — Sub-Regions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {selectedRegion.subRegions.map(sr => (
                      <div key={sr.name} className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
                        <h4 className="font-medium text-gray-900 dark:text-white text-sm">{sr.name}</h4>
                        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                          <span>{sr.customers.toLocaleString()} customers</span>
                          <span>Avg: ₦{(sr.avgBalance / 1000).toFixed(0)}K</span>
                        </div>
                        <button className="mt-2 text-xs text-rose-600 font-medium hover:text-rose-700">
                          Target this area →
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {activeTab === 'regions' && (
          <motion.div key="regions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Region Performance Table</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 text-gray-500 font-medium">Region</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Customers</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Agents</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Active Campaigns</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Conversion</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {REGIONS.map(r => (
                    <tr key={r.id} className="border-b border-gray-100 dark:border-gray-700/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30"
                      onClick={() => setSelectedRegion(r)}>
                      <td className="py-3 font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-rose-500" /> {r.name}
                      </td>
                      <td className="py-3 text-right">{r.customers.toLocaleString()}</td>
                      <td className="py-3 text-right">{r.agents}</td>
                      <td className="py-3 text-right">{r.campaigns}</td>
                      <td className="py-3 text-right font-bold text-green-600">{r.conversionRate}%</td>
                      <td className="py-3 text-right font-bold">₦{(r.revenue / 1000000).toFixed(1)}M</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                    <td className="py-3 font-bold text-gray-900 dark:text-white">Total</td>
                    <td className="py-3 text-right font-bold">{totalCustomers.toLocaleString()}</td>
                    <td className="py-3 text-right font-bold">{totalAgents}</td>
                    <td className="py-3 text-right font-bold">{REGIONS.reduce((s, r) => s + r.campaigns, 0)}</td>
                    <td className="py-3 text-right font-bold text-green-600">
                      {(REGIONS.reduce((s, r) => s + r.conversionRate, 0) / REGIONS.length).toFixed(1)}%
                    </td>
                    <td className="py-3 text-right font-bold">₦{(totalRevenue / 1000000).toFixed(1)}M</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'campaigns' && (
          <motion.div key="campaigns" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Geo-Targeted Campaigns</h3>
              <div className="space-y-3">
                {[
                  { name: 'Lagos Premium Savings Push', region: 'Lagos — Victoria Island & Lekki', audience: 10400, channels: ['whatsapp', 'sms'], conversion: 22.1, status: 'active' },
                  { name: 'Kano Agent Onboarding', region: 'Kano — Sabon Gari & Fagge', audience: 7300, channels: ['sms', 'voice'], conversion: 14.5, status: 'active' },
                  { name: 'Abuja Business Loan', region: 'Abuja — Maitama & Wuse', audience: 6300, channels: ['whatsapp', 'email'], conversion: 18.8, status: 'active' },
                  { name: 'PH Remittance Promo', region: 'Port Harcourt — GRA & Trans Amadi', audience: 5100, channels: ['telegram', 'whatsapp'], conversion: 16.2, status: 'completed' },
                  { name: 'Ibadan Student Account', region: 'Ibadan — Bodija & Mokola', audience: 4300, channels: ['sms', 'whatsapp'], conversion: 9.8, status: 'draft' },
                ].map(c => (
                  <div key={c.name} className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 dark:text-white text-sm">{c.name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${c.status === 'active' ? 'bg-green-100 text-green-700' : c.status === 'completed' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>{c.status}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{c.region}</p>
                      <div className="flex gap-1 mt-1">
                        {c.channels.map(ch => (
                          <span key={ch} className="text-[10px] px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-gray-600 dark:text-gray-300">{ch}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Audience</p>
                        <p className="font-bold">{c.audience.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Conversion</p>
                        <p className="font-bold text-green-600">{c.conversion}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
