import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollText, Search, Download, Filter } from "lucide-react";

const mockLogs = [
  { id: 1, userId: 1, action: "user.login", resource: "auth", resourceId: "user-1", ipAddress: "197.210.45.12", createdAt: "2026-05-02 14:30:00" },
  { id: 2, userId: 2, action: "transaction.create", resource: "remittance", resourceId: "txn-1001", ipAddress: "41.58.120.33", createdAt: "2026-05-02 14:25:00" },
  { id: 3, userId: 1, action: "settings.update", resource: "user_preferences", resourceId: "pref-1", ipAddress: "197.210.45.12", createdAt: "2026-05-02 14:20:00" },
  { id: 4, userId: 3, action: "dispute.create", resource: "disputes", resourceId: "dsp-1", ipAddress: "105.112.78.90", createdAt: "2026-05-02 14:15:00" },
  { id: 5, userId: 1, action: "admin.approve_kyc", resource: "kyc", resourceId: "kyc-45", ipAddress: "197.210.45.12", createdAt: "2026-05-02 14:10:00" },
  { id: 6, userId: 4, action: "api_key.rotate", resource: "api_keys", resourceId: "key-12", ipAddress: "154.120.90.45", createdAt: "2026-05-02 14:05:00" },
];

export default function AuditLogViewer() {
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const filtered = mockLogs.filter(l =>
    (actionFilter === "all" || l.action.startsWith(actionFilter)) &&
    (searchTerm === "" || l.action.includes(searchTerm) || l.resource.includes(searchTerm) || l.ipAddress.includes(searchTerm))
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><ScrollText className="h-8 w-8" /> Audit Log</h1>
            <p className="text-muted-foreground mt-1">Complete audit trail of all platform actions</p>
          </div>
          <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Export Logs</Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{mockLogs.length}</div><p className="text-sm text-muted-foreground">Total Events Today</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{new Set(mockLogs.map(l => l.userId)).size}</div><p className="text-sm text-muted-foreground">Active Users</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{new Set(mockLogs.map(l => l.action.split(".")[0])).size}</div><p className="text-sm text-muted-foreground">Action Categories</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search actions, resources, IPs..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="user">User Actions</SelectItem>
                  <SelectItem value="transaction">Transactions</SelectItem>
                  <SelectItem value="admin">Admin Actions</SelectItem>
                  <SelectItem value="settings">Settings</SelectItem>
                  <SelectItem value="api_key">API Keys</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input type="date" className="w-40" />
                <Input type="date" className="w-40" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead><TableHead>User</TableHead><TableHead>Action</TableHead><TableHead>Resource</TableHead><TableHead>Resource ID</TableHead><TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="text-sm">{l.createdAt}</TableCell>
                    <TableCell>User #{l.userId}</TableCell>
                    <TableCell><Badge variant="outline" className="font-mono text-xs">{l.action}</Badge></TableCell>
                    <TableCell>{l.resource}</TableCell>
                    <TableCell className="font-mono text-xs">{l.resourceId}</TableCell>
                    <TableCell className="font-mono text-xs">{l.ipAddress}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
