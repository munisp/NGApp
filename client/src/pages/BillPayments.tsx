import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Smartphone, Tv, Wifi, Search, CreditCard } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function BillPayments() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [accountNumber, setAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("");

  const categoriesQuery = trpc.billPayment.categories.useQuery();
  const historyQuery = trpc.billPayment.history.useQuery({ limit: 20 });
  const payMutation = trpc.billPayment.pay.useMutation();
  const validateMutation = trpc.billPayment.validate.useMutation();

  const categories = categoriesQuery.data || [];
  const history = historyQuery.data || [];

  const categoryIcons: Record<string, React.ReactNode> = {
    electricity: <Zap className="h-5 w-5" />,
    airtime: <Smartphone className="h-5 w-5" />,
    cable: <Tv className="h-5 w-5" />,
    internet: <Wifi className="h-5 w-5" />,
  };

  const handleValidate = () => {
    if (!selectedProvider || !accountNumber) return;
    validateMutation.mutate({ providerId: selectedProvider, accountNumber });
  };

  const handlePay = () => {
    if (!selectedProvider || !accountNumber || !amount) return;
    payMutation.mutate({
      providerId: selectedProvider,
      accountNumber,
      amount: parseFloat(amount),
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bill Payments</h1>
          <p className="text-muted-foreground">Pay electricity, airtime, cable TV, and more</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {categories.map((cat: any) => (
          <Card
            key={cat.id}
            className={`cursor-pointer transition-all hover:shadow-md ${selectedCategory === cat.id ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setSelectedCategory(cat.id)}
          >
            <CardContent className="flex items-center gap-3 p-4">
              {categoryIcons[cat.id] || <CreditCard className="h-5 w-5" />}
              <div>
                <p className="font-medium">{cat.name}</p>
                <p className="text-sm text-muted-foreground">{cat.providers?.length || 0} providers</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Make Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select value={selectedProvider} onValueChange={setSelectedProvider}>
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {categories
                  .filter((c: any) => selectedCategory === 'all' || c.id === selectedCategory)
                  .flatMap((c: any) => c.providers || [])
                  .map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Account/Meter number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
            />
            <Input
              type="number"
              placeholder="Amount (NGN)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleValidate} disabled={validateMutation.isPending}>
              <Search className="h-4 w-4 mr-2" />
              Validate Account
            </Button>
            <Button onClick={handlePay} disabled={payMutation.isPending}>
              <CreditCard className="h-4 w-4 mr-2" />
              Pay Now
            </Button>
          </div>
          {validateMutation.data && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm font-medium">Account validated: {JSON.stringify(validateMutation.data)}</p>
            </div>
          )}
          {payMutation.data && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm font-medium">Payment result: {(payMutation.data as any).status}</p>
              <p className="text-xs text-muted-foreground">Ref: {(payMutation.data as any).reference}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.isArray(history) && history.map((h: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{h.provider}</p>
                  <p className="text-sm text-muted-foreground">{h.accountNumber}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">NGN {h.amount?.toLocaleString()}</p>
                  <Badge variant={h.status === 'successful' ? 'default' : 'secondary'}>{h.status}</Badge>
                </div>
              </div>
            ))}
            {(!Array.isArray(history) || history.length === 0) && (
              <p className="text-center text-muted-foreground py-4">No payment history yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
