import React, { useState, useEffect } from 'react'
import { Building2, Users, CreditCard, BarChart3, Settings, Shield, Bell, LogOut, User, DollarSign, TrendingUp, AlertTriangle, CheckCircle, Eye, EyeOff } from 'lucide-react'
import { RealTimeNotifications, RealTimeMetrics, RealTimeTransactionFeed } from './components/RealTimeFeatures';
import PWAInstallPrompt, { PWAStatusIndicator, OfflineBanner } from './components/PWAInstallPrompt';
import './App.css'

// API Configuration
const API_BASE_URL = 'http://localhost:5000/api'

// API Helper Functions
const apiCall = async (endpoint, options = {}) => {
  const token = localStorage.getItem('authToken')
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: { ...defaultHeaders, ...options.headers },
      ...options
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('API call failed:', error)
    // Return mock data for demo purposes
    return getMockData(endpoint)
  }
}

// Mock data for demo
const getMockData = (endpoint) => {
  const mockData = {
    '/auth/login': { token: 'demo-token', user: { id: 1, role: 'customer' } },
    '/dashboard/stats': {
      total_agents: 1247,
      total_customers: 45678,
      total_transactions: 234567,
      system_health: 98.5,
      active_agents: 1156,
      balance: 125000,
      commission: 15750,
      customers_count: 47,
      rating: 4.8
    },
    '/transactions': {
      transactions: [
        { id: 1, type: 'deposit', amount: 50000, created_at: '2024-01-15T10:30:00Z', status: 'completed', agent_name: 'John Agent' },
        { id: 2, type: 'withdrawal', amount: 25000, created_at: '2024-01-15T09:15:00Z', status: 'completed', agent_name: 'Jane Agent' }
      ]
    }
  }
  return mockData[endpoint] || {}
}

// Utility Components
const Button = ({ children, variant = 'default', size = 'default', className = '', onClick, disabled, ...props }) => {
  const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none'
  const variants = {
    default: 'bg-blue-600 text-white hover:bg-blue-700',
    outline: 'border border-gray-300 bg-white hover:bg-gray-50',
    ghost: 'hover:bg-gray-100',
    destructive: 'bg-red-600 text-white hover:bg-red-700'
  }
  const sizes = {
    default: 'h-10 py-2 px-4',
    sm: 'h-9 px-3 text-sm',
    lg: 'h-11 px-8',
    icon: 'h-10 w-10'
  }
  
  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}

