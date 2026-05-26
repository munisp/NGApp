/**
 * GrafanaDashboards.tsx — Embedded Grafana dashboards in the OG-RMM PWA
 *
 * Embeds the 4 provisioned Grafana dashboards (Well KPIs, Alarm Analytics,
 * Telemetry Throughput, Financial KPIs) in iframes with a time-range picker.
 *
 * If Grafana is not running, shows a setup guide with the docker compose command.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Activity, Bell, Zap, DollarSign, ExternalLink, RefreshCw, AlertTriangle, CheckCircle2, Terminal } from "lucide-react";

const ICON_MAP: Record<string, React.ReactNode> = {
  activity: <Activity className="h-4 w-4" />,
  bell: <Bell className="h-4 w-4" />,
  zap: <Zap className="h-4 w-4" />,
  "dollar-sign": <DollarSign className="h-4 w-4" />,
};

const TIME_RANGES = [
  { label: "Last 1 hour", from: "now-1h", to: "now" },
  { label: "Last 6 hours", from: "now-6h", to: "now" },
  { label: "Last 24 hours", from: "now-24h", to: "now" },
  { label: "Last 7 days", from: "now-7d", to: "now" },
  { label: "Last 30 days", from: "now-30d", to: "now" },
  { label: "This month", from: "now/M", to: "now" },
];

export default function GrafanaDashboards() {
  const [selectedFrom, setSelectedFrom] = useState("now-24h");
  const [selectedTo, setSelectedTo] = useState("now");
  const [theme] = useState<"dark" | "light">("dark");
  const [iframeKey, setIframeKey] = useState(0);

  const { data: health, isLoading: healthLoading } = trpc.grafana.health.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const { data: dashboards, isLoading: dashLoading } = trpc.grafana.dashboards.useQuery({
    from: selectedFrom,
    to: selectedTo,
    theme,
  });

  const handleTimeRangeChange = (value: string) => {
    const range = TIME_RANGES.find((r) => r.from === value);
    if (range) {
      setSelectedFrom(range.from);
      setSelectedTo(range.to);
      setIframeKey((k) => k + 1);
    }
  };

  const handleRefresh = () => setIframeKey((k) => k + 1);

  if (healthLoading || dashLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Grafana Dashboards</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Real-time KPI dashboards powered by Grafana 10 + PostgreSQL + Prometheus
          </p>
        </div>
        <div className="flex items-center gap-3">
          {health?.healthy ? (
            <Badge variant="outline" className="text-green-500 border-green-500 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Grafana {health.version}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-500 border-amber-500 gap-1">
              <AlertTriangle className="h-3 w-3" />
              Grafana Offline
            </Badge>
          )}
          <Select value={selectedFrom} onValueChange={handleTimeRangeChange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map((r) => (
                <SelectItem key={r.from} value={r.from}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          {health?.healthy && (
            <Button variant="outline" size="sm" asChild>
              <a href={health.grafanaUrl} target="_blank" rel="noopener noreferrer" className="gap-1">
                <ExternalLink className="h-4 w-4" />
                Open Grafana
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Grafana offline notice */}
      {!health?.healthy && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <Terminal className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-500">Grafana is not running</AlertTitle>
          <AlertDescription className="space-y-2">
            <p className="text-sm">
              Start Grafana with the provisioned dashboards using Docker Compose:
            </p>
            <pre className="bg-background/50 text-xs p-3 rounded border font-mono overflow-x-auto">
              docker compose -f infra/grafana/docker-compose.grafana.yml up -d
            </pre>
            <p className="text-xs text-muted-foreground">
              Access at <strong>http://localhost:3001</strong> (admin / ogrmm-grafana-2024).
              Set <code>GRAFANA_URL</code> env var to point to your Grafana instance.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Dashboard tabs */}
      {dashboards && dashboards.length > 0 && (
        <Tabs defaultValue={dashboards[0].uid} className="w-full">
          <TabsList className="mb-4">
            {dashboards.map((d) => (
              <TabsTrigger key={d.uid} value={d.uid} className="gap-2">
                {ICON_MAP[d.icon] ?? <Activity className="h-4 w-4" />}
                <span className="hidden sm:inline">{d.title}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {dashboards.map((d) => (
            <TabsContent key={d.uid} value={d.uid} className="mt-0">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {ICON_MAP[d.icon] ?? <Activity className="h-4 w-4" />}
                        {d.title}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">{d.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        Auto-refresh: {d.refresh}
                      </Badge>
                      {d.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      <Button variant="ghost" size="sm" asChild>
                        <a href={d.embedUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {health?.healthy ? (
                    <iframe
                      key={`${d.uid}-${iframeKey}`}
                      src={d.embedUrl}
                      className="w-full rounded-b-lg border-0"
                      style={{ height: "600px" }}
                      title={d.title}
                      allow="fullscreen"
                      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
                      <Activity className="h-12 w-12 opacity-20" />
                      <div className="text-center">
                        <p className="font-medium">Dashboard unavailable</p>
                        <p className="text-xs mt-1">Start Grafana to view live dashboards</p>
                      </div>
                      <div className="text-xs text-left bg-muted/50 p-3 rounded font-mono max-w-sm">
                        <span className="text-green-500">$</span> docker compose -f infra/grafana/docker-compose.grafana.yml up -d
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Dashboard info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {dashboards?.map((d) => (
          <Card key={d.uid} className="border border-border/50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-primary/10 text-primary">
                  {ICON_MAP[d.icon] ?? <Activity className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{d.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{d.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {d.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs px-1 py-0">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
