import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Landmark, Receipt, Building2, Heart, FileText, CheckCircle, Clock, AlertCircle, BarChart3, TrendingUp, Activity, PieChart, LayoutDashboard, Globe, ArrowDownLeft, Banknote, Ship, CreditCard, Code, Users } from 'lucide-react';

type Tab = 'dashboard' | 'tsa' | 'tax' | 'pension' | 'social' | 'reports';

const moduleLinks = [
  { label: 'Outbound Remittance', href: '/', icon: Globe, color: '#3b82f6' },
  { label: 'Inbound Remittance', href: '/inbound-remittance', icon: ArrowDownLeft, color: '#059669' },
  { label: 'Domestic Payments', href: '/domestic-payments', icon: Banknote, color: '#2563eb' },
  { label: 'Trade Payments', href: '/trade-payments', icon: Ship, color: '#7c3aed' },
  { label: 'Card Processing', href: '/card-processing', icon: CreditCard, color: '#dc2626' },
  { label: 'Open Banking', href: '/open-banking', icon: Code, color: '#0ea5e9' },
];

export default function GovernmentPayments() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const govQuery = trpc.governmentPayments.listGovernmentPayments.useQuery(undefined, { retry: false });
  const taxQuery = trpc.governmentPayments.listTaxPayments.useQuery(undefined, { retry: false });
  const pensionQuery = trpc.governmentPayments.listPensions.useQuery(undefined, { retry: false });
  const socialQuery = trpc.governmentPayments.listSocialDisbursements.useQuery(undefined, { retry: false });
  const reportsQuery = trpc.governmentPayments.listRegulatoryReports.useQuery(undefined, { retry: false });

  const govPayments = govQuery.data?.payments ?? [];
  const govSummary = govQuery.data?.summary;
  const taxes = taxQuery.data?.taxes ?? [];
  const pensions = pensionQuery.data?.pensions ?? [];
  const socials = socialQuery.data?.disbursements ?? [];
  const reports = reportsQuery.data?.reports ?? [];

  const fmt = (n: number | undefined | null) => { const v = n ?? 0; return v >= 1e12 ? `₦${(v / 1e12).toFixed(1)}T` : v >= 1e9 ? `₦${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `₦${(v / 1e6).toFixed(1)}M` : `₦${v.toLocaleString()}`; };

  const navItems: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tsa', label: 'TSA Collections', icon: Landmark },
    { id: 'tax', label: 'Tax Payments', icon: Receipt },
    { id: 'pension', label: 'Pension', icon: Building2 },
    { id: 'social', label: 'Social Payments', icon: Heart },
    { id: 'reports', label: 'Regulatory Reports', icon: FileText },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <aside style={{ width: 250, borderRight: '1px solid #e5e7eb', background: '#fafafa', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Landmark size={22} color="#0369a1" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Government Payments</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Payment Switch Module</div>
            </div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, width: '100%', textAlign: 'left',
                background: activeTab === item.id ? '#0369a1' : 'transparent', color: activeTab === item.id ? 'white' : '#374151' }}>
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
          <span style={{ fontSize: 13, color: '#6b7280' }}>TSA, Tax, Pension, Social Payments, CBN Reporting</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'TSA', value: govSummary?.totalCollections ?? 0, sub: fmt(govSummary?.totalValueNGN ?? 0), icon: Landmark, color: '#0369a1' },
            { label: 'Tax', value: taxes.length, sub: fmt(taxQuery.data?.totalPaidNGN ?? 0), icon: Receipt, color: '#7c3aed' },
            { label: 'Pension', value: pensions.length, sub: fmt(pensionQuery.data?.totalContributions ?? 0), icon: Building2, color: '#059669' },
            { label: 'Social', value: socials.length, sub: `${((socialQuery.data?.totalBeneficiaries ?? 0) / 1e6).toFixed(1)}M`, icon: Heart, color: '#dc2626' },
            { label: 'Reports', value: reports.length, sub: `${reportsQuery.data?.totalSubmitted ?? 0} submitted`, icon: FileText, color: '#ea580c' },
          ].map((c, i) => (
            <div key={i} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <c.icon size={18} color={c.color} />
                <span style={{ fontSize: 12, color: '#6b7280' }}>{c.label}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{c.sub}</div>
            </div>
          ))}
        </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 24 }}>
            <div style={{ background: 'linear-gradient(135deg, #0369a1, #0ea5e9)', borderRadius: 16, padding: 24, color: 'white' }}>
              <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>Total TSA Revenue</div>
              <div style={{ fontSize: 32, fontWeight: 800 }}>{fmt(govSummary?.totalValueNGN ?? 0)}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}><TrendingUp size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {govSummary?.totalCollections ?? 0} collections</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', borderRadius: 16, padding: 24, color: 'white' }}>
              <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>Tax Revenue Collected</div>
              <div style={{ fontSize: 32, fontWeight: 800 }}>{fmt(taxQuery.data?.totalPaidNGN ?? 0)}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{taxes.length} tax payments processed</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #059669, #10b981)', borderRadius: 16, padding: 24, color: 'white' }}>
              <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>Pension Contributions</div>
              <div style={{ fontSize: 32, fontWeight: 800 }}>{fmt(pensionQuery.data?.totalContributions ?? 0)}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{pensions.length} employer remittances</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><PieChart size={18} color="#0369a1" /> Revenue by Category</h3>
              {[
                { label: 'TSA Collections', value: govSummary?.totalValueNGN ?? 0, color: '#0369a1' },
                { label: 'Tax (CIT/VAT/WHT)', value: taxQuery.data?.totalPaidNGN ?? 0, color: '#7c3aed' },
                { label: 'Pension', value: pensionQuery.data?.totalContributions ?? 0, color: '#059669' },
              ].map((item, i) => {
                const total = (govSummary?.totalValueNGN ?? 0) + (taxQuery.data?.totalPaidNGN ?? 0) + (pensionQuery.data?.totalContributions ?? 0);
                return (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>{item.label}</span>
                      <span style={{ fontWeight: 600 }}>{fmt(item.value)}</span>
                    </div>
                    <div style={{ height: 10, background: '#f3f4f6', borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${total > 0 ? (item.value / total) * 100 : 0}%`, background: item.color, borderRadius: 5 }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Heart size={18} color="#dc2626" /> Social Programs</h3>
              {socials.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, padding: '10px 12px', background: '#f9fafb', borderRadius: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{s.programName}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{s.ministry}</div>
                  </div>
                  <div style={{ textAlign: 'right' as const }}>
                    <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>{fmt(s.totalDisbursed)}</div>
                    <div style={{ fontSize: 10, color: '#9ca3af' }}>{(s.beneficiaryCount / 1e6).toFixed(1)}M beneficiaries</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={18} color="#ea580c" /> Regulatory Reports Status</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
              {reports.map((r, i) => (
                <div key={i} style={{ padding: 14, background: '#f9fafb', borderRadius: 8, borderLeft: `4px solid ${r.status === 'SUBMITTED' ? '#10b981' : r.status === 'PENDING' ? '#f59e0b' : '#ef4444'}` }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{r.reportName}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{r.reportType} · {r.frequency}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 600, background: r.status === 'SUBMITTED' ? '#dcfce7' : '#fef3c7', color: r.status === 'SUBMITTED' ? '#166534' : '#92400e' }}>{r.status}</span>
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>Due: {new Date(r.dueDate).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tsa' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['ID', 'MDA', 'TSA Code', 'Revenue Code', 'Amount', 'GIFMIS Ref', 'Status', 'Completed'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {govPayments.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{p.id}</td>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{p.beneficiaryMda}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{p.tsaCode}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{p.revenueCode}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(p.amount)}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{p.gifmisRef || '—'}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600,
                    background: p.status === 'COMPLETED' ? '#dcfce7' : '#fef3c7', color: p.status === 'COMPLETED' ? '#166534' : '#92400e' }}>{p.status}</span>
                </td>
                <td style={{ padding: '10px 12px', fontSize: 11, color: '#6b7280' }}>{p.completedAt ? new Date(p.completedAt).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {activeTab === 'tax' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['ID', 'Tax Type', 'Payer', 'TIN', 'Tax Office', 'Amount', 'Penalty', 'Interest', 'Total', 'Status', 'Receipt'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {taxes.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{t.id}</td>
                <td style={{ padding: '10px 12px' }}><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: '#e0e7ff', color: '#3730a3' }}>{t.taxType}</span></td>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{t.payerName}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{t.payerTin}</td>
                <td style={{ padding: '10px 12px', fontSize: 12 }}>{t.taxOffice}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{fmt(t.amount)}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: t.penalty > 0 ? '#ef4444' : '#6b7280' }}>{t.penalty > 0 ? fmt(t.penalty) : '—'}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: t.interest > 0 ? '#f59e0b' : '#6b7280' }}>{t.interest > 0 ? fmt(t.interest) : '—'}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(t.totalAmount)}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600,
                    background: t.status === 'paid' ? '#dcfce7' : '#fef2f2', color: t.status === 'paid' ? '#166534' : '#991b1b' }}>{t.status}</span>
                </td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11 }}>{t.receiptNumber || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {activeTab === 'pension' && (
        <div>
          {pensions.map(p => (
            <div key={p.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{p.pfaName}</div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>{p.employerName} · {p.pfaCode} · Period: {p.period}</div>
                </div>
                <span style={{ padding: '4px 12px', borderRadius: 9999, fontSize: 12, fontWeight: 600,
                  background: p.status === 'confirmed' ? '#dcfce7' : '#fef3c7', color: p.status === 'confirmed' ? '#166534' : '#92400e' }}>{p.status}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, fontSize: 13 }}>
                <div><span style={{ color: '#9ca3af' }}>Employees:</span> <strong>{p.employeeCount.toLocaleString()}</strong></div>
                <div><span style={{ color: '#9ca3af' }}>Employer (10%):</span> <strong>{fmt(p.employerContribution)}</strong></div>
                <div><span style={{ color: '#9ca3af' }}>Employee (8%):</span> <strong>{fmt(p.employeeContribution)}</strong></div>
                <div><span style={{ color: '#9ca3af' }}>Voluntary:</span> <strong>{fmt(p.voluntaryContribution)}</strong></div>
                <div><span style={{ color: '#9ca3af' }}>Total:</span> <strong style={{ fontSize: 16, color: '#059669' }}>{fmt(p.totalAmount)}</strong></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'social' && (
        <div>
          {socials.map(s => (
            <div key={s.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{s.programName}</div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>{s.programCode} · {s.initiatedBy}</div>
                </div>
                <span style={{ padding: '4px 12px', borderRadius: 9999, fontSize: 12, fontWeight: 600,
                  background: s.status === 'completed' ? '#dcfce7' : '#fef3c7', color: s.status === 'completed' ? '#166534' : '#92400e' }}>{s.status}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, fontSize: 13 }}>
                <div><span style={{ color: '#9ca3af' }}>Beneficiaries:</span> <strong>{s.beneficiaryCount.toLocaleString()}</strong></div>
                <div><span style={{ color: '#9ca3af' }}>Amount/Person:</span> <strong>{fmt(s.amountPerBeneficiary)}</strong></div>
                <div><span style={{ color: '#9ca3af' }}>Total:</span> <strong style={{ fontSize: 16, color: '#dc2626' }}>{fmt(s.totalAmount)}</strong></div>
                <div><span style={{ color: '#9ca3af' }}>Disbursed:</span> <strong style={{ color: '#10b981' }}>{s.disbursedCount.toLocaleString()}</strong></div>
                <div><span style={{ color: '#9ca3af' }}>Failed:</span> <strong style={{ color: '#ef4444' }}>{s.failedCount.toLocaleString()}</strong></div>
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(s.disbursedCount / s.beneficiaryCount * 100)}%`, background: '#10b981', borderRadius: 4 }} />
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{(s.disbursedCount / s.beneficiaryCount * 100).toFixed(1)}% disbursed</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'reports' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['ID', 'Report Type', 'Period', 'Records', 'Total Value', 'Submitted To', 'Reference', 'Status', 'Generated'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reports.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{r.id}</td>
                <td style={{ padding: '10px 12px' }}><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: '#e0e7ff', color: '#3730a3' }}>{r.reportType}</span></td>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.period}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{r.recordCount.toLocaleString()}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(r.totalValue)}</td>
                <td style={{ padding: '10px 12px' }}>{r.submittedTo}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{r.reference}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600,
                    background: r.status === 'submitted' ? '#dcfce7' : r.status === 'generated' ? '#dbeafe' : '#f3f4f6',
                    color: r.status === 'submitted' ? '#166534' : r.status === 'generated' ? '#1d4ed8' : '#6b7280' }}>{r.status}</span>
                </td>
                <td style={{ padding: '10px 12px', fontSize: 11, color: '#6b7280' }}>{new Date(r.generatedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      </main>
    </div>
  );
}
