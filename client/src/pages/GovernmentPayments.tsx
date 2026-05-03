import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Landmark, Receipt, Building2, Heart, FileText, CheckCircle, Clock, AlertCircle } from 'lucide-react';

type Tab = 'tsa' | 'tax' | 'pension' | 'social' | 'reports';

export default function GovernmentPayments() {
  const [activeTab, setActiveTab] = useState<Tab>('tsa');

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

  const fmt = (n: number) => n >= 1e12 ? `₦${(n / 1e12).toFixed(1)}T` : n >= 1e9 ? `₦${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `₦${(n / 1e6).toFixed(1)}M` : `₦${n.toLocaleString()}`;

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Landmark size={28} color="#0369a1" />
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Government & Regulatory Payments</h1>
        <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 8 }}>TSA, Tax, Pension, Social Payments, CBN Reporting</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'TSA Collections', value: govSummary?.totalCollections ?? 0, sub: fmt(govSummary?.totalValueNGN ?? 0), icon: Landmark, color: '#0369a1' },
          { label: 'Tax Payments', value: taxes.length, sub: fmt(taxQuery.data?.totalPaidNGN ?? 0), icon: Receipt, color: '#7c3aed' },
          { label: 'Pension Remittances', value: pensions.length, sub: fmt(pensionQuery.data?.totalContributions ?? 0), icon: Building2, color: '#059669' },
          { label: 'Social Programs', value: socials.length, sub: `${((socialQuery.data?.totalBeneficiaries ?? 0) / 1e6).toFixed(1)}M beneficiaries`, icon: Heart, color: '#dc2626' },
          { label: 'Reg. Reports', value: reports.length, sub: `${reportsQuery.data?.totalSubmitted ?? 0} submitted`, icon: FileText, color: '#ea580c' },
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

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #e5e7eb', paddingBottom: 8, flexWrap: 'wrap' }}>
        {(['tsa', 'tax', 'pension', 'social', 'reports'] as Tab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
              background: activeTab === tab ? '#0369a1' : 'transparent', color: activeTab === tab ? 'white' : '#6b7280' }}>
            {tab === 'tsa' ? 'TSA Collections' : tab === 'tax' ? 'Tax Payments' : tab === 'pension' ? 'Pension' : tab === 'social' ? 'Social Payments' : 'Regulatory Reports'}
          </button>
        ))}
      </div>

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
    </div>
  );
}
