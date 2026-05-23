import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Activity, Globe, Shield, AlertTriangle, TrendingUp, TrendingDown,
  Building2, Zap, Play, BarChart3, Target, Clock,
} from "lucide-react";

// ── Pre-built Nigerian regulatory scenarios ─────────────────────────────────

const SCENARIOS = [
  {
    id: "sla_tighten",
    name: "Tighten Breach Notification SLA",
    description: "NDPC proposes reducing breach notification window from 72 to 24 hours, aligned with EU GDPR standards. What happens to compliance rates and penalties?",
    realWorldContext: "In March 2025, NDPC issued a directive requiring faster breach reporting after the Flutterwave cross-border data leak exposed 8,500 records. This scenario simulates the impact of enforcing the new timeline across all sectors.",
    defaults: { breach_sla_hours: 24, penalty_multiplier: 1.0, compliance_threshold: 70 },
    duration: 12,
  },
  {
    id: "double_penalties",
    name: "Double Enforcement Penalties",
    description: "NITDA doubles maximum fines for non-compliance from ₦10M to ₦20M per violation, with sector-specific multipliers for banking and telecom.",
    realWorldContext: "Following the MTN Nigeria SIM swap fraud breach affecting 450 subscribers, the National Assembly proposed increasing NDPA penalties to match the scale of harm. This scenario models the deterrent effect on breach rates and compliance investment.",
    defaults: { breach_sla_hours: 72, penalty_multiplier: 2.0, compliance_threshold: 70 },
    duration: 12,
  },
  {
    id: "education_crackdown",
    name: "Education Sector Compliance Crackdown",
    description: "NDPC mandates that all EdTech platforms processing children's data must achieve 75% compliance within 6 months or face license suspension.",
    realWorldContext: "With 60 EdTech organizations scoring only 55.2% average compliance and an 18% annual breach rate — the highest of any sector — student data is the most vulnerable. This scenario simulates targeted enforcement on education.",
    defaults: { breach_sla_hours: 48, penalty_multiplier: 3.0, compliance_threshold: 75 },
    duration: 6,
  },
];

