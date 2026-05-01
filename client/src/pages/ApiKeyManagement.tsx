import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Key, Plus, Trash2, Copy, Eye, EyeOff, Activity } from "lucide-react";

export default function ApiKeyManagement() {
  const [createOpen, setCreateOpen] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [form, setForm] = useState({ name: "", orgId: 1, expiresInDays: 365 });

  const { data: keys = [], refetch } = trpc.apiKeyManagement.list.useQuery({});
  const { data: stats } = trpc.apiKeyManagement.getStats.useQuery();
  const createMut = trpc.apiKeyManagement.create.useMutation({
    onSuccess: (d) => { setNewKey(d.rawKey); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const revokeMut = trpc.apiKeyManagement.revoke.useMutation({
    onSuccess: () => { toast.success("API key revoked"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const copyKey = (k: string) => { navigator.clipboard.writeText(k); toast.success("Copied to clipboard"); };

  const statCards = [
    { label: "Total Keys", value: String(stats?.total ?? 0), color: "text-blue-400" },
    { label: "Active Keys", value: String(stats?.active ?? 0), color: "text-green-400" },
    { label: "Revoked Keys", value: String(stats?.revoked ?? 0), color: "text-red-400" },
    { label: "Total Requests", value: Number(stats?.total_requests ?? 0).toLocaleString(), color: "text-purple-400" },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Key className="w-6 h-6 text-yellow-400" /> API Key Management</h1>
            <p className="text-slate-400 text-sm mt-1">Manage API keys for NDSEP data access integration</p>
          </div>
          <Dialog open={createOpen} onOpenChange={v => { setCreateOpen(v); if (!v) setNewKey(null); }}>
            <DialogTrigger asChild>
              <Button className="bg-yellow-600 hover:bg-yellow-700"><Plus className="w-4 h-4 mr-2" /> Create API Key</Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-800 border-slate-700 text-white">
              <DialogHeader><DialogTitle>{newKey ? "API Key Created" : "Create New API Key"}</DialogTitle></DialogHeader>
              {newKey ? (
                <div className="space-y-4">
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                    <p className="text-amber-400 text-sm font-medium mb-2">⚠ Store this key securely — it will not be shown again.</p>
                    <div className="flex items-center gap-2 bg-slate-900 rounded p-2">
                      <code className="text-green-400 text-xs flex-1 break-all">{showKey ? newKey : newKey.slice(0, 20) + "•".repeat(20)}</code>
                      <Button size="sm" variant="ghost" onClick={() => setShowKey(s => !s)}>{showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</Button>
                      <Button size="sm" variant="ghost" onClick={() => copyKey(newKey)}><Copy className="w-4 h-4" /></Button>
                    </div>
                  </div>
                  <Button className="w-full" onClick={() => { setCreateOpen(false); setNewKey(null); }}>Done</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div><Label>Key Name</Label><Input className="bg-slate-700 border-slate-600" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Production Integration" /></div>
                  <div><Label>Expires In (Days)</Label><Input type="number" className="bg-slate-700 border-slate-600" value={form.expiresInDays} onChange={e => setForm(f => ({ ...f, expiresInDays: parseInt(e.target.value) }))} /></div>
                  <Button className="w-full bg-yellow-600 hover:bg-yellow-700" disabled={!form.name || createMut.isPending} onClick={() => createMut.mutate({ name: form.name, orgId: form.orgId, scopes: ["read", "write"], expiresInDays: form.expiresInDays })}>
                    {createMut.isPending ? "Creating..." : "Create API Key"}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map(s => (
            <Card key={s.label} className="bg-slate-800 border-slate-700">
              <CardContent className="p-4 text-center">
                <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-400 mt-1">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader><CardTitle className="text-white flex items-center gap-2"><Activity className="w-5 h-5 text-yellow-400" /> API Keys</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-700 text-slate-400">
                  <th className="text-left py-2 px-3">Name</th><th className="text-left py-2 px-3">Key ID</th>
                  <th className="text-left py-2 px-3">Organization</th><th className="text-left py-2 px-3">Requests</th>
                  <th className="text-left py-2 px-3">Expires</th><th className="text-left py-2 px-3">Status</th>
                  <th className="text-left py-2 px-3">Actions</th>
                </tr></thead>
                <tbody>
                  {(keys as any[]).length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-slate-400">No API keys found</td></tr>
                  ) : (keys as any[]).map((k: any) => (
                    <tr key={k.key_id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-2 px-3 text-white font-medium">{k.name}</td>
                      <td className="py-2 px-3"><code className="text-xs text-slate-400 bg-slate-900 px-2 py-1 rounded">{String(k.key_id).slice(0, 16)}...</code></td>
                      <td className="py-2 px-3 text-slate-300">{k.org_name ?? "—"}</td>
                      <td className="py-2 px-3 text-slate-300">{Number(k.request_count ?? 0).toLocaleString()}</td>
                      <td className="py-2 px-3 text-slate-400">{k.expires_at ? new Date(String(k.expires_at)).toLocaleDateString("en-NG") : "Never"}</td>
                      <td className="py-2 px-3"><Badge className={k.status === "active" ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}>{String(k.status ?? "active")}</Badge></td>
                      <td className="py-2 px-3">
                        {k.status === "active" && (
                          <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => revokeMut.mutate({ keyId: String(k.key_id) })}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
