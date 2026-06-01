import { useState, useEffect } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Cpu, Plus, RefreshCw, Copy, Trash2, Wifi, WifiOff,
  Settings, Terminal, Activity, AlertTriangle, CheckCircle2, Clock, Pencil, Search
} from "lucide-react";

const DEVICE_TYPE_LABELS: Record<string, string> = {
  RTU: "RTU", PLC: "PLC", SCADA_GATEWAY: "SCADA Gateway",
  FLOW_COMPUTER: "Flow Computer", SENSOR_HUB: "Sensor Hub",
  ESP_CONTROLLER: "ESP Controller", WELLHEAD_CONTROLLER: "Wellhead Controller",
  EDGE_NODE: "Edge Node",
};

// ── Heartbeat helpers ──────────────────────────────────────────────────────
function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), intervalMs); return () => clearInterval(id); }, [intervalMs]);
  return now;
}

function relativeTime(ts: string | number | Date | null | undefined, _now: number): string {
  if (!ts) return "Never";
  const diffMs = _now - new Date(ts as string).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function heartbeatColor(ts: string | number | Date | null | undefined, _now: number): string {
  if (!ts) return "text-slate-500";
  const diffMin = (_now - new Date(ts as string).getTime()) / 60_000;
  if (diffMin < 5) return "text-green-400";
  if (diffMin < 30) return "text-amber-400";
  return "text-red-400";
}

function heartbeatDot(ts: string | number | Date | null | undefined, _now: number): string {
  if (!ts) return "bg-slate-500";
  const diffMin = (_now - new Date(ts as string).getTime()) / 60_000;
  if (diffMin < 5) return "bg-green-400 animate-pulse";
  if (diffMin < 30) return "bg-amber-400";
  return "bg-red-400";
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  online: { color: "bg-green-500/20 text-green-400 border-green-500/30", icon: <Wifi className="w-3 h-3" /> },
  offline: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: <WifiOff className="w-3 h-3" /> },
  provisioning: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: <Clock className="w-3 h-3" /> },
  maintenance: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: <Settings className="w-3 h-3" /> },
  error: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: <AlertTriangle className="w-3 h-3" /> },
  decommissioned: { color: "bg-slate-500/20 text-slate-400 border-slate-500/30", icon: <Trash2 className="w-3 h-3" /> },
};

const DEVICE_TYPES = ["RTU", "PLC", "SCADA_GATEWAY", "FLOW_COMPUTER", "SENSOR_HUB", "ESP_CONTROLLER", "WELLHEAD_CONTROLLER", "EDGE_NODE"] as const;

type DeviceType = typeof DEVICE_TYPES[number];

interface RegisterForm {
  deviceId: string; name: string; deviceType: DeviceType;
  manufacturer: string; model: string; serialNumber: string;
  firmwareVersion: string; hardwareRevision: string;
  wellId: string; fieldLocation: string; ipAddress: string; macAddress: string; notes: string;
}

const DEFAULT_FORM: RegisterForm = {
  deviceId: "", name: "", deviceType: "RTU",
  manufacturer: "", model: "", serialNumber: "",
  firmwareVersion: "", hardwareRevision: "",
  wellId: "", fieldLocation: "", ipAddress: "", macAddress: "", notes: "",
};

