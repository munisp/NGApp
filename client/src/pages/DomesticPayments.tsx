import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Banknote, QrCode, FileText, Repeat, Users, ArrowRightLeft, CheckCircle, XCircle, Clock } from 'lucide-react';

type Tab = 'payments' | 'bills' | 'standing_orders' | 'bulk';

export default function DomesticPayments() {
  const [activeTab, setActiveTab] = useState<Tab>('payments');
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

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Banknote size={28} color="#2563eb" />
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Domestic Instant Payments</h1>
        <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 8 }}>P2P, P2B, QR, Bills, Bulk, Standing Orders</span>
      </div>

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Total Payments', value: summary.totalPayments, icon: ArrowRightLeft, color: '#3b82f6' },
            { label: 'Completed', value: summary.completed, icon: CheckCircle, color: '#10b981' },
            { label: 'Failed', value: summary.failed, icon: XCircle, color: '#ef4444' },
            { label: 'Pending', value: summary.pending, icon: Clock, color: '#f59e0b' },
            { label: 'P2P', value: summary.p2pCount, icon: Users, color: '#8b5cf6' },
            { label: 'P2B/QR', value: summary.p2bCount, icon: QrCode, color: '#059669' },
            { label: 'Bills', value: summary.billCount, icon: FileText, color: '#0891b2' },
            { label: 'Total Volume', value: fmt(summary.totalVolumeNGN), icon: Banknote, color: '#2563eb' },
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

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid #e5e7eb', paddingBottom: 8 }}>
        {(['payments', 'bills', 'standing_orders', 'bulk'] as Tab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
              background: activeTab === tab ? '#2563eb' : 'transparent', color: activeTab === tab ? 'white' : '#6b7280' }}>
            {tab === 'payments' ? 'Payments' : tab === 'bills' ? 'Bill Providers' : tab === 'standing_orders' ? 'Standing Orders' : 'Bulk Disbursements'}
          </button>
        ))}
      </div>

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
    </div>
  );
}
