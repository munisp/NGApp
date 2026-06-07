import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldAlert, ShieldCheck, Lock, FileWarning, Activity, BarChart3 } from "lucide-react";

export default function SecurityDashboard() {
  const score = trpc.securityAudit.getScore.useQuery();
  const findings = trpc.securityAudit.getFindings.useQuery();
  const latest = trpc.securityAudit.getLatest.useQuery();

  const isLoading = score.isLoading || findings.isLoading;
  const error = score.error || findings.error;

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;
  if (error) return <div className="text-red-500 p-4">Error loading security status: {error.message}</div>;

  const scoreData = score.data;
  const findingsData = findings.data ?? [];
  const gradeColor = (scoreData?.score ?? 0) >= 85 ? "text-green-600" : (scoreData?.score ?? 0) >= 65 ? "text-yellow-600" : "text-red-600";

  const securityModules = [
    { name: "Security Score", status: `${scoreData?.score ?? 0}/100 (${scoreData?.grade ?? "N/A"})`, icon: BarChart3, ok: (scoreData?.score ?? 0) >= 75 },
    { name: "Fixed Findings", status: `${scoreData?.fixedCount ?? 0} resolved`, icon: ShieldCheck, ok: true },
    { name: "Open Findings", status: `${scoreData?.remainingCount ?? 0} remaining`, icon: ShieldAlert, ok: (scoreData?.remainingCount ?? 0) === 0 },
    { name: "Resolution Rate", status: `${scoreData?.resolutionRate ?? 100}%`, icon: Activity, ok: (scoreData?.resolutionRate ?? 100) >= 80 },
    { name: "Total Scanned", status: `${scoreData?.totalCount ?? 0} checks`, icon: Shield, ok: true },
    { name: "Last Scan", status: latest.data?.scannedAt ? new Date(latest.data.scannedAt).toLocaleDateString() : "Never", icon: FileWarning, ok: !!latest.data },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold">Security Dashboard</h1>
          <p className="text-muted-foreground">Real-time security posture monitoring via tRPC</p>
        </div>
        <div className="ml-auto">
          <span className={`text-4xl font-bold ${gradeColor}`}>{scoreData?.grade ?? "N/A"}</span>
        </div>
      </div>

      {/* Security Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {securityModules.map((mod) => (
          <Card key={mod.name}>
            <CardContent className="flex items-center gap-4 p-4">
              <mod.icon className={`h-8 w-8 ${mod.ok ? "text-green-600" : "text-red-600"}`} />
              <div>
                <p className="font-medium">{mod.name}</p>
                <Badge variant={mod.ok ? "default" : "destructive"}>
                  {mod.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Security Findings Table */}
      <Card>
        <CardHeader><CardTitle>Security Findings ({findingsData.length})</CardTitle></CardHeader>
        <CardContent>
          {findingsData.length === 0 ? (
            <p className="text-muted-foreground">No security findings recorded. Run a scan to generate findings.</p>
          ) : (
            <div className="space-y-2">
              {findingsData.map((f) => (
                <div key={f.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={f.severity === "critical" || f.severity === "high" ? "destructive" : "default"} className="text-xs">
                        {f.severity}
                      </Badge>
                      <span className="font-medium text-sm">{f.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{f.description}</p>
                  </div>
                  <Badge variant={f.status === "fixed" || f.status === "mitigated" ? "default" : "destructive"}>
                    {f.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
