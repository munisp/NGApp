/**
 * MudManagement.tsx
 * Oil-Based Mud (OBM) inventory management, cost tracking, and transaction history.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { toast } from "sonner";
import { Beaker, AlertTriangle, Plus, RefreshCw, DollarSign, Package } from "lucide-react";

const MUD_TYPE_COLORS: Record<string, string> = {
  OBM: "#f59e0b",
  SBM: "#06b6d4",
  WBM: "#10b981",
  BRINE: "#8b5cf6",
};

const TXN_TYPE_LABELS: Record<string, string> = {
  RECEIVED: "Received",
  CONSUMED: "Consumed",
  TRANSFERRED: "Transferred",
  DISPOSED: "Disposed",
  RETURNED: "Returned",
};

function SummaryCards() {
  const { data } = trpc.mudManagement.summary.useQuery();
  if (!data) return null;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-slate-800/60 border-slate-700">
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-white">{data.totalItems}</div>
          <div className="text-xs text-slate-400 mt-1">Inventory Locations</div>
        </CardContent>
      </Card>
      <Card className="bg-amber-900/20 border-amber-700/40">
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-amber-400">{(data.obmVolumeBbl ?? 0).toLocaleString()}</div>
          <div className="text-xs text-slate-400 mt-1">OBM Volume (bbl)</div>
        </CardContent>
      </Card>
      <Card className="bg-slate-800/60 border-slate-700">
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-green-400">${(data.totalCostUsd ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <div className="text-xs text-slate-400 mt-1">Total Inventory Value</div>
        </CardContent>
      </Card>
      <Card className={data.lowStockAlerts > 0 ? "bg-red-900/20 border-red-700/40" : "bg-slate-800/60 border-slate-700"}>
        <CardContent className="pt-4">
          <div className={`text-2xl font-bold ${data.lowStockAlerts > 0 ? "text-red-400" : "text-white"}`}>{data.lowStockAlerts}</div>
          <div className="text-xs text-slate-400 mt-1">Low Stock Alerts</div>
        </CardContent>
      </Card>
    </div>
  );
}

function AddInventoryDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    locationId: "",
    locationName: "",
    mudType: "OBM" as "OBM" | "SBM" | "WBM" | "BRINE",
    mudGrade: "",
    currentVolumeBbl: 0,
    maxCapacityBbl: 500,
    reorderPointBbl: 100,
    costPerBblUsd: 120,
    supplierName: "",
  });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const mutation = trpc.mudManagement.upsertInventory.useMutation({
    onSuccess: () => { toast.success("Inventory location added"); setOpen(false); onSuccess(); },
    onError: (e) => toast.error("Failed", { description: e.message }),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-amber-600 hover:bg-amber-700 text-white"><Plus className="w-4 h-4 mr-2" />Add Location</Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
        <DialogHeader><DialogTitle>Add Mud Inventory Location</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-300">Location ID</Label>
              <Input className="bg-slate-700 border-slate-600 text-white mt-1" value={form.locationId} onChange={(e) => set("locationId", e.target.value)} placeholder="e.g. YARD-A1" />
            </div>
            <div>
              <Label className="text-slate-300">Location Name</Label>
              <Input className="bg-slate-700 border-slate-600 text-white mt-1" value={form.locationName} onChange={(e) => set("locationName", e.target.value)} placeholder="e.g. Onshore Yard A" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-300">Mud Type</Label>
              <select className="w-full mt-1 bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                value={form.mudType} onChange={(e) => set("mudType", e.target.value)}>
                <option value="OBM">OBM</option>
                <option value="SBM">SBM</option>
                <option value="WBM">WBM</option>
                <option value="BRINE">Brine</option>
              </select>
            </div>
            <div>
              <Label className="text-slate-300">Grade</Label>
              <Input className="bg-slate-700 border-slate-600 text-white mt-1" value={form.mudGrade} onChange={(e) => set("mudGrade", e.target.value)} placeholder="e.g. 16ppg" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-300">Current Volume (bbl)</Label>
              <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" value={form.currentVolumeBbl} onChange={(e) => set("currentVolumeBbl", +e.target.value)} />
            </div>
            <div>
              <Label className="text-slate-300">Max Capacity (bbl)</Label>
              <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" value={form.maxCapacityBbl} onChange={(e) => set("maxCapacityBbl", +e.target.value)} />
            </div>
            <div>
              <Label className="text-slate-300">Reorder Point (bbl)</Label>
              <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" value={form.reorderPointBbl} onChange={(e) => set("reorderPointBbl", +e.target.value)} />
            </div>
            <div>
              <Label className="text-slate-300">Cost/bbl (USD)</Label>
              <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" value={form.costPerBblUsd} onChange={(e) => set("costPerBblUsd", +e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-slate-300">Supplier</Label>
            <Input className="bg-slate-700 border-slate-600 text-white mt-1" value={form.supplierName} onChange={(e) => set("supplierName", e.target.value)} />
          </div>
          <Button className="w-full bg-amber-600 hover:bg-amber-700" disabled={mutation.isPending}
            onClick={() => mutation.mutate(form)}>
            {mutation.isPending ? "Saving..." : "Add Location"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RecordTransactionDialog({ inventoryId, onSuccess }: { inventoryId: number; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ transactionType: "RECEIVED" as any, volumeBbl: 0, costUsd: 0, referenceNumber: "", performedBy: "", notes: "" });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const mutation = trpc.mudManagement.recordTransaction.useMutation({
    onSuccess: () => { toast.success("Transaction recorded"); setOpen(false); onSuccess(); },
    onError: (e) => toast.error("Failed", { description: e.message }),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 text-xs">Record Txn</Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-sm">
        <DialogHeader><DialogTitle>Record Transaction</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-slate-300">Type</Label>
            <select className="w-full mt-1 bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
              value={form.transactionType} onChange={(e) => set("transactionType", e.target.value)}>
              {Object.entries(TXN_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-300">Volume (bbl)</Label>
              <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" value={form.volumeBbl} onChange={(e) => set("volumeBbl", +e.target.value)} />
            </div>
            <div>
              <Label className="text-slate-300">Cost (USD)</Label>
              <Input className="bg-slate-700 border-slate-600 text-white mt-1" type="number" value={form.costUsd} onChange={(e) => set("costUsd", +e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-slate-300">Reference #</Label>
            <Input className="bg-slate-700 border-slate-600 text-white mt-1" value={form.referenceNumber} onChange={(e) => set("referenceNumber", e.target.value)} />
          </div>
          <Button className="w-full bg-amber-600 hover:bg-amber-700" disabled={mutation.isPending}
            onClick={() => mutation.mutate({ inventoryId, ...form })}>
            {mutation.isPending ? "Saving..." : "Record"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InventoryTab() {
  const { data: inventory, refetch } = trpc.mudManagement.listInventory.useQuery();
  const inventoryArr = inventory ?? [];

  const pieData = Object.entries(
    inventoryArr.reduce((acc: Record<string, number>, i: any) => {
      acc[i.mudType] = (acc[i.mudType] ?? 0) + (i.currentVolumeBbl ?? 0);
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-white font-medium">Inventory Locations ({inventoryArr.length})</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="border-slate-600 text-slate-300" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />Refresh
          </Button>
          <AddInventoryDialog onSuccess={() => refetch()} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader><CardTitle className="text-white text-sm">Volume by Mud Type</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((entry, i) => <Cell key={i} fill={MUD_TYPE_COLORS[entry.name] ?? "#64748b"} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                  formatter={(v: any) => [`${v.toLocaleString()} bbl`]} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <div className="space-y-3">
            {inventoryArr.map((item: any) => {
              const fillPct = item.maxCapacityBbl > 0 ? (item.currentVolumeBbl / item.maxCapacityBbl) * 100 : 0;
              const isLow = item.reorderPointBbl && item.currentVolumeBbl <= item.reorderPointBbl;
              return (
                <Card key={item.id} className={`border ${isLow ? "bg-red-900/10 border-red-700/40" : "bg-slate-800/60 border-slate-700"}`}>
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge style={{ background: MUD_TYPE_COLORS[item.mudType] + "20", color: MUD_TYPE_COLORS[item.mudType], borderColor: MUD_TYPE_COLORS[item.mudType] + "40" }}
                          variant="outline" className="text-xs">{item.mudType}</Badge>
                        <span className="text-white font-medium text-sm">{item.locationName}</span>
                        {isLow && <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 text-xs">Low Stock</Badge>}
                      </div>
                      <RecordTransactionDialog inventoryId={item.id} onSuccess={() => {}} />
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-slate-700 rounded-full h-2">
                        <div className="h-2 rounded-full transition-all" style={{ width: `${fillPct}%`, background: isLow ? "#ef4444" : MUD_TYPE_COLORS[item.mudType] ?? "#06b6d4" }} />
                      </div>
                      <span className="text-slate-300 text-xs whitespace-nowrap">{(item.currentVolumeBbl ?? 0).toLocaleString()} / {(item.maxCapacityBbl ?? 0).toLocaleString()} bbl</span>
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-slate-400">
                      <span>Grade: {item.mudGrade ?? "—"}</span>
                      <span>Cost: ${(item.costPerBblUsd ?? 0).toFixed(0)}/bbl</span>
                      <span>Supplier: {item.supplierName ?? "—"}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {inventoryArr.length === 0 && (
              <div className="text-center py-12 text-slate-500">No inventory locations yet. Add one above.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MudManagementPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Beaker className="w-7 h-7 text-amber-400" />
            Mud Management
          </h1>
          <p className="text-slate-400 mt-1">OBM / SBM / WBM inventory · Cost tracking · Transaction history · Low-stock alerts</p>
        </div>
        <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10">
          OBM Cost Control
        </Badge>
      </div>

      <SummaryCards />
      <InventoryTab />
    </div>
  );
}
