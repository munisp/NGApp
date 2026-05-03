import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Ship, FileText, Lock, Landmark, Package, CheckCircle, Clock, AlertCircle } from 'lucide-react';

type Tab = 'lcs' | 'escrows' | 'customs';

export default function TradePayments() {
  const [activeTab, setActiveTab] = useState<Tab>('lcs');
  const [lcTypeFilter, setLcTypeFilter] = useState('');

  const lcsQuery = trpc.tradePayments.listLCs.useQuery({ type: lcTypeFilter || undefined }, { retry: false });
  const escrowsQuery = trpc.tradePayments.listEscrows.useQuery(undefined, { retry: false });
  const dutiesQuery = trpc.tradePayments.listCustomsDuties.useQuery(undefined, { retry: false });

  const lcs = lcsQuery.data?.lcs ?? [];
  const lcSummary = lcsQuery.data?.summary;
  const escrows = escrowsQuery.data?.escrows ?? [];
  const duties = dutiesQuery.data?.duties ?? [];

  const fmt = (n: number) => n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${n.toLocaleString()}`;
  const fmtNGN = (n: number) => n >= 1e9 ? `₦${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `₦${(n / 1e6).toFixed(1)}M` : `₦${n.toLocaleString()}`;

  const lcStatusColor = (s: string) => {
    const m: Record<string, { bg: string; fg: string }> = {
      ISSUED: { bg: '#dbeafe', fg: '#1d4ed8' }, ADVISED: { bg: '#e0e7ff', fg: '#3730a3' },
      CONFIRMED: { bg: '#dcfce7', fg: '#166534' }, DRAWN_DOWN: { bg: '#fef3c7', fg: '#92400e' },
      SETTLED: { bg: '#f0fdf4', fg: '#065f46' }, EXPIRED: { bg: '#fef2f2', fg: '#991b1b' },
    };
    const c = m[s] || { bg: '#f3f4f6', fg: '#374151' };
    return { background: c.bg, color: c.fg };
  };

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Ship size={28} color="#7c3aed" />
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Cross-Border Trade Payments</h1>
        <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 8 }}>LCs, Escrow, Customs Duties, Trade Finance</span>
      </div>

      {lcSummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Total LCs', value: lcSummary.totalLCs, icon: FileText, color: '#7c3aed' },
            { label: 'Import LCs', value: lcSummary.importLCs, icon: Package, color: '#2563eb' },
            { label: 'Export LCs', value: lcSummary.exportLCs, icon: Ship, color: '#059669' },
            { label: 'Active', value: lcSummary.activeLCs, icon: Clock, color: '#f59e0b' },
            { label: 'Total Value', value: fmt(lcSummary.totalValueUSD), icon: Landmark, color: '#0891b2' },
            { label: 'Active Escrows', value: escrowsQuery.data?.totalActive ?? 0, icon: Lock, color: '#dc2626' },
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

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid #e5e7eb', paddingBottom: 8 }}>
        {(['lcs', 'escrows', 'customs'] as Tab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
              background: activeTab === tab ? '#7c3aed' : 'transparent', color: activeTab === tab ? 'white' : '#6b7280' }}>
            {tab === 'lcs' ? 'Letters of Credit' : tab === 'escrows' ? 'Escrow Payments' : 'Customs Duties'}
          </button>
        ))}
      </div>

      {activeTab === 'lcs' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <select value={lcTypeFilter} onChange={e => setLcTypeFilter(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}>
              <option value="">All Types</option>
              <option value="import">Import</option>
              <option value="export">Export</option>
            </select>
          </div>
          {lcs.map(lc => (
            <div key={lc.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{lc.lcNumber}</div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>{lc.type.toUpperCase()} · Form {lc.type === 'export' ? 'A' : 'M'}: {lc.formMRef}</div>
                </div>
                <span style={{ padding: '4px 12px', borderRadius: 9999, fontSize: 12, fontWeight: 600, ...lcStatusColor(lc.status) }}>{lc.status}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, fontSize: 13, marginBottom: 12 }}>
                <div><span style={{ color: '#9ca3af' }}>Applicant:</span> <strong>{lc.applicant}</strong><br/><span style={{ fontSize: 11, color: '#9ca3af' }}>{lc.applicantBank}</span></div>
                <div><span style={{ color: '#9ca3af' }}>Beneficiary:</span> <strong>{lc.beneficiary}</strong><br/><span style={{ fontSize: 11, color: '#9ca3af' }}>{lc.beneficiaryBank}, {lc.beneficiaryCountry}</span></div>
                <div><span style={{ color: '#9ca3af' }}>Amount:</span> <strong style={{ fontSize: 16 }}>{lc.currency} {lc.amount.toLocaleString()}</strong></div>
                <div><span style={{ color: '#9ca3af' }}>Goods:</span> <strong>{lc.goodsDescription}</strong></div>
                <div><span style={{ color: '#9ca3af' }}>Route:</span> <strong>{lc.shipmentPort} → {lc.destinationPort}</strong></div>
                <div><span style={{ color: '#9ca3af' }}>Expiry:</span> <strong>{new Date(lc.expiryDate).toLocaleDateString()}</strong></div>
              </div>
              {lc.documents.length > 0 && (
                <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Documents ({lc.documents.length}):</span>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    {lc.documents.map(d => (
                      <span key={d.id} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: d.status === 'verified' ? '#dcfce7' : '#fef3c7', color: d.status === 'verified' ? '#166534' : '#92400e' }}>
                        {d.type.replace(/_/g, ' ')} — {d.status}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'escrows' && (
        <div>
          {escrows.map(e => (
            <div key={e.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{e.buyerName} ↔ {e.sellerName}</div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>{e.id} · {e.currency} {e.totalAmount.toLocaleString()}</div>
                </div>
                <span style={{ padding: '4px 12px', borderRadius: 9999, fontSize: 12, fontWeight: 600, background: '#dcfce7', color: '#166534' }}>{e.status}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {e.milestones.map((m, i) => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 8, background: '#f9fafb' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: m.status === 'released' ? '#10b981' : m.status === 'buyer_approved' ? '#3b82f6' : '#d1d5db' }}>
                      {m.status === 'released' ? <CheckCircle size={14} color="white" /> : <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>{i + 1}</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{m.description}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>Due: {new Date(m.dueDate).toLocaleDateString()}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}>${m.amount.toLocaleString()}</div>
                    <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600,
                      background: m.status === 'released' ? '#dcfce7' : m.status === 'buyer_approved' ? '#dbeafe' : '#f3f4f6',
                      color: m.status === 'released' ? '#166534' : m.status === 'buyer_approved' ? '#1d4ed8' : '#6b7280' }}>{m.status}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'customs' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Assessment Ref', 'Importer', 'HS Code', 'Goods', 'Duty', 'VAT', 'Surcharge', 'Total', 'Port', 'Status'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {duties.map(d => (
              <tr key={d.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{d.assessmentRef}</td>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{d.importerName}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{d.hsCode}</td>
                <td style={{ padding: '10px 12px', fontSize: 12 }}>{d.goodsDesc}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{fmtNGN(d.dutyAmount)}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{fmtNGN(d.vatAmount)}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{fmtNGN(d.surchargeAmount)}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700 }}>{fmtNGN(d.totalAmount)}</td>
                <td style={{ padding: '10px 12px', fontSize: 12 }}>{d.portOfEntry}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600,
                    background: d.status === 'cleared' ? '#dcfce7' : d.status === 'paid' ? '#dbeafe' : '#fef3c7',
                    color: d.status === 'cleared' ? '#166534' : d.status === 'paid' ? '#1d4ed8' : '#92400e' }}>{d.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
