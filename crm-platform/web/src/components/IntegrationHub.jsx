import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Wifi, Activity, Zap, Server, Database, Shield, Clock, CheckCircle,
  AlertTriangle, XCircle, RefreshCw, ArrowRight, BarChart3, MessageSquare
} from 'lucide-react'
import { BarChart, Bar, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { eventBus } from '../services/eventBus'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const TOPIC_COLORS = {
  'core-banking': '#3b82f6',
  'agent-banking': '#10b981',
  'remittance': '#8b5cf6',
  'crm': '#f59e0b',
}

const IntegrationHub = () => {
  const [topicStats, setTopicStats] = useState({})
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setTopicStats(eventBus.getTopicStats())
    setEvents(eventBus.getRecentEvents(10))
    setLoading(false)
  }

  if (loading) {
    return (
      <div role="region" aria-label="IntegrationHub"  className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  const systems = [
    {
      name: 'Kafka Event Bus',
      status: 'Healthy',
      icon: MessageSquare,
      metrics: { 'Topics': '10', 'Messages/sec': '281', 'Consumer Groups': '6', 'Lag': '8' },
      color: 'border-blue-500',
      statusColor: 'text-green-500'
    },
    {
      name: 'APISIX Gateway',
      status: 'Healthy',
      icon: Shield,
      metrics: { 'Routes': '24', 'Upstreams': '8', 'Req/sec': '1,250', 'Error Rate': '0.1%' },
      color: 'border-green-500',
      statusColor: 'text-green-500'
    },
    {
      name: 'Keycloak Auth',
      status: 'Healthy',
      icon: Shield,
      metrics: { 'Realms': '3', 'Users': '48,900', 'Sessions': '12,450', 'Tokens/min': '850' },
      color: 'border-purple-500',
      statusColor: 'text-green-500'
    },
    {
      name: 'Temporal Workflows',
      status: 'Healthy',
      icon: Activity,
      metrics: { 'Active Workflows': '142', 'Completed/hr': '89', 'Failed': '2', 'Namespaces': '4' },
      color: 'border-amber-500',
      statusColor: 'text-green-500'
    },
    {
      name: 'Redis Cache',
      status: 'Healthy',
      icon: Database,
      metrics: { 'Memory': '2.4 GB', 'Keys': '125K', 'Hit Rate': '98.5%', 'Connections': '45' },
      color: 'border-red-500',
      statusColor: 'text-green-500'
    },
    {
      name: 'FalkorDB Graph',
      status: 'Healthy',
      icon: Database,
      metrics: { 'Nodes': '285K', 'Edges': '1.2M', 'Queries/sec': '120', 'Latency': '4ms' },
      color: 'border-cyan-500',
      statusColor: 'text-green-500'
    },
    {
      name: 'Dapr Service Mesh',
      status: 'Healthy',
      icon: Server,
      metrics: { 'Services': '12', 'Pub/Sub': '10 topics', 'State Stores': '3', 'Bindings': '8' },
      color: 'border-indigo-500',
      statusColor: 'text-green-500'
    },
    {
      name: 'Permify Authorization',
      status: 'Healthy',
      icon: Shield,
      metrics: { 'Policies': '48', 'Checks/sec': '450', 'Roles': '12', 'Tenants': '3' },
      color: 'border-pink-500',
      statusColor: 'text-green-500'
    },
  ]

  const topicData = Object.entries(topicStats).map(([topic, stats]) => ({
    name: topic.split('.').pop(),
    fullName: topic,
    messagesPerMinute: stats.messagesPerMinute,
    lag: stats.lag,
    consumers: stats.consumers,
    color: topic.startsWith('core-banking') ? '#3b82f6' :
           topic.startsWith('agent-banking') ? '#10b981' :
           topic.startsWith('remittance') ? '#8b5cf6' : '#f59e0b'
  }))

  const adapters = [
    {
      name: 'Core Banking Adapter',
      source: 'T24 / Finacle / Flexcube',
      target: 'CRM Golden Record',
      protocol: 'REST + Kafka',
      status: 'Active',
      syncFrequency: 'Real-time',
      lastSync: '2 min ago',
      recordsSynced: '48,900',
      color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
    },
    {
      name: 'Agent Banking Adapter',
      source: 'Paga / OPay / Kudi / Moniepoint',
      target: 'CRM Golden Record',
      protocol: 'REST + Kafka',
      status: 'Active',
      syncFrequency: 'Real-time',
      lastSync: '30 sec ago',
      recordsSynced: '28,500',
      color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    },
    {
      name: 'Remittance Adapter',
      source: 'WorldRemit / Flutterwave / Paystack',
      target: 'CRM Golden Record',
      protocol: 'gRPC + Kafka',
      status: 'Active',
      syncFrequency: 'Real-time',
      lastSync: '1 min ago',
      recordsSynced: '46,900',
      color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
    }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-cyan-100 dark:bg-cyan-900/30 rounded-xl">
            <Wifi className="w-7 h-7 text-cyan-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Integration Hub</h1>
            <p className="text-gray-500 dark:text-gray-400">Middleware, event bus & system connectivity</p>
          </div>
        </div>
        <button onClick={loadData} className="flex items-center space-x-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition">
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Adapters */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Integration Adapters</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {adapters.map((adapter) => (
            <div key={adapter.name} className={`rounded-xl border p-5 ${adapter.color}`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900 dark:text-white">{adapter.name}</h4>
                <span className="flex items-center space-x-1 text-green-600 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  <span>{adapter.status}</span>
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500 w-20">Source:</span>
                  <span className="text-gray-900 dark:text-white">{adapter.source}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500 w-20">Target:</span>
                  <span className="text-gray-900 dark:text-white">{adapter.target}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500 w-20">Protocol:</span>
                  <span className="text-gray-900 dark:text-white">{adapter.protocol}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500 w-20">Sync:</span>
                  <span className="text-gray-900 dark:text-white">{adapter.syncFrequency}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500 w-20">Records:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{adapter.recordsSynced}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500 w-20">Last Sync:</span>
                  <span className="text-gray-600 dark:text-gray-300">{adapter.lastSync}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Kafka Topic Stats */}
      <div tabIndex="0" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Kafka Topic Throughput</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={topicData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis />
            <Tooltip content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const d = payload[0].payload
                return (
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
                    <p className="font-semibold text-sm">{d.fullName}</p>
                    <p className="text-sm text-gray-500">{d.messagesPerMinute} msg/min • {d.consumers} consumers • lag: {d.lag}</p>
                  </div>
                )
              }
              return null
            }} />
            <Bar dataKey="messagesPerMinute" name="Messages/min" radius={[4, 4, 0, 0]}>
              {topicData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Middleware Systems */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Middleware Services</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {systems.map((sys) => (
            <motion.div key={sys.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`bg-white dark:bg-gray-800 rounded-xl border-l-4 border border-gray-200 dark:border-gray-700 ${sys.color} p-4`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <sys.icon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{sys.name}</h4>
                </div>
                <CheckCircle className={`w-4 h-4 ${sys.statusColor}`} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(sys.metrics).map(([key, val]) => (
                  <div key={key}>
                    <p className="text-xs text-gray-500">{key}</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{val}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Event Log */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Events</h3>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-gray-500">Streaming</span>
          </div>
        </div>
        <div className="space-y-2">
          {events.map((event) => (
            <div key={event.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-700/30 text-sm">
              <div className="flex items-center space-x-3">
                <div className={`w-2 h-2 rounded-full ${
                  event.source === 'Core Banking' ? 'bg-blue-500' :
                  event.source === 'Agent Banking' ? 'bg-green-500' :
                  event.source === 'Remittance' ? 'bg-purple-500' : 'bg-amber-500'
                }`} />
                <span className="font-medium text-gray-900 dark:text-white">{event.type.replace(/_/g, ' ')}</span>
                <span className="text-gray-500">{event.source}</span>
              </div>
              <div className="flex items-center space-x-3 text-gray-500">
                <span className="font-mono text-xs">{event.topic}</span>
                <span>{Math.round((Date.now() - new Date(event.timestamp)) / 60000)}m ago</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default IntegrationHub
