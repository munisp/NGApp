import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileText, Search, RefreshCw, Shield, Clock, User, Activity } from "lucide-react";

const ACTION_COLORS: Record<string, string> = {
  create: "text-green-400 bg-green-500/10",
  read: "text-blue-400 bg-blue-500/10",
  update: "text-yellow-400 bg-yellow-500/10",
  delete: "text-red-400 bg-red-500/10",
  login: "text-purple-400 bg-purple-500/10",
  logout: "text-zinc-400 bg-zinc-500/10",
  export: "text-orange-400 bg-orange-500/10",
  admin: "text-pink-400 bg-pink-500/10",
};

export default function Soc2Page() {
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterOutcome, setFilterOutcome] = useState("all");

  const { data: eventsResult, isLoading, refetch } = trpc.soc2.listAuditEvents.useQuery({
    action: filterAction === "all" ? undefined : filterAction,
    outcome: filterOutcome === "all" ? undefined : filterOutcome,
  });

  const { data: summary } = trpc.soc2.getSummary.useQuery();
  const { data: controls } = trpc.soc2.listControls.useQuery();

  const seedMutation = trpc.soc2.seedDefaultControls.useMutation({
    onSuccess: (data: { seeded: number }) => {
      toast.success(`SOC 2 controls seeded: ${data.seeded} controls added.`);
      refetch();
    },
  });

  const logMutation = trpc.soc2.logAuditEvent.useMutation({
    onSuccess: () => { toast.success("Test audit event logged"); refetch(); },
  });

  const events = eventsResult?.events ?? [];
  const total = eventsResult?.total ?? 0;

  const filteredEvents = search
    ? events.filter((e) =>
        e.action.toLowerCase().includes(search.toLowerCase()) ||
        (e.resource ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (e.userId ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : events;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <FileText className="w-7 h-7 text-purple-400" />
              SOC 2 Audit Trail & Compliance
            </h1>
            <p className="text-zinc-400 text-sm mt-1">System and Organization Controls — Trust Services Criteria</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => logMutation.mutate({ action: "test_audit", resource: "soc2_page", outcome: "success" })} disabled={logMutation.isPending}>
              <Activity className="w-4 h-4 mr-1" /> Log Test Event
            </Button>
            <Button size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
              <Shield className="w-4 h-4 mr-1" /> Seed Controls
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="text-zinc-400 text-xs mb-1">Total Events</div>
              <div className="text-2xl font-bold text-white">{total}</div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="text-zinc-400 text-xs mb-1">Recent Events (24h)</div>
              <div className="text-2xl font-bold text-blue-400">{summary?.recentEvents ?? 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="text-zinc-400 text-xs mb-1">Controls Implemented</div>
              <div className="text-2xl font-bold text-green-400">{summary?.byStatus?.in_place ?? 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="text-zinc-400 text-xs mb-1">SOC 2 Controls</div>
              <div className="text-2xl font-bold text-purple-400">{summary?.totalControls ?? 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              placeholder="Search events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-zinc-900 border-zinc-700 text-white"
            />
          </div>
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-36 bg-zinc-900 border-zinc-700 text-white">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="create">Create</SelectItem>
              <SelectItem value="read">Read</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
              <SelectItem value="login">Login</SelectItem>
              <SelectItem value="logout">Logout</SelectItem>
              <SelectItem value="export">Export</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterOutcome} onValueChange={setFilterOutcome}>
            <SelectTrigger className="w-36 bg-zinc-900 border-zinc-700 text-white">
              <SelectValue placeholder="Outcome" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Outcomes</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failure">Failure</SelectItem>
              <SelectItem value="denied">Denied</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Audit Events */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              Audit Events ({filteredEvents.length} of {total})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-zinc-500">Loading audit events...</div>
            ) : filteredEvents.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">
                No audit events found. Click "Log Test Event" to create one.
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {filteredEvents.map((event) => (
                  <div key={event.id} className="p-4 hover:bg-zinc-800/30 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded font-mono ${ACTION_COLORS[event.action] ?? "text-zinc-400 bg-zinc-500/10"}`}>
                            {event.action.toUpperCase()}
                          </span>
                          <Badge variant="outline" className={`text-xs ${
                            event.outcome === "success" ? "text-green-400 border-green-500/30" :
                            event.outcome === "failure" ? "text-red-400 border-red-500/30" :
                            "text-yellow-400 border-yellow-500/30"
                          }`}>
                            {event.outcome}
                          </Badge>
                        </div>
                        <div className="text-sm font-medium text-white">
                          {event.resource ?? "system"}{event.resourceId ? ` [${event.resourceId}]` : ""}
                        </div>
                        {event.details && (
                          <div className="text-xs text-zinc-500 mt-1 line-clamp-2">{event.details}</div>
                        )}
                        <div className="flex items-center gap-4 mt-1 text-xs text-zinc-500">
                          <span className="flex items-center gap-1"><User className="w-3 h-3" />{event.userId ?? "system"}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(event.eventTime).toLocaleString()}</span>
                          {event.ipAddress && <span>{event.ipAddress}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* SOC 2 Controls */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-base">Trust Services Criteria Controls ({controls?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {controls?.length === 0 ? (
              <div className="text-zinc-500 text-sm">No controls defined. Click "Seed Controls" to add defaults.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {controls?.map((ctrl) => (
                  <div key={ctrl.id} className="p-3 bg-zinc-800/50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                        {ctrl.controlRef}
                      </span>
                      <Badge variant="outline" className={`text-xs ${
                        ctrl.status === "in_place" ? "text-green-400 border-green-500/30" :
                        ctrl.status === "in_progress" ? "text-blue-400 border-blue-500/30" :
                        "text-zinc-400 border-zinc-700"
                      }`}>
                        {ctrl.status}
                      </Badge>
                    </div>
                    <div className="text-sm font-medium text-white">{ctrl.title}</div>
                    <div className="text-xs text-zinc-500 mt-1">
                      {ctrl.trustServiceCriteria} — {ctrl.controlType} — {ctrl.frequency}
                    </div>
                    {ctrl.owner && <div className="text-xs text-zinc-600 mt-1">Owner: {ctrl.owner}</div>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
