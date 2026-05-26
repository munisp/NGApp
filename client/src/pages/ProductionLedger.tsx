/**
 * ProductionLedger.tsx — TigerBeetle Double-Entry Production Ledger
 *
 * Financial-grade production volume accounting using TigerBeetle:
 *   - Portfolio summary: all well balances (oil bbl, gas mscf, water bbl)
 *   - Per-well balance drill-down
 *   - Transfer history per well
 *   - Record daily production (create ledger transfer)
 *   - Net balance waterfall chart
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  BookOpen, TrendingUp, TrendingDown, Droplets, Flame,
  RefreshCw, Plus, DollarSign, BarChart3, Activity,
  ArrowUpRight, ArrowDownRight, Scale,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface WellBalance {
  wellName?: string;
  credits: number;
  debits: number;
  netBalance: number;
}

interface Transfer {
  id: string;
  amount: number;
  code: number;
  timestamp: string;
  debitAccountId: string;
  creditAccountId: string;
}

// ─── Record Production Dialog ──────────────────────────────────────────────────
function RecordProductionDialog({ open, onClose, onRecorded }: { open: boolean; onClose: () => void; onRecorded: () => void }) {
  const [wellId, setWellId] = useState("");
  const [fieldId, setFieldId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [oil, setOil] = useState("");
  const [gas, setGas] = useState("");
  const [water, setWater] = useState("");

  const recordMut = trpc.ledger.recordTransfer.useMutation({
    onSuccess: (data) => {
      toast.success(`Production recorded — ${data.transfers} ledger transfer(s) created`);
      onRecorded();
      onClose();
      setWellId(""); setFieldId(""); setOil(""); setGas(""); setWater("");
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit() {
    if (!wellId || !fieldId || !date) {
      toast.error("Well ID, Field ID, and date are required");
      return;
    }
    recordMut.mutate({
      wellId,
      fieldId,
      date,
      oilVolumeMillibbl: oil ? Math.round(Number(oil) * 1000) : undefined,
      gasVolumeMscf: gas ? Math.round(Number(gas) * 1000) : undefined,
      waterVolumeMillibbl: water ? Math.round(Number(water) * 1000) : undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            Record Daily Production
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Well ID <span className="text-red-400">*</span></Label>
              <Input placeholder="e.g. WELL-001" value={wellId} onChange={e => setWellId(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Field ID <span className="text-red-400">*</span></Label>
              <Input placeholder="e.g. FIELD-A" value={fieldId} onChange={e => setFieldId(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Production Date <span className="text-red-400">*</span></Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><Droplets className="w-3 h-3 text-emerald-400" />Oil (bbl)</Label>
              <Input type="number" placeholder="0" value={oil} onChange={e => setOil(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><Flame className="w-3 h-3 text-orange-400" />Gas (mscf)</Label>
              <Input type="number" placeholder="0" value={gas} onChange={e => setGas(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><Droplets className="w-3 h-3 text-blue-400" />Water (bbl)</Label>
              <Input type="number" placeholder="0" value={water} onChange={e => setWater(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Volumes are stored as millibbl/mscf integers (×1000) in TigerBeetle for financial-grade precision.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={recordMut.isPending}>
            {recordMut.isPending ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
            Record Production
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Well Balance Row ──────────────────────────────────────────────────────────
function WellBalanceRow({ well, onClick }: { well: WellBalance & { wellId?: string }; onClick: () => void }) {
  const isPositive = well.netBalance >= 0;
  return (
    <TableRow className="cursor-pointer hover:bg-muted/10" onClick={onClick}>
      <TableCell className="font-medium">{well.wellName ?? well.wellId ?? "Unknown"}</TableCell>
      <TableCell className="font-mono text-sm text-emerald-400">{(well.credits / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} bbl</TableCell>
      <TableCell className="font-mono text-sm text-red-400">{(well.debits / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} bbl</TableCell>
      <TableCell>
                  <div className={cn("flex items-center gap-1 font-mono text-sm font-bold", isPositive ? "text-emerald-400" : "text-red-400")}>
                          {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                          {(Math.abs(well.netBalance ?? 0) / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} bbl
                        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ProductionLedger() {
  const [recordOpen, setRecordOpen] = useState(false);
  const [selectedWellId, setSelectedWellId] = useState<string | null>(null);

  const { data: portfolio, isLoading, refetch, isFetching } = trpc.ledger.getPortfolioSummary.useQuery(undefined, {
    refetchInterval: 60000,
  });

  const { data: wellBalance } = trpc.ledger.getWellBalance.useQuery(
    { wellId: selectedWellId! },
    { enabled: !!selectedWellId }
  );

  const { data: transfers } = trpc.ledger.getHistory.useQuery(
    { accountId: selectedWellId!, limit: 50 },
    { enabled: !!selectedWellId }
  );

  const wells = (portfolio?.wells as unknown as (WellBalance & { wellId?: string; wellName?: string })[]) ?? [];
  const totalCredits = portfolio?.totalCredits ?? 0;
  const totalDebits = portfolio?.totalDebits ?? 0;
  const netBalance = portfolio?.netBalance ?? 0;

  // Chart data — top 10 wells by credits
  const chartData = useMemo(() => {
    return wells
      .sort((a, b) => b.credits - a.credits)
      .slice(0, 10)
      .map(w => ({
        name: (w.wellName ?? w.wellId ?? "Unknown").replace(/^WELL-/, "W-"),
        credits: Math.round(w.credits / 1000),
        debits: Math.round(w.debits / 1000),
        net: Math.round(w.netBalance / 1000),
      }));
  }, [wells]);

  const transferList = (transfers as Transfer[] | undefined) ?? [];

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            Production Ledger
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            TigerBeetle double-entry accounting — financial-grade production volume allocation
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("w-4 h-4 mr-1", isFetching && "animate-spin")} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setRecordOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Record Production
          </Button>
        </div>
      </div>

      {/* Portfolio KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Credits", value: `${(totalCredits / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} bbl`, icon: ArrowUpRight, color: "text-emerald-400" },
          { label: "Total Debits", value: `${(totalDebits / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} bbl`, icon: ArrowDownRight, color: "text-red-400" },
          { label: "Net Balance", value: `${(Math.abs(netBalance) / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} bbl`, icon: Scale, color: netBalance >= 0 ? "text-emerald-400" : "text-red-400" },
          { label: "Active Wells", value: wells.length.toString(), icon: Activity, color: "text-blue-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-card border-border/50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <Icon className={cn("w-5 h-5", color)} />
                <div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="text-lg font-bold">{value}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="portfolio">
        <TabsList>
          <TabsTrigger value="portfolio">Portfolio Summary</TabsTrigger>
          <TabsTrigger value="chart">Balance Chart</TabsTrigger>
          {selectedWellId && <TabsTrigger value="well">Well Detail</TabsTrigger>}
        </TabsList>

        {/* Portfolio Tab */}
        <TabsContent value="portfolio" className="mt-4">
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm">Well Production Balances</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-12 text-center text-muted-foreground">
                  <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-40" />
                  Loading ledger data...
                </div>
              ) : wells.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">No ledger entries yet</p>
                  <p className="text-xs mt-1">Record daily production to populate the ledger</p>
                  <Button className="mt-4" size="sm" onClick={() => setRecordOpen(true)}>
                    <Plus className="w-4 h-4 mr-1" /> Record First Entry
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Well</TableHead>
                      <TableHead>Total Credits</TableHead>
                      <TableHead>Total Debits</TableHead>
                      <TableHead>Net Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wells.map((well, i) => (
                      <WellBalanceRow key={i} well={well} onClick={() => setSelectedWellId(well.wellId ?? null)} />
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chart Tab */}
        <TabsContent value="chart" className="mt-4">
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm">Top 10 Wells — Production Volume (bbl)</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {chartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  <BarChart3 className="w-8 h-8 opacity-20 mr-2" />
                  No data available
                </div>
              ) : (
                <div style={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                        labelStyle={{ color: "#f1f5f9" }}
                        itemStyle={{ color: "#94a3b8" }}
                        formatter={(v: number) => [`${v.toLocaleString()} bbl`]}
                      />
                      <Bar dataKey="credits" name="Credits" fill="#10b981" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="debits" name="Debits" fill="#ef4444" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Well Detail Tab */}
        {selectedWellId && (
          <TabsContent value="well" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Well: {selectedWellId}</h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedWellId(null)}>
                ← Back to Portfolio
              </Button>
            </div>

            {/* Balance Card */}
            {wellBalance && (
              <div className="grid grid-cols-3 gap-4">
                {(() => {
                  const wb = wellBalance as unknown as WellBalance;
                  return [
                    { label: "Credits", value: `${(wb.credits / 1000).toLocaleString()} bbl`, color: "text-emerald-400" },
                    { label: "Debits", value: `${(wb.debits / 1000).toLocaleString()} bbl`, color: "text-red-400" },
                    { label: "Net Balance", value: `${(Math.abs(wb.netBalance) / 1000).toLocaleString()} bbl`, color: wb.netBalance >= 0 ? "text-emerald-400" : "text-red-400" },
                  ];
                })().map(({ label, value, color }) => (
                  <Card key={label} className="bg-card border-border/50">
                    <CardContent className="pt-4 pb-3">
                      <div className="text-xs text-muted-foreground">{label}</div>
                      <div className={cn("text-lg font-bold", color)}>{value}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Transfer History */}
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm">Transfer History (last 50)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {transferList.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">No transfers found for this well</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Transfer ID</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Debit Account</TableHead>
                        <TableHead>Credit Account</TableHead>
                        <TableHead>Timestamp</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transferList.map(t => (
                        <TableRow key={t.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground">{t.id.slice(0, 16)}...</TableCell>
                          <TableCell className="font-mono text-sm">{(t.amount / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {t.code === 1 ? "OIL" : t.code === 2 ? "GAS" : t.code === 3 ? "WATER" : t.code}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{t.debitAccountId}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{t.creditAccountId}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {t.timestamp ? new Date(t.timestamp).toLocaleString() : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Record dialog */}
      <RecordProductionDialog open={recordOpen} onClose={() => setRecordOpen(false)} onRecorded={() => refetch()} />
    </div>
  );
}
