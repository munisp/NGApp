import { useState, useContext } from 'react';
import { TenantContext } from '../contexts/TenantContext';
import { Building2, Users, Globe, CreditCard, TrendingUp, DollarSign, Target, BarChart3, ArrowUpRight, ArrowDownRight, Zap, Shield, Landmark, PieChart, Star } from 'lucide-react';
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const CHANNELS = {
  core_banking: {
    name: 'Core Banking', icon: Building2, color: 'blue',
    tagline: 'Traditional banking with digital overlay',
    description: 'Savings, current accounts, fixed deposits, personal/business loans, salary accounts',
    market_size: '₦85.2T total banking assets',
    addressable: '45M+ banked adults in Nigeria',
    revenue_per_customer: 185000, cac: 12500, ltv_cac: 14.8, margin: 42.5, growth: 12.8,
    payback_months: 8, roi_5yr: 485, break_even: 2500,
    products: ['Savings Account', 'Current Account', 'Fixed Deposit', 'Personal Loan', 'Salary Account', 'Business Loan'],
    advantage: 'Full-stack digital banking with AI-powered credit scoring and real-time fraud detection',
    risks: ['Regulatory compliance costs', 'Legacy system migration', 'NPL ratio management'],
    value_drivers: [
      { driver: 'Interest income from loan portfolio', pct: 45 },
      { driver: 'Fee income (transfers, maintenance)', pct: 25 },
      { driver: 'Cross-sell to investment/insurance', pct: 15 },
      { driver: 'Data monetization (credit scoring)', pct: 15 },
    ],
    metrics: { customers: 48900, monthly_volume: '₦230.5B', npl_ratio: '3.2%', avg_balance: '₦5.2M' },
  },
  agent_banking: {
    name: 'Agent Banking', icon: Users, color: 'green',
    tagline: 'Last-mile financial inclusion via agent networks',
    description: 'Cash-in/out, account opening, bill payments, airtime purchase, micro-savings at 15,000+ agent locations',
    market_size: '36.8M financially excluded adults',
    addressable: '38M+ unbanked/underbanked Nigerians',
    revenue_per_customer: 42000, cac: 2100, ltv_cac: 20.0, margin: 38.2, growth: 35.5,
    payback_months: 3, roi_5yr: 720, break_even: 500,
    products: ['Cash-In/Cash-Out', 'Account Opening', 'Bill Payment', 'Airtime Purchase', 'Micro-Savings', 'KYC Upgrade'],
    advantage: 'AI-powered agent route optimization, real-time float management, multi-language support (Hausa, Yoruba, Igbo)',
    risks: ['Agent fraud/cash management', 'Network connectivity in rural areas', 'Competition from MoMo agents'],
    value_drivers: [
      { driver: 'Transaction fees (cash-in/out)', pct: 40 },
      { driver: 'Account opening commissions', pct: 20 },
      { driver: 'Bill payment commissions', pct: 20 },
      { driver: 'Upgrade to full banking (funnel)', pct: 20 },
    ],
    metrics: { customers: 28500, monthly_volume: '₦2.9B', agents: 3200, coverage: '24 states' },
  },
  remittance: {
    name: 'Remittance', icon: Globe, color: 'purple',
    tagline: 'Cross-border money transfers — diaspora inflows',
    description: 'International transfers, regional corridors, instant settlement via Mojaloop, multi-currency wallets',
    market_size: '$20.1B diaspora remittance to Nigeria',
    addressable: '15M+ Nigerians in diaspora',
    revenue_per_customer: 95000, cac: 8500, ltv_cac: 11.2, margin: 52.8, growth: 18.5,
    payback_months: 6, roi_5yr: 580, break_even: 1200,
    products: ['International Transfer', 'Regional Corridor', 'Instant Settlement', 'Multi-Currency Wallet', 'FX Conversion'],
    advantage: 'Mojaloop DFSP integration for instant settlement, 8 active corridors, competitive FX rates',
    risks: ['FX rate volatility', 'CBN regulatory changes on IMTOs', 'Compliance (AML/CFT)'],
    value_drivers: [
      { driver: 'Transfer fees (0.5-2%)', pct: 35 },
      { driver: 'FX spread income', pct: 35 },
      { driver: 'Cross-sell to savings/investment', pct: 15 },
      { driver: 'Float income on settlement', pct: 15 },
    ],
    metrics: { customers: 43800, monthly_volume: '$125.0M', corridors: 8, avg_transfer: '$450' },
  },
  payments: {
    name: 'Payments', icon: CreditCard, color: 'orange',
    tagline: 'Digital payments infrastructure — POS, QR, NFC',
    description: 'POS terminals, QR payments, online gateway, merchant acquiring, settlement services',
    market_size: '₦572.6T electronic payment value',
    addressable: '200K+ merchants, 80M+ card holders',
    revenue_per_customer: 128000, cac: 15000, ltv_cac: 8.5, margin: 28.5, growth: 25.2,
    payback_months: 10, roi_5yr: 340, break_even: 3500,
    products: ['POS Terminal', 'QR Payments', 'Online Gateway', 'Merchant Dashboard', 'Settlement', 'Payroll'],
    advantage: 'Sub-second settlement via TigerBeetle, multi-acquirer routing, smart POS with inventory',
    risks: ['Interchange fee regulation', 'Fraud/chargeback liability', 'Terminal deployment costs'],
    value_drivers: [
      { driver: 'Transaction processing fees (MDR)', pct: 50 },
      { driver: 'Terminal rental/sales', pct: 20 },
      { driver: 'Value-added services (loyalty)', pct: 15 },
      { driver: 'Settlement float income', pct: 15 },
    ],
    metrics: { customers: 85000, monthly_volume: '₦45.2B', terminals: 12500, avg_txn: '₦8,500' },
  },
};

