import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Banknote, QrCode, FileText, Repeat, Users, ArrowRightLeft, CheckCircle, XCircle, Clock, BarChart3, TrendingUp, Activity, PieChart, LayoutDashboard, Globe, Ship, CreditCard, Landmark, Code, ArrowDownLeft, Package, RefreshCw, AlertTriangle, ShieldCheck, Search, Layers, Building2, BookOpen, UserCheck, Hash, RotateCcw, Scale, Store, Receipt, FileCode, ScanLine, FileCheck, Fingerprint, Shield, UserPlus } from 'lucide-react';

type Tab = 'dashboard' | 'payments' | 'bills' | 'standing_orders' | 'bulk'
  | 'neft' | 'cheques' | 'mandates' | 'reversals' | 'disputes'
  | 'merchants' | 'paydirect' | 'identity' | 'iso20022'
  | 'nqr' | 'emandate' | 'fraud' | 'onboarding';

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

  // NIBSS Gap Queries
  const neftQuery = trpc.domesticPayments.listNeftBatches.useQuery(undefined, { retry: false });
  const chequesQuery = trpc.domesticPayments.listCheques.useQuery(undefined, { retry: false });
  const mandatesQuery = trpc.domesticPayments.listMandates.useQuery(undefined, { retry: false });
  const reversalsQuery = trpc.domesticPayments.listReversals.useQuery(undefined, { retry: false });
  const disputesQuery = trpc.domesticPayments.listDisputes.useQuery(undefined, { retry: false });
  const merchantsQuery = trpc.domesticPayments.listMerchants.useQuery(undefined, { retry: false });
  const paydirectQuery = trpc.domesticPayments.listPayDirectCollections.useQuery(undefined, { retry: false });
  const iso20022Query = trpc.domesticPayments.listIso20022Messages.useQuery(undefined, { retry: false });

  // Remaining 5% + Onboarding Queries
  const nqrQuery = trpc.domesticPayments.listNqrCodes.useQuery(undefined, { retry: false });
  const emandateQuery = trpc.domesticPayments.listEmandates.useQuery(undefined, { retry: false });
  const fraudQuery = trpc.domesticPayments.listFraudAlerts.useQuery(undefined, { retry: false });
  const banksQuery = trpc.domesticPayments.listOnboardedBanks.useQuery(undefined, { retry: false });
  const billersQuery = trpc.domesticPayments.listOnboardedBillers.useQuery(undefined, { retry: false });
  const dfspsQuery = trpc.domesticPayments.listOnboardedDfsps.useQuery(undefined, { retry: false });

  const payments = paymentsQuery.data?.payments ?? [];
  const summary = paymentsQuery.data?.summary;
  const providers = billsQuery.data?.providers ?? [];
  const orders = ordersQuery.data?.orders ?? [];
  const bulks = bulkQuery.data?.disbursements ?? [];

  const neftBatches = neftQuery.data?.batches ?? [];
  const neftSummary = neftQuery.data?.summary;
  const cheques = chequesQuery.data?.cheques ?? [];
  const chequeSummary = chequesQuery.data?.summary;
  const mandates = mandatesQuery.data?.mandates ?? [];
  const mandateSummary = mandatesQuery.data?.summary;
  const reversals = reversalsQuery.data?.reversals ?? [];
  const reversalSummary = reversalsQuery.data?.summary;
  const disputes = disputesQuery.data?.disputes ?? [];
  const disputeSummary = disputesQuery.data?.summary;
  const merchants = merchantsQuery.data?.merchants ?? [];
  const merchantSummary = merchantsQuery.data?.summary;
  const pdCollections = paydirectQuery.data?.collections ?? [];
  const pdSummary = paydirectQuery.data?.summary;
  const isoMessages = iso20022Query.data?.messages ?? [];
  const isoSummary = iso20022Query.data?.summary;

  const nqrCodes = nqrQuery.data?.codes ?? [];
  const nqrSummary = nqrQuery.data?.summary;
  const emandates = emandateQuery.data?.emandates ?? [];
  const emandateSummary = emandateQuery.data?.summary;
  const fraudAlerts = fraudQuery.data?.alerts ?? [];
  const fraudSummary = fraudQuery.data?.summary;
  const onboardedBanks = banksQuery.data?.banks ?? [];
  const banksSummary = banksQuery.data?.summary;
  const onboardedBillers = billersQuery.data?.billers ?? [];
  const billersSummary = billersQuery.data?.summary;
  const onboardedDfsps = dfspsQuery.data?.dfsps ?? [];
  const dfspsSummary = dfspsQuery.data?.summary;

  const fmt = (n: number) => n >= 1e9 ? `₦${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `₦${(n / 1e6).toFixed(1)}M` : `₦${n.toLocaleString()}`;

  const typeBadge = (t: string) => {
    const colors: Record<string, { bg: string; fg: string }> = {
      P2P: { bg: '#dbeafe', fg: '#1d4ed8' }, P2B: { bg: '#dcfce7', fg: '#166534' },
      QR_PAY: { bg: '#fef3c7', fg: '#92400e' }, BILL_PAYMENT: { bg: '#e0e7ff', fg: '#3730a3' },
      REQUEST_TO_PAY: { bg: '#fce7f3', fg: '#9d174d' }, USSD: { bg: '#f3e8ff', fg: '#6b21a8' },
    };
    const c = colors[t] || { bg: '#f3f4f6', fg: '#374151' };
    return { background: c.bg, color: c.fg, padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600 as const };
  };

  const statusBadge = (s: string) => {
    const m: Record<string, { bg: string; fg: string }> = {
      SETTLED: { bg: '#dcfce7', fg: '#166534' }, CLEARED: { bg: '#dcfce7', fg: '#166534' },
      COMPLETED: { bg: '#dcfce7', fg: '#166534' }, ACTIVE: { bg: '#dcfce7', fg: '#166534' },
      ACCEPTED: { bg: '#dcfce7', fg: '#166534' }, RESOLVED: { bg: '#dcfce7', fg: '#166534' },
      REVERSED: { bg: '#dbeafe', fg: '#1d4ed8' },
      PENDING_SETTLEMENT: { bg: '#fef3c7', fg: '#92400e' }, PENDING_CLEARING: { bg: '#fef3c7', fg: '#92400e' },
      PENDING: { bg: '#fef3c7', fg: '#92400e' }, PROCESSING: { bg: '#fef3c7', fg: '#92400e' },
      UNDER_REVIEW: { bg: '#fef3c7', fg: '#92400e' }, OPEN: { bg: '#fef3c7', fg: '#92400e' },
      RETURNED: { bg: '#fef2f2', fg: '#991b1b' }, FAILED: { bg: '#fef2f2', fg: '#991b1b' },
      DECLINED: { bg: '#fef2f2', fg: '#991b1b' }, REJECTED: { bg: '#fef2f2', fg: '#991b1b' },
      SUSPENDED: { bg: '#fff7ed', fg: '#9a3412' }, EXPIRED: { bg: '#f3f4f6', fg: '#6b7280' },
      ESCALATED_TO_CBN: { bg: '#fce7f3', fg: '#9d174d' }, DRAFT: { bg: '#f3f4f6', fg: '#6b7280' },
    };
    const c = m[s] || { bg: '#f3f4f6', fg: '#374151' };
    return <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: c.bg, color: c.fg }}>{s.replace(/_/g, ' ')}</span>;
  };

  const navItems: { id: Tab; label: string; icon: typeof LayoutDashboard; section?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'payments', label: 'NIP Payments', icon: ArrowRightLeft },
    { id: 'bills', label: 'Bill Providers', icon: FileText },
    { id: 'standing_orders', label: 'Standing Orders', icon: Repeat },
    { id: 'bulk', label: 'Bulk Disbursements', icon: Package },
    // NIBSS Gap Features
    { id: 'neft', label: 'NEFT Batches', icon: Layers, section: 'NIBSS' },
    { id: 'cheques', label: 'NACS Cheques', icon: BookOpen, section: 'NIBSS' },
    { id: 'mandates', label: 'Direct Debit (NDD)', icon: Receipt, section: 'NIBSS' },
    { id: 'reversals', label: 'Reversals', icon: RotateCcw, section: 'NIBSS' },
    { id: 'disputes', label: 'Inter-Bank Disputes', icon: Scale, section: 'NIBSS' },
    { id: 'merchants', label: 'mCash+ Merchants', icon: Store, section: 'NIBSS' },
    { id: 'paydirect', label: 'PayDirect', icon: Building2, section: 'NIBSS' },
    { id: 'identity', label: 'Identity (BVN/NIN)', icon: UserCheck, section: 'NIBSS' },
    { id: 'iso20022', label: 'ISO 20022', icon: FileCode, section: 'NIBSS' },
    { id: 'nqr', label: 'NQR Codes', icon: ScanLine, section: 'NIBSS' },
    { id: 'emandate', label: 'e-Mandate Portal', icon: FileCheck, section: 'NIBSS' },
    { id: 'fraud', label: 'Fraud Detection', icon: Shield, section: 'ADVANCED' },
    { id: 'onboarding', label: 'Stakeholder Onboarding', icon: UserPlus, section: 'ADVANCED' },
  ];

  const coreItems = navItems.filter(n => !n.section);
  const nibssItems = navItems.filter(n => n.section === 'NIBSS');
  const advancedItems = navItems.filter(n => n.section === 'ADVANCED');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <aside style={{ width: 250, borderRight: '1px solid #e5e7eb', background: '#fafafa', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Banknote size={22} color="#2563eb" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Domestic Payments</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>NIP + NIBSS Switch</div>
            </div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {coreItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, width: '100%', textAlign: 'left',
                background: activeTab === item.id ? '#2563eb' : 'transparent', color: activeTab === item.id ? 'white' : '#374151' }}>
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, padding: '12px 14px 4px' }}>NIBSS Features</div>
          {nibssItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, width: '100%', textAlign: 'left',
                background: activeTab === item.id ? '#2563eb' : 'transparent', color: activeTab === item.id ? 'white' : '#374151' }}>
              <item.icon size={14} />
              {item.label}
            </button>
          ))}
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, padding: '12px 14px 4px' }}>Advanced</div>
          {advancedItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, width: '100%', textAlign: 'left',
                background: activeTab === item.id ? '#2563eb' : 'transparent', color: activeTab === item.id ? 'white' : '#374151' }}>
              <item.icon size={14} />
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
        </div>

        {/* ============== Summary Cards (shown on dashboard) ============== */}
        {activeTab === 'dashboard' && summary && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 24 }}>
              {[
                { label: 'NIP Payments', value: summary.totalPayments, icon: ArrowRightLeft, color: '#3b82f6' },
                { label: 'Completed', value: summary.completed, icon: CheckCircle, color: '#10b981' },
                { label: 'Failed', value: summary.failed, icon: XCircle, color: '#ef4444' },
                { label: 'Volume', value: fmt(summary.totalVolumeNGN), icon: Banknote, color: '#2563eb' },
                { label: 'NEFT Batches', value: neftBatches.length, icon: Layers, color: '#7c3aed' },
                { label: 'Cheques', value: cheques.length, icon: BookOpen, color: '#0369a1' },
                { label: 'Mandates', value: mandates.length, icon: Receipt, color: '#059669' },
                { label: 'Disputes', value: disputes.length, icon: Scale, color: '#dc2626' },
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 24 }}>
              <div style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)', borderRadius: 16, padding: 24, color: 'white' }}>
                <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>Total NIP Volume</div>
                <div style={{ fontSize: 32, fontWeight: 800 }}>{fmt(summary.totalVolumeNGN)}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}><TrendingUp size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {summary.totalPayments} transactions</div>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', borderRadius: 16, padding: 24, color: 'white' }}>
                <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>NEFT Settlement</div>
                <div style={{ fontSize: 32, fontWeight: 800 }}>{neftSummary ? fmt(neftSummary.totalVolume) : '₦0'}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{neftSummary?.totalBatches ?? 0} batches, {neftSummary?.totalItems ?? 0} items</div>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #059669, #10b981)', borderRadius: 16, padding: 24, color: 'white' }}>
                <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>Active Mandates</div>
                <div style={{ fontSize: 32, fontWeight: 800 }}>{mandateSummary?.active ?? 0}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Total debited: {mandateSummary ? fmt(mandateSummary.totalDebited) : '₦0'}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><PieChart size={18} color="#2563eb" /> Payment Type Distribution</h3>
                {['P2P', 'P2B', 'QR_PAY', 'BILL_PAYMENT', 'REQUEST_TO_PAY', 'USSD'].map((type, i) => {
                  const count = payments.filter(p => p.type === type).length;
                  const vol = payments.filter(p => p.type === type).reduce((s: number, p: any) => s + p.amount, 0);
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
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={18} color="#059669" /> NIBSS Module Status</h3>
                {[
                  { label: 'NEFT Settled', val: neftSummary?.settled ?? 0, total: neftSummary?.totalBatches ?? 0, color: '#10b981' },
                  { label: 'Cheques Cleared', val: chequeSummary?.cleared ?? 0, total: chequeSummary?.totalCheques ?? 0, color: '#0369a1' },
                  { label: 'Disputes Resolved', val: disputeSummary?.resolved ?? 0, total: disputeSummary?.total ?? 0, color: '#7c3aed' },
                  { label: 'Reversals Complete', val: reversalSummary?.successful ?? 0, total: reversalSummary?.total ?? 0, color: '#dc2626' },
                ].map((item, i) => (
                  <div key={i} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>{item.label}</span>
                      <span style={{ fontWeight: 600 }}>{item.val}/{item.total}</span>
                    </div>
                    <div style={{ height: 10, background: '#f3f4f6', borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${item.total > 0 ? (item.val / item.total) * 100 : 0}%`, background: item.color, borderRadius: 5 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============== NIP Payments Tab ============== */}
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
                  {payments.map((p: any) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{p.id}</td>
                      <td style={{ padding: '10px 12px' }}><span style={typeBadge(p.type)}>{p.type}</span></td>
                      <td style={{ padding: '10px 12px', fontSize: 12 }}>{p.channel}</td>
                      <td style={{ padding: '10px 12px' }}>{p.senderName}<br/><span style={{ fontSize: 11, color: '#9ca3af' }}>{p.senderBank}</span></td>
                      <td style={{ padding: '10px 12px' }}>{p.receiverName}<br/><span style={{ fontSize: 11, color: '#9ca3af' }}>{p.receiverBank}</span></td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(p.amount)}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>₦{p.fee?.toLocaleString()}</td>
                      <td style={{ padding: '10px 12px' }}>{statusBadge(p.status)}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.narration}</td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>{new Date(p.initiatedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============== Bill Providers Tab ============== */}
        {activeTab === 'bills' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {providers.map((p: any) => (
              <div key={p.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{p.name}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: p.isActive ? '#dcfce7' : '#fef2f2', color: p.isActive ? '#166534' : '#991b1b' }}>
                    {p.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Category: <strong>{p.category?.replace(/_/g, ' ')}</strong></div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Avg Response: <strong>{p.avgProcessMs}ms</strong></div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {(p.services || []).map((s: string) => (
                    <span key={s} style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, background: '#f3f4f6', color: '#374151' }}>{s}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ============== Standing Orders Tab ============== */}
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
              {orders.map((o: any) => (
                <tr key={o.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{o.id}</td>
                  <td style={{ padding: '10px 12px' }}>{o.payerBank}<br/><span style={{ fontSize: 11, color: '#9ca3af' }}>{o.payerAcct}</span></td>
                  <td style={{ padding: '10px 12px' }}>{o.payeeName}<br/><span style={{ fontSize: 11, color: '#9ca3af' }}>{o.payeeBank}</span></td>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(o.amount)}</td>
                  <td style={{ padding: '10px 12px' }}>{o.frequency}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12 }}>{new Date(o.nextExecDate).toLocaleDateString()}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{o.executions}</td>
                  <td style={{ padding: '10px 12px' }}>{statusBadge(o.status?.toUpperCase())}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ============== Bulk Disbursements Tab ============== */}
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
              {bulks.map((b: any) => (
                <tr key={b.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{b.id}</td>
                  <td style={{ padding: '10px 12px' }}>{b.initiatorName}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{b.totalItems?.toLocaleString()}</td>
                  <td style={{ padding: '10px 12px' }}>{b.processedItems?.toLocaleString()}</td>
                  <td style={{ padding: '10px 12px', color: '#10b981', fontWeight: 600 }}>{b.successCount?.toLocaleString()}</td>
                  <td style={{ padding: '10px 12px', color: '#ef4444', fontWeight: 600 }}>{b.failedCount?.toLocaleString()}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(b.totalAmount)}</td>
                  <td style={{ padding: '10px 12px' }}>{statusBadge(b.status?.toUpperCase())}</td>
                  <td style={{ padding: '10px 12px', fontSize: 11, color: '#6b7280' }}>{new Date(b.submittedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ============== NEFT Batches Tab ============== */}
        {activeTab === 'neft' && (
          <div>
            {neftSummary && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 24 }}>
                {[
                  { label: 'Total Batches', value: neftSummary.totalBatches, color: '#3b82f6' },
                  { label: 'Total Items', value: neftSummary.totalItems?.toLocaleString(), color: '#7c3aed' },
                  { label: 'Volume', value: fmt(neftSummary.totalVolume), color: '#2563eb' },
                  { label: 'Settled', value: neftSummary.settled, color: '#10b981' },
                  { label: 'Pending', value: neftSummary.pendingSettlement, color: '#f59e0b' },
                ].map((c, i) => (
                  <div key={i} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{c.label}</span>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.color, marginTop: 4 }}>{c.value}</div>
                  </div>
                ))}
              </div>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: '#f9fafb' }}>
                {['Batch Ref', 'Sender Bank', 'Items', 'Total Amount', 'Settled', 'Session', 'Status', 'Submitted'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {neftBatches.map((b: any) => (
                  <tr key={b.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{b.batchRef}</td>
                    <td style={{ padding: '10px 12px' }}>{b.senderBank}<br/><span style={{ fontSize: 11, color: '#9ca3af' }}>Code: {b.senderBankCode}</span></td>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{b.totalItems}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(b.totalAmount)}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{fmt(b.settledAmount)}</td>
                    <td style={{ padding: '10px 12px' }}><span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, background: '#f3f4f6' }}>{b.clearingSession}</span></td>
                    <td style={{ padding: '10px 12px' }}>{statusBadge(b.status)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: '#6b7280' }}>{new Date(b.submittedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ============== NACS Cheques Tab ============== */}
        {activeTab === 'cheques' && (
          <div>
            {chequeSummary && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 24 }}>
                {[
                  { label: 'Total Cheques', value: chequeSummary.totalCheques, color: '#0369a1' },
                  { label: 'Cleared', value: chequeSummary.cleared, color: '#10b981' },
                  { label: 'Returned', value: chequeSummary.returned, color: '#ef4444' },
                  { label: 'Pending', value: chequeSummary.pendingClearing, color: '#f59e0b' },
                  { label: 'Total Value', value: fmt(chequeSummary.totalValue), color: '#2563eb' },
                ].map((c, i) => (
                  <div key={i} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{c.label}</span>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.color, marginTop: 4 }}>{c.value}</div>
                  </div>
                ))}
              </div>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: '#f9fafb' }}>
                {['Cheque #', 'Drawer', 'Payee', 'Amount', 'Status', 'Return Reason', 'Presented'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {cheques.map((c: any) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{c.chequeNumber}<br/><span style={{ fontSize: 10, color: '#9ca3af' }}>MICR: {c.micrLine?.substring(0, 20)}...</span></td>
                    <td style={{ padding: '10px 12px' }}>{c.drawerName}<br/><span style={{ fontSize: 11, color: '#9ca3af' }}>{c.drawerBank}</span></td>
                    <td style={{ padding: '10px 12px' }}>{c.payeeName}<br/><span style={{ fontSize: 11, color: '#9ca3af' }}>{c.payeeBank}</span></td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(c.amount)}</td>
                    <td style={{ padding: '10px 12px' }}>{statusBadge(c.status)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#ef4444' }}>{c.returnReason || '-'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: '#6b7280' }}>{new Date(c.presentedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ============== Direct Debit Mandates Tab ============== */}
        {activeTab === 'mandates' && (
          <div>
            {mandateSummary && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 14, marginBottom: 24 }}>
                {[
                  { label: 'Total', value: mandateSummary.total, color: '#3b82f6' },
                  { label: 'Active', value: mandateSummary.active, color: '#10b981' },
                  { label: 'Suspended', value: mandateSummary.suspended, color: '#f59e0b' },
                  { label: 'Expired', value: mandateSummary.expired, color: '#6b7280' },
                  { label: 'FIXED', value: mandateSummary.fixedCount, color: '#0369a1' },
                  { label: 'VARIABLE', value: mandateSummary.variableCount, color: '#7c3aed' },
                  { label: 'GSI', value: mandateSummary.gsiCount, color: '#dc2626' },
                  { label: 'Debited', value: fmt(mandateSummary.totalDebited), color: '#059669' },
                ].map((c, i) => (
                  <div key={i} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{c.label}</span>
                    <div style={{ fontSize: 20, fontWeight: 700, color: c.color, marginTop: 4 }}>{c.value}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#f9fafb' }}>
                  {['Mandate Ref', 'Type', 'Subscriber', 'Biller', 'Amount', 'Frequency', 'Executions', 'Total Debited', 'Next Debit', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {mandates.map((m: any) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11 }}>{m.mandateRef}</td>
                      <td style={{ padding: '10px 12px' }}><span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: m.mandateType === 'GSI' ? '#fef2f2' : m.mandateType === 'FIXED' ? '#dbeafe' : '#f3e8ff', color: m.mandateType === 'GSI' ? '#991b1b' : m.mandateType === 'FIXED' ? '#1d4ed8' : '#6b21a8' }}>{m.mandateType}</span></td>
                      <td style={{ padding: '10px 12px' }}>{m.subscriberName}<br/><span style={{ fontSize: 11, color: '#9ca3af' }}>{m.subscriberBank}</span></td>
                      <td style={{ padding: '10px 12px' }}>{m.billerName}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(m.amount)}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12 }}>{m.frequency}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{m.executionCount}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{fmt(m.totalDebited)}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12 }}>{new Date(m.nextDebitDate).toLocaleDateString()}</td>
                      <td style={{ padding: '10px 12px' }}>{statusBadge(m.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============== Reversals Tab ============== */}
        {activeTab === 'reversals' && (
          <div>
            {reversalSummary && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 24 }}>
                {[
                  { label: 'Total', value: reversalSummary.total, color: '#3b82f6' },
                  { label: 'Reversed', value: reversalSummary.successful, color: '#10b981' },
                  { label: 'Pending', value: reversalSummary.pending, color: '#f59e0b' },
                  { label: 'Declined', value: reversalSummary.declined, color: '#ef4444' },
                  { label: 'Reversed Amount', value: fmt(reversalSummary.totalReversed), color: '#2563eb' },
                ].map((c, i) => (
                  <div key={i} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{c.label}</span>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.color, marginTop: 4 }}>{c.value}</div>
                  </div>
                ))}
              </div>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: '#f9fafb' }}>
                {['ID', 'Original NIP Ref', 'Amount', 'Reason', 'Status', 'Requested By', 'Requested', 'Resolved'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {reversals.map((r: any) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{r.id}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{r.originalNipRef}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(r.amount)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>{r.reason?.replace(/_/g, ' ')}</td>
                    <td style={{ padding: '10px 12px' }}>{statusBadge(r.status)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>{r.requestedBy}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: '#6b7280' }}>{new Date(r.requestedAt).toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: '#6b7280' }}>{r.resolvedAt ? new Date(r.resolvedAt).toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ============== Disputes Tab ============== */}
        {activeTab === 'disputes' && (
          <div>
            {disputeSummary && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 24 }}>
                {[
                  { label: 'Total', value: disputeSummary.total, color: '#3b82f6' },
                  { label: 'Open', value: disputeSummary.open, color: '#f59e0b' },
                  { label: 'Under Review', value: disputeSummary.underReview, color: '#7c3aed' },
                  { label: 'Resolved', value: disputeSummary.resolved, color: '#10b981' },
                  { label: 'Escalated to CBN', value: disputeSummary.escalated, color: '#dc2626' },
                  { label: 'Disputed Amount', value: fmt(disputeSummary.totalDisputedAmount), color: '#0369a1' },
                ].map((c, i) => (
                  <div key={i} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{c.label}</span>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.color, marginTop: 4 }}>{c.value}</div>
                  </div>
                ))}
              </div>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: '#f9fafb' }}>
                {['NIP Ref', 'Type', 'Initiating Bank', 'Responding Bank', 'Amount', 'Status', 'SLA Deadline', 'Created'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {disputes.map((d: any) => (
                  <tr key={d.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{d.nipRef}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>{d.disputeType?.replace(/_/g, ' ')}</td>
                    <td style={{ padding: '10px 12px' }}>{d.initiatingBank}</td>
                    <td style={{ padding: '10px 12px' }}>{d.respondingBank}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(d.amount)}</td>
                    <td style={{ padding: '10px 12px' }}>{statusBadge(d.status)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: new Date(d.slaDeadline) < new Date() ? '#ef4444' : '#6b7280', fontWeight: new Date(d.slaDeadline) < new Date() ? 700 : 400 }}>{new Date(d.slaDeadline).toLocaleDateString()}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: '#6b7280' }}>{new Date(d.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ============== mCash+ Merchants Tab ============== */}
        {activeTab === 'merchants' && (
          <div>
            {merchantSummary && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 24 }}>
                {[
                  { label: 'Total Merchants', value: merchantSummary.total, color: '#3b82f6' },
                  { label: 'Active', value: merchantSummary.active, color: '#10b981' },
                  { label: 'Transactions', value: merchantSummary.totalTransactions?.toLocaleString(), color: '#7c3aed' },
                  { label: 'Volume', value: fmt(merchantSummary.totalVolume), color: '#2563eb' },
                ].map((c, i) => (
                  <div key={i} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{c.label}</span>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.color, marginTop: 4 }}>{c.value}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {merchants.map((m: any) => (
                <div key={m.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{m.merchantName}</span>
                    {statusBadge(m.status)}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Code: <strong>{m.merchantCode}</strong></div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>USSD: <strong>{m.ussdShortCode}</strong></div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Category: <strong>{m.category?.replace(/_/g, ' ')}</strong></div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Location: {m.location}</div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div><span style={{ fontSize: 11, color: '#9ca3af' }}>Transactions</span><div style={{ fontWeight: 700 }}>{m.transactionCount?.toLocaleString()}</div></div>
                    <div><span style={{ fontSize: 11, color: '#9ca3af' }}>Volume</span><div style={{ fontWeight: 700 }}>{fmt(m.totalVolume)}</div></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============== PayDirect Tab ============== */}
        {activeTab === 'paydirect' && (
          <div>
            {pdSummary && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 24 }}>
                {[
                  { label: 'Collectors', value: pdSummary.totalCollections, color: '#3b82f6' },
                  { label: 'Active', value: pdSummary.active, color: '#10b981' },
                  { label: 'Total Collected', value: fmt(pdSummary.totalCollected), color: '#2563eb' },
                  { label: 'Transactions', value: pdSummary.totalTransactions?.toLocaleString(), color: '#7c3aed' },
                ].map((c, i) => (
                  <div key={i} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{c.label}</span>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.color, marginTop: 4 }}>{c.value}</div>
                  </div>
                ))}
              </div>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: '#f9fafb' }}>
                {['Collector', 'Code', 'Category', 'Product', 'Total Collected', 'Transactions', 'Bank Coverage', 'Channels', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {pdCollections.map((c: any) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{c.collectorName}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{c.collectorCode}</td>
                    <td style={{ padding: '10px 12px' }}><span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, background: '#f3f4f6' }}>{c.category}</span></td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>{c.productName}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(c.totalCollected)}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{c.transactionCount?.toLocaleString()}</td>
                    <td style={{ padding: '10px 12px' }}>{c.bankCoverage} banks</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(c.channels || []).map((ch: string) => (
                          <span key={ch} style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, background: '#f3f4f6', color: '#374151' }}>{ch}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>{statusBadge(c.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ============== Identity (BVN/NIN) Tab ============== */}
        {activeTab === 'identity' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
              <div style={{ background: 'linear-gradient(135deg, #059669, #10b981)', borderRadius: 16, padding: 24, color: 'white' }}>
                <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>BVN Verification</div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>Bank Verification Number</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 8 }}>11-digit unique identifier linked to biometrics</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Fee: ₦50 per lookup | Cache TTL: 72h (Redis)</div>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)', borderRadius: 16, padding: 24, color: 'white' }}>
                <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>NIN Verification</div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>National Identity Number</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 8 }}>11-digit national ID from NIMC database</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Fee: ₦30 per lookup | Cache TTL: 72h (Redis)</div>
              </div>
            </div>
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Middleware Integration</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {[
                  { label: 'Rust Service', desc: 'DashMap + atomic counters', color: '#dc2626' },
                  { label: 'TigerBeetle', desc: 'Fee collection postings (Code 701/702)', color: '#f59e0b' },
                  { label: 'Redis Cache', desc: 'nibss:bvn:{bvn} TTL 72h', color: '#ef4444' },
                  { label: 'Fluvio Stream', desc: 'nibss-identity-verifications', color: '#7c3aed' },
                  { label: 'OpenSearch Index', desc: 'nibss-identity-verifications', color: '#0369a1' },
                  { label: 'Keycloak', desc: 'identity:bvn:verify permission', color: '#059669' },
                  { label: 'APISIX', desc: '500 req/s rate limit, JWT auth', color: '#2563eb' },
                  { label: 'OpenAppSec', desc: 'BVN/NIN format validation WAF', color: '#9333ea' },
                ].map((item, i) => (
                  <div key={i} style={{ padding: 12, background: '#f9fafb', borderRadius: 8, borderLeft: `4px solid ${item.color}` }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Account Name Enquiry & TSQ</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Name Enquiry</div>
                  <div style={{ fontSize: 12, color: '#166534' }}>Real-time beneficiary name lookup via NIP before transfer. Fee: ₦10. Cache: 24h in Redis.</div>
                </div>
                <div style={{ padding: 16, background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Transaction Status Query (TSQ)</div>
                  <div style={{ fontSize: 12, color: '#1d4ed8' }}>Query pending/indeterminate NIP transactions. NIP response codes per CBN spec. Cache: 5 min in Redis.</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============== ISO 20022 Tab ============== */}
        {activeTab === 'iso20022' && (
          <div>
            {isoSummary && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 14, marginBottom: 24 }}>
                {[
                  { label: 'Total Messages', value: isoSummary.total, color: '#3b82f6' },
                  { label: 'pain.001', value: isoSummary.pain001, color: '#7c3aed' },
                  { label: 'pacs.008', value: isoSummary.pacs008, color: '#059669' },
                  { label: 'pacs.002', value: isoSummary.pacs002, color: '#0369a1' },
                  { label: 'camt.053', value: isoSummary.camt053, color: '#dc2626' },
                ].map((c, i) => (
                  <div key={i} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{c.label}</span>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.color, marginTop: 4 }}>{c.value}</div>
                  </div>
                ))}
              </div>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: '#f9fafb' }}>
                {['Message ID', 'Type', 'Sender BIC', 'Receiver BIC', 'Txn Count', 'Amount', 'Currency', 'Settlement', 'Status', 'Size'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {isoMessages.map((m: any) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11 }}>{m.messageId}</td>
                    <td style={{ padding: '10px 12px' }}><span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#f3e8ff', color: '#6b21a8' }}>{m.messageType}</span></td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{m.senderBic}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{m.receiverBic}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{m.transactionCount}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(m.totalAmount)}</td>
                    <td style={{ padding: '10px 12px' }}>{m.currency}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>{m.settlementMethod}</td>
                    <td style={{ padding: '10px 12px' }}>{statusBadge(m.status)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280' }}>{(m.rawXmlSizeBytes / 1024).toFixed(1)} KB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ============== NQR Codes Tab ============== */}
        {activeTab === 'nqr' && (
          <div>
            {nqrSummary && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 24 }}>
                {[
                  { label: 'Total QR Codes', value: nqrSummary.total, color: '#3b82f6' },
                  { label: 'Active', value: nqrSummary.active, color: '#10b981' },
                  { label: 'Dynamic', value: nqrSummary.dynamic, color: '#7c3aed' },
                  { label: 'Static', value: nqrSummary.static, color: '#0369a1' },
                  { label: 'Total Scans', value: nqrSummary.totalScans?.toLocaleString(), color: '#f59e0b' },
                  { label: 'Collected', value: fmt(nqrSummary.totalCollected), color: '#2563eb' },
                ].map((c, i) => (
                  <div key={i} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{c.label}</span>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.color, marginTop: 4 }}>{c.value}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
              {nqrCodes.map((q: any) => (
                <div key={q.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{q.merchantName}</span>
                    {statusBadge(q.status)}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: q.isDynamic ? '#f3e8ff' : '#dbeafe', color: q.isDynamic ? '#6b21a8' : '#1d4ed8' }}>{q.isDynamic ? 'DYNAMIC' : 'STATIC'}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, background: '#f3f4f6' }}>{q.merchantCategory}</span>
                  </div>
                  {q.amount && <div style={{ fontSize: 28, fontWeight: 800, color: '#2563eb', marginBottom: 8 }}>{fmt(q.amount)}</div>}
                  {q.narration && <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{q.narration}</div>}
                  <div style={{ background: '#f9fafb', borderRadius: 8, padding: 12, marginBottom: 12, fontFamily: 'monospace', fontSize: 10, wordBreak: 'break-all', color: '#6b7280' }}>{q.emvPayload}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div><span style={{ fontSize: 10, color: '#9ca3af' }}>Scans</span><div style={{ fontWeight: 700 }}>{q.scansCount?.toLocaleString()}</div></div>
                    <div><span style={{ fontSize: 10, color: '#9ca3af' }}>Payments</span><div style={{ fontWeight: 700 }}>{q.paymentsCount?.toLocaleString()}</div></div>
                    <div><span style={{ fontSize: 10, color: '#9ca3af' }}>Collected</span><div style={{ fontWeight: 700 }}>{fmt(q.totalCollected)}</div></div>
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>Expires: {new Date(q.expiresAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============== e-Mandate Portal Tab ============== */}
        {activeTab === 'emandate' && (
          <div>
            {emandateSummary && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 24 }}>
                {[
                  { label: 'Total', value: emandateSummary.total, color: '#3b82f6' },
                  { label: 'Approved', value: emandateSummary.approved, color: '#10b981' },
                  { label: 'Pending Approval', value: emandateSummary.pendingApproval, color: '#f59e0b' },
                  { label: 'Rejected', value: emandateSummary.rejected, color: '#ef4444' },
                  { label: 'Expired', value: emandateSummary.expired, color: '#6b7280' },
                ].map((c, i) => (
                  <div key={i} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{c.label}</span>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.color, marginTop: 4 }}>{c.value}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>How e-Mandate Works</h3>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {['1. Biller initiates mandate request', '2. Customer redirected to bank portal', '3. Bank sends OTP to customer', '4. Customer approves via OTP', '5. Mandate activated for auto-debit'].map((step, i) => (
                  <div key={i} style={{ padding: '8px 16px', background: '#eff6ff', borderRadius: 8, fontSize: 12, color: '#1d4ed8', fontWeight: 600 }}>{step}</div>
                ))}
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: '#f9fafb' }}>
                {['Mandate Ref', 'Bank', 'Biller', 'Amount', 'Frequency', 'Status', 'OTP', 'Bank Portal', 'Initiated', 'Expires'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {emandates.map((e: any) => (
                  <tr key={e.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{e.mandateRef}</td>
                    <td style={{ padding: '10px 12px' }}>{e.subscriberBank}</td>
                    <td style={{ padding: '10px 12px' }}>{e.billerName}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(e.amount)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>{e.frequency}</td>
                    <td style={{ padding: '10px 12px' }}>{statusBadge(e.approvalStatus)}</td>
                    <td style={{ padding: '10px 12px' }}><span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, background: e.otpSent ? '#dcfce7' : '#fef2f2', color: e.otpSent ? '#166534' : '#991b1b' }}>{e.otpChannel}</span></td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: '#2563eb' }}><a href={e.bankRedirectUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>Open</a></td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: '#6b7280' }}>{new Date(e.initiatedAt).toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: new Date(e.expiresAt) < new Date() ? '#ef4444' : '#6b7280' }}>{new Date(e.expiresAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ============== Fraud Detection Tab ============== */}
        {activeTab === 'fraud' && (
          <div>
            {fraudSummary && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 24 }}>
                {[
                  { label: 'Total Alerts', value: fraudSummary.total, color: '#3b82f6' },
                  { label: 'Critical', value: fraudSummary.critical, color: '#dc2626' },
                  { label: 'High', value: fraudSummary.high, color: '#f59e0b' },
                  { label: 'Medium', value: fraudSummary.medium, color: '#7c3aed' },
                  { label: 'Blocked', value: fraudSummary.blocked, color: '#ef4444' },
                  { label: 'Flagged', value: fraudSummary.flagged, color: '#f59e0b' },
                  { label: 'Amount Blocked', value: fmt(fraudSummary.totalAmountBlocked), color: '#dc2626' },
                ].map((c, i) => (
                  <div key={i} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{c.label}</span>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.color, marginTop: 4 }}>{c.value}</div>
                  </div>
                ))}
              </div>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: '#f9fafb' }}>
                {['NIP Ref', 'Amount', 'Sender Bank', 'Receiver Bank', 'Channel', 'Risk Score', 'Severity', 'Action', 'Rule Triggered', 'Detected', 'Reviewed By'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {fraudAlerts.map((a: any) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #f3f4f6', background: a.severity === 'CRITICAL' ? '#fef2f2' : 'transparent' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{a.nipRef}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(a.amount)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>{a.senderBank}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>{a.receiverBank}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>{a.channel}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 40, height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${a.riskScore}%`, height: '100%', background: a.riskScore >= 70 ? '#ef4444' : a.riskScore >= 50 ? '#f59e0b' : '#10b981', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontWeight: 700, fontSize: 12, color: a.riskScore >= 70 ? '#ef4444' : a.riskScore >= 50 ? '#f59e0b' : '#10b981' }}>{a.riskScore}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}><span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: a.severity === 'CRITICAL' ? '#fef2f2' : a.severity === 'HIGH' ? '#fff7ed' : a.severity === 'MEDIUM' ? '#fef3c7' : '#f0fdf4', color: a.severity === 'CRITICAL' ? '#991b1b' : a.severity === 'HIGH' ? '#9a3412' : a.severity === 'MEDIUM' ? '#92400e' : '#166534' }}>{a.severity}</span></td>
                    <td style={{ padding: '10px 12px' }}>{statusBadge(a.action)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11 }}>{a.ruleTriggered?.replace(/_/g, ' ')}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: '#6b7280' }}>{new Date(a.detectedAt).toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>{a.reviewedBy || <span style={{ color: '#f59e0b' }}>Pending</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 16 }}>
              {fraudAlerts.filter((a: any) => a.severity === 'CRITICAL' || a.severity === 'HIGH').map((a: any) => (
                <div key={a.id} style={{ background: a.severity === 'CRITICAL' ? '#fef2f2' : '#fff7ed', border: `1px solid ${a.severity === 'CRITICAL' ? '#fecaca' : '#fed7aa'}`, borderRadius: 8, padding: 12, marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: a.severity === 'CRITICAL' ? '#991b1b' : '#9a3412' }}>{a.ruleTriggered?.replace(/_/g, ' ')} — {fmt(a.amount)}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{a.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============== Stakeholder Onboarding Tab ============== */}
        {activeTab === 'onboarding' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 24 }}>
              <div style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)', borderRadius: 16, padding: 24, color: 'white' }}>
                <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>Banks / NIP Participants</div>
                <div style={{ fontSize: 32, fontWeight: 800 }}>{banksSummary?.total ?? 0}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{banksSummary?.active ?? 0} active, {banksSummary?.pendingApproval ?? 0} pending</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Prefund: {banksSummary ? fmt(banksSummary.totalPrefund) : '₦0'}</div>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #059669, #10b981)', borderRadius: 16, padding: 24, color: 'white' }}>
                <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>Billers (e-BillsPay/PayDirect)</div>
                <div style={{ fontSize: 32, fontWeight: 800 }}>{billersSummary?.total ?? 0}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{billersSummary?.active ?? 0} active, {billersSummary?.pending ?? 0} pending</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{billersSummary?.totalProducts ?? 0} products registered</div>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', borderRadius: 16, padding: 24, color: 'white' }}>
                <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>DFSPs / IMTOs</div>
                <div style={{ fontSize: 32, fontWeight: 800 }}>{dfspsSummary?.total ?? 0}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{dfspsSummary?.active ?? 0} active, {dfspsSummary?.mojaConnected ?? 0} Mojaloop-connected</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{dfspsSummary?.totalCorridors ?? 0} corridors</div>
              </div>
            </div>

            {/* Banks */}
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Bank / NIP Participant Onboarding</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
              <thead><tr style={{ background: '#f9fafb' }}>
                {['Bank', 'Code', 'CBN License', 'NIP Code', 'Prefund', 'Services', 'API Key', 'NIP', 'Status', 'Go-Live'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {onboardedBanks.map((b: any) => (
                  <tr key={b.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{b.bankName}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{b.bankCode}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11 }}>{b.cbnLicenseNo}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11 }}>{b.nipParticipantCode}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(b.prefundBalance)}</td>
                    <td style={{ padding: '10px 12px' }}><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{b.services.map((s: string) => <span key={s} style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, background: '#f3f4f6' }}>{s}</span>)}</div></td>
                    <td style={{ padding: '10px 12px' }}><span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, background: b.apiKeyProvisioned ? '#dcfce7' : '#fef2f2', color: b.apiKeyProvisioned ? '#166534' : '#991b1b' }}>{b.apiKeyProvisioned ? 'Provisioned' : 'Pending'}</span></td>
                    <td style={{ padding: '10px 12px' }}><span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, background: b.nipConnected ? '#dcfce7' : '#fef2f2', color: b.nipConnected ? '#166534' : '#991b1b' }}>{b.nipConnected ? 'Connected' : 'Pending'}</span></td>
                    <td style={{ padding: '10px 12px' }}>{statusBadge(b.status)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: '#6b7280' }}>{b.goLiveDate ? new Date(b.goLiveDate).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Billers */}
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Biller Onboarding</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
              {onboardedBillers.map((b: any) => (
                <div key={b.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{b.billerName}</span>
                    {statusBadge(b.status)}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Code: <strong>{b.billerCode}</strong> | RC: {b.rcNumber}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Category: <strong>{b.category}</strong></div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{b.productCount} products | {b.transactionCount?.toLocaleString()} txns | {fmt(b.totalCollected)} collected</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, background: b.ebillspayIntegrated ? '#dcfce7' : '#f3f4f6', color: b.ebillspayIntegrated ? '#166534' : '#9ca3af' }}>e-BillsPay</span>
                    <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, background: b.paydirectIntegrated ? '#dcfce7' : '#f3f4f6', color: b.paydirectIntegrated ? '#166534' : '#9ca3af' }}>PayDirect</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {b.channels.map((ch: string) => <span key={ch} style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, background: '#f3f4f6' }}>{ch}</span>)}
                  </div>
                </div>
              ))}
            </div>

            {/* DFSPs */}
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>DFSP / IMTO Onboarding</h3>
            {onboardedDfsps.map((d: any) => (
              <div key={d.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{d.dfspName}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, background: '#f3e8ff', color: '#6b21a8', marginLeft: 8 }}>{d.type}</span>
                  </div>
                  {statusBadge(d.status)}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                  Code: <strong>{d.dfspCode}</strong> | CBN: {d.cbnLicenseNo} | Mojaloop: {d.mojaFspId || 'Not connected'}
                </div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
                  {d.corridors.map((c: string) => <span key={c} style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, background: '#dbeafe', color: '#1d4ed8' }}>{c}</span>)}
                  {d.services.map((s: string) => <span key={s} style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, background: '#dcfce7', color: '#166534' }}>{s}</span>)}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {d.onboardingSteps.map((step: any, i: number) => (
                    <div key={i} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: step.status === 'COMPLETED' ? '#dcfce7' : step.status === 'IN_PROGRESS' ? '#fef3c7' : '#f3f4f6', color: step.status === 'COMPLETED' ? '#166534' : step.status === 'IN_PROGRESS' ? '#92400e' : '#6b7280' }}>
                      {step.step.replace(/_/g, ' ')}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}
