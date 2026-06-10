import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowDownLeft, Globe, Building2, Shield, AlertTriangle, CheckCircle, Clock, XCircle, BarChart3, TrendingUp, Activity, LayoutDashboard, ArrowRightLeft, Map, Network, Layers, Search, Zap, ShieldAlert } from 'lucide-react';
import ModuleLayout from '@/components/ModuleLayout';
import type { NavItem, ModuleConfig } from '@/components/ModuleLayout';
import MetricCard from '@/components/MetricCard';
import StatusBadge from '@/components/StatusBadge';
import PageHeader from '@/components/PageHeader';
import { formatNGN, formatUSD, formatCompact } from '@/lib/currency';
import { cn } from '@/lib/utils';

const MODULE: ModuleConfig = {
  title: 'Inbound Remittance',
  subtitle: 'Payment Switch Module',
  icon: ArrowDownLeft,
  accentColor: 'text-emerald-600',
  accentBg: 'bg-emerald-600',
  accentHover: 'hover:bg-emerald-700',
};

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transfers', label: 'Transfers', icon: ArrowRightLeft },
  { id: 'corridors', label: 'Corridors', icon: Map },
  { id: 'banks', label: 'Receiving Banks', icon: Building2 },
  { id: 'ai_prophet', label: 'Volume Forecasting', icon: TrendingUp, section: 'Intelligence' },
  { id: 'ai_cocoindex', label: 'Data Pipeline', icon: Layers, section: 'Intelligence' },
  { id: 'ai_kgqa', label: 'Knowledge Search', icon: Search, section: 'Intelligence' },
  { id: 'ai_falkordb', label: 'Graph Analytics', icon: Network, section: 'Intelligence' },
  { id: 'ai_ollama', label: 'AI Assistant', icon: Zap, section: 'Intelligence' },
  { id: 'ai_art', label: 'Model Security', icon: ShieldAlert, section: 'Intelligence' },
  { id: 'ai_gnn', label: 'Fraud Networks', icon: Network, section: 'Intelligence' },
  { id: 'ai_mcmc', label: 'Risk Scoring', icon: Activity, section: 'Intelligence' },
];

const RAIL_STYLES: Record<string, string> = {
  SWIFT: 'bg-blue-600 text-white', PAPSS: 'bg-green-600 text-white', CIPS: 'bg-red-600 text-white',
  UPI: 'bg-orange-600 text-white', SEPA: 'bg-indigo-600 text-white', ACH: 'bg-gray-600 text-white',
  FASTER_PAY: 'bg-purple-600 text-white', MOBILE_MONEY: 'bg-yellow-600 text-white',
};

