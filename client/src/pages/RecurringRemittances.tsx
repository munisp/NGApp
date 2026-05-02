import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Plus, Pause, Play, X, Calendar } from "lucide-react";

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  cancelled: "bg-red-100 text-red-800",
  completed: "bg-blue-100 text-blue-800",
  failed: "bg-red-100 text-red-800",
};

const mockSchedules = [
  { id: 1, recipientName: "Olumide Adeyemi", amount: "50000.00", frequency: "monthly", status: "active", nextExecutionDate: "2026-06-01", totalExecutions: 5 },
  { id: 2, recipientName: "Chioma Okafor", amount: "25000.00", frequency: "weekly", status: "active", nextExecutionDate: "2026-05-09", totalExecutions: 12 },
  { id: 3, recipientName: "Ibrahim Musa", amount: "100000.00", frequency: "quarterly", status: "paused", nextExecutionDate: "2026-07-01", totalExecutions: 2 },
];

export default function RecurringRemittances() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ recipientName: "", recipientAccount: "", recipientBank: "", amount: "", frequency: "monthly", nextExecutionDate: "" });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><RefreshCw className="h-8 w-8" /> Recurring Remittances</h1>
            <p className="text-muted-foreground mt-1">Schedule and manage automatic recurring transfers</p>
          </div>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New Schedule</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create Recurring Transfer</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Recipient name" value={form.recipientName} onChange={e => setForm({ ...form, recipientName: e.target.value })} />
                <Input placeholder="Account number" value={form.recipientAccount} onChange={e => setForm({ ...form, recipientAccount: e.target.value })} />
                <Input placeholder="Bank name" value={form.recipientBank} onChange={e => setForm({ ...form, recipientBank: e.target.value })} />
                <Input placeholder="Amount (NGN)" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                <Select value={form.frequency} onValueChange={v => setForm({ ...form, frequency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Bi-Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="date" value={form.nextExecutionDate} onChange={e => setForm({ ...form, nextExecutionDate: e.target.value })} />
                <Button className="w-full" onClick={() => setShowCreate(false)}>Create Schedule</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{mockSchedules.length}</div><p className="text-sm text-muted-foreground">Total Schedules</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-green-600">{mockSchedules.filter(s => s.status === "active").length}</div><p className="text-sm text-muted-foreground">Active</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold">₦{mockSchedules.filter(s => s.status === "active").reduce((sum, s) => sum + parseFloat(s.amount), 0).toLocaleString()}</div><p className="text-sm text-muted-foreground">Monthly Outflow</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Scheduled Transfers</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Next Date</TableHead>
                  <TableHead>Executions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockSchedules.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.recipientName}</TableCell>
                    <TableCell>₦{parseFloat(s.amount).toLocaleString()}</TableCell>
                    <TableCell className="capitalize">{s.frequency}</TableCell>
                    <TableCell className="flex items-center gap-1"><Calendar className="h-3 w-3" />{s.nextExecutionDate}</TableCell>
                    <TableCell>{s.totalExecutions}</TableCell>
                    <TableCell><Badge className={statusColors[s.status]}>{s.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {s.status === "active" && <Button variant="outline" size="sm"><Pause className="h-3 w-3" /></Button>}
                        {s.status === "paused" && <Button variant="outline" size="sm"><Play className="h-3 w-3" /></Button>}
                        <Button variant="outline" size="sm" className="text-red-600"><X className="h-3 w-3" /></Button>
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
