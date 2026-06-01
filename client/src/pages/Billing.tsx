/**
 * OG-RMM Platform — Billing & Payments Page
 *
 * Features:
 * - View current subscription plan and usage
 * - Upgrade/downgrade plan
 * - Stripe credit card checkout
 * - PayPal checkout
 * - Bank transfer instructions
 * - Invoice history
 * - Payment method management
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CreditCard,
  Building2,
  CheckCircle2,
  AlertCircle,
  Download,
  Zap,
  Shield,
  Globe,
  BarChart3,
  Users,
  Server,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

// ── Plan feature lists ────────────────────────────────────────────────────────

const PLAN_FEATURES: Record<string, string[]> = {
  starter: [
    "Up to 10 wells",
    "Real-time telemetry",
    "Basic alarm management",
    "Production reporting",
    "Email support",
  ],
  professional: [
    "Up to 50 wells",
    "Advanced analytics & ML insights",
    "IEC 62443 compliance module",
    "SIL 2 safety assessment",
    "Digital twin (basic)",
    "API access",
    "Priority support",
  ],
  enterprise: [
    "Unlimited wells",
    "Full AI/PINN well performance",
    "OSDU R3 + WITSML/PRODML integration",
    "SAP PM / Maximo CMMS integration",
    "Federated learning framework",
    "Unreal Engine FPSO digital twin",
    "White-label deployment",
    "24/7 dedicated support",
    "Custom SLA",
    "On-premise deployment option",
  ],
  field_operations: [
    "Up to 25 wells",
    "Mobile-first design",
    "Offline mode",
    "Shift handover system",
    "PTW management",
    "HSE incident reporting",
    "GCC interoperability",
    "Bilingual (AR/EN)",
  ],
};

const PLAN_ICONS: Record<string, React.ReactNode> = {
  starter: <Zap className="h-5 w-5 text-yellow-400" />,
  professional: <BarChart3 className="h-5 w-5 text-blue-400" />,
  enterprise: <Globe className="h-5 w-5 text-purple-400" />,
  field_operations: <Shield className="h-5 w-5 text-green-400" />,
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "paypal" | "bank">("stripe");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [showBankDialog, setShowBankDialog] = useState(false);

  // Fetch plans
  const { data: plans, isLoading: plansLoading } = trpc.payments.listPlans.useQuery();

  // Fetch current subscription
  const { data: subscriptionList, isLoading: subLoading } = trpc.saas.listSubscriptions.useQuery({ tenantId: "current" });
  const subscription = subscriptionList?.[0] ?? null;

  // Fetch invoice history
  const { data: invoicesData, isLoading: invoicesLoading } = trpc.payments.getBillingHistory.useQuery();
  const invoices = invoicesData?.payments ?? [];

  // Stripe checkout mutation
  const stripeCheckout = trpc.stripeBilling.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        toast.info("Redirecting to secure checkout...");
        window.open(data.checkoutUrl, "_blank");
      }
    },
    onError: (err) => toast.error(`Checkout failed: ${err.message}`),
  });

  // PayPal checkout mutation
  const paypalCheckout = trpc.payments.createPayPalOrder.useMutation({
    onSuccess: (data) => {
      if (data.approveUrl) {
        toast.info("Redirecting to PayPal...");
        window.open(data.approveUrl, "_blank");
      }
    },
    onError: (err) => toast.error(`PayPal checkout failed: ${err.message}`),
  });

  // Bank transfer mutation
  const bankTransfer = trpc.payments.createBankTransfer.useMutation({
    onSuccess: () => {
      setShowBankDialog(true);
    },
    onError: (err) => toast.error(`Bank transfer failed: ${err.message}`),
  });

  const handleSubscribe = (planId: string) => {
    setSelectedPlan(planId);
    setShowUpgradeDialog(true);
  };

  const handleConfirmPayment = () => {
    if (!selectedPlan) return;
    const plan = plans?.find(p => p.id === selectedPlan);
    if (!plan) return;

    const amount = billingCycle === "annual"
      ? Math.round(plan.priceMonthly * 12 * 0.83) // 17% annual discount
      : plan.priceMonthly;

    if (paymentMethod === "stripe") {
      stripeCheckout.mutate({
        planId: selectedPlan,
        billingCycle,
        tenantId: "current",
        origin: window.location.origin,
      });
    } else if (paymentMethod === "paypal") {
      paypalCheckout.mutate({
        planId: selectedPlan,
        origin: window.location.origin,
      });
    } else {
      bankTransfer.mutate({
        planId: selectedPlan,
      });
    }
    setShowUpgradeDialog(false);
  };

  const currentPlanId = subscription?.planId ?? "starter";

  return (
    <div className="p-6 space-y-6">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Billing & Payments</h1>
            <p className="text-muted-foreground mt-1">
              Manage your subscription, payment methods, and invoices
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Billing cycle:</span>
            <div className="flex bg-muted rounded-lg p-1">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  billingCycle === "monthly"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle("annual")}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  billingCycle === "annual"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Annual
                <Badge variant="secondary" className="ml-1 text-xs bg-green-900 text-green-300">
                  Save 17%
                </Badge>
              </button>
            </div>
          </div>
        </div>

        {/* Current Subscription */}
        {!subLoading && subscription != null && (
          <Card className="border-blue-500/30 bg-blue-950/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  Current Plan: <span className="text-blue-400">{subscription.planId}</span>
                </CardTitle>
                <Badge
                  variant={subscription.status === "active" ? "default" : "destructive"}
                  className={subscription.status === "active" ? "bg-green-900 text-green-300" : ""}
                >
                  {String(subscription.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Wells Used</p>
                  <p className="font-semibold text-white">
                    — / ∞
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Next Billing</p>
                  <p className="font-semibold text-white">
                    {subscription.currentPeriodStart
                      ? new Date(subscription.currentPeriodStart).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Amount</p>
                  <p className="font-semibold text-white">
                    ${subscription.monthlyRevenue?.toFixed(2) ?? "0.00"} / {subscription.billingCycle ?? "month"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Payment Method</p>
                  <p className="font-semibold text-white capitalize">
                    {subscription.stripeSubscriptionId ? "Stripe" : subscription.subscriptionId ? "PayPal" : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Plans */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Available Plans</h2>
          {plansLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(plans ?? []).map(plan => {
                const isCurrent = plan.id === currentPlanId;
                const price = billingCycle === "annual"
                  ? Math.round(plan.priceMonthly * 0.83)
                  : plan.priceMonthly;
                const features = PLAN_FEATURES[plan.id] ?? [];

                return (
                  <Card
                    key={plan.id}
                    className={`relative transition-all ${
                      isCurrent
                        ? "border-blue-500 bg-blue-950/30"
                        : "border-border hover:border-blue-500/50"
                    }`}
                  >
                    {isCurrent && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                        <Badge className="bg-blue-600 text-white text-xs">Current Plan</Badge>
                      </div>
                    )}
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        {PLAN_ICONS[plan.id] ?? <Server className="h-5 w-5 text-gray-400" />}
                        <CardTitle className="text-base">{plan.name}</CardTitle>
                      </div>
                      <div className="mt-2">
                        <span className="text-2xl font-bold text-white">${price}</span>
                        <span className="text-muted-foreground text-sm">/mo</span>
                        {billingCycle === "annual" && (
                          <p className="text-xs text-green-400 mt-1">
                            Billed ${Math.round(price * 12)}/year
                          </p>
                        )}
                      </div>
                      {plan.description && (
                        <CardDescription className="text-xs mt-1">{plan.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <ul className="space-y-1.5">
                        {features.slice(0, 5).map((f, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3 w-3 text-green-400 mt-0.5 shrink-0" />
                            {f}
                          </li>
                        ))}
                        {features.length > 5 && (
                          <li className="text-xs text-blue-400">+{features.length - 5} more features</li>
                        )}
                      </ul>
                      <Button
                        className="w-full mt-2"
                        variant={isCurrent ? "outline" : "default"}
                        size="sm"
                        disabled={isCurrent}
                        onClick={() => handleSubscribe(plan.id)}
                      >
                        {isCurrent ? "Current Plan" : "Subscribe"}
                        {!isCurrent && <ChevronRight className="h-3 w-3 ml-1" />}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Invoice History */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Invoice History</h2>
          <Card>
            <CardContent className="p-0">
              {invoicesLoading ? (
                <div className="p-6 text-center text-muted-foreground">Loading invoices...</div>
              ) : !invoices?.length ? (
                <div className="p-6 text-center text-muted-foreground">No invoices yet</div>
              ) : (
                <div className="divide-y divide-border">
                  {invoices.map((inv: Record<string, unknown>, i: number) => (
                    <div key={i} className="flex items-center justify-between p-4 hover:bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{String(inv.description ?? `Invoice #${inv.id}`)}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(inv.createdAt as string).toLocaleDateString()} · {String(inv.paymentProvider ?? "—")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-white">
                            ${Number(inv.amount ?? 0).toFixed(2)} {String(inv.currency ?? "USD")}
                          </p>
                          <Badge
                            variant={inv.status === "paid" ? "default" : "destructive"}
                            className={`text-xs ${inv.status === "paid" ? "bg-green-900 text-green-300" : ""}`}
                          >
                            {String(inv.status ?? "pending")}
                          </Badge>
                        </div>
                        {inv.receiptUrl != null && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={String(inv.receiptUrl)} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Payment Methods Info */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Accepted Payment Methods</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-border">
              <CardContent className="p-4 flex items-start gap-3">
                <CreditCard className="h-8 w-8 text-blue-400 shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-white text-sm">Credit / Debit Card</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Visa, Mastercard, Amex, Discover. Processed securely via Stripe.
                    Instant activation.
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4 flex items-start gap-3">
                <ExternalLink className="h-8 w-8 text-yellow-400 shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-white text-sm">PayPal</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pay with your PayPal balance or linked bank account.
                    Redirects to PayPal secure checkout.
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4 flex items-start gap-3">
                <Building2 className="h-8 w-8 text-green-400 shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-white text-sm">Bank Transfer / Wire</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ACH, SWIFT, SEPA, and GCC local bank transfers.
                    Activation within 2-3 business days.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Upgrade Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Choose Payment Method</DialogTitle>
            <DialogDescription>
              Subscribe to{" "}
              <strong>{plans?.find(p => p.id === selectedPlan)?.name ?? selectedPlan}</strong>{" "}
              plan — {billingCycle} billing
            </DialogDescription>
          </DialogHeader>

          <Tabs value={paymentMethod} onValueChange={v => setPaymentMethod(v as typeof paymentMethod)}>
            <TabsList className="w-full">
              <TabsTrigger value="stripe" className="flex-1">
                <CreditCard className="h-4 w-4 mr-1" /> Card
              </TabsTrigger>
              <TabsTrigger value="paypal" className="flex-1">
                <ExternalLink className="h-4 w-4 mr-1" /> PayPal
              </TabsTrigger>
              <TabsTrigger value="bank" className="flex-1">
                <Building2 className="h-4 w-4 mr-1" /> Bank
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stripe" className="mt-4">
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                  <span>Secure checkout powered by Stripe</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                  <span>Visa, Mastercard, Amex, Discover accepted</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                  <span>Instant activation after payment</span>
                </div>
                <p className="text-xs mt-2">
                  Test card: <code className="bg-muted px-1 rounded">4242 4242 4242 4242</code>
                </p>
              </div>
            </TabsContent>

            <TabsContent value="paypal" className="mt-4">
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                  <span>Redirects to PayPal secure checkout</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                  <span>Pay with PayPal balance or linked bank</span>
                </div>
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
                  <span>PayPal sandbox mode — use test credentials</span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="bank" className="mt-4">
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                  <span>ACH, SWIFT, SEPA, GCC local transfers</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                  <span>Bank details provided after confirmation</span>
                </div>
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
                  <span>Activation within 2-3 business days</span>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPayment}
              disabled={stripeCheckout.isPending || paypalCheckout.isPending || bankTransfer.isPending}
            >
              {stripeCheckout.isPending || paypalCheckout.isPending || bankTransfer.isPending
                ? "Processing..."
                : paymentMethod === "bank"
                ? "Get Bank Details"
                : "Proceed to Checkout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bank Transfer Dialog */}
      <Dialog open={showBankDialog} onOpenChange={setShowBankDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bank Transfer Instructions</DialogTitle>
            <DialogDescription>
              Please transfer the exact amount to the following account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="bg-muted rounded-lg p-4 space-y-2 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bank Name:</span>
                <span className="text-white">First National O&G Bank</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account Name:</span>
                <span className="text-white">OG-RMM Platform Ltd</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account Number:</span>
                <span className="text-white">1234567890</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Routing Number:</span>
                <span className="text-white">021000021</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SWIFT/BIC:</span>
                <span className="text-white">FNOGUS33</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IBAN:</span>
                <span className="text-white">US12 FNOG 0210 0001 2345 6789 0</span>
              </div>
            </div>
            <div className="bg-yellow-950/30 border border-yellow-500/30 rounded-lg p-3 text-xs text-yellow-300">
              <AlertCircle className="h-3 w-3 inline mr-1" />
              Include your account email in the transfer reference to ensure proper allocation.
              Activation within 2-3 business days of receipt.
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowBankDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
