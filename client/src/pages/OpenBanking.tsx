import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Globe, Key, Shield, Code, CheckCircle, XCircle, Clock, Zap, Users, Server, BarChart3, TrendingUp, Activity, PieChart, LayoutDashboard, ArrowDownLeft, Banknote, Ship, CreditCard, Landmark, Box } from 'lucide-react';

type Tab = 'dashboard' | 'tpps' | 'consents' | 'api_catalog' | 'sandboxes';

const moduleLinks = [
  { label: 'Outbound Remittance', href: '/', icon: Globe, color: '#3b82f6' },
  { label: 'Inbound Remittance', href: '/inbound-remittance', icon: ArrowDownLeft, color: '#059669' },
  { label: 'Domestic Payments', href: '/domestic-payments', icon: Banknote, color: '#2563eb' },
  { label: 'Trade Payments', href: '/trade-payments', icon: Ship, color: '#7c3aed' },
  { label: 'Card Processing', href: '/card-processing', icon: CreditCard, color: '#dc2626' },
  { label: 'Government Payments', href: '/government-payments', icon: Landmark, color: '#0369a1' },
];

export default function OpenBanking() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

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

  const fmtCalls = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K` : String(n);

  const tierColor = (t: string) => {
    const m: Record<string, { bg: string; fg: string }> = {
      ENTERPRISE: { bg: '#fef3c7', fg: '#92400e' }, GROWTH: { bg: '#dbeafe', fg: '#1d4ed8' },
      STARTER: { bg: '#dcfce7', fg: '#166534' }, SANDBOX: { bg: '#f3f4f6', fg: '#6b7280' },
    };
    return m[t] || { bg: '#f3f4f6', fg: '#6b7280' };
  };

  const navItems: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tpps', label: 'TPP Registry', icon: Users },
    { id: 'consents', label: 'Consents', icon: Shield },
    { id: 'api_catalog', label: 'API Catalog', icon: Server },
    { id: 'sandboxes', label: 'Sandboxes', icon: Box },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <aside style={{ width: 250, borderRight: '1px solid #e5e7eb', background: '#fafafa', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Code size={22} color="#0ea5e9" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Open Banking</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>API Marketplace</div>
            </div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, width: '100%', textAlign: 'left',
                background: activeTab === item.id ? '#0ea5e9' : 'transparent', color: activeTab === item.id ? 'white' : '#374151' }}>
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
          <span style={{ fontSize: 13, color: '#6b7280' }}>AIS, PIS, Consent Management, Developer Sandbox</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'TPPs', value: tppSummary?.totalTPPs ?? 0, icon: Users, color: '#0ea5e9' },
            { label: 'Active', value: tppSummary?.activeTPPs ?? 0, icon: CheckCircle, color: '#10b981' },
            { label: 'API Calls', value: fmtCalls(tppSummary?.totalApiCalls ?? 0), icon: Zap, color: '#7c3aed' },
            { label: 'Consents', value: consentSummary?.authorized ?? 0, icon: Shield, color: '#059669' },
            { label: 'Endpoints', value: endpoints.length, icon: Server, color: '#ea580c' },
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

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 24 }}>
            <div style={{ background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', borderRadius: 16, padding: 24, color: 'white' }}>
              <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>Total API Calls (Monthly)</div>
              <div style={{ fontSize: 32, fontWeight: 800 }}>{fmtCalls(tppSummary?.totalApiCalls ?? 0)}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}><TrendingUp size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {fmtCalls(endpointsQuery.data?.totalCalls24h ?? 0)} in last 24h</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #059669, #10b981)', borderRadius: 16, padding: 24, color: 'white' }}>
              <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>Active Consents</div>
              <div style={{ fontSize: 32, fontWeight: 800 }}>{consentSummary?.authorized ?? 0}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{consentSummary?.revoked ?? 0} revoked, {consentSummary?.expired ?? 0} expired</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', borderRadius: 16, padding: 24, color: 'white' }}>
              <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>Registered TPPs</div>
              <div style={{ fontSize: 32, fontWeight: 800 }}>{tppSummary?.totalTPPs ?? 0}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{tppSummary?.activeTPPs ?? 0} active, {sandboxes.length} sandboxes</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><BarChart3 size={18} color="#0ea5e9" /> TPP Tier Distribution</h3>
              {['ENTERPRISE', 'GROWTH', 'STARTER', 'SANDBOX'].map((tier, i) => {
                const count = tpps.filter(t => t.tier === tier).length;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, padding: '10px 12px', background: '#f9fafb', borderRadius: 8 }}>
                    <span style={{ padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: tierColor(tier).bg, color: tierColor(tier).fg, minWidth: 80, textAlign: 'center' as const }}>{tier}</span>
                    <div style={{ flex: 1, height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(tpps.length > 0 ? count / tpps.length : 0) * 100}%`, background: '#0ea5e9', borderRadius: 4 }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{count}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Shield size={18} color="#059669" /> Consent Status</h3>
              {[
                { label: 'Authorized', value: consentSummary?.authorized ?? 0, total: consentSummary?.total ?? 1, color: '#10b981' },
                { label: 'Revoked', value: consentSummary?.revoked ?? 0, total: consentSummary?.total ?? 1, color: '#ef4444' },
                { label: 'Expired', value: consentSummary?.expired ?? 0, total: consentSummary?.total ?? 1, color: '#6b7280' },
              ].map((item, i) => (
                <div key={i} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span>{item.label}</span>
                    <span style={{ fontWeight: 600 }}>{item.value} ({((item.value / item.total) * 100).toFixed(0)}%)</span>
                  </div>
                  <div style={{ height: 10, background: '#f3f4f6', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(item.value / item.total) * 100}%`, background: item.color, borderRadius: 5 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Code size={18} color="#ea580c" /> Top API Endpoints</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {endpoints.sort((a, b) => b.calls24h - a.calls24h).slice(0, 6).map((ep, i) => (
                <div key={i} style={{ padding: 14, background: '#f9fafb', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: ep.method === 'GET' ? '#dbeafe' : ep.method === 'POST' ? '#dcfce7' : '#fef3c7', color: ep.method === 'GET' ? '#1d4ed8' : ep.method === 'POST' ? '#166534' : '#92400e' }}>{ep.method}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, fontFamily: 'monospace' }}>{ep.path}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{ep.category} · p{ep.avgLatencyMs}ms</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0ea5e9' }}>{fmtCalls(ep.calls24h)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tpps' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {tpps.map(t => (
            <div key={t.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{t.registrationNumber} · {t.cbnLicense}</div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexDirection: 'column' as const, alignItems: 'flex-end' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600,
                    background: t.status === 'ACTIVE' ? '#dcfce7' : t.status === 'REGISTERED' ? '#dbeafe' : '#fef2f2',
                    color: t.status === 'ACTIVE' ? '#166534' : t.status === 'REGISTERED' ? '#1d4ed8' : '#991b1b' }}>{t.status}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 600, ...tierColor(t.apiTier) }}>{t.apiTier}</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                <div><span style={{ color: '#9ca3af' }}>Services:</span> <strong>{t.services.join(', ')}</strong></div>
                <div><span style={{ color: '#9ca3af' }}>Monthly Calls:</span> <strong>{fmtCalls(t.monthlyApiCalls)}</strong></div>
                <div><span style={{ color: '#9ca3af' }}>Rate Limit:</span> <strong>{t.rateLimitPerMin}/min</strong></div>
                <div><span style={{ color: '#9ca3af' }}>Contact:</span> <strong>{t.contactEmail}</strong></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'consents' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['ID', 'Customer', 'TPP', 'Service', 'Permissions', 'Accounts', 'Status', 'Valid Until'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {consents.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{c.id}</td>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{c.customerName}<br/><span style={{ fontSize: 11, color: '#9ca3af' }}>{c.customerId}</span></td>
                <td style={{ padding: '10px 12px' }}>{c.tppName}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                    background: c.serviceType === 'AIS' ? '#dbeafe' : '#dcfce7', color: c.serviceType === 'AIS' ? '#1d4ed8' : '#166534' }}>{c.serviceType}</span>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    {c.permissions.map(p => <span key={p} style={{ padding: '1px 4px', borderRadius: 2, fontSize: 10, background: '#f3f4f6' }}>{p}</span>)}
                  </div>
                </td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11 }}>{c.accounts.join(', ')}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600,
                    background: c.status === 'AUTHORIZED' ? '#dcfce7' : c.status === 'REVOKED' ? '#fef2f2' : c.status === 'EXPIRED' ? '#f3f4f6' : '#fef3c7',
                    color: c.status === 'AUTHORIZED' ? '#166534' : c.status === 'REVOKED' ? '#991b1b' : c.status === 'EXPIRED' ? '#6b7280' : '#92400e' }}>{c.status}</span>
                </td>
                <td style={{ padding: '10px 12px', fontSize: 12 }}>{new Date(c.validUntil).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {activeTab === 'api_catalog' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Method', 'Path', 'Description', 'Service', 'Version', 'Avg Latency', '24h Calls'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {endpoints.map(e => (
              <tr key={e.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
                    background: e.method === 'GET' ? '#dcfce7' : e.method === 'POST' ? '#dbeafe' : '#fef3c7',
                    color: e.method === 'GET' ? '#166534' : e.method === 'POST' ? '#1d4ed8' : '#92400e' }}>{e.method}</span>
                </td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{e.path}</td>
                <td style={{ padding: '10px 12px' }}>{e.description}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11,
                    background: e.serviceType === 'AIS' ? '#dbeafe' : '#dcfce7', color: e.serviceType === 'AIS' ? '#1d4ed8' : '#166534' }}>{e.serviceType}</span>
                </td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{e.version}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ fontWeight: 600, color: e.avgLatencyMs > 200 ? '#f59e0b' : '#10b981' }}>{e.avgLatencyMs}ms</span>
                </td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{e.callsLast24h.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {activeTab === 'sandboxes' && (
        <div>
          {sandboxes.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
              <Code size={48} color="#d1d5db" style={{ margin: '0 auto 16px' }} />
              <div style={{ fontSize: 16, fontWeight: 600 }}>No active sandboxes</div>
              <div style={{ fontSize: 13 }}>Register a TPP in SANDBOX tier to create a test environment</div>
            </div>
          )}
          {sandboxes.map(s => (
            <div key={s.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{s.tppName} Sandbox</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{s.id} · Created {new Date(s.createdAt).toLocaleDateString()}</div>
                </div>
                <span style={{ padding: '4px 12px', borderRadius: 9999, fontSize: 12, fontWeight: 600, background: '#dcfce7', color: '#166534' }}>{s.status}</span>
              </div>
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: 12, marginBottom: 12, fontFamily: 'monospace', fontSize: 12 }}>
                <span style={{ color: '#6b7280' }}>Test API Key:</span> <strong>{s.testApiKey}</strong>
              </div>
              <div style={{ fontSize: 13 }}>
                <strong>Test Accounts:</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginTop: 8 }}>
                  {s.testAccounts.map((a: { id: string; name: string; balance: number; currency: string; type: string }) => (
                    <div key={a.id} style={{ padding: 8, background: '#f9fafb', borderRadius: 6, fontSize: 12 }}>
                      <div style={{ fontWeight: 600 }}>{a.name}</div>
                      <div style={{ color: '#6b7280' }}>{a.currency} {a.balance.toLocaleString()} · {a.type}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>Total Test Calls: <strong>{s.totalTestCalls.toLocaleString()}</strong></div>
            </div>
          ))}
        </div>
      )}
      </main>
    </div>
  );
}
