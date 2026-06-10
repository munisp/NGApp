import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Code, CheckCircle, Shield, Zap, Users, Server, BarChart3, TrendingUp, Box, LayoutDashboard } from 'lucide-react';
import ModuleLayout from '@/components/ModuleLayout';
import type { NavItem, ModuleConfig } from '@/components/ModuleLayout';
import MetricCard from '@/components/MetricCard';
import StatusBadge from '@/components/StatusBadge';
import PageHeader from '@/components/PageHeader';
import { formatCompact } from '@/lib/currency';
import { cn } from '@/lib/utils';

const MODULE: ModuleConfig = {
  title: 'Open Banking',
  subtitle: 'API Marketplace',
  icon: Code,
  accentColor: 'text-sky-500',
  accentBg: 'bg-sky-500',
  accentHover: 'hover:bg-sky-600',
};

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tpps', label: 'Third-Party Providers', icon: Users },
  { id: 'consents', label: 'Consents', icon: Shield },
  { id: 'api_catalog', label: 'API Services', icon: Server },
  { id: 'sandboxes', label: 'Sandboxes', icon: Box },
];

const TIER_STYLES: Record<string, string> = {
  ENTERPRISE: 'bg-amber-100 text-amber-800',
  GROWTH: 'bg-blue-100 text-blue-800',
  STARTER: 'bg-green-100 text-green-800',
  SANDBOX: 'bg-gray-100 text-gray-600',
};

const METHOD_STYLES: Record<string, string> = {
  GET: 'bg-green-100 text-green-800',
  POST: 'bg-blue-100 text-blue-800',
  PUT: 'bg-amber-100 text-amber-800',
  DELETE: 'bg-red-100 text-red-800',
};

const SERVICE_STYLES: Record<string, string> = {
  AIS: 'bg-blue-100 text-blue-800',
  PIS: 'bg-green-100 text-green-800',
};

