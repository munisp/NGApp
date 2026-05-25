import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard, ShieldCheck, AlertTriangle, Store, CheckCircle, BarChart3, Smartphone, TrendingUp, Activity, PieChart, LayoutDashboard, ArrowRightLeft } from 'lucide-react';
import ModuleLayout from '@/components/ModuleLayout';
import type { NavItem, ModuleConfig } from '@/components/ModuleLayout';
import MetricCard from '@/components/MetricCard';
import StatusBadge from '@/components/StatusBadge';
import PageHeader from '@/components/PageHeader';
import { formatNGN } from '@/lib/currency';
import { cn } from '@/lib/utils';

const MODULE: ModuleConfig = {
  title: 'Card Processing',
  subtitle: 'Payment Switch Module',
  icon: CreditCard,
  accentColor: 'text-red-600',
  accentBg: 'bg-red-600',
  accentHover: 'hover:bg-red-700',
};

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: ArrowRightLeft },
  { id: 'cards', label: 'Issued Cards', icon: CreditCard },
  { id: 'chargebacks', label: 'Chargebacks', icon: AlertTriangle },
  { id: 'terminals', label: 'Terminals', icon: Smartphone },
];

const SCHEME_STYLES: Record<string, string> = {
  VISA: 'bg-[#1a1f71] text-white',
  MASTERCARD: 'bg-[#eb001b] text-white',
  VERVE: 'bg-[#00425f] text-white',
};

const SCHEME_GRADIENTS: Record<string, string> = {
  VISA: 'from-[#1a1f71] to-[#2d3494]',
  MASTERCARD: 'from-[#eb001b] to-[#f79e1b]',
  VERVE: 'from-[#00425f] to-[#0078a0]',
};

const CHANNEL_STYLES: Record<string, string> = {
  POS: 'bg-blue-100 text-blue-800',
  WEB: 'bg-indigo-100 text-indigo-800',
  ATM: 'bg-amber-100 text-amber-800',
};

