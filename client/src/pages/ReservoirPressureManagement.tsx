/**
 * ReservoirPressureManagement.tsx
 * Material balance, aquifer influx, pressure maintenance plan
 * References: Havlena-Odeh (1963), van Everdingen-Hurst (1949)
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
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { toast } from "sonner";
import { Gauge, RefreshCw, Calculator, Plus, Database } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";

const FIELD_OPTIONS = [
  { id: "AL-BURGAN", name: "Al-Burgan Field" },
  { id: "RAUDHATAIN", name: "Raudhatain Field" },
  { id: "SABRIYAH", name: "Sabriyah Field" },
  { id: "MINAGISH", name: "Minagish Field" },
];

export default function ReservoirPressureManagement() {
  const [fieldId, setFieldId] = useState("AL-BURGAN");
  const [piInitial, setPiInitial] = useState(4500);
  const [pCurrent, setPCurrent] = useState(3800);
  const [boi, setBoi] = useState(1.25);
  const [bgi, setBgi] = useState(0.0045);
  const [cf, setCf] = useState(1.5e-5);
  const [ooipMBbl, setOoipMBbl] = useState(500000);
  const [cumOilMBbl, setCumOilMBbl] = useState(50000);
  const [cumWaterMBbl, setCumWaterMBbl] = useState(5000);
  const [cumGasMmscf, setCumGasMmscf] = useState(20000);
  const [aquiferStrength, setAquiferStrength] = useState(0.3);
  const [mbParams, setMbParams] = useState<any>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newPressure, setNewPressure] = useState(3500);
  const [newMethod, setNewMethod] = useState<"BHP"|"RFT"|"MDT"|"DST"|"STATIC">("BHP");
  const [newDepth, setNewDepth] = useState(8000);
  const [newNotes, setNewNotes] = useState("");

  const recordsQuery = trpc.reservoirPressure.list.useQuery({ fieldId });
  const addRecord = trpc.reservoirPressure.addRecord.useMutation({
    onSuccess: () => {
      toast.success("Pressure record added");
      setAddOpen(false);
      recordsQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const mbQuery = trpc.reservoirPressure.materialBalance.useQuery(
    mbParams ?? { fieldId },
    { enabled: !!mbParams }
  );

  const pressureTrendQuery = trpc.reservoirPressure.pressureTrend.useQuery({ fieldId });

  const handleCompute = () => {
    setMbParams({
      fieldId,
      initialPressurePsia: piInitial,
      currentPressurePsia: pCurrent,
      oilFvfRbPerStb: boi,
      gasFvfRbPerMscf: bgi,
      totalCompressibilityPerPsi: cf,
      poreVolumeMBbl: ooipMBbl,
      cumulativeOilMBbl: cumOilMBbl,
      cumulativeWaterMBbl: cumWaterMBbl,
      cumulativeGasMmscf: cumGasMmscf,
      waterInfluxMBbl: Math.round(aquiferStrength * cumOilMBbl * 0.5),
    });
  };

  const data = mbQuery.data;

  // Build drive index chart data
  const driveData = data ? [
    { name: "Solution Gas", value: Math.round(((data.recoveryFactorPct ?? 20) / 100) * 40), fill: "#f59e0b" },
    { name: "Water Influx", value: Math.round(aquiferStrength * 100), fill: "#3b82f6" },
    { name: "Rock/Fluid Exp.", value: Math.round(cf * 1e5 * 10), fill: "#8b5cf6" },
    { name: "Gas Cap", value: 10, fill: "#10b981" },
  ] : [];

  return (
    <div className="p-6 space-y-6 bg-slate-950 min-h-screen text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Gauge className="w-6 h-6 text-cyan-400" />
            Reservoir Pressure Management
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Material balance · Aquifer influx · Pressure maintenance · Havlena-Odeh (1963)
          </p>
        </div>
        <Badge variant="outline" className="border-cyan-500/40 text-cyan-400">
          van Everdingen-Hurst Aquifer
        </Badge>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Input Panel */}
        <Card className="bg-slate-900/60 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-base">Material Balance Inputs</CardTitle>
            <CardDescription className="text-slate-400">Havlena-Odeh reservoir parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-slate-300 text-xs">Field</Label>
              <Select value={fieldId} onValueChange={setFieldId}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {FIELD_OPTIONS.map(f => (
                    <SelectItem key={f.id} value={f.id} className="text-white">{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300 text-xs">Pi (psia)</Label>
                <Input type="number" value={piInitial} onChange={e => setPiInitial(+e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white mt-1" />
              </div>
              <div>
                <Label className="text-slate-300 text-xs">P current (psia)</Label>
                <Input type="number" value={pCurrent} onChange={e => setPCurrent(+e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white mt-1" />
              </div>
              <div>
                <Label className="text-slate-300 text-xs">Boi (RB/STB)</Label>
                <Input type="number" step="0.001" value={boi} onChange={e => setBoi(+e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white mt-1" />
              </div>
              <div>
                <Label className="text-slate-300 text-xs">Bgi (RB/Mscf)</Label>
                <Input type="number" step="0.0001" value={bgi} onChange={e => setBgi(+e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white mt-1" />
              </div>
              <div>
                <Label className="text-slate-300 text-xs">Pore Volume (MBbl)</Label>
                <Input type="number" value={ooipMBbl} onChange={e => setOoipMBbl(+e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white mt-1" />
              </div>
              <div>
                <Label className="text-slate-300 text-xs">Cum. Oil (MBbl)</Label>
                <Input type="number" value={cumOilMBbl} onChange={e => setCumOilMBbl(+e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white mt-1" />
              </div>
              <div>
                <Label className="text-slate-300 text-xs">Cum. Water (MBbl)</Label>
                <Input type="number" value={cumWaterMBbl} onChange={e => setCumWaterMBbl(+e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white mt-1" />
              </div>
              <div>
                <Label className="text-slate-300 text-xs">Cum. Gas (MMscf)</Label>
                <Input type="number" value={cumGasMmscf} onChange={e => setCumGasMmscf(+e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white mt-1" />
              </div>
            </div>

            <div>
              <Label className="text-slate-300 text-xs">Aquifer Strength — {(aquiferStrength * 100).toFixed(0)}%</Label>
              <Slider
                value={[aquiferStrength * 100]}
                onValueChange={([v]) => setAquiferStrength(v / 100)}
                min={0} max={100} step={5}
                className="mt-2"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>No aquifer</span>
                <span>Strong aquifer</span>
              </div>
            </div>

            <Button
              onClick={handleCompute}
              disabled={mbQuery.isFetching}
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              {mbQuery.isFetching
                ? <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                : <Calculator className="w-4 h-4 mr-2" />}
              Compute Material Balance
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="xl:col-span-2 space-y-4">
          {data ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "Pressure Decline", value: `${data.pressureDeclinePct?.toFixed(1)}%`, color: "text-red-400" },
                  { label: "Recovery Factor", value: `${data.recoveryFactorPct?.toFixed(1)}%`, color: "text-emerald-400" },
                  { label: "OOIP", value: `${data.ooipMMBbl?.toFixed(1)} MMbbl`, color: "text-cyan-400" },
                  { label: "Aquifer Influx", value: `${data.aquiferInfluxEstimateMBbl?.toFixed(0)} MBbl`, color: "text-blue-400" },
                ].map(kpi => (
                  <Card key={kpi.label} className="bg-slate-900/60 border-slate-700">
                    <CardContent className="pt-4">
                      <div className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</div>
                      <div className="text-xs text-slate-400 mt-1">{kpi.label}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Tabs defaultValue="maintenance">
                <TabsList className="bg-slate-800 border-slate-700">
                  <TabsTrigger value="maintenance" className="data-[state=active]:bg-cyan-600">Maintenance Plan</TabsTrigger>
                  <TabsTrigger value="drive_indices" className="data-[state=active]:bg-cyan-600">Drive Indices</TabsTrigger>
                  <TabsTrigger value="trend" className="data-[state=active]:bg-cyan-600">Pressure Trend</TabsTrigger>
                  <TabsTrigger value="records" className="data-[state=active]:bg-cyan-600">Historical Records</TabsTrigger>
                </TabsList>

                <TabsContent value="maintenance">
                  <Card className="bg-slate-900/60 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white text-sm">Pressure Maintenance Recommendation</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="p-4 rounded-lg bg-slate-800/60 border border-cyan-500/30">
                        <p className="text-slate-200 text-sm leading-relaxed">{data.maintenancePlan}</p>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700">
                          <div className="text-xs text-slate-400">Underground Withdrawal</div>
                          <div className="text-lg font-bold text-white mt-1">{data.undergroundWithdrawalMBbl?.toLocaleString()} MBbl</div>
                        </div>
                        <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700">
                          <div className="text-xs text-slate-400">Voidage Replacement Ratio</div>
                          <div className={`text-lg font-bold mt-1 ${(data.voidageReplacementRatio ?? 0) >= 1 ? "text-emerald-400" : "text-red-400"}`}>
                            {data.voidageReplacementRatio?.toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-slate-500">{data.model}</div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="drive_indices">
                  <Card className="bg-slate-900/60 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white text-sm">Drive Mechanism Indices (Estimated)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={driveData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis type="number" stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 11 }} unit="%" />
                          <YAxis type="category" dataKey="name" stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 11 }} width={120} />
                          <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} formatter={(v: any) => [`${v}%`]} />
                          <Bar dataKey="value" name="Drive Index (%)" radius={[0, 4, 4, 0]}>
                            {driveData.map((entry, index) => (
                              <rect key={index} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="trend">
                  <Card className="bg-slate-900/60 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white text-sm">Reservoir Pressure History</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {pressureTrendQuery.data?.trend && pressureTrendQuery.data.trend.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <LineChart data={pressureTrendQuery.data.trend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="date" stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                            <YAxis stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                            <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
                            <Line type="monotone" dataKey="pressurePsia" stroke="#06b6d4" strokeWidth={2} dot={{ r: 4 }} name="Pressure (psia)" />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="text-center py-12 text-slate-500 text-sm">
                          No pressure history records yet. Add records via the Reservoir Pressure API.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="records">
                  <Card className="bg-slate-900/60 border-slate-700">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-white text-sm">Measured Pressure Records</CardTitle>
                      <Dialog open={addOpen} onOpenChange={setAddOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white">
                            <Plus className="w-3 h-3 mr-1" />Add Record
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-slate-900 border-slate-700 text-white">
                          <DialogHeader><DialogTitle>Add Pressure Measurement</DialogTitle></DialogHeader>
                          <div className="space-y-3">
                            <div><Label className="text-slate-300 text-xs">Date</Label>
                              <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="bg-slate-800 border-slate-600 text-white mt-1" /></div>
                            <div><Label className="text-slate-300 text-xs">Measured Pressure (psia)</Label>
                              <Input type="number" value={newPressure} onChange={e => setNewPressure(+e.target.value)} className="bg-slate-800 border-slate-600 text-white mt-1" /></div>
                            <div><Label className="text-slate-300 text-xs">Method</Label>
                              <Select value={newMethod} onValueChange={(v: any) => setNewMethod(v)}>
                                <SelectTrigger className="bg-slate-800 border-slate-600 text-white mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-600">
                                  {["BHP","RFT","MDT","DST","STATIC"].map(m => <SelectItem key={m} value={m} className="text-white">{m}</SelectItem>)}
                                </SelectContent>
                              </Select></div>
                            <div><Label className="text-slate-300 text-xs">Depth (ft)</Label>
                              <Input type="number" value={newDepth} onChange={e => setNewDepth(+e.target.value)} className="bg-slate-800 border-slate-600 text-white mt-1" /></div>
                            <div><Label className="text-slate-300 text-xs">Notes</Label>
                              <Input value={newNotes} onChange={e => setNewNotes(e.target.value)} className="bg-slate-800 border-slate-600 text-white mt-1" /></div>
                            <Button onClick={() => addRecord.mutate({ fieldId, recordDate: newDate, measuredPressurePsia: newPressure, measurementMethod: newMethod, depthFt: newDepth, notes: newNotes || undefined })}
                              disabled={!newDate || addRecord.isPending} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white">
                              {addRecord.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}Save Record
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </CardHeader>
                    <CardContent>
                      {recordsQuery.data && recordsQuery.data.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead><tr className="border-b border-slate-700">
                              <th className="text-left py-2 px-3 text-slate-400 font-medium">Date</th>
                              <th className="text-right py-2 px-3 text-slate-400 font-medium">Pressure (psia)</th>
                              <th className="text-center py-2 px-3 text-slate-400 font-medium">Method</th>
                              <th className="text-right py-2 px-3 text-slate-400 font-medium">Depth (ft)</th>
                              <th className="text-left py-2 px-3 text-slate-400 font-medium">Notes</th>
                            </tr></thead>
                            <tbody>
                              {(recordsQuery.data as any[]).map((r: any) => (
                                <tr key={r.id} className="border-b border-slate-800 hover:bg-slate-800/40">
                                  <td className="py-2 px-3 text-slate-300">{format(new Date(r.recordDate), "MMM d, yyyy")}</td>
                                  <td className="py-2 px-3 text-right font-mono text-cyan-400">{r.measuredPressurePsia?.toLocaleString()}</td>
                                  <td className="py-2 px-3 text-center"><span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300">{r.measurementMethod}</span></td>
                                  <td className="py-2 px-3 text-right text-slate-300">{r.depthFt?.toLocaleString() ?? "—"}</td>
                                  <td className="py-2 px-3 text-slate-400 text-xs">{r.notes ?? "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-10 text-slate-500">
                          <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No pressure records yet. Add the first measurement above.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <Card className="bg-slate-900/60 border-slate-700 h-80 flex items-center justify-center">
              <div className="text-center text-slate-500">
                <Gauge className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Configure parameters and compute material balance</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
