import React, { useState } from 'react';

type TabType = 'overview' | 'transfers' | 'prefund' | 'billing' | 'corridors' | 'compliance';

interface Transfer {
  id: string;
  senderRef: string;
  beneficiary: string;
  corridor: string;
  amountNGN: number;
  amountDest: string;
  status: string;
  provider: string;
  timestamp: string;
  lifecycleStep: string;
}

const mockTransfers: Transfer[] = [
  { id: 'TRF-2024-000142', senderRef: 'PAY-APP-98712', beneficiary: 'Kwame A. (GH)', corridor: 'NG-GH', amountNGN: 750000, amountDest: 'GHS 3,750', status: 'completed', provider: 'Chipper Cash', timestamp: '14:32:01', lifecycleStep: 'G. Audit' },
  { id: 'TRF-2024-000141', senderRef: 'PAY-APP-98711', beneficiary: 'James S. (GB)', corridor: 'NG-GB', amountNGN: 18000000, amountDest: 'GBP 9,540', status: 'completed', provider: 'Wise', timestamp: '14:28:15', lifecycleStep: 'G. Audit' },
  { id: 'TRF-2024-000140', senderRef: 'FIN-BETA-4451', beneficiary: 'Raj P. (IN)', corridor: 'NG-IN', amountNGN: 12750000, amountDest: 'INR 714,000', status: 'processing', provider: 'Flutterwave', timestamp: '14:25:03', lifecycleStep: 'E. Routing' },
  { id: 'TRF-2024-000139', senderRef: 'FIN-BETA-4450', beneficiary: 'Chen W. (CN)', corridor: 'NG-CN', amountNGN: 67500000, amountDest: 'CNY 324,000', status: 'manual_review', provider: '-', timestamp: '14:20:47', lifecycleStep: 'C. Compliance' },
  { id: 'TRF-2024-000138', senderRef: 'PAY-APP-98710', beneficiary: 'Fatou D. (SN)', corridor: 'NG-SN', amountNGN: 300000, amountDest: 'XOF 123,000', status: 'completed', provider: 'MTN MoMo', timestamp: '14:15:22', lifecycleStep: 'G. Audit' },
  { id: 'TRF-2024-000137', senderRef: 'MON-GO-7821', beneficiary: 'Ahmed B. (AE)', corridor: 'NG-AE', amountNGN: 45000000, amountDest: 'AED 108,000', status: 'processing', provider: 'Wise', timestamp: '14:12:09', lifecycleStep: 'D. Pricing' },
  { id: 'TRF-2024-000136', senderRef: 'PAY-APP-98709', beneficiary: 'Kofi M. (GH)', corridor: 'NG-GH', amountNGN: 450000, amountDest: 'GHS 2,250', status: 'completed', provider: 'Mojaloop Hub', timestamp: '14:08:33', lifecycleStep: 'G. Audit' },
];

export default function OutboundRemittance() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: 'Dashboard' },
    { id: 'transfers', label: 'Transfers' },
    { id: 'prefund', label: 'Prefund' },
    { id: 'billing', label: 'Billing' },
    { id: 'corridors', label: 'Corridors' },
    { id: 'compliance', label: 'Compliance' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Outbound Remittance Operations</h1>
            <p className="text-sm text-gray-500">Participant Portal — PayApp Nigeria Ltd (Tier: Growth)</p>
          </div>
          <div className="flex items-center space-x-3">
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Connected</span>
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">API v2.1</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'transfers' && <TransfersTab />}
        {activeTab === 'prefund' && <PrefundTab />}
        {activeTab === 'billing' && <BillingTab />}
        {activeTab === 'corridors' && <CorridorsTab />}
        {activeTab === 'compliance' && <ComplianceTab />}
      </div>
    </div>
  );
}

