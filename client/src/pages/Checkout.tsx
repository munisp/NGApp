import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CreditCard, Building2, QrCode, Wallet, CheckCircle2, XCircle, Star, Shield, Lock, Award } from "lucide-react";
import { APP_LOGO, APP_TITLE } from "@/const";
import { QRCodeSVG } from "qrcode.react";

export default function Checkout() {
  const [, params] = useRoute("/checkout/:sessionId");
  const sessionId = params?.sessionId || "";

  const [paymentMethod, setPaymentMethod] = useState<"card" | "bank_transfer" | "qr_code" | "wallet">("card");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [cryptoCurrency, setCryptoCurrency] = useState<"BTC" | "ETH" | "USDT">("BTC");
  const [walletType, setWalletType] = useState<"paypal" | "apple_pay" | "google_pay">("paypal");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ status: string; transactionId?: string; redirectUrl?: string | null } | null>(null);

  const { data: session, isLoading, error } = trpc.payment.getSession.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  const processPayment = trpc.payment.processPayment.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setProcessing(false);
      
      // Redirect after 3 seconds if URL provided
      if (data.redirectUrl) {
        setTimeout(() => {
          window.location.href = data.redirectUrl!;
        }, 3000);
      }
    },
    onError: (err) => {
      setProcessing(false);
      toast.error(`Payment failed: ${err.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    
    processPayment.mutate({
      sessionId,
      paymentMethod,
      cardNumber: paymentMethod === "card" ? cardNumber : undefined,
      cardExpiry: paymentMethod === "card" ? cardExpiry : undefined,
      cardCvc: paymentMethod === "card" ? cardCvc : undefined,
      cardholderName: paymentMethod === "card" ? cardholderName : undefined,
      cryptoCurrency: paymentMethod === "qr_code" ? cryptoCurrency : undefined,
      walletType: paymentMethod === "wallet" ? walletType : undefined,
    });
  };

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\s/g, "");
    const chunks = cleaned.match(/.{1,4}/g) || [];
    return chunks.join(" ");
  };

  const formatExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length >= 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
    }
    return cleaned;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Payment Session Not Found
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {error?.message || "The payment session you're looking for doesn't exist or has expired."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show result page
  if (result) {
    const isSuccess = result.status === "captured";
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${isSuccess ? "text-green-600" : "text-red-600"}`}>
              {isSuccess ? <CheckCircle2 className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
              {isSuccess ? "Payment Successful!" : "Payment Failed"}
            </CardTitle>
            <CardDescription>
              {isSuccess 
                ? "Your payment has been processed successfully."
                : "We couldn't process your payment. Please try again."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.transactionId && (
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Transaction ID</p>
                <p className="font-mono text-sm">{result.transactionId}</p>
              </div>
            )}
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Amount</p>
              <p className="text-2xl font-bold">
                {session.currency} {(session.amount / 100).toFixed(2)}
              </p>
            </div>
            {result.redirectUrl && (
              <Alert>
                <AlertDescription>
                  Redirecting you back to the merchant in 3 seconds...
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Secure Checkout</h1>
          <p className="text-muted-foreground">Powered by {APP_TITLE}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Order Summary */}
          <div className="md:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Merchant</p>
                  <p className="font-semibold">{session.merchantName}</p>
                </div>
                {session.description && (
                  <div>
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p>{session.description}</p>
                  </div>
                )}
                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {session.currency} {(session.amount / 100).toFixed(2)}
                  </p>
                </div>
                {session.customerEmail && (
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="text-sm">{session.customerEmail}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payment Form */}
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Payment Details</CardTitle>
                <CardDescription>Choose your payment method and complete the transaction</CardDescription>
              </CardHeader>
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-6">
                  {/* Payment Method Selection */}
                  <div className="space-y-3">
                    <Label>Payment Method</Label>
                    <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                      <div className="flex items-center space-x-2 border rounded-lg p-4 cursor-pointer hover:bg-accent">
                        <RadioGroupItem value="card" id="card" />
                        <Label htmlFor="card" className="flex items-center gap-2 cursor-pointer flex-1">
                          <CreditCard className="h-5 w-5" />
                          Credit / Debit Card
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 border rounded-lg p-4 cursor-pointer hover:bg-accent">
                        <RadioGroupItem value="bank_transfer" id="bank" />
                        <Label htmlFor="bank" className="flex items-center gap-2 cursor-pointer flex-1">
                          <Building2 className="h-5 w-5" />
                          Bank Transfer
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 border rounded-lg p-4 cursor-pointer hover:bg-accent">
                        <RadioGroupItem value="qr_code" id="qr" />
                        <Label htmlFor="qr" className="flex items-center gap-2 cursor-pointer flex-1">
                          <QrCode className="h-5 w-5" />
                          Cryptocurrency
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 border rounded-lg p-4 cursor-pointer hover:bg-accent">
                        <RadioGroupItem value="wallet" id="wallet" />
                        <Label htmlFor="wallet" className="flex items-center gap-2 cursor-pointer flex-1">
                          <Wallet className="h-5 w-5" />
                          Digital Wallet
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Card Details Form */}
                  {paymentMethod === "card" && (
                    <div className="space-y-4 border-t pt-6">
                      <div className="space-y-2">
                        <Label htmlFor="cardNumber">Card Number</Label>
                        <Input
                          id="cardNumber"
                          placeholder="1234 5678 9012 3456"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(formatCardNumber(e.target.value.replace(/\s/g, "")))}
                          maxLength={19}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cardholderName">Cardholder Name</Label>
                        <Input
                          id="cardholderName"
                          placeholder="John Doe"
                          value={cardholderName}
                          onChange={(e) => setCardholderName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="cardExpiry">Expiry Date</Label>
                          <Input
                            id="cardExpiry"
                            placeholder="MM/YY"
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                            maxLength={5}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cardCvc">CVC</Label>
                          <Input
                            id="cardCvc"
                            placeholder="123"
                            value={cardCvc}
                            onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, ""))}
                            maxLength={4}
                            type="password"
                            required
                          />
                        </div>
                      </div>
                      <Alert>
                        <AlertDescription className="text-xs">
                          🔒 Your payment information is encrypted and secure. We never store your full card details.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}

                  {/* Bank Transfer Details */}
                  {paymentMethod === "bank_transfer" && (
                    <div className="space-y-4 border-t pt-6">
                      <Alert>
                        <Building2 className="h-4 w-4" />
                        <AlertDescription>
                          <div className="space-y-3">
                            <p className="font-semibold">Bank Transfer Instructions</p>
                            <div className="space-y-2 text-sm">
                              <div className="grid grid-cols-2 gap-2">
                                <span className="text-muted-foreground">Bank Name:</span>
                                <span className="font-medium">Payment Switch Bank</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <span className="text-muted-foreground">Account Name:</span>
                                <span className="font-medium">Payment Switch Ltd</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <span className="text-muted-foreground">Account Number:</span>
                                <span className="font-mono font-medium">1234567890</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <span className="text-muted-foreground">Routing Number:</span>
                                <span className="font-mono font-medium">021000021</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <span className="text-muted-foreground">Reference:</span>
                                <span className="font-mono font-medium bg-yellow-100 px-2 py-1 rounded">
                                  {sessionId.substring(0, 12).toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-3">
                              ⚠️ Please include the reference number in your transfer. Payment will be confirmed within 1-3 business days.
                            </p>
                          </div>
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}

                  {/* Cryptocurrency/QR Code Details */}
                  {paymentMethod === "qr_code" && (
                    <div className="space-y-4 border-t pt-6">
                      <div className="space-y-2">
                        <Label>Select Cryptocurrency</Label>
                        <RadioGroup value={cryptoCurrency} onValueChange={(v) => setCryptoCurrency(v as any)}>
                          <div className="flex items-center space-x-2 border rounded-lg p-3">
                            <RadioGroupItem value="BTC" id="btc" />
                            <Label htmlFor="btc" className="cursor-pointer flex-1">Bitcoin (BTC)</Label>
                          </div>
                          <div className="flex items-center space-x-2 border rounded-lg p-3">
                            <RadioGroupItem value="ETH" id="eth" />
                            <Label htmlFor="eth" className="cursor-pointer flex-1">Ethereum (ETH)</Label>
                          </div>
                          <div className="flex items-center space-x-2 border rounded-lg p-3">
                            <RadioGroupItem value="USDT" id="usdt" />
                            <Label htmlFor="usdt" className="cursor-pointer flex-1">Tether (USDT)</Label>
                          </div>
                        </RadioGroup>
                      </div>
                      <Alert>
                        <QrCode className="h-4 w-4" />
                        <AlertDescription>
                          <div className="space-y-3">
                            <p className="font-semibold">Payment Address</p>
                            <div className="bg-white p-4 rounded-lg border">
                              <div className="flex justify-center mb-3">
                                <div className="bg-white p-2 rounded">
                                  <QRCodeSVG 
                                    value={
                                      cryptoCurrency === "BTC" 
                                        ? `bitcoin:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa?amount=${(session.amount / 100).toFixed(8)}`
                                        : cryptoCurrency === "ETH"
                                        ? `ethereum:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb?value=${(session.amount / 100).toFixed(18)}`
                                        : `ethereum:0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed?value=${(session.amount / 100).toFixed(6)}`
                                    }
                                    size={192}
                                    level="M"
                                    includeMargin={true}
                                  />
                                </div>
                              </div>
                              <div className="text-center">
                                <p className="text-xs text-muted-foreground mb-1">Wallet Address:</p>
                                <p className="font-mono text-xs break-all bg-gray-50 p-2 rounded">
                                  {cryptoCurrency === "BTC" && "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"}
                                  {cryptoCurrency === "ETH" && "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"}
                                  {cryptoCurrency === "USDT" && "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"}
                                </p>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              ⚠️ Send exactly {(session.amount / 100).toFixed(2)} {session.currency} worth of {cryptoCurrency}. Payment will be confirmed after 3 network confirmations.
                            </p>
                          </div>
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}

                  {/* Digital Wallet Details */}
                  {paymentMethod === "wallet" && (
                    <div className="space-y-4 border-t pt-6">
                      <div className="space-y-2">
                        <Label>Select Wallet</Label>
                        <RadioGroup value={walletType} onValueChange={(v) => setWalletType(v as any)}>
                          <div className="flex items-center space-x-2 border rounded-lg p-3">
                            <RadioGroupItem value="paypal" id="paypal" />
                            <Label htmlFor="paypal" className="cursor-pointer flex-1 flex items-center gap-2">
                              <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-bold">P</div>
                              PayPal
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2 border rounded-lg p-3">
                            <RadioGroupItem value="apple_pay" id="apple_pay" />
                            <Label htmlFor="apple_pay" className="cursor-pointer flex-1 flex items-center gap-2">
                              <div className="w-6 h-6 bg-black rounded flex items-center justify-center text-white text-xs font-bold">🍎</div>
                              Apple Pay
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2 border rounded-lg p-3">
                            <RadioGroupItem value="google_pay" id="google_pay" />
                            <Label htmlFor="google_pay" className="cursor-pointer flex-1 flex items-center gap-2">
                              <div className="w-6 h-6 bg-white border rounded flex items-center justify-center text-xs font-bold">G</div>
                              Google Pay
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                      <Alert>
                        <Wallet className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          You will be redirected to {walletType === "paypal" ? "PayPal" : walletType === "apple_pay" ? "Apple Pay" : "Google Pay"} to complete your payment securely.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex flex-col gap-4">
                  <Button 
                    type="submit" 
                    className="w-full" 
                    size="lg"
                    disabled={processing}
                  >
                    {processing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      `Pay ${session.currency} ${(session.amount / 100).toFixed(2)}`
                    )}
                  </Button>
                  {session.cancelUrl && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      className="w-full"
                      onClick={() => window.location.href = session.cancelUrl!}
                    >
                      Cancel
                    </Button>
                  )}
                </CardFooter>
              </form>
            </Card>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-8">
          <Card>
            <CardContent className="py-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-green-600" />
                  </div>
                  <p className="text-sm font-semibold">PCI DSS</p>
                  <p className="text-xs text-muted-foreground">Level 1 Certified</p>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <Lock className="h-6 w-6 text-blue-600" />
                  </div>
                  <p className="text-sm font-semibold">256-bit SSL</p>
                  <p className="text-xs text-muted-foreground">Bank-level encryption</p>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                    <Award className="h-6 w-6 text-purple-600" />
                  </div>
                  <p className="text-sm font-semibold">3D Secure</p>
                  <p className="text-xs text-muted-foreground">Extra protection</p>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-orange-600" />
                  </div>
                  <p className="text-sm font-semibold">Verified</p>
                  <p className="text-xs text-muted-foreground">Trusted merchant</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Customer Testimonials */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-center mb-6">Trusted by Thousands of Customers</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex gap-1 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm mb-4">
                  "Payment Switch made it incredibly easy to integrate payments into our e-commerce platform. The checkout experience is smooth and our customers love it!"
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold">
                    SJ
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Sarah Johnson</p>
                    <p className="text-xs text-muted-foreground">CEO, ShopEasy</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex gap-1 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm mb-4">
                  "The security features and fraud detection give us peace of mind. Our transaction success rate improved by 15% after switching to Payment Switch."
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-semibold">
                    MC
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Michael Chen</p>
                    <p className="text-xs text-muted-foreground">CTO, TechFlow</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex gap-1 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm mb-4">
                  "Outstanding support and documentation. The developer portal has everything we needed to get started quickly. Highly recommended!"
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-semibold">
                    EP
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Emily Parker</p>
                    <p className="text-xs text-muted-foreground">Founder, StartupHub</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Security Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p className="flex items-center justify-center gap-2">
            <Lock className="h-4 w-4" />
            Secured by 256-bit SSL encryption • PCI DSS Level 1 Compliant • 3D Secure Protected
          </p>
        </div>
      </div>
    </div>
  );
}
