import { useState } from 'react'
import {
  Code2, Download, Book, Copy, CheckCircle, Terminal, Globe, Package,
  FileCode, Braces, ChevronRight, ExternalLink
} from 'lucide-react'

const LANGUAGES = [
  { id: 'python', name: 'Python', icon: '🐍', pkg: 'banking-crm-sdk', install: 'pip install banking-crm-sdk', version: '2.1.0', size: '245 KB' },
  { id: 'javascript', name: 'JavaScript', icon: '🟨', pkg: '@banking-crm/sdk', install: 'npm install @banking-crm/sdk', version: '2.1.0', size: '189 KB' },
  { id: 'go', name: 'Go', icon: '🔵', pkg: 'github.com/banking-crm/sdk-go', install: 'go get github.com/banking-crm/sdk-go@v2.1.0', version: '2.1.0', size: '312 KB' },
  { id: 'java', name: 'Java', icon: '☕', pkg: 'com.banking-crm:sdk', install: "implementation 'com.banking-crm:sdk:2.1.0'", version: '2.1.0', size: '428 KB' },
  { id: 'ruby', name: 'Ruby', icon: '💎', pkg: 'banking_crm_sdk', install: 'gem install banking_crm_sdk', version: '2.1.0', size: '178 KB' },
]

const CODE_EXAMPLES = {
  python: {
    auth: `from banking_crm_sdk import BankingCRMClient

client = BankingCRMClient(
    base_url="https://api.banking-crm.example.com/v1",
    api_key="prod_your_api_key_here",
    tenant_id="tenant-acme-bank"
)

# Client handles JWT token refresh automatically`,
    customers: `# List customers with pagination
customers = client.customers.list(page=1, limit=50, source="core-banking")
print(f"Found {customers.total} customers")

for customer in customers.data:
    print(f"{customer.name} - {customer.segment}")

# Create a new customer
new_customer = client.customers.create(
    name="Adebayo Ogundimu",
    email="adebayo@example.ng",
    phone="+2348012345678",
    source="agent-banking",
    segment="retail"
)`,
    transactions: `# Process a transaction
txn = client.banking.transactions.create(
    account_id="acct-123",
    amount=50000.00,
    currency="NGN",
    type="transfer",
    reference="TXN-2025-001",
    idempotency_key="unique-key-abc"
)

# Check transaction status
status = client.banking.transactions.get(txn.id)
print(f"Status: {status.status}, Amount: {status.amount}")`,
    webhooks: `# Verify webhook signature
from banking_crm_sdk.webhooks import verify_signature

def webhook_handler(request):
    payload = request.body
    signature = request.headers["X-Webhook-Signature"]
    
    if verify_signature(payload, signature, webhook_secret):
        event = json.loads(payload)
        if event["type"] == "customer.created":
            handle_new_customer(event["data"])
        elif event["type"] == "transaction.completed":
            handle_transaction(event["data"])
    else:
        return Response(status=401)`,
  },
  javascript: {
    auth: `import { BankingCRMClient } from '@banking-crm/sdk';

const client = new BankingCRMClient({
  baseUrl: 'https://api.banking-crm.example.com/v1',
  apiKey: 'prod_your_api_key_here',
  tenantId: 'tenant-acme-bank',
});

// Client handles JWT token refresh automatically`,
    customers: `// List customers with pagination
const { data, total } = await client.customers.list({
  page: 1,
  limit: 50,
  source: 'core-banking',
});
console.log(\`Found \${total} customers\`);

// Create a new customer
const customer = await client.customers.create({
  name: 'Adebayo Ogundimu',
  email: 'adebayo@example.ng',
  phone: '+2348012345678',
  source: 'agent-banking',
  segment: 'retail',
});`,
    transactions: `// Process a transaction
const txn = await client.banking.transactions.create({
  accountId: 'acct-123',
  amount: 50000.00,
  currency: 'NGN',
  type: 'transfer',
  reference: 'TXN-2025-001',
  idempotencyKey: 'unique-key-abc',
});

// Check transaction status
const status = await client.banking.transactions.get(txn.id);
console.log(\`Status: \${status.status}, Amount: \${status.amount}\`);`,
    webhooks: `// Verify webhook signature (Express.js)
import { verifySignature } from '@banking-crm/sdk/webhooks';

app.post('/webhooks', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  
  if (verifySignature(req.body, signature, webhookSecret)) {
    const event = JSON.parse(req.body);
    switch (event.type) {
      case 'customer.created':
        handleNewCustomer(event.data);
        break;
      case 'transaction.completed':
        handleTransaction(event.data);
        break;
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(401);
  }
});`,
  },
  go: {
    auth: `package main

import (
    sdk "github.com/banking-crm/sdk-go"
)

func main() {
    client := sdk.NewClient(
        sdk.WithBaseURL("https://api.banking-crm.example.com/v1"),
        sdk.WithAPIKey("prod_your_api_key_here"),
        sdk.WithTenantID("tenant-acme-bank"),
    )

    // Client handles JWT token refresh automatically
}`,
    customers: `// List customers with pagination
customers, err := client.Customers.List(ctx, &sdk.ListParams{
    Page:   1,
    Limit:  50,
    Source: "core-banking",
})
if err != nil {
    log.Fatal(err)
}
fmt.Printf("Found %d customers\\n", customers.Total)

// Create a new customer
customer, err := client.Customers.Create(ctx, &sdk.CreateCustomerRequest{
    Name:    "Adebayo Ogundimu",
    Email:   "adebayo@example.ng",
    Phone:   "+2348012345678",
    Source:  "agent-banking",
    Segment: "retail",
})`,
    transactions: `// Process a transaction
txn, err := client.Banking.Transactions.Create(ctx, &sdk.CreateTransactionRequest{
    AccountID:      "acct-123",
    Amount:         50000.00,
    Currency:       "NGN",
    Type:           "transfer",
    Reference:      "TXN-2025-001",
    IdempotencyKey: "unique-key-abc",
})
if err != nil {
    log.Fatal(err)
}

// Check transaction status
status, err := client.Banking.Transactions.Get(ctx, txn.ID)
fmt.Printf("Status: %s, Amount: %.2f\\n", status.Status, status.Amount)`,
    webhooks: `// Verify webhook signature (net/http)
import "github.com/banking-crm/sdk-go/webhooks"

func webhookHandler(w http.ResponseWriter, r *http.Request) {
    payload, _ := io.ReadAll(r.Body)
    signature := r.Header.Get("X-Webhook-Signature")
    
    if webhooks.VerifySignature(payload, signature, webhookSecret) {
        var event sdk.WebhookEvent
        json.Unmarshal(payload, &event)
        
        switch event.Type {
        case "customer.created":
            handleNewCustomer(event.Data)
        case "transaction.completed":
            handleTransaction(event.Data)
        }
        w.WriteHeader(http.StatusOK)
    } else {
        w.WriteHeader(http.StatusUnauthorized)
    }
}`,
  },
}