function MetricCard({ label, value, subtitle, color = 'blue' }: { label: string; value: string; subtitle?: string; color?: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    red: 'bg-red-50 border-red-200',
  };
  return (
    <div className={`rounded-lg p-4 border ${colorClasses[color] || colorClasses.blue}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

function OverviewTab() {
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Today's Volume" value="₦2.4B" subtitle="1,247 transfers" color="blue" />
        <MetricCard label="Success Rate" value="99.1%" subtitle="Last 24h" color="green" />
        <MetricCard label="Prefund Balance" value="₦847M" subtitle="62% of daily limit" color="yellow" />
        <MetricCard label="Avg Latency" value="890ms" subtitle="End-to-end" color="blue" />
      </div>

      {/* Transaction Lifecycle Pipeline */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Active Transaction Pipeline</h3>
        <div className="grid grid-cols-7 gap-2 text-center text-xs">
          {[
            { step: 'A. Admission', count: 12 },
            { step: 'B. Workflow', count: 8 },
            { step: 'C. Compliance', count: 5 },
            { step: 'D. Pricing', count: 3 },
            { step: 'E. Routing', count: 7 },
            { step: 'F. Settlement', count: 4 },
            { step: 'G. Audit', count: 1208 },
          ].map((item) => (
            <div key={item.step} className="bg-gray-50 rounded p-3">
              <p className="font-medium text-gray-700">{item.step}</p>
              <p className="text-lg font-bold text-blue-600 mt-1">{item.count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Corridor Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Top Corridors (Today)</h3>
          <div className="space-y-3">
            {[
              { corridor: 'NG-GB', volume: '₦890M', txns: 312, pct: 37 },
              { corridor: 'NG-US', volume: '₦620M', txns: 245, pct: 26 },
              { corridor: 'NG-GH', volume: '₦340M', txns: 428, pct: 14 },
              { corridor: 'NG-CN', volume: '₦280M', txns: 45, pct: 12 },
              { corridor: 'NG-IN', volume: '₦170M', txns: 89, pct: 7 },
            ].map((item) => (
              <div key={item.corridor} className="flex items-center space-x-3">
                <span className="text-xs font-mono text-gray-700 w-14">{item.corridor}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className="bg-blue-500 rounded-full h-2" style={{ width: `${item.pct}%` }} />
                </div>
                <span className="text-xs text-gray-500 w-20 text-right">{item.volume}</span>
                <span className="text-xs text-gray-400 w-12 text-right">{item.txns} txns</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Provider Health</h3>
          <div className="space-y-2">
            {[
              { name: 'Mojaloop Hub', latency: '400ms', success: '99.8%', status: 'healthy' },
              { name: 'Flutterwave', latency: '800ms', success: '98.8%', status: 'healthy' },
              { name: 'Wise', latency: '2.0s', success: '99.6%', status: 'healthy' },
              { name: 'Chipper Cash', latency: '600ms', success: '97.5%', status: 'degraded' },
              { name: 'MTN MoMo', latency: '500ms', success: '96.5%', status: 'healthy' },
            ].map((p) => (
              <div key={p.name} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${p.status === 'healthy' ? 'bg-green-400' : 'bg-yellow-400'}`} />
                  <span className="text-sm text-gray-700">{p.name}</span>
                </div>
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <span>{p.latency}</span>
                  <span>{p.success}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Transfers */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Transfers</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="pb-2">Transfer ID</th>
                <th className="pb-2">Your Ref</th>
                <th className="pb-2">Corridor</th>
                <th className="pb-2">Amount</th>
                <th className="pb-2">Step</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {mockTransfers.slice(0, 5).map((t) => (
                <tr key={t.id} className="border-b border-gray-50">
                  <td className="py-2 font-mono text-xs text-blue-600">{t.id}</td>
                  <td className="py-2 text-gray-600">{t.senderRef}</td>
                  <td className="py-2 font-medium">{t.corridor}</td>
                  <td className="py-2 text-gray-600">₦{t.amountNGN.toLocaleString()}</td>
                  <td className="py-2 text-xs text-gray-500">{t.lifecycleStep}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      t.status === 'completed' ? 'bg-green-100 text-green-700' :
                      t.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>{t.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TransfersTab() {
  const [filter, setFilter] = useState('all');
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          {['all', 'processing', 'completed', 'manual_review', 'failed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-full ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              {f === 'all' ? 'All' : f.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="flex space-x-2">
          <button className="px-4 py-2 text-xs bg-blue-600 text-white rounded-lg">Submit Batch</button>
          <button className="px-4 py-2 text-xs border border-gray-300 rounded-lg">Export CSV</button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-500">
              <th className="px-4 py-3">Transfer ID</th>
              <th className="px-4 py-3">Your Reference</th>
              <th className="px-4 py-3">Beneficiary</th>
              <th className="px-4 py-3">Corridor</th>
              <th className="px-4 py-3">Amount (NGN)</th>
              <th className="px-4 py-3">Dest Amount</th>
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3">Lifecycle</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Time</th>
            </tr>
          </thead>
          <tbody>
            {mockTransfers.filter(t => filter === 'all' || t.status === filter).map((t) => (
              <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-blue-600">{t.id}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{t.senderRef}</td>
                <td className="px-4 py-3 text-gray-700">{t.beneficiary}</td>
                <td className="px-4 py-3 font-medium">{t.corridor}</td>
                <td className="px-4 py-3">₦{t.amountNGN.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-600">{t.amountDest}</td>
                <td className="px-4 py-3 text-gray-600">{t.provider}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{t.lifecycleStep}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    t.status === 'completed' ? 'bg-green-100 text-green-700' :
                    t.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                    t.status === 'manual_review' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>{t.status}</span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">{t.timestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PrefundTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard label="Prefund Balance" value="₦847,320,000" subtitle="Last updated: 2 min ago" color="green" />
        <MetricCard label="Today's Deductions" value="₦2,152,800,000" subtitle="1,247 transfers processed" color="blue" />
        <MetricCard label="Available Headroom" value="₦1.37B" subtitle="Daily limit: ₦3.5B" color="yellow" />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Prefund Account (TigerBeetle Ledger)</h3>
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Account ID</span>
            <span className="text-sm font-mono">TB-PFND-PAYAPP-001</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Tier</span>
            <span className="text-sm font-medium">Growth (₦500/mo subscription)</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Daily Limit</span>
            <span className="text-sm">₦3,500,000,000</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Low Balance Threshold</span>
            <span className="text-sm">₦200,000,000 (alert at 5.7%)</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-sm text-gray-600">Settlement Bank</span>
            <span className="text-sm">Zenith Bank Plc</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Deductions</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="pb-2">Time</th>
              <th className="pb-2">Transfer</th>
              <th className="pb-2">Type</th>
              <th className="pb-2">Amount</th>
              <th className="pb-2">State</th>
            </tr>
          </thead>
          <tbody>
            {[
              { time: '14:32:01', transfer: 'TRF-000142', type: 'Principal + Fees', amount: '₦752,250', state: 'committed' },
              { time: '14:28:15', transfer: 'TRF-000141', type: 'Principal + Fees', amount: '₦18,014,400', state: 'committed' },
              { time: '14:25:03', transfer: 'TRF-000140', type: 'Principal + Fees', amount: '₦12,756,375', state: 'pending' },
              { time: '14:20:47', transfer: 'TRF-000139', type: 'Reserve (compliance hold)', amount: '₦67,540,500', state: 'pending' },
              { time: '14:15:22', transfer: 'TRF-000138', type: 'Principal + Fees', amount: '₦300,900', state: 'committed' },
            ].map((d, i) => (
              <tr key={i} className="border-t border-gray-50">
                <td className="py-2 text-xs text-gray-400">{d.time}</td>
                <td className="py-2 font-mono text-xs text-blue-600">{d.transfer}</td>
                <td className="py-2 text-gray-600">{d.type}</td>
                <td className="py-2 font-medium">{d.amount}</td>
                <td className="py-2">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${d.state === 'committed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{d.state}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BillingTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard label="Current Tier" value="Growth" subtitle="$500/mo + $0.15/txn" color="blue" />
        <MetricCard label="This Month" value="32,847 txns" subtitle="$4,927 switch fees" color="blue" />
        <MetricCard label="Corridor Fees" value="$14,230" subtitle="Blended $0.43/txn" color="blue" />
        <MetricCard label="FX Revenue Share" value="$2,180" subtitle="5% of spread (Growth tier)" color="green" />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Current Fee Schedule</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Base Fees</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Monthly subscription</span><span className="font-medium">$500</span></div>
              <div className="flex justify-between"><span>Per-transaction switch fee</span><span className="font-medium">$0.15</span></div>
              <div className="flex justify-between"><span>Corridor discount</span><span className="font-medium text-green-600">-10%</span></div>
              <div className="flex justify-between"><span>FX revenue share-back</span><span className="font-medium text-green-600">5%</span></div>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Corridor Variable Fees</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>NG-GH (West Africa)</span><span className="font-medium">$0.30</span></div>
              <div className="flex justify-between"><span>NG-GB (Education)</span><span className="font-medium">$0.80</span></div>
              <div className="flex justify-between"><span>NG-CN (Premium)</span><span className="font-medium">$1.20</span></div>
              <div className="flex justify-between"><span>NG-KE (General)</span><span className="font-medium">$0.35</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Invoice History</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="pb-2">Invoice</th>
              <th className="pb-2">Period</th>
              <th className="pb-2">Subscription</th>
              <th className="pb-2">Switch Fees</th>
              <th className="pb-2">Corridor Fees</th>
              <th className="pb-2">Less Prefund</th>
              <th className="pb-2">Balance Due</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {[
              { id: 'INV-202412', period: 'Dec 2024', sub: '$500', switch: '$6,750', corridor: '$18,900', prefund: '$24,500', due: '$1,650', status: 'draft' },
              { id: 'INV-202411', period: 'Nov 2024', sub: '$500', switch: '$5,820', corridor: '$16,200', prefund: '$21,100', due: '$1,420', status: 'paid' },
              { id: 'INV-202410', period: 'Oct 2024', sub: '$500', switch: '$4,950', corridor: '$13,800', prefund: '$18,200', due: '$1,050', status: 'paid' },
            ].map((inv) => (
              <tr key={inv.id} className="border-t border-gray-50">
                <td className="py-2 font-mono text-xs text-blue-600">{inv.id}</td>
                <td className="py-2">{inv.period}</td>
                <td className="py-2">{inv.sub}</td>
                <td className="py-2">{inv.switch}</td>
                <td className="py-2">{inv.corridor}</td>
                <td className="py-2 text-red-600">-{inv.prefund}</td>
                <td className="py-2 font-medium">{inv.due}</td>
                <td className="py-2">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{inv.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CorridorsTab() {
  const corridors = [
    { id: 'NG-GH', dest: 'Ghana', currency: 'GHS', category: 'West Africa Labor', spreadCap: '150 bps', maxUSD: 5000, status: 'active', todayVol: '₦340M' },
    { id: 'NG-SN', dest: 'Senegal', currency: 'XOF', category: 'West Africa Labor', spreadCap: '200 bps', maxUSD: 5000, status: 'active', todayVol: '₦45M' },
    { id: 'NG-GB', dest: 'United Kingdom', currency: 'GBP', category: 'Education', spreadCap: '100 bps', maxUSD: 50000, status: 'active', todayVol: '₦890M' },
    { id: 'NG-US', dest: 'United States', currency: 'USD', category: 'Education', spreadCap: '100 bps', maxUSD: 50000, status: 'active', todayVol: '₦620M' },
    { id: 'NG-CA', dest: 'Canada', currency: 'CAD', category: 'Education', spreadCap: '120 bps', maxUSD: 50000, status: 'active', todayVol: '₦78M' },
    { id: 'NG-IN', dest: 'India', currency: 'INR', category: 'Medical', spreadCap: '150 bps', maxUSD: 30000, status: 'active', todayVol: '₦170M' },
    { id: 'NG-TR', dest: 'Turkey', currency: 'TRY', category: 'Medical', spreadCap: '175 bps', maxUSD: 30000, status: 'active', todayVol: '₦22M' },
    { id: 'NG-CN', dest: 'China', currency: 'CNY', category: 'Premium Business', spreadCap: '80 bps', maxUSD: 100000, status: 'active', todayVol: '₦280M' },
    { id: 'NG-AE', dest: 'UAE', currency: 'AED', category: 'Premium Business', spreadCap: '90 bps', maxUSD: 100000, status: 'active', todayVol: '₦195M' },
    { id: 'NG-KE', dest: 'Kenya', currency: 'KES', category: 'General Personal', spreadCap: '150 bps', maxUSD: 10000, status: 'active', todayVol: '₦56M' },
    { id: 'NG-ZA', dest: 'South Africa', currency: 'ZAR', category: 'General Personal', spreadCap: '130 bps', maxUSD: 10000, status: 'active', todayVol: '₦38M' },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr className="text-left text-xs text-gray-500">
            <th className="px-4 py-3">Corridor</th>
            <th className="px-4 py-3">Destination</th>
            <th className="px-4 py-3">Currency</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">CBN Spread Cap</th>
            <th className="px-4 py-3">Max (USD)</th>
            <th className="px-4 py-3">Today Volume</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {corridors.map((c) => (
            <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 font-mono font-medium">{c.id}</td>
              <td className="px-4 py-3">{c.dest}</td>
              <td className="px-4 py-3">{c.currency}</td>
              <td className="px-4 py-3 text-gray-600">{c.category}</td>
              <td className="px-4 py-3">{c.spreadCap}</td>
              <td className="px-4 py-3">${c.maxUSD.toLocaleString()}</td>
              <td className="px-4 py-3 font-medium">{c.todayVol}</td>
              <td className="px-4 py-3">
                <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">{c.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComplianceTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard label="Screened Today" value="1,247" subtitle="All transfers" color="blue" />
        <MetricCard label="Cleared" value="1,233" subtitle="98.9%" color="green" />
        <MetricCard label="Escalated" value="11" subtitle="Manual review" color="yellow" />
        <MetricCard label="Blocked" value="3" subtitle="Sanctions hit" color="red" />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Sanctions Lists Active</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { name: 'OFAC SDN', entries: '12,847', updated: 'Today' },
            { name: 'UN Consolidated', entries: '789', updated: 'Yesterday' },
            { name: 'EU Sanctions', entries: '2,156', updated: 'Today' },
            { name: 'CBN Watchlist', entries: '456', updated: 'Today' },
            { name: 'INTERPOL Red', entries: '7,312', updated: '2 days ago' },
            { name: 'PEP List', entries: '15,000', updated: 'Today' },
            { name: 'OFAC Non-SDN', entries: '3,421', updated: 'Today' },
          ].map((list) => (
            <div key={list.name} className="bg-gray-50 rounded p-3">
              <p className="text-xs font-medium text-gray-700">{list.name}</p>
              <p className="text-sm font-bold text-gray-900">{list.entries}</p>
              <p className="text-xs text-gray-400">Updated: {list.updated}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Escalated Transfers (Pending Review)</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="pb-2">Transfer</th>
              <th className="pb-2">Beneficiary</th>
              <th className="pb-2">Match Score</th>
              <th className="pb-2">List</th>
              <th className="pb-2">Reason</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {[
              { id: 'TRF-000139', beneficiary: 'Chen Wei (CN)', score: '0.82', list: 'PEP List', reason: 'Name similarity to PEP entry', status: 'pending' },
              { id: 'TRF-000131', beneficiary: 'Al-Hassan M. (AE)', score: '0.78', list: 'UN Consolidated', reason: 'Partial name match', status: 'pending' },
              { id: 'TRF-000128', beneficiary: 'Kim J. (KR)', score: '0.91', list: 'OFAC SDN', reason: 'High-confidence name match', status: 'under_review' },
            ].map((e) => (
              <tr key={e.id} className="border-t border-gray-50">
                <td className="py-2 font-mono text-xs text-blue-600">{e.id}</td>
                <td className="py-2">{e.beneficiary}</td>
                <td className="py-2 font-medium">{e.score}</td>
                <td className="py-2 text-gray-600">{e.list}</td>
                <td className="py-2 text-xs text-gray-500">{e.reason}</td>
                <td className="py-2">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${e.status === 'under_review' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>{e.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
