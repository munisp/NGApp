import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { ArrowDownLeft, Globe, Building2, Shield, AlertTriangle, CheckCircle, Clock, XCircle, ArrowLeft, BarChart3, TrendingUp, Activity, LayoutDashboard, ArrowRightLeft, Map, Landmark, CreditCard, Banknote, Ship, Code, Network, Layers, Search, Zap, ShieldAlert } from 'lucide-react';

type Tab = 'dashboard' | 'transfers' | 'corridors' | 'banks' | 'ai_prophet' | 'ai_cocoindex' | 'ai_kgqa' | 'ai_falkordb' | 'ai_ollama' | 'ai_art' | 'ai_gnn' | 'ai_mcmc';

const moduleLinks = [
  { label: 'Outbound Remittance', href: '/', icon: Globe, color: '#3b82f6' },
  { label: 'Domestic Payments', href: '/domestic-payments', icon: Banknote, color: '#2563eb' },
  { label: 'Trade Payments', href: '/trade-payments', icon: Ship, color: '#7c3aed' },
  { label: 'Card Processing', href: '/card-processing', icon: CreditCard, color: '#dc2626' },
  { label: 'Government Payments', href: '/government-payments', icon: Landmark, color: '#0369a1' },
  { label: 'Open Banking', href: '/open-banking', icon: Code, color: '#0ea5e9' },
];

