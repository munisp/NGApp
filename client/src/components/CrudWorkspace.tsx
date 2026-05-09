/**
 * CrudWorkspace — Reusable CRUD workspace component for banking domain pages.
 * Provides: List with search/filter, Create dialog, Edit dialog, Detail view, Delete confirmation.
 * Used by: Mortgage, Virtual Accounts, Education Loans, Esusu, Dispute Management, etc.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  Download,
  Edit,
  Eye,
  Filter,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "date" | "textarea" | "readonly";
  options?: string[];
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number;
}

export interface CrudConfig {
  domainKey: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  accentColor: string;
  fields: FieldDef[];
  columns: { key: string; label: string; render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode }[];
  idField: string;
  statusField?: string;
  searchFields: string[];
  apiBase: string;
  actions?: { label: string; key: string; variant?: string; condition?: (row: Record<string, unknown>) => boolean }[];
}

interface CrudWorkspaceProps {
  config: CrudConfig;
}

type RecordData = Record<string, unknown>;

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  approved: "bg-emerald-100 text-emerald-800",
  completed: "bg-emerald-100 text-emerald-800",
  healthy: "bg-emerald-100 text-emerald-800",
  verified: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  draft: "bg-amber-100 text-amber-800",
  forming: "bg-amber-100 text-amber-800",
  grace: "bg-amber-100 text-amber-800",
  open: "bg-blue-100 text-blue-800",
  investigating: "bg-blue-100 text-blue-800",
  running: "bg-blue-100 text-blue-800",
  disbursed: "bg-blue-100 text-blue-800",
  repaying: "bg-teal-100 text-teal-800",
  failed: "bg-red-100 text-red-800",
  rejected: "bg-red-100 text-red-800",
  frozen: "bg-red-100 text-red-800",
  suspended: "bg-red-100 text-red-800",
  closed: "bg-gray-100 text-gray-600",
  expired: "bg-gray-100 text-gray-600",
  default: "bg-gray-100 text-gray-600",
};

function StatusBadge({ status }: { status: string }) {
  const colorClass = statusColors[status?.toLowerCase()] ?? statusColors.default;
  return <Badge className={`${colorClass} font-medium capitalize`}>{status}</Badge>;
}

export default function CrudWorkspace({ config }: CrudWorkspaceProps) {
  const [records, setRecords] = useState<RecordData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RecordData | null>(null);
  const [formData, setFormData] = useState<RecordData>({});
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const Icon = config.icon;

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(config.apiBase);
      if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
      const data = await res.json();
      const items = Array.isArray(data) ? data : data.items ?? data.records ?? data.data ?? [];
      setRecords(items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [config.apiBase]);

  useEffect(() => {
    void fetchRecords();
  }, [fetchRecords]);

  const filteredRecords = useMemo(() => {
    let result = records;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) =>
        config.searchFields.some((field) => String(r[field] ?? "").toLowerCase().includes(q))
      );
    }
    if (statusFilter !== "all" && config.statusField) {
      result = result.filter((r) => String(r[config.statusField!]).toLowerCase() === statusFilter.toLowerCase());
    }
    return result;
  }, [records, searchQuery, statusFilter, config.searchFields, config.statusField]);

  const uniqueStatuses = useMemo(() => {
    if (!config.statusField) return [];
    const statuses = new Set(records.map((r) => String(r[config.statusField!])));
    return Array.from(statuses).sort();
  }, [records, config.statusField]);

  const initCreateForm = () => {
    const defaults: RecordData = {};
    config.fields.forEach((f) => {
      if (f.defaultValue !== undefined) defaults[f.key] = f.defaultValue;
      else if (f.type === "number") defaults[f.key] = 0;
      else defaults[f.key] = "";
    });
    setFormData(defaults);
    setShowCreate(true);
  };

  const initEditForm = (record: RecordData) => {
    setFormData({ ...record });
    setSelectedRecord(record);
    setShowEdit(true);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const res = await fetch(config.apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Create failed: ${res.status}`);
      }
      setShowCreate(false);
      setStatusMessage("Record created successfully");
      void fetchRecords();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedRecord) return;
    setSaving(true);
    try {
      const id = selectedRecord[config.idField];
      const res = await fetch(`${config.apiBase}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Update failed: ${res.status}`);
      }
      setShowEdit(false);
      setStatusMessage("Record updated successfully");
      void fetchRecords();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (actionKey: string, record: RecordData) => {
    const id = record[config.idField];
    try {
      const res = await fetch(`${config.apiBase}/${id}/${actionKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Action failed: ${res.status}`);
      }
      setStatusMessage(`Action '${actionKey}' completed`);
      void fetchRecords();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Action failed");
    }
  };

  const handleExport = () => {
    const csv = [
      config.columns.map((c) => c.label).join(","),
      ...filteredRecords.map((r) => config.columns.map((c) => JSON.stringify(String(r[c.key] ?? ""))).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${config.domainKey}-export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderField = (field: FieldDef) => {
    if (field.type === "readonly") {
      return <p className="text-sm text-gray-500">{String(formData[field.key] ?? "")}</p>;
    }
    if (field.type === "select" && field.options) {
      return (
        <Select
          value={String(formData[field.key] ?? "")}
          onValueChange={(val) => setFormData((prev) => ({ ...prev, [field.key]: val }))}
        >
          <SelectTrigger><SelectValue placeholder={field.placeholder ?? "Select..."} /></SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    if (field.type === "textarea") {
      return (
        <textarea
          className="w-full rounded-md border px-3 py-2 text-sm"
          rows={3}
          placeholder={field.placeholder}
          value={String(formData[field.key] ?? "")}
          onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
        />
      );
    }
    return (
      <Input
        type={field.type === "number" ? "number" : "text"}
        placeholder={field.placeholder}
        value={String(formData[field.key] ?? "")}
        onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: field.type === "number" ? Number(e.target.value) : e.target.value }))}
      />
    );
  };

  const FormFields = () => (
    <div className="grid gap-4">
      {config.fields.filter((f) => f.type !== "readonly").map((field) => (
        <div key={field.key}>
          <Label className="mb-1">{field.label}{field.required && <span className="text-red-500 ml-1">*</span>}</Label>
          {renderField(field)}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className={`border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10`}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${config.accentColor}`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">{config.title}</h1>
                <p className="text-sm text-gray-500">{config.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void fetchRecords()}>
                <RefreshCcw className="h-4 w-4 mr-1" /> Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" /> Export
              </Button>
              <Button size="sm" onClick={initCreateForm}>
                <Plus className="h-4 w-4 mr-1" /> Create
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-3">
            <p className="text-2xl font-bold">{records.length}</p>
            <p className="text-xs text-gray-500">Total Records</p>
          </CardContent></Card>
          {uniqueStatuses.slice(0, 3).map((s) => (
            <Card key={s}><CardContent className="p-3">
              <p className="text-2xl font-bold">{records.filter((r) => String(r[config.statusField!]) === s).length}</p>
              <p className="text-xs text-gray-500 capitalize">{s}</p>
            </CardContent></Card>
          ))}
        </div>
      </div>

      {/* Search + Filter */}
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              className="pl-10"
              placeholder={`Search ${config.title.toLowerCase()}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {config.statusField && (
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-1" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {uniqueStatuses.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Status message */}
      {statusMessage && (
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
            {statusMessage}
            <button onClick={() => setStatusMessage(null)}><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="max-w-7xl mx-auto px-4 py-3">
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Loading...</span>
              </div>
            ) : error ? (
              <div className="text-center py-12 text-red-500">{error}</div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                {searchQuery ? "No records match your search" : "No records yet. Click Create to add one."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {config.columns.map((col) => (
                      <TableHead key={col.key}>{col.label}</TableHead>
                    ))}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record, idx) => (
                    <TableRow key={String(record[config.idField] ?? idx)} className="hover:bg-gray-50">
                      {config.columns.map((col) => (
                        <TableCell key={col.key}>
                          {col.render ? col.render(record[col.key], record) :
                            col.key === config.statusField ? <StatusBadge status={String(record[col.key] ?? "")} /> :
                            <span className="text-sm">{String(record[col.key] ?? "—")}</span>
                          }
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedRecord(record); setShowDetail(true); }}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => initEditForm(record)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          {config.actions?.filter((a) => !a.condition || a.condition(record)).map((action) => (
                            <Button key={action.key} variant="ghost" size="sm" onClick={() => void handleAction(action.key, record)}>
                              {action.label}
                            </Button>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-gray-400 mt-2 text-right">
          Showing {filteredRecords.length} of {records.length} records
        </p>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create {config.title}</DialogTitle>
            <DialogDescription>Fill in the details below to create a new record.</DialogDescription>
          </DialogHeader>
          <FormFields />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => void handleCreate()} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {config.title}</DialogTitle>
            <DialogDescription>Modify the record details below.</DialogDescription>
          </DialogHeader>
          <FormFields />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button onClick={() => void handleUpdate()} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Details</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="grid gap-3">
              {Object.entries(selectedRecord).map(([key, val]) => (
                <div key={key} className="flex justify-between border-b pb-2">
                  <span className="text-sm font-medium text-gray-500 capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                  <span className="text-sm text-right max-w-[60%] break-words">{String(val ?? "—")}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
