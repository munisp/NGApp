import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Server, Database, Shield, Activity, Layers, Network, Globe, Eye, Lock, Gauge, Radio, Cpu, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import ModuleLayout from '@/components/ModuleLayout';
import type { NavItem, ModuleConfig } from '@/components/ModuleLayout';
import SharedStatusBadge from '@/components/StatusBadge';
import MetricCardShared from '@/components/MetricCard';
import PageHeader from '@/components/PageHeader';

const MW_MODULE: ModuleConfig = {
  title: 'Middleware',
  subtitle: '65 Enhancements',
  icon: Server,
  accentColor: 'text-blue-600',
  accentBg: 'bg-blue-600',
  accentHover: 'hover:bg-blue-700',
};

const MW_NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: Gauge },
  { id: 'kafka', label: 'Kafka', icon: Radio },
  { id: 'redis', label: 'Redis', icon: Database },
  { id: 'postgresql', label: 'PostgreSQL', icon: Database },
  { id: 'tigerbeetle', label: 'TigerBeetle', icon: Layers },
  { id: 'temporal', label: 'Temporal', icon: Clock },
  { id: 'apisix', label: 'APISIX', icon: Globe },
  { id: 'keycloak', label: 'Keycloak', icon: Lock },
  { id: 'dapr', label: 'Dapr', icon: Network },
  { id: 'opensearch', label: 'OpenSearch', icon: Eye },
  { id: 'observability', label: 'Observability', icon: Activity },
  { id: 'mojaloop', label: 'Mojaloop', icon: Globe },
  { id: 'fluvio', label: 'Fluvio', icon: Cpu },
  { id: 'permify', label: 'Permify', icon: Shield },
  { id: 'openappsec', label: 'OpenAppSec', icon: AlertTriangle },
];

function StatusBadge({ status }: { status: string }) {
  return <SharedStatusBadge status={status} />;
}

function MetricCard({ title, value, subtitle, icon: Icon }: { title: string; value: string | number; subtitle?: string; icon?: typeof Server }) {
  return <MetricCardShared title={title} value={value} subtitle={subtitle} icon={Icon} />;
}