function formatNGN(amount: number): string {
  if (Math.abs(amount) >= 1_000_000_000) return `₦${(amount / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(amount) >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1_000) return `₦${(amount / 1_000).toFixed(0)}K`;
  return `₦${amount.toFixed(0)}`;
}

function riskBadge(level: string) {
  const colors: Record<string, string> = {
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
    high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    low: "bg-green-500/20 text-green-400 border-green-500/30",
  };
  return <Badge className={colors[level] ?? ""}>{level.toUpperCase()}</Badge>;
}

// ── Ecosystem Overview Tab ──────────────────────────────────────────────────

function EcosystemTab() {
  const state = trpc.platformIntelligence.twinState.useQuery();
  const d = state.data as Record<string, unknown> | undefined;
  const sectors = (d?.sectors as Array<Record<string, unknown>>) ?? [];
  const flows = (d?.data_flows as Array<Record<string, unknown>>) ?? [];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-blue-400 mb-1"><Building2 className="h-4 w-4" /><span className="text-xs font-medium uppercase tracking-wide">Organizations</span></div>
            <p className="text-3xl font-bold">{d?.total_organizations as number ?? "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">Across 6 sectors</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-green-400 mb-1"><Shield className="h-4 w-4" /><span className="text-xs font-medium uppercase tracking-wide">Avg Compliance</span></div>
            <p className="text-3xl font-bold">{(d?.avg_compliance_score as number)?.toFixed(1) ?? "—"}%</p>
            <p className="text-xs text-muted-foreground mt-1">Weighted by org count</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-purple-400 mb-1"><Activity className="h-4 w-4" /><span className="text-xs font-medium uppercase tracking-wide">Data Flows</span></div>
            <p className="text-3xl font-bold">{d?.total_data_flows as number ?? "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">Active routes tracked</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-amber-400 mb-1"><Globe className="h-4 w-4" /><span className="text-xs font-medium uppercase tracking-wide">Cross-Border</span></div>
            <p className="text-3xl font-bold">{(d?.cross_border_flows as number)?.toLocaleString() ?? "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">International transfers</p>
          </CardContent>
        </Card>
      </div>

      {/* Sector Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><BarChart3 className="h-5 w-5" />Sector Compliance Overview</CardTitle>
          <CardDescription>Current compliance scores and breach rates across Nigeria's regulated sectors</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sectors.map((s, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.name as string}</span>
                    <Badge variant="outline" className="text-xs">{s.organizations as number} orgs</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">{((s.breach_rate_annual as number) * 100).toFixed(0)}% breach rate</span>
                    <span className="font-semibold">{(s.avg_compliance_score as number).toFixed(1)}%</span>
                  </div>
                </div>
                <Progress value={s.avg_compliance_score as number} className="h-2" />
                <div className="flex gap-1.5 flex-wrap">
                  {(s.risk_factors as string[])?.map((rf, j) => (
                    <Badge key={j} variant="secondary" className="text-xs">{rf}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Data Flow Map */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Globe className="h-5 w-5" />Active Data Flows</CardTitle>
          <CardDescription>Real-time data transfer routes — domestic and cross-border</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Volume</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Encrypted</TableHead>
                <TableHead>Cross-Border</TableHead>
                <TableHead>Compliant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flows.map((f, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{f.source as string}</TableCell>
                  <TableCell>{f.destination as string}</TableCell>
                  <TableCell>{(f.volume_gb_per_month as number).toFixed(0)} GB/mo</TableCell>
                  <TableCell><Badge variant="outline">{f.sector as string}</Badge></TableCell>
                  <TableCell>{(f.encrypted as boolean) ? <Badge className="bg-green-500/20 text-green-400">✓</Badge> : <Badge className="bg-red-500/20 text-red-400">✗</Badge>}</TableCell>
                  <TableCell>{(f.cross_border as boolean) ? <Badge className="bg-amber-500/20 text-amber-400">Int'l</Badge> : <span className="text-muted-foreground">Domestic</span>}</TableCell>
                  <TableCell>{(f.compliant as boolean) ? <Badge className="bg-green-500/20 text-green-400">✓</Badge> : <Badge className="bg-red-500/20 text-red-400">Non-Compliant</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Scenario Simulator Tab ──────────────────────────────────────────────────

function SimulatorTab() {
  const [selectedScenario, setSelectedScenario] = useState(0);
  const scenario = SCENARIOS[selectedScenario];
  const [slaHours, setSlaHours] = useState(scenario.defaults.breach_sla_hours);
  const [penaltyMult, setPenaltyMult] = useState(scenario.defaults.penalty_multiplier);
  const [threshold, setThreshold] = useState(scenario.defaults.compliance_threshold);
  const [duration, setDuration] = useState(scenario.duration);

  const simulate = trpc.platformIntelligence.twinSimulate.useMutation();

  const handleSelectScenario = (idx: number) => {
    setSelectedScenario(idx);
    const s = SCENARIOS[idx];
    setSlaHours(s.defaults.breach_sla_hours);
    setPenaltyMult(s.defaults.penalty_multiplier);
    setThreshold(s.defaults.compliance_threshold);
    setDuration(s.duration);
  };

  const runSimulation = () => {
    simulate.mutate({
      scenario: scenario.name,
      parameters: { breach_sla_hours: slaHours, penalty_multiplier: penaltyMult, compliance_threshold: threshold },
      durationMonths: duration,
    });
  };

  const result = simulate.data as Record<string, unknown> | undefined;
  const timeline = (result?.timeline as Array<Record<string, unknown>>) ?? [];
  const impacts = (result?.sector_impacts as Record<string, Record<string, unknown>>) ?? {};
  const recommendations = (result?.recommendations as string[]) ?? [];

  const complianceTrend = useMemo(() => {
    if (timeline.length === 0) return null;
    const first = timeline[0].avg_compliance as number;
    const last = timeline[timeline.length - 1].avg_compliance as number;
    return { start: first, end: last, delta: last - first };
  }, [timeline]);

  return (
    <div className="space-y-6">
      {/* Scenario Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {SCENARIOS.map((s, i) => (
          <Card
            key={s.id}
            className={`cursor-pointer transition-all hover:border-primary/50 ${selectedScenario === i ? "border-primary ring-1 ring-primary/30" : ""}`}
            onClick={() => handleSelectScenario(i)}
          >
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-2">
                {i === 0 ? <Clock className="h-4 w-4 text-blue-400" /> : i === 1 ? <Zap className="h-4 w-4 text-amber-400" /> : <Target className="h-4 w-4 text-red-400" />}
                <span className="font-semibold text-sm">{s.name}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Real-World Context */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="pt-4 pb-3 px-4">
          <p className="text-sm font-medium text-blue-400 mb-1">Real-World Context</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{scenario.realWorldContext}</p>
        </CardContent>
      </Card>

      {/* Parameter Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Simulation Parameters</CardTitle>
          <CardDescription>Adjust the parameters and run the what-if analysis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Breach Notification SLA: <span className="text-primary">{slaHours} hours</span></label>
              <Slider value={[slaHours]} onValueChange={(v) => setSlaHours(v[0])} min={6} max={96} step={6} />
              <div className="flex justify-between text-xs text-muted-foreground"><span>6h (strict)</span><span>72h (current NDPA)</span><span>96h (relaxed)</span></div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Penalty Multiplier: <span className="text-primary">{penaltyMult.toFixed(1)}×</span></label>
              <Slider value={[penaltyMult * 10]} onValueChange={(v) => setPenaltyMult(v[0] / 10)} min={5} max={50} step={5} />
              <div className="flex justify-between text-xs text-muted-foreground"><span>0.5× (reduced)</span><span>1× (current)</span><span>5× (severe)</span></div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Compliance Threshold: <span className="text-primary">{threshold}%</span></label>
              <Slider value={[threshold]} onValueChange={(v) => setThreshold(v[0])} min={50} max={95} step={5} />
              <div className="flex justify-between text-xs text-muted-foreground"><span>50% (lenient)</span><span>70% (current)</span><span>95% (strict)</span></div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Simulation Duration: <span className="text-primary">{duration} months</span></label>
              <Slider value={[duration]} onValueChange={(v) => setDuration(v[0])} min={3} max={24} step={3} />
              <div className="flex justify-between text-xs text-muted-foreground"><span>3 months</span><span>12 months</span><span>24 months</span></div>
            </div>
          </div>
          <Button onClick={runSimulation} disabled={simulate.isPending} className="w-full" size="lg">
            <Play className="h-4 w-4 mr-2" />
            {simulate.isPending ? "Running Simulation..." : "Run What-If Simulation"}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Compliance Change</p>
                <div className="flex items-center gap-2 mt-1">
                  {complianceTrend && complianceTrend.delta > 0 ? <TrendingUp className="h-5 w-5 text-green-400" /> : <TrendingDown className="h-5 w-5 text-red-400" />}
                  <span className="text-2xl font-bold">{complianceTrend ? (complianceTrend.delta > 0 ? "+" : "") + complianceTrend.delta.toFixed(1) + "%" : "—"}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{complianceTrend ? `${complianceTrend.start.toFixed(1)}% → ${complianceTrend.end.toFixed(1)}%` : ""}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Penalty Impact</p>
                <p className="text-2xl font-bold mt-1">{formatNGN(result.penalty_delta_ngn as number)}</p>
                <p className="text-xs text-muted-foreground mt-1">Total penalty change</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Breach Change</p>
                <p className="text-2xl font-bold mt-1">{(result.breach_delta_percent as number)?.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-1">vs baseline rate</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Duration</p>
                <p className="text-2xl font-bold mt-1">{result.duration_months as number} mo</p>
                <p className="text-xs text-muted-foreground mt-1">Simulation period</p>
              </CardContent>
            </Card>
          </div>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Monthly Timeline</CardTitle>
              <CardDescription>Projected compliance, breaches, and penalties month-by-month</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Avg Compliance</TableHead>
                    <TableHead>Breaches</TableHead>
                    <TableHead>Penalties</TableHead>
                    <TableHead>Cross-Border Flows</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeline.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">Month {t.month as number}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={t.avg_compliance as number} className="h-1.5 w-16" />
                          <span>{(t.avg_compliance as number).toFixed(1)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={((t.breach_count as number) > 20) ? "destructive" : "secondary"}>
                          {t.breach_count as number}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatNGN(t.total_penalties_ngn as number)}</TableCell>
                      <TableCell>{(t.cross_border_flows as number).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Sector Impacts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sector-by-Sector Impact Analysis</CardTitle>
              <CardDescription>How each sector is affected by the policy change</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(impacts).map(([name, impact]) => (
                  <Card key={name} className="bg-card/50">
                    <CardContent className="pt-4 pb-3 px-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold">{name}</span>
                        {riskBadge(impact.risk_level as string)}
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Compliance Δ</span>
                          <span className={((impact.compliance_delta as number) > 0) ? "text-green-400" : "text-red-400"}>
                            {(impact.compliance_delta as number) > 0 ? "+" : ""}{(impact.compliance_delta as number).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Penalty Δ</span>
                          <span>{formatNGN(impact.penalty_delta_ngn as number)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Breach Δ</span>
                          <span className={((impact.breach_delta_percent as number) < 0) ? "text-green-400" : "text-red-400"}>
                            {(impact.breach_delta_percent as number).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <Card className="border-amber-500/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-400" />AI Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-amber-400 mt-0.5">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ── Breach Predictions Tab ──────────────────────────────────────────────────

function PredictionsTab() {
  const predictions = trpc.platformIntelligence.twinPredictBreaches.useQuery();
  const d = predictions.data as Record<string, unknown> | undefined;
  const list = (d?.predictions as Array<Record<string, unknown>>) ?? [];

  const sortedByRisk = useMemo(() => {
    return [...list].sort((a, b) => (b.probability_30d as number) - (a.probability_30d as number));
  }, [list]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><AlertTriangle className="h-5 w-5" />Breach Probability Predictions</CardTitle>
          <CardDescription>ML-generated risk forecast for the next 30 and 90 days across {list.length} organizations. Based on historical breach patterns, compliance scores, and sector risk factors.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>30-Day Risk</TableHead>
                <TableHead>90-Day Risk</TableHead>
                <TableHead>Top Risk Factors</TableHead>
                <TableHead>Recommended Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedByRisk.slice(0, 20).map((p, i) => {
                const p30 = p.probability_30d as number;
                const p90 = p.probability_90d as number;
                return (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{p.org_name as string}</TableCell>
                    <TableCell><Badge variant="outline">{p.sector as string}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={p30} className={`h-1.5 w-12 ${p30 > 5 ? "[&>div]:bg-red-500" : p30 > 2 ? "[&>div]:bg-amber-500" : "[&>div]:bg-green-500"}`} />
                        <span className={`text-sm font-medium ${p30 > 5 ? "text-red-400" : p30 > 2 ? "text-amber-400" : "text-green-400"}`}>{p30.toFixed(1)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={p90} className={`h-1.5 w-12 ${p90 > 10 ? "[&>div]:bg-red-500" : p90 > 5 ? "[&>div]:bg-amber-500" : "[&>div]:bg-green-500"}`} />
                        <span className="text-sm">{p90.toFixed(1)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {(p.top_risk_factors as string[])?.slice(0, 2).map((rf, j) => (
                          <Badge key={j} variant="secondary" className="text-xs">{rf}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs ${(p.recommended_action as string).includes("Immediate") ? "text-red-400 font-medium" : (p.recommended_action as string).includes("Schedule") ? "text-amber-400" : "text-muted-foreground"}`}>
                        {p.recommended_action as string}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Simulation History Tab ──────────────────────────────────────────────────

