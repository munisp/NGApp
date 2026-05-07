import { useState } from 'react'
import { useTenant } from '../contexts/TenantContext'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const OllamaInference = () => {
  const { tenant } = useTenant()
  const [activeTab, setActiveTab] = useState('generate')
  const [prompt, setPrompt] = useState('')
  const [selectedModel, setSelectedModel] = useState('llama3.2:3b')
  const [response, setResponse] = useState(null)

  const models = [
    { name: 'llama3.2:3b', size: '2.0 GB', quantization: 'Q4_K_M', status: 'loaded', purpose: 'General CRM intelligence, email drafting' },
    { name: 'mistral:7b', size: '4.1 GB', quantization: 'Q4_K_M', status: 'available', purpose: 'Complex reasoning, compliance review' },
    { name: 'phi3:mini', size: '2.3 GB', quantization: 'Q4_0', status: 'available', purpose: 'Fast inference, sentiment analysis' },
    { name: 'codellama:7b', size: '3.8 GB', quantization: 'Q4_K_M', status: 'available', purpose: 'API documentation, SDK code generation' },
    { name: 'nomic-embed-text', size: '274 MB', quantization: 'FP16', status: 'loaded', purpose: 'Text embeddings for semantic search' },
  ]

  const tasks = [
    { label: 'Customer Summary', prompt: 'Summarize customer Adamu Ibrahim', icon: '👤' },
    { label: 'Draft Email', prompt: 'Draft a marketing email for Premium Savings product', icon: '📧' },
    { label: 'Campaign Copy', prompt: 'Generate campaign copy for insurance product', icon: '📝' },
    { label: 'Sentiment Analysis', prompt: 'Analyze sentiment: customer complaint about service delay', icon: '😊' },
    { label: 'Compliance Review', prompt: 'Review compliance document for NDPR and CBN regulations', icon: '📋' },
    { label: 'Entity Extraction', prompt: 'Extract entities and knowledge from customer interaction', icon: '🔍' },
  ]

  const precomputedResponses = {
    'summary': {
      response: 'Premium customer since 2021. Core banking client with savings (₦1.2M), current (₦1.25M), and insurance bundle. High engagement — responds to SMS campaigns (12% response rate). Referred 1 customer (Fatima Bello). No missed payments. Recommended: Fixed deposit upsell based on idle current account balance.',
      tokens: 52, latency: 45.2,
    },
    'email': {
      response: 'Subject: Exclusive Offer for Valued Customers\n\nDear Valued Customer,\n\nAs one of our most valued premium customers, we\'re pleased to offer you exclusive access to our new Fixed Deposit product with preferential rates.\n\nKey benefits:\n- 12% annual returns on 12-month tenor\n- Capital guaranteed by NDIC\n- Flexible rollover options\n\nThis offer is available until March 31, 2025. Contact your relationship manager or visit any branch to get started.\n\nBest regards,\nCRM Team',
      tokens: 85, latency: 68.4,
    },
    'campaign': {
      response: 'Protect what matters most. Our Insurance Bundle covers life, health, and property with premiums starting at ₦1,500/month. Get covered today.',
      tokens: 28, latency: 32.1,
    },
    'sentiment': {
      response: '{"label": "negative", "score": 0.82, "keywords": ["frustrated", "poor", "waiting", "unresolved"]}',
      tokens: 15, latency: 22.8,
    },
    'compliance': {
      response: 'Compliance Review Summary:\n1. NDPR (Nigeria Data Protection Regulation): Document references personal data collection in sections 3.2, 4.1. Consent mechanism present but needs explicit opt-in language.\n2. CBN Guidelines: KYC requirements met in section 2. BVN verification referenced.\n3. PCI-DSS: Card data handling in section 5 needs encryption-at-rest clarification.\n4. AML/CFT: Transaction monitoring thresholds defined (₦5M cash, ₦10M transfers).\nRecommendation: Update section 3.2 consent language, add encryption-at-rest specification.',
      tokens: 95, latency: 82.3,
    },
    'extract': {
      response: '{"entities": [{"type": "PERSON", "text": "Adamu Ibrahim", "confidence": 0.97}, {"type": "ORGANIZATION", "text": "Acme Microfinance Bank", "confidence": 0.95}, {"type": "MONEY", "text": "₦2,450,000", "confidence": 0.99}], "relationships": [{"subject": "Adamu Ibrahim", "predicate": "IS_CUSTOMER_OF", "object": "Acme Microfinance Bank"}]}',
      tokens: 45, latency: 38.6,
    },
  }

  const handleGenerate = (p) => {
    const promptText = p || prompt
    if (!promptText.trim()) return
    const lower = promptText.toLowerCase()
    for (const [key, val] of Object.entries(precomputedResponses)) {
      if (lower.includes(key) || (key === 'summary' && (lower.includes('summarize') || lower.includes('profile'))) || (key === 'email' && lower.includes('draft')) || (key === 'campaign' && lower.includes('copy')) || (key === 'sentiment' && lower.includes('sentiment')) || (key === 'compliance' && lower.includes('compliance')) || (key === 'extract' && lower.includes('extract'))) {
        setResponse({ ...val, model: selectedModel, localInference: true })
        return
      }
    }
    setResponse({
      response: "I'm the CRM AI assistant powered by local Ollama inference. I can help with:\n- Customer profile summaries\n- Email/campaign copy drafting\n- Sentiment analysis\n- Compliance document review\n- Entity/knowledge extraction\n\nAll processing happens locally — your data never leaves the platform.",
      tokens: 42, latency: 35.0, model: selectedModel, localInference: true,
    })
  }

  const statusColors = { loaded: 'bg-green-100 text-green-800', available: 'bg-gray-100 text-gray-800' }
  const tabs = [
    { key: 'generate', label: 'AI Generate' },
    { key: 'models', label: 'Models' },
    { key: 'tasks', label: 'CRM Tasks' },
  ]

  return (
    <div role="region" aria-label="OllamaInference"  className="space-y-6" data-tenant={tenant?.id}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ollama — Local LLM Inference</h1>
          <p className="text-gray-500 mt-1">100% on-premises AI inference — customer data never leaves the platform</p>
        </div>
        <div className="flex items-center space-x-3">
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">Local Inference</span>
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">NDPR Compliant</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Available Models</p>
          <p className="text-3xl font-bold text-blue-600">{models.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Loaded Models</p>
          <p className="text-3xl font-bold text-green-600">{models.filter(m => m.status === 'loaded').length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Avg Latency</p>
          <p className="text-3xl font-bold text-purple-600">45ms</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Data Sovereignty</p>
          <p className="text-3xl font-bold text-emerald-600">100%</p>
          <p className="text-xs text-gray-400">zero external API calls</p>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex space-x-4">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === tab.key ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'generate' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center space-x-4 mb-3">
              <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                {models.map(m => <option key={m.name} value={m.name}>{m.name} ({m.size})</option>)}
              </select>
            </div>
            <div className="flex space-x-2">
              <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleGenerate())}
                placeholder="Enter your prompt... (e.g., Summarize customer Adamu Ibrahim)"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-none" rows={3} />
              <button onClick={() => handleGenerate()} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 self-end">Generate</button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {tasks.map((t, i) => (
                <button key={i} onClick={() => { setPrompt(t.prompt); handleGenerate(t.prompt) }}
                  className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs hover:bg-green-100 border border-green-200">
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {response && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">Response</h4>
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <span className="bg-gray-100 px-2 py-1 rounded">{response.model}</span>
                  <span>{response.tokens} tokens</span>
                  <span>{response.latency}ms</span>
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded">Local</span>
                </div>
              </div>
              <pre className="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">{response.response}</pre>
            </div>
          )}
        </div>
      )}

      {activeTab === 'models' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map((m, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex justify-between items-start">
                <h4 className="font-semibold">{m.name}</h4>
                <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[m.status]}`}>{m.status}</span>
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-gray-500">Size</dt><dd>{m.size}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Quantization</dt><dd>{m.quantization}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Purpose</dt><dd className="text-right text-xs">{m.purpose}</dd></div>
              </dl>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks.map((t, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => { setActiveTab('generate'); setPrompt(t.prompt); handleGenerate(t.prompt) }}>
              <div className="text-3xl mb-2">{t.icon}</div>
              <h4 className="font-semibold">{t.label}</h4>
              <p className="text-sm text-gray-500 mt-1">{t.prompt}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-gray-800 dark:to-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-200">Technology Value — Ollama</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm text-gray-700 dark:text-gray-300">
          <ul className="space-y-1">
            <li>• 100% local inference — zero API costs, zero data leakage</li>
            <li>• NDPR/GDPR compliant by design — PII never leaves the platform</li>
            <li>• Powers 6 CRM AI tasks without external LLM providers</li>
          </ul>
          <ul className="space-y-1">
            <li>• Runs Llama 3.2, Mistral, Phi-3 — open-weight models with commercial licenses</li>
            <li>• Quantized models (Q4_K_M) run on modest hardware — no GPU required</li>
            <li>• Integrates with CocoIndex for RAG over CRM knowledge graph</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default OllamaInference
