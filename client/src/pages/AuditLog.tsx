/**
 * AuditLog.tsx — Platform Audit Trail
 *
 * Displays all platform audit events from the auditLog table:
 *   - Searchable, filterable event table
 *   - Resource-type filter (wells, alarms, permits, etc.)
 *   - Action filter (CREATE, UPDATE, DELETE, LOGIN, etc.)
 *   - User filter
 *   - Time-range filter
 *   - Event detail drawer
 *   - Export to CSV
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Shield, Search, Download, RefreshCw, Eye,
  User, Clock, FileText, AlertTriangle, CheckCircle2,
  Filter, ChevronDown, ChevronRight, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface AuditEntry {
  id: number;
  userId?: string | null;
  userName?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
}

// ─── Config ────────────────────────────────────────────────────────────────────
const ACTION_CONFIG: Record<string, { color: string; label: string }> = {
  CREATE:     { color: "bg-emerald-950/40 text-emerald-400 border-emerald-800/40", label: "Create" },
  UPDATE:     { color: "bg-blue-950/40 text-blue-400 border-blue-800/40",         label: "Update" },
  DELETE:     { color: "bg-red-950/40 text-red-400 border-red-800/40",            label: "Delete" },
  LOGIN:      { color: "bg-purple-950/40 text-purple-400 border-purple-800/40",   label: "Login" },
  LOGOUT:     { color: "bg-slate-950/40 text-slate-400 border-slate-800/40",      label: "Logout" },
  APPROVE:    { color: "bg-amber-950/40 text-amber-400 border-amber-800/40",      label: "Approve" },
  REJECT:     { color: "bg-orange-950/40 text-orange-400 border-orange-800/40",   label: "Reject" },
  EXPORT:     { color: "bg-cyan-950/40 text-cyan-400 border-cyan-800/40",         label: "Export" },
  SEED:       { color: "bg-indigo-950/40 text-indigo-400 border-indigo-800/40",   label: "Seed" },
  TRIGGER:    { color: "bg-yellow-950/40 text-yellow-400 border-yellow-800/40",   label: "Trigger" },
};

const RESOURCE_ICONS: Record<string, LucideIcon> = {
  wells:      Shield,
  alarms:     AlertTriangle,
  permits:    FileText,
  users:      User,
  settings:   Filter,
};

function getActionConfig(action: string) {
  return ACTION_CONFIG[action?.toUpperCase()] ?? { color: "bg-muted/30 text-muted-foreground border-border/30", label: action };
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" });
}

// ─── Detail Dialog ─────────────────────────────────────────────────────────────
function AuditDetailDialog({ entry, onClose }: { entry: AuditEntry | null; onClose: () => void }) {
  if (!entry) return null;
  const ac = getActionConfig(entry.action);
  return (
    <Dialog open={!!entry} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Shield className="w-4 h-4 text-primary" />
            Audit Event #{entry.id}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Action</div>
              <Badge variant="outline" className={cn("text-xs", ac.color)}>{ac.label}</Badge>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Resource</div>
              <span className="font-mono text-xs">{entry.resource}{entry.resourceId ? ` / ${entry.resourceId}` : ""}</span>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">User</div>
              <span>{entry.userName ?? entry.userId ?? "System"}</span>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Timestamp</div>
              <span>{formatDate(entry.createdAt)}</span>
            </div>
            {entry.ipAddress && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">IP Address</div>
                <span className="font-mono text-xs">{entry.ipAddress}</span>
              </div>
            )}
            {entry.userAgent && (
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground mb-1">User Agent</div>
                <span className="font-mono text-xs break-all text-muted-foreground">{entry.userAgent}</span>
              </div>
            )}
          </div>
          {entry.details && Object.keys(entry.details).length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-2">Details</div>
              <pre className="bg-muted/20 border border-border/40 rounded p-3 text-xs overflow-auto max-h-64 font-mono">
                {JSON.stringify(entry.details, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AuditLog() {
  const [search, setSearch] = useState("");
  const [resourceFilter, setResourceFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [limit, setLimit] = useState(200);

  const { data: rawEntries, isLoading, refetch, isFetching } = trpc.audit.list.useQuery({
    resource: resourceFilter !== "all" ? resourceFilter : undefined,
    limit,
  });

  const entries = (rawEntries as AuditEntry[] | undefined) ?? [];

  // Derive unique resource types and actions from data
  const resourceTypes = useMemo(() => {
    const types = new Set(entries.map(e => e.resource));
    return Array.from(types).sort();
  }, [entries]);

  const actionTypes = useMemo(() => {
    const types = new Set(entries.map(e => e.action?.toUpperCase()));
    return Array.from(types).sort();
  }, [entries]);

  // Filter entries
  const filtered = useMemo(() => {
    return entries.filter(e => {
      const matchSearch = !search ||
        e.resource?.toLowerCase().includes(search.toLowerCase()) ||
        e.action?.toLowerCase().includes(search.toLowerCase()) ||
        e.userName?.toLowerCase().includes(search.toLowerCase()) ||
        e.userId?.toLowerCase().includes(search.toLowerCase()) ||
        e.resourceId?.toLowerCase().includes(search.toLowerCase());
      const matchAction = actionFilter === "all" || e.action?.toUpperCase() === actionFilter;
      return matchSearch && matchAction;
    });
  }, [entries, search, actionFilter]);

  // Stats
  const stats = useMemo(() => {
    const byAction: Record<string, number> = {};
    for (const e of entries) {
      const k = e.action?.toUpperCase() ?? "UNKNOWN";
      byAction[k] = (byAction[k] ?? 0) + 1;
    }
    const uniqueUsers = new Set(entries.map(e => e.userId ?? e.userName).filter(Boolean)).size;
    const today = entries.filter(e => {
      const d = new Date(e.createdAt);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length;
    return { total: entries.length, byAction, uniqueUsers, today };
  }, [entries]);

  // Export CSV
  function exportCsv() {
    const header = "ID,Timestamp,Action,Resource,Resource ID,User,IP";
    const rows = filtered.map(e =>
      [e.id, formatDate(e.createdAt), e.action, e.resource, e.resourceId ?? "", e.userName ?? e.userId ?? "", e.ipAddress ?? ""].join(",")
    );
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "audit-log.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Audit Log
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Complete platform activity trail — all user actions, system events, and data changes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("w-4 h-4 mr-1", isFetching && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="w-4 h-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Events", value: stats.total.toLocaleString(), icon: FileText, color: "text-primary" },
          { label: "Today", value: stats.today.toLocaleString(), icon: Clock, color: "text-blue-400" },
          { label: "Unique Users", value: stats.uniqueUsers.toLocaleString(), icon: User, color: "text-emerald-400" },
          { label: "Filtered", value: filtered.length.toLocaleString(), icon: Filter, color: "text-amber-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-card border-border/50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <Icon className={cn("w-5 h-5", color)} />
                <div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="text-xl font-bold">{value}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action breakdown */}
      {Object.keys(stats.byAction).length > 0 && (
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">Event Breakdown by Action</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byAction).sort((a, b) => b[1] - a[1]).map(([action, count]) => {
                const ac = getActionConfig(action);
                return (
                  <button
                    key={action}
                    onClick={() => setActionFilter(actionFilter === action ? "all" : action)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all",
                      ac.color,
                      actionFilter === action ? "ring-2 ring-primary/50" : "opacity-80 hover:opacity-100"
                    )}
                  >
                    {action} <span className="font-bold">{count}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search resource, action, user..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={resourceFilter} onValueChange={setResourceFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Resource type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Resources</SelectItem>
            {resourceTypes.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {actionTypes.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(limit)} onValueChange={v => setLimit(Number(v))}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="100">Last 100</SelectItem>
            <SelectItem value="200">Last 200</SelectItem>
            <SelectItem value="500">Last 500</SelectItem>
            <SelectItem value="1000">Last 1000</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="bg-card border-border/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="font-semibold text-sm">Events ({filtered.length})</span>
          <span className="text-xs text-muted-foreground">Showing most recent first</span>
        </div>
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">
            <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-40" />
            Loading audit events...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Shield className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No audit events found</p>
            <p className="text-xs mt-1">Events are recorded as users interact with the platform</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Resource ID</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(entry => {
                  const ac = getActionConfig(entry.action);
                  const ResourceIcon = RESOURCE_ICONS[entry.resource] ?? FileText;
                  return (
                    <TableRow key={entry.id} className="hover:bg-muted/10 cursor-pointer" onClick={() => setSelectedEntry(entry)}>
                      <TableCell className="text-xs text-muted-foreground font-mono">{entry.id}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(entry.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-xs", ac.color)}>{ac.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <ResourceIcon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-mono text-xs">{entry.resource}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{entry.resourceId ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <User className="w-3 h-3 text-muted-foreground" />
                          {entry.userName ?? entry.userId ?? <span className="text-muted-foreground">System</span>}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{entry.ipAddress ?? "—"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); setSelectedEntry(entry); }}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Load more */}
      {filtered.length >= limit && (
        <div className="text-center">
          <Button variant="outline" onClick={() => setLimit(l => l + 200)}>
            <ChevronDown className="w-4 h-4 mr-1" />
            Load 200 more
          </Button>
        </div>
      )}

      {/* Detail dialog */}
      <AuditDetailDialog entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
    </div>
  );
}
