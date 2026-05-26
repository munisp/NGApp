import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUpDown, Download, Search, Filter, RefreshCcw } from "lucide-react";

const seedSettlements = Array.from({ length: 20 }, (_, i) => ({
  id: `STL-${String(i + 1).padStart(4, "0")}`,
  date: new Date(Date.now() - i * 86400000).toISOString().split("T")[0],
  bankCode: ["058", "044", "057", "011", "033"][i % 5],
  bankName: ["GTBank", "Access Bank", "Zenith Bank", "First Bank", "UBA"][i % 5],
  totalTransactions: Math.floor(Math.random() * 50000) + 1000,
  totalAmount: Math.round(Math.random() * 10000000000),
  netAmount: Math.round(Math.random() * 9000000000),
  fees: Math.round(Math.random() * 100000000),
  status: ["settled", "settled", "pending", "settled"][i % 4] as string,
}));

export default function Settlements() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<string>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = seedSettlements
    .filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (search && !s.bankName.toLowerCase().includes(search.toLowerCase()) && !s.id.includes(search)) return false;
      return true;
    })
    .sort((a, b) => {
      const aVal = (a as any)[sortField];
      const bVal = (b as any)[sortField];
      if (typeof aVal === "number") return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      return sortDir === "asc" ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
    });

  const totalSettled = seedSettlements.filter((s) => s.status === "settled").reduce((sum, s) => sum + s.netAmount, 0);
  const totalPending = seedSettlements.filter((s) => s.status === "pending").reduce((sum, s) => sum + s.netAmount, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Settlement Management</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><RefreshCcw className="h-4 w-4 mr-1" /> Refresh</Button>
          <Button size="sm"><Download className="h-4 w-4 mr-1" /> Export</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Settled</p><p className="text-xl font-bold">₦{(totalSettled / 1e9).toFixed(2)}B</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Pending</p><p className="text-xl font-bold">₦{(totalPending / 1e9).toFixed(2)}B</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Batches</p><p className="text-xl font-bold">{seedSettlements.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Success Rate</p><p className="text-xl font-bold">99.7%</p></CardContent></Card>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by bank or ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" /></div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded px-3 py-2 text-sm">
          <option value="all">All Status</option>
          <option value="settled">Settled</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {[{ key: "id", label: "ID" }, { key: "date", label: "Date" }, { key: "bankName", label: "Bank" }, { key: "totalTransactions", label: "Transactions" }, { key: "totalAmount", label: "Total" }, { key: "netAmount", label: "Net" }, { key: "fees", label: "Fees" }, { key: "status", label: "Status" }].map(({ key, label }) => (
                  <th key={key} className="text-left p-3 cursor-pointer hover:bg-muted" onClick={() => { if (sortField === key) setSortDir(sortDir === "asc" ? "desc" : "asc"); else { setSortField(key); setSortDir("desc"); } }}>
                    <div className="flex items-center gap-1">{label}<ArrowUpDown className="h-3 w-3" /></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{s.id}</td>
                  <td className="p-3">{s.date}</td>
                  <td className="p-3">{s.bankName}</td>
                  <td className="p-3">{s.totalTransactions.toLocaleString()}</td>
                  <td className="p-3">₦{(s.totalAmount / 1e6).toFixed(1)}M</td>
                  <td className="p-3">₦{(s.netAmount / 1e6).toFixed(1)}M</td>
                  <td className="p-3">₦{(s.fees / 1e6).toFixed(1)}M</td>
                  <td className="p-3"><Badge variant={s.status === "settled" ? "default" : "secondary"}>{s.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
