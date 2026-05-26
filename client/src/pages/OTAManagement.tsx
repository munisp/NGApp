import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Download, Plus, Play, XCircle, CheckCircle2, AlertTriangle,
  RefreshCw, ChevronRight, Cpu, Layers, Zap, Clock, BarChart3
} from "lucide-react";

const DEVICE_TYPES = ["RTU", "PLC", "SCADA_GATEWAY", "FLOW_COMPUTER", "SENSOR_HUB", "ESP_CONTROLLER", "WELLHEAD_CONTROLLER", "EDGE_NODE"] as const;
const DEVICE_TYPE_LABELS: Record<string, string> = {
  RTU: "RTU", PLC: "PLC", SCADA_GATEWAY: "SCADA Gateway",
  FLOW_COMPUTER: "Flow Computer", SENSOR_HUB: "Sensor Hub",
  ESP_CONTROLLER: "ESP Controller", WELLHEAD_CONTROLLER: "Wellhead Controller",
  EDGE_NODE: "Edge Node",
};

const CAMPAIGN_STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  draft: { color: "bg-slate-500/20 text-slate-400 border-slate-500/30", icon: <Layers className="w-3 h-3" /> },
  scheduled: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: <Clock className="w-3 h-3" /> },
  in_progress: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: <Zap className="w-3 h-3" /> },
  completed: { color: "bg-green-500/20 text-green-400 border-green-500/30", icon: <CheckCircle2 className="w-3 h-3" /> },
  failed: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: <AlertTriangle className="w-3 h-3" /> },
  cancelled: { color: "bg-slate-500/20 text-slate-400 border-slate-500/30", icon: <XCircle className="w-3 h-3" /> },
  rolled_back: { color: "bg-purple-500/20 text-purple-400 border-purple-500/30", icon: <RefreshCw className="w-3 h-3" /> },
};

