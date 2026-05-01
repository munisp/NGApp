import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, Database, GitBranch, Play, Pause, RefreshCw, TrendingUp, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const engineColors: Record<string, string> = {
  nifi: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  dbt: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  airflow: "bg-green-500/20 text-green-400 border-green-500/30",
};

const statusColors: Record<string, string> = {
  running: "bg-emerald-500/20 text-emerald-400",
  stopped: "bg-slate-500/20 text-slate-400",
  error: "bg-red-500/20 text-red-400",
  paused: "bg-yellow-500/20 text-yellow-400",
  success: "bg-emerald-500/20 text-emerald-400",
  failed: "bg-red-500/20 text-red-400",
};

export default function DataPipeline() {
  const [engine, setEngine] = useState<"all" | "nifi" | "dbt" | "airflow">("all");
  const { data: flows, refetch: refetchFlows } = trpc.phase12.dataPipeline.listFlows.useQuery({ engine });
  const { data: dbtModels } = trpc.phase12.dataPipeline.getDbtModels.useQuery();
  const { data: airflowDags } = trpc.phase12.dataPipeline.getAirflowDags.useQuery();
  const { data: stats } = trpc.phase12.dataPipeline.getPipelineStats.useQuery();

  const updateStatus = trpc.phase12.dataPipeline.updateFlowStatus.useMutation({
    onSuccess: () => { refetchFlows(); toast.success("Flow status updated"); },
  });
  const toggleDag = trpc.phase12.dataPipeline.toggleDag.useMutation({
    onSuccess: () => { toast.success("DAG toggled"); },
  });

  const nifiFlows = flows?.filter(f => f.engine === "nifi") ?? [];
  const dbtFlows = flows?.filter(f => f.engine === "dbt") ?? [];
  const airflowFlows = flows?.filter(f => f.engine === "airflow") ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Data Pipeline Orchestration</h1>
          <p className="text-slate-400 text-sm mt-1">Apache NiFi · dbt · Apache Airflow — NDPA-compliant data flows</p>
        </div>
        <Button onClick={() => refetchFlows()} variant="outline" size="sm" className="border-slate-600 text-slate-300">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-blue-400" />
              <div>
                <p className="text-slate-400 text-xs">Active Flows</p>
                <p className="text-2xl font-bold text-white">{stats?.flows?.running ?? 0}</p>
                <p className="text-slate-500 text-xs">of {stats?.flows?.total ?? 0} total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Database className="w-8 h-8 text-orange-400" />
              <div>
                <p className="text-slate-400 text-xs">dbt Models</p>
                <p className="text-2xl font-bold text-white">{stats?.dbt?.success ?? 0}</p>
                <p className="text-slate-500 text-xs">passing of {stats?.dbt?.total ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <GitBranch className="w-8 h-8 text-green-400" />
              <div>
                <p className="text-slate-400 text-xs">Airflow DAGs</p>
                <p className="text-2xl font-bold text-white">{stats?.airflow?.active ?? 0}</p>
                <p className="text-slate-500 text-xs">active of {stats?.airflow?.total ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-purple-400" />
              <div>
                <p className="text-slate-400 text-xs">Records Processed</p>
                <p className="text-2xl font-bold text-white">
                  {stats?.flows?.total_records ? (parseInt(stats.flows.total_records) / 1000).toFixed(0) + "K" : "0"}
                </p>
                <p className="text-slate-500 text-xs">total across all flows</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NiFi / dbt / Airflow Value Proposition */}
      <Card className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-blue-700/40">
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-6 text-sm">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full bg-blue-400"></span>
                <span className="font-semibold text-blue-300">Apache NiFi</span>
              </div>
              <p className="text-slate-400">Real-time data ingestion from NIMC, CBN, NCC, NHIS APIs. Handles 500K+ records/hour with built-in provenance tracking for NDPA audit trails. Ensures data lineage from source to compliance database.</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full bg-orange-400"></span>
                <span className="font-semibold text-orange-300">dbt (data build tool)</span>
              </div>
              <p className="text-slate-400">Transforms raw compliance events into analytics-ready marts. Compliance score aggregation, DSAR SLA metrics, breach analytics, and vendor risk scoring — all with version-controlled SQL and automated testing.</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full bg-green-400"></span>
                <span className="font-semibold text-green-300">Apache Airflow</span>
              </div>
              <p className="text-slate-400">Orchestrates complex multi-step workflows: daily compliance refreshes, weekly NDPC report generation, monthly penalty reconciliation with CBN, and ML model retraining pipelines.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="nifi">
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="nifi" className="data-[state=active]:bg-blue-600">NiFi Flows</TabsTrigger>
          <TabsTrigger value="dbt" className="data-[state=active]:bg-orange-600">dbt Models</TabsTrigger>
          <TabsTrigger value="airflow" className="data-[state=active]:bg-green-700">Airflow DAGs</TabsTrigger>
        </TabsList>

        <TabsContent value="nifi">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-base">Apache NiFi Data Flows</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-400">Flow Name</TableHead>
                    <TableHead className="text-slate-400">Source → Target</TableHead>
                    <TableHead className="text-slate-400">Records</TableHead>
                    <TableHead className="text-slate-400">Errors</TableHead>
                    <TableHead className="text-slate-400">Schedule</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nifiFlows.map(flow => (
                    <TableRow key={flow.id} className="border-slate-700">
                      <TableCell className="text-white font-medium">{flow.flow_name}</TableCell>
                      <TableCell className="text-slate-400 text-xs">
                        <span className="text-blue-400">{flow.source_system}</span>
                        <span className="mx-1">→</span>
                        <span className="text-green-400">{flow.target_system}</span>
                      </TableCell>
                      <TableCell className="text-slate-300">{(flow.records_processed / 1000).toFixed(1)}K</TableCell>
                      <TableCell>
                        <span className={flow.error_count > 0 ? "text-red-400" : "text-emerald-400"}>
                          {flow.error_count}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-400 text-xs font-mono">{flow.schedule_expression}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[flow.status] ?? ""}>{flow.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-400"
                            onClick={() => updateStatus.mutate({ flowId: flow.flow_id, status: "running" })}>
                            <Play className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-yellow-400"
                            onClick={() => updateStatus.mutate({ flowId: flow.flow_id, status: "stopped" })}>
                            <Pause className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dbt">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-base">dbt Transformation Models</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-400">Model Name</TableHead>
                    <TableHead className="text-slate-400">Schema</TableHead>
                    <TableHead className="text-slate-400">Materialisation</TableHead>
                    <TableHead className="text-slate-400">Rows Affected</TableHead>
                    <TableHead className="text-slate-400">Exec Time</TableHead>
                    <TableHead className="text-slate-400">Last Run</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dbtModels?.map(m => (
                    <TableRow key={m.id} className="border-slate-700">
                      <TableCell className="text-white font-mono text-sm">{m.model_name}</TableCell>
                      <TableCell><Badge variant="outline" className="border-orange-500/40 text-orange-400">{m.schema}</Badge></TableCell>
                      <TableCell className="text-slate-400 capitalize">{m.materialisation}</TableCell>
                      <TableCell className="text-slate-300">{(m.rows_affected / 1000).toFixed(0)}K</TableCell>
                      <TableCell className="text-slate-400">{(m.execution_time_ms / 1000).toFixed(1)}s</TableCell>
                      <TableCell className="text-slate-400 text-xs">
                        {m.last_run_at ? new Date(m.last_run_at).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[m.status ?? ""] ?? ""}>{m.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="airflow">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-base">Apache Airflow DAGs</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-400">DAG Name</TableHead>
                    <TableHead className="text-slate-400">Schedule</TableHead>
                    <TableHead className="text-slate-400">Tasks</TableHead>
                    <TableHead className="text-slate-400">Success / Fail</TableHead>
                    <TableHead className="text-slate-400">Last Run</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {airflowDags?.map(dag => (
                    <TableRow key={dag.id} className="border-slate-700">
                      <TableCell>
                        <div>
                          <p className="text-white font-medium">{dag.dag_name}</p>
                          <p className="text-slate-500 text-xs">{dag.dag_id}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-400 font-mono text-xs">{dag.schedule}</TableCell>
                      <TableCell className="text-slate-300">{dag.task_count}</TableCell>
                      <TableCell>
                        <span className="text-emerald-400">{dag.success_count}</span>
                        <span className="text-slate-500 mx-1">/</span>
                        <span className="text-red-400">{dag.failure_count}</span>
                      </TableCell>
                      <TableCell className="text-slate-400 text-xs">
                        {dag.last_run_at ? new Date(dag.last_run_at).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={dag.is_paused ? statusColors.paused : (dag.is_active ? statusColors.running : statusColors.stopped)}>
                          {dag.is_paused ? "paused" : dag.is_active ? "active" : "inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-yellow-400"
                          onClick={() => toggleDag.mutate({ dagId: dag.dag_id, isPaused: !dag.is_paused })}>
                          {dag.is_paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
