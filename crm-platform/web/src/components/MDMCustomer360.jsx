import { useState, useContext } from 'react';
import { TenantContext } from '../contexts/TenantContext';
import { Database, Users, Shield, TrendingUp, Search, CheckCircle, AlertTriangle, XCircle, BarChart3, Layers, GitMerge, Fingerprint, Star, ArrowUpRight, Clock, Zap } from 'lucide-react';
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const MDM_STATS = {
  totalSourceRecords: 142500,
  goldenRecords: 121100,
  duplicatesFound: 21400,
  mergeRate: 15.0,
  avgQualityScore: 87.4,
  qualityDistribution: { excellent: 45200, good: 52100, fair: 18200, poor: 5600 },
  sourceCoverage: { core_banking: 48900, agent_banking: 28500, remittance: 43800, payments: 21300 },
};

const GOLDEN_RECORDS = [
  { id: 'GR-001', name: 'Adebayo Okonkwo', email: 'adebayo@email.com', phone: '+234 803 123 4567', bvn: '22345678901', quality: 96.5, sources: 3, products: ['Savings', 'Agent Banking', 'Remittance'], balance: 12500000, ltv: 28500000, segment: 'Champion', riskScore: 12 },
  { id: 'GR-002', name: 'Fatima Ibrahim', email: 'fatima.i@email.com', phone: '+234 812 345 6789', bvn: '33456789012', quality: 92.1, sources: 2, products: ['Current Account', 'POS'], balance: 8200000, ltv: 15800000, segment: 'Loyal', riskScore: 18 },
  { id: 'GR-003', name: 'Chinedu Nwankwo', email: 'chinedu.n@email.com', phone: '+234 706 789 0123', bvn: '44567890123', quality: 88.7, sources: 2, products: ['Savings', 'Micro Loan'], balance: 3500000, ltv: 8200000, segment: 'Potential Loyalist', riskScore: 25 },
  { id: 'GR-004', name: 'Aisha Mohammed', email: null, phone: '+234 805 234 5678', bvn: '55678901234', quality: 74.2, sources: 1, products: ['Agent Banking'], balance: 450000, ltv: 1200000, segment: 'New Customer', riskScore: 35 },
  { id: 'GR-005', name: 'Oluwaseun Adeleke', email: 'seun.a@email.com', phone: '+234 901 567 8901', bvn: '66789012345', quality: 91.8, sources: 3, products: ['Savings', 'Fixed Deposit', 'Remittance', 'Insurance'], balance: 25800000, ltv: 52000000, segment: 'Champion', riskScore: 8 },
];

const QUALITY_FIELDS = [
  { field: 'BVN', completeness: 94.2, accuracy: 99.1 },
  { field: 'Phone Number', completeness: 98.5, accuracy: 96.8 },
  { field: 'Email', completeness: 72.3, accuracy: 88.5 },
  { field: 'Full Name', completeness: 99.8, accuracy: 95.2 },
  { field: 'Date of Birth', completeness: 85.6, accuracy: 92.1 },
  { field: 'Address', completeness: 68.4, accuracy: 78.3 },
  { field: 'NIN', completeness: 62.1, accuracy: 98.8 },
  { field: 'State/LGA', completeness: 88.9, accuracy: 91.5 },
  { field: 'Income Bracket', completeness: 45.2, accuracy: 72.0 },
  { field: 'Occupation', completeness: 58.7, accuracy: 80.5 },
];

const SEGMENTS = [
  { name: 'Champions', count: 4890, pct: 10, color: 'bg-green-500', avgBalance: '₦8.5M', churnRisk: '2%' },
  { name: 'Loyal', count: 7335, pct: 15, color: 'bg-blue-500', avgBalance: '₦4.2M', churnRisk: '5%' },
  { name: 'Potential Loyalists', count: 9780, pct: 20, color: 'bg-cyan-500', avgBalance: '₦2.1M', churnRisk: '12%' },
  { name: 'New Customers', count: 5868, pct: 12, color: 'bg-teal-500', avgBalance: '₦350K', churnRisk: '25%' },
  { name: 'At Risk', count: 4401, pct: 9, color: 'bg-orange-500', avgBalance: '₦1.8M', churnRisk: '45%' },
  { name: "Can't Lose", count: 2934, pct: 6, color: 'bg-red-500', avgBalance: '₦12M', churnRisk: '35%' },
  { name: 'Need Attention', count: 5379, pct: 11, color: 'bg-yellow-500', avgBalance: '₦950K', churnRisk: '30%' },
  { name: 'Hibernating', count: 4890, pct: 10, color: 'bg-gray-400', avgBalance: '₦180K', churnRisk: '65%' },
  { name: 'Lost', count: 3423, pct: 7, color: 'bg-gray-300', avgBalance: '₦25K', churnRisk: '90%' },
];

