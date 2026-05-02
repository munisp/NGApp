import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { DollarSign, Plus, Edit, History } from "lucide-react";

const mockFees = [
  { id: 1, name: "Standard Transfer Fee", tier: "standard", transactionType: "transfer", feeType: "hybrid", flatFee: "50.00", percentageFee: "0.015", minFee: "50.00", maxFee: "5000.00", isActive: true },
  { id: 2, name: "Premium Transfer Fee", tier: "premium", transactionType: "transfer", feeType: "hybrid", flatFee: "25.00", percentageFee: "0.01", minFee: "25.00", maxFee: "3000.00", isActive: true },
  { id: 3, name: "Card Payment Fee", tier: "standard", transactionType: "card_payment", feeType: "percentage", flatFee: "0", percentageFee: "0.025", minFee: "100.00", maxFee: "10000.00", isActive: true },
  { id: 4, name: "Promo: Zero-Fee Transfer", tier: "promotional", transactionType: "transfer", feeType: "flat", flatFee: "0", percentageFee: "0", minFee: "0", maxFee: null, isActive: false },
];

export default function FeeManagement() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><DollarSign className="h-8 w-8" /> Fee Management</h1>
            <p className="text-muted-foreground mt-1">Configure and manage transaction fee structures</p>
          </div>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add Fee Config</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Fee Configuration</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Fee name" />
                <Select><SelectTrigger><SelectValue placeholder="Tier" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                    <SelectItem value="promotional">Promotional</SelectItem>
                  </SelectContent>
                </Select>
                <Select><SelectTrigger><SelectValue placeholder="Transaction Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="card_payment">Card Payment</SelectItem>
                    <SelectItem value="qr_payment">QR Payment</SelectItem>
                    <SelectItem value="wallet_topup">Wallet Top-up</SelectItem>
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-4">
                  <Input placeholder="Flat Fee (NGN)" type="number" />
                  <Input placeholder="% Fee (e.g. 0.015)" type="number" step="0.001" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input placeholder="Min Fee (NGN)" type="number" />
                  <Input placeholder="Max Fee (NGN)" type="number" />
                </div>
                <Button className="w-full" onClick={() => setShowCreate(false)}>Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader><CardTitle>Fee Calculator</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1"><label className="text-sm text-muted-foreground">Amount (NGN)</label><Input type="number" placeholder="100000" /></div>
              <div className="w-48"><label className="text-sm text-muted-foreground">Type</label>
                <Select><SelectTrigger><SelectValue placeholder="Transfer" /></SelectTrigger>
                  <SelectContent><SelectItem value="transfer">Transfer</SelectItem><SelectItem value="card_payment">Card</SelectItem></SelectContent>
                </Select>
              </div>
              <Button>Calculate</Button>
              <div className="text-right"><p className="text-sm text-muted-foreground">Estimated Fee</p><p className="text-2xl font-bold">₦1,550.00</p></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Fee Configurations</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Tier</TableHead><TableHead>Type</TableHead>
                  <TableHead>Flat</TableHead><TableHead>%</TableHead><TableHead>Min/Max</TableHead><TableHead>Active</TableHead><TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockFees.map(f => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{f.tier}</Badge></TableCell>
                    <TableCell className="capitalize">{f.transactionType.replace(/_/g, " ")}</TableCell>
                    <TableCell>₦{f.flatFee}</TableCell>
                    <TableCell>{(parseFloat(f.percentageFee) * 100).toFixed(1)}%</TableCell>
                    <TableCell>₦{f.minFee} / {f.maxFee ? `₦${f.maxFee}` : "∞"}</TableCell>
                    <TableCell><Switch checked={f.isActive} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm"><Edit className="h-3 w-3" /></Button>
                        <Button variant="outline" size="sm"><History className="h-3 w-3" /></Button>
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
