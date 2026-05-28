import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BarChart3, FlaskConical, Leaf, Camera, RefreshCw, Plus, Play, CheckCircle } from "lucide-react";

type OpsTab = "allocation" | "reservoir" | "emissions" | "drone";

const STATUS_COLORS: Record<string, string> = {
  active: "text-green-400 border-green-500/30",
  inactive: "text-zinc-400 border-zinc-700",
  queued: "text-yellow-400 border-yellow-500/30",
  running: "text-blue-400 border-blue-500/30",
  completed: "text-green-400 border-green-500/30",
  failed: "text-red-400 border-red-500/30",
  scheduled: "text-yellow-400 border-yellow-500/30",
  in_progress: "text-blue-400 border-blue-500/30",
  open: "text-orange-400 border-orange-500/30",
  unverified: "text-zinc-400 border-zinc-700",
  verified: "text-green-400 border-green-500/30",
  disputed: "text-red-400 border-red-500/30",
};

export default function OperationsPage() {
  const [activeTab, setActiveTab] = useState<OpsTab>("allocation");

  const { data: allocationRules, refetch: refetchRules } = trpc.operations.listAllocationRules.useQuery();
  const { data: allocatedProd, refetch: refetchAlloc } = trpc.operations.listAllocatedProduction.useQuery();
  const { data: simulations, refetch: refetchSims } = trpc.operations.listSimulations.useQuery();
  const { data: emissionSources, refetch: refetchSources } = trpc.operations.listEmissionSources.useQuery();
  const { data: emissionRecords, refetch: refetchRecords } = trpc.operations.listEmissionRecords.useQuery();
  const { data: emissionsSummary } = trpc.operations.getEmissionsSummary.useQuery();
  const { data: carbonTargets } = trpc.operations.listCarbonTargets.useQuery();
  const { data: droneInspections, refetch: refetchDrones } = trpc.operations.listDroneInspections.useQuery();
  const { data: droneSummary } = trpc.operations.getDroneInspectionSummary.useQuery();

  const createRuleMutation = trpc.operations.createAllocationRule.useMutation({
    onSuccess: () => { toast.success("Allocation rule created"); refetchRules(); },
  });

  const runAllocationMutation = trpc.operations.runAllocation.useMutation({
    onSuccess: (data) => { toast.success(`Allocation run: ${data.allocated.length} records`); refetchAlloc(); },
  });

  const submitSimMutation = trpc.operations.submitSimulation.useMutation({
    onSuccess: () => { toast.success("Simulation submitted"); refetchSims(); },
  });

  const createSourceMutation = trpc.operations.createEmissionSource.useMutation({
    onSuccess: () => { toast.success("Emission source created"); refetchSources(); },
  });

  const scheduleDroneMutation = trpc.operations.scheduleDroneInspection.useMutation({
    onSuccess: () => { toast.success("Drone inspection scheduled"); refetchDrones(); },
  });

  const updateDroneMutation = trpc.operations.updateDroneInspection.useMutation({
    onSuccess: () => { toast.success("Inspection updated"); refetchDrones(); },
  });

  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [activeUploadInspId, setActiveUploadInspId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDroneUpload = async (inspectionId: string, files: FileList) => {
    setUploadingFor(inspectionId);
    try {
      const formData = new FormData();
      Array.from(files).forEach(f => formData.append("files", f));
      formData.append("inspectionId", inspectionId);
      const res = await fetch("/api/drone/upload-multiple", { method: "POST", body: formData, credentials: "include" });
      const result = await res.json() as { success?: boolean; uploaded?: number; error?: string };
      if (result.success) {
        toast.success(`${result.uploaded} file(s) uploaded successfully`);
        refetchDrones();
      } else {
        toast.error(result.error ?? "Upload failed");
      }
    } catch (err) {
      toast.error("Upload failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setUploadingFor(null);
      setActiveUploadInspId(null);
    }
  };

  const tabs = [
    { id: "allocation" as const, label: "Production Allocation", icon: BarChart3 },
    { id: "reservoir" as const, label: "Reservoir Simulation", icon: FlaskConical },
    { id: "emissions" as const, label: "Emissions & Carbon", icon: Leaf },
    { id: "drone" as const, label: "Drone Inspection", icon: Camera },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-7 h-7 text-amber-400" />
              Operations Management
            </h1>
            <p className="text-zinc-400 text-sm mt-1">Production Allocation · Reservoir Simulation · Emissions/Carbon · Drone Inspection</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { refetchRules(); refetchSims(); refetchSources(); refetchDrones(); }}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-900 p-1 rounded-lg flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id ? "bg-amber-600 text-white" : "text-zinc-400 hover:text-white"}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Production Allocation */}
        {activeTab === "allocation" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Rules */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-white">Allocation Rules ({allocationRules?.length ?? 0})</h2>
                  <Button size="sm" onClick={() => createRuleMutation.mutate({
                    name: `Rule-${Date.now()}`,
                    fieldId: "FIELD-001",
                    method: "well_test_ratio",
                    effectiveFrom: new Date(),
                  })} disabled={createRuleMutation.isPending}>
                    <Plus className="w-4 h-4 mr-1" /> Add Rule
                  </Button>
                </div>
                {allocationRules?.length === 0 ? (
                  <div className="text-zinc-500 text-sm p-6 text-center bg-zinc-900 rounded-lg">No allocation rules yet.</div>
                ) : (
                  <div className="space-y-2">
                    {allocationRules?.map((rule) => (
                      <div key={rule.id} className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-white">{rule.name}</div>
                            <div className="text-xs text-zinc-500">Field: {rule.fieldId} · Method: {rule.method}</div>
                            <div className="text-xs text-zinc-500">
                              Oil: {rule.oilAllocationBbl ?? "—"} bbl · Gas: {rule.gasAllocationMcf ?? "—"} Mcf
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant="outline" className={`text-xs ${rule.isActive ? STATUS_COLORS.active : STATUS_COLORS.inactive}`}>
                              {rule.isActive ? "active" : "inactive"}
                            </Badge>
                            <Button size="sm" variant="outline" className="text-xs h-6" onClick={() => runAllocationMutation.mutate({ ruleId: rule.ruleId, allocationDate: new Date() })} disabled={runAllocationMutation.isPending}>
                              <Play className="w-3 h-3 mr-1" /> Run
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Allocated Production */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">Allocated Production ({allocatedProd?.length ?? 0})</h2>
                {allocatedProd?.length === 0 ? (
                  <div className="text-zinc-500 text-sm p-6 text-center bg-zinc-900 rounded-lg">No allocated production. Run an allocation rule to generate records.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-zinc-500 border-b border-zinc-800">
                          <th className="text-left py-2 pr-3">Date</th>
                          <th className="text-left pr-3">Well</th>
                          <th className="text-right pr-3">Oil (bbl)</th>
                          <th className="text-right pr-3">Gas (Mcf)</th>
                          <th className="text-right">Finalized</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allocatedProd?.slice(0, 10).map((ap) => (
                          <tr key={ap.id} className="border-b border-zinc-800/50 text-white">
                            <td className="py-2 pr-3 text-zinc-400">{new Date(ap.allocationDate).toLocaleDateString()}</td>
                            <td className="pr-3 font-mono text-amber-400">{ap.wellId}</td>
                            <td className="text-right pr-3">{ap.allocatedOilBbl?.toFixed(1) ?? "—"}</td>
                            <td className="text-right pr-3">{ap.allocatedGasMcf?.toFixed(1) ?? "—"}</td>
                            <td className="text-right">
                              {ap.isFinalized ? <CheckCircle className="w-3 h-3 text-green-400 ml-auto" /> : <span className="text-zinc-500">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Reservoir Simulation */}
        {activeTab === "reservoir" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Reservoir Simulations ({simulations?.length ?? 0})</h2>
              <Button size="sm" onClick={() => submitSimMutation.mutate({
                name: `Sim-${Date.now()}`,
                simulator: "opm_flow",
                fieldId: "FIELD-001",
              })} disabled={submitSimMutation.isPending}>
                <Plus className="w-4 h-4 mr-1" /> Submit Simulation
              </Button>
            </div>
            {simulations?.length === 0 ? (
              <div className="text-zinc-500 text-sm p-8 text-center bg-zinc-900 rounded-lg">No simulations. Click "Submit Simulation" to queue one.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {simulations?.map((sim) => (
                  <Card key={sim.id} className="bg-zinc-900 border-zinc-800">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="text-xs font-mono text-amber-400">{sim.simId}</div>
                          <div className="text-sm font-medium text-white mt-1">{sim.name}</div>
                        </div>
                        <Badge variant="outline" className={`text-xs ${STATUS_COLORS[sim.status] ?? ""}`}>
                          {sim.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-zinc-500 space-y-1">
                        <div>Simulator: <span className="text-zinc-300">{sim.simulator}</span></div>
                        {sim.fieldId && <div>Field: <span className="text-zinc-300">{sim.fieldId}</span></div>}
                        <div>Submitted: <span className="text-zinc-300">{new Date(sim.submittedAt).toLocaleString()}</span></div>
                        {sim.durationSec && <div>Duration: <span className="text-zinc-300">{sim.durationSec}s</span></div>}
                        {sim.errorMessage && <div className="text-red-400">{sim.errorMessage}</div>}
                      </div>
                      {sim.outputUrl && (
                        <a href={sim.outputUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline mt-2 block">
                          View Output →
                        </a>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Emissions & Carbon */}
        {activeTab === "emissions" && (
          <div className="space-y-6">
            {/* Summary */}
            {emissionsSummary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="text-zinc-400 text-xs mb-1">Total CO₂e (tonnes)</div>
                    <div className="text-2xl font-bold text-white">{emissionsSummary.totalCo2e.toFixed(1)}</div>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="text-zinc-400 text-xs mb-1">Sources</div>
                    <div className="text-2xl font-bold text-amber-400">{emissionsSummary.sourcesCount}</div>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="text-zinc-400 text-xs mb-1">Carbon Targets</div>
                    <div className="text-2xl font-bold text-green-400">{carbonTargets?.length ?? 0}</div>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="text-zinc-400 text-xs mb-1">Emission Records</div>
                    <div className="text-2xl font-bold text-blue-400">{emissionRecords?.length ?? 0}</div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Emission Sources */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-white">Emission Sources</h2>
                  <Button size="sm" onClick={() => createSourceMutation.mutate({
                    name: `Source-${Date.now()}`,
                    sourceType: "combustion",
                    emissionScope: "scope1",
                    ghgComponent: "co2",
                  })} disabled={createSourceMutation.isPending}>
                    <Plus className="w-4 h-4 mr-1" /> Add Source
                  </Button>
                </div>
                {emissionSources?.length === 0 ? (
                  <div className="text-zinc-500 text-sm p-6 text-center bg-zinc-900 rounded-lg">No emission sources.</div>
                ) : (
                  <div className="space-y-2">
                    {emissionSources?.map((src) => (
                      <div key={src.id} className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-white">{src.name}</div>
                            <div className="text-xs text-zinc-500">{src.sourceType} · {src.emissionScope} · {src.ghgComponent}</div>
                          </div>
                          <Badge variant="outline" className={`text-xs ${src.isActive ? STATUS_COLORS.active : STATUS_COLORS.inactive}`}>
                            {src.isActive ? "active" : "inactive"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Emission Records */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">Emission Records</h2>
                {emissionRecords?.length === 0 ? (
                  <div className="text-zinc-500 text-sm p-6 text-center bg-zinc-900 rounded-lg">No emission records.</div>
                ) : (
                  <div className="space-y-2">
                    {emissionRecords?.slice(0, 8).map((rec) => (
                      <div key={rec.id} className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-mono text-zinc-400">{rec.sourceId}</div>
                            <div className="text-xs text-zinc-500">
                              {new Date(rec.reportingPeriodStart).toLocaleDateString()} — {new Date(rec.reportingPeriodEnd).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-white mt-1">
                              CO₂e: <span className="text-amber-400">{rec.co2eTonnes?.toFixed(2) ?? "—"} t</span>
                              {" · "}CO₂: {rec.co2Tonnes?.toFixed(2) ?? "—"} t
                              {" · "}CH₄: {rec.ch4Tonnes?.toFixed(4) ?? "—"} t
                            </div>
                          </div>
                          <Badge variant="outline" className={`text-xs ${STATUS_COLORS[rec.verificationStatus] ?? ""}`}>
                            {rec.verificationStatus}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Drone Inspection */}
        {activeTab === "drone" && (
          <div className="space-y-4">
            {/* Summary */}
            {droneSummary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="text-zinc-400 text-xs mb-1">Total Inspections</div>
                    <div className="text-2xl font-bold text-white">{droneSummary.total}</div>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="text-zinc-400 text-xs mb-1">Completed</div>
                    <div className="text-2xl font-bold text-green-400">{droneSummary.byStatus["completed"] ?? 0}</div>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="text-zinc-400 text-xs mb-1">In Progress</div>
                    <div className="text-2xl font-bold text-blue-400">{droneSummary.byStatus["in_progress"] ?? 0}</div>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="text-zinc-400 text-xs mb-1">Scheduled</div>
                    <div className="text-2xl font-bold text-yellow-400">{droneSummary.byStatus["scheduled"] ?? 0}</div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Drone Inspections ({droneInspections?.length ?? 0})</h2>
              <Button size="sm" onClick={() => scheduleDroneMutation.mutate({
                inspectionType: "visual",
                wellId: "WELL-001",
                scheduledAt: new Date(Date.now() + 86400000),
              })} disabled={scheduleDroneMutation.isPending}>
                <Plus className="w-4 h-4 mr-1" /> Schedule Inspection
              </Button>
            </div>

            {droneInspections?.length === 0 ? (
              <div className="text-zinc-500 text-sm p-8 text-center bg-zinc-900 rounded-lg">No drone inspections. Click "Schedule Inspection" to create one.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {droneInspections?.map((insp) => (
                  <Card key={insp.id} className="bg-zinc-900 border-zinc-800">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="text-xs font-mono text-amber-400">{insp.inspectionId}</div>
                          <div className="text-sm font-medium text-white mt-1">{insp.inspectionType}</div>
                        </div>
                        <Badge variant="outline" className={`text-xs ${STATUS_COLORS[insp.status] ?? ""}`}>
                          {insp.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-zinc-500 space-y-1">
                        {insp.wellId && <div>Well: <span className="text-zinc-300">{insp.wellId}</span></div>}
                        {insp.facilityId && <div>Facility: <span className="text-zinc-300">{insp.facilityId}</span></div>}
                        {insp.droneModel && <div>Drone: <span className="text-zinc-300">{insp.droneModel}</span></div>}
                        {insp.pilotName && <div>Pilot: <span className="text-zinc-300">{insp.pilotName}</span></div>}
                        <div>Images: <span className="text-zinc-300">{insp.imageCount}</span> · Thermal: <span className="text-zinc-300">{insp.thermalImageCount}</span></div>
                        {insp.scheduledAt && <div>Scheduled: <span className="text-zinc-300">{new Date(insp.scheduledAt).toLocaleString()}</span></div>}
                      </div>
                      {insp.status === "scheduled" && (
                        <Button size="sm" variant="outline" className="w-full mt-3 text-xs" onClick={() => updateDroneMutation.mutate({ inspectionId: insp.inspectionId, status: "in_progress", startedAt: new Date() })}>
                          <Play className="w-3 h-3 mr-1" /> Start Inspection
                        </Button>
                      )}
                      {insp.status === "in_progress" && (
                        <Button size="sm" className="w-full mt-3 text-xs bg-green-700 hover:bg-green-800" onClick={() => updateDroneMutation.mutate({ inspectionId: insp.inspectionId, status: "completed", completedAt: new Date() })}>
                          <CheckCircle className="w-3 h-3 mr-1" /> Complete
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-2 text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                        disabled={uploadingFor === insp.inspectionId}
                        onClick={() => {
                          setActiveUploadInspId(insp.inspectionId);
                          fileInputRef.current?.click();
                        }}
                      >
                        <Camera className="w-3 h-3 mr-1" />
                        {uploadingFor === insp.inspectionId ? "Uploading..." : "Upload Media"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {/* Hidden file input for drone media upload */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/mp4,video/quicktime,application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0 && activeUploadInspId) {
            handleDroneUpload(activeUploadInspId, e.target.files);
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}
