import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Database, Activity, RefreshCw, Plus, Search, TrendingUp, Clock } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function HistorianPage() {
  const [selectedStream, setSelectedStream] = useState<string | null>(null);
  const [resolution, setResolution] = useState<"raw" | "1m" | "5m" | "1h" | "1d">("1h");
  const [search, setSearch] = useState("");

  const { data: streams, isLoading, refetch } = trpc.historian.listStreams.useQuery({
    search: search || undefined,
  });

  const now = Date.now();
  const { data: tsData } = trpc.historian.queryTimeSeries.useQuery(
    { tagName: selectedStream!, fromTs: now - 24 * 3600 * 1000, toTs: now, resolution },
    { enabled: selectedStream !== null }
  );

  const { data: summary } = trpc.historian.getSummary.useQuery();

  const seedMutation = trpc.historian.seedDefaultStreams.useMutation({
    onSuccess: (data: { seeded: number }) => {
      toast.success(`Historian streams seeded: ${data.seeded} default tags created.`);
      refetch();
    },
  });

  const createMutation = trpc.historian.createStream.useMutation({
    onSuccess: () => { toast.success("Stream created"); refetch(); },
  });

  const chartData = (tsData?.points ?? []).map((d: { ts: number; value: number }) => ({
    time: new Date(d.ts).toLocaleTimeString(),
    value: d.value,
  }));

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Database className="w-7 h-7 text-cyan-400" />
              Process Historian
            </h1>
            <p className="text-zinc-400 text-sm mt-1">QuestDB + TimescaleDB Time-Series Historian with Continuous Aggregates</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
            <Button size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
              <Plus className="w-4 h-4 mr-1" /> Seed Streams
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="text-zinc-400 text-xs mb-1">Total Streams</div>
              <div className="text-2xl font-bold text-white">{summary?.total ?? 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="text-zinc-400 text-xs mb-1">Active</div>
              <div className="text-2xl font-bold text-cyan-400">{summary?.active ?? 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="text-zinc-400 text-xs mb-1">Data Types</div>
              <div className="text-2xl font-bold text-green-400">{Object.keys(summary?.byDataType ?? {}).length}</div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="text-zinc-400 text-xs mb-1">Avg Retention</div>
              <div className="text-2xl font-bold text-yellow-400">
                {summary && summary.total > 0 ? Math.round(summary.totalRetentionDays / summary.total) : 0}d
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stream Browser */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Stream Browser ({streams?.length ?? 0})
              </CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
                <Input
                  placeholder="Search streams..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-96 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center text-zinc-500 text-sm">Loading streams...</div>
              ) : streams?.length === 0 ? (
                <div className="p-4 text-center text-zinc-500 text-sm">No streams. Click "Seed Streams" to start.</div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {streams?.map((stream) => (
                    <div
                      key={stream.id}
                      className={`p-3 cursor-pointer hover:bg-zinc-800/50 transition-colors ${selectedStream === stream.tagName ? "bg-zinc-800/70 border-l-2 border-cyan-500" : ""}`}
                      onClick={() => setSelectedStream(stream.tagName)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-mono text-cyan-400">{stream.tagName}</div>
                          <div className="text-sm text-white">{stream.description ?? stream.tagName}</div>
                          <div className="text-xs text-zinc-500">
                            {stream.engineeringUnit ?? "—"} · {stream.dataType} · {stream.sampleRateHz} Hz
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-xs ${stream.isActive ? "text-green-400 border-green-500/30" : "text-zinc-400 border-zinc-700"}`}>
                          {stream.isActive ? "active" : "inactive"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chart Panel */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                    {selectedStream ? `Trend: ${selectedStream}` : "Select a stream to view trend"}
                  </CardTitle>
                  {selectedStream && (
                    <Select value={resolution} onValueChange={(v) => setResolution(v as typeof resolution)}>
                      <SelectTrigger className="w-24 h-8 text-xs bg-zinc-800 border-zinc-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="raw">Raw</SelectItem>
                        <SelectItem value="1m">1 min</SelectItem>
                        <SelectItem value="5m">5 min</SelectItem>
                        <SelectItem value="1h">1 hour</SelectItem>
                        <SelectItem value="1d">1 day</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-zinc-500 text-sm">
                    {selectedStream ? "No data for this interval." : "Select a stream from the browser."}
                  </div>
                ) : (
                  <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="time" tick={{ fill: "#71717a", fontSize: 10 }} />
                        <YAxis tick={{ fill: "#71717a", fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", color: "#fff" }} />
                        <Line type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stream Details */}
            {selectedStream && streams && (
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    Stream Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const s = streams.find((x) => x.tagName === selectedStream);
                    if (!s) return null;
                    return (
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><span className="text-zinc-500">Tag Name:</span> <span className="text-white font-mono">{s.tagName}</span></div>
                        <div><span className="text-zinc-500">Well ID:</span> <span className="text-white">{s.wellId ?? "—"}</span></div>
                        <div><span className="text-zinc-500">Data Type:</span> <span className="text-white">{s.dataType}</span></div>
                        <div><span className="text-zinc-500">Sample Rate:</span> <span className="text-white">{s.sampleRateHz} Hz</span></div>
                        <div><span className="text-zinc-500">Engineering Unit:</span> <span className="text-white">{s.engineeringUnit ?? "—"}</span></div>
                        <div><span className="text-zinc-500">Retention:</span> <span className="text-white">{s.retentionDays} days</span></div>
                        <div><span className="text-zinc-500">Compression:</span> <span className="text-white">{s.compressionEnabled ? `Enabled (±${s.compressionDeviation})` : "Disabled"}</span></div>
                        <div><span className="text-zinc-500">QuestDB Table:</span> <span className="text-white font-mono">{s.questdbTable ?? "auto"}</span></div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            {/* Quick Add Stream */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base">Add New Stream</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    id="new-tag-name"
                    placeholder="Tag name (e.g. WELL-01.TUBING_PRESSURE)"
                    className="bg-zinc-800 border-zinc-700 text-white text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      const el = document.getElementById("new-tag-name") as HTMLInputElement;
                      if (!el?.value) return;
                      createMutation.mutate({ tagName: el.value, engineeringUnit: "psi", dataType: "float" });
                      el.value = "";
                    }}
                    disabled={createMutation.isPending}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
