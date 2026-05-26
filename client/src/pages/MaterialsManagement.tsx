/**
 * MaterialsManagement.tsx — ERPNext-inspired Materials Management Page (v38.0)
 * Covers: Material Master, Supplier Catalog, Inventory Locations,
 * Procurement Workflow (MR → PO → GRN), Field Issue Tickets, Mud Tank Snapshots
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Package, ShoppingCart, Truck, AlertTriangle, CheckCircle, Clock, Plus, BarChart3, Factory, Wrench } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-500", SUBMITTED: "bg-blue-500", APPROVED: "bg-green-500",
  REJECTED: "bg-red-500", ORDERED: "bg-purple-500", RECEIVED: "bg-emerald-500",
  PENDING: "bg-yellow-500", IN_TRANSIT: "bg-orange-500", COMPLETED: "bg-green-600",
  OK: "bg-green-500", LOW: "bg-yellow-500", CRITICAL: "bg-red-500",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={`${STATUS_COLORS[status] ?? "bg-gray-500"} text-white text-xs`}>
      {status}
    </Badge>
  );
}

// ─── Dashboard Overview ───────────────────────────────────────────────────────
function DashboardTab() {
  const { data: stats } = trpc.materials.fieldOps.getDashboardStats.useQuery();
  const { data: stockLevels } = trpc.materials.materials.getStockLevels.useQuery({});
  const { data: supplierPerf } = trpc.materials.suppliers.getPerformance.useQuery();

  const lowStockItems = (stockLevels ?? []).filter((s: { stock_status: string }) => s.stock_status !== "OK");
  const stockByGroup = Object.entries(
    ((stockLevels ?? []) as Array<{ item_group: string; total_stock: number }>).reduce((acc: Record<string, number>, item) => {
      acc[item.item_group] = (acc[item.item_group] ?? 0) + Number(item.total_stock);
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const COLORS = ["#0ea5e9", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4"];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs">Pending MRs</p>
                <p className="text-2xl font-bold text-white">{stats?.pendingMaterialRequests ?? 0}</p>
              </div>
              <Package className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs">Open POs</p>
                <p className="text-2xl font-bold text-white">{stats?.pendingPurchaseOrders ?? 0}</p>
              </div>
              <ShoppingCart className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs">Open Transfers</p>
                <p className="text-2xl font-bold text-white">{stats?.openTransferOrders ?? 0}</p>
              </div>
              <Truck className="w-8 h-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs">Low Stock Items</p>
                <p className="text-2xl font-bold text-red-400">{stats?.lowStockItems ?? 0}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stock by Group */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader><CardTitle className="text-white text-sm">Inventory by Item Group</CardTitle></CardHeader>
          <CardContent>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stockByGroup} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name }) => name}>
                    {stockByGroup.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader><CardTitle className="text-white text-sm">Stock Alerts</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {lowStockItems.length === 0 ? (
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <CheckCircle className="w-4 h-4" /> All items above reorder point
                </div>
              ) : (
                lowStockItems.map((item: { id: string; item_code: string; item_name: string; total_stock: number; uom: string; reorder_point: number; stock_status: string }) => (
                  <div key={item.id} className="flex items-center justify-between p-2 bg-slate-700 rounded">
                    <div>
                      <p className="text-white text-xs font-medium">{item.item_name}</p>
                      <p className="text-slate-400 text-xs">{item.item_code} · {Number(item.total_stock).toFixed(1)} {item.uom} / {item.reorder_point} ROP</p>
                    </div>
                    <StatusBadge status={item.stock_status} />
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Supplier Performance */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader><CardTitle className="text-white text-sm">Supplier Performance</CardTitle></CardHeader>
        <CardContent>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(supplierPerf ?? []).slice(0, 8) as Array<{ supplier_name: string; total_spend: number; performance_score: number }>}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="supplier_name" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "none", color: "#fff" }} />
                <Bar dataKey="total_spend" fill="#0ea5e9" name="Total Spend (USD)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Material Master Tab ──────────────────────────────────────────────────────
function MaterialMasterTab() {
  const [search, setSearch] = useState("");
  const [itemGroup, setItemGroup] = useState<string | undefined>();
  const [showCreate, setShowCreate] = useState(false);
  const utils = trpc.useUtils();

  const { data: materials, isLoading } = trpc.materials.materials.list.useQuery({ search: search || undefined, itemGroup, limit: 100 });
  const { data: stockLevels } = trpc.materials.materials.getStockLevels.useQuery({});
  const stockMap = new Map((stockLevels ?? []).map((s: { id: string; total_stock: number; stock_status: string }) => [s.id, s]));

  const createMutation = trpc.materials.materials.create.useMutation({
    onSuccess: () => { utils.materials.materials.list.invalidate(); setShowCreate(false); toast.success("Material created"); },
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState({ itemCode: "", itemName: "", itemGroup: "MUD_CHEMICAL" as const, uom: "BBL", unitCost: "", minStockLevel: "0", reorderPoint: "0" });

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <Input placeholder="Search materials..." value={search} onChange={e => setSearch(e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
        </div>
        <Select value={itemGroup ?? "all"} onValueChange={v => setItemGroup(v === "all" ? undefined : v)}>
          <SelectTrigger className="w-44 bg-slate-700 border-slate-600 text-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Groups</SelectItem>
            {["MUD_CHEMICAL", "PIPE", "EQUIPMENT", "CONSUMABLE", "RENTAL", "SERVICE"].map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild><Button className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-1" />New Material</Button></DialogTrigger>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
            <DialogHeader><DialogTitle>Create Material</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 pt-2">
              {[["Item Code", "itemCode"], ["Item Name", "itemName"], ["UOM", "uom"], ["Unit Cost (USD)", "unitCost"], ["Min Stock", "minStockLevel"], ["Reorder Point", "reorderPoint"]].map(([label, key]) => (
                <div key={key}>
                  <Label className="text-slate-300 text-xs">{label}</Label>
                  <Input value={(form as Record<string, string>)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className="bg-slate-700 border-slate-600 text-white mt-1" />
                </div>
              ))}
              <div className="col-span-2">
                <Label className="text-slate-300 text-xs">Item Group</Label>
                <Select value={form.itemGroup} onValueChange={v => setForm(f => ({ ...f, itemGroup: v as typeof form.itemGroup }))}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{["MUD_CHEMICAL", "PIPE", "EQUIPMENT", "CONSUMABLE", "RENTAL", "SERVICE"].map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={() => createMutation.mutate({ ...form, unitCost: form.unitCost ? Number(form.unitCost) : undefined, minStockLevel: Number(form.minStockLevel), reorderPoint: Number(form.reorderPoint) })} disabled={createMutation.isPending} className="w-full mt-2 bg-blue-600 hover:bg-blue-700">
              {createMutation.isPending ? "Creating..." : "Create Material"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <p className="text-slate-400">Loading...</p> : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700">
                <TableHead className="text-slate-400">Code</TableHead>
                <TableHead className="text-slate-400">Name</TableHead>
                <TableHead className="text-slate-400">Group</TableHead>
                <TableHead className="text-slate-400">UOM</TableHead>
                <TableHead className="text-slate-400">Stock</TableHead>
                <TableHead className="text-slate-400">Unit Cost</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(materials ?? []).map((m: { id: string; item_code: string; item_name: string; item_group: string; uom: string; unit_cost: number }) => {
                const stock = stockMap.get(m.id) as { total_stock: number; stock_status: string } | undefined;
                return (
                  <TableRow key={m.id} className="border-slate-700 hover:bg-slate-700/50">
                    <TableCell className="text-blue-400 font-mono text-xs">{m.item_code}</TableCell>
                    <TableCell className="text-white text-sm">{m.item_name}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs border-slate-600 text-slate-300">{m.item_group}</Badge></TableCell>
                    <TableCell className="text-slate-300 text-xs">{m.uom}</TableCell>
                    <TableCell className="text-slate-300 text-xs">{stock ? Number(stock.total_stock).toFixed(1) : "—"}</TableCell>
                    <TableCell className="text-slate-300 text-xs">{m.unit_cost ? `$${Number(m.unit_cost).toFixed(2)}` : "—"}</TableCell>
                    <TableCell>{stock ? <StatusBadge status={stock.stock_status} /> : <StatusBadge status="OK" />}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Material Requests Tab ────────────────────────────────────────────────────
function MaterialRequestsTab() {
  const [status, setStatus] = useState<string | undefined>();
  const utils = trpc.useUtils();

  const { data: requests } = trpc.materials.requests.list.useQuery({ status, limit: 100 });
  const approveMutation = trpc.materials.requests.approve.useMutation({
    onSuccess: () => { utils.materials.requests.list.invalidate(); toast.success("MR Approved"); },
  });
  const rejectMutation = trpc.materials.requests.reject.useMutation({
    onSuccess: () => { utils.materials.requests.list.invalidate(); toast.success("MR Rejected"); },
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Select value={status ?? "all"} onValueChange={v => setStatus(v === "all" ? undefined : v)}>
          <SelectTrigger className="w-44 bg-slate-700 border-slate-600 text-white"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "ORDERED"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700">
              <TableHead className="text-slate-400">MR Number</TableHead>
              <TableHead className="text-slate-400">Requested By</TableHead>
              <TableHead className="text-slate-400">Well</TableHead>
              <TableHead className="text-slate-400">Priority</TableHead>
              <TableHead className="text-slate-400">Items</TableHead>
              <TableHead className="text-slate-400">Est. Cost</TableHead>
              <TableHead className="text-slate-400">Status</TableHead>
              <TableHead className="text-slate-400">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(requests ?? []).map((r: { id: string; request_number: string; requested_by: string; well_id: string; priority: string; item_count: number; estimated_total: number; status: string }) => (
              <TableRow key={r.id} className="border-slate-700 hover:bg-slate-700/50">
                <TableCell className="text-blue-400 font-mono text-xs">{r.request_number}</TableCell>
                <TableCell className="text-white text-sm">{r.requested_by}</TableCell>
                <TableCell className="text-slate-300 text-xs">{r.well_id ?? "—"}</TableCell>
                <TableCell><Badge variant="outline" className={`text-xs ${r.priority === "CRITICAL" ? "border-red-500 text-red-400" : "border-slate-600 text-slate-300"}`}>{r.priority}</Badge></TableCell>
                <TableCell className="text-slate-300 text-xs">{r.item_count}</TableCell>
                <TableCell className="text-slate-300 text-xs">${Number(r.estimated_total).toFixed(0)}</TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
                <TableCell>
                  {r.status === "SUBMITTED" && (
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => approveMutation.mutate({ requestId: r.id })} className="bg-green-600 hover:bg-green-700 h-6 text-xs px-2">Approve</Button>
                      <Button size="sm" onClick={() => rejectMutation.mutate({ requestId: r.id })} className="bg-red-600 hover:bg-red-700 h-6 text-xs px-2">Reject</Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Purchase Orders Tab ──────────────────────────────────────────────────────
function PurchaseOrdersTab() {
  const [status, setStatus] = useState<string | undefined>();
  const { data: orders } = trpc.materials.purchaseOrders.list.useQuery({ status, limit: 100 });

  return (
    <div className="space-y-4">
      <Select value={status ?? "all"} onValueChange={v => setStatus(v === "all" ? undefined : v)}>
        <SelectTrigger className="w-44 bg-slate-700 border-slate-600 text-white"><SelectValue placeholder="All Statuses" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {["DRAFT", "SUBMITTED", "CONFIRMED", "RECEIVED", "CANCELLED"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700">
              <TableHead className="text-slate-400">PO Number</TableHead>
              <TableHead className="text-slate-400">Supplier</TableHead>
              <TableHead className="text-slate-400">Lead Time</TableHead>
              <TableHead className="text-slate-400">Lines</TableHead>
              <TableHead className="text-slate-400">Total Amount</TableHead>
              <TableHead className="text-slate-400">Expected Delivery</TableHead>
              <TableHead className="text-slate-400">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(orders ?? []).map((o: { id: string; po_number: string; supplier_name: string; lead_time_days: number; line_count: number; total_amount: number; expected_delivery: string; status: string }) => (
              <TableRow key={o.id} className="border-slate-700 hover:bg-slate-700/50">
                <TableCell className="text-blue-400 font-mono text-xs">{o.po_number}</TableCell>
                <TableCell className="text-white text-sm">{o.supplier_name}</TableCell>
                <TableCell className="text-slate-300 text-xs">{o.lead_time_days}d</TableCell>
                <TableCell className="text-slate-300 text-xs">{o.line_count}</TableCell>
                <TableCell className="text-emerald-400 text-xs font-medium">${Number(o.total_amount).toLocaleString()}</TableCell>
                <TableCell className="text-slate-300 text-xs">{o.expected_delivery ? new Date(o.expected_delivery).toLocaleDateString() : "—"}</TableCell>
                <TableCell><StatusBadge status={o.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Suppliers Tab ────────────────────────────────────────────────────────────
function SuppliersTab() {
  const { data: suppliers } = trpc.materials.suppliers.list.useQuery({});
  const { data: performance } = trpc.materials.suppliers.getPerformance.useQuery();

  const perfMap = new Map((performance ?? []).map((p: { id: string; total_orders: number; total_spend: number }) => [p.id, p]));

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-slate-700">
            <TableHead className="text-slate-400">Code</TableHead>
            <TableHead className="text-slate-400">Supplier Name</TableHead>
            <TableHead className="text-slate-400">Type</TableHead>
            <TableHead className="text-slate-400">Lead Time</TableHead>
            <TableHead className="text-slate-400">Payment Terms</TableHead>
            <TableHead className="text-slate-400">Total Orders</TableHead>
            <TableHead className="text-slate-400">Total Spend</TableHead>
            <TableHead className="text-slate-400">Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(suppliers ?? []).map((s: { id: string; supplier_code: string; supplier_name: string; supplier_type: string; lead_time_days: number; payment_terms: string; performance_score: number }) => {
            const perf = perfMap.get(s.id) as { total_orders: number; total_spend: number } | undefined;
            return (
              <TableRow key={s.id} className="border-slate-700 hover:bg-slate-700/50">
                <TableCell className="text-blue-400 font-mono text-xs">{s.supplier_code}</TableCell>
                <TableCell className="text-white text-sm">{s.supplier_name}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs border-slate-600 text-slate-300">{s.supplier_type}</Badge></TableCell>
                <TableCell className="text-slate-300 text-xs">{s.lead_time_days}d</TableCell>
                <TableCell className="text-slate-300 text-xs">{s.payment_terms}</TableCell>
                <TableCell className="text-slate-300 text-xs">{perf?.total_orders ?? 0}</TableCell>
                <TableCell className="text-emerald-400 text-xs">${Number(perf?.total_spend ?? 0).toLocaleString()}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <div className="w-16 h-2 bg-slate-600 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${s.performance_score ?? 75}%` }} />
                    </div>
                    <span className="text-slate-300 text-xs">{s.performance_score ?? 75}</span>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Field Operations Tab ─────────────────────────────────────────────────────
function FieldOperationsTab() {
  const { data: transfers } = trpc.materials.fieldOps.listTransferOrders.useQuery({});

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Truck className="w-5 h-5 text-orange-400" />
        <h3 className="text-white font-medium">Transfer Orders</h3>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700">
              <TableHead className="text-slate-400">Transfer #</TableHead>
              <TableHead className="text-slate-400">From</TableHead>
              <TableHead className="text-slate-400">To</TableHead>
              <TableHead className="text-slate-400">Well</TableHead>
              <TableHead className="text-slate-400">Driver</TableHead>
              <TableHead className="text-slate-400">Items</TableHead>
              <TableHead className="text-slate-400">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(transfers ?? []).map((t: { id: string; transfer_number: string; from_location: string; to_location: string; well_id: string; driver_name: string; item_count: number; status: string }) => (
              <TableRow key={t.id} className="border-slate-700 hover:bg-slate-700/50">
                <TableCell className="text-blue-400 font-mono text-xs">{t.transfer_number}</TableCell>
                <TableCell className="text-white text-sm">{t.from_location ?? "—"}</TableCell>
                <TableCell className="text-white text-sm">{t.to_location ?? "—"}</TableCell>
                <TableCell className="text-slate-300 text-xs">{t.well_id ?? "—"}</TableCell>
                <TableCell className="text-slate-300 text-xs">{t.driver_name ?? "—"}</TableCell>
                <TableCell className="text-slate-300 text-xs">{t.item_count}</TableCell>
                <TableCell><StatusBadge status={t.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MaterialsManagement() {
  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Factory className="w-6 h-6 text-blue-400" />
              Materials Management
            </h1>
            <p className="text-slate-400 text-sm mt-1">ERPNext-inspired procurement, inventory, and field operations — MR → PO → GRN workflow</p>
          </div>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-blue-600 text-slate-300 data-[state=active]:text-white">
              <BarChart3 className="w-4 h-4 mr-1" />Dashboard
            </TabsTrigger>
            <TabsTrigger value="materials" className="data-[state=active]:bg-blue-600 text-slate-300 data-[state=active]:text-white">
              <Package className="w-4 h-4 mr-1" />Material Master
            </TabsTrigger>
            <TabsTrigger value="requests" className="data-[state=active]:bg-blue-600 text-slate-300 data-[state=active]:text-white">
              <Clock className="w-4 h-4 mr-1" />Material Requests
            </TabsTrigger>
            <TabsTrigger value="orders" className="data-[state=active]:bg-blue-600 text-slate-300 data-[state=active]:text-white">
              <ShoppingCart className="w-4 h-4 mr-1" />Purchase Orders
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="data-[state=active]:bg-blue-600 text-slate-300 data-[state=active]:text-white">
              <Wrench className="w-4 h-4 mr-1" />Suppliers
            </TabsTrigger>
            <TabsTrigger value="fieldops" className="data-[state=active]:bg-blue-600 text-slate-300 data-[state=active]:text-white">
              <Truck className="w-4 h-4 mr-1" />Field Operations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4"><DashboardTab /></TabsContent>
          <TabsContent value="materials" className="mt-4"><MaterialMasterTab /></TabsContent>
          <TabsContent value="requests" className="mt-4"><MaterialRequestsTab /></TabsContent>
          <TabsContent value="orders" className="mt-4"><PurchaseOrdersTab /></TabsContent>
          <TabsContent value="suppliers" className="mt-4"><SuppliersTab /></TabsContent>
          <TabsContent value="fieldops" className="mt-4"><FieldOperationsTab /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
