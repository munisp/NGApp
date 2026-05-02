import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Plus, Search, FileText, Clock, CheckCircle } from "lucide-react";

const statusColors: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-800",
  under_review: "bg-blue-100 text-blue-800",
  evidence_requested: "bg-purple-100 text-purple-800",
  resolved_merchant: "bg-green-100 text-green-800",
  resolved_customer: "bg-green-100 text-green-800",
  escalated: "bg-red-100 text-red-800",
  closed: "bg-gray-100 text-gray-800",
};

const mockDisputes = [
  { id: 1, transactionId: 1001, reason: "Unauthorized transaction", amount: "50000.00", currency: "NGN", status: "open", createdAt: "2026-04-28" },
  { id: 2, transactionId: 1045, reason: "Amount mismatch", amount: "25000.00", currency: "NGN", status: "under_review", createdAt: "2026-04-25" },
  { id: 3, transactionId: 1023, reason: "Service not received", amount: "100000.00", currency: "NGN", status: "resolved_customer", createdAt: "2026-04-20" },
];

export default function Disputes() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newDispute, setNewDispute] = useState({ transactionId: "", reason: "", description: "", amount: "" });

  const filtered = mockDisputes.filter(d =>
    (statusFilter === "all" || d.status === statusFilter) &&
    (search === "" || d.reason.toLowerCase().includes(search.toLowerCase()) || String(d.transactionId).includes(search))
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><AlertTriangle className="h-8 w-8" /> Transaction Disputes</h1>
            <p className="text-muted-foreground mt-1">File and track dispute resolutions for transactions</p>
          </div>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> File Dispute</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>File a New Dispute</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Transaction ID" value={newDispute.transactionId} onChange={e => setNewDispute({ ...newDispute, transactionId: e.target.value })} />
                <Input placeholder="Dispute amount" value={newDispute.amount} onChange={e => setNewDispute({ ...newDispute, amount: e.target.value })} />
                <Select onValueChange={v => setNewDispute({ ...newDispute, reason: v })}>
                  <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unauthorized">Unauthorized Transaction</SelectItem>
                    <SelectItem value="amount_mismatch">Amount Mismatch</SelectItem>
                    <SelectItem value="service_not_received">Service Not Received</SelectItem>
                    <SelectItem value="duplicate_charge">Duplicate Charge</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea placeholder="Describe the dispute in detail..." value={newDispute.description} onChange={e => setNewDispute({ ...newDispute, description: e.target.value })} />
                <Button className="w-full" onClick={() => setShowCreate(false)}>Submit Dispute</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{mockDisputes.length}</div><p className="text-sm text-muted-foreground">Total Disputes</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-yellow-600">{mockDisputes.filter(d => d.status === "open").length}</div><p className="text-sm text-muted-foreground">Open</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-blue-600">{mockDisputes.filter(d => d.status === "under_review").length}</div><p className="text-sm text-muted-foreground">Under Review</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-green-600">{mockDisputes.filter(d => d.status.startsWith("resolved")).length}</div><p className="text-sm text-muted-foreground">Resolved</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search disputes..." value={search} onChange={e => setSearch(e.target.value)} /></div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="resolved_customer">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Transaction</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">#{d.id}</TableCell>
                    <TableCell>TXN-{d.transactionId}</TableCell>
                    <TableCell>{d.reason}</TableCell>
                    <TableCell>₦{parseFloat(d.amount).toLocaleString()}</TableCell>
                    <TableCell><Badge className={statusColors[d.status]}>{d.status.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell>{d.createdAt}</TableCell>
                    <TableCell><Button variant="outline" size="sm"><FileText className="mr-1 h-3 w-3" /> View</Button></TableCell>
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
