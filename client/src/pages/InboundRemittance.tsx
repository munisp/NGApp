import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { ArrowDownLeft, Globe, Building2, Shield, AlertTriangle, CheckCircle, Clock, XCircle, ArrowLeft, BarChart3, TrendingUp, Activity } from 'lucide-react';

type Tab = 'dashboard' | 'transfers' | 'corridors' | 'banks';

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

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <ArrowDownLeft size={28} color="#059669" />
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Inbound Remittance</h1>
        <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 8 }}>Receiving international transfers into Nigerian accounts</span>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid #e5e7eb', paddingBottom: 8 }}>
        {(['dashboard', 'transfers', 'corridors', 'banks'] as Tab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
              background: activeTab === tab ? '#059669' : 'transparent', color: activeTab === tab ? 'white' : '#6b7280' }}>
            {tab === 'dashboard' ? 'Dashboard' : tab === 'transfers' ? 'Transfers' : tab === 'corridors' ? 'Corridors' : 'Receiving Banks'}
          </button>
        ))}
      </div>

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
    </div>
  );
}
