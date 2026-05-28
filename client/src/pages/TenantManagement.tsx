/**
 * TenantManagement.tsx — Multi-Tenant Field Isolation Admin Panel
 *
 * Admin-only page for managing operators/tenants and their field access:
 *   - List all tenants with their fields and user counts
 *   - Create new tenant with field assignments
 *   - Assign/remove users from tenants
 *   - Deactivate tenants
 *   - View my accessible fields (for non-admin users)
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Building2, Users, Shield, Plus, UserPlus, UserMinus,
  RefreshCw, Trash2, CheckCircle2, XCircle, MapPin,
  Lock, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Tenant {
  id: number;
  tenant_id: string;
  name: string;
  fields: string[];
  contact_email?: string | null;
  active: boolean;
  created_at: string;
}

// ─── Create Tenant Dialog ──────────────────────────────────────────────────────
function CreateTenantDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [tenantId, setTenantId] = useState("");
  const [name, setName] = useState("");
  const [fieldsInput, setFieldsInput] = useState("");
  const [email, setEmail] = useState("");

  const createMut = trpc.tenantIsolation.createTenant.useMutation({
    onSuccess: () => {
      toast.success("Tenant created successfully");
      onCreated();
      onClose();
      setTenantId(""); setName(""); setFieldsInput(""); setEmail("");
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit() {
    const fields = fieldsInput.split(",").map(f => f.trim()).filter(Boolean);
    if (!tenantId || !name || fields.length === 0) {
      toast.error("Tenant ID, name, and at least one field are required");
      return;
    }
    createMut.mutate({ tenantId, name, fields, contactEmail: email || undefined });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Create New Tenant
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tenant ID <span className="text-red-400">*</span></Label>
              <Input placeholder="e.g. adnoc-offshore" value={tenantId} onChange={e => setTenantId(e.target.value)} />
              <p className="text-xs text-muted-foreground">Unique identifier (lowercase, hyphens)</p>
            </div>
            <div className="space-y-1.5">
              <Label>Display Name <span className="text-red-400">*</span></Label>
              <Input placeholder="e.g. ADNOC Offshore" value={name} onChange={e => setName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Assigned Fields <span className="text-red-400">*</span></Label>
            <Input placeholder="FIELD-A, FIELD-B, FIELD-C" value={fieldsInput} onChange={e => setFieldsInput(e.target.value)} />
            <p className="text-xs text-muted-foreground">Comma-separated field IDs this tenant can access</p>
          </div>
          <div className="space-y-1.5">
            <Label>Contact Email</Label>
            <Input type="email" placeholder="ops@operator.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createMut.isPending}>
            {createMut.isPending ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
            Create Tenant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Assign User Dialog ────────────────────────────────────────────────────────
function AssignUserDialog({ tenant, open, onClose, onAssigned }: { tenant: Tenant | null; open: boolean; onClose: () => void; onAssigned: () => void }) {
  const [userOpenId, setUserOpenId] = useState("");
  const [role, setRole] = useState<"VIEWER" | "OPERATOR" | "SUPERVISOR" | "ADMIN">("OPERATOR");

  const assignMut = trpc.tenantIsolation.assignUser.useMutation({
    onSuccess: () => {
      toast.success("User assigned to tenant");
      onAssigned();
      onClose();
      setUserOpenId("");
    },
    onError: (e) => toast.error(e.message),
  });

  if (!tenant) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            Assign User to {tenant.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>User Open ID <span className="text-red-400">*</span></Label>
            <Input placeholder="user-open-id" value={userOpenId} onChange={e => setUserOpenId(e.target.value)} />
            <p className="text-xs text-muted-foreground">The user's Manus Open ID from the Users table</p>
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={v => setRole(v as typeof role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VIEWER">Viewer — Read-only access</SelectItem>
                <SelectItem value="OPERATOR">Operator — Standard operations</SelectItem>
                <SelectItem value="SUPERVISOR">Supervisor — Approve permits & reports</SelectItem>
                <SelectItem value="ADMIN">Admin — Full tenant management</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => assignMut.mutate({ tenantId: tenant.tenant_id, userOpenId, role })} disabled={assignMut.isPending || !userOpenId}>
            {assignMut.isPending ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <UserPlus className="w-4 h-4 mr-1" />}
            Assign User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function TenantManagement() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  const { data: tenants, isLoading, refetch, isFetching } = trpc.tenantIsolation.listTenants.useQuery(undefined, { enabled: isAdmin });
  const { data: myFields, isLoading: myFieldsLoading } = trpc.tenantIsolation.myFields.useQuery();

  const deleteMut = trpc.tenantIsolation.deleteTenant.useMutation({
    onSuccess: () => { toast.success("Tenant deactivated"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const tenantList = (tenants as Tenant[] | undefined) ?? [];
  const myFieldList = (myFields as string[] | undefined) ?? [];

  const activeCount = tenantList.filter(t => t.active).length;
  const totalFields = new Set(tenantList.flatMap(t => t.fields)).size;

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Tenant Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Multi-operator field isolation — control which operators can access which fields
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={cn("w-4 h-4 mr-1", isFetching && "animate-spin")} />
                Refresh
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                New Tenant
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue={isAdmin ? "tenants" : "my-fields"}>
        <TabsList>
          {isAdmin && <TabsTrigger value="tenants">All Tenants</TabsTrigger>}
          <TabsTrigger value="my-fields">My Fields</TabsTrigger>
        </TabsList>

        {/* All Tenants Tab (Admin only) */}
        {isAdmin && (
          <TabsContent value="tenants" className="space-y-4 mt-4">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Tenants", value: tenantList.length, icon: Building2, color: "text-primary" },
                { label: "Active", value: activeCount, icon: CheckCircle2, color: "text-emerald-400" },
                { label: "Inactive", value: tenantList.length - activeCount, icon: XCircle, color: "text-red-400" },
                { label: "Unique Fields", value: totalFields, icon: MapPin, color: "text-amber-400" },
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

            {/* Tenant Table */}
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm">Registered Tenants / Operators</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-40" />
                    Loading tenants...
                  </div>
                ) : tenantList.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <Building2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="font-medium">No tenants configured</p>
                    <p className="text-xs mt-1">Create a tenant to enable multi-operator field isolation</p>
                    <Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)}>
                      <Plus className="w-4 h-4 mr-1" /> Create First Tenant
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tenant</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Assigned Fields</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tenantList.map(tenant => (
                        <TableRow key={tenant.id}>
                          <TableCell className="font-medium">{tenant.name}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{tenant.tenant_id}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(tenant.fields ?? []).slice(0, 4).map(f => (
                                <Badge key={f} variant="outline" className="text-xs bg-blue-950/30 text-blue-400 border-blue-800/40">{f}</Badge>
                              ))}
                              {(tenant.fields ?? []).length > 4 && (
                                <Badge variant="outline" className="text-xs">+{tenant.fields.length - 4}</Badge>
                              )}
                              {(!tenant.fields || tenant.fields.length === 0) && (
                                <span className="text-xs text-muted-foreground">No fields assigned</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{tenant.contact_email ?? "—"}</TableCell>
                          <TableCell>
                            {tenant.active ? (
                              <Badge variant="outline" className="text-xs bg-emerald-950/30 text-emerald-400 border-emerald-800/40">
                                <CheckCircle2 className="w-3 h-3 mr-1" />Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-red-950/30 text-red-400 border-red-800/40">
                                <XCircle className="w-3 h-3 mr-1" />Inactive
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {tenant.created_at ? new Date(tenant.created_at).toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost" size="sm" className="h-7 px-2 text-xs"
                                onClick={() => { setSelectedTenant(tenant); setAssignOpen(true); }}
                              >
                                <UserPlus className="w-3.5 h-3.5 mr-1" />Assign
                              </Button>
                              {tenant.active && (
                                <Button
                                  variant="ghost" size="sm" className="h-7 px-2 text-xs text-red-400 hover:text-red-300"
                                  onClick={() => {
                                    if (confirm(`Deactivate tenant "${tenant.name}"?`)) {
                                      deleteMut.mutate({ tenantId: tenant.tenant_id });
                                    }
                                  }}
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-1" />Deactivate
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* My Fields Tab */}
        <TabsContent value="my-fields" className="space-y-4 mt-4">
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                Fields Accessible to Your Account
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {myFieldsLoading ? (
                <div className="py-8 text-center text-muted-foreground">
                  <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin opacity-40" />
                  Loading your fields...
                </div>
              ) : myFieldList.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Lock className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">No fields assigned</p>
                  <p className="text-xs mt-1">Contact your administrator to be assigned to a tenant</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Your account has access to <strong>{myFieldList.length}</strong> field{myFieldList.length !== 1 ? "s" : ""}:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {myFieldList.map(field => (
                      <div key={field} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-muted/10">
                        <MapPin className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">{field}</span>
                        <Badge variant="outline" className="text-xs bg-emerald-950/30 text-emerald-400 border-emerald-800/40">Access Granted</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {!isAdmin && (
            <Card className="bg-amber-950/20 border-amber-800/40">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-amber-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-300">Admin Access Required</p>
                    <p className="text-xs text-amber-400/80 mt-1">
                      Tenant management (creating tenants, assigning users) requires administrator privileges.
                      Contact your system administrator to manage tenant configurations.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CreateTenantDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => refetch()} />
      <AssignUserDialog tenant={selectedTenant} open={assignOpen} onClose={() => setAssignOpen(false)} onAssigned={() => refetch()} />
    </div>
  );
}
