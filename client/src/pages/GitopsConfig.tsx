import React from "react";
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GitBranch, RefreshCw, Download, CheckCircle , Trash2 } from "lucide-react";

export default function GitopsConfig() {
  const [showSnapshot, setShowSnapshot] = useState(false);
  const [snapshotType, setSnapshotType] = useState("policy");
  const [showDetail, setShowDetail] = useState<any>(null);

  const { data: snapshots = [], refetch } = trpc.gitopsConfig.list.useQuery({});
  const { data: stats } = trpc.gitopsConfig.stats.useQuery();

  const createMutation = trpc.gitopsConfig.snapshot.useMutation({
    onSuccess: () => { toast.success("Config snapshot created"); setShowSnapshot(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const applyMutation = trpc.gitopsConfig.applySnapshot.useMutation({
    onSuccess: () => { toast.success("Config applied successfully"); setShowDetail(null); utils.gitopsConfig.list.invalidate().catch(() => {}); },
    onError: (e) => toast.error(e.message),
  });
  const utils = trpc.useUtils();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const deleteMutation = trpc.gitopsConfig.delete.useMutation({
    onSuccess: () => {
      toast.success("Config snapshot deleted successfully");
      setDeleteId(null);
      utils.gitopsConfig.list.invalidate().catch(() => {});;
    },
    onError: (err) => toast.error(err.message || "Delete failed"),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">GitOps Config Sync</h1>
          <p className="text-gray-400 text-sm mt-1">Version-controlled policy and configuration snapshots with audit trail</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-gray-600" onClick={() => refetch()}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
          <Button onClick={() => setShowSnapshot(true)} className="bg-violet-600 hover:bg-violet-700"><GitBranch className="w-4 h-4 mr-2" /> New Snapshot</Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4"><div className="text-gray-400 text-sm">Total Snapshots</div><div className="text-2xl font-bold text-white">{stats?.total || 0}</div></div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4"><div className="text-gray-400 text-sm">Applied</div><div className="text-2xl font-bold text-green-400">{stats?.applied || 0}</div></div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4"><div className="text-gray-400 text-sm">Pending</div><div className="text-2xl font-bold text-yellow-400">{stats?.pending || 0}</div></div>
      </div>
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-700 bg-gray-900/50">
            <tr>{["Snapshot ID", "Type", "Version", "Hash", "Status", "Created", "Actions"].map(h => <th key={h} className="text-left px-4 py-3 text-gray-400 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {(snapshots as any[]).length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-500"><GitBranch className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>No config snapshots yet</p></td></tr>
            ) : (snapshots as any[]).map((s: any) => (
              <tr key={s.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="px-4 py-3 font-mono text-xs text-violet-400">CS-{String(s.id).padStart(6, "0")}</td>
                <td className="px-4 py-3"><Badge variant="outline" className="text-xs border-gray-600 text-gray-300">{s.configType}</Badge></td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400">{s.version}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-xs truncate">{s.contentHash?.slice(0, 16)}...</td>
                <td className="px-4 py-3"><Badge className={`text-xs ${s.status === "applied" ? "bg-green-500/20 text-green-400" : s.status === "pending" ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"}`}>{s.status}</Badge></td>
                <td className="px-4 py-3 text-xs text-gray-400">{s.createdAt ? new Date(s.createdAt).toLocaleString() : "—"}</td>
                <td className="px-4 py-3 flex gap-1">
                  <Button size="sm" variant="outline" className="text-xs border-gray-600" onClick={() => setShowDetail(s)}><Download className="w-3 h-3" /></Button>
                  {s.status === "pending" && <Button size="sm" className="text-xs bg-green-600/20 hover:bg-green-600/40 text-green-300 border border-green-500/30" onClick={() => applyMutation.mutate({ id: s.id })}><CheckCircle className="w-3 h-3 mr-1" />Apply</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={showSnapshot} onOpenChange={setShowSnapshot}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader><DialogTitle>Create Config Snapshot</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Config Type</Label>
              <Select value={snapshotType} onValueChange={setSnapshotType}>
                <SelectTrigger className="bg-gray-800 border-gray-700 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="policy">Policy</SelectItem><SelectItem value="network">Network</SelectItem><SelectItem value="compliance">Compliance</SelectItem><SelectItem value="worker">Worker</SelectItem><SelectItem value="full">Full Platform</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="bg-violet-500/10 border border-violet-500/30 rounded-lg p-3 text-xs text-violet-300">Snapshot will capture the current state of all {snapshotType} configurations and create a versioned, hash-verified record in the GitOps audit trail.</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSnapshot(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate({ configType: snapshotType })} disabled={createMutation.isPending}>{createMutation.isPending ? "Snapshotting..." : "Create Snapshot"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl">
          <DialogHeader><DialogTitle>Snapshot Detail: CS-{String(showDetail?.id).padStart(6, "0")}</DialogTitle></DialogHeader>
          <div className="space-y-2 text-xs font-mono">
            <div className="bg-gray-800 rounded p-3 space-y-1">
              <div><span className="text-gray-400">Type:</span> <span className="text-white">{showDetail?.configType}</span></div>
              <div><span className="text-gray-400">Version:</span> <span className="text-white">{showDetail?.version}</span></div>
              <div><span className="text-gray-400">Hash:</span> <span className="text-violet-400 break-all">{showDetail?.contentHash}</span></div>
              <div><span className="text-gray-400">Status:</span> <span className="text-white">{showDetail?.status}</span></div>
              <div><span className="text-gray-400">Created:</span> <span className="text-white">{showDetail?.createdAt ? new Date(showDetail.createdAt).toISOString() : "—"}</span></div>
            </div>
            {showDetail?.configData && <pre className="bg-gray-800 rounded p-3 overflow-auto max-h-64 text-gray-300">{JSON.stringify(JSON.parse(showDetail.configData || "{}"), null, 2)}</pre>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowDetail(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
