import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target,
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Eye,
  Phone,
  Mail,
  Building,
  Star,
  Clock,
  CheckCircle,
  AlertCircle,
  MoreHorizontal,
  X,
  ArrowRight,
  ArrowUp,
  ArrowDown
} from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  FunnelChart,
  Funnel
} from 'recharts'

const CRMCore = () => {
  const [activeTab, setActiveTab] = useState('pipeline')
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItems, setSelectedItems] = useState([])
  const [showFilters, setShowFilters] = useState(false)
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [showOpportunityModal, setShowOpportunityModal] = useState(false)
  const [selectedLead, setSelectedLead] = useState(null)
  const [selectedOpportunity, setSelectedOpportunity] = useState(null)

  // Mock data
  const [pipelineData, setPipelineData] = useState([
    { stage: 'Prospecting', count: 45, value: 450000, color: '#3B82F6' },
    { stage: 'Qualification', count: 32, value: 640000, color: '#10B981' },
    { stage: 'Proposal', count: 18, value: 720000, color: '#F59E0B' },
    { stage: 'Negotiation', count: 12, value: 480000, color: '#EF4444' },
    { stage: 'Closed Won', count: 8, value: 320000, color: '#8B5CF6' }
  ])

  const [leads, setLeads] = useState([
    {
      id: 1,
      name: 'John Smith',
      company: 'Tech Solutions Inc',
      title: 'CTO',
      email: 'john.smith@techsolutions.com',
      phone: '+1 (555) 123-4567',
      source: 'Website',
      status: 'New',
      score: 85,
      lastActivity: '2024-01-15',
      createdAt: '2024-01-10',
      notes: 'Interested in enterprise solution'
    },
    {
      id: 2,
      name: 'Sarah Johnson',
      company: 'Global Corp',
      title: 'VP Sales',
      email: 'sarah.j@globalcorp.com',
      phone: '+1 (555) 987-6543',
      source: 'Referral',
      status: 'Qualified',
      score: 92,
      lastActivity: '2024-01-14',
      createdAt: '2024-01-08',
      notes: 'Ready for demo presentation'
    }
  ])

  const [opportunities, setOpportunities] = useState([
    {
      id: 1,
      name: 'Enterprise Software License',
      account: 'Tech Solutions Inc',
      stage: 'Proposal',
      amount: 125000,
      probability: 75,
      closeDate: '2024-02-15',
      owner: 'Alice Cooper',
      source: 'Inbound Lead',
      lastActivity: '2024-01-15',
      createdAt: '2024-01-05',
      products: ['Enterprise Suite', 'Support Package'],
      competitors: ['Competitor A', 'Competitor B']
    },
    {
      id: 2,
      name: 'Professional Services Contract',
      account: 'Global Corp',
      stage: 'Negotiation',
      amount: 85000,
      probability: 60,
      closeDate: '2024-02-28',
      owner: 'Bob Wilson',
      source: 'Referral',
      lastActivity: '2024-01-14',
      createdAt: '2024-01-12',
      products: ['Professional Services', 'Training'],
      competitors: ['Competitor C']
    }
  ])

  const [activities, setActivities] = useState([
    {
      id: 1,
      type: 'call',
      title: 'Discovery Call with Tech Solutions',
      description: 'Initial needs assessment and product demo',
      date: '2024-01-15',
      time: '14:00',
      duration: 60,
      status: 'completed',
      relatedTo: 'Lead',
      relatedId: 1
    },
    {
      id: 2,
      type: 'email',
      title: 'Proposal Follow-up',
      description: 'Sent detailed proposal and pricing',
      date: '2024-01-14',
      time: '10:30',
      status: 'completed',
      relatedTo: 'Opportunity',
      relatedId: 1
    }
  ])

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setLoading(false)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'new': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
      case 'contacted': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
      case 'qualified': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
      case 'unqualified': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
    }
  }

  const getStageColor = (stage) => {
    switch (stage.toLowerCase()) {
      case 'prospecting': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
      case 'qualification': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
      case 'proposal': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
      case 'negotiation': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300'
      case 'closed won': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
      case 'closed lost': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
    }
  }

  const PipelineStage = ({ stage, isLast }) => (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex-1 relative"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{stage.stage}</h3>
          <span className="text-sm text-gray-600 dark:text-gray-400">{stage.count} deals</span>
        </div>
        <div className="space-y-2">
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            ${stage.value.toLocaleString()}
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="h-2 rounded-full"
              style={{ 
                width: `${(stage.count / 45) * 100}%`,
                backgroundColor: stage.color 
              }}
            />
          </div>
        </div>
      </div>
      {!isLast && (
        <div className="absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
          <ArrowRight className="h-6 w-6 text-gray-400 bg-white dark:bg-gray-800 rounded-full p-1" />
        </div>
      )}
    </motion.div>
  )

  const LeadCard = ({ lead }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-semibold">
              {lead.name.split(' ').map(n => n[0]).join('')}
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{lead.name}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{lead.title} at {lead.company}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}>
            {lead.status}
          </span>
          <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <MoreHorizontal className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>
      
      <div className="space-y-2 mb-3">
        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
          <Mail className="h-4 w-4" />
          <span>{lead.email}</span>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
          <Phone className="h-4 w-4" />
          <span>{lead.phone}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Star className="h-4 w-4 text-yellow-500" />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Score: {lead.score}
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => {
              setSelectedLead(lead)
              setShowLeadModal(true)
            }}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button className="p-2 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors">
            <Edit className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )

  const OpportunityCard = ({ opportunity }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{opportunity.name}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{opportunity.account}</p>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStageColor(opportunity.stage)}`}>
          {opportunity.stage}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Amount</p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            ${opportunity.amount.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Probability</p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">{opportunity.probability}%</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
          <Calendar className="h-4 w-4" />
          <span>{new Date(opportunity.closeDate).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => {
              setSelectedOpportunity(opportunity)
              setShowOpportunityModal(true)
            }}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button className="p-2 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors">
            <Edit className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">CRM Core</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your sales pipeline, leads, and opportunities
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Add Lead</span>
          </button>
          <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Add Opportunity</span>
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Pipeline</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                $2.61M
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-full">
              <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="flex items-center mt-4">
            <ArrowUp className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-600 dark:text-green-400 ml-1">
              12.5%
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">vs last month</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Leads</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                {leads.length}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
              <Target className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="flex items-center mt-4">
            <ArrowUp className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-600 dark:text-green-400 ml-1">
              8.2%
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">vs last month</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Opportunities</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                {opportunities.length}
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-full">
              <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <div className="flex items-center mt-4">
            <ArrowDown className="h-4 w-4 text-red-600 dark:text-red-400" />
            <span className="text-sm font-medium text-red-600 dark:text-red-400 ml-1">
              2.1%
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">vs last month</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Win Rate</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                68%
              </p>
            </div>
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-full">
              <CheckCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
          <div className="flex items-center mt-4">
            <ArrowUp className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-600 dark:text-green-400 ml-1">
              5.3%
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">vs last month</span>
          </div>
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'pipeline', label: 'Sales Pipeline', icon: TrendingUp },
              { id: 'leads', label: 'Leads', icon: Target },
              { id: 'opportunities', label: 'Opportunities', icon: DollarSign },
              { id: 'activities', label: 'Activities', icon: Clock }
            ].map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'pipeline' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Sales Pipeline Overview
                </h3>
                <div className="flex items-center space-x-3">
                  <select className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm">
                    <option>This Quarter</option>
                    <option>This Month</option>
                    <option>This Year</option>
                  </select>
                </div>
              </div>

              <div className="flex space-x-4 overflow-x-auto pb-4">
                {pipelineData.map((stage, index) => (
                  <PipelineStage
                    key={stage.stage}
                    stage={stage}
                    isLast={index === pipelineData.length - 1}
                  />
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Pipeline by Stage
                  </h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={pipelineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                      <XAxis dataKey="stage" stroke="#6B7280" />
                      <YAxis stroke="#6B7280" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1F2937',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#F9FAFB'
                        }}
                      />
                      <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Deal Count by Stage
                  </h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pipelineData}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="count"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {pipelineData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'leads' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Leads Management
                </h3>
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search leads..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2">
                    <Filter className="h-4 w-4" />
                    <span>Filter</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {leads.map(lead => (
                  <LeadCard key={lead.id} lead={lead} />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'opportunities' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Opportunities Management
                </h3>
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search opportunities..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2">
                    <Filter className="h-4 w-4" />
                    <span>Filter</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {opportunities.map(opportunity => (
                  <OpportunityCard key={opportunity.id} opportunity={opportunity} />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'activities' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Recent Activities
                </h3>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>Add Activity</span>
                </button>
              </div>

              <div className="space-y-4">
                {activities.map(activity => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-full ${
                          activity.type === 'call' ? 'bg-blue-100 dark:bg-blue-900/20' :
                          activity.type === 'email' ? 'bg-green-100 dark:bg-green-900/20' :
                          'bg-gray-100 dark:bg-gray-600'
                        }`}>
                          {activity.type === 'call' ? (
                            <Phone className={`h-4 w-4 ${
                              activity.type === 'call' ? 'text-blue-600 dark:text-blue-400' : ''
                            }`} />
                          ) : (
                            <Mail className={`h-4 w-4 ${
                              activity.type === 'email' ? 'text-green-600 dark:text-green-400' : ''
                            }`} />
                          )}
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">
                            {activity.title}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {activity.description}
                          </p>
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-gray-500">
                            <span>{activity.date} at {activity.time}</span>
                            {activity.duration && <span>{activity.duration} min</span>}
                            <span className="capitalize">{activity.relatedTo}</span>
                          </div>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        activity.status === 'completed' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                      }`}>
                        {activity.status}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CRMCore

