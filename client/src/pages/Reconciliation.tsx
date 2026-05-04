import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Scale, AlertTriangle, CheckCircle2, RefreshCcw } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Reconciliation() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const summaryQuery = trpc.reconciliation.summary.useQuery({ dateFrom, dateTo });
  const discrepanciesQuery = trpc.reconciliation.discrepancies.useQuery({ limit: 50 });
  const runMutation = trpc.reconciliation.runReconciliation.useMutation();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reconciliation</h1>
          <p className="text-muted-foreground">Transaction reconciliation and discrepancy management</p>
        </div>
        <Button
          onClick={() => {
            if (dateFrom && dateTo) {
              runMutation.mutate({ dateRange: { from: dateFrom, to: dateTo } });
            }
          }}
          disabled={runMutation.isPending}
        >
          <RefreshCcw className="h-4 w-4 mr-2" />
          {runMutation.isPending ? 'Running...' : 'Run Reconciliation'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Scale className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{(summaryQuery.data as any)?.totalMatched || 0}</p>
              <p className="text-sm text-muted-foreground">Matched Transactions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{(summaryQuery.data as any)?.totalDiscrepancies || 0}</p>
              <p className="text-sm text-muted-foreground">Discrepancies</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{(summaryQuery.data as any)?.matchRate || '0'}%</p>
              <p className="text-sm text-muted-foreground">Match Rate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Discrepancies</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.isArray(discrepanciesQuery.data) && discrepanciesQuery.data.map((d: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{d.transactionId || d.id}</p>
                  <p className="text-sm text-muted-foreground">{d.description || d.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={d.status === 'resolved' ? 'default' : 'destructive'}>
                    {d.status}
                  </Badge>
                  <p className="font-medium">NGN {d.amount?.toLocaleString()}</p>
                </div>
              </div>
            ))}
            {(!discrepanciesQuery.data || !Array.isArray(discrepanciesQuery.data) || discrepanciesQuery.data.length === 0) && (
              <p className="text-center text-muted-foreground py-4">No discrepancies found</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
