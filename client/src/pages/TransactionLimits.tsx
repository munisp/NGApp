import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Gauge, ArrowUp, Shield } from "lucide-react";

const mockLimits = [
  { type: "Per Transaction", max: "500,000", used: "0", percentage: 0 },
  { type: "Daily", max: "1,000,000", used: "350,000", percentage: 35 },
  { type: "Weekly", max: "5,000,000", used: "1,200,000", percentage: 24 },
  { type: "Monthly", max: "20,000,000", used: "8,500,000", percentage: 42.5 },
];

const mockRequests = [
  { id: 1, limitType: "daily", currentLimit: "1,000,000", requestedLimit: "5,000,000", status: "pending", createdAt: "2026-05-01" },
  { id: 2, limitType: "monthly", currentLimit: "20,000,000", requestedLimit: "50,000,000", status: "approved", createdAt: "2026-04-15" },
];

export default function TransactionLimits() {
  const [showRequest, setShowRequest] = useState(false);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Gauge className="h-8 w-8" /> Transaction Limits</h1>
            <p className="text-muted-foreground mt-1">View your current limits and request increases</p>
          </div>
          <Dialog open={showRequest} onOpenChange={setShowRequest}>
            <DialogTrigger asChild><Button><ArrowUp className="mr-2 h-4 w-4" /> Request Increase</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Request Limit Increase</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <select className="w-full border rounded-md p-2">
                  <option value="">Select limit type</option>
                  <option value="per_transaction">Per Transaction</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <Input placeholder="Requested limit (NGN)" type="number" />
                <Textarea placeholder="Justification for the increase..." rows={3} />
                <Button className="w-full" onClick={() => setShowRequest(false)}>Submit Request</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {mockLimits.map((l, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{l.type} Limit</CardTitle>
                <CardDescription>₦{l.used} of ₦{l.max} used</CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={l.percentage} className="h-3" />
                <div className="flex justify-between mt-2 text-sm text-muted-foreground">
                  <span>{l.percentage}% used</span>
                  <span>₦{(parseFloat(l.max.replace(/,/g, "")) - parseFloat(l.used.replace(/,/g, ""))).toLocaleString()} remaining</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Limit Increase Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead><TableHead>Current</TableHead><TableHead>Requested</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockRequests.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="capitalize">{r.limitType}</TableCell>
                    <TableCell>₦{r.currentLimit}</TableCell>
                    <TableCell>₦{r.requestedLimit}</TableCell>
                    <TableCell><Badge variant={r.status === "approved" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                    <TableCell>{r.createdAt}</TableCell>
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
