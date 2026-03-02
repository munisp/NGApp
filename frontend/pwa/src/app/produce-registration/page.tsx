"use client";

import { useState } from "react";
import {
  Sprout,
  Plus,
  Search,
  Loader2,
  MapPin,
  Calendar,
  Scale,
  CheckCircle2,
  Clock,
  TrendingUp,
  Warehouse,
  X,
  ChevronRight,
  Leaf,
  Sun,
  Package,
} from "lucide-react";
import { useProduceInventory, useRegisterProduce } from "@/lib/api-hooks";

const GRADE_COLORS: Record<string, string> = {
  premium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  grade_a: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  grade_b: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  grade_c: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  ungraded: "text-gray-400 bg-gray-500/10 border-gray-500/20",
};

const STATUS_COLORS: Record<string, string> = {
  registered: "text-blue-400 bg-blue-500/10",
  growing: "text-green-400 bg-green-500/10",
  harvested: "text-amber-400 bg-amber-500/10",
  stored: "text-cyan-400 bg-cyan-500/10",
  listed: "text-purple-400 bg-purple-500/10",
  sold: "text-gray-400 bg-gray-500/10",
};

const STATUS_ICONS: Record<string, typeof Sprout> = {
  registered: Clock,
  growing: Sun,
  harvested: Leaf,
  stored: Warehouse,
  listed: TrendingUp,
  sold: CheckCircle2,
};

function formatNaira(v: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(v);
}

