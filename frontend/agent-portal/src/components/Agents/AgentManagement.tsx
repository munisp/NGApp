import React, { useState, useEffect } from 'react'
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Eye, 
  MapPin, 
  Phone, 
  Mail, 
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  Star,
  Award,
  Target,
  Wallet,
  CreditCard
} from 'lucide-react'

interface Agent {
  id: string
  name: string
  email: string
  phone: string
  level: 'Agent' | 'Super Agent' | 'Master Agent'
  status: 'active' | 'inactive' | 'suspended' | 'pending'
  location: {
    state: string
    lga: string
    address: string
  }
  joinDate: string
  lastActive: string
  metrics: {
    totalTransactions: number
    transactionVolume: number
    commission: number
    floatBalance: number
    successRate: number
    customers: number
  }
  hierarchy: {
    parentAgent?: string
    subAgents: number
    level: number
  }
  compliance: {
    kycStatus: 'verified' | 'pending' | 'rejected'
    licenseStatus: 'valid' | 'expired' | 'pending'
    lastAudit: string
  }
  performance: {
    rating: number
    rank: number
    targets: {
      monthly: number
      achieved: number
    }
  }
}

const AgentManagement: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([
    {
      id: 'AGT001',
      name: 'Olumide Adebayo',
      email: 'olumide.adebayo@agentbank.ng',
      phone: '+234-803-123-4567',
      level: 'Super Agent',
      status: 'active',
      location: {
        state: 'Lagos',
        lga: 'Ikeja',
        address: '123 Allen Avenue, Ikeja, Lagos'
      },
      joinDate: '2023-01-15',
      lastActive: '2024-01-15 14:30:00',
      metrics: {
        totalTransactions: 2847,
        transactionVolume: 45678900,
        commission: 456789,
        floatBalance: 1234567,
        successRate: 98.5,
        customers: 234
      },
      hierarchy: {
        subAgents: 12,
        level: 2
      },
      compliance: {
        kycStatus: 'verified',
        licenseStatus: 'valid',
        lastAudit: '2024-01-01'
      },
      performance: {
        rating: 4.8,
        rank: 1,
        targets: {
          monthly: 500000,
          achieved: 456789
        }
      }
    },
    {
      id: 'AGT002',
      name: 'Hauwa Garba',
      email: 'hauwa.garba@agentbank.ng',
      phone: '+234-806-234-5678',
      level: 'Agent',
      status: 'active',
      location: {
        state: 'Kano',
        lga: 'Fagge',
        address: '45 Ibrahim Taiwo Road, Kano'
      },
      joinDate: '2023-03-20',
      lastActive: '2024-01-15 13:45:00',
      metrics: {
        totalTransactions: 1892,
        transactionVolume: 28934500,
        commission: 289345,
        floatBalance: 567890,
        successRate: 97.2,
        customers: 156
      },
      hierarchy: {
        parentAgent: 'AGT001',
        subAgents: 5,
        level: 3
      },
      compliance: {
        kycStatus: 'verified',
        licenseStatus: 'valid',
        lastAudit: '2024-01-01'
      },
      performance: {
        rating: 4.6,
        rank: 2,
        targets: {
          monthly: 300000,
          achieved: 289345
        }
      }
    },
    {
      id: 'AGT003',
      name: 'Emeka Okafor',
      email: 'emeka.okafor@agentbank.ng',
      phone: '+234-809-345-6789',
      level: 'Agent',
      status: 'pending',
      location: {
        state: 'Enugu',
        lga: 'Enugu North',
        address: '78 Ogui Road, Enugu'
      },
      joinDate: '2024-01-10',
      lastActive: '2024-01-15 12:20:00',
      metrics: {
        totalTransactions: 45,
        transactionVolume: 1234500,
        commission: 12345,
        floatBalance: 100000,
        successRate: 95.6,
        customers: 23
      },
      hierarchy: {
        parentAgent: 'AGT002',
        subAgents: 0,
        level: 4
      },
      compliance: {
        kycStatus: 'pending',
        licenseStatus: 'pending',
        lastAudit: 'N/A'
      },
      performance: {
        rating: 4.2,
        rank: 15,
        targets: {
          monthly: 150000,
          achieved: 12345
        }
      }
    },
    {
      id: 'AGT004',
      name: 'Fatima Aliyu',
      email: 'fatima.aliyu@agentbank.ng',
      phone: '+234-807-456-7890',
      level: 'Master Agent',
      status: 'active',
      location: {
        state: 'Abuja',
        lga: 'Wuse',
        address: '12 Ademola Adetokunbo Crescent, Wuse II, Abuja'
      },
      joinDate: '2022-08-12',
      lastActive: '2024-01-15 15:10:00',
      metrics: {
        totalTransactions: 4567,
        transactionVolume: 89123400,
        commission: 891234,
        floatBalance: 2345678,
        successRate: 99.1,
        customers: 456
      },
      hierarchy: {
        subAgents: 25,
        level: 1
      },
      compliance: {
        kycStatus: 'verified',
        licenseStatus: 'valid',
        lastAudit: '2024-01-01'
      },
      performance: {
        rating: 4.9,
        rank: 1,
        targets: {
          monthly: 800000,
          achieved: 891234
        }
      }
    },
    {
      id: 'AGT005',
      name: 'Chinedu Okoro',
      email: 'chinedu.okoro@agentbank.ng',
      phone: '+234-805-567-8901',
      level: 'Agent',
      status: 'suspended',
      location: {
        state: 'Rivers',
        lga: 'Port Harcourt',
        address: '34 Aba Road, Port Harcourt'
      },
      joinDate: '2023-06-18',
      lastActive: '2024-01-10 09:30:00',
      metrics: {
        totalTransactions: 1234,
        transactionVolume: 15678900,
        commission: 156789,
        floatBalance: 234567,
        successRate: 92.3,
        customers: 89
      },
      hierarchy: {
        parentAgent: 'AGT004',
        subAgents: 2,
        level: 3
      },
      compliance: {
        kycStatus: 'verified',
        licenseStatus: 'expired',
        lastAudit: '2023-12-15'
      },
      performance: {
        rating: 3.8,
        rank: 25,
        targets: {
          monthly: 200000,
          achieved: 156789
        }
      }
    }
  ])

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [showAgentModal, setShowAgentModal] = useState(false)
  const [showAddAgent, setShowAddAgent] = useState(false)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'inactive':
        return 'bg-gray-100 text-gray-800'
      case 'suspended':
        return 'bg-red-100 text-red-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Master Agent':
        return 'bg-purple-100 text-purple-800'
      case 'Super Agent':
        return 'bg-blue-100 text-blue-800'
      case 'Agent':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'inactive':
        return <Clock className="h-4 w-4 text-gray-500" />
      case 'suspended':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return null
    }
  }

  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         agent.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         agent.location.state.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || agent.status === statusFilter
    const matchesLevel = levelFilter === 'all' || agent.level === levelFilter
    
    return matchesSearch && matchesStatus && matchesLevel
  })

  const handleViewAgent = (agent: Agent) => {
    setSelectedAgent(agent)
    setShowAgentModal(true)
  }

  const renderStarRating = (rating: number) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
            }`}
          />
        ))}
        <span className="ml-1 text-sm text-gray-600">({rating})</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agent Network Management</h1>
            <p className="text-gray-600 mt-1">Manage your agent network and monitor performance</p>
          </div>
          <button
            onClick={() => setShowAddAgent(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Agent
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Users className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Agents</p>
              <p className="text-2xl font-semibold text-gray-900">{agents.length}</p>
              <p className="text-sm text-green-600 flex items-center">
                <TrendingUp className="h-4 w-4 mr-1" />
                +12% this month
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Agents</p>
              <p className="text-2xl font-semibold text-gray-900">
                {agents.filter(a => a.status === 'active').length}
              </p>
              <p className="text-sm text-green-600">
                {Math.round((agents.filter(a => a.status === 'active').length / agents.length) * 100)}% active rate
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Award className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Top Performers</p>
              <p className="text-2xl font-semibold text-gray-900">
                {agents.filter(a => a.performance.rating >= 4.5).length}
              </p>
              <p className="text-sm text-purple-600">Rating ≥ 4.5 stars</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Target className="h-8 w-8 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Target Achievement</p>
              <p className="text-2xl font-semibold text-gray-900">87%</p>
              <p className="text-sm text-orange-600">Average across network</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Search agents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
              <option value="pending">Pending</option>
            </select>

            <select
              className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
            >
              <option value="all">All Levels</option>
              <option value="Master Agent">Master Agent</option>
              <option value="Super Agent">Super Agent</option>
              <option value="Agent">Agent</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              <Filter className="h-4 w-4 mr-2" />
              More Filters
            </button>
          </div>
        </div>
      </div>

      {/* Agents Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Agent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Level & Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Performance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Metrics
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Network
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAgents.map((agent) => (
                <tr key={agent.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 bg-blue-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-medium text-sm">
                            {agent.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{agent.name}</div>
                        <div className="text-sm text-gray-500">{agent.email}</div>
                        <div className="text-sm text-gray-500">{agent.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getLevelColor(agent.level)}`}>
                        {agent.level}
                      </span>
                      <div className="flex items-center">
                        {getStatusIcon(agent.status)}
                        <span className={`ml-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(agent.status)}`}>
                          {agent.status}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 flex items-center">
                      <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                      {agent.location.state}
                    </div>
                    <div className="text-sm text-gray-500">{agent.location.lga}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      {renderStarRating(agent.performance.rating)}
                      <div className="text-sm text-gray-500">Rank #{agent.performance.rank}</div>
                      <div className="text-sm text-gray-500">
                        {Math.round((agent.performance.targets.achieved / agent.performance.targets.monthly) * 100)}% of target
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(agent.metrics.commission)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {agent.metrics.totalTransactions.toLocaleString()} txns
                      </div>
                      <div className="text-sm text-gray-500">
                        {agent.metrics.successRate}% success
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <div className="text-sm text-gray-900">
                        Level {agent.hierarchy.level}
                      </div>
                      <div className="text-sm text-gray-500">
                        {agent.hierarchy.subAgents} sub-agents
                      </div>
                      <div className="text-sm text-gray-500">
                        {agent.metrics.customers} customers
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleViewAgent(agent)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="text-gray-600 hover:text-gray-900">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button className="text-gray-600 hover:text-gray-900">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Agent Details Modal */}
      {showAgentModal && selectedAgent && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowAgentModal(false)}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Agent Details - {selectedAgent.name}
                  </h3>
                  <button
                    onClick={() => setShowAgentModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <span className="sr-only">Close</span>
                    ×
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Basic Information</h4>
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <Mail className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-600">{selectedAgent.email}</span>
                        </div>
                        <div className="flex items-center">
                          <Phone className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-600">{selectedAgent.phone}</span>
                        </div>
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-600">{selectedAgent.location.address}</span>
                        </div>
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-600">Joined: {selectedAgent.joinDate}</span>
                        </div>
                      </div>
                    </div>

                    {/* Performance Metrics */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Performance Metrics</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Total Transactions</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {selectedAgent.metrics.totalTransactions.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Success Rate</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {selectedAgent.metrics.successRate}%
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Commission</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {formatCurrency(selectedAgent.metrics.commission)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Float Balance</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {formatCurrency(selectedAgent.metrics.floatBalance)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Network & Compliance */}
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Network Hierarchy</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Level:</span>
                          <span className="text-sm font-medium text-gray-900">
                            {selectedAgent.hierarchy.level}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Sub-agents:</span>
                          <span className="text-sm font-medium text-gray-900">
                            {selectedAgent.hierarchy.subAgents}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Customers:</span>
                          <span className="text-sm font-medium text-gray-900">
                            {selectedAgent.metrics.customers}
                          </span>
                        </div>
                        {selectedAgent.hierarchy.parentAgent && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Parent Agent:</span>
                            <span className="text-sm font-medium text-gray-900">
                              {selectedAgent.hierarchy.parentAgent}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Compliance Status</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">KYC Status:</span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            selectedAgent.compliance.kycStatus === 'verified' 
                              ? 'bg-green-100 text-green-800' 
                              : selectedAgent.compliance.kycStatus === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {selectedAgent.compliance.kycStatus}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">License:</span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            selectedAgent.compliance.licenseStatus === 'valid' 
                              ? 'bg-green-100 text-green-800' 
                              : selectedAgent.compliance.licenseStatus === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {selectedAgent.compliance.licenseStatus}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Last Audit:</span>
                          <span className="text-sm font-medium text-gray-900">
                            {selectedAgent.compliance.lastAudit}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowAgentModal(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Edit Agent
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AgentManagement

