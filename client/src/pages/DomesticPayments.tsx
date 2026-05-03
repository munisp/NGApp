import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Banknote, QrCode, FileText, Repeat, Users, ArrowRightLeft, CheckCircle, XCircle, Clock, BarChart3, TrendingUp, Activity, PieChart, LayoutDashboard, Globe, Ship, CreditCard, Landmark, Code, ArrowDownLeft, Package } from 'lucide-react';

type Tab = 'dashboard' | 'payments' | 'bills' | 'standing_orders' | 'bulk';

const moduleLinks = [
  { label: 'Outbound Remittance', href: '/', icon: Globe, color: '#3b82f6' },
  { label: 'Inbound Remittance', href: '/inbound-remittance', icon: ArrowDownLeft, color: '#059669' },
  { label: 'Trade Payments', href: '/trade-payments', icon: Ship, color: '#7c3aed' },
  { label: 'Card Processing', href: '/card-processing', icon: CreditCard, color: '#dc2626' },
  { label: 'Government Payments', href: '/government-payments', icon: Landmark, color: '#0369a1' },
  { label: 'Open Banking', href: '/open-banking', icon: Code, color: '#0ea5e9' },
];

export default function DomesticPayments() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [typeFilter, setTypeFilter] = useState('');

  const paymentsQuery = trpc.domesticPayments.listPayments.useQuery({ type: typeFilter || undefined }, { retry: false });
  const billsQuery = trpc.domesticPayments.listBillProviders.useQuery(undefined, { retry: false });
  const ordersQuery = trpc.domesticPayments.listStandingOrders.useQuery(undefined, { retry: false });
  const bulkQuery = trpc.domesticPayments.listBulkDisbursements.useQuery(undefined, { retry: false });

  const payments = paymentsQuery.data?.payments ?? [];
  const summary = paymentsQuery.data?.summary;
  const providers = billsQuery.data?.providers ?? [];
  const orders = ordersQuery.data?.orders ?? [];
  const bulks = bulkQuery.data?.disbursements ?? [];

  const fmt = (n: number) => n >= 1e9 ? `₦${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `₦${(n / 1e6).toFixed(1)}M` : `₦${n.toLocaleString()}`;

  const typeBadge = (t: string) => {
    const colors: Record<string, { bg: string; fg: string }> = {
      P2P: { bg: '#dbeafe', fg: '#1d4ed8' }, P2B: { bg: '#dcfce7', fg: '#166534' },
      QR_PAY: { bg: '#fef3c7', fg: '#92400e' }, BILL_PAYMENT: { bg: '#e0e7ff', fg: '#3730a3' },
      REQUEST_TO_PAY: { bg: '#fce7f3', fg: '#9d174d' }, USSD: { bg: '#f3e8ff', fg: '#6b21a8' },
      BULK_DISBURSEMENT: { bg: '#ccfbf1', fg: '#065f46' }, STANDING_ORDER: { bg: '#fef2f2', fg: '#991b1b' },
    };
    const c = colors[t] || { bg: '#f3f4f6', fg: '#374151' };
    return { background: c.bg, color: c.fg, padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600 as const };
  };

  const navItems: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'payments', label: 'Payments', icon: ArrowRightLeft },
    { id: 'bills', label: 'Bill Providers', icon: FileText },
    { id: 'standing_orders', label: 'Standing Orders', icon: Repeat },
    { id: 'bulk', label: 'Bulk Disbursements', icon: Package },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <aside style={{ width: 250, borderRight: '1px solid #e5e7eb', background: '#fafafa', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Banknote size={22} color="#2563eb" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Domestic Payments</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Payment Switch Module</div>
            </div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, width: '100%', textAlign: 'left',
                background: activeTab === item.id ? '#2563eb' : 'transparent', color: activeTab === item.id ? 'white' : '#374151' }}>
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
          <span style={{ fontSize: 13, color: '#6b7280' }}>P2P, P2B, QR, Bills, Bulk, Standing Orders</span>
        </div>

        {summary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'Total', value: summary.totalPayments, icon: ArrowRightLeft, color: '#3b82f6' },
              { label: 'Completed', value: summary.completed, icon: CheckCircle, color: '#10b981' },
              { label: 'Failed', value: summary.failed, icon: XCircle, color: '#ef4444' },
              { label: 'Pending', value: summary.pending, icon: Clock, color: '#f59e0b' },
              { label: 'Volume', value: fmt(summary.totalVolumeNGN), icon: Banknote, color: '#2563eb' },
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
        )}

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && summary && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 24 }}>
            <div style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)', borderRadius: 16, padding: 24, color: 'white' }}>
              <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>Total Transaction Volume</div>
              <div style={{ fontSize: 32, fontWeight: 800 }}>{fmt(summary.totalVolumeNGN)}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}><TrendingUp size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {summary.totalPayments} transactions today</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #059669, #10b981)', borderRadius: 16, padding: 24, color: 'white' }}>
              <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>Success Rate</div>
              <div style={{ fontSize: 32, fontWeight: 800 }}>{summary.totalPayments > 0 ? ((summary.completed / summary.totalPayments) * 100).toFixed(1) : 0}%</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{summary.completed} completed, {summary.failed} failed</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', borderRadius: 16, padding: 24, color: 'white' }}>
              <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>Active Services</div>
              <div style={{ fontSize: 32, fontWeight: 800 }}>{providers.length}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Bill providers + {orders.length} standing orders</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><PieChart size={18} color="#2563eb" /> Payment Type Distribution</h3>
              {['P2P', 'P2B', 'QR_PAY', 'BILL_PAYMENT', 'REQUEST_TO_PAY', 'USSD'].map((type, i) => {
                const count = payments.filter(p => p.type === type).length;
                const vol = payments.filter(p => p.type === type).reduce((s, p) => s + p.amount, 0);
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, padding: '8px 12px', background: '#f9fafb', borderRadius: 8 }}>
                    <span style={{ ...typeBadge(type), minWidth: 90, textAlign: 'center' as const }}>{type.replace(/_/g, ' ')}</span>
                    <span style={{ fontSize: 13, flex: 1 }}>{count} payments</span>
                    <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>{fmt(vol)}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={18} color="#059669" /> Payment Pipeline</h3>
              {[
                { label: 'Completed', value: summary.completed, total: summary.totalPayments, color: '#10b981' },
                { label: 'Pending', value: summary.pending, total: summary.totalPayments, color: '#f59e0b' },
                { label: 'Failed', value: summary.failed, total: summary.totalPayments, color: '#ef4444' },
              ].map((item, i) => (
                <div key={i} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span>{item.label}</span>
                    <span style={{ fontWeight: 600 }}>{item.value} ({item.total > 0 ? ((item.value / item.total) * 100).toFixed(0) : 0}%)</span>
                  </div>
                  <div style={{ height: 10, background: '#f3f4f6', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${item.total > 0 ? (item.value / item.total) * 100 : 0}%`, background: item.color, borderRadius: 5 }} />
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 20, padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>Avg Transaction</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#059669' }}>{summary.totalPayments > 0 ? fmt(summary.totalVolumeNGN / summary.totalPayments) : '₦0'}</div>
              </div>
            </div>
          </div>

          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={18} color="#0891b2" /> Bill Provider Coverage</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
              {providers.map((p, i) => (
                <div key={i} style={{ padding: 12, background: '#f9fafb', borderRadius: 8, borderLeft: `4px solid ${p.status === 'active' ? '#10b981' : '#f59e0b'}` }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{p.category}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{p.services?.length || 0} services</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}>
              <option value="">All Types</option>
              {['P2P', 'P2B', 'QR_PAY', 'BILL_PAYMENT', 'REQUEST_TO_PAY', 'USSD'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['ID', 'Type', 'Channel', 'Sender', 'Receiver', 'Amount', 'Fee', 'Status', 'Narration', 'Time'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{p.id}</td>
                    <td style={{ padding: '10px 12px' }}><span style={typeBadge(p.type)}>{p.type}</span></td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>{p.channel}</td>
                    <td style={{ padding: '10px 12px' }}>{p.senderName}<br/><span style={{ fontSize: 11, color: '#9ca3af' }}>{p.senderBank}</span></td>
                    <td style={{ padding: '10px 12px' }}>{p.receiverName}<br/><span style={{ fontSize: 11, color: '#9ca3af' }}>{p.receiverBank}</span></td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(p.amount)}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>₦{p.fee.toLocaleString()}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600,
                        background: p.status === 'COMPLETED' ? '#dcfce7' : p.status === 'FAILED' ? '#fef2f2' : '#fef3c7',
                        color: p.status === 'COMPLETED' ? '#166534' : p.status === 'FAILED' ? '#991b1b' : '#92400e' }}>{p.status}</span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.narration}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>{new Date(p.initiatedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'bills' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {providers.map(p => (
            <div key={p.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{p.name}</span>
                <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: p.isActive ? '#dcfce7' : '#fef2f2', color: p.isActive ? '#166534' : '#991b1b' }}>
                  {p.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Category: <strong>{p.category.replace(/_/g, ' ')}</strong></div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Avg Response: <strong>{p.avgProcessMs}ms</strong></div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {p.services.map(s => (
                  <span key={s} style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, background: '#f3f4f6', color: '#374151' }}>{s}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'standing_orders' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['ID', 'Payer', 'Payee', 'Amount', 'Frequency', 'Next Execution', 'Executions', 'Status'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{o.id}</td>
                <td style={{ padding: '10px 12px' }}>{o.payerBank}<br/><span style={{ fontSize: 11, color: '#9ca3af' }}>{o.payerAcct}</span></td>
                <td style={{ padding: '10px 12px' }}>{o.payeeName}<br/><span style={{ fontSize: 11, color: '#9ca3af' }}>{o.payeeBank}</span></td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(o.amount)}</td>
                <td style={{ padding: '10px 12px' }}>{o.frequency}</td>
                <td style={{ padding: '10px 12px', fontSize: 12 }}>{new Date(o.nextExecDate).toLocaleDateString()}</td>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{o.executions}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: '#dcfce7', color: '#166534' }}>{o.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {activeTab === 'bulk' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['ID', 'Initiator', 'Total Items', 'Processed', 'Success', 'Failed', 'Total Amount', 'Status', 'Submitted'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bulks.map(b => (
              <tr key={b.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{b.id}</td>
                <td style={{ padding: '10px 12px' }}>{b.initiatorName}</td>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{b.totalItems.toLocaleString()}</td>
                <td style={{ padding: '10px 12px' }}>{b.processedItems.toLocaleString()}</td>
                <td style={{ padding: '10px 12px', color: '#10b981', fontWeight: 600 }}>{b.successCount.toLocaleString()}</td>
                <td style={{ padding: '10px 12px', color: '#ef4444', fontWeight: 600 }}>{b.failedCount.toLocaleString()}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(b.totalAmount)}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600,
                    background: b.status === 'completed' ? '#dcfce7' : '#fef3c7', color: b.status === 'completed' ? '#166534' : '#92400e' }}>{b.status}</span>
                </td>
                <td style={{ padding: '10px 12px', fontSize: 11, color: '#6b7280' }}>{new Date(b.submittedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      </main>
    </div>
  );
}
