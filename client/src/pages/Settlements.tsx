import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUpDown, Download, Search, Filter, RefreshCcw, CheckCircle, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Settlements() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = trpc.settlements.list.useQuery({
    status: statusFilter as 'all' | 'pending' | 'processing' | 'settled' | 'failed' | 'disputed',
    page,
    limit: 20,
  });

  const { data: summary } = trpc.settlements.getSummary.useQuery();
  const reconcileMutation = trpc.settlements.reconcile.useMutation({
    onSuccess: () => { toast.success("Settlement reconciled"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const settlements = data?.settlements || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const filtered = search
    ? settlements.filter((s: Record<string, any>) => s.id.toLowerCase().includes(search.toLowerCase()) ||
        s.bankName.toLowerCase().includes(search.toLowerCase()))
    : settlements;

  const formatAmount = (amount: number) => `₦${(amount / 100).toLocaleString()}`;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2"><ArrowUpDown className="h-6 w-6" /> Settlement Management</h1>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4 text-center">
            <CheckCircle className="h-6 w-6 mx-auto text-green-500 mb-1" />
            <p className="text-2xl font-bold">{summary.totalSettled}</p>
            <p className="text-xs text-muted-foreground">Settled</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <Clock className="h-6 w-6 mx-auto text-yellow-500 mb-1" />
            <p className="text-2xl font-bold">{summary.totalPending}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <AlertTriangle className="h-6 w-6 mx-auto text-orange-500 mb-1" />
            <p className="text-2xl font-bold">{summary.totalProcessing}</p>
            <p className="text-xs text-muted-foreground">Processing</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-lg font-bold">{formatAmount(summary.todayVolume)}</p>
            <p className="text-xs text-muted-foreground">Today's Volume</p>
            <p className="text-xs text-muted-foreground">{summary.todayTransactions.toLocaleString()} transactions</p>
          </CardContent></Card>
        </div>
      )}

      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by ID or bank..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-1">
          {["all", "pending", "processing", "settled", "failed"].map((s) => (
            <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => { setStatusFilter(s); setPage(1); }}>
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left p-3">ID</th>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Bank</th>
                  <th className="text-left p-3">Channel</th>
                  <th className="text-right p-3">Transactions</th>
                  <th className="text-right p-3">Gross</th>
                  <th className="text-right p-3">Fees</th>
                  <th className="text-right p-3">Net</th>
                  <th className="text-left p-3">Window</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s: Record<string, any>) => (
                  <tr key={s.id} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs">{s.id}</td>
                    <td className="p-3">{s.date}</td>
                    <td className="p-3">{s.bankName}</td>
                    <td className="p-3"><Badge variant="outline">{s.channel}</Badge></td>
                    <td className="p-3 text-right">{s.totalTransactions.toLocaleString()}</td>
                    <td className="p-3 text-right font-mono">{formatAmount(s.grossAmount)}</td>
                    <td className="p-3 text-right font-mono text-muted-foreground">{formatAmount(s.fees)}</td>
                    <td className="p-3 text-right font-mono font-semibold">{formatAmount(s.netAmount)}</td>
                    <td className="p-3"><Badge variant="secondary">{s.window}</Badge></td>
                    <td className="p-3">
                      <Badge variant={s.status === 'settled' ? 'default' : s.status === 'pending' ? 'secondary' : s.status === 'failed' ? 'destructive' : 'outline'}>
                        {s.status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {s.status === 'pending' && (
                        <Button size="sm" variant="outline" onClick={() => reconcileMutation.mutate({ id: s.id })}
                          disabled={reconcileMutation.isPending}>
                          Reconcile
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{total} total settlements</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-sm py-1">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}
