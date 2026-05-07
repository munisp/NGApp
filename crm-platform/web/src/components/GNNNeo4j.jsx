import { useState } from 'react'
import { useTenant } from '../contexts/TenantContext'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const GNNNeo4j = () => {
  const { tenant } = useTenant()
  const [activeTab, setActiveTab] = useState('fraud')

  // Seed data — GNN fraud detection results
  const fraudScores = [
    { nodeId: 'C011', name: 'Phantom LLC', probability: 0.92, riskLevel: 'critical', reasons: ['Shared device D004 with 3 users', 'Circular transaction pattern detected', 'Member of suspicious community #2'], connectedFrauds: 3, communityId: 2 },
    { nodeId: 'C012', name: 'Shell Entity', probability: 0.88, riskLevel: 'critical', reasons: ['Shared device D004 with 3 users', 'Circular transaction pattern', 'Transacts with high-risk merchant Shadow Trading Co'], connectedFrauds: 2, communityId: 2 },
    { nodeId: 'C013', name: 'Unknown Import Co', probability: 0.85, riskLevel: 'critical', reasons: ['Shared device D004 with 3 users', 'Transacts with high-risk merchant Shadow Trading Co', 'Member of suspicious community #2'], connectedFrauds: 2, communityId: 2 },
    { nodeId: 'C004', name: 'Aisha Mohammed', probability: 0.45, riskLevel: 'medium', reasons: ['Pre-existing risk flag', 'Shared phone with C007'], connectedFrauds: 1, communityId: 1 },
    { nodeId: 'C007', name: 'Bola Ogundimu', probability: 0.38, riskLevel: 'medium', reasons: ['Pre-existing risk flag', 'Shared phone with C004'], connectedFrauds: 1, communityId: 1 },
    { nodeId: 'C008', name: 'Ibrahim Yusuf', probability: 0.30, riskLevel: 'medium', reasons: ['Pre-existing risk flag'], connectedFrauds: 0, communityId: 3 },
  ]

  const fraudSummary = { total: 15, critical: 3, high: 0, medium: 3, low: 9 }

  const communities = [
    { id: 0, members: ['C001', 'C002', 'C003', 'C005', 'C009', 'C010', 'C014', 'C015'], label: 'legitimate', density: 0.32, size: 8, avgDegree: 3.2 },
    { id: 1, members: ['C004', 'C007'], label: 'suspicious_pair', density: 0.50, size: 2, avgDegree: 2.0 },
    { id: 2, members: ['C011', 'C012', 'C013'], label: 'suspicious_ring', density: 0.83, size: 3, avgDegree: 4.7 },
    { id: 3, members: ['C006', 'C008'], label: 'legitimate', density: 0.25, size: 2, avgDegree: 1.5 },
  ]

  const linkPredictions = [
    { source: 'C001', target: 'C005', probability: 0.82, relationship: 'LIKELY_REFERRAL', reason: 'Embedding similarity: 0.79, 2 common neighbors' },
    { source: 'C003', target: 'C009', probability: 0.76, relationship: 'POTENTIAL_CROSS_SELL', reason: 'Embedding similarity: 0.74, 1 common neighbor' },
    { source: 'C002', target: 'C006', probability: 0.68, relationship: 'POTENTIAL_CROSS_SELL', reason: 'Embedding similarity: 0.71, same channel' },
    { source: 'C009', target: 'C003', probability: 0.65, relationship: 'LIKELY_REFERRAL', reason: 'Embedding similarity: 0.68, 2 common neighbors' },
    { source: 'C005', target: 'C014', probability: 0.61, relationship: 'POTENTIAL_CROSS_SELL', reason: 'Embedding similarity: 0.63, premium segment' },
  ]

  const influenceScores = [
    { customerId: 'C001', name: 'Adamu Ibrahim', pageRank: 0.142, degree: 6, influence: 18.5, tier: 'key_influencer', reachCount: 12 },
    { customerId: 'C003', name: 'Chinedu Okafor', pageRank: 0.128, degree: 5, influence: 16.2, tier: 'key_influencer', reachCount: 10 },
    { customerId: 'C005', name: 'Emeka Nwosu', pageRank: 0.115, degree: 4, influence: 14.8, tier: 'connector', reachCount: 9 },
    { customerId: 'C009', name: 'Ngozi Eze', pageRank: 0.098, degree: 3, influence: 12.1, tier: 'connector', reachCount: 7 },
    { customerId: 'C014', name: 'Kemi Fawole', pageRank: 0.087, degree: 3, influence: 10.5, tier: 'connector', reachCount: 6 },
  ]

  const graphStats = { totalNodes: 24, totalEdges: 32, embeddingDim: 64, gnnLayers: 3, aggregation: 'mean' }

  const tabs = [
    { key: 'fraud', label: 'Fraud Detection' },
    { key: 'communities', label: 'Communities' },
    { key: 'predictions', label: 'Link Prediction' },
    { key: 'influence', label: 'Influence Scoring' },
  ]

  const riskColors = { critical: 'bg-red-100 text-red-800', high: 'bg-orange-100 text-orange-800', medium: 'bg-yellow-100 text-yellow-800', low: 'bg-green-100 text-green-800' }

  return (
    <div role="region" aria-label="GNNNeo4j"  className="space-y-6" data-tenant={tenant?.id}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">GNN + Neo4j — Graph Neural Networks</h1>
          <p className="text-gray-500 mt-1">Graph-based fraud detection, community analysis, link prediction & influence scoring</p>
        </div>
        <div className="flex items-center space-x-3">
          <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">GraphSAGE Model</span>
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">{graphStats.totalNodes} Nodes</span>
          <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium">{graphStats.totalEdges} Edges</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Critical Fraud Signals</p>
          <p className="text-3xl font-bold text-red-600">{fraudSummary.critical}</p>
          <p className="text-xs text-gray-400 mt-1">of {fraudSummary.total} entities analyzed</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Suspicious Communities</p>
          <p className="text-3xl font-bold text-orange-600">{communities.filter(c => c.label.includes('suspicious')).length}</p>
          <p className="text-xs text-gray-400 mt-1">of {communities.length} detected</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Cross-Sell Predictions</p>
          <p className="text-3xl font-bold text-blue-600">{linkPredictions.length}</p>
          <p className="text-xs text-gray-400 mt-1">high-probability links</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Key Influencers</p>
          <p className="text-3xl font-bold text-purple-600">{influenceScores.filter(s => s.tier === 'key_influencer').length}</p>
          <p className="text-xs text-gray-400 mt-1">top network connectors</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-4">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === tab.key ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Fraud Detection */}
      {activeTab === 'fraud' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">GNN Fraud Detection — GraphSAGE</h3>
            <p className="text-sm text-gray-500">3-layer GraphSAGE with mean aggregation, 64-dim embeddings</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left">Entity</th>
                  <th className="px-4 py-3 text-left">Risk Level</th>
                  <th className="px-4 py-3 text-left">Probability</th>
                  <th className="px-4 py-3 text-left">Connected Frauds</th>
                  <th className="px-4 py-3 text-left">Community</th>
                  <th className="px-4 py-3 text-left">Reasons</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {fraudScores.map((score, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 font-medium">{score.name}<span className="text-xs text-gray-400 ml-2">{score.nodeId}</span></td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${riskColors[score.riskLevel]}`}>{score.riskLevel}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div className={`h-2 rounded-full ${score.probability > 0.7 ? 'bg-red-500' : score.probability > 0.4 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{width: `${score.probability * 100}%`}}></div>
                        </div>
                        <span>{(score.probability * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{score.connectedFrauds}</td>
                    <td className="px-4 py-3">#{score.communityId}</td>
                    <td className="px-4 py-3 max-w-xs">
                      <ul className="text-xs text-gray-500 space-y-1">
                        {score.reasons.map((r, j) => <li key={j}>• {r}</li>)}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Communities */}
      {activeTab === 'communities' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {communities.map(comm => (
            <div key={comm.id} className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 ${comm.label.includes('suspicious') ? 'border-red-500' : 'border-green-500'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold">Community #{comm.id}</h4>
                  <span className={`text-xs px-2 py-1 rounded ${comm.label.includes('suspicious') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{comm.label}</span>
                </div>
                <span className="text-sm text-gray-500">{comm.size} members</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">Density:</span> <span className="font-medium">{comm.density.toFixed(2)}</span></div>
                <div><span className="text-gray-500">Avg Degree:</span> <span className="font-medium">{comm.avgDegree.toFixed(1)}</span></div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {comm.members.map(m => (
                  <span key={m} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">{m}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Link Predictions */}
      {activeTab === 'predictions' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Link Prediction — Cross-Sell Opportunities</h3>
            <p className="text-sm text-gray-500">GNN embedding cosine similarity + common neighbor analysis</p>
          </div>
          <div className="divide-y divide-gray-200">
            {linkPredictions.map((pred, i) => (
              <div key={i} className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className="font-mono text-sm bg-blue-50 px-2 py-1 rounded">{pred.source}</span>
                  <span className="text-gray-400">→</span>
                  <span className="font-mono text-sm bg-blue-50 px-2 py-1 rounded">{pred.target}</span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${pred.relationship === 'LIKELY_REFERRAL' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{pred.relationship}</span>
                  <span className="text-sm font-semibold">{(pred.probability * 100).toFixed(0)}%</span>
                </div>
                <p className="text-xs text-gray-500 max-w-xs">{pred.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Influence Scoring */}
      {activeTab === 'influence' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Customer Influence Scoring — PageRank + Centrality</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Tier</th>
                  <th className="px-4 py-3 text-left">PageRank</th>
                  <th className="px-4 py-3 text-left">Degree</th>
                  <th className="px-4 py-3 text-left">Influence Score</th>
                  <th className="px-4 py-3 text-left">2-Hop Reach</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {influenceScores.map((score, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 font-medium">{score.name}<span className="text-xs text-gray-400 ml-2">{score.customerId}</span></td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${score.tier === 'key_influencer' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>{score.tier}</span></td>
                    <td className="px-4 py-3">{score.pageRank.toFixed(3)}</td>
                    <td className="px-4 py-3">{score.degree}</td>
                    <td className="px-4 py-3 font-semibold">{score.influence.toFixed(1)}</td>
                    <td className="px-4 py-3">{score.reachCount} customers</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Technology Value */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-200">Technology Value — GNN + Neo4j</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm">
          <div>
            <h4 className="font-medium text-purple-800 dark:text-purple-300">What GNN Adds</h4>
            <ul className="mt-2 space-y-1 text-gray-700 dark:text-gray-300">
              <li>• Fraud ring detection via graph-structure learning (vs. isolated transaction rules)</li>
              <li>• Customer embeddings encode relationship context — not just individual features</li>
              <li>• Message-passing aggregates neighbor signals: guilt-by-association scoring</li>
              <li>• Link prediction for cross-sell: "customers like you also use..."</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-purple-800 dark:text-purple-300">What Neo4j Adds</h4>
            <ul className="mt-2 space-y-1 text-gray-700 dark:text-gray-300">
              <li>• Native graph storage for customer/transaction/device relationship data</li>
              <li>• Cypher queries for real-time fraud ring traversal</li>
              <li>• Graph Data Science library: PageRank, betweenness, community detection</li>
              <li>• Persistent storage for GNN-computed embeddings and scores</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GNNNeo4j