const API_SECTIONS = [
  { name: 'Customers', endpoints: [
    { method: 'GET', path: '/v1/customers', desc: 'List customers' },
    { method: 'POST', path: '/v1/customers', desc: 'Create customer' },
    { method: 'GET', path: '/v1/customers/{id}', desc: 'Get customer' },
    { method: 'PUT', path: '/v1/customers/{id}', desc: 'Update customer' },
  ]},
  { name: 'Core Banking', endpoints: [
    { method: 'GET', path: '/v1/banking/accounts', desc: 'List accounts' },
    { method: 'GET', path: '/v1/banking/transactions', desc: 'List transactions' },
    { method: 'POST', path: '/v1/banking/transactions', desc: 'Create transaction' },
  ]},
  { name: 'Agent Banking', endpoints: [
    { method: 'GET', path: '/v1/agents', desc: 'List agents' },
    { method: 'POST', path: '/v1/agents/{id}/transactions', desc: 'Process agent transaction' },
  ]},
  { name: 'Remittance', endpoints: [
    { method: 'GET', path: '/v1/remittance/corridors', desc: 'List corridors' },
    { method: 'POST', path: '/v1/remittance/transfers', desc: 'Initiate transfer' },
  ]},
  { name: 'Campaigns', endpoints: [
    { method: 'GET', path: '/v1/campaigns', desc: 'List campaigns' },
    { method: 'POST', path: '/v1/campaigns', desc: 'Create campaign' },
  ]},
  { name: 'API Keys', endpoints: [
    { method: 'GET', path: '/v1/api-keys', desc: 'List API keys' },
    { method: 'POST', path: '/v1/api-keys', desc: 'Create API key' },
    { method: 'DELETE', path: '/v1/api-keys/{id}', desc: 'Revoke API key' },
  ]},
  { name: 'Webhooks', endpoints: [
    { method: 'GET', path: '/v1/webhooks', desc: 'List subscriptions' },
    { method: 'POST', path: '/v1/webhooks', desc: 'Create subscription' },
    { method: 'POST', path: '/v1/webhooks/verify', desc: 'Verify signature' },
  ]},
]

const METHOD_COLORS = {
  GET: 'bg-green-100 text-green-700',
  POST: 'bg-blue-100 text-blue-700',
  PUT: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
}

