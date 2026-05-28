import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plug, Database, GitBranch, Server, Wrench, RefreshCw, Plus, Activity } from "lucide-react";

type IntegrationTab = "osdu" | "witsml" | "opcua" | "cmms";

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState<IntegrationTab>("osdu");

  const { data: osduDatasets, refetch: refetchOsdu } = trpc.integrations.listOsduDatasets.useQuery();
  const { data: witsmlWells, refetch: refetchWitsml } = trpc.integrations.listWitsmlWells.useQuery();
  const { data: prodmlSets, refetch: refetchProdml } = trpc.integrations.listProdmlSets.useQuery({ uidWell: "ALL" });
  const { data: cmmsWorkOrders, refetch: refetchCmms } = trpc.integrations.listCmmsWorkOrders.useQuery();
  const { data: cmmsIntegrations } = trpc.integrations.listCmmsIntegrations.useQuery(undefined);
  const { data: opcuaNodes, refetch: refetchOpcua } = trpc.integrations.listOpcuaNodes.useQuery();
  const { data: opcuaServerInfo } = trpc.integrations.getOpcuaServerInfo.useQuery();

  const createOsduMutation = trpc.integrations.createOsduDataset.useMutation({
    onSuccess: () => { toast.success("OSDU dataset created"); refetchOsdu(); },
  });

  const createWitsmlMutation = trpc.integrations.createWitsmlWell.useMutation({
    onSuccess: () => { toast.success("WITSML well created"); refetchWitsml(); },
  });

  const createWorkOrderMutation = trpc.integrations.createCmmsWorkOrder.useMutation({
    onSuccess: () => { toast.success("Work order created"); refetchCmms(); },
  });

  const updateWorkOrderMutation = trpc.integrations.updateCmmsWorkOrder.useMutation({
    onSuccess: () => { toast.success("Work order updated"); refetchCmms(); },
  });

  const seedOpcuaMutation = trpc.integrations.seedOpcuaNodes.useMutation({
    onSuccess: (data: { seeded: number }) => { toast.success(`${data.seeded} OPC-UA nodes seeded`); refetchOpcua(); },
  });

  const tabs = [
    { id: "osdu" as const, label: "OSDU R3", icon: Database, count: osduDatasets?.length },
    { id: "witsml" as const, label: "WITSML/PRODML", icon: GitBranch, count: (witsmlWells?.length ?? 0) + (prodmlSets?.length ?? 0) },
    { id: "opcua" as const, label: "OPC-UA Server", icon: Server, count: opcuaNodes?.length },
    { id: "cmms" as const, label: "SAP PM / Maximo", icon: Wrench, count: cmmsWorkOrders?.length },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Plug className="w-7 h-7 text-emerald-400" />
              Industry Integrations
            </h1>
            <p className="text-zinc-400 text-sm mt-1">OSDU R3 · WITSML/PRODML · OPC-UA Server · SAP PM / IBM Maximo</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { refetchOsdu(); refetchWitsml(); refetchOpcua(); refetchCmms(); }}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-900 p-1 rounded-lg flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-white"}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && (
                <span className="text-xs bg-zinc-700 px-1.5 py-0.5 rounded">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* OSDU R3 Tab */}
        {activeTab === "osdu" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">OSDU R3 Data Platform</h2>
                <p className="text-zinc-500 text-xs">Open Subsurface Data Universe — Full R3 Compliance</p>
              </div>
              <Button size="sm" onClick={() => createOsduMutation.mutate({
                kind: "osdu:wks:dataset--File.Generic:1.0.0",
                namespace: "opendes",
                version: "1.0.0",
              })} disabled={createOsduMutation.isPending}>
                <Plus className="w-4 h-4 mr-1" /> Create Dataset
              </Button>
            </div>
            {osduDatasets?.length === 0 ? (
              <div className="text-zinc-500 text-sm p-8 text-center bg-zinc-900 rounded-lg">No OSDU datasets. Click "Create Dataset" to add one.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {osduDatasets?.map((ds) => (
                  <Card key={ds.id} className="bg-zinc-900 border-zinc-800">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-mono text-emerald-400 truncate">{ds.datasetId}</div>
                          <div className="text-sm font-medium text-white mt-1 truncate">{ds.kind}</div>
                        </div>
                        <Badge variant="outline" className={`text-xs ml-2 ${ds.status === "active" ? "text-green-400 border-green-500/30" : "text-zinc-400 border-zinc-700"}`}>
                          {ds.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-zinc-500 space-y-1">
                        <div>Namespace: <span className="text-zinc-300">{ds.namespace}</span></div>
                        <div>Version: <span className="text-zinc-300">{ds.version}</span></div>
                        {ds.source && <div>Source: <span className="text-zinc-300">{ds.source}</span></div>}
                        <div>Created: <span className="text-zinc-300">{new Date(ds.createdAt).toLocaleDateString()}</span></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* WITSML/PRODML Tab */}
        {activeTab === "witsml" && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">WITSML Wells</h2>
                  <p className="text-zinc-500 text-xs">Wellbore Information Transfer Standard Markup Language</p>
                </div>
                <Button size="sm" onClick={() => createWitsmlMutation.mutate({
                  uid: `WELL-${Date.now()}`,
                  name: `Well-${Date.now()}`,
                  statusWell: "active",
                  purposeWell: "production",
                })} disabled={createWitsmlMutation.isPending}>
                  <Plus className="w-4 h-4 mr-1" /> Add WITSML Well
                </Button>
              </div>
              {witsmlWells?.length === 0 ? (
                <div className="text-zinc-500 text-sm p-6 text-center bg-zinc-900 rounded-lg">No WITSML wells.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-zinc-500 border-b border-zinc-800">
                        <th className="text-left py-2 pr-4">UID</th>
                        <th className="text-left pr-4">Name</th>
                        <th className="text-left pr-4">Field</th>
                        <th className="text-left pr-4">Operator</th>
                        <th className="text-left pr-4">Status</th>
                        <th className="text-left">Purpose</th>
                      </tr>
                    </thead>
                    <tbody>
                      {witsmlWells?.map((w) => (
                        <tr key={w.id} className="border-b border-zinc-800/50 text-white">
                          <td className="py-2 pr-4 font-mono text-emerald-400">{w.uid}</td>
                          <td className="pr-4">{w.name}</td>
                          <td className="pr-4 text-zinc-400">{w.field ?? "—"}</td>
                          <td className="pr-4 text-zinc-400">{w.operator ?? "—"}</td>
                          <td className="pr-4">
                            <Badge variant="outline" className="text-xs text-green-400 border-green-500/30">{w.statusWell ?? "—"}</Badge>
                          </td>
                          <td className="text-zinc-400">{w.purposeWell ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-white">PRODML Production Sets</h2>
                <p className="text-zinc-500 text-xs">Production Markup Language — Production Data Exchange</p>
              </div>
              {prodmlSets?.length === 0 ? (
                <div className="text-zinc-500 text-sm p-6 text-center bg-zinc-900 rounded-lg">No PRODML production sets.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {prodmlSets?.map((ps) => (
                    <div key={ps.id} className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                      <div className="text-xs font-mono text-emerald-400">{ps.uid}</div>
                      <div className="text-sm text-white mt-1">{ps.uid}</div>
                      <div className="text-xs text-zinc-500 mt-1">
                        Well: {ps.uidWell} · {new Date(ps.dTimStart).toLocaleDateString()} → {new Date(ps.dTimEnd).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-zinc-500">
                        Oil: {ps.oilVolume ?? "—"} {ps.volumeUom} · Gas: {ps.gasVolume ?? "—"} {ps.volumeUom}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* OPC-UA Tab */}
        {activeTab === "opcua" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">OPC-UA Server Mode</h2>
                <p className="text-zinc-500 text-xs">Open Platform Communications Unified Architecture — Server Node Exposure</p>
              </div>
              <Button size="sm" onClick={() => seedOpcuaMutation.mutate()} disabled={seedOpcuaMutation.isPending}>
                <Plus className="w-4 h-4 mr-1" /> Seed OPC-UA Nodes
              </Button>
            </div>

            {/* Server Info */}
            {opcuaServerInfo && (
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Activity className="w-5 h-5 text-green-400" />
                    <div>
                      <div className="text-sm font-medium text-white">OPC-UA Server Status</div>
                      <div className="text-xs text-zinc-500">{opcuaServerInfo.serverEndpoint ?? "opc.tcp://og-rmm.internal:4840"}</div>
                    </div>
                    <Badge variant="outline" className="ml-auto text-xs text-green-400 border-green-500/30">
                      Running
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-xs text-zinc-500">
                    <div>Total Nodes: <span className="text-white">{opcuaServerInfo.totalNodes}</span></div>
                    <div>Active: <span className="text-white">{opcuaServerInfo.activeNodes}</span></div>
                    <div>Security: <span className="text-white">{opcuaServerInfo.securityMode ?? "SignAndEncrypt"}</span></div>
                  </div>
                </CardContent>
              </Card>
            )}

            {opcuaNodes?.length === 0 ? (
              <div className="text-zinc-500 text-sm p-8 text-center bg-zinc-900 rounded-lg">No OPC-UA nodes. Click "Seed OPC-UA Nodes" to create defaults.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-zinc-500 border-b border-zinc-800">
                      <th className="text-left py-2 pr-4">Node ID</th>
                      <th className="text-left pr-4">Name</th>
                      <th className="text-left pr-4">Type</th>
                      <th className="text-left pr-4">Data Type</th>
                      <th className="text-left pr-4">Access</th>
                      <th className="text-right">Current Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opcuaNodes?.map((node) => (
                      <tr key={node.id} className="border-b border-zinc-800/50 text-white">
                        <td className="py-2 pr-4 font-mono text-emerald-400 text-xs">{node.nodeId}</td>
                        <td className="pr-4">{node.displayName}</td>
                        <td className="pr-4 text-zinc-400">{node.nodeClass}</td>
                        <td className="pr-4 text-zinc-400">{node.dataType ?? "—"}</td>
                        <td className="pr-4">
                          <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-700">{node.accessLevel}</Badge>
                        </td>
                        <td className="text-right font-mono">{node.tagName ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SAP PM / Maximo Tab */}
        {activeTab === "cmms" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* CMMS Integrations */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">CMMS Integrations</h2>
                {cmmsIntegrations?.length === 0 ? (
                  <div className="text-zinc-500 text-sm p-6 text-center bg-zinc-900 rounded-lg">No CMMS integrations configured.</div>
                ) : (
                  <div className="space-y-3">
                    {cmmsIntegrations?.map((intg) => (
                      <Card key={intg.id} className="bg-zinc-900 border-zinc-800">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium text-white">{intg.cmmsSystem}</div>
                              <div className="text-xs text-zinc-500">{intg.cmmsSystem} · {intg.baseUrl ?? "—"}</div>
                            </div>
                            <Badge variant="outline" className={`text-xs ${intg.isActive ? "text-green-400 border-green-500/30" : "text-zinc-400 border-zinc-700"}`}>
                              {intg.isActive ? "active" : "inactive"}
                            </Badge>
                          </div>
                          <div className="text-xs text-zinc-600 mt-2">
                            Sync: every {intg.syncInterval}s · Last: {intg.lastTestAt ? new Date(intg.lastTestAt).toLocaleString() : "never"}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Work Orders */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-white">Work Orders</h2>
                  <Button size="sm" onClick={() => createWorkOrderMutation.mutate({
                    title: "Preventive Maintenance",
                    workOrderType: "preventive",
                    priority: "medium",
                    assetId: "PUMP-001",
                  })} disabled={createWorkOrderMutation.isPending}>
                    <Plus className="w-4 h-4 mr-1" /> New WO
                  </Button>
                </div>
                {cmmsWorkOrders?.length === 0 ? (
                  <div className="text-zinc-500 text-sm p-6 text-center bg-zinc-900 rounded-lg">No work orders. Click "New WO" to create one.</div>
                ) : (
                  <div className="space-y-2">
                    {cmmsWorkOrders?.map((wo) => (
                      <div key={wo.id} className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-emerald-400">{wo.workOrderNumber ?? `WO-${wo.id}`}</span>
                              <Badge variant="outline" className={`text-xs ${
                                wo.priority === "critical" ? "text-red-400 border-red-500/30" :
                                wo.priority === "high" ? "text-orange-400 border-orange-500/30" :
                                wo.priority === "medium" ? "text-yellow-400 border-yellow-500/30" :
                                "text-zinc-400 border-zinc-700"
                              }`}>
                                {wo.priority}
                              </Badge>
                            </div>
                            <div className="text-sm text-white mt-1">{wo.title}</div>
                            <div className="text-xs text-zinc-500">{wo.assetId ?? "—"} · {wo.workOrderType}</div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant="outline" className={`text-xs ${
                              wo.status === "completed" ? "text-green-400 border-green-500/30" :
                              wo.status === "in_progress" ? "text-blue-400 border-blue-500/30" :
                              wo.status === "open" ? "text-yellow-400 border-yellow-500/30" :
                              "text-zinc-400 border-zinc-700"
                            }`}>
                              {wo.status}
                            </Badge>
                            {wo.status === "open" && (
                              <Button size="sm" variant="outline" className="text-xs h-6" onClick={() => updateWorkOrderMutation.mutate({ id: wo.id, status: "in_progress" })}>
                                Start
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
