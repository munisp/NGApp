import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldAlert, ShieldCheck, Lock, FileWarning, Activity } from "lucide-react";

interface SecurityStatus {
  ransomware: {
    status: string;
    fileIntegrity: Array<{ file: string; status: string; detail: string }>;
    canaryFiles: { intact: boolean; compromised: string[] };
    auditChain: { valid: boolean; brokenAt: number | null };
  };
  blockedIps: Array<{ ip: string; expiresAt: string }>;
  securityHeaders: string;
  pbac: string;
  ddosProtection: string;
  inputSanitization: string;
  auditLogging: string;
}

export default function SecurityDashboard() {
  const { data, isLoading, error } = useQuery<SecurityStatus>({
    queryKey: ["security-status"],
    queryFn: async () => {
      const res = await fetch("/api/security/status");
      if (!res.ok) throw new Error("Failed to fetch security status");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;
  if (error) return <div className="text-red-500 p-4">Error loading security status</div>;

  const securityModules = [
    { name: "DDoS Protection", status: data?.ddosProtection ?? "unknown", icon: ShieldAlert },
    { name: "PBAC (Policy-Based Access)", status: data?.pbac ?? "unknown", icon: Lock },
    { name: "Input Sanitization", status: data?.inputSanitization ?? "unknown", icon: Shield },
    { name: "Security Headers", status: data?.securityHeaders ?? "unknown", icon: ShieldCheck },
    { name: "Audit Logging", status: data?.auditLogging ?? "unknown", icon: Activity },
    { name: "Ransomware Protection", status: data?.ransomware?.status ?? "unknown", icon: FileWarning },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold">Security Dashboard</h1>
          <p className="text-muted-foreground">Real-time security posture monitoring</p>
        </div>
      </div>

      {/* Security Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {securityModules.map((mod) => (
          <Card key={mod.name}>
            <CardContent className="flex items-center gap-4 p-4">
              <mod.icon className={`h-8 w-8 ${mod.status === "enabled" || mod.status === "SECURE" ? "text-green-600" : "text-red-600"}`} />
              <div>
                <p className="font-medium">{mod.name}</p>
                <Badge variant={mod.status === "enabled" || mod.status === "SECURE" ? "default" : "destructive"}>
                  {mod.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* File Integrity */}
      <Card>
        <CardHeader><CardTitle>File Integrity Monitoring</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data?.ransomware?.fileIntegrity?.map((f) => (
              <div key={f.file} className="flex items-center justify-between py-2 border-b last:border-0">
                <code className="text-sm">{f.file}</code>
                <Badge variant={f.status === "OK" ? "default" : "destructive"}>{f.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Audit Chain */}
      <Card>
        <CardHeader><CardTitle>Immutable Audit Chain</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {data?.ransomware?.auditChain?.valid ? (
              <><ShieldCheck className="h-5 w-5 text-green-600" /><span className="text-green-600 font-medium">Chain integrity verified</span></>
            ) : (
              <><ShieldAlert className="h-5 w-5 text-red-600" /><span className="text-red-600 font-medium">Chain broken at entry {data?.ransomware?.auditChain?.brokenAt}</span></>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Blocked IPs */}
      <Card>
        <CardHeader><CardTitle>Blocked IPs ({data?.blockedIps?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {data?.blockedIps?.length === 0 ? (
            <p className="text-muted-foreground">No IPs currently blocked</p>
          ) : (
            <div className="space-y-2">
              {data?.blockedIps?.map((b) => (
                <div key={b.ip} className="flex items-center justify-between py-2 border-b">
                  <code>{b.ip}</code>
                  <span className="text-sm text-muted-foreground">Expires: {b.expiresAt}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
