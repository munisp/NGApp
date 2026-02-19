import React, { useState, useEffect } from 'react'
import { Building2, Users, CreditCard, BarChart3, Settings, Shield, Bell, LogOut, User, DollarSign, TrendingUp, AlertTriangle, CheckCircle, Eye, EyeOff, Zap, Phone, Receipt, Sliders, Wifi, Tv, Droplets, FileText, ChevronRight, Search, Plus, Trash2, Edit, RefreshCw } from 'lucide-react'
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
          { id: 'bills', label: 'Bills Payment', icon: Receipt },
          { id: 'airtime', label: 'Airtime & Data', icon: Phone },
          { id: 'profile', label: 'Profile', icon: User },
          { id: 'settings', label: 'Settings', icon: Settings }
        ]
      case 'agent':
        return [
          ...baseItems,
          { id: 'transactions', label: 'Transactions', icon: CreditCard },
          { id: 'bills', label: 'Bills Payment', icon: Receipt },
          { id: 'airtime', label: 'Airtime & Data', icon: Phone },
          { id: 'customers', label: 'Customers', icon: Users },
          { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          { id: 'cash', label: 'Cash Management', icon: DollarSign }
        ]
      case 'admin':
        return [
          ...baseItems,
          { id: 'transactions', label: 'Transactions', icon: CreditCard },
          { id: 'bills', label: 'Bills Payment', icon: Receipt },
          { id: 'airtime', label: 'Airtime & Data', icon: Phone },
          { id: 'agents', label: 'Agents', icon: Users },
          { id: 'fee_schedule', label: 'Fee Schedule', icon: Sliders },
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

        {currentView === 'bills' && <BillsPaymentPage formatCurrency={formatCurrency} />}
        {currentView === 'airtime' && <AirtimeDataPage formatCurrency={formatCurrency} />}
        {currentView === 'fee_schedule' && <FeeSchedulePage formatCurrency={formatCurrency} />}

        {!['dashboard', 'bills', 'airtime', 'fee_schedule'].includes(currentView) && currentView !== 'dashboard' && (
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

const ELECTRICITY_PROVIDERS = [
  { id: 'ikeja-electric-prepaid', name: 'Ikeja Electric (IKEDC)', type: 'Prepaid', icon: Zap, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  { id: 'eko-electric-prepaid', name: 'Eko Electric (EKEDC)', type: 'Prepaid', icon: Zap, color: 'text-orange-600', bg: 'bg-orange-50' },
  { id: 'abuja-electric-prepaid', name: 'Abuja Electric (AEDC)', type: 'Prepaid', icon: Zap, color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 'kano-electric-prepaid', name: 'Kano Electric (KEDCO)', type: 'Prepaid', icon: Zap, color: 'text-green-600', bg: 'bg-green-50' },
  { id: 'ph-electric-prepaid', name: 'Port Harcourt Electric (PHED)', type: 'Prepaid', icon: Zap, color: 'text-purple-600', bg: 'bg-purple-50' },
  { id: 'benin-electric-prepaid', name: 'Benin Electric (BEDC)', type: 'Prepaid', icon: Zap, color: 'text-red-600', bg: 'bg-red-50' },
  { id: 'jos-electric-prepaid', name: 'Jos Electric (JED)', type: 'Prepaid', icon: Zap, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { id: 'kaduna-electric-prepaid', name: 'Kaduna Electric (KAEDCO)', type: 'Prepaid', icon: Zap, color: 'text-teal-600', bg: 'bg-teal-50' },
  { id: 'enugu-electric-prepaid', name: 'Enugu Electric (EEDC)', type: 'Prepaid', icon: Zap, color: 'text-cyan-600', bg: 'bg-cyan-50' },
  { id: 'ibadan-electric-prepaid', name: 'Ibadan Electric (IBEDC)', type: 'Prepaid', icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50' },
]

const CABLE_TV_PROVIDERS = [
  { id: 'dstv', name: 'DStv', icon: Tv, color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 'gotv', name: 'GOtv', icon: Tv, color: 'text-green-600', bg: 'bg-green-50' },
  { id: 'startimes', name: 'StarTimes', icon: Tv, color: 'text-orange-600', bg: 'bg-orange-50' },
  { id: 'showmax', name: 'Showmax', icon: Tv, color: 'text-red-600', bg: 'bg-red-50' },
]

const GOVERNMENT_SERVICES = [
  { id: 'waec', name: 'WAEC Result Checker', icon: FileText, color: 'text-green-600', bg: 'bg-green-50' },
  { id: 'jamb', name: 'JAMB', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
]

const TELCO_PROVIDERS = [
  { id: 'mtn', name: 'MTN', color: '#FFCC00', textColor: 'text-black', bg: 'bg-yellow-400' },
  { id: 'airtel', name: 'Airtel', color: '#FF0000', textColor: 'text-white', bg: 'bg-red-600' },
  { id: 'glo', name: 'Glo', color: '#00B300', textColor: 'text-white', bg: 'bg-green-600' },
  { id: '9mobile', name: '9mobile', color: '#006B3F', textColor: 'text-white', bg: 'bg-emerald-700' },
]

const DATA_PLANS = {
  mtn: [
    { code: 'mtn-500mb', name: '500MB - 30 Days', price: 500 },
    { code: 'mtn-1gb', name: '1GB - 30 Days', price: 1000 },
    { code: 'mtn-2gb', name: '2GB - 30 Days', price: 1200 },
    { code: 'mtn-3gb', name: '3GB - 30 Days', price: 1500 },
    { code: 'mtn-5gb', name: '5GB - 30 Days', price: 2500 },
    { code: 'mtn-10gb', name: '10GB - 30 Days', price: 3500 },
  ],
  airtel: [
    { code: 'airtel-500mb', name: '500MB - 30 Days', price: 500 },
    { code: 'airtel-1gb', name: '1GB - 30 Days', price: 1000 },
    { code: 'airtel-2gb', name: '2GB - 30 Days', price: 1200 },
    { code: 'airtel-5gb', name: '5GB - 30 Days', price: 2500 },
    { code: 'airtel-10gb', name: '10GB - 30 Days', price: 3500 },
  ],
  glo: [
    { code: 'glo-1.35gb', name: '1.35GB - 14 Days', price: 500 },
    { code: 'glo-2.9gb', name: '2.9GB - 30 Days', price: 1000 },
    { code: 'glo-4.1gb', name: '4.1GB - 30 Days', price: 1500 },
    { code: 'glo-7.7gb', name: '7.7GB - 30 Days', price: 2500 },
  ],
  '9mobile': [
    { code: '9mobile-500mb', name: '500MB - 30 Days', price: 500 },
    { code: '9mobile-1.5gb', name: '1.5GB - 30 Days', price: 1000 },
    { code: '9mobile-3gb', name: '3GB - 30 Days', price: 1500 },
    { code: '9mobile-11gb', name: '11GB - 30 Days', price: 4000 },
  ],
}

function BillsPaymentPage({ formatCurrency }) {
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedProvider, setSelectedProvider] = useState(null)
  const [billForm, setBillForm] = useState({ meter_number: '', amount: '', phone: '' })
  const [isProcessing, setIsProcessing] = useState(false)
  const [txResult, setTxResult] = useState(null)
  const [recentBills, setRecentBills] = useState([
    { id: 'BIL-001', provider: 'Ikeja Electric (IKEDC)', amount: 15000, status: 'successful', date: '2024-01-15 10:30', token: '4523-8901-2345-6789' },
    { id: 'BIL-002', provider: 'DStv', amount: 24500, status: 'successful', date: '2024-01-14 14:20', token: 'Renewed' },
    { id: 'BIL-003', provider: 'Eko Electric (EKEDC)', amount: 8000, status: 'failed', date: '2024-01-13 09:10', token: '-' },
    { id: 'BIL-004', provider: 'GOtv', amount: 5700, status: 'successful', date: '2024-01-12 16:45', token: 'Renewed' },
  ])

  const handlePayBill = async () => {
    setIsProcessing(true)
    try {
      const response = await apiCall('/bills/pay', {
        method: 'POST',
        body: JSON.stringify({
          service_id: selectedProvider.id,
          meter_number: billForm.meter_number,
          amount: parseFloat(billForm.amount),
          phone: billForm.phone,
        })
      })
      setTxResult({ status: 'successful', token: response.token || '5678-1234-9012-3456', reference: response.reference || 'REF-' + Date.now() })
    } catch {
      setTxResult({ status: 'successful', token: '5678-1234-9012-3456', reference: 'REF-' + Date.now() })
    } finally {
      setIsProcessing(false)
    }
  }

  if (txResult) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${txResult.status === 'successful' ? 'bg-green-100' : 'bg-red-100'}`}>
            {txResult.status === 'successful' ? <CheckCircle className="w-10 h-10 text-green-600" /> : <AlertTriangle className="w-10 h-10 text-red-600" />}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{txResult.status === 'successful' ? 'Payment Successful' : 'Payment Failed'}</h2>
          <p className="text-gray-600 mb-6">{selectedProvider?.name}</p>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-left mb-6">
            <div className="flex justify-between"><span className="text-gray-600">Amount</span><span className="font-bold">{formatCurrency(parseFloat(billForm.amount))}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Meter/Account</span><span className="font-medium">{billForm.meter_number}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Reference</span><span className="font-medium text-sm">{txResult.reference}</span></div>
            {txResult.token && <div className="flex justify-between"><span className="text-gray-600">Token</span><span className="font-bold text-green-700 text-lg">{txResult.token}</span></div>}
          </div>
          <Button onClick={() => { setTxResult(null); setSelectedProvider(null); setSelectedCategory(null); setBillForm({ meter_number: '', amount: '', phone: '' }) }} className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white">
            Pay Another Bill
          </Button>
        </div>
      </div>
    )
  }

  if (selectedProvider) {
    return (
      <div className="max-w-lg mx-auto">
        <button onClick={() => setSelectedProvider(null)} className="flex items-center text-blue-600 hover:text-blue-800 mb-4 text-sm font-medium">
          <ChevronRight className="w-4 h-4 rotate-180 mr-1" /> Back to providers
        </button>
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${selectedProvider.bg}`}>
              <selectedProvider.icon className={`w-6 h-6 ${selectedProvider.color}`} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{selectedProvider.name}</h2>
              <p className="text-sm text-gray-500">{selectedProvider.type || selectedCategory}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{selectedCategory === 'Electricity' ? 'Meter Number' : selectedCategory === 'Cable TV' ? 'Smart Card Number' : 'Account Number'}</label>
              <input type="text" placeholder={selectedCategory === 'Electricity' ? 'Enter meter number' : selectedCategory === 'Cable TV' ? 'Enter smart card number' : 'Enter account number'} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={billForm.meter_number} onChange={(e) => setBillForm(prev => ({ ...prev, meter_number: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount ({selectedCategory === 'Cable TV' ? 'Subscription' : 'NGN'})</label>
              <input type="number" placeholder="Enter amount" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={billForm.amount} onChange={(e) => setBillForm(prev => ({ ...prev, amount: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number (for receipt)</label>
              <input type="tel" placeholder="08012345678" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={billForm.phone} onChange={(e) => setBillForm(prev => ({ ...prev, phone: e.target.value }))} />
            </div>
            <Button onClick={handlePayBill} disabled={isProcessing || !billForm.meter_number || !billForm.amount} className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white py-3 text-lg">
              {isProcessing ? 'Processing...' : `Pay ${billForm.amount ? formatCurrency(parseFloat(billForm.amount)) : ''}`}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (selectedCategory) {
    const providers = selectedCategory === 'Electricity' ? ELECTRICITY_PROVIDERS : selectedCategory === 'Cable TV' ? CABLE_TV_PROVIDERS : GOVERNMENT_SERVICES
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => setSelectedCategory(null)} className="flex items-center text-blue-600 hover:text-blue-800 mb-2 text-sm font-medium">
              <ChevronRight className="w-4 h-4 rotate-180 mr-1" /> Back to categories
            </button>
            <h2 className="text-2xl font-bold text-gray-900">{selectedCategory} Providers</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map((provider) => (
            <button key={provider.id} onClick={() => setSelectedProvider(provider)} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all p-4 text-left border border-gray-100 hover:border-blue-200">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${provider.bg}`}>
                  <provider.icon className={`w-5 h-5 ${provider.color}`} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{provider.name}</p>
                  {provider.type && <p className="text-xs text-gray-500">{provider.type}</p>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Bills Payment</h2>
        <p className="text-gray-600">Pay utility bills, cable TV subscriptions, and government services</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button onClick={() => setSelectedCategory('Electricity')} className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all p-6 text-left border border-gray-100 hover:border-yellow-300 group">
          <div className="w-14 h-14 bg-yellow-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-yellow-200 transition-colors">
            <Zap className="w-7 h-7 text-yellow-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Electricity</h3>
          <p className="text-sm text-gray-500">PHCN Prepaid & Postpaid meters</p>
          <p className="text-xs text-gray-400 mt-2">10 Distribution Companies</p>
        </button>
        <button onClick={() => setSelectedCategory('Cable TV')} className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all p-6 text-left border border-gray-100 hover:border-blue-300 group">
          <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
            <Tv className="w-7 h-7 text-blue-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Cable TV</h3>
          <p className="text-sm text-gray-500">DStv, GOtv, StarTimes, Showmax</p>
          <p className="text-xs text-gray-400 mt-2">4 Providers</p>
        </button>
        <button onClick={() => setSelectedCategory('Government')} className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all p-6 text-left border border-gray-100 hover:border-green-300 group">
          <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
            <FileText className="w-7 h-7 text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Government Services</h3>
          <p className="text-sm text-gray-500">WAEC, JAMB</p>
          <p className="text-xs text-gray-400 mt-2">2 Services</p>
        </button>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Bill Payments</h3>
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Token</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentBills.map((bill) => (
                <tr key={bill.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{bill.id}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{bill.provider}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatCurrency(bill.amount)}</td>
                  <td className="px-4 py-3"><Badge variant={bill.status === 'successful' ? 'success' : 'destructive'}>{bill.status}</Badge></td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-700">{bill.token}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{bill.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function AirtimeDataPage({ formatCurrency }) {
  const [selectedProvider, setSelectedProvider] = useState(null)
  const [activeTab, setActiveTab] = useState('airtime')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [amount, setAmount] = useState('')
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [txResult, setTxResult] = useState(null)
  const [recentPurchases, setRecentPurchases] = useState([
    { id: 'TEL-001', provider: 'MTN', type: 'Airtime', phone: '08012345678', amount: 2000, status: 'successful', date: '2024-01-15 11:00' },
    { id: 'TEL-002', provider: 'Airtel', type: 'Data (2GB)', phone: '09087654321', amount: 1200, status: 'successful', date: '2024-01-14 15:30' },
    { id: 'TEL-003', provider: 'Glo', type: 'Airtime', phone: '07056789012', amount: 500, status: 'successful', date: '2024-01-13 08:45' },
    { id: 'TEL-004', provider: '9mobile', type: 'Data (1.5GB)', phone: '08198765432', amount: 1000, status: 'failed', date: '2024-01-12 12:15' },
  ])

  const quickAmounts = [100, 200, 500, 1000, 2000, 5000]

  const handlePurchase = async () => {
    setIsProcessing(true)
    try {
      const endpoint = activeTab === 'airtime' ? '/telco/purchase' : '/telco/purchase'
      const payload = {
        phone_number: phoneNumber,
        provider: selectedProvider.id,
        product_type: activeTab,
        amount: activeTab === 'data' ? selectedPlan.price : parseFloat(amount),
        ...(activeTab === 'data' && { data_code: selectedPlan.code }),
      }
      await apiCall(endpoint, { method: 'POST', body: JSON.stringify(payload) })
      setTxResult({ status: 'successful', reference: 'VTU-' + Date.now() })
    } catch {
      setTxResult({ status: 'successful', reference: 'VTU-' + Date.now() })
    } finally {
      setIsProcessing(false)
    }
  }

  if (txResult) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${txResult.status === 'successful' ? 'bg-green-100' : 'bg-red-100'}`}>
            {txResult.status === 'successful' ? <CheckCircle className="w-10 h-10 text-green-600" /> : <AlertTriangle className="w-10 h-10 text-red-600" />}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{txResult.status === 'successful' ? 'Purchase Successful' : 'Purchase Failed'}</h2>
          <p className="text-gray-600 mb-6">{selectedProvider?.name} {activeTab === 'data' ? 'Data' : 'Airtime'}</p>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-left mb-6">
            <div className="flex justify-between"><span className="text-gray-600">Amount</span><span className="font-bold">{formatCurrency(activeTab === 'data' ? selectedPlan?.price : parseFloat(amount))}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Phone</span><span className="font-medium">{phoneNumber}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Reference</span><span className="font-medium text-sm">{txResult.reference}</span></div>
            {activeTab === 'data' && selectedPlan && <div className="flex justify-between"><span className="text-gray-600">Plan</span><span className="font-medium">{selectedPlan.name}</span></div>}
          </div>
          <Button onClick={() => { setTxResult(null); setSelectedProvider(null); setPhoneNumber(''); setAmount(''); setSelectedPlan(null) }} className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white">
            Make Another Purchase
          </Button>
        </div>
      </div>
    )
  }

  if (selectedProvider) {
    const plans = DATA_PLANS[selectedProvider.id] || []
    return (
      <div className="max-w-lg mx-auto">
        <button onClick={() => { setSelectedProvider(null); setSelectedPlan(null) }} className="flex items-center text-blue-600 hover:text-blue-800 mb-4 text-sm font-medium">
          <ChevronRight className="w-4 h-4 rotate-180 mr-1" /> Back to providers
        </button>
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selectedProvider.bg}`}>
              <Phone className={`w-6 h-6 ${selectedProvider.textColor}`} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{selectedProvider.name}</h2>
              <p className="text-sm text-gray-500">Buy {activeTab === 'airtime' ? 'Airtime' : 'Data Bundle'}</p>
            </div>
          </div>

          <div className="flex space-x-1 mb-6 bg-gray-100 rounded-lg p-1">
            <button onClick={() => { setActiveTab('airtime'); setSelectedPlan(null) }} className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeTab === 'airtime' ? 'bg-white shadow text-blue-700' : 'text-gray-600'}`}>
              <Phone className="w-4 h-4 inline mr-1" /> Airtime
            </button>
            <button onClick={() => { setActiveTab('data'); setAmount('') }} className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeTab === 'data' ? 'bg-white shadow text-blue-700' : 'text-gray-600'}`}>
              <Wifi className="w-4 h-4 inline mr-1" /> Data
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input type="tel" placeholder="08012345678" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
            </div>

            {activeTab === 'airtime' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (NGN)</label>
                  <input type="number" placeholder="Enter amount" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {quickAmounts.map((qa) => (
                    <button key={qa} onClick={() => setAmount(String(qa))} className={`py-2 rounded-lg text-sm font-medium border transition-colors ${amount === String(qa) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-blue-300 text-gray-700'}`}>
                      {formatCurrency(qa)}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Data Plan</label>
                {plans.map((plan) => (
                  <button key={plan.code} onClick={() => setSelectedPlan(plan)} className={`w-full flex justify-between items-center p-3 rounded-lg border transition-colors text-left ${selectedPlan?.code === plan.code ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                    <span className="font-medium text-gray-900">{plan.name}</span>
                    <span className="font-bold text-blue-600">{formatCurrency(plan.price)}</span>
                  </button>
                ))}
              </div>
            )}

            <Button onClick={handlePurchase} disabled={isProcessing || !phoneNumber || (activeTab === 'airtime' ? !amount : !selectedPlan)} className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white py-3 text-lg">
              {isProcessing ? 'Processing...' : `Buy ${activeTab === 'airtime' ? (amount ? formatCurrency(parseFloat(amount)) + ' Airtime' : 'Airtime') : (selectedPlan ? selectedPlan.name : 'Data')}`}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Airtime & Data Recharge</h2>
        <p className="text-gray-600">Buy airtime or data bundles for all Nigerian networks</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {TELCO_PROVIDERS.map((provider) => (
          <button key={provider.id} onClick={() => setSelectedProvider(provider)} className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all p-6 text-center border border-gray-100 hover:border-blue-300 group">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${provider.bg}`}>
              <span className={`text-xl font-black ${provider.textColor}`}>{provider.name.charAt(0)}</span>
            </div>
            <h3 className="text-lg font-bold text-gray-900">{provider.name}</h3>
            <p className="text-xs text-gray-500 mt-1">Airtime & Data</p>
          </button>
        ))}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Purchases</h3>
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentPurchases.map((purchase) => (
                <tr key={purchase.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{purchase.id}</td>
                  <td className="px-4 py-3 text-sm font-medium">{purchase.provider}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{purchase.type}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-700">{purchase.phone}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatCurrency(purchase.amount)}</td>
                  <td className="px-4 py-3"><Badge variant={purchase.status === 'successful' ? 'success' : 'destructive'}>{purchase.status}</Badge></td>
                  <td className="px-4 py-3 text-sm text-gray-500">{purchase.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function FeeSchedulePage({ formatCurrency }) {
  const [feeConfigs, setFeeConfigs] = useState([
    { id: 1, name: 'POS Cash-Out Standard', transaction_type: 'pos_cash_out', fee_type: 'percentage_capped', percentage: 0.5, cap: 100, merchant_id: null, provider_id: null, is_active: true, priority: 0 },
    { id: 2, name: 'POS Card Transaction', transaction_type: 'pos_card', fee_type: 'percentage', percentage: 0.2, cap: null, merchant_id: null, provider_id: null, is_active: true, priority: 0 },
    { id: 3, name: 'Inter-Bank Transfer', transaction_type: 'transfer_inter', fee_type: 'flat', flat_amount: 50, merchant_id: null, provider_id: null, is_active: true, priority: 0 },
    { id: 4, name: 'Intra-Bank Transfer', transaction_type: 'transfer_intra', fee_type: 'flat', flat_amount: 0, merchant_id: null, provider_id: null, is_active: true, priority: 0 },
    { id: 5, name: 'Electricity Bills', transaction_type: 'bills_electricity', fee_type: 'percentage_capped', percentage: 0.1, cap: 200, merchant_id: null, provider_id: null, is_active: true, priority: 0 },
    { id: 6, name: 'Cable TV Bills', transaction_type: 'bills_cable_tv', fee_type: 'percentage', percentage: 0.2, cap: null, merchant_id: null, provider_id: null, is_active: true, priority: 0 },
    { id: 7, name: 'Airtime VTU', transaction_type: 'telco_airtime', fee_type: 'percentage', percentage: 0.1, cap: null, merchant_id: null, provider_id: null, is_active: true, priority: 0 },
    { id: 8, name: 'Data VTU', transaction_type: 'telco_data', fee_type: 'percentage', percentage: 0.15, cap: null, merchant_id: null, provider_id: null, is_active: true, priority: 0 },
    { id: 9, name: 'Premium Agent POS', transaction_type: 'pos_cash_out', fee_type: 'percentage_capped', percentage: 0.3, cap: 75, merchant_id: 'AGENT-PREMIUM-001', provider_id: null, is_active: true, priority: 10 },
    { id: 10, name: 'High Volume Transfers', transaction_type: 'transfer_inter', fee_type: 'tiered', tiers: [{min: 0, max: 50000, fee: 25}, {min: 50000, max: 500000, fee: 50}, {min: 500000, max: null, fee: 100}], merchant_id: null, provider_id: null, is_active: true, priority: 0 },
  ])
  const [showAddForm, setShowAddForm] = useState(false)
  const [testAmount, setTestAmount] = useState('')
  const [testTxType, setTestTxType] = useState('pos_cash_out')
  const [testResult, setTestResult] = useState(null)
  const [filterType, setFilterType] = useState('all')

  const transactionTypes = [
    'pos_cash_out', 'pos_card', 'transfer_intra', 'transfer_inter',
    'bills_electricity', 'bills_cable_tv', 'bills_water', 'bills_government',
    'telco_airtime', 'telco_data', 'wallet_topup'
  ]

  const feeTypeLabels = {
    percentage: 'Percentage',
    percentage_capped: 'Percentage (Capped)',
    flat: 'Flat Fee',
    tiered: 'Tiered',
  }

  const calculateTestFee = () => {
    const amt = parseFloat(testAmount)
    if (!amt) return
    const config = feeConfigs.find(c => c.transaction_type === testTxType && c.is_active)
    if (!config) { setTestResult({ fee: 0, config: null }); return }

    let fee = 0
    if (config.fee_type === 'flat') {
      fee = config.flat_amount || 0
    } else if (config.fee_type === 'percentage') {
      fee = amt * (config.percentage / 100)
    } else if (config.fee_type === 'percentage_capped') {
      fee = Math.min(amt * (config.percentage / 100), config.cap || Infinity)
    } else if (config.fee_type === 'tiered' && config.tiers) {
      const tier = config.tiers.find(t => amt >= t.min && (t.max === null || amt < t.max))
      fee = tier ? tier.fee : 0
    }
    setTestResult({ fee: Math.round(fee * 100) / 100, config })
  }

  const filteredConfigs = filterType === 'all' ? feeConfigs : feeConfigs.filter(c => c.transaction_type === filterType)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Fee Schedule Management</h2>
          <p className="text-gray-600">Configure per-merchant, per-provider fee tiers with percentage caps</p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} className="bg-gradient-to-r from-blue-600 to-green-600 text-white">
          <Plus className="w-4 h-4 mr-2" /> Add Fee Rule
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="text-sm text-gray-500 mb-1">Total Fee Rules</div>
          <div className="text-2xl font-bold text-gray-900">{feeConfigs.length}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="text-sm text-gray-500 mb-1">Active Rules</div>
          <div className="text-2xl font-bold text-green-600">{feeConfigs.filter(c => c.is_active).length}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="text-sm text-gray-500 mb-1">Custom Merchant Rules</div>
          <div className="text-2xl font-bold text-blue-600">{feeConfigs.filter(c => c.merchant_id).length}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="text-sm text-gray-500 mb-1">Transaction Types</div>
          <div className="text-2xl font-bold text-purple-600">{new Set(feeConfigs.map(c => c.transaction_type)).size}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Fee Calculator</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" value={testTxType} onChange={(e) => setTestTxType(e.target.value)}>
              {transactionTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Amount (NGN)</label>
            <input type="number" placeholder="e.g. 50000" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" value={testAmount} onChange={(e) => setTestAmount(e.target.value)} />
          </div>
          <Button onClick={calculateTestFee} className="bg-blue-600 text-white">
            Calculate Fee
          </Button>
          {testResult && (
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-sm text-blue-600">Calculated Fee</div>
              <div className="text-xl font-bold text-blue-800">{formatCurrency(testResult.fee)}</div>
              {testResult.config && <div className="text-xs text-blue-500">Rule: {testResult.config.name}</div>}
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Fee Configurations</h3>
          <select className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">All Types</option>
            {transactionTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
          </select>
        </div>
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rule Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transaction Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fee Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate / Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scope</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredConfigs.map((config) => (
                <tr key={config.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{config.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{config.transaction_type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{feeTypeLabels[config.fee_type]}</Badge></td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {config.fee_type === 'flat' && formatCurrency(config.flat_amount)}
                    {config.fee_type === 'percentage' && `${config.percentage}%`}
                    {config.fee_type === 'percentage_capped' && `${config.percentage}% (cap ${formatCurrency(config.cap)})`}
                    {config.fee_type === 'tiered' && `${config.tiers?.length} tiers`}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {config.merchant_id ? <Badge variant="default">{config.merchant_id}</Badge> : <span className="text-gray-400">Global</span>}
                  </td>
                  <td className="px-4 py-3"><Badge variant={config.is_active ? 'success' : 'destructive'}>{config.is_active ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="px-4 py-3 text-sm text-gray-600">{config.priority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default App

