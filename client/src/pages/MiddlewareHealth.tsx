import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server, Activity, Zap, Database, Shield, Cpu, Globe, MessageSquare, Lock, Layers, Landmark } from "lucide-react";

const serviceIcons: Record<string, typeof Server> = {
  PostgreSQL: Database,
  postgres: Database,
  Redis: Zap,
  redis: Zap,
  Kafka: MessageSquare,
  kafka: MessageSquare,
  Temporal: Activity,
  temporal: Activity,
  Keycloak: Lock,
  keycloak: Lock,
  TigerBeetle: Landmark,
  tigerBeetleHttp: Landmark,
  OpenSearch: Globe,
  openSearch: Globe,
  APISIX: Shield,
  apisix: Shield,
  Dapr: Layers,
  daprSidecar: Layers,
  Fluvio: Activity,
  fluvio: Activity,
  Permify: Lock,
  permify: Lock,
  Mojaloop: Landmark,
  mojaloop: Landmark,
};

export default function MiddlewareHealth() {
  const { data, isLoading, error, refetch } = trpc.orchestration.middlewareHealth.useQuery(undefined, {
    refetchInterval: 15_000,
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;

  const statusColor = (status: string) => {
    switch (status) {
      case "healthy": return "text-green-600 bg-green-50";
      case "degraded": return "text-yellow-600 bg-yellow-50";
      case "unhealthy": return "text-red-600 bg-red-50";
      default: return "text-muted-foreground bg-muted";
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "healthy": return "default";
      case "degraded": return "secondary";
      case "unhealthy": return "destructive";
      default: return "outline";
    }
  };

  const overallStatus = data ? (data.healthPct >= 80 ? "healthy" : data.healthPct >= 50 ? "degraded" : "unhealthy") : "unknown";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Cpu className="h-8 w-8 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold">Middleware Health</h1>
            <p className="text-muted-foreground">Service connectivity and status monitoring via tRPC</p>
          </div>
        </div>
        <button onClick={() => refetch()} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">Refresh</button>
      </div>

      {error && <div className="text-red-500 p-4">Error: {error.message}</div>}

      {/* Overall Status */}
      <Card className={statusColor(overallStatus)}>
        <CardContent className="flex items-center justify-center gap-4 py-8">
          <Server className="h-12 w-12" />
          <div className="text-center">
            <p className="text-lg font-medium">Overall Platform Health</p>
            <p className="text-3xl font-bold">{data?.online ?? 0}/{data?.total ?? 0} Services Online ({data?.healthPct ?? 0}%)</p>
            <p className="text-sm opacity-70">Last checked: {data?.checkedAt ? new Date(data.checkedAt).toLocaleTimeString() : "N/A"}</p>
          </div>
        </CardContent>
      </Card>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.middleware?.map((service) => {
          const Icon = serviceIcons[service.service] ?? Server;
          return (
            <Card key={service.service}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {service.service}
                </CardTitle>
                <Badge variant={statusBadge(service.status) as "default" | "secondary" | "destructive" | "outline"}>{service.status}</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  <p>Latency: {service.latencyMs ?? 0}ms</p>
                  {service.error && <p className="text-red-500 truncate">Error: {service.error}</p>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