export default function ProduceRegistrationPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const { inventory, loading } = useProduceInventory();
  const { registerProduce, loading: registering } = useRegisterProduce();

  const [form, setForm] = useState({
    producer_id: "",
    cooperative_id: "",
    commodity: "",
    commodity_category: "grains",
    variety: "",
    estimated_quantity_tonnes: "",
    quality_grade: "ungraded",
    farm_location: "",
    farm_gps: "",
    farm_size_hectares: "",
    planting_date: "",
    expected_harvest_date: "",
    asking_price_per_tonne: "",
  });

  const filtered = inventory.filter((p) => {
    const matchesSearch = !searchQuery || [p.commodity, p.producer_name, p.variety, p.id].some((v) => String(v ?? "").toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = !statusFilter || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalTonnes = inventory.reduce((sum, p) => sum + (Number(p.estimated_quantity_tonnes) || 0), 0);
  const listedCount = inventory.filter((p) => p.listed_on_exchange).length;
  const growingCount = inventory.filter((p) => p.status === "growing").length;
  const harvestedCount = inventory.filter((p) => p.status === "harvested").length;

  const handleRegister = async () => {
    await registerProduce({
      ...form,
      estimated_quantity_tonnes: parseFloat(form.estimated_quantity_tonnes) || 0,
      farm_size_hectares: parseFloat(form.farm_size_hectares) || 0,
      asking_price_per_tonne: parseFloat(form.asking_price_per_tonne) || 0,
    });
    setShowRegister(false);
    setForm({ producer_id: "", cooperative_id: "", commodity: "", commodity_category: "grains", variety: "", estimated_quantity_tonnes: "", quality_grade: "ungraded", farm_location: "", farm_gps: "", farm_size_hectares: "", planting_date: "", expected_harvest_date: "", asking_price_per_tonne: "" });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10"><Sprout className="h-5 w-5 text-green-400" /></div>
            Produce & Crop Registration
          </h1>
          <p className="text-sm text-gray-400 mt-1">Register crops and commodities for grading, storage, and listing on the exchange</p>
        </div>
        <button onClick={() => setShowRegister(true)} className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition-colors">
          <Plus className="h-4 w-4" /> Register Produce
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Registered", value: String(inventory.length), icon: Package, color: "text-brand-400" },
          { label: "Total Quantity", value: `${totalTonnes.toFixed(1)} tonnes`, icon: Scale, color: "text-cyan-400" },
          { label: "Growing", value: String(growingCount), icon: Sun, color: "text-green-400" },
          { label: "Listed on Exchange", value: String(listedCount), icon: TrendingUp, color: "text-purple-400" },
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

      {/* Harvest timeline info */}
      {harvestedCount > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
          <Leaf className="h-5 w-5 text-amber-400 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-400">{harvestedCount} Crop(s) Harvested & Ready</p>
            <p className="text-xs text-amber-400/70 mt-1">These crops have been harvested and are ready for quality grading, warehouse deposit, and listing on the exchange. Create a warehouse receipt to make them tradeable.</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by commodity, producer, variety..."
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none" />
        </div>
        <div className="flex gap-2">
          {["", "registered", "growing", "harvested", "stored"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${statusFilter === s ? "bg-brand-500/20 text-brand-400 border border-brand-500/30" : "text-gray-400 hover:text-white border border-white/[0.06]"}`}>
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory list */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading inventory...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No produce registered yet</div>
      ) : (
        <div className="space-y-4">
          {filtered.map((p) => {
            const StatusIcon = STATUS_ICONS[String(p.status)] ?? Clock;
            return (
              <div key={String(p.id)} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-white/[0.1] transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                      <Sprout className="h-5 w-5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{String(p.commodity)} — {String(p.variety)}</p>
                      <p className="text-xs text-gray-500">{String(p.id)} &middot; {String(p.producer_name)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${GRADE_COLORS[String(p.quality_grade)] ?? GRADE_COLORS.ungraded}`}>
                      {String(p.quality_grade).replace("_", " ").toUpperCase()}
                    </span>
                    <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[String(p.status)] ?? STATUS_COLORS.registered}`}>
                      <StatusIcon className="h-2.5 w-2.5" /> {String(p.status).toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                  <div>
                    <span className="text-gray-500">Farm Location</span>
                    <p className="text-white font-medium mt-0.5 flex items-center gap-1"><MapPin className="h-3 w-3 text-gray-500" />{String(p.farm_location)}</p>
                    <p className="text-gray-600 text-[10px]">{Number(p.farm_size_hectares).toFixed(1)} hectares</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Quantity</span>
                    <p className="text-white font-medium mt-0.5">{Number(p.estimated_quantity_tonnes).toFixed(1)} tonnes</p>
                    <p className="text-gray-600 text-[10px]">{String(p.commodity_category).replace("_", " ")}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Asking Price</span>
                    <p className="text-white font-medium mt-0.5">{formatNaira(Number(p.asking_price_per_tonne))}/tonne</p>
                    <p className="text-gray-600 text-[10px]">Total: {formatNaira(Number(p.asking_price_per_tonne) * Number(p.estimated_quantity_tonnes))}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Harvest</span>
                    <p className="text-white font-medium mt-0.5 flex items-center gap-1"><Calendar className="h-3 w-3 text-gray-500" />{String(p.expected_harvest_date ?? "TBD")}</p>
                    <p className="text-gray-600 text-[10px]">Planted: {String(p.planting_date ?? "N/A")}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3 border-t border-white/[0.04] pt-3">
                  {Boolean(p.listed_on_exchange) && (
                    <span className="flex items-center gap-1.5 text-xs text-purple-400">
                      <TrendingUp className="h-3 w-3" /> Listed on Exchange
                    </span>
                  )}
                  {Boolean(p.warehouse_receipt_id) && (
                    <span className="flex items-center gap-1.5 text-xs text-cyan-400">
                      <Warehouse className="h-3 w-3" /> Receipt: {String(p.warehouse_receipt_id)}
                    </span>
                  )}
                  {Boolean(p.cooperative_id) && (
                    <span className="flex items-center gap-1.5 text-xs text-green-400">
                      <Sprout className="h-3 w-3" /> Cooperative: {String(p.cooperative_id)}
                    </span>
                  )}
                  <button className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors">
                    View Details <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Register modal */}
      {showRegister && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/[0.08] bg-gray-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">Register New Produce</h2>
              <button onClick={() => setShowRegister(false)} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Producer ID *</label>
                <input type="text" value={form.producer_id} onChange={(e) => setForm({ ...form, producer_id: e.target.value })} placeholder="e.g. kyc-f01"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Cooperative ID</label>
                <input type="text" value={form.cooperative_id} onChange={(e) => setForm({ ...form, cooperative_id: e.target.value })} placeholder="Optional"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Commodity *</label>
                <select value={form.commodity} onChange={(e) => setForm({ ...form, commodity: e.target.value })}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none">
                  <option value="">Select...</option>
                  <option value="Maize">Maize</option><option value="Sorghum">Sorghum</option><option value="Rice">Rice</option>
                  <option value="Millet">Millet</option><option value="Cocoa">Cocoa</option><option value="Cashew">Cashew</option>
                  <option value="Sesame">Sesame</option><option value="Soybean">Soybean</option><option value="Groundnut">Groundnut</option>
                  <option value="Palm Oil">Palm Oil</option><option value="Cotton">Cotton</option><option value="Cassava">Cassava</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Variety</label>
                <input type="text" value={form.variety} onChange={(e) => setForm({ ...form, variety: e.target.value })} placeholder="e.g. SAMMAZ-15"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Estimated Quantity (tonnes)</label>
                <input type="number" step="0.1" value={form.estimated_quantity_tonnes} onChange={(e) => setForm({ ...form, estimated_quantity_tonnes: e.target.value })} placeholder="e.g. 8.0"
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
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Farm Location</label>
                <input type="text" value={form.farm_location} onChange={(e) => setForm({ ...form, farm_location: e.target.value })} placeholder="e.g. Kura LGA, Kano State"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Farm Size (hectares)</label>
                <input type="number" step="0.1" value={form.farm_size_hectares} onChange={(e) => setForm({ ...form, farm_size_hectares: e.target.value })} placeholder="e.g. 3.5"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Planting Date</label>
                <input type="date" value={form.planting_date} onChange={(e) => setForm({ ...form, planting_date: e.target.value })}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Expected Harvest Date</label>
                <input type="date" value={form.expected_harvest_date} onChange={(e) => setForm({ ...form, expected_harvest_date: e.target.value })}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Asking Price (NGN/tonne)</label>
                <input type="number" value={form.asking_price_per_tonne} onChange={(e) => setForm({ ...form, asking_price_per_tonne: e.target.value })} placeholder="e.g. 280000"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setShowRegister(false)} className="rounded-lg border border-white/[0.08] px-4 py-2.5 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleRegister} disabled={registering || !form.producer_id || !form.commodity}
                className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50 transition-colors">
                {registering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Register
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