function HistoryTab() {
  const history = trpc.platformIntelligence.twinHistory.useQuery();
  const d = history.data as Record<string, unknown> | undefined;
  const sims = (d?.simulations as Array<Record<string, unknown>>) ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Simulation History</CardTitle>
          <CardDescription>Previously run what-if scenarios and their results</CardDescription>
        </CardHeader>
        <CardContent>
          {sims.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No simulations run yet. Go to the Scenario Simulator tab to run your first what-if analysis.</p>
          ) : (
            <div className="space-y-4">
              {sims.map((sim, i) => (
                <Card key={i} className="bg-card/50">
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">{sim.scenario as string}</span>
                      <span className="text-xs text-muted-foreground">{sim.simulated_at as string}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Compliance Δ: </span>
                        <span className={((sim.overall_compliance as number) > 0) ? "text-green-400" : "text-red-400"}>
                          {(sim.overall_compliance as number) > 0 ? "+" : ""}{(sim.overall_compliance as number)?.toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Duration: </span>
                        <span>{sim.duration_months as number} months</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Breach Δ: </span>
                        <span>{(sim.breach_delta_percent as number)?.toFixed(1)}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function DigitalTwinPage() {
  const [tab, setTab] = useState("ecosystem");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Digital Twin</h1>
        <p className="text-muted-foreground mt-1">
          Live simulation of Nigeria's data protection ecosystem — run what-if scenarios, predict breaches, and model regulatory impact across 6 sectors and 198 organizations
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ecosystem">Ecosystem Overview</TabsTrigger>
          <TabsTrigger value="simulator">Scenario Simulator</TabsTrigger>
          <TabsTrigger value="predictions">Breach Predictions</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="ecosystem"><EcosystemTab /></TabsContent>
        <TabsContent value="simulator"><SimulatorTab /></TabsContent>
        <TabsContent value="predictions"><PredictionsTab /></TabsContent>
        <TabsContent value="history"><HistoryTab /></TabsContent>
      </Tabs>
    </div>
  );
}