export default function OpenBanking() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const tppsQuery = trpc.openBanking.listTPPs.useQuery(undefined, { retry: false });
  const consentsQuery = trpc.openBanking.listConsents.useQuery(undefined, { retry: false });
  const endpointsQuery = trpc.openBanking.listEndpoints.useQuery(undefined, { retry: false });
  const sandboxQuery = trpc.openBanking.listSandboxes.useQuery(undefined, { retry: false });

  const tpps = tppsQuery.data?.tpps ?? [];
  const tppSummary = tppsQuery.data?.summary;
  const consents = consentsQuery.data?.consents ?? [];
  const consentSummary = consentsQuery.data?.summary;
  const endpoints = endpointsQuery.data?.endpoints ?? [];
  const sandboxes = sandboxQuery.data?.sandboxes ?? [];

  return (
    <ModuleLayout module={MODULE} navItems={NAV_ITEMS} activeTab={activeTab} onTabChange={setActiveTab}>
      <PageHeader
        title={NAV_ITEMS.find(n => n.id === activeTab)?.label ?? 'Dashboard'}
        subtitle="AIS, PIS, Consent Management, Developer Sandbox"
        icon={Code}
      />

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard title="TPPs" value={tppSummary?.totalTPPs ?? 0} icon={Users} />
        <MetricCard title="Active" value={tppSummary?.activeTPPs ?? 0} icon={CheckCircle} variant="success" />
        <MetricCard title="API Calls" value={formatCompact(tppSummary?.totalApiCalls ?? 0)} icon={Zap} />
        <MetricCard title="Consents" value={consentSummary?.authorized ?? 0} icon={Shield} variant="success" />
        <MetricCard title="Endpoints" value={endpoints.length} icon={Server} variant="warning" />
      </div>

      {/* Dashboard */}
      {activeTab === 'dashboard' && (
        <>
          <div className="grid md:grid-cols-3 gap-5">
            <Card className="bg-gradient-to-br from-sky-500 to-sky-400 text-white border-0">
              <CardContent className="p-6">
                <p className="text-sm opacity-90 mb-2">Total API Calls (Monthly)</p>
                <p className="text-3xl font-extrabold">{formatCompact(tppSummary?.totalApiCalls ?? 0)}</p>
                <p className="text-xs opacity-80 mt-1 flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> {formatCompact(endpointsQuery.data?.totalCalls24h ?? 0)} in last 24h</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-600 to-emerald-500 text-white border-0">
              <CardContent className="p-6">
                <p className="text-sm opacity-90 mb-2">Active Consents</p>
                <p className="text-3xl font-extrabold">{consentSummary?.authorized ?? 0}</p>
                <p className="text-xs opacity-80 mt-1">{consentSummary?.revoked ?? 0} revoked, {consentSummary?.expired ?? 0} expired</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-violet-600 to-violet-500 text-white border-0">
              <CardContent className="p-6">
                <p className="text-sm opacity-90 mb-2">Registered TPPs</p>
                <p className="text-3xl font-extrabold">{tppSummary?.totalTPPs ?? 0}</p>
                <p className="text-xs opacity-80 mt-1">{tppSummary?.activeTPPs ?? 0} active, {sandboxes.length} sandboxes</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-[15px] flex items-center gap-2"><BarChart3 className="h-4.5 w-4.5 text-sky-500" /> TPP Tier Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {['ENTERPRISE', 'GROWTH', 'STARTER', 'SANDBOX'].map(tier => {
                  const count = tpps.filter(t => t.apiTier === tier).length;
                  return (
                    <div key={tier} className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-lg">
                      <span className={cn('px-2.5 py-0.5 rounded-full text-[11px] font-semibold min-w-[80px] text-center', TIER_STYLES[tier] || 'bg-gray-100 text-gray-600')}>{tier}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-sky-500 rounded-full" style={{ width: `${(tpps.length > 0 ? count / tpps.length : 0) * 100}%` }} />
                      </div>
                      <span className="text-sm font-semibold">{count}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-[15px] flex items-center gap-2"><Shield className="h-4.5 w-4.5 text-emerald-600" /> Consent Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: 'Authorized', value: consentSummary?.authorized ?? 0, total: consentSummary?.totalConsents ?? 1, color: 'bg-emerald-500' },
                  { label: 'Revoked', value: consentSummary?.revoked ?? 0, total: consentSummary?.totalConsents ?? 1, color: 'bg-red-500' },
                  { label: 'Expired', value: consentSummary?.expired ?? 0, total: consentSummary?.totalConsents ?? 1, color: 'bg-gray-400' },
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
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-[15px] flex items-center gap-2"><Code className="h-4.5 w-4.5 text-orange-600" /> Top API Endpoints</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {endpoints.sort((a, b) => b.callsLast24h - a.callsLast24h).slice(0, 6).map((ep, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold font-mono', METHOD_STYLES[ep.method] || 'bg-gray-100')}>{ep.method}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-xs font-mono truncate">{ep.path}</p>
                      <p className="text-[11px] text-muted-foreground">{ep.serviceType} · p{ep.avgLatencyMs}ms</p>
                    </div>
                    <span className="text-sm font-bold text-sky-500">{formatCompact(ep.callsLast24h)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* TPPs Tab */}
      {activeTab === 'tpps' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {tpps.map(t => (
            <Card key={t.id}>
              <CardContent className="p-5">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <p className="text-base font-bold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.registrationNumber} · {t.cbnLicense}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={t.status} />
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold', TIER_STYLES[t.apiTier] || 'bg-gray-100 text-gray-600')}>{t.apiTier}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Services:</span> <strong>{t.services.join(', ')}</strong></div>
                  <div><span className="text-muted-foreground">Monthly Calls:</span> <strong>{formatCompact(t.monthlyApiCalls)}</strong></div>
                  <div><span className="text-muted-foreground">Rate Limit:</span> <strong>{t.rateLimitPerMin}/min</strong></div>
                  <div><span className="text-muted-foreground">Contact:</span> <strong>{t.contactEmail}</strong></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Consents Tab */}
      {activeTab === 'consents' && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {['ID', 'Customer', 'TPP', 'Service', 'Permissions', 'Accounts', 'Status', 'Valid Until'].map(h => (
                      <TableHead key={h}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consents.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.id}</TableCell>
                      <TableCell>
                        <div className="font-semibold">{c.customerName}</div>
                        <div className="text-[11px] text-muted-foreground">{c.customerId}</div>
                      </TableCell>
                      <TableCell>{c.tppName}</TableCell>
                      <TableCell><span className={cn('px-1.5 py-0.5 rounded text-[11px] font-semibold', SERVICE_STYLES[c.serviceType] || 'bg-gray-100')}>{c.serviceType}</span></TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {c.permissions.map(p => <span key={p} className="px-1 py-0.5 rounded text-[10px] bg-muted">{p}</span>)}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-[11px]">{c.accounts.join(', ')}</TableCell>
                      <TableCell><StatusBadge status={c.status} /></TableCell>
                      <TableCell className="text-xs">{new Date(c.validUntil).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* API Catalog Tab */}
      {activeTab === 'api_catalog' && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {['Method', 'Path', 'Description', 'Service', 'Version', 'Avg Latency', '24h Calls'].map(h => (
                      <TableHead key={h}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {endpoints.map(e => (
                    <TableRow key={e.id}>
                      <TableCell><span className={cn('px-2 py-0.5 rounded text-[11px] font-bold font-mono', METHOD_STYLES[e.method] || 'bg-gray-100')}>{e.method}</span></TableCell>
                      <TableCell className="font-mono text-xs font-semibold">{e.path}</TableCell>
                      <TableCell>{e.description}</TableCell>
                      <TableCell><span className={cn('px-1.5 py-0.5 rounded text-[11px] font-semibold', SERVICE_STYLES[e.serviceType] || 'bg-gray-100')}>{e.serviceType}</span></TableCell>
                      <TableCell className="font-mono">{e.version}</TableCell>
                      <TableCell>
                        <span className={cn('font-semibold', e.avgLatencyMs > 200 ? 'text-amber-500' : 'text-emerald-500')}>{e.avgLatencyMs}ms</span>
                      </TableCell>
                      <TableCell className="font-mono font-semibold">{e.callsLast24h.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sandboxes Tab */}
      {activeTab === 'sandboxes' && (
        <div className="space-y-4">
          {sandboxes.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <Code className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-base font-semibold">No active sandboxes</p>
              <p className="text-sm">Register a TPP in SANDBOX tier to create a test environment</p>
            </div>
          )}
          {sandboxes.map(s => (
            <Card key={s.id}>
              <CardContent className="p-5">
                <div className="flex justify-between mb-3">
                  <div>
                    <p className="text-base font-bold">{s.tppName} Sandbox</p>
                    <p className="text-xs text-muted-foreground">{s.id} · Created {new Date(s.createdAt).toLocaleDateString()}</p>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
                <div className="bg-muted/50 rounded-lg p-3 mb-3 font-mono text-xs">
                  <span className="text-muted-foreground">Test API Key:</span> <strong>{s.testApiKey}</strong>
                </div>
                <div className="text-sm">
                  <strong>Test Accounts:</strong>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                    {s.testAccounts.map((a: { id: string; name: string; balance: number; currency: string; type: string }) => (
                      <div key={a.id} className="p-2 bg-muted/50 rounded-md text-xs">
                        <p className="font-semibold">{a.name}</p>
                        <p className="text-muted-foreground">{a.currency} {a.balance.toLocaleString()} · {a.type}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Total Test Calls: <strong>{s.totalTestCalls.toLocaleString()}</strong></p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </ModuleLayout>
  );
}
