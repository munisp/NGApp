import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { CreditCard, ShieldCheck, AlertTriangle, Store, CheckCircle, XCircle, BarChart3, Smartphone, TrendingUp, Activity, PieChart, LayoutDashboard, Globe, ArrowDownLeft, Banknote, Ship, Landmark, Code, ArrowRightLeft } from 'lucide-react';

type Tab = 'dashboard' | 'cards' | 'transactions' | 'chargebacks' | 'terminals';

const moduleLinks = [
  { label: 'Outbound Remittance', href: '/', icon: Globe, color: '#3b82f6' },
  { label: 'Inbound Remittance', href: '/inbound-remittance', icon: ArrowDownLeft, color: '#059669' },
  { label: 'Domestic Payments', href: '/domestic-payments', icon: Banknote, color: '#2563eb' },
  { label: 'Trade Payments', href: '/trade-payments', icon: Ship, color: '#7c3aed' },
  { label: 'Government Payments', href: '/government-payments', icon: Landmark, color: '#0369a1' },
  { label: 'Open Banking', href: '/open-banking', icon: Code, color: '#0ea5e9' },
];

export default function CardProcessing() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const cardsQuery = trpc.cardProcessing.listCards.useQuery(undefined, { retry: false });
  const txnsQuery = trpc.cardProcessing.listTransactions.useQuery(undefined, { retry: false });
  const cbQuery = trpc.cardProcessing.listChargebacks.useQuery(undefined, { retry: false });
  const termQuery = trpc.cardProcessing.listTerminals.useQuery(undefined, { retry: false });

  const cards = cardsQuery.data?.cards ?? [];
  const cardSummary = cardsQuery.data?.summary;
  const txns = txnsQuery.data?.transactions ?? [];
  const txnSummary = txnsQuery.data?.summary;
  const chargebacks = cbQuery.data?.chargebacks ?? [];
  const terminals = termQuery.data?.terminals ?? [];

  const fmt = (n: number) => n >= 1e9 ? `₦${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `₦${(n / 1e6).toFixed(1)}M` : `₦${n.toLocaleString()}`;

  const schemeLogo = (s: string) => {
    const colors: Record<string, { bg: string; fg: string }> = {
      VISA: { bg: '#1a1f71', fg: 'white' }, MASTERCARD: { bg: '#eb001b', fg: 'white' }, VERVE: { bg: '#00425f', fg: 'white' },
    };
    const c = colors[s] || { bg: '#6b7280', fg: 'white' };
    return { background: c.bg, color: c.fg, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 as const };
  };

  const navItems: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', icon: ArrowRightLeft },
    { id: 'cards', label: 'Issued Cards', icon: CreditCard },
    { id: 'chargebacks', label: 'Chargebacks', icon: AlertTriangle },
    { id: 'terminals', label: 'Terminals', icon: Smartphone },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <aside style={{ width: 250, borderRight: '1px solid #e5e7eb', background: '#fafafa', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CreditCard size={22} color="#dc2626" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Card Processing</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Payment Switch Module</div>
            </div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, width: '100%', textAlign: 'left',
                background: activeTab === item.id ? '#dc2626' : 'transparent', color: activeTab === item.id ? 'white' : '#374151' }}>
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
          <span style={{ fontSize: 13, color: '#6b7280' }}>Issuing, Acquiring, 3DS, Chargebacks, Tokenization</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Cards', value: cardSummary?.totalCards ?? 0, icon: CreditCard, color: '#dc2626' },
            { label: 'Active', value: cardSummary?.activeCards ?? 0, icon: CheckCircle, color: '#10b981' },
            { label: 'Txns', value: txnSummary?.totalTxns ?? 0, icon: BarChart3, color: '#3b82f6' },
            { label: 'Approval', value: `${txnSummary?.approvalRate ?? 0}%`, icon: ShieldCheck, color: '#0891b2' },
            { label: 'Volume', value: fmt(Number(txnSummary?.totalVolumeNGN ?? 0)), icon: Store, color: '#7c3aed' },
          ].map((c, i) => (
            <div key={i} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <c.icon size={16} color={c.color} />
                <span style={{ fontSize: 11, color: '#6b7280' }}>{c.label}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 24 }}>
            <div style={{ background: 'linear-gradient(135deg, #dc2626, #ef4444)', borderRadius: 16, padding: 24, color: 'white' }}>
              <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>Total Card Volume</div>
              <div style={{ fontSize: 32, fontWeight: 800 }}>{fmt(Number(txnSummary?.totalVolumeNGN ?? 0))}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}><TrendingUp size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {txnSummary?.totalTxns ?? 0} transactions</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #059669, #10b981)', borderRadius: 16, padding: 24, color: 'white' }}>
              <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>Approval Rate</div>
              <div style={{ fontSize: 32, fontWeight: 800 }}>{txnSummary?.approvalRate ?? 0}%</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{txnSummary?.approved ?? 0} approved, {txnSummary?.declined ?? 0} declined</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #1a1f71, #3b4ebe)', borderRadius: 16, padding: 24, color: 'white' }}>
              <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>Active Cards</div>
              <div style={{ fontSize: 32, fontWeight: 800 }}>{cardSummary?.activeCards ?? 0}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>of {cardSummary?.totalCards ?? 0} total issued</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><PieChart size={18} color="#dc2626" /> Scheme Distribution</h3>
              {['VISA', 'MASTERCARD', 'VERVE'].map((scheme, i) => {
                const count = txns.filter(t => t.cardScheme === scheme).length;
                const vol = txns.filter(t => t.cardScheme === scheme).reduce((s, t) => s + t.amount, 0);
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, padding: '10px 12px', background: '#f9fafb', borderRadius: 8 }}>
                    <span style={{ ...schemeLogo(scheme), minWidth: 85, textAlign: 'center' as const }}>{scheme}</span>
                    <span style={{ fontSize: 13, flex: 1 }}>{count} txns</span>
                    <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>{fmt(vol)}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={18} color="#059669" /> Transaction Performance</h3>
              {[
                { label: 'Approved', value: txnSummary?.approved ?? 0, total: txnSummary?.totalTxns ?? 1, color: '#10b981' },
                { label: 'Declined', value: txnSummary?.declined ?? 0, total: txnSummary?.totalTxns ?? 1, color: '#ef4444' },
              ].map((item, i) => (
                <div key={i} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span>{item.label}</span>
                    <span style={{ fontWeight: 600 }}>{item.value} ({((item.value / item.total) * 100).toFixed(0)}%)</span>
                  </div>
                  <div style={{ height: 10, background: '#f3f4f6', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(item.value / item.total) * 100}%`, background: item.color, borderRadius: 5 }} />
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 16, padding: 16, background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
                <div style={{ fontSize: 12, color: '#991b1b', fontWeight: 600 }}>Active Chargebacks</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626' }}>{cbQuery.data?.totalActive ?? 0}</div>
                <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 2 }}>of {chargebacks.length} total disputes</div>
              </div>
            </div>
          </div>

          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Smartphone size={18} color="#7c3aed" /> Terminal Network</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {terminals.map((t, i) => (
                <div key={i} style={{ padding: 14, background: '#f9fafb', borderRadius: 8, borderLeft: `4px solid ${t.status === 'ACTIVE' ? '#10b981' : '#f59e0b'}` }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{t.terminalId}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{t.merchantName}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{t.type} · {t.location}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['ID', 'Type', 'Scheme', 'Card', 'Channel', 'Merchant', 'Amount', 'Fee', '3DS', 'Risk', 'Status', 'Time'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {txns.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{t.id}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, background: '#f3f4f6', fontWeight: 600 }}>{t.type}</span>
                  </td>
                  <td style={{ padding: '10px 12px' }}><span style={schemeLogo(t.scheme)}>{t.scheme}</span></td>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>****{t.cardLast4}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11,
                      background: t.channel === 'POS' ? '#dbeafe' : t.channel === 'WEB' ? '#e0e7ff' : t.channel === 'ATM' ? '#fef3c7' : '#f3f4f6',
                      color: t.channel === 'POS' ? '#1d4ed8' : t.channel === 'WEB' ? '#3730a3' : t.channel === 'ATM' ? '#92400e' : '#374151' }}>{t.channel}</span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>{t.merchantName}<br/><span style={{ fontSize: 11, color: '#9ca3af' }}>{t.merchantCategory}</span></td>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(t.amount)}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>₦{t.feeAmount.toLocaleString()}</td>
                  <td style={{ padding: '10px 12px' }}>
                    {t.is3DSVerified ? <ShieldCheck size={16} color="#10b981" /> : <span style={{ color: '#d1d5db' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontWeight: 600, color: t.riskScore > 70 ? '#ef4444' : t.riskScore > 40 ? '#f59e0b' : '#10b981' }}>{t.riskScore}</span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600,
                      background: t.status === 'approved' ? '#dcfce7' : '#fef2f2', color: t.status === 'approved' ? '#166534' : '#991b1b' }}>
                      {t.status}{t.declineReason ? ` (${t.declineReason})` : ''}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>{new Date(t.processedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'cards' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {cards.map(c => (
            <div key={c.id} style={{ background: c.scheme === 'VISA' ? 'linear-gradient(135deg, #1a1f71, #2d3494)' : c.scheme === 'MASTERCARD' ? 'linear-gradient(135deg, #eb001b, #f79e1b)' : 'linear-gradient(135deg, #00425f, #0078a0)',
              borderRadius: 16, padding: 20, color: 'white', minHeight: 180, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 700, opacity: 0.9 }}>{c.scheme}</span>
                <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: c.status === 'active' ? 'rgba(255,255,255,0.2)' : 'rgba(255,0,0,0.3)' }}>{c.status}</span>
              </div>
              <div>
                <div style={{ fontSize: 20, fontFamily: 'monospace', letterSpacing: 2, marginBottom: 8 }}>•••• •••• •••• {c.last4}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: 0.8 }}>
                  <div>{c.holderName}</div>
                  <div>{String(c.expiryMonth).padStart(2, '0')}/{c.expiryYear}</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.7 }}>
                <span>{c.type} · {c.issuerBankName}</span>
                <span>{c.is3DSEnrolled ? '3DS Enrolled' : 'No 3DS'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'chargebacks' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['ID', 'Transaction', 'Cardholder', 'Merchant', 'Amount', 'Reason', 'Status', 'Filed', 'Due Date'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chargebacks.map(cb => (
              <tr key={cb.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{cb.id}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{cb.transactionId}</td>
                <td style={{ padding: '10px 12px' }}>{cb.cardholderName}</td>
                <td style={{ padding: '10px 12px' }}>{cb.merchantName}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(cb.disputeAmount)}</td>
                <td style={{ padding: '10px 12px' }}><span style={{ fontSize: 11 }}>[{cb.reasonCode}] {cb.reasonDesc}</span></td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: '#fef3c7', color: '#92400e' }}>{cb.status}</span>
                </td>
                <td style={{ padding: '10px 12px', fontSize: 11 }}>{new Date(cb.filedAt).toLocaleDateString()}</td>
                <td style={{ padding: '10px 12px', fontSize: 11 }}>{new Date(cb.dueDate).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {activeTab === 'terminals' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Terminal ID', 'Merchant', 'MCC', 'Type', 'Location', 'Acquirer', 'Daily Volume', 'Status'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {terminals.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{t.terminalId}</td>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{t.merchantName}</td>
                <td style={{ padding: '10px 12px' }}><span style={{ fontSize: 11 }}>{t.mcc} · {t.mccDescription}</span></td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                    background: t.type === 'POS' ? '#dbeafe' : t.type === 'WEB' ? '#e0e7ff' : '#fef3c7',
                    color: t.type === 'POS' ? '#1d4ed8' : t.type === 'WEB' ? '#3730a3' : '#92400e' }}>{t.type}</span>
                </td>
                <td style={{ padding: '10px 12px', fontSize: 12 }}>{t.location}</td>
                <td style={{ padding: '10px 12px' }}>{t.acquirerBank}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(t.dailyVolume)}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: '#dcfce7', color: '#166534' }}>{t.status}</span>
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
