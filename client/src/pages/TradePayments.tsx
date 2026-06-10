import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Ship, FileText, Lock, Landmark, Package, CheckCircle, Clock, BarChart3, TrendingUp, Activity, Globe, LayoutDashboard } from 'lucide-react';
import ModuleLayout from '@/components/ModuleLayout';
import type { NavItem, ModuleConfig } from '@/components/ModuleLayout';
import MetricCard from '@/components/MetricCard';
import StatusBadge from '@/components/StatusBadge';
import PageHeader from '@/components/PageHeader';
import { formatUSD, formatNGN } from '@/lib/currency';
import { cn } from '@/lib/utils';

const MODULE: ModuleConfig = {
  title: 'Trade Payments',
  subtitle: 'Payment Switch Module',
  icon: Ship,
  accentColor: 'text-violet-600',
  accentBg: 'bg-violet-600',
  accentHover: 'hover:bg-violet-700',
};

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'lcs', label: 'Letters of Credit', icon: FileText },
  { id: 'escrows', label: 'Escrow Payments', icon: Lock },
  { id: 'customs', label: 'Customs Duties', icon: Package },
];

export default function TradePayments() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [lcTypeFilter, setLcTypeFilter] = useState('');

  const lcsQuery = trpc.tradePayments.listLCs.useQuery({ type: lcTypeFilter || undefined }, { retry: false });
  const escrowsQuery = trpc.tradePayments.listEscrows.useQuery(undefined, { retry: false });
  const dutiesQuery = trpc.tradePayments.listCustomsDuties.useQuery(undefined, { retry: false });

  const lcs = lcsQuery.data?.lcs ?? [];
  const lcSummary = lcsQuery.data?.summary;
  const escrows = escrowsQuery.data?.escrows ?? [];
  const duties = dutiesQuery.data?.duties ?? [];

  return (
    <ModuleLayout module={MODULE} navItems={NAV_ITEMS} activeTab={activeTab} onTabChange={setActiveTab}>
      <PageHeader
        title={NAV_ITEMS.find(n => n.id === activeTab)?.label ?? 'Dashboard'}
        subtitle="LCs, Escrow, Customs Duties, Trade Finance"
        icon={Ship}
      />

      {/* Summary Metrics */}
      {lcSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard title="Total LCs" value={lcSummary.totalLCs} icon={FileText} />
          <MetricCard title="Import LCs" value={lcSummary.importLCs} icon={Package} />
          <MetricCard title="Export LCs" value={lcSummary.exportLCs} icon={Ship} variant="success" />
          <MetricCard title="Active" value={lcSummary.activeLCs} icon={Clock} variant="warning" />
          <MetricCard title="Total Value" value={formatUSD(lcSummary.totalValueUSD)} icon={Landmark} />
          <MetricCard title="Escrows" value={escrowsQuery.data?.totalActive ?? 0} icon={Lock} variant="danger" />
        </div>
      )}

      {/* Dashboard */}
      {activeTab === 'dashboard' && lcSummary && (
        <>
          <div className="grid md:grid-cols-3 gap-5">
            <Card className="bg-gradient-to-br from-violet-600 to-violet-500 text-white border-0">
              <CardContent className="p-6">
                <p className="text-sm opacity-90 mb-2">Total Trade Value</p>
                <p className="text-3xl font-extrabold">{formatUSD(lcSummary.totalValueUSD)}</p>
                <p className="text-xs opacity-80 mt-1 flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> {lcSummary.totalLCs} letters of credit</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-600 to-blue-500 text-white border-0">
              <CardContent className="p-6">
                <p className="text-sm opacity-90 mb-2">Import / Export Ratio</p>
                <p className="text-3xl font-extrabold">{lcSummary.importLCs} / {lcSummary.exportLCs}</p>
                <p className="text-xs opacity-80 mt-1">{lcSummary.activeLCs} currently active</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-red-600 to-red-500 text-white border-0">
              <CardContent className="p-6">
                <p className="text-sm opacity-90 mb-2">Active Escrows</p>
                <p className="text-3xl font-extrabold">{escrowsQuery.data?.totalActive ?? 0}</p>
                <p className="text-xs opacity-80 mt-1">{escrows.length} total escrow accounts</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-[15px] flex items-center gap-2"><BarChart3 className="h-4.5 w-4.5 text-violet-600" /> LC Status Pipeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {['ISSUED', 'ADVISED', 'CONFIRMED', 'DRAWN_DOWN', 'SETTLED', 'EXPIRED'].map(status => {
                  const count = lcs.filter(l => l.status === status).length;
                  return (
                    <div key={status}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{status.replace(/_/g, ' ')}</span>
                        <span className="font-semibold">{count}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-violet-600 rounded-full" style={{ width: `${lcs.length > 0 ? (count / lcs.length) * 100 : 0}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-[15px] flex items-center gap-2"><Globe className="h-4.5 w-4.5 text-blue-600" /> Customs Duties Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {duties.map((d, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{d.assessmentRef}</p>
                      <p className="text-[11px] text-muted-foreground">{d.importerName} · {d.hsCode}</p>
                    </div>
                    <span className="font-bold font-mono text-sm">{formatNGN(d.dutyAmount)}</span>
                    <StatusBadge status={d.status} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-[15px] flex items-center gap-2"><Activity className="h-4.5 w-4.5 text-emerald-600" /> Recent Escrow Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {escrows.slice(0, 4).map((e, i) => (
                  <div key={i} className={cn('p-3.5 bg-muted/50 rounded-lg border-l-4', e.status === 'ACTIVE' ? 'border-l-emerald-500' : e.status === 'RELEASED' ? 'border-l-blue-500' : 'border-l-amber-500')}>
                    <p className="font-bold text-sm">{e.id}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{e.buyerName} → {e.sellerName}</p>
                    <p className="text-xl font-extrabold text-violet-600 mt-2">{formatUSD(e.totalAmount)}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{e.milestones.filter(m => m.status === 'COMPLETED').length}/{e.milestones.length} milestones</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* LCs Tab */}
      {activeTab === 'lcs' && (
        <div className="space-y-4">
          <Select value={lcTypeFilter} onValueChange={setLcTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Types</SelectItem>
              <SelectItem value="import">Import</SelectItem>
              <SelectItem value="export">Export</SelectItem>
            </SelectContent>
          </Select>

          {lcs.map(lc => (
            <Card key={lc.id}>
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-base font-bold">{lc.lcNumber}</p>
                    <p className="text-sm text-muted-foreground">{lc.type.toUpperCase()} · Form {lc.type === 'export' ? 'A' : 'M'}: {lc.formMRef}</p>
                  </div>
                  <StatusBadge status={lc.status} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm mb-3">
                  <div><span className="text-muted-foreground">Applicant:</span> <strong>{lc.applicant}</strong><br/><span className="text-[11px] text-muted-foreground">{lc.applicantBank}</span></div>
                  <div><span className="text-muted-foreground">Beneficiary:</span> <strong>{lc.beneficiary}</strong><br/><span className="text-[11px] text-muted-foreground">{lc.beneficiaryBank}, {lc.beneficiaryCountry}</span></div>
                  <div><span className="text-muted-foreground">Amount:</span> <strong className="text-base">{lc.currency} {lc.amount.toLocaleString()}</strong></div>
                  <div><span className="text-muted-foreground">Goods:</span> <strong>{lc.goodsDescription}</strong></div>
                  <div><span className="text-muted-foreground">Route:</span> <strong>{lc.shipmentPort} → {lc.destinationPort}</strong></div>
                  <div><span className="text-muted-foreground">Expiry:</span> <strong>{new Date(lc.expiryDate).toLocaleDateString()}</strong></div>
                </div>
                {lc.documents.length > 0 && (
                  <div className="border-t pt-2">
                    <span className="text-xs font-semibold">Documents ({lc.documents.length}):</span>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {lc.documents.map(d => (
                        <StatusBadge key={d.id} status={d.status} className="text-[10px]" />
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Escrows Tab */}
      {activeTab === 'escrows' && (
        <div className="space-y-4">
          {escrows.map(e => (
            <Card key={e.id}>
              <CardContent className="p-5">
                <div className="flex justify-between mb-3">
                  <div>
                    <p className="text-base font-bold">{e.buyerName} ↔ {e.sellerName}</p>
                    <p className="text-sm text-muted-foreground">{e.id} · {e.currency} {e.totalAmount.toLocaleString()}</p>
                  </div>
                  <StatusBadge status={e.status} />
                </div>
                <div className="space-y-2">
                  {e.milestones.map((m, i) => (
                    <div key={m.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                      <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold',
                        m.status === 'released' ? 'bg-emerald-500' : m.status === 'buyer_approved' ? 'bg-blue-500' : 'bg-gray-300')}>
                        {m.status === 'released' ? <CheckCircle className="h-3.5 w-3.5" /> : i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{m.description}</p>
                        <p className="text-[11px] text-muted-foreground">Due: {new Date(m.dueDate).toLocaleDateString()}</p>
                      </div>
                      <span className="font-bold font-mono text-sm">${m.amount.toLocaleString()}</span>
                      <StatusBadge status={m.status} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Customs Tab */}
      {activeTab === 'customs' && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {['Assessment Ref', 'Importer', 'HS Code', 'Goods', 'Duty', 'VAT', 'Surcharge', 'Total', 'Port', 'Status'].map(h => (
                      <TableHead key={h}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {duties.map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs">{d.assessmentRef}</TableCell>
                      <TableCell className="font-semibold">{d.importerName}</TableCell>
                      <TableCell className="font-mono">{d.hsCode}</TableCell>
                      <TableCell className="text-xs">{d.goodsDesc}</TableCell>
                      <TableCell className="font-mono">{formatNGN(d.dutyAmount)}</TableCell>
                      <TableCell className="font-mono">{formatNGN(d.vatAmount)}</TableCell>
                      <TableCell className="font-mono">{formatNGN(d.surchargeAmount)}</TableCell>
                      <TableCell className="font-mono font-bold">{formatNGN(d.totalAmount)}</TableCell>
                      <TableCell className="text-xs">{d.portOfEntry}</TableCell>
                      <TableCell><StatusBadge status={d.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </ModuleLayout>
  );
}
