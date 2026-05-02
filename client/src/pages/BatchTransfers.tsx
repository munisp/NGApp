import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Users, Plus, Upload, Play, FileText } from "lucide-react";

const mockBatches = [
  { id: 1, batchName: "April Payroll", totalAmount: "5000000.00", recipientCount: 25, completedCount: 25, failedCount: 0, status: "completed", createdAt: "2026-04-30" },
  { id: 2, batchName: "Vendor Payments Q2", totalAmount: "12500000.00", recipientCount: 15, completedCount: 10, failedCount: 2, status: "processing", createdAt: "2026-05-01" },
  { id: 3, batchName: "Supplier Disbursement", totalAmount: "3200000.00", recipientCount: 8, completedCount: 0, failedCount: 0, status: "pending", createdAt: "2026-05-02" },
];

export default function BatchTransfers() {
  const [showCreate, setShowCreate] = useState(false);
  const [csvData, setCsvData] = useState("");

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Users className="h-8 w-8" /> Batch Transfers</h1>
            <p className="text-muted-foreground mt-1">Send payments to multiple recipients in one batch</p>
          </div>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New Batch</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Create Batch Transfer</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Batch name (e.g., May Payroll)" />
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Upload CSV file with recipients</p>
                  <p className="text-xs text-muted-foreground mt-1">Format: name, account_number, bank, amount</p>
                  <Button variant="outline" className="mt-2">Choose File</Button>
                </div>
                <div className="text-center text-sm text-muted-foreground">— or paste CSV data below —</div>
                <Textarea placeholder="Name, Account, Bank, Amount&#10;John Doe, 0123456789, Access Bank, 50000&#10;Jane Smith, 9876543210, GTBank, 75000" rows={6} value={csvData} onChange={e => setCsvData(e.target.value)} />
                <Button className="w-full" onClick={() => setShowCreate(false)}>Create Batch</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{mockBatches.length}</div><p className="text-sm text-muted-foreground">Total Batches</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold">₦{mockBatches.reduce((s, b) => s + parseFloat(b.totalAmount), 0).toLocaleString()}</div><p className="text-sm text-muted-foreground">Total Amount</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{mockBatches.reduce((s, b) => s + b.recipientCount, 0)}</div><p className="text-sm text-muted-foreground">Total Recipients</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-green-600">{mockBatches.reduce((s, b) => s + b.completedCount, 0)}</div><p className="text-sm text-muted-foreground">Completed</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Batch History</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch Name</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockBatches.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.batchName}</TableCell>
                    <TableCell>₦{parseFloat(b.totalAmount).toLocaleString()}</TableCell>
                    <TableCell>{b.recipientCount}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${(b.completedCount / b.recipientCount) * 100}%` }} />
                        </div>
                        <span className="text-xs">{b.completedCount}/{b.recipientCount}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant={b.status === "completed" ? "default" : b.status === "processing" ? "secondary" : "outline"}>{b.status}</Badge></TableCell>
                    <TableCell>{b.createdAt}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {b.status === "pending" && <Button variant="outline" size="sm"><Play className="mr-1 h-3 w-3" /> Process</Button>}
                        <Button variant="outline" size="sm"><FileText className="h-3 w-3" /></Button>
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
