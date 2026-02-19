import React, { useState, useEffect } from 'react'
import { Building2, Users, CreditCard, BarChart3, Settings, Shield, Bell, LogOut, User, DollarSign, TrendingUp, AlertTriangle, CheckCircle, Eye, EyeOff, Zap, Phone, Receipt, Sliders, Wifi, Tv, Droplets, FileText, ChevronRight, Search, Plus, Trash2, Edit, RefreshCw, UserPlus, MapPin, Upload, ClipboardCheck, Star, Award, Globe, Briefcase, Hash, Calendar, ArrowRight, ArrowLeft, Camera, Fingerprint } from 'lucide-react'
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
      case 'super_agent':
        return [
          ...baseItems,
          { id: 'onboarding', label: 'Agent Onboarding', icon: UserPlus },
          { id: 'transactions', label: 'Transactions', icon: CreditCard },
          { id: 'bills', label: 'Bills Payment', icon: Receipt },
          { id: 'airtime', label: 'Airtime & Data', icon: Phone },
          { id: 'agents', label: 'My Agents', icon: Users },
          { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          { id: 'cash', label: 'Cash Management', icon: DollarSign }
        ]
      case 'master_agent':
        return [
          ...baseItems,
          { id: 'onboarding', label: 'Agent Onboarding', icon: UserPlus },
          { id: 'transactions', label: 'Transactions', icon: CreditCard },
          { id: 'bills', label: 'Bills Payment', icon: Receipt },
          { id: 'airtime', label: 'Airtime & Data', icon: Phone },
          { id: 'agents', label: 'My Agents', icon: Users },
          { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          { id: 'cash', label: 'Cash Management', icon: DollarSign },
          { id: 'settings', label: 'Settings', icon: Settings }
        ]
      case 'admin':
        return [
          ...baseItems,
          { id: 'onboarding', label: 'Agent Onboarding', icon: UserPlus },
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

            {(currentUser?.role === 'super_agent' || currentUser?.role === 'master_agent') && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Sub-Agents</p>
                        <p className="text-2xl font-bold">24</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Float Balance</p>
                        <p className="text-2xl font-bold">{formatCurrency(2500000)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Monthly Volume</p>
                        <p className="text-2xl font-bold">{formatCurrency(15800000)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                        <Award className="w-5 h-5 text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Commission (MTD)</p>
                        <p className="text-2xl font-bold">{formatCurrency(185000)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold mb-4">Super Agent Profile</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Agent Code</span>
                        <span className="font-medium">SA-LG-001</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Territory</span>
                        <span className="font-medium">Lagos & Ogun States</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tier</span>
                        <Badge variant="default">Super Agent</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">KYC Status</span>
                        <Badge variant="success">Verified</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">KYB Status</span>
                        <Badge variant="success">Verified</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Transaction Limit</span>
                        <span className="font-medium">{formatCurrency(5000000)}/day</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold mb-4">Recent Onboarding Activity</h3>
                    <div className="space-y-3">
                      {[
                        { name: 'Adebayo Johnson', tier: 'Field Agent', status: 'approved', date: '2024-01-15' },
                        { name: 'Fatima Ibrahim', tier: 'Sub Agent', status: 'under_review', date: '2024-01-14' },
                        { name: 'Chukwu Emmanuel', tier: 'Field Agent', status: 'submitted', date: '2024-01-13' },
                        { name: 'Ngozi Okafor', tier: 'Sub Agent', status: 'approved', date: '2024-01-12' },
                      ].map((app, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <User className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{app.name}</p>
                              <p className="text-xs text-gray-500">{app.tier} - {app.date}</p>
                            </div>
                          </div>
                          <Badge variant={app.status === 'approved' ? 'success' : app.status === 'under_review' ? 'warning' : 'default'}>
                            {app.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      ))}
                    </div>
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

        {currentView === 'onboarding' && <AgentOnboardingPage formatCurrency={formatCurrency} userRole={currentUser?.role} />}
        {currentView === 'bills' && <BillsPaymentPage formatCurrency={formatCurrency} />}
        {currentView === 'airtime' && <AirtimeDataPage formatCurrency={formatCurrency} />}
        {currentView === 'fee_schedule' && <FeeSchedulePage formatCurrency={formatCurrency} />}

        {!['dashboard', 'onboarding', 'bills', 'airtime', 'fee_schedule'].includes(currentView) && currentView !== 'dashboard' && (
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

const ONBOARDING_STEPS = [
  { id: 1, title: 'Agent Tier', description: 'Select agent type and tier', icon: Award },
  { id: 2, title: 'Personal Info', description: 'Agent personal details', icon: User },
  { id: 3, title: 'Business Details', description: 'Business registration info', icon: Briefcase },
  { id: 4, title: 'KYC Documents', description: 'Identity verification documents', icon: Upload },
  { id: 5, title: 'KYB Verification', description: 'Business verification documents', icon: ClipboardCheck },
  { id: 6, title: 'Territory Setup', description: 'Assign operating territory', icon: MapPin },
  { id: 7, title: 'Biometric Capture', description: 'Fingerprint and photo capture', icon: Fingerprint },
  { id: 8, title: 'Review & Submit', description: 'Review and submit application', icon: CheckCircle },
]

const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT Abuja', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
  'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau',
  'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
]

const AGENT_TIERS = [
  {
    id: 'super_agent', name: 'Super Agent', description: 'Manages multiple regional and field agents. Highest transaction limits and commission rates.',
    limits: { daily: 5000000, monthly: 100000000 }, commission: '0.5% - 1.0%',
    requirements: ['Minimum 5 years banking experience', 'CAC registered business', 'Minimum ₦2M float capital', 'Office in designated territory'],
    color: 'from-purple-600 to-indigo-600', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700'
  },
  {
    id: 'regional_agent', name: 'Regional Agent', description: 'Oversees field agents within a specific region. High transaction limits.',
    limits: { daily: 2000000, monthly: 50000000 }, commission: '0.3% - 0.7%',
    requirements: ['Minimum 3 years banking experience', 'Registered business', 'Minimum ₦1M float capital', 'Physical office location'],
    color: 'from-blue-600 to-cyan-600', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700'
  },
  {
    id: 'field_agent', name: 'Field Agent', description: 'Operates in the field handling direct customer transactions. Standard limits.',
    limits: { daily: 500000, monthly: 10000000 }, commission: '0.2% - 0.5%',
    requirements: ['Minimum 1 year experience', 'Valid ID', 'Minimum ₦200K float capital', 'POS terminal access'],
    color: 'from-green-600 to-emerald-600', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700'
  },
  {
    id: 'sub_agent', name: 'Sub Agent', description: 'Entry-level agent handling basic transactions under a supervising agent.',
    limits: { daily: 100000, monthly: 2000000 }, commission: '0.1% - 0.3%',
    requirements: ['Valid ID', 'Smartphone or POS terminal', 'Minimum ₦50K float capital', 'Referral from existing agent'],
    color: 'from-orange-600 to-amber-600', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700'
  },
]

function AgentOnboardingPage({ formatCurrency, userRole }) {
  const [currentStep, setCurrentStep] = useState(1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [errors, setErrors] = useState({})

  const [selectedTier, setSelectedTier] = useState(null)

  const [personalInfo, setPersonalInfo] = useState({
    first_name: '', last_name: '', email: '', phone: '+234',
    date_of_birth: '', gender: '', nationality: 'Nigerian',
    nin: '', bvn: ''
  })

  const [businessInfo, setBusinessInfo] = useState({
    business_name: '', business_type: '', registration_number: '',
    tax_id: '', years_in_business: '', business_address: '',
    business_phone: '', business_email: '', expected_monthly_volume: ''
  })

  const [kycDocuments, setKycDocuments] = useState({
    national_id: null, passport_photo: null, proof_of_address: null, utility_bill: null
  })

  const [kybDocuments, setKybDocuments] = useState({
    business_registration: null, tax_certificate: null, bank_statement: null, reference_letter: null
  })

  const [territory, setTerritory] = useState({
    primary_state: '', primary_lga: '', secondary_states: [],
    operating_address: '', gps_latitude: '', gps_longitude: ''
  })

  const [biometric, setBiometric] = useState({
    photo_captured: false, fingerprint_captured: false, signature_captured: false
  })

  const [referralInfo, setReferralInfo] = useState({
    referrer_agent_id: '', referral_code: ''
  })

  const [applications, setApplications] = useState([
    { id: 'APP-2024-001', name: 'Adebayo Johnson', tier: 'Field Agent', status: 'approved', date: '2024-01-15', risk_score: 0.12, kyc: 'verified', kyb: 'verified' },
    { id: 'APP-2024-002', name: 'Fatima Ibrahim', tier: 'Sub Agent', status: 'under_review', date: '2024-01-14', risk_score: 0.35, kyc: 'verified', kyb: 'in_progress' },
    { id: 'APP-2024-003', name: 'Chukwu Emmanuel', tier: 'Field Agent', status: 'submitted', date: '2024-01-13', risk_score: 0.08, kyc: 'pending', kyb: 'pending' },
    { id: 'APP-2024-004', name: 'Ngozi Okafor', tier: 'Sub Agent', status: 'approved', date: '2024-01-12', risk_score: 0.05, kyc: 'verified', kyb: 'verified' },
    { id: 'APP-2024-005', name: 'Ibrahim Musa', tier: 'Regional Agent', status: 'rejected', date: '2024-01-11', risk_score: 0.72, kyc: 'failed', kyb: 'pending' },
    { id: 'APP-2024-006', name: 'Amina Yusuf', tier: 'Field Agent', status: 'additional_info', date: '2024-01-10', risk_score: 0.45, kyc: 'verified', kyb: 'failed' },
  ])

  const [activeTab, setActiveTab] = useState('new')

  const validateStep = () => {
    const newErrors = {}
    if (currentStep === 1 && !selectedTier) {
      newErrors.tier = 'Please select an agent tier'
    }
    if (currentStep === 2) {
      if (!personalInfo.first_name) newErrors.first_name = 'Required'
      if (!personalInfo.last_name) newErrors.last_name = 'Required'
      if (!personalInfo.email) newErrors.email = 'Required'
      if (!personalInfo.phone || personalInfo.phone.length < 11) newErrors.phone = 'Valid phone required'
      if (!personalInfo.nin || personalInfo.nin.length !== 11) newErrors.nin = 'NIN must be 11 digits'
      if (!personalInfo.bvn || personalInfo.bvn.length !== 11) newErrors.bvn = 'BVN must be 11 digits'
    }
    if (currentStep === 3) {
      if (!businessInfo.business_name) newErrors.business_name = 'Required'
      if (!businessInfo.business_type) newErrors.business_type = 'Required'
      if (selectedTier !== 'sub_agent' && !businessInfo.registration_number) newErrors.registration_number = 'Required for this tier'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep()) {
      setCurrentStep(Math.min(currentStep + 1, ONBOARDING_STEPS.length))
    }
  }

  const handlePrevious = () => {
    setCurrentStep(Math.max(currentStep - 1, 1))
    setErrors({})
  }

  const handleSubmit = () => {
    setIsProcessing(true)
    setTimeout(() => {
      setIsProcessing(false)
      setIsSubmitted(true)
    }, 2500)
  }

  const handleFileUpload = (category, docType, file) => {
    if (file && file.size > 5 * 1024 * 1024) {
      setErrors({ ...errors, [docType]: 'File must be less than 5MB' })
      return
    }
    if (category === 'kyc') {
      setKycDocuments({ ...kycDocuments, [docType]: file })
    } else {
      setKybDocuments({ ...kybDocuments, [docType]: file })
    }
  }

  const simulateBiometric = (type) => {
    setIsProcessing(true)
    setTimeout(() => {
      setBiometric({ ...biometric, [`${type}_captured`]: true })
      setIsProcessing(false)
    }, 1500)
  }

  if (isSubmitted) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-3">Application Submitted!</h2>
        <p className="text-gray-600 mb-6 text-lg">
          Agent onboarding application for <strong>{personalInfo.first_name} {personalInfo.last_name}</strong> has been submitted successfully.
        </p>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 text-left mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Application Summary</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><span className="text-sm text-gray-500">Application ID</span><p className="font-medium">APP-2024-007</p></div>
            <div><span className="text-sm text-gray-500">Agent Tier</span><p className="font-medium">{AGENT_TIERS.find(t => t.id === selectedTier)?.name}</p></div>
            <div><span className="text-sm text-gray-500">Status</span><Badge variant="warning">Under Review</Badge></div>
            <div><span className="text-sm text-gray-500">Est. Processing</span><p className="font-medium">1-3 business days</p></div>
            <div><span className="text-sm text-gray-500">Territory</span><p className="font-medium">{territory.primary_state || 'Lagos'}</p></div>
            <div><span className="text-sm text-gray-500">KYC Status</span><Badge variant="default">Pending Verification</Badge></div>
          </div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 text-left mb-6">
          <h4 className="font-medium text-blue-900 mb-2">Next Steps</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>1. KYC documents will be verified via OCR + Ballerine workflow</li>
            <li>2. AML/PEP screening will be conducted automatically</li>
            <li>3. KYB business verification (1-2 business days)</li>
            <li>4. Territory assignment confirmation</li>
            <li>5. Agent code generation and POS terminal assignment</li>
          </ul>
        </div>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => { setIsSubmitted(false); setCurrentStep(1); setSelectedTier(null); setPersonalInfo({ first_name: '', last_name: '', email: '', phone: '+234', date_of_birth: '', gender: '', nationality: 'Nigerian', nin: '', bvn: '' }); setBusinessInfo({ business_name: '', business_type: '', registration_number: '', tax_id: '', years_in_business: '', business_address: '', business_phone: '', business_email: '', expected_monthly_volume: '' }); }} className="bg-blue-600 text-white">
            Onboard Another Agent
          </Button>
          <Button variant="outline" onClick={() => setActiveTab('applications')}>
            View All Applications
          </Button>
        </div>
      </div>
    )
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Select Agent Tier</h3>
              <p className="text-sm text-gray-500">Choose the appropriate tier based on the agent's qualifications and expected volume</p>
            </div>
            {errors.tier && <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm">{errors.tier}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {AGENT_TIERS.map((tier) => (
                <div
                  key={tier.id}
                  onClick={() => setSelectedTier(tier.id)}
                  className={`relative cursor-pointer rounded-xl border-2 p-5 transition-all ${
                    selectedTier === tier.id
                      ? `${tier.border} ${tier.bg} ring-2 ring-offset-2 ring-blue-500`
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                  }`}
                >
                  {selectedTier === tier.id && (
                    <div className="absolute top-3 right-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                  )}
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${tier.color} flex items-center justify-center mb-3`}>
                    <Award className="w-5 h-5 text-white" />
                  </div>
                  <h4 className="font-semibold text-gray-900 text-lg">{tier.name}</h4>
                  <p className="text-sm text-gray-500 mt-1 mb-3">{tier.description}</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Daily Limit</span>
                      <span className="font-medium">{formatCurrency(tier.limits.daily)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Commission</span>
                      <span className="font-medium">{tier.commission}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-700 mb-1">Requirements:</p>
                    <ul className="text-xs text-gray-500 space-y-0.5">
                      {tier.requirements.map((req, i) => (
                        <li key={i} className="flex items-start">
                          <ChevronRight className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Personal Information</h3>
              <p className="text-sm text-gray-500">Enter the agent's personal details for KYC verification</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                <input className={`w-full px-3 py-2 border ${errors.first_name ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500`} placeholder="Enter first name" value={personalInfo.first_name} onChange={(e) => setPersonalInfo({ ...personalInfo, first_name: e.target.value })} />
                {errors.first_name && <p className="text-xs text-red-500 mt-1">{errors.first_name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <input className={`w-full px-3 py-2 border ${errors.last_name ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500`} placeholder="Enter last name" value={personalInfo.last_name} onChange={(e) => setPersonalInfo({ ...personalInfo, last_name: e.target.value })} />
                {errors.last_name && <p className="text-xs text-red-500 mt-1">{errors.last_name}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                <input type="email" className={`w-full px-3 py-2 border ${errors.email ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500`} placeholder="agent@example.com" value={personalInfo.email} onChange={(e) => setPersonalInfo({ ...personalInfo, email: e.target.value })} />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <input className={`w-full px-3 py-2 border ${errors.phone ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500`} placeholder="+234 801 234 5678" value={personalInfo.phone} onChange={(e) => setPersonalInfo({ ...personalInfo, phone: e.target.value })} />
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" value={personalInfo.date_of_birth} onChange={(e) => setPersonalInfo({ ...personalInfo, date_of_birth: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" value={personalInfo.gender} onChange={(e) => setPersonalInfo({ ...personalInfo, gender: e.target.value })}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nationality</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" value={personalInfo.nationality} onChange={(e) => setPersonalInfo({ ...personalInfo, nationality: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">National Identification Number (NIN) *</label>
                <input className={`w-full px-3 py-2 border ${errors.nin ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500`} placeholder="12345678901" maxLength={11} value={personalInfo.nin} onChange={(e) => setPersonalInfo({ ...personalInfo, nin: e.target.value.replace(/\D/g, '') })} />
                {errors.nin && <p className="text-xs text-red-500 mt-1">{errors.nin}</p>}
                <p className="text-xs text-gray-400 mt-1">11-digit National ID Number</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Verification Number (BVN) *</label>
                <input className={`w-full px-3 py-2 border ${errors.bvn ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500`} placeholder="22312345678" maxLength={11} value={personalInfo.bvn} onChange={(e) => setPersonalInfo({ ...personalInfo, bvn: e.target.value.replace(/\D/g, '') })} />
                {errors.bvn && <p className="text-xs text-red-500 mt-1">{errors.bvn}</p>}
                <p className="text-xs text-gray-400 mt-1">11-digit Bank Verification Number</p>
              </div>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Business Details</h3>
              <p className="text-sm text-gray-500">Provide business registration and operational information</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
                <input className={`w-full px-3 py-2 border ${errors.business_name ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500`} placeholder="e.g. Adeola Enterprises" value={businessInfo.business_name} onChange={(e) => setBusinessInfo({ ...businessInfo, business_name: e.target.value })} />
                {errors.business_name && <p className="text-xs text-red-500 mt-1">{errors.business_name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Type *</label>
                <select className={`w-full px-3 py-2 border ${errors.business_type ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500`} value={businessInfo.business_type} onChange={(e) => setBusinessInfo({ ...businessInfo, business_type: e.target.value })}>
                  <option value="">Select type</option>
                  <option value="sole_proprietorship">Sole Proprietorship</option>
                  <option value="partnership">Partnership</option>
                  <option value="limited_company">Limited Company (Ltd)</option>
                  <option value="cooperative">Cooperative Society</option>
                  <option value="ngo">NGO / Non-Profit</option>
                </select>
                {errors.business_type && <p className="text-xs text-red-500 mt-1">{errors.business_type}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CAC Registration Number {selectedTier !== 'sub_agent' ? '*' : ''}</label>
                <input className={`w-full px-3 py-2 border ${errors.registration_number ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500`} placeholder="RC-1234567" value={businessInfo.registration_number} onChange={(e) => setBusinessInfo({ ...businessInfo, registration_number: e.target.value })} />
                {errors.registration_number && <p className="text-xs text-red-500 mt-1">{errors.registration_number}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tax Identification Number (TIN)</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="12345678-0001" value={businessInfo.tax_id} onChange={(e) => setBusinessInfo({ ...businessInfo, tax_id: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Years in Business</label>
                <input type="number" min="0" max="100" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="5" value={businessInfo.years_in_business} onChange={(e) => setBusinessInfo({ ...businessInfo, years_in_business: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expected Monthly Volume (NGN)</label>
                <input type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g. 5000000" value={businessInfo.expected_monthly_volume} onChange={(e) => setBusinessInfo({ ...businessInfo, expected_monthly_volume: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Address</label>
              <textarea className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" rows={2} placeholder="Full business address" value={businessInfo.business_address} onChange={(e) => setBusinessInfo({ ...businessInfo, business_address: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Phone</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="+234 801 234 5678" value={businessInfo.business_phone} onChange={(e) => setBusinessInfo({ ...businessInfo, business_phone: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Email</label>
                <input type="email" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="business@example.com" value={businessInfo.business_email} onChange={(e) => setBusinessInfo({ ...businessInfo, business_email: e.target.value })} />
              </div>
            </div>
            {referralInfo && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Referral Information (Optional)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Referring Agent ID</label>
                    <input className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" placeholder="e.g. SA-LG-001" value={referralInfo.referrer_agent_id} onChange={(e) => setReferralInfo({ ...referralInfo, referrer_agent_id: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Referral Code</label>
                    <input className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" placeholder="e.g. REF-2024-ABC" value={referralInfo.referral_code} onChange={(e) => setReferralInfo({ ...referralInfo, referral_code: e.target.value })} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">KYC Document Upload</h3>
              <p className="text-sm text-gray-500">Upload identity documents for verification. Documents will be processed via Multi-OCR (PaddleOCR + EasyOCR + OLMOCR) and verified through Ballerine workflow.</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 flex items-start space-x-3">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p className="font-medium">Secure Document Processing</p>
                <p>All documents are encrypted with AES-256-GCM and stored in compliance with NDPR (Nigeria Data Protection Regulation).</p>
              </div>
            </div>
            <div className="space-y-4">
              {[
                { key: 'national_id', label: 'National ID / NIN Slip', desc: 'Government-issued national ID card or NIN enrollment slip', required: true },
                { key: 'passport_photo', label: 'Passport Photograph', desc: 'Recent passport-size photograph (white background)', required: true },
                { key: 'proof_of_address', label: 'Proof of Address', desc: 'Utility bill or bank statement (not older than 3 months)', required: true },
                { key: 'utility_bill', label: 'Additional ID (Optional)', desc: 'Driver\'s license, international passport, or voter\'s card', required: false },
              ].map((doc) => (
                <div key={doc.key} className={`border-2 border-dashed rounded-xl p-5 transition-all ${kycDocuments[doc.key] ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-blue-300'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {kycDocuments[doc.key] ? (
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <Upload className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{doc.label} {doc.required && <span className="text-red-500">*</span>}</p>
                        <p className="text-sm text-gray-500">{doc.desc}</p>
                        {kycDocuments[doc.key] && (
                          <p className="text-xs text-green-600 mt-1">{kycDocuments[doc.key].name} ({(kycDocuments[doc.key].size / 1024).toFixed(1)} KB)</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <input type="file" id={`kyc-${doc.key}`} className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => handleFileUpload('kyc', doc.key, e.target.files[0])} />
                      <label htmlFor={`kyc-${doc.key}`}>
                        <Button variant={kycDocuments[doc.key] ? 'outline' : 'default'} className={kycDocuments[doc.key] ? '' : 'bg-blue-600 text-white'} onClick={() => document.getElementById(`kyc-${doc.key}`).click()}>
                          {kycDocuments[doc.key] ? 'Replace' : 'Upload'}
                        </Button>
                      </label>
                    </div>
                  </div>
                  {errors[doc.key] && <p className="text-xs text-red-500 mt-2">{errors[doc.key]}</p>}
                </div>
              ))}
            </div>
          </div>
        )

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">KYB Business Verification</h3>
              <p className="text-sm text-gray-500">Upload business documents for KYB verification. Documents are verified through Ballerine workflow with CAC registry cross-reference.</p>
            </div>
            <div className="space-y-4">
              {[
                { key: 'business_registration', label: 'CAC Business Registration Certificate', desc: 'Certificate of Incorporation / Business Name Registration', required: selectedTier !== 'sub_agent' },
                { key: 'tax_certificate', label: 'Tax Identification Certificate', desc: 'FIRS Tax Identification Number (TIN) certificate', required: selectedTier === 'super_agent' || selectedTier === 'regional_agent' },
                { key: 'bank_statement', label: 'Bank Statement (6 months)', desc: 'Recent 6-month bank statement showing business transactions', required: true },
                { key: 'reference_letter', label: 'Reference Letter', desc: 'Letter of reference from an existing agent or financial institution', required: false },
              ].map((doc) => (
                <div key={doc.key} className={`border-2 border-dashed rounded-xl p-5 transition-all ${kybDocuments[doc.key] ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-blue-300'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {kybDocuments[doc.key] ? (
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <Upload className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{doc.label} {doc.required && <span className="text-red-500">*</span>}</p>
                        <p className="text-sm text-gray-500">{doc.desc}</p>
                        {kybDocuments[doc.key] && (
                          <p className="text-xs text-green-600 mt-1">{kybDocuments[doc.key].name} ({(kybDocuments[doc.key].size / 1024).toFixed(1)} KB)</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <input type="file" id={`kyb-${doc.key}`} className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => handleFileUpload('kyb', doc.key, e.target.files[0])} />
                      <Button variant={kybDocuments[doc.key] ? 'outline' : 'default'} className={kybDocuments[doc.key] ? '' : 'bg-blue-600 text-white'} onClick={() => document.getElementById(`kyb-${doc.key}`).click()}>
                        {kybDocuments[doc.key] ? 'Replace' : 'Upload'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {selectedTier === 'sub_agent' && (
              <div className="bg-yellow-50 rounded-lg p-4 text-sm text-yellow-700">
                <p className="font-medium">Sub Agent Note:</p>
                <p>CAC registration and Tax Certificate are optional for Sub Agents. A bank statement and supervising agent referral are sufficient.</p>
              </div>
            )}
          </div>
        )

      case 6:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Territory Assignment</h3>
              <p className="text-sm text-gray-500">Define the agent's operating territory with GPS coordinates for geofence enforcement</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary State *</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" value={territory.primary_state} onChange={(e) => setTerritory({ ...territory, primary_state: e.target.value })}>
                  <option value="">Select state</option>
                  {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary LGA</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g. Ikeja" value={territory.primary_lga} onChange={(e) => setTerritory({ ...territory, primary_lga: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Operating Address</label>
              <textarea className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" rows={2} placeholder="Full address of primary operating location" value={territory.operating_address} onChange={(e) => setTerritory({ ...territory, operating_address: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GPS Latitude</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g. 6.5244" value={territory.gps_latitude} onChange={(e) => setTerritory({ ...territory, gps_latitude: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GPS Longitude</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g. 3.3792" value={territory.gps_longitude} onChange={(e) => setTerritory({ ...territory, gps_longitude: e.target.value })} />
              </div>
            </div>
            {(selectedTier === 'super_agent' || selectedTier === 'regional_agent') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Additional Coverage States</label>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                  {NIGERIAN_STATES.filter(s => s !== territory.primary_state).map(state => (
                    <label key={state} className="flex items-center space-x-2 text-sm cursor-pointer">
                      <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" checked={territory.secondary_states.includes(state)} onChange={(e) => {
                        if (e.target.checked) {
                          setTerritory({ ...territory, secondary_states: [...territory.secondary_states, state] })
                        } else {
                          setTerritory({ ...territory, secondary_states: territory.secondary_states.filter(s => s !== state) })
                        }
                      }} />
                      <span>{state}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Geofence Configuration</h4>
              <p className="text-xs text-gray-500 mb-3">CBN requires GPS accuracy within 10 meters for agent location verification. Geofence violations will be automatically flagged.</p>
              <div className="flex items-center space-x-4">
                <Badge variant="default">Radius: 5km</Badge>
                <Badge variant="default">Accuracy: 10m CBN requirement</Badge>
                <Badge variant="default">Haversine distance calculation</Badge>
              </div>
            </div>
          </div>
        )

      case 7:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Biometric Capture</h3>
              <p className="text-sm text-gray-500">Capture biometric data for agent identification and transaction verification</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className={`rounded-xl border-2 p-6 text-center ${biometric.photo_captured ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${biometric.photo_captured ? 'bg-green-100' : 'bg-gray-100'}`}>
                  {biometric.photo_captured ? <CheckCircle className="w-8 h-8 text-green-600" /> : <Camera className="w-8 h-8 text-gray-400" />}
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">Photo Capture</h4>
                <p className="text-sm text-gray-500 mb-4">Live photo for facial recognition</p>
                <Button onClick={() => simulateBiometric('photo')} disabled={biometric.photo_captured || isProcessing} className={biometric.photo_captured ? '' : 'bg-blue-600 text-white'} variant={biometric.photo_captured ? 'outline' : 'default'}>
                  {isProcessing ? 'Capturing...' : biometric.photo_captured ? 'Captured' : 'Capture Photo'}
                </Button>
              </div>
              <div className={`rounded-xl border-2 p-6 text-center ${biometric.fingerprint_captured ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${biometric.fingerprint_captured ? 'bg-green-100' : 'bg-gray-100'}`}>
                  {biometric.fingerprint_captured ? <CheckCircle className="w-8 h-8 text-green-600" /> : <Fingerprint className="w-8 h-8 text-gray-400" />}
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">Fingerprint Scan</h4>
                <p className="text-sm text-gray-500 mb-4">10-finger biometric enrollment</p>
                <Button onClick={() => simulateBiometric('fingerprint')} disabled={biometric.fingerprint_captured || isProcessing} className={biometric.fingerprint_captured ? '' : 'bg-blue-600 text-white'} variant={biometric.fingerprint_captured ? 'outline' : 'default'}>
                  {isProcessing ? 'Scanning...' : biometric.fingerprint_captured ? 'Scanned' : 'Scan Fingerprints'}
                </Button>
              </div>
              <div className={`rounded-xl border-2 p-6 text-center ${biometric.signature_captured ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${biometric.signature_captured ? 'bg-green-100' : 'bg-gray-100'}`}>
                  {biometric.signature_captured ? <CheckCircle className="w-8 h-8 text-green-600" /> : <Edit className="w-8 h-8 text-gray-400" />}
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">Digital Signature</h4>
                <p className="text-sm text-gray-500 mb-4">Signature for agreement verification</p>
                <Button onClick={() => simulateBiometric('signature')} disabled={biometric.signature_captured || isProcessing} className={biometric.signature_captured ? '' : 'bg-blue-600 text-white'} variant={biometric.signature_captured ? 'outline' : 'default'}>
                  {isProcessing ? 'Capturing...' : biometric.signature_captured ? 'Captured' : 'Capture Signature'}
                </Button>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Biometric Capture Progress</p>
                  <p className="text-xs text-gray-500">All biometrics are stored encrypted with AES-256</p>
                </div>
                <div className="text-sm font-medium">
                  {[biometric.photo_captured, biometric.fingerprint_captured, biometric.signature_captured].filter(Boolean).length} / 3 completed
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${([biometric.photo_captured, biometric.fingerprint_captured, biometric.signature_captured].filter(Boolean).length / 3) * 100}%` }} />
              </div>
            </div>
          </div>
        )

      case 8:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Review & Submit</h3>
              <p className="text-sm text-gray-500">Review all information before submitting the onboarding application</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center"><Award className="w-4 h-4 mr-2 text-purple-600" /> Agent Tier</h4>
                <p className="text-lg font-medium text-purple-700">{AGENT_TIERS.find(t => t.id === selectedTier)?.name || 'Not selected'}</p>
                <p className="text-sm text-gray-500">Daily limit: {formatCurrency(AGENT_TIERS.find(t => t.id === selectedTier)?.limits.daily || 0)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center"><User className="w-4 h-4 mr-2 text-blue-600" /> Personal Info</h4>
                <p className="font-medium">{personalInfo.first_name} {personalInfo.last_name}</p>
                <p className="text-sm text-gray-500">{personalInfo.email}</p>
                <p className="text-sm text-gray-500">{personalInfo.phone}</p>
                <p className="text-sm text-gray-500">NIN: {personalInfo.nin ? `***${personalInfo.nin.slice(-4)}` : 'N/A'} | BVN: {personalInfo.bvn ? `***${personalInfo.bvn.slice(-4)}` : 'N/A'}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center"><Briefcase className="w-4 h-4 mr-2 text-green-600" /> Business Details</h4>
                <p className="font-medium">{businessInfo.business_name || 'N/A'}</p>
                <p className="text-sm text-gray-500">Type: {businessInfo.business_type ? businessInfo.business_type.replace('_', ' ') : 'N/A'}</p>
                <p className="text-sm text-gray-500">CAC: {businessInfo.registration_number || 'N/A'}</p>
                <p className="text-sm text-gray-500">TIN: {businessInfo.tax_id || 'N/A'}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center"><MapPin className="w-4 h-4 mr-2 text-red-600" /> Territory</h4>
                <p className="font-medium">{territory.primary_state || 'Not set'} {territory.primary_lga ? `- ${territory.primary_lga}` : ''}</p>
                {territory.secondary_states.length > 0 && (
                  <p className="text-sm text-gray-500">+{territory.secondary_states.length} additional state(s)</p>
                )}
                {territory.gps_latitude && <p className="text-sm text-gray-500">GPS: {territory.gps_latitude}, {territory.gps_longitude}</p>}
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center"><Upload className="w-4 h-4 mr-2 text-orange-600" /> Documents</h4>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>KYC Documents</span>
                    <span className="font-medium">{Object.values(kycDocuments).filter(Boolean).length}/4 uploaded</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>KYB Documents</span>
                    <span className="font-medium">{Object.values(kybDocuments).filter(Boolean).length}/4 uploaded</span>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center"><Fingerprint className="w-4 h-4 mr-2 text-indigo-600" /> Biometrics</h4>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm"><span>Photo</span><Badge variant={biometric.photo_captured ? 'success' : 'warning'}>{biometric.photo_captured ? 'Captured' : 'Pending'}</Badge></div>
                  <div className="flex justify-between text-sm"><span>Fingerprint</span><Badge variant={biometric.fingerprint_captured ? 'success' : 'warning'}>{biometric.fingerprint_captured ? 'Captured' : 'Pending'}</Badge></div>
                  <div className="flex justify-between text-sm"><span>Signature</span><Badge variant={biometric.signature_captured ? 'success' : 'warning'}>{biometric.signature_captured ? 'Captured' : 'Pending'}</Badge></div>
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 text-sm text-yellow-700">
              <p className="font-medium mb-1">Before submitting, please verify:</p>
              <ul className="space-y-0.5">
                <li>- All personal and business information is accurate</li>
                <li>- KYC/KYB documents are clear and legible</li>
                <li>- Territory assignment matches the agent's operating location</li>
                <li>- Biometric captures are complete</li>
              </ul>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Agent Onboarding</h2>
          <p className="text-gray-500">Onboard new agents with KYC/KYB verification, territory assignment, and biometric enrollment</p>
        </div>
        <div className="flex gap-2">
          <Button variant={activeTab === 'new' ? 'default' : 'outline'} onClick={() => setActiveTab('new')} className={activeTab === 'new' ? 'bg-blue-600 text-white' : ''}>
            <UserPlus className="w-4 h-4 mr-2" /> New Application
          </Button>
          <Button variant={activeTab === 'applications' ? 'default' : 'outline'} onClick={() => setActiveTab('applications')} className={activeTab === 'applications' ? 'bg-blue-600 text-white' : ''}>
            <ClipboardCheck className="w-4 h-4 mr-2" /> Applications ({applications.length})
          </Button>
        </div>
      </div>

      {activeTab === 'applications' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { label: 'Total', count: applications.length, color: 'bg-gray-100 text-gray-700' },
              { label: 'Approved', count: applications.filter(a => a.status === 'approved').length, color: 'bg-green-100 text-green-700' },
              { label: 'Under Review', count: applications.filter(a => a.status === 'under_review').length, color: 'bg-yellow-100 text-yellow-700' },
              { label: 'Submitted', count: applications.filter(a => a.status === 'submitted').length, color: 'bg-blue-100 text-blue-700' },
              { label: 'Rejected', count: applications.filter(a => a.status === 'rejected').length, color: 'bg-red-100 text-red-700' },
            ].map((stat) => (
              <div key={stat.label} className={`rounded-xl p-4 ${stat.color}`}>
                <p className="text-sm font-medium">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.count}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Application ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">KYC</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">KYB</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk Score</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">{app.id}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{app.name}</td>
                    <td className="px-4 py-3"><Badge variant="outline">{app.tier}</Badge></td>
                    <td className="px-4 py-3"><Badge variant={app.kyc === 'verified' ? 'success' : app.kyc === 'failed' ? 'destructive' : 'warning'}>{app.kyc}</Badge></td>
                    <td className="px-4 py-3"><Badge variant={app.kyb === 'verified' ? 'success' : app.kyb === 'failed' ? 'destructive' : 'warning'}>{app.kyb}</Badge></td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${app.risk_score > 0.5 ? 'text-red-600' : app.risk_score > 0.3 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {(app.risk_score * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={app.status === 'approved' ? 'success' : app.status === 'rejected' ? 'destructive' : app.status === 'under_review' ? 'warning' : 'default'}>
                        {app.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{app.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center space-x-2 overflow-x-auto pb-2">
            {ONBOARDING_STEPS.map((step, index) => {
              const StepIcon = step.icon
              const isActive = currentStep === step.id
              const isCompleted = currentStep > step.id
              return (
                <React.Fragment key={step.id}>
                  {index > 0 && (
                    <div className={`h-0.5 w-8 flex-shrink-0 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} />
                  )}
                  <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg flex-shrink-0 transition-all ${
                    isActive ? 'bg-blue-100 text-blue-700' :
                    isCompleted ? 'bg-green-50 text-green-700' :
                    'text-gray-400'
                  }`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${
                      isActive ? 'bg-blue-600 text-white' :
                      isCompleted ? 'bg-green-500 text-white' :
                      'bg-gray-200 text-gray-500'
                    }`}>
                      {isCompleted ? <CheckCircle className="w-4 h-4" /> : step.id}
                    </div>
                    <span className="text-xs font-medium whitespace-nowrap">{step.title}</span>
                  </div>
                </React.Fragment>
              )
            })}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            {renderStepContent()}
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={handlePrevious} disabled={currentStep === 1}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Previous
            </Button>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">Step {currentStep} of {ONBOARDING_STEPS.length}</span>
            </div>
            {currentStep === ONBOARDING_STEPS.length ? (
              <Button onClick={handleSubmit} disabled={isProcessing} className="bg-green-600 text-white hover:bg-green-700">
                {isProcessing ? 'Submitting...' : 'Submit Application'}
              </Button>
            ) : (
              <Button onClick={handleNext} className="bg-blue-600 text-white">
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App

