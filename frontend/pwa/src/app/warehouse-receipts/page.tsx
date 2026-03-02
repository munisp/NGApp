"use client";

import { useState } from "react";
import {
  Warehouse,
  Package,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Shield,
  Search,
  Plus,
  FileText,
  MapPin,
  Scale,
  Loader2,
  ChevronRight,
  X,
} from "lucide-react";
import { useWarehouseReceipts, useCreateWarehouseReceipt } from "@/lib/api-hooks";

const GRADE_COLORS: Record<string, string> = {
  premium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  grade_a: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  grade_b: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  grade_c: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  ungraded: "text-gray-400 bg-gray-500/10 border-gray-500/20",
};

const STATUS_COLORS: Record<string, string> = {
  issued: "text-blue-400 bg-blue-500/10",
  active: "text-emerald-400 bg-emerald-500/10",
  traded: "text-purple-400 bg-purple-500/10",
  settled: "text-gray-400 bg-gray-500/10",
  expired: "text-red-400 bg-red-500/10",
  released: "text-cyan-400 bg-cyan-500/10",
};

function formatNaira(v: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(v);
}

export default function WarehouseReceiptsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { receipts, loading } = useWarehouseReceipts(statusFilter || undefined);
  const { createReceipt, loading: creating } = useCreateWarehouseReceipt();

  const [form, setForm] = useState({
    depositor_id: "",
    warehouse_id: "",
    commodity: "",
    commodity_category: "grains",
    quantity_tonnes: "",
    quality_grade: "ungraded",
    unit_price: "",
    deposit_date: "",
    expiry_date: "",
  });

  const filtered = receipts.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(r.commodity ?? "").toLowerCase().includes(q) ||
      String(r.depositor_name ?? "").toLowerCase().includes(q) ||
      String(r.warehouse_name ?? "").toLowerCase().includes(q) ||
      String(r.id ?? "").toLowerCase().includes(q)
    );
  });

  const totalValue = receipts.reduce((sum, r) => sum + (Number(r.total_value) || 0), 0);
  const totalTonnes = receipts.reduce((sum, r) => sum + (Number(r.quantity_tonnes) || 0), 0);
  const activeCount = receipts.filter((r) => r.status === "active").length;
  const collateralizedCount = receipts.filter((r) => r.collateralized).length;

  const handleCreate = async () => {
    await createReceipt({
      ...form,
      quantity_tonnes: parseFloat(form.quantity_tonnes) || 0,
      unit_price: parseFloat(form.unit_price) || 0,
    });
    setShowCreate(false);
    setForm({ depositor_id: "", warehouse_id: "", commodity: "", commodity_category: "grains", quantity_tonnes: "", quality_grade: "ungraded", unit_price: "", deposit_date: "", expiry_date: "" });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10"><Warehouse className="h-5 w-5 text-cyan-400" /></div>
            Warehouse Receipts
          </h1>
          <p className="text-sm text-gray-400 mt-1">Digital warehouse receipts for deposited commodities — tradeable on the exchange</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition-colors">
          <Plus className="h-4 w-4" /> New Receipt
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Receipts", value: String(receipts.length), icon: FileText, color: "text-brand-400" },
          { label: "Active Receipts", value: String(activeCount), icon: CheckCircle2, color: "text-emerald-400" },
          { label: "Total Stored", value: `${totalTonnes.toFixed(1)} tonnes`, icon: Scale, color: "text-cyan-400" },
          { label: "Total Value", value: formatNaira(totalValue), icon: Package, color: "text-yellow-400" },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{card.label}</span>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
            <p className="text-xl font-bold text-white">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Collateral info */}
      {collateralizedCount > 0 && (
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 flex items-start gap-3">
          <Shield className="h-5 w-5 text-purple-400 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-purple-400">{collateralizedCount} Receipt(s) Used as Collateral</p>
            <p className="text-xs text-purple-400/70 mt-1">These receipts are pledged to trade finance banks for commodity-backed loans. They remain in the warehouse and cannot be traded until the loan is repaid.</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by commodity, depositor, warehouse, or receipt ID..."
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none" />
        </div>
        <div className="flex gap-2">
          {["", "active", "issued", "traded", "settled"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${statusFilter === s ? "bg-brand-500/20 text-brand-400 border border-brand-500/30" : "text-gray-400 hover:text-white border border-white/[0.06]"}`}>
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Receipts list */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading receipts...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No warehouse receipts found</div>
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => (
            <div key={String(r.id)} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-white/[0.1] transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10">
                    <FileText className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{String(r.id)}</p>
                    <p className="text-xs text-gray-500">{String(r.commodity)} &middot; {String(r.depositor_name)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${GRADE_COLORS[String(r.quality_grade)] ?? GRADE_COLORS.ungraded}`}>
                    {String(r.quality_grade).replace("_", " ").toUpperCase()}
                  </span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[String(r.status)] ?? STATUS_COLORS.issued}`}>
                    {String(r.status).toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                <div>
                  <span className="text-gray-500">Warehouse</span>
                  <p className="text-white font-medium mt-0.5 flex items-center gap-1"><MapPin className="h-3 w-3 text-gray-500" />{String(r.warehouse_name)}</p>
                  <p className="text-gray-600 text-[10px]">{String(r.warehouse_location)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Quantity</span>
                  <p className="text-white font-medium mt-0.5">{Number(r.quantity_tonnes).toFixed(1)} tonnes</p>
                  <p className="text-gray-600 text-[10px]">{String(r.commodity_category).replace("_", " ")}</p>
                </div>
                <div>
                  <span className="text-gray-500">Total Value</span>
                  <p className="text-white font-medium mt-0.5">{formatNaira(Number(r.total_value))}</p>
                  <p className="text-gray-600 text-[10px]">{formatNaira(Number(r.unit_price))}/tonne</p>
                </div>
                <div>
                  <span className="text-gray-500">Dates</span>
                  <p className="text-white font-medium mt-0.5 flex items-center gap-1"><Clock className="h-3 w-3 text-gray-500" />{String(r.deposit_date)}</p>
                  <p className="text-gray-600 text-[10px]">Expires: {String(r.expiry_date ?? "N/A")}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3 border-t border-white/[0.04] pt-3">
                {Boolean(r.tradeable) && r.status === "active" && (
                  <button className="flex items-center gap-1.5 rounded-lg bg-brand-500/10 border border-brand-500/20 px-3 py-1.5 text-xs font-medium text-brand-400 hover:bg-brand-500/20 transition-colors">
                    <ArrowRightLeft className="h-3 w-3" /> Trade on Exchange
                  </button>
                )}
                {Boolean(r.collateralized) && (
                  <span className="flex items-center gap-1.5 text-xs text-purple-400">
                    <Shield className="h-3 w-3" /> Collateralized
                  </span>
                )}
                <button className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors">
                  View Details <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-gray-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">Create Warehouse Receipt</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Depositor ID *</label>
                <input type="text" value={form.depositor_id} onChange={(e) => setForm({ ...form, depositor_id: e.target.value })} placeholder="e.g. kyc-f01"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Warehouse ID *</label>
                <input type="text" value={form.warehouse_id} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })} placeholder="e.g. WH-KN-001"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Commodity *</label>
                <input type="text" value={form.commodity} onChange={(e) => setForm({ ...form, commodity: e.target.value })} placeholder="e.g. Maize"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Category</label>
                <select value={form.commodity_category} onChange={(e) => setForm({ ...form, commodity_category: e.target.value })}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none">
                  <option value="grains">Grains</option><option value="oilseeds">Oilseeds</option><option value="cash_crops">Cash Crops</option>
                  <option value="tubers">Tubers</option><option value="fruits_vegetables">Fruits & Vegetables</option><option value="livestock">Livestock</option>
                  <option value="precious_metals">Precious Metals</option><option value="base_metals">Base Metals</option><option value="energy">Energy</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Quantity (tonnes) *</label>
                <input type="number" step="0.1" value={form.quantity_tonnes} onChange={(e) => setForm({ ...form, quantity_tonnes: e.target.value })} placeholder="e.g. 12.5"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Quality Grade</label>
                <select value={form.quality_grade} onChange={(e) => setForm({ ...form, quality_grade: e.target.value })}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none">
                  <option value="premium">Premium</option><option value="grade_a">Grade A</option><option value="grade_b">Grade B</option>
                  <option value="grade_c">Grade C</option><option value="ungraded">Ungraded</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Unit Price (NGN/tonne)</label>
                <input type="number" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} placeholder="e.g. 280000"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Deposit Date</label>
                <input type="date" value={form.deposit_date} onChange={(e) => setForm({ ...form, deposit_date: e.target.value })}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="rounded-lg border border-white/[0.08] px-4 py-2.5 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={creating || !form.depositor_id || !form.warehouse_id || !form.commodity}
                className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50 transition-colors">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