export default function DeviceManagement() {
  const now = useNow(15_000);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [form, setForm] = useState<RegisterForm>(DEFAULT_FORM);
  const [newDeviceToken, setNewDeviceToken] = useState<{ token: string; bootstrapCommand: string; deviceId: string } | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const [tokenResult, setTokenResult] = useState<{ token: string; expiresAt: Date } | null>(null);
  const [editDevice, setEditDevice] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ name: "", fieldLocation: "", notes: "" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: deviceList = [], refetch } = trpc.deviceManagement.listDevices.useQuery({}, { refetchInterval: 30_000 });
  const { data: stats } = trpc.deviceManagement.getStats.useQuery();

  const registerDevice = trpc.deviceManagement.registerDevice.useMutation({
    onSuccess: (data) => {
      setNewDeviceToken({ token: data.provisioningToken!, bootstrapCommand: data.bootstrapCommand!, deviceId: data.deviceId });
      refetch();
      toast.success(`Device ${data.deviceId} registered`);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteDevice = trpc.deviceManagement.deleteDevice.useMutation({
    onSuccess: () => { refetch(); toast.success("Device decommissioned"); },
    onError: (err) => toast.error(err.message),
  });

  const generateToken = trpc.deviceManagement.generateToken.useMutation({
    onSuccess: (data) => {
      setTokenResult(data);
      toast.success("New provisioning token generated");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateStatus = trpc.deviceManagement.updateStatus.useMutation({
    onSuccess: () => { refetch(); toast.success("Status updated"); },
    onError: (err) => toast.error(err.message),
  });

  const updateDevice = trpc.deviceManagement.updateDevice.useMutation({
    onSuccess: () => { refetch(); setEditDevice(null); toast.success("Device updated"); },
    onError: (err) => toast.error(err.message),
  });

  function handleRegister() {
    const cleanForm = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v === "" ? undefined : v])
    ) as RegisterForm;
    registerDevice.mutate(cleanForm);
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    toast.success("Copied to clipboard");
  }

  const onlineCount = stats?.online ?? 0;
  const totalCount = stats?.total ?? 0;
  const offlineCount = stats?.offline ?? 0;
  const provisioningCount = stats?.provisioning ?? 0;

  const filteredDevices = (deviceList as any[]).filter((d: any) => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (typeFilter !== "all" && d.deviceType !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!d.deviceId.toLowerCase().includes(q) && !(d.name ?? "").toLowerCase().includes(q) && !(d.fieldLocation ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const deviceTypes = Array.from(new Set((deviceList as any[]).map((d: any) => d.deviceType).filter(Boolean)));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Device Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Register, provision, and monitor field devices</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button onClick={() => { setShowRegisterDialog(true); setForm(DEFAULT_FORM); setNewDeviceToken(null); }}>
            <Plus className="w-4 h-4 mr-2" /> Register Device
          </Button>
        </div>
      </div>

      {/* Fleet stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Devices", value: totalCount, color: "border-slate-500/20", icon: <Cpu className="w-5 h-5 text-slate-400" /> },
          { label: "Online", value: onlineCount, color: "border-green-500/20", icon: <Wifi className="w-5 h-5 text-green-400" /> },
          { label: "Offline", value: offlineCount, color: "border-red-500/20", icon: <WifiOff className="w-5 h-5 text-red-400" /> },
          { label: "Provisioning", value: provisioningCount, color: "border-blue-500/20", icon: <Clock className="w-5 h-5 text-blue-400" /> },
          { label: "Maintenance", value: stats?.maintenance ?? 0, color: "border-amber-500/20", icon: <Settings className="w-5 h-5 text-amber-400" /> },
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

      {/* Device table */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex-1">
              <CardTitle className="text-base">Device Registry</CardTitle>
              <CardDescription>All registered field devices and their current status</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search devices..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-8 text-sm bg-background border-border/50 w-52"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 h-8 text-sm bg-background border-border/50">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="provisioning">Provisioning</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-32 h-8 text-sm bg-background border-border/50">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {deviceTypes.map((t: string) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-left">
                  <th className="pb-3 font-medium">Device ID</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Firmware</th>
                  <th className="pb-3 font-medium">Well / Location</th>
                  <th className="pb-3 font-medium">Last Seen</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDevices.map(d => {
                  const sc = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.offline;
                  return (
                    <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3">
                        <div className="font-mono text-xs font-semibold">{d.deviceId}</div>
                        <div className="text-xs text-muted-foreground">{d.name}</div>
                      </td>
                      <td className="py-3">
                        <Badge variant="outline" className="text-xs">{DEVICE_TYPE_LABELS[d.deviceType] ?? d.deviceType}</Badge>
                      </td>
                      <td className="py-3">
                        <Badge className={`text-xs border gap-1 ${sc.color}`}>{sc.icon}{d.status}</Badge>
                      </td>
                      <td className="py-3 font-mono text-xs">{d.firmwareVersion ?? "—"}</td>
                      <td className="py-3 text-xs text-muted-foreground">
                        {d.wellId ? <span className="text-foreground">{d.wellId}</span> : "—"}
                        {d.fieldLocation && <div>{d.fieldLocation}</div>}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${heartbeatDot(d.lastSeenAt, now)}`} />
                          <div>
                            <div className={`text-xs font-mono font-medium ${heartbeatColor(d.lastSeenAt, now)}`}>
                              {relativeTime(d.lastSeenAt, now)}
                            </div>
                            {d.lastSeenAt && (
                              <div className="text-[10px] text-muted-foreground">
                                {new Date(d.lastSeenAt).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" title="Generate new token"
                            onClick={() => { setSelectedDevice(d.id); generateToken.mutate({ id: d.id }); }}>
                            <Terminal className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm" title="Edit device"
                            onClick={() => { setEditDevice(d); setEditForm({ name: d.name ?? "", fieldLocation: d.fieldLocation ?? "", notes: d.notes ?? "" }); }}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm" title="Toggle maintenance mode"
                            onClick={() => updateStatus.mutate({ id: d.id, status: d.status === "maintenance" ? "online" : "maintenance" })}>
                            <Settings className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300"
                            onClick={() => { if (confirm(`Decommission ${d.deviceId}?`)) deleteDevice.mutate({ id: d.id }); }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {deviceList.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <Cpu className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <div>No devices registered yet</div>
                      <div className="text-xs mt-1">Click "Register Device" to add your first field device</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Device Dialog */}
      <Dialog open={!!editDevice} onOpenChange={() => setEditDevice(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4" /> Edit Device</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Display Name</Label>
              <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Field Location</Label>
              <Input value={editForm.fieldLocation} onChange={e => setEditForm(f => ({ ...f, fieldLocation: e.target.value }))} placeholder="e.g. Permian Basin, Pad 3" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Input value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDevice(null)}>Cancel</Button>
            <Button onClick={() => updateDevice.mutate({ id: editDevice?.id, ...editForm })} disabled={updateDevice.isPending}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Token result dialog */}
      {tokenResult && (
        <Dialog open={!!tokenResult} onOpenChange={() => setTokenResult(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Terminal className="w-5 h-5" /> New Provisioning Token</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <div className="text-xs text-muted-foreground">Token (valid until {new Date(tokenResult.expiresAt).toLocaleString()})</div>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-background p-2 rounded border border-border flex-1 truncate">{tokenResult.token}</code>
                  <Button variant="outline" size="sm" onClick={() => copyText(tokenResult.token)}><Copy className="w-3 h-3" /></Button>
                </div>
              </div>
            </div>
            <DialogFooter><Button onClick={() => setTokenResult(null)}>Close</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Register Dialog */}
      <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5" /> Register New Device</DialogTitle>
          </DialogHeader>
          {!newDeviceToken ? (
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="space-y-2">
                <Label>Device ID * <span className="text-muted-foreground text-xs">(unique, e.g. RTU-WELL-001)</span></Label>
                <Input value={form.deviceId} onChange={e => setForm(f => ({ ...f, deviceId: e.target.value }))} placeholder="RTU-WELL-001" />
              </div>
              <div className="space-y-2">
                <Label>Display Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Well-1 RTU" />
              </div>
              <div className="space-y-2">
                <Label>Device Type *</Label>
                <Select value={form.deviceType} onValueChange={v => setForm(f => ({ ...f, deviceType: v as DeviceType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEVICE_TYPES.map(t => <SelectItem key={t} value={t}>{DEVICE_TYPE_LABELS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Manufacturer</Label>
                <Input value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))} placeholder="ABB / Emerson / Honeywell" />
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="e.g. SCADAPack 350E" />
              </div>
              <div className="space-y-2">
                <Label>Serial Number</Label>
                <Input value={form.serialNumber} onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Firmware Version</Label>
                <Input value={form.firmwareVersion} onChange={e => setForm(f => ({ ...f, firmwareVersion: e.target.value }))} placeholder="2.3.1" />
              </div>
              <div className="space-y-2">
                <Label>Hardware Revision</Label>
                <Input value={form.hardwareRevision} onChange={e => setForm(f => ({ ...f, hardwareRevision: e.target.value }))} placeholder="Rev B" />
              </div>
              <div className="space-y-2">
                <Label>Well ID</Label>
                <Input value={form.wellId} onChange={e => setForm(f => ({ ...f, wellId: e.target.value }))} placeholder="WELL-001" />
              </div>
              <div className="space-y-2">
                <Label>Field Location</Label>
                <Input value={form.fieldLocation} onChange={e => setForm(f => ({ ...f, fieldLocation: e.target.value }))} placeholder="Burgan Field, Block 3" />
              </div>
              <div className="space-y-2">
                <Label>IP Address</Label>
                <Input value={form.ipAddress} onChange={e => setForm(f => ({ ...f, ipAddress: e.target.value }))} placeholder="192.168.1.101" />
              </div>
              <div className="space-y-2">
                <Label>MAC Address</Label>
                <Input value={form.macAddress} onChange={e => setForm(f => ({ ...f, macAddress: e.target.value }))} placeholder="AA:BB:CC:DD:EE:FF" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Notes</Label>
                <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Installation notes..." />
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Device {newDeviceToken.deviceId} registered!</span>
              </div>
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-3">
                <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
                  <AlertTriangle className="w-4 h-4" /> Save this provisioning token — it will not be shown again
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Provisioning Token</div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-background p-2 rounded border border-border flex-1 break-all">{newDeviceToken.token}</code>
                    <Button variant="outline" size="sm" onClick={() => copyText(newDeviceToken.token)}><Copy className="w-3 h-3" /></Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">QR Code — scan with field device provisioning app</div>
                  <div className="flex justify-center p-3 bg-white rounded-lg">
                    <QRCodeCanvas
                      value={`og-rmm://provision?deviceId=${encodeURIComponent(newDeviceToken.deviceId)}&token=${encodeURIComponent(newDeviceToken.token)}&server=${encodeURIComponent(window.location.origin)}`}
                      size={160}
                      level="M"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Bootstrap Command</div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-background p-2 rounded border border-border flex-1 break-all">{newDeviceToken.bootstrapCommand}</code>
                    <Button variant="outline" size="sm" onClick={() => copyText(newDeviceToken.bootstrapCommand)}><Copy className="w-3 h-3" /></Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            {!newDeviceToken ? (
              <>
                <Button variant="outline" onClick={() => setShowRegisterDialog(false)}>Cancel</Button>
                <Button onClick={handleRegister} disabled={!form.deviceId || !form.name || registerDevice.isPending}>
                  {registerDevice.isPending ? "Registering..." : "Register Device"}
                </Button>
              </>
            ) : (
              <Button onClick={() => setShowRegisterDialog(false)}>Done</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
