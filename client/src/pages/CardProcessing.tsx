import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { CreditCard, ShieldCheck, AlertTriangle, Store, CheckCircle, XCircle, BarChart3, Smartphone } from 'lucide-react';

type Tab = 'cards' | 'transactions' | 'chargebacks' | 'terminals';

export default function CardProcessing() {
  const [activeTab, setActiveTab] = useState<Tab>('transactions');

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

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <CreditCard size={28} color="#dc2626" />
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Card Payment Processing</h1>
        <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 8 }}>Issuing, Acquiring, 3DS, Chargebacks, Tokenization</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Cards', value: cardSummary?.totalCards ?? 0, icon: CreditCard, color: '#dc2626' },
          { label: 'Active Cards', value: cardSummary?.activeCards ?? 0, icon: CheckCircle, color: '#10b981' },
          { label: 'Total Txns', value: txnSummary?.totalTxns ?? 0, icon: BarChart3, color: '#3b82f6' },
          { label: 'Approved', value: txnSummary?.approved ?? 0, icon: CheckCircle, color: '#059669' },
          { label: 'Declined', value: txnSummary?.declined ?? 0, icon: XCircle, color: '#ef4444' },
          { label: 'Approval Rate', value: `${txnSummary?.approvalRate ?? 0}%`, icon: ShieldCheck, color: '#0891b2' },
          { label: 'Volume', value: fmt(Number(txnSummary?.totalVolumeNGN ?? 0)), icon: Store, color: '#7c3aed' },
          { label: 'Chargebacks', value: cbQuery.data?.totalActive ?? 0, icon: AlertTriangle, color: '#f59e0b' },
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

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid #e5e7eb', paddingBottom: 8 }}>
        {(['transactions', 'cards', 'chargebacks', 'terminals'] as Tab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
              background: activeTab === tab ? '#dc2626' : 'transparent', color: activeTab === tab ? 'white' : '#6b7280' }}>
            {tab === 'transactions' ? 'Transactions' : tab === 'cards' ? 'Issued Cards' : tab === 'chargebacks' ? 'Chargebacks' : 'Terminals'}
          </button>
        ))}
      </div>

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
    </div>
  );
}