export default function InboundRemittance() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [statusFilter, setStatusFilter] = useState('');
  const [railFilter, setRailFilter] = useState('');

  const transfersQuery = trpc.inboundRemittance.listTransfers.useQuery(
    { status: statusFilter || undefined, sourceRail: railFilter || undefined },
    { retry: false }
  );
  const corridorsQuery = trpc.inboundRemittance.listCorridors.useQuery(undefined, { retry: false });
  const banksQuery = trpc.inboundRemittance.listReceivingBanks.useQuery(undefined, { retry: false });

  const transfers = transfersQuery.data?.transfers ?? [];
  const summary = transfersQuery.data?.summary;
  const corridors = corridorsQuery.data?.corridors ?? [];
  const banks = banksQuery.data?.banks ?? [];

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      CREDITED: 'bg-green-100 text-green-800', SCREENING_CLEARED: 'bg-blue-100 text-blue-800',
      SCREENING_HELD: 'bg-yellow-100 text-yellow-800', FAILED: 'bg-red-100 text-red-800',
      RETURNED: 'bg-gray-100 text-gray-800', FX_CONVERSION: 'bg-purple-100 text-purple-800',
      RECEIVED: 'bg-blue-50 text-blue-700', CREDITING: 'bg-indigo-100 text-indigo-800',
    };
    return map[s] || 'bg-gray-100 text-gray-700';
  };

  const railBadge = (r: string) => {
    const map: Record<string, string> = {
      SWIFT: 'bg-blue-600 text-white', PAPSS: 'bg-green-600 text-white', CIPS: 'bg-red-600 text-white',
      UPI: 'bg-orange-600 text-white', SEPA: 'bg-indigo-600 text-white', ACH: 'bg-gray-600 text-white',
      FASTER_PAY: 'bg-purple-600 text-white', MOBILE_MONEY: 'bg-yellow-600 text-white',
    };
    return map[r] || 'bg-gray-500 text-white';
  };

  const fmt = (n: number) => n >= 1e9 ? `₦${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `₦${(n / 1e6).toFixed(1)}M` : `₦${n.toLocaleString()}`;
  const fmtUSD = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${n.toLocaleString()}`;

  const navItems: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transfers', label: 'Transfers', icon: ArrowRightLeft },
    { id: 'corridors', label: 'Corridors', icon: Map },
    { id: 'banks', label: 'Receiving Banks', icon: Building2 },
  ];

  const aiNavItems: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'ai_prophet', label: 'Prophet Pipeline', icon: TrendingUp },
    { id: 'ai_cocoindex', label: 'CocoIndex', icon: Layers },
    { id: 'ai_kgqa', label: 'EPR-KGQA', icon: Search },
    { id: 'ai_falkordb', label: 'FalkorDB', icon: Network },
    { id: 'ai_ollama', label: 'Ollama LLM', icon: Zap },
    { id: 'ai_art', label: 'ART Robustness', icon: ShieldAlert },
    { id: 'ai_gnn', label: 'GNN + Neo4j', icon: Network },
    { id: 'ai_mcmc', label: 'MCMC Fraud', icon: Activity },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Left Sidebar */}
      <aside style={{ width: 250, borderRight: '1px solid #e5e7eb', background: '#fafafa', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ArrowDownLeft size={22} color="#059669" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Inbound Remittance</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Payment Switch Module</div>
            </div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, width: '100%', textAlign: 'left',
                background: activeTab === item.id ? '#059669' : 'transparent', color: activeTab === item.id ? 'white' : '#374151', transition: 'all 0.15s' }}>
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, padding: '12px 14px 4px' }}>AI / ML</div>
          {aiNavItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, width: '100%', textAlign: 'left',
                background: activeTab === item.id ? '#059669' : 'transparent', color: activeTab === item.id ? 'white' : '#374151', transition: 'all 0.15s' }}>
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </nav>
        <div style={{ borderTop: '1px solid #e5e7eb', padding: '8px 8px 12px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, padding: '4px 14px 6px' }}>Other Modules</div>
          {moduleLinks.map(m => (
            <a key={m.href} href={m.href} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 6, fontSize: 12, color: m.color, textDecoration: 'none', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <m.icon size={14} />
              {m.label}
            </a>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: 24, overflowY: 'auto', maxWidth: 1200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
            {navItems.find(n => n.id === activeTab)?.label ?? 'Dashboard'}
          </h1>
          <span style={{ fontSize: 13, color: '#6b7280' }}>Receiving international transfers into Nigerian accounts</span>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Total Received', value: summary.totalReceived, icon: ArrowDownLeft, color: '#3b82f6' },
              { label: 'Credited', value: summary.credited, icon: CheckCircle, color: '#10b981' },
              { label: 'Held for Review', value: summary.held, icon: AlertTriangle, color: '#f59e0b' },
              { label: 'Failed', value: summary.failed, icon: XCircle, color: '#ef4444' },
              { label: 'Processing', value: summary.processing, icon: Clock, color: '#8b5cf6' },
              { label: 'Total Volume', value: fmt(summary.totalVolumeNGN), icon: Building2, color: '#059669' },
            ].map((c, i) => (
              <div key={i} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <c.icon size={18} color={c.color} />
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{c.label}</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>
        )}

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && summary && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 24 }}>
            <div style={{ background: 'linear-gradient(135deg, #059669, #10b981)', borderRadius: 16, padding: 24, color: 'white' }}>
              <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>Today's Inflow Volume</div>
              <div style={{ fontSize: 32, fontWeight: 800 }}>{fmt(summary.totalVolumeNGN)}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}><TrendingUp size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> +12.4% vs yesterday</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)', borderRadius: 16, padding: 24, color: 'white' }}>
              <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>Success Rate</div>
              <div style={{ fontSize: 32, fontWeight: 800 }}>{summary.totalReceived > 0 ? ((summary.credited / summary.totalReceived) * 100).toFixed(1) : 0}%</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{summary.credited} of {summary.totalReceived} transfers credited</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', borderRadius: 16, padding: 24, color: 'white' }}>
              <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>Active Corridors</div>
              <div style={{ fontSize: 32, fontWeight: 800 }}>{corridors.filter(c => c.isActive).length}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>of {corridors.length} total corridors</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><BarChart3 size={18} color="#059669" /> Transfer Status Breakdown</h3>
              {[
                { label: 'Credited', value: summary.credited, total: summary.totalReceived, color: '#10b981' },
                { label: 'Screening Held', value: summary.held, total: summary.totalReceived, color: '#f59e0b' },
                { label: 'Processing', value: summary.processing, total: summary.totalReceived, color: '#8b5cf6' },
                { label: 'Failed', value: summary.failed, total: summary.totalReceived, color: '#ef4444' },
              ].map((item, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span>{item.label}</span>
                    <span style={{ fontWeight: 600 }}>{item.value} ({item.total > 0 ? ((item.value / item.total) * 100).toFixed(0) : 0}%)</span>
                  </div>
                  <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${item.total > 0 ? (item.value / item.total) * 100 : 0}%`, background: item.color, borderRadius: 4, transition: 'width 0.5s' }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={18} color="#2563eb" /> Rail Distribution</h3>
              {['SWIFT', 'PAPSS', 'CIPS', 'UPI', 'SEPA'].map((rail, i) => {
                const count = transfers.filter(t => t.sourceRail === rail).length;
                const vol = transfers.filter(t => t.sourceRail === rail).reduce((s, t) => s + t.destAmount, 0);
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: '8px 12px', background: '#f9fafb', borderRadius: 8 }}>
                    <span style={{ padding: '2px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: rail === 'SWIFT' ? '#2563eb' : rail === 'PAPSS' ? '#059669' : rail === 'CIPS' ? '#dc2626' : rail === 'UPI' ? '#ea580c' : '#4f46e5', color: 'white', minWidth: 60, textAlign: 'center' as const }}>{rail}</span>
                    <span style={{ fontSize: 13, flex: 1 }}>{count} transfers</span>
                    <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>{fmt(vol)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Globe size={18} color="#7c3aed" /> Top Corridors by Volume</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {corridors.sort((a, b) => b.dailyVolumeUSD - a.dailyVolumeUSD).slice(0, 6).map((c, i) => (
                <div key={i} style={{ padding: 12, background: '#f9fafb', borderRadius: 8, borderLeft: `4px solid ${i === 0 ? '#059669' : i === 1 ? '#2563eb' : '#8b5cf6'}` }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{c.sourceCountryName}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#059669', marginTop: 4 }}>{fmtUSD(c.dailyVolumeUSD)}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{c.rails.join(' · ')} · {(c.avgSettlementMs / 1000).toFixed(0)}s avg</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Transfers Tab */}
      {activeTab === 'transfers' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}>
              <option value="">All Statuses</option>
              {['CREDITED', 'SCREENING_HELD', 'FAILED', 'FX_CONVERSION', 'RETURNED'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={railFilter} onChange={e => setRailFilter(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}>
              <option value="">All Rails</option>
              {['SWIFT', 'PAPSS', 'CIPS', 'UPI', 'SEPA'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['ID', 'Rail', 'Corridor', 'Sender', 'Beneficiary', 'Source Amt', 'NGN Amt', 'FX Rate', 'Status', 'Compliance', 'Time'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transfers.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{t.id}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, ...Object.fromEntries(railBadge(t.sourceRail).split(' ').map(c => {
                        if (c.startsWith('bg-')) return ['background', c.includes('blue-600') ? '#2563eb' : c.includes('green-600') ? '#059669' : c.includes('red-600') ? '#dc2626' : c.includes('orange-600') ? '#ea580c' : c.includes('indigo-600') ? '#4f46e5' : '#6b7280'];
                        return ['color', 'white'];
                      })) }}>{t.sourceRail}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>{t.sourceCountryName} → NG</td>
                    <td style={{ padding: '10px 12px' }}>{t.senderName}</td>
                    <td style={{ padding: '10px 12px' }}>{t.beneficiaryName}<br/><span style={{ fontSize: 11, color: '#9ca3af' }}>{t.beneficiaryBank}</span></td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{t.sourceCurrency} {t.sourceAmount.toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(t.destAmount)}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{t.fxRate}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className={statusColor(t.status)} style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600 }}>{t.status}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ color: t.complianceScore > 50 ? '#ef4444' : t.complianceScore > 25 ? '#f59e0b' : '#10b981', fontWeight: 600 }}>{t.complianceScore}</span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: '#6b7280' }}>{new Date(t.receivedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Corridors Tab */}
      {activeTab === 'corridors' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {corridors.map(c => (
            <div key={c.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{c.sourceCountryName} → Nigeria</span>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{c.id} · {c.sourceCurrency}</div>
                </div>
                <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: c.isActive ? '#dcfce7' : '#fef2f2', color: c.isActive ? '#166534' : '#991b1b' }}>
                  {c.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                <div><span style={{ color: '#9ca3af' }}>Daily Volume:</span> <strong>{fmtUSD(c.dailyVolumeUSD)}</strong></div>
                <div><span style={{ color: '#9ca3af' }}>Avg Settlement:</span> <strong>{(c.avgSettlementMs / 1000).toFixed(0)}s</strong></div>
                <div><span style={{ color: '#9ca3af' }}>Compliance:</span> <strong style={{ color: c.complianceLevel === 'enhanced' ? '#f59e0b' : '#10b981' }}>{c.complianceLevel}</strong></div>
                <div><span style={{ color: '#9ca3af' }}>Rails:</span> <strong>{c.rails.join(', ')}</strong></div>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>Banks: {c.receivingBanks.join(', ')}</div>
            </div>
          ))}
        </div>
      )}

      {/* Receiving Banks Tab */}
      {activeTab === 'banks' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Code', 'Bank Name', 'NIP Code', 'SWIFT Code', 'Daily Capacity', 'Status'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {banks.map(b => (
              <tr key={b.code} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{b.code}</td>
                <td style={{ padding: '10px 12px' }}>{b.name}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{b.nipCode}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{b.swiftCode}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{fmtUSD(b.dailyCapacity)}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: '#dcfce7', color: '#166534' }}>{b.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* AI/ML Tabs */}
      {activeTab.startsWith('ai_') && <InboundAIMLContent activeTab={activeTab} />}
      </main>
    </div>
  );
}

// =============================================================================
// INBOUND AI/ML SECTION
// =============================================================================

function InbSourceBanner({ source }: { source: string }) {
  const isLive = source.includes('LIVE');
  return (
    <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, border: `1px solid ${isLive ? '#86efac' : '#fcd34d'}`, background: isLive ? '#dcfce7' : '#fef3c7', color: isLive ? '#166534' : '#92400e', fontSize: 13 }}>
      {source}
    </div>
  );
}

function InbMetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 11, color: '#6b7280' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function InboundAIMLContent({ activeTab }: { activeTab: string }) {
  const prophetQ = trpc.inboundRemittance.getInboundProphetPipeline.useQuery(undefined, { enabled: activeTab === 'ai_prophet' });
  const cocoQ = trpc.inboundRemittance.getInboundCocoIndex.useQuery(undefined, { enabled: activeTab === 'ai_cocoindex' });
  const kgqaQ = trpc.inboundRemittance.getInboundEPRKGQA.useQuery(undefined, { enabled: activeTab === 'ai_kgqa' });
  const falkorQ = trpc.inboundRemittance.getInboundFalkorDB.useQuery(undefined, { enabled: activeTab === 'ai_falkordb' });
  const ollamaQ = trpc.inboundRemittance.getInboundOllamaStatus.useQuery(undefined, { enabled: activeTab === 'ai_ollama' });
  const ollamaMut = trpc.inboundRemittance.queryInboundOllama.useMutation();
  const artQ = trpc.inboundRemittance.getInboundARTResults.useQuery(undefined, { enabled: activeTab === 'ai_art' });
  const gnnQ = trpc.inboundRemittance.getInboundGNNFraudNetworks.useQuery(undefined, { enabled: activeTab === 'ai_gnn' });
  const mcmcQ = trpc.inboundRemittance.getInboundMCMCFraudScoring.useQuery(undefined, { enabled: activeTab === 'ai_mcmc' });
  const [ollamaInput, setOllamaInput] = React.useState('');
  const [ollamaHistory, setOllamaHistory] = React.useState<{q:string;a:string}[]>([]);

  const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
  const th: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e5e7eb', background: '#f9fafb' };
  const td: React.CSSProperties = { padding: '8px 12px', borderBottom: '1px solid #f3f4f6' };

  if (activeTab === 'ai_prophet') {
    const d = prophetQ.data as any;
    if (prophetQ.isLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading Prophet...</div>;
    if (!d) return <div style={{ color: '#9ca3af' }}>No Prophet data</div>;
    return (
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Prophet Forecasting — Inbound Remittance</h2>
        <InbSourceBanner source={d._source} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
          <InbMetricCard label="Model" value={d.model.id} sub={d.model.framework} />
          <InbMetricCard label="MAPE" value={`${d.metrics.mape.toFixed(2)}%`} sub={`Confidence: ${d.metrics.confidenceScore.toFixed(1)}%`} />
          <InbMetricCard label="RMSE" value={d.metrics.rmse.toLocaleString()} sub={`MAE: ${d.metrics.mae.toLocaleString()}`} />
          <InbMetricCard label="CV Folds" value={d.metrics.crossValidationFolds} sub={`R²: ${d.metrics.rSquared.toFixed(4)}`} />
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Cross-Validation</h3>
          <table style={tbl}><thead><tr>{['Fold','MAPE','RMSE','R²'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{d.crossValidation.map((cv:any)=><tr key={cv.fold}><td style={td}>Fold {cv.fold}</td><td style={td}>{cv.mape.toFixed(2)}%</td><td style={td}>{cv.rmse.toLocaleString()}</td><td style={td}>{cv.rSquared.toFixed(4)}</td></tr>)}</tbody></table>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Regressors</h3>
          <table style={tbl}><thead><tr>{['Name','Description','Weight','Active'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{d.regressors.map((r:any)=><tr key={r.name}><td style={{...td,fontFamily:'monospace',fontSize:12}}>{r.name}</td><td style={td}>{r.description}</td><td style={td}>{r.weight.toFixed(2)}</td><td style={td}>{r.active?'✓':'✗'}</td></tr>)}</tbody></table>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Forecasts</h3>
          <table style={tbl}><thead><tr>{['Date','Corridor','Predicted (₦)','Lower','Upper','Tags'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{d.forecasts.map((f:any,i:number)=><tr key={i}><td style={td}>{f.date}</td><td style={td}>{f.corridor}</td><td style={{...td,fontWeight:700}}>₦{f.predicted.toLocaleString()}</td><td style={td}>₦{f.lower.toLocaleString()}</td><td style={td}>₦{f.upper.toLocaleString()}</td><td style={td}>{f.isSalaryDay&&<span style={{fontSize:11,background:'#dbeafe',padding:'2px 6px',borderRadius:4}}>SALARY DAY</span>}{f.isHoliday&&<span style={{fontSize:11,background:'#fecaca',padding:'2px 6px',borderRadius:4,marginLeft:4}}>HOLIDAY</span>}</td></tr>)}</tbody></table>
        </div>
      </div>
    );
  }

  if (activeTab === 'ai_cocoindex') {
    const d = cocoQ.data as any;
    if (cocoQ.isLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading CocoIndex...</div>;
    if (!d) return <div style={{ color: '#9ca3af' }}>No CocoIndex data</div>;
    return (
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>CocoIndex Data Pipeline — Inbound Remittance</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
          <InbMetricCard label="Pipeline" value={d.pipeline.name} sub={d.pipeline.framework} />
          <InbMetricCard label="Total Docs" value={d.stats.totalDocs.toLocaleString()} sub={`${d.stats.indexingRate.toLocaleString()} docs/s`} />
          <InbMetricCard label="Avg Latency" value={`${d.stats.avgLatencyMs}ms`} sub={`Cache: ${(d.stats.cacheHitRate*100).toFixed(0)}%`} />
          <InbMetricCard label="Status" value={d.pipeline.status} sub={d.pipeline.version} />
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Data Sources</h3>
          <table style={tbl}><thead><tr>{['Source','Type','Status','Docs','Lag'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{d.sources.map((s:any)=><tr key={s.name}><td style={td}>{s.name}</td><td style={td}>{s.type}</td><td style={td}><span style={{fontSize:11,padding:'2px 6px',borderRadius:4,background:s.status==='streaming'?'#dcfce7':'#dbeafe'}}>{s.status}</span></td><td style={td}>{s.docsIndexed.toLocaleString()}</td><td style={td}>{s.lag}</td></tr>)}</tbody></table>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Middleware</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, fontSize: 13 }}>
            <div><span style={{ color: '#6b7280' }}>Kafka:</span> {d.middleware.kafka}</div>
            <div><span style={{ color: '#6b7280' }}>Fluvio:</span> {d.middleware.fluvio}</div>
            <div><span style={{ color: '#6b7280' }}>Redis:</span> {d.middleware.redis}</div>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'ai_kgqa') {
    const d = kgqaQ.data as any;
    if (kgqaQ.isLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading KG QA...</div>;
    if (!d) return <div style={{ color: '#9ca3af' }}>No KGQA data</div>;
    return (
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>EPR-KGQA — Knowledge Graph QA (Inbound)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
          <InbMetricCard label="Nodes" value={d.graph.nodes.toLocaleString()} sub={d.graph.nodeTypes.join(', ')} />
          <InbMetricCard label="Edges" value={d.graph.edges.toLocaleString()} sub={d.graph.edgeTypes.join(', ')} />
          <InbMetricCard label="Queries" value={d.stats.totalQueries.toLocaleString()} sub={`Cache: ${(d.stats.cacheHitRate*100).toFixed(0)}%`} />
          <InbMetricCard label="Avg Latency" value={`${d.stats.avgLatencyMs}ms`} sub={d.graph.framework} />
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Recent Queries</h3>
          {d.recentQueries.map((q:any,i:number)=>(
            <div key={i} style={{ marginBottom: 16, paddingBottom: 12, borderBottom: i<d.recentQueries.length-1?'1px solid #f3f4f6':'none' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{q.question}</div>
              <pre style={{ background: '#f3f4f6', padding: 8, borderRadius: 6, fontSize: 11, overflowX: 'auto', marginBottom: 4 }}>{q.cypher}</pre>
              <div style={{ fontSize: 13 }}>{q.answer}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{q.latencyMs}ms • {q.tokens} tokens</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activeTab === 'ai_falkordb') {
    const d = falkorQ.data as any;
    if (falkorQ.isLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading FalkorDB...</div>;
    if (!d) return <div style={{ color: '#9ca3af' }}>No FalkorDB data</div>;
    return (
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>FalkorDB Graph Engine — Inbound Remittance</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
          <InbMetricCard label="Nodes" value={d.stats.totalNodes.toLocaleString()} sub={`${d.stats.totalEdges.toLocaleString()} edges`} />
          <InbMetricCard label="Avg Query" value={`${d.stats.avgQueryMs}ms`} sub={`${d.stats.queriesPerSec.toLocaleString()} QPS`} />
          <InbMetricCard label="Cache Hit" value={`${(d.stats.cacheHitRate*100).toFixed(0)}%`} sub={`Memory: ${d.stats.memoryMb}MB`} />
          <InbMetricCard label="Status" value={d.connection.status} sub={d.connection.graphName} />
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Corridor Graph</h3>
          <table style={tbl}><thead><tr>{['Corridor','Nodes','Edges','Avg Degree','Risk'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{d.corridorGraph.map((c:any)=><tr key={c.corridor}><td style={{...td,fontFamily:'monospace'}}>{c.corridor}</td><td style={td}>{c.nodes.toLocaleString()}</td><td style={td}>{c.edges.toLocaleString()}</td><td style={td}>{c.avgDegree}</td><td style={td}><span style={{fontSize:11,padding:'2px 6px',borderRadius:4,background:c.riskScore>0.15?'#fecaca':'#dcfce7'}}>{c.riskScore}</span></td></tr>)}</tbody></table>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Recent Queries</h3>
          {d.recentQueries.map((q:any,i:number)=>(
            <div key={i} style={{ marginBottom: 12 }}>
              <pre style={{ background: '#f3f4f6', padding: 8, borderRadius: 6, fontSize: 11, overflowX: 'auto' }}>{q.query}</pre>
              <div style={{ fontSize: 13, marginTop: 4 }}>Result: {q.result} <span style={{ color: '#9ca3af' }}>({q.latencyUs}μs)</span></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activeTab === 'ai_ollama') {
    const d = ollamaQ.data as any;
    if (ollamaQ.isLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading Ollama...</div>;
    if (!d) return <div style={{ color: '#9ca3af' }}>No Ollama data</div>;
    return (
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Ollama LLM — Inbound Remittance</h2>
        <InbSourceBanner source={d._source} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
          <InbMetricCard label="Model" value={d.config.model} sub={d.config.framework} />
          <InbMetricCard label="Queries" value={d.stats.totalQueries} sub={`Avg: ${d.stats.avgLatencyMs}ms`} />
          <InbMetricCard label="Tokens" value={d.stats.totalTokensUsed.toLocaleString()} sub={`Uptime: ${d.stats.uptimeHours}h`} />
          <InbMetricCard label="Size" value={`${d.stats.modelSizeGb}GB`} sub={`Max: ${d.config.maxTokens}`} />
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Interactive Query</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 13 }} placeholder="Ask about inbound remittance..." value={ollamaInput} onChange={e => setOllamaInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && ollamaInput.trim()) { const q = ollamaInput.trim(); setOllamaInput(''); ollamaMut.mutate({ question: q }, { onSuccess: (r: any) => setOllamaHistory(h => [...h, { q, a: r.answer }]) }); }}} />
            <button style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#059669', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' }} disabled={ollamaMut.isPending || !ollamaInput.trim()} onClick={() => { const q = ollamaInput.trim(); setOllamaInput(''); ollamaMut.mutate({ question: q }, { onSuccess: (r: any) => setOllamaHistory(h => [...h, { q, a: r.answer }]) }); }}>
              {ollamaMut.isPending ? 'Thinking...' : 'Ask'}
            </button>
          </div>
          {ollamaHistory.map((h, i) => (
            <div key={i} style={{ marginTop: 12, borderTop: '1px solid #e5e7eb', paddingTop: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Q: {h.q}</div>
              <div style={{ fontSize: 13, marginTop: 4, whiteSpace: 'pre-wrap' }}>{h.a}</div>
            </div>
          ))}
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Recent Queries</h3>
          {d.recentQueries.map((q:any,i:number)=>(
            <div key={i} style={{ marginBottom: 10, paddingBottom: 8, borderBottom: i<d.recentQueries.length-1?'1px solid #f3f4f6':'none' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{q.question}</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>{q.answer}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{q.latencyMs}ms • {q.tokens} tokens • {q.category}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activeTab === 'ai_art') {
    const d = artQ.data as any;
    if (artQ.isLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading ART...</div>;
    if (!d) return <div style={{ color: '#9ca3af' }}>No ART data</div>;
    return (
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>IBM ART Robustness — Inbound Remittance</h2>
        <InbSourceBanner source={d._source} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
          <InbMetricCard label="Model" value={d.model.name} sub={d.model.framework} />
          <InbMetricCard label="Clean Accuracy" value={`${(d.model.accuracy*100).toFixed(1)}%`} sub={`${d.model.trainingSamples} samples`} />
          <InbMetricCard label="Robustness" value={`${(d.model.robustness*100).toFixed(1)}%`} sub={`${d.model.testSamples} test`} />
          <InbMetricCard label="Features" value={d.model.features?.length || d.model.features} />
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Attack Results</h3>
          <table style={tbl}><thead><tr>{['Attack','Type','Evasion','Clean','Adversarial','Status'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{d.attacks.map((a:any)=><tr key={a.name}><td style={td}>{a.name}</td><td style={td}>{a.type}</td><td style={td}>{(a.evasionRate*100).toFixed(1)}%</td><td style={td}>{(a.cleanAccuracy*100).toFixed(1)}%</td><td style={td}>{(a.adversarialAccuracy*100).toFixed(1)}%</td><td style={td}><span style={{fontSize:11,padding:'2px 6px',borderRadius:4,background:'#dcfce7',color:'#166534'}}>{a.status}</span></td></tr>)}</tbody></table>
        </div>
      </div>
    );
  }

  if (activeTab === 'ai_gnn') {
    const d = gnnQ.data as any;
    if (gnnQ.isLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading GNN...</div>;
    if (!d) return <div style={{ color: '#9ca3af' }}>No GNN data</div>;
    return (
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>GNN + Neo4j Fraud Detection — Inbound Remittance</h2>
        <InbSourceBanner source={d._source} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
          <InbMetricCard label="Model" value={d.model.name} sub={d.model.framework} />
          <InbMetricCard label="Accuracy" value={`${(d.model.accuracy*100).toFixed(1)}%`} sub={`±${(d.model.accuracyStd*100).toFixed(2)}%`} />
          <InbMetricCard label="AUC-ROC" value={d.model.aucRoc.toFixed(3)} sub={`${d.model.cvFolds} folds`} />
          <InbMetricCard label="Graph" value={`${(d.graphStats.nodes/1e6).toFixed(1)}M nodes`} sub={`${(d.graphStats.edges/1e6).toFixed(1)}M edges`} />
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Detected Fraud Networks</h3>
          <table style={tbl}><thead><tr>{['ID','Type','Nodes','Edges','Risk','Corridors','Description'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{d.detectedNetworks.map((n:any)=><tr key={n.id}><td style={{...td,fontFamily:'monospace',fontSize:11}}>{n.id}</td><td style={td}>{n.type}</td><td style={td}>{n.nodes}</td><td style={td}>{n.edges}</td><td style={td}><span style={{fontSize:11,padding:'2px 6px',borderRadius:4,background:n.risk_score>0.8?'#fecaca':'#fef3c7'}}>{n.risk_score}</span></td><td style={td}>{n.corridors.join(', ')}</td><td style={{...td,fontSize:12}}>{n.description}</td></tr>)}</tbody></table>
        </div>
      </div>
    );
  }

  if (activeTab === 'ai_mcmc') {
    const d = mcmcQ.data as any;
    if (mcmcQ.isLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading MCMC...</div>;
    if (!d) return <div style={{ color: '#9ca3af' }}>No MCMC data</div>;
    return (
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>MCMC Bayesian Fraud Scoring — Inbound Remittance</h2>
        <InbSourceBanner source={d._source} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
          <InbMetricCard label="Framework" value={d.config.framework.split('(')[0].trim()} sub={d.config.framework} />
          <InbMetricCard label="Posterior Mean" value={d.scoring.posteriorMean.toFixed(6)} sub={`Std: ${d.scoring.posteriorStd.toFixed(6)}`} />
          <InbMetricCard label="HDI (94%)" value={`[${d.scoring.hdiLower.toFixed(4)}, ${d.scoring.hdiUpper.toFixed(4)}]`} sub={`R-hat: ${d.scoring.rHat.toFixed(3)}`} />
          <InbMetricCard label="Risk Level" value={d.scoring.riskLevel} sub={`${d.config.chains} chains × ${d.config.samplesPerChain}`} />
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Example Transaction</h3>
          <div style={{ fontSize: 13 }}>
            <p><span style={{ color: '#6b7280' }}>Corridor:</span> {d.scoring.exampleTransaction.corridor}</p>
            <p><span style={{ color: '#6b7280' }}>Amount:</span> ${d.scoring.exampleTransaction.amountUsd.toLocaleString()}</p>
            <p><span style={{ color: '#6b7280' }}>Direction:</span> {d.scoring.exampleTransaction.direction}</p>
          </div>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Corridor Risk Map</h3>
          <table style={tbl}><thead><tr>{['Corridor','Base Risk','Label'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{d.corridorRiskMap.map((c:any)=><tr key={c.corridor}><td style={{...td,fontFamily:'monospace'}}>{c.corridor}</td><td style={td}>{(c.baseRisk*100).toFixed(1)}%</td><td style={td}><span style={{fontSize:11,padding:'2px 6px',borderRadius:4,background:c.label==='HIGH'?'#fecaca':c.label==='MEDIUM'?'#fef3c7':'#dcfce7'}}>{c.label}</span></td></tr>)}</tbody></table>
        </div>
      </div>
    );
  }

  return <div style={{ color: '#9ca3af' }}>Select an AI/ML tab</div>;
}