export default function InboundRemittance() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [statusFilter, setStatusFilter] = useState('');
  const [railFilter, setRailFilter] = useState('');

  const transfersQuery = trpc.inboundRemittance.listTransfers.useQuery(
    { status: statusFilter || undefined, sourceRail: railFilter || undefined },
    { retry: false }
  );
  const corridorsQuery = trpc.inboundRemittance.listCorridors.useQuery(undefined, { retry: false });
  const banksQuery = trpc.inboundRemittance.listReceivingBanks.useQuery(undefined, { retry: false });

  const transfers = transfersQuery.data?.transfers ?? [];
  const summary = transfersQuery.data?.summary;
  const corridors = corridorsQuery.data?.corridors ?? [];
  const banks = banksQuery.data?.banks ?? [];

  return (
    <ModuleLayout module={MODULE} navItems={NAV_ITEMS} activeTab={activeTab} onTabChange={setActiveTab}>
      <PageHeader
        title={NAV_ITEMS.find(n => n.id === activeTab)?.label ?? 'Dashboard'}
        subtitle="Receiving international transfers into Nigerian accounts"
        icon={ArrowDownLeft}
      />

      {/* Summary Metrics */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard title="Total Received" value={summary.totalReceived} icon={ArrowDownLeft} />
          <MetricCard title="Credited" value={summary.credited} icon={CheckCircle} variant="success" />
          <MetricCard title="Held for Review" value={summary.held} icon={AlertTriangle} variant="warning" />
          <MetricCard title="Failed" value={summary.failed} icon={XCircle} variant="danger" />
          <MetricCard title="Processing" value={summary.processing} icon={Clock} />
          <MetricCard title="Total Volume" value={formatNGN(summary.totalVolumeNGN)} icon={Building2} variant="success" />
        </div>
      )}

      {/* Dashboard */}
      {activeTab === 'dashboard' && summary && (
        <>
          <div className="grid md:grid-cols-3 gap-5">
            <Card className="bg-gradient-to-br from-emerald-600 to-emerald-500 text-white border-0">
              <CardContent className="p-6">
                <p className="text-sm opacity-90 mb-2">Today's Inflow Volume</p>
                <p className="text-3xl font-extrabold">{formatNGN(summary.totalVolumeNGN)}</p>
                <p className="text-xs opacity-80 mt-1 flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> +12.4% vs yesterday</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-600 to-blue-500 text-white border-0">
              <CardContent className="p-6">
                <p className="text-sm opacity-90 mb-2">Success Rate</p>
                <p className="text-3xl font-extrabold">{summary.totalReceived > 0 ? ((summary.credited / summary.totalReceived) * 100).toFixed(1) : 0}%</p>
                <p className="text-xs opacity-80 mt-1">{summary.credited} of {summary.totalReceived} transfers credited</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-violet-600 to-violet-500 text-white border-0">
              <CardContent className="p-6">
                <p className="text-sm opacity-90 mb-2">Active Corridors</p>
                <p className="text-3xl font-extrabold">{corridors.filter(c => c.isActive).length}</p>
                <p className="text-xs opacity-80 mt-1">of {corridors.length} total corridors</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-[15px] flex items-center gap-2"><BarChart3 className="h-4.5 w-4.5 text-emerald-600" /> Transfer Status Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Credited', value: summary.credited, total: summary.totalReceived, color: 'bg-emerald-500' },
                  { label: 'Screening Held', value: summary.held, total: summary.totalReceived, color: 'bg-amber-500' },
                  { label: 'Processing', value: summary.processing, total: summary.totalReceived, color: 'bg-violet-500' },
                  { label: 'Failed', value: summary.failed, total: summary.totalReceived, color: 'bg-red-500' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{item.label}</span>
                      <span className="font-semibold">{item.value} ({item.total > 0 ? ((item.value / item.total) * 100).toFixed(0) : 0}%)</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', item.color)} style={{ width: `${item.total > 0 ? (item.value / item.total) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-[15px] flex items-center gap-2"><Activity className="h-4.5 w-4.5 text-blue-600" /> Rail Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {['SWIFT', 'PAPSS', 'CIPS', 'UPI', 'SEPA'].map(rail => {
                  const count = transfers.filter(t => t.sourceRail === rail).length;
                  const vol = transfers.filter(t => t.sourceRail === rail).reduce((s, t) => s + t.destAmount, 0);
                  return (
                    <div key={rail} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                      <span className={cn('px-2.5 py-0.5 rounded text-[11px] font-bold min-w-[60px] text-center', RAIL_STYLES[rail] || 'bg-gray-500 text-white')}>{rail}</span>
                      <span className="text-sm flex-1">{count} transfers</span>
                      <span className="text-sm font-semibold font-mono">{formatNGN(vol)}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-[15px] flex items-center gap-2"><Globe className="h-4.5 w-4.5 text-violet-600" /> Top Corridors by Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {corridors.sort((a, b) => b.dailyVolumeUSD - a.dailyVolumeUSD).slice(0, 6).map((c, i) => (
                  <div key={i} className={cn('p-3 bg-muted/50 rounded-lg border-l-4', i === 0 ? 'border-l-emerald-500' : i === 1 ? 'border-l-blue-500' : 'border-l-violet-500')}>
                    <p className="font-bold text-sm">{c.sourceCountryName}</p>
                    <p className="text-xl font-extrabold text-emerald-600 mt-1">{formatUSD(c.dailyVolumeUSD)}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{c.rails.join(' · ')} · {(c.avgSettlementMs / 1000).toFixed(0)}s avg</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Transfers Tab */}
      {activeTab === 'transfers' && (
        <>
          <div className="flex gap-3 mb-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                {['CREDITED', 'SCREENING_HELD', 'FAILED', 'FX_CONVERSION', 'RETURNED'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={railFilter} onValueChange={setRailFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="All Rails" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Rails</SelectItem>
                {['SWIFT', 'PAPSS', 'CIPS', 'UPI', 'SEPA'].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {['ID', 'Rail', 'Corridor', 'Sender', 'Beneficiary', 'Source Amt', 'NGN Amt', 'FX Rate', 'Status', 'Compliance', 'Time'].map(h => (
                        <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-xs">{t.id}</TableCell>
                        <TableCell><span className={cn('px-2 py-0.5 rounded text-[11px] font-semibold', RAIL_STYLES[t.sourceRail] || 'bg-gray-500 text-white')}>{t.sourceRail}</span></TableCell>
                        <TableCell>{t.sourceCountryName} → NG</TableCell>
                        <TableCell>{t.senderName}</TableCell>
                        <TableCell>
                          <div>{t.beneficiaryName}</div>
                          <div className="text-[11px] text-muted-foreground">{t.beneficiaryBank}</div>
                        </TableCell>
                        <TableCell className="font-mono">{t.sourceCurrency} {t.sourceAmount.toLocaleString()}</TableCell>
                        <TableCell className="font-mono font-semibold">{formatNGN(t.destAmount)}</TableCell>
                        <TableCell className="font-mono">{t.fxRate}</TableCell>
                        <TableCell><StatusBadge status={t.status} /></TableCell>
                        <TableCell>
                          <span className={cn('font-semibold', t.complianceScore > 50 ? 'text-red-500' : t.complianceScore > 25 ? 'text-amber-500' : 'text-emerald-500')}>{t.complianceScore}</span>
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">{new Date(t.receivedAt).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Corridors Tab */}
      {activeTab === 'corridors' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {corridors.map(c => (
            <Card key={c.id}>
              <CardContent className="p-5">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <p className="text-base font-bold">{c.sourceCountryName} → Nigeria</p>
                    <p className="text-xs text-muted-foreground">{c.id} · {c.sourceCurrency}</p>
                  </div>
                  <StatusBadge status={c.isActive ? 'ACTIVE' : 'SUSPENDED'} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Daily Volume:</span> <strong>{formatUSD(c.dailyVolumeUSD)}</strong></div>
                  <div><span className="text-muted-foreground">Avg Settlement:</span> <strong>{(c.avgSettlementMs / 1000).toFixed(0)}s</strong></div>
                  <div><span className="text-muted-foreground">Compliance:</span> <strong className={c.complianceLevel === 'enhanced' ? 'text-amber-500' : 'text-emerald-500'}>{c.complianceLevel}</strong></div>
                  <div><span className="text-muted-foreground">Rails:</span> <strong>{c.rails.join(', ')}</strong></div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Banks: {c.receivingBanks.join(', ')}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Receiving Banks Tab */}
      {activeTab === 'banks' && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {['Code', 'Bank Name', 'NIP Code', 'SWIFT Code', 'Daily Capacity', 'Status'].map(h => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {banks.map(b => (
                  <TableRow key={b.code}>
                    <TableCell className="font-mono font-semibold">{b.code}</TableCell>
                    <TableCell>{b.name}</TableCell>
                    <TableCell className="font-mono">{b.nipCode}</TableCell>
                    <TableCell className="font-mono">{b.swiftCode}</TableCell>
                    <TableCell className="font-mono">{formatUSD(b.dailyCapacity)}</TableCell>
                    <TableCell><StatusBadge status={b.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* AI/ML Tabs */}
      {activeTab.startsWith('ai_') && <InboundAIMLContent activeTab={activeTab} />}
    </ModuleLayout>
  );
}

// =============================================================================
// INBOUND AI/ML SECTION
// =============================================================================

function InbSourceBanner({ source }: { source: string }) {
  const isLive = source.includes('LIVE');
  return (
    <div className={cn('mb-4 p-3 rounded-lg border text-sm', isLive ? 'bg-green-50 border-green-300 text-green-800' : 'bg-amber-50 border-amber-300 text-amber-800')}>
      {source}
    </div>
  );
}

function InbMetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-xl font-bold mt-1">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function InboundAIMLContent({ activeTab }: { activeTab: string }) {
  const prophetQ = trpc.inboundRemittance.getInboundProphetPipeline.useQuery(undefined, { enabled: activeTab === 'ai_prophet' });
  const cocoQ = trpc.inboundRemittance.getInboundCocoIndex.useQuery(undefined, { enabled: activeTab === 'ai_cocoindex' });
  const kgqaQ = trpc.inboundRemittance.getInboundEPRKGQA.useQuery(undefined, { enabled: activeTab === 'ai_kgqa' });
  const falkorQ = trpc.inboundRemittance.getInboundFalkorDB.useQuery(undefined, { enabled: activeTab === 'ai_falkordb' });
  const ollamaQ = trpc.inboundRemittance.getInboundOllamaStatus.useQuery(undefined, { enabled: activeTab === 'ai_ollama' });
  const ollamaMut = trpc.inboundRemittance.queryInboundOllama.useMutation();
  const artQ = trpc.inboundRemittance.getInboundARTResults.useQuery(undefined, { enabled: activeTab === 'ai_art' });
  const gnnQ = trpc.inboundRemittance.getInboundGNNFraudNetworks.useQuery(undefined, { enabled: activeTab === 'ai_gnn' });
  const mcmcQ = trpc.inboundRemittance.getInboundMCMCFraudScoring.useQuery(undefined, { enabled: activeTab === 'ai_mcmc' });
  const [ollamaInput, setOllamaInput] = React.useState('');
  const [ollamaHistory, setOllamaHistory] = React.useState<{q:string;a:string}[]>([]);

  if (activeTab === 'ai_prophet') {
    const d = prophetQ.data as any;
    if (prophetQ.isLoading) return <div className="py-10 text-center text-muted-foreground">Loading Prophet...</div>;
    if (!d) return <div className="text-muted-foreground">No Prophet data</div>;
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold">Prophet Forecasting — Inbound Remittance</h2>
        <InbSourceBanner source={d._source} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <InbMetricCard label="Model" value={d.model.id} sub={d.model.framework} />
          <InbMetricCard label="MAPE" value={`${d.metrics.mape.toFixed(2)}%`} sub={`Confidence: ${d.metrics.confidenceScore.toFixed(1)}%`} />
          <InbMetricCard label="RMSE" value={d.metrics.rmse.toLocaleString()} sub={`MAE: ${d.metrics.mae.toLocaleString()}`} />
          <InbMetricCard label="CV Folds" value={d.metrics.crossValidationFolds} sub={`R\u00B2: ${d.metrics.rSquared.toFixed(4)}`} />
        </div>
        <Card><CardHeader><CardTitle className="text-sm">Cross-Validation</CardTitle></CardHeader><CardContent className="p-0">
          <Table><TableHeader><TableRow>{['Fold','MAPE','RMSE','R\u00B2'].map(h=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{d.crossValidation.map((cv:any)=><TableRow key={cv.fold}><TableCell>Fold {cv.fold}</TableCell><TableCell>{cv.mape.toFixed(2)}%</TableCell><TableCell>{cv.rmse.toLocaleString()}</TableCell><TableCell>{cv.rSquared.toFixed(4)}</TableCell></TableRow>)}</TableBody></Table>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Regressors</CardTitle></CardHeader><CardContent className="p-0">
          <Table><TableHeader><TableRow>{['Name','Description','Weight','Active'].map(h=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{d.regressors.map((r:any)=><TableRow key={r.name}><TableCell className="font-mono text-xs">{r.name}</TableCell><TableCell>{r.description}</TableCell><TableCell>{r.weight.toFixed(2)}</TableCell><TableCell>{r.active?'\u2713':'\u2717'}</TableCell></TableRow>)}</TableBody></Table>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Forecasts</CardTitle></CardHeader><CardContent className="p-0">
          <Table><TableHeader><TableRow>{['Date','Corridor','Predicted (\u20A6)','Lower','Upper','Tags'].map(h=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{d.forecasts.map((f:any,i:number)=><TableRow key={i}><TableCell>{f.date}</TableCell><TableCell>{f.corridor}</TableCell><TableCell className="font-bold">{'\u20A6'}{f.predicted.toLocaleString()}</TableCell><TableCell>{'\u20A6'}{f.lower.toLocaleString()}</TableCell><TableCell>{'\u20A6'}{f.upper.toLocaleString()}</TableCell><TableCell>{f.isSalaryDay&&<span className="text-[11px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">SALARY DAY</span>}{f.isHoliday&&<span className="text-[11px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded ml-1">HOLIDAY</span>}</TableCell></TableRow>)}</TableBody></Table>
        </CardContent></Card>
      </div>
    );
  }

  if (activeTab === 'ai_cocoindex') {
    const d = cocoQ.data as any;
    if (cocoQ.isLoading) return <div className="py-10 text-center text-muted-foreground">Loading CocoIndex...</div>;
    if (!d) return <div className="text-muted-foreground">No CocoIndex data</div>;
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold">CocoIndex Data Pipeline — Inbound Remittance</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <InbMetricCard label="Pipeline" value={d.pipeline.name} sub={d.pipeline.framework} />
          <InbMetricCard label="Total Docs" value={d.stats.totalDocs.toLocaleString()} sub={`${d.stats.indexingRate.toLocaleString()} docs/s`} />
          <InbMetricCard label="Avg Latency" value={`${d.stats.avgLatencyMs}ms`} sub={`Cache: ${(d.stats.cacheHitRate*100).toFixed(0)}%`} />
          <InbMetricCard label="Status" value={d.pipeline.status} sub={d.pipeline.version} />
        </div>
        <Card><CardHeader><CardTitle className="text-sm">Data Sources</CardTitle></CardHeader><CardContent className="p-0">
          <Table><TableHeader><TableRow>{['Source','Type','Status','Docs','Lag'].map(h=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{d.sources.map((s:any)=><TableRow key={s.name}><TableCell>{s.name}</TableCell><TableCell>{s.type}</TableCell><TableCell><StatusBadge status={s.status} /></TableCell><TableCell>{s.docsIndexed.toLocaleString()}</TableCell><TableCell>{s.lag}</TableCell></TableRow>)}</TableBody></Table>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <h3 className="font-semibold text-sm mb-2">Middleware</h3>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div><span className="text-muted-foreground">Kafka:</span> {d.middleware.kafka}</div>
            <div><span className="text-muted-foreground">Fluvio:</span> {d.middleware.fluvio}</div>
            <div><span className="text-muted-foreground">Redis:</span> {d.middleware.redis}</div>
          </div>
        </CardContent></Card>
      </div>
    );
  }

  if (activeTab === 'ai_kgqa') {
    const d = kgqaQ.data as any;
    if (kgqaQ.isLoading) return <div className="py-10 text-center text-muted-foreground">Loading KG QA...</div>;
    if (!d) return <div className="text-muted-foreground">No KGQA data</div>;
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold">EPR-KGQA — Knowledge Graph QA (Inbound)</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <InbMetricCard label="Nodes" value={d.graph.nodes.toLocaleString()} sub={d.graph.nodeTypes.join(', ')} />
          <InbMetricCard label="Edges" value={d.graph.edges.toLocaleString()} sub={d.graph.edgeTypes.join(', ')} />
          <InbMetricCard label="Queries" value={d.stats.totalQueries.toLocaleString()} sub={`Cache: ${(d.stats.cacheHitRate*100).toFixed(0)}%`} />
          <InbMetricCard label="Avg Latency" value={`${d.stats.avgLatencyMs}ms`} sub={d.graph.framework} />
        </div>
        <Card><CardHeader><CardTitle className="text-sm">Recent Queries</CardTitle></CardHeader><CardContent className="space-y-4">
          {d.recentQueries.map((q:any,i:number)=>(
            <div key={i} className={cn(i < d.recentQueries.length - 1 && 'pb-4 border-b')}>
              <p className="font-semibold text-sm mb-1">{q.question}</p>
              <pre className="bg-muted p-2 rounded-md text-[11px] overflow-x-auto mb-1">{q.cypher}</pre>
              <p className="text-sm">{q.answer}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{q.latencyMs}ms · {q.tokens} tokens</p>
            </div>
          ))}
        </CardContent></Card>
      </div>
    );
  }

  if (activeTab === 'ai_falkordb') {
    const d = falkorQ.data as any;
    if (falkorQ.isLoading) return <div className="py-10 text-center text-muted-foreground">Loading FalkorDB...</div>;
    if (!d) return <div className="text-muted-foreground">No FalkorDB data</div>;
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold">FalkorDB Graph Engine — Inbound Remittance</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <InbMetricCard label="Nodes" value={d.stats.totalNodes.toLocaleString()} sub={`${d.stats.totalEdges.toLocaleString()} edges`} />
          <InbMetricCard label="Avg Query" value={`${d.stats.avgQueryMs}ms`} sub={`${d.stats.queriesPerSec.toLocaleString()} QPS`} />
          <InbMetricCard label="Cache Hit" value={`${(d.stats.cacheHitRate*100).toFixed(0)}%`} sub={`Memory: ${d.stats.memoryMb}MB`} />
          <InbMetricCard label="Status" value={d.connection.status} sub={d.connection.graphName} />
        </div>
        <Card><CardHeader><CardTitle className="text-sm">Corridor Graph</CardTitle></CardHeader><CardContent className="p-0">
          <Table><TableHeader><TableRow>{['Corridor','Nodes','Edges','Avg Degree','Risk'].map(h=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{d.corridorGraph.map((c:any)=><TableRow key={c.corridor}><TableCell className="font-mono">{c.corridor}</TableCell><TableCell>{c.nodes.toLocaleString()}</TableCell><TableCell>{c.edges.toLocaleString()}</TableCell><TableCell>{c.avgDegree}</TableCell><TableCell><span className={cn('text-[11px] px-1.5 py-0.5 rounded', c.riskScore>0.15?'bg-red-100 text-red-800':'bg-green-100 text-green-800')}>{c.riskScore}</span></TableCell></TableRow>)}</TableBody></Table>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Recent Queries</CardTitle></CardHeader><CardContent className="space-y-3">
          {d.recentQueries.map((q:any,i:number)=>(
            <div key={i}>
              <pre className="bg-muted p-2 rounded-md text-[11px] overflow-x-auto">{q.query}</pre>
              <p className="text-sm mt-1">Result: {q.result} <span className="text-muted-foreground">({q.latencyUs}{'\u03BC'}s)</span></p>
            </div>
          ))}
        </CardContent></Card>
      </div>
    );
  }

  if (activeTab === 'ai_ollama') {
    const d = ollamaQ.data as any;
    if (ollamaQ.isLoading) return <div className="py-10 text-center text-muted-foreground">Loading Ollama...</div>;
    if (!d) return <div className="text-muted-foreground">No Ollama data</div>;
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold">Ollama LLM — Inbound Remittance</h2>
        <InbSourceBanner source={d._source} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <InbMetricCard label="Model" value={d.config.model} sub={d.config.framework} />
          <InbMetricCard label="Queries" value={d.stats.totalQueries} sub={`Avg: ${d.stats.avgLatencyMs}ms`} />
          <InbMetricCard label="Tokens" value={d.stats.totalTokensUsed.toLocaleString()} sub={`Uptime: ${d.stats.uptimeHours}h`} />
          <InbMetricCard label="Size" value={`${d.stats.modelSizeGb}GB`} sub={`Max: ${d.config.maxTokens}`} />
        </div>
        <Card><CardContent className="p-4">
          <h3 className="font-semibold text-sm mb-2">Interactive Query</h3>
          <div className="flex gap-2">
            <Input className="flex-1" placeholder="Ask about inbound remittance..." value={ollamaInput} onChange={e => setOllamaInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && ollamaInput.trim()) { const q = ollamaInput.trim(); setOllamaInput(''); ollamaMut.mutate({ question: q }, { onSuccess: (r: any) => setOllamaHistory(h => [...h, { q, a: r.answer }]) }); }}} />
            <Button disabled={ollamaMut.isPending || !ollamaInput.trim()} onClick={() => { const q = ollamaInput.trim(); setOllamaInput(''); ollamaMut.mutate({ question: q }, { onSuccess: (r: any) => setOllamaHistory(h => [...h, { q, a: r.answer }]) }); }}>
              {ollamaMut.isPending ? 'Thinking...' : 'Ask'}
            </Button>
          </div>
          {ollamaHistory.map((h, i) => (
            <div key={i} className="mt-3 pt-2 border-t">
              <p className="font-semibold text-sm">Q: {h.q}</p>
              <p className="text-sm mt-1 whitespace-pre-wrap">{h.a}</p>
            </div>
          ))}
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Recent Queries</CardTitle></CardHeader><CardContent className="space-y-2.5">
          {d.recentQueries.map((q:any,i:number)=>(
            <div key={i} className={cn(i < d.recentQueries.length - 1 && 'pb-2 border-b')}>
              <p className="font-semibold text-sm">{q.question}</p>
              <p className="text-sm mt-1">{q.answer}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{q.latencyMs}ms · {q.tokens} tokens · {q.category}</p>
            </div>
          ))}
        </CardContent></Card>
      </div>
    );
  }

  if (activeTab === 'ai_art') {
    const d = artQ.data as any;
    if (artQ.isLoading) return <div className="py-10 text-center text-muted-foreground">Loading ART...</div>;
    if (!d) return <div className="text-muted-foreground">No ART data</div>;
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold">IBM ART Robustness — Inbound Remittance</h2>
        <InbSourceBanner source={d._source} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <InbMetricCard label="Model" value={d.model.name} sub={d.model.framework} />
          <InbMetricCard label="Clean Accuracy" value={`${(d.model.accuracy*100).toFixed(1)}%`} sub={`${d.model.trainingSamples} samples`} />
          <InbMetricCard label="Robustness" value={`${(d.model.robustness*100).toFixed(1)}%`} sub={`${d.model.testSamples} test`} />
          <InbMetricCard label="Features" value={d.model.features?.length || d.model.features} />
        </div>
        <Card><CardHeader><CardTitle className="text-sm">Attack Results</CardTitle></CardHeader><CardContent className="p-0">
          <Table><TableHeader><TableRow>{['Attack','Type','Evasion','Clean','Adversarial','Status'].map(h=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{d.attacks.map((a:any)=><TableRow key={a.name}><TableCell>{a.name}</TableCell><TableCell>{a.type}</TableCell><TableCell>{(a.evasionRate*100).toFixed(1)}%</TableCell><TableCell>{(a.cleanAccuracy*100).toFixed(1)}%</TableCell><TableCell>{(a.adversarialAccuracy*100).toFixed(1)}%</TableCell><TableCell><StatusBadge status={a.status} /></TableCell></TableRow>)}</TableBody></Table>
        </CardContent></Card>
      </div>
    );
  }

  if (activeTab === 'ai_gnn') {
    const d = gnnQ.data as any;
    if (gnnQ.isLoading) return <div className="py-10 text-center text-muted-foreground">Loading GNN...</div>;
    if (!d) return <div className="text-muted-foreground">No GNN data</div>;
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold">GNN + Neo4j Fraud Detection — Inbound Remittance</h2>
        <InbSourceBanner source={d._source} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <InbMetricCard label="Model" value={d.model.name} sub={d.model.framework} />
          <InbMetricCard label="Accuracy" value={`${(d.model.accuracy*100).toFixed(1)}%`} sub={`\u00B1${(d.model.accuracyStd*100).toFixed(2)}%`} />
          <InbMetricCard label="AUC-ROC" value={d.model.aucRoc.toFixed(3)} sub={`${d.model.cvFolds} folds`} />
          <InbMetricCard label="Graph" value={`${(d.graphStats.nodes/1e6).toFixed(1)}M nodes`} sub={`${(d.graphStats.edges/1e6).toFixed(1)}M edges`} />
        </div>
        <Card><CardHeader><CardTitle className="text-sm">Detected Fraud Networks</CardTitle></CardHeader><CardContent className="p-0">
          <Table><TableHeader><TableRow>{['ID','Type','Nodes','Edges','Risk','Corridors','Description'].map(h=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{d.detectedNetworks.map((n:any)=><TableRow key={n.id}><TableCell className="font-mono text-[11px]">{n.id}</TableCell><TableCell>{n.type}</TableCell><TableCell>{n.nodes}</TableCell><TableCell>{n.edges}</TableCell><TableCell><span className={cn('text-[11px] px-1.5 py-0.5 rounded', n.risk_score>0.8?'bg-red-100 text-red-800':'bg-amber-100 text-amber-800')}>{n.risk_score}</span></TableCell><TableCell>{n.corridors.join(', ')}</TableCell><TableCell className="text-xs">{n.description}</TableCell></TableRow>)}</TableBody></Table>
        </CardContent></Card>
      </div>
    );
  }

  if (activeTab === 'ai_mcmc') {
    const d = mcmcQ.data as any;
    if (mcmcQ.isLoading) return <div className="py-10 text-center text-muted-foreground">Loading MCMC...</div>;
    if (!d) return <div className="text-muted-foreground">No MCMC data</div>;
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold">MCMC Bayesian Fraud Scoring — Inbound Remittance</h2>
        <InbSourceBanner source={d._source} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <InbMetricCard label="Framework" value={d.config.framework.split('(')[0].trim()} sub={d.config.framework} />
          <InbMetricCard label="Posterior Mean" value={d.scoring.posteriorMean.toFixed(6)} sub={`Std: ${d.scoring.posteriorStd.toFixed(6)}`} />
          <InbMetricCard label="HDI (94%)" value={`[${d.scoring.hdiLower.toFixed(4)}, ${d.scoring.hdiUpper.toFixed(4)}]`} sub={`R-hat: ${d.scoring.rHat.toFixed(3)}`} />
          <InbMetricCard label="Risk Level" value={d.scoring.riskLevel} sub={`${d.config.chains} chains \u00D7 ${d.config.samplesPerChain}`} />
        </div>
        <Card><CardContent className="p-4">
          <h3 className="font-semibold text-sm mb-2">Example Transaction</h3>
          <div className="text-sm space-y-1">
            <p><span className="text-muted-foreground">Corridor:</span> {d.scoring.exampleTransaction.corridor}</p>
            <p><span className="text-muted-foreground">Amount:</span> ${d.scoring.exampleTransaction.amountUsd.toLocaleString()}</p>
            <p><span className="text-muted-foreground">Direction:</span> {d.scoring.exampleTransaction.direction}</p>
          </div>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Corridor Risk Map</CardTitle></CardHeader><CardContent className="p-0">
          <Table><TableHeader><TableRow>{['Corridor','Base Risk','Label'].map(h=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{d.corridorRiskMap.map((c:any)=><TableRow key={c.corridor}><TableCell className="font-mono">{c.corridor}</TableCell><TableCell>{(c.baseRisk*100).toFixed(1)}%</TableCell><TableCell><span className={cn('text-[11px] px-1.5 py-0.5 rounded', c.label==='HIGH'?'bg-red-100 text-red-800':c.label==='MEDIUM'?'bg-amber-100 text-amber-800':'bg-green-100 text-green-800')}>{c.label}</span></TableCell></TableRow>)}</TableBody></Table>
        </CardContent></Card>
      </div>
    );
  }

  return <div className="text-muted-foreground">Select an AI/ML tab</div>;
}
