/**
 * Financials Page — Revenue, royalties, TigerBeetle ledger entries, Mojaloop settlements
 */

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
// Static fallback chart data — used only when DB has no entries yet
const FALLBACK_CHART_DATA = [
  { month: "Oct 2024", revenue: 8200, opex: 2100, capex: 450 },
  { month: "Nov 2024", revenue: 8800, opex: 2300, capex: 380 },
  { month: "Dec 2024", revenue: 9100, opex: 2200, capex: 520 },
  { month: "Jan 2025", revenue: 8500, opex: 2400, capex: 410 },
  { month: "Feb 2025", revenue: 9400, opex: 2100, capex: 390 },
  { month: "Mar 2025", revenue: 9800, opex: 2300, capex: 460 },
];
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";

// ─── Mock ledger entries ──────────────────────────────────────────────────────

const LEDGER_ENTRIES = [
  { id: "TB-001", date: "2025-03-13", type: "REVENUE", description: "Oil Sales — Permian Basin #47", amount: 90_880, currency: "USD", debit_account: "1001-RECEIVABLES", credit_account: "4001-OIL-REVENUE", status: "SETTLED" },
  { id: "TB-002", date: "2025-03-13", type: "ROYALTY", description: "Royalty Payment — State of Texas", amount: -13_632, currency: "USD", debit_account: "5001-ROYALTIES", credit_account: "2001-ROYALTIES-PAYABLE", status: "PENDING" },
  { id: "TB-003", date: "2025-03-13", type: "REVENUE", description: "Gas Sales — DJ Basin #34", amount: 32_340, currency: "USD", debit_account: "1001-RECEIVABLES", credit_account: "4002-GAS-REVENUE", status: "SETTLED" },
  { id: "TB-004", date: "2025-03-12", type: "OPEX", description: "Chemical Treatment — Eagle Ford #12", amount: -8_400, currency: "USD", debit_account: "6001-OPEX", credit_account: "1002-CASH", status: "SETTLED" },
  { id: "TB-005", date: "2025-03-12", type: "REVENUE", description: "NGL Sales — Bakken #89", amount: 24_150, currency: "USD", debit_account: "1001-RECEIVABLES", credit_account: "4003-NGL-REVENUE", status: "SETTLED" },
  { id: "TB-006", date: "2025-03-12", type: "ROYALTY", description: "Federal Royalty — Marcellus #21", amount: -7_200, currency: "USD", debit_account: "5001-ROYALTIES", credit_account: "2002-FEDERAL-ROYALTIES", status: "PENDING" },
  { id: "TB-007", date: "2025-03-11", type: "CAPEX", description: "ESP Replacement — Anadarko #55", amount: -145_000, currency: "USD", debit_account: "7001-CAPEX", credit_account: "1002-CASH", status: "SETTLED" },
];

// Mojaloop settlements now loaded from DB via tRPC

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 shadow-xl">
      <div className="text-xs text-muted-foreground mb-1 font-mono">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground capitalize">{p.name}:</span>
          <span className="font-mono font-bold text-foreground">${(p.value / 1_000_000).toFixed(2)}M</span>
        </div>
      ))}
    </div>
  );
}

function CreateEntryDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ wellId: "", entryType: "REVENUE" as const, amountUsd: "", description: "", currency: "USD", counterparty: "" });
  const createMutation = trpc.financials.create.useMutation({
    onSuccess: () => { toast.success("Entry created"); onCreated(); onClose(); },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader><DialogTitle className="font-[Syne]">New Financial Entry</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Entry Type</Label>
              <Select value={form.entryType} onValueChange={v => setForm(p => ({ ...p, entryType: v as any }))}>
                <SelectTrigger className="mt-1 h-8 text-sm bg-background border-border/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["REVENUE","ROYALTY","OPEX","CAPEX","TAX","SETTLEMENT","ADJUSTMENT"].map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Amount (USD)</Label>
              <Input value={form.amountUsd} onChange={e => setForm(p => ({ ...p, amountUsd: e.target.value }))} type="number" placeholder="1000000" className="mt-1 bg-background border-border/50 h-8 text-sm" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Oil sales — Q1" className="mt-1 bg-background border-border/50 h-8 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Well ID (optional)</Label>
              <Input value={form.wellId} onChange={e => setForm(p => ({ ...p, wellId: e.target.value }))} placeholder="W-KW001A" className="mt-1 bg-background border-border/50 h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Counterparty</Label>
              <Input value={form.counterparty} onChange={e => setForm(p => ({ ...p, counterparty: e.target.value }))} placeholder="KOC" className="mt-1 bg-background border-border/50 h-8 text-sm" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="h-8 text-sm">Cancel</Button>
          <Button onClick={() => {
            if (!form.amountUsd || !form.description) { toast.error("Amount and description required"); return; }
            createMutation.mutate({ entryType: form.entryType, amountUsd: parseFloat(form.amountUsd), description: form.description, wellId: form.wellId || undefined, counterparty: form.counterparty || undefined });
          }} disabled={createMutation.isPending} className="h-8 text-sm bg-amber-600 hover:bg-amber-700 text-white">
            {createMutation.isPending ? "Creating..." : "Create Entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InitiateSettlementDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ counterparty: "", counterpartyIdValue: "", amountUsd: "", settlementType: "ROYALTY" as const, wellId: "", currency: "USD" });
  const initiateMutation = trpc.financials.initiateSettlement.useMutation({
    onSuccess: () => { toast.success("Settlement initiated — processing"); onCreated(); onClose(); },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader><DialogTitle className="font-[Syne]">Initiate Cross-Border Settlement</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs text-muted-foreground">Settlement Type</Label>
            <Select value={form.settlementType} onValueChange={v => setForm(p => ({ ...p, settlementType: v as any }))}>
              <SelectTrigger className="mt-1 h-8 text-sm bg-background border-border/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["ROYALTY","FEDERAL_ROYALTY","TRANSPORT","TAX","PARTNER"].map(t => (
                  <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Counterparty Name</Label>
            <Input className="mt-1 h-8 text-sm bg-background border-border/50" value={form.counterparty} onChange={e => setForm(p => ({ ...p, counterparty: e.target.value }))} placeholder="e.g. Texas General Land Office" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Counterparty Account ID</Label>
            <Input className="mt-1 h-8 text-sm bg-background border-border/50" value={form.counterpartyIdValue} onChange={e => setForm(p => ({ ...p, counterpartyIdValue: e.target.value }))} placeholder="e.g. TXGLO-001" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Amount (USD)</Label>
              <Input className="mt-1 h-8 text-sm bg-background border-border/50" type="number" value={form.amountUsd} onChange={e => setForm(p => ({ ...p, amountUsd: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Well ID (optional)</Label>
              <Input className="mt-1 h-8 text-sm bg-background border-border/50" value={form.wellId} onChange={e => setForm(p => ({ ...p, wellId: e.target.value }))} placeholder="W-001" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" disabled={initiateMutation.isPending || !form.counterparty || !form.amountUsd}
            onClick={() => initiateMutation.mutate({ counterparty: form.counterparty, counterpartyIdValue: form.counterpartyIdValue || form.counterparty, amountUsd: parseFloat(form.amountUsd), settlementType: form.settlementType, wellId: form.wellId || undefined, currency: "USD" })}>
            {initiateMutation.isPending ? "Initiating..." : "Initiate Settlement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function FinancialsPage() {
  const [period, setPeriod] = useState("Mar 2025");
  const [showCreate, setShowCreate] = useState(false);
  const [showSettle, setShowSettle] = useState(false);

  const utils = trpc.useUtils();
  const { data: financialSummary } = trpc.financials.summary.useQuery();
  const { data: financialEntries } = trpc.financials.list.useQuery({ limit: 50 });
  const { data: settlements, refetch: refetchSettlements } = trpc.financials.settlements.useQuery();
  const { data: settlementsStats } = trpc.financials.settlementsStats.useQuery();

  const hasLiveData = (financialEntries?.length ?? 0) > 0;

  // Live KPIs
  const liveRevenue = financialSummary?.revenue ?? 0;
  const liveOpex = financialSummary?.opex ?? 0;
  const liveRoyalty = financialSummary?.royalty ?? 0;
  const liveNet = financialSummary?.netIncome ?? 0;

  const { data: trendData } = trpc.financials.monthlyTrend.useQuery({ months: 12 });
  // Use live trend data from DB; fall back to static data only when DB is empty
  const chartData = (trendData && trendData.length > 0) ? trendData : FALLBACK_CHART_DATA;

  // KPI values: live if available, else demo
  const kpiRevenue = liveRevenue > 0 ? liveRevenue : 9_800_000;
  const kpiOpex = liveOpex > 0 ? liveOpex : 2_300_000;
  const kpiRoyalty = liveRoyalty > 0 ? liveRoyalty : 1_500_000;
  const kpiNet = liveNet !== 0 ? liveNet : 6_000_000;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold font-[Syne]">Financial Operations</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Double-entry ledger · Cross-border settlements · Real-time P&L</p>
      </div>

      {/* KPI Row */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground">{hasLiveData ? "Live database" : "Demo data"}</p>
        <Button size="sm" onClick={() => setShowCreate(true)} className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 h-8 text-xs">
          <Plus className="w-3.5 h-3.5" />
          New Entry
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Revenue", value: `$${(kpiRevenue / 1_000_000).toFixed(2)}M`, sub: "Oil & gas sales", color: "text-amber-400" },
          { label: "Net Income", value: `$${(kpiNet / 1_000_000).toFixed(2)}M`, sub: `${((kpiNet / kpiRevenue) * 100).toFixed(1)}% margin`, color: "text-emerald-400" },
          { label: "Royalties Paid", value: `$${(kpiRoyalty / 1_000_000).toFixed(2)}M`, sub: `${((kpiRoyalty / kpiRevenue) * 100).toFixed(1)}% of revenue`, color: "text-red-400" },
          { label: "OPEX", value: `$${(kpiOpex / 1_000_000).toFixed(2)}M`, sub: `$${(kpiOpex / 48320).toFixed(2)}/BOE`, color: "text-blue-400" },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="kpi-card">
            <div className="text-xs text-muted-foreground mb-1">{label}</div>
            <div className={cn("text-2xl font-mono font-bold", color)}>{value}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">{sub}</div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="bg-muted/30 border border-border/50">
          <TabsTrigger value="overview" className="text-xs">P&L Overview</TabsTrigger>
          <TabsTrigger value="ledger" className="text-xs">Financial Ledger</TabsTrigger>
          <TabsTrigger value="settlements" className="text-xs">Settlements</TabsTrigger>
        </TabsList>

        {/* P&L Overview */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-[Syne]">Revenue vs. Costs</CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" />
                    <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#6B7280", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#6B7280", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1e6).toFixed(1)}M`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="revenue" fill="#D97706" radius={[3, 3, 0, 0]} name="Revenue" />
                    <Bar dataKey="opex" fill="#3B82F6" radius={[3, 3, 0, 0]} name="OPEX" />
                    <Bar dataKey="royalties" fill="#EF4444" radius={[3, 3, 0, 0]} name="Royalties" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-[Syne]">Net Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" />
                    <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#6B7280", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#6B7280", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1e6).toFixed(1)}M`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="net" stroke="#10B981" strokeWidth={2.5} dot={{ fill: "#10B981", r: 4 }} name="Net Revenue" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Commodity prices */}
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-[Syne]">Commodity Prices</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { commodity: "WTI Crude", price: 78.45, unit: "$/bbl", change: "+1.2%", up: true },
                  { commodity: "Henry Hub Gas", price: 2.84, unit: "$/Mcf", change: "+3.8%", up: true },
                  { commodity: "NGL Basket", price: 24.80, unit: "$/bbl", change: "-0.4%", up: false },
                  { commodity: "Brent Crude", price: 81.65, unit: "$/bbl", change: "+0.9%", up: true },
                ].map(({ commodity, price, unit, change, up }) => (
                  <div key={commodity} className="p-3 rounded-md bg-muted/20 border border-border/30">
                    <div className="text-[10px] text-muted-foreground mb-1">{commodity}</div>
                    <div className="text-xl font-mono font-bold text-foreground">${price.toFixed(2)}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{unit}</div>
                    <div className={cn("text-xs font-mono mt-1", up ? "text-emerald-400" : "text-red-400")}>{change}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financial Ledger */}
        <TabsContent value="ledger" className="mt-4">
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-[Syne]">Financial Ledger Entries</CardTitle>
                <span className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-2 py-1 rounded">
                  Double-entry · Immutable · ACID
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/20">
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">ID</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Type</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Description</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Debit Account</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Credit Account</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Amount</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(hasLiveData ? (financialEntries ?? []).map((e: any) => ({
                      id: e.entryId, date: new Date(e.valueDate ?? e.createdAt).toISOString().slice(0,10),
                      type: e.entryType, description: e.description,
                      debit_account: "1001-RECEIVABLES", credit_account: "4001-REVENUE",
                      amount: e.entryType === "REVENUE" ? Number(e.amountUsd) : -Number(e.amountUsd),
                      status: e.status,
                    })) : LEDGER_ENTRIES).map((entry: any, i: number) => (
                      <tr key={entry.id} className={cn("border-b border-border/20 hover:bg-amber-950/5 transition-colors", i % 2 === 0 ? "" : "bg-muted/10")}>
                        <td className="px-4 py-2.5 font-mono text-muted-foreground">{entry.id}</td>
                        <td className="px-4 py-2.5 font-mono text-muted-foreground">{entry.date}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn("font-mono text-[10px] px-1.5 py-0.5 rounded",
                            entry.type === "REVENUE" ? "bg-emerald-950/40 text-emerald-400" :
                            entry.type === "ROYALTY" ? "bg-red-950/40 text-red-400" :
                            entry.type === "OPEX" ? "bg-blue-950/40 text-blue-400" :
                            "bg-amber-950/40 text-amber-400"
                          )}>
                            {entry.type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-foreground max-w-[200px] truncate">{entry.description}</td>
                        <td className="px-4 py-2.5 font-mono text-muted-foreground text-[10px]">{entry.debit_account}</td>
                        <td className="px-4 py-2.5 font-mono text-muted-foreground text-[10px]">{entry.credit_account}</td>
                        <td className={cn("px-4 py-2.5 text-right font-mono font-bold", entry.amount > 0 ? "text-emerald-400" : "text-red-400")}>
                          {entry.amount > 0 ? "+" : ""}${Math.abs(entry.amount).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={cn("text-[10px] font-mono",
                            entry.status === "SETTLED" ? "text-emerald-400" : "text-amber-400"
                          )}>
                            {entry.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cross-Border Settlements */}
        <TabsContent value="settlements" className="mt-4 space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Settlements", value: settlementsStats?.total ?? 0, color: "text-foreground" },
              { label: "Completed", value: settlementsStats?.completed ?? 0, color: "text-emerald-400" },
              { label: "Pending / Processing", value: settlementsStats?.pending ?? 0, color: "text-amber-400" },
              { label: "Total Settled (USD)", value: `$${((settlementsStats?.totalAmountUsd ?? 0) / 1_000_000).toFixed(2)}M`, color: "text-amber-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="kpi-card">
                <div className="text-xs text-muted-foreground mb-1">{label}</div>
                <div className={cn("text-2xl font-mono font-bold", color)}>{value}</div>
              </div>
            ))}
          </div>
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-[Syne]">Mojaloop Settlement Transactions</CardTitle>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">ISO 20022 · Real-time gross settlement · Live DB</p>
                </div>
                <Button size="sm" onClick={() => setShowSettle(true)} className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 h-8 text-xs">
                  <Plus className="w-3.5 h-3.5" />
                  Initiate Settlement
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {(settlements ?? []).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No settlements found. Initiate the first settlement above.</div>
              ) : (settlements ?? []).map((s: any) => (
                <div key={s.settlementId} className="p-4 rounded-lg border border-border/50 bg-muted/10">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-muted-foreground">{s.settlementId}</span>
                        <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded",
                          s.settlementType === "ROYALTY" ? "bg-red-950/40 text-red-400" :
                          s.settlementType === "FEDERAL_ROYALTY" ? "bg-orange-950/40 text-orange-400" :
                          s.settlementType === "TAX" ? "bg-purple-950/40 text-purple-400" :
                          s.settlementType === "PARTNER" ? "bg-cyan-950/40 text-cyan-400" :
                          "bg-blue-950/40 text-blue-400"
                        )}>
                          {s.settlementType.replace(/_/g, " ")}
                        </span>
                        {s.mojaloopTransferId && (
                          <span className="text-[10px] font-mono text-muted-foreground/60">{s.mojaloopTransferId.slice(0, 16)}...</span>
                        )}
                      </div>
                      <div className="text-sm font-medium text-foreground">{s.counterparty}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">
                        {new Date(s.createdAt).toLocaleDateString()}
                        {s.wellId && <span className="ml-2 text-amber-400/70">{s.wellId}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-mono font-bold text-amber-400">
                        ${parseFloat(s.amountUsd).toLocaleString()}
                      </div>
                      <div className={cn("text-xs font-mono mt-1",
                        s.status === "COMPLETED" ? "text-emerald-400" :
                        s.status === "PROCESSING" ? "text-blue-400" :
                        s.status === "FAILED" ? "text-red-400" :
                        "text-amber-400"
                      )}>
                        {s.status}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateEntryDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => utils.financials.list.invalidate()}
      />
      <InitiateSettlementDialog
        open={showSettle}
        onClose={() => setShowSettle(false)}
        onCreated={() => { refetchSettlements(); utils.financials.settlementsStats.invalidate(); }}
      />
    </div>
  );
}
