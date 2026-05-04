import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Smartphone, Send, History, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function MobileMoney() {
  const [selectedProvider, setSelectedProvider] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [narration, setNarration] = useState("");

  const providersQuery = trpc.mobileMoney.providers.useQuery();
  const historyQuery = trpc.mobileMoney.history.useQuery({ limit: 20 });
  const transferMutation = trpc.mobileMoney.transfer.useMutation();

  const providers = providersQuery.data || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mobile Money</h1>
          <p className="text-muted-foreground">Send money via MTN MoMo, Airtel Money, and more</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {providers.map((p: any) => (
          <Card
            key={p.id}
            className={`cursor-pointer transition-all hover:shadow-md ${selectedProvider === p.id ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setSelectedProvider(p.id)}
          >
            <CardContent className="flex items-center gap-3 p-4">
              <Smartphone className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-muted-foreground">
                  Min: NGN {p.minAmount?.toLocaleString()} — Max: NGN {p.maxAmount?.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  Fee: {p.fee === 0 ? 'Free' : `NGN ${p.fee}`}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Send Money</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select value={selectedProvider} onValueChange={setSelectedProvider}>
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Recipient phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Input
              type="number"
              placeholder="Amount (NGN)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Input
              placeholder="Narration (optional)"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
            />
          </div>
          <Button
            onClick={() => {
              if (!selectedProvider || !phone || !amount) return;
              transferMutation.mutate({
                providerId: selectedProvider,
                recipientPhone: phone,
                amount: parseFloat(amount),
                narration,
              });
            }}
            disabled={transferMutation.isPending}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            {transferMutation.isPending ? 'Sending...' : 'Send Money'}
          </Button>
          {transferMutation.data && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium">Transfer {(transferMutation.data as any).status}</p>
                <p className="text-sm text-muted-foreground">Ref: {(transferMutation.data as any).reference}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Transfer History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.isArray(historyQuery.data) && historyQuery.data.map((h: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{h.provider}</p>
                  <p className="text-sm text-muted-foreground">{h.recipientPhone}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">NGN {h.amount?.toLocaleString()}</p>
                  <Badge variant={h.status === 'successful' ? 'default' : 'secondary'}>{h.status}</Badge>
                </div>
              </div>
            ))}
            {(!historyQuery.data || !Array.isArray(historyQuery.data) || historyQuery.data.length === 0) && (
              <p className="text-center text-muted-foreground py-4">No transfer history yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
