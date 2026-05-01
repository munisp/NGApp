import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server, Activity, Zap, Database, Shield, Cpu, Globe, MessageSquare, Lock, Layers, Landmark } from "lucide-react";

interface ServiceHealth {
  name: string;
  status: "healthy" | "degraded" | "unhealthy" | "unconfigured";
  latencyMs: number;
  details: Record<string, unknown>;
  checkedAt: string;
}

interface MiddlewareHealthData {
  overall: string;
  services: ServiceHealth[];
  checkedAt: string;
}

const serviceIcons: Record<string, typeof Server> = {
  PostgreSQL: Database,
  Redis: Zap,
  Kafka: MessageSquare,
  Temporal: Activity,
  Keycloak: Lock,
  TigerBeetle: Landmark,
  OpenSearch: Globe,
  APISIX: Shield,
  Dapr: Layers,
  Fluvio: Activity,
  Permify: Lock,
  Mojaloop: Landmark,
};

export default function MiddlewareHealth() {
  const { data, isLoading, error, refetch } = useQuery<MiddlewareHealthData>({
    queryKey: ["middleware-health"],
    queryFn: async () => {
      const res = await fetch("/api/middleware/health");
      if (!res.ok) throw new Error("Failed to fetch middleware health");
      return res.json();
    },
    refetchInterval: 15_000,
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;

  const statusColor = (status: string) => {
    switch (status) {
      case "healthy": return "text-green-600 bg-green-50";
      case "degraded": return "text-yellow-600 bg-yellow-50";
      case "unhealthy": return "text-red-600 bg-red-50";
      default: return "text-gray-500 bg-gray-50";
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Cpu className="h-8 w-8 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold">Middleware Health</h1>
            <p className="text-muted-foreground">Service connectivity and status monitoring</p>
          </div>
        </div>
        <button onClick={() => refetch()} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">Refresh</button>
      </div>

      {/* Overall Status */}
      <Card className={statusColor(data?.overall ?? "unknown")}>
        <CardContent className="flex items-center justify-center gap-4 py-8">
          <Server className="h-12 w-12" />
          <div className="text-center">
            <p className="text-lg font-medium">Overall Platform Health</p>
            <p className="text-3xl font-bold uppercase">{data?.overall ?? "Unknown"}</p>
            <p className="text-sm opacity-70">Last checked: {data?.checkedAt ? new Date(data.checkedAt).toLocaleTimeString() : "N/A"}</p>
          </div>
        </CardContent>
      </Card>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.services?.map((service) => {
          const Icon = serviceIcons[service.name] ?? Server;
          return (
            <Card key={service.name}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {service.name}
                </CardTitle>
                <Badge variant={statusBadge(service.status) as any}>{service.status}</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  <p>Latency: {service.latencyMs}ms</p>
                  {Object.entries(service.details).map(([key, value]) => (
                    <p key={key} className="truncate">{key}: {String(value)}</p>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
