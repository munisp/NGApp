import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Globe, Key, Shield, Code, CheckCircle, XCircle, Clock, Zap, Users, Server } from 'lucide-react';

type Tab = 'tpps' | 'consents' | 'api_catalog' | 'sandboxes';

export default function OpenBanking() {
  const [activeTab, setActiveTab] = useState<Tab>('tpps');

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

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Globe size={28} color="#0ea5e9" />
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Open Banking / API Marketplace</h1>
        <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 8 }}>AIS, PIS, Consent Management, Developer Sandbox</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Registered TPPs', value: tppSummary?.totalTPPs ?? 0, icon: Users, color: '#0ea5e9' },
          { label: 'Active TPPs', value: tppSummary?.activeTPPs ?? 0, icon: CheckCircle, color: '#10b981' },
          { label: 'Monthly API Calls', value: fmtCalls(tppSummary?.totalApiCalls ?? 0), icon: Zap, color: '#7c3aed' },
          { label: 'Active Consents', value: consentSummary?.authorized ?? 0, icon: Shield, color: '#059669' },
          { label: 'Revoked Consents', value: consentSummary?.revoked ?? 0, icon: XCircle, color: '#ef4444' },
          { label: 'API Endpoints', value: endpoints.length, icon: Server, color: '#ea580c' },
          { label: '24h API Calls', value: fmtCalls(endpointsQuery.data?.totalCalls24h ?? 0), icon: Code, color: '#0369a1' },
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
        {(['tpps', 'consents', 'api_catalog', 'sandboxes'] as Tab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
              background: activeTab === tab ? '#0ea5e9' : 'transparent', color: activeTab === tab ? 'white' : '#6b7280' }}>
            {tab === 'tpps' ? 'TPP Registry' : tab === 'consents' ? 'Consents' : tab === 'api_catalog' ? 'API Catalog' : 'Sandboxes'}
          </button>
        ))}
      </div>

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
    </div>
  );
}