export default function MiddlewareMonitoring() {
  const [activeTab, setActiveTab] = useState('overview');

  const healthQuery = trpc.middleware.health.useQuery(undefined, { retry: false });
  const kafkaQuery = trpc.middleware.kafkaStatus.useQuery(undefined, { retry: false, enabled: activeTab === 'kafka' || activeTab === 'overview' });
  const redisQuery = trpc.middleware.redisStatus.useQuery(undefined, { retry: false, enabled: activeTab === 'redis' || activeTab === 'overview' });
  const pgQuery = trpc.middleware.postgresqlStatus.useQuery(undefined, { retry: false, enabled: activeTab === 'postgresql' || activeTab === 'overview' });
  const tbQuery = trpc.middleware.tigerbeetleStatus.useQuery(undefined, { retry: false, enabled: activeTab === 'tigerbeetle' || activeTab === 'overview' });
  const temporalQuery = trpc.middleware.temporalStatus.useQuery(undefined, { retry: false, enabled: activeTab === 'temporal' || activeTab === 'overview' });
  const apisixQuery = trpc.middleware.apisixStatus.useQuery(undefined, { retry: false, enabled: activeTab === 'apisix' || activeTab === 'overview' });
  const keycloakQuery = trpc.middleware.keycloakStatus.useQuery(undefined, { retry: false, enabled: activeTab === 'keycloak' || activeTab === 'overview' });
  const daprQuery = trpc.middleware.daprStatus.useQuery(undefined, { retry: false, enabled: activeTab === 'dapr' || activeTab === 'overview' });
  const osQuery = trpc.middleware.opensearchStatus.useQuery(undefined, { retry: false, enabled: activeTab === 'opensearch' || activeTab === 'overview' });
  const obsQuery = trpc.middleware.observabilityStatus.useQuery(undefined, { retry: false, enabled: activeTab === 'observability' || activeTab === 'overview' });
  const mojaloopQuery = trpc.middleware.mojaloopStatus.useQuery(undefined, { retry: false, enabled: activeTab === 'mojaloop' || activeTab === 'overview' });
  const fluvioQuery = trpc.middleware.fluvioStatus.useQuery(undefined, { retry: false, enabled: activeTab === 'fluvio' || activeTab === 'overview' });
  const permifyQuery = trpc.middleware.permifyStatus.useQuery(undefined, { retry: false, enabled: activeTab === 'permify' || activeTab === 'overview' });
  const wafQuery = trpc.middleware.openappsecStatus.useQuery(undefined, { retry: false, enabled: activeTab === 'openappsec' || activeTab === 'overview' });

  const health = healthQuery.data;

  return (
    <ModuleLayout module={MW_MODULE} navItems={MW_NAV_ITEMS} activeTab={activeTab} onTabChange={setActiveTab}>
      <PageHeader
        title={MW_NAV_ITEMS.find(n => n.id === activeTab)?.label ?? 'Overview'}
        subtitle="Infrastructure monitoring & health"
        icon={Server}
      />
        {/* Overview */}
        {activeTab === 'overview' && health && (
          <div>
            <h1 className="text-2xl font-bold mb-4">Middleware Health Overview</h1>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <MetricCard title="Overall Status" value={health.overall} icon={CheckCircle} />
              <MetricCard title="Total Services" value={health.services.length} icon={Server} />
              <MetricCard title="Enhancements" value={health.totalEnhancements} icon={Layers} />
              <MetricCard title="Healthy" value={health.services.filter(s => s.status === 'HEALTHY').length + '/' + health.services.length} icon={Activity} />
            </div>
            <div className="bg-white rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3">Service</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Version</th>
                    <th className="text-left p-3">Enhancements</th>
                  </tr>
                </thead>
                <tbody>
                  {health.services.map((svc, i) => (
                    <tr key={i} className="border-t hover:bg-gray-50">
                      <td className="p-3 font-medium">{svc.name}</td>
                      <td className="p-3"><StatusBadge status={svc.status} /></td>
                      <td className="p-3 text-gray-500">{svc.version}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {svc.enhancements.map((e, j) => (
                            <span key={j} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{e}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Kafka */}
        {activeTab === 'kafka' && kafkaQuery.data && (() => {
          const k = kafkaQuery.data;
          return (
            <div>
              <h1 className="text-2xl font-bold mb-4">Kafka — Message Broker</h1>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <MetricCard title="Broker Status" value={k.broker.status} icon={Server} />
                <MetricCard title="EOS Enabled" value={k.broker.eosEnabled ? 'Yes' : 'No'} icon={Shield} />
                <MetricCard title="Schema Registry" value={k.schemaRegistry.registeredSchemas + ' schemas'} icon={Database} />
                <MetricCard title="DLQ Pending" value={k.dlq.pendingRetry} subtitle={k.dlq.totalMessages + ' total'} icon={AlertTriangle} />
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white rounded-lg border p-4">
                  <h3 className="font-semibold mb-3">Schema Registry (#2)</h3>
                  <table className="w-full text-sm">
                    <thead><tr><th className="text-left pb-2">Subject</th><th className="text-left pb-2">Version</th><th className="text-left pb-2">Type</th></tr></thead>
                    <tbody>{k.schemaRegistry.schemas.map((s, i) => (<tr key={i} className="border-t"><td className="py-1.5">{s.subject}</td><td>{s.version}</td><td>{s.type}</td></tr>))}</tbody>
                  </table>
                </div>
                <div className="bg-white rounded-lg border p-4">
                  <h3 className="font-semibold mb-3">Consumer Lag (#5)</h3>
                  <table className="w-full text-sm">
                    <thead><tr><th className="text-left pb-2">Group</th><th className="text-left pb-2">Lag</th><th className="text-left pb-2">Alert</th><th className="text-left pb-2">Pods</th></tr></thead>
                    <tbody>{k.consumerLag.groups.map((g, i) => (<tr key={i} className="border-t"><td className="py-1.5 text-xs">{g.groupId}</td><td>{g.totalLag.toLocaleString()}</td><td><StatusBadge status={g.alertLevel} /></td><td>{g.pods}</td></tr>))}</tbody>
                  </table>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg border p-4">
                  <h3 className="font-semibold mb-3">MirrorMaker2 (#1)</h3>
                  <div className="text-sm space-y-1">
                    <div>Status: <StatusBadge status={k.mirrorMaker.status} /></div>
                    <div>Source: {k.mirrorMaker.sourceCluster} → Target: {k.mirrorMaker.targetCluster}</div>
                    <div>Topics: {k.mirrorMaker.replicatedTopics} | Lag: {k.mirrorMaker.replicationLagMs}ms</div>
                  </div>
                </div>
                <div className="bg-white rounded-lg border p-4">
                  <h3 className="font-semibold mb-3">Tiered Storage (#3)</h3>
                  <div className="text-sm space-y-1">
                    <div>Enabled: {k.tieredStorage.enabled ? 'Yes' : 'No'}</div>
                    <div>Local Retention: {k.tieredStorage.localRetentionDays} days</div>
                    <div>Cold Segments: {k.tieredStorage.coldSegmentsGB} GB</div>
                    <div>Cost Savings: {k.tieredStorage.costSavingsPercent}%</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Redis */}
        {activeTab === 'redis' && redisQuery.data && (() => {
          const r = redisQuery.data;
          return (
            <div>
              <h1 className="text-2xl font-bold mb-4">Redis — Cache & Session</h1>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <MetricCard title="Topology" value={r.topology.mode} subtitle={r.topology.sentinels + ' sentinels'} icon={Server} />
                <MetricCard title="Hit Rate" value={r.performance.hitRate + '%'} icon={Activity} />
                <MetricCard title="Ops/sec" value={r.performance.opsPerSec.toLocaleString()} icon={Gauge} />
                <MetricCard title="Memory" value={r.performance.usedMemoryMB + '/' + r.performance.maxMemoryMB + ' MB'} icon={Database} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg border p-4">
                  <h3 className="font-semibold mb-3">Streams (#9)</h3>
                  <table className="w-full text-sm">
                    <thead><tr><th className="text-left pb-2">Stream</th><th className="text-left pb-2">Length</th><th className="text-left pb-2">Consumers</th><th className="text-left pb-2">Lag</th></tr></thead>
                    <tbody>{r.streams.map((s, i) => (<tr key={i} className="border-t"><td className="py-1.5 text-xs">{s.name}</td><td>{s.length.toLocaleString()}</td><td>{s.consumers}</td><td>{s.lag}</td></tr>))}</tbody>
                  </table>
                </div>
                <div className="bg-white rounded-lg border p-4">
                  <h3 className="font-semibold mb-3">Bloom Filter (#10)</h3>
                  <div className="text-sm space-y-1">
                    <div>Filter: {r.bloomFilter.filterName}</div>
                    <div>Items: {r.bloomFilter.currentItems.toLocaleString()} / {r.bloomFilter.expectedItems.toLocaleString()}</div>
                    <div>FP Rate: {r.bloomFilter.fpRate}</div>
                    <div>Memory: {r.bloomFilter.memoryMB} MB</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* PostgreSQL */}
        {activeTab === 'postgresql' && pgQuery.data && (() => {
          const pg = pgQuery.data;
          return (
            <div>
              <h1 className="text-2xl font-bold mb-4">PostgreSQL — Primary Database</h1>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <MetricCard title="PgBouncer" value={pg.pgbouncer.status} subtitle={pg.pgbouncer.totalClients + ' clients'} icon={Server} />
                <MetricCard title="Replicas" value={pg.patroni.members.length} subtitle="Patroni HA" icon={Database} />
                <MetricCard title="Partitions" value={pg.partitioning.totalPartitions} subtitle={pg.partitioning.partitionedTables + ' tables'} icon={Layers} />
                <MetricCard title="TDE" value={pg.tde.enabled ? 'Enabled' : 'Disabled'} subtitle={pg.tde.algorithm} icon={Lock} />
              </div>
              <div className="bg-white rounded-lg border p-4 mb-4">
                <h3 className="font-semibold mb-3">Patroni Cluster (#14)</h3>
                <table className="w-full text-sm">
                  <thead><tr><th className="text-left pb-2">Node</th><th className="text-left pb-2">Role</th><th className="text-left pb-2">Region</th><th className="text-left pb-2">State</th><th className="text-left pb-2">Lag (MB)</th></tr></thead>
                  <tbody>{pg.patroni.members.map((m, i) => (<tr key={i} className="border-t"><td className="py-1.5">{m.name}</td><td>{m.role}</td><td>{m.region}</td><td><StatusBadge status={m.state.toUpperCase()} /></td><td>{m.lag}</td></tr>))}</tbody>
                </table>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg border p-4">
                  <h3 className="font-semibold mb-3">Connection Pools (#13)</h3>
                  <table className="w-full text-sm">
                    <thead><tr><th className="text-left pb-2">Service</th><th className="text-left pb-2">Active</th><th className="text-left pb-2">Idle</th><th className="text-left pb-2">Waiting</th></tr></thead>
                    <tbody>{pg.pgbouncer.pools.map((p, i) => (<tr key={i} className="border-t"><td className="py-1.5">{p.service}</td><td>{p.active}</td><td>{p.idle}</td><td>{p.waiting}</td></tr>))}</tbody>
                  </table>
                </div>
                <div className="bg-white rounded-lg border p-4">
                  <h3 className="font-semibold mb-3">Cron Jobs (#17)</h3>
                  <table className="w-full text-sm">
                    <thead><tr><th className="text-left pb-2">Schedule</th><th className="text-left pb-2">Command</th><th className="text-left pb-2">Last Run</th><th className="text-left pb-2">Status</th></tr></thead>
                    <tbody>{pg.cronJobs.jobs.map((j, i) => (<tr key={i} className="border-t"><td className="py-1.5 font-mono text-xs">{j.schedule}</td><td className="text-xs">{j.command}</td><td>{j.lastRun}</td><td><StatusBadge status={j.status} /></td></tr>))}</tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* TigerBeetle */}
        {activeTab === 'tigerbeetle' && tbQuery.data && (() => {
          const tb = tbQuery.data;
          return (
            <div>
              <h1 className="text-2xl font-bold mb-4">TigerBeetle — High-Performance Ledger</h1>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <MetricCard title="Cluster Nodes" value={tb.cluster.replicas} subtitle={'Quorum: ' + tb.cluster.quorumSize} icon={Server} />
                <MetricCard title="Last Backup" value="Today" subtitle={tb.backup.backupSizeGB + ' GB'} icon={Database} />
                <MetricCard title="Drift Alerts" value={tb.reconciliation.driftAlerts} subtitle={'Checked: ' + tb.reconciliation.totalChecked.toLocaleString()} icon={AlertTriangle} />
                <MetricCard title="Total Accounts" value={tb.hierarchy.totalAccounts.toLocaleString()} icon={Layers} />
              </div>
              <div className="bg-white rounded-lg border p-4 mb-4">
                <h3 className="font-semibold mb-3">Cluster Nodes (#19)</h3>
                <table className="w-full text-sm">
                  <thead><tr><th className="text-left pb-2">Index</th><th className="text-left pb-2">Region</th><th className="text-left pb-2">Status</th><th className="text-left pb-2">Last Heartbeat</th></tr></thead>
                  <tbody>{tb.cluster.nodes.map((n, i) => (<tr key={i} className="border-t"><td className="py-1.5">{n.index}</td><td>{n.region}</td><td><StatusBadge status={n.status} /></td><td className="text-xs">{new Date(n.lastHeartbeat).toLocaleTimeString()}</td></tr>))}</tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* Temporal */}
        {activeTab === 'temporal' && temporalQuery.data && (() => {
          const t = temporalQuery.data;
          return (
            <div>
              <h1 className="text-2xl font-bold mb-4">Temporal — Workflow Engine</h1>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <MetricCard title="Active Sagas" value={t.sagas.active} icon={Activity} />
                <MetricCard title="Completed (24h)" value={t.sagas.completed24h.toLocaleString()} icon={CheckCircle} />
                <MetricCard title="Failed (24h)" value={t.sagas.failed24h} icon={XCircle} />
                <MetricCard title="Replication Lag" value={t.cluster.replicationLagMs + 'ms'} icon={Clock} />
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-white rounded-lg border p-4">
                  <h3 className="font-semibold mb-3">Workflow Versioning (#24)</h3>
                  <table className="w-full text-sm">
                    <thead><tr><th className="text-left pb-2">Workflow</th><th className="text-left pb-2">Version</th><th className="text-left pb-2">Compatible</th></tr></thead>
                    <tbody>{t.versioning.workflows.map((w, i) => (<tr key={i} className="border-t"><td className="py-1.5">{w.type}</td><td>v{w.version}</td><td>{w.compatible ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}</td></tr>))}</tbody>
                  </table>
                </div>
                <div className="bg-white rounded-lg border p-4">
                  <h3 className="font-semibold mb-3">KEDA Auto-Scale (#26)</h3>
                  <table className="w-full text-sm">
                    <thead><tr><th className="text-left pb-2">Scaler</th><th className="text-left pb-2">Pods</th><th className="text-left pb-2">Queue</th></tr></thead>
                    <tbody>{t.keda.scalers.map((s, i) => (<tr key={i} className="border-t"><td className="py-1.5">{s.name}</td><td>{s.currentPods}/{s.maxPods}</td><td>{s.queueDepth}</td></tr>))}</tbody>
                  </table>
                </div>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold mb-3">Cron Workflows (#27)</h3>
                <table className="w-full text-sm">
                  <thead><tr><th className="text-left pb-2">Workflow</th><th className="text-left pb-2">Schedule</th><th className="text-left pb-2">Last Run</th><th className="text-left pb-2">Status</th></tr></thead>
                  <tbody>{t.cronWorkflows.map((c, i) => (<tr key={i} className="border-t"><td className="py-1.5">{c.type}</td><td className="font-mono text-xs">{c.schedule}</td><td>{c.lastRun}</td><td><StatusBadge status={c.status} /></td></tr>))}</tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* APISIX */}
        {activeTab === 'apisix' && apisixQuery.data && (() => {
          const a = apisixQuery.data;
          return (
            <div>
              <h1 className="text-2xl font-bold mb-4">APISIX — API Gateway</h1>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <MetricCard title="Routes" value={a.gateway.totalRoutes} icon={Globe} />
                <MetricCard title="Requests/sec" value={a.gateway.requestsPerSec.toLocaleString()} icon={Activity} />
                <MetricCard title="API Keys" value={a.apiKeys.activeKeys} subtitle={a.apiKeys.totalKeys + ' total'} icon={Lock} />
                <MetricCard title="Blocked (Geo)" value={a.geofencing.blockedToday} icon={AlertTriangle} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg border p-4">
                  <h3 className="font-semibold mb-3">gRPC Transcoding (#29)</h3>
                  <table className="w-full text-sm">
                    <thead><tr><th className="text-left pb-2">Service</th><th className="text-left pb-2">REST Pattern</th><th className="text-left pb-2">gRPC Endpoint</th></tr></thead>
                    <tbody>{a.grpcTranscoding.routes.map((r, i) => (<tr key={i} className="border-t"><td className="py-1.5">{r.service}</td><td className="font-mono text-xs">{r.restPattern}</td><td className="text-xs">{r.grpcEndpoint}</td></tr>))}</tbody>
                  </table>
                </div>
                <div className="bg-white rounded-lg border p-4">
                  <h3 className="font-semibold mb-3">IP Geofencing (#31)</h3>
                  <table className="w-full text-sm">
                    <thead><tr><th className="text-left pb-2">Country</th><th className="text-left pb-2">Blocked Today</th></tr></thead>
                    <tbody>{a.geofencing.topBlockedCountries.map((c, i) => (<tr key={i} className="border-t"><td className="py-1.5">{c.country}</td><td>{c.count}</td></tr>))}</tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Keycloak */}
        {activeTab === 'keycloak' && keycloakQuery.data && (() => {
          const kc = keycloakQuery.data;
          return (
            <div>
              <h1 className="text-2xl font-bold mb-4">Keycloak — Identity Provider</h1>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <MetricCard title="BVN Verifications" value={kc.bvnSpi.verificationsToday.toLocaleString()} subtitle={kc.bvnSpi.successRate + '% success'} icon={Shield} />
                <MetricCard title="Step-Up Auth" value={kc.adaptiveAuth.stepUpTriggered24h} icon={Lock} />
                <MetricCard title="SSO Sessions" value={kc.federation.ssoSessions24h} icon={Globe} />
                <MetricCard title="Brute Force Blocks" value={kc.bruteForce.blockedAttempts} icon={AlertTriangle} />
              </div>
            </div>
          );
        })()}

        {/* Dapr */}
        {activeTab === 'dapr' && daprQuery.data && (() => {
          const d = daprQuery.data;
          return (
            <div>
              <h1 className="text-2xl font-bold mb-4">Dapr — Service Mesh</h1>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <MetricCard title="Sidecars" value={d.sidecars.length} subtitle="All healthy" icon={Server} />
                <MetricCard title="Active Locks" value={d.distributedLocks.activeLocks} icon={Lock} />
                <MetricCard title="Feature Flags" value={Object.keys(d.configStore.featureFlags).length} icon={Layers} />
                <MetricCard title="External Bindings" value={d.bindings.external} icon={Network} />
              </div>
              <div className="bg-white rounded-lg border p-4 mb-4">
                <h3 className="font-semibold mb-3">Service Sidecars (#39)</h3>
                <table className="w-full text-sm">
                  <thead><tr><th className="text-left pb-2">App ID</th><th className="text-left pb-2">Protocol</th><th className="text-left pb-2">Healthy</th><th className="text-left pb-2">Req/sec</th></tr></thead>
                  <tbody>{d.sidecars.map((s, i) => (<tr key={i} className="border-t"><td className="py-1.5">{s.appId}</td><td>{s.protocol}</td><td>{s.healthy ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}</td><td>{s.requestsPerSec.toLocaleString()}</td></tr>))}</tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* OpenSearch */}
        {activeTab === 'opensearch' && osQuery.data && (() => {
          const os = osQuery.data;
          return (
            <div>
              <h1 className="text-2xl font-bold mb-4">OpenSearch — Search & Analytics</h1>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <MetricCard title="Cluster" value={os.cluster.status} subtitle={os.cluster.nodeCount + ' nodes'} icon={Server} />
                <MetricCard title="Documents" value={(os.cluster.totalDocuments / 1000000).toFixed(1) + 'M'} icon={Database} />
                <MetricCard title="ILM Policies" value={os.ilm.policies} subtitle={os.ilm.managedIndices + ' managed indices'} icon={Layers} />
                <MetricCard title="Security" value={os.security.enabled ? 'Enabled' : 'Disabled'} subtitle={os.security.roles + ' roles'} icon={Shield} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg border p-4">
                  <h3 className="font-semibold mb-3">Anomaly Detection (#46)</h3>
                  <table className="w-full text-sm">
                    <thead><tr><th className="text-left pb-2">Detector</th><th className="text-left pb-2">Status</th><th className="text-left pb-2">Last Anomaly</th></tr></thead>
                    <tbody>{os.anomalyDetection.detectors_list.map((d, i) => (<tr key={i} className="border-t"><td className="py-1.5">{d.name}</td><td><StatusBadge status={d.status} /></td><td>{d.lastAnomaly}</td></tr>))}</tbody>
                  </table>
                </div>
                <div className="bg-white rounded-lg border p-4">
                  <h3 className="font-semibold mb-3">Index Templates (#48)</h3>
                  <table className="w-full text-sm">
                    <thead><tr><th className="text-left pb-2">Template</th><th className="text-left pb-2">Pattern</th><th className="text-left pb-2">Shards</th><th className="text-left pb-2">Replicas</th></tr></thead>
                    <tbody>{os.templates.templates.map((t, i) => (<tr key={i} className="border-t"><td className="py-1.5">{t.name}</td><td className="font-mono text-xs">{t.indexPattern}</td><td>{t.shards}</td><td>{t.replicas}</td></tr>))}</tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Observability */}
        {activeTab === 'observability' && obsQuery.data && (() => {
          const ob = obsQuery.data;
          return (
            <div>
              <h1 className="text-2xl font-bold mb-4">Observability Stack</h1>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <MetricCard title="Traces (24h)" value={(ob.tailSampling.totalTraces24h / 1000000).toFixed(1) + 'M'} subtitle={ob.tailSampling.sampledTraces24h.toLocaleString() + ' sampled'} icon={Activity} />
                <MetricCard title="Thanos Storage" value={ob.thanos.objectStoreSizeGB + ' GB'} subtitle={ob.thanos.retention1h + ' retention'} icon={Database} />
                <MetricCard title="Active Alerts" value={ob.alerting.activeAlerts} subtitle={ob.alerting.firedToday + ' fired today'} icon={AlertTriangle} />
                <MetricCard title="SLOs In Budget" value={ob.slo.withinBudget + '/' + ob.slo.definitions} icon={Gauge} />
              </div>
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold mb-3">SLO Dashboard (#53)</h3>
                <table className="w-full text-sm">
                  <thead><tr><th className="text-left pb-2">SLO</th><th className="text-left pb-2">Target</th><th className="text-left pb-2">Current</th><th className="text-left pb-2">In Budget</th></tr></thead>
                  <tbody>{ob.slo.slos.map((s, i) => (<tr key={i} className="border-t"><td className="py-1.5">{s.name}</td><td>{s.target}%</td><td className="font-bold">{s.current}%</td><td>{s.withinBudget ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}</td></tr>))}</tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* Mojaloop */}
        {activeTab === 'mojaloop' && mojaloopQuery.data && (() => {
          const m = mojaloopQuery.data;
          return (
            <div>
              <h1 className="text-2xl font-bold mb-4">Mojaloop — Interoperability</h1>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <MetricCard title="Hub Components" value={m.hub.healthyComponents + '/' + m.hub.components} icon={Server} />
                <MetricCard title="Active PISPs" value={m.pisp.activePISPs} subtitle={m.pisp.transactions24h + ' txns today'} icon={Globe} />
                <MetricCard title="Oracles" value={m.oracles.active} icon={Database} />
                <MetricCard title="Version" value={m.hub.version} icon={Layers} />
              </div>
            </div>
          );
        })()}

        {/* Fluvio */}
        {activeTab === 'fluvio' && fluvioQuery.data && (() => {
          const f = fluvioQuery.data;
          return (
            <div>
              <h1 className="text-2xl font-bold mb-4">Fluvio — Real-Time Streaming</h1>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <MetricCard title="SmartModules" value={f.smartModules.active} icon={Cpu} />
                <MetricCard title="Kafka Mirror Topics" value={f.kafkaMirror.topicMappings} subtitle={f.kafkaMirror.totalMirrored24h.toLocaleString() + ' mirrored'} icon={Radio} />
                <MetricCard title="Stream Processors" value={f.streamProcessors.active} icon={Activity} />
              </div>
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold mb-3">SmartModules (#57)</h3>
                <table className="w-full text-sm">
                  <thead><tr><th className="text-left pb-2">Module</th><th className="text-left pb-2">Type</th><th className="text-left pb-2">Avg Latency</th><th className="text-left pb-2">Processed Today</th></tr></thead>
                  <tbody>{f.smartModules.modules.map((m, i) => (<tr key={i} className="border-t"><td className="py-1.5">{m.name}</td><td>{m.type}</td><td>{m.avgLatencyUs}μs</td><td>{m.processedToday.toLocaleString()}</td></tr>))}</tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* Permify */}
        {activeTab === 'permify' && permifyQuery.data && (() => {
          const p = permifyQuery.data;
          return (
            <div>
              <h1 className="text-2xl font-bold mb-4">Permify — Authorization</h1>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <MetricCard title="Schema Entities" value={p.schema.entities} subtitle={p.schema.permissions + ' permissions'} icon={Shield} />
                <MetricCard title="Checks (24h)" value={p.bulkCheck.totalChecks24h.toLocaleString()} subtitle={p.bulkCheck.avgLatencyMs + 'ms avg'} icon={Activity} />
                <MetricCard title="Allow Rate" value={p.bulkCheck.allowRate + '%'} icon={CheckCircle} />
                <MetricCard title="Audit Logs Today" value={p.auditLog.logsToday.toLocaleString()} icon={Eye} />
              </div>
            </div>
          );
        })()}

        {/* OpenAppSec */}
        {activeTab === 'openappsec' && wafQuery.data && (() => {
          const w = wafQuery.data;
          return (
            <div>
              <h1 className="text-2xl font-bold mb-4">OpenAppSec — WAF</h1>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <MetricCard title="Mode" value={w.enforcement.mode} icon={Shield} />
                <MetricCard title="Blocked Today" value={w.enforcement.blockedToday} icon={AlertTriangle} />
                <MetricCard title="Threat Intel Entries" value={w.threatIntel.totalEntries.toLocaleString()} subtitle={w.threatIntel.activeFeeds + ' feeds'} icon={Eye} />
                <MetricCard title="Bots Detected" value={w.botDetection.botsDetectedToday} icon={Cpu} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg border p-4">
                  <h3 className="font-semibold mb-3">Threat Intelligence (#64)</h3>
                  <table className="w-full text-sm">
                    <thead><tr><th className="text-left pb-2">Feed</th><th className="text-left pb-2">Entries</th><th className="text-left pb-2">Matches Today</th></tr></thead>
                    <tbody>{w.threatIntel.topFeeds.map((f, i) => (<tr key={i} className="border-t"><td className="py-1.5">{f.name}</td><td>{f.entries.toLocaleString()}</td><td>{f.matchesToday}</td></tr>))}</tbody>
                  </table>
                </div>
                <div className="bg-white rounded-lg border p-4">
                  <h3 className="font-semibold mb-3">Bot Detection (#65)</h3>
                  <table className="w-full text-sm">
                    <thead><tr><th className="text-left pb-2">Pattern</th><th className="text-left pb-2">Detected</th><th className="text-left pb-2">Action</th></tr></thead>
                    <tbody>{w.botDetection.patterns.map((p, i) => (<tr key={i} className="border-t"><td className="py-1.5">{p.name}</td><td>{p.detectedToday}</td><td><StatusBadge status={p.action} /></td></tr>))}</tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}
    </ModuleLayout>
  );
}