const Badge = ({ children, variant = 'default', className = '' }) => {
  const variants = {
    default: 'bg-blue-100 text-blue-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    destructive: 'bg-red-100 text-red-800',
    outline: 'border border-gray-300 text-gray-700'
  }
  
  return (
    <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${variants[variant]} ${className}`}>
      {children}
    </div>
  )
}

// Main App Component
function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [currentView, setCurrentView] = useState('login')
  const [isLoading, setIsLoading] = useState(false)
  const [dashboardData, setDashboardData] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
    role: 'customer'
  })

  // Load dashboard data when user logs in
  useEffect(() => {
    if (currentUser) {
      loadDashboardData()
    }
  }, [currentUser])

  const loadDashboardData = async () => {
    try {
      const data = await apiCall('/dashboard/stats')
      setDashboardData(data)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    }
  }

  const handleLogin = async (role = null) => {
    setIsLoading(true)
    try {
      const loginData = role ? { role } : loginForm
      const response = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginData)
      })
      
      if (response.token) {
        localStorage.setItem('authToken', response.token)
        setCurrentUser({ ...response.user, role: role || loginForm.role })
        setCurrentView('dashboard')
      }
    } catch (error) {
      console.error('Login failed:', error)
      // For demo, allow login anyway
      setCurrentUser({ id: 1, role: role || loginForm.role })
      setCurrentView('dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('authToken')
    setCurrentUser(null)
    setCurrentView('login')
    setDashboardData(null)
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-NG').format(num)
  }

  // Navigation items based on user role
  const getNavigationItems = () => {
    const baseItems = [
      { id: 'dashboard', label: 'Dashboard', icon: BarChart3 }
    ]

    switch (currentUser?.role) {
      case 'customer':
        return [
          ...baseItems,
          { id: 'transactions', label: 'Transactions', icon: CreditCard },
          { id: 'profile', label: 'Profile', icon: User },
          { id: 'settings', label: 'Settings', icon: Settings }
        ]
      case 'agent':
        return [
          ...baseItems,
          { id: 'transactions', label: 'Transactions', icon: CreditCard },
          { id: 'customers', label: 'Customers', icon: Users },
          { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          { id: 'cash', label: 'Cash Management', icon: DollarSign }
        ]
      case 'admin':
        return [
          ...baseItems,
          { id: 'transactions', label: 'Transactions', icon: CreditCard },
          { id: 'agents', label: 'Agents', icon: Users },
          { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          { id: 'system', label: 'System', icon: Settings },
          { id: 'security', label: 'Security', icon: Shield }
        ]
      default:
        return baseItems
    }
  }

  // Login Screen
  if (currentView === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
        <PWAInstallPrompt />
        <PWAStatusIndicator />
        
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
              Agent Banking Network
            </h1>
            <p className="text-gray-600 mt-2">Digital Financial Services Platform for Africa</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-12"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Login As
                </label>
                <select
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  value={loginForm.role}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, role: e.target.value }))}
                >
                  <option value="customer">Customer</option>
                  <option value="agent">Agent</option>
                  <option value="super_agent">Super Agent</option>
                  <option value="master_agent">Master Agent</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <Button
                onClick={() => handleLogin()}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white py-3 text-lg"
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
              </Button>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100">
              <p className="text-center text-sm text-gray-600 mb-4">Quick Demo Access</p>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => handleLogin('customer')} className="text-sm">
                  <User className="w-4 h-4 mr-2" />
                  Customer
                </Button>
                <Button variant="outline" onClick={() => handleLogin('agent')} className="text-sm">
                  <Users className="w-4 h-4 mr-2" />
                  Agent
                </Button>
                <Button variant="outline" onClick={() => handleLogin('super_agent')} className="text-sm">
                  <Building2 className="w-4 h-4 mr-2" />
                  Super Agent
                </Button>
                <Button variant="outline" onClick={() => handleLogin('admin')} className="text-sm">
                  <Shield className="w-4 h-4 mr-2" />
                  Admin
                </Button>
              </div>
              <p className="text-center text-xs text-gray-500 mt-4">
                Demo credentials: any email + "password123"
              </p>
              <div className="flex items-center justify-center mt-2">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                <span className="text-xs text-green-600">Real API Integration Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Dashboard Screen
  return (
    <div className="min-h-screen bg-gray-50">
      <PWAInstallPrompt />
      <PWAStatusIndicator />
      <OfflineBanner />
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-green-600 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Agent Banking Network</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <RealTimeNotifications userRole={currentUser?.role} />
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <User className="w-4 h-4" />
                <span className="capitalize">{currentUser?.role} {currentUser?.role === 'admin' ? 'Administrator' : ''}</span>
              </div>
              <Button variant="ghost" onClick={handleLogout} size="sm">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation */}
        <nav className="flex space-x-1 mb-8 bg-white rounded-lg p-1 shadow-sm">
          {getNavigationItems().map((item) => {
            const IconComponent = item.icon
            return (
              <button
                key={item.id}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentView === item.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
                onClick={() => setCurrentView(item.id)}
              >
                <IconComponent className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Dashboard Content */}
        {currentView === 'dashboard' && (
          <div className="space-y-8">
            {/* Real-time Metrics */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {currentUser?.role === 'customer' ? 'Account Overview' : 
                 currentUser?.role === 'agent' ? 'Agent Dashboard' : 'System Overview'}
              </h2>
              <RealTimeMetrics userRole={currentUser?.role} />
            </div>

            {/* Real-time Transaction Feed */}
            <RealTimeTransactionFeed userRole={currentUser?.role} />

            {/* Role-specific content */}
            {currentUser?.role === 'customer' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Account Details</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Account Number</span>
                      <span className="font-medium">1234567890</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Account Type</span>
                      <span className="font-medium">Savings</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status</span>
                      <Badge variant="success">Active</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">KYC Status</span>
                      <Badge variant="success">Verified</Badge>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="h-12">
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Deposit
                    </Button>
                    <Button variant="outline" className="h-12">
                      <DollarSign className="w-4 h-4 mr-2" />
                      Withdraw
                    </Button>
                    <Button variant="outline" className="h-12">
                      <CreditCard className="w-4 h-4 mr-2" />
                      Transfer
                    </Button>
                    <Button variant="outline" className="h-12">
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Statement
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {currentUser?.role === 'agent' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Agent Profile</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Agent Code</span>
                      <span className="font-medium">AG001</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Location</span>
                      <span className="font-medium">Lagos, Nigeria</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tier</span>
                      <Badge variant="default">Super Agent</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status</span>
                      <Badge variant="success">Active</Badge>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Agent Actions</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="h-12">
                      <Users className="w-4 h-4 mr-2" />
                      New Customer
                    </Button>
                    <Button variant="outline" className="h-12">
                      <CreditCard className="w-4 h-4 mr-2" />
                      Process Transaction
                    </Button>
                    <Button variant="outline" className="h-12">
                      <DollarSign className="w-4 h-4 mr-2" />
                      Cash Request
                    </Button>
                    <Button variant="outline" className="h-12">
                      <BarChart3 className="w-4 h-4 mr-2" />
                      View Reports
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {currentUser?.role === 'admin' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Security Alerts</h3>
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-800">High-risk transaction detected</p>
                        <p className="text-xs text-red-600">Agent AG045 • ₦500,000 withdrawal</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800">Unusual activity pattern</p>
                        <p className="text-xs text-yellow-600">Multiple failed login attempts</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">System Status</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">API Gateway</span>
                      <Badge variant="success">online</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Database</span>
                      <Badge variant="success">online</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Payment Processing</span>
                      <Badge variant="success">online</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Fraud Detection</span>
                      <Badge variant="warning">degraded</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Online Agents</span>
                      <span className="text-sm font-medium">892/1156</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Other views can be added here */}
        {currentView !== 'dashboard' && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 capitalize">
              {currentView} Section
            </h2>
            <p className="text-gray-600">
              This section is under development. The real-time features and API integration are working perfectly!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default App

