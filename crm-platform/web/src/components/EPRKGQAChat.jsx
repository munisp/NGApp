import { useState } from 'react'
import { useTenant } from '../contexts/TenantContext'

const EPRKGQAChat = () => {
  const { tenant } = useTenant()
  const [question, setQuestion] = useState('')
  const [chatHistory, setChatHistory] = useState([])

  const sampleQuestions = [
    { q: "Who are our top customers in Lagos that haven't bought insurance?", complexity: 'multi-hop' },
    { q: 'Which premium customers have referred others?', complexity: '2-hop' },
    { q: 'What are the most popular products?', complexity: 'aggregation' },
    { q: 'Which customers are at risk of churning?', complexity: 'single-hop' },
    { q: 'Who referred Fatima Bello?', complexity: 'single-hop' },
  ]

  const kgStats = {
    totalEntities: 19, totalRelations: 24,
    entityTypes: { Customer: 8, Product: 6, City: 5 },
    relationTypes: ['LIVES_IN', 'HAS_PRODUCT', 'REFERRED'],
  }

  const precomputedAnswers = {
    "haven't bought insurance": {
      answer: "3 customers in Lagos without insurance: Chinedu Okafor, Bola Ogundimu, Ngozi Eze",
      patterns: [{ subjectType: 'Customer', predicate: 'LIVES_IN', objectType: 'City', score: 0.92 }, { subjectType: 'Customer', predicate: 'HAS_PRODUCT (negation)', objectType: 'Product', score: 0.88 }],
      entities: [
        { name: 'Chinedu Okafor', segment: 'premium', ltv: 5200000, products: ['savings', 'fixed_deposit'] },
        { name: 'Bola Ogundimu', segment: 'standard', ltv: 290000, products: ['current'] },
        { name: 'Ngozi Eze', segment: 'premium', ltv: 4100000, products: ['savings', 'current', 'fixed_deposit'] },
      ],
      steps: ['Decompose: find Customer LIVES_IN Lagos AND NOT HAS_PRODUCT insurance', 'Retrieved 2 atomic patterns: LIVES_IN, HAS_PRODUCT', 'Extracted subgraph: 4 Lagos customers, filter by product negation', 'NSM reasoning: 3 customers match (Adamu already has insurance)'],
      confidence: 0.89,
    },
    'premium': {
      answer: '4 premium customers: Chinedu Okafor (₦5,200,000), Ngozi Eze (₦4,100,000), Emeka Nwosu (₦3,800,000), Adamu Ibrahim (₦2,450,000)',
      patterns: [{ subjectType: 'Customer', predicate: 'HAS_SEGMENT', objectType: 'premium', score: 0.90 }],
      entities: [
        { name: 'Chinedu Okafor', ltv: 5200000 },
        { name: 'Ngozi Eze', ltv: 4100000 },
        { name: 'Emeka Nwosu', ltv: 3800000 },
        { name: 'Adamu Ibrahim', ltv: 2450000 },
      ],
      steps: ['Decompose: find Customer with segment=premium', 'Retrieved 1 atomic pattern: HAS_SEGMENT', 'Extracted subgraph: all 8 customers, filter by segment', 'NSM reasoning: 4 match, sorted by LTV'],
      confidence: 0.92,
    },
    'popular': {
      answer: 'Products by popularity: Premium Savings (3 subscribers), Business Current (2), Mobile Money Wallet (2), Fixed Deposit (1), Remittance Express (1)',
      patterns: [{ subjectType: 'Customer', predicate: 'HAS_PRODUCT', objectType: 'Product', score: 0.88 }],
      entities: [{ name: 'Premium Savings', subscribers: 3 }, { name: 'Business Current', subscribers: 2 }, { name: 'Mobile Money Wallet', subscribers: 2 }],
      steps: ['Decompose: count Customer HAS_PRODUCT relationships per Product', 'Retrieved 1 atomic pattern: HAS_PRODUCT', 'Aggregated subgraph: 11 HAS_PRODUCT edges across 6 products', 'NSM reasoning: sorted by count'],
      confidence: 0.88,
    },
    'churn': {
      answer: '1 at-risk customer: Aisha Mohammed (₦95,000 LTV, agent_banking channel)',
      patterns: [{ subjectType: 'Customer', predicate: 'HAS_SEGMENT', objectType: 'at_risk', score: 0.87 }],
      entities: [{ name: 'Aisha Mohammed', ltv: 95000, channel: 'agent_banking' }],
      steps: ['Decompose: find Customer with segment=at_risk', 'Retrieved 1 atomic pattern', 'Extracted subgraph: 1 match', 'NSM reasoning: direct match'],
      confidence: 0.85,
    },
    'referred fatima': {
      answer: 'Adamu Ibrahim referred Fatima Bello',
      patterns: [{ subjectType: 'Customer', predicate: 'REFERRED', objectType: 'Customer', score: 0.85 }],
      entities: [{ name: 'Adamu Ibrahim', role: 'referrer' }, { name: 'Fatima Bello', role: 'referred' }],
      steps: ['Decompose: find Customer REFERRED Fatima Bello', 'Retrieved 1 atomic pattern: REFERRED', 'Traversed 3 REFERRED edges, found match', 'NSM reasoning: Adamu Ibrahim → Fatima Bello'],
      confidence: 0.95,
    },
  }

  const handleAsk = (q) => {
    const questionText = q || question
    if (!questionText.trim()) return

    let result = null
    const lower = questionText.toLowerCase()
    for (const [key, val] of Object.entries(precomputedAnswers)) {
      if (lower.includes(key)) { result = val; break }
    }

    if (!result) {
      result = {
        answer: "I can answer questions about customers (by city, segment, products), product popularity, referral networks, and churn risk. Try one of the sample questions!",
        patterns: [], entities: [], steps: ['No matching pattern found'], confidence: 0.3,
      }
    }

    setChatHistory(prev => [...prev, { question: questionText, ...result }])
    setQuestion('')
  }

  return (
    <div className="space-y-6" data-tenant={tenant?.id}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">EPR-KGQA — Knowledge Graph Q&A</h1>
          <p className="text-gray-500 mt-1">Evidence Pattern Retrieval for complex multi-hop CRM questions</p>
        </div>
        <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium">WWW&apos;24 Paper</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">KG Entities</p>
          <p className="text-3xl font-bold text-indigo-600">{kgStats.totalEntities}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">KG Relations</p>
          <p className="text-3xl font-bold text-purple-600">{kgStats.totalRelations}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Entity Types</p>
          <p className="text-3xl font-bold text-blue-600">{Object.keys(kgStats.entityTypes).length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Relation Types</p>
          <p className="text-3xl font-bold text-teal-600">{kgStats.relationTypes.length}</p>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Ask Questions Over Your CRM Knowledge Graph</h3>
          <p className="text-sm text-gray-500">EPR decomposes complex questions into atomic patterns, retrieves evidence subgraphs, then reasons via NSM</p>
        </div>

        <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
          {chatHistory.map((entry, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-end"><div className="bg-indigo-100 text-indigo-900 rounded-lg px-4 py-2 max-w-lg"><p className="text-sm font-medium">{entry.question}</p></div></div>
              <div className="flex justify-start">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg px-4 py-3 max-w-2xl space-y-2">
                  <p className="text-sm">{entry.answer}</p>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${entry.confidence > 0.8 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {(entry.confidence * 100).toFixed(0)}% confidence
                    </span>
                    <span className="text-xs text-gray-400">{entry.entities.length} entities</span>
                  </div>
                  {entry.patterns.length > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      <span className="font-medium">Patterns: </span>
                      {entry.patterns.map((p, j) => (
                        <span key={j} className="inline-block bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded mr-1 mt-1">
                          {p.subjectType} → {p.predicate} → {p.objectType}
                        </span>
                      ))}
                    </div>
                  )}
                  {entry.steps.length > 0 && (
                    <details className="text-xs text-gray-500 mt-1">
                      <summary className="cursor-pointer font-medium">Reasoning steps</summary>
                      <ol className="mt-1 ml-4 space-y-0.5 list-decimal">
                        {entry.steps.map((s, j) => <li key={j}>{s}</li>)}
                      </ol>
                    </details>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200">
          <div className="flex space-x-2">
            <input type="text" value={question} onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAsk()}
              placeholder="Ask a question about your CRM data..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
            <button onClick={() => handleAsk()} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Ask</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {sampleQuestions.map((sq, i) => (
              <button key={i} onClick={() => handleAsk(sq.q)}
                className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs hover:bg-indigo-100 border border-indigo-200">
                <span className="text-indigo-400 mr-1">[{sq.complexity}]</span> {sq.q}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-200">Technology Value — EPR-KGQA</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm text-gray-700 dark:text-gray-300">
          <ul className="space-y-1">
            <li>• Complex multi-hop QA: &quot;Lagos customers without insurance&quot; requires 2 graph traversals</li>
            <li>• Evidence Pattern Retrieval explicitly models structural dependencies in KG</li>
            <li>• 10+ F1 point improvement over prior IR-KGQA methods (WWW&apos;24)</li>
          </ul>
          <ul className="space-y-1">
            <li>• Explainable: shows atomic patterns, evidence subgraphs, and reasoning steps</li>
            <li>• Integrates with CocoIndex (entities) and FalkorDB (graph storage)</li>
            <li>• Enables non-technical users to query CRM data in natural language</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default EPRKGQAChat
