/**
 * ProductionForecasting.tsx
 * Arps decline curve analysis, P10/P50/P90 Monte Carlo EUR, NPV10 calculator
 * References: Arps (1945), Fetkovich (1980)
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { toast } from "sonner";
import { TrendingDown, DollarSign, BarChart2, Save, RefreshCw, Target } from "lucide-react";

const WELL_OPTIONS = [
  { id: "W-001", name: "Al-Burgan-01" },
  { id: "W-002", name: "Al-Burgan-02" },
  { id: "W-003", name: "Raudhatain-01" },
  { id: "W-004", name: "Sabriyah-01" },
  { id: "W-005", name: "Minagish-01" },
];

const DECLINE_TYPES = [
  { value: "exponential", label: "Exponential (b=0)", desc: "Most conservative, used for tight reservoirs" },
  { value: "hyperbolic", label: "Hyperbolic (0<b<1)", desc: "Most common in conventional reservoirs" },
  { value: "harmonic", label: "Harmonic (b=1)", desc: "Fractured/solution gas drive reservoirs" },
];

export default function ProductionForecasting() {
  const [wellId, setWellId] = useState("W-001");
  const [forecastName, setForecastName] = useState("Base Case Forecast");
  const [declineType, setDeclineType] = useState<"exponential" | "hyperbolic" | "harmonic">("hyperbolic");
  const [qi, setQi] = useState(500);
  const [di, setDi] = useState(0.08);
  const [bFactor, setBFactor] = useState(0.5);
  const [years, setYears] = useState(10);
  const [oilPrice, setOilPrice] = useState(70);
  const [opex, setOpex] = useState(15);
  const [discount, setDiscount] = useState(10);
  const [result, setResult] = useState<any>(null);
  const [savedForecasts, setSavedForecasts] = useState<any[]>([]);

  const computeMutation = trpc.productionForecasting.compute.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success("Forecast computed successfully");
    },
    onError: (err) => toast.error(err.message),
  });

  const saveMutation = trpc.productionForecasting.compute.useMutation({
    onSuccess: () => toast.success("Forecast saved to database"),
    onError: (err) => toast.error(err.message),
  });

  const listQuery = trpc.productionForecasting.list.useQuery({ wellId });

  const handleCompute = (save = false) => {
    computeMutation.mutate({
      wellId, forecastName, declineType,
      initialRateBopd: qi,
      declineRateMonthly: di,
      bFactor: declineType === "exponential" ? 0 : declineType === "harmonic" ? 1 : bFactor,
      forecastYears: years,
      oilPriceUsdPerBbl: oilPrice,
      operatingCostUsdPerBbl: opex,
      discountRatePct: discount,
      save,
    });
  };

  const wellName = WELL_OPTIONS.find(w => w.id === wellId)?.name ?? wellId;

  return (
    <div className="p-6 space-y-6 bg-slate-950 min-h-screen text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingDown className="w-6 h-6 text-amber-400" />
            Production Forecasting
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Arps decline curve analysis · P10/P50/P90 Monte Carlo · EUR & NPV10 calculator
          </p>
        </div>
        <Badge variant="outline" className="border-amber-500/40 text-amber-400">
          Arps (1945) · Fetkovich (1980)
        </Badge>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Input Panel */}
        <Card className="bg-slate-900/60 border-slate-700 xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-white text-base">Decline Curve Parameters</CardTitle>
            <CardDescription className="text-slate-400">Configure Arps model inputs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-slate-300 text-xs">Well</Label>
              <Select value={wellId} onValueChange={setWellId}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {WELL_OPTIONS.map(w => (
                    <SelectItem key={w.id} value={w.id} className="text-white">{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-slate-300 text-xs">Forecast Name</Label>
              <Input
                value={forecastName}
                onChange={e => setForecastName(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
              />
            </div>

            <div>
              <Label className="text-slate-300 text-xs">Decline Type</Label>
              <Select value={declineType} onValueChange={(v: any) => setDeclineType(v)}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {DECLINE_TYPES.map(d => (
                    <SelectItem key={d.value} value={d.value} className="text-white">{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-slate-300 text-xs">Initial Rate (qi) — {qi} BOPD</Label>
              <Slider
                value={[qi]} onValueChange={([v]) => setQi(v)}
                min={10} max={5000} step={10}
                className="mt-2"
              />
            </div>

            <div>
              <Label className="text-slate-300 text-xs">Monthly Decline Rate (Di) — {(di * 100).toFixed(1)}%/month</Label>
              <Slider
                value={[di * 100]} onValueChange={([v]) => setDi(v / 100)}
                min={1} max={30} step={0.5}
                className="mt-2"
              />
            </div>

            {declineType === "hyperbolic" && (
              <div>
                <Label className="text-slate-300 text-xs">b-factor — {bFactor.toFixed(2)}</Label>
                <Slider
                  value={[bFactor * 100]} onValueChange={([v]) => setBFactor(v / 100)}
                  min={1} max={99} step={1}
                  className="mt-2"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300 text-xs">Forecast Years</Label>
                <Input
                  type="number" value={years} onChange={e => setYears(+e.target.value)}
                  min={1} max={50}
                  className="bg-slate-800 border-slate-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-300 text-xs">Oil Price ($/bbl)</Label>
                <Input
                  type="number" value={oilPrice} onChange={e => setOilPrice(+e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-300 text-xs">OPEX ($/bbl)</Label>
                <Input
                  type="number" value={opex} onChange={e => setOpex(+e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-300 text-xs">Discount Rate (%)</Label>
                <Input
                  type="number" value={discount} onChange={e => setDiscount(+e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white mt-1"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => handleCompute(false)}
                disabled={computeMutation.isPending}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
              >
                {computeMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <BarChart2 className="w-4 h-4 mr-2" />}
                Compute
              </Button>
              <Button
                onClick={() => handleCompute(true)}
                disabled={computeMutation.isPending}
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                <Save className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results Panel */}
        <div className="xl:col-span-2 space-y-4">
          {result ? (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="bg-slate-900/60 border-slate-700">
                  <CardContent className="pt-4">
                    <div className="text-xs text-slate-400">EUR (P50)</div>
                    <div className="text-xl font-bold text-amber-400 mt-1">
                      {(result.p50EurBbl / 1e6).toFixed(2)} MMbbl
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-slate-900/60 border-slate-700">
                  <CardContent className="pt-4">
                    <div className="text-xs text-slate-400">NPV10</div>
                    <div className="text-xl font-bold text-emerald-400 mt-1">
                      ${result.npv10M.toFixed(1)}M
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-slate-900/60 border-slate-700">
                  <CardContent className="pt-4">
                    <div className="text-xs text-slate-400">P10 EUR</div>
                    <div className="text-xl font-bold text-blue-400 mt-1">
                      {(result.p10EurBbl / 1e6).toFixed(2)} MMbbl
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-slate-900/60 border-slate-700">
                  <CardContent className="pt-4">
                    <div className="text-xs text-slate-400">P90 EUR</div>
                    <div className="text-xl font-bold text-orange-400 mt-1">
                      {(result.p90EurBbl / 1e6).toFixed(2)} MMbbl
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="decline">
                <TabsList className="bg-slate-800 border-slate-700">
                  <TabsTrigger value="decline" className="data-[state=active]:bg-amber-600">Decline Curve</TabsTrigger>
                  <TabsTrigger value="cumulative" className="data-[state=active]:bg-amber-600">Cumulative</TabsTrigger>
                  <TabsTrigger value="monte_carlo" className="data-[state=active]:bg-amber-600">P10/P50/P90</TabsTrigger>
                  <TabsTrigger value="cashflow" className="data-[state=active]:bg-amber-600">Cash Flow</TabsTrigger>
                </TabsList>

                <TabsContent value="decline">
                  <Card className="bg-slate-900/60 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white text-sm">Annual Rate Decline — {result.model}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={result.annualProfile}>
                          <defs>
                            <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="year" stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 11 }} label={{ value: "Year", position: "insideBottom", offset: -5, fill: "#94a3b8" }} />
                          <YAxis stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 11 }} label={{ value: "Rate (BOPD)", angle: -90, position: "insideLeft", fill: "#94a3b8" }} />
                          <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} labelStyle={{ color: "#f1f5f9" }} />
                          <Area type="monotone" dataKey="rateBopd" stroke="#f59e0b" fill="url(#rateGrad)" strokeWidth={2} name="Rate (BOPD)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="cumulative">
                  <Card className="bg-slate-900/60 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white text-sm">Cumulative Production</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={result.annualProfile}>
                          <defs>
                            <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="year" stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                          <YAxis stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={v => `${(v / 1e6).toFixed(1)}M`} />
                          <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} formatter={(v: any) => [`${(v / 1e6).toFixed(3)} MMbbl`, "Cumulative"]} />
                          <Area type="monotone" dataKey="cumulativeBbl" stroke="#10b981" fill="url(#cumGrad)" strokeWidth={2} name="Cumulative (bbl)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="monte_carlo">
                  <Card className="bg-slate-900/60 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white text-sm">Monte Carlo EUR Distribution (500 iterations)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        {[
                          { label: "P10 (Optimistic)", value: result.p10EurBbl, color: "text-blue-400" },
                          { label: "P50 (Base Case)", value: result.p50EurBbl, color: "text-amber-400" },
                          { label: "P90 (Conservative)", value: result.p90EurBbl, color: "text-orange-400" },
                        ].map(p => (
                          <div key={p.label} className="text-center p-3 bg-slate-800/60 rounded-lg border border-slate-700">
                            <div className={`text-xl font-bold ${p.color}`}>{(p.value / 1e6).toFixed(2)}</div>
                            <div className="text-xs text-slate-400 mt-1">MMbbl</div>
                            <div className="text-xs text-slate-500 mt-1">{p.label}</div>
                          </div>
                        ))}
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={[
                          { name: "P90", eur: result.p90EurBbl / 1e6, fill: "#f97316" },
                          { name: "P50", eur: result.p50EurBbl / 1e6, fill: "#f59e0b" },
                          { name: "Mean", eur: result.meanEurBbl / 1e6, fill: "#8b5cf6" },
                          { name: "P10", eur: result.p10EurBbl / 1e6, fill: "#3b82f6" },
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="name" stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                          <YAxis stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 11 }} label={{ value: "EUR (MMbbl)", angle: -90, position: "insideLeft", fill: "#94a3b8" }} />
                          <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} formatter={(v: any) => [`${v.toFixed(3)} MMbbl`]} />
                          <Bar dataKey="eur" name="EUR (MMbbl)">
                            {[{ fill: "#f97316" }, { fill: "#f59e0b" }, { fill: "#8b5cf6" }, { fill: "#3b82f6" }].map((entry, index) => (
                              <rect key={index} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="cashflow">
                  <Card className="bg-slate-900/60 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white text-sm">Annual Revenue & NPV Contribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={result.annualProfile}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="year" stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                          <YAxis stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 11 }} label={{ value: "USD (M)", angle: -90, position: "insideLeft", fill: "#94a3b8" }} />
                          <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} formatter={(v: any) => [`$${v.toFixed(2)}M`]} />
                          <Legend wrapperStyle={{ color: "#94a3b8" }} />
                          <Bar dataKey="revenueMUsd" name="Revenue ($M)" fill="#10b981" />
                          <Bar dataKey="npvContribMUsd" name="NPV10 Contrib ($M)" fill="#3b82f6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <Card className="bg-slate-900/60 border-slate-700 h-96 flex items-center justify-center">
              <div className="text-center text-slate-500">
                <TrendingDown className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Configure parameters and click Compute to generate forecast</p>
              </div>
            </Card>
          )}

          {/* Saved Forecasts */}
          {listQuery.data && listQuery.data.length > 0 && (
            <Card className="bg-slate-900/60 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-sm">Saved Forecasts — {wellName}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {listQuery.data.map(f => (
                    <div key={f.id} className="flex items-center justify-between p-3 bg-slate-800/60 rounded-lg border border-slate-700">
                      <div>
                        <div className="text-white text-sm font-medium">{f.forecastName}</div>
                        <div className="text-slate-400 text-xs">{f.declineType} · {f.forecastYears}yr · Di={((f.declineRateMonthly ?? 0) * 100).toFixed(1)}%/mo</div>
                      </div>
                      <div className="text-right">
                        <div className="text-amber-400 text-sm font-bold">{f.eurBbl ? `${(f.eurBbl / 1e6).toFixed(2)} MMbbl` : "—"}</div>
                        <div className="text-emerald-400 text-xs">{f.npv10M ? `NPV10: $${f.npv10M.toFixed(1)}M` : ""}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
