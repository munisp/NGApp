import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { BarChart2, TrendingUp, TrendingDown, Minus, Award, AlertTriangle } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

const SECTOR_COLORS: Record<string, string> = {
  fintech: "bg-blue-600",
  health: "bg-green-600",
  telecom: "bg-purple-600",
  government: "bg-yellow-600",
  retail: "bg-orange-600",
  education: "bg-pink-600",
  energy: "bg-red-600",
  media: "bg-cyan-600",
};

function ComplianceBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-300 w-8 text-right">{value}</span>
    </div>
  );
}

export default function SectorBenchmarking() {
  const [selectedSector, setSelectedSector] = useState<string | null>(null);

  const { data: benchmarks = [], isLoading } = trpc.sectorBenchmarks.list.useQuery({});
  const [compareOrgId] = useState(1);
  const { data: detail } = trpc.sectorBenchmarks.compare.useQuery(
    { orgId: compareOrgId, sector: selectedSector! },
    { enabled: !!selectedSector }
  );

  const topSector = (benchmarks as any[]).reduce((best: any, curr: any) => (!best || curr.avg_compliance_score > best.avg_compliance_score ? curr : best), null);
  const bottomSector = (benchmarks as any[]).reduce((worst: any, curr: any) => (!worst || curr.avg_compliance_score < worst.avg_compliance_score ? curr : worst), null);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <BarChart2 className="w-7 h-7 text-blue-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Sector Benchmarking</h1>
            <p className="text-sm text-gray-400">Comparative compliance analytics across regulated sectors</p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">Sectors Monitored</div>
            <div className="text-2xl font-bold text-white">{(benchmarks as any[]).length}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">National Average</div>
            <div className="text-2xl font-bold text-white">
              {(benchmarks as any[]).length > 0 ? Math.round((benchmarks as any[]).reduce((s: number, b: any) => s + (b.avg_compliance_score ?? 0), 0) / (benchmarks as any[]).length) : "—"}%
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Award className="w-3 h-3 text-green-400" /> Top Sector</div>
            <div className="text-lg font-bold text-green-400 capitalize">{topSector?.sector ?? "—"}</div>
            {topSector && <div className="text-xs text-gray-500">{Math.round(topSector.avg_compliance_score)}% avg</div>}
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-red-400" /> Needs Attention</div>
            <div className="text-lg font-bold text-red-400 capitalize">{bottomSector?.sector ?? "—"}</div>
            {bottomSector && <div className="text-xs text-gray-500">{Math.round(bottomSector.avg_compliance_score)}% avg</div>}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sector list */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <h2 className="font-semibold text-white">Sector Overview</h2>
            </div>
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : (benchmarks as any[]).length === 0 ? (
              <div className="p-8 text-center text-gray-500">No sector data available. Run sector benchmarking to populate.</div>
            ) : (
              <div className="divide-y divide-gray-800">
                {(benchmarks as any[]).map((b: any) => (
                  <button
                    key={b.sector}
                    onClick={() => setSelectedSector(b.sector === selectedSector ? null : b.sector)}
                    className={`w-full px-5 py-4 text-left hover:bg-gray-800/50 transition-all ${selectedSector === b.sector ? "bg-gray-800/50" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${SECTOR_COLORS[b.sector] ?? "bg-gray-500"}`} />
                        <span className="font-medium text-white capitalize">{b.sector}</span>
                        <span className="text-xs text-gray-500">{b.org_count} orgs</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {b.trend > 0 ? <TrendingUp className="w-3.5 h-3.5 text-green-400" /> : b.trend < 0 ? <TrendingDown className="w-3.5 h-3.5 text-red-400" /> : <Minus className="w-3.5 h-3.5 text-gray-500" />}
                        <span className={`text-xs font-medium ${b.trend > 0 ? "text-green-400" : b.trend < 0 ? "text-red-400" : "text-gray-500"}`}>
                          {b.trend > 0 ? "+" : ""}{b.trend?.toFixed(1) ?? "0"}%
                        </span>
                      </div>
                    </div>
                    <ComplianceBar value={Math.round(b.avg_compliance_score ?? 0)} />
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      <span>{b.open_violations ?? 0} open violations</span>
                      <span>{b.total_penalties_ngn ? `₦${(b.total_penalties_ngn / 1e6).toFixed(1)}M penalties` : "No penalties"}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sector detail */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <h2 className="font-semibold text-white">{selectedSector ? `${selectedSector.charAt(0).toUpperCase() + selectedSector.slice(1)} Sector Detail` : "Select a Sector"}</h2>
            </div>
            {!selectedSector && (
              <div className="p-8 text-center text-gray-500">
                <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Click a sector to see detailed benchmarks</p>
              </div>
            )}
            {selectedSector && detail && (
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Avg Compliance", value: `${Math.round((detail as any).avg_compliance_score ?? 0)}%`, color: "text-green-400" },
                    { label: "Avg Risk Score", value: `${Math.round((detail as any).avg_risk_score ?? 0)}`, color: "text-yellow-400" },
                    { label: "Breach Rate", value: `${((detail as any).breach_rate ?? 0).toFixed(1)}%`, color: "text-red-400" },
                    { label: "DSAR Response", value: `${Math.round((detail as any).avg_dsar_response_days ?? 0)}d avg`, color: "text-blue-400" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-gray-800 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
                      <div className={`text-xl font-bold ${color}`}>{value}</div>
                    </div>
                  ))}
                </div>
                {(detail as any).top_violations?.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Top Violation Types</div>
                    <div className="space-y-1.5">
                      {(detail as any).top_violations.slice(0, 4).map((v: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-gray-300">{v.type}</span>
                          <span className="text-gray-500">{v.count}x</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(detail as any).compliance_leaders?.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Compliance Leaders</div>
                    <div className="space-y-1.5">
                      {(detail as any).compliance_leaders.slice(0, 3).map((org: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-yellow-600 text-white" : i === 1 ? "bg-gray-500 text-white" : "bg-orange-800 text-white"}`}>{i + 1}</span>
                            <span className="text-gray-300">{org.name}</span>
                          </div>
                          <span className="text-green-400 font-medium">{org.score}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
