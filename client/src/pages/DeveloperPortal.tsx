import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ChatWidget from "@/components/ChatWidget";
import { Code2, Book, Webhook, TestTube, Shield, Zap, Key, Plus, Trash2, Send, Loader2 } from "lucide-react";
import { APP_TITLE } from "@/const";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

function ApiKeysSection() {
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyEnv, setNewKeyEnv] = useState<"sandbox" | "production">("sandbox");
  const { data: keys, refetch } = trpc.developerPortal.listApiKeys.useQuery();
  const { data: stats } = trpc.developerPortal.getUsageStats.useQuery();
  const createMutation = trpc.developerPortal.createApiKey.useMutation({
    onSuccess: (data) => { toast.success(`API key created: ${data.key}`); refetch(); setNewKeyName(""); },
    onError: (err) => toast.error(err.message),
  });
  const revokeMutation = trpc.developerPortal.revokeApiKey.useMutation({
    onSuccess: () => { toast.success("Key revoked"); refetch(); },
  });

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{stats.totalKeys}</p><p className="text-xs text-muted-foreground">Total Keys</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{stats.activeKeys}</p><p className="text-xs text-muted-foreground">Active</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{stats.totalRequests}</p><p className="text-xs text-muted-foreground">Total Requests</p></CardContent></Card>
        </div>
      )}
      <div className="flex gap-2">
        <Input placeholder="Key name (e.g. Production App)" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} />
        <Button variant={newKeyEnv === "sandbox" ? "secondary" : "default"} size="sm" onClick={() => setNewKeyEnv(newKeyEnv === "sandbox" ? "production" : "sandbox")}>
          {newKeyEnv}
        </Button>
        <Button onClick={() => createMutation.mutate({ name: newKeyName, environment: newKeyEnv, scopes: ['payments:read', 'payments:write'] })}
          disabled={!newKeyName || createMutation.isPending}>
          <Plus className="h-4 w-4 mr-1" /> Create
        </Button>
      </div>
      <div className="space-y-2">
        {(keys || []).map(key => (
          <div key={key.id} className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium">{key.name}</p>
              <p className="font-mono text-xs text-muted-foreground">{key.key}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={key.environment === 'sandbox' ? 'secondary' : 'default'}>{key.environment}</Badge>
              <Badge variant={key.status === 'active' ? 'default' : 'destructive'}>{key.status}</Badge>
              {key.status === 'active' && (
                <Button variant="ghost" size="sm" onClick={() => revokeMutation.mutate({ id: key.id })}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WebhooksSection() {
  const [newUrl, setNewUrl] = useState("");
  const { data: endpoints, refetch } = trpc.developerPortal.listWebhookEndpoints.useQuery();
  const createMutation = trpc.developerPortal.createWebhookEndpoint.useMutation({
    onSuccess: (data) => { toast.success(`Webhook created. Secret: ${data.secret}`); refetch(); setNewUrl(""); },
    onError: (err) => toast.error(err.message),
  });
  const testMutation = trpc.developerPortal.testWebhook.useMutation({
    onSuccess: (data) => {
      if (data.success) toast.success(`Test delivered: ${data.statusCode} in ${data.responseTimeMs}ms`);
      else toast.error(`Test failed: ${data.statusCode || 'unreachable'}`);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input placeholder="https://your-server.com/webhooks" value={newUrl} onChange={e => setNewUrl(e.target.value)} />
        <Button onClick={() => createMutation.mutate({ url: newUrl, events: ['payment.completed', 'transfer.completed'] })}
          disabled={!newUrl || createMutation.isPending}>
          <Plus className="h-4 w-4 mr-1" /> Add Endpoint
        </Button>
      </div>
      <div className="space-y-2">
        {(endpoints || []).map(ep => (
          <div key={ep.id} className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-mono text-sm">{ep.url}</p>
              <p className="text-xs text-muted-foreground">{ep.events.join(', ')} • Success rate: {ep.successRate}%</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={ep.status === 'active' ? 'default' : 'destructive'}>{ep.status}</Badge>
              <Button variant="outline" size="sm" onClick={() => testMutation.mutate({ endpointId: ep.id })}
                disabled={testMutation.isPending}>
                {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DeveloperPortal() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                <Code2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{APP_TITLE} Developer Portal</h1>
                <p className="text-sm text-muted-foreground">Documentation & Resources</p>
              </div>
            </div>
            <Badge variant="outline" className="gap-1">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
              All Systems Operational
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4 py-8">
            <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Build with Payment Switch
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Integrate powerful payment processing into your application with our comprehensive SDKs and APIs
            </p>
          </div>

          {/* Quick Start Cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle>Quick Start</CardTitle>
                <CardDescription>Get up and running in 5 minutes</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Follow our step-by-step guide to integrate payments into your application quickly and securely.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                  <Code2 className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle>API Reference</CardTitle>
                <CardDescription>Complete API documentation</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Explore our comprehensive API reference with detailed endpoint descriptions and examples.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
                  <TestTube className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle>Testing</CardTitle>
                <CardDescription>Test mode and sandbox</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Use test API keys and test cards to validate your integration before going live.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Documentation Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="api-keys">API Keys</TabsTrigger>
              <TabsTrigger value="sdks">SDKs</TabsTrigger>
              <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="api-docs">API Docs</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Getting Started</CardTitle>
                  <CardDescription>Learn the basics of Payment Switch integration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">1. Get Your API Keys</h3>
                    <p className="text-sm text-muted-foreground">
                      Sign up for a merchant account and get your API keys from the dashboard. Use test keys (pk_test_...) for development.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">2. Create a Payment Session</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      Create a payment session on your backend using our API:
                    </p>
                    <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
{`const response = await fetch('/api/trpc/payment.createSession', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    apiKey: 'pk_test_...',
    amount: 5000, // $50.00 in cents
    currency: 'USD',
    description: 'Product Purchase'
  })
});

const { checkoutUrl } = await response.json();`}
                    </pre>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">3. Redirect to Checkout</h3>
                    <p className="text-sm text-muted-foreground">
                      Redirect your customer to the checkout URL. They'll complete payment and return to your success URL.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">4. Handle Webhooks</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure webhooks to receive real-time notifications about payment events like successful payments, refunds, and failures.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sdks" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>JavaScript SDK</CardTitle>
                    <CardDescription>For web applications</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground">Install via npm:</p>
                    <pre className="bg-muted p-3 rounded text-xs">npm install @payment-switch/js-sdk</pre>
                    <p className="text-sm text-muted-foreground mt-4">Basic usage:</p>
                    <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`const paymentSwitch = new PaymentSwitch({
  apiKey: 'pk_test_...'
});

await paymentSwitch.checkout({
  amount: 5000,
  currency: 'USD'
});`}
                    </pre>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Python Library</CardTitle>
                    <CardDescription>For backend integration</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground">Install via pip:</p>
                    <pre className="bg-muted p-3 rounded text-xs">pip install payment-switch</pre>
                    <p className="text-sm text-muted-foreground mt-4">Basic usage:</p>
                    <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`from payment_switch import PaymentSwitch

client = PaymentSwitch('pk_test_...')
session = client.create_session(
    amount=5000,
    currency='USD'
)`}
                    </pre>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>iOS SDK (Swift)</CardTitle>
                    <CardDescription>For native iOS apps</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground">Swift Package Manager:</p>
                    <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`dependencies: [
  .package(url: "github.com/payment-switch/swift-sdk")
]`}
                    </pre>
                    <p className="text-sm text-muted-foreground mt-4">Basic usage:</p>
                    <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`let ps = PaymentSwitch(apiKey: "pk_test_...")
ps.checkout(amount: 5000, currency: "USD")`}
                    </pre>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Android SDK (Kotlin)</CardTitle>
                    <CardDescription>For native Android apps</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground">Gradle:</p>
                    <pre className="bg-muted p-3 rounded text-xs">
{`implementation 'com.paymentswitch:android-sdk:1.0.0'`}
                    </pre>
                    <p className="text-sm text-muted-foreground mt-4">Basic usage:</p>
                    <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`val ps = PaymentSwitch(apiKey = "pk_test_...")
ps.checkout(activity, amount = 5000)`}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="api-keys" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" /> API Key Management</CardTitle>
                  <CardDescription>Create and manage API keys for your integrations</CardDescription>
                </CardHeader>
                <CardContent>
                  <ApiKeysSection />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="webhooks" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Webhook className="h-5 w-5" /> Webhook Endpoints</CardTitle>
                  <CardDescription>Configure and test webhook endpoints for real-time event notifications</CardDescription>
                </CardHeader>
                <CardContent>
                  <WebhooksSection />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Example Webhook Handler</CardTitle></CardHeader>
                <CardContent>
                  <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
{`app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const isValid = verifySignature(req.body, signature, webhookSecret);
  if (!isValid) return res.status(401).send('Invalid signature');
  
  const event = req.body;
  switch (event.type) {
    case 'payment.completed':
      updateOrder(event.data.sessionId, 'paid');
      break;
    case 'transfer.completed':
      notifyRecipient(event.data.transferId);
      break;
  }
  res.send('OK');
});`}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="api-docs" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>API Documentation</CardTitle>
                  <CardDescription>Interactive API documentation powered by OpenAPI/Swagger</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Full interactive API documentation is available at <code className="bg-muted px-2 py-1 rounded">/api/docs</code>.
                    This covers all 43 tRPC routers including payments, transfers, compliance, and admin endpoints.
                  </p>
                  <Button onClick={() => window.open('/api/docs', '_blank')}>
                    <Book className="h-4 w-4 mr-2" /> Open API Docs
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Security Best Practices</CardTitle>
                  <CardDescription>Keep your integration secure</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold mb-1">Use HTTPS</h3>
                      <p className="text-sm text-muted-foreground">
                        Always use HTTPS in production to protect sensitive data in transit.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold mb-1">Never Expose Secret Keys</h3>
                      <p className="text-sm text-muted-foreground">
                        Keep your secret API keys on the server. Never include them in client-side code.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold mb-1">Verify Webhook Signatures</h3>
                      <p className="text-sm text-muted-foreground">
                        Always verify webhook signatures to ensure requests are from Payment Switch.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold mb-1">PCI Compliance</h3>
                      <p className="text-sm text-muted-foreground">
                        Use our hosted checkout to avoid handling card data directly and reduce PCI compliance scope.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Test Cards */}
          <Card>
            <CardHeader>
              <CardTitle>Test Cards</CardTitle>
              <CardDescription>Use these cards in test mode</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-3 bg-muted rounded">
                    <code className="text-sm">4242 4242 4242 4242</code>
                    <Badge variant="outline" className="bg-green-100 text-green-700">Success</Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted rounded">
                    <code className="text-sm">4000 0000 0000 0002</code>
                    <Badge variant="outline" className="bg-red-100 text-red-700">Decline</Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-3 bg-muted rounded">
                    <code className="text-sm">4000 0000 0000 9995</code>
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-700">Insufficient Funds</Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted rounded">
                    <code className="text-sm">4000 0025 0000 3155</code>
                    <Badge variant="outline" className="bg-blue-100 text-blue-700">3D Secure</Badge>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Use any future expiry date, any 3-digit CVV, and any ZIP code.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Chat Widget */}
      <ChatWidget />
    </div>
  );
}
