import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Users, UserPlus, Mail, Shield, Clock, CheckCircle2,
  XCircle, RefreshCw, Copy, Trash2, Crown, AlertCircle
} from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-500/20 text-red-400 border-red-500/30",
  supervisor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  engineer: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  operator: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  user: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  admin: <Crown className="w-3 h-3" />,
  supervisor: <Shield className="w-3 h-3" />,
  engineer: <Shield className="w-3 h-3" />,
  operator: <Users className="w-3 h-3" />,
  user: <Users className="w-3 h-3" />,
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  accepted: "bg-green-500/20 text-green-400 border-green-500/30",
  expired: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  revoked: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function UserOnboarding() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("operator");
  const [inviteMessage, setInviteMessage] = useState("");
  const [generatedInvite, setGeneratedInvite] = useState<{ inviteUrl: string; email: string; role: string; expiresAt: Date } | null>(null);
  const [roleChangeTarget, setRoleChangeTarget] = useState<{ id: number; name: string | null; currentRole: string } | null>(null);
  const [newRole, setNewRole] = useState<string>("");

  const { data: userList = [], refetch: refetchUsers } = trpc.userOnboarding.listUsers.useQuery();
  const { data: invitations = [], refetch: refetchInvitations } = trpc.userOnboarding.listInvitations.useQuery();

  const createInvitation = trpc.userOnboarding.createInvitation.useMutation({
    onSuccess: (data) => {
      setGeneratedInvite({ inviteUrl: data.inviteUrl, email: data.email, role: data.role, expiresAt: data.expiresAt });
      refetchInvitations();
      toast.success(`Invitation created for ${data.email}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const revokeInvitation = trpc.userOnboarding.revokeInvitation.useMutation({
    onSuccess: () => { refetchInvitations(); toast.success("Invitation revoked"); },
    onError: (err) => toast.error(err.message),
  });

  const resendInvitation = trpc.userOnboarding.resendInvitation.useMutation({
    onSuccess: (data) => {
      refetchInvitations();
      navigator.clipboard.writeText(data.inviteUrl).catch(() => {});
      toast.success("New invite link copied to clipboard");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateRole = trpc.userOnboarding.updateUserRole.useMutation({
    onSuccess: () => { refetchUsers(); setRoleChangeTarget(null); toast.success("Role updated"); },
    onError: (err) => toast.error(err.message),
  });

  const removeUser = trpc.userOnboarding.removeUser.useMutation({
    onSuccess: () => { refetchUsers(); toast.success("User removed"); },
    onError: (err) => toast.error(err.message),
  });

  function handleSendInvite() {
    if (!inviteEmail) return;
    createInvitation.mutate({
      email: inviteEmail,
      role: inviteRole as "operator",
      message: inviteMessage || undefined,
      origin: window.location.origin,
    });
  }

  function copyInviteUrl(url: string) {
    navigator.clipboard.writeText(url).catch(() => {});
    toast.success("Invite link copied to clipboard");
  }

  const pendingInvitations = invitations.filter(i => i.status === "pending");
  const pastInvitations = invitations.filter(i => i.status !== "pending");

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Onboard team members, manage roles, and track invitations</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setShowInviteDialog(true); setGeneratedInvite(null); setInviteEmail(""); setInviteMessage(""); setInviteRole("operator"); }}>
            <UserPlus className="w-4 h-4 mr-2" />
            Invite User
          </Button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Users", value: userList.length, icon: <Users className="w-5 h-5 text-blue-400" />, color: "border-blue-500/20" },
          { label: "Admins", value: userList.filter(u => u.role === "admin").length, icon: <Crown className="w-5 h-5 text-red-400" />, color: "border-red-500/20" },
          { label: "Pending Invites", value: pendingInvitations.length, icon: <Mail className="w-5 h-5 text-amber-400" />, color: "border-amber-500/20" },
          { label: "Accepted Invites", value: invitations.filter(i => i.status === "accepted").length, icon: <CheckCircle2 className="w-5 h-5 text-green-400" />, color: "border-green-500/20" },
        ].map(stat => (
          <Card key={stat.label} className={`border ${stat.color} bg-card/50`}>
            <CardContent className="p-4 flex items-center gap-3">
              {stat.icon}
              <div>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Platform Users ({userList.length})</TabsTrigger>
          <TabsTrigger value="invitations">Invitations ({invitations.length})</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Registered Users</CardTitle>
              <CardDescription>All users who have authenticated with the platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-left">
                      <th className="pb-3 font-medium">User</th>
                      <th className="pb-3 font-medium">Email</th>
                      <th className="pb-3 font-medium">Role</th>
                      <th className="pb-3 font-medium">Last Sign-in</th>
                      {isAdmin && <th className="pb-3 font-medium text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {userList.map(u => (
                      <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                              {(u.name ?? "?")[0].toUpperCase()}
                            </div>
                            <span className="font-medium">{u.name ?? "Unknown"}</span>
                            {u.openId === user?.openId && (
                              <Badge variant="outline" className="text-xs">You</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 text-muted-foreground">{u.email ?? "—"}</td>
                        <td className="py-3">
                          <Badge className={`text-xs border gap-1 ${ROLE_COLORS[u.role] ?? ROLE_COLORS.user}`}>
                            {ROLE_ICONS[u.role]}
                            {u.role}
                          </Badge>
                        </td>
                        <td className="py-3 text-muted-foreground text-xs">
                          {new Date(u.lastSignedIn).toLocaleString()}
                        </td>
                        {isAdmin && (
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => { setRoleChangeTarget({ id: u.id, name: u.name, currentRole: u.role }); setNewRole(u.role); }}>
                                <Shield className="w-3 h-3 mr-1" /> Change Role
                              </Button>
                              {u.openId !== user?.openId && (
                                <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300"
                                  onClick={() => { if (confirm(`Remove ${u.name ?? "this user"}?`)) removeUser.mutate({ userId: u.id }); }}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                    {userList.length === 0 && (
                      <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No users found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invitations Tab */}
        <TabsContent value="invitations" className="mt-4 space-y-4">
          {/* Pending */}
          {pendingInvitations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" /> Pending Invitations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingInvitations.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium text-sm">{inv.email}</div>
                          <div className="text-xs text-muted-foreground">
                            Invited by {inv.inviterName ?? "Admin"} · Expires {new Date(inv.expiresAt).toLocaleDateString()}
                          </div>
                        </div>
                        <Badge className={`text-xs border ${ROLE_COLORS[inv.role] ?? ROLE_COLORS.user}`}>{inv.role}</Badge>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => resendInvitation.mutate({ id: inv.id, origin: window.location.origin })}>
                            <RefreshCw className="w-3 h-3 mr-1" /> Resend
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-400" onClick={() => revokeInvitation.mutate({ id: inv.id })}>
                            <XCircle className="w-3 h-3 mr-1" /> Revoke
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invitation History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-left">
                      <th className="pb-3 font-medium">Email</th>
                      <th className="pb-3 font-medium">Role</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Invited By</th>
                      <th className="pb-3 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {invitations.map(inv => (
                      <tr key={inv.id} className="hover:bg-muted/30">
                        <td className="py-3 font-medium">{inv.email}</td>
                        <td className="py-3">
                          <Badge className={`text-xs border ${ROLE_COLORS[inv.role] ?? ROLE_COLORS.user}`}>{inv.role}</Badge>
                        </td>
                        <td className="py-3">
                          <Badge className={`text-xs border ${STATUS_COLORS[inv.status] ?? ""}`}>{inv.status}</Badge>
                        </td>
                        <td className="py-3 text-muted-foreground">{inv.inviterName ?? "—"}</td>
                        <td className="py-3 text-muted-foreground text-xs">{new Date(inv.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                    {invitations.length === 0 && (
                      <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No invitations yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" /> Invite New User
            </DialogTitle>
          </DialogHeader>
          {!generatedInvite ? (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Email Address *</Label>
                <Input placeholder="engineer@company.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} type="email" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operator">Operator</SelectItem>
                    <SelectItem value="engineer">Engineer</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="user">User (read-only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Personal Message (optional)</Label>
                <Textarea placeholder="Welcome to the OG-RMM platform..." value={inviteMessage} onChange={e => setInviteMessage(e.target.value)} rows={3} />
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>The invite link will be valid for 72 hours. The user must have a Manus account to complete sign-up.</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Invitation created!</span>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <div className="text-xs text-muted-foreground">Invite link for {generatedInvite.email}</div>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-background p-2 rounded border border-border flex-1 truncate">{generatedInvite.inviteUrl}</code>
                  <Button variant="outline" size="sm" onClick={() => copyInviteUrl(generatedInvite.inviteUrl)}>
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  Role: <span className="text-foreground">{generatedInvite.role}</span> · Expires: {new Date(generatedInvite.expiresAt).toLocaleString()}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Share this link with the invitee. They will be prompted to log in with Manus OAuth and their account will be automatically assigned the <strong>{generatedInvite.role}</strong> role.</p>
            </div>
          )}
          <DialogFooter>
            {!generatedInvite ? (
              <>
                <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
                <Button onClick={handleSendInvite} disabled={!inviteEmail || createInvitation.isPending}>
                  {createInvitation.isPending ? "Creating..." : "Create Invitation"}
                </Button>
              </>
            ) : (
              <Button onClick={() => setShowInviteDialog(false)}>Done</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Dialog */}
      <Dialog open={!!roleChangeTarget} onOpenChange={() => setRoleChangeTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Role — {roleChangeTarget?.name ?? "User"}</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">Current role: <Badge className={`text-xs border ${ROLE_COLORS[roleChangeTarget?.currentRole ?? "user"]}`}>{roleChangeTarget?.currentRole}</Badge></p>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger><SelectValue placeholder="Select new role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="operator">Operator</SelectItem>
                <SelectItem value="engineer">Engineer</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="user">User (read-only)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleChangeTarget(null)}>Cancel</Button>
            <Button onClick={() => roleChangeTarget && updateRole.mutate({ userId: roleChangeTarget.id, role: newRole as "admin" })} disabled={updateRole.isPending || !newRole}>
              {updateRole.isPending ? "Saving..." : "Update Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