const UPDATE_STATUS_CONFIG: Record<string, { color: string }> = {
  pending: { color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  downloading: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  installing: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  verifying: { color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  success: { color: "bg-green-500/20 text-green-400 border-green-500/30" },
  failed: { color: "bg-red-500/20 text-red-400 border-red-500/30" },
  skipped: { color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  rolled_back: { color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
};

type DeviceType = typeof DEVICE_TYPES[number];

export default function OTAManagement() {
  const [showFirmwareDialog, setShowFirmwareDialog] = useState(false);
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [fwForm, setFwForm] = useState({ version: "", deviceType: "RTU" as DeviceType, firmwareUrl: "", releaseNotes: "", isStable: false });
  const [fwFile, setFwFile] = useState<File | null>(null);
  const [fwUploading, setFwUploading] = useState(false);

  async function uploadFirmwareFile(): Promise<string | null> {
    if (!fwFile) return fwForm.firmwareUrl || null;
    setFwUploading(true);
    try {
      const fd = new FormData();
      fd.append("firmware", fwFile);
      const res = await fetch("/api/firmware/upload", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Upload failed"); }
      const { url } = await res.json() as { url: string };
      return url;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      return null;
    } finally {
      setFwUploading(false);
    }
  }
  const [campaignForm, setCampaignForm] = useState({ name: "", description: "", firmwareVersionId: 0, targetDeviceType: "RTU" as DeviceType, rolloutStrategy: "sequential" as "sequential" | "parallel" | "canary", canaryPercentage: 10 });

  const { data: firmwareList = [], refetch: refetchFw } = trpc.otaManagement.listFirmwareVersions.useQuery();
  const { data: campaigns = [], refetch: refetchCampaigns } = trpc.otaManagement.listCampaigns.useQuery();
  const { data: campaignDetails, refetch: refetchDetails } = trpc.otaManagement.getCampaignDetails.useQuery(
    { id: selectedCampaignId! },
    { enabled: !!selectedCampaignId }
  );

  const addFirmware = trpc.otaManagement.addFirmwareVersion.useMutation({
    onSuccess: () => { refetchFw(); setShowFirmwareDialog(false); toast.success("Firmware version added"); },
    onError: (err) => toast.error(err.message),
  });

  const markStable = trpc.otaManagement.markStable.useMutation({
    onSuccess: () => { refetchFw(); toast.success("Marked as stable"); },
    onError: (err) => toast.error(err.message),
  });

  const createCampaign = trpc.otaManagement.createCampaign.useMutation({
    onSuccess: (data) => { refetchCampaigns(); setShowCampaignDialog(false); setSelectedCampaignId(data.id); toast.success(`Campaign "${data.name}" created`); },
    onError: (err) => toast.error(err.message),
  });

  const startCampaign = trpc.otaManagement.startCampaign.useMutation({
    onSuccess: () => { refetchCampaigns(); refetchDetails(); toast.success("Campaign started"); },
    onError: (err) => toast.error(err.message),
  });

  const cancelCampaign = trpc.otaManagement.cancelCampaign.useMutation({
    onSuccess: () => { refetchCampaigns(); refetchDetails(); toast.success("Campaign cancelled"); },
    onError: (err) => toast.error(err.message),
  });

  const simulateProgress = trpc.otaManagement.simulateProgress.useMutation({
    onSuccess: (data) => {
      refetchCampaigns(); refetchDetails();
      if (data.isComplete) toast.success(`Campaign complete — ${data.successCount} succeeded, ${data.failureCount} failed`);
      else toast.info(`Advanced ${data.advanced} device(s) — ${data.pendingCount} remaining`);
    },
    onError: (err) => toast.error(err.message),
  });

  const activeCampaigns = campaigns.filter(c => ["in_progress", "scheduled"].includes(c.status));
  const completedCampaigns = campaigns.filter(c => ["completed", "failed", "cancelled", "rolled_back"].includes(c.status));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">OTA Firmware Updates</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage firmware versions and deploy over-the-air update campaigns</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowFirmwareDialog(true)}>
            <Download className="w-4 h-4 mr-2" /> Add Firmware
          </Button>
          <Button onClick={() => setShowCampaignDialog(true)} disabled={firmwareList.length === 0}>
            <Plus className="w-4 h-4 mr-2" /> New Campaign
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Firmware Versions", value: firmwareList.length, icon: <Layers className="w-5 h-5 text-blue-400" />, color: "border-blue-500/20" },
          { label: "Stable Releases", value: firmwareList.filter(f => f.isStable).length, icon: <CheckCircle2 className="w-5 h-5 text-green-400" />, color: "border-green-500/20" },
          { label: "Active Campaigns", value: activeCampaigns.length, icon: <Zap className="w-5 h-5 text-amber-400" />, color: "border-amber-500/20" },
          { label: "Total Campaigns", value: campaigns.length, icon: <BarChart3 className="w-5 h-5 text-slate-400" />, color: "border-slate-500/20" },
        ].map(s => (
          <Card key={s.label} className={`border ${s.color} bg-card/50`}>
            <CardContent className="p-4 flex items-center gap-3">
              {s.icon}
              <div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Campaigns list */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campaigns</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {campaigns.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">No campaigns yet</div>
              ) : (
                <div className="divide-y divide-border">
                  {campaigns.map(c => {
                    const sc = CAMPAIGN_STATUS_CONFIG[c.status] ?? CAMPAIGN_STATUS_CONFIG.draft;
                    const progress = c.totalDevices > 0 ? Math.round(((c.successCount + c.failureCount) / c.totalDevices) * 100) : 0;
                    return (
                      <button key={c.id} onClick={() => setSelectedCampaignId(c.id)}
                        className={`w-full text-left p-4 hover:bg-muted/30 transition-colors ${selectedCampaignId === c.id ? "bg-muted/50" : ""}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm truncate">{c.name}</span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={`text-xs border gap-1 ${sc.color}`}>{sc.icon}{c.status}</Badge>
                          <span className="text-xs text-muted-foreground">{c.totalDevices} devices</span>
                        </div>
                        {["in_progress", "completed"].includes(c.status) && (
                          <Progress value={progress} className="h-1" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Campaign details */}
        <div className="lg:col-span-2">
          {selectedCampaignId && campaignDetails ? (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{campaignDetails.campaign.name}</CardTitle>
                    <CardDescription>{campaignDetails.campaign.description ?? "No description"}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {campaignDetails.campaign.status === "draft" && (
                      <Button size="sm" onClick={() => startCampaign.mutate({ id: selectedCampaignId })}>
                        <Play className="w-3 h-3 mr-1" /> Start
                      </Button>
                    )}
                    {campaignDetails.campaign.status === "in_progress" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => simulateProgress.mutate({ campaignId: selectedCampaignId })}>
                          <Zap className="w-3 h-3 mr-1" /> Simulate Step
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-400" onClick={() => cancelCampaign.mutate({ id: selectedCampaignId })}>
                          <XCircle className="w-3 h-3 mr-1" /> Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Campaign meta */}
                <div className="grid grid-cols-3 gap-3 text-sm">
                  {[
                    { label: "Target Type", value: DEVICE_TYPE_LABELS[campaignDetails.campaign.targetDeviceType] },
                    { label: "Firmware", value: campaignDetails.firmware?.version ?? "—" },
                    { label: "Strategy", value: campaignDetails.campaign.rolloutStrategy },
                    { label: "Total Devices", value: campaignDetails.campaign.totalDevices },
                    { label: "Succeeded", value: campaignDetails.campaign.successCount },
                    { label: "Failed", value: campaignDetails.campaign.failureCount },
                  ].map(m => (
                    <div key={m.label} className="p-3 rounded-lg bg-muted/30">
                      <div className="text-xs text-muted-foreground">{m.label}</div>
                      <div className="font-semibold mt-0.5">{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* Overall progress */}
                {campaignDetails.campaign.totalDevices > 0 && (
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Overall Progress</span>
                      <span>{Math.round(((campaignDetails.campaign.successCount + campaignDetails.campaign.failureCount) / campaignDetails.campaign.totalDevices) * 100)}%</span>
                    </div>
                    <Progress value={Math.round(((campaignDetails.campaign.successCount + campaignDetails.campaign.failureCount) / campaignDetails.campaign.totalDevices) * 100)} />
                  </div>
                )}

                {/* Per-device updates */}
                <div>
                  <div className="text-sm font-medium mb-2">Device Update Status</div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {campaignDetails.updates.map(u => {
                      const sc = UPDATE_STATUS_CONFIG[u.status] ?? UPDATE_STATUS_CONFIG.pending;
                      return (
                        <div key={u.id} className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/20 text-sm">
                          <div className="flex items-center gap-2">
                            <Cpu className="w-3 h-3 text-muted-foreground" />
                            <span className="font-mono text-xs">{u.deviceDeviceId ?? `Device #${u.deviceId}`}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{u.fromVersion ?? "?"} → {u.toVersion}</span>
                            <Badge className={`text-xs border ${sc.color}`}>{u.status}</Badge>
                            {u.progress !== null && u.progress > 0 && u.status !== "success" && (
                              <span className="text-xs text-muted-foreground">{u.progress}%</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {campaignDetails.updates.length === 0 && (
                      <div className="text-center text-muted-foreground text-sm py-4">No device updates in this campaign</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center min-h-64">
              <CardContent className="text-center text-muted-foreground">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <div>Select a campaign to view details</div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Firmware Versions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Firmware Registry</CardTitle>
          <CardDescription>Available firmware versions for OTA deployment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-left">
                  <th className="pb-3 font-medium">Version</th>
                  <th className="pb-3 font-medium">Device Type</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Size</th>
                  <th className="pb-3 font-medium">Added</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {firmwareList.map(fw => (
                  <tr key={fw.id} className="hover:bg-muted/30">
                    <td className="py-3 font-mono font-semibold">{fw.version}</td>
                    <td className="py-3"><Badge variant="outline" className="text-xs">{DEVICE_TYPE_LABELS[fw.deviceType]}</Badge></td>
                    <td className="py-3">
                      <div className="flex gap-1">
                        {fw.isStable && <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30">Stable</Badge>}
                        {fw.isDeprecated && <Badge className="text-xs bg-red-500/20 text-red-400 border-red-500/30">Deprecated</Badge>}
                        {!fw.isStable && !fw.isDeprecated && <Badge className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30">Beta</Badge>}
                      </div>
                    </td>
                    <td className="py-3 text-muted-foreground text-xs">{fw.firmwareSize ? `${(fw.firmwareSize / 1024).toFixed(0)} KB` : "—"}</td>
                    <td className="py-3 text-muted-foreground text-xs">{new Date(fw.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 text-right">
                      {!fw.isStable && !fw.isDeprecated && (
                        <Button variant="ghost" size="sm" onClick={() => markStable.mutate({ id: fw.id })}>
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Mark Stable
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {firmwareList.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No firmware versions registered yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Firmware Dialog */}
      <Dialog open={showFirmwareDialog} onOpenChange={setShowFirmwareDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Download className="w-5 h-5" /> Add Firmware Version</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Version *</Label>
                <Input value={fwForm.version} onChange={e => setFwForm(f => ({ ...f, version: e.target.value }))} placeholder="2.4.1" />
              </div>
              <div className="space-y-2">
                <Label>Device Type *</Label>
                <Select value={fwForm.deviceType} onValueChange={v => setFwForm(f => ({ ...f, deviceType: v as DeviceType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DEVICE_TYPES.map(t => <SelectItem key={t} value={t}>{DEVICE_TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Firmware File <span className="text-muted-foreground text-xs">(upload .bin/.hex, or paste URL below)</span></Label>
              <div className="flex items-center gap-2">
                <label className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-border/60 bg-muted/10 hover:bg-muted/20 transition-colors text-sm text-muted-foreground">
                    <Download className="w-4 h-4 shrink-0" />
                    <span className="truncate">{fwFile ? fwFile.name : "Choose .bin / .hex file…"}</span>
                    {fwFile && <span className="text-[10px] font-mono ml-auto shrink-0">{(fwFile.size / 1024).toFixed(0)} KB</span>}
                  </div>
                  <input type="file" accept=".bin,.hex,.fw,.img" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) { setFwFile(f); setFwForm(prev => ({ ...prev, firmwareUrl: "" })); } }} />
                </label>
                {fwFile && <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => setFwFile(null)}>Clear</Button>}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground"><div className="flex-1 h-px bg-border/40" />or paste URL<div className="flex-1 h-px bg-border/40" /></div>
              <Input value={fwForm.firmwareUrl} onChange={e => { setFwForm(f => ({ ...f, firmwareUrl: e.target.value })); if (e.target.value) setFwFile(null); }} placeholder="https://cdn.example.com/firmware/v2.4.1.bin" disabled={!!fwFile} />
            </div>
            <div className="space-y-2">
              <Label>Release Notes</Label>
              <Input value={fwForm.releaseNotes} onChange={e => setFwForm(f => ({ ...f, releaseNotes: e.target.value }))} placeholder="Bug fixes, performance improvements..." />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isStable" checked={fwForm.isStable} onChange={e => setFwForm(f => ({ ...f, isStable: e.target.checked }))} className="w-4 h-4" />
              <Label htmlFor="isStable">Mark as stable release</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFirmwareDialog(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                const url = await uploadFirmwareFile();
                if (!url) { toast.error("Provide a firmware file or URL"); return; }
                addFirmware.mutate({ ...fwForm, firmwareUrl: url });
              }}
              disabled={(!fwForm.version) || (!fwFile && !fwForm.firmwareUrl) || fwUploading || addFirmware.isPending}
            >
              {fwUploading ? "Uploading…" : addFirmware.isPending ? "Adding…" : "Add Firmware"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Campaign Dialog */}
      <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5" /> New OTA Campaign</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Campaign Name *</Label>
              <Input value={campaignForm.name} onChange={e => setCampaignForm(f => ({ ...f, name: e.target.value }))} placeholder="RTU Fleet Update — v2.4.1" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={campaignForm.description} onChange={e => setCampaignForm(f => ({ ...f, description: e.target.value }))} placeholder="Quarterly security patch rollout" />
            </div>
            <div className="space-y-2">
              <Label>Target Device Type *</Label>
              <Select value={campaignForm.targetDeviceType} onValueChange={v => setCampaignForm(f => ({ ...f, targetDeviceType: v as DeviceType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DEVICE_TYPES.map(t => <SelectItem key={t} value={t}>{DEVICE_TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Firmware Version *</Label>
              <Select value={campaignForm.firmwareVersionId.toString()} onValueChange={v => setCampaignForm(f => ({ ...f, firmwareVersionId: parseInt(v) }))}>
                <SelectTrigger><SelectValue placeholder="Select firmware version" /></SelectTrigger>
                <SelectContent>
                  {firmwareList.filter(fw => fw.deviceType === campaignForm.targetDeviceType).map(fw => (
                    <SelectItem key={fw.id} value={fw.id.toString()}>
                      v{fw.version} {fw.isStable ? "✓ Stable" : "(beta)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rollout Strategy</Label>
              <Select value={campaignForm.rolloutStrategy} onValueChange={v => setCampaignForm(f => ({ ...f, rolloutStrategy: v as "sequential" | "parallel" | "canary" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequential">Sequential — one device at a time</SelectItem>
                  <SelectItem value="parallel">Parallel — all devices simultaneously</SelectItem>
                  <SelectItem value="canary">Canary — small batch first</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {campaignForm.rolloutStrategy === "canary" && (
              <div className="space-y-2">
                <Label>Canary Percentage</Label>
                <Input type="number" min={1} max={50} value={campaignForm.canaryPercentage} onChange={e => setCampaignForm(f => ({ ...f, canaryPercentage: parseInt(e.target.value) || 10 }))} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCampaignDialog(false)}>Cancel</Button>
            <Button onClick={() => createCampaign.mutate(campaignForm)} disabled={!campaignForm.name || !campaignForm.firmwareVersionId || createCampaign.isPending}>
              {createCampaign.isPending ? "Creating..." : "Create Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
