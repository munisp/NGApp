import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Gauge, CheckCircle, X } from "lucide-react";

const mockRequests = [
  { id: 1, userId: 5, userName: "Olumide Adeyemi", limitType: "daily", currentLimit: "1,000,000", requestedLimit: "5,000,000", justification: "Business expansion requires higher daily limits", status: "pending", createdAt: "2026-05-01" },
  { id: 2, userId: 12, userName: "Chioma Okafor", limitType: "monthly", currentLimit: "20,000,000", requestedLimit: "50,000,000", justification: "Managing payroll for 200+ employees", status: "pending", createdAt: "2026-04-30" },
  { id: 3, userId: 8, userName: "Ibrahim Musa", limitType: "per_transaction", currentLimit: "500,000", requestedLimit: "2,000,000", justification: "Large supplier payments", status: "approved", createdAt: "2026-04-25" },
];

export default function TransactionLimitsAdmin() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Gauge className="h-8 w-8" /> Transaction Limits Management</h1>
          <p className="text-muted-foreground mt-1">Review and manage user transaction limit requests</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-yellow-600">{mockRequests.filter(r => r.status === "pending").length}</div><p className="text-sm text-muted-foreground">Pending Requests</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-green-600">{mockRequests.filter(r => r.status === "approved").length}</div><p className="text-sm text-muted-foreground">Approved This Month</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{mockRequests.length}</div><p className="text-sm text-muted-foreground">Total Requests</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Limit Increase Requests</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead><TableHead>Limit Type</TableHead><TableHead>Current</TableHead><TableHead>Requested</TableHead><TableHead>Justification</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockRequests.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.userName}</TableCell>
                    <TableCell className="capitalize">{r.limitType.replace(/_/g, " ")}</TableCell>
                    <TableCell>₦{r.currentLimit}</TableCell>
                    <TableCell>₦{r.requestedLimit}</TableCell>
                    <TableCell className="max-w-xs truncate">{r.justification}</TableCell>
                    <TableCell><Badge variant={r.status === "approved" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                    <TableCell>
                      {r.status === "pending" && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="text-green-600"><CheckCircle className="h-3 w-3 mr-1" /> Approve</Button>
                          <Button size="sm" variant="outline" className="text-red-600"><X className="h-3 w-3 mr-1" /> Reject</Button>
                        </div>
                      )}
                    </TableCell>
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