const COLOR_MAP = { blue: 'from-blue-500 to-blue-700', green: 'from-green-500 to-green-700', purple: 'from-purple-500 to-purple-700', orange: 'from-orange-500 to-orange-700' };
const BG_MAP = { blue: 'bg-blue-50', green: 'bg-green-50', purple: 'bg-purple-50', orange: 'bg-orange-50' };
const TEXT_MAP = { blue: 'text-blue-700', green: 'text-green-700', purple: 'text-purple-700', orange: 'text-orange-700' };

export default function ChannelValueAnalysis() {
  const { t } = useTranslation()
  const { tenantId } = useContext(TenantContext);
  const [selectedChannel, setSelectedChannel] = useState('core_banking');
  const [compareMode, setCompareMode] = useState(false);

  const channel = CHANNELS[selectedChannel];
  const Icon = channel.icon;

  const formatCurrency = (v) => v >= 1000000 ? `₦${(v/1000000).toFixed(1)}M` : v >= 1000 ? `₦${(v/1000).toFixed(0)}K` : `₦${v.toLocaleString()}`;

  return (
    <div role="region" aria-label="ChannelValueAnalysis"  className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-indigo-600" /> Banking Channel Value Analysis
          </h1>
          <p className="text-gray-500 mt-1">ROI, market opportunity, and value proposition per banking channel</p>
        </div>
        <button onClick={() => setCompareMode(!compareMode)} className={`px-4 py-2 rounded-lg text-sm font-medium ${compareMode ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
          {compareMode ? 'Single View' : 'Compare All'}
        </button>
      </div>

      {/* Channel Selector */}
      <div className="grid grid-cols-4 gap-4">
        {Object.entries(CHANNELS).map(([key, ch]) => {
          const ChIcon = ch.icon;
          const active = selectedChannel === key;
          return (
            <button key={key} onClick={() => setSelectedChannel(key)} className={`p-4 rounded-xl border-2 transition-all ${active ? `border-${ch.color}-500 bg-gradient-to-br ${COLOR_MAP[ch.color]} text-white shadow-lg` : 'border-gray-200 bg-white hover:border-gray-300'}`}>
              <ChIcon className={`w-6 h-6 ${active ? 'text-white' : `text-${ch.color}-600`} mb-2`} />
              <div className={`font-semibold ${active ? 'text-white' : 'text-gray-900'}`}>{ch.name}</div>
              <div className={`text-xs mt-1 ${active ? 'text-white/80' : 'text-gray-500'}`}>{ch.growth}% growth</div>
            </button>
          );
        })}
      </div>

      {compareMode ? (
        /* Compare All Channels */
        <div tabIndex="0" className="bg-white dark:bg-gray-800 rounded-xl border p-6">
          <h2 className="text-lg font-bold mb-4">Channel Comparison Matrix</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium text-gray-500">Metric</th>
                  {Object.values(CHANNELS).map(ch => <th key={ch.name} className="text-right p-3 font-medium text-gray-500">{ch.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Revenue/Customer', fn: ch => formatCurrency(ch.revenue_per_customer) },
                  { label: 'Acquisition Cost', fn: ch => formatCurrency(ch.cac) },
                  { label: 'LTV:CAC Ratio', fn: ch => `${ch.ltv_cac}x`, best: 'max' },
                  { label: 'Margin', fn: ch => `${ch.margin}%` },
                  { label: 'Growth Rate', fn: ch => `${ch.growth}%`, best: 'max' },
                  { label: 'Payback Period', fn: ch => `${ch.payback_months} mo`, best: 'min' },
                  { label: '5-Year ROI', fn: ch => `${ch.roi_5yr}%`, best: 'max' },
                  { label: 'Break-Even', fn: ch => `${ch.break_even.toLocaleString()} customers` },
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{row.label}</td>
                    {Object.values(CHANNELS).map(ch => <td key={ch.name} className="text-right p-3">{row.fn(ch)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Single Channel Deep Dive */
        <>
          {/* Hero Stats */}
          <div className={`bg-gradient-to-br ${COLOR_MAP[channel.color]} rounded-xl p-6 text-white`}>
            <div className="flex items-center gap-3 mb-4">
              <Icon className="w-8 h-8" />
              <div>
                <h2 className="text-xl font-bold">{channel.name}</h2>
                <p className="text-white/80">{channel.tagline}</p>
              </div>
            </div>
            <p className="text-sm text-white/90 mb-4">{channel.description}</p>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-white/70 text-xs">Market Size</div>
                <div className="font-bold text-lg">{channel.market_size}</div>
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-white/70 text-xs">Addressable Market</div>
                <div className="font-bold text-lg">{channel.addressable}</div>
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-white/70 text-xs">Margin</div>
                <div className="font-bold text-lg">{channel.margin}%</div>
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-white/70 text-xs">Growth</div>
                <div className="font-bold text-lg flex items-center gap-1"><ArrowUpRight className="w-4 h-4" />{channel.growth}%</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* ROI Metrics */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><DollarSign className="w-5 h-5 text-green-600" /> ROI Metrics</h3>
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-gray-500">Revenue per Customer</div>
                  <div className="text-xl font-bold text-gray-900">{formatCurrency(channel.revenue_per_customer)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Customer Acquisition Cost</div>
                  <div className="text-xl font-bold text-gray-900">{formatCurrency(channel.cac)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">LTV:CAC Ratio</div>
                  <div className="text-xl font-bold text-green-600">{channel.ltv_cac}x</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">5-Year ROI</div>
                  <div className="text-xl font-bold text-indigo-600">{channel.roi_5yr}%</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Payback Period</div>
                  <div className="text-lg font-bold text-gray-900">{channel.payback_months} months</div>
                </div>
              </div>
            </div>

            {/* Value Drivers */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><PieChart className="w-5 h-5 text-indigo-600" /> Revenue Drivers</h3>
              <div className="space-y-3">
                {channel.value_drivers.map((d, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{d.driver}</span>
                      <span className="font-medium">{d.pct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className={`bg-gradient-to-r ${COLOR_MAP[channel.color]} h-2 rounded-full`} style={{ width: `${d.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Products & Risks */}
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Star className="w-5 h-5 text-yellow-500" /> Key Products</h3>
                <div className="flex flex-wrap gap-2">
                  {channel.products.map(p => (
                    <span key={p} className={`px-2 py-1 rounded-full text-xs font-medium ${BG_MAP[channel.color]} ${TEXT_MAP[channel.color]}`}>{p}</span>
                  ))}
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Shield className="w-5 h-5 text-red-500" /> Risk Factors</h3>
                <ul className="space-y-2">
                  {channel.risks.map(r => (
                    <li key={r} className="flex items-start gap-2 text-sm text-gray-600">
                      <ArrowDownRight className="w-4 h-4 text-red-400 mt-0.5 shrink-0" /> {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Competitive Advantage */}
          <div className={`${BG_MAP[channel.color]} rounded-xl border p-5`}>
            <h3 className={`font-semibold ${TEXT_MAP[channel.color]} mb-2 flex items-center gap-2`}><Zap className="w-5 h-5" /> Competitive Advantage</h3>
            <p className="text-gray-700">{channel.advantage}</p>
          </div>

          {/* Current Performance */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Current Performance Metrics</h3>
            <div className="grid grid-cols-4 gap-4">
              {Object.entries(channel.metrics).map(([key, val]) => (
                <div key={key} className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 capitalize">{key.replace(/_/g, ' ')}</div>
                  <div className="text-lg font-bold text-gray-900">{typeof val === 'number' ? val.toLocaleString() : val}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
