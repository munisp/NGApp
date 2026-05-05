import { useState } from 'react'
import { useTenant } from '../contexts/TenantContext'

const CocoIndexPipeline = () => {
  const { tenant } = useTenant()
  const [activeTab, setActiveTab] = useState('overview')

  const stats = {
    totalEntities: 14, totalRelationships: 17, activeSources: 7,
    entityTypes: { Customer: 6, Product: 5, Campaign: 3 },
    relationshipTypes: { SUBSCRIBED_TO: 6, REFERRED: 3, RESPONDED_TO: 2, CONVERTED_FROM: 1, INQUIRED_ABOUT: 1, COMPLAINED_ABOUT: 1, CROSS_SELLS_WITH: 1, UPGRADES_TO: 1, TARGETED: 3 },
    engine: 'CocoIndex v2.0',
  }

  const entities = [
    { id: 'cust-001', type: 'Customer', name: 'Adamu Ibrahim', source: 'core_banking', hash: 'a3f2c1' },
    { id: 'cust-002', type: 'Customer', name: 'Fatima Bello', source: 'agent_banking', hash: 'b4e3d2' },
    { id: 'cust-003', type: 'Customer', name: 'Chinedu Okafor', source: 'core_banking', hash: 'c5f4e3' },
    { id: 'cust-004', type: 'Customer', name: 'Aisha Mohammed', source: 'agent_banking', hash: 'd6a5f4' },
    { id: 'cust-005', type: 'Customer', name: 'Emeka Nwosu', source: 'remittance', hash: 'e7b6a5' },
    { id: 'cust-006', type: 'Customer', name: 'Grace Adeyemi', source: 'agent_banking', hash: 'f8c7b6' },
    { id: 'prod-001', type: 'Product', name: 'Premium Savings', source: 'product_catalog', hash: 'a1b2c3' },
    { id: 'prod-002', type: 'Product', name: 'Business Current', source: 'product_catalog', hash: 'b2c3d4' },
    { id: 'prod-003', type: 'Product', name: 'Mobile Money Wallet', source: 'product_catalog', hash: 'c3d4e5' },
  ]

  const relationships = [
    { subject: 'cust-001', predicate: 'SUBSCRIBED_TO', object: 'prod-001', confidence: 0.99, source: 'core_banking' },
    { subject: 'cust-001', predicate: 'SUBSCRIBED_TO', object: 'prod-002', confidence: 0.99, source: 'core_banking' },
    { subject: 'cust-001', predicate: 'REFERRED', object: 'cust-002', confidence: 0.92, source: 'call_transcript_001' },
    { subject: 'cust-003', predicate: 'REFERRED', object: 'cust-006', confidence: 0.87, source: 'email_thread_042' },
    { subject: 'cust-005', predicate: 'INQUIRED_ABOUT', object: 'prod-004', confidence: 0.78, source: 'call_transcript_015' },
    { subject: 'cust-004', predicate: 'COMPLAINED_ABOUT', object: 'prod-003', confidence: 0.85, source: 'support_ticket_291' },
    { subject: 'prod-001', predicate: 'CROSS_SELLS_WITH', object: 'prod-004', confidence: 0.72, source: 'ml_analysis' },
  ]

  const jobs = [
    { id: 'job-001', source: 'core_banking', status: 'completed', entities: 6, relationships: 8, delta: true, duration: 245 },
    { id: 'job-002', source: 'transactions', status: 'completed', entities: 1420, relationships: 2100, delta: true, duration: 1850 },
    { id: 'job-003', source: 'campaigns', status: 'completed', entities: 3, relationships: 6, delta: false, duration: 120 },
    { id: 'job-004', source: 'documents', status: 'completed', entities: 42, relationships: 67, delta: true, duration: 3200 },
    { id: 'job-005', source: 'call_transcripts', status: 'running', entities: 0, relationships: 0, delta: true, duration: 0 },
  ]

  const sources = [
    { name: 'core_banking', type: 'database', interval: '30s', status: 'active' },
    { name: 'agent_banking', type: 'database', interval: '60s', status: 'active' },
    { name: 'transactions', type: 'kafka', topic: 'crm.transactions', status: 'active' },
    { name: 'campaigns', type: 'database', interval: '120s', status: 'active' },
    { name: 'documents', type: 'filesystem', watch: true, status: 'active' },
    { name: 'call_transcripts', type: 's3', bucket: 'crm-transcripts', status: 'active' },
    { name: 'emails', type: 'imap', interval: '300s', status: 'active' },
  ]

  const statusColors = { completed: 'bg-green-100 text-green-800', running: 'bg-blue-100 text-blue-800 animate-pulse', failed: 'bg-red-100 text-red-800' }
  const tabs = [
    { key: 'overview', label: 'Pipeline Overview' },
    { key: 'entities', label: 'Indexed Entities' },
    { key: 'relationships', label: 'Relationships' },
    { key: 'jobs', label: 'Indexing Jobs' },
    { key: 'sources', label: 'Data Sources' },
  ]

  return (
    <div className="space-y-6" data-tenant={tenant?.id}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">CocoIndex — Data Indexing Pipeline</h1>
          <p className="text-gray-500 mt-1">Incremental knowledge graph construction with delta-only processing</p>
        </div>
        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">Delta Processing Active</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Indexed Entities</p>
          <p className="text-3xl font-bold text-blue-600">{stats.totalEntities}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Relationships</p>
          <p className="text-3xl font-bold text-purple-600">{stats.totalRelationships}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Active Sources</p>
          <p className="text-3xl font-bold text-green-600">{stats.activeSources}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Entity Types</p>
          <p className="text-3xl font-bold text-orange-600">{Object.keys(stats.entityTypes).length}</p>
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

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="font-semibold mb-3">Entity Type Distribution</h3>
            {Object.entries(stats.entityTypes).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm">{type}</span>
                <span className="px-2 py-1 bg-blue-50 text-blue-800 rounded text-xs font-medium">{count}</span>
              </div>
            ))}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="font-semibold mb-3">Relationship Types</h3>
            {Object.entries(stats.relationshipTypes).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                <span className="text-xs font-mono">{type}</span>
                <span className="text-xs text-gray-500">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'entities' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Source</th>
                  <th className="px-4 py-3 text-left">Content Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {entities.map((e, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 font-mono text-xs">{e.id}</td>
                    <td className="px-4 py-3"><span className="px-2 py-1 bg-blue-50 text-blue-800 rounded text-xs">{e.type}</span></td>
                    <td className="px-4 py-3 font-medium">{e.name}</td>
                    <td className="px-4 py-3 text-gray-500">{e.source}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{e.hash}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'relationships' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left">Subject</th>
                  <th className="px-4 py-3 text-left">Predicate</th>
                  <th className="px-4 py-3 text-left">Object</th>
                  <th className="px-4 py-3 text-left">Confidence</th>
                  <th className="px-4 py-3 text-left">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {relationships.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 font-mono text-xs">{r.subject}</td>
                    <td className="px-4 py-3"><span className="px-2 py-1 bg-purple-50 text-purple-800 rounded text-xs font-medium">{r.predicate}</span></td>
                    <td className="px-4 py-3 font-mono text-xs">{r.object}</td>
                    <td className="px-4 py-3">{(r.confidence * 100).toFixed(0)}%</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'jobs' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left">Job ID</th>
                  <th className="px-4 py-3 text-left">Source</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Entities</th>
                  <th className="px-4 py-3 text-left">Relations</th>
                  <th className="px-4 py-3 text-left">Delta</th>
                  <th className="px-4 py-3 text-left">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {jobs.map((j, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 font-mono text-xs">{j.id}</td>
                    <td className="px-4 py-3">{j.source}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[j.status]}`}>{j.status}</span></td>
                    <td className="px-4 py-3">{j.entities.toLocaleString()}</td>
                    <td className="px-4 py-3">{j.relationships.toLocaleString()}</td>
                    <td className="px-4 py-3">{j.delta ? 'Yes' : 'Full'}</td>
                    <td className="px-4 py-3">{j.duration > 0 ? `${j.duration}ms` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'sources' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sources.map((s, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-green-500">
              <div className="flex justify-between items-start">
                <h4 className="font-semibold capitalize">{s.name.replace(/_/g, ' ')}</h4>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">{s.status}</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">Type: {s.type}</p>
              {s.interval && <p className="text-xs text-gray-400">Poll: every {s.interval}</p>}
              {s.topic && <p className="text-xs text-gray-400">Topic: {s.topic}</p>}
              {s.bucket && <p className="text-xs text-gray-400">Bucket: {s.bucket}</p>}
              {s.watch && <p className="text-xs text-gray-400">File watcher: enabled</p>}
            </div>
          ))}
        </div>
      )}

      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-green-900 dark:text-green-200">Technology Value — CocoIndex</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm text-gray-700 dark:text-gray-300">
          <ul className="space-y-1">
            <li>• Incremental delta processing — only changed data re-indexed (not full rebuild)</li>
            <li>• LLM-powered relationship extraction from unstructured data (call transcripts, emails)</li>
            <li>• Content-hash deduplication prevents duplicate entity creation</li>
          </ul>
          <ul className="space-y-1">
            <li>• Multi-source ingestion: databases, Kafka, S3, IMAP, filesystem</li>
            <li>• Feeds FalkorDB and Neo4j with continuously fresh knowledge graph data</li>
            <li>• Written in Rust (core) + Python (API) — ultra performant at scale</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default CocoIndexPipeline