const PRODUCT_AFFINITIES = [
  { a: 'Savings Account', b: 'Debit Card', support: 78, confidence: 92, lift: 1.18 },
  { a: 'Savings Account', b: 'Mobile Banking', support: 72, confidence: 85, lift: 1.09 },
  { a: 'Current Account', b: 'POS Terminal', support: 45, confidence: 68, lift: 1.51 },
  { a: 'Salary Account', b: 'Personal Loan', support: 38, confidence: 56, lift: 1.87 },
  { a: 'Agent Banking', b: 'Micro Loan', support: 42, confidence: 63, lift: 1.75 },
  { a: 'Remittance', b: 'Savings Account', support: 55, confidence: 71, lift: 1.42 },
  { a: 'Fixed Deposit', b: 'Investment Fund', support: 22, confidence: 45, lift: 2.05 },
];

const QUALITY_ICON = (score) => score >= 90 ? <CheckCircle className="w-4 h-4 text-green-500" /> : score >= 70 ? <AlertTriangle className="w-4 h-4 text-yellow-500" /> : <XCircle className="w-4 h-4 text-red-500" />;

export default function MDMCustomer360() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('mdmcustomer360', () => apiClient.dashboard.metrics(), { fallback: MDM_STATS })
  const { t } = useTranslation()
  const { tenantId } = useContext(TenantContext);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const tabs = [
    { id: 'overview', label: 'MDM Overview', icon: Database },
    { id: 'golden', label: 'Golden Records', icon: Star },
    { id: 'quality', label: 'Data Quality', icon: Shield },
    { id: 'segments', label: 'RFM Segments', icon: Users },
    { id: 'affinity', label: 'Product Affinity', icon: GitMerge },
  ];

  return (
    <div role="region" aria-label="MDMCustomer360"  className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Database className="w-7 h-7 text-violet-600" /> MDM Customer 360° + Lakehouse Analytics
          </h1>
          <p className="text-gray-500 mt-1">Golden records, data quality scoring, RFM segmentation, and product affinity analysis</p>
        </div>
      </div>

      {/* MDM KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Source Records', value: MDM_STATS.totalSourceRecords.toLocaleString(), icon: Layers, color: 'text-blue-600' },
          { label: 'Golden Records', value: MDM_STATS.goldenRecords.toLocaleString(), icon: Star, color: 'text-yellow-600' },
          { label: 'Duplicates Found', value: MDM_STATS.duplicatesFound.toLocaleString(), icon: GitMerge, color: 'text-red-600' },
          { label: 'Merge Rate', value: `${MDM_STATS.mergeRate}%`, icon: Fingerprint, color: 'text-purple-600' },
          { label: 'Avg Quality', value: `${MDM_STATS.avgQualityScore}%`, icon: Shield, color: 'text-green-600' },
        ].map((kpi, i) => (
          <div key={i} tabIndex="0" className="bg-white dark:bg-gray-800 rounded-xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{kpi.label}</span>
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
            <h3 className="font-semibold mb-4">Source System Coverage</h3>
            <div className="space-y-3">
              {Object.entries(MDM_STATS.sourceCoverage).map(([source, count]) => (
                <div key={source} className="flex items-center gap-3">
                  <div className="w-32 text-sm capitalize text-gray-700">{source.replace(/_/g, ' ')}</div>
                  <div className="flex-1">
                    <div className="w-full bg-gray-100 rounded-full h-6 overflow-hidden">
                      <div className="bg-violet-500 h-full rounded-full flex items-center pl-2" style={{ width: `${(count / 48900) * 100}%` }}>
                        <span className="text-xs text-white font-bold">{count.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
            <h3 className="font-semibold mb-4">Quality Distribution</h3>
            <div className="space-y-3">
              {[
                { label: 'Excellent (90-100%)', count: MDM_STATS.qualityDistribution.excellent, color: 'bg-green-500' },
                { label: 'Good (70-89%)', count: MDM_STATS.qualityDistribution.good, color: 'bg-blue-500' },
                { label: 'Fair (50-69%)', count: MDM_STATS.qualityDistribution.fair, color: 'bg-yellow-500' },
                { label: 'Poor (<50%)', count: MDM_STATS.qualityDistribution.poor, color: 'bg-red-500' },
              ].map((d, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-36 text-sm text-gray-700">{d.label}</div>
                  <div className="flex-1">
                    <div className="w-full bg-gray-100 rounded-full h-6 overflow-hidden">
                      <div className={`${d.color} h-full rounded-full flex items-center pl-2`} style={{ width: `${(d.count / 121100) * 100}%` }}>
                        <span className="text-xs text-white font-bold">{d.count.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'golden' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border">
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search golden records..." className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <div className="divide-y">
            {GOLDEN_RECORDS.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase())).map(record => (
              <div key={record.id} onClick={() => setSelectedRecord(selectedRecord?.id === record.id ? null : record)} className="p-4 hover:bg-gray-50 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                      {record.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{record.name}</div>
                      <div className="text-xs text-gray-500">{record.phone} · {record.sources} sources</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {QUALITY_ICON(record.quality)}
                    <span className="text-sm font-bold">{record.quality}%</span>
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-700">{record.segment}</span>
                    <div className="text-right">
                      <div className="text-sm font-bold">₦{(record.balance / 1000000).toFixed(1)}M</div>
                      <div className="text-xs text-gray-500">LTV: ₦{(record.ltv / 1000000).toFixed(0)}M</div>
                    </div>
                  </div>
                </div>
                {selectedRecord?.id === record.id && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-3">
                      <div><div className="text-xs text-gray-500">BVN</div><div className="text-sm font-mono">{record.bvn}</div></div>
                      <div><div className="text-xs text-gray-500">Email</div><div className="text-sm">{record.email || 'N/A'}</div></div>
                      <div><div className="text-xs text-gray-500">Risk Score</div><div className="text-sm font-bold">{record.riskScore}/100</div></div>
                      <div><div className="text-xs text-gray-500">Sources Merged</div><div className="text-sm">{record.sources} systems</div></div>
                      <div><div className="text-xs text-gray-500">Quality Score</div><div className="text-sm font-bold">{record.quality}%</div></div>
                    </div>
                    <div className="flex gap-2">
                      {record.products.map(p => <span key={p} className="px-2 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700">{p}</span>)}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'quality' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
          <h3 className="font-semibold mb-4">Field-Level Data Quality</h3>
          <div className="overflow-x-auto"><table className="min-w-full w-full text-sm">
            <thead>
              <tr className="border-b"><th className="text-left p-3">Field</th><th className="text-right p-3">Completeness</th><th className="text-right p-3">Accuracy</th><th className="text-right p-3">Overall</th></tr>
            </thead>
            <tbody>
              {QUALITY_FIELDS.map(f => {
                const overall = (f.completeness * 0.5 + f.accuracy * 0.5).toFixed(1);
                return (
                  <tr key={f.field} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{f.field}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-24 bg-gray-100 rounded-full h-2"><div className={`h-2 rounded-full ${f.completeness >= 80 ? 'bg-green-500' : f.completeness >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${f.completeness}%` }} /></div>
                        {f.completeness}%
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-24 bg-gray-100 rounded-full h-2"><div className={`h-2 rounded-full ${f.accuracy >= 90 ? 'bg-green-500' : f.accuracy >= 75 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${f.accuracy}%` }} /></div>
                        {f.accuracy}%
                      </div>
                    </td>
                    <td className="p-3 text-right font-bold">{overall}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </div>
      )}

      {activeTab === 'segments' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
          <h3 className="font-semibold mb-4">RFM Customer Segments</h3>
          <div className="space-y-3">
            {SEGMENTS.map(s => (
              <div key={s.name} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50">
                <div className={`w-3 h-3 ${s.color} rounded-full`} />
                <div className="w-40 font-medium text-sm">{s.name}</div>
                <div className="flex-1">
                  <div className="w-full bg-gray-100 rounded-full h-5 overflow-hidden">
                    <div className={`${s.color} h-full rounded-full flex items-center pl-2`} style={{ width: `${s.pct * 5}%` }}>
                      <span className="text-xs text-white font-bold">{s.count.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="w-16 text-sm text-right">{s.pct}%</div>
                <div className="w-20 text-sm text-right font-medium">{s.avgBalance}</div>
                <div className={`w-16 text-sm text-right font-bold ${parseInt(s.churnRisk) > 30 ? 'text-red-600' : parseInt(s.churnRisk) > 15 ? 'text-yellow-600' : 'text-green-600'}`}>{s.churnRisk}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'affinity' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
          <h3 className="font-semibold mb-4">Product Affinity Analysis (Market Basket)</h3>
          <table className="min-w-full w-full text-sm">
            <thead>
              <tr className="border-b"><th className="text-left p-3">Product A</th><th className="text-left p-3">Product B</th><th className="text-right p-3">Support</th><th className="text-right p-3">Confidence</th><th className="text-right p-3">Lift</th></tr>
            </thead>
            <tbody>
              {PRODUCT_AFFINITIES.map((pa, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">{pa.a}</td>
                  <td className="p-3">{pa.b}</td>
                  <td className="p-3 text-right">{pa.support}%</td>
                  <td className="p-3 text-right font-bold">{pa.confidence}%</td>
                  <td className="p-3 text-right">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${pa.lift >= 1.5 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{pa.lift}x</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="text-sm font-medium text-purple-800">Top Cross-Sell Opportunity</div>
            <div className="text-xs text-purple-600 mt-1">Fixed Deposit → Investment Fund has the highest <strong>lift (2.05x)</strong>, meaning customers with Fixed Deposits are <strong>2x more likely</strong> to adopt Investment Funds than average.</div>
          </div>
        </div>
      )}
    </div>
  );
}
