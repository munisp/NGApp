import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Lock, Eye, AlertTriangle, Wifi, WifiOff, Activity, Globe, Server, FileWarning, ShieldCheck, ShieldAlert, Database, Radio } from "lucide-react";

function MetricCard({ title, value, subtitle, icon: Icon, variant = "default" }: { title: string; value: string | number; subtitle?: string; icon: any; variant?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <Icon className={`h-8 w-8 ${variant === "danger" ? "text-red-500" : variant === "warning" ? "text-yellow-500" : variant === "success" ? "text-green-500" : "text-blue-500"}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    healthy: "bg-green-100 text-green-800",
    mitigated: "bg-blue-100 text-blue-800",
    warning: "bg-yellow-100 text-yellow-800",
    critical: "bg-red-100 text-red-800",
    "A+": "bg-green-100 text-green-800",
    A: "bg-green-100 text-green-800",
    B: "bg-blue-100 text-blue-800",
    C: "bg-yellow-100 text-yellow-800",
  };
  return <Badge className={colors[status?.toLowerCase()] || "bg-gray-100 text-gray-800"}>{status}</Badge>;
}

export default function SecurityDashboard() {
  const [tab, setTab] = useState("overview");

  const ddos = trpc.security.ddosStatus.useQuery(undefined, { enabled: tab === "overview" || tab === "ddos" });
  const ransomware = trpc.security.ransomwareStatus.useQuery(undefined, { enabled: tab === "overview" || tab === "ransomware" });
  const pbac = trpc.security.pbacStatus.useQuery(undefined, { enabled: tab === "overview" || tab === "pbac" });
  const vulns = trpc.security.vulnerabilityScore.useQuery(undefined, { enabled: tab === "overview" || tab === "vulnerabilities" });
  const resilience = trpc.security.resilienceStatus.useQuery(undefined, { enabled: tab === "overview" || tab === "resilience" });

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r bg-card p-4 space-y-1 overflow-y-auto">
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><Shield className="h-5 w-5" /> Security Center</h2>
        {[
          { id: "overview", label: "Overview", icon: Activity },
          { id: "ddos", label: "DDoS Protection", icon: Globe },
          { id: "ransomware", label: "Ransomware Defense", icon: FileWarning },
          { id: "pbac", label: "Access Control (PBAC)", icon: Lock },
          { id: "vulnerabilities", label: "Vulnerability Score", icon: ShieldCheck },
          { id: "resilience", label: "Offline Resilience", icon: Wifi },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-left ${tab === id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {tab === "overview" && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">Security & Resilience Overview</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard title="Security Score" value={vulns.data?.score ?? "..."} subtitle={`Grade: ${vulns.data?.grade ?? "..."}`} icon={ShieldCheck} variant="success" />
              <MetricCard title="DDoS Attacks Blocked" value={ddos.data?.shield.attacksDetected ?? 0} subtitle="Last 30 days" icon={Globe} variant="warning" />
              <MetricCard title="Ransomware Score" value={`${ransomware.data?.defense.ransomwareScore ?? 0}/1.0`} subtitle="0.0 = No threat" icon={FileWarning} variant="success" />
              <MetricCard title="PBAC Evaluations" value={pbac.data?.engine.totalEvaluations ?? 0} subtitle={`${pbac.data?.engine.deniedRequests ?? 0} denied`} icon={Lock} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard title="Files Monitored" value={ransomware.data?.defense.filesMonitored ?? 0} icon={Database} />
              <MetricCard title="Blacklisted IPs" value={ddos.data?.shield.activeBlacklist ?? 0} icon={ShieldAlert} variant="danger" />
              <MetricCard title="Offline Queue" value={resilience.data?.offlineQueue.queueDepth ?? 0} subtitle="Pending sync" icon={WifiOff} />
              <MetricCard title="Bandwidth Tier" value={resilience.data?.bandwidthAdapter.currentTier ?? "..."} icon={Radio} />
            </div>

            {/* Compliance */}
            {vulns.data && (
              <Card>
                <CardHeader><CardTitle>Compliance Scores</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(vulns.data.complianceChecks).map(([key, val]) => (
                      <div key={key} className="text-center p-3 border rounded">
                        <p className="text-sm text-muted-foreground">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                        <p className="text-2xl font-bold">{(val as any).score}%</p>
                        <p className="text-xs">{(val as any).passed}/{(val as any).total} passed</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {tab === "ddos" && ddos.data && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">DDoS Protection</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard title="Total Requests" value={ddos.data.shield.totalRequests} icon={Activity} />
              <MetricCard title="Blocked" value={ddos.data.shield.blockedRequests} icon={ShieldAlert} variant="danger" />
              <MetricCard title="Challenged" value={ddos.data.shield.challengedRequests} icon={Eye} variant="warning" />
              <MetricCard title="Rate Limited" value={ddos.data.shield.rateLimitedRequests} icon={Globe} variant="warning" />
            </div>

            <Card>
              <CardHeader><CardTitle>Rate Limits</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left p-2">Path</th><th className="text-left p-2">Window</th><th className="text-left p-2">Max Requests</th></tr></thead>
                  <tbody>
                    {ddos.data.rateLimits.paths.map((p: any) => (
                      <tr key={p.path} className="border-b"><td className="p-2 font-mono text-xs">{p.path}</td><td className="p-2">{p.windowSec}s</td><td className="p-2">{p.maxRequests}</td></tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Recent Attacks</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left p-2">Type</th><th className="text-left p-2">Source</th><th className="text-left p-2">Time</th><th className="text-left p-2">Blocked</th><th className="text-left p-2">Status</th></tr></thead>
                  <tbody>
                    {ddos.data.recentAttacks.map((a: any, i: number) => (
                      <tr key={i} className="border-b"><td className="p-2">{a.type}</td><td className="p-2 font-mono text-xs">{a.sourceIP}</td><td className="p-2">{new Date(a.timestamp).toLocaleString()}</td><td className="p-2">{a.requestsBlocked.toLocaleString()}</td><td className="p-2"><StatusBadge status={a.mitigated ? "mitigated" : "active"} /></td></tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Geo Blocking</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground mr-2">Blocked:</span>
                  {ddos.data.geoBlocking.blockedCountries.map((c: string) => <Badge key={c} variant="destructive">{c}</Badge>)}
                  <span className="text-sm text-muted-foreground mx-2">Allowed corridors:</span>
                  {ddos.data.geoBlocking.allowedRemittanceCorridors.map((c: string) => <Badge key={c} variant="secondary">{c}</Badge>)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "ransomware" && ransomware.data && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">Ransomware Defense</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard title="Files Monitored" value={ransomware.data.defense.filesMonitored} icon={Database} />
              <MetricCard title="Ransomware Score" value={`${ransomware.data.defense.ransomwareScore}/1.0`} icon={FileWarning} variant={ransomware.data.defense.ransomwareScore > 0.5 ? "danger" : "success"} />
              <MetricCard title="Suspicious Files" value={ransomware.data.defense.suspiciousFiles} icon={AlertTriangle} variant={ransomware.data.defense.suspiciousFiles > 0 ? "danger" : "success"} />
              <MetricCard title="Backups Completed" value={ransomware.data.backups.backupsCompleted} icon={Server} />
            </div>

            <Card>
              <CardHeader><CardTitle>Canary Files</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left p-2">Path</th><th className="text-left p-2">Status</th><th className="text-left p-2">Last Checked</th></tr></thead>
                  <tbody>
                    {ransomware.data.canaryFiles.map((f: any) => (
                      <tr key={f.path} className="border-b"><td className="p-2 font-mono text-xs">{f.path}</td><td className="p-2"><StatusBadge status={f.status.toLowerCase()} /></td><td className="p-2">{new Date(f.lastChecked).toLocaleString()}</td></tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Backup Strategies</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap mb-4">
                  {ransomware.data.backups.strategies.map((s: string) => <Badge key={s}>{s.replace(/_/g, " ")}</Badge>)}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Retention:</span> {ransomware.data.backups.retentionDays} days</div>
                  <div><span className="text-muted-foreground">Immutable:</span> {ransomware.data.backups.immutableEnabled ? "Yes" : "No"}</div>
                  <div><span className="text-muted-foreground">Cross-Region:</span> {ransomware.data.backups.crossRegion.source} → {ransomware.data.backups.crossRegion.target}</div>
                  <div><span className="text-muted-foreground">Replication Lag:</span> {ransomware.data.backups.crossRegion.lagMs}ms</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "pbac" && pbac.data && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">Policy-Based Access Control</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard title="Total Evaluations" value={pbac.data.engine.totalEvaluations} icon={Activity} />
              <MetricCard title="Allowed" value={pbac.data.engine.allowedRequests} icon={ShieldCheck} variant="success" />
              <MetricCard title="Denied" value={pbac.data.engine.deniedRequests} icon={ShieldAlert} variant="danger" />
              <MetricCard title="Avg Latency" value={`${pbac.data.engine.avgEvaluationUs}µs`} icon={Activity} />
            </div>

            <Card>
              <CardHeader><CardTitle>Active Policies ({pbac.data.engine.policiesLoaded})</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left p-2">ID</th><th className="text-left p-2">Name</th><th className="text-left p-2">Effect</th><th className="text-left p-2">Evaluations</th><th className="text-left p-2">Denials</th><th className="text-left p-2">Tags</th></tr></thead>
                  <tbody>
                    {pbac.data.policies.map((p: any) => (
                      <tr key={p.id} className="border-b">
                        <td className="p-2 font-mono text-xs">{p.id}</td>
                        <td className="p-2">{p.name}</td>
                        <td className="p-2"><Badge variant={p.effect === "ALLOW" ? "default" : "destructive"}>{p.effect}</Badge></td>
                        <td className="p-2">{p.evaluations.toLocaleString()}</td>
                        <td className="p-2">{p.denials.toLocaleString()}</td>
                        <td className="p-2"><div className="flex gap-1">{p.tags.map((t: string) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Recent Denials</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left p-2">Policy</th><th className="text-left p-2">Subject</th><th className="text-left p-2">Resource</th><th className="text-left p-2">Reason</th><th className="text-left p-2">Time</th></tr></thead>
                  <tbody>
                    {pbac.data.recentDenials.map((d: any, i: number) => (
                      <tr key={i} className="border-b">
                        <td className="p-2 font-mono text-xs">{d.policyId}</td>
                        <td className="p-2 font-mono text-xs">{d.subject}</td>
                        <td className="p-2 font-mono text-xs">{d.resource}</td>
                        <td className="p-2 text-xs">{d.reason}</td>
                        <td className="p-2 text-xs">{new Date(d.timestamp).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "vulnerabilities" && vulns.data && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">Vulnerability Assessment</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard title="Security Score" value={vulns.data.score} subtitle={`Grade: ${vulns.data.grade}`} icon={ShieldCheck} variant="success" />
              <MetricCard title="Critical" value={vulns.data.summary.critical} icon={AlertTriangle} variant={vulns.data.summary.critical > 0 ? "danger" : "success"} />
              <MetricCard title="High" value={vulns.data.summary.high} icon={ShieldAlert} variant={vulns.data.summary.high > 0 ? "warning" : "success"} />
              <MetricCard title="Fixed" value={vulns.data.summary.fixed} icon={ShieldCheck} variant="success" />
            </div>

            <Card>
              <CardHeader><CardTitle>Top Vulnerabilities</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left p-2">ID</th><th className="text-left p-2">Severity</th><th className="text-left p-2">Title</th><th className="text-left p-2">File</th><th className="text-left p-2">Status</th><th className="text-left p-2">Remediation</th></tr></thead>
                  <tbody>
                    {vulns.data.topVulnerabilities.map((v: any) => (
                      <tr key={v.id} className="border-b">
                        <td className="p-2 font-mono text-xs">{v.id}</td>
                        <td className="p-2"><Badge variant={v.severity === "CRITICAL" ? "destructive" : v.severity === "HIGH" ? "destructive" : "default"}>{v.severity}</Badge></td>
                        <td className="p-2">{v.title}</td>
                        <td className="p-2 font-mono text-xs">{v.file}</td>
                        <td className="p-2"><StatusBadge status={v.status.toLowerCase()} /></td>
                        <td className="p-2 text-xs">{v.remediation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Compliance Frameworks</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(vulns.data.complianceChecks).map(([key, val]) => (
                    <div key={key} className="text-center p-4 border rounded">
                      <p className="text-sm font-medium">{key.replace(/([A-Z])/g, ' $1').trim().toUpperCase()}</p>
                      <p className="text-3xl font-bold mt-2">{(val as any).score}%</p>
                      <p className="text-xs text-muted-foreground mt-1">{(val as any).passed}/{(val as any).total} checks passed</p>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: `${(val as any).score}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "resilience" && resilience.data && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">Offline & Low-Bandwidth Resilience</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard title="Queue Depth" value={resilience.data.offlineQueue.queueDepth} subtitle="Pending operations" icon={WifiOff} />
              <MetricCard title="Synced Operations" value={resilience.data.offlineQueue.completedOperations} icon={Activity} variant="success" />
              <MetricCard title="Current Tier" value={resilience.data.bandwidthAdapter.currentTier} icon={Wifi} />
              <MetricCard title="Strategy" value={resilience.data.bandwidthAdapter.strategy} icon={Radio} />
            </div>

            <Card>
              <CardHeader><CardTitle>Network Tiers & Strategies</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left p-2">Tier</th><th className="text-left p-2">Max Payload</th><th className="text-left p-2">Timeout</th><th className="text-left p-2">Strategy</th></tr></thead>
                  <tbody>
                    {resilience.data.bandwidthAdapter.supportedTiers.map((t: any) => (
                      <tr key={t.tier} className="border-b">
                        <td className="p-2 font-medium">{t.tier}</td>
                        <td className="p-2">{t.maxPayload}</td>
                        <td className="p-2">{t.timeout}</td>
                        <td className="p-2"><Badge>{t.strategy}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Regional Connection Probes</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left p-2">Region</th><th className="text-left p-2">Latency</th><th className="text-left p-2">Bandwidth</th><th className="text-left p-2">Tier</th><th className="text-left p-2">Packet Loss</th></tr></thead>
                  <tbody>
                    {resilience.data.connectionProbes.map((p: any) => (
                      <tr key={p.region} className="border-b">
                        <td className="p-2 font-medium">{p.region}</td>
                        <td className="p-2">{p.latencyMs}ms</td>
                        <td className="p-2">{p.bandwidth}</td>
                        <td className="p-2"><Badge variant={p.tier === "EDGE" ? "destructive" : p.tier === "3G" ? "secondary" : "default"}>{p.tier}</Badge></td>
                        <td className="p-2">{(p.packetLoss * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>WebSocket Resilience</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Primary:</span> {resilience.data.webSocketResilience.primaryProtocol}</div>
                  <div><span className="text-muted-foreground">Reconnect:</span> {resilience.data.webSocketResilience.reconnectStrategy}</div>
                  <div><span className="text-muted-foreground">Heartbeat:</span> {resilience.data.webSocketResilience.heartbeatInterval}ms</div>
                  <div><span className="text-muted-foreground">Max Retries:</span> {resilience.data.webSocketResilience.maxReconnectAttempts}</div>
                  <div><span className="text-muted-foreground">Fallbacks:</span> {resilience.data.webSocketResilience.fallbacks.join(", ")}</div>
                  <div><span className="text-muted-foreground">Offline Queue:</span> {resilience.data.webSocketResilience.offlineQueueEnabled ? "Enabled" : "Disabled"}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
