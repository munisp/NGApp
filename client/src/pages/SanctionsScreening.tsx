import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Search, AlertTriangle, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function SanctionsScreening() {
  const [searchName, setSearchName] = useState("");
  const [searchBVN, setSearchBVN] = useState("");
  const [tab, setTab] = useState<"screen" | "history" | "lists">("screen");
  const [lastResult, setLastResult] = useState<{
    id: string; name: string; result: string; score: number;
    listsChecked: number; timeMs: number; matchedList: string | null;
  } | null>(null);

  const screenMutation = trpc.sanctionsScreening.screen.useMutation({
    onSuccess: (data) => {
      setLastResult(data);
      if (data.result === 'CLEAR') {
        toast.success(`CLEAR — No matches found across ${data.listsChecked} lists (${data.timeMs}ms)`);
      } else if (data.result === 'POTENTIAL_MATCH') {
        toast.warning(`POTENTIAL MATCH — Score: ${data.score} on ${data.matchedList}`);
      } else {
        toast.error(`CONFIRMED MATCH — ${data.matchedList}`);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: history } = trpc.sanctionsScreening.getHistory.useQuery(undefined, { enabled: tab === 'history' });
  const { data: lists } = trpc.sanctionsScreening.getLists.useQuery(undefined, { enabled: tab === 'lists' });
  const { data: stats } = trpc.sanctionsScreening.getStats.useQuery();

  const handleScreen = () => {
    if (!searchName.trim()) { toast.error("Name is required"); return; }
    screenMutation.mutate({ name: searchName, bvn: searchBVN || undefined });
  };

  const screenings = history || [];
  const sanctionsLists = lists || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="h-6 w-6" /> Sanctions Screening</h1>
        {stats && (
          <Badge variant="outline">
            {stats.totalEntries.toLocaleString()} entries across {stats.listsCount} lists
          </Badge>
        )}
      </div>

      <div className="flex gap-2">
        {(["screen", "history", "lists"] as const).map((t) => (
          <Button key={t} variant={tab === t ? "default" : "outline"} size="sm" onClick={() => setTab(t)}>
            {t === "screen" ? "Screen" : t === "history" ? "History" : "Lists"}
          </Button>
        ))}
      </div>

      {tab === "screen" && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Real-Time Screening</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Full Name</label>
                  <Input placeholder="Enter sender or recipient name" value={searchName} onChange={(e) => setSearchName(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium">BVN (Optional)</label>
                  <Input placeholder="11-digit BVN" value={searchBVN} onChange={(e) => setSearchBVN(e.target.value)} />
                </div>
              </div>
              <Button onClick={handleScreen} disabled={screenMutation.isPending} className="w-full">
                {screenMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                Screen Against All Lists
              </Button>
              <p className="text-xs text-muted-foreground">Screens against: OFAC SDN, UN Security Council, EU Sanctions, EFCC Watchlist, PEP Database, NFIU Watchlist, INTERPOL</p>
            </CardContent>
          </Card>

          {lastResult && (
            <Card className={lastResult.result === 'CLEAR' ? 'border-green-200' : lastResult.result === 'POTENTIAL_MATCH' ? 'border-yellow-200' : 'border-red-200'}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {lastResult.result === 'CLEAR' ? <CheckCircle className="h-8 w-8 text-green-500" /> :
                   lastResult.result === 'POTENTIAL_MATCH' ? <AlertTriangle className="h-8 w-8 text-yellow-500" /> :
                   <XCircle className="h-8 w-8 text-red-500" />}
                  <div>
                    <p className="font-semibold">{lastResult.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {lastResult.result} — Score: {lastResult.score} — {lastResult.listsChecked} lists checked in {lastResult.timeMs}ms
                      {lastResult.matchedList && ` — Matched: ${lastResult.matchedList}`}
                    </p>
                  </div>
                  <Badge className="ml-auto" variant={lastResult.result === 'CLEAR' ? 'default' : 'destructive'}>
                    {lastResult.result.replace('_', ' ')}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-3 gap-4">
            <Card><CardContent className="p-4 text-center"><CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" /><p className="text-2xl font-bold">{stats?.clearCount ?? 0}</p><p className="text-sm text-muted-foreground">Clear</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><AlertTriangle className="h-8 w-8 mx-auto text-yellow-500 mb-2" /><p className="text-2xl font-bold">{stats?.potentialMatchCount ?? 0}</p><p className="text-sm text-muted-foreground">Potential Match</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><XCircle className="h-8 w-8 mx-auto text-red-500 mb-2" /><p className="text-2xl font-bold">{stats?.confirmedMatchCount ?? 0}</p><p className="text-sm text-muted-foreground">Confirmed Match</p></CardContent></Card>
          </div>
        </div>
      )}

      {tab === "history" && (
        <Card>
          <CardHeader><CardTitle>Screening History</CardTitle></CardHeader>
          <CardContent>
            {screenings.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No screening history yet. Run a screening to see results here.</p>
            ) : (
              <div className="space-y-2">
                {screenings.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.id} • {new Date(s.timestamp).toLocaleString()} • {s.timeMs}ms</p>
                    </div>
                    <Badge variant={s.result === 'CLEAR' ? 'default' : s.result === 'POTENTIAL_MATCH' ? 'secondary' : 'destructive'}>
                      {s.result.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "lists" && (
        <Card>
          <CardHeader><CardTitle>Sanctions Lists</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sanctionsLists.map((list) => (
                <div key={list.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{list.name}</p>
                    <p className="text-xs text-muted-foreground">{list.source} • {list.region}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm">{list.entries.toLocaleString()} entries</p>
                    <p className="text-xs text-muted-foreground">Updated: {list.lastUpdated}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
