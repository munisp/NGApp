/**
 * OSDUDataExplorer.tsx — OSDU (Open Subsurface Data Universe) Data Explorer
 *
 * Provides OSDU R3-compatible search, export, and metadata management for
 * well master data, wellbores, and work product components.
 *
 * Reference: https://community.opengroup.org/osdu/data/data-definitions
 */

import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  Database, Search, Download, FileJson, Globe, Shield,
  Layers, ChevronRight, Copy, CheckCircle2, Info
} from "lucide-react";

// ── Schema Browser Component ─────────────────────────────────────────────────

function SchemaBrowser() {
  const { data: schemas, isLoading } = trpc.osdu.schemas.useQuery();

  if (isLoading) return <div className="text-muted-foreground text-sm p-4">Loading schemas...</div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        OSDU R3 schema definitions supported by this platform. All exported records conform to these schemas.
      </p>
      {schemas?.supportedKinds.map(schema => (
        <Card key={schema.kind} className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-mono">{schema.kind}</CardTitle>
              <Badge variant="outline" className="text-xs">R3</Badge>
            </div>
            <CardDescription>{schema.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {schema.fields.map(f => (
                <Badge key={f} variant="secondary" className="text-xs font-mono">{f}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
      <div className="text-xs text-muted-foreground mt-4 p-3 bg-muted/30 rounded-md">
        <strong>Platform:</strong> {schemas?.platform} &nbsp;|&nbsp;
        <strong>Standard:</strong> {schemas?.version}
      </div>
    </div>
  );
}

// ── Search Component ──────────────────────────────────────────────────────────

function OSDUSearch() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [wellTypeFilter, setWellTypeFilter] = useState("all");
  const [searchTrigger, setSearchTrigger] = useState(0);

  const { data: results, isLoading } = trpc.osdu.search.useQuery({
    kind: "osdu:wks:master-data--Well:1.0.0",
    query: query || undefined,
    filter: {
      status: statusFilter !== "all" ? statusFilter : undefined,
      wellType: wellTypeFilter !== "all" ? wellTypeFilter : undefined,
    },
    limit: 25,
  }, { enabled: true });

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success("OSDU ID copied to clipboard");
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by well name or ID..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && setSearchTrigger(t => t + 1)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="PRODUCING">Producing</SelectItem>
            <SelectItem value="SHUT_IN">Shut In</SelectItem>
            <SelectItem value="DRILLING">Drilling</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <Select value={wellTypeFilter} onValueChange={setWellTypeFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Well Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="OIL">Oil</SelectItem>
            <SelectItem value="GAS">Gas</SelectItem>
            <SelectItem value="WATER_INJECTION">Water Injection</SelectItem>
            <SelectItem value="OBSERVATION">Observation</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm p-4">Searching OSDU records...</div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            {results?.totalCount ?? 0} records found · Kind: <span className="font-mono">osdu:wks:master-data--Well:1.0.0</span>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>OSDU ID</TableHead>
                  <TableHead>Facility Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Well Type</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead>Depth (m)</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results?.results.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs max-w-[200px] truncate">
                      <div className="flex items-center gap-1">
                        <span className="truncate">{r.id}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0"
                          onClick={() => handleCopyId(r.id)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{r.data.FacilityName}</TableCell>
                    <TableCell>
                      <Badge variant={r.data.WellStatus === "PRODUCING" ? "default" : "secondary"} className="text-xs">
                        {r.data.WellStatus ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{r.data.WellType ?? "—"}</TableCell>
                    <TableCell className="text-sm">{r.data.FieldID ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {r.data.TotalDepthMD_m ? `${r.data.TotalDepthMD_m.toFixed(0)} m` : "—"}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
                {(!results?.results || results.results.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No records found. Try adjusting your search filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Export Component ──────────────────────────────────────────────────────────

function OSDUExport() {
  const [wellId, setWellId] = useState("");
  const [exportedRecord, setExportedRecord] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const exportMutation = trpc.osdu.exportWell.useQuery(
    { wellId },
    { enabled: false }
  );

  const bulkExport = trpc.osdu.exportAllWells.useQuery(
    { limit: 100 },
    { enabled: false }
  );

  const handleExportSingle = async () => {
    if (!wellId.trim()) {
      toast.error("Please enter a Well ID");
      return;
    }
    const result = await exportMutation.refetch();
    if (result.data) {
      setExportedRecord(result.data.osduRecord);
      toast.success("OSDU record exported successfully");
    }
  };

  const handleBulkExport = async () => {
    const result = await bulkExport.refetch();
    if (result.data) {
      const blob = new Blob([JSON.stringify(result.data.records, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `osdu-wells-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${result.data.totalCount} OSDU records`);
    }
  };

  const handleCopy = () => {
    if (exportedRecord) {
      navigator.clipboard.writeText(JSON.stringify(exportedRecord, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (exportedRecord) {
      const blob = new Blob([JSON.stringify(exportedRecord, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `osdu-well-${wellId}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Single Well Export */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileJson className="h-4 w-4" />
              Single Well Export
            </CardTitle>
            <CardDescription>Export one well as OSDU R3 master data record</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Enter Well ID (e.g. WELL-001)"
              value={wellId}
              onChange={e => setWellId(e.target.value)}
            />
            <Button
              onClick={handleExportSingle}
              disabled={exportMutation.isFetching}
              className="w-full"
            >
              {exportMutation.isFetching ? "Exporting..." : "Export as OSDU JSON"}
            </Button>
          </CardContent>
        </Card>

        {/* Bulk Export */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="h-4 w-4" />
              Bulk Export
            </CardTitle>
            <CardDescription>Export all wells as OSDU R3 records (JSON Lines)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-md">
              Exports up to 100 well records in OSDU-compatible JSON format.
              Compatible with OSDU R3 ingestion APIs.
            </div>
            <Button
              variant="outline"
              onClick={handleBulkExport}
              disabled={bulkExport.isFetching}
              className="w-full"
            >
              {bulkExport.isFetching ? "Exporting..." : "Download All Wells (JSON)"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Exported Record Preview */}
      {exportedRecord && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Exported Record
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied!" : "Copy"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted/30 p-4 rounded-md overflow-auto max-h-96 font-mono">
              {JSON.stringify(exportedRecord, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Fleet Query Component ─────────────────────────────────────────────────────

function FleetQuery() {
  const [queryType, setQueryType] = useState<
    "critical_alarms" | "low_production_wells" | "high_water_cut_wells" |
    "shut_in_wells" | "production_summary" | "field_summary"
  >("critical_alarms");

  const { data, isLoading, refetch } = trpc.osdu.queryFleet.useQuery(
    { queryType, limit: 20 },
    { enabled: true }
  );

  const queryOptions = [
    { value: "critical_alarms", label: "Critical & High Alarms" },
    { value: "low_production_wells", label: "Low Production Wells (<50% capacity)" },
    { value: "high_water_cut_wells", label: "High Water Cut Wells (>70%)" },
    { value: "shut_in_wells", label: "Shut-In / Suspended Wells" },
    { value: "production_summary", label: "Fleet Production Summary" },
    { value: "field_summary", label: "Field-by-Field Summary" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Select value={queryType} onValueChange={(v: any) => setQueryType(v)}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {queryOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => refetch()} disabled={isLoading}>
          {isLoading ? "Querying..." : "Run Query"}
        </Button>
      </div>

      {data && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            {data.count} record(s) returned for <span className="font-mono">{data.queryType}</span>
          </div>
          <div className="rounded-md border overflow-auto max-h-96">
            <pre className="text-xs p-4 font-mono whitespace-pre-wrap">
              {JSON.stringify(data.data, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OSDUDataExplorer() {
  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Database className="h-6 w-6 text-primary" />
              OSDU Data Explorer
            </h1>
            <p className="text-muted-foreground mt-1">
              Open Subsurface Data Universe R3 — search, export, and manage well metadata
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <Globe className="h-3 w-3" />
              OSDU R3
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Compliant
            </Badge>
          </div>
        </div>

        {/* Info Banner */}
        <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            This platform implements OSDU R3 schema patterns for well master data, wellbores, and work product components.
            Exported records are compatible with OSDU-compliant data platforms (Schlumberger DELFI, Microsoft Energy Data Services, AWS OSDU).
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Supported Schemas", value: "3", icon: Layers, color: "text-blue-500" },
            { label: "OSDU Version", value: "R3", icon: Globe, color: "text-green-500" },
            { label: "Export Format", value: "JSON-LD", icon: FileJson, color: "text-purple-500" },
            { label: "Compliance", value: "Full", icon: Shield, color: "text-orange-500" },
          ].map(stat => (
            <Card key={stat.label}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <stat.icon className={`h-8 w-8 ${stat.color}`} />
                  <div>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="search">
          <TabsList>
            <TabsTrigger value="search">
              <Search className="h-4 w-4 mr-1" />
              Search
            </TabsTrigger>
            <TabsTrigger value="export">
              <Download className="h-4 w-4 mr-1" />
              Export
            </TabsTrigger>
            <TabsTrigger value="fleet">
              <Database className="h-4 w-4 mr-1" />
              Fleet Query
            </TabsTrigger>
            <TabsTrigger value="schemas">
              <Layers className="h-4 w-4 mr-1" />
              Schemas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="mt-4">
            <OSDUSearch />
          </TabsContent>

          <TabsContent value="export" className="mt-4">
            <OSDUExport />
          </TabsContent>

          <TabsContent value="fleet" className="mt-4">
            <FleetQuery />
          </TabsContent>

          <TabsContent value="schemas" className="mt-4">
            <SchemaBrowser />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
