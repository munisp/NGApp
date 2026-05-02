import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Plus, Download, CheckCircle, FileText } from "lucide-react";

const mockReports = [
  { id: 1, title: "Q1 2026 AML Summary", reportType: "aml_summary", periodStart: "2026-01-01", periodEnd: "2026-03-31", totalTransactions: 45230, flaggedTransactions: 12, status: "approved", createdAt: "2026-04-05" },
  { id: 2, title: "March 2026 SAR Report", reportType: "sar", periodStart: "2026-03-01", periodEnd: "2026-03-31", totalTransactions: 15840, flaggedTransactions: 5, status: "submitted", createdAt: "2026-04-02" },
  { id: 3, title: "CTR Report - April 2026", reportType: "ctr", periodStart: "2026-04-01", periodEnd: "2026-04-30", totalTransactions: 16500, flaggedTransactions: 8, status: "draft", createdAt: "2026-05-01" },
];

export default function ComplianceReports() {
  const [showGenerate, setShowGenerate] = useState(false);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Shield className="h-8 w-8" /> Compliance Reports</h1>
            <p className="text-muted-foreground mt-1">Generate and manage regulatory compliance reports</p>
          </div>
          <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Generate Report</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Generate Compliance Report</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Select><SelectTrigger><SelectValue placeholder="Report Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sar">Suspicious Activity Report (SAR)</SelectItem>
                    <SelectItem value="ctr">Currency Transaction Report (CTR)</SelectItem>
                    <SelectItem value="aml_summary">AML Transaction Summary</SelectItem>
                    <SelectItem value="quarterly_compliance">Quarterly Compliance</SelectItem>
                    <SelectItem value="annual_report">Annual Report</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Report title" />
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-sm">Period Start</label><Input type="date" /></div>
                  <div><label className="text-sm">Period End</label><Input type="date" /></div>
                </div>
                <Button className="w-full" onClick={() => setShowGenerate(false)}>Generate Report</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{mockReports.length}</div><p className="text-sm text-muted-foreground">Total Reports</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-green-600">{mockReports.filter(r => r.status === "approved").length}</div><p className="text-sm text-muted-foreground">Approved</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-blue-600">{mockReports.filter(r => r.status === "submitted").length}</div><p className="text-sm text-muted-foreground">Submitted</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-red-600">{mockReports.reduce((s, r) => s + r.flaggedTransactions, 0)}</div><p className="text-sm text-muted-foreground">Flagged Transactions</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Reports</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Period</TableHead>
                  <TableHead>Transactions</TableHead><TableHead>Flagged</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockReports.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.title}</TableCell>
                    <TableCell><Badge variant="outline">{r.reportType.replace(/_/g, " ").toUpperCase()}</Badge></TableCell>
                    <TableCell>{r.periodStart} — {r.periodEnd}</TableCell>
                    <TableCell>{r.totalTransactions.toLocaleString()}</TableCell>
                    <TableCell className={r.flaggedTransactions > 0 ? "text-red-600 font-medium" : ""}>{r.flaggedTransactions}</TableCell>
                    <TableCell><Badge variant={r.status === "approved" ? "default" : r.status === "submitted" ? "secondary" : "outline"}>{r.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {r.status === "draft" && <Button variant="outline" size="sm"><CheckCircle className="mr-1 h-3 w-3" /> Approve</Button>}
                        <Button variant="outline" size="sm"><Download className="h-3 w-3" /></Button>
                      </div>
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
