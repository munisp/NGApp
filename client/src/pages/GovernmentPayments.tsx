import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Landmark, Receipt, Building2, Heart, FileText, TrendingUp, PieChart, LayoutDashboard } from 'lucide-react';
import ModuleLayout from '@/components/ModuleLayout';
import type { NavItem, ModuleConfig } from '@/components/ModuleLayout';
import MetricCard from '@/components/MetricCard';
import StatusBadge from '@/components/StatusBadge';
import PageHeader from '@/components/PageHeader';
import { formatNGN } from '@/lib/currency';
import { cn } from '@/lib/utils';

const MODULE: ModuleConfig = {
  title: 'Government Payments',
  subtitle: 'Payment Switch Module',
  icon: Landmark,
  accentColor: 'text-sky-700',
  accentBg: 'bg-sky-700',
  accentHover: 'hover:bg-sky-800',
};

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tsa', label: 'TSA Collections', icon: Landmark },
  { id: 'tax', label: 'Tax Payments', icon: Receipt },
  { id: 'pension', label: 'Pension', icon: Building2 },
  { id: 'social', label: 'Social Payments', icon: Heart },
  { id: 'reports', label: 'Regulatory Reports', icon: FileText },
];

export default function GovernmentPayments() {
  const [activeTab, setActiveTab] = useState('dashboard');

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

  return (
    <ModuleLayout module={MODULE} navItems={NAV_ITEMS} activeTab={activeTab} onTabChange={setActiveTab}>
      <PageHeader
        title={NAV_ITEMS.find(n => n.id === activeTab)?.label ?? 'Dashboard'}
        subtitle="TSA, Tax, Pension, Social Payments, CBN Reporting"
        icon={Landmark}
      />

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard title="TSA" value={govSummary?.totalCollections ?? 0} subtitle={formatNGN(govSummary?.totalValueNGN ?? 0)} icon={Landmark} />
        <MetricCard title="Tax" value={taxes.length} subtitle={formatNGN(taxQuery.data?.totalPaidNGN ?? 0)} icon={Receipt} />
        <MetricCard title="Pension" value={pensions.length} subtitle={formatNGN(pensionQuery.data?.totalContributions ?? 0)} icon={Building2} variant="success" />
        <MetricCard title="Social" value={socials.length} subtitle={`${((socialQuery.data?.totalBeneficiaries ?? 0) / 1e6).toFixed(1)}M`} icon={Heart} variant="danger" />
        <MetricCard title="Reports" value={reports.length} subtitle={`${reportsQuery.data?.totalSubmitted ?? 0} submitted`} icon={FileText} variant="warning" />
      </div>

      {/* Dashboard */}
      {activeTab === 'dashboard' && (
        <>
          <div className="grid md:grid-cols-3 gap-5">
            <Card className="bg-gradient-to-br from-sky-700 to-sky-500 text-white border-0">
              <CardContent className="p-6">
                <p className="text-sm opacity-90 mb-2">Total TSA Revenue</p>
                <p className="text-3xl font-extrabold">{formatNGN(govSummary?.totalValueNGN ?? 0)}</p>
                <p className="text-xs opacity-80 mt-1 flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> {govSummary?.totalCollections ?? 0} collections</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-violet-600 to-violet-500 text-white border-0">
              <CardContent className="p-6">
                <p className="text-sm opacity-90 mb-2">Tax Revenue Collected</p>
                <p className="text-3xl font-extrabold">{formatNGN(taxQuery.data?.totalPaidNGN ?? 0)}</p>
                <p className="text-xs opacity-80 mt-1">{taxes.length} tax payments processed</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-600 to-emerald-500 text-white border-0">
              <CardContent className="p-6">
                <p className="text-sm opacity-90 mb-2">Pension Contributions</p>
                <p className="text-3xl font-extrabold">{formatNGN(pensionQuery.data?.totalContributions ?? 0)}</p>
                <p className="text-xs opacity-80 mt-1">{pensions.length} employer remittances</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-[15px] flex items-center gap-2"><PieChart className="h-4.5 w-4.5 text-sky-700" /> Revenue by Category</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'TSA Collections', value: govSummary?.totalValueNGN ?? 0, color: 'bg-sky-700' },
                  { label: 'Tax (CIT/VAT/WHT)', value: taxQuery.data?.totalPaidNGN ?? 0, color: 'bg-violet-600' },
                  { label: 'Pension', value: pensionQuery.data?.totalContributions ?? 0, color: 'bg-emerald-600' },
                ].map(item => {
                  const total = (govSummary?.totalValueNGN ?? 0) + (taxQuery.data?.totalPaidNGN ?? 0) + (pensionQuery.data?.totalContributions ?? 0);
                  return (
                    <div key={item.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{item.label}</span>
                        <span className="font-semibold">{formatNGN(item.value)}</span>
                      </div>
                      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', item.color)} style={{ width: `${total > 0 ? (item.value / total) * 100 : 0}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-[15px] flex items-center gap-2"><Heart className="h-4.5 w-4.5 text-red-600" /> Social Programs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {socials.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{s.programName}</p>
                      <p className="text-[11px] text-muted-foreground">{s.programCode}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold font-mono text-sm">{formatNGN(s.totalAmount)}</p>
                      <p className="text-[10px] text-muted-foreground">{(s.beneficiaryCount / 1e6).toFixed(1)}M beneficiaries</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-[15px] flex items-center gap-2"><FileText className="h-4.5 w-4.5 text-orange-600" /> Regulatory Reports Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {reports.map((r, i) => (
                  <div key={i} className={cn('p-3.5 bg-muted/50 rounded-lg border-l-4', r.status === 'SUBMITTED' ? 'border-l-emerald-500' : r.status === 'PENDING' ? 'border-l-amber-500' : 'border-l-red-500')}>
                    <p className="font-bold text-sm">{r.reportType}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{r.period} · {r.submittedTo}</p>
                    <div className="flex justify-between mt-2">
                      <StatusBadge status={r.status} />
                      <span className="text-[10px] text-muted-foreground">Ref: {r.reference}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* TSA Tab */}
      {activeTab === 'tsa' && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {['ID', 'MDA', 'TSA Code', 'Revenue Code', 'Amount', 'GIFMIS Ref', 'Status', 'Completed'].map(h => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {govPayments.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.id}</TableCell>
                    <TableCell className="font-semibold">{p.beneficiaryMda}</TableCell>
                    <TableCell className="font-mono">{p.tsaCode}</TableCell>
                    <TableCell className="font-mono">{p.revenueCode}</TableCell>
                    <TableCell className="font-mono font-bold">{formatNGN(p.amount)}</TableCell>
                    <TableCell className="font-mono text-xs">{p.gifmisRef || '—'}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">{p.completedAt ? new Date(p.completedAt).toLocaleString() : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Tax Tab */}
      {activeTab === 'tax' && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {['ID', 'Tax Type', 'Payer', 'TIN', 'Tax Office', 'Amount', 'Penalty', 'Interest', 'Total', 'Status', 'Receipt'].map(h => (
                      <TableHead key={h}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taxes.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs">{t.id}</TableCell>
                      <TableCell><span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-100 text-indigo-800">{t.taxType}</span></TableCell>
                      <TableCell className="font-semibold">{t.payerName}</TableCell>
                      <TableCell className="font-mono text-xs">{t.payerTin}</TableCell>
                      <TableCell className="text-xs">{t.taxOffice}</TableCell>
                      <TableCell className="font-mono">{formatNGN(t.amount)}</TableCell>
                      <TableCell className={cn('font-mono', t.penalty > 0 ? 'text-red-500' : 'text-muted-foreground')}>{t.penalty > 0 ? formatNGN(t.penalty) : '—'}</TableCell>
                      <TableCell className={cn('font-mono', t.interest > 0 ? 'text-amber-500' : 'text-muted-foreground')}>{t.interest > 0 ? formatNGN(t.interest) : '—'}</TableCell>
                      <TableCell className="font-mono font-bold">{formatNGN(t.totalAmount)}</TableCell>
                      <TableCell><StatusBadge status={t.status} /></TableCell>
                      <TableCell className="font-mono text-[11px]">{t.receiptNumber || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pension Tab */}
      {activeTab === 'pension' && (
        <div className="space-y-4">
          {pensions.map(p => (
            <Card key={p.id}>
              <CardContent className="p-5">
                <div className="flex justify-between mb-3">
                  <div>
                    <p className="text-base font-bold">{p.pfaName}</p>
                    <p className="text-sm text-muted-foreground">{p.employerName} · {p.pfaCode} · Period: {p.period}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Employees:</span> <strong>{p.employeeCount.toLocaleString()}</strong></div>
                  <div><span className="text-muted-foreground">Employer (10%):</span> <strong>{formatNGN(p.employerContribution)}</strong></div>
                  <div><span className="text-muted-foreground">Employee (8%):</span> <strong>{formatNGN(p.employeeContribution)}</strong></div>
                  <div><span className="text-muted-foreground">Voluntary:</span> <strong>{formatNGN(p.voluntaryContribution)}</strong></div>
                  <div><span className="text-muted-foreground">Total:</span> <strong className="text-base text-emerald-600">{formatNGN(p.totalAmount)}</strong></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Social Tab */}
      {activeTab === 'social' && (
        <div className="space-y-4">
          {socials.map(s => (
            <Card key={s.id}>
              <CardContent className="p-5">
                <div className="flex justify-between mb-3">
                  <div>
                    <p className="text-base font-bold">{s.programName}</p>
                    <p className="text-sm text-muted-foreground">{s.programCode} · {s.initiatedBy}</p>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Beneficiaries:</span> <strong>{s.beneficiaryCount.toLocaleString()}</strong></div>
                  <div><span className="text-muted-foreground">Amount/Person:</span> <strong>{formatNGN(s.amountPerBeneficiary)}</strong></div>
                  <div><span className="text-muted-foreground">Total:</span> <strong className="text-base text-red-600">{formatNGN(s.totalAmount)}</strong></div>
                  <div><span className="text-muted-foreground">Disbursed:</span> <strong className="text-emerald-500">{s.disbursedCount.toLocaleString()}</strong></div>
                  <div><span className="text-muted-foreground">Failed:</span> <strong className="text-red-500">{s.failedCount.toLocaleString()}</strong></div>
                </div>
                <div className="mt-3">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(s.disbursedCount / s.beneficiaryCount * 100)}%` }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{(s.disbursedCount / s.beneficiaryCount * 100).toFixed(1)}% disbursed</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {['ID', 'Report Type', 'Period', 'Records', 'Total Value', 'Submitted To', 'Reference', 'Status', 'Generated'].map(h => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.id}</TableCell>
                    <TableCell><span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-100 text-indigo-800">{r.reportType}</span></TableCell>
                    <TableCell className="font-semibold">{r.period}</TableCell>
                    <TableCell className="font-mono">{r.recordCount.toLocaleString()}</TableCell>
                    <TableCell className="font-mono font-semibold">{formatNGN(r.totalValue)}</TableCell>
                    <TableCell>{r.submittedTo}</TableCell>
                    <TableCell className="font-mono text-xs">{r.reference}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">{new Date(r.generatedAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </ModuleLayout>
  );
}
