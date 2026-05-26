import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Search, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

const seedScreenings = [
  { id: "SCR-001", name: "Adebayo Johnson", bvn: "22345678901", result: "CLEAR", score: 0.0, lists: 7, timeMs: 12, timestamp: new Date(Date.now() - 600000).toISOString() },
  { id: "SCR-002", name: "Test Sanctioned Person One", bvn: "", result: "CONFIRMED_MATCH", score: 1.0, lists: 7, timeMs: 8, matchedList: "OFAC SDN", timestamp: new Date(Date.now() - 1800000).toISOString() },
  { id: "SCR-003", name: "Ngozi Okafor", bvn: "33456789012", result: "CLEAR", score: 0.0, lists: 7, timeMs: 15, timestamp: new Date(Date.now() - 3600000).toISOString() },
  { id: "SCR-004", name: "Ibrahim M.", bvn: "", result: "POTENTIAL_MATCH", score: 0.82, lists: 7, timeMs: 11, matchedList: "PEP Database", timestamp: new Date(Date.now() - 7200000).toISOString() },
  { id: "SCR-005", name: "Chinedu Eze", bvn: "44567890123", result: "CLEAR", score: 0.0, lists: 7, timeMs: 9, timestamp: new Date(Date.now() - 14400000).toISOString() },
  { id: "SCR-006", name: "Test Fraud Suspect Nigeria", bvn: "12345678901", result: "CONFIRMED_MATCH", score: 1.0, lists: 7, timeMs: 6, matchedList: "EFCC Watchlist", timestamp: new Date(Date.now() - 86400000).toISOString() },
];

const sanctionsLists = [
  { name: "OFAC SDN", entries: 12847, lastUpdated: "2025-04-30", source: "US Treasury" },
  { name: "UN Security Council", entries: 891, lastUpdated: "2025-04-28", source: "United Nations" },
  { name: "EU Sanctions", entries: 3247, lastUpdated: "2025-04-29", source: "European Union" },
  { name: "EFCC Watchlist", entries: 547, lastUpdated: "2025-05-01", source: "Nigeria EFCC" },
  { name: "PEP Database", entries: 28472, lastUpdated: "2025-04-15", source: "Dow Jones" },
  { name: "NFIU Watchlist", entries: 189, lastUpdated: "2025-04-25", source: "Nigeria NFIU" },
  { name: "INTERPOL Red Notice", entries: 7891, lastUpdated: "2025-04-20", source: "INTERPOL" },
];

export default function SanctionsScreening() {
  const [searchName, setSearchName] = useState("");
  const [searchBVN, setSearchBVN] = useState("");
  const [tab, setTab] = useState<"screen" | "history" | "lists">("screen");

  const handleScreen = () => {
    alert(`Screening: ${searchName || searchBVN}\nResult: CLEAR (0 hits across 7 lists)\nTime: 14ms`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="h-6 w-6" /> Sanctions Screening</h1>
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
              <Button onClick={handleScreen} className="w-full"><Search className="h-4 w-4 mr-2" /> Screen Against All Lists</Button>
              <p className="text-xs text-muted-foreground">Screens against: OFAC SDN, UN Security Council, EU Sanctions, EFCC Watchlist, PEP Database, NFIU Watchlist, INTERPOL</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-4">
            <Card><CardContent className="p-4 text-center"><CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" /><p className="text-2xl font-bold">{seedScreenings.filter((s) => s.result === "CLEAR").length}</p><p className="text-sm text-muted-foreground">Clear</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><AlertTriangle className="h-8 w-8 mx-auto text-yellow-500 mb-2" /><p className="text-2xl font-bold">{seedScreenings.filter((s) => s.result === "POTENTIAL_MATCH").length}</p><p className="text-sm text-muted-foreground">Potential Match</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><XCircle className="h-8 w-8 mx-auto text-red-500 mb-2" /><p className="text-2xl font-bold">{seedScreenings.filter((s) => s.result === "CONFIRMED_MATCH").length}</p><p className="text-sm text-muted-foreground">Confirmed Match</p></CardContent></Card>
          </div>
        </div>
      )}

      {tab === "history" && (
        <Card>
          <CardHeader><CardTitle>Screening History</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="text-left p-2">ID</th><th className="text-left p-2">Name</th><th className="text-left p-2">Result</th><th className="text-left p-2">Score</th><th className="text-left p-2">Matched List</th><th className="text-left p-2">Time</th><th className="text-left p-2">Date</th></tr></thead>
              <tbody>
                {seedScreenings.map((s) => (
                  <tr key={s.id} className="border-b">
                    <td className="p-2 font-mono text-xs">{s.id}</td>
                    <td className="p-2">{s.name}</td>
                    <td className="p-2"><Badge variant={s.result === "CLEAR" ? "default" : s.result === "CONFIRMED_MATCH" ? "destructive" : "secondary"}>{s.result}</Badge></td>
                    <td className="p-2">{s.score.toFixed(2)}</td>
                    <td className="p-2">{(s as any).matchedList || "-"}</td>
                    <td className="p-2">{s.timeMs}ms</td>
                    <td className="p-2 text-xs">{new Date(s.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {tab === "lists" && (
        <Card>
          <CardHeader><CardTitle>Sanctions Lists ({sanctionsLists.length})</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="text-left p-2">List</th><th className="text-left p-2">Entries</th><th className="text-left p-2">Source</th><th className="text-left p-2">Last Updated</th></tr></thead>
              <tbody>
                {sanctionsLists.map((l) => (
                  <tr key={l.name} className="border-b">
                    <td className="p-2 font-medium">{l.name}</td>
                    <td className="p-2">{l.entries.toLocaleString()}</td>
                    <td className="p-2">{l.source}</td>
                    <td className="p-2">{l.lastUpdated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