const SDKDocs = () => {
  const [lang, setLang] = useState('python')
  const [tab, setTab] = useState('quickstart')
  const [copiedId, setCopiedId] = useState(null)
  const [expandedSection, setExpandedSection] = useState('Customers')

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const currentLang = LANGUAGES.find(l => l.id === lang)
  const examples = CODE_EXAMPLES[lang] || CODE_EXAMPLES.python

  const CodeBlock = ({ code, id }) => (
    <div className="relative">
      <button onClick={() => handleCopy(code, id)}
        className="absolute top-2 right-2 p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300">
        {copiedId === id ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
      </button>
      <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm font-mono">
        <code>{code}</code>
      </pre>
    </div>
  )

  const tabs = ['quickstart', 'api-reference', 'sdks']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-violet-100 dark:bg-violet-900/30 rounded-xl">
            <Code2 className="w-7 h-7 text-violet-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">SDK & API Documentation</h1>
            <p className="text-gray-500 dark:text-gray-400">Integration guides, code examples & SDK downloads</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition ${tab === t ? 'bg-white dark:bg-gray-600 shadow text-violet-600' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.replace('-', ' ')}
          </button>
        ))}
      </div>

      {tab === 'quickstart' && (
        <>
          {/* Language Selector */}
          <div className="flex space-x-2">
            {LANGUAGES.map(l => (
              <button key={l.id} onClick={() => setLang(l.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition ${lang === l.id ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700' : 'border-gray-200 hover:border-gray-300'}`}>
                <span>{l.icon}</span>
                <span className="text-sm font-medium">{l.name}</span>
              </button>
            ))}
          </div>

          {/* Install */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
            <h3 className="font-semibold flex items-center space-x-2 mb-3">
              <Terminal className="w-5 h-5 text-gray-500" />
              <span>Installation</span>
            </h3>
            <CodeBlock code={currentLang.install} id="install" />
          </div>

          {/* Auth Example */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
            <h3 className="font-semibold flex items-center space-x-2 mb-3">
              <Braces className="w-5 h-5 text-gray-500" />
              <span>Authentication</span>
            </h3>
            <CodeBlock code={examples.auth} id="auth" />
          </div>

          {/* Customers Example */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
            <h3 className="font-semibold flex items-center space-x-2 mb-3">
              <FileCode className="w-5 h-5 text-gray-500" />
              <span>Customer Management</span>
            </h3>
            <CodeBlock code={examples.customers} id="customers" />
          </div>

          {/* Transactions Example */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
            <h3 className="font-semibold flex items-center space-x-2 mb-3">
              <FileCode className="w-5 h-5 text-gray-500" />
              <span>Transaction Processing</span>
            </h3>
            <CodeBlock code={examples.transactions} id="txns" />
          </div>

          {/* Webhook Verification Example */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
            <h3 className="font-semibold flex items-center space-x-2 mb-3">
              <FileCode className="w-5 h-5 text-gray-500" />
              <span>Webhook Signature Verification</span>
            </h3>
            <CodeBlock code={examples.webhooks} id="webhooks" />
          </div>
        </>
      )}

      {tab === 'api-reference' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border">
          <div className="p-4 border-b">
            <h3 className="font-semibold">API Endpoints</h3>
            <p className="text-sm text-gray-500">Base URL: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-xs">https://api.banking-crm.example.com/v1</code></p>
          </div>
          <div className="divide-y">
            {API_SECTIONS.map(section => (
              <div key={section.name}>
                <button onClick={() => setExpandedSection(expandedSection === section.name ? null : section.name)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-750">
                  <span className="font-medium">{section.name}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-400">{section.endpoints.length} endpoints</span>
                    <ChevronRight className={`w-4 h-4 transition ${expandedSection === section.name ? 'rotate-90' : ''}`} />
                  </div>
                </button>
                {expandedSection === section.name && (
                  <div className="px-4 pb-3 space-y-2">
                    {section.endpoints.map((ep, i) => (
                      <div key={i} className="flex items-center space-x-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${METHOD_COLORS[ep.method]}`}>{ep.method}</span>
                        <code className="text-sm font-mono flex-1">{ep.path}</code>
                        <span className="text-xs text-gray-500">{ep.desc}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'sdks' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {LANGUAGES.map(l => (
            <div key={l.id} className="bg-white dark:bg-gray-800 rounded-xl border p-4">
              <div className="flex items-center space-x-3 mb-3">
                <span className="text-2xl">{l.icon}</span>
                <div>
                  <h3 className="font-semibold">{l.name} SDK</h3>
                  <p className="text-xs text-gray-500">v{l.version} | {l.size}</p>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-3">
                <code className="text-xs font-mono break-all">{l.install}</code>
              </div>
              <div className="text-xs text-gray-500">
                <p>Package: <code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">{l.pkg}</code></p>
              </div>
              <div className="flex space-x-2 mt-3">
                <button className="flex-1 flex items-center justify-center space-x-1 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700">
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button className="flex items-center justify-center px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
                  <Book className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default SDKDocs
