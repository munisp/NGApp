/**
 * SeedAdmin.tsx — One-click master data seeder
 * Calls trpc.masterSeed.seedAll which populates all 17 domain tables with demo data.
 * Requires admin role.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, SkipForward, Database, Loader2, Play, RefreshCw, BarChart3 } from "lucide-react";
import { toast } from "sonner";

interface SeedResult {
  domain: string;
  seeded: number;
  skipped: boolean;
  error?: string;
}

export default function SeedAdmin() {
  const [results, setResults] = useState<SeedResult[]>([]);
  const [done, setDone] = useState(false);

  // Live DB status — shows current row counts per table
  const statusQuery = trpc.masterSeed.status.useQuery(undefined, {
    refetchInterval: 10000, // poll every 10s
  });

  const mutation = trpc.masterSeed.seedAll.useMutation({
    onSuccess: (data: any) => {
      setResults(data.results ?? []);
      setDone(true);
      statusQuery.refetch();
      const total = (data.results ?? []).reduce((s: number, r: SeedResult) => s + r.seeded, 0);
      const errors = (data.results ?? []).filter((r: SeedResult) => r.error).length;
      if (errors === 0) {
        toast.success(`Seeded ${total} records across ${data.results?.length ?? 0} domains`);
      } else {
        toast.warning(`Seeded ${total} records — ${errors} domain(s) had errors`);
      }
    },
    onError: (e) => {
      toast.error(`Seed failed: ${e.message}`);
    },
  });

  const totalSeeded = results.reduce((s, r) => s + r.seeded, 0);
  const skipped = results.filter(r => r.skipped).length;
  const errored = results.filter(r => r.error).length;
  const succeeded = results.filter(r => !r.skipped && !r.error).length;

  const statusRows: { table: string; count: number }[] = (statusQuery.data as any) ?? [];
  const totalRows = statusRows.reduce((s, r) => s + r.count, 0);
  const populatedTables = statusRows.filter(r => r.count > 0).length;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Database className="w-7 h-7 text-blue-400" />
          <h1 className="text-2xl font-bold tracking-tight">Platform Data Seeder</h1>
          <Badge variant="outline" className="text-xs">Admin Only</Badge>
        </div>
        <p className="text-muted-foreground text-sm max-w-2xl">
          One-click demo data population across all 17 platform domains. Each domain is seeded
          idempotently — existing data is preserved and domains with existing records are skipped.
        </p>
      </div>

      {/* Live DB Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            Current Database State
            {statusQuery.isLoading ? (
              <Badge variant="outline" className="text-xs ml-auto">Loading…</Badge>
            ) : (
              <Badge variant="outline" className={`text-xs ml-auto ${populatedTables > 0 ? "text-green-400 border-green-500/30" : "text-muted-foreground"}`}>
                {populatedTables}/{statusRows.length} tables · {totalRows.toLocaleString()} total rows
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statusRows.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {statusRows.map((row) => (
                <div key={row.table} className={`p-2 rounded border text-center transition-colors ${
                  row.count > 0
                    ? "bg-green-500/10 border-green-500/30"
                    : "bg-muted/20 border-border/30"
                }`}>
                  <div className={`text-lg font-bold font-mono ${
                    row.count > 0 ? "text-green-400" : "text-muted-foreground"
                  }`}>{row.count.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground truncate leading-tight mt-0.5" title={row.table}>
                    {row.table.replace(/_/g, " ")}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground text-sm">
              {statusQuery.isLoading ? "Checking database…" : "Database not available"}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seed button */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Master Seed</CardTitle>
          <CardDescription className="text-xs">
            Seeds: Wells · Alarms · Production Records · Well Physics · Digital Twin Models ·
            Telemetry · IEC 62443 Controls · SOC 2 Controls · Historian Streams ·
            SaaS Plans · Marketplace Apps · WITSML Wells · OPC-UA Nodes ·
            Drone Inspections · Emission Sources · Production Allocation · Reservoir Simulations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => { setResults([]); setDone(false); mutation.mutate(); }}
              disabled={mutation.isPending}
            >
              {mutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Seeding…</>
                : <><Play className="w-4 h-4 mr-2" /> Seed All Domains</>
              }
            </Button>
            {done && (
              <Button variant="outline" onClick={() => { setResults([]); setDone(false); }}>
                <RefreshCw className="w-4 h-4 mr-2" /> Reset
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => statusQuery.refetch()} disabled={statusQuery.isFetching} className="ml-auto text-xs text-muted-foreground">
              <RefreshCw className={`w-3 h-3 mr-1 ${statusQuery.isFetching ? "animate-spin" : ""}`} />
              Refresh Status
            </Button>
          </div>

          {mutation.isPending && (
            <div className="space-y-2">
              <Progress value={undefined} className="h-1 animate-pulse" />
              <p className="text-muted-foreground text-xs">Populating all domains…</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {done && results.length > 0 && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-3">
            <Card className="bg-muted/20">
              <CardContent className="pt-4 pb-3 text-center">
                <div className="text-2xl font-bold text-blue-400">{totalSeeded}</div>
                <div className="text-muted-foreground text-xs">Records Seeded</div>
              </CardContent>
            </Card>
            <Card className="bg-muted/20">
              <CardContent className="pt-4 pb-3 text-center">
                <div className="text-2xl font-bold text-green-400">{succeeded}</div>
                <div className="text-muted-foreground text-xs">Domains Seeded</div>
              </CardContent>
            </Card>
            <Card className="bg-muted/20">
              <CardContent className="pt-4 pb-3 text-center">
                <div className="text-2xl font-bold text-amber-400">{skipped}</div>
                <div className="text-muted-foreground text-xs">Domains Skipped</div>
              </CardContent>
            </Card>
            <Card className="bg-muted/20">
              <CardContent className="pt-4 pb-3 text-center">
                <div className="text-2xl font-bold text-red-400">{errored}</div>
                <div className="text-muted-foreground text-xs">Errors</div>
              </CardContent>
            </Card>
          </div>

          {/* Per-domain results */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Domain Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {results.map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                    <div className="flex items-center gap-2">
                      {r.error
                        ? <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        : r.skipped
                          ? <SkipForward className="w-4 h-4 text-amber-400 flex-shrink-0" />
                          : <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                      }
                      <span className="text-sm font-medium">{r.domain}</span>
                      {r.error && <span className="text-red-400 text-xs truncate max-w-xs">{r.error}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {r.skipped && <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/30">Skipped (data exists)</Badge>}
                      {!r.skipped && !r.error && <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30">{r.seeded} records</Badge>}
                      {r.error && <Badge className="text-xs bg-red-500/20 text-red-400 border-red-500/30">Error</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {errored > 0 && (
            <Alert className="border-amber-500/30 bg-amber-500/10">
              <AlertDescription className="text-xs">
                Some domains failed to seed. This is usually due to missing foreign key dependencies.
                Try running the seed again — domains with existing data will be skipped and failed domains will be retried.
              </AlertDescription>
            </Alert>
          )}

          {errored === 0 && (
            <Alert className="border-green-500/30 bg-green-500/10">
              <AlertDescription className="text-xs">
                All domains seeded successfully. Navigate to any page to see the populated data.
                The Digital Twin, Historian, IEC 62443, SOC 2, and all other pages now have live demo data.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}
