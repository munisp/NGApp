import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Brain, Zap, Network, RefreshCw, Plus, Play, Activity, ChevronRight, Save, Upload, History, Cpu } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  training: "text-yellow-400 border-yellow-500/30",
  ready: "text-green-400 border-green-500/30",
  deployed: "text-blue-400 border-blue-500/30",
  failed: "text-red-400 border-red-500/30",
  active: "text-green-400 border-green-500/30",
  inactive: "text-zinc-400 border-zinc-700",
  running: "text-blue-400 border-blue-500/30",
  completed: "text-green-400 border-green-500/30",
  error: "text-red-400 border-red-500/30",
};

export default function AiAdvancedPage() {
  const [activeTab, setActiveTab] = useState<"pinn" | "surrogate" | "agentic" | "federated">("pinn");
  const [selectedPinnId, setSelectedPinnId] = useState<string | null>(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  const { data: pinnModels, refetch: refetchPinn } = trpc.aiAdvanced.listPinnModels.useQuery();
  const { data: workflows, refetch: refetchWorkflows } = trpc.aiAdvanced.listWorkflows.useQuery();
  const { data: workflowRuns } = trpc.aiAdvanced.listWorkflowRuns.useQuery(
    { workflowId: selectedWorkflowId! },
    { enabled: selectedWorkflowId !== null }
  );
  const { data: federatedModels, refetch: refetchFederated } = trpc.aiAdvanced.listFederatedModels.useQuery();

  // PINN Surrogate S3 model management
  const { data: pinnStatus } = trpc.pinn.status.useQuery(undefined, { refetchInterval: 10000 });
  const { data: pinnVersions, refetch: refetchVersions } = trpc.pinn.modelVersions.useQuery();
  const pinnTrain = trpc.pinn.train.useMutation({
    onSuccess: (d: any) => toast.success(`PINN training started — ${d.n_epochs ?? 150} epochs`),
    onError: (e: any) => toast.error(`Training failed: ${e.message}`),
  });
  const pinnSave = trpc.pinn.saveModel.useMutation({
    onSuccess: (d: any) => { toast.success(`Model saved to S3 — version ${d.version ?? "latest"}`); refetchVersions(); },
    onError: (e: any) => toast.error(`Save failed: ${e.message}`),
  });
  const pinnLoad = trpc.pinn.loadModel.useMutation({
    onSuccess: (d: any) => toast.success(`Model loaded from S3 — version ${d.version ?? "latest"}`),
    onError: (e: any) => toast.error(`Load failed: ${e.message}`),
  });

  const createPinnMutation = trpc.aiAdvanced.createPinnModel.useMutation({
    onSuccess: () => { toast.success("PINN model created."); refetchPinn(); },
  });
  const createWorkflowMutation = trpc.aiAdvanced.createWorkflow.useMutation({
    onSuccess: () => { toast.success("Agentic workflow created."); refetchWorkflows(); },
  });
  const runPinnMutation = trpc.aiAdvanced.runPinnInference.useMutation({
    onSuccess: (data) => toast.success(`PINN inference complete. Latency: ${data.latencyMs}ms`),
  });
  const runWorkflowMutation = trpc.aiAdvanced.runWorkflow.useMutation({
    onSuccess: () => { toast.success("Workflow triggered successfully"); if (selectedWorkflowId) refetchWorkflows(); },
  });
  const joinFederatedMutation = trpc.aiAdvanced.joinFederatedModel.useMutation({
    onSuccess: () => { toast.success("Joined federated learning round"); refetchFederated(); },
  });

  const TABS = ["pinn", "surrogate", "agentic", "federated"] as const;
  const TAB_LABELS: Record<string, string> = {
    pinn: "PINN Models",
    surrogate: "PINN Surrogate",
    agentic: "Agentic Workflows",
    federated: "Federated Learning",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Brain className="w-7 h-7 text-violet-400" />
              Advanced AI & ML Platform
            </h1>
            <p className="text-zinc-400 text-sm mt-1">PINN Well Performance · Surrogate S3 Management · Agentic Workflows · Federated Learning</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { refetchPinn(); refetchWorkflows(); refetchFederated(); refetchVersions(); }}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-900 p-1 rounded-lg w-fit flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-white"}`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* PINN DB Models Tab */}
        {activeTab === "pinn" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Physics-Informed Neural Networks (DB Registry)</h2>
              <Button size="sm" onClick={() => createPinnMutation.mutate({ name: `PINN-${Date.now()}`, modelType: "inflow_performance", physicsLossWeight: 0.1, dataLossWeight: 0.9 })} disabled={createPinnMutation.isPending}>
                <Plus className="w-4 h-4 mr-1" /> Add PINN Model
              </Button>
            </div>
            {pinnModels?.length === 0 ? (
              <div className="text-zinc-500 text-sm p-8 text-center bg-zinc-900 rounded-lg">
                No PINN models yet. Click "Add PINN Model" to create one.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pinnModels?.map((model) => (
                  <Card key={model.id} className="bg-zinc-900 border-zinc-800">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="text-xs font-mono text-violet-400">{model.modelId}</div>
                          <div className="text-sm font-medium text-white mt-1">{model.name}</div>
                        </div>
                        <Badge variant="outline" className={`text-xs ${STATUS_COLORS[model.status] ?? ""}`}>
                          {model.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-zinc-500 space-y-1">
                        <div>Type: <span className="text-zinc-300">{model.modelType}</span></div>
                        {model.wellId && <div>Well: <span className="text-zinc-300">{model.wellId}</span></div>}
                        {model.validationRmse !== null && model.validationRmse !== undefined && (
                          <div>Validation RMSE: <span className="text-zinc-300">{model.validationRmse.toFixed(4)}</span></div>
                        )}
                        <div>Physics Loss: <span className="text-zinc-300">{model.physicsLossWeight}</span> | Data Loss: <span className="text-zinc-300">{model.dataLossWeight}</span></div>
                        <div>Inferences: <span className="text-zinc-300">{model.inferenceCount}</span></div>
                      </div>
                      {(model.status === "ready" || model.status === "deployed") && (
                        <Button
                          size="sm"
                          className="w-full mt-3 bg-violet-600 hover:bg-violet-700 text-xs"
                          onClick={() => runPinnMutation.mutate({
                            modelId: model.modelId,
                            inputData: { wellhead_pressure: 2500, tubing_temp: 85, choke_size: 32 },
                          })}
                          disabled={runPinnMutation.isPending}
                        >
                          <Zap className="w-3 h-3 mr-1" /> Run Inference
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PINN Surrogate S3 Management Tab */}
        {activeTab === "surrogate" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-semibold text-white">PINN Surrogate — S3 Model Management</h2>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => pinnTrain.mutate({ nEpochs: 150, nSamples: 300 })} disabled={pinnTrain.isPending}>
                  <Cpu className="w-3.5 h-3.5 mr-1" /> {pinnTrain.isPending ? "Training..." : "Train (150 epochs)"}
                </Button>
                <Button size="sm" className="bg-violet-600 hover:bg-violet-700" onClick={() => pinnSave.mutate()} disabled={pinnSave.isPending}>
                  <Save className="w-3.5 h-3.5 mr-1" /> {pinnSave.isPending ? "Saving..." : "Save to S3"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => pinnLoad.mutate()} disabled={pinnLoad.isPending}>
                  <Upload className="w-3.5 h-3.5 mr-1" /> {pinnLoad.isPending ? "Loading..." : "Load Latest from S3"}
                </Button>
              </div>
            </div>

            {/* Status card */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-300">Surrogate Status</CardTitle></CardHeader>
              <CardContent>
                {pinnStatus ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div>
                      <div className="text-zinc-500 mb-1">Status</div>
                      <Badge variant="outline" className={pinnStatus.trained ? "text-green-400 border-green-400/30" : "text-yellow-400 border-yellow-400/30"}>
                        {pinnStatus.trained ? "Trained" : "Untrained (physics fallback)"}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-zinc-500 mb-1">Architecture</div>
                      <div className="text-zinc-300 font-mono">{(pinnStatus as any).architecture ?? "5-layer MLP"}</div>
                    </div>
                    <div>
                      <div className="text-zinc-500 mb-1">Output Variables</div>
                      <div className="text-zinc-300">{(pinnStatus as any).output_count ?? 7} outputs</div>
                    </div>
                    <div>
                      <div className="text-zinc-500 mb-1">MC Dropout Samples</div>
                      <div className="text-zinc-300">{(pinnStatus as any).mc_samples ?? 50} samples</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-zinc-500 text-sm py-2">
                    ML service not reachable — start the ML service to use PINN surrogate.
                    <div className="text-zinc-600 text-xs mt-1">Expected at: http://localhost:8001</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Version history */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-zinc-300 flex items-center gap-2">
                    <History className="w-4 h-4" />
                    S3 Version History
                  </CardTitle>
                  <Button size="sm" variant="ghost" onClick={() => refetchVersions()}>
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {(pinnVersions as any)?.versions?.length ? (
                  <div className="space-y-2">
                    {((pinnVersions as any).versions as Array<{ version: string; saved_at: string; s3_key: string }>).map((v) => (
                      <div key={v.version} className="flex items-center justify-between p-2 bg-zinc-800 rounded text-xs">
                        <div>
                          <span className="text-violet-400 font-mono">{v.version}</span>
                          <span className="text-zinc-500 ml-3">{new Date(v.saved_at).toLocaleString()}</span>
                          <span className="text-zinc-600 ml-3 font-mono">{v.s3_key}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs"
                          onClick={() => pinnLoad.mutate()}
                          disabled={pinnLoad.isPending}
                        >
                          <Upload className="w-3 h-3 mr-1" />Load
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-zinc-500 text-sm py-2">
                    No saved versions yet. Train a model and click "Save to S3" to create the first version.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Usage guide */}
            <Card className="bg-zinc-900/50 border-zinc-800/50">
              <CardContent className="p-4">
                <div className="text-xs text-zinc-500 space-y-1">
                  <div className="text-zinc-400 font-medium mb-2">How to use the PINN Surrogate:</div>
                  <div>1. Click <span className="text-violet-400">Train (150 epochs)</span> to train the surrogate on synthetic well data with physics residual loss.</div>
                  <div>2. Click <span className="text-violet-400">Save to S3</span> to persist the trained weights — they will auto-load on next server restart.</div>
                  <div>3. Use the <span className="text-violet-400">Digital Twin → PINN Surrogate</span> tab to run predictions with 95% CI uncertainty bands.</div>
                  <div>4. Use <span className="text-violet-400">Well KPI Dashboard → PINN Uncertainty</span> to see per-well uncertainty across all 6 wells.</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Agentic AI Tab */}
        {activeTab === "agentic" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Agentic Workflows</h2>
                <Button size="sm" onClick={() => createWorkflowMutation.mutate({ name: `Workflow-${Date.now()}`, triggerType: "manual", steps: [] })} disabled={createWorkflowMutation.isPending}>
                  <Plus className="w-4 h-4 mr-1" /> Add Workflow
                </Button>
              </div>
              {workflows?.length === 0 ? (
                <div className="text-zinc-500 text-sm p-8 text-center bg-zinc-900 rounded-lg">
                  No workflows yet. Click "Add Workflow" to create one.
                </div>
              ) : (
                <div className="space-y-3">
                  {workflows?.map((wf) => (
                    <Card
                      key={wf.id}
                      className={`bg-zinc-900 border-zinc-800 cursor-pointer hover:border-zinc-600 transition-colors ${selectedWorkflowId === wf.workflowId ? "border-violet-500/50" : ""}`}
                      onClick={() => setSelectedWorkflowId(wf.workflowId)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-medium text-white">{wf.name}</div>
                              <Badge variant="outline" className={`text-xs ${wf.isActive ? STATUS_COLORS.active : STATUS_COLORS.inactive}`}>
                                {wf.isActive ? "active" : "inactive"}
                              </Badge>
                            </div>
                            {wf.description && <div className="text-xs text-zinc-500 mt-1">{wf.description}</div>}
                            <div className="flex gap-3 mt-2 text-xs text-zinc-500">
                              <span>Trigger: <span className="text-zinc-300">{wf.triggerType}</span></span>
                              <span>Runs: <span className="text-green-400">{wf.successCount}</span>/<span className="text-red-400">{wf.failureCount}</span></span>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 ml-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              runWorkflowMutation.mutate({ workflowId: wf.workflowId });
                            }}
                            disabled={runWorkflowMutation.isPending}
                          >
                            <Play className="w-3 h-3 mr-1" /> Run
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Workflow Runs */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">
                {selectedWorkflowId ? `Runs: ${selectedWorkflowId}` : "Select a workflow to see runs"}
              </h2>
              {!selectedWorkflowId ? (
                <div className="text-zinc-500 text-sm p-8 text-center bg-zinc-900 rounded-lg">
                  Select a workflow to view its execution history.
                </div>
              ) : workflowRuns?.length === 0 ? (
                <div className="text-zinc-500 text-sm p-8 text-center bg-zinc-900 rounded-lg">
                  No runs yet. Click "Run" to trigger the workflow.
                </div>
              ) : (
                <div className="space-y-2">
                  {workflowRuns?.map((run) => (
                    <div key={run.id} className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-mono text-zinc-400">{run.runId}</div>
                          <div className="text-xs text-zinc-500 mt-1">{new Date(run.startedAt).toLocaleString()}</div>
                        </div>
                        <Badge variant="outline" className={`text-xs ${STATUS_COLORS[run.status] ?? ""}`}>
                          {run.status}
                        </Badge>
                      </div>
                      {run.errorMessage && (
                        <div className="text-xs text-red-400 mt-2">{run.errorMessage}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Federated Learning Tab */}
        {activeTab === "federated" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Federated Learning Framework</h2>
            </div>
            {federatedModels?.length === 0 ? (
              <div className="text-zinc-500 text-sm p-8 text-center bg-zinc-900 rounded-lg">
                No federated models registered yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {federatedModels?.map((model) => (
                  <Card key={model.id} className="bg-zinc-900 border-zinc-800">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="text-xs font-mono text-violet-400">{model.modelId}</div>
                          <div className="text-sm font-medium text-white mt-1">{model.name}</div>
                        </div>
                        <Badge variant="outline" className={`text-xs ${STATUS_COLORS[model.status] ?? ""}`}>
                          {model.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-zinc-500 space-y-1">
                        <div>Algorithm: <span className="text-zinc-300">{model.aggregationStrategy}</span></div>
                        <div>Min Participants: <span className="text-zinc-300">{model.minParticipants}</span></div>
                        <div>Rounds: <span className="text-zinc-300">{model.globalRound}</span></div>
                        <div>Privacy: <span className="text-zinc-300">ε={model.differentialPrivacyEpsilon}</span></div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          className="flex-1 bg-violet-600 hover:bg-violet-700 text-xs"
                          onClick={() => joinFederatedMutation.mutate({ modelId: model.modelId, tenantId: "tenant-default" })}
                          disabled={joinFederatedMutation.isPending}
                        >
                          <Network className="w-3 h-3 mr-1" /> Join Round
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => toast.success(`Status: ${model.status}`)}
                        >
                          <Activity className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