export default function CardProcessing() {
  const [activeTab, setActiveTab] = useState('dashboard');

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

  return (
    <ModuleLayout module={MODULE} navItems={NAV_ITEMS} activeTab={activeTab} onTabChange={setActiveTab}>
      <PageHeader
        title={NAV_ITEMS.find(n => n.id === activeTab)?.label ?? 'Dashboard'}
        subtitle="Issuing, Acquiring, 3DS, Chargebacks, Tokenization"
        icon={CreditCard}
      />

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard title="Cards" value={cardSummary?.totalCards ?? 0} icon={CreditCard} variant="danger" />
        <MetricCard title="Active" value={cardSummary?.activeCards ?? 0} icon={CheckCircle} variant="success" />
        <MetricCard title="Txns" value={txnSummary?.totalTxns ?? 0} icon={BarChart3} />
        <MetricCard title="Approval" value={`${txnSummary?.approvalRate ?? 0}%`} icon={ShieldCheck} />
        <MetricCard title="Volume" value={formatNGN(Number(txnSummary?.totalVolumeNGN ?? 0))} icon={Store} />
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <>
          <div className="grid md:grid-cols-3 gap-5">
            <Card className="bg-gradient-to-br from-red-600 to-red-500 text-white border-0">
              <CardContent className="p-6">
                <p className="text-sm opacity-90 mb-2">Total Card Volume</p>
                <p className="text-3xl font-extrabold">{formatNGN(Number(txnSummary?.totalVolumeNGN ?? 0))}</p>
                <p className="text-xs opacity-80 mt-1 flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> {txnSummary?.totalTxns ?? 0} transactions</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-600 to-emerald-500 text-white border-0">
              <CardContent className="p-6">
                <p className="text-sm opacity-90 mb-2">Approval Rate</p>
                <p className="text-3xl font-extrabold">{txnSummary?.approvalRate ?? 0}%</p>
                <p className="text-xs opacity-80 mt-1">{txnSummary?.approved ?? 0} approved, {txnSummary?.declined ?? 0} declined</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-[#1a1f71] to-[#3b4ebe] text-white border-0">
              <CardContent className="p-6">
                <p className="text-sm opacity-90 mb-2">Active Cards</p>
                <p className="text-3xl font-extrabold">{cardSummary?.activeCards ?? 0}</p>
                <p className="text-xs opacity-80 mt-1">of {cardSummary?.totalCards ?? 0} total issued</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-[15px] flex items-center gap-2"><PieChart className="h-4.5 w-4.5 text-red-600" /> Scheme Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {['VISA', 'MASTERCARD', 'VERVE'].map(scheme => {
                  const count = txns.filter(t => t.scheme === scheme).length;
                  const vol = txns.filter(t => t.scheme === scheme).reduce((s, t) => s + t.amount, 0);
                  return (
                    <div key={scheme} className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-lg">
                      <span className={cn('px-2 py-0.5 rounded text-[11px] font-bold min-w-[85px] text-center', SCHEME_STYLES[scheme] || 'bg-gray-500 text-white')}>{scheme}</span>
                      <span className="text-sm flex-1">{count} txns</span>
                      <span className="text-sm font-semibold font-mono">{formatNGN(vol)}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-[15px] flex items-center gap-2"><Activity className="h-4.5 w-4.5 text-emerald-600" /> Transaction Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: 'Approved', value: txnSummary?.approved ?? 0, total: txnSummary?.totalTxns ?? 1, color: 'bg-emerald-500' },
                  { label: 'Declined', value: txnSummary?.declined ?? 0, total: txnSummary?.totalTxns ?? 1, color: 'bg-red-500' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{item.label}</span>
                      <span className="font-semibold">{item.value} ({((item.value / item.total) * 100).toFixed(0)}%)</span>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full', item.color)} style={{ width: `${(item.value / item.total) * 100}%` }} />
                    </div>
                  </div>
                ))}
                <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-xs font-semibold text-red-800">Active Chargebacks</p>
                  <p className="text-2xl font-extrabold text-red-600">{cbQuery.data?.totalActive ?? 0}</p>
                  <p className="text-[11px] text-red-700 mt-0.5">of {chargebacks.length} total disputes</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-[15px] flex items-center gap-2"><Smartphone className="h-4.5 w-4.5 text-violet-600" /> Terminal Network</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {terminals.map((t, i) => (
                  <div key={i} className={cn('p-3.5 bg-muted/50 rounded-lg border-l-4', t.status === 'ACTIVE' ? 'border-l-emerald-500' : 'border-l-amber-500')}>
                    <p className="font-bold text-sm">{t.terminalId}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.merchantName}</p>
                    <p className="text-[11px] text-muted-foreground/70 mt-1">{t.type} · {t.location}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {['ID', 'Type', 'Scheme', 'Card', 'Channel', 'Merchant', 'Amount', 'Fee', '3DS', 'Risk', 'Status', 'Time'].map(h => (
                      <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txns.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs">{t.id}</TableCell>
                      <TableCell><span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-muted">{t.type}</span></TableCell>
                      <TableCell><span className={cn('px-2 py-0.5 rounded text-[11px] font-bold', SCHEME_STYLES[t.scheme] || 'bg-gray-500 text-white')}>{t.scheme}</span></TableCell>
                      <TableCell className="font-mono">****{t.cardLast4}</TableCell>
                      <TableCell><span className={cn('px-1.5 py-0.5 rounded text-[11px] font-semibold', CHANNEL_STYLES[t.channel] || 'bg-muted')}>{t.channel}</span></TableCell>
                      <TableCell>
                        <div>{t.merchantName}</div>
                        <div className="text-[11px] text-muted-foreground">{t.merchantCategory}</div>
                      </TableCell>
                      <TableCell className="font-mono font-semibold">{formatNGN(t.amount)}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{'\u20A6'}{t.feeAmount.toLocaleString()}</TableCell>
                      <TableCell>{t.is3DSVerified ? <ShieldCheck className="h-4 w-4 text-emerald-500" /> : <span className="text-muted-foreground/30">—</span>}</TableCell>
                      <TableCell>
                        <span className={cn('font-semibold', t.riskScore > 70 ? 'text-red-500' : t.riskScore > 40 ? 'text-amber-500' : 'text-emerald-500')}>{t.riskScore}</span>
                      </TableCell>
                      <TableCell><StatusBadge status={t.status} /></TableCell>
                      <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">{new Date(t.processedAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards Tab */}
      {activeTab === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(c => (
            <div key={c.id} className={cn('bg-gradient-to-br rounded-2xl p-5 text-white min-h-[180px] flex flex-col justify-between', SCHEME_GRADIENTS[c.scheme] || 'from-gray-600 to-gray-500')}>
              <div className="flex justify-between">
                <span className="text-sm font-bold opacity-90">{c.scheme}</span>
                <span className={cn('text-xs px-2 py-0.5 rounded', c.status === 'active' ? 'bg-white/20' : 'bg-red-500/30')}>{c.status}</span>
              </div>
              <div>
                <p className="text-xl font-mono tracking-widest mb-2">{'····'} {'····'} {'····'} {c.last4}</p>
                <div className="flex justify-between text-xs opacity-80">
                  <span>{c.holderName}</span>
                  <span>{String(c.expiryMonth).padStart(2, '0')}/{c.expiryYear}</span>
                </div>
              </div>
              <div className="flex justify-between text-[11px] opacity-70">
                <span>{c.type} · {c.issuerBankName}</span>
                <span>{c.is3DSEnrolled ? '3DS Enrolled' : 'No 3DS'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chargebacks Tab */}
      {activeTab === 'chargebacks' && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {['ID', 'Transaction', 'Cardholder', 'Merchant', 'Amount', 'Reason', 'Status', 'Filed', 'Due Date'].map(h => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {chargebacks.map(cb => (
                  <TableRow key={cb.id}>
                    <TableCell className="font-mono">{cb.id}</TableCell>
                    <TableCell className="font-mono text-xs">{cb.transactionId}</TableCell>
                    <TableCell>{cb.cardholderName}</TableCell>
                    <TableCell>{cb.merchantName}</TableCell>
                    <TableCell className="font-mono font-semibold">{formatNGN(cb.disputeAmount)}</TableCell>
                    <TableCell className="text-[11px]">[{cb.reasonCode}] {cb.reasonDesc}</TableCell>
                    <TableCell><StatusBadge status={cb.status} /></TableCell>
                    <TableCell className="text-[11px]">{new Date(cb.filedAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-[11px]">{new Date(cb.dueDate).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Terminals Tab */}
      {activeTab === 'terminals' && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {['Terminal ID', 'Merchant', 'MCC', 'Type', 'Location', 'Acquirer', 'Daily Volume', 'Status'].map(h => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {terminals.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono">{t.terminalId}</TableCell>
                    <TableCell className="font-semibold">{t.merchantName}</TableCell>
                    <TableCell className="text-[11px]">{t.mcc} · {t.mccDescription}</TableCell>
                    <TableCell><span className={cn('px-1.5 py-0.5 rounded text-[11px] font-semibold', CHANNEL_STYLES[t.type] || 'bg-muted')}>{t.type}</span></TableCell>
                    <TableCell className="text-xs">{t.location}</TableCell>
                    <TableCell>{t.acquirerBank}</TableCell>
                    <TableCell className="font-mono font-semibold">{formatNGN(t.dailyVolume)}</TableCell>
                    <TableCell><StatusBadge status={t.status} /></TableCell>
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
