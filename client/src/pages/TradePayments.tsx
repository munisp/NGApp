import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Ship, FileText, Lock, Landmark, Package, CheckCircle, Clock, AlertCircle, BarChart3, TrendingUp, Activity, Globe, LayoutDashboard, CreditCard, Banknote, Code, ArrowDownLeft, ArrowRightLeft } from 'lucide-react';

type Tab = 'dashboard' | 'lcs' | 'escrows' | 'customs';

const moduleLinks = [
  { label: 'Outbound Remittance', href: '/', icon: Globe, color: '#3b82f6' },
  { label: 'Inbound Remittance', href: '/inbound-remittance', icon: ArrowDownLeft, color: '#059669' },
  { label: 'Domestic Payments', href: '/domestic-payments', icon: Banknote, color: '#2563eb' },
  { label: 'Card Processing', href: '/card-processing', icon: CreditCard, color: '#dc2626' },
  { label: 'Government Payments', href: '/government-payments', icon: Landmark, color: '#0369a1' },
  { label: 'Open Banking', href: '/open-banking', icon: Code, color: '#0ea5e9' },
];

export default function TradePayments() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [lcTypeFilter, setLcTypeFilter] = useState('');

  const lcsQuery = trpc.tradePayments.listLCs.useQuery({ type: lcTypeFilter || undefined }, { retry: false });
  const escrowsQuery = trpc.tradePayments.listEscrows.useQuery(undefined, { retry: false });
  const dutiesQuery = trpc.tradePayments.listCustomsDuties.useQuery(undefined, { retry: false });

  const lcs = lcsQuery.data?.lcs ?? [];
  const lcSummary = lcsQuery.data?.summary;
  const escrows = escrowsQuery.data?.escrows ?? [];
  const duties = dutiesQuery.data?.duties ?? [];

  const fmt = (n: number | undefined | null) => { const v = n ?? 0; return v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${v.toLocaleString()}`; };
  const fmtNGN = (n: number | undefined | null) => { const v = n ?? 0; return v >= 1e9 ? `₦${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `₦${(v / 1e6).toFixed(1)}M` : `₦${v.toLocaleString()}`; };

  const lcStatusColor = (s: string) => {
    const m: Record<string, { bg: string; fg: string }> = {
      ISSUED: { bg: '#dbeafe', fg: '#1d4ed8' }, ADVISED: { bg: '#e0e7ff', fg: '#3730a3' },
      CONFIRMED: { bg: '#dcfce7', fg: '#166534' }, DRAWN_DOWN: { bg: '#fef3c7', fg: '#92400e' },
      SETTLED: { bg: '#f0fdf4', fg: '#065f46' }, EXPIRED: { bg: '#fef2f2', fg: '#991b1b' },
    };
    const c = m[s] || { bg: '#f3f4f6', fg: '#374151' };
    return { background: c.bg, color: c.fg };
  };

  const navItems: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'lcs', label: 'Letters of Credit', icon: FileText },
    { id: 'escrows', label: 'Escrow Payments', icon: Lock },
    { id: 'customs', label: 'Customs Duties', icon: Package },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <aside style={{ width: 250, borderRight: '1px solid #e5e7eb', background: '#fafafa', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Ship size={22} color="#7c3aed" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Trade Payments</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Payment Switch Module</div>
            </div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, width: '100%', textAlign: 'left',
                background: activeTab === item.id ? '#7c3aed' : 'transparent', color: activeTab === item.id ? 'white' : '#374151' }}>
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </nav>
        <div style={{ borderTop: '1px solid #e5e7eb', padding: '8px 8px 12px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, padding: '4px 14px 6px' }}>Other Modules</div>
          {moduleLinks.map(m => (
            <a key={m.href} href={m.href} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 6, fontSize: 12, color: m.color, textDecoration: 'none' }}>
              <m.icon size={14} />
              {m.label}
            </a>
          ))}
        </div>
      </aside>

      <main style={{ flex: 1, padding: 24, overflowY: 'auto', maxWidth: 1200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{navItems.find(n => n.id === activeTab)?.label ?? 'Dashboard'}</h1>
          <span style={{ fontSize: 13, color: '#6b7280' }}>LCs, Escrow, Customs Duties, Trade Finance</span>
        </div>

        {lcSummary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Total LCs', value: lcSummary.totalLCs, icon: FileText, color: '#7c3aed' },
              { label: 'Import LCs', value: lcSummary.importLCs, icon: Package, color: '#2563eb' },
              { label: 'Export LCs', value: lcSummary.exportLCs, icon: Ship, color: '#059669' },
              { label: 'Active', value: lcSummary.activeLCs, icon: Clock, color: '#f59e0b' },
              { label: 'Total Value', value: fmt(lcSummary.totalValueUSD), icon: Landmark, color: '#0891b2' },
              { label: 'Escrows', value: escrowsQuery.data?.totalActive ?? 0, icon: Lock, color: '#dc2626' },
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
      {activeTab === 'dashboard' && lcSummary && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 24 }}>
            <div style={{ background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', borderRadius: 16, padding: 24, color: 'white' }}>
              <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>Total Trade Value</div>
              <div style={{ fontSize: 32, fontWeight: 800 }}>{fmt(lcSummary.totalValueUSD)}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}><TrendingUp size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {lcSummary.totalLCs} letters of credit</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)', borderRadius: 16, padding: 24, color: 'white' }}>
              <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>Import / Export Ratio</div>
              <div style={{ fontSize: 32, fontWeight: 800 }}>{lcSummary.importLCs} / {lcSummary.exportLCs}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{lcSummary.activeLCs} currently active</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #dc2626, #ef4444)', borderRadius: 16, padding: 24, color: 'white' }}>
              <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>Active Escrows</div>
              <div style={{ fontSize: 32, fontWeight: 800 }}>{escrowsQuery.data?.totalActive ?? 0}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{escrows.length} total escrow accounts</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><BarChart3 size={18} color="#7c3aed" /> LC Status Pipeline</h3>
              {['ISSUED', 'ADVISED', 'CONFIRMED', 'DRAWN_DOWN', 'SETTLED', 'EXPIRED'].map((status, i) => {
                const count = lcs.filter(l => l.status === status).length;
                return (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>{status.replace(/_/g, ' ')}</span>
                      <span style={{ fontWeight: 600 }}>{count}</span>
                    </div>
                    <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${lcs.length > 0 ? (count / lcs.length) * 100 : 0}%`, background: lcSummary ? '#7c3aed' : '#6b7280', borderRadius: 4 }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Globe size={18} color="#2563eb" /> Customs Duties Overview</h3>
              {duties.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, padding: '10px 12px', background: '#f9fafb', borderRadius: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{d.declarationRef}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{d.importerName} · {d.hsCode}</div>
                  </div>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 14 }}>{fmtNGN(d.dutyAmountNGN)}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 600, background: d.paymentStatus === 'PAID' ? '#dcfce7' : '#fef3c7', color: d.paymentStatus === 'PAID' ? '#166534' : '#92400e' }}>{d.paymentStatus}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={18} color="#059669" /> Recent Escrow Activity</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
              {escrows.slice(0, 4).map((e, i) => (
                <div key={i} style={{ padding: 14, background: '#f9fafb', borderRadius: 8, borderLeft: `4px solid ${e.status === 'ACTIVE' ? '#10b981' : e.status === 'RELEASED' ? '#2563eb' : '#f59e0b'}` }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{e.escrowRef}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{e.buyerName} → {e.sellerName}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#7c3aed', marginTop: 8 }}>{fmt(e.amountUSD)}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{e.milestonesCompleted}/{e.totalMilestones} milestones</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
      </main>
    </div>
  );
}
